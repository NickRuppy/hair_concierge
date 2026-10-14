import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { PGlite } from "@electric-sql/pglite"
import { createTrialCheckoutAttempt } from "../src/lib/billing/trial-checkout-attempt"
import { createTrialOfferSnapshot } from "../src/lib/billing/trial-offer"

const ROOT = new URL("../", import.meta.url)
const FOUNDATION = "supabase/migrations/20260914044650_trial_admission_foundation.sql"
const MIGRATION = "supabase/migrations/20260914091103_trial_checkout_attempt.sql"
const USER = "00000000-0000-4000-8000-000000000001"
const LEAD = "00000000-0000-4000-8000-000000000002"
const ATTEMPT = "00000000-0000-4000-8000-000000000003"
const OFFER = createTrialOfferSnapshot("month", {
  monthPriceId: "price_trial_month",
  yearPriceId: "price_trial_year",
  annualCouponId: "coupon_trial_year",
})

async function database(t: { after(fn: () => Promise<void>): void }) {
  const pg = new PGlite()
  t.after(() => pg.close())
  await pg.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE TABLE public.profiles(id uuid PRIMARY KEY); CREATE TABLE public.billing_subscriptions(id uuid PRIMARY KEY);
    INSERT INTO public.profiles VALUES ('${USER}');`)
  await pg.exec(await readFile(new URL(FOUNDATION, ROOT), "utf8"))
  await pg.exec(await readFile(new URL(MIGRATION, ROOT), "utf8"))
  return pg
}

async function create(pg: PGlite, scope = USER, attempt = ATTEMPT, offer = OFFER) {
  const result = await pg.query<{ row: Record<string, unknown> }>(
    "SELECT to_jsonb(public.create_trial_checkout_attempt('user',$1::uuid,$2::uuid,$3::jsonb)) AS row",
    [scope, attempt, JSON.stringify(offer)],
  )
  return result.rows[0]!.row
}

test("atomically creates immutable server enrollment rather than reusing the client attempt ID", async (t) => {
  const pg = await database(t)
  const first = await create(pg)
  const replay = await create(pg)
  assert.equal(first.id, replay.id)
  assert.notEqual(first.enrollment_id, ATTEMPT)
  assert.equal(first.status, "reserved")
  const catalogChanged = await create(pg, USER, ATTEMPT, { ...OFFER, stripePriceId: "price_later" })
  assert.deepEqual(catalogChanged.accepted_offer, OFFER)
  await assert.rejects(
    () =>
      create(
        pg,
        USER,
        ATTEMPT,
        createTrialOfferSnapshot("year", {
          monthPriceId: "price_trial_month",
          yearPriceId: "price_trial_year",
          annualCouponId: "coupon_trial_year",
        }),
      ),
    /conflict/,
  )
  await assert.rejects(() => create(pg, LEAD, ATTEMPT), /foreign key/)
})

test("freezes once, binds the same provider reference idempotently, and requires reconciliation after horizon", async (t) => {
  const pg = await database(t)
  const attempt = await create(pg)
  const frozen = await pg.query<{ row: Record<string, unknown> }>(
    "SELECT to_jsonb(public.freeze_trial_stripe_checkout_attempt($1::uuid,'acct_trial',false,$2::jsonb,now()+interval '22 hours')) AS row",
    [attempt.id, JSON.stringify({ mode: "subscription", price: "price_trial_month" })],
  )
  assert.equal(frozen.rows[0]!.row.status, "frozen")
  const bound = await pg.query<{ row: Record<string, unknown> }>(
    "SELECT to_jsonb(public.bind_trial_stripe_checkout_reference($1::uuid,'cs_first')) AS row",
    [attempt.id],
  )
  assert.equal(bound.rows[0]!.row.status, "provider_created")
  await pg.query("SELECT public.bind_trial_stripe_checkout_reference($1::uuid,'cs_first')", [
    attempt.id,
  ])
  await assert.rejects(
    () =>
      pg.query("SELECT public.bind_trial_stripe_checkout_reference($1::uuid,'cs_other')", [
        attempt.id,
      ]),
    /conflict/,
  )
  await pg.query(
    "UPDATE public.trial_checkout_attempts SET created_at=now()-interval '24 hours' WHERE id=$1::uuid",
    [attempt.id],
  )
  const observed = await pg.query<{ row: Record<string, unknown> }>(
    "SELECT to_jsonb(public.bind_trial_stripe_checkout_reference($1::uuid,'cs_first')) AS row",
    [attempt.id],
  )
  assert.equal(observed.rows[0]!.row.status, "provider_created")
  const stale = await create(pg, USER, "00000000-0000-4000-8000-000000000004")
  await pg.query(
    "UPDATE public.trial_checkout_attempts SET created_at=now()-interval '24 hours' WHERE id=$1::uuid",
    [stale.id],
  )
  const staleFreeze = await pg.query<{ row: Record<string, unknown> }>(
    "SELECT to_jsonb(public.freeze_trial_stripe_checkout_attempt($1::uuid,'acct_trial',false,$2::jsonb,now()+interval '1 hour')) AS row",
    [stale.id, JSON.stringify({ mode: "subscription" })],
  )
  assert.equal(staleFreeze.rows[0]!.row.status, "reconciliation_required")
  const lateBound = await create(pg, USER, "00000000-0000-4000-8000-000000000005")
  await pg.query(
    "SELECT public.freeze_trial_stripe_checkout_attempt($1::uuid,'acct_trial',false,$2::jsonb,now()+interval '1 hour')",
    [lateBound.id, JSON.stringify({ mode: "subscription" })],
  )
  await pg.query(
    "UPDATE public.trial_checkout_attempts SET created_at=now()-interval '24 hours' WHERE id=$1::uuid",
    [lateBound.id],
  )
  const firstObservedLate = await pg.query<{ row: Record<string, unknown> }>(
    "SELECT to_jsonb(public.bind_trial_stripe_checkout_reference($1::uuid,'cs_observed_late')) AS row",
    [lateBound.id],
  )
  assert.equal(firstObservedLate.rows[0]!.row.status, "provider_created")
})

test("adapter accepts PostgREST singleton composite rows and rejects ambiguous shapes", async () => {
  const row = {
    id: ATTEMPT,
    enrollment_id: USER,
    scope_kind: "user",
    scope_id: USER,
    client_attempt_id: ATTEMPT,
    accepted_offer: OFFER,
    status: "reserved",
    stripe_account_id: null,
    stripe_livemode: null,
    stripe_params: null,
    expires_at: null,
    provider_reference: null,
  }
  for (const data of [row, [row]]) {
    const attempt = await createTrialCheckoutAttempt(
      { rpc: async () => ({ data, error: null }) } as never,
      {
        scope: { kind: "user", id: USER },
        clientAttemptId: ATTEMPT,
        offer: OFFER,
      },
    )
    assert.equal(attempt.enrollmentId, USER)
  }
  await assert.rejects(
    () =>
      createTrialCheckoutAttempt(
        { rpc: async () => ({ data: [row, row], error: null }) } as never,
        {
          scope: { kind: "user", id: USER },
          clientAttemptId: ATTEMPT,
          offer: OFFER,
        },
      ),
    /unavailable/,
  )
})

test("private table and RPCs reject unprivileged access", async (t) => {
  const pg = await database(t)
  await pg.exec("SET ROLE authenticated")
  await assert.rejects(
    () => pg.query("SELECT * FROM public.trial_checkout_attempts"),
    /permission denied/,
  )
  await assert.rejects(
    () =>
      pg.query("SELECT public.create_trial_checkout_attempt('user',$1::uuid,$2::uuid,$3::jsonb)", [
        USER,
        ATTEMPT,
        JSON.stringify(OFFER),
      ]),
    /permission denied/,
  )
})
