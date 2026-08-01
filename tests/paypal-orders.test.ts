import assert from "node:assert/strict"
import test from "node:test"

import {
  buildPayPalPersonalPlanOrder,
  paypalOrderRequestId,
  type PayPalOrderIntentRow,
} from "../src/lib/paypal/order-intents"
import {
  captureAndActivatePayPalOrder,
  finalizeLockedPersonalPlanFromPreparedArtifact,
  PERSONAL_PLAN_PREPARED_ARTIFACT_DELIVERY_PROVIDER as PAYPAL_PREPARED_ARTIFACT_DELIVERY_PROVIDER,
  processPayPalOneTimeFulfillmentJob,
  recoverPayPalOrderActivation,
  validateCapturedPayPalOrder,
  verifyPayPalOneTimePaymentForRecovery,
  verifiedPayPalCaptureFromWebhook,
} from "../src/lib/paypal/order-activation"
import { PERSONAL_PLAN_PREPARED_ARTIFACT_DELIVERY_PROVIDER as STRIPE_PREPARED_ARTIFACT_DELIVERY_PROVIDER } from "../src/lib/stripe/checkout-activation"
import {
  assertValidPayPalOneTimeCaptureEvent,
  handlePayPalWebhookEvent,
  payPalCaptureIdForWebhook,
  payPalDisputeCaptureIdsForWebhook,
  validatePayPalCaptureCompletedWebhook,
} from "../src/lib/paypal/webhook-handlers"
import { personalPlanOneTimeConsentBlocksPayPalOrder } from "../src/app/api/paypal/create-order-intent/route"
import { readFile } from "node:fs/promises"

const intent: PayPalOrderIntentRow = {
  id: "intent-1",
  token: "opaque-personal-plan-token",
  user_id: null,
  lead_id: "lead-1",
  funnel_session_id: "session-1",
  consent_id: "consent-1",
  email: "buyer@example.com",
  checkout_attempt_id: "11111111-1111-4111-8111-111111111111",
  product_kind: "personal_plan_once",
  provider_order_id: "ORDER-1",
  provider_capture_id: null,
  status: "created",
  expires_at: "2030-01-01T00:00:00.000Z",
  metadata: {},
}

test("builds one fixed PayPal digital-goods order without a Billing Plan", () => {
  const payload = buildPayPalPersonalPlanOrder(intent.token, "MERCHANT-1")

  assert.deepEqual(payload, {
    intent: "CAPTURE",
    purchase_units: [
      {
        reference_id: "personal_plan_once",
        custom_id: intent.token,
        payee: { merchant_id: "MERCHANT-1" },
        amount: {
          currency_code: "EUR",
          value: "29.99",
          breakdown: { item_total: { currency_code: "EUR", value: "29.99" } },
        },
        items: [
          {
            name: "Persönlicher Haarplan",
            description: "Einmalige Erstellung eines persönlichen Haarplans · Kein Abo",
            sku: "personal_plan_once",
            quantity: "1",
            category: "DIGITAL_GOODS",
            unit_amount: { currency_code: "EUR", value: "29.99" },
          },
        ],
      },
    ],
    application_context: { shipping_preference: "NO_SHIPPING" },
  })
  assert.equal("plan_id" in payload, false)
})

test("uses separate stable idempotency keys for PayPal create and capture", () => {
  assert.equal(
    paypalOrderRequestId(intent.token, "create"),
    `personal-plan-once:create:${intent.token}`,
  )
  assert.equal(
    paypalOrderRequestId(intent.token, "capture"),
    `personal-plan-once:capture:${intent.token}`,
  )
})

test("PayPal order creation stops before the provider call when Stripe already owns the consent", () => {
  assert.equal(
    personalPlanOneTimeConsentBlocksPayPalOrder({ stripe_checkout_session_id: "cs_once" }),
    true,
  )
  assert.equal(
    personalPlanOneTimeConsentBlocksPayPalOrder({ stripe_checkout_session_id: null }),
    false,
  )
})

test("validates PayPal capture status, identity, amount, and currency", () => {
  const validCapture = {
    id: "ORDER-1",
    status: "COMPLETED",
    purchase_units: [
      {
        custom_id: intent.token,
        payee: { merchant_id: "MERCHANT-1" },
        amount: { currency_code: "EUR", value: "29.99" },
        payments: {
          captures: [
            {
              id: "CAPTURE-1",
              status: "COMPLETED",
              create_time: "2026-07-31T12:34:56.000Z",
              amount: { currency_code: "EUR", value: "29.99" },
            },
          ],
        },
      },
    ],
  }

  assert.deepEqual(validateCapturedPayPalOrder(validCapture, intent, "MERCHANT-1"), {
    captureId: "CAPTURE-1",
    orderId: "ORDER-1",
    paidAt: "2026-07-31T12:34:56.000Z",
  })
  assert.throws(
    () =>
      validateCapturedPayPalOrder(
        {
          ...validCapture,
          purchase_units: [
            {
              ...validCapture.purchase_units[0],
              custom_id: "wrong-token",
            },
          ],
        },
        intent,
        "MERCHANT-1",
      ),
    (error: unknown) =>
      error instanceof Error && "code" in error && error.code === "paypal_order_capture_incomplete",
  )
  assert.throws(
    () => validateCapturedPayPalOrder(validCapture, intent, "OTHER-MERCHANT"),
    /failed validation/,
  )
  assert.throws(
    () =>
      validateCapturedPayPalOrder(validCapture, intent, "MERCHANT-1", {
        expectedCaptureId: "CAPTURE-OTHER",
      }),
    /failed validation/,
  )
})

test("does not mark or activate an order when the provider capture fails validation", async () => {
  let updateCalls = 0
  let accountCalls = 0
  const reported: Array<Record<string, unknown>> = []
  const qaIntent = { ...intent, metadata: { is_internal_test: true } }
  const supabase = {
    from(table: string) {
      assert.equal(table, "paypal_order_intents")
      return {
        select() {
          return this
        },
        eq() {
          return this
        },
        async maybeSingle() {
          return { data: qaIntent, error: null }
        },
        update() {
          updateCalls += 1
          return this
        },
      }
    },
  }

  await assert.rejects(
    captureAndActivatePayPalOrder(intent.token, {
      supabase: supabase as never,
      capturePaymentFailure(details: Record<string, unknown>) {
        reported.push(details)
      },
      captureOrder: async () => ({
        id: intent.provider_order_id ?? undefined,
        status: "COMPLETED",
        purchase_units: [
          {
            custom_id: intent.token,
            amount: { currency_code: "EUR", value: "1.00" },
            payments: {
              captures: [
                {
                  id: "CAPTURE-INVALID",
                  status: "COMPLETED",
                  amount: { currency_code: "EUR", value: "1.00" },
                },
              ],
            },
          },
        ],
      }),
      ensureAccount: async () => {
        accountCalls += 1
        throw new Error("account activation must not run")
      },
    }),
    (error: unknown) =>
      error instanceof Error && "code" in error && error.code === "paypal_order_capture_incomplete",
  )
  assert.equal(updateCalls, 0)
  assert.equal(accountCalls, 0)
  assert.deepEqual(reported, [
    {
      signal: "customer_payment_error_observed",
      boundary: "provider_outcome",
      errorFamily: "processing",
      truth: "unknown",
      provider: "paypal",
      commerceKind: "one_time",
      origin: "provider_api",
      method: "paypal",
      live: false,
      isInternalTest: true,
      retryable: "true",
      checkoutAttemptId: qaIntent.checkout_attempt_id,
      leadId: qaIntent.lead_id,
      providerReferencePresent: true,
    },
  ])
})

test("reports a PayPal 422 capture response as one provider-confirmed failed capture", async () => {
  const reported: Array<Record<string, unknown>> = []
  const supabase = payPalOrderIntentLookup(intent)
  const providerRejection = Object.assign(new Error("provider rejected capture"), { status: 422 })

  await assert.rejects(
    captureAndActivatePayPalOrder(intent.token, {
      supabase: supabase as never,
      captureOrder: async () => {
        throw providerRejection
      },
      capturePaymentFailure(details: Record<string, unknown>) {
        reported.push(details)
      },
    }),
    providerRejection,
  )

  assert.equal(reported.length, 1)
  assert.equal(reported[0].signal, "provider_payment_failed")
  assert.equal(reported[0].errorFamily, "processing")
  assert.equal(reported[0].truth, "failed")
})

test("keeps PayPal authentication and configuration failures out of provider-failed truth", async () => {
  for (const status of [401, 403]) {
    const reported: Array<Record<string, unknown>> = []
    const error = Object.assign(new Error("merchant authentication failed"), { status })
    await assert.rejects(
      captureAndActivatePayPalOrder(intent.token, {
        supabase: payPalOrderIntentLookup(intent) as never,
        captureOrder: async () => {
          throw error
        },
        capturePaymentFailure(details: Record<string, unknown>) {
          reported.push(details)
        },
      }),
      error,
    )
    assert.equal(reported.length, 1)
    assert.equal(reported[0].signal, "customer_payment_error_observed")
    assert.equal(reported[0].errorFamily, "provider_unavailable")
    assert.equal(reported[0].truth, "unknown")
  }
})

function payPalOrderIntentLookup(row: PayPalOrderIntentRow) {
  return {
    from(table: string) {
      assert.equal(table, "paypal_order_intents")
      return {
        select() {
          return this
        },
        eq() {
          return this
        },
        async maybeSingle() {
          return { data: row, error: null }
        },
      }
    },
  }
}

test("resolves refund and reversal webhooks through their related capture, not refund id", () => {
  assert.equal(
    payPalCaptureIdForWebhook({
      id: "WH-REFUND",
      event_type: "PAYMENT.CAPTURE.REFUNDED",
      resource: {
        id: "REFUND-1",
        supplementary_data: { related_ids: { capture_id: "CAPTURE-1" } },
      },
    }),
    "CAPTURE-1",
  )
  assert.equal(
    payPalCaptureIdForWebhook({
      id: "WH-CAPTURE",
      event_type: "PAYMENT.CAPTURE.COMPLETED",
      resource: { id: "CAPTURE-2" },
    }),
    "CAPTURE-2",
  )
})

test("resolves PayPal disputes through seller transaction ids", () => {
  assert.deepEqual(
    payPalDisputeCaptureIdsForWebhook({
      id: "PP-D-1",
      event_type: "CUSTOMER.DISPUTE.CREATED",
      resource: {
        disputed_transactions: [
          { seller_transaction_id: "CAPTURE-1" },
          { transaction_info: { seller_transaction_id: "CAPTURE-2" } },
          { seller_transaction_id: "CAPTURE-1" },
        ],
      },
    }),
    ["CAPTURE-1", "CAPTURE-2"],
  )
})

test("PayPal dispute lifecycle revokes and restores a one-time entitlement", async () => {
  const purchase: Record<string, any> = {
    id: "purchase-1",
    user_id: "user-1",
    provider: "paypal",
    product_kind: "personal_plan_once",
    provider_transaction_id: "CAPTURE-1",
    provider_customer_id: null,
    provider_order_id: "ORDER-1",
    amount_minor: 2999,
    currency: "eur",
    refunded_amount_minor: 0,
    status: "paid",
    paid_at: "2026-07-31T10:00:00.000Z",
    refunded_at: null,
    metadata: {},
    created_at: "2026-07-31T10:00:00.000Z",
    updated_at: "2026-07-31T10:00:00.000Z",
  }
  const supabase = oneTimePayPalWebhookSupabase(purchase)
  const deps = {
    supabase: supabase as never,
    premiumTierId: "premium",
    freeTierId: "free",
  }

  assert.deepEqual(
    await handlePayPalWebhookEvent(
      {
        id: "WH-DISPUTE-CREATED",
        event_type: "CUSTOMER.DISPUTE.CREATED",
        resource: {
          id: "PP-D-1",
          disputed_transactions: [{ seller_transaction_id: "CAPTURE-1" }],
        },
      },
      deps,
    ),
    { handled: true },
  )
  assert.equal(purchase.status, "disputed")

  await handlePayPalWebhookEvent(
    {
      id: "WH-DISPUTE-RESOLVED",
      event_type: "CUSTOMER.DISPUTE.RESOLVED",
      resource: {
        id: "PP-D-1",
        disputed_transactions: [{ seller_transaction_id: "CAPTURE-1" }],
        dispute_outcome: { outcome_code: "RESOLVED_SELLER_FAVOUR" },
      },
    },
    deps,
  )
  assert.equal(purchase.status, "paid")
  assert.deepEqual(purchase.metadata, {
    paypal_dispute_event_type: "CUSTOMER.DISPUTE.RESOLVED",
    paypal_dispute_id: "PP-D-1",
    paypal_dispute_outcome: "RESOLVED_SELLER_FAVOUR",
  })

  purchase.status = "refunded"
  purchase.refunded_amount_minor = 2999
  purchase.refunded_at = "2026-08-01T10:00:00.000Z"
  await handlePayPalWebhookEvent(
    {
      id: "WH-DISPUTE-RESOLVED-AFTER-REFUND",
      event_type: "CUSTOMER.DISPUTE.RESOLVED",
      resource: {
        id: "PP-D-1",
        disputed_transactions: [{ seller_transaction_id: "CAPTURE-1" }],
        dispute_outcome: { outcome_code: "RESOLVED_SELLER_FAVOUR" },
      },
    },
    deps,
  )
  assert.equal(purchase.status, "refunded")
  assert.equal(purchase.refunded_at, "2026-08-01T10:00:00.000Z")
})

test("unmatched PayPal dispute payloads are acknowledged without a retry loop", async () => {
  const purchase = {
    id: "purchase-unrelated",
    provider: "paypal",
    provider_transaction_id: "CAPTURE-OTHER",
  }
  const originalWarn = console.warn
  console.warn = () => {}
  try {
    assert.deepEqual(
      await handlePayPalWebhookEvent(
        {
          id: "WH-DISPUTE-WITHOUT-TRANSACTION",
          event_type: "CUSTOMER.DISPUTE.UPDATED",
          resource: { id: "PP-D-UNRELATED" },
        },
        {
          supabase: oneTimePayPalWebhookSupabase(purchase) as never,
          premiumTierId: "premium",
          freeTierId: "free",
        },
      ),
      { handled: false },
    )
  } finally {
    console.warn = originalWarn
  }
})

test("rejects completed capture webhooks with an unexpected amount or currency", () => {
  assert.doesNotThrow(() =>
    assertValidPayPalOneTimeCaptureEvent({
      id: "WH-CAPTURE",
      event_type: "PAYMENT.CAPTURE.COMPLETED",
      resource: {
        id: "CAPTURE-1",
        amount: { currency_code: "EUR", value: "29.99" },
      },
    }),
  )
  assert.throws(
    () =>
      assertValidPayPalOneTimeCaptureEvent({
        id: "WH-CAPTURE",
        event_type: "PAYMENT.CAPTURE.COMPLETED",
        resource: {
          id: "CAPTURE-1",
          amount: { currency_code: "USD", value: "29.99" },
        },
      }),
    /amount or currency/,
  )
})

test("validates webhook-first PayPal capture status, identity, amount, and currency", () => {
  const validEvent = {
    id: "WH-CAPTURE",
    event_type: "PAYMENT.CAPTURE.COMPLETED",
    resource: {
      id: "CAPTURE-1",
      custom_id: intent.token,
      status: "COMPLETED",
      payee: { merchant_id: "MERCHANT-1" },
      amount: { currency_code: "EUR", value: "29.99" },
      supplementary_data: { related_ids: { order_id: intent.provider_order_id ?? undefined } },
    },
  }

  assert.doesNotThrow(() =>
    validatePayPalCaptureCompletedWebhook(validEvent, intent, "CAPTURE-1", "MERCHANT-1"),
  )
  assert.doesNotThrow(() =>
    validatePayPalCaptureCompletedWebhook(
      {
        ...validEvent,
        resource: {
          ...validEvent.resource,
          payee: undefined,
        },
      },
      intent,
      "CAPTURE-1",
      "MERCHANT-1",
    ),
  )
  assert.throws(
    () =>
      validatePayPalCaptureCompletedWebhook(
        {
          ...validEvent,
          resource: {
            ...validEvent.resource,
            amount: { currency_code: "EUR", value: "9.99" },
          },
        },
        intent,
        "CAPTURE-1",
        "MERCHANT-1",
      ),
    /failed validation/,
  )
  assert.throws(
    () =>
      validatePayPalCaptureCompletedWebhook(
        {
          ...validEvent,
          resource: {
            ...validEvent.resource,
            custom_id: "wrong-token",
          },
        },
        intent,
        "CAPTURE-1",
        "MERCHANT-1",
      ),
    /failed validation/,
  )
  assert.throws(
    () =>
      validatePayPalCaptureCompletedWebhook(
        {
          ...validEvent,
          resource: {
            ...validEvent.resource,
            payee: { merchant_id: "OTHER-MERCHANT" },
          },
        },
        intent,
        "CAPTURE-1",
        "MERCHANT-1",
      ),
    /failed validation/,
  )
})

test("derives PayPal one-time paid_at from provider webhook time, not local recovery time", () => {
  assert.deepEqual(
    verifiedPayPalCaptureFromWebhook(
      {
        create_time: "2026-07-31T12:00:00.000Z",
        resource: {
          id: "CAPTURE-1",
          create_time: "2026-07-31T11:59:55.000Z",
          supplementary_data: { related_ids: { order_id: "ORDER-1" } },
        },
      },
      "CAPTURE-1",
    ),
    {
      captureId: "CAPTURE-1",
      orderId: "ORDER-1",
      paidAt: "2026-07-31T11:59:55.000Z",
    },
  )
})

test("PayPal one-time activation delegates fulfillment and analytics to the canonical service", async () => {
  const source = await readFile(
    new URL("../src/lib/paypal/order-activation.ts", import.meta.url),
    "utf8",
  )
  assert.match(source, /activateVerifiedOneTimePayment/)
  assert.match(source, /paidAt: capture\.paidAt/)
  assert.doesNotMatch(source, /paid_at: .*new Date/)
  assert.doesNotMatch(source, /sendPersonalPlanOneTimeConfirmation\)\(\{/)
  assert.match(source, /activation\.state === "active"/)
  assert.doesNotMatch(source, /pendingOneTimeAccountSnapshot/)
  assert.match(source, /linkQuizToProfile: deps\.linkQuizToProfile/)
  assert.match(source, /defer: deps\.defer/)
  assert.doesNotMatch(source, /premiumTierId: "",\\n\\s*linkQuizToProfile/)
})

test("prepared-artifact delivery uses one provider identifier and rejects a null locked plan", async () => {
  assert.equal(
    PAYPAL_PREPARED_ARTIFACT_DELIVERY_PROVIDER,
    STRIPE_PREPARED_ARTIFACT_DELIVERY_PROVIDER,
  )

  const artifactClient = (lockedPlan: unknown) =>
    ({
      rpc(fn: string, args: Record<string, unknown>) {
        assert.equal(fn, "link_personal_plan_artifact_to_user")
        assert.deepEqual(args, { p_lead_id: "lead-1", p_user_id: "user-1" })
        return Promise.resolve({
          data: { artifact_id: "artifact-1", locked_plan: lockedPlan },
          error: null,
        })
      },
    }) as never
  const context = {
    consent: { lead_id: "lead-1" },
    purchase: { user_id: "user-1" },
  } as never

  await assert.rejects(
    finalizeLockedPersonalPlanFromPreparedArtifact(artifactClient(null), context),
    /missing locked_plan/,
  )
  const finalized = await finalizeLockedPersonalPlanFromPreparedArtifact(
    artifactClient({ routine: ["shampoo"] }),
    context,
  )
  assert.equal(finalized.deliveryProvider, STRIPE_PREPARED_ARTIFACT_DELIVERY_PROVIDER)
})

test("PayPal artifact finalization binds via RPC even when generic profile linking would no-op", async () => {
  let boundUserId: unknown = null
  const finalized = await finalizeLockedPersonalPlanFromPreparedArtifact(
    {
      rpc: async (fn: string, args: Record<string, unknown>) => {
        assert.equal(fn, "link_personal_plan_artifact_to_user")
        boundUserId = args.p_user_id
        return {
          data: { artifact_id: "artifact-1", locked_plan: { routine: ["shampoo"] } },
          error: null,
        }
      },
    } as never,
    { consent: { lead_id: "lead-1" }, purchase: { user_id: "user-1" } } as never,
  )

  assert.equal(boundUserId, "user-1")
  assert.equal(finalized.deliveryReference, "artifact-1")
})

test("PayPal missing prepared artifact rejects before delivery can be recorded", async () => {
  await assert.rejects(
    () =>
      finalizeLockedPersonalPlanFromPreparedArtifact(
        {
          rpc: async () => ({ data: null, error: new Error("artifact missing") }),
        } as never,
        { consent: { lead_id: "lead-1" }, purchase: { user_id: "user-1" } } as never,
      ),
    /prepared locked plan binding failed/,
  )
})

test("already-captured PayPal intents recover through non-charging order retrieval", async () => {
  const source = await readFile(
    new URL("../src/lib/paypal/order-activation.ts", import.meta.url),
    "utf8",
  )
  assert.match(source, /intent\.provider_capture_id/)
  assert.match(source, /deps\.retrieveOrder \?\? retrieveProviderPayPalOrder/)
  assert.match(source, /expectedCaptureId: intent\.provider_capture_id/)
  assert.match(source, /method: "GET"/)
})

test("valid capture persistence precedes fallible PayPal activation", async () => {
  const source = await readFile(
    new URL("../src/lib/paypal/order-activation.ts", import.meta.url),
    "utf8",
  )
  const capture = source.indexOf("tryMarkPayPalOrderIntentCaptured(deps.supabase, token")
  const activation = source.indexOf(
    "activateVerifiedPayPalOrderIntent(intent, verifiedCapture, deps)",
  )
  assert.ok(capture >= 0 && activation > capture)
})

test("PayPal consent-bind failure leaves purchase durable and retry does not recapture", async () => {
  const state = payPalActivationReplayState({ failConsentProviderBindOnce: true })
  const originalMerchantId = process.env.PAYPAL_MERCHANT_ID
  process.env.PAYPAL_MERCHANT_ID = "MERCHANT-1"
  let captureCalls = 0
  let retrieveCalls = 0
  let accountCalls = 0

  try {
    const deps = {
      supabase: state.supabase as never,
      captureOrder: async () => {
        captureCalls += 1
        return completedPayPalOrder()
      },
      retrieveOrder: async () => {
        retrieveCalls += 1
        return completedPayPalOrder()
      },
      ensureAccount: async () => {
        accountCalls += 1
        return {
          status: "active",
          userId: "user-1",
          email: "buyer@example.com",
          providerSubscriberEmail: null,
          canSetInitialPassword: false,
          leadId: "lead-1",
          checkoutContext: null,
        } as const
      },
      sendConfirmation: async () => ({
        confirmationReference: "customerio:message:paypal:CAPTURE-1",
      }),
      finalizeLockedPlan: async () => ({
        lockedPlan: { routine: "fixed" },
        deliveryProvider: "customerio",
        deliveryReference: "customerio:delivery:paypal",
      }),
      defer: () => {},
      now: () => new Date("2026-07-31T10:02:00.000Z"),
    }

    const first = await captureAndActivatePayPalOrder(intent.token, deps)

    assert.equal(first.status, "paid_pending")
    assert.equal(captureCalls, 1)
    assert.equal(retrieveCalls, 0)
    assert.equal(accountCalls, 0)
    assert.equal(state.purchases.length, 1)
    assert.equal(state.purchases[0]?.provider_transaction_id, "CAPTURE-1")
    assert.equal(state.jobs.length, 1)
    assert.equal(state.jobs[0]?.status, "pending")
    assert.equal(state.intent.provider_capture_id, "CAPTURE-1")
    assert.equal(state.consent.paypal_capture_id, null)

    const claimedReplayJob = (
      await state.supabase.rpc("claim_personal_plan_one_time_fulfillment_job", {
        p_job_id: state.jobs[0]?.id,
        p_stale_after_minutes: 15,
      })
    ).data
    assert.ok(claimedReplayJob)

    const replay = await processPayPalOneTimeFulfillmentJob(claimedReplayJob as never, deps)

    assert.equal(replay.state, "active")
    assert.equal(captureCalls, 1)
    assert.equal(retrieveCalls, 1)
    assert.equal(accountCalls, 1)
    assert.equal(state.purchases.length, 1)
    assert.equal(state.purchases[0]?.user_id, "user-1")
    assert.equal(state.jobs.length, 1)
    assert.equal(state.jobs[0]?.status, "completed")
    assert.equal(state.consent.paypal_order_id, "ORDER-1")
    assert.equal(state.consent.paypal_capture_id, "CAPTURE-1")
  } finally {
    if (originalMerchantId === undefined) delete process.env.PAYPAL_MERCHANT_ID
    else process.env.PAYPAL_MERCHANT_ID = originalMerchantId
  }
})

test("PayPal retry recovers by order when capture-id persistence failed", async () => {
  const state = payPalActivationReplayState({ failIntentCapturePersistOnce: true })
  const originalMerchantId = process.env.PAYPAL_MERCHANT_ID
  process.env.PAYPAL_MERCHANT_ID = "MERCHANT-1"
  let captureCalls = 0
  let retrieveCalls = 0
  let failAccountOnce = true
  try {
    const deps = {
      supabase: state.supabase as never,
      captureOrder: async () => {
        captureCalls += 1
        return completedPayPalOrder()
      },
      retrieveOrder: async () => {
        retrieveCalls += 1
        return completedPayPalOrder()
      },
      ensureAccount: async () => {
        if (failAccountOnce) {
          failAccountOnce = false
          throw new Error("temporary account provisioning outage")
        }
        return {
          status: "active",
          userId: "user-1",
          email: "buyer@example.com",
          providerSubscriberEmail: null,
          canSetInitialPassword: false,
          leadId: "lead-1",
          checkoutContext: null,
        } as const
      },
      sendConfirmation: async () => ({
        confirmationReference: "customerio:message:paypal:CAPTURE-1",
      }),
      finalizeLockedPlan: async () => ({
        lockedPlan: { routine: "fixed" },
        deliveryProvider: "customerio",
        deliveryReference: "customerio:delivery:paypal",
      }),
      defer: () => {},
      now: () => new Date("2026-07-31T10:02:00.000Z"),
    }

    const first = await captureAndActivatePayPalOrder(intent.token, deps)

    assert.equal(first.status, "paid_pending")
    assert.equal(captureCalls, 1)
    assert.equal(state.intent.provider_capture_id, null)
    assert.equal(state.purchases[0]?.provider_transaction_id, "CAPTURE-1")
    assert.equal(state.purchases[0]?.provider_order_id, "ORDER-1")
    assert.equal(state.jobs[0]?.status, "failed")

    const claimedRetryJob = (
      await state.supabase.rpc("claim_personal_plan_one_time_fulfillment_job", {
        p_job_id: state.jobs[0]?.id,
        p_stale_after_minutes: 15,
      })
    ).data
    assert.ok(claimedRetryJob)

    const replay = await processPayPalOneTimeFulfillmentJob(claimedRetryJob as never, deps)

    assert.equal(replay.state, "active")
    assert.equal(captureCalls, 1)
    assert.equal(retrieveCalls, 1)
    assert.equal(state.jobs[0]?.status, "completed")
    assert.equal(state.intent.provider_capture_id, null)
  } finally {
    if (originalMerchantId === undefined) delete process.env.PAYPAL_MERCHANT_ID
    else process.env.PAYPAL_MERCHANT_ID = originalMerchantId
  }
})

test("PayPal recovery wrapper is non-charging and verifies before local repair", async () => {
  assert.equal(typeof recoverPayPalOrderActivation, "function")
  const source = await readFile(
    new URL("../src/lib/paypal/order-activation.ts", import.meta.url),
    "utf8",
  )
  const recoveryFunction = source.slice(
    source.indexOf("export async function recoverPayPalOrderActivation"),
    source.indexOf("export async function processPayPalOneTimeFulfillmentJob"),
  )
  assert.match(recoveryFunction, /verifyPayPalOneTimePaymentForRecovery/)
  assert.match(recoveryFunction, /activateVerifiedPayPalOrderIntent/)
  assert.doesNotMatch(
    recoveryFunction,
    /captureAndActivatePayPalOrder|captureProviderPayPalOrder|captureOrder|createProviderPayPalOrder/,
  )
  assert.ok(
    recoveryFunction.indexOf("verifyPayPalOneTimePaymentForRecovery") <
      recoveryFunction.indexOf("tryMarkPayPalOrderIntentCaptured"),
  )
})

test("PayPal fulfillment job replay delegates provider retry without capture/create calls", async () => {
  const source = await readFile(
    new URL("../src/lib/paypal/order-activation.ts", import.meta.url),
    "utf8",
  )
  const replayFunction = source.slice(
    source.indexOf("export async function processPayPalOneTimeFulfillmentJob"),
    source.indexOf("export async function verifyPayPalOneTimePaymentForRecovery"),
  )
  assert.match(replayFunction, /processPersonalPlanOneTimeFulfillmentJob/)
  assert.match(replayFunction, /resolveVerifiedPaymentForRetry/)
  assert.match(replayFunction, /verifyPayPalOneTimePaymentForRecovery/)
  assert.doesNotMatch(
    replayFunction,
    /captureProviderPayPalOrder|captureOrder|createProviderPayPalOrder/,
  )
})

test("PayPal fulfillment retry marks deterministic provider validation mismatch permanent", async () => {
  const state = payPalFulfillmentRetryState()
  const originalMerchantId = process.env.PAYPAL_MERCHANT_ID
  process.env.PAYPAL_MERCHANT_ID = "MERCHANT-1"
  try {
    const result = await processPayPalOneTimeFulfillmentJob(state.job as never, {
      supabase: state.supabase as never,
      retrieveOrder: async () => ({
        id: "ORDER-1",
        status: "COMPLETED",
        purchase_units: [
          {
            custom_id: intent.token,
            payee: { merchant_id: "MERCHANT-1" },
            amount: { currency_code: "EUR", value: "1.00" },
            payments: {
              captures: [
                {
                  id: "CAPTURE-1",
                  status: "COMPLETED",
                  create_time: "2026-07-31T12:34:56.000Z",
                  amount: { currency_code: "EUR", value: "1.00" },
                },
              ],
            },
          },
        ],
      }),
      ensureAccount: async () => {
        state.accountCalls += 1
        throw new Error("account activation must not run before provider verification")
      },
      now: () => new Date("2026-07-31T10:00:00.000Z"),
    })

    assert.equal(result.state, "paid_pending")
    assert.equal(result.job?.status, "failed_permanent")
    assert.equal(result.job?.attempts, 2)
    assert.equal(result.job?.next_attempt_at, null)
    assert.match(result.job?.last_error ?? "", /failed validation/)
    assert.equal(state.accountCalls, 0)
  } finally {
    if (originalMerchantId === undefined) delete process.env.PAYPAL_MERCHANT_ID
    else process.env.PAYPAL_MERCHANT_ID = originalMerchantId
  }
})

test("PayPal fulfillment retry keeps provider outages retryable", async () => {
  const state = payPalFulfillmentRetryState()
  const result = await processPayPalOneTimeFulfillmentJob(state.job as never, {
    supabase: state.supabase as never,
    retrieveOrder: async () => {
      throw new Error("PayPal API 503")
    },
    ensureAccount: async () => {
      state.accountCalls += 1
      throw new Error("account activation must not run before provider verification")
    },
    now: () => new Date("2026-07-31T10:00:00.000Z"),
  })

  assert.equal(result.state, "paid_pending")
  assert.equal(result.job?.status, "failed")
  assert.equal(result.job?.attempts, 2)
  assert.equal(result.job?.next_attempt_at, "2026-07-31T10:04:00.000Z")
  assert.match(result.job?.last_error ?? "", /PayPal API 503/)
  assert.equal(state.accountCalls, 0)
})

test("PayPal fulfillment retry keeps genuinely pending provider capture retryable", async () => {
  const state = payPalFulfillmentRetryState()
  const originalMerchantId = process.env.PAYPAL_MERCHANT_ID
  process.env.PAYPAL_MERCHANT_ID = "MERCHANT-1"
  try {
    const result = await processPayPalOneTimeFulfillmentJob(state.job as never, {
      supabase: state.supabase as never,
      retrieveOrder: async () => ({
        id: "ORDER-1",
        status: "APPROVED",
        purchase_units: [
          {
            custom_id: intent.token,
            payee: { merchant_id: "MERCHANT-1" },
            amount: { currency_code: "EUR", value: "29.99" },
            payments: { captures: [] },
          },
        ],
      }),
      ensureAccount: async () => {
        state.accountCalls += 1
        throw new Error("account activation must not run before provider verification")
      },
      now: () => new Date("2026-07-31T10:00:00.000Z"),
    })

    assert.equal(result.state, "paid_pending")
    assert.equal(result.job?.status, "failed")
    assert.equal(result.job?.attempts, 2)
    assert.equal(result.job?.next_attempt_at, "2026-07-31T10:04:00.000Z")
    assert.match(result.job?.last_error ?? "", /not complete/)
    assert.equal(state.accountCalls, 0)
  } finally {
    if (originalMerchantId === undefined) delete process.env.PAYPAL_MERCHANT_ID
    else process.env.PAYPAL_MERCHANT_ID = originalMerchantId
  }
})

test("PayPal active replay reconstructs an existing account instead of throwing", async () => {
  const source = await readFile(
    new URL("../src/lib/paypal/order-activation.ts", import.meta.url),
    "utf8",
  )
  assert.match(source, /loadActivePayPalOneTimeAccountFromReplay/)
  assert.match(source, /userId: activation\.purchase\.user_id/)
  assert.match(source, /canSetInitialPassword: false/)
  assert.doesNotMatch(source, /activation\.state === "active" && !account/)
})

test("PayPal operator recovery verification is read-only and returns sanitized normalized payment", async () => {
  let retrieveCalls = 0
  let writeCalls = 0
  const originalMerchantId = process.env.PAYPAL_MERCHANT_ID
  process.env.PAYPAL_MERCHANT_ID = "MERCHANT-1"
  try {
    const verification = await verifyPayPalOneTimePaymentForRecovery({
      supabase: readOnlyPayPalRecoverySupabase(() => {
        writeCalls += 1
      }) as never,
      token: intent.token,
      orderId: "ORDER-1",
      retrieveOrder: async () => {
        retrieveCalls += 1
        return {
          id: "ORDER-1",
          status: "COMPLETED",
          purchase_units: [
            {
              custom_id: intent.token,
              payee: { merchant_id: "MERCHANT-1" },
              amount: { currency_code: "EUR", value: "29.99" },
              payments: {
                captures: [
                  {
                    id: "CAPTURE-1",
                    status: "COMPLETED",
                    create_time: "2026-07-31T12:34:56.000Z",
                    amount: { currency_code: "EUR", value: "29.99" },
                  },
                ],
              },
            },
          ],
        }
      },
    })

    assert.equal(retrieveCalls, 1)
    assert.equal(writeCalls, 0)
    assert.equal(verification.payment.provider, "paypal")
    assert.equal(verification.payment.providerTransactionId, "CAPTURE-1")
    assert.equal(verification.payment.providerOrderId, "ORDER-1")
    assert.equal(verification.payment.paidAt, "2026-07-31T12:34:56.000Z")
    assert.equal(verification.payment.email, intent.email)
    assert.equal(verification.accountContext.activationKey, intent.token)
    assert.equal(
      JSON.stringify(verification.payment.providerEvidence).includes(intent.token),
      false,
    )
  } finally {
    if (originalMerchantId === undefined) {
      delete process.env.PAYPAL_MERCHANT_ID
    } else {
      process.env.PAYPAL_MERCHANT_ID = originalMerchantId
    }
  }
})

test("PayPal operator recovery verification fails closed while order capture is pending", async () => {
  const originalMerchantId = process.env.PAYPAL_MERCHANT_ID
  process.env.PAYPAL_MERCHANT_ID = "MERCHANT-1"
  try {
    await assert.rejects(
      verifyPayPalOneTimePaymentForRecovery({
        supabase: readOnlyPayPalRecoverySupabase(() => {
          throw new Error("recovery verification must stay read-only")
        }) as never,
        token: intent.token,
        orderId: "ORDER-1",
        retrieveOrder: async () => ({
          id: "ORDER-1",
          status: "APPROVED",
          purchase_units: [
            {
              custom_id: intent.token,
              payee: { merchant_id: "MERCHANT-1" },
              amount: { currency_code: "EUR", value: "29.99" },
              payments: { captures: [] },
            },
          ],
        }),
      }),
      (error: unknown) =>
        error instanceof Error &&
        "code" in error &&
        error.code === "paypal_order_capture_incomplete",
    )
  } finally {
    if (originalMerchantId === undefined) {
      delete process.env.PAYPAL_MERCHANT_ID
    } else {
      process.env.PAYPAL_MERCHANT_ID = originalMerchantId
    }
  }
})

test("PayPal capture webhook analytics stay canonical for one-time purchases", async () => {
  const source = await readFile(
    new URL("../src/lib/paypal/webhook-handlers.ts", import.meta.url),
    "utf8",
  )
  assert.match(source, /activateVerifiedPayPalOrderIntent/)
  assert.match(source, /verifiedPayPalWebhookCaptureWithMerchantCheck/)
  assert.match(source, /retrieveProviderPayPalOrder/)
  assert.doesNotMatch(source, /checkout_reference: captureId/)
  assert.doesNotMatch(source, /paypal_capture_id: captureId/)
})

test("legacy PayPal activation-status route stays subscription-only", async () => {
  const source = await readFile(
    new URL("../src/app/api/paypal/activation-status/route.ts", import.meta.url),
    "utf8",
  )
  assert.doesNotMatch(source, /purchase === "one_time"/)
  assert.doesNotMatch(source, /recoverPayPalOrderActivation/)
})

function completedPayPalOrder() {
  return {
    id: "ORDER-1",
    status: "COMPLETED",
    purchase_units: [
      {
        custom_id: intent.token,
        payee: { merchant_id: "MERCHANT-1" },
        amount: { currency_code: "EUR", value: "29.99" },
        payments: {
          captures: [
            {
              id: "CAPTURE-1",
              status: "COMPLETED",
              create_time: "2026-07-31T12:34:56.000Z",
              amount: { currency_code: "EUR", value: "29.99" },
            },
          ],
        },
      },
    ],
  }
}

function payPalActivationReplayState(
  options: { failConsentProviderBindOnce?: boolean; failIntentCapturePersistOnce?: boolean } = {},
) {
  const localIntent = { ...intent }
  const consent: Record<string, any> = {
    id: intent.consent_id,
    lead_id: intent.lead_id,
    funnel_session_id: intent.funnel_session_id,
    user_id: null,
    product_kind: "personal_plan_once",
    offer_variant: "personal-plan-one-time-v1",
    copy_version: "v1",
    consent_text: "consent",
    consent_text_sha256: "sha",
    accepted_at: "2026-07-31T12:00:00.000Z",
    stripe_checkout_session_id: null,
    paypal_order_id: null,
    paypal_capture_id: null,
    confirmation_provider: null,
    confirmation_status: "pending",
    confirmation_reference: null,
    confirmation_sent_at: null,
    confirmation_delivered_at: null,
    generation_started_at: null,
    generation_completed_at: null,
    generated_content_sha256: null,
    delivery_provider: null,
    delivery_reference: null,
    delivered_at: null,
    first_accessed_at: null,
    created_at: "2026-07-31T12:00:00.000Z",
    updated_at: "2026-07-31T12:00:00.000Z",
  }
  const purchases: Record<string, any>[] = []
  const jobs: Record<string, any>[] = []
  const outbox: Record<string, any>[] = []
  const deliveries: Record<string, any>[] = []
  let failConsentProviderBindOnce = options.failConsentProviderBindOnce === true
  let failIntentCapturePersistOnce = options.failIntentCapturePersistOnce === true
  const rowsByTable: Record<string, Record<string, any>[]> = {
    paypal_order_intents: [localIntent],
    personal_plan_one_time_checkout_consents: [consent],
    billing_one_time_purchases: purchases,
    personal_plan_one_time_fulfillment_jobs: jobs,
    billing_analytics_outbox: outbox,
    billing_analytics_deliveries: deliveries,
    funnel_sessions: [{ id: "session-1", package_key: "meta_personal_plan_v1" }],
  }

  const supabase = {
    from(table: string) {
      const rows = rowsByTable[table] ?? []
      const filters: Array<[string, unknown]> = []
      const builder: any = {
        select() {
          return builder
        },
        eq(column: string, value: unknown) {
          filters.push([column, value])
          return builder
        },
        in(column: string, values: unknown[]) {
          filters.push([column, values])
          return builder
        },
        insert(row: Record<string, unknown>) {
          if (
            table === "personal_plan_one_time_fulfillment_jobs" &&
            rows.some((existing) => existing.purchase_id === row.purchase_id)
          ) {
            return payPalErrorSelect({ code: "23505", message: "duplicate fulfillment job" })
          }
          if (
            table === "billing_analytics_outbox" &&
            rows.some((existing) => existing.event_key === row.event_key)
          ) {
            return payPalErrorSelect({ code: "23505", message: "duplicate outbox event" })
          }
          const inserted = payPalAddDefaults(table, row, rows.length + 1)
          rows.push(inserted)
          return { select: () => payPalSelectResult(inserted) }
        },
        upsert(rowOrRows: Record<string, unknown> | Array<Record<string, unknown>>) {
          const incoming = Array.isArray(rowOrRows) ? rowOrRows : [rowOrRows]
          for (const row of incoming) {
            if (table === "billing_one_time_purchases") {
              const existing = rows.find(
                (candidate) =>
                  candidate.provider === row.provider &&
                  candidate.provider_transaction_id === row.provider_transaction_id,
              )
              if (existing) Object.assign(existing, row)
              else rows.push(payPalAddDefaults(table, row, rows.length + 1))
            } else if (table === "billing_analytics_deliveries") {
              const existing = rows.find(
                (candidate) =>
                  candidate.outbox_id === row.outbox_id &&
                  candidate.destination === row.destination,
              )
              if (!existing) rows.push(payPalAddDefaults(table, row, rows.length + 1))
            }
          }
          return { select: () => payPalSelectResult(rows[rows.length - 1] ?? null) }
        },
        update(patch: Record<string, unknown>) {
          const updateFilters: Array<[string, unknown]> = []
          const updateBuilder: any = {
            eq(column: string, value: unknown) {
              updateFilters.push([column, value])
              return updateBuilder
            },
            in(column: string, values: unknown[]) {
              updateFilters.push([column, values])
              return updateBuilder
            },
            select() {
              return updateBuilder
            },
            async single() {
              if (
                table === "paypal_order_intents" &&
                "provider_capture_id" in patch &&
                failIntentCapturePersistOnce
              ) {
                failIntentCapturePersistOnce = false
                return { data: null, error: new Error("capture-id persistence unavailable") }
              }
              if (
                table === "personal_plan_one_time_checkout_consents" &&
                "paypal_order_id" in patch &&
                failConsentProviderBindOnce
              ) {
                failConsentProviderBindOnce = false
                return { data: null, error: new Error("provider reference bind unavailable") }
              }
              const updated = rows.filter((row) =>
                updateFilters.every(([column, value]) =>
                  Array.isArray(value) ? value.includes(row[column]) : row[column] === value,
                ),
              )
              for (const row of updated) Object.assign(row, patch)
              return { data: updated[0] ?? null, error: null }
            },
            async maybeSingle() {
              return updateBuilder.single()
            },
          }
          return updateBuilder
        },
        async maybeSingle() {
          return { data: findRows()[0] ?? null, error: null }
        },
        async single() {
          return { data: findRows()[0] ?? null, error: null }
        },
        then(resolve: (result: { data: Record<string, any>[]; error: null }) => void) {
          resolve({ data: findRows(), error: null })
        },
      }
      function findRows() {
        return rows.filter((row) =>
          filters.every(([column, value]) =>
            Array.isArray(value) ? value.includes(row[column]) : row[column] === value,
          ),
        )
      }
      return builder
    },
    async rpc(fn: string, args: Record<string, unknown>) {
      if (fn === "claim_personal_plan_one_time_fulfillment_job") {
        const job = jobs.find((candidate) => candidate.id === args.p_job_id)
        if (!job || (job.status !== "pending" && job.status !== "failed")) {
          return { data: null, error: null }
        }
        job.status = "processing"
        job.processing_started_at = "2026-07-31T10:02:00.000Z"
        return { data: job, error: null }
      }
      if (fn === "bind_personal_plan_one_time_purchase_user") {
        const purchase = purchases.find((row) => row.id === args.p_purchase_id)
        if (!purchase) return { data: null, error: new Error("missing purchase") }
        purchase.user_id = String(args.p_user_id)
        consent.user_id = String(args.p_user_id)
        return { data: purchase, error: null }
      }
      return { data: null, error: new Error(`unexpected rpc ${fn}`) }
    },
  }

  return { intent: localIntent, consent, purchases, jobs, outbox, deliveries, supabase }
}

function payPalSelectResult(row: Record<string, any> | null) {
  return {
    single: async () => ({ data: row, error: null }),
    maybeSingle: async () => ({ data: row, error: null }),
  }
}

function payPalErrorSelect(error: unknown) {
  return {
    select: () => ({
      single: async () => ({ data: null, error }),
      maybeSingle: async () => ({ data: null, error }),
    }),
  }
}

function payPalAddDefaults(table: string, row: Record<string, unknown>, index: number) {
  const now = "2026-07-31T10:02:00.000Z"
  if (table === "billing_one_time_purchases") {
    return { id: `purchase-${index}`, created_at: now, updated_at: now, ...row }
  }
  if (table === "personal_plan_one_time_fulfillment_jobs") {
    return {
      id: `job-${index}`,
      attempts: 0,
      next_attempt_at: null,
      processing_started_at: null,
      last_error: null,
      delivery_provider: null,
      delivery_reference: null,
      canonical_content_sha256: null,
      delivered_at: null,
      created_at: now,
      updated_at: now,
      ...row,
    }
  }
  if (table === "billing_analytics_outbox") {
    return { id: `outbox-${index}`, created_at: now, updated_at: now, ...row }
  }
  if (table === "billing_analytics_deliveries") {
    return {
      id: `delivery-${index}`,
      status: "pending",
      attempts: 0,
      processing_started_at: null,
      next_attempt_at: null,
      delivered_at: null,
      last_error: null,
      provider_request_id: null,
      created_at: now,
      updated_at: now,
      ...row,
    }
  }
  return { id: `${table}-${index}`, created_at: now, updated_at: now, ...row }
}

function payPalFulfillmentRetryState() {
  const purchase = {
    id: "purchase-1",
    user_id: null,
    consent_id: intent.consent_id,
    provider: "paypal",
    product_kind: "personal_plan_once",
    provider_transaction_id: "CAPTURE-1",
    provider_customer_id: null,
    provider_order_id: "ORDER-1",
    amount_minor: 2999,
    currency: "eur",
    refunded_amount_minor: 0,
    status: "paid",
    paid_at: "2026-07-31T12:34:56.000Z",
    refunded_at: null,
    metadata: {},
    created_at: "2026-07-31T12:34:56.000Z",
    updated_at: "2026-07-31T12:34:56.000Z",
  }
  const consent = {
    id: intent.consent_id,
    lead_id: intent.lead_id,
    funnel_session_id: intent.funnel_session_id,
    user_id: null,
    product_kind: "personal_plan_once",
    offer_variant: "personal-plan-one-time-v1",
    copy_version: "v1",
    consent_text: "consent",
    consent_text_sha256: "sha",
    accepted_at: "2026-07-31T12:00:00.000Z",
    stripe_checkout_session_id: null,
    paypal_order_id: "ORDER-1",
    paypal_capture_id: "CAPTURE-1",
    confirmation_provider: null,
    confirmation_status: "pending",
    confirmation_reference: null,
    confirmation_sent_at: null,
    confirmation_delivered_at: null,
    generation_started_at: null,
    generation_completed_at: null,
    generated_content_sha256: null,
    delivery_provider: null,
    delivery_reference: null,
    delivered_at: null,
    first_accessed_at: null,
    created_at: "2026-07-31T12:00:00.000Z",
    updated_at: "2026-07-31T12:00:00.000Z",
  }
  const job = {
    id: "job-1",
    purchase_id: purchase.id,
    consent_id: consent.id,
    status: "processing",
    attempts: 1,
    next_attempt_at: null,
    processing_started_at: "2026-07-31T12:35:00.000Z",
    last_error: null,
    delivery_provider: null,
    delivery_reference: null,
    canonical_content_sha256: null,
    delivered_at: null,
    created_at: "2026-07-31T12:35:00.000Z",
    updated_at: "2026-07-31T12:35:00.000Z",
  }
  let accountCalls = 0
  const rowsByTable: Record<string, any[]> = {
    billing_one_time_purchases: [purchase],
    personal_plan_one_time_checkout_consents: [consent],
    personal_plan_one_time_fulfillment_jobs: [job],
    paypal_order_intents: [{ ...intent, provider_capture_id: "CAPTURE-1", status: "captured" }],
  }
  const supabase = {
    from(table: string) {
      const filters: Array<[string, unknown]> = []
      let patch: Record<string, unknown> | null = null
      const builder: any = {
        select() {
          return builder
        },
        eq(column: string, value: unknown) {
          filters.push([column, value])
          return builder
        },
        update(input: Record<string, unknown>) {
          patch = input
          return builder
        },
        async maybeSingle() {
          const row = findRow()
          if (patch && row) Object.assign(row, patch)
          return { data: row ?? null, error: null }
        },
        async single() {
          const row = findRow()
          if (patch && row) Object.assign(row, patch)
          return { data: row ?? null, error: null }
        },
      }
      function findRow() {
        return (
          rowsByTable[table]?.find((row) =>
            filters.every(([column, value]) => row[column] === value),
          ) ?? null
        )
      }
      return builder
    },
  }
  return {
    purchase,
    consent,
    job,
    supabase,
    get accountCalls() {
      return accountCalls
    },
    set accountCalls(value: number) {
      accountCalls = value
    },
  }
}

function oneTimePayPalWebhookSupabase(purchase: Record<string, any>) {
  return {
    from(table: string) {
      if (table === "billing_webhook_events") {
        return {
          async insert() {
            return { error: null }
          },
        }
      }
      assert.equal(table, "billing_one_time_purchases")
      const filters: Array<[string, unknown]> = []
      const builder: any = {
        select() {
          return builder
        },
        eq(column: string, value: unknown) {
          filters.push([column, value])
          return builder
        },
        async maybeSingle() {
          return {
            data: filters.every(([column, value]) => purchase[column] === value) ? purchase : null,
            error: null,
          }
        },
        update(patch: Record<string, unknown>) {
          const updateFilters: Array<[string, unknown]> = []
          const updateBuilder: any = {
            eq(column: string, value: unknown) {
              updateFilters.push([column, value])
              return updateBuilder
            },
            select() {
              return updateBuilder
            },
            async single() {
              if (updateFilters.every(([column, value]) => purchase[column] === value)) {
                Object.assign(purchase, patch)
              }
              return { data: purchase, error: null }
            },
          }
          return updateBuilder
        },
      }
      return builder
    },
  }
}

function readOnlyPayPalRecoverySupabase(onWrite: () => void) {
  const consent = {
    id: "consent-1",
    lead_id: "lead-1",
    funnel_session_id: "session-1",
    user_id: null,
    product_kind: "personal_plan_once",
    offer_variant: "personal-plan-one-time-v1",
    copy_version: "v1",
    consent_text: "consent",
    consent_text_sha256: "sha",
    accepted_at: "2026-07-31T12:00:00.000Z",
    stripe_checkout_session_id: null,
    paypal_order_id: null,
    paypal_capture_id: null,
    confirmation_provider: null,
    confirmation_status: "pending",
    confirmation_reference: null,
    confirmation_sent_at: null,
    confirmation_delivered_at: null,
    generation_started_at: null,
    generation_completed_at: null,
    generated_content_sha256: null,
    delivery_provider: null,
    delivery_reference: null,
    delivered_at: null,
    first_accessed_at: null,
    created_at: "2026-07-31T12:00:00.000Z",
    updated_at: "2026-07-31T12:00:00.000Z",
  }
  return {
    from(table: string) {
      const filters: Array<[string, unknown]> = []
      const builder: any = {
        select() {
          return builder
        },
        eq(column: string, value: unknown) {
          filters.push([column, value])
          return builder
        },
        insert() {
          onWrite()
          throw new Error(`unexpected write to ${table}`)
        },
        update() {
          onWrite()
          throw new Error(`unexpected write to ${table}`)
        },
        upsert() {
          onWrite()
          throw new Error(`unexpected write to ${table}`)
        },
        async maybeSingle() {
          if (table === "paypal_order_intents") return { data: intent, error: null }
          if (table === "billing_one_time_purchases") return { data: null, error: null }
          return { data: null, error: null }
        },
        async single() {
          if (table === "personal_plan_one_time_checkout_consents") {
            return { data: consent, error: null }
          }
          return { data: null, error: null }
        },
      }
      return builder
    },
  }
}
