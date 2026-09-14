import "server-only"
import type Stripe from "stripe"
import type { TrialManagementClient } from "./trial-management-operations"
import { requestStripePaidCancellation } from "../stripe/trial-management"
import { retrievePayPalSubscription, cancelPayPalSubscription } from "../paypal/subscriptions"
type Operation = {
  id: string
  enrollment_id: string
  user_id: string
  provider: "stripe" | "paypal"
  original_agreement_id: string
  agreement_id: string
  customer_id: string
  submitted_at: string
  effective_end_at: string
  status: "pending" | "confirmed"
  lease_token: string | null
}
export type TrialPaidCancellationReceipt = {
  declaration: { declarationId: string; submittedAt: string; effectiveEndAt: string }
  providerStatus: "pending" | "confirmed"
}
export type TrialPaidCancellationDeps = {
  client: TrialManagementClient
  stripe: () => Stripe
  stripeCancel?: typeof requestStripePaidCancellation
  paypalRetrieve?: typeof retrievePayPalSubscription
  paypalCancel?: typeof cancelPayPalSubscription
}
function parse(value: unknown): Operation {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Paid cancellation unavailable")
  const o = value as Operation
  for (const k of [
    "id",
    "enrollment_id",
    "user_id",
    "original_agreement_id",
    "agreement_id",
    "customer_id",
    "submitted_at",
    "effective_end_at",
  ] as const)
    if (typeof o[k] !== "string" || !o[k]) throw new Error("Invalid paid cancellation operation")
  if (
    !["stripe", "paypal"].includes(o.provider) ||
    !["pending", "confirmed"].includes(o.status) ||
    !Number.isFinite(Date.parse(o.submitted_at)) ||
    !Number.isFinite(Date.parse(o.effective_end_at))
  )
    throw new Error("Invalid paid cancellation operation")
  return o
}
async function call(client: TrialManagementClient, name: string, args: Record<string, unknown>) {
  const { data, error } = await client.rpc(name, args)
  if (error) throw new Error("Paid cancellation reconciliation required")
  return data
}
/** Save the customer's declaration before provider configuration or network work. */
export async function requestTrialPaidCancellation(
  input: { requestId: string; enrollmentId: string; authenticatedUserId: string },
  deps: TrialPaidCancellationDeps,
): Promise<TrialPaidCancellationReceipt> {
  const o = parse(
    await call(deps.client, "request_trial_paid_cancellation", {
      p_request_id: input.requestId,
      p_enrollment_id: input.enrollmentId,
      p_authenticated_user_id: input.authenticatedUserId,
    }),
  )
  if (o.user_id !== input.authenticatedUserId || o.enrollment_id !== input.enrollmentId)
    throw new Error("Paid cancellation ownership mismatch")
  let status = o.status
  if (status !== "confirmed")
    try {
      const result = await reconcileTrialPaidCancellations({ ...deps, declarationId: o.id })
      if (result.confirmed === 1) status = "confirmed"
    } catch {
      /* Saved declaration and queue remain acknowledged. */
    }
  return {
    declaration: {
      declarationId: o.id,
      submittedAt: o.submitted_at,
      effectiveEndAt: o.effective_end_at,
    },
    providerStatus: status,
  }
}
/** Bounded durable retry consumer; retaining paid access never depends on provider speed. */
export async function reconcileTrialPaidCancellations(
  deps: TrialPaidCancellationDeps & { declarationId?: string },
) {
  const rows = await call(deps.client, "claim_trial_paid_cancellations", {
    p_limit: 2,
    p_declaration_id: deps.declarationId ?? null,
  })
  if (!Array.isArray(rows)) throw new Error("Paid cancellation retry unavailable")
  const result = { claimed: rows.length, confirmed: 0, pending: 0 }
  for (const row of rows) {
    const o = parse(row)
    if (!o.lease_token) throw new Error("Paid cancellation lease unavailable")
    let confirmed = false
    try {
      if (o.provider === "stripe") {
        const status = await (deps.stripeCancel ?? requestStripePaidCancellation)({
          requestId: o.id,
          enrollmentId: o.enrollment_id,
          authenticatedUserId: o.user_id,
          client: deps.client,
          stripe: deps.stripe(),
        })
        confirmed =
          status.status === "confirmed" &&
          Date.parse(status.paidThroughAt) === Date.parse(o.effective_end_at)
      } else {
        const retrieve = deps.paypalRetrieve ?? retrievePayPalSubscription
        let subscription = await retrieve(o.agreement_id)
        const owned = () =>
          subscription.id === o.agreement_id && subscription.subscriber?.payer_id === o.customer_id
        if (!owned()) throw new Error("Paid cancellation provider owner mismatch")
        if (!["CANCELLED", "EXPIRED"].includes(subscription.status ?? "")) {
          if (!["ACTIVE", "SUSPENDED"].includes(subscription.status ?? ""))
            throw new Error("Paid cancellation provider state unavailable")
          await (deps.paypalCancel ?? cancelPayPalSubscription)(
            o.agreement_id,
            `Chaarlie Kündigung ${o.id}`,
          )
          subscription = await retrieve(o.agreement_id)
        }
        confirmed = owned() && ["CANCELLED", "EXPIRED"].includes(subscription.status ?? "")
      }
    } catch {
      /* Keep the durable provider work pending. */
    }
    const finished = await call(deps.client, "finish_trial_paid_cancellation", {
      p_declaration_id: o.id,
      p_lease_token: o.lease_token,
      p_confirmed: confirmed,
    })
    if (finished === true) result.confirmed++
    else result.pending++
  }
  return result
}
