import assert from "node:assert/strict"
import test from "node:test"

import { handlePayPalWebhookPost } from "../src/app/api/paypal/webhook/route"

function withEnv(name: string, value: string, fn: () => Promise<void>) {
  const previous = process.env[name]
  process.env[name] = value
  return fn().finally(() => {
    if (previous === undefined) delete process.env[name]
    else process.env[name] = previous
  })
}

test("PayPal verified processing failure emits one typed payment signal", async () => {
  const reported: Array<Record<string, unknown>> = []

  await withEnv("PAYPAL_WEBHOOK_ID", "WH-test", async () => {
    const response = await handlePayPalWebhookPost(
      new Request("https://example.test/api/paypal/webhook", {
        method: "POST",
        body: JSON.stringify({ id: "WH-event", event_type: "BILLING.SUBSCRIPTION.PAYMENT.FAILED" }),
      }),
      {
        createSupabaseClient: () => ({}) as any,
        getTierIds: async () => ({ premiumTierId: "premium", freeTierId: "free" }),
        handlePayPalWebhookEvent: async () => {
          throw new Error("local mutation failed")
        },
        capturePaymentFailure(details: Record<string, unknown>) {
          reported.push(details)
        },
        verifyPayPalWebhookSignature: async () => true,
      },
    )

    assert.equal(response.status, 500)
  })

  assert.deepEqual(reported, [
    {
      signal: "payment_webhook_processing_failed",
      provider: "paypal",
      boundary: "webhook",
      errorFamily: "webhook_processing",
      commerceKind: "subscription",
      origin: "webhook",
      method: "paypal",
      truth: "unknown",
      live: false,
      isInternalTest: false,
      providerReferencePresent: true,
    },
  ])
})

test("PayPal signature verification failure emits no payment signal", async () => {
  const reported: Array<Record<string, unknown>> = []

  await withEnv("PAYPAL_WEBHOOK_ID", "WH-test", async () => {
    const response = await handlePayPalWebhookPost(
      new Request("https://example.test/api/paypal/webhook", {
        method: "POST",
        body: JSON.stringify({
          id: "WH-unverified",
          event_type: "BILLING.SUBSCRIPTION.PAYMENT.FAILED",
        }),
      }),
      {
        capturePaymentFailure(details: Record<string, unknown>) {
          reported.push(details)
        },
        verifyPayPalWebhookSignature: async () => false,
      },
    )

    assert.equal(response.status, 400)
  })

  assert.deepEqual(reported, [])
})
