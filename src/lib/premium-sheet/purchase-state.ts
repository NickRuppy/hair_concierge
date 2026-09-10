/**
 * The Premium sheet's purchase machine (freemium-scanner-first T14).
 *
 * Pure and React-free so the states that matter — and above all the ones that must NOT
 * unlock anything — are testable without a browser. The sheet renders one of these
 * phases; the component owns only the effects (fetch, Stripe mount, refresh, toast).
 *
 * The journey's shape, in states:
 *
 *   plans ──(CTA)──▶ starting ──▶ paying ──(Stripe onComplete)──▶ verifying
 *                        │                                            │
 *                        │                                  ┌─────────┴─────────┐
 *                        ▼                                  ▼                   ▼
 *                     failed ◀──────────────────────────  pending           unlocked
 *
 * Two rules the type system enforces here rather than leaving to the component:
 *
 *  1. **Only the server unlocks.** `unlocked` is reachable only from a verified
 *     completion (`verification_complete`), never from Stripe's client callback — that
 *     callback moves the machine to `verifying` and nothing else.
 *  2. **Failure never costs the free session.** Every failure and every escape lands back
 *     in `plans` (or holds `failed` with a retry), inside the same mounted sheet. Nothing
 *     in this machine navigates, and nothing clears scan state.
 */

import type { BillingInterval } from "@/lib/stripe/intervals"

export type PremiumSheetPurchasePhase =
  /** Plan selection — the T13 sheet, unchanged. */
  | { phase: "plans" }
  /** CTA pressed; the checkout session is being created. */
  | { phase: "starting"; interval: BillingInterval; attemptId: string }
  /** Embedded checkout is mounted and the buyer is paying. */
  | { phase: "paying"; interval: BillingInterval; attemptId: string }
  /** Stripe says the form finished; the server is deciding whether money moved. */
  | { phase: "verifying"; interval: BillingInterval; attemptId: string; sessionId: string }
  /** Verified: entitlement is live. `routineReady` says whether content is there yet. */
  | { phase: "unlocked"; routineReady: boolean }
  /** An asynchronous payment is still settling; the webhook will finish it. */
  | { phase: "pending"; sessionId: string }
  /** Recoverable: the sheet shows the reason and one retry back into `plans`. */
  | { phase: "failed"; reason: PremiumSheetPurchaseFailure }

export type PremiumSheetPurchaseFailure =
  /** The checkout session could not be created (network, config, server). */
  | "checkout_unavailable"
  /** Stripe.js or the embedded form could not load. */
  | "provider_unavailable"
  /** The server refused or could not verify the completed session. */
  | "verification_failed"

export type PremiumSheetPurchaseEvent =
  | { type: "checkout_requested"; interval: BillingInterval; attemptId: string }
  | { type: "checkout_ready" }
  | { type: "checkout_failed"; reason: PremiumSheetPurchaseFailure }
  /** Stripe's embedded `onComplete`, or a contextual redirect return. */
  | { type: "provider_completed"; sessionId: string }
  | { type: "verification_complete"; routineReady: boolean }
  | { type: "verification_pending" }
  | { type: "verification_failed" }
  /** Any escape the buyer takes: back to plans, the X, backdrop, Escape. */
  | { type: "returned_to_plans" }

export const initialPremiumSheetPurchaseState: PremiumSheetPurchasePhase = { phase: "plans" }

export function premiumSheetPurchaseReducer(
  state: PremiumSheetPurchasePhase,
  event: PremiumSheetPurchaseEvent,
): PremiumSheetPurchasePhase {
  switch (event.type) {
    case "checkout_requested":
      // Guarded against a double CTA press: a checkout already in flight is not restarted,
      // which would strand the first Stripe session.
      if (state.phase !== "plans" && state.phase !== "failed") return state
      return { phase: "starting", interval: event.interval, attemptId: event.attemptId }
    case "checkout_ready":
      if (state.phase !== "starting") return state
      return { phase: "paying", interval: state.interval, attemptId: state.attemptId }
    case "checkout_failed":
      // A provider failure after the payment finished must not overwrite a verified
      // unlock or a pending payment — the money outranks the widget.
      if (state.phase === "unlocked" || state.phase === "pending") return state
      return { phase: "failed", reason: event.reason }
    case "provider_completed":
      if (state.phase === "unlocked") return state
      return {
        phase: "verifying",
        // A contextual redirect return re-enters the machine at `plans`, with no live
        // interval/attempt to carry — the session id is the only thing verification needs.
        interval: "interval" in state ? state.interval : "year",
        attemptId: "attemptId" in state ? state.attemptId : "",
        sessionId: event.sessionId,
      }
    case "verification_complete":
      return { phase: "unlocked", routineReady: event.routineReady }
    case "verification_pending":
      if (state.phase !== "verifying") return state
      return { phase: "pending", sessionId: state.sessionId }
    case "verification_failed":
      if (state.phase !== "verifying") return state
      return { phase: "failed", reason: "verification_failed" }
    case "returned_to_plans":
      // An unlocked purchase is terminal: the sheet is closing into the unlocked world and
      // must never fall back to showing plans the buyer has already paid for.
      if (state.phase === "unlocked") return state
      return { phase: "plans" }
    default:
      return state
  }
}

/** The sheet's plan rows and CTA are interactive only while no payment is in flight. */
export function isPremiumSheetPlanSelectionActive(state: PremiumSheetPurchasePhase): boolean {
  return state.phase === "plans" || state.phase === "failed"
}

/** Escapes stay available throughout — a payment sheet must never trap the buyer. */
export function premiumSheetShowsCheckout(state: PremiumSheetPurchasePhase): boolean {
  return state.phase === "starting" || state.phase === "paying"
}
