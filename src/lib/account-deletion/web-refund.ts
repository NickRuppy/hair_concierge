import "server-only"
import type { PayPalPlan, PayPalSubscription } from "@/lib/paypal/subscription-shapes"
import type { PayPalTrialTransaction } from "@/lib/paypal/trial-runtime"
import type { WebRefundDue, WebRefundOutcome } from "./service"

/**
 * D14: the unused, prepaid part of a web subscription cancelled by an account deletion is
 * refunded pro rata to the original payment method. "Now" is the provider's own end time of
 * the subscription (our immediate cancellation), so a retry days later refunds the same
 * amount; the idempotency key (request id + subscription id) and the provider's
 * already-refunded state keep retries from refunding twice.
 */

/** A subscription that already ended before this deletion began is not ours to refund. */
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
) {
  return `account-deletion-refund-${refund.requestId}-${refund.subscriptionId}`
}

const NOTHING: WebRefundOutcome = { refundedMinor: 0, paymentRef: null }

function endedBeforeDeletion(endedAt: number, refund: WebRefundDue) {
  return endedAt < Date.parse(refund.recordedAt) - ENDED_BEFORE_DELETION_SLACK_MS
}

type Id = string | { id: string } | null | undefined
const idOf = (value: Id) => (typeof value === "string" ? value : (value?.id ?? null))

export type StripeRefundApi = {
  subscriptions: {
    retrieve(id: string): Promise<{ status: string; ended_at: number | null; latest_invoice: Id }>
  }
  invoices: {
    retrieve(id: string): Promise<{
      status: string | null
      amount_paid: number
      lines: { data: { period: { start: number; end: number } }[] }
    }>
  }
  invoicePayments: {
    list(params: {
      invoice: string
      status: "paid"
      limit: number
    }): Promise<{ data: { payment: { type: string; payment_intent?: Id } }[] }>
  }
  refunds: {
    list(params: { payment_intent: string; limit: number }): Promise<{ data: unknown[] }>
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

export async function refundStripeSubscriptionWith(
  refund: WebRefundDue,
  stripe: StripeRefundApi,
): Promise<WebRefundOutcome> {
  const subscription = await stripe.subscriptions.retrieve(refund.subscriptionId)
  if (!STRIPE_ENDED.has(subscription.status) || subscription.ended_at === null)
    throw new Error("Stripe subscription is not cancelled yet")
  const endedAt = subscription.ended_at * 1000
  if (endedBeforeDeletion(endedAt, refund)) return NOTHING
  const invoiceId = idOf(subscription.latest_invoice)
  if (!invoiceId) return NOTHING
  const invoice = await stripe.invoices.retrieve(invoiceId)
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
  const payments = await stripe.invoicePayments.list({
    invoice: invoiceId,
    status: "paid",
    limit: 10,
  })
  const paymentIntent = payments.data
    .filter((entry) => entry.payment.type === "payment_intent")
    .map((entry) => idOf(entry.payment.payment_intent))
    .find(Boolean)
  if (!paymentIntent) throw new Error("Stripe invoice payment has no PaymentIntent")
  // Already refunded (support, or a retry after the idempotency window): never twice.
  const existing = await stripe.refunds.list({ payment_intent: paymentIntent, limit: 1 })
  if (existing.data.length) return { refundedMinor: 0, paymentRef: paymentIntent }
  await stripe.refunds.create(
    {
      payment_intent: paymentIntent,
      amount,
      reason: "requested_by_customer",
      metadata: { source: "account_deletion" },
    },
    { idempotencyKey: webRefundIdempotencyKey(refund) },
  )
  return { refundedMinor: amount, paymentRef: paymentIntent }
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
/** Payments that settle a period; a refunded one means we (or support) refunded already. */
const PAYPAL_SETTLED = new Set(["COMPLETED", "PARTIALLY_REFUNDED", "REFUNDED"])
/** Day-after collection and PayPal's retries shift a payment after its period start. */
const PAYPAL_PAYMENT_WINDOW_SLACK_DAYS = 10

function addInterval(start: number, unit: string, count: number): number {
  const date = new Date(start)
  if (unit === "DAY") date.setUTCDate(date.getUTCDate() + count)
  else if (unit === "WEEK") date.setUTCDate(date.getUTCDate() + 7 * count)
  else if (unit === "MONTH") date.setUTCMonth(date.getUTCMonth() + count)
  else if (unit === "YEAR") date.setUTCFullYear(date.getUTCFullYear() + count)
  else throw new Error("Unknown PayPal billing interval")
  return date.getTime()
}

export async function refundPayPalSubscriptionWith(
  refund: WebRefundDue,
  paypal: PayPalRefundApi,
): Promise<WebRefundOutcome> {
  const subscription = await paypal.retrieve(refund.subscriptionId)
  const endedAt = Date.parse(subscription.status_update_time ?? "")
  if (!PAYPAL_ENDED.has(subscription.status ?? "") || !Number.isFinite(endedAt))
    throw new Error("PayPal subscription is not cancelled yet")
  if (subscription.status === "EXPIRED" || endedBeforeDeletion(endedAt, refund)) return NOTHING
  if (!subscription.plan_id) throw new Error("PayPal subscription has no plan")
  const frequency = (await paypal.plan(subscription.plan_id)).billing_cycles?.find(
    (cycle) => cycle.tenure_type === "REGULAR",
  )?.frequency
  if (!frequency?.interval_unit) throw new Error("PayPal plan has no regular billing cycle")
  const unit = frequency.interval_unit
  const count = frequency.interval_count ?? 1
  // Only a payment within one billing interval before the cancellation can cover it.
  const from = addInterval(endedAt, unit, -count) - PAYPAL_PAYMENT_WINDOW_SLACK_DAYS * 86_400_000
  const settled = (
    await paypal.transactions(
      refund.subscriptionId,
      new Date(from).toISOString(),
      new Date(endedAt + 60_000).toISOString(),
    )
  )
    .filter(
      (tx) => PAYPAL_SETTLED.has(tx.status ?? "") && Number.isFinite(Date.parse(tx.time ?? "")),
    )
    .sort((a, b) => Date.parse(b.time!) - Date.parse(a.time!))
  const last = settled[0]
  // Trial without a completed payment: cancel only.
  if (!last?.id) return NOTHING
  if (last.status !== "COMPLETED") return { refundedMinor: 0, paymentRef: last.id }
  const gross = last.amount_with_breakdown?.gross_amount
  const paidMinor = Math.round(Number(gross?.value) * 100)
  if (!gross?.currency_code || !Number.isFinite(paidMinor)) throw new Error("PayPal payment amount")
  const periodStart = Date.parse(last.time!)
  const amount = proRataRefundMinor({
    paidMinor,
    periodStart,
    periodEnd: addInterval(periodStart, unit, count),
    endedAt,
  })
  if (amount <= 0) return NOTHING
  await paypal.refund(
    last.id,
    { value: (amount / 100).toFixed(2), currency_code: gross.currency_code },
    webRefundIdempotencyKey(refund),
  )
  return { refundedMinor: amount, paymentRef: last.id }
}
