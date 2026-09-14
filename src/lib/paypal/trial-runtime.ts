import "server-only"
import { readTrialRuntime, type TrialRuntimeEnvironment } from "../billing/trial-runtime"
import type { PayPalTrialRuntime } from "./trial-checkout"
import { paypalRequest } from "./client"
import type { PayPalSubscription } from "./subscription-shapes"
import type { TrialOfferSnapshot } from "../billing/trial-offer"

export function readPayPalTrialRuntime(
  env: TrialRuntimeEnvironment = process.env,
): PayPalTrialRuntime | null {
  const trial = readTrialRuntime(env)
  if (!trial) return null
  const values = [
    env.TRIAL_PAYPAL_APP_ID,
    env.TRIAL_PAYPAL_PRODUCT_ID,
    env.TRIAL_PAYPAL_PLAN_MONTHLY,
    env.TRIAL_PAYPAL_PLAN_ANNUAL,
  ]
  if (values.some((value) => !value || !/^\S{1,255}$/.test(value)))
    throw new Error("PayPal trial runtime configuration invalid")
  if (env.PAYPAL_ENVIRONMENT !== (trial.livemode ? "live" : "sandbox"))
    throw new Error("PayPal trial environment mismatch")
  const [appId, productId, monthPlanId, yearPlanId] = values as string[]
  return { trial, appId, productId, monthPlanId, yearPlanId }
}

export function paypalTrialPriceOverrides(offer: TrialOfferSnapshot) {
  const price = (value: number) => ({
    fixed_price: { value: (value / 100).toFixed(2), currency_code: "EUR" },
  })
  return {
    billing_cycles:
      offer.interval === "month"
        ? [{ sequence: 1, pricing_scheme: price(offer.renewalAmountMinor) }]
        : [
            { sequence: 1, pricing_scheme: price(offer.firstAmountMinor) },
            { sequence: 2, pricing_scheme: price(offer.renewalAmountMinor) },
          ],
    payment_preferences: { setup_fee: { value: "0", currency_code: "EUR" } },
  }
}

export function createPayPalTrialSubscription(input: {
  planId: string
  customId: string
  requestId: string
  startTime: string
  offer: TrialOfferSnapshot
}) {
  return paypalRequest<PayPalSubscription>("/v1/billing/subscriptions", {
    method: "POST",
    signal: AbortSignal.timeout(15_000),
    headers: { "PayPal-Request-Id": input.requestId, Prefer: "return=representation" },
    body: JSON.stringify({
      plan_id: input.planId,
      custom_id: input.customId,
      start_time: input.startTime,
      plan: paypalTrialPriceOverrides(input.offer),
      application_context: { shipping_preference: "NO_SHIPPING", user_action: "SUBSCRIBE_NOW" },
    }),
  })
}

export function retrievePayPalTrialSubscription(id: string) {
  return paypalRequest<PayPalSubscription>(
    `/v1/billing/subscriptions/${encodeURIComponent(id)}?fields=plan,last_failed_payment`,
    { signal: AbortSignal.timeout(15_000) },
  )
}

export async function patchPayPalTrialStart(id: string, startTime: string) {
  await paypalRequest<void>(`/v1/billing/subscriptions/${encodeURIComponent(id)}`, {
    method: "PATCH",
    signal: AbortSignal.timeout(15_000),
    body: JSON.stringify([{ op: "replace", path: "/start_time", value: startTime }]),
  })
}

export type PayPalTrialTransaction = {
  id?: string
  status?: string
  time?: string
  amount_with_breakdown?: { gross_amount?: { value?: string; currency_code?: string } }
}
export async function listPayPalTrialTransactions(
  id: string,
  from: string,
  to: string,
): Promise<PayPalTrialTransaction[]> {
  const query = new URLSearchParams({ start_time: from, end_time: to })
  const result = await paypalRequest<{
    transactions?: PayPalTrialTransaction[]
    total_items?: number
    total_pages?: number
  }>(`/v1/billing/subscriptions/${encodeURIComponent(id)}/transactions?${query}`, {
    signal: AbortSignal.timeout(15_000),
  })
  return parsePayPalTrialTransactions(result)
}

/** PayPal live returns HTTP 200 {} for empty windows; its transactions_list schema makes every field optional. */
export function parsePayPalTrialTransactions(value: unknown): PayPalTrialTransaction[] {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("PayPal trial transactions require reconciliation")
  const result = value as {
    transactions?: PayPalTrialTransaction[]
    total_items?: number
    total_pages?: number
  }
  if (Object.keys(result).length === 0) return []
  if (
    !Array.isArray(result.transactions) ||
    (result.total_pages ?? 1) > 1 ||
    (result.total_items ?? result.transactions.length) !== result.transactions.length
  )
    throw new Error("PayPal trial transactions require reconciliation")
  return result.transactions
}
