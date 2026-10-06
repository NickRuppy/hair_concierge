import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { PGlite } from "@electric-sql/pglite"

import {
  recordTrialPaymentEvent,
  type TrialPaymentEvent,
} from "../src/lib/billing/trial-payment-events"
import { createTrialOfferSnapshot } from "../src/lib/billing/trial-offer"

const ROOT = new URL("../", import.meta.url)
const MIGRATIONS = [
  "supabase/migrations/20260914044650_trial_admission_foundation.sql",
  "supabase/migrations/20260914094203_trial_payment_events.sql",
] as const
const USER = "11111111-1111-4111-8111-111111111111"
const ENROLLMENT = "22222222-2222-4222-8222-222222222222"
const OFFER = createTrialOfferSnapshot("month", {
  monthPriceId: "price_month",
  yearPriceId: "price_year",
  annualCouponId: "coupon_year",
})

async function database(t: { after(fn: () => Promise<void>): void }) {
  const pg = new PGlite()
  t.after(() => pg.close())
  await pg.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE TABLE public.profiles (id uuid PRIMARY KEY); CREATE TABLE public.billing_subscriptions (id uuid PRIMARY KEY);
    GRANT USAGE ON SCHEMA public TO service_role;`)
  for (const file of MIGRATIONS) await pg.exec(await readFile(new URL(file, ROOT), "utf8"))
  return pg
}

async function seed(
  pg: PGlite,
  input: { offer?: unknown; canceled?: boolean; revoked?: boolean; owner?: string | null } = {},
) {
  const owner = input.owner === undefined ? USER : input.owner
  if (owner) await pg.query("INSERT INTO public.profiles(id) VALUES ($1::uuid)", [owner])
  await pg.query(
    `INSERT INTO public.trial_enrollments(id,user_id,accepted_offer,provider,provider_agreement_id,admission_status,authorization_succeeded_at,original_trial_end_at,cancel_at_period_end,access_revoked)
    VALUES($1::uuid,$2::uuid,$3::jsonb,'stripe','agreement','active','2024-01-01T00:00:00Z','2024-01-08T00:00:00Z',$4,$5)`,
    [
      ENROLLMENT,
      owner,
      JSON.stringify(input.offer ?? OFFER),
      input.canceled ?? false,
      input.revoked ?? false,
    ],
  )
}

function event(overrides: Partial<TrialPaymentEvent> = {}): TrialPaymentEvent {
  return {
    provider: "stripe",
    enrollmentId: ENROLLMENT,
    agreementId: "agreement",
    sourceEventId: "evt-1",
    sourceObjectId: "invoice-1",
    outcome: "succeeded",
    occurredAt: "2024-01-31T10:00:00Z",
    amountMinor: 999,
    currency: "EUR",
    periodStartAt: "2024-01-31T10:00:00Z",
    periodEndAt: "2024-02-29T10:00:00Z",
    ...overrides,
  }
}
async function call(pg: PGlite, input: TrialPaymentEvent) {
  const result = await pg.query<{ result: { outcome: string; phase: string } }>(
    "SELECT public.record_trial_payment_event($1::jsonb) AS result",
    [JSON.stringify(input)],
  )
  return result.rows[0]!.result
}
async function enrollment(pg: PGlite) {
  const q = await pg.query<{
    first: string | null
    through: string | null
    failed: boolean
    grace: string | null
  }>(
    "SELECT first_payment_succeeded_at::text AS first, paid_through_at::text AS through, renewal_payment_failed AS failed, renewal_grace_ends_at::text AS grace FROM public.trial_enrollments WHERE id=$1::uuid",
    [ENROLLMENT],
  )
  return q.rows[0]!
}
async function continuationDebt(pg: PGlite) {
  const result = await pg.query<{ count: number; owed: string | null; source_end: string | null }>(
    "SELECT count(*)::int AS count, max(owed_paid_through_at)::text AS owed, max(source_period_end_at)::text AS source_end FROM private.trial_payment_continuation_reconciliations",
  )
  return result.rows[0]!
}

test("records exact first monthly payment, including UTC EOM, and replays without access mutation", async (t) => {
  const pg = await database(t)
  await seed(pg)
  assert.deepEqual(await call(pg, event()), { outcome: "applied", phase: "first_paid" })
  const before = await enrollment(pg)
  assert.match(before.through!, /2024-02-29 10:00:00/)
  assert.equal((await continuationDebt(pg)).count, 0)
  assert.deepEqual(await call(pg, event()), { outcome: "duplicate", phase: "first_paid" })
  assert.deepEqual(await enrollment(pg), before)
})

test("fulfills the first full UTC calendar period and records continuation debt when provider boundaries are seconds late", async (t) => {
  const pg = await database(t)
  await seed(pg)
  const delayed = event({ periodEndAt: "2024-02-29T09:59:59Z" })
  assert.deepEqual(await call(pg, delayed), { outcome: "applied", phase: "first_paid" })
  assert.match((await enrollment(pg)).through!, /2024-02-29 10:00:00/)
  assert.deepEqual(await continuationDebt(pg), {
    count: 1,
    owed: "2024-02-29 10:00:00+00",
    source_end: "2024-02-29 09:59:59+00",
  })
  assert.deepEqual(await call(pg, delayed), { outcome: "duplicate", phase: "first_paid" })
  assert.equal((await continuationDebt(pg)).count, 1)
})

test("days-late first collection fulfills from verified success and keeps the source period as repair evidence", async (t) => {
  const pg = await database(t)
  await seed(pg)
  assert.deepEqual(
    await call(
      pg,
      event({
        occurredAt: "2024-02-03T10:00:00Z",
        periodStartAt: "2024-01-31T10:00:00Z",
        periodEndAt: "2024-02-29T10:00:00Z",
      }),
    ),
    { outcome: "applied", phase: "first_paid" },
  )
  assert.match((await enrollment(pg)).through!, /2024-03-03 10:00:00/)
  assert.deepEqual(await continuationDebt(pg), {
    count: 1,
    owed: "2024-03-03 10:00:00+00",
    source_end: "2024-02-29 10:00:00+00",
  })
})

test("unknown enrollment and failed first collection cannot create paid access or grace", async (t) => {
  const pg = await database(t)
  await seed(pg)
  assert.deepEqual(
    await call(pg, event({ enrollmentId: "33333333-3333-4333-8333-333333333333" })),
    { outcome: "reconciliation_required", phase: "none" },
  )
  assert.deepEqual(await call(pg, event({ outcome: "failed" })), {
    outcome: "applied",
    phase: "none",
  })
  assert.deepEqual(await enrollment(pg), { first: null, through: null, failed: false, grace: null })
})

test("repeated failure deliveries with a new provider time are duplicate facts and never extend grace", async (t) => {
  const pg = await database(t)
  await seed(pg)
  await call(pg, event())
  const failure = event({
    sourceEventId: "failed-1",
    sourceObjectId: "failed-invoice",
    outcome: "failed",
    periodStartAt: "2024-02-29T10:00:00Z",
    periodEndAt: "2024-03-29T10:00:00Z",
    occurredAt: "2024-03-01T10:00:00Z",
  })
  assert.deepEqual(await call(pg, failure), { outcome: "applied", phase: "none" })
  const grace = (await enrollment(pg)).grace
  assert.deepEqual(
    await call(pg, { ...failure, sourceEventId: "failed-2", occurredAt: "2024-03-04T10:00:00Z" }),
    { outcome: "duplicate", phase: "none" },
  )
  assert.equal((await enrollment(pg)).grace, grace)
})

test("rejects early first charges and malformed or incomplete event shapes before mutation", async (t) => {
  const pg = await database(t)
  await seed(pg)
  assert.deepEqual(
    await call(
      pg,
      event({
        occurredAt: "2024-01-07T23:59:59Z",
        periodStartAt: "2024-01-07T23:59:59Z",
        periodEndAt: "2024-02-07T23:59:59Z",
      }),
    ),
    { outcome: "reconciliation_required", phase: "none" },
  )
  assert.deepEqual(
    await call(
      pg,
      event({
        sourceEventId: "insufficient",
        sourceObjectId: "insufficient",
        amountMinor: 998,
        periodEndAt: "2024-02-28T00:00:00Z",
      }),
    ),
    { outcome: "reconciliation_required", phase: "none" },
  )
  assert.deepEqual(await enrollment(pg), { first: null, through: null, failed: false, grace: null })
  assert.equal((await continuationDebt(pg)).count, 0)
  await assert.rejects(
    () =>
      pg.query("SELECT public.record_trial_payment_event($1::jsonb)", [
        JSON.stringify({ ...event(), amountMinor: "999" }),
      ]),
    /Invalid trial payment event/,
  )
  await assert.rejects(
    () =>
      pg.query("SELECT public.record_trial_payment_event($1::jsonb)", [
        JSON.stringify({ ...event(), extra: true }),
      ]),
    /Invalid trial payment event/,
  )
})

test("accepts annual EOM only after a full year and rejects price or malformed immutable terms", async (t) => {
  const pg = await database(t)
  const annual = createTrialOfferSnapshot("year", {
    monthPriceId: "price_month",
    yearPriceId: "price_year",
    annualCouponId: "coupon_year",
  })
  await seed(pg, { offer: annual })
  assert.deepEqual(
    await call(
      pg,
      event({
        amountMinor: 6999,
        occurredAt: "2024-02-29T10:00:00Z",
        periodStartAt: "2024-02-29T10:00:00Z",
        periodEndAt: "2025-02-27T10:00:00Z",
      }),
    ),
    { outcome: "applied", phase: "first_paid" },
  )
  assert.match((await enrollment(pg)).through!, /2025-02-28 10:00:00/)
  assert.equal((await continuationDebt(pg)).count, 1)
  const pg2 = await database(t)
  await seed(pg2, { offer: {} })
  assert.deepEqual(await call(pg2, event()), { outcome: "reconciliation_required", phase: "none" })
})

test("renewal advances monotonically; due-period failure gets exactly seven days and old failures cannot relock", async (t) => {
  const pg = await database(t)
  await seed(pg)
  await call(pg, event())
  const renewal = event({
    sourceEventId: "evt-2",
    sourceObjectId: "invoice-2",
    occurredAt: "2024-02-29T10:00:00Z",
    periodStartAt: "2024-02-29T10:00:00Z",
    periodEndAt: "2024-03-29T10:00:00Z",
    amountMinor: 999,
  })
  assert.deepEqual(await call(pg, renewal), { outcome: "applied", phase: "renewal" })
  const failure = event({
    sourceEventId: "evt-3",
    sourceObjectId: "invoice-3",
    outcome: "failed",
    occurredAt: "2030-01-01T00:00:00Z",
    periodStartAt: "2024-03-29T10:00:00Z",
    periodEndAt: "2024-04-29T10:00:00Z",
    amountMinor: 999,
  })
  assert.deepEqual(await call(pg, failure), { outcome: "applied", phase: "none" })
  assert.match((await enrollment(pg)).grace!, /2024-04-05 10:00:00/)
  await call(
    pg,
    event({
      sourceEventId: "evt-4",
      sourceObjectId: "invoice-4",
      occurredAt: "2024-03-29T10:00:00Z",
      periodStartAt: "2024-03-29T10:00:00Z",
      periodEndAt: "2024-04-29T10:00:00Z",
      amountMinor: 999,
    }),
  )
  assert.deepEqual(
    await call(pg, event({ ...failure, sourceEventId: "evt-5", sourceObjectId: "invoice-5" })),
    { outcome: "stale", phase: "none" },
  )
  assert.equal((await enrollment(pg)).failed, false)
})

test("delayed renewal follows the provider period boundary and a late annual first-payment failure stays stale", async (t) => {
  const pg = await database(t)
  await seed(pg)
  await call(pg, event())
  assert.deepEqual(
    await call(
      pg,
      event({
        sourceEventId: "evt-delayed",
        sourceObjectId: "invoice-delayed",
        occurredAt: "2024-03-02T10:00:00Z",
        periodStartAt: "2024-02-29T10:00:00Z",
        periodEndAt: "2024-03-29T10:00:00Z",
      }),
    ),
    { outcome: "applied", phase: "renewal" },
  )
  const annualPg = await database(t)
  await seed(annualPg, {
    offer: createTrialOfferSnapshot("year", {
      monthPriceId: "price_month",
      yearPriceId: "price_year",
      annualCouponId: "coupon_year",
    }),
  })
  const paid = event({
    amountMinor: 6999,
    occurredAt: "2024-02-29T10:00:00Z",
    periodStartAt: "2024-02-29T10:00:00Z",
    periodEndAt: "2025-02-28T10:00:00Z",
    sourceObjectId: "annual-invoice",
  })
  await call(annualPg, paid)
  assert.deepEqual(
    await call(annualPg, { ...paid, sourceEventId: "late-failure", outcome: "failed" }),
    { outcome: "stale", phase: "none" },
  )
})

test("out-of-order future renewal remains reconcilable after its missing period is applied", async (t) => {
  const pg = await database(t)
  await seed(pg)
  await call(pg, event())
  const future = event({
    sourceEventId: "future",
    sourceObjectId: "future-invoice",
    occurredAt: "2024-04-01T10:00:00Z",
    periodStartAt: "2024-03-29T10:00:00Z",
    periodEndAt: "2024-04-29T10:00:00Z",
  })
  assert.deepEqual(await call(pg, future), { outcome: "reconciliation_required", phase: "none" })
  assert.deepEqual(
    await call(
      pg,
      event({
        sourceEventId: "missing",
        sourceObjectId: "missing-invoice",
        occurredAt: "2024-03-01T10:00:00Z",
        periodStartAt: "2024-02-29T10:00:00Z",
        periodEndAt: "2024-03-29T10:00:00Z",
      }),
    ),
    { outcome: "applied", phase: "renewal" },
  )
  assert.deepEqual(await call(pg, future), { outcome: "applied", phase: "renewal" })
})

test("invalid source boundaries remain reconcilable; canceled and revoked rows fail closed", async (t) => {
  const pg = await database(t)
  await seed(pg)
  assert.deepEqual(await call(pg, event({ periodEndAt: "2024-01-31T10:00:00Z" })), {
    outcome: "reconciliation_required",
    phase: "none",
  })
  assert.deepEqual(await call(pg, event()), { outcome: "applied", phase: "first_paid" })
  const canceled = await database(t)
  await seed(canceled, { canceled: true })
  assert.deepEqual(await call(canceled, event()), {
    outcome: "reconciliation_required",
    phase: "none",
  })
  const revoked = await database(t)
  await seed(revoked, { revoked: true })
  assert.deepEqual(await call(revoked, event()), {
    outcome: "reconciliation_required",
    phase: "none",
  })
})

test("same invoice aliases preserve phase while ambiguous event or source collisions fail closed", async (t) => {
  const pg = await database(t)
  await seed(pg)
  assert.deepEqual(await call(pg, event()), { outcome: "applied", phase: "first_paid" })
  assert.deepEqual(await call(pg, event({ sourceEventId: "evt-alias" })), {
    outcome: "duplicate",
    phase: "first_paid",
  })
  assert.deepEqual(
    await call(pg, event({ sourceEventId: "evt-alias", sourceObjectId: "other-invoice" })),
    { outcome: "reconciliation_required", phase: "none" },
  )
  assert.deepEqual(
    await call(
      pg,
      event({ sourceEventId: "other-event", sourceObjectId: "invoice-1", amountMinor: 998 }),
    ),
    { outcome: "reconciliation_required", phase: "none" },
  )
})

test("a previously recorded failure event can be corrected to provider-confirmed success for that invoice", async (t) => {
  const pg = await database(t)
  await seed(pg)
  const failed = event({
    sourceEventId: "evt-retried",
    sourceObjectId: "invoice-retried",
    outcome: "failed",
  })
  assert.deepEqual(await call(pg, failed), { outcome: "applied", phase: "none" })
  assert.deepEqual(await call(pg, { ...failed, outcome: "succeeded" }), {
    outcome: "applied",
    phase: "first_paid",
  })
  assert.deepEqual(
    await call(pg, { ...failed, sourceEventId: "evt-provider-success", outcome: "succeeded" }),
    { outcome: "duplicate", phase: "first_paid" },
  )
})

test("RPC and private ledger are service-role-only, and adapter accepts object or singleton array RPC data", async (t) => {
  const pg = await database(t)
  await seed(pg)
  await pg.exec("SET ROLE anon")
  await assert.rejects(() => call(pg, event()), /permission denied/)
  await assert.rejects(
    () => pg.query("SELECT * FROM private.trial_payment_continuation_reconciliations"),
    /permission denied/,
  )
  await pg.exec("RESET ROLE; SET ROLE authenticated")
  await assert.rejects(() => call(pg, event()), /permission denied/)
  await pg.exec("RESET ROLE; SET ROLE service_role")
  assert.deepEqual(await call(pg, event()), { outcome: "applied", phase: "first_paid" })
  const object = await recordTrialPaymentEvent(
    { rpc: async () => ({ data: { outcome: "stale", phase: "none" }, error: null }) },
    event(),
  )
  const array = await recordTrialPaymentEvent(
    { rpc: async () => ({ data: [{ outcome: "duplicate", phase: "none" }], error: null }) },
    event(),
  )
  await assert.rejects(
    () =>
      recordTrialPaymentEvent(
        {
          rpc: async () => ({
            data: [
              { outcome: "duplicate", phase: "none" },
              { outcome: "duplicate", phase: "none" },
            ],
            error: null,
          }),
        },
        event(),
      ),
    /unavailable/,
  )
  assert.deepEqual(object, { outcome: "stale", phase: "none" })
  assert.deepEqual(array, { outcome: "duplicate", phase: "none" })
})
