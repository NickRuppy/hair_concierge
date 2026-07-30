import assert from "node:assert/strict"
import test from "node:test"
import {
  IDLE_OFFER_CHECKOUT_READY_GATE,
  reduceOfferCheckoutReadyGate,
} from "../src/lib/stripe/offer-checkout-ready-gate"

test("a duplicate request does not replace the in-flight gate", () => {
  const waiting = reduceOfferCheckoutReadyGate(IDLE_OFFER_CHECKOUT_READY_GATE, {
    type: "request",
  })

  assert.deepEqual(waiting, { status: "waiting" })
  assert.equal(reduceOfferCheckoutReadyGate(waiting, { type: "request" }), waiting)
})

test("available commits to the prepared open only with a currently usable preparation", () => {
  const waiting = reduceOfferCheckoutReadyGate(IDLE_OFFER_CHECKOUT_READY_GATE, {
    type: "request",
  })

  assert.deepEqual(
    reduceOfferCheckoutReadyGate(waiting, {
      type: "available",
      preparedCheckoutUsable: true,
    }),
    { status: "open_prepared" },
  )
  assert.deepEqual(
    reduceOfferCheckoutReadyGate(waiting, {
      type: "available",
      preparedCheckoutUsable: false,
    }),
    { status: "open_fallback", fallback: "cold", reason: "prepared_unusable" },
  )
})

test("unavailable and preparation failure each commit exactly once", () => {
  const waiting = reduceOfferCheckoutReadyGate(IDLE_OFFER_CHECKOUT_READY_GATE, {
    type: "request",
  })

  const unavailable = reduceOfferCheckoutReadyGate(waiting, {
    type: "unavailable",
    preparedCheckoutUsable: true,
  })
  assert.deepEqual(unavailable, {
    status: "open_fallback",
    fallback: "prepared",
    reason: "unavailable",
  })
  assert.equal(
    reduceOfferCheckoutReadyGate(unavailable, {
      type: "failure",
      preparedCheckoutUsable: false,
    }),
    unavailable,
  )

  assert.deepEqual(
    reduceOfferCheckoutReadyGate(waiting, {
      type: "failure",
      preparedCheckoutUsable: true,
    }),
    { status: "open_fallback", fallback: "prepared", reason: "failure" },
  )
  assert.deepEqual(
    reduceOfferCheckoutReadyGate(waiting, {
      type: "failure",
      preparedCheckoutUsable: false,
    }),
    { status: "open_fallback", fallback: "cold", reason: "failure" },
  )
})

test("timeout chooses the prepared or cold fallback from current usability", () => {
  const waiting = reduceOfferCheckoutReadyGate(IDLE_OFFER_CHECKOUT_READY_GATE, {
    type: "request",
  })

  assert.deepEqual(
    reduceOfferCheckoutReadyGate(waiting, {
      type: "timeout",
      preparedCheckoutUsable: true,
    }),
    { status: "open_fallback", fallback: "prepared", reason: "timeout" },
  )
  assert.deepEqual(
    reduceOfferCheckoutReadyGate(waiting, {
      type: "timeout",
      preparedCheckoutUsable: false,
    }),
    { status: "open_fallback", fallback: "cold", reason: "timeout" },
  )
})

test("late terminal events are ignored after the gate commits", () => {
  const committed = reduceOfferCheckoutReadyGate(
    reduceOfferCheckoutReadyGate(IDLE_OFFER_CHECKOUT_READY_GATE, { type: "request" }),
    { type: "timeout", preparedCheckoutUsable: false },
  )

  for (const event of [
    { type: "available" as const, preparedCheckoutUsable: true },
    { type: "unavailable" as const, preparedCheckoutUsable: true },
    { type: "failure" as const, preparedCheckoutUsable: true },
    { type: "timeout" as const, preparedCheckoutUsable: true },
  ]) {
    assert.equal(reduceOfferCheckoutReadyGate(committed, event), committed)
  }
})

test("reset always returns the gate to idle", () => {
  const fallback = reduceOfferCheckoutReadyGate(
    reduceOfferCheckoutReadyGate(IDLE_OFFER_CHECKOUT_READY_GATE, { type: "request" }),
    { type: "unavailable", preparedCheckoutUsable: true },
  )

  assert.equal(
    reduceOfferCheckoutReadyGate(fallback, { type: "reset" }),
    IDLE_OFFER_CHECKOUT_READY_GATE,
  )
})
