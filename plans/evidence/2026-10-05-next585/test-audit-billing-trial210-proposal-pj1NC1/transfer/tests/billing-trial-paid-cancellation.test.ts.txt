import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { PGlite } from "@electric-sql/pglite"
import { createTrialOfferSnapshot } from "../src/lib/billing/trial-offer"
import {
  freezeTrialManagementCatalog,
  type TrialManagementClient,
} from "../src/lib/billing/trial-management-operations"
import { requestTrialPaidCancellation } from "../src/lib/billing/trial-paid-cancellation"
import { handleTrialPaidCancellation } from "../src/app/api/billing/trial-paid-cancellation/route"
const USER = "11111111-1111-4111-8111-111111111111",
  ENROLLMENT = "22222222-2222-4222-8222-222222222222",
  OP = "33333333-3333-4333-8333-333333333333",
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
async function setup(
  t: { after(fn: () => Promise<void>): void },
  provider = "paypal",
  interval: "month" | "year" = "month",
) {
  const pg = new PGlite()
  t.after(() => pg.close())
  await pg.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;
 CREATE TABLE public.profiles(id uuid PRIMARY KEY);CREATE TABLE public.billing_subscriptions(id uuid PRIMARY KEY,user_id uuid,provider text,provider_subscription_id text,provider_customer_id text);
 GRANT USAGE ON SCHEMA public TO service_role;GRANT ALL ON public.billing_subscriptions TO service_role;`)
  for (const name of [
    "20260914044650_trial_admission_foundation",
    "20260914090614_trial_cancellation_declarations",
    "20260914094203_trial_payment_events",
    "20260914135114_stripe_trial_continuation_operations",
    "20260914135527_trial_required_notices",
    "20260914140320_trial_management_operations",
    "20260914142808_trial_paid_recovery_operations",
    "20260914143515_trial_paid_recovery_ledger",
    "20260914144833_trial_paid_cancellation_declarations",
  ])
    await pg.exec(
      await readFile(new URL(`../supabase/migrations/${name}.sql`, import.meta.url), "utf8"),
    )
  await pg.query("INSERT INTO public.profiles VALUES($1),($2)", [USER, OTHER])
  await pg.query(
    "INSERT INTO public.trial_enrollments(id,user_id,provider,accepted_offer) VALUES($1,$2,$3,$4)",
    [ENROLLMENT, USER, provider, JSON.stringify(catalog[interval])],
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
  await pg.exec(
    `UPDATE public.trial_enrollments SET admission_status='active',provider_agreement_id='original',authorization_succeeded_at=now()-interval '10 days',original_trial_end_at=now()-interval '3 days',first_payment_succeeded_at=now()-interval '2 days',paid_through_at=now()+interval '28 days'`,
  )
  await pg.query(
    "INSERT INTO public.billing_subscriptions(id,user_id,provider,provider_subscription_id,provider_customer_id,trial_enrollment_id) VALUES($1,$2,$3,'original','customer',$1)",
    [ENROLLMENT, USER, provider],
  )
  const deps: any = {
    client,
    stripe: () => ({}),
    paypalRetrieve: async () => ({
      id: "original",
      status: "ACTIVE",
      subscriber: { payer_id: "customer" },
    }),
    paypalCancel: async () => {
      throw new Error("provider down")
    },
  }
  return { pg, client, deps }
}
const input = { requestId: OP, enrollmentId: ENROLLMENT, authenticatedUserId: USER }
test("paid declaration is durable before provider effects, preserves full entitlement and queues one required receipt", async (t) => {
  const { pg, deps } = await setup(t)
  const before = (
    await pg.query(
      "SELECT paid_through_at,first_payment_succeeded_at,original_trial_end_at,accepted_offer FROM public.trial_enrollments",
    )
  ).rows[0]
  deps.paypalCancel = async () => {
    assert.equal(
      (
        await pg.query<{ c: boolean }>(
          "SELECT cancel_at_period_end AS c FROM public.trial_enrollments",
        )
      ).rows[0]!.c,
      true,
    )
    throw new Error("network down")
  }
  const receipt = await requestTrialPaidCancellation(input, deps)
  assert.equal(receipt.providerStatus, "pending")
  assert.equal(receipt.declaration.declarationId, OP)
  const again = await requestTrialPaidCancellation({ ...input, requestId: OTHER }, deps)
  assert.deepEqual(again.declaration, receipt.declaration)
  assert.deepEqual(
    (
      await pg.query(
        "SELECT paid_through_at,first_payment_succeeded_at,original_trial_end_at,accepted_offer FROM public.trial_enrollments",
      )
    ).rows[0],
    before,
  )
  const notices = await pg.query<{ kind: string; snapshot: any }>(
    "SELECT kind,snapshot FROM private.trial_required_notices WHERE kind='paid_cancellation_receipt'",
  )
  assert.equal(notices.rows.length, 1)
  assert.equal(notices.rows[0]!.snapshot.declarationId, OP)
  assert.equal(
    Date.parse(notices.rows[0]!.snapshot.effectiveEndAt),
    Date.parse(receipt.declaration.effectiveEndAt),
  )
})
test("PayPal cancellation uses verified current successor while keeping immutable original ownership", async (t) => {
  const { pg, deps } = await setup(t)
  await pg.query(
    `INSERT INTO private.trial_paid_continuations(enrollment_id,provider,original_agreement_id,continuation_agreement_id,customer_id,source_object_id,paid_through_at,operation_id)
 SELECT id,provider,'original','successor','customer','sale',paid_through_at,$1 FROM public.trial_enrollments`,
    [OTHER],
  )
  let status = "ACTIVE",
    canceled = 0
  deps.paypalRetrieve = async (id: string) => {
    assert.equal(id, "successor")
    return { id, status, subscriber: { payer_id: "customer" } }
  }
  deps.paypalCancel = async (id: string) => {
    assert.equal(id, "successor")
    canceled++
    status = "CANCELLED"
  }
  const receipt = await requestTrialPaidCancellation(input, deps)
  assert.equal(receipt.providerStatus, "confirmed")
  assert.equal(canceled, 1)
  assert.equal((await requestTrialPaidCancellation(input, deps)).providerStatus, "confirmed")
  assert.equal(canceled, 1)
})
test("foreign provider payer cannot trigger mutation but the owned customer declaration stays accepted", async (t) => {
  const { deps } = await setup(t)
  let canceled = 0
  deps.paypalRetrieve = async () => ({
    id: "original",
    status: "ACTIVE",
    subscriber: { payer_id: "other" },
  })
  deps.paypalCancel = async () => {
    canceled++
  }
  assert.equal((await requestTrialPaidCancellation(input, deps)).providerStatus, "pending")
  assert.equal(canceled, 0)
  await assert.rejects(() =>
    requestTrialPaidCancellation({ ...input, authenticatedUserId: OTHER }, deps),
  )
})
test("Stripe cancellation delegates only after generic durable acceptance", async (t) => {
  const { pg, deps } = await setup(t, "stripe")
  deps.stripeCancel = async (i: any) => {
    assert.equal(i.requestId, OP)
    assert.equal(i.authenticatedUserId, USER)
    const row = (
      await pg.query<{ effective_end_at: Date }>(
        "SELECT effective_end_at FROM private.trial_paid_cancellation_declarations",
      )
    ).rows[0]!
    assert.ok(row)
    return {
      status: "confirmed",
      operationId: OP,
      paidThroughAt: row.effective_end_at.toISOString(),
    }
  }
  assert.equal((await requestTrialPaidCancellation(input, deps)).providerStatus, "confirmed")
})
test("year two routes to statutory flow; direct writes and unauthorized roles cannot manufacture a receipt", async (t) => {
  const { pg, client } = await setup(t, "paypal", "year")
  await pg.exec(
    "UPDATE public.trial_enrollments SET paid_through_at=first_payment_succeeded_at+interval '2 years'",
  )
  assert.equal(
    (
      await client.rpc("request_trial_paid_cancellation", {
        p_request_id: OP,
        p_enrollment_id: ENROLLMENT,
        p_authenticated_user_id: USER,
      })
    ).data,
    null,
  )
  assert.equal(
    (await pg.query("SELECT * FROM private.trial_paid_cancellation_declarations")).rows.length,
    0,
  )
  for (const role of ["anon", "authenticated"]) {
    await pg.exec(`SET ROLE ${role}`)
    await assert.rejects(() =>
      pg.query("SELECT public.request_trial_paid_cancellation($1,$2,$3)", [OP, ENROLLMENT, USER]),
    )
    await pg.exec("RESET ROLE")
  }
  await pg.exec("SET ROLE service_role")
  await assert.rejects(
    () => pg.exec("DELETE FROM private.trial_paid_cancellation_declarations"),
    /permission denied/,
  )
})
test("paid cancellation HTTP requires auth, exact JSON and same origin without accepting client provider claims", async () => {
  let calls = 0
  const deps: any = {
    userId: async () => USER,
    client: {},
    stripe: () => ({}),
    requestCancellation: async (i: any) => {
      assert.equal(i.authenticatedUserId, USER)
      calls++
      return {
        declaration: {
          declarationId: OP,
          submittedAt: "2026-09-14T00:00:00Z",
          effectiveEndAt: "2026-10-14T00:00:00Z",
        },
        providerStatus: "pending",
      }
    },
  }
  const request = (
    value: unknown = { requestId: OP, enrollmentId: ENROLLMENT },
    origin = "https://chaarlie.de",
  ) =>
    new Request("https://chaarlie.de/api/billing/trial-paid-cancellation", {
      method: "POST",
      headers: { origin, "content-type": "application/json" },
      body: JSON.stringify(value),
    })
  assert.equal(
    (
      await handleTrialPaidCancellation(
        request({ requestId: OP, enrollmentId: ENROLLMENT, confirmed: true }),
        deps,
      )
    ).status,
    400,
  )
  assert.equal(
    (await handleTrialPaidCancellation(request(undefined, "https://other.example"), deps)).status,
    403,
  )
  assert.equal(calls, 0)
  assert.equal((await handleTrialPaidCancellation(request(), deps)).status, 200)
  assert.equal(calls, 1)
  deps.userId = async () => null
  assert.equal((await handleTrialPaidCancellation(request(), deps)).status, 401)
})
