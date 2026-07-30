import assert from "node:assert/strict"
import test from "node:test"

import {
  claimCheckoutOpenRequest,
  createCheckoutAttemptController,
} from "../src/lib/analytics/checkout-attempt"

test("checkout attempt identity stays correlated until close and partitions failure dedupe", () => {
  const generatedIds = ["checkout-attempt-1", "checkout-attempt-2"]
  const controller = createCheckoutAttemptController(() => {
    const nextId = generatedIds.shift()
    assert.ok(nextId)
    return nextId
  })

  const firstOpen = controller.open()
  assert.deepEqual(firstOpen, {
    checkoutAttemptId: "checkout-attempt-1",
    isNew: true,
  })
  assert.deepEqual(controller.open(), {
    checkoutAttemptId: "checkout-attempt-1",
    isNew: false,
  })
  assert.equal(controller.retry(), "checkout-attempt-1")

  assert.equal(
    controller.claimFailure(
      firstOpen.checkoutAttemptId,
      "paypal",
      "provider_session",
      "paypal_js_load_failed",
    ),
    true,
  )
  assert.equal(
    controller.claimFailure(
      firstOpen.checkoutAttemptId,
      "paypal",
      "provider_session",
      "paypal_js_load_failed",
    ),
    false,
  )

  assert.equal(controller.close(), "checkout-attempt-1")
  assert.equal(controller.retry(), null)

  const secondOpen = controller.open()
  assert.deepEqual(secondOpen, {
    checkoutAttemptId: "checkout-attempt-2",
    isNew: true,
  })
  assert.equal(
    controller.claimFailure(
      secondOpen.checkoutAttemptId,
      "paypal",
      "provider_session",
      "paypal_js_load_failed",
    ),
    true,
  )
})

test("pricing CTA and final request tokens each open one checkout attempt", () => {
  const controller = createCheckoutAttemptController(() => "checkout-attempt-1")
  let pricingOpenCount = 0
  const openFromPricing = () => {
    const claim = controller.open()
    if (claim.isNew) pricingOpenCount += 1
  }

  openFromPricing()
  openFromPricing()
  assert.equal(pricingOpenCount, 1, "repeat pricing actions must reuse the open attempt")

  const handledFinalRequests = new Set<number>()
  assert.equal(claimCheckoutOpenRequest(handledFinalRequests, undefined), false)
  assert.equal(claimCheckoutOpenRequest(handledFinalRequests, 1), true)
  assert.equal(claimCheckoutOpenRequest(handledFinalRequests, 1), false)
  assert.equal(claimCheckoutOpenRequest(handledFinalRequests, 2), true)
})
