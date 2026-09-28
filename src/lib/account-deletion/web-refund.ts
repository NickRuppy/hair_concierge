import "server-only"
import type { PayPalPlan, PayPalSubscription } from "@/lib/paypal/subscription-shapes"
import type { PayPalTrialTransaction } from "@/lib/paypal/trial-runtime"
import {
  AccountDeletionRefundManualError,
  AccountDeletionRefundPendingError,
  type WebRefundDue,
  type WebRefundHooks,
  type WebRefundOutcome,
} from "./service"

/**
 * Refunds for web subscriptions an account deletion cancelled.
 *
 * - `deletion` (D14): the unused, prepaid part of the last payment, pro rata. "Now" is the
 *   provider's own end time of the subscription (our immediate cancellation), so a retry days
 *   later refunds the same amount.
 * - `post_deletion` (R-a): a subscription that went live only after its account was deleted
 *   (checkout in flight) — every payment made at/after the deletion (`paymentsFrom`) is
 *   refunded in full; the customer never had access.
 *
 * A payment in scope that is still pending (PayPal PENDING, Stripe PaymentIntent processing)
 * keeps the refund due: it settles only once every payment in scope is final.
 *
 * Never twice: provider idempotency keys derive from the stored request id + subscription
 * (+ payment); our own earlier refund is recognised on the provider (Stripe metadata, PayPal
 * planned payment) and recorded with its actual amount; a refund by someone else counts as
 * settled. Never-billed or unknown subscriptions resolve to "nothing to refund".
 */

/** A subscription that already ended before this deletion recorded it is not ours to refund. */
const ENDED_BEFORE_DELETION_SLACK_MS = 5 * 60_000

export function proRataRefundMinor(input: {
  paidMinor: number
  periodStart: number
  periodEnd: number
  endedAt: number
}): number {
  const total = input.periodEnd - input.periodStart
  if (!(input.paidMinor > 0) || !(total > 0)) return 0
  const unused = Math.min(total, Math.max(0, input.periodEnd - input.endedAt))
  return Math.floor((input.paidMinor * unused) / total)
}

export function webRefundIdempotencyKey(
  refund: Pick<WebRefundDue, "requestId" | "subscriptionId">,
  paymentRef?: string,
) {
  const base = `account-deletion-refund-${refund.requestId}-${refund.subscriptionId}`
  return paymentRef ? `${base}-${paymentRef}` : base
}

/** Calendar-safe: Jan 31 + 1 month = Feb 28/29 (the day is clamped to the target month). */
export function addBillingInterval(start: number, unit: string, count: number): number {
  const date = new Date(start)
  if (unit === "DAY") return start + count * 86_400_000
  if (unit === "WEEK") return start + count * 7 * 86_400_000
  const months = unit === "MONTH" ? count : unit === "YEAR" ? 12 * count : null
  if (months === null) throw new AccountDeletionRefundManualError("Unknown billing interval")
  const target = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth() + months,
      1,
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
      date.getUTCMilliseconds(),
    ),
  )
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate()
  target.setUTCDate(Math.min(date.getUTCDate(), lastDay))
  return target.getTime()
}

const NOTHING: WebRefundOutcome = { refundedMinor: 0, paymentRef: null }

function endedBeforeDeletion(endedAt: number, refund: WebRefundDue) {
  return endedAt < Date.parse(refund.recordedAt) - ENDED_BEFORE_DELETION_SLACK_MS
}

type Id = string | { id: string } | null | undefined
const idOf = (value: Id) => (typeof value === "string" ? value : (value?.id ?? null))

type StripeRefund = {
  amount: number
  status: string | null
  metadata: Record<string, string> | null
}
type StripeInvoice = {
  id: string
  status: string | null
  amount_paid: number
  created: number
  status_transitions: { paid_at: number | null }
  lines: { data: { period: { start: number; end: number } }[] }
}

export type StripeRefundApi = {
  subscriptions: {
    retrieve(id: string): Promise<{ status: string; ended_at: number | null; latest_invoice: Id }>
  }
  invoices: {
    retrieve(id: string): Promise<StripeInvoice>
    list(params: {
      subscription: string
      limit: number
    }): Promise<{ data: StripeInvoice[]; has_more: boolean }>
  }
  invoicePayments: {
    list(params: {
      invoice: string
      status: "paid" | "open"
      limit: number
    }): Promise<{ data: { payment: { type: string; payment_intent?: Id } }[] }>
  }
  paymentIntents: {
    retrieve(id: string): Promise<{ status: string }>
  }
  refunds: {
    list(params: {
      payment_intent: string
      limit: number
    }): Promise<{ data: StripeRefund[]; has_more: boolean }>
    create(
      params: {
        payment_intent: string
        amount: number
        reason: "requested_by_customer"
        metadata: Record<string, string>
      },
      options: { idempotencyKey: string },
    ): Promise<{ id: string }>
  }
}

const STRIPE_ENDED = new Set(["canceled", "incomplete_expired"])
/** A failed or cancelled refund returned nothing; it must not count as refunded. */
const STRIPE_REFUND_COUNTS = new Set(["succeeded", "pending", "requires_action"])
const STRIPE_PERMANENT = new Set(["charge_disputed", "charge_already_refunded"])

async function stripeSubscription(stripe: StripeRefundApi, id: string) {
  try {
    return await stripe.subscriptions.retrieve(id)
  } catch (error) {
    if ((error as { code?: unknown }).code === "resource_missing") return null
    throw error
  }
}

async function stripePaymentIntent(stripe: StripeRefundApi, invoiceId: string) {
  const payments = await stripe.invoicePayments.list({
    invoice: invoiceId,
    status: "paid",
    limit: 10,
  })
  const intent = payments.data
    .filter((entry) => entry.payment.type === "payment_intent")
    .map((entry) => idOf(entry.payment.payment_intent))
    .find(Boolean)
  if (!intent) throw new AccountDeletionRefundManualError("Stripe payment is not a PaymentIntent")
  return intent
}

/** m4: an open invoice whose payment is still processing (e.g. SEPA) may yet be paid. */
async function stripeInvoiceProcessing(stripe: StripeRefundApi, invoiceId: string) {
  const payments = await stripe.invoicePayments.list({
    invoice: invoiceId,
    status: "open",
    limit: 10,
  })
  for (const entry of payments.data) {
    const intent = entry.payment.type === "payment_intent" && idOf(entry.payment.payment_intent)
    if (intent && (await stripe.paymentIntents.retrieve(intent)).status === "processing")
      return true
  }
  return false
}

/** Refunds already on the PaymentIntent: ours (metadata) and in total (counting ones only). */
async function stripeExistingRefunds(
  stripe: StripeRefundApi,
  intent: string,
  refund: WebRefundDue,
) {
  const refunds = await stripe.refunds.list({ payment_intent: intent, limit: 100 })
  if (refunds.has_more) throw new AccountDeletionRefundManualError("Too many Stripe refunds")
  const counting = refunds.data.filter((r) => STRIPE_REFUND_COUNTS.has(r.status ?? ""))
  const sum = (list: StripeRefund[]) => list.reduce((total, r) => total + r.amount, 0)
  return {
    ours: sum(
      counting.filter(
        (r) =>
          r.metadata?.source === "account_deletion" &&
          r.metadata?.request_id === refund.requestId &&
          r.metadata?.subscription_id === refund.subscriptionId,
      ),
    ),
    total: sum(counting),
  }
}

async function createStripeRefund(
  stripe: StripeRefundApi,
  refund: WebRefundDue,
  intent: string,
  amount: number,
  idempotencyKey: string,
) {
  try {
    await stripe.refunds.create(
      {
        payment_intent: intent,
        amount,
        reason: "requested_by_customer",
        metadata: {
          source: "account_deletion",
          kind: refund.kind,
          request_id: refund.requestId,
          subscription_id: refund.subscriptionId,
        },
      },
      { idempotencyKey },
    )
  } catch (error) {
    if (STRIPE_PERMANENT.has(String((error as { code?: unknown }).code)))
      throw new AccountDeletionRefundManualError("Stripe refused the refund permanently")
    throw error
  }
}

export async function refundStripeSubscriptionWith(
  refund: WebRefundDue,
  stripe: StripeRefundApi,
): Promise<WebRefundOutcome> {
  const subscription = await stripeSubscription(stripe, refund.subscriptionId)
  // Unknown to Stripe (never created/billed): nothing to refund.
  if (!subscription) return NOTHING
  if (!STRIPE_ENDED.has(subscription.status) || subscription.ended_at === null)
    throw new Error("Stripe subscription is not cancelled yet")
  if (refund.kind === "post_deletion") return refundAllStripePayments(refund, stripe)

  const endedAt = subscription.ended_at * 1000
  if (endedBeforeDeletion(endedAt, refund)) return NOTHING
  const invoiceId = idOf(subscription.latest_invoice)
  if (!invoiceId) return NOTHING
  const invoice = await stripe.invoices.retrieve(invoiceId)
  if (invoice.status === "open" && (await stripeInvoiceProcessing(stripe, invoiceId)))
    throw new AccountDeletionRefundPendingError("Stripe payment is still processing")
  // A trial's €0 invoice, or an unpaid renewal: nothing prepaid.
  if (invoice.status !== "paid" || invoice.amount_paid <= 0) return NOTHING
  const period = invoice.lines.data.map((line) => line.period).sort((a, b) => b.end - a.end)[0]
  if (!period) return NOTHING
  const amount = proRataRefundMinor({
    paidMinor: invoice.amount_paid,
    periodStart: period.start * 1000,
    periodEnd: period.end * 1000,
    endedAt,
  })
  if (amount <= 0) return NOTHING
  const intent = await stripePaymentIntent(stripe, invoiceId)
  const existing = await stripeExistingRefunds(stripe, intent, refund)
  // Ours (a retry after a lost result): record what was actually refunded.
  if (existing.ours > 0) return { refundedMinor: existing.ours, paymentRef: intent }
  // Refunded by someone else (support): never on top.
  if (existing.total > 0) return { refundedMinor: 0, paymentRef: intent }
  await createStripeRefund(stripe, refund, intent, amount, webRefundIdempotencyKey(refund))
  return { refundedMinor: amount, paymentRef: intent }
}

async function refundAllStripePayments(
  refund: WebRefundDue,
  stripe: StripeRefundApi,
): Promise<WebRefundOutcome> {
  const invoices = await stripe.invoices.list({ subscription: refund.subscriptionId, limit: 100 })
  if (invoices.has_more) throw new AccountDeletionRefundManualError("Too many Stripe invoices")
  const from = paymentsFrom(refund)
  let refunded = 0
  let paymentRef: string | null = null
  let pending = false
  for (const invoice of invoices.data) {
    if (invoice.status === "open") {
      if (await stripeInvoiceProcessing(stripe, invoice.id)) pending = true
      continue
    }
    const paidAt = (invoice.status_transitions.paid_at ?? invoice.created) * 1000
    // I-2: only payments made at/after the deletion; earlier ones were not ours to take back.
    if (invoice.status !== "paid" || invoice.amount_paid <= 0 || paidAt < from) continue
    const intent = await stripePaymentIntent(stripe, invoice.id)
    const existing = await stripeExistingRefunds(stripe, intent, refund)
    const remaining = invoice.amount_paid - existing.total
    refunded += existing.ours
    paymentRef = intent
    if (remaining <= 0) continue
    await createStripeRefund(
      stripe,
      refund,
      intent,
      remaining,
      webRefundIdempotencyKey(refund, intent),
    )
    refunded += remaining
  }
  // Refunds made so far are recognised on the retry (metadata); settle once all are final.
  if (pending) throw new AccountDeletionRefundPendingError("Stripe payment is still processing")
  return { refundedMinor: refunded, paymentRef }
}

function paymentsFrom(refund: WebRefundDue) {
  const from = Date.parse(refund.paymentsFrom ?? "")
  if (!Number.isFinite(from))
    throw new AccountDeletionRefundManualError("Post-deletion refund without a deletion time")
  return from
}

export type PayPalRefundApi = {
  retrieve(id: string): Promise<PayPalSubscription>
  plan(id: string): Promise<PayPalPlan>
  transactions(id: string, from: string, to: string): Promise<PayPalTrialTransaction[]>
  refund(
    transactionId: string,
    amount: { value: string; currency_code: string },
    requestId: string,
  ): Promise<void>
}

const PAYPAL_ENDED = new Set(["CANCELLED", "EXPIRED"])
/** Agreements the payer never approved/activated: never billed. */
const PAYPAL_NEVER_BILLED = new Set(["APPROVAL_PENDING", "APPROVED"])
/** Payments that settle a period; a refunded one means we (or support) refunded already. */
const PAYPAL_SETTLED = new Set(["COMPLETED", "PARTIALLY_REFUNDED", "REFUNDED"])
/** m4: may still complete; the refund waits until it is final. */
const PAYPAL_PENDING = "PENDING"
/** Day-after collection and PayPal's retries shift a payment after its period start. */
const PAYPAL_PAYMENT_WINDOW_SLACK_DAYS = 10
const DAY_MS = 86_400_000

async function paypalSubscription(paypal: PayPalRefundApi, id: string) {
  try {
    return await paypal.retrieve(id)
  } catch (error) {
    if ((error as { status?: unknown }).status === 404) return null
    throw error
  }
}

function paypalMinor(tx: PayPalTrialTransaction) {
  const gross = tx.amount_with_breakdown?.gross_amount
  const minor = Math.round(Number(gross?.value) * 100)
  if (!gross?.currency_code || !Number.isFinite(minor) || minor <= 0)
    throw new AccountDeletionRefundManualError("PayPal payment amount")
  return { minor, currency: gross.currency_code }
}

const paypalValue = (minor: number) => (minor / 100).toFixed(2)
const timeOf = (tx: PayPalTrialTransaction) => Date.parse(tx.time ?? "")

export async function refundPayPalSubscriptionWith(
  refund: WebRefundDue,
  paypal: PayPalRefundApi,
  hooks: WebRefundHooks,
): Promise<WebRefundOutcome> {
  const subscription = await paypalSubscription(paypal, refund.subscriptionId)
  if (!subscription || PAYPAL_NEVER_BILLED.has(subscription.status ?? "")) return NOTHING
  const endedAt = Date.parse(subscription.status_update_time ?? "")
  if (!PAYPAL_ENDED.has(subscription.status ?? "") || !Number.isFinite(endedAt))
    throw new Error("PayPal subscription is not cancelled yet")
  if (refund.kind === "post_deletion") return refundAllPayPalPayments(refund, paypal, hooks)
  if (subscription.status === "EXPIRED" || endedBeforeDeletion(endedAt, refund)) return NOTHING
  if (!subscription.plan_id)
    throw new AccountDeletionRefundManualError("PayPal subscription has no plan")
  const frequency = (await paypal.plan(subscription.plan_id)).billing_cycles?.find(
    (cycle) => cycle.tenure_type === "REGULAR",
  )?.frequency
  if (!frequency?.interval_unit)
    throw new AccountDeletionRefundManualError("PayPal plan has no regular billing cycle")
  const unit = frequency.interval_unit
  const count = frequency.interval_count ?? 1
  // Only a payment within one billing interval before the cancellation can cover it.
  const from = addBillingInterval(endedAt, unit, -count) - PAYPAL_PAYMENT_WINDOW_SLACK_DAYS * DAY_MS
  const settled = (
    await paypal.transactions(
      refund.subscriptionId,
      new Date(from).toISOString(),
      new Date(endedAt + 60_000).toISOString(),
    )
  )
    .filter(
      (tx) =>
        (PAYPAL_SETTLED.has(tx.status ?? "") || tx.status === PAYPAL_PENDING) &&
        Number.isFinite(timeOf(tx)),
    )
    .sort((a, b) => timeOf(b) - timeOf(a))
  const last = settled[0]
  if (last?.status === PAYPAL_PENDING)
    throw new AccountDeletionRefundPendingError("PayPal payment is still pending")
  // Trial without a completed payment: cancel only.
  if (!last?.id) return NOTHING
  if (last.status !== "COMPLETED")
    // Ours (a retry after a lost result) or someone else's refund: never on top.
    return refund.plannedPaymentRef === last.id && refund.plannedMinor
      ? { refundedMinor: refund.plannedMinor, paymentRef: last.id }
      : { refundedMinor: 0, paymentRef: last.id }
  const paid = paypalMinor(last)
  // M5: the agreement's billing cycle anchors the paid period where PayPal still reports it.
  const paidAt = timeOf(last)
  const nextBilling = Date.parse(subscription.billing_info?.next_billing_time ?? "")
  const anchored = Number.isFinite(nextBilling) && nextBilling > paidAt
  const periodEnd = anchored ? nextBilling : addBillingInterval(paidAt, unit, count)
  // A late (day-after) collection belongs to the cycle that ends at the next billing time.
  const periodStart = anchored
    ? Math.min(paidAt, addBillingInterval(periodEnd, unit, -count))
    : paidAt
  const amount = proRataRefundMinor({ paidMinor: paid.minor, periodStart, periodEnd, endedAt })
  if (amount <= 0) return NOTHING
  // M4: PayPal cannot list a sale's refunds; the stored plan recognises ours on a retry.
  await hooks.plan({ amountMinor: amount, paymentRef: last.id })
  return refundPayPalPayment(paypal, refund, last.id, amount, paid.currency, false)
}

async function refundPayPalPayment(
  paypal: PayPalRefundApi,
  refund: WebRefundDue,
  transactionId: string,
  amount: number,
  currency: string,
  perPayment: boolean,
): Promise<WebRefundOutcome> {
  await paypal.refund(
    transactionId,
    { value: paypalValue(amount), currency_code: currency },
    webRefundIdempotencyKey(refund, perPayment ? transactionId : undefined),
  )
  return { refundedMinor: amount, paymentRef: transactionId }
}

async function refundAllPayPalPayments(
  refund: WebRefundDue,
  paypal: PayPalRefundApi,
  hooks: WebRefundHooks,
): Promise<WebRefundOutcome> {
  const from = paymentsFrom(refund)
  const transactions = await paypal.transactions(
    refund.subscriptionId,
    new Date(from - DAY_MS).toISOString(),
    new Date().toISOString(),
  )
  let refunded = 0
  let paymentRef: string | null = null
  let pending = false
  for (const tx of transactions) {
    // I-2: only payments made at/after the deletion.
    if (!tx.id || !(timeOf(tx) >= from)) continue
    // Fully refunded (by us on an earlier attempt, or by support): the payer has it back.
    if (tx.status === "REFUNDED") {
      refunded += paypalMinor(tx).minor
      paymentRef = tx.id
    } else if (tx.status === "PARTIALLY_REFUNDED") {
      throw new AccountDeletionRefundManualError("PayPal payment partially refunded")
    } else if (tx.status === PAYPAL_PENDING) {
      pending = true
    } else if (tx.status === "COMPLETED") {
      const paid = paypalMinor(tx)
      // m3: every refunded payment is stored, so each of its refund webhooks is recognised.
      await hooks.plan({ amountMinor: paid.minor, paymentRef: tx.id })
      refunded += (
        await refundPayPalPayment(paypal, refund, tx.id, paid.minor, paid.currency, true)
      ).refundedMinor
      paymentRef = tx.id
    }
  }
  // Completed payments are refunded (REFUNDED on the retry); settle once none is pending.
  if (pending) throw new AccountDeletionRefundPendingError("PayPal payment is still pending")
  return { refundedMinor: refunded, paymentRef }
}
