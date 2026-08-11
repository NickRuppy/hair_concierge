export const PERSONAL_PLAN_READY_POLL_INTERVAL_MS = 1_500
export const PERSONAL_PLAN_READY_POLL_LIMIT = 20

export type PersonalPlanReadinessPhase = "checking" | "ready" | "timeout" | "error"

export function canContinueToPersonalPlan(readiness: PersonalPlanReadinessPhase): boolean {
  return readiness === "ready"
}
