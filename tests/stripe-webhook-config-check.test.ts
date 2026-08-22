import assert from "node:assert/strict"
import test from "node:test"

import {
  REQUIRED_STRIPE_WEBHOOK_EVENTS,
  verifyStripeWebhookConfig,
  type StripeWebhookConfigIssue,
} from "../src/lib/stripe/webhook-config-check"

test("verifyStripeWebhookConfig reports ok when the matching endpoint covers every required event", async () => {
  const captured: StripeWebhookConfigIssue[] = []
  const result = await verifyStripeWebhookConfig({
    webhookUrl: "https://app.example.com/api/stripe/webhook",
    listWebhookEndpoints: async () => [
      {
        id: "we_1",
        url: "https://app.example.com/api/stripe/webhook",
        enabled_events: [...REQUIRED_STRIPE_WEBHOOK_EVENTS, "checkout.session.completed"],
      },
    ],
    captureIssue: (issue) => captured.push(issue),
  })

  assert.deepEqual(result, {
    status: "ok",
    endpointId: "we_1",
    enabledEvents: [...REQUIRED_STRIPE_WEBHOOK_EVENTS, "checkout.session.completed"],
  })
  assert.equal(captured.length, 0)
})

test("verifyStripeWebhookConfig treats a wildcard enabled_events list as covering every required event", async () => {
  const result = await verifyStripeWebhookConfig({
    webhookUrl: "https://app.example.com/api/stripe/webhook",
    listWebhookEndpoints: async () => [
      { id: "we_1", url: "https://app.example.com/api/stripe/webhook", enabled_events: ["*"] },
    ],
  })

  assert.equal(result.status, "ok")
})

test("verifyStripeWebhookConfig matches the endpoint URL ignoring trailing slash and case", async () => {
  const result = await verifyStripeWebhookConfig({
    webhookUrl: "https://app.example.com/api/stripe/webhook",
    listWebhookEndpoints: async () => [
      {
        id: "we_1",
        url: "HTTPS://App.Example.com/api/stripe/webhook/",
        enabled_events: [...REQUIRED_STRIPE_WEBHOOK_EVENTS],
      },
    ],
  })

  assert.equal(result.status, "ok")
})

test("verifyStripeWebhookConfig reports missing_events and captures an issue when required events are absent", async () => {
  const captured: StripeWebhookConfigIssue[] = []
  const result = await verifyStripeWebhookConfig({
    webhookUrl: "https://app.example.com/api/stripe/webhook",
    listWebhookEndpoints: async () => [
      {
        id: "we_1",
        url: "https://app.example.com/api/stripe/webhook",
        enabled_events: ["customer.subscription.updated", "invoice.payment_succeeded"],
      },
    ],
    captureIssue: (issue) => captured.push(issue),
  })

  assert.deepEqual(result, {
    status: "missing_events",
    endpointId: "we_1",
    enabledEvents: ["customer.subscription.updated", "invoice.payment_succeeded"],
    missingEvents: ["customer.subscription.deleted", "invoice.payment_failed"],
  })
  assert.deepEqual(captured, [result])
})

test("verifyStripeWebhookConfig reports endpoint_not_found and captures an issue when no endpoint matches the app URL", async () => {
  const captured: StripeWebhookConfigIssue[] = []
  const result = await verifyStripeWebhookConfig({
    webhookUrl: "https://app.example.com/api/stripe/webhook",
    listWebhookEndpoints: async () => [
      {
        id: "we_other",
        url: "https://other-app.example.com/api/stripe/webhook",
        enabled_events: [...REQUIRED_STRIPE_WEBHOOK_EVENTS],
      },
    ],
    captureIssue: (issue) => captured.push(issue),
  })

  assert.deepEqual(result, {
    status: "endpoint_not_found",
    webhookUrl: "https://app.example.com/api/stripe/webhook",
  })
  assert.deepEqual(captured, [result])
})

test("verifyStripeWebhookConfig reports error and captures an issue when listing endpoints fails", async () => {
  const captured: StripeWebhookConfigIssue[] = []
  const result = await verifyStripeWebhookConfig({
    webhookUrl: "https://app.example.com/api/stripe/webhook",
    listWebhookEndpoints: async () => {
      throw new Error("stripe api unavailable")
    },
    captureIssue: (issue) => captured.push(issue),
  })

  assert.deepEqual(result, { status: "error", reason: "stripe api unavailable" })
  assert.deepEqual(captured, [result])
})

test("verifyStripeWebhookConfig does not capture an issue for the ok result", async () => {
  let captureCalls = 0
  await verifyStripeWebhookConfig({
    webhookUrl: "https://app.example.com/api/stripe/webhook",
    listWebhookEndpoints: async () => [
      {
        id: "we_1",
        url: "https://app.example.com/api/stripe/webhook",
        enabled_events: [...REQUIRED_STRIPE_WEBHOOK_EVENTS],
      },
    ],
    captureIssue: () => {
      captureCalls += 1
    },
  })

  assert.equal(captureCalls, 0)
})
