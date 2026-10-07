import { PayPalRequestError } from "../src/lib/paypal/client"
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
import {
  frozenPayPalTrialStart,
  paypalTrialCollectionStart,
  paypalTrialProviderStart,
} from "../src/lib/paypal/trial-collection-start"
import { paypalCheckoutActivationHash } from "../src/lib/paypal/checkout-activation"
import { getPersistedTrialRecoveryCode } from "../src/lib/paypal/trial-account-admission"
import { CheckoutRecoveryError } from "../src/lib/auth/checkout-activation-outcome"

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
  // Checkout froze two minutes ago; the PayPal trial end is the collection
  // midnight fixed at that freeze (next UTC midnight after freeze + 8 days).
  const requestExpiresAt = new Date(now - 120_000 + 3 * 86400000).toISOString()
  const end = frozenPayPalTrialStart(requestExpiresAt)
  // Trial end an agreement admitted under the retired contract would carry.
  const legacyEnd = new Date(Date.parse(authorized) + 7 * 86400000).toISOString()
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
    request_expires_at: requestExpiresAt,
    provider_reference: "I-owned",
    authorization_succeeded_at: authorized,
    activation_event_id: "WH-original",
  }
  const enrollment: any = {
    id: ENROLLMENT,
    user_id: USER,
    provider: "paypal",
    admission_status: "reserved",
    admission_recovery_reason: null,
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
    start_time: end,
    // A verified example batch; creation time alone does not guarantee this date.
    billing_info: { next_billing_time: new Date(Date.parse(end) + 10 * 3600 * 1000).toISOString() },
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
      if (name === "get_paypal_trial_checkout_attempt_v2")
        return { data: { ...attempt }, error: null }
      if (name === "pin_paypal_trial_activation") {
        if (
          !attempt.authorization_succeeded_at &&
          Date.parse(args.p_authorized_at) > Date.parse(intent.expires_at)
        ) {
          Object.assign(enrollment, {
            admission_status: "blocked",
            neutralization_required: true,
            provider_agreement_id: args.p_agreement_id,
          })
          return { data: { ...attempt }, error: null }
        }
        if (!attempt.authorization_succeeded_at) {
          attempt.authorization_succeeded_at = args.p_authorized_at
          attempt.activation_event_id = args.p_event_id
          attempt.authorization_proof_kind = "webhook"
        }
        return { data: { ...attempt }, error: null }
      }
      if (name === "confirm_paypal_trial_activation") {
        if (!attempt.authorization_succeeded_at)
          Object.assign(attempt, {
            authorization_proof_kind: "api_confirmation",
            authorization_succeeded_at: new Date().toISOString(),
            api_confirmed_at: new Date().toISOString(),
            api_confirmation_id: args.p_confirmation_id,
            activation_event_id: null,
          })
        if (attempt.authorization_proof_kind === "api_confirmation")
          attempt.api_confirmed_at = attempt.authorization_succeeded_at
        return { data: { ...attempt }, error: null }
      }
      if (name === "admit_trial_enrollment") {
        if (admissionResult === "active")
          Object.assign(enrollment, {
            admission_status: "active",
            provider_agreement_id: args.p_provider_agreement_id,
            authorization_succeeded_at: args.p_authorized_at,
            original_trial_end_at: args.p_original_trial_end_at ?? legacyEnd,
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
    // The frozen-end contract never patches an initial agreement.
    patchPayPalTrialStart: async () => {
      throw new Error("initial trial agreements must not be patched")
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
    legacyEnd,
    authorized,
    setAdmission(value: string) {
      admissionResult = value
    },
    setPayment(value: any) {
      paymentResult = value
    },
  }
}

test("original provider activation stores the frozen trial end without patching the agreement, and disabled enrollment still reconciles accepted checkout/account", async () => {
  const f = fixture()
  const result = await ensurePayPalTrialCheckoutAccount(f.intent, f.deps)
  assert.equal(result.status, "active")
  assert.equal(result.status === "active" && result.trialEndAt, f.end)
  assert.equal(f.subscription.start_time, f.end)
  const admission = f.calls.find((c) => c.rpc === "admit_trial_enrollment")
  assert.equal(admission.args.p_authorized_at, f.authorized)
  assert.equal(admission.args.p_original_trial_end_at, f.end)
  assert.equal(f.enrollment.original_trial_end_at, f.end)
  assert.equal(
    admission.args.p_claims.some((c: any) => c.kind === "paypal_payer"),
    true,
  )
  assert.equal(f.tables.billing_subscriptions[0].trial_enrollment_id, ENROLLMENT)
  assert.equal(
    f.calls.some((c) => c.rpc === "record_trial_payment_event"),
    false,
  )
  assert.equal((await ensurePayPalTrialCheckoutAccount(f.intent, f.deps)).status, "active")
  assert.equal(f.calls.filter((c) => c.rpc === "admit_trial_enrollment").length, 1)
})

test("GET ACTIVE or a redirect alone cannot pin an authorization clock or grant an account", async () => {
  const f = fixture()
  f.attempt.authorization_succeeded_at = null
  f.attempt.activation_event_id = null
  assert.deepEqual(await ensurePayPalTrialCheckoutAccount(f.intent, f.deps), { status: "pending" })
  assert.equal(
    f.calls.some((c) => c.rpc === "admit_trial_enrollment"),
    false,
  )
  assert.equal(f.tables.billing_subscriptions.length, 0)
})

test("verified original ACTIVATED resource is required, including exact intent and plan bindings", async () => {
  const f = fixture()
  f.attempt.authorization_succeeded_at = null
  f.attempt.activation_event_id = null
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

test("an agreement created with the retired provisional start is closed and neutralized so the customer retries", async () => {
  const f = fixture()
  // Attempts frozen before the frozen-end contract requested start_time =
  // freeze + 7 days (request_expires_at + 4 days), echoed in whole seconds.
  const retired = new Date(
    Math.floor((Date.parse(f.attempt.request_expires_at) + 4 * 86400000) / 1000) * 1000,
  ).toISOString()
  f.subscription.start_time = retired
  f.subscription.billing_info.next_billing_time = retired
  assert.deepEqual(await ensurePayPalTrialCheckoutAccount(f.intent, f.deps), {
    status: "duplicate",
    recoveryCode: "trial_checkout_closed",
  })
  assert.equal(f.subscription.status, "CANCELLED")
  assert.equal(f.enrollment.admission_status, "released")
  assert.equal(f.tables.billing_subscriptions.length, 0)
})

test("a provider batch outside the collection window never grants access", async () => {
  const f = fixture()
  f.subscription.billing_info.next_billing_time = new Date(
    Date.parse(f.end) + 3 * 86400000,
  ).toISOString()
  await assert.rejects(
    () => ensurePayPalTrialCheckoutAccount(f.intent, f.deps),
    (error: unknown) =>
      error instanceof CheckoutRecoveryError && error.code === "trial_reconciliation_required",
  )
  assert.equal(f.tables.billing_subscriptions.length, 0)
  assert.equal(f.subscription.status, "ACTIVE")
})

test("a repeated payer is denied and cancellation is confirmed before claims release", async () => {
  const f = fixture()
  f.setAdmission("trial_used")
  assert.deepEqual(await ensurePayPalTrialCheckoutAccount(f.intent, f.deps), {
    status: "duplicate",
    recoveryCode: "trial_unavailable",
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
    (error: unknown) =>
      error instanceof CheckoutRecoveryError && error.code === "trial_reconciliation_required",
  )
  assert.equal(f.enrollment.neutralization_required, true)
  assert.equal(
    f.calls.some((c) => c.rpc === "release_trial_enrollment"),
    false,
  )
})

test("an invalid PayPal admission result requires reconciliation without granting or neutralizing", async () => {
  const f = fixture()
  f.setAdmission("invalid_state")
  await assert.rejects(
    () => ensurePayPalTrialCheckoutAccount(f.intent, f.deps),
    (error: unknown) =>
      error instanceof CheckoutRecoveryError && error.code === "trial_reconciliation_required",
  )
  assert.equal(f.tables.billing_subscriptions.length, 0)
  assert.equal(
    f.calls.some((call) => call.cancel),
    false,
  )
  assert.equal(
    f.calls.some((call) => call.rpc === "release_trial_enrollment"),
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
    f.calls.some((c) => c.rpc === "admit_trial_enrollment"),
    false,
  )
})

test("an agreement admitted under the retired seven-day contract still replays through the active path", async () => {
  const f = fixture()
  Object.assign(f.enrollment, {
    admission_status: "active",
    provider_agreement_id: "I-owned",
    authorization_succeeded_at: f.authorized,
    original_trial_end_at: f.legacyEnd,
  })
  f.subscription.start_time = f.legacyEnd
  f.subscription.billing_info.next_billing_time = f.legacyEnd
  const result = await ensurePayPalTrialCheckoutAccount(f.intent, f.deps)
  assert.equal(result.status, "active")
  assert.equal(result.status === "active" && result.trialEndAt, f.legacyEnd)
  assert.equal(f.tables.billing_subscriptions.length, 1)
  assert.equal(
    f.calls.some((c) => c.rpc === "admit_trial_enrollment"),
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
  const paidAt = new Date(
    Date.parse(paypalTrialCollectionStart(f.end)) + 10 * 3600 * 1000,
  ).toISOString()
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
  assert.equal(ledger.periodStartAt, paidAt)
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
    recoveryCode: "checkout_existing_access",
  })
  assert.equal(f.calls.filter((c) => c.cancel).length, 1)
  assert.equal(f.tables.billing_subscriptions.length, 0)
  assert.equal(
    f.calls.some((c) => c.rpc === "admit_trial_enrollment"),
    false,
  )
  assert.equal(f.enrollment.admission_recovery_reason, "existing_access")
  assert.deepEqual(await ensurePayPalTrialCheckoutAccount(f.intent, f.deps), {
    status: "duplicate",
    recoveryCode: "checkout_existing_access",
  })
})

test("PayPal existing-access cleanup failure preserves its recovery reason for a successful replay", async () => {
  const f = fixture()
  const conflict = new CheckoutAccessAlreadyExistsError()
  f.deps.assertCheckoutAccess = async () => {
    throw conflict
  }
  const cancel = f.deps.cancelPayPalSubscription
  f.deps.cancelPayPalSubscription = async () => {
    throw new Error("provider cancellation timeout")
  }
  await assert.rejects(
    () => ensurePayPalTrialCheckoutAccount(f.intent, f.deps),
    (error: unknown) =>
      error instanceof CheckoutRecoveryError && error.code === "trial_reconciliation_required",
  )
  assert.equal(f.enrollment.admission_recovery_reason, "existing_access")
  assert.equal(f.enrollment.neutralization_required, true)
  assert.equal(f.tables.billing_subscriptions.length, 0)

  f.deps.cancelPayPalSubscription = cancel
  assert.deepEqual(await ensurePayPalTrialCheckoutAccount(f.intent, f.deps), {
    status: "duplicate",
    recoveryCode: "checkout_existing_access",
  })
  assert.equal(f.enrollment.admission_status, "released")
  assert.equal(f.enrollment.neutralization_required, false)
})

test("persisted PayPal terminal admissions retain only verified recovery reasons", () => {
  assert.equal(
    getPersistedTrialRecoveryCode({
      admission_status: "blocked",
      admission_recovery_reason: "existing_access",
      neutralization_required: true,
    }),
    "trial_reconciliation_required",
  )
  assert.equal(
    getPersistedTrialRecoveryCode({
      admission_status: "released",
      admission_recovery_reason: "existing_access",
      admission_denial_reason: "trial_used",
      neutralization_required: false,
    }),
    "checkout_existing_access",
  )
  assert.equal(
    getPersistedTrialRecoveryCode({
      admission_status: "released",
      admission_denial_reason: "trial_used",
      neutralization_required: false,
    }),
    "trial_unavailable",
  )
  assert.equal(
    getPersistedTrialRecoveryCode({
      admission_status: "blocked",
      admission_denial_reason: "claim_reserved",
      neutralization_required: false,
    }),
    "trial_checkout_conflict",
  )
  assert.equal(
    getPersistedTrialRecoveryCode({
      admission_status: "released",
      admission_denial_reason: null,
      neutralization_required: false,
    }),
    "trial_checkout_closed",
  )
  assert.equal(
    getPersistedTrialRecoveryCode({
      admission_status: "blocked",
      admission_denial_reason: "trial_used",
      neutralization_required: true,
    }),
    "trial_reconciliation_required",
  )
  assert.equal(
    getPersistedTrialRecoveryCode({
      admission_status: "reserved",
      admission_denial_reason: "trial_used",
      neutralization_required: false,
    }),
    null,
  )
})

test("persisted PayPal cleanup returns its settled denial reason after release", async () => {
  const f = fixture()
  Object.assign(f.enrollment, {
    admission_status: "blocked",
    admission_denial_reason: "trial_used",
    neutralization_required: true,
  })
  assert.deepEqual(await ensurePayPalTrialCheckoutAccount(f.intent, f.deps), {
    status: "duplicate",
    recoveryCode: "trial_unavailable",
  })
  assert.equal(f.enrollment.admission_status, "released")
  assert.equal(f.enrollment.neutralization_required, false)
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

test("trial authorization timestamp qualifies a legacy-quiz lead for the plan destination cutover", async () => {
  const LEAD = "44444444-4444-4444-8444-444444444444"
  const values = {
    PERSONAL_PLAN_LEGACY_QUIZ_CUTOVER_ENABLED: "true",
    PERSONAL_PLAN_APP_V1_NEW_BUYER_CUTOFF: "2026-08-12T19:06:16Z",
  }
  const previous = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]))
  try {
    Object.assign(process.env, values)
    const f = fixture()
    f.intent.lead_id = LEAD
    // The lead is linked by the activation projection itself; a resolver that
    // runs before linking sees no owned lead and must come back ineligible.
    f.tables.leads = [{ id: LEAD, user_id: null, quiz_kind: "legacy" }]
    f.deps.linkQuizToProfile = async () => {
      f.tables.leads[0].user_id = USER
    }
    const result = await ensurePayPalTrialCheckoutAccount(f.intent, f.deps)
    assert.equal(result.status, "active")
    assert.equal((result as any).legacyQuizFuturePurchaseEligible, true)
    const replay = await ensurePayPalTrialCheckoutAccount(f.intent, f.deps)
    assert.equal(replay.status, "active")
    assert.equal((replay as any).legacyQuizFuturePurchaseEligible, true)
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
})

test("a provider start that is not the frozen trial end fails closed for reconciliation", async () => {
  for (const start of [
    new Date(Date.parse(fixture().end) + 1000).toISOString(),
    new Date(Date.parse(fixture().end) - 1000).toISOString(),
    "not-a-timestamp",
  ]) {
    const f = fixture()
    f.subscription.start_time = start
    f.subscription.billing_info.next_billing_time = new Date(
      Date.parse(f.end) + 10 * 3600 * 1000,
    ).toISOString()
    await assert.rejects(
      () => ensurePayPalTrialCheckoutAccount(f.intent, f.deps),
      /trial_reconciliation_required/,
      start,
    )
    assert.equal(f.subscription.status, "ACTIVE", start)
    assert.equal(f.tables.billing_subscriptions.length, 0, start)
  }
})

test("the frozen trial end with the provider's morning batch verifies and activates untouched", async () => {
  const f = fixture()
  const result = await ensurePayPalTrialCheckoutAccount(f.intent, f.deps)
  assert.equal(result.status, "active")
  assert.equal(f.subscription.start_time, f.end)
  assert.equal(paypalTrialCollectionStart(f.end), f.end)
})

test("a batch scheduled exactly at the frozen trial end is accepted", async () => {
  const f = fixture()
  f.subscription.billing_info.next_billing_time = f.end
  assert.equal((await ensurePayPalTrialCheckoutAccount(f.intent, f.deps)).status, "active")
})

test("a batch scheduled inside the trial window is rejected", async () => {
  const f = fixture()
  // Regression guard for the observed incident: provider floors the batch
  // onto a date before the promised trial end.
  f.subscription.billing_info.next_billing_time = new Date(
    Date.parse(f.end) - 2 * 3600 * 1000,
  ).toISOString()
  await assert.rejects(
    () => ensurePayPalTrialCheckoutAccount(f.intent, f.deps),
    /trial_reconciliation_required/,
  )
})

test("the annual live incident's prior-day billing batch cannot admit a trial or consume its identity", async () => {
  const f = fixture()
  const offer = createTrialOfferSnapshot("year", catalog)
  f.intent.interval = "year"
  f.intent.metadata.paypal_plan_id = "P-year"
  f.attempt.accepted_offer = offer
  f.attempt.paypal_plan_id = "P-year"
  f.enrollment.accepted_offer = offer
  f.subscription.plan_id = "P-year"
  f.subscription.plan = buildPayPalDeferredTrialPlanRequest({
    interval: "year",
    productId: "PROD-owned",
  })
  // Live 2026-09-15: requested Sep 24 00:00Z, next billing Sep 23 10:00Z.
  // Preserve the observed 14-hour difference relative to the fixture clock.
  f.subscription.billing_info.next_billing_time = new Date(
    Date.parse(f.end) - 14 * 3600 * 1000,
  ).toISOString()

  await assert.rejects(
    () => ensurePayPalTrialCheckoutAccount(f.intent, f.deps),
    (error: unknown) =>
      error instanceof CheckoutRecoveryError &&
      error.code === "trial_reconciliation_required" &&
      error.cause instanceof Error &&
      error.cause.message.includes("billing deadline is not verified"),
  )
  assert.equal(f.enrollment.admission_status, "reserved")
  assert.equal(f.enrollment.provider_agreement_id, null)
  assert.equal(f.enrollment.original_trial_end_at, null)
  assert.equal(
    f.calls.some((call) => call.rpc === "admit_trial_enrollment"),
    false,
  )
  assert.equal(f.tables.billing_subscriptions.length, 0)
  assert.equal(f.subscription.status, "ACTIVE")
})

test("an approval too late for the frozen trial end closes the checkout without consuming the trial", async () => {
  const f = fixture()
  // Frozen five days ago: the frozen end now sits less than seven days after
  // this approval, so the promised 7 × 24h could not be honoured.
  f.attempt.request_expires_at = new Date(Date.now() - 2 * 86400000).toISOString()
  const end = frozenPayPalTrialStart(f.attempt.request_expires_at)
  assert.ok(Date.parse(end) > Date.now() && Date.parse(end) < Date.parse(f.legacyEnd))
  f.subscription.start_time = end
  f.subscription.billing_info.next_billing_time = new Date(
    Date.parse(end) + 10 * 3600 * 1000,
  ).toISOString()
  assert.deepEqual(await ensurePayPalTrialCheckoutAccount(f.intent, f.deps), {
    status: "duplicate",
    recoveryCode: "trial_checkout_closed",
  })
  assert.equal(f.subscription.status, "CANCELLED")
  assert.equal(f.enrollment.admission_status, "released")
})

for (const interval of ["month", "year"] as const) {
  test(`noon schedule admits ${interval} without moving the promised trial end`, async () => {
    const f = fixture()
    const offer = createTrialOfferSnapshot(interval, catalog)
    f.intent.interval = interval
    f.intent.metadata.paypal_plan_id = `P-${interval}`
    Object.assign(f.attempt, {
      accepted_offer: offer,
      paypal_plan_id: `P-${interval}`,
      request_id: `paypal-trial:${ATTEMPT}:v2`,
    })
    f.enrollment.accepted_offer = offer
    f.subscription.plan_id = `P-${interval}`
    f.subscription.plan = buildPayPalDeferredTrialPlanRequest({ interval, productId: "PROD-owned" })
    const noon = new Date(Date.parse(f.end) + 12 * 3600000).toISOString()
    Object.assign(f.attempt, { provider_start_time: noon, trial_end_at: f.end })
    f.subscription.start_time = noon
    f.subscription.billing_info = {
      next_billing_time: new Date(Date.parse(f.end) + 10 * 3600000).toISOString(),
    }
    const result = await ensurePayPalTrialCheckoutAccount(f.intent, f.deps)
    assert.equal(result.status === "active" && result.trialEndAt, f.end)
    assert.equal(f.enrollment.original_trial_end_at, f.end)
  })
}

test("noon activation fails closed on missing, corrupt or conflicting frozen schedules", async () => {
  for (const patch of [
    {},
    { trial_end_at: null, provider_start_time: "bad" },
    { trial_end_at: "bad", provider_start_time: "bad" },
    { trial_end_at: "2026-09-24T00:00:00Z", provider_start_time: null },
  ]) {
    const f = fixture()
    Object.assign(f.attempt, { request_id: `paypal-trial:${ATTEMPT}:v2`, ...patch })
    await assert.rejects(
      () => ensurePayPalTrialCheckoutAccount(f.intent, f.deps),
      /schedule unavailable/,
    )
    assert.equal(
      f.calls.some((c) => c.rpc === "admit_trial_enrollment"),
      false,
    )
    assert.equal(f.tables.billing_subscriptions.length, 0)
  }
})

test("noon request keeps the billing bounds and exact start binding on admission", async () => {
  for (const variant of ["early", "upper", "missing", "malformed", "wrong_start"]) {
    const f = fixture()
    const noon = new Date(Date.parse(f.end) + 12 * 3600000).toISOString()
    Object.assign(f.attempt, {
      request_id: `paypal-trial:${ATTEMPT}:v2`,
      provider_start_time: noon,
      trial_end_at: f.end,
    })
    f.subscription.start_time = variant === "wrong_start" ? f.end : noon
    f.subscription.billing_info.next_billing_time =
      variant === "early"
        ? new Date(Date.parse(f.end) - 14 * 3600000).toISOString()
        : variant === "upper"
          ? new Date(Date.parse(f.end) + 48 * 3600000).toISOString()
          : variant === "missing"
            ? undefined
            : variant === "malformed"
              ? "bad"
              : f.end
    await assert.rejects(
      () => ensurePayPalTrialCheckoutAccount(f.intent, f.deps),
      /trial_reconciliation_required/,
    )
    assert.equal(f.enrollment.admission_status, "reserved")
    assert.equal(f.subscription.status, "ACTIVE")
    assert.equal(
      f.calls.some((c) => c.rpc === "admit_trial_enrollment"),
      false,
    )
    assert.equal(f.tables.billing_subscriptions.length, 0)
  }
})

test("an admitted noon trial replays with its original midnight end", async () => {
  const f = fixture()
  const noon = new Date(Date.parse(f.end) + 12 * 3600000).toISOString()
  Object.assign(f.attempt, {
    request_id: `paypal-trial:${ATTEMPT}:v2`,
    provider_start_time: noon,
    trial_end_at: f.end,
  })
  f.subscription.start_time = noon
  await ensurePayPalTrialCheckoutAccount(f.intent, f.deps)
  const result = await ensurePayPalTrialCheckoutAccount(f.intent, f.deps)
  assert.equal(result.status === "active" && result.trialEndAt, f.end)
  assert.equal(f.tables.billing_subscriptions.length, 1)
})

function apiFixture() {
  const f = fixture()
  Object.assign(f.attempt, {
    request_id: `paypal-trial:${ATTEMPT}:v2`,
    trial_end_at: f.end,
    provider_start_time: paypalTrialProviderStart(f.end),
    authorization_succeeded_at: null,
    activation_event_id: null,
    authorization_proof_kind: null,
    api_confirmation_id: null,
    api_confirmed_at: null,
  })
  Object.assign(f.intent.metadata, {
    accepted_offer: f.attempt.accepted_offer,
    paypal_app_id: f.attempt.paypal_app_id,
    paypal_product_id: f.attempt.paypal_product_id,
    paypal_request_id: f.attempt.request_id,
  })
  const rpc = f.deps.supabase.rpc
  f.deps.supabase.rpc = async (name: string, args: any) =>
    name === "get_paypal_trial_plan_catalog"
      ? {
          data: {
            enrollment_id: ENROLLMENT,
            app_id: "APP-owned",
            product_id: "PROD-owned",
            month_plan_id: "P-month",
            year_plan_id: "P-year",
          },
          error: null,
        }
      : rpc(name, args)
  f.subscription.start_time = f.attempt.provider_start_time
  f.deps.apiConfirmationEnabled = true
  return f
}

test("fresh v2 ACTIVE server evidence admits before any webhook using the DB confirmation clock", async () => {
  const f = apiFixture()
  const result = await ensurePayPalTrialCheckoutAccount(f.intent, f.deps)
  assert.equal(result.status, "active")
  const proof = f.calls.find((c) => c.rpc === "confirm_paypal_trial_activation")
  assert.ok(proof)
  assert.deepEqual(
    Object.keys(proof.args).sort(),
    [
      "p_token",
      "p_agreement_id",
      "p_confirmation_id",
      "p_app_id",
      "p_plan_id",
      "p_provider_start_time",
      "p_next_billing_time",
    ].sort(),
  )
  assert.match(proof.args.p_confirmation_id, /^[0-9a-f-]{36}$/)
  assert.equal(proof.args.p_agreement_id, "I-owned")
  assert.equal(proof.args.p_app_id, "APP-owned")
  assert.equal(proof.args.p_plan_id, "P-month")
  assert.equal(proof.args.p_provider_start_time, f.subscription.start_time)
  assert.equal(proof.args.p_next_billing_time, f.subscription.billing_info.next_billing_time)
  assert.equal(f.attempt.activation_event_id, null)
  assert.equal(f.enrollment.authorization_succeeded_at, f.attempt.api_confirmed_at)
  assert.notEqual(f.enrollment.authorization_succeeded_at, f.subscription.status_update_time)
  assert.equal(f.enrollment.original_trial_end_at, f.end)
})

test("API confirmation disabled and non-ACTIVE evidence preserve webhook fallback", async () => {
  for (const status of ["ACTIVE", "APPROVED", "CANCELLED", "SUSPENDED"]) {
    const f = apiFixture()
    f.subscription.status = status
    f.deps.apiConfirmationEnabled = status !== "ACTIVE"
    assert.deepEqual(await ensurePayPalTrialCheckoutAccount(f.intent, f.deps), {
      status: "pending",
    })
    assert.equal(
      f.calls.some(
        (c) => c.rpc === "confirm_paypal_trial_activation" || c.rpc === "admit_trial_enrollment",
      ),
      false,
    )
  }
})

test("API proof is never requested for mismatched accepted bindings or incomplete provider evidence", async () => {
  for (const change of [
    (f: any) => {
      f.subscription.id = "I-foreign"
    },
    (f: any) => {
      f.subscription.custom_id = "foreign"
    },
    (f: any) => {
      f.subscription.plan_id = "P-foreign"
    },
    (f: any) => {
      f.deps.attestPayPalApp = async () => "APP-foreign"
    },
    (f: any) => {
      f.subscription.plan.product_id = "PROD-foreign"
    },
    (f: any) => {
      f.subscription.subscriber.payer_id = ""
    },
    (f: any) => {
      f.subscription.start_time = f.end
    },
    (f: any) => {
      f.subscription.billing_info.next_billing_time = "invalid"
    },
  ]) {
    const f = apiFixture()
    change(f)
    await assert.rejects(() => ensurePayPalTrialCheckoutAccount(f.intent, f.deps))
    assert.equal(
      f.calls.some(
        (c) => c.rpc === "confirm_paypal_trial_activation" || c.rpc === "admit_trial_enrollment",
      ),
      false,
    )
  }
})

test("an expired API observation stays pending without neutralizing a potentially timely webhook", async () => {
  const f = apiFixture()
  f.intent.expires_at = new Date(Date.now() - 1000).toISOString()
  assert.deepEqual(await ensurePayPalTrialCheckoutAccount(f.intent, f.deps), { status: "pending" })
  assert.equal(
    f.calls.some((c) => c.cancel || c.rpc === "confirm_paypal_trial_activation"),
    false,
  )
  assert.equal(f.enrollment.admission_status, "reserved")
})

test("API proof completion survives feature rollback and late activation evidence without resetting clock", async () => {
  const f = apiFixture()
  const confirmationAt = new Date(Date.now() - 10_000).toISOString()
  Object.assign(f.attempt, {
    authorization_proof_kind: "api_confirmation",
    authorization_succeeded_at: confirmationAt,
    api_confirmed_at: confirmationAt,
    api_confirmation_id: "44444444-4444-4444-8444-444444444444",
  })
  f.deps.apiConfirmationEnabled = false
  f.intent.expires_at = new Date(Date.now() - 1000).toISOString()
  await pinVerifiedPayPalTrialActivation(
    {
      intent: f.intent,
      subscription: f.subscription,
      eventId: "WH-late",
      resource: { ...f.subscription, status_update_time: new Date().toISOString() },
    },
    f.deps,
  )
  assert.equal(
    f.calls.some((c) => c.cancel),
    false,
  )
  assert.equal((await ensurePayPalTrialCheckoutAccount(f.intent, f.deps)).status, "active")
  assert.equal(f.enrollment.authorization_succeeded_at, confirmationAt)
  assert.equal(f.attempt.activation_event_id, null)
  assert.equal(
    f.calls.some((c) => c.rpc === "confirm_paypal_trial_activation"),
    false,
  )
})

test("a canceled activation snapshot acknowledges an already canceled and released API-proven trial", async () => {
  const f = apiFixture()
  const confirmedAt = new Date(Date.now() - 10_000).toISOString()
  Object.assign(f.attempt, {
    authorization_proof_kind: "api_confirmation",
    authorization_succeeded_at: confirmedAt,
    api_confirmed_at: confirmedAt,
    api_confirmation_id: "44444444-4444-4444-8444-444444444444",
    activation_event_id: null,
  })
  Object.assign(f.enrollment, {
    admission_status: "released",
    provider_agreement_id: f.subscription.id,
    neutralization_required: false,
    neutralization_evidence: `paypal:canceled:${f.subscription.id}`,
  })
  f.subscription.status = "CANCELLED"
  const activationResource = {
    ...f.subscription,
    status_update_time: new Date().toISOString(),
  }

  assert.equal(
    await handlePayPalTrialWebhook(
      {
        id: "WH-late-canceled",
        event_type: "BILLING.SUBSCRIPTION.ACTIVATED",
        resource: activationResource,
      },
      f.subscription,
      f.deps,
    ),
    true,
  )
  assert.equal(f.enrollment.admission_status, "released")
  assert.equal(f.attempt.authorization_succeeded_at, confirmedAt)
  assert.equal(f.tables.billing_subscriptions.length, 0)
  assert.equal(
    f.calls.some((call) => call.rpc === "pin_paypal_trial_activation"),
    false,
  )
})

test("a proven canceled activation snapshot may omit its status clock", async () => {
  const f = apiFixture()
  Object.assign(f.attempt, {
    authorization_proof_kind: "api_confirmation",
    authorization_succeeded_at: new Date(Date.now() - 10_000).toISOString(),
    api_confirmed_at: new Date(Date.now() - 10_000).toISOString(),
    api_confirmation_id: "44444444-4444-4444-8444-444444444444",
    activation_event_id: null,
  })
  Object.assign(f.enrollment, {
    admission_status: "released",
    provider_agreement_id: f.subscription.id,
    neutralization_required: false,
  })
  f.subscription.status = "CANCELLED"
  assert.equal(
    await handlePayPalTrialWebhook(
      {
        id: "WH-late-canceled-no-clock",
        event_type: "BILLING.SUBSCRIPTION.ACTIVATED",
        resource: { ...f.subscription, status_update_time: undefined },
      },
      f.subscription,
      f.deps,
    ),
    true,
  )
  assert.equal(f.tables.billing_subscriptions.length, 0)
})

test("a canceled activation snapshot cannot be replayed against a live active subscription", async () => {
  const f = apiFixture()
  Object.assign(f.attempt, {
    authorization_proof_kind: "api_confirmation",
    authorization_succeeded_at: new Date(Date.now() - 10_000).toISOString(),
    api_confirmed_at: new Date(Date.now() - 10_000).toISOString(),
    api_confirmation_id: "44444444-4444-4444-8444-444444444444",
  })
  await assert.rejects(
    () =>
      pinVerifiedPayPalTrialActivation(
        {
          intent: f.intent,
          subscription: f.subscription,
          eventId: "WH-stale-canceled",
          resource: { ...f.subscription, status: "CANCELLED" },
        },
        f.deps,
      ),
    /original activation evidence unavailable/,
  )
})

test("a late activation snapshot without a status clock can finish an API-proven reserved trial", async () => {
  const f = apiFixture()
  const confirmedAt = new Date(Date.now() - 10_000).toISOString()
  Object.assign(f.attempt, {
    authorization_proof_kind: "api_confirmation",
    authorization_succeeded_at: confirmedAt,
    api_confirmed_at: confirmedAt,
    api_confirmation_id: "44444444-4444-4444-8444-444444444444",
    activation_event_id: null,
  })
  assert.equal(
    await handlePayPalTrialWebhook(
      {
        id: "WH-late-reserved",
        event_type: "BILLING.SUBSCRIPTION.ACTIVATED",
        resource: { ...f.subscription, status_update_time: undefined },
      },
      f.subscription,
      f.deps,
    ),
    true,
  )
  assert.equal(f.enrollment.admission_status, "active")
  assert.equal(f.enrollment.authorization_succeeded_at, confirmedAt)
  assert.equal(f.tables.billing_subscriptions.length, 1)
  assert.equal(
    f.calls.some((call) => call.rpc === "pin_paypal_trial_activation"),
    false,
  )
})

test("an unproven trial still rejects an activation snapshot without its original status clock", async () => {
  const f = apiFixture()
  const activationResource = { ...f.subscription, status_update_time: undefined }
  await assert.rejects(
    () =>
      handlePayPalTrialWebhook(
        {
          id: "WH-unproven",
          event_type: "BILLING.SUBSCRIPTION.ACTIVATED",
          resource: activationResource,
        },
        f.subscription,
        f.deps,
      ),
    /original activation evidence unavailable/,
  )
  assert.equal(f.enrollment.admission_status, "reserved")
  assert.equal(f.tables.billing_subscriptions.length, 0)
})

test("an unproven trial rejects a canceled activation snapshot even with a timestamp", async () => {
  const f = apiFixture()
  await assert.rejects(
    () =>
      handlePayPalTrialWebhook(
        {
          id: "WH-unproven-canceled",
          event_type: "BILLING.SUBSCRIPTION.ACTIVATED",
          resource: {
            ...f.subscription,
            status: "CANCELLED",
            status_update_time: new Date().toISOString(),
          },
        },
        f.subscription,
        f.deps,
      ),
    /original activation evidence unavailable/,
  )
  assert.equal(f.enrollment.admission_status, "reserved")
  assert.equal(f.tables.billing_subscriptions.length, 0)
})

test("a webhook winner returned from API confirmation governs admission", async () => {
  const f = apiFixture()
  const rpc = f.deps.supabase.rpc
  f.deps.supabase.rpc = async (name: string, args: any) => {
    if (name === "confirm_paypal_trial_activation")
      Object.assign(f.attempt, {
        authorization_proof_kind: "webhook",
        authorization_succeeded_at: f.authorized,
        activation_event_id: "WH-winner",
        api_confirmation_id: null,
        api_confirmed_at: null,
      })
    return rpc(name, args)
  }
  assert.equal((await ensurePayPalTrialCheckoutAccount(f.intent, f.deps)).status, "active")
  assert.equal(f.enrollment.authorization_succeeded_at, f.authorized)
  assert.equal(f.attempt.activation_event_id, "WH-winner")
})

test("admitted API proof cannot create a missing billing projection after provider cancellation or suspension", async () => {
  for (const status of ["CANCELLED", "SUSPENDED"]) {
    const f = apiFixture()
    Object.assign(f.attempt, {
      authorization_proof_kind: "api_confirmation",
      authorization_succeeded_at: f.authorized,
      api_confirmed_at: f.authorized,
      api_confirmation_id: "44444444-4444-4444-8444-444444444444",
    })
    Object.assign(f.enrollment, {
      admission_status: "active",
      provider_agreement_id: "I-owned",
      authorization_succeeded_at: f.authorized,
      original_trial_end_at: f.end,
    })
    f.subscription.status = status
    assert.deepEqual(await ensurePayPalTrialCheckoutAccount(f.intent, f.deps), {
      status: "pending",
    })
    assert.equal(f.tables.billing_subscriptions.length, 0)
  }
})

test("temporary API proof persistence failure and DB expiry loser retain bounded webhook fallback", async () => {
  for (const error of [null, { code: "57014", message: "statement timeout" }]) {
    const f = apiFixture()
    const rpc = f.deps.supabase.rpc
    let confirmations = 0
    f.deps.supabase.rpc = async (name: string, args: any) => {
      if (name === "confirm_paypal_trial_activation") {
        confirmations++
        return { data: error ? null : { ...f.attempt }, error }
      }
      return rpc(name, args)
    }
    assert.deepEqual(await ensurePayPalTrialCheckoutAccount(f.intent, f.deps), {
      status: "pending",
    })
    assert.equal(confirmations, 1)
    assert.equal(
      f.calls.some((c) => c.cancel || c.rpc === "admit_trial_enrollment"),
      false,
    )
  }
})

test("API proof contract-integrity errors remain visible instead of being swallowed as pending", async () => {
  const f = apiFixture()
  const rpc = f.deps.supabase.rpc
  f.deps.supabase.rpc = async (name: string, args: any) =>
    name === "confirm_paypal_trial_activation"
      ? { data: null, error: { code: "P0001", message: "PayPal trial binding mismatch" } }
      : rpc(name, args)
  await assert.rejects(
    () => ensurePayPalTrialCheckoutAccount(f.intent, f.deps),
    /confirmation failed/,
  )
  assert.equal(
    f.calls.some((c) => c.cancel || c.rpc === "admit_trial_enrollment"),
    false,
  )
})

test("conservative API observation with less than seven days remains pending without cancellation", async (t) => {
  const f = apiFixture()
  const observedAt = Date.parse(f.end) - 7 * 86400000 + 1
  t.mock.method(Date, "now", () => observedAt)
  f.intent.expires_at = new Date(observedAt + 60_000).toISOString()
  assert.deepEqual(await ensurePayPalTrialCheckoutAccount(f.intent, f.deps), { status: "pending" })
  assert.equal(
    f.calls.some((c) => c.cancel || c.rpc === "confirm_paypal_trial_activation"),
    false,
  )
})

test("webhook-first proof remains the immutable admission clock when API issuance is enabled", async () => {
  const f = apiFixture()
  Object.assign(f.attempt, {
    authorization_proof_kind: "webhook",
    authorization_succeeded_at: f.authorized,
    activation_event_id: "WH-first",
  })
  assert.equal((await ensurePayPalTrialCheckoutAccount(f.intent, f.deps)).status, "active")
  assert.equal(f.enrollment.authorization_succeeded_at, f.authorized)
  assert.equal(
    f.calls.some((c) => c.rpc === "confirm_paypal_trial_activation"),
    false,
  )
})

test("API confirmation never crosses scope, metadata offer, frozen catalog or effective-contract boundaries", async () => {
  for (const change of [
    (f: any) => {
      f.attempt.intent_token = "foreign"
    },
    (f: any) => {
      f.attempt.scope_id = "foreign"
    },
    (f: any) => {
      f.intent.metadata.accepted_offer = null
    },
    (f: any) => {
      f.intent.metadata.paypal_app_id = "foreign"
    },
    (f: any) => {
      f.intent.metadata.paypal_product_id = "foreign"
    },
    (f: any) => {
      f.intent.metadata.paypal_request_id = "foreign"
    },
    (f: any) => {
      const rpc = f.deps.supabase.rpc
      f.deps.supabase.rpc = async (n: string, a: any) =>
        n === "get_paypal_trial_plan_catalog" ? { data: null, error: null } : rpc(n, a)
    },
    (f: any) => {
      const rpc = f.deps.supabase.rpc
      f.deps.supabase.rpc = async (n: string, a: any) =>
        n === "read_trial_effective_contract"
          ? {
              data: {
                accepted_offer: f.attempt.accepted_offer,
                provider: "paypal",
                provider_agreement_id: "foreign",
                revision: 0,
              },
              error: null,
            }
          : rpc(n, a)
    },
  ]) {
    const f = apiFixture()
    change(f)
    await assert.rejects(() => ensurePayPalTrialCheckoutAccount(f.intent, f.deps))
    assert.equal(
      f.calls.some(
        (c) => c.rpc === "confirm_paypal_trial_activation" || c.rpc === "admit_trial_enrollment",
      ),
      false,
    )
  }
})

test("a late webhook stale read cannot neutralize an API proof pinned before its SQL decision", async () => {
  const f = apiFixture()
  f.intent.expires_at = new Date(Date.now() - 1000).toISOString()
  const rpc = f.deps.supabase.rpc
  let interleaved = false
  f.deps.supabase.rpc = async (name: string, args: any) => {
    const response = await rpc(name, args)
    if (name === "get_paypal_trial_checkout_attempt_v2" && !interleaved) {
      interleaved = true
      Object.assign(f.attempt, {
        authorization_proof_kind: "api_confirmation",
        authorization_succeeded_at: f.authorized,
        api_confirmed_at: f.authorized,
        api_confirmation_id: "44444444-4444-4444-8444-444444444444",
      })
    }
    return response
  }
  await pinVerifiedPayPalTrialActivation(
    {
      intent: f.intent,
      subscription: f.subscription,
      eventId: "WH-late-race",
      resource: { ...f.subscription, status_update_time: new Date().toISOString() },
    },
    f.deps,
  )
  assert.equal(f.enrollment.admission_status, "reserved")
  assert.equal(
    f.calls.some((c) => c.cancel),
    false,
  )
  assert.equal(f.calls.filter((c) => c.rpc === "pin_paypal_trial_activation").length, 1)
  assert.equal((await ensurePayPalTrialCheckoutAccount(f.intent, f.deps)).status, "active")
  assert.equal(f.enrollment.authorization_succeeded_at, f.authorized)
})

test("a late initial webhook uses SQL persisted denial before ordinary neutralization", async () => {
  const f = apiFixture()
  f.intent.expires_at = new Date(Date.now() - 1000).toISOString()
  await pinVerifiedPayPalTrialActivation(
    {
      intent: f.intent,
      subscription: f.subscription,
      eventId: "WH-late-initial",
      resource: { ...f.subscription, status_update_time: new Date().toISOString() },
    },
    f.deps,
  )
  assert.equal(f.calls.filter((c) => c.rpc === "pin_paypal_trial_activation").length, 1)
  assert.equal(f.enrollment.admission_status, "blocked")
  assert.equal(
    f.calls.some((c) => c.cancel),
    false,
  )
  assert.deepEqual(await ensurePayPalTrialCheckoutAccount(f.intent, f.deps), {
    status: "duplicate",
    recoveryCode: "trial_checkout_closed",
  })
  assert.equal(f.enrollment.admission_status, "released")
  assert.equal(f.calls.filter((c) => c.cancel).length, 1)
})

test("temporary provider read failures fall back once while authentication failures remain visible", async () => {
  for (const status of [null, 429, 503, 401]) {
    const f = apiFixture()
    let reads = 0
    f.deps.retrievePayPalSubscription = async () => {
      reads++
      throw new PayPalRequestError("provider request failed", status)
    }
    if (status === 401)
      await assert.rejects(
        () => ensurePayPalTrialCheckoutAccount(f.intent, f.deps),
        /provider request failed/,
      )
    else
      assert.deepEqual(await ensurePayPalTrialCheckoutAccount(f.intent, f.deps), {
        status: "pending",
      })
    assert.equal(reads, 1)
    assert.equal(
      f.calls.some(
        (c) => c.rpc === "confirm_paypal_trial_activation" || c.rpc === "admit_trial_enrollment",
      ),
      false,
    )
  }
})
