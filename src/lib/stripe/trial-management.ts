import "server-only"
import type Stripe from "stripe"
import { readTrialRuntime, type TrialRuntime } from "../billing/trial-runtime"
import {
  loadTrialManagementOperation,
  commitTrialManagementOperation,
  abandonTrialManagementOperation,
  type TrialManagementClient,
  type TrialManagementOperation,
} from "../billing/trial-management-operations"
import type { TrialOfferSnapshot } from "../billing/trial-offer"
import { reconcileStripeTrialManagementApproval } from "./trial-management-approval"

function id(value: string | { id: string } | null | undefined) {
  return typeof value === "string" ? value : (value?.id ?? null)
}
function requireFact(value: unknown): asserts value {
  if (!value) throw new Error("Stripe trial management requires reconciliation")
}
function epoch(value: string) {
  const n = Date.parse(value) / 1000
  requireFact(Number.isSafeInteger(n) && n > 0)
  return n
}
function owned(s: Stripe.Subscription, op: TrialManagementOperation, runtime: TrialRuntime) {
  return (
    s.id === op.sourceAgreementId &&
    s.livemode === runtime.livemode &&
    id(s.customer) === op.providerCustomerId &&
    s.metadata.trial_enrollment_id === op.enrollmentId &&
    s.metadata.trial_cohort === "trial_v1" &&
    s.billing_mode.type === "flexible" &&
    s.automatic_tax.enabled &&
    !s.schedule &&
    !s.pending_update &&
    !s.pause_collection &&
    !s.transfer_data &&
    !s.on_behalf_of &&
    s.collection_method === "charge_automatically" &&
    s.items.has_more === false &&
    s.items.data.length === 1 &&
    (s.trial_end === epoch(op.originalTrialEndAt) ||
      (s.metadata.trial_management_role === "restored" &&
        s.trial_end == null &&
        s.billing_cycle_anchor === epoch(op.originalTrialEndAt) &&
        s.items.data[0].current_period_end === epoch(op.originalTrialEndAt)))
  )
}
function stillTrial(s: Stripe.Subscription) {
  return (
    s.status === "trialing" ||
    (s.status === "active" && s.metadata.trial_management_role === "restored")
  )
}
function terms(s: Stripe.Subscription, offer: TrialOfferSnapshot) {
  const item = s.items.data[0],
    price = item.price
  if (
    item.quantity !== 1 ||
    item.discounts.length !== 0 ||
    price.id !== offer.stripePriceId ||
    price.currency !== "eur" ||
    price.tax_behavior !== "inclusive" ||
    price.unit_amount !== offer.renewalAmountMinor ||
    price.recurring?.interval !== offer.interval ||
    price.recurring.interval_count !== 1
  )
    return false
  if (!offer.stripeCouponId) return s.discounts.length === 0
  if (s.discounts.length !== 1 || typeof s.discounts[0] === "string") return false
  const discount = s.discounts[0]
  return (
    id(discount.source.coupon) === offer.stripeCouponId &&
    discount.subscription === s.id &&
    id(discount.customer) === id(s.customer) &&
    discount.subscription_item == null
  )
}
function canceledAtEnd(s: Stripe.Subscription, deadline: number) {
  return (
    s.cancel_at === deadline ||
    (s.cancel_at_period_end && s.items.data[0].current_period_end === deadline)
  )
}

/** Existing Stripe trial changes; canceled agreements require fresh hosted approval. */
export async function reconcileStripeTrialManagement(input: {
  operationId: string
  authenticatedUserId: string
  client: TrialManagementClient
  stripe: Stripe
  runtime?: TrialRuntime | null
  now?: () => number
}): Promise<{
  status: "committed" | "pending" | "requires_approval" | "abandoned"
  operationId: string
}> {
  const pending = { status: "pending" as const, operationId: input.operationId }
  const runtime = input.runtime === undefined ? readTrialRuntime() : input.runtime
  let rollback: (() => Promise<boolean>) | null = null
  try {
    requireFact(runtime)
    const op = await loadTrialManagementOperation(input.client, {
      operationId: input.operationId,
      authenticatedUserId: input.authenticatedUserId,
    })
    requireFact(op.provider === "stripe" && op.userId === input.authenticatedUserId)
    if (op.status === "committed") return { ...pending, status: "committed" }
    if (op.status === "abandoned") return { ...pending, status: "abandoned" }
    requireFact(
      op.status === "pending" &&
        epoch(op.originalTrialEndAt) > Math.floor((input.now ?? Date.now)() / 1000),
    )
    const guard = async () => {
      const result = await input.client.rpc("guard_trial_management_operation", {
        p_operation_id: op.id,
        p_authenticated_user_id: op.userId,
      })
      requireFact(!result.error && result.data === true)
    }
    await guard()
    requireFact((await input.stripe.accounts.retrieve(null)).id === runtime.stripeAccountId)
    const retrieve = () =>
      input.stripe.subscriptions.retrieve(op.sourceAgreementId, { expand: ["discounts"] })
    let subscription = await retrieve()
    requireFact(owned(subscription, op, runtime))
    if (subscription.status === "canceled") {
      const approval = await input.client.rpc("load_stripe_trial_management_approval", {
        p_operation_id: op.id,
      })
      requireFact(!approval.error)
      if (approval.data) {
        const result = await reconcileStripeTrialManagementApproval(input)
        if (result.status === "committed") return { ...pending, status: "committed" }
        if (result.status === "abandoned") return { ...pending, status: "abandoned" }
      }
      return { ...pending, status: "requires_approval" }
    }
    requireFact(stillTrial(subscription))
    const deadline = epoch(op.originalTrialEndAt),
      originalAnchor = subscription.billing_cycle_anchor
    const expectedCancellation = (s: Stripe.Subscription) =>
      op.cancelAtPeriodEnd
        ? canceledAtEnd(s, deadline)
        : !s.cancel_at_period_end && s.cancel_at == null
    const alreadyApplied =
      subscription.metadata.trial_management_operation_id === op.id &&
      terms(subscription, op.targetOffer) &&
      expectedCancellation(subscription)
    requireFact(alreadyApplied || terms(subscription, op.sourceOffer))
    const zeroInvoices = async () => {
      const invoices = await input.stripe.invoices.list({
        subscription: op.sourceAgreementId,
        limit: 100,
      })
      requireFact(
        !invoices.has_more &&
          invoices.data.every(
            (i) =>
              i.amount_paid === 0 &&
              i.amount_due === 0 &&
              i.amount_remaining === 0 &&
              ["paid", "void"].includes(i.status ?? ""),
          ),
      )
    }
    rollback = async () => {
      const latest = await retrieve()
      if (
        !owned(latest, op, runtime) ||
        !stillTrial(latest) ||
        latest.metadata.trial_management_operation_id !== op.id ||
        !terms(latest, op.targetOffer)
      )
        return false
      const currentGuard = await input.client.rpc("guard_trial_management_operation", {
        p_operation_id: op.id,
        p_authenticated_user_id: op.userId,
      })
      requireFact(!currentGuard.error)
      const keepCanceled =
        currentGuard.data !== true || op.kind === "restore" || op.cancelAtPeriodEnd
      await input.stripe.subscriptions.update(
        latest.id,
        {
          billing_cycle_anchor: "unchanged",
          proration_behavior: "none",
          cancel_at_period_end: false,
          cancel_at: keepCanceled ? deadline : "",
          ...(op.kind === "switch"
            ? {
                items: [
                  { id: latest.items.data[0].id, price: op.sourceOffer.stripePriceId, quantity: 1 },
                ],
                discounts: op.sourceOffer.stripeCouponId
                  ? [{ coupon: op.sourceOffer.stripeCouponId }]
                  : ("" as const),
              }
            : {}),
        },
        {
          idempotencyKey: `trial-management:${op.id}:rollback:${keepCanceled ? "canceled" : "original"}:v1`,
        },
      )
      const restored = await retrieve()
      requireFact(
        owned(restored, op, runtime) &&
          stillTrial(restored) &&
          terms(restored, op.sourceOffer) &&
          (keepCanceled
            ? canceledAtEnd(restored, deadline)
            : !restored.cancel_at_period_end && restored.cancel_at == null),
      )
      await zeroInvoices()
      return abandonTrialManagementOperation(input.client, {
        operationId: op.id,
        authenticatedUserId: op.userId,
        reconciliationReference: `stripe-rollback:${op.id}`,
      })
    }
    await zeroInvoices()
    if (!alreadyApplied) {
      const customer = await input.stripe.customers.retrieve(op.providerCustomerId)
      requireFact(!customer.deleted && !customer.discount)
      if (op.kind === "switch" && op.targetOffer.stripeCouponId) {
        const coupon = await input.stripe.coupons.retrieve(op.targetOffer.stripeCouponId)
        const target = await input.stripe.prices.retrieve(op.targetOffer.stripePriceId)
        requireFact(
          coupon.valid &&
            coupon.livemode === runtime.livemode &&
            coupon.amount_off === 3000 &&
            coupon.percent_off == null &&
            coupon.currency === "eur" &&
            coupon.duration === "once" &&
            coupon.applies_to?.products.length === 1 &&
            coupon.applies_to.products[0] === id(target.product),
        )
      }
      await guard()
      const params: Stripe.SubscriptionUpdateParams = {
        billing_cycle_anchor: "unchanged",
        proration_behavior: "none",
        metadata: { trial_management_operation_id: op.id },
        ...(op.kind === "restore"
          ? { cancel_at_period_end: false, cancel_at: "" as const }
          : {
              items: [
                {
                  id: subscription.items.data[0].id,
                  price: op.targetOffer.stripePriceId,
                  quantity: 1,
                },
              ],
              discounts: op.targetOffer.stripeCouponId
                ? [{ coupon: op.targetOffer.stripeCouponId }]
                : ("" as const),
            }),
      }
      try {
        await input.stripe.subscriptions.update(subscription.id, params, {
          idempotencyKey: `trial-management:${op.id}:v1`,
        })
      } catch {
        return pending
      } // Read back an uncertain update before attempting compensation.
      subscription = await retrieve()
    }
    requireFact(
      owned(subscription, op, runtime) &&
        stillTrial(subscription) &&
        subscription.billing_cycle_anchor === originalAnchor &&
        terms(subscription, op.targetOffer) &&
        expectedCancellation(subscription),
    )
    await zeroInvoices()
    // The preview corroborates the first paid total without creating/finalizing
    // an invoice or granting access. A canceled trial has no upcoming invoice.
    if (!op.cancelAtPeriodEnd) {
      const preview = await input.stripe.invoices.createPreview({ subscription: subscription.id })
      requireFact(
        preview.currency === "eur" &&
          preview.amount_due === op.targetOffer.firstAmountMinor &&
          preview.total === op.targetOffer.firstAmountMinor,
      )
    }
    let committed: boolean
    try {
      committed = await commitTrialManagementOperation(input.client, {
        operationId: op.id,
        authenticatedUserId: op.userId,
        evidence: {
          provider: "stripe",
          providerCustomerId: op.providerCustomerId,
          sourceAgreementId: op.sourceAgreementId,
          targetAgreementId: subscription.id,
          originalTrialEndAt: op.originalTrialEndAt,
          offer: op.targetOffer,
          cancelAtPeriodEnd: op.cancelAtPeriodEnd,
          noImmediatePayment: true,
          sourceAgreementNeutralized: false,
          reference: `stripe-subscription:${subscription.id}:trial-management:${op.id}`,
        },
      })
    } catch {
      return pending
    } // Lost DB response may have committed; retry the same operation.
    if (!committed) {
      try {
        if (rollback && (await rollback())) return { ...pending, status: "abandoned" }
      } catch {
        /* Stop collection below if restoring the old terms failed. */
      }
      // A newer declaration wins. Do not leave a restored or differently priced
      // agreement collectible while the local commit is rejected.
      const latest = await retrieve()
      if (
        owned(latest, op, runtime) &&
        stillTrial(latest) &&
        deadline > Math.floor((input.now ?? Date.now)() / 1000)
      ) {
        await input.stripe.subscriptions.update(
          latest.id,
          { cancel_at: deadline, proration_behavior: "none" },
          { idempotencyKey: `trial-management:${op.id}:rejected:v1` },
        )
      }
      return pending
    }
    return { ...pending, status: "committed" }
  } catch {
    if (rollback) {
      try {
        if (await rollback()) return { ...pending, status: "abandoned" }
      } catch {
        /* Keep reconciliation pending. */
      }
    }
    return pending
  }
}

type PaidCancellation = {
  id: string
  enrollment_id: string
  user_id: string
  agreement_id: string
  original_agreement_id: string
  customer_id: string
  paid_through_at: string
  status: "pending" | "confirmed"
  lease_token: string | null
}
function paidCancellation(value: unknown): PaidCancellation {
  requireFact(value && typeof value === "object" && !Array.isArray(value))
  const row = value as Record<string, unknown>
  requireFact(
    [
      "id",
      "enrollment_id",
      "user_id",
      "agreement_id",
      "original_agreement_id",
      "customer_id",
      "paid_through_at",
    ].every((k) => typeof row[k] === "string" && row[k]),
  )
  requireFact(row.status === "pending" || row.status === "confirmed")
  return row as PaidCancellation
}

async function applyPaidCancellation(input: {
  operation: PaidCancellation
  stripe: Stripe
  runtime: TrialRuntime
  now?: () => number
}) {
  const { operation: op, stripe, runtime } = input
  try {
    requireFact((await stripe.accounts.retrieve(null)).id === runtime.stripeAccountId)
    const deadline = epoch(op.paid_through_at)
    let subscription = await stripe.subscriptions.retrieve(op.agreement_id)
    const matches = (s: Stripe.Subscription) =>
      s.id === op.agreement_id &&
      s.livemode === runtime.livemode &&
      id(s.customer) === op.customer_id &&
      s.metadata.trial_cohort === "trial_v1" &&
      s.metadata.trial_enrollment_id === op.enrollment_id &&
      (s.id === op.original_agreement_id ||
        s.metadata.trial_original_agreement_id === op.original_agreement_id)
    requireFact(matches(subscription))
    if (subscription.status === "canceled") return true
    requireFact(
      ["active", "past_due", "unpaid"].includes(subscription.status) &&
        !subscription.items.has_more &&
        subscription.items.data.length === 1 &&
        !subscription.schedule,
    )
    // A source that would renew before the paid-through date must stop now;
    // retaining paid access is the ledger's job, independent of provider status.
    if (
      deadline <= Math.floor((input.now ?? Date.now)() / 1000) ||
      subscription.items.data[0].current_period_end < deadline
    ) {
      await stripe.subscriptions.cancel(subscription.id, {
        invoice_now: false,
        prorate: false,
        cancellation_details: { comment: `trial-paid-cancellation:${op.id}` },
      })
    } else if (subscription.cancel_at !== deadline) {
      await stripe.subscriptions.update(
        subscription.id,
        { cancel_at: deadline, proration_behavior: "none" },
        { idempotencyKey: `trial-paid-cancellation:${op.id}:v1` },
      )
    }
    subscription = await stripe.subscriptions.retrieve(op.agreement_id)
    return (
      matches(subscription) &&
      (subscription.status === "canceled" || subscription.cancel_at === deadline)
    )
  } catch {
    return false
  }
}

export async function reconcileStripePaidCancellations(input: {
  client: TrialManagementClient
  stripe: Stripe
  runtime?: TrialRuntime | null
  operationId?: string
}) {
  const runtime = input.runtime === undefined ? readTrialRuntime() : input.runtime
  requireFact(runtime)
  const claimed = await input.client.rpc("claim_stripe_paid_cancellations", {
    p_limit: 2,
    p_operation_id: input.operationId ?? null,
  })
  requireFact(!claimed.error && Array.isArray(claimed.data))
  const result = { claimed: claimed.data.length, confirmed: 0, pending: 0 }
  for (const row of claimed.data) {
    const operation = paidCancellation(row)
    requireFact(operation.lease_token)
    const verified = await applyPaidCancellation({ operation, stripe: input.stripe, runtime })
    const finished = await input.client.rpc("finish_stripe_paid_cancellation", {
      p_operation_id: operation.id,
      p_lease_token: operation.lease_token,
      p_confirmed: verified,
    })
    requireFact(!finished.error)
    if (finished.data === true) result.confirmed++
    else result.pending++
  }
  return result
}

/** Persists the owner's cancellation before any provider call; failures remain queued. */
export async function requestStripePaidCancellation(input: {
  requestId: string
  enrollmentId: string
  authenticatedUserId: string
  client: TrialManagementClient
  stripe: Stripe
  runtime?: TrialRuntime | null
}): Promise<{ status: "confirmed" | "pending"; operationId: string; paidThroughAt: string }> {
  const requested = await input.client.rpc("request_stripe_paid_cancellation", {
    p_request_id: input.requestId,
    p_enrollment_id: input.enrollmentId,
    p_authenticated_user_id: input.authenticatedUserId,
  })
  requireFact(!requested.error)
  const operation = paidCancellation(requested.data)
  requireFact(
    operation.user_id === input.authenticatedUserId &&
      operation.enrollment_id === input.enrollmentId,
  )
  if (operation.status === "confirmed")
    return {
      status: "confirmed",
      operationId: operation.id,
      paidThroughAt: operation.paid_through_at,
    }
  let status: "confirmed" | "pending" = "pending"
  try {
    const result = await reconcileStripePaidCancellations({ ...input, operationId: operation.id })
    if (result.confirmed === 1) status = "confirmed"
  } catch {
    /* Persisted cancellation remains independently retryable. */
  }
  return { status, operationId: operation.id, paidThroughAt: operation.paid_through_at }
}
