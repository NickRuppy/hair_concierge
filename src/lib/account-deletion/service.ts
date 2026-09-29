import "server-only"

/**
 * Account deletion state machine over private.account_deletion_operations (iOS paywall
 * Task 6): requested → web_billing_cancelled → data_deleted → external_cleanup_done.
 *
 * 1. D14: every live web subscription (Stripe/PayPal) is recorded, then cancelled
 *    immediately. A failure keeps the account and the state `requested`; the same request
 *    id retries safely. Marking billing cancelled makes the recorded pro-rata refunds due.
 * 2. `delete_account_data` runs the one-transaction data routine (private.delete_account).
 * 3. Storage photos, the Customer.io person and the PostHog person + events are removed.
 *    A failure leaves `data_deleted`; the cron retries until `external_cleanup_done` and
 *    reports to Sentry from the 5th failed attempt. The account is gone after step 2.
 * 4. The due refunds (unused prepaid time, pro rata) are settled after the response (the
 *    route defers the first attempt) and by the cron; a failure never blocks the deletion.
 *    Sentry from the 5th failed attempt; the 10th failure or a permanent provider error ends
 *    in `failed_manual` (one report). Post-deletion subscriptions (R-a) share the table and
 *    are refunded in full.
 */

export type AccountDeletionState =
  | "requested"
  | "web_billing_cancelled"
  | "data_deleted"
  | "external_cleanup_done"

export type AccountDeletionErrorCode =
  | "request_id_conflict"
  | "account_not_found"
  | "admin_account"
  | "web_billing_cancel_failed"
  | "deletion_failed"

export class AccountDeletionError extends Error {
  constructor(readonly code: AccountDeletionErrorCode) {
    super(code)
    this.name = "AccountDeletionError"
  }
}

/** A cleanup step failure with a machine code (stored, reported; never the account). */
export class AccountDeletionCleanupError extends Error {
  constructor(readonly code: "storage_failed" | "customerio_failed" | "posthog_failed") {
    super(code)
    this.name = "AccountDeletionCleanupError"
  }
}

export type WebSubscription = { provider: "stripe" | "paypal"; id: string }

/** A cancelled web subscription whose refund is still to settle. */
export type WebRefundDue = {
  provider: WebSubscription["provider"]
  subscriptionId: string
  /** The deletion request that cancelled it, or a random id (idempotency key source). */
  requestId: string
  /** `deletion`: pro rata (D14). `post_deletion`: surfaced after deletion, full (R-a). */
  kind: "deletion" | "post_deletion"
  /** When the current request recorded it (M6). */
  recordedAt: string
  /** post_deletion: only payments at/after this time (the account's deletion) are refunded. */
  paymentsFrom: string | null
  attempts: number
  /** The refund last requested from the provider (recognises our own refund on a retry). */
  plannedMinor: number | null
  plannedPaymentRef: string | null
}

/** 0 = nothing to refund (trial, never billed, period over, refunded by someone else). */
export type WebRefundOutcome = { refundedMinor: number; paymentRef: string | null }

export type WebRefundHooks = {
  /** Stores the refund about to be requested before the provider call. */
  plan(input: { amountMinor: number; paymentRef: string }): Promise<void>
}

/** A payment in scope is still pending: the refund stays due without counting an attempt. */
export class AccountDeletionRefundPendingError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "AccountDeletionRefundPendingError"
  }
}

/** A provider refusal no retry can fix (disputed charge, unsupported payment): manual review. */
export class AccountDeletionRefundManualError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "AccountDeletionRefundManualError"
  }
}

export type AccountDeletionTarget = {
  requestId: string
  userId: string
  email: string | null
  storagePaths: string[]
  externalAttempts: number
}

type RpcResult = { data: unknown; error: { message?: string } | null }

export type AccountDeletionDeps = {
  rpc(name: string, args: Record<string, unknown>): PromiseLike<RpcResult>
  /** Live or possibly-live web subscriptions of the account (provider verifies). */
  listWebSubscriptions(userId: string): Promise<WebSubscription[]>
  /** Cancels immediately without proration; a no-op when already ended. Throws on failure. */
  cancelWebSubscription(subscription: WebSubscription): Promise<void>
  /** Refunds per `refund.kind` (pro rata / full). Throws on failure. */
  refundWebSubscription(refund: WebRefundDue, hooks: WebRefundHooks): Promise<WebRefundOutcome>
  removeStorageObjects(paths: string[]): Promise<void>
  deleteCustomerIoPerson(identifier: string, messageId: string): Promise<void>
  deletePostHogPerson(distinctId: string): Promise<void>
  reportCleanupFailure(details: { errorCode: string; attempts: number }): void
  reportRefundFailure(details: {
    provider: WebSubscription["provider"]
    errorCode: string
    attempts: number
    manual: boolean
  }): void
  /** N4: refunds still waiting on a pending payment long after they were recorded. */
  reportRefundWaiting(details: { waiting: number }): void
}

export const ACCOUNT_DELETION_SENTRY_THRESHOLD = 5

/** N4: a refund waiting on a pending payment this long is reported (no state change). */
export const ACCOUNT_DELETION_REFUND_WAITING_REPORT_MS = 14 * 86_400_000

const RPC_ERRORS: AccountDeletionErrorCode[] = [
  "request_id_conflict",
  "account_not_found",
  "admin_account",
]

async function call(deps: AccountDeletionDeps, name: string, args: Record<string, unknown>) {
  const result = await deps.rpc(name, args)
  if (result.error) {
    const message = result.error.message ?? ""
    throw new AccountDeletionError(
      RPC_ERRORS.find((code) => message.includes(code)) ?? "deletion_failed",
    )
  }
  return result.data as Record<string, unknown>
}

function state(value: unknown): AccountDeletionState {
  const s = (value as { state?: unknown } | null)?.state
  if (
    s === "requested" ||
    s === "web_billing_cancelled" ||
    s === "data_deleted" ||
    s === "external_cleanup_done"
  )
    return s
  throw new AccountDeletionError("deletion_failed")
}

export async function requestAccountDeletion(
  input: { userId: string; requestId: string },
  deps: AccountDeletionDeps,
): Promise<{ state: AccountDeletionState }> {
  const args = { p_user_id: input.userId, p_request_id: input.requestId }
  let current = state(await call(deps, "account_deletion_begin", args))

  if (current === "requested") {
    try {
      const subscriptions = await deps.listWebSubscriptions(input.userId)
      // Recorded before cancelling, so no refund is lost to a failure after the cancel.
      if (subscriptions.length)
        await call(deps, "account_deletion_record_web_subscriptions", {
          p_request_id: input.requestId,
          p_subscriptions: subscriptions,
        })
      for (const subscription of subscriptions) await deps.cancelWebSubscription(subscription)
    } catch {
      throw new AccountDeletionError("web_billing_cancel_failed")
    }
    current = state(
      await call(deps, "account_deletion_mark_billing_cancelled", {
        p_request_id: input.requestId,
      }),
    )
  }
  if (current === "web_billing_cancelled")
    current = state(await call(deps, "delete_account_data", args))
  if (current === "data_deleted") {
    const [target] = await pendingCleanup(deps, { requestId: input.requestId, limit: 1 })
    if (target) current = await runExternalCleanup(target, deps)
  }
  return { state: current }
}

/** State only (response-loss recovery); null for an unknown request id. */
export async function getAccountDeletionStatus(
  requestId: string,
  deps: Pick<AccountDeletionDeps, "rpc">,
): Promise<AccountDeletionState | null> {
  const result = await deps.rpc("account_deletion_status", { p_request_id: requestId })
  if (result.error) throw new AccountDeletionError("deletion_failed")
  return result.data === null ? null : state({ state: result.data })
}

/** Cron: resume external cleanup of deleted accounts. */
export async function retryAccountDeletionCleanup(deps: AccountDeletionDeps, limit = 20) {
  const targets = await pendingCleanup(deps, { limit })
  let completed = 0
  for (const target of targets)
    if ((await runExternalCleanup(target, deps)) === "external_cleanup_done") completed += 1
  return { pending: targets.length, completed, failed: targets.length - completed }
}

/** Cron: settle the due refunds of cancelled web subscriptions. */
export async function retryAccountDeletionWebRefunds(deps: AccountDeletionDeps, limit = 20) {
  return settleWebRefunds(deps, { limit })
}

/** First attempt for one request, deferred after the response (never awaited by the app). */
export async function settleAccountDeletionWebRefunds(
  deps: AccountDeletionDeps,
  requestId: string,
) {
  return settleWebRefunds(deps, { requestId, limit: 10 })
}

async function settleWebRefunds(
  deps: AccountDeletionDeps,
  input: { requestId?: string; limit: number },
) {
  const due = (await call(deps, "account_deletion_due_web_refunds", {
    p_limit: input.limit,
    p_request_id: input.requestId ?? null,
  })) as unknown as WebRefundDue[]
  let completed = 0
  let manual = 0
  let waiting = 0
  let staleWaiting = 0
  for (const refund of due ?? []) {
    // N3: plan/result/waiting only ever touch the row of the request that listed it as due.
    const key = {
      p_provider: refund.provider,
      p_subscription_id: refund.subscriptionId,
      p_request_id: refund.requestId,
    }
    let outcome: WebRefundOutcome | null = null
    try {
      outcome = await deps.refundWebSubscription(refund, {
        plan: async ({ amountMinor, paymentRef }) => {
          await call(deps, "account_deletion_web_refund_plan", {
            ...key,
            p_planned_minor: amountMinor,
            p_payment_ref: paymentRef,
          })
        },
      })
    } catch (error) {
      // m4: settle only once every payment in scope is final; pending is not a failure.
      if (error instanceof AccountDeletionRefundPendingError) {
        waiting += 1
        // N4: to the back of the due queue, so waiting rows never starve the others.
        await deps.rpc("account_deletion_web_refund_waiting", key)
        if (Date.now() - Date.parse(refund.recordedAt) > ACCOUNT_DELETION_REFUND_WAITING_REPORT_MS)
          staleWaiting += 1
        continue
      }
      const permanent = error instanceof AccountDeletionRefundManualError
      const errorCode = `${refund.provider}_refund_failed`
      const recorded = await deps.rpc("account_deletion_web_refund_result", {
        ...key,
        p_refunded_minor: null,
        p_payment_ref: null,
        p_error_code: errorCode,
        p_manual: permanent,
      })
      const result = recorded.data as { attempts?: unknown; state?: unknown } | null
      const attempts = Number(result?.attempts)
      const terminal = !recorded.error && result?.state === "failed_manual"
      if (terminal) manual += 1
      if (terminal || (!recorded.error && attempts >= ACCOUNT_DELETION_SENTRY_THRESHOLD))
        deps.reportRefundFailure({
          provider: refund.provider,
          errorCode,
          attempts,
          manual: terminal,
        })
      continue
    }
    // A lost result is harmless: the retry finds the same refund (idempotency key/provider state).
    const settled = await deps.rpc("account_deletion_web_refund_result", {
      ...key,
      p_refunded_minor: outcome.refundedMinor,
      p_payment_ref: outcome.paymentRef,
      p_error_code: null,
    })
    if (!settled.error) completed += 1
  }
  // N4: once per run, however many rows wait that long.
  if (staleWaiting > 0) deps.reportRefundWaiting({ waiting: staleWaiting })
  const pending = (due ?? []).length
  // Manual-review rows are settled for the cron (reported once), waiting ones retried; neither fails.
  return { pending, completed, manual, waiting, failed: pending - completed - manual - waiting }
}

async function pendingCleanup(
  deps: AccountDeletionDeps,
  input: { requestId?: string; limit: number },
): Promise<AccountDeletionTarget[]> {
  const data = await call(deps, "account_deletion_pending_cleanup", {
    p_limit: input.limit,
    p_request_id: input.requestId ?? null,
  })
  return (data as unknown as AccountDeletionTarget[]) ?? []
}

async function runExternalCleanup(
  target: AccountDeletionTarget,
  deps: AccountDeletionDeps,
): Promise<AccountDeletionState> {
  try {
    if (target.storagePaths.length)
      await step("storage_failed", () => deps.removeStorageObjects(target.storagePaths))
    // People are identified by user id (billing, app) and by email (quiz leads, waitlist).
    await step("customerio_failed", async () => {
      await deps.deleteCustomerIoPerson(target.userId, `account_deletion:${target.requestId}:user`)
      if (target.email)
        await deps.deleteCustomerIoPerson(
          target.email,
          `account_deletion:${target.requestId}:email`,
        )
    })
    await step("posthog_failed", () => deps.deletePostHogPerson(target.userId))
  } catch (error) {
    const errorCode = error instanceof AccountDeletionCleanupError ? error.code : "cleanup_failed"
    const recorded = await deps.rpc("account_deletion_record_external_failure", {
      p_request_id: target.requestId,
      p_error_code: errorCode,
    })
    const attempts = Number(
      (recorded.data as { externalAttempts?: unknown } | null)?.externalAttempts,
    )
    if (!recorded.error && attempts >= ACCOUNT_DELETION_SENTRY_THRESHOLD)
      deps.reportCleanupFailure({ errorCode, attempts })
    return "data_deleted"
  }
  return state(await call(deps, "account_deletion_complete", { p_request_id: target.requestId }))
}

async function step(code: AccountDeletionCleanupError["code"], run: () => Promise<void>) {
  try {
    await run()
  } catch {
    throw new AccountDeletionCleanupError(code)
  }
}
