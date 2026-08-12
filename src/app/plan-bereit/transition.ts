export const PERSONAL_PLAN_READY_POLL_INTERVAL_MS = 1_500
export const PERSONAL_PLAN_READY_POLL_LIMIT = 20

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
