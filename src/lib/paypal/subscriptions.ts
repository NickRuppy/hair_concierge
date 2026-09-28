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
  options: { signal?: AbortSignal } = {},
): Promise<PayPalSubscription> {
  return paypalRequest<PayPalSubscription>(
    `/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}`,
    { signal: options.signal },
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
      signal: AbortSignal.timeout(15_000),
      body: JSON.stringify({ reason }),
    },
  )
}

/**
 * Refunds (part of) a subscription payment to the payer. A subscription transaction id is a
 * capture on the v2 Payments API; older sale-based ids only exist on v1. The request id makes
 * a retry return the first refund instead of creating a second one.
 */
export async function refundPayPalSubscriptionPayment(
  transactionId: string,
  amount: { value: string; currency_code: string },
  requestId: string,
): Promise<void> {
  const id = encodeURIComponent(transactionId)
  const init = (body: unknown): RequestInit => ({
    method: "POST",
    signal: AbortSignal.timeout(15_000),
    headers: { "PayPal-Request-Id": requestId },
    body: JSON.stringify(body),
  })
  try {
    await paypalRequest<unknown>(`/v2/payments/captures/${id}/refund`, init({ amount }))
  } catch (error) {
    if ((error as { status?: unknown }).status !== 404) throw error
    await paypalRequest<unknown>(
      `/v1/payments/sale/${id}/refund`,
      init({ amount: { total: amount.value, currency: amount.currency_code } }),
    )
  }
}
