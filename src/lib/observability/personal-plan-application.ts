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
  setLevel(level: "error"): void
  setTag(key: string, value: string): void
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
