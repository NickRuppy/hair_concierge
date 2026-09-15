import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { PGlite } from "@electric-sql/pglite"
import { createTrialOfferSnapshot } from "../src/lib/billing/trial-offer"
import { frozenPayPalTrialStart } from "../src/lib/paypal/trial-collection-start"

const USER = "11111111-1111-4111-8111-111111111111",
  ATTEMPT = "22222222-2222-4222-8222-222222222222",
  OP = "33333333-3333-4333-8333-333333333333"
const rawCatalog = {
  monthPriceId: "price_month",
  yearPriceId: "price_year",
  annualCouponId: "coupon",
}
const catalog = {
  month: createTrialOfferSnapshot("month", rawCatalog),
  year: createTrialOfferSnapshot("year", rawCatalog),
}
async function setup(
  t: { after(fn: () => Promise<void>): void },
  trialEndInterval = "3 days",
  beginRecovery = true,
  alignedDaysAgo: number | null = null,
) {
  const pg = new PGlite()
  t.after(() => pg.close())
  await pg.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;
 CREATE TABLE public.profiles(id uuid PRIMARY KEY);
 CREATE TABLE public.billing_subscriptions(id uuid PRIMARY KEY,user_id uuid,provider text,provider_subscription_id text,provider_customer_id text,metadata jsonb DEFAULT '{}'::jsonb);
 CREATE TABLE public.paypal_checkout_intents(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),token text UNIQUE,interval text,source text,lead_id uuid,email text,user_id uuid,
 provider_subscription_id text,status text DEFAULT 'created',expires_at timestamptz,metadata jsonb DEFAULT '{}'::jsonb,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
 INSERT INTO public.profiles VALUES('${USER}');`)
  for (const migration of [
    "20260914044650_trial_admission_foundation",
    "20260914090614_trial_cancellation_declarations",
    "20260914094203_trial_payment_events",
    "20260914135114_stripe_trial_continuation_operations",
    "20260914120000_paypal_trial_checkout_attempt",
    "20260914135017_paypal_trial_activation_clock",
    "20260914140320_trial_management_operations",
    "20260914140634_paypal_trial_management_requests",
    "20260914141149_trial_effective_payment_contract",
    "20260914142808_trial_paid_recovery_operations",
    "20260914143014_paypal_trial_paid_recovery_requests",
    "20260914143515_trial_paid_recovery_ledger",
    "20260914144638_paypal_trial_candidate_expiry",
    "20260915143327_trial_paid_recovery_collection_window_gate",
    "20260915190000_paypal_trial_frozen_end",
    "20260915190100_paypal_trial_frozen_end_recovery_gate",
    "20260915190500_paypal_trial_frozen_start_expiry",
  ])
    await pg.exec(
      await readFile(new URL(`../supabase/migrations/${migration}.sql`, import.meta.url), "utf8"),
    )
  const result = await pg.query<{ row: any }>(
    "SELECT public.create_paypal_trial_checkout_attempt('user',$1,$2,$3,'owner@example.com',null,'pricing_page') AS row",
    [USER, ATTEMPT, JSON.stringify(catalog.year)],
  )
  const attempt = result.rows[0].row
  await pg.query(
    "SELECT public.freeze_paypal_trial_checkout_attempt($1,'APP','PROD','P-year',$2)",
    [attempt.id, `paypal-trial:${attempt.id}:v1`],
  )
  await pg.query("SELECT public.bind_paypal_trial_checkout_reference($1,'I-old')", [attempt.id])
  await pg.query("SELECT public.freeze_trial_management_catalog($1,$2)", [
    attempt.enrollment_id,
    JSON.stringify(catalog),
  ])
  await pg.query(
    "SELECT public.freeze_paypal_trial_plan_catalog($1,'APP','PROD','P-month','P-year')",
    [attempt.enrollment_id],
  )
  // A frozen PayPal trial end sits on a UTC midnight (authorization eight days earlier keeps the bounds check happy);
  // the legacy shape is a second-exact end seven days after authorization.
  const trialEnd =
    alignedDaysAgo === null
      ? "now()-interval '" + trialEndInterval + "'"
      : "(date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')-interval '" +
        alignedDaysAgo +
        " days'"
  await pg.query(
    "UPDATE public.trial_enrollments SET admission_status='active',provider_agreement_id='I-old',authorization_succeeded_at=" +
      trialEnd +
      (alignedDaysAgo === null ? "-interval '7 days'" : "-interval '8 days'") +
      ",original_trial_end_at=" +
      trialEnd +
      ",cancel_at_period_end=false WHERE id=$1",
    [attempt.enrollment_id],
  )
  await pg.query(
    "INSERT INTO public.billing_subscriptions(id,user_id,provider,provider_subscription_id,provider_customer_id,trial_enrollment_id) VALUES($1,$2,'paypal','I-old','PAYER',$1)",
    [attempt.enrollment_id, USER],
  )
  if (!beginRecovery) return { pg, attempt, operation: null as any }
  const op = await pg.query<{ row: any }>(
    "SELECT public.begin_trial_paid_recovery_operation($1,$2,$3,'recover_unpaid',0) AS row",
    [OP, attempt.enrollment_id, USER],
  )
  return { pg, attempt, operation: op.rows[0].row }
}
async function freeze(pg: PGlite) {
  return pg.query<{ r: any }>(
    "SELECT public.freeze_paypal_trial_paid_recovery_request($1,$2,'P-year','P-renewal','https://chaarlie.de/profile','https://chaarlie.de/profile') r",
    [OP, USER],
  )
}
test("PayPal paid recovery freezes full period request independently from72h retry expiry and forbids rewriting", async (t) => {
  const { pg } = await setup(t),
    f = (await freeze(pg)).rows[0].r
  assert.equal(f.target_plan_id, "P-renewal")
  assert.equal(f.app_id, "APP")
  assert.ok(Date.parse(f.start_time) - Date.parse(f.request_expires_at) > 350 * 86400000)
  const changed = await pg.query<{ r: any }>(
    "SELECT public.freeze_paypal_trial_paid_recovery_request($1,$2,'P-other','P-changed','https://different.example','https://different.example') r",
    [OP, USER],
  )
  assert.deepEqual(changed.rows[0].r, f)
  await assert.rejects(
    pg.query(
      "UPDATE private.paypal_trial_paid_recovery_requests SET start_time=start_time+interval '7 days' WHERE operation_id=$1",
      [OP],
    ),
    /immutable/,
  )
  await pg.query("SELECT public.claim_paypal_trial_paid_recovery_request($1,$2)", [OP, USER])
  await pg.query(
    "SELECT public.bind_paypal_trial_paid_recovery_response($1,$2,'I-new','https://www.paypal.com/approve')",
    [OP, USER],
  )
  await assert.rejects(
    pg.query("SELECT public.bind_paypal_trial_paid_recovery_response($1,$2,'I-other',null)", [
      OP,
      USER,
    ]),
    /mismatch/,
  )
  await pg.exec("SET ROLE authenticated")
  await assert.rejects(
    pg.query("SELECT public.get_paypal_trial_paid_recovery_request($1,$2)", [OP, USER]),
    /permission denied/,
  )
})
test("old cancellation is suppressed only after explicit neutralization request and new candidate maps original intent", async (t) => {
  const { pg, attempt } = await setup(t)
  await freeze(pg)
  const guard = async () =>
    (
      await pg.query<{ g: boolean }>("SELECT public.guard_trial_paid_recovery_operation($1,$2) g", [
        OP,
        USER,
      ])
    ).rows[0].g
  assert.equal(await guard(), true)
  await pg.query("SELECT public.claim_paypal_trial_paid_recovery_source_neutralization($1,$2)", [
    OP,
    USER,
  ])
  const canceled = await pg.query<{ v: boolean }>(
    "SELECT public.record_paypal_trial_cancellation($1,'I-old') v",
    [attempt.enrollment_id],
  )
  assert.equal(canceled.rows[0].v, false)
  assert.equal(await guard(), true)
  await pg.query("SELECT public.claim_paypal_trial_paid_recovery_request($1,$2)", [OP, USER])
  await pg.query(
    "SELECT public.bind_paypal_trial_paid_recovery_response($1,$2,'I-new','https://www.paypal.com/approve')",
    [OP, USER],
  )
  const linked = await pg.query<{ v: any }>(
    "SELECT public.find_paypal_trial_checkout_intent_for_agreement('I-new') v",
  )
  assert.equal(linked.rows[0].v.id, attempt.intent_id)
  const callback = await pg.query<{ v: any }>(
    "SELECT public.find_paypal_trial_paid_recovery_callback('I-new') v",
  )
  assert.equal(callback.rows[0].v.operationId, OP)
  assert.equal(callback.rows[0].v.status, "pending")
})
test("source collection reconciliation rejects unknown, pending, and wrong-amount transactions", async (t) => {
  const { pg, attempt } = await setup(t)
  await freeze(pg)
  const time = new Date(Math.floor(Date.now() / 1000) * 1000 - 1000).toISOString(),
    tx = {
      id: "known",
      status: "COMPLETED",
      time,
      amount_with_breakdown: { gross_amount: { value: "69.99", currency_code: "EUR" } },
    }
  const verify = async (xs: unknown[]) =>
    (
      await pg.query<{ v: boolean }>(
        "SELECT public.verify_paypal_trial_paid_recovery_source_transactions($1,$2,$3) v",
        [OP, USER, JSON.stringify(xs)],
      )
    ).rows[0].v
  assert.equal(await verify([]), true)
  assert.equal(await verify([tx]), false)
  assert.equal(await verify([{ ...tx, status: "PENDING" }]), false)
  await pg.query(
    "INSERT INTO private.trial_payment_events(enrollment_id,provider,source_event_id,source_event_ids,source_object_id,outcome,occurred_at,amount_minor,currency,period_start_at,period_end_at,result,phase) VALUES($1,'paypal','event','[\"event\"]','known','succeeded',$2,6999,'EUR',$2,$2::timestamptz+interval '1 year','applied','first_paid')",
    [attempt.enrollment_id, time],
  )
  assert.equal(await verify([tx]), true)
  assert.equal(
    await verify([
      { ...tx, amount_with_breakdown: { gross_amount: { value: "99.99", currency_code: "EUR" } } },
    ]),
    false,
  )
})

test("expired PayPal candidate lease uses frozen expiry and skips concurrent workers", async (t) => {
  const { pg } = await setup(t)
  await freeze(pg)
  await pg.query("SELECT public.claim_paypal_trial_paid_recovery_request($1,$2)", [OP, USER])
  await pg.query(
    "SELECT public.bind_paypal_trial_paid_recovery_response($1,$2,'I-new','https://www.paypal.com/approve')",
    [OP, USER],
  )
  // Initial intent is expired after10days and remains unadmitted in a separate valid enrollment.
  const a = await pg.query<{ r: any }>(
    "SELECT public.create_paypal_trial_checkout_attempt('user',$1,gen_random_uuid(),$2,'owner@example.com',null,'pricing_page') r",
    [USER, JSON.stringify(catalog.year)],
  )
  const attempt = a.rows[0].r
  await pg.query(
    "SELECT public.freeze_paypal_trial_checkout_attempt($1,'APP','PROD','P-year',$2)",
    [attempt.id, `paypal-trial:${attempt.id}:v1`],
  )
  await pg.query("SELECT public.bind_paypal_trial_checkout_reference($1,'I-expire')", [attempt.id])
  await pg.query(
    "UPDATE public.paypal_checkout_intents SET expires_at=now()-interval '1 minute' WHERE id=$1",
    [attempt.intent_id],
  )
  const first = await pg.query<{ r: any }>("SELECT public.claim_paypal_trial_candidate_expiry(5) r")
  assert.equal(first.rows.length, 1)
  assert.equal(first.rows[0].r.agreement_id, "I-expire")
  assert.equal(
    (await pg.query("SELECT public.claim_paypal_trial_candidate_expiry(5)")).rows.length,
    0,
  )
  const c = first.rows[0].r
  const receipt = await pg.query<{ v: boolean }>(
    "SELECT public.complete_paypal_trial_candidate_expiry($1,$2,'canceled_no_payment') v",
    [c.agreement_id, c.lease_token],
  )
  assert.equal(receipt.rows[0].v, true)
  assert.equal(
    (await pg.query("SELECT public.claim_paypal_trial_candidate_expiry(5)")).rows.length,
    0,
  )
})

test("recover_unpaid waits for the collection window unless the trial was cancelled", async (t) => {
  const { pg, attempt } = await setup(t, "1 day", false)
  await assert.rejects(
    () =>
      pg.query("SELECT public.begin_trial_paid_recovery_operation($1,$2,$3,'recover_unpaid',0)", [
        OP,
        attempt.enrollment_id,
        USER,
      ]),
    /Paid recovery unavailable/,
  )
  await pg.query("UPDATE public.trial_enrollments SET cancel_at_period_end=true WHERE id=$1", [
    attempt.enrollment_id,
  ])
  const op = await pg.query<{ row: any }>(
    "SELECT public.begin_trial_paid_recovery_operation($1,$2,$3,'recover_unpaid',0) AS row",
    [OP, attempt.enrollment_id, USER],
  )
  assert.equal(op.rows[0].row.kind, "recover_unpaid")
})

test("recover_unpaid opens two days after a midnight-aligned frozen trial end, not three", async (t) => {
  const early = await setup(t, "3 days", false, 1)
  const earlyView = await early.pg.query<{ v: any }>(
    "SELECT public.load_trial_paid_recovery_public_view($1,$2) v",
    [early.attempt.enrollment_id, USER],
  )
  assert.equal(earlyView.rows[0].v.kind, null)
  await assert.rejects(
    () =>
      early.pg.query(
        "SELECT public.begin_trial_paid_recovery_operation($1,$2,$3,'recover_unpaid',0)",
        [OP, early.attempt.enrollment_id, USER],
      ),
    /Paid recovery unavailable/,
  )
  const { pg, attempt } = await setup(t, "3 days", false, 2)
  const open = await pg.query<{ v: any }>(
    "SELECT public.load_trial_paid_recovery_public_view($1,$2) v",
    [attempt.enrollment_id, USER],
  )
  assert.equal(open.rows[0].v.kind, "recover_unpaid")
  const op = await pg.query<{ row: any }>(
    "SELECT public.begin_trial_paid_recovery_operation($1,$2,$3,'recover_unpaid',0) AS row",
    [OP, attempt.enrollment_id, USER],
  )
  assert.equal(op.rows[0].row.kind, "recover_unpaid")
  const guarded = await pg.query<{ g: boolean }>(
    "SELECT public.guard_trial_paid_recovery_operation($1,$2) g",
    [OP, USER],
  )
  assert.equal(guarded.rows[0].g, true)
})

test("SQL frozen trial start is the twin of frozenPayPalTrialStart and feeds the expiry candidate", async (t) => {
  const { pg, attempt } = await setup(t, "3 days", false)
  // The twin must not depend on the session time zone, including across DST changes.
  for (const zone of ["UTC", "Europe/Berlin", "America/Los_Angeles"]) {
    await pg.query(`SET TIME ZONE '${zone}'`)
    for (const expiry of [
      "2026-09-18T14:00:00.000Z",
      "2026-09-18T23:59:59.000Z",
      "2026-09-19T00:00:00.000Z",
      "2026-09-18T14:00:00.837Z",
      "2026-12-31T23:59:59.000Z",
      "2026-10-23T23:30:00.000Z",
      "2026-03-27T00:30:00.000Z",
    ]) {
      const twin = await pg.query<{ e: number }>(
        "SELECT extract(epoch FROM private.paypal_trial_frozen_start($1::timestamptz))::bigint e",
        [expiry],
      )
      assert.equal(
        Number(twin.rows[0].e),
        Date.parse(frozenPayPalTrialStart(expiry)) / 1000,
        `${zone} ${expiry}`,
      )
    }
  }
  await pg.query("SET TIME ZONE 'UTC'")
  // A second, never-approved attempt whose intent expired is the expiry candidate.
  const OTHER = "44444444-4444-4444-8444-444444444444"
  await pg.query("INSERT INTO public.profiles VALUES($1)", [OTHER])
  const other = (
    await pg.query<{ row: any }>(
      "SELECT public.create_paypal_trial_checkout_attempt('user',$1,$2,$3,'other@example.com',null,'pricing_page') AS row",
      [OTHER, "55555555-5555-4555-8555-555555555555", JSON.stringify(catalog.year)],
    )
  ).rows[0].row
  await pg.query(
    "SELECT public.freeze_paypal_trial_checkout_attempt($1,'APP','PROD','P-year',$2)",
    [other.id, `paypal-trial:${other.id}:v1`],
  )
  await pg.query("SELECT public.bind_paypal_trial_checkout_reference($1,'I-new')", [other.id])
  const frozen = await pg.query<{ e: number }>(
    "SELECT extract(epoch FROM request_expires_at)::bigint e FROM private.paypal_trial_checkout_attempts WHERE id=$1",
    [other.id],
  )
  await pg.query(
    "UPDATE public.paypal_checkout_intents SET expires_at=now()-interval '1 minute' WHERE id=$1",
    [other.intent_id],
  )
  const claimed = await pg.query<{ r: any }>(
    "SELECT public.claim_paypal_trial_candidate_expiry(5) r",
  )
  const candidate = claimed.rows.map((x) => x.r).find((r) => r.agreement_id === "I-new")
  assert.ok(candidate, "initial candidate claimed")
  assert.equal(candidate.kind, "initial")
  void attempt
  assert.equal(
    Date.parse(candidate.start_time),
    Date.parse(frozenPayPalTrialStart(new Date(Number(frozen.rows[0].e) * 1000).toISOString())),
  )
})

test("approval latency report aggregates freeze-to-approval minutes without payer data", async (t) => {
  const { pg, attempt } = await setup(t, "3 days", false)
  const before = await pg.query<{ r: any }>(
    "SELECT public.report_paypal_trial_approval_latency() r",
  )
  assert.equal(before.rows[0].r.frozen, 1)
  assert.equal(before.rows[0].r.approved, 0)
  await pg.query(
    "UPDATE private.paypal_trial_checkout_attempts SET authorization_succeeded_at=request_expires_at-interval '72 hours'+interval '90 minutes',activation_event_id='WH-1' WHERE id=$1",
    [attempt.id],
  )
  const after = await pg.query<{ r: any }>("SELECT public.report_paypal_trial_approval_latency() r")
  assert.equal(after.rows[0].r.approved, 1)
  assert.equal(Number(after.rows[0].r.p50Minutes), 90)
  assert.equal(after.rows[0].r.approvedAfter3h, 0)
  assert.doesNotMatch(JSON.stringify(after.rows[0].r), /owner@example|PAYER|I-old/)
})
