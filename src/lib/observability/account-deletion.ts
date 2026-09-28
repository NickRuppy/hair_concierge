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

/**
 * A pro-rata (D14) or post-deletion (R-a) refund of a web subscription keeps failing, or
 * ended in manual review. Only provider, machine code, attempts and whether it is terminal
 * are reported — never subscription, payment, request or user ids.
 */
export function reportAccountDeletionRefundFailure(
  details: { provider: "stripe" | "paypal"; errorCode: string; attempts: number; manual: boolean },
  sink: AccountDeletionFailureSink = Sentry,
): void {
  try {
    const errorCode = MACHINE_CODE.test(details.errorCode) ? details.errorCode : "unknown"
    sink.withScope((scope) => {
      scope.setLevel?.("error")
      scope.setTag("account_deletion.provider", details.provider)
      scope.setTag("account_deletion.error_code", errorCode)
      scope.setTag("account_deletion.refund_manual", details.manual ? "true" : "false")
      scope.setContext("account_deletion_refund", {
        provider: details.provider,
        error_code: errorCode,
        attempts: details.attempts,
        manual: details.manual,
      })
      sink.captureException(
        new Error(
          details.manual
            ? "account_deletion_refund_needs_manual_review"
            : "account_deletion_refund_failed",
        ),
      )
    })
  } catch {
    /* Telemetry is best effort. */
  }
}

/**
 * N4: due refunds that have waited on a still pending provider payment for more than 14 days
 * since they were recorded. Once per run with the count only — no ids.
 */
export function reportAccountDeletionRefundWaiting(
  details: { waiting: number },
  sink: AccountDeletionFailureSink = Sentry,
): void {
  try {
    sink.withScope((scope) => {
      scope.setLevel?.("warning")
      scope.setTag("account_deletion.code", "refund_waiting_on_pending_payment")
      scope.setContext("account_deletion_refund_waiting", {
        code: "refund_waiting_on_pending_payment",
        waiting: details.waiting,
      })
      sink.captureException(new Error("account_deletion_refund_waiting_on_pending_payment"))
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

/**
 * N2: a live subscription of a deleted account was cancelled, but its full refund (R-a) was
 * not recorded because the subscription already has a deletion refund row it may not take
 * over (e.g. one that paid something out). An operator checks for a missed charge. Only the
 * provider, event type and the existing row's kind are reported — never ids or email.
 */
export function reportPostDeletionRefundNotRecorded(
  details: DeletedAccountBillingReport & { existingKind: "deletion" | "none" },
  sink: AccountDeletionFailureSink = Sentry,
): void {
  try {
    const eventType = /^[a-zA-Z0-9._-]{1,80}$/.test(details.eventType)
      ? details.eventType
      : "unknown"
    const existingKind = details.existingKind === "deletion" ? "deletion" : "none"
    sink.withScope((scope) => {
      scope.setLevel?.("error")
      scope.setTag("account_deletion.provider", details.provider)
      scope.setTag("account_deletion.event_type", eventType)
      scope.setTag("account_deletion.existing_refund_kind", existingKind)
      scope.setContext("account_deletion_post_deletion_refund", {
        provider: details.provider,
        event_type: eventType,
        existing_refund_kind: existingKind,
      })
      sink.captureException(new Error("account_deletion_post_deletion_refund_not_recorded"))
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

/**
 * An open deletion whose account vanished by another path was closed before the routine
 * cancelled web billing (`requested`): an operator must check for a still billing provider
 * subscription. Only the machine code and the prior state are reported — no ids or email.
 */
export function reportAccountDeletionOrphanClosed(
  details: { priorState: "requested" | "web_billing_cancelled" },
  sink: AccountDeletionFailureSink = Sentry,
): void {
  try {
    sink.withScope((scope) => {
      scope.setLevel?.("warning")
      scope.setTag("account_deletion.code", "orphan_closed_before_billing_cancel")
      scope.setTag("account_deletion.prior_state", details.priorState)
      scope.setContext("account_deletion_orphan", {
        code: "orphan_closed_before_billing_cancel",
        prior_state: details.priorState,
      })
      sink.captureException(new Error("account_deletion_orphan_closed_before_billing_cancel"))
    })
  } catch {
    /* Telemetry is best effort. */
  }
}
