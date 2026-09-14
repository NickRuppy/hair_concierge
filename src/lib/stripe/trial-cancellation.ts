import "server-only"

import { createHmac, timingSafeEqual } from "node:crypto"
import type Stripe from "stripe"

import { readTrialRuntime } from "../billing/trial-runtime"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type TrialCancellationCapability = { enrollmentId: string; requestId: string }

export function projectTrialCancellationCapability(
  value: TrialCancellationCapability,
  secret: string,
) {
  if (!UUID.test(value.enrollmentId) || !UUID.test(value.requestId) || secret.length < 32)
    throw new Error("Invalid cancellation capability")
  const payload = Buffer.from(`${value.enrollmentId}:${value.requestId}`, "utf8").toString(
    "base64url",
  )
  return `v1.${payload}.${createHmac("sha256", secret).update(`v1.${payload}`).digest("base64url")}`
}

export function decodeTrialCancellationCapability(
  token: string | null | undefined,
  secret: string,
): TrialCancellationCapability | null {
  if (!token || secret.length < 32) return null
  const [version, payload, signature, ...rest] = token.split(".")
  if (version !== "v1" || !payload || !signature || rest.length) return null
  const expected = createHmac("sha256", secret).update(`${version}.${payload}`).digest()
  const supplied = Buffer.from(signature, "base64url")
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null
  const [enrollmentId, requestId, ...extra] = Buffer.from(payload, "base64url")
    .toString("utf8")
    .split(":")
  return !extra.length && UUID.test(enrollmentId) && UUID.test(requestId)
    ? { enrollmentId, requestId }
    : null
}

type Rpc = (
  name: string,
  args: Record<string, string>,
) => PromiseLike<{ data: unknown; error: unknown }>
type ProviderOperation = Readonly<{
  enrollment_id: string
  user_id: string
  provider: "stripe"
  provider_customer_id: string
  provider_agreement_id: string
  original_trial_end_at: string
  status: "pending" | "confirmed"
  cancel_at_period_end: boolean
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
    fields.provider !== "stripe" ||
    typeof fields.provider_customer_id !== "string" ||
    !fields.provider_customer_id ||
    typeof fields.provider_agreement_id !== "string" ||
    !fields.provider_agreement_id ||
    typeof fields.original_trial_end_at !== "string" ||
    !Number.isFinite(Date.parse(fields.original_trial_end_at)) ||
    (fields.status !== "pending" && fields.status !== "confirmed") ||
    fields.cancel_at_period_end !== true
  )
    return null
  return fields as ProviderOperation
}

function matchesSubscription(
  subscription: Record<string, unknown>,
  operation: ProviderOperation,
  deadline: number,
  livemode: boolean,
) {
  const metadata = subscription.metadata as Record<string, unknown> | null | undefined
  return (
    subscription.id === operation.provider_agreement_id &&
    subscription.livemode === livemode &&
    subscription.customer === operation.provider_customer_id &&
    metadata?.trial_cohort === "trial_v1" &&
    metadata.trial_enrollment_id === operation.enrollment_id &&
    subscription.trial_end === deadline &&
    (subscription.status === "trialing" || subscription.status === "canceled")
  )
}

export async function reconcileStripeTrialCancellation(input: {
  declarationId: string
  userId: string
  rpc: Rpc
  stripe: Pick<Stripe, "accounts" | "subscriptions" | "invoices">
}) {
  try {
    const loaded = await input.rpc("load_trial_cancellation_provider_operation", {
      p_declaration_id: input.declarationId,
      p_user_id: input.userId,
    })
    const operation = loaded.error ? null : providerOperation(loaded.data, input.userId)
    if (!operation) return "pending" as const
    const runtime = readTrialRuntime()
    if (!runtime) return "pending" as const
    const deadline = Math.floor(Date.parse(operation.original_trial_end_at) / 1_000)
    if (!Number.isFinite(deadline)) return "pending" as const
    const account = await input.stripe.accounts.retrieve(null)
    if (account.id !== runtime.stripeAccountId) return "pending" as const
    let subscription = (await input.stripe.subscriptions.retrieve(
      operation.provider_agreement_id,
    )) as unknown as Record<string, unknown>
    if (!matchesSubscription(subscription, operation, deadline, runtime.livemode))
      return "pending" as const
    if (subscription.status === "trialing") {
      // cancel_at_period_end can point at another period boundary; verify the exact effective date.
      if (subscription.cancel_at !== deadline)
        await input.stripe.subscriptions.update(
          operation.provider_agreement_id,
          { cancel_at: deadline, proration_behavior: "none" },
          { idempotencyKey: `trial-cancellation:${input.declarationId}:v1` },
        )
      subscription = (await input.stripe.subscriptions.retrieve(
        operation.provider_agreement_id,
      )) as unknown as Record<string, unknown>
      if (
        !matchesSubscription(subscription, operation, deadline, runtime.livemode) ||
        subscription.cancel_at !== deadline
      )
        return "pending" as const
    } else {
      // Stripe's canceled_at can be the time cancellation was requested, rather
      // than the effective end. An already canceled free agreement is safe only
      // when it ended by the original deadline and has no collectible payment.
      if (typeof subscription.ended_at !== "number" || subscription.ended_at > deadline)
        return "pending" as const
      const invoices = await input.stripe.invoices.list({
        subscription: operation.provider_agreement_id,
        limit: 100,
      })
      if (
        invoices.has_more ||
        invoices.data.some(
          (invoice) =>
            invoice.amount_paid !== 0 ||
            invoice.amount_due !== 0 ||
            invoice.amount_remaining !== 0 ||
            !["paid", "void"].includes(invoice.status ?? ""),
        )
      )
        return "pending" as const
    }
    const confirmed = await input.rpc("confirm_trial_cancellation_provider_operation", {
      p_declaration_id: input.declarationId,
      p_user_id: input.userId,
      p_enrollment_id: operation.enrollment_id,
      p_provider_agreement_id: operation.provider_agreement_id,
      p_provider: "stripe",
      p_provider_customer_id: operation.provider_customer_id,
      p_original_trial_end_at: operation.original_trial_end_at,
      p_trial_cohort: "",
      p_provider_plan_id: "",
    })
    return !confirmed.error && confirmed.data === true
      ? ("confirmed" as const)
      : ("pending" as const)
  } catch {
    return "pending" as const
  }
}
