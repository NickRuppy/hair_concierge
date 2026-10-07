import "server-only"
import type Stripe from "stripe"
import type { TrialRuntime } from "../billing/trial-runtime"
import { parseTrialOfferSnapshot, type TrialOfferSnapshot } from "../billing/trial-offer"
export type StripeContinuationOperation = {
  id: string
  enrollment_id: string
  original_agreement_id: string
  customer_id: string
  source_agreement_id?: string | null
  source_object_id: string
  paid_through_at: string
  payment_succeeded_at: string
  accepted_offer: unknown
  neutralized_at: string | null
  continuation_agreement_id: string | null
  create_attempted_at: string | null
  lease_token: string
}
export type StripeContinuationRpc = (
  name: string,
  args: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: unknown }>
function id(value: string | { id: string } | null | undefined) {
  return typeof value === "string" ? value : (value?.id ?? null)
}
function requireFact(value: unknown): asserts value {
  if (!value) throw new Error("Stripe continuation requires reconciliation")
}
function epoch(value: string) {
  const result = Date.parse(value) / 1000
  requireFact(Number.isSafeInteger(result) && result > 0)
  return result
}
function matches(
  subscription: Stripe.Subscription,
  op: StripeContinuationOperation,
  runtime: TrialRuntime,
  offer: TrialOfferSnapshot,
) {
  const item = subscription.items.data[0]
  return (
    subscription.livemode === runtime.livemode &&
    id(subscription.customer) === op.customer_id &&
    subscription.metadata.trial_cohort === "trial_v1" &&
    subscription.metadata.trial_enrollment_id === op.enrollment_id &&
    !subscription.items.has_more &&
    subscription.items.data.length === 1 &&
    item.quantity === 1 &&
    item.price.id === offer.stripePriceId &&
    item.price.currency === "eur" &&
    item.price.tax_behavior === "inclusive" &&
    item.price.unit_amount === offer.renewalAmountMinor &&
    item.price.recurring?.interval === offer.interval &&
    item.price.recurring.interval_count === 1 &&
    item.price.recurring.usage_type === "licensed" &&
    item.price.billing_scheme === "per_unit" &&
    subscription.collection_method === "charge_automatically" &&
    subscription.automatic_tax.enabled === true &&
    !subscription.on_behalf_of &&
    !subscription.transfer_data &&
    !subscription.application_fee_percent &&
    !subscription.schedule &&
    !subscription.pending_update &&
    !subscription.pause_collection
  )
}

/** Exact future anchor on a new full-price agreement, never a second trial or payment. */
export async function reconcileStripeTrialContinuation(input: {
  operation: StripeContinuationOperation
  rpc: StripeContinuationRpc
  stripe: Stripe
  runtime: TrialRuntime
  now?: () => number
}): Promise<"resolved" | "canceled" | "pending"> {
  const { operation: op, stripe, runtime, rpc } = input
  const sourceAgreementId = op.source_agreement_id ?? op.original_agreement_id
  const now = input.now ?? Date.now
  const checkpoint = async (action: string, subscriptionId: string | null = null) => {
    const result = await rpc("checkpoint_stripe_trial_continuation", {
      p_operation_id: op.id,
      p_lease_token: op.lease_token,
      p_action: action,
      p_subscription_id: subscriptionId,
    })
    requireFact(!result.error && result.data === true)
  }
  const allowed = async () => {
    const result = await rpc("guard_stripe_trial_continuation", {
      p_operation_id: op.id,
      p_lease_token: op.lease_token,
    })
    if (result.error) throw new Error("Stripe continuation guard unavailable")
    return result.data === true
  }
  const cancelSuccessor = async (successor: Stripe.Subscription) => {
    if (successor.status !== "canceled")
      await stripe.subscriptions.cancel(successor.id, {
        invoice_now: false,
        prorate: false,
        cancellation_details: { comment: `trial-continuation-aborted:${op.id}` },
      })
    requireFact((await stripe.subscriptions.retrieve(successor.id)).status === "canceled")
  }
  try {
    const offer = parseTrialOfferSnapshot(op.accepted_offer)
    requireFact(offer && (await stripe.accounts.retrieve(null)).id === runtime.stripeAccountId)
    const anchor = epoch(op.paid_through_at)
    const paidAt = epoch(op.payment_succeeded_at)
    let original = await stripe.subscriptions.retrieve(sourceAgreementId)
    requireFact(original.id === sourceAgreementId && matches(original, op, runtime, offer))

    // Complete customer pagination, not eventually consistent Search, recovers a
    // response lost before a successor ID was persisted. More than one is debt.
    const found: Stripe.Subscription[] = []
    let cursor: string | undefined
    for (let page = 0; ; page++) {
      requireFact(page < 20)
      const list = await stripe.subscriptions.list({
        customer: op.customer_id,
        status: "all",
        limit: 100,
        ...(cursor ? { starting_after: cursor } : {}),
      })
      found.push(
        ...list.data.filter(
          (s) => s.id !== sourceAgreementId && s.metadata.trial_continuation_operation_id === op.id,
        ),
      )
      if (!list.has_more) break
      const next = list.data.at(-1)?.id
      requireFact(next && next !== cursor)
      cursor = next
    }
    requireFact(found.length <= 1)
    let successor = found[0] ?? null
    if (op.continuation_agreement_id) {
      requireFact(successor?.id === op.continuation_agreement_id)
    }
    if (successor) {
      requireFact(
        successor.livemode === runtime.livemode &&
          id(successor.customer) === op.customer_id &&
          successor.metadata.trial_enrollment_id === op.enrollment_id &&
          successor.metadata.trial_original_agreement_id === op.original_agreement_id,
      )
      if (!matches(successor, op, runtime, offer)) {
        await cancelSuccessor(successor)
        return "pending"
      }
    }

    if (!(await allowed())) {
      if (successor) await cancelSuccessor(successor)
      // An unobserved in-flight creation is not proof of no agreement. Retry it
      // until provider lookup can compensate, without clearing the operation.
      if (!successor && op.create_attempted_at) return "pending"
      await checkpoint("canceled")
      return "canceled"
    }
    const marker = `trial-paid-continuation:${op.id}`
    if (original.status === "canceled")
      requireFact(
        original.cancellation_details?.comment === marker &&
          original.metadata.trial_continuation_operation_id === op.id,
      )
    else
      requireFact(
        ["active", "past_due", "unpaid"].includes(original.status) &&
          !original.cancel_at_period_end &&
          original.cancel_at == null,
      )

    const invoice = await stripe.invoices.retrieve(op.source_object_id)
    requireFact(
      invoice.id === op.source_object_id &&
        invoice.status === "paid" &&
        invoice.livemode === runtime.livemode &&
        id(invoice.customer) === op.customer_id &&
        id(invoice.parent?.subscription_details?.subscription) === sourceAgreementId &&
        invoice.currency === "eur" &&
        invoice.amount_paid === offer.firstAmountMinor &&
        invoice.amount_due === invoice.amount_paid &&
        invoice.amount_remaining === 0,
    )
    const payments = await stripe.invoicePayments.list({
      invoice: invoice.id,
      status: "paid",
      limit: 2,
    })
    requireFact(!payments.has_more && payments.data.length === 1)
    const payment = payments.data[0]
    const intentId = id(payment.payment.payment_intent)
    requireFact(
      payment.status === "paid" &&
        payment.livemode === runtime.livemode &&
        id(payment.invoice) === invoice.id &&
        payment.currency === "eur" &&
        payment.amount_paid === invoice.amount_paid &&
        payment.status_transitions.paid_at === paidAt &&
        payment.payment.type === "payment_intent" &&
        intentId,
    )
    const intent = await stripe.paymentIntents.retrieve(intentId, { expand: ["latest_charge"] })
    const paymentMethod = id(intent.payment_method)
    const charge = intent.latest_charge
    requireFact(
      intent.status === "succeeded" &&
        intent.livemode === runtime.livemode &&
        id(intent.customer) === op.customer_id &&
        intent.amount_received === invoice.amount_paid &&
        intent.currency === "eur" &&
        paymentMethod &&
        charge &&
        typeof charge !== "string" &&
        charge.paid &&
        charge.captured &&
        !charge.disputed &&
        charge.amount_refunded === 0 &&
        charge.amount_captured === invoice.amount_paid,
    )
    const method = await stripe.paymentMethods.retrieve(paymentMethod)
    requireFact(
      id(method.customer) === op.customer_id &&
        method.livemode === runtime.livemode &&
        method.type === "card",
    )

    if (original.status !== "canceled") {
      // No other collectible invoice may survive the handoff. A second paid
      // invoice also requires reconciliation rather than changing its contract.
      const invoices = await stripe.invoices.list({ subscription: original.id, limit: 100 })
      requireFact(
        !invoices.has_more &&
          invoices.data.every(
            (i) =>
              i.id === invoice.id ||
              (i.amount_paid === 0 &&
                i.amount_remaining === 0 &&
                ["paid", "void"].includes(i.status ?? "")),
          ),
      )
      requireFact(await allowed())
      await stripe.subscriptions.update(
        original.id,
        { metadata: { trial_continuation_operation_id: op.id } },
        { idempotencyKey: `trial-continuation:${op.id}:mark:v1` },
      )
      original = await stripe.subscriptions.retrieve(original.id)
      requireFact(
        matches(original, op, runtime, offer) &&
          original.metadata.trial_continuation_operation_id === op.id &&
          !original.cancel_at_period_end &&
          original.cancel_at == null &&
          original.status !== "canceled" &&
          (await allowed()),
      )
      await stripe.subscriptions.cancel(original.id, {
        invoice_now: false,
        prorate: false,
        cancellation_details: { comment: marker },
      })
      original = await stripe.subscriptions.retrieve(original.id)
      requireFact(
        original.status === "canceled" && original.cancellation_details?.comment === marker,
      )
    }
    await checkpoint("neutralized")

    if (!successor) {
      // Creation is forbidden once the owed boundary or Stripe's minimum
      // idempotency retention window has elapsed. The paid ledger is untouched.
      requireFact(anchor > Math.floor(now() / 1000) + 60)
      if (op.create_attempted_at)
        requireFact(now() - Date.parse(op.create_attempted_at) < 23 * 60 * 60 * 1000)
      const customer = await stripe.customers.retrieve(op.customer_id)
      requireFact(!customer.deleted && customer.id === op.customer_id && !customer.discount)
      requireFact(await allowed())
      await checkpoint("begin_create")
      successor = await stripe.subscriptions.create(
        {
          customer: op.customer_id,
          items: [{ price: offer.stripePriceId, quantity: 1 }],
          billing_mode: { type: "flexible" },
          billing_cycle_anchor: anchor,
          proration_behavior: "none",
          collection_method: "charge_automatically",
          automatic_tax: { enabled: true },
          default_payment_method: paymentMethod,
          metadata: {
            trial_cohort: "trial_v1",
            trial_enrollment_id: op.enrollment_id,
            trial_continuation_operation_id: op.id,
            trial_original_agreement_id: op.original_agreement_id,
            trial_continuation_role: "paid_successor",
          },
        },
        { idempotencyKey: `trial-continuation:${op.id}:create:v1` },
      )
    }
    requireFact(
      successor.id !== original.id &&
        matches(successor, op, runtime, offer) &&
        successor.metadata.trial_continuation_operation_id === op.id &&
        successor.metadata.trial_original_agreement_id === op.original_agreement_id,
    )
    await checkpoint("observed", successor.id)
    if (!(await allowed())) {
      await cancelSuccessor(successor)
      await checkpoint("canceled")
      return "canceled"
    }
    // A malformed provider result must never remain an unintended renewal.
    const correct =
      successor.status === "active" &&
      !successor.cancel_at_period_end &&
      successor.cancel_at == null &&
      successor.billing_cycle_anchor === anchor &&
      successor.billing_mode.type === "flexible" &&
      successor.trial_start == null &&
      successor.trial_end == null &&
      !successor.discounts.length &&
      successor.items.data[0].current_period_end === anchor &&
      id(successor.default_payment_method) === paymentMethod
    if (!correct) {
      await cancelSuccessor(successor)
      return "pending"
    }
    const immediate = await stripe.invoices.list({ subscription: successor.id, limit: 100 })
    if (immediate.has_more || immediate.data.length !== 0) {
      await cancelSuccessor(successor)
      return "pending"
    }
    const bound = await rpc("confirm_trial_paid_continuation", {
      p_enrollment_id: op.enrollment_id,
      p_provider: "stripe",
      p_original_agreement_id: op.original_agreement_id,
      p_continuation_agreement_id: successor.id,
      p_customer_id: op.customer_id,
      p_source_object_id: op.source_object_id,
      p_paid_through_at: op.paid_through_at,
      p_operation_id: op.id,
    })
    // An RPC transport failure is ambiguous: binding may have committed. Leave
    // the durable operation for an idempotent bind retry; only a definite CAS
    // rejection authorizes compensating cancellation.
    if (bound.error) return "pending"
    if (bound.data !== true) {
      await cancelSuccessor(successor)
      return "pending"
    }
    await checkpoint("resolved")
    return "resolved"
  } catch {
    return "pending"
  }
}
