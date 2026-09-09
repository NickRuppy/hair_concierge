import type { ScanSearchReason } from "@/components/scan/scan-search-sheet"
import type { ScanUnavailableReason } from "@/components/scan/scanner"

import type { PremiumSheetContext } from "@/lib/premium-sheet/context"

import type { ScanSavedStatePayload } from "./saved-state"
import type {
  ScanAlternativePresentation,
  ScanPendingSubmissionResult,
  ScanUnknownProductResult,
} from "./types"
import {
  nextScanTierSignal,
  scanTierSignal,
  type ScanClientResolveResult,
  type ScanTierSignal,
  type ScanVerdictResult,
} from "./verdict-access"

/**
 * The whole `/scan` client state machine as one pure reducer, so the transitions can be
 * tested without a camera, a DOM or a network — and so the guards that used to live in
 * scattered refs inside `ScanFlow` become structural instead of conventional.
 *
 * Two of those guards are the point of the extraction:
 * - Every async action carries the token of the request it belongs to, and is a no-op
 *   unless that request is still the active one. A resolve or submit whose sheet the user
 *   already dismissed can therefore no longer repaint the step, re-open a sheet over a
 *   live viewfinder, or clear a newer request's `submitting` flag (finding F4).
 * - `saved_state_changed` carries the product it belongs to, so a save that completes
 *   after the user scanned something else cannot land on the new product's card (F5).
 */

export type ScanFlowStep =
  | { kind: "scanning" }
  | { kind: "resolving" }
  | { kind: "result"; result: ScanVerdictResult }
  | { kind: "unknown"; unknown: ScanUnknownProductResult }
  | { kind: "pending"; pending: ScanPendingSubmissionResult }

/**
 * The free tier's one-lifetime reveal (T9), scoped to the product it was started for so a
 * response that lands after the user scanned something else can never unblur the new
 * product's card. `unavailable` is the 409 `already_used` answer — the credit turns out to
 * be spent (a second tab, a reload) — which flips the CTA to the Premium sheet instead of
 * offering a reveal the server will keep refusing.
 */
export type ScanRevealState =
  | { status: "idle" }
  | { status: "pending"; productId: string }
  | { status: "revealed"; productId: string; alternatives: ScanAlternativePresentation[] }
  | { status: "unavailable"; productId: string }

/**
 * `unavailable` is "we never got a stream" (permission, no device, insecure context);
 * `stalled` is "we had one and it died" (track ended/muted, restored from bfcache). They
 * stay distinct because only the second one can be recovered by re-acquiring silently.
 */
export type ScanCameraState =
  | { status: "live" }
  | { status: "unavailable"; reason: ScanUnavailableReason }
  | { status: "stalled" }

export type ScanFlowState = {
  step: ScanFlowStep
  /** Sheets that open over a still-live scanner without changing the step. */
  auxiliary: "none" | "search" | "wishlist"
  /**
   * How the search sheet was last opened. Kept as its own field rather than folded into
   * `auxiliary` so every existing `auxiliary` check (and the `data-scan-auxiliary`
   * attribute the Playwright spec reads) stays a plain string comparison. Only the
   * sheet's header depends on it; the search behind it is the same either way.
   */
  searchReason: ScanSearchReason
  saveOpen: boolean
  camera: ScanCameraState
  submitting: boolean
  submitError: string | null
  /** Bumped on every return to scanning; drives the `Scanner`'s `sessionEpoch`. */
  epoch: number
  activeRequest: { kind: "resolve" | "submit"; token: number } | null
  /**
   * What the resolve responses seen so far prove about the caller's tier (T9). Learned
   * from the response SHAPE only (`verdict-access.ts`) — the client never guesses an
   * entitlement — and it outlives the result step, because the Merken bookmark in the
   * scan header stays locked between scans.
   */
  tier: ScanTierSignal
  reveal: ScanRevealState
  /** The stub Premium sheet's opener context, or null while it is closed (T5/T9). */
  premiumSheet: PremiumSheetContext | null
}

export type ScanFlowAction =
  | { type: "resolve_started"; token: number; showResolvingImmediately: boolean }
  | { type: "resolving_sheet_due"; token: number }
  | { type: "resolved"; token: number; result: ScanClientResolveResult }
  | { type: "resolve_failed"; token: number }
  | { type: "reveal_started"; productId: string }
  | { type: "reveal_succeeded"; productId: string; alternatives: ScanAlternativePresentation[] }
  | { type: "reveal_failed"; productId: string; reason: "already_used" | "error" }
  | { type: "premium_sheet_opened"; context: PremiumSheetContext }
  | { type: "premium_sheet_closed" }
  | { type: "submit_started"; token: number }
  | { type: "submitted"; token: number; pending: ScanPendingSubmissionResult }
  | { type: "submit_failed"; token: number; error: string }
  | { type: "return_to_scanning" }
  | { type: "auxiliary_opened"; sheet: "search" | "wishlist"; searchReason?: ScanSearchReason }
  | { type: "auxiliary_closed" }
  | { type: "save_sheet_toggled"; open: boolean }
  | { type: "saved_state_changed"; productId: string; savedState: ScanSavedStatePayload }
  | { type: "camera_unavailable"; reason: ScanUnavailableReason }
  | { type: "camera_stalled" }
  | { type: "camera_retry" }
  | { type: "camera_live" }

export const initialScanFlowState: ScanFlowState = {
  step: { kind: "scanning" },
  auxiliary: "none",
  searchReason: "manual",
  saveOpen: false,
  camera: { status: "live" },
  submitting: false,
  submitError: null,
  epoch: 0,
  activeRequest: null,
  tier: "unknown",
  reveal: { status: "idle" },
  premiumSheet: null,
}

/**
 * Whether `action`'s token still owns the in-flight slot. The request KIND is compared
 * too, so a resolve response can never settle a submit (or vice versa) just because two
 * independently-counted guards handed out the same number.
 */
function owns(state: ScanFlowState, kind: "resolve" | "submit", token: number): boolean {
  return state.activeRequest?.kind === kind && state.activeRequest.token === token
}

/** Whether `productId` is still the product the result step is showing. */
function ownsResultProduct(state: ScanFlowState, productId: string): boolean {
  return state.step.kind === "result" && state.step.result.product.productId === productId
}

export function scanFlowReducer(state: ScanFlowState, action: ScanFlowAction): ScanFlowState {
  switch (action.type) {
    case "resolve_started":
      return {
        ...state,
        // A camera decode keeps the viewfinder (and its green confirm state) for the
        // 400ms window and only then raises the skeleton via `resolving_sheet_due`;
        // every other entry point shows it at once.
        step: action.showResolvingImmediately ? { kind: "resolving" } : state.step,
        // A resolve takes over the in-flight slot, so any submit that was still running
        // is structurally dead from here on and its terminal action will be dropped.
        // Clearing the busy flag with it is what keeps the `already_in_catalog` chain
        // (submit -> resolve) from leaving `submitting` stuck true forever.
        submitting: false,
        submitError: null,
        activeRequest: { kind: "resolve", token: action.token },
        // A new verdict is on its way: whatever the previous one revealed belongs to a
        // product that is about to leave the screen.
        reveal: { status: "idle" },
      }

    case "resolving_sheet_due":
      if (!owns(state, "resolve", action.token)) return state
      return { ...state, step: { kind: "resolving" } }

    case "resolved": {
      if (!owns(state, "resolve", action.token)) return state
      return {
        ...state,
        step: stepForResult(action.result),
        activeRequest: null,
        tier: nextScanTierSignal(state.tier, scanTierSignal(action.result)),
      }
    }

    case "reveal_started":
      if (!ownsResultProduct(state, action.productId)) return state
      return { ...state, reveal: { status: "pending", productId: action.productId } }

    case "reveal_succeeded":
      // Same guard as `saved_state_changed` (F5), for the same reason: a reveal that
      // resolves after the user scanned something else must not unblur the new card.
      if (!ownsResultProduct(state, action.productId)) return state
      return {
        ...state,
        reveal: {
          status: "revealed",
          productId: action.productId,
          alternatives: action.alternatives,
        },
      }

    case "reveal_failed":
      if (!ownsResultProduct(state, action.productId)) return state
      return {
        ...state,
        reveal:
          action.reason === "already_used"
            ? { status: "unavailable", productId: action.productId }
            : { status: "idle" },
      }

    case "premium_sheet_opened":
      return { ...state, premiumSheet: action.context }

    case "premium_sheet_closed":
      return { ...state, premiumSheet: null }

    case "resolve_failed":
      if (!owns(state, "resolve", action.token)) return state
      // Deliberately does NOT return to scanning: the component toasts first and then
      // dispatches `return_to_scanning`, mirroring today's order. Settling the request
      // here is what keeps a stale second failure from toasting again (F1's toast loop).
      return { ...state, activeRequest: null }

    case "submit_started":
      return {
        ...state,
        submitting: true,
        submitError: null,
        activeRequest: { kind: "submit", token: action.token },
      }

    case "submitted":
      if (!owns(state, "submit", action.token)) return state
      return {
        ...state,
        step: { kind: "pending", pending: action.pending },
        submitting: false,
        submitError: null,
        activeRequest: null,
      }

    case "submit_failed":
      if (!owns(state, "submit", action.token)) return state
      // The unknown sheet stays open so the user can correct and retry (F17).
      return {
        ...state,
        submitting: false,
        submitError: action.error,
        activeRequest: null,
      }

    case "return_to_scanning":
      // The single way back. `submitting` is cleared here because a submission the user
      // dismissed mid-flight has its terminal action dropped by the token guard, so
      // nothing else would ever unstick the busy flag.
      return {
        ...state,
        step: { kind: "scanning" },
        saveOpen: false,
        submitting: false,
        submitError: null,
        activeRequest: null,
        epoch: state.epoch + 1,
        reveal: { status: "idle" },
        premiumSheet: null,
      }

    case "auxiliary_opened":
      // Can't happen today (both triggers are only reachable on the scanning step); kept
      // as an invariant so a search sheet can never hide behind a result sheet.
      if (state.step.kind !== "scanning") return state
      return {
        ...state,
        auxiliary: action.sheet,
        // A reopen with no stated reason keeps the deliberate one: only the timeout and
        // the camera failure open this sheet on the user's behalf, and both say so.
        searchReason:
          action.sheet === "search" ? (action.searchReason ?? "manual") : state.searchReason,
      }

    case "auxiliary_closed":
      return { ...state, auxiliary: "none" }

    case "save_sheet_toggled":
      return { ...state, saveOpen: action.open }

    case "saved_state_changed":
      // F5: the completion must name the product it belongs to. A save that resolves
      // after the user scanned something else is simply dropped.
      if (state.step.kind !== "result") return state
      if (state.step.result.product.productId !== action.productId) return state
      return {
        ...state,
        step: { kind: "result", result: { ...state.step.result, savedState: action.savedState } },
      }

    case "camera_unavailable":
      return { ...state, camera: { status: "unavailable", reason: action.reason } }

    case "camera_stalled":
      return { ...state, camera: { status: "stalled" } }

    case "camera_retry":
    case "camera_live":
      return { ...state, camera: { status: "live" } }
  }
}

function stepForResult(result: ScanClientResolveResult): ScanFlowStep {
  if (result.kind === "unknown_product") return { kind: "unknown", unknown: result }
  if (result.kind === "pending_submission") return { kind: "pending", pending: result }
  return { kind: "result", result }
}

/** A step sheet covers the viewfinder. Auxiliary sheets do not change the step. */
export function isSheetOpen(state: ScanFlowState): boolean {
  return state.step.kind !== "scanning"
}

/**
 * Any open surface pauses the DETECTION LOOP (never the camera stream): decoding behind
 * a sheet burns battery on frames nobody can aim, and a read that lands there would be
 * discarded anyway.
 */
export function isDetectionPaused(state: ScanFlowState): boolean {
  return (
    isSheetOpen(state) ||
    state.auxiliary !== "none" ||
    state.saveOpen ||
    state.premiumSheet !== null
  )
}

/**
 * The alternatives the result step should render, and how. `revealed` only ever applies
 * to the product the reveal was spent on; every other case falls back to whatever the
 * resolve response itself carried, so a premium (or flag-off) verdict is untouched.
 */
export function scanRevealedAlternatives(
  state: ScanFlowState,
): ScanAlternativePresentation[] | null {
  if (state.step.kind !== "result") return null
  if (state.reveal.status !== "revealed") return null
  if (state.reveal.productId !== state.step.result.product.productId) return null
  return state.reveal.alternatives
}
