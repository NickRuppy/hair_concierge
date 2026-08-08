export type RoutineTransitionRpc = (
  name:
    | "personal_plan_stage_routine_successor"
    | "personal_plan_record_routine_no_semantic_change"
    | "personal_plan_confirm_routine_proposal"
    | "personal_plan_reject_routine_proposal",
  args: Record<string, unknown>,
) => Promise<{ data: unknown; error: unknown | null }>

export function transitionOutcome(raw: unknown): Record<string, unknown> | null {
  return raw &&
    typeof raw === "object" &&
    typeof (raw as Record<string, unknown>).outcome === "string"
    ? (raw as Record<string, unknown>)
    : null
}

export function numberField(value: Record<string, unknown>, field: string): number | null {
  const result = value[field]
  return typeof result === "number" && Number.isInteger(result) && result >= 0 ? result : null
}
