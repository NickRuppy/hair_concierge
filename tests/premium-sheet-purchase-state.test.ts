import assert from "node:assert/strict"
import test from "node:test"

import {
  initialPremiumSheetPurchaseState,
  isPremiumSheetPlanSelectionActive,
  premiumSheetPurchaseReducer,
  premiumSheetShowsCheckout,
  type PremiumSheetPurchaseEvent,
  type PremiumSheetPurchasePhase,
} from "../src/lib/premium-sheet/purchase-state"

/**
 * The sheet's purchase machine. The claims worth pinning are the ones a component test
 * would only reach by accident:
 *
 *  - Stripe's client `onComplete` cannot unlock anything. It moves the machine to
 *    `verifying`; only a SERVER-verified completion reaches `unlocked`.
 *  - Every failure and escape returns to the plan rows. Nothing here can navigate away or
 *    end a free session, because nothing here has that vocabulary.
 */

function run(events: PremiumSheetPurchaseEvent[]): PremiumSheetPurchasePhase {
  return events.reduce(premiumSheetPurchaseReducer, initialPremiumSheetPurchaseState)
}

const start: PremiumSheetPurchaseEvent = {
  type: "checkout_requested",
  interval: "year",
  attemptId: "attempt-1",
}

test("the happy path: CTA → checkout → provider done → verified unlock", () => {
  const state = run([
    start,
    { type: "checkout_ready" },
    { type: "provider_completed", sessionId: "cs_1" },
    { type: "verification_complete", routineReady: true },
  ])
  assert.deepEqual(state, { phase: "unlocked", routineReady: true })
})

test("the provider's completion callback ALONE never unlocks", () => {
  const state = run([
    start,
    { type: "checkout_ready" },
    { type: "provider_completed", sessionId: "cs_1" },
  ])
  assert.equal(state.phase, "verifying")
})

test("a rejected verification lands back on the plan rows, inside the same sheet", () => {
  const state = run([
    start,
    { type: "checkout_ready" },
    { type: "provider_completed", sessionId: "cs_1" },
    { type: "verification_failed" },
  ])
  assert.deepEqual(state, { phase: "failed", reason: "verification_failed" })
  assert.equal(isPremiumSheetPlanSelectionActive(state), true)
})

test("a pending payment holds its own state and can still complete later", () => {
  const pending = run([
    start,
    { type: "checkout_ready" },
    { type: "provider_completed", sessionId: "cs_1" },
    { type: "verification_pending" },
  ])
  assert.deepEqual(pending, { phase: "pending", sessionId: "cs_1" })

  const completed = [
    { type: "provider_completed", sessionId: "cs_1" } as const,
    { type: "verification_complete", routineReady: false } as const,
  ].reduce(premiumSheetPurchaseReducer, pending)
  assert.deepEqual(completed, { phase: "unlocked", routineReady: false })
})

test("a late provider failure cannot demote a pending payment or an unlocked purchase", () => {
  for (const settled of [
    { phase: "pending", sessionId: "cs_1" } as const,
    { phase: "unlocked", routineReady: true } as const,
  ]) {
    assert.deepEqual(
      premiumSheetPurchaseReducer(settled, {
        type: "checkout_failed",
        reason: "provider_unavailable",
      }),
      settled,
    )
  }
})

test("a second CTA press does not strand the checkout already in flight", () => {
  const paying = run([start, { type: "checkout_ready" }])
  const again = premiumSheetPurchaseReducer(paying, {
    type: "checkout_requested",
    interval: "month",
    attemptId: "attempt-2",
  })
  assert.deepEqual(again, paying)
})

test("a failed attempt can be retried from the plan rows with a fresh attempt id", () => {
  const failed = run([start, { type: "checkout_failed", reason: "checkout_unavailable" }])
  const retried = premiumSheetPurchaseReducer(failed, {
    type: "checkout_requested",
    interval: "month",
    attemptId: "attempt-2",
  })
  assert.deepEqual(retried, { phase: "starting", interval: "month", attemptId: "attempt-2" })
})

test("escaping mid-payment returns to plans, but an unlocked purchase is terminal", () => {
  const paying = run([start, { type: "checkout_ready" }])
  assert.deepEqual(premiumSheetPurchaseReducer(paying, { type: "returned_to_plans" }), {
    phase: "plans",
  })

  const unlocked = { phase: "unlocked", routineReady: true } as const
  assert.deepEqual(premiumSheetPurchaseReducer(unlocked, { type: "returned_to_plans" }), unlocked)
})

test("a contextual redirect return verifies even though the sheet lost its in-flight state", () => {
  // PayPal (inside Stripe Checkout) reloads the page: the machine is back at `plans` and the
  // only thing it has is the session id from the URL.
  const state = premiumSheetPurchaseReducer(initialPremiumSheetPurchaseState, {
    type: "provider_completed",
    sessionId: "cs_redirect",
  })
  assert.equal(state.phase, "verifying")
  if (state.phase !== "verifying") throw new Error("unreachable")
  assert.equal(state.sessionId, "cs_redirect")
})

test("the plan rows and the checkout body are never both live", () => {
  const states: PremiumSheetPurchasePhase[] = [
    { phase: "plans" },
    { phase: "starting", interval: "year", attemptId: "a" },
    { phase: "paying", interval: "year", attemptId: "a" },
    { phase: "verifying", interval: "year", attemptId: "a", sessionId: "cs_1" },
    { phase: "pending", sessionId: "cs_1" },
    { phase: "failed", reason: "verification_failed" },
    { phase: "unlocked", routineReady: true },
  ]
  for (const state of states) {
    assert.equal(
      isPremiumSheetPlanSelectionActive(state) && premiumSheetShowsCheckout(state),
      false,
      `${state.phase} must not show both`,
    )
  }
})
