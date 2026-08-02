import assert from "node:assert/strict"
import test from "node:test"

import {
  createPreparedCheckoutCredential,
  createAlreadyReportedPreparedCheckoutError,
  getPreparedCheckoutControlOutcome,
  isHandledPreparedCheckoutControlError,
  isAlreadyReportedPreparedCheckoutError,
} from "../src/lib/stripe/prepared-checkout-credential"

test("prepared checkout credentials are stable values until their owner deliberately refreshes", () => {
  let sequence = 0
  const cryptoSource = {
    getRandomValues: (bytes: Uint8Array) => {
      bytes.fill(++sequence)
      return bytes
    },
    randomUUID: () => `preparation-${++sequence}`,
  }

  const first = createPreparedCheckoutCredential(cryptoSource)
  const retry = first
  const refreshed = createPreparedCheckoutCredential(cryptoSource)

  assert.deepEqual(retry, first)
  assert.notEqual(refreshed.preparationId, first.preparationId)
  assert.notEqual(refreshed.preparationToken, first.preparationToken)
  assert.match(first.preparationToken, /^[A-Za-z0-9_-]{40,}$/)
})

test("expected prepared checkout controls stay outside payment-failure reporting", () => {
  assert.equal(
    getPreparedCheckoutControlOutcome({ status: "unavailable" }),
    "prepared_checkout_unavailable",
  )
  assert.equal(
    getPreparedCheckoutControlOutcome({ error: "checkout_access_already_exists" }),
    "duplicate_access",
  )
  assert.equal(getPreparedCheckoutControlOutcome({ providerLocked: "paypal" }), "provider_locked")
  assert.equal(getPreparedCheckoutControlOutcome({ status: "prepared" }), null)
  assert.equal(
    isHandledPreparedCheckoutControlError(
      new Error("prepared_checkout_control:prepared_checkout_unavailable"),
    ),
    true,
  )
  assert.equal(isHandledPreparedCheckoutControlError(new Error("Stripe unavailable")), false)

  const alreadyReported = createAlreadyReportedPreparedCheckoutError(new Error("network failure"))
  assert.equal(isAlreadyReportedPreparedCheckoutError(alreadyReported), true)
  assert.equal(isHandledPreparedCheckoutControlError(alreadyReported), false)
  assert.equal(isAlreadyReportedPreparedCheckoutError(new Error("network failure")), false)
})
