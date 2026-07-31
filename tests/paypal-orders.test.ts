import assert from "node:assert/strict"
import test from "node:test"

import {
  buildPayPalPersonalPlanOrder,
  paypalOrderRequestId,
  type PayPalOrderIntentRow,
} from "../src/lib/paypal/order-intents"
import {
  captureAndActivatePayPalOrder,
  validateCapturedPayPalOrder,
} from "../src/lib/paypal/order-activation"
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
              amount: { currency_code: "EUR", value: "29.99" },
            },
          ],
        },
      },
    ],
  }

  assert.equal(validateCapturedPayPalOrder(validCapture, intent, "MERCHANT-1"), "CAPTURE-1")
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
})

test("does not mark or activate an order when the provider capture fails validation", async () => {
  let updateCalls = 0
  let accountCalls = 0
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
          return { data: intent, error: null }
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
      captureOrder: async () => ({
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
})

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
      amount: { currency_code: "EUR", value: "29.99" },
      supplementary_data: { related_ids: { order_id: intent.provider_order_id ?? undefined } },
    },
  }

  assert.doesNotThrow(() => validatePayPalCaptureCompletedWebhook(validEvent, intent, "CAPTURE-1"))
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
      ),
    /failed validation/,
  )
})

test("activation preserves sent confirmation evidence and records a failed send before access", async () => {
  const source = await readFile(
    new URL("../src/lib/paypal/order-activation.ts", import.meta.url),
    "utf8",
  )
  assert.match(source, /confirmation_status !== "sent"/)
  assert.match(source, /confirmation_status !== "delivered"/)
  assert.match(source, /status: "failed"/)
  assert.match(source, /paypal_order_confirmation_failed/)
})

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
