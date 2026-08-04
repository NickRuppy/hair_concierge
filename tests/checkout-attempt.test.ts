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

test("checkout lifecycle keeps hide resumable, increments reopen indexes, and ends terminally", () => {
  const controller = createCheckoutAttemptController(() => "checkout-attempt-1")
  const firstOpen = controller.open()

  assert.equal(controller.openIndex(), 1)
  assert.equal(controller.hide(), "checkout-attempt-1")
  assert.equal(controller.retry(), "checkout-attempt-1")
  assert.deepEqual(controller.resume(), {
    checkoutAttemptId: "checkout-attempt-1",
    isNew: false,
  })
  assert.equal(controller.openIndex(), 2)

  const preparationClaim = {
    checkoutAttemptId: firstOpen.checkoutAttemptId,
    lastState: "none" as const,
    openIndex: 2,
    transition: "provider_ready" as const,
    provider: "stripe" as const,
  }
  assert.equal(controller.claimLifecycle(preparationClaim), true)
  assert.equal(controller.claimLifecycle(preparationClaim), false)
  assert.equal(
    controller.claimLifecycle({ ...preparationClaim, provider: "paypal" }),
    true,
    "a separate provider is a meaningful lifecycle transition",
  )
  assert.equal(
    controller.claimLifecycle({ ...preparationClaim, openIndex: 3 }),
    false,
    "a stale presentation index cannot claim a lifecycle transition",
  )
  assert.equal(
    controller.claimLifecycle({ ...preparationClaim, checkoutAttemptId: "stale-attempt" }),
    false,
    "a stale checkout attempt cannot claim a lifecycle transition",
  )

  const customerAbortClaim = {
    checkoutAttemptId: firstOpen.checkoutAttemptId,
    dismissalReason: "close_button" as const,
    endReason: "customer_aborted" as const,
    lastState: "payment_engaged" as const,
    openIndex: 2,
    transition: "attempt_ended" as const,
  }
  assert.equal(controller.claimLifecycle(customerAbortClaim), true)

  assert.equal(controller.end(), "checkout-attempt-1")
  assert.equal(
    controller.claimLifecycle({
      ...customerAbortClaim,
      dismissalReason: undefined,
      endReason: "page_teardown",
    }),
    false,
    "teardown after a terminal customer abort cannot emit a second attempt_ended",
  )
  assert.equal(
    controller.claimLifecycle(preparationClaim),
    false,
    "callbacks after the terminal end cannot claim a lifecycle transition",
  )
  assert.equal(controller.retry(), null)
  assert.equal(controller.resume(), null)
  assert.equal(controller.openIndex(), null)
})
