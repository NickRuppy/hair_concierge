import {
  type PayPalPlan,
  type PayPalSubscription,
  derivePayPalPaidThroughDate,
  mapPayPalSubscriptionStatus,
  toBillingSubscriptionInputFromPayPal,
  validatePayPalPlanShape,
} from "./subscription-shapes"
import { paypalRequest } from "./client"

export type { PayPalPlan, PayPalSubscription }
export {
  derivePayPalPaidThroughDate,
  mapPayPalSubscriptionStatus,
  toBillingSubscriptionInputFromPayPal,
  validatePayPalPlanShape,
}

export async function retrievePayPalSubscription(
  subscriptionId: string,
): Promise<PayPalSubscription> {
  return paypalRequest<PayPalSubscription>(
    `/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}`,
  )
}

export async function retrievePayPalPlan(planId: string): Promise<PayPalPlan> {
  return paypalRequest<PayPalPlan>(`/v1/billing/plans/${encodeURIComponent(planId)}`)
}

export async function cancelPayPalSubscription(
  subscriptionId: string,
  reason: string,
): Promise<void> {
  await paypalRequest<void>(
    `/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`,
    {
      method: "POST",
      body: JSON.stringify({ reason }),
    },
  )
}
