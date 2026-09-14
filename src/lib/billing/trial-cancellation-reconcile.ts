import "server-only"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// One Stripe reconciliation can need several round trips. Keep each cron
// invocation inside its 60-second route budget and use a lease longer than it.
const LIMIT = 1
const LEASE_SECONDS = 120

type RpcResult = { data: unknown; error: unknown }

export type TrialCancellationRetryClient = Readonly<{
  rpc: (name: string, args: Record<string, string>) => PromiseLike<RpcResult>
}>

type ClaimedOperation = Readonly<{
  declarationId: string
  userId: string
  provider: "stripe" | "paypal"
  leaseToken: string
}>

export type TrialCancellationRetryStats = Readonly<{
  claimed: number
  confirmed: number
  pending: number
  unsupported: number
}>

function claimedOperation(value: unknown): ClaimedOperation | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const row = value as Record<string, unknown>
  if (
    !UUID.test(String(row.declaration_id)) ||
    !UUID.test(String(row.user_id)) ||
    !UUID.test(String(row.lease_token)) ||
    (row.provider !== "stripe" && row.provider !== "paypal")
  ) {
    return null
  }
  return {
    declarationId: row.declaration_id as string,
    userId: row.user_id as string,
    provider: row.provider,
    leaseToken: row.lease_token as string,
  }
}

async function completeAttempt(
  client: TrialCancellationRetryClient,
  operation: ClaimedOperation,
  errorCode: string,
) {
  const completed = await client.rpc("complete_trial_cancellation_provider_operation_attempt", {
    p_declaration_id: operation.declarationId,
    p_lease_token: operation.leaseToken,
    p_error_code: errorCode,
  })
  if (completed.error || completed.data !== true) {
    throw new Error("Unable to complete cancellation provider operation attempt")
  }
}

/**
 * Executes only database-leased operations. The Stripe adapter owns provider
 * reconciliation and uses the declaration ID as its idempotency identity.
 */
export async function reconcileTrialCancellationProviderOperations(input: {
  client: TrialCancellationRetryClient
  reconcileStripe: (input: {
    declarationId: string
    userId: string
  }) => Promise<"confirmed" | "pending" | "in_progress">
  reconcilePayPal?: (input: {
    declarationId: string
    userId: string
    leaseToken: string
  }) => Promise<"confirmed" | "pending" | "in_progress">
  limit?: number
}): Promise<TrialCancellationRetryStats> {
  const limit = input.limit ?? LIMIT
  if (!Number.isInteger(limit) || limit < 1 || limit > LIMIT)
    throw new Error("Invalid cancellation retry limit")
  const claimed = await input.client.rpc("claim_trial_cancellation_provider_operations", {
    p_limit: String(limit),
    p_lease_seconds: String(LEASE_SECONDS),
  })
  if (claimed.error || !Array.isArray(claimed.data))
    throw new Error("Unable to claim cancellation provider operations")

  const operations = claimed.data.map(claimedOperation)
  if (operations.some((operation) => operation === null)) {
    throw new Error("Claimed cancellation provider operation is invalid")
  }
  const validOperations = operations as ClaimedOperation[]
  const stats = { claimed: validOperations.length, confirmed: 0, pending: 0, unsupported: 0 }
  for (const operation of validOperations) {
    let result: "confirmed" | "pending" | "in_progress" = "pending"
    try {
      result =
        operation.provider === "stripe"
          ? await input.reconcileStripe({
              declarationId: operation.declarationId,
              userId: operation.userId,
            })
          : await (input.reconcilePayPal ?? defaultReconcilePayPal(input.client))({
              declarationId: operation.declarationId,
              userId: operation.userId,
              leaseToken: operation.leaseToken,
            })
    } catch {
      result = "pending"
    }
    // A timed-out provider call may still reach Stripe. Leave its lease in
    // place so no second worker begins before the 120-second lease expires.
    if (result === "in_progress") {
      stats.pending++
      continue
    }
    await completeAttempt(
      input.client,
      operation,
      result === "confirmed"
        ? ""
        : operation.provider === "stripe"
          ? "stripe_reconciliation_pending"
          : "paypal_reconciliation_pending",
    )
    if (result === "confirmed") stats.confirmed++
    else stats.pending++
  }
  return stats
}

function defaultReconcilePayPal(client: TrialCancellationRetryClient) {
  return async ({
    declarationId,
    userId,
    leaseToken,
  }: {
    declarationId: string
    userId: string
    leaseToken: string
  }) => {
    const [
      { reconcilePayPalTrialCancellation },
      { cancelPayPalSubscription, retrievePayPalSubscription },
    ] = await Promise.all([
      import("@/lib/paypal/trial-cancellation"),
      import("@/lib/paypal/subscriptions"),
    ])
    return reconcilePayPalTrialCancellation({
      declarationId,
      userId,
      leaseToken,
      rpc: (name, args) => client.rpc(name, args),
      retrieve: retrievePayPalSubscription,
      cancel: cancelPayPalSubscription,
    })
  }
}
