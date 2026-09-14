import "server-only"

import type Stripe from "stripe"
import type { SupabaseClient } from "@supabase/supabase-js"
import { findBillingSubscriptionByProviderId } from "../billing/subscriptions"
import { readTrialEffectiveContract } from "../billing/trial-effective-contract"
import { readTrialRuntime, type TrialRuntime } from "../billing/trial-runtime"
import {
  recordTrialPaymentEvent,
  type TrialPaymentEventResult,
} from "../billing/trial-payment-events"

function id(value: string | { id: string } | null | undefined): string | null {
  return typeof value === "string" ? value : (value?.id ?? null)
}

function marked(metadata: Stripe.Metadata | null | undefined): boolean {
  return Boolean(metadata && Object.keys(metadata).some((key) => key.startsWith("trial_")))
}

function subscriptionId(invoice: Stripe.Invoice): string | null {
  const legacy = invoice as Stripe.Invoice & { subscription?: string | { id: string } | null }
  return id(invoice.parent?.subscription_details?.subscription) ?? id(legacy.subscription)
}

function instant(seconds: number | null | undefined): string {
  if (!Number.isSafeInteger(seconds) || seconds! <= 0)
    throw new Error("Trial invoice timestamp invalid")
  return new Date(seconds! * 1000).toISOString()
}

export class TrialInvoiceReconciliationRequired extends Error {
  constructor() {
    super("Trial invoice requires reconciliation")
    this.name = "TrialInvoiceReconciliationRequired"
  }
}

function requireFact(value: unknown): asserts value {
  if (!value) throw new TrialInvoiceReconciliationRequired()
}

export type TrialInvoiceResult = {
  enrollmentId: string
  userId: string
  customerId: string
  subscriptionId: string
  invoiceId: string
  interval: "month" | "year"
  payment: { amountMinor: number; occurredAt: string; result: TrialPaymentEventResult } | null
}

/**
 * Runs before legacy invoice handlers. Null means positively identified legacy;
 * every incomplete trial candidate throws, releasing the webhook claim for retry.
 * No provider writes occur here. In particular an unchanged renewal date after a
 * delayed first payment is reconciliation work, never an invented access period.
 */
export async function handleStripeTrialInvoice(
  input: {
    invoice: Stripe.Invoice
    eventId: string
    eventCreated: number
    outcome: "succeeded" | "failed"
  },
  deps: {
    supabase: SupabaseClient
    stripe: Stripe
    runtime?: TrialRuntime | null
    recordPayment?: typeof recordTrialPaymentEvent
  },
): Promise<TrialInvoiceResult | null> {
  const agreementId = subscriptionId(input.invoice)
  const invoiceMarker =
    marked(input.invoice.metadata) || marked(input.invoice.parent?.subscription_details?.metadata)
  if (!agreementId) {
    requireFact(!invoiceMarker)
    return null
  }
  let billing = await findBillingSubscriptionByProviderId(deps.supabase, "stripe", agreementId)
  const runtime = deps.runtime === undefined ? readTrialRuntime() : deps.runtime
  // Existing live paid subscriptions must keep working with the rollout disabled.
  if (!billing?.trial_enrollment_id && !invoiceMarker && !runtime) return null

  const subscription = await deps.stripe.subscriptions.retrieve(agreementId)
  if (!billing?.trial_enrollment_id && !invoiceMarker && !marked(subscription.metadata)) return null
  let originalAgreementId = agreementId
  let hasContinuation = false
  if (
    subscription.metadata.trial_continuation_role === "paid_successor" ||
    subscription.metadata.trial_paid_recovery_role === "candidate"
  ) {
    const linked = await deps.supabase.rpc("lookup_trial_paid_continuation", {
      p_provider: "stripe",
      p_agreement_id: agreementId,
    })
    const continuation = linked.data
    requireFact(
      !linked.error &&
        continuation &&
        typeof continuation === "object" &&
        continuation.continuation_agreement_id === agreementId &&
        continuation.original_agreement_id === subscription.metadata.trial_original_agreement_id &&
        continuation.operation_id ===
          (subscription.metadata.trial_continuation_role === "paid_successor"
            ? subscription.metadata.trial_continuation_operation_id
            : subscription.metadata.trial_paid_recovery_operation_id) &&
        continuation.enrollment_id === subscription.metadata.trial_enrollment_id &&
        continuation.customer_id === id(subscription.customer),
    )
    originalAgreementId = continuation.original_agreement_id
    hasContinuation = true
    billing = await findBillingSubscriptionByProviderId(
      deps.supabase,
      "stripe",
      originalAgreementId,
    )
  }
  if (!billing?.trial_enrollment_id && subscription.metadata.trial_enrollment_id) {
    const candidate = await deps.supabase
      .from("trial_enrollments")
      .select("id,provider,provider_agreement_id")
      .eq("id", subscription.metadata.trial_enrollment_id)
      .maybeSingle()
    requireFact(
      !candidate.error &&
        candidate.data?.provider === "stripe" &&
        candidate.data.provider_agreement_id,
    )
    const effective = await readTrialEffectiveContract(deps.supabase, candidate.data.id)
    requireFact(effective.provider === "stripe" && effective.agreementId === agreementId)
    originalAgreementId = candidate.data.provider_agreement_id
    billing = await findBillingSubscriptionByProviderId(
      deps.supabase,
      "stripe",
      originalAgreementId,
    )
  }
  requireFact(runtime && billing?.trial_enrollment_id && billing.user_id)
  const enrollmentId = billing.trial_enrollment_id
  const { data: enrollment, error } = await deps.supabase
    .from("trial_enrollments")
    .select(
      "id,user_id,provider,provider_agreement_id,accepted_offer,admission_status,original_trial_end_at",
    )
    .eq("id", enrollmentId)
    .maybeSingle()
  if (error) throw error
  const effective = await readTrialEffectiveContract(deps.supabase, enrollmentId)
  const offer = effective.offer
  requireFact(
    offer &&
      enrollment?.user_id === billing.user_id &&
      enrollment?.provider === "stripe" &&
      enrollment?.provider_agreement_id === originalAgreementId &&
      enrollment?.admission_status === "active" &&
      effective.provider === "stripe",
  )
  const account = await deps.stripe.accounts.retrieve(null)
  requireFact(
    account.id === runtime.stripeAccountId &&
      subscription.id === agreementId &&
      subscription.livemode === runtime.livemode &&
      subscription.metadata.trial_cohort === "trial_v1" &&
      subscription.metadata.trial_enrollment_id === enrollmentId &&
      id(subscription.customer) === billing.provider_customer_id,
  )

  const invoice = await deps.stripe.invoices.retrieve(input.invoice.id)
  requireFact(
    invoice.id === input.invoice.id &&
      invoice.livemode === runtime.livemode &&
      subscriptionId(invoice) === agreementId &&
      id(invoice.customer) === billing.provider_customer_id &&
      invoice.currency === "eur" &&
      invoice.collection_method === "charge_automatically",
  )
  const base: TrialInvoiceResult = {
    enrollmentId,
    userId: billing.user_id,
    customerId: billing.provider_customer_id!,
    subscriptionId: agreementId,
    invoiceId: invoice.id,
    interval: offer.interval,
    payment: null,
  }
  // The zero authorization invoice is not a purchase, paid access, or a failure.
  if (
    invoice.billing_reason === "subscription_create" &&
    invoice.amount_due === 0 &&
    invoice.amount_paid === 0
  )
    return base
  requireFact(hasContinuation || effective.agreementId === agreementId)

  requireFact(
    invoice.lines.has_more === false &&
      invoice.lines.data.length === 1 &&
      subscription.items.has_more === false &&
      subscription.items.data.length === 1,
  )
  const line = invoice.lines.data[0]
  const item = subscription.items.data[0]
  const details = line.parent?.subscription_item_details
  requireFact(
    details?.subscription === agreementId &&
      details.subscription_item === item.id &&
      details.proration === false &&
      line.quantity === 1 &&
      id(line.pricing?.price_details?.price) === offer.stripePriceId &&
      item.price.id === offer.stripePriceId &&
      item.quantity === 1 &&
      item.price.currency === "eur" &&
      item.price.tax_behavior === "inclusive" &&
      item.price.unit_amount === offer.renewalAmountMinor &&
      item.price.recurring?.interval === offer.interval &&
      item.price.recurring.interval_count === 1 &&
      line.period.end > line.period.start,
  )
  // Old invoice events can still be deduplicated by the ledger. An invoice cannot
  // establish service beyond the retrieved provider subscription's actual end.
  requireFact(line.period.end <= item.current_period_end)
  const succeeded = invoice.status === "paid"
  let repairedSource = false
  const repairId = subscription.metadata.trial_continuation_operation_id
  if (
    subscription.status === "canceled" &&
    succeeded &&
    repairId &&
    subscription.cancellation_details?.comment === `trial-paid-continuation:${repairId}` &&
    !hasContinuation
  ) {
    const source = await deps.supabase.rpc("is_trial_continuation_source_cancellation", {
      p_enrollment_id: enrollmentId,
      p_original_agreement_id: agreementId,
      p_customer_id: billing.provider_customer_id,
      p_operation_id: repairId,
    })
    repairedSource = !source.error && source.data === true
  }
  requireFact(
    repairedSource ||
      (["active", "past_due", "unpaid"].includes(subscription.status) &&
        !subscription.cancel_at_period_end &&
        subscription.cancel_at == null),
  )
  if (!succeeded) {
    requireFact(
      input.outcome === "failed" &&
        invoice.status === "open" &&
        invoice.amount_paid === 0 &&
        invoice.amount_due > 0 &&
        invoice.attempted &&
        invoice.attempt_count > 0,
    )
  }
  let occurredAt = instant(input.eventCreated)
  if (succeeded) {
    requireFact(
      invoice.amount_paid > 0 &&
        invoice.amount_paid === invoice.amount_due &&
        invoice.amount_remaining === 0,
    )
    const payments = await deps.stripe.invoicePayments.list({
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
        payment.payment.type === "payment_intent" &&
        intentId,
    )
    const intent = await deps.stripe.paymentIntents.retrieve(intentId, {
      expand: ["latest_charge"],
    })
    const charge = intent.latest_charge
    requireFact(
      intent.id === intentId &&
        intent.livemode === runtime.livemode &&
        intent.status === "succeeded" &&
        id(intent.customer) === billing.provider_customer_id &&
        intent.currency === "eur" &&
        intent.amount_received === invoice.amount_paid &&
        charge &&
        typeof charge !== "string" &&
        charge.paid &&
        charge.captured &&
        !charge.disputed &&
        charge.amount_refunded === 0 &&
        charge.amount_captured === invoice.amount_paid,
    )
    occurredAt = instant(payment.status_transitions.paid_at)
  }
  const result = await (deps.recordPayment ?? recordTrialPaymentEvent)(deps.supabase, {
    provider: "stripe",
    enrollmentId,
    agreementId,
    sourceEventId: input.eventId,
    sourceObjectId: invoice.id,
    outcome: succeeded ? "succeeded" : "failed",
    occurredAt,
    amountMinor: succeeded ? invoice.amount_paid : invoice.amount_due,
    currency: "EUR",
    periodStartAt: instant(line.period.start),
    periodEndAt: instant(line.period.end),
  })
  // The ledger durably records ambiguous payments. Throw so a failed webhook is
  // retryable, including when a provider continuation is reconciled afterwards.
  requireFact(result.outcome !== "reconciliation_required")
  return {
    ...base,
    payment: succeeded ? { amountMinor: invoice.amount_paid, occurredAt, result } : null,
  }
}
