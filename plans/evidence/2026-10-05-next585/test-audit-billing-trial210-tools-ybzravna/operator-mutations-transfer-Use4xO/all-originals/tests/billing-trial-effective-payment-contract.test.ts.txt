import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { PGlite } from "@electric-sql/pglite"
import { createTrialOfferSnapshot } from "../src/lib/billing/trial-offer"
import {
  freezeTrialManagementCatalog,
  beginTrialManagementOperation,
  commitTrialManagementOperation,
  loadTrialManagementState,
  guardTrialManagementOperation,
  abandonTrialManagementOperation,
  type TrialManagementProviderEvidence,
  type TrialManagementClient,
} from "../src/lib/billing/trial-management-operations"
const USER = "11111111-1111-4111-8111-111111111111",
  ENROLLMENT = "22222222-2222-4222-8222-222222222222"
const OP = "33333333-3333-4333-8333-333333333333",
  OTHER = "44444444-4444-4444-8444-444444444444"
const catalog = {
  month: createTrialOfferSnapshot("month", {
    monthPriceId: "price_month",
    yearPriceId: "price_year",
    annualCouponId: "coupon",
  }),
  year: createTrialOfferSnapshot("year", {
    monthPriceId: "price_month",
    yearPriceId: "price_year",
    annualCouponId: "coupon",
  }),
}
async function setup(t: { after(fn: () => Promise<void>): void }, elapsedDays = 1) {
  const pg = new PGlite()
  t.after(() => pg.close())
  await pg.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
 CREATE TABLE public.profiles(id uuid PRIMARY KEY);
 CREATE TABLE public.billing_subscriptions(id uuid PRIMARY KEY,user_id uuid,provider text,provider_subscription_id text,provider_customer_id text);
 GRANT USAGE ON SCHEMA public TO service_role; GRANT ALL ON public.billing_subscriptions TO service_role;`)
  for (const name of [
    "20260914044650_trial_admission_foundation",
    "20260914090614_trial_cancellation_declarations",
    "20260914094203_trial_payment_events",
    "20260914140320_trial_management_operations",
    "20260914141149_trial_effective_payment_contract",
  ])
    await pg.exec(
      await readFile(new URL(`../supabase/migrations/${name}.sql`, import.meta.url), "utf8"),
    )
  await pg.query("INSERT INTO public.profiles VALUES($1),($2)", [USER, OTHER])
  await pg.query(
    `INSERT INTO public.trial_enrollments(id,user_id,accepted_offer,provider) VALUES($1,$2,$3,'stripe')`,
    [ENROLLMENT, USER, JSON.stringify(catalog.month)],
  )
  const client: TrialManagementClient = {
    async rpc(name, args) {
      try {
        const values = Object.values(args).map((v) =>
          typeof v === "object" && v !== null ? JSON.stringify(v) : v,
        )
        const result = await pg.query<{ data: unknown }>(
          `SELECT public.${name}(${values.map((_, i) => `$${i + 1}`).join(",")}) AS data`,
          values,
        )
        return { data: result.rows[0]!.data, error: null }
      } catch (error) {
        return { data: null, error }
      }
    },
  }
  await freezeTrialManagementCatalog(client, { enrollmentId: ENROLLMENT, catalog })
  await pg.query(
    `UPDATE public.trial_enrollments SET provider_agreement_id='sub_original',admission_status='active',
 authorization_succeeded_at=now()-($2::integer * interval '1 day'),original_trial_end_at=now()-($2::integer * interval '1 day')+interval '7 days' WHERE id=$1`,
    [ENROLLMENT, elapsedDays],
  )
  return { pg, client }
}
async function ready(t: { after(fn: () => Promise<void>): void }, elapsedDays = 1) {
  const result = await setup(t, elapsedDays)
  await result.pg.query(
    `INSERT INTO public.billing_subscriptions(id,user_id,provider,provider_subscription_id,provider_customer_id,trial_enrollment_id)
 VALUES($1,$2,'stripe','sub_original','cus_owner',$1)`,
    [ENROLLMENT, USER],
  )
  return result
}
const start = {
  operationId: OP,
  enrollmentId: ENROLLMENT,
  authenticatedUserId: USER,
  kind: "switch" as const,
  expectedRevision: 0,
  targetInterval: "year" as const,
}
function evidence(
  o: Awaited<ReturnType<typeof beginTrialManagementOperation>>,
  extra: Partial<TrialManagementProviderEvidence> = {},
): TrialManagementProviderEvidence {
  return {
    provider: o.provider,
    providerCustomerId: o.providerCustomerId,
    sourceAgreementId: o.sourceAgreementId,
    targetAgreementId: o.sourceAgreementId,
    originalTrialEndAt: o.originalTrialEndAt,
    offer: o.targetOffer,
    cancelAtPeriodEnd: o.cancelAtPeriodEnd,
    noImmediatePayment: true,
    sourceAgreementNeutralized: false,
    reference: "retrieved_verified",
    ...extra,
  }
}

test("a committed monthly-to-annual revision controls the actual first charge and paid period", async (t) => {
  const { pg, client } = await ready(t)
  const operation = await beginTrialManagementOperation(client, start)
  assert.equal(
    await commitTrialManagementOperation(client, {
      operationId: OP,
      authenticatedUserId: USER,
      evidence: evidence(operation),
    }),
    true,
  )
  const at = new Date(operation.originalTrialEndAt)
  const end = new Date(at)
  end.setUTCFullYear(end.getUTCFullYear() + 1)
  const event = {
    provider: "stripe",
    enrollmentId: ENROLLMENT,
    agreementId: operation.sourceAgreementId,
    sourceEventId: "paid",
    sourceObjectId: "invoice",
    outcome: "succeeded",
    occurredAt: at.toISOString(),
    amountMinor: 6999,
    currency: "EUR",
    periodStartAt: at.toISOString(),
    periodEndAt: end.toISOString(),
  }
  const result = await pg.query<{ result: unknown }>(
    "SELECT public.record_trial_payment_event($1::jsonb) AS result",
    [JSON.stringify(event)],
  )
  assert.deepEqual(result.rows[0]!.result, { outcome: "applied", phase: "first_paid" })
  const row = (
    await pg.query<{ interval: string; through: string }>(
      "SELECT accepted_offer->>'interval' AS interval,paid_through_at::text AS through FROM public.trial_enrollments",
    )
  ).rows[0]!
  assert.equal(row.interval, "month", "original accepted terms are immutable")
  assert.equal(new Date(row.through).getTime(), end.getTime())
})

test("after a confirmed replacement, old agreements cannot charge through a new effective contract", async (t) => {
  const { pg, client } = await ready(t)
  const operation = await beginTrialManagementOperation(client, start)
  assert.equal(
    await commitTrialManagementOperation(client, {
      operationId: OP,
      authenticatedUserId: USER,
      evidence: evidence(operation, {
        targetAgreementId: "sub_replacement",
        sourceAgreementNeutralized: true,
      }),
    }),
    true,
  )
  const at = new Date(operation.originalTrialEndAt),
    end = new Date(at)
  end.setUTCFullYear(end.getUTCFullYear() + 1)
  const event = {
    provider: "stripe",
    enrollmentId: ENROLLMENT,
    agreementId: "sub_original",
    sourceEventId: "oldpaid",
    sourceObjectId: "oldinvoice",
    outcome: "succeeded",
    occurredAt: at.toISOString(),
    amountMinor: 6999,
    currency: "EUR",
    periodStartAt: at.toISOString(),
    periodEndAt: end.toISOString(),
  }
  const call = async (value: unknown) =>
    (
      await pg.query<{ result: unknown }>(
        "SELECT public.record_trial_payment_event($1::jsonb) AS result",
        [JSON.stringify(value)],
      )
    ).rows[0]!.result
  assert.deepEqual(await call(event), { outcome: "reconciliation_required", phase: "none" })
  assert.deepEqual(
    await call({
      ...event,
      agreementId: "sub_replacement",
      sourceEventId: "newpaid",
      sourceObjectId: "newinvoice",
    }),
    { outcome: "applied", phase: "first_paid" },
  )
})
