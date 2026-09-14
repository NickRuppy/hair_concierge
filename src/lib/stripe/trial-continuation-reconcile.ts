import "server-only"
import type Stripe from "stripe"
import { readTrialRuntime, type TrialRuntime } from "../billing/trial-runtime"
import {
  reconcileStripeTrialContinuation,
  type StripeContinuationOperation,
  type StripeContinuationRpc,
} from "./trial-continuation"

export async function reconcileStripeTrialContinuations(input: {
  rpc: StripeContinuationRpc
  stripe: Stripe
  runtime?: TrialRuntime | null
  enrollmentId?: string
  reconcile?: typeof reconcileStripeTrialContinuation
}) {
  const runtime = input.runtime === undefined ? readTrialRuntime() : input.runtime
  if (!runtime) throw new Error("Stripe continuation runtime unavailable")
  const claim = await input.rpc("claim_stripe_trial_continuations", {
    p_limit: 2,
    p_enrollment_id: input.enrollmentId ?? null,
  })
  if (claim.error || !Array.isArray(claim.data))
    throw new Error("Stripe continuation queue unavailable")
  const counts = { claimed: claim.data.length, resolved: 0, canceled: 0, pending: 0 }
  for (const row of claim.data) {
    if (
      !row ||
      typeof row !== "object" ||
      ![
        "id",
        "enrollment_id",
        "original_agreement_id",
        "customer_id",
        "source_object_id",
        "paid_through_at",
        "payment_succeeded_at",
        "lease_token",
      ].every((k) => typeof row[k] === "string" && row[k])
    ) {
      throw new Error("Stripe continuation operation invalid")
    }
    const operation = row as StripeContinuationOperation
    let result: "resolved" | "canceled" | "pending" = "pending"
    try {
      result = await (input.reconcile ?? reconcileStripeTrialContinuation)({
        operation,
        rpc: input.rpc,
        stripe: input.stripe,
        runtime,
      })
    } catch {
      /* The durable lease expires even if retry scheduling fails. */
    }
    counts[result]++
    if (result === "pending") {
      const released = await input.rpc("checkpoint_stripe_trial_continuation", {
        p_operation_id: operation.id,
        p_lease_token: operation.lease_token,
        p_action: "retry",
        p_subscription_id: null,
      })
      if (released.error || released.data !== true)
        throw new Error("Stripe continuation retry unavailable")
    }
  }
  return counts
}
