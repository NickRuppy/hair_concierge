import type Stripe from "stripe"
import { intervalFromPrice, type BillingInterval } from "./intervals"

type RetrievedSubscription = {
  items: {
    data: Array<{
      price: {
        recurring?: { interval: string; interval_count: number }
        interval?: string
        interval_count?: number
      }
    }>
  }
}

function subscriptionIdFromSession(session: Stripe.Checkout.Session) {
  if (typeof session.subscription === "string") return session.subscription
  return session.subscription?.id
}

function singleAllowedPaymentMethodTypeFromSession(session: Stripe.Checkout.Session) {
  const methodTypes = session.payment_method_types
  if (methodTypes?.length !== 1) return undefined
  return methodTypes[0]
}

function planIdForInterval(interval: BillingInterval) {
  return `premium_${interval}`
}

export type CheckoutPurchaseAnalytics = {
  currency: string
  interval: BillingInterval
  paymentMethodType?: string
  planId: string
  value: number
}

export async function buildCheckoutPurchaseAnalytics(
  session: Stripe.Checkout.Session,
  stripe: Stripe,
): Promise<CheckoutPurchaseAnalytics | null> {
  const subscriptionId = subscriptionIdFromSession(session)
  if (
    !session.id ||
    typeof session.amount_total !== "number" ||
    !session.currency ||
    !subscriptionId
  ) {
    return null
  }

  const subscription = (await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ["items.data.price"],
  })) as unknown as RetrievedSubscription
  const price = subscription.items.data[0]?.price
  if (!price) return null

  const interval = intervalFromPrice({
    interval: price.recurring?.interval ?? price.interval ?? "",
    interval_count: price.recurring?.interval_count ?? price.interval_count ?? 1,
  })

  return {
    currency: session.currency.toUpperCase(),
    interval,
    planId: planIdForInterval(interval),
    paymentMethodType: singleAllowedPaymentMethodTypeFromSession(session),
    value: session.amount_total / 100,
  }
}
