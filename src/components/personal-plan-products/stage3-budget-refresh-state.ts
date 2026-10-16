import type { Stage3BootstrapBudgetEnvelope } from "@/lib/personal-plan/products/gateway"
import type { ShoppingBudget } from "@/lib/user-facts/schema"
import type { Stage3BudgetSaveStatus } from "./stage3-budget-step"

type BudgetAuthority =
  | { status: "optional"; suggestion: 5 | 15 | null }
  | { status: "required"; suggestion: 5 | 15 | null }
  | { status: "saved"; value: ShoppingBudget; suggestion: 5 | 15 | null }
type ReviewPurpose = "entry" | "post_save"

export type Stage3BudgetRefreshState = {
  authority: BudgetAuthority
  save:
    | { status: "idle" }
    | { status: "saving"; request: number }
    | { status: "failed"; reason: "conflict" | "unavailable" }
  primary:
    | { status: "idle" | "ready" }
    | { status: "loading" | "failed"; request: number; purpose: ReviewPurpose }
  projection:
    | { status: "idle" }
    | { status: "loading" | "failed"; request: number; blocking: boolean }
  /** The sole admission identity, including invalidation and effect cleanup. */
  sequence: number
  active: boolean
}

export type Stage3BudgetRefreshEvent =
  | { type: "envelope"; envelope: Stage3BootstrapBudgetEnvelope | null | undefined }
  | { type: "save_requested" }
  | { type: "save_saved"; request: number; value: ShoppingBudget }
  | { type: "save_failed"; request: number; reason: "conflict" | "unavailable" }
  | { type: "save_reset" }
  | { type: "primary_requested"; purpose: ReviewPurpose }
  | { type: "primary_accepted" | "primary_failed"; request: number }
  | { type: "projection_requested"; blocking: boolean }
  | { type: "projection_accepted" | "projection_failed"; request: number }
  | { type: "invalidated"; captureReopened?: boolean }
  | { type: "primary_bypassed" }
  | { type: "activated" | "disposed" }

export function initialStage3BudgetRefreshState(input: {
  initialEnvelope?: Stage3BootstrapBudgetEnvelope | null
  primaryReady?: boolean
}): Stage3BudgetRefreshState {
  const initial: Stage3BudgetRefreshState = {
    authority: { status: "optional", suggestion: null },
    save: { status: "idle" },
    primary: { status: input.primaryReady ? "ready" : "idle" },
    projection: { status: "idle" },
    sequence: 0,
    active: true,
  }
  return stage3BudgetRefreshReducer(initial, { type: "envelope", envelope: input.initialEnvelope })
}

export function stage3BudgetRefreshReducer(
  state: Stage3BudgetRefreshState,
  event: Stage3BudgetRefreshEvent,
): Stage3BudgetRefreshState {
  if ("request" in event && (!state.active || event.request !== state.sequence)) return state
  switch (event.type) {
    case "envelope": {
      const envelope = event.envelope
      if (envelope === undefined) return state
      if (envelope === null) {
        return state.authority.status === "required"
          ? { ...state, authority: { ...state.authority, status: "optional" } }
          : state
      }
      return {
        ...state,
        authority:
          envelope.status === "saved"
            ? { status: "saved", value: envelope.value, suggestion: state.authority.suggestion }
            : { status: "required", suggestion: envelope.suggestion },
      }
    }
    case "save_requested":
      return {
        ...state,
        sequence: state.sequence + 1,
        save: { status: "saving", request: state.sequence + 1 },
        projection: { status: "idle" },
      }
    case "save_saved":
      return {
        ...state,
        authority: { status: "saved", value: event.value, suggestion: state.authority.suggestion },
        save: { status: "idle" },
        primary: { status: "loading", purpose: "post_save", request: event.request },
      }
    case "save_failed":
      return { ...state, save: { status: "failed", reason: event.reason } }
    case "save_reset":
      return state.save.status === "failed" ? { ...state, save: { status: "idle" } } : state
    case "primary_requested":
      return {
        ...state,
        sequence: state.sequence + 1,
        primary: { status: "loading", purpose: event.purpose, request: state.sequence + 1 },
        save: { status: "idle" },
      }
    case "primary_accepted":
      return {
        ...state,
        primary: { status: "ready" },
        save: { status: "idle" },
        projection: { status: "idle" },
      }
    case "primary_failed":
      return state.primary.status === "loading"
        ? { ...state, primary: { ...state.primary, status: "failed" }, save: { status: "idle" } }
        : state
    case "projection_requested":
      return {
        ...state,
        sequence: state.sequence + 1,
        projection: { status: "loading", blocking: event.blocking, request: state.sequence + 1 },
        save: { status: "idle" },
        primary:
          state.primary.status === "loading"
            ? { ...state.primary, status: "failed" }
            : state.primary,
      }
    case "projection_accepted":
      return { ...state, projection: { status: "idle" } }
    case "projection_failed":
      return state.projection.status === "loading" && state.projection.blocking
        ? { ...state, projection: { ...state.projection, status: "failed" } }
        : { ...state, projection: { status: "idle" } }
    case "primary_bypassed":
      return {
        ...state,
        sequence: state.sequence + 1,
        primary: { status: "ready" },
        projection: { status: "idle" },
        save: { status: "idle" },
      }
    case "invalidated":
    case "disposed":
      return {
        ...state,
        sequence: state.sequence + 1,
        active: event.type === "disposed" ? false : state.active,
        save: { status: "idle" },
        primary:
          event.type === "invalidated" && event.captureReopened
            ? { status: "idle" }
            : state.primary.status === "loading"
              ? { ...state.primary, status: "failed" }
              : state.primary,
        projection: { status: "idle" },
      }
    case "activated":
      return { ...state, active: true }
  }
}

export function stage3BudgetRefreshView(state: Stage3BudgetRefreshState) {
  const needsBudgetRefresh =
    state.authority.status === "saved" &&
    (state.primary.status === "loading" || state.primary.status === "failed") &&
    state.primary.purpose === "post_save"
  const budgetSaveStatus: Stage3BudgetSaveStatus =
    state.save.status === "saving" || (needsBudgetRefresh && state.primary.status === "loading")
      ? "saving"
      : state.save.status === "failed"
        ? state.save.reason
        : "idle"
  const budgetPreviewStatus =
    state.projection.status !== "idle" && state.projection.blocking
      ? state.projection.status
      : "idle"
  return {
    authority: state.authority,
    savedBudget: state.authority.status === "saved" ? state.authority.value : null,
    budgetRequired: state.authority.status === "required",
    budgetSuggestion: state.authority.suggestion,
    budgetSaveStatus,
    authorityStatus:
      state.primary.status === "failed" ? ("loading" as const) : state.primary.status,
    budgetPreviewStatus,
    budgetPreviewBlocked: budgetPreviewStatus !== "idle",
    needsBudgetRefresh,
  }
}
