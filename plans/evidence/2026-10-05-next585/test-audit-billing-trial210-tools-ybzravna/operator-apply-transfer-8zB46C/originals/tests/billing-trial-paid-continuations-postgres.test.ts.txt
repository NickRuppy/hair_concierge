import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { PGlite } from "@electric-sql/pglite"
import { createTrialOfferSnapshot } from "../src/lib/billing/trial-offer"

const USER = "11111111-1111-4111-8111-111111111111"
const ENROLLMENT = "22222222-2222-4222-8222-222222222222"
const OPERATION = "33333333-3333-4333-8333-333333333333"
const OFFER = createTrialOfferSnapshot("month", {
  monthPriceId: "price_month",
  yearPriceId: "price_year",
  annualCouponId: "coupon_year",
})
const THROUGH = "2090-02-08T10:00:00Z"

async function setup(t: { after(fn: () => Promise<void>): void }) {
  const pg = new PGlite()
  t.after(() => pg.close())
  await pg.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE TABLE public.profiles(id uuid PRIMARY KEY);
    CREATE TABLE public.billing_subscriptions(id uuid PRIMARY KEY, user_id uuid, provider text,
      provider_subscription_id text, provider_customer_id text);
    GRANT USAGE ON SCHEMA public TO service_role;
    GRANT ALL ON public.billing_subscriptions TO service_role;`)
  for (const name of [
    "20260914044650_trial_admission_foundation",
    "20260914094203_trial_payment_events",
    "20260914090614_trial_cancellation_declarations",
    "20260914135114_stripe_trial_continuation_operations",
    "20260914135123_trial_paid_continuation_links",
    "20260914140320_trial_management_operations",
    "20260914142808_trial_paid_recovery_operations",
    "20260914143515_trial_paid_recovery_ledger",
    "20260914143741_trial_paid_recovery_continuation_transition",
  ]) {
    await pg.exec(
      await readFile(new URL(`../supabase/migrations/${name}.sql`, import.meta.url), "utf8"),
    )
  }
  await pg.query("INSERT INTO public.profiles VALUES ($1)", [USER])
  await pg.query(
    `INSERT INTO public.trial_enrollments(id,user_id,accepted_offer,provider,provider_agreement_id,
    admission_status,authorization_succeeded_at,original_trial_end_at)
    VALUES($1,$2,$3,'stripe','sub_original','active','2090-01-01T10:00:00Z','2090-01-08T10:00:00Z')`,
    [ENROLLMENT, USER, JSON.stringify(OFFER)],
  )
  await pg.query(
    `INSERT INTO public.billing_subscriptions(id,user_id,provider,provider_subscription_id,provider_customer_id,trial_enrollment_id)
    VALUES($1,$2,'stripe','sub_original','cus_owner',$1)`,
    [ENROLLMENT, USER],
  )
  const paid = await payment(pg)
  assert.equal(paid.outcome, "applied")
  await pg.query(
    `INSERT INTO private.stripe_trial_continuation_operations(id,enrollment_id,original_agreement_id,
    customer_id,source_object_id,paid_through_at,payment_succeeded_at)
    VALUES($1,$2,'sub_original','cus_owner','invoice_first',$3,'2090-01-08T10:00:00Z')`,
    [OPERATION, ENROLLMENT, THROUGH],
  )
  return pg
}

async function payment(pg: PGlite, overrides: Record<string, unknown> = {}) {
  const event = {
    provider: "stripe",
    enrollmentId: ENROLLMENT,
    agreementId: "sub_original",
    sourceEventId: "evt_first",
    sourceObjectId: "invoice_first",
    outcome: "succeeded",
    occurredAt: "2090-01-08T10:00:00Z",
    amountMinor: 999,
    currency: "EUR",
    periodStartAt: "2090-01-08T09:59:59Z",
    periodEndAt: "2090-02-08T09:59:59Z",
    ...overrides,
  }
  return (
    await pg.query<{ result: { outcome: string; phase: string } }>(
      "SELECT public.record_trial_payment_event($1::jsonb) AS result",
      [JSON.stringify(event)],
    )
  ).rows[0]!.result
}
async function bind(pg: PGlite, customer = "cus_owner", successor = "sub_successor") {
  return (
    await pg.query<{ ok: boolean }>(
      `SELECT public.confirm_trial_paid_continuation(
    $1,'stripe','sub_original',$2,$3,'invoice_first',$4,$5) AS ok`,
      [ENROLLMENT, successor, customer, THROUGH, OPERATION],
    )
  ).rows[0]!.ok
}
async function verifiedOperation(pg: PGlite) {
  await pg.exec(
    "UPDATE private.stripe_trial_continuation_operations SET neutralized_at=clock_timestamp(), continuation_agreement_id='sub_successor'",
  )
}

test("a paid successor requires verified neutralization, matching customer, operation and unchanged entitlement", async (t) => {
  const pg = await setup(t)
  assert.equal(await bind(pg), false)
  await verifiedOperation(pg)
  assert.equal(await bind(pg, "cus_other"), false)
  assert.equal(await bind(pg, "cus_owner", "sub_forged"), false)
  await pg.exec("UPDATE public.trial_enrollments SET cancel_at_period_end=true")
  assert.equal(await bind(pg), false)
  await pg.exec(
    "UPDATE public.trial_enrollments SET cancel_at_period_end=false, access_revoked=true",
  )
  assert.equal(await bind(pg), false)
  await pg.exec("UPDATE public.trial_enrollments SET access_revoked=false")
  assert.equal(await bind(pg), true)
  assert.equal(await bind(pg), true)
  assert.equal(await bind(pg, "cus_owner", "sub_other"), false)
  const row = (
    await pg.query<{ provider_agreement_id: string }>(
      "SELECT provider_agreement_id FROM public.trial_enrollments",
    )
  ).rows[0]!
  assert.equal(row.provider_agreement_id, "sub_original")
})

test("only the bound successor can renew; an old-source invoice replay stays duplicate", async (t) => {
  const pg = await setup(t)
  await verifiedOperation(pg)
  assert.equal(await bind(pg), true)
  assert.equal((await payment(pg)).outcome, "duplicate")
  const renewal = {
    sourceEventId: "evt_renewal",
    sourceObjectId: "invoice_renewal",
    occurredAt: THROUGH,
    periodStartAt: THROUGH,
    periodEndAt: "2090-03-08T10:00:00Z",
  }
  assert.equal(
    (await payment(pg, { ...renewal, agreementId: "sub_forged" })).outcome,
    "reconciliation_required",
  )
  assert.equal((await payment(pg, renewal)).outcome, "reconciliation_required")
  assert.deepEqual(await payment(pg, { ...renewal, agreementId: "sub_successor" }), {
    outcome: "applied",
    phase: "renewal",
  })
})

test("successor lookup and binding are private and cannot clear a later cancellation on replay", async (t) => {
  const pg = await setup(t)
  await verifiedOperation(pg)
  for (const role of ["anon", "authenticated"]) {
    await pg.exec(`SET ROLE ${role}`)
    await assert.rejects(() => bind(pg), /permission denied/)
    await assert.rejects(
      () => pg.query("SELECT public.lookup_trial_paid_continuation('stripe','sub_successor')"),
      /permission denied/,
    )
    await pg.exec("RESET ROLE")
  }
  await pg.exec("SET ROLE service_role")
  assert.equal(await bind(pg), true)
  await assert.rejects(
    () => pg.query("DELETE FROM private.trial_paid_continuations"),
    /permission denied/,
  )
  await pg.exec("RESET ROLE; UPDATE public.trial_enrollments SET cancel_at_period_end=true")
  assert.equal(await bind(pg), true)
  assert.equal(
    (
      await pg.query<{ canceled: boolean }>(
        "SELECT cancel_at_period_end AS canceled FROM public.trial_enrollments",
      )
    ).rows[0]!.canceled,
    true,
  )
})

test("only a committed recovery candidate can transition to its verified final paid agreement", async (t) => {
  const pg = await setup(t)
  const recovery = "55555555-5555-4555-8555-555555555555"
  await pg.query(
    `INSERT INTO private.trial_paid_recovery_operations(id,enrollment_id,user_id,kind,status,provider,
 provider_customer_id,original_agreement_id,source_agreement_id,offer,original_trial_end_at,expected_revision,
 cancellation_version,cancel_at_period_end,target_agreement_id,provider_verified_at,completed_at)
 VALUES($1,$2,$3,'recover_unpaid','committed','stripe','cus_owner','sub_original','sub_original',$4,
 '2090-01-08T10:00:00Z',0,0,false,'sub_recovered',now(),now())`,
    [recovery, ENROLLMENT, USER, JSON.stringify(OFFER)],
  )
  await pg.query(
    `INSERT INTO private.trial_paid_continuations(enrollment_id,provider,original_agreement_id,
 continuation_agreement_id,customer_id,source_object_id,paid_through_at,operation_id)
 VALUES($1,'stripe','sub_original','sub_recovered','cus_owner','invoice_first',$2,$3)`,
    [ENROLLMENT, THROUGH, recovery],
  )
  await verifiedOperation(pg)
  assert.equal(await bind(pg), false)
  await pg.exec(
    "UPDATE private.stripe_trial_continuation_operations SET source_agreement_id='sub_recovered'",
  )
  assert.equal(await bind(pg), true)
  assert.equal(await bind(pg), true)
  assert.equal(
    (
      await pg.query<{ n: number }>(
        "SELECT count(*)::int AS n FROM private.trial_paid_continuation_history",
      )
    ).rows[0].n,
    1,
  )
  assert.equal(
    (
      await pg.query<{ c: { provider_agreement_id: string } }>(
        "SELECT public.read_trial_effective_contract($1) AS c",
        [ENROLLMENT],
      )
    ).rows[0].c.provider_agreement_id,
    "sub_successor",
  )
  assert.equal(
    (
      await payment(pg, {
        agreementId: "sub_recovered",
        sourceEventId: "new",
        sourceObjectId: "new",
      })
    ).outcome,
    "reconciliation_required",
  )
})
