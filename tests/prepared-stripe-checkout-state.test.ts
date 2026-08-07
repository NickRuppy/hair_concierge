import assert from "node:assert/strict"
import test from "node:test"

import { resolvePreparedStripeCheckoutState } from "../src/lib/stripe/prepared-stripe-checkout-state"

const preparedResponse = {
  client_secret: "cs_test_prepared",
  expires_at: 1_800_000_000,
  preparation_token: "prepare_token",
  session_id: "cs_session",
  status: "prepared",
} as const

test("prepared Stripe ownership resolves every expected control outcome before Elements can mount", () => {
  assert.deepEqual(
    resolvePreparedStripeCheckoutState({
      body: preparedResponse,
      responseOk: true,
      responseStatus: 200,
    }),
    {
      kind: "ready",
      checkout: {
        clientSecret: "cs_test_prepared",
        expiresAt: 1_800_000_000,
        owner: null,
        preparationToken: "prepare_token",
        sessionId: "cs_session",
      },
    },
  )
  assert.deepEqual(
    resolvePreparedStripeCheckoutState({
      body: { error: "payment provider already selected", provider_locked: "paypal" },
      responseOk: false,
      responseStatus: 409,
    }),
    { kind: "provider_locked_paypal" },
  )
  assert.deepEqual(
    resolvePreparedStripeCheckoutState({
      body: { error: "payment provider already selected", provider_locked: "stripe" },
      responseOk: false,
      responseStatus: 409,
    }),
    { kind: "provider_locked_stripe" },
  )
  assert.deepEqual(
    resolvePreparedStripeCheckoutState({
      body: { ...preparedResponse, provider_locked: "stripe", status: "recovered" },
      responseOk: true,
      responseStatus: 200,
    }),
    {
      kind: "ready",
      checkout: {
        clientSecret: "cs_test_prepared",
        expiresAt: 1_800_000_000,
        owner: "stripe",
        preparationToken: "prepare_token",
        sessionId: "cs_session",
      },
    },
  )
  assert.deepEqual(
    resolvePreparedStripeCheckoutState({
      body: { status: "unavailable" },
      responseOk: false,
      responseStatus: 409,
    }),
    { kind: "unavailable" },
  )
  assert.deepEqual(
    resolvePreparedStripeCheckoutState({
      body: { error: "checkout already completed", email: "  lea@example.com  " },
      responseOk: false,
      responseStatus: 409,
    }),
    { kind: "duplicate_access", email: "lea@example.com" },
  )
  assert.equal(
    resolvePreparedStripeCheckoutState({
      body: { error: "upstream unavailable" },
      responseOk: false,
      responseStatus: 503,
    }),
    null,
  )
  assert.equal(
    resolvePreparedStripeCheckoutState({
      body: { ...preparedResponse, client_secret: "" },
      responseOk: true,
      responseStatus: 200,
    }),
    null,
    "an empty client secret must not mount Checkout Elements",
  )
})
