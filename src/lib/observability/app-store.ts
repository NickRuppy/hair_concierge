import * as Sentry from "@sentry/nextjs"

/**
 * App Store webhook failures that make Apple retry (HTTP 503). Only the error's class
 * name, a known machine code, the notification type and the environment are reported:
 * never the signed payload, transaction IDs, account tokens or raw error messages.
 * Follows `free-registration.ts`'s idiom (tags + context, injectable sink).
 */

export type AppStoreFailureStage = "verify" | "record"

export type AppStoreFailureDetails = {
  stage: AppStoreFailureStage
  notificationType?: string | null
  environment?: string | null
}

type ScopeLike = {
  setContext(name: string, context: Record<string, unknown>): void
  setLevel?(level: "warning" | "error"): void
  setTag(key: string, value: string): void
}

export type AppStoreFailureSink = {
  captureException(error: unknown): void
  withScope(callback: (scope: ScopeLike) => void): void
}

const MACHINE_CODE = /^[a-z][a-z0-9_]{0,63}$/

/** A code only when it is one of our own machine codes, never free-form text. */
function errorCode(error: unknown): string | null {
  if (!(error instanceof Error)) return null
  const code = (error as { code?: unknown }).code
  if (typeof code === "string" && MACHINE_CODE.test(code)) return code
  return MACHINE_CODE.test(error.message) ? error.message : null
}

/** Never throws: telemetry must not change the webhook's answer. */
export function reportAppStoreNotificationFailure(
  error: unknown,
  details: AppStoreFailureDetails,
  sink: AppStoreFailureSink = Sentry,
): void {
  try {
    const context: Record<string, unknown> = {
      stage: details.stage,
      error_name: error instanceof Error ? error.name : typeof error,
      error_code: errorCode(error),
      notification_type: details.notificationType ?? null,
      environment: details.environment ?? null,
    }
    sink.withScope((scope) => {
      scope.setLevel?.("error")
      scope.setTag("app_store.stage", details.stage)
      if (details.notificationType)
        scope.setTag("app_store.notification_type", details.notificationType)
      if (details.environment) scope.setTag("app_store.environment", details.environment)
      scope.setContext("app_store_notification", context)
      sink.captureException(new Error(`app_store_notification_${details.stage}_failed`))
    })
  } catch {
    /* Telemetry is best effort. */
  }
}
