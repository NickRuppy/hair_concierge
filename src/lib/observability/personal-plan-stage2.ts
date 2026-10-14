import * as Sentry from "@sentry/nextjs"

export type Stage2UnexpectedErrorRoute =
  | "stage2_access"
  | "stage2_load_or_save"
  | "stage2_completion_after_save"
  | "stage2_optional_entry_access"
  | "stage2_optional_entry"

interface Stage2ScopeLike {
  setTag(key: string, value: string): void
  setContext(name: string, context: Record<string, unknown>): void
}

interface Stage2SentrySink {
  captureException(error: unknown): void
  withScope(callback: (scope: Stage2ScopeLike) => void): void
}

export type Stage2UnexpectedErrorLabel = {
  route: Stage2UnexpectedErrorRoute
  error_name: string
  code?: string
  reason?: string
}

/** Persistence wrappers throw fixed snake_case codes (`stage2_draft_read_failed`, …). */
const CODE_LIKE_MESSAGE = /^[a-z][a-z0-9_]{2,80}$/

/**
 * The sanitized label of an unexpected Stage-2 failure: the error class, a string `code`
 * (Postgres SQLSTATE / PostgREST code) when present, and a `reason` — the message only when it is
 * a fixed snake_case code. Never a free-text message: repository readers put the user id into
 * theirs (see `src/lib/user-facts/read.ts`).
 */
export function stage2UnexpectedErrorLabel(
  route: Stage2UnexpectedErrorRoute,
  error: unknown,
): Stage2UnexpectedErrorLabel {
  const code = (error as { code?: unknown } | null)?.code
  const message = error instanceof Error ? error.message : ""
  const reason = CODE_LIKE_MESSAGE.test(message) ? message : undefined
  return {
    route,
    error_name: error instanceof Error ? error.name : typeof error,
    ...(typeof code === "string" ? { code } : {}),
    ...(reason ? { reason } : {}),
  }
}

/**
 * Reports a Stage-2 failure the route turns into a generic `temporarily_unavailable`, so the
 * cause shows up in the Vercel log and in Sentry instead of disappearing (2026-10-05: a missing
 * column hid behind exactly that response for every legacy member opening the Feinschliff).
 */
export function reportUnexpectedStage2Error(
  route: Stage2UnexpectedErrorRoute,
  error: unknown,
  sink: Stage2SentrySink = Sentry,
) {
  const label = stage2UnexpectedErrorLabel(route, error)
  console.error("personal_plan_stage2_unexpected_error", label)
  const diagnostic = new Error(
    ["personal_plan_stage2_unexpected_error", route, label.error_name, label.code, label.reason]
      .filter(Boolean)
      .join(":"),
  )
  diagnostic.name = "PersonalPlanStage2UnexpectedError"
  sink.withScope((scope) => {
    scope.setTag("stage2.route", route)
    scope.setTag("stage2.error_name", label.error_name)
    scope.setContext("stage2", label)
    sink.captureException(diagnostic)
  })
}
