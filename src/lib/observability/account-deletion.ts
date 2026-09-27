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

export type DeletedAccountBillingReport = {
  provider: "stripe" | "paypal"
  /** Webhook event type that surfaced the live subscription (a machine string). */
  eventType: string
}

/**
 * A live provider subscription surfaced for an account that was already deleted (e.g. a
 * checkout approved before deletion that activated after it) and was cancelled
 * immediately (A1). Only the provider and event type are reported — never ids or email.
 */
export function reportDeletedAccountSubscriptionCancelled(
  details: DeletedAccountBillingReport,
  sink: AccountDeletionFailureSink = Sentry,
): void {
  try {
    const eventType = /^[a-zA-Z0-9._-]{1,80}$/.test(details.eventType)
      ? details.eventType
      : "unknown"
    sink.withScope((scope) => {
      scope.setLevel?.("warning")
      scope.setTag("account_deletion.provider", details.provider)
      scope.setTag("account_deletion.event_type", eventType)
      scope.setContext("account_deletion_billing", {
        provider: details.provider,
        event_type: eventType,
      })
      sink.captureException(new Error("account_deletion_live_subscription_cancelled"))
    })
  } catch {
    /* Telemetry is best effort. */
  }
}

/** A table the retention purge could not clean this run (machine table name only). */
export function reportAccountDeletionPurgeFailure(
  details: { table: string },
  sink: AccountDeletionFailureSink = Sentry,
): void {
  try {
    const table = /^(public|private)\.[a-z0-9_]{1,80}$/.test(details.table)
      ? details.table
      : "unknown"
    sink.withScope((scope) => {
      scope.setLevel?.("error")
      scope.setTag("account_deletion.purge_table", table)
      scope.setContext("account_deletion_purge", { table })
      sink.captureException(new Error("account_deletion_purge_failed"))
    })
  } catch {
    /* Telemetry is best effort. */
  }
}
