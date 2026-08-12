import * as Sentry from "@sentry/nextjs"

export type PersonalPlanApplicationFailureReason =
  | "database"
  | "schema_contract"
  | "missing_protocol"
  | "incomplete_guidance"
  | "unknown"

export type PersonalPlanApplicationFailureDetails = {
  reason: PersonalPlanApplicationFailureReason
  durationMs: number
  planId?: string
  routineVersionId?: string
  refinedVersionId?: string
}

type Scope = {
  setContext(name: string, context: Record<string, unknown>): void
  setFingerprint(value: string[]): void
  setLevel(level: "error" | "warning"): void
  setTag(key: string, value: string): void
}

export type PersonalPlanRoutineTerminalSourceDetails = {
  planId: string
  sourceKind: string
  observedRevision: number
  terminalCode: `terminal_${string}`
}

export type PersonalPlanApplicationSentrySink = {
  captureException(error: unknown): void
  withScope(callback: (scope: Scope) => void): void
}

/**
 * Stage 5 only emits stable operational metadata. In particular, product
 * names, protocol copy, instructions, and the refined profile never leave the
 * request boundary through this event.
 */
export function capturePersonalPlanApplicationFailure(
  details: PersonalPlanApplicationFailureDetails,
  sink: PersonalPlanApplicationSentrySink = Sentry,
) {
  const context: Record<string, unknown> = {
    reason: details.reason,
    duration_ms: Math.max(0, Math.round(details.durationMs)),
  }
  if (details.planId) context.plan_id = details.planId
  if (details.routineVersionId) context.routine_version_id = details.routineVersionId
  if (details.refinedVersionId) context.refined_version_id = details.refinedVersionId

  sink.withScope((scope) => {
    scope.setFingerprint(["personal-plan-application-failure", details.reason])
    scope.setLevel("error")
    scope.setTag("personal_plan.stage", "application")
    scope.setTag("personal_plan.failure_reason", details.reason)
    scope.setContext("personal_plan_application", context)
    // Do not forward a caught database/Zod error: either can contain raw data.
    sink.captureException(new Error("personal_plan_application_unavailable"))
  })
}

/**
 * Terminal Routine-source events contain no product identity or user-authored
 * content. The durable outbox row remains the detailed operator ledger.
 */
export function capturePersonalPlanRoutineTerminalSource(
  details: PersonalPlanRoutineTerminalSourceDetails,
  sink: PersonalPlanApplicationSentrySink = Sentry,
) {
  if (details.terminalCode === "terminal_refinement_pending_stage3") return
  sink.withScope((scope) => {
    scope.setFingerprint(["personal-plan-routine-terminal-source", details.terminalCode])
    scope.setLevel("warning")
    scope.setTag("personal_plan.stage", "routine")
    scope.setTag("personal_plan.terminal_code", details.terminalCode)
    scope.setContext("personal_plan_routine_source", {
      plan_id: details.planId,
      source_kind: details.sourceKind,
      observed_revision: details.observedRevision,
      terminal_code: details.terminalCode,
    })
    sink.captureException(new Error("personal_plan_routine_source_terminalized"))
  })
}
