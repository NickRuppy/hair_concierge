import assert from "node:assert/strict"
import test from "node:test"

import {
  buildCustomerIoCheckoutCompletedSync,
  buildCustomerIoInvoicePaymentFailedSync,
  buildCustomerIoSubscriptionLifecycleSync,
} from "../src/lib/customerio/stripe-lifecycle"

test("builds purchase and subscription events from a completed checkout", () => {
  const sync = buildCustomerIoCheckoutCompletedSync({
    email: "buyer@example.com",
    interval: "month",
    planId: "premium_month",
    session: {
      id: "cs_test_123",
      amount_total: 749,
      currency: "eur",
      customer: "cus_123",
      subscription: "sub_123",
    },
    stripeEventId: "evt_123",
    subscriptionStatus: "active",
    timestamp: "2026-05-28T10:00:00.000Z",
    userId: "user_123",
  })

  assert.equal(sync.userId, "user_123")
  assert.equal(sync.identifyTraits.email, "buyer@example.com")
  assert.equal(sync.identifyTraits.is_customer, true)
  assert.equal(sync.identifyTraits.subscription_interval, "month")
  assert.equal(sync.identifyTraits.stripe_customer_id, "cus_123")
  assert.equal(sync.identifyTraits.stripe_subscription_id, "sub_123")
  assert.deepEqual(
    sync.events.map((event) => event.event),
    ["purchase_completed", "subscription_started"],
  )
  assert.equal(sync.events[0].messageId, "purchase_completed:cs_test_123")
  assert.equal(sync.events[0].properties.source, "stripe_webhook")
  assert.equal(sync.events[0].properties.amount, 7.49)
  assert.equal(sync.events[0].properties.currency, "EUR")
  assert.equal(sync.events[0].timestamp, "2026-05-28T10:00:00.000Z")
  assert.equal(sync.events[1].messageId, "subscription_started:sub_123")
  assert.equal(sync.events[1].properties.subscription_status, "active")
  assert.equal(sync.events[1].timestamp, "2026-05-28T10:00:00.000Z")
})

test("builds payment_failed from an invoice", () => {
  const sync = buildCustomerIoInvoicePaymentFailedSync({
    email: "buyer@example.com",
    invoice: {
      id: "in_123",
      amount_due: 749,
      attempt_count: 2,
      currency: "eur",
      customer: "cus_123",
      subscription: "sub_123",
    },
    stripeEventId: "evt_failed",
    timestamp: "2026-05-28T10:00:00.000Z",
    userId: "user_123",
  })

  assert.equal(sync.event.event, "payment_failed")
  assert.equal(sync.event.messageId, "payment_failed:in_123")
  assert.equal(sync.event.properties.amount_due, 7.49)
  assert.equal(sync.event.properties.attempt_count, 2)
  assert.equal(sync.event.properties.currency, "EUR")
  assert.equal(sync.event.properties.source, "stripe_webhook")
  assert.equal(sync.event.timestamp, "2026-05-28T10:00:00.000Z")
})

test("builds subscription cancellation with event-id-scoped dedupe", () => {
  const sync = buildCustomerIoSubscriptionLifecycleSync({
    email: "buyer@example.com",
    eventType: "subscription_cancelled",
    interval: "quarter",
    status: "canceled",
    stripeCustomerId: "cus_123",
    stripeEventId: "evt_cancelled",
    stripeSubscriptionId: "sub_123",
    timestamp: "2026-05-28T10:00:00.000Z",
    userId: "user_123",
  })

  assert.equal(sync.identifyTraits.is_customer, false)
  assert.equal(sync.event.event, "subscription_cancelled")
  assert.equal(sync.event.messageId, "subscription_cancelled:sub_123:evt_cancelled")
  assert.equal(sync.event.properties.subscription_status, "canceled")
})
