import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { PGlite } from "@electric-sql/pglite"
import { createTrialOfferSnapshot } from "../src/lib/billing/trial-offer"

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
async function setup(t: { after(fn: () => Promise<void>): void }) {
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
    "20260914120000_paypal_trial_checkout_attempt",
    "20260914135017_paypal_trial_activation_clock",
    "20260914140320_trial_management_operations",
    "20260914140634_paypal_trial_management_requests",
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
  await pg.query(
    "UPDATE public.trial_enrollments SET admission_status='active',provider_agreement_id='I-old',authorization_succeeded_at=now()-interval '1 day',original_trial_end_at=now()+interval '6 days',cancel_at_period_end=true WHERE id=$1",
    [attempt.enrollment_id],
  )
  await pg.query(
    "INSERT INTO public.billing_subscriptions(id,user_id,provider,provider_subscription_id,provider_customer_id,trial_enrollment_id) VALUES($1,$2,'paypal','I-old','PAYER',$1)",
    [attempt.enrollment_id, USER],
  )
  const op = await pg.query<{ row: any }>(
    "SELECT public.begin_trial_management_operation($1,$2,$3,'restore',0,'year') AS row",
    [OP, attempt.enrollment_id, USER],
  )
  return { pg, attempt, operation: op.rows[0].row }
}

test("PayPal management request freezes app/catalog/URLs and claims a single revision dispatch", async (t) => {
  const { pg, attempt } = await setup(t)
  const args = [
    OP,
    USER,
    "P-month",
    "P-year",
    "https://chaarlie.de/profile",
    "https://chaarlie.de/profile",
  ]
  const first = await pg.query<{ row: any }>(
    "SELECT public.freeze_paypal_trial_management_request($1,$2,$3,$4,$5,$6) AS row",
    args,
  )
  assert.equal(first.rows[0].row.app_id, "APP")
  assert.equal(first.rows[0].row.product_id, "PROD")
  args[3] = "P-future-catalog"
  const replay = await pg.query<{ row: any }>(
    "SELECT public.freeze_paypal_trial_management_request($1,$2,$3,$4,$5,$6) AS row",
    args,
  )
  assert.deepEqual(replay.rows[0].row, first.rows[0].row)
  const firstClaim = await pg.query<{ claimed: boolean }>(
    "SELECT public.claim_paypal_trial_management_request($1,$2) AS claimed",
    [OP, USER],
  )
  const secondClaim = await pg.query<{ claimed: boolean }>(
    "SELECT public.claim_paypal_trial_management_request($1,$2) AS claimed",
    [OP, USER],
  )
  assert.equal(firstClaim.rows[0].claimed, true)
  assert.equal(secondClaim.rows[0].claimed, false)
  await pg.query(
    "SELECT public.bind_paypal_trial_management_response($1,$2,'I-new','https://www.paypal.com/approve')",
    [OP, USER],
  )
  await assert.rejects(
    () =>
      pg.query(
        "SELECT public.bind_paypal_trial_management_response($1,$2,'I-foreign','https://www.paypal.com/approve')",
        [OP, USER],
      ),
    /mismatch/,
  )
  await assert.rejects(
    () =>
      pg.query(
        "UPDATE private.paypal_trial_management_requests SET target_plan_id='P-rewrite' WHERE operation_id=$1",
        [OP],
      ),
    /immutable/,
  )
  await assert.rejects(
    () =>
      pg.query(
        "UPDATE private.paypal_trial_plan_catalogs SET year_plan_id='P-rewrite' WHERE enrollment_id=$1",
        [attempt.enrollment_id],
      ),
    /immutable/,
  )
  await pg.exec("SET ROLE authenticated")
  await assert.rejects(
    () => pg.query("SELECT public.get_paypal_trial_management_request($1,$2)", [OP, USER]),
    /permission denied/,
  )
})

test("replacement callback retains original intent, and stale cancellation cannot cancel the approved replacement", async (t) => {
  const { pg, attempt, operation } = await setup(t)
  await pg.query(
    "SELECT public.freeze_paypal_trial_management_request($1,$2,'P-month','P-year','https://chaarlie.de/profile','https://chaarlie.de/profile')",
    [OP, USER],
  )
  await pg.query("SELECT public.claim_paypal_trial_management_request($1,$2)", [OP, USER])
  await pg.query(
    "SELECT public.bind_paypal_trial_management_response($1,$2,'I-new','https://www.paypal.com/approve')",
    [OP, USER],
  )
  const callback = await pg.query<{ row: any }>(
    "SELECT public.find_paypal_trial_management_callback('I-new') AS row",
  )
  assert.deepEqual(callback.rows[0].row, { operationId: OP, authenticatedUserId: USER })
  const evidence = {
    provider: "paypal",
    providerCustomerId: "PAYER",
    sourceAgreementId: "I-old",
    targetAgreementId: "I-new",
    originalTrialEndAt: operation.originalTrialEndAt,
    offer: catalog.year,
    cancelAtPeriodEnd: false,
    noImmediatePayment: true,
    sourceAgreementNeutralized: true,
    reference: "paypal:confirmed",
  }
  const committed = await pg.query<{ ok: boolean }>(
    "SELECT public.commit_trial_management_operation($1,$2,$3) AS ok",
    [OP, USER, JSON.stringify(evidence)],
  )
  assert.equal(committed.rows[0].ok, true)
  const intent = await pg.query<{ row: any }>(
    "SELECT public.find_paypal_trial_checkout_intent_for_agreement('I-new') AS row",
  )
  assert.equal(intent.rows[0].row.token, attempt.intent_token)
  const stale = await pg.query<{ ok: boolean }>(
    "SELECT public.record_paypal_trial_cancellation($1,'I-old') AS ok",
    [attempt.enrollment_id],
  )
  assert.equal(stale.rows[0].ok, false)
  const current = await pg.query<{ ok: boolean }>(
    "SELECT public.record_paypal_trial_cancellation($1,'I-new') AS ok",
    [attempt.enrollment_id],
  )
  assert.equal(current.rows[0].ok, true)
})
