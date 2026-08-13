export const PERSONAL_PLAN_READY_POLL_INTERVAL_MS = 1_500
export const PERSONAL_PLAN_READY_POLL_LIMIT = 20

export type PersonalPlanReadyPollAction = "link" | "poll"

export type PersonalPlanReadyPollRequestState = {
  action: PersonalPlanReadyPollAction
  linkAttempted: boolean
}

export function createPersonalPlanReadyPollRequestState(
  action: PersonalPlanReadyPollAction,
): PersonalPlanReadyPollRequestState {
  return { action, linkAttempted: false }
}

export function takePersonalPlanReadyPollRequest(
  state: PersonalPlanReadyPollRequestState,
): { method: "GET" | "POST"; nextState: PersonalPlanReadyPollRequestState } {
  if (state.action === "link" && !state.linkAttempted) {
    return {
      method: "POST",
      nextState: { ...state, linkAttempted: true },
    }
  }
  return { method: "GET", nextState: state }
}

export function applyPersonalPlanReadyPollResponse(
  nextAction: PersonalPlanReadyPollAction | "none" | undefined,
): PersonalPlanReadyPollRequestState {
  if (nextAction === "link") {
    return { action: "link", linkAttempted: false }
  }
  return { action: "poll", linkAttempted: false }
}

export type PersonalPlanReadinessPhase =
  | "checking"
  | "paid_pending"
  | "source_pending"
  | "missing_source_facts"
  | "ready"
  | "invalid_source"
  | "forbidden"
  | "transient_error"
  | "timeout"

export function canContinueToPersonalPlan(readiness: PersonalPlanReadinessPhase): boolean {
  return readiness === "ready"
}
