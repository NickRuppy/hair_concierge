import assert from "node:assert/strict"
import test from "node:test"

import {
  consumeOfferCheckoutHistorySentinel,
  createOfferCheckoutHistoryGuard,
  isOfferCheckoutHistoryState,
  pushOfferCheckoutHistorySentinel,
  restoreOfferCheckoutHistorySentinel,
} from "../src/lib/checkout/offer-checkout-history"

function createWindow(state: unknown = null) {
  let currentState = state
  let pushes = 0
  let backs = 0
  return {
    history: {
      get state() {
        return currentState
      },
      pushState(next: unknown) {
        currentState = next
        pushes += 1
      },
      back() {
        backs += 1
        currentState = { ppq: 2 }
      },
    },
    location: { href: "https://example.test/result/lead" },
    counts: () => ({ pushes, backs }),
  }
}

test("checkout history owns one same-URL sentinel and ignores foreign quiz state", () => {
  const win = createWindow({ ppq: 1 })
  const guard = createOfferCheckoutHistoryGuard()

  assert.equal(isOfferCheckoutHistoryState({ ppq: 1 }), false)
  assert.equal(pushOfferCheckoutHistorySentinel(guard, win), true)
  assert.equal(pushOfferCheckoutHistorySentinel(guard, win), false)
  assert.equal(isOfferCheckoutHistoryState(win.history.state), true)
  assert.deepEqual(win.counts(), { pushes: 1, backs: 0 })
})

test("a new overlay guard pushes above stale checkout history state", () => {
  const win = createWindow({ __chaarlieOfferCheckout: "open-v1" })
  const guard = createOfferCheckoutHistoryGuard()

  assert.equal(pushOfferCheckoutHistorySentinel(guard, win), true)
  assert.equal(guard.ownsSentinel, true)
  assert.deepEqual(win.counts(), { pushes: 1, backs: 0 })
})

test("Back dismissal consumes one guard, confirmation cancellation restores one, then explicit close consumes it", () => {
  const win = createWindow()
  const guard = createOfferCheckoutHistoryGuard()
  pushOfferCheckoutHistorySentinel(guard, win)

  assert.equal(consumeOfferCheckoutHistorySentinel(guard, win), true)
  assert.deepEqual(win.counts(), { pushes: 1, backs: 1 })
  assert.equal(consumeOfferCheckoutHistorySentinel(guard, win), false)

  assert.equal(restoreOfferCheckoutHistorySentinel(guard, win), true)
  assert.equal(restoreOfferCheckoutHistorySentinel(guard, win), false)
  assert.deepEqual(win.counts(), { pushes: 2, backs: 1 })

  assert.equal(consumeOfferCheckoutHistorySentinel(guard, win), true)
  assert.deepEqual(win.counts(), { pushes: 2, backs: 2 })
})
