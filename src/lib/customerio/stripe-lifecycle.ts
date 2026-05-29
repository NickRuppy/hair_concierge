import type { CustomerIoServerProperties } from "@/lib/customerio/server"
import type { BillingInterval } from "@/lib/stripe/intervals"

type StripeId = string | { id?: string } | null | undefined

function idFrom(value: StripeId) {
  if (typeof value === "string") return value
  return value?.id
}

function amountFromCents(value: number | null | undefined) {
  return typeof value === "number" ? value / 100 : undefined
}

function upperCurrency(value: string | null | undefined) {
  return value ? value.toUpperCase() : undefined
}

export type CustomerIoLifecycleEvent = {
  event: string
  messageId: string
  properties: CustomerIoServerProperties
  timestamp: string
}

export function buildCustomerIoCheckoutCompletedSync({
  email,
  interval,
  planId,
  session,
  stripeEventId,
  subscriptionStatus,
  timestamp,
  userId,
}: {
  email: string
  interval: BillingInterval | string
  planId: string
  session: {
    id: string
    amount_total?: number | null
    currency?: string | null
    customer?: StripeId
    subscription?: StripeId
  }
  stripeEventId: string
  subscriptionStatus: string
  timestamp: string
  userId: string
}) {
  const stripeCustomerId = idFrom(session.customer)
  const stripeSubscriptionId = idFrom(session.subscription)
  const currency = upperCurrency(session.currency)
  const value = amountFromCents(session.amount_total)

  const identifyTraits: CustomerIoServerProperties = {
    email,
    is_customer: true,
    last_purchase_at: timestamp,
    subscription_interval: interval,
    subscription_started_at: timestamp,
    subscription_status: subscriptionStatus,
    stripe_customer_id: stripeCustomerId,
    stripe_subscription_id: stripeSubscriptionId,
  }

  return {
    userId,
    identifyTraits,
    identifyMessageId: `identify:stripe_checkout:${session.id}`,
    events: [
      {
        event: "purchase_completed",
        messageId: `purchase_completed:${session.id}`,
        properties: {
          source: "stripe_webhook",
          stripe_event_id: stripeEventId,
          checkout_session_id: session.id,
          stripe_customer_id: stripeCustomerId,
          stripe_subscription_id: stripeSubscriptionId,
          amount: value,
          currency,
          interval,
          plan_id: planId,
        },
        timestamp,
      },
      {
        event: "subscription_started",
        messageId: `subscription_started:${stripeSubscriptionId ?? session.id}`,
        properties: {
          source: "stripe_webhook",
          stripe_event_id: stripeEventId,
          checkout_session_id: session.id,
          stripe_customer_id: stripeCustomerId,
          stripe_subscription_id: stripeSubscriptionId,
          interval,
          plan_id: planId,
          subscription_status: subscriptionStatus,
        },
        timestamp,
      },
    ] satisfies CustomerIoLifecycleEvent[],
  }
}

export function buildCustomerIoInvoicePaymentFailedSync({
  email,
  invoice,
  stripeEventId,
  timestamp,
  userId,
}: {
  email?: string | null
  invoice: {
    id: string
    amount_due?: number | null
    attempt_count?: number | null
    currency?: string | null
    customer?: StripeId
    subscription?: StripeId
  }
  stripeEventId: string
  timestamp: string
  userId: string
}) {
  const stripeCustomerId = idFrom(invoice.customer)
  const stripeSubscriptionId = idFrom(invoice.subscription)

  return {
    userId,
    identifyTraits: {
      email: email ?? undefined,
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: stripeSubscriptionId,
    } satisfies CustomerIoServerProperties,
    identifyMessageId: `identify:payment_failed:${invoice.id}`,
    event: {
      event: "payment_failed",
      messageId: `payment_failed:${invoice.id}`,
      properties: {
        source: "stripe_webhook",
        stripe_event_id: stripeEventId,
        invoice_id: invoice.id,
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: stripeSubscriptionId,
        amount_due: amountFromCents(invoice.amount_due),
        currency: upperCurrency(invoice.currency),
        attempt_count: invoice.attempt_count ?? undefined,
        occurred_at: timestamp,
      },
      timestamp,
    } satisfies CustomerIoLifecycleEvent,
  }
}

export function buildCustomerIoSubscriptionLifecycleSync({
  email,
  eventType,
  interval,
  status,
  stripeCustomerId,
  stripeEventId,
  stripeSubscriptionId,
  timestamp,
  userId,
}: {
  email?: string | null
  eventType: "subscription_updated" | "subscription_cancelled"
  interval?: BillingInterval | string | null
  status: string
  stripeCustomerId: string
  stripeEventId: string
  stripeSubscriptionId: string
  timestamp: string
  userId: string
}) {
  const isCancelled = eventType === "subscription_cancelled"

  return {
    userId,
    identifyTraits: {
      email: email ?? undefined,
      is_customer: isCancelled ? false : undefined,
      subscription_interval: interval ?? undefined,
      subscription_status: status,
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: stripeSubscriptionId,
      ...(isCancelled ? { subscription_cancelled_at: timestamp } : {}),
    } satisfies CustomerIoServerProperties,
    identifyMessageId: `identify:${eventType}:${stripeSubscriptionId}:${stripeEventId}`,
    event: {
      event: eventType,
      messageId: `${eventType}:${stripeSubscriptionId}:${stripeEventId}`,
      properties: {
        source: "stripe_webhook",
        stripe_event_id: stripeEventId,
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: stripeSubscriptionId,
        interval: interval ?? undefined,
        subscription_status: status,
        occurred_at: timestamp,
      },
      timestamp,
    } satisfies CustomerIoLifecycleEvent,
  }
}
