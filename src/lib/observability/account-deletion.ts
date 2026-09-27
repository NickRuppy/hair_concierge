import * as Sentry from "@sentry/nextjs"

/**
 * External cleanup of a deleted account keeps failing (storage, Customer.io or PostHog).
 * Only the step's machine code and the attempt count are reported — never the request id,
 * user id or email. Follows `app-store.ts`'s idiom (tags + context, injectable sink).
 */

type ScopeLike = {
  setContext(name: string, context: Record<string, unknown>): void
  setLevel?(level: "warning" | "error"): void
  setTag(key: string, value: string): void
}

export type AccountDeletionFailureSink = {
  captureException(error: unknown): void
  withScope(callback: (scope: ScopeLike) => void): void
}

const MACHINE_CODE = /^[a-z][a-z0-9_]{0,63}$/

/** Never throws: telemetry must not change the cleanup's outcome. */
export function reportAccountDeletionCleanupFailure(
  details: { errorCode: string; attempts: number },
  sink: AccountDeletionFailureSink = Sentry,
): void {
  try {
    const errorCode = MACHINE_CODE.test(details.errorCode) ? details.errorCode : "unknown"
    sink.withScope((scope) => {
      scope.setLevel?.("error")
      scope.setTag("account_deletion.error_code", errorCode)
      scope.setContext("account_deletion_cleanup", {
        error_code: errorCode,
        attempts: details.attempts,
      })
      sink.captureException(new Error("account_deletion_external_cleanup_failed"))
    })
  } catch {
    /* Telemetry is best effort. */
  }
}
