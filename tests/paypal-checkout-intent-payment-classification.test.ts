import assert from "node:assert/strict"
import test from "node:test"
import {
  isPayPalCheckoutIntentEligibleForInitialPayment,
  type PayPalCheckoutIntentRow,
} from "../src/lib/paypal/checkout-intents"

const createdAt = "2026-07-18T10:00:00.000Z"
const expiresAt = "2026-07-19T10:00:00.000Z"

function intent(patch: Partial<PayPalCheckoutIntentRow> = {}): PayPalCheckoutIntentRow {
  return {
    id: "intent-1",
    token: "token-1",
    interval: "month",
    source: "pricing_page",
    lead_id: null,
    email: null,
    user_id: null,
    reactivation_reservation_id: null,
    provider_subscription_id: "I-1",
    status: "approved",
    duplicate_reason: null,
    created_at: createdAt,
    expires_at: expiresAt,
    updated_at: createdAt,
    metadata: {},
    ...patch,
  }
}

test("initial payment eligibility accepts created, approved, and activated bound intents", () => {
  for (const status of ["created", "approved", "activated"] as const) {
    assert.equal(
      isPayPalCheckoutIntentEligibleForInitialPayment(intent({ status }), {
        providerSubscriptionId: "I-1",
        eventCreatedAt: "2026-07-18T10:05:00.000Z",
      }),
      true,
    )
  }
})

test("initial payment eligibility allows five minutes of provider clock skew", () => {
  assert.equal(
    isPayPalCheckoutIntentEligibleForInitialPayment(intent(), {
      providerSubscriptionId: "I-1",
      eventCreatedAt: "2026-07-18T09:55:00.000Z",
    }),
    true,
  )
  assert.equal(
    isPayPalCheckoutIntentEligibleForInitialPayment(intent(), {
      providerSubscriptionId: "I-1",
      eventCreatedAt: "2026-07-18T09:54:59.999Z",
    }),
    false,
  )
})

test("initial payment eligibility rejects mismatches, quarantines, expiry, and invalid times", () => {
  const input = { providerSubscriptionId: "I-1", eventCreatedAt: createdAt }

  assert.equal(
    isPayPalCheckoutIntentEligibleForInitialPayment(
      intent({ provider_subscription_id: "I-other" }),
      input,
    ),
    false,
  )
  assert.equal(
    isPayPalCheckoutIntentEligibleForInitialPayment(intent({ status: "duplicate" }), input),
    false,
  )
  assert.equal(
    isPayPalCheckoutIntentEligibleForInitialPayment(intent({ status: "expired" }), input),
    false,
  )
  assert.equal(
    isPayPalCheckoutIntentEligibleForInitialPayment(intent(), {
      ...input,
      eventCreatedAt: "2026-07-19T10:00:00.001Z",
    }),
    false,
  )
  assert.equal(
    isPayPalCheckoutIntentEligibleForInitialPayment(intent({ created_at: "invalid" }), input),
    false,
  )
})
