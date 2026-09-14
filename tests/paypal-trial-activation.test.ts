import { CheckoutAccessAlreadyExistsError } from "../src/lib/billing/subscriptions"
import { handlePayPalWebhookEvent } from "../src/lib/paypal/webhook-handlers"
import { handlePayPalTrialWebhook } from "../src/lib/paypal/trial-webhook"
import assert from "node:assert/strict"
import test from "node:test"
import { createTrialOfferSnapshot } from "../src/lib/billing/trial-offer"
import {
  ensurePayPalTrialCheckoutAccount,
  pinVerifiedPayPalTrialActivation,
} from "../src/lib/paypal/trial-account-admission"
import { recordVerifiedPayPalTrialSale } from "../src/lib/paypal/trial-webhook"
import { buildPayPalDeferredTrialPlanRequest } from "../src/lib/paypal/trial-plan-shape"
import { paypalCheckoutActivationHash } from "../src/lib/paypal/checkout-activation"

const USER = "11111111-1111-4111-8111-111111111111"
const ENROLLMENT = "22222222-2222-4222-8222-222222222222"
const ATTEMPT = "33333333-3333-4333-8333-333333333333"
const catalog = {
  monthPriceId: "price_month",
  yearPriceId: "price_year",
  annualCouponId: "coupon_year",
}

function fixture() {
  const now = Date.now()
  const authorized = new Date(now - 30_000).toISOString()
  const end = new Date(Date.parse(authorized) + 7 * 86400000).toISOString()
  const offer = createTrialOfferSnapshot("month", catalog)
  const intent: any = {
    id: "intent",
    token: "owned-trial-token-12345",
    interval: "month",
    source: "quiz_result_offer",
    email: "owner@example.com",
    user_id: USER,
    lead_id: null,
    provider_subscription_id: "I-owned",
    status: "approved",
    created_at: new Date(now - 120_000).toISOString(),
    expires_at: new Date(now + 86400000).toISOString(),
    metadata: {
      trial_cohort: "trial_v1",
      trial_enrollment_id: ENROLLMENT,
      paypal_plan_id: "P-month",
    },
  }
  const attempt: any = {
    id: ATTEMPT,
    enrollment_id: ENROLLMENT,
    intent_token: intent.token,
    scope_kind: "user",
    scope_id: USER,
    client_attempt_id: ATTEMPT,
    accepted_offer: offer,
    status: "provider_created",
    paypal_app_id: "APP-owned",
    paypal_product_id: "PROD-owned",
    paypal_plan_id: "P-month",
    request_id: "request",
    request_expires_at: new Date(now - 120_000 + 3 * 86400000).toISOString(),
    provider_reference: "I-owned",
    authorization_succeeded_at: authorized,
    activation_event_id: "WH-original",
  }
  const enrollment: any = {
    id: ENROLLMENT,
    user_id: USER,
    provider: "paypal",
    admission_status: "reserved",
    accepted_offer: offer,
    provider_agreement_id: null,
    access_revoked: false,
    neutralization_required: false,
    original_trial_end_at: null,
    first_payment_succeeded_at: null,
    paid_through_at: null,
    cancel_at_period_end: false,
  }
  const subscription: any = {
    id: "I-owned",
    custom_id: intent.token,
    plan_id: "P-month",
    status: "ACTIVE",
    subscriber: { payer_id: "PAYER", email_address: "payer@example.com" },
    status_update_time: authorized,
    start_time: new Date(now - 120_000 + 7 * 86400000).toISOString(),
    billing_info: { next_billing_time: new Date(now - 120_000 + 7 * 86400000).toISOString() },
    plan: buildPayPalDeferredTrialPlanRequest({ interval: "month", productId: "PROD-owned" }),
  }
  const tables: Record<string, any[]> = {
    trial_enrollments: [enrollment],
    profiles: [{ id: USER, email: intent.email }],
    billing_subscriptions: [],
    paypal_checkout_intents: [intent],
  }
  const calls: any[] = []
  let admissionResult = "active"
  let paymentResult: any = { outcome: "applied", phase: "first_paid" }
  function builder(table: string) {
    const filters: Array<(row: any) => boolean> = []
    let patch: any = null
    let operation = "select"
    let single = false
    const q: any = {
      select() {
        return q
      },
      eq(key: string, value: any) {
        filters.push((row) => row[key] === value)
        return q
      },
      is(key: string, value: any) {
        filters.push((row) => row[key] === value)
        return q
      },
      in(key: string, values: any[]) {
        filters.push((row) => values.includes(row[key]))
        return q
      },
      gt(key: string, value: any) {
        filters.push((row) => row[key] > value)
        return q
      },
      ilike(key: string, value: any) {
        filters.push((row) => String(row[key]).toLowerCase() === value.toLowerCase())
        return q
      },
      or() {
        return q
      },
      order() {
        return q
      },
      limit() {
        return q
      },
      insert(value: any) {
        patch = value
        operation = "upsert"
        return q
      },
      delete() {
        operation = "delete"
        return q
      },
      update(value: any) {
        patch = value
        operation = "update"
        return q
      },
      upsert(value: any) {
        patch = value
        operation = "upsert"
        return q
      },
      maybeSingle() {
        single = true
        return q
      },
      single() {
        single = true
        return q
      },
      then(resolve: any, reject: any) {
        return Promise.resolve()
          .then(() => {
            const rows = tables[table] ?? []
            let selected = rows.filter((row) => filters.every((filter) => filter(row)))
            if (operation === "upsert") {
              const old = rows.find((row) =>
                table === "billing_subscriptions"
                  ? row.provider_subscription_id === patch.provider_subscription_id
                  : row.id === patch.id,
              )
              const row = Object.assign(old ?? { id: `row-${rows.length}` }, patch)
              if (table === "billing_subscriptions") row.trial_access_facts = projection()
              if (!old) rows.push(row)
              selected = [row]
            } else if (patch) selected.forEach((row) => Object.assign(row, patch))
            if (operation !== "select") calls.push({ table, operation, patch })
            return { data: single ? (selected[0] ?? null) : selected, error: null }
          })
          .then(resolve, reject)
      },
    }
    return q
  }
  function projection() {
    return {
      version: 1,
      enrollmentId: ENROLLMENT,
      admissionStatus: enrollment.admission_status,
      authorizationSucceededAt: enrollment.authorization_succeeded_at ?? null,
      originalTrialEndAt: enrollment.original_trial_end_at,
      firstPaymentSucceededAt: enrollment.first_payment_succeeded_at,
      paidThroughAt: enrollment.paid_through_at,
      renewalPaymentFailed: false,
      renewalGraceEndsAt: null,
      cancelAtPeriodEnd: false,
      accessRevoked: false,
    }
  }
  const supabase: any = {
    from: builder,
    auth: {
      admin: {
        getUserById: async () => ({
          data: {
            user: {
              id: USER,
              email: intent.email,
              app_metadata: {
                checkout_activation_session_hash: paypalCheckoutActivationHash(intent.token),
              },
            },
          },
          error: null,
        }),
      },
    },
    rpc: async (name: string, args: any) => {
      calls.push({ rpc: name, args })
      if (name === "find_paypal_trial_management_callback") return { data: null, error: null }
      if (name === "read_trial_effective_contract")
        return {
          data: {
            accepted_offer: enrollment.accepted_offer,
            provider: "paypal",
            provider_agreement_id: enrollment.provider_agreement_id,
            revision: 0,
          },
          error: null,
        }
      if (name === "get_paypal_trial_checkout_attempt") return { data: { ...attempt }, error: null }
      if (name === "pin_paypal_trial_activation") {
        attempt.authorization_succeeded_at = args.p_authorized_at
        return { data: { ...attempt }, error: null }
      }
      if (name === "admit_trial_enrollment") {
        if (admissionResult === "active")
          Object.assign(enrollment, {
            admission_status: "active",
            provider_agreement_id: args.p_provider_agreement_id,
            authorization_succeeded_at: args.p_authorized_at,
            original_trial_end_at: end,
          })
        else
          Object.assign(enrollment, {
            admission_status: "blocked",
            provider_agreement_id: "I-owned",
            neutralization_required: true,
          })
        return { data: admissionResult, error: null }
      }
      if (name === "release_trial_enrollment") {
        Object.assign(enrollment, { admission_status: "released", neutralization_required: false })
        return { data: true, error: null }
      }
      if (name === "record_trial_payment_event") return { data: paymentResult, error: null }
      if (name === "billing_one_time_access_state") return { data: "none", error: null }
      return { data: null, error: null }
    },
  }
  const deps: any = {
    supabase,
    premiumTierId: "tier",
    paypalTrialRuntime: {
      appId: "APP-owned",
      productId: "PROD-owned",
      monthPlanId: "P-new",
      yearPlanId: "P-year",
      trial: {
        identityKeys: [{ version: 1, secret: new Uint8Array(32).fill(7) }],
        livemode: true,
        enrollmentMode: "disabled",
        catalog,
      },
    },
    attestPayPalApp: async () => "APP-owned",
    retrievePayPalSubscription: async () => structuredClone(subscription),
    patchPayPalTrialStart: async (id: string, start: string) => {
      calls.push({ patchStart: start })
      subscription.start_time = start
      subscription.billing_info.next_billing_time = start
      subscription.status_update_time = new Date().toISOString()
    },
    cancelPayPalSubscription: async () => {
      calls.push({ cancel: true })
      subscription.status = "CANCELLED"
    },
    listPayPalTrialTransactions: async () => [],
  }
  return {
    deps,
    intent,
    attempt,
    enrollment,
    subscription,
    tables,
    calls,
    end,
    authorized,
    setAdmission(value: string) {
      admissionResult = value
    },
    setPayment(value: any) {
      paymentResult = value
    },
  }
}

test("original provider activation pins seven days, and disabled enrollment still reconciles accepted checkout/account", async () => {
  const f = fixture()
  const result = await ensurePayPalTrialCheckoutAccount(f.intent, f.deps)
  assert.equal(result.status, "active")
  assert.equal(f.calls.filter((c) => c.patchStart).length, 1)
  assert.equal(f.calls.find((c) => c.patchStart).patchStart, f.end)
  const admission = f.calls.find((c) => c.rpc === "admit_trial_enrollment")
  assert.equal(admission.args.p_authorized_at, f.authorized)
  assert.equal(
    admission.args.p_claims.some((c: any) => c.kind === "paypal_payer"),
    true,
  )
  assert.equal(f.tables.billing_subscriptions[0].trial_enrollment_id, ENROLLMENT)
  assert.equal(
    f.calls.some((c) => c.rpc === "record_trial_payment_event"),
    false,
  )
  await ensurePayPalTrialCheckoutAccount(f.intent, f.deps)
  assert.equal(f.calls.filter((c) => c.patchStart).length, 1)
})

test("GET ACTIVE or a redirect alone cannot pin an authorization clock or grant an account", async () => {
  const f = fixture()
  f.attempt.authorization_succeeded_at = null
  f.attempt.activation_event_id = null
  assert.deepEqual(await ensurePayPalTrialCheckoutAccount(f.intent, f.deps), { status: "pending" })
  assert.equal(
    f.calls.some((c) => c.patchStart || c.rpc === "admit_trial_enrollment"),
    false,
  )
  assert.equal(f.tables.billing_subscriptions.length, 0)
})

test("verified original ACTIVATED resource is required, including exact intent and plan bindings", async () => {
  const f = fixture()
  await assert.rejects(
    () =>
      pinVerifiedPayPalTrialActivation(
        {
          intent: f.intent,
          subscription: f.subscription,
          eventId: "WH",
          resource: { ...f.subscription, custom_id: "foreign" },
        },
        f.deps,
      ),
    /evidence/,
  )
  await pinVerifiedPayPalTrialActivation(
    { intent: f.intent, subscription: f.subscription, eventId: "WH", resource: f.subscription },
    f.deps,
  )
  assert.equal(
    f.calls.find((c) => c.rpc === "pin_paypal_trial_activation").args.p_authorized_at,
    f.authorized,
  )
})

test("a lost PATCH response re-reads the provider and admits only the exact seven-day boundary", async () => {
  const f = fixture()
  const patch = f.deps.patchPayPalTrialStart
  f.deps.patchPayPalTrialStart = async (...args: any[]) => {
    await patch(...args)
    throw new Error("timeout")
  }
  assert.equal((await ensurePayPalTrialCheckoutAccount(f.intent, f.deps)).status, "active")
  assert.equal(f.enrollment.original_trial_end_at, f.end)
})

test("a rejected patch cancels and reconciles the unadmitted collectible agreement", async () => {
  const f = fixture()
  f.deps.patchPayPalTrialStart = async () => {
    throw new Error("provider rejected")
  }
  assert.deepEqual(await ensurePayPalTrialCheckoutAccount(f.intent, f.deps), {
    status: "duplicate",
  })
  assert.equal(f.subscription.status, "CANCELLED")
  assert.equal(f.enrollment.admission_status, "released")
  assert.equal(f.tables.billing_subscriptions.length, 0)
})

test("a provider start without the exact next billing boundary never grants access", async () => {
  const f = fixture()
  f.deps.patchPayPalTrialStart = async (_id: string, start: string) => {
    f.subscription.start_time = start
  }
  await assert.rejects(() => ensurePayPalTrialCheckoutAccount(f.intent, f.deps), /deadline/)
  assert.equal(f.tables.billing_subscriptions.length, 0)
})

test("a repeated payer is denied and cancellation is confirmed before claims release", async () => {
  const f = fixture()
  f.setAdmission("trial_used")
  assert.deepEqual(await ensurePayPalTrialCheckoutAccount(f.intent, f.deps), {
    status: "duplicate",
  })
  assert.equal(f.tables.billing_subscriptions.length, 0)
  assert.equal(f.subscription.status, "CANCELLED")
  assert.equal(f.enrollment.admission_status, "released")
})

test("a racing transaction prevents denied agreement claim release", async () => {
  const f = fixture()
  f.setAdmission("trial_used")
  f.deps.listPayPalTrialTransactions = async () => [{ id: "SALE-racing", status: "COMPLETED" }]
  await assert.rejects(
    () => ensurePayPalTrialCheckoutAccount(f.intent, f.deps),
    /transaction reconciliation/,
  )
  assert.equal(f.enrollment.neutralization_required, true)
  assert.equal(
    f.calls.some((c) => c.rpc === "release_trial_enrollment"),
    false,
  )
})

test("admission-to-billing interruption replays projection without resetting the original clock", async () => {
  const f = fixture()
  Object.assign(f.enrollment, {
    admission_status: "active",
    provider_agreement_id: "I-owned",
    authorization_succeeded_at: f.authorized,
    original_trial_end_at: f.end,
  })
  f.intent.expires_at = new Date(Date.now() - 1000).toISOString()
  assert.equal((await ensurePayPalTrialCheckoutAccount(f.intent, f.deps)).status, "active")
  assert.equal(f.tables.billing_subscriptions.length, 1)
  assert.equal(
    f.calls.some((c) => c.patchStart || c.rpc === "admit_trial_enrollment"),
    false,
  )
})

test("deleted activated owner cannot resurrect its account through an old accepted intent", async () => {
  const f = fixture()
  Object.assign(f.enrollment, {
    admission_status: "active",
    user_id: null,
    provider_agreement_id: "I-owned",
    original_trial_end_at: f.end,
  })
  await assert.rejects(() => ensurePayPalTrialCheckoutAccount(f.intent, f.deps), /ownership/)
  assert.equal(f.tables.billing_subscriptions.length, 0)
})

test("only retrieved nonzero completed sale reaches payment ledger with authoritative transaction and period", async () => {
  const f = fixture()
  await ensurePayPalTrialCheckoutAccount(f.intent, f.deps)
  const paidAt = f.end
  const paidEnd = new Date(Date.parse(paidAt) + 31 * 86400000).toISOString()
  f.subscription.billing_info = { next_billing_time: paidEnd, last_payment: { time: paidAt } }
  f.deps.listPayPalTrialTransactions = async () => [
    {
      id: "SALE-1",
      status: "COMPLETED",
      time: paidAt,
      amount_with_breakdown: { gross_amount: { value: "9.99", currency_code: "EUR" } },
    },
  ]
  const event: any = {
    id: "WH-sale",
    event_type: "PAYMENT.SALE.COMPLETED",
    resource: { id: "SALE-1", create_time: paidAt },
  }
  await recordVerifiedPayPalTrialSale(event, f.subscription, f.deps)
  const ledger = f.calls.find((c) => c.rpc === "record_trial_payment_event").args.p_event
  assert.equal(ledger.sourceObjectId, "SALE-1")
  assert.equal(ledger.occurredAt, paidAt)
  assert.equal(ledger.amountMinor, 999)
  assert.equal(ledger.periodStartAt, f.end)
  assert.equal(ledger.periodEndAt, paidEnd)
  f.enrollment.first_payment_succeeded_at = paidAt
  f.setPayment({ outcome: "duplicate", phase: "first_paid" })
  await recordVerifiedPayPalTrialSale(
    { ...event, id: "WH-sale-redelivery" },
    f.subscription,
    f.deps,
  )
  assert.equal(f.calls.filter((c) => c.rpc === "record_trial_payment_event").length, 2)
})

test("ACTIVE and a zero or pending sale cannot manufacture paid revenue", async () => {
  const f = fixture()
  await ensurePayPalTrialCheckoutAccount(f.intent, f.deps)
  const event: any = { id: "WH-sale", resource: { id: "SALE-1", create_time: f.end } }
  for (const transaction of [
    {
      id: "SALE-1",
      status: "COMPLETED",
      time: f.end,
      amount_with_breakdown: { gross_amount: { value: "0", currency_code: "EUR" } },
    },
    {
      id: "SALE-1",
      status: "PENDING",
      time: f.end,
      amount_with_breakdown: { gross_amount: { value: "9.99", currency_code: "EUR" } },
    },
  ]) {
    f.deps.listPayPalTrialTransactions = async () => [transaction]
    await assert.rejects(
      () => recordVerifiedPayPalTrialSale(event, f.subscription, f.deps),
      /not verified/,
    )
  }
  assert.equal(
    f.calls.some((c) => c.rpc === "record_trial_payment_event"),
    false,
  )
})

test("verified webhook dispatch completes trial account without a browser return and never runs legacy paid activation", async () => {
  const f = fixture()
  const result = await handlePayPalWebhookEvent(
    {
      id: "WH-original",
      event_type: "BILLING.SUBSCRIPTION.ACTIVATED",
      resource: structuredClone(f.subscription),
    },
    { ...f.deps, freeTierId: "free" },
  )
  assert.equal(result.handled, true)
  assert.equal(f.enrollment.admission_status, "active")
  assert.equal(f.tables.billing_subscriptions[0].trial_enrollment_id, ENROLLMENT)
  assert.equal(
    f.calls.some((c) => c.rpc === "record_trial_payment_event"),
    false,
  )
})

test("a delayed cancellation for the original agreement cannot cancel a current restored agreement", async () => {
  const f = fixture()
  Object.assign(f.enrollment, {
    admission_status: "active",
    provider_agreement_id: "I-owned",
    authorization_succeeded_at: f.authorized,
    original_trial_end_at: f.end,
  })
  f.subscription.status = "CANCELLED"
  const originalRpc = f.deps.supabase.rpc
  f.deps.supabase.rpc = async (name: string, args: any) =>
    name === "read_trial_effective_contract"
      ? {
          data: {
            accepted_offer: f.enrollment.accepted_offer,
            provider: "paypal",
            provider_agreement_id: "I-restored",
            revision: 1,
          },
          error: null,
        }
      : originalRpc(name, args)
  assert.equal(
    await handlePayPalTrialWebhook(
      { id: "WH-old-cancel", event_type: "BILLING.SUBSCRIPTION.CANCELLED" },
      f.subscription,
      f.deps,
    ),
    true,
  )
  assert.equal(f.enrollment.cancel_at_period_end, false)
})

test("setup-fee webhook replay uses its committed exact paid period instead of future regular start", async () => {
  const f = fixture()
  await ensurePayPalTrialCheckoutAccount(f.intent, f.deps)
  const at = new Date(Date.now() - 10000).toISOString(),
    end = new Date(Date.now() + 30 * 86400000).toISOString()
  f.enrollment.first_payment_succeeded_at = at
  f.enrollment.paid_through_at = end
  f.subscription.custom_id = "trial-paid-recovery:operation"
  f.subscription.start_time = end
  f.subscription.billing_info = { next_billing_time: end }
  f.deps.listPayPalTrialTransactions = async () => [
    {
      id: "SETUP",
      time: at,
      status: "COMPLETED",
      amount_with_breakdown: { gross_amount: { value: "9.99", currency_code: "EUR" } },
    },
  ]
  const rpc = f.deps.supabase.rpc
  f.deps.supabase.rpc = async (name: string, args: any) =>
    name === "find_paypal_trial_paid_recovery_callback"
      ? {
          data: {
            status: "committed",
            payment: {
              sourceObjectId: "SETUP",
              occurredAt: at,
              amountMinor: 999,
              periodStartAt: at,
              periodEndAt: end,
            },
          },
          error: null,
        }
      : rpc(name, args)
  f.setPayment({ outcome: "duplicate", phase: "first_paid" })
  await recordVerifiedPayPalTrialSale(
    {
      id: "WH-setup",
      event_type: "PAYMENT.SALE.COMPLETED",
      resource: { id: "SETUP", create_time: at },
    },
    f.subscription,
    f.deps,
  )
  const payment = f.calls.find((c) => c.rpc === "record_trial_payment_event").args.p_event
  assert.equal(payment.periodStartAt, at)
  assert.equal(payment.periodEndAt, end)
})

test("typed access conflict neutralizes the duplicate agreement even when its message changes", async () => {
  const f = fixture()
  const conflict = new CheckoutAccessAlreadyExistsError()
  conflict.message = "A different localized access conflict message"
  f.deps.assertCheckoutAccess = async () => {
    throw conflict
  }
  assert.deepEqual(await ensurePayPalTrialCheckoutAccount(f.intent, f.deps), {
    status: "duplicate",
  })
  assert.equal(f.calls.filter((c) => c.cancel).length, 1)
  assert.equal(f.tables.billing_subscriptions.length, 0)
  assert.equal(
    f.calls.some((c) => c.rpc === "admit_trial_enrollment"),
    false,
  )
})
test("an unrelated error with old access-conflict words is propagated without canceling the agreement", async () => {
  const f = fixture()
  const error = new Error("backend failure: already has access cache unavailable")
  f.deps.assertCheckoutAccess = async () => {
    throw error
  }
  await assert.rejects(ensurePayPalTrialCheckoutAccount(f.intent, f.deps), error)
  assert.equal(f.calls.filter((c) => c.cancel).length, 0)
  assert.equal(f.tables.billing_subscriptions.length, 0)
})
