import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { PGlite } from "@electric-sql/pglite"

import { readTrialPaymentReconciliation } from "../scripts/billing/trial-payment-reconciliation"
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
  for (const migration of MIGRATIONS)
    await pg.exec(await readFile(new URL(migration, ROOT), "utf8"))
  await pg.query("INSERT INTO public.profiles(id) VALUES ($1::uuid)", [USER])
  await pg.query(
    `INSERT INTO public.trial_enrollments(id,user_id,accepted_offer,provider,provider_agreement_id,admission_status,authorization_succeeded_at,original_trial_end_at)
    VALUES($1::uuid,$2::uuid,$3::jsonb,'stripe','agreement','active','2024-01-01T00:00:00Z','2024-01-08T00:00:00Z')`,
    [ENROLLMENT, USER, JSON.stringify(OFFER)],
  )
  return pg
}
function event(overrides: Record<string, unknown> = {}) {
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
async function record(pg: PGlite, value: Record<string, unknown>) {
  await pg.query("SELECT public.record_trial_payment_event($1::jsonb)", [JSON.stringify(value)])
}

test("service-only paged operator projection exposes reconciliation facts without user or offer data", async (t) => {
  const pg = await database(t)
  await record(
    pg,
    event({ sourceEventId: "underpaid", sourceObjectId: "underpaid", amountMinor: 998 }),
  )
  await record(
    pg,
    event({
      sourceEventId: "continuation",
      sourceObjectId: "continuation",
      periodEndAt: "2024-02-29T09:59:59Z",
    }),
  )
  await pg.exec("SET ROLE service_role")
  const result = await pg.query<Record<string, unknown>>(
    "SELECT * FROM public.list_trial_payment_reconciliation_failures($1, $2)",
    [100, 0],
  )
  assert.equal(result.rows.length, 2)
  assert.deepEqual(result.rows.map((row) => row.reconciliation_kind).sort(), [
    "continuation",
    "payment_event",
  ])
  for (const row of result.rows) {
    assert.equal(row.enrollment_id, ENROLLMENT)
    assert.equal("user_id" in row, false)
    assert.equal("accepted_offer" in row, false)
    assert.equal("provider_payload" in row, false)
  }
  await pg.exec("RESET ROLE; SET ROLE anon")
  await assert.rejects(
    () => pg.query("SELECT * FROM public.list_trial_payment_reconciliation_failures(100, 0)"),
    /permission denied/,
  )
  await pg.exec("RESET ROLE; SET ROLE authenticated")
  await assert.rejects(
    () => pg.query("SELECT * FROM public.list_trial_payment_reconciliation_failures(100, 0)"),
    /permission denied/,
  )
})

test("read-only CLI pages through the dedicated RPC and rejects mutation-shaped arguments without RPC calls", async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = []
  const client = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args })
      return { data: [], error: null }
    },
  }
  assert.deepEqual(await readTrialPaymentReconciliation(["--list", "--offset=200"], client), {
    mode: "read-only",
    rows: [],
  })
  assert.deepEqual(calls, [
    { name: "list_trial_payment_reconciliation_failures", args: { p_limit: 100, p_offset: 200 } },
  ])
  await assert.rejects(
    () => readTrialPaymentReconciliation(["--apply"], client),
    /mutations are not supported/,
  )
  assert.equal(calls.length, 1)
})
