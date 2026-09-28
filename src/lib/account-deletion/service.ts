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
 * 4. The due refunds (unused prepaid time, pro rata) are settled; a failure never blocks the
 *    deletion — the cron retries until done and reports from the 5th failed attempt.
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

/** A cancelled web subscription whose pro-rata refund is still to settle. */
export type WebRefundDue = {
  provider: WebSubscription["provider"]
  subscriptionId: string
  /** The deletion request that cancelled it (idempotency key source). */
  requestId: string
  recordedAt: string
  attempts: number
}

/** 0 = nothing to refund (trial, period over, already refunded). */
export type WebRefundOutcome = { refundedMinor: number; paymentRef: string | null }

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
  /** Refunds the unused part of the cancelled subscription's last payment. Throws on failure. */
  refundWebSubscription(refund: WebRefundDue): Promise<WebRefundOutcome>
  removeStorageObjects(paths: string[]): Promise<void>
  deleteCustomerIoPerson(identifier: string, messageId: string): Promise<void>
  deletePostHogPerson(distinctId: string): Promise<void>
  reportCleanupFailure(details: { errorCode: string; attempts: number }): void
}

export const ACCOUNT_DELETION_SENTRY_THRESHOLD = 5

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
  // Best effort here; the cron settles what is left.
  await settleWebRefunds(deps, { requestId: input.requestId, limit: 10 }).catch(() => undefined)
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

/** Cron: settle the due pro-rata refunds of cancelled web subscriptions. */
export async function retryAccountDeletionWebRefunds(deps: AccountDeletionDeps, limit = 20) {
  return settleWebRefunds(deps, { limit })
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
  for (const refund of due ?? []) {
    const key = { p_provider: refund.provider, p_subscription_id: refund.subscriptionId }
    let outcome: WebRefundOutcome | null = null
    try {
      outcome = await deps.refundWebSubscription(refund)
    } catch {
      const errorCode = `${refund.provider}_refund_failed`
      const recorded = await deps.rpc("account_deletion_web_refund_result", {
        ...key,
        p_refunded_minor: null,
        p_payment_ref: null,
        p_error_code: errorCode,
      })
      const attempts = Number((recorded.data as { attempts?: unknown } | null)?.attempts)
      if (!recorded.error && attempts >= ACCOUNT_DELETION_SENTRY_THRESHOLD)
        deps.reportCleanupFailure({ errorCode, attempts })
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
  const pending = (due ?? []).length
  return { pending, completed, failed: pending - completed }
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
