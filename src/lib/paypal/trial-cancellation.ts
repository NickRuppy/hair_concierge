import "server-only"

import { paypalTrialNextBillingMatches } from "./trial-collection-start"

import type { PayPalSubscription } from "./subscription-shapes"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Rpc = (
  name: string,
  args: Record<string, string>,
) => PromiseLike<{ data: unknown; error: unknown }>
type ProviderOperation = Readonly<{
  enrollment_id: string
  user_id: string
  provider: "paypal"
  provider_customer_id: string
  provider_agreement_id: string
  original_trial_end_at: string
  status: "pending" | "confirmed"
  cancel_at_period_end: true
  trial_cohort: "trial_v1"
  provider_plan_id: string
}>

function providerOperation(value: unknown, userId: string): ProviderOperation | null {
  if (Array.isArray(value) && value.length !== 1) return null
  const row = Array.isArray(value) ? value[0] : value
  if (!row || typeof row !== "object" || Array.isArray(row)) return null
  const fields = row as Record<string, unknown>
  if (
    !UUID.test(String(fields.enrollment_id)) ||
    !UUID.test(String(fields.user_id)) ||
    fields.user_id !== userId ||
    fields.provider !== "paypal" ||
    typeof fields.provider_customer_id !== "string" ||
    !fields.provider_customer_id ||
    typeof fields.provider_agreement_id !== "string" ||
    !fields.provider_agreement_id ||
    typeof fields.original_trial_end_at !== "string" ||
    !Number.isFinite(Date.parse(fields.original_trial_end_at)) ||
    (fields.status !== "pending" && fields.status !== "confirmed") ||
    fields.cancel_at_period_end !== true ||
    fields.trial_cohort !== "trial_v1" ||
    typeof fields.provider_plan_id !== "string" ||
    !fields.provider_plan_id
  )
    return null
  return fields as ProviderOperation
}

function matchesOwnedTrial(
  subscription: PayPalSubscription,
  operation: ProviderOperation,
  requireDeadline: boolean,
) {
  const providerEnd = subscription.billing_info?.next_billing_time
  return (
    subscription.id === operation.provider_agreement_id &&
    subscription.subscriber?.payer_id === operation.provider_customer_id &&
    subscription.plan_id === operation.provider_plan_id &&
    (!requireDeadline ||
      paypalTrialNextBillingMatches(operation.original_trial_end_at, providerEnd))
  )
}

function sameOperation(left: ProviderOperation, right: ProviderOperation) {
  return (
    left.enrollment_id === right.enrollment_id &&
    left.user_id === right.user_id &&
    left.provider_customer_id === right.provider_customer_id &&
    left.provider_agreement_id === right.provider_agreement_id &&
    left.original_trial_end_at === right.original_trial_end_at &&
    left.trial_cohort === right.trial_cohort &&
    left.provider_plan_id === right.provider_plan_id &&
    right.cancel_at_period_end
  )
}

/**
 * PayPal exposes no subscription metadata field. The enrollment/cohort pins are
 * therefore the immutable owned billing row loaded by the service RPC; the
 * retrieved agreement independently proves its exact ID, payer, and plan.
 */
export async function reconcilePayPalTrialCancellation(input: {
  declarationId: string
  userId: string
  leaseToken?: string
  rpc: Rpc
  retrieve: (subscriptionId: string) => Promise<PayPalSubscription>
  cancel: (subscriptionId: string, reason: string) => Promise<void>
}) {
  try {
    const loaded = await input.rpc("load_trial_cancellation_provider_operation", {
      p_declaration_id: input.declarationId,
      p_user_id: input.userId,
    })
    const operation = loaded.error ? null : providerOperation(loaded.data, input.userId)
    if (!operation) return "pending" as const
    let subscription = await input.retrieve(operation.provider_agreement_id)
    if (!matchesOwnedTrial(subscription, operation, subscription.status === "ACTIVE"))
      return "pending" as const
    if (subscription.status === "ACTIVE") {
      // The initial load can be stale while the provider retrieve is in flight.
      // Re-read the local declaration guard immediately before an irreversible
      // provider cancellation and refuse if a restore/replacement changed it.
      const current = await input.rpc("load_trial_cancellation_provider_operation", {
        p_declaration_id: input.declarationId,
        p_user_id: input.userId,
      })
      const currentOperation = current.error ? null : providerOperation(current.data, input.userId)
      if (!currentOperation || !sameOperation(operation, currentOperation))
        return "pending" as const
      await input.cancel(
        operation.provider_agreement_id,
        "Customer cancelled trial before its original end",
      )
      subscription = await input.retrieve(operation.provider_agreement_id)
      if (!matchesOwnedTrial(subscription, operation, false)) return "pending" as const
    }
    if (subscription.status !== "CANCELLED") return "pending" as const
    const confirmed = await input.rpc("confirm_trial_cancellation_provider_operation", {
      p_declaration_id: input.declarationId,
      p_user_id: input.userId,
      p_enrollment_id: operation.enrollment_id,
      p_provider: "paypal",
      p_provider_agreement_id: operation.provider_agreement_id,
      p_provider_customer_id: operation.provider_customer_id,
      p_original_trial_end_at: operation.original_trial_end_at,
      p_trial_cohort: operation.trial_cohort,
      p_provider_plan_id: operation.provider_plan_id,
      ...(input.leaseToken ? { p_lease_token: input.leaseToken } : {}),
    })
    return !confirmed.error && confirmed.data === true
      ? ("confirmed" as const)
      : ("pending" as const)
  } catch {
    return "pending" as const
  }
}
