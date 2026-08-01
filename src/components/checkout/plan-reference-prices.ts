import type { BillingInterval } from "@/lib/stripe/intervals"
import { PERSONAL_PLAN_LAUNCH_PRICING_CATALOG } from "@/lib/billing/pricing-catalog"
import type { SubscriptionPricingCatalog } from "@/lib/billing/pricing-catalog"

export const STANDARD_SUBSCRIPTION_REFERENCE_PRICES = {
  month: 14.99,
  quarter: 34.99,
  year: 99.99,
} satisfies QuizResultReferencePrices

export const QUIZ_RESULT_REFERENCE_PRICES = {
  month: 19.99,
  quarter: 44.49,
  year: 149.99,
} satisfies QuizResultReferencePrices

export const PERSONAL_PLAN_LAUNCH_REFERENCE_PRICES = STANDARD_SUBSCRIPTION_REFERENCE_PRICES

export type QuizResultReferencePrices = Readonly<Record<BillingInterval, number>>

export function getSubscriptionPlanReferencePrices(
  pricingCatalog: SubscriptionPricingCatalog,
): QuizResultReferencePrices | undefined {
  return pricingCatalog === PERSONAL_PLAN_LAUNCH_PRICING_CATALOG
    ? STANDARD_SUBSCRIPTION_REFERENCE_PRICES
    : undefined
}

export function formatQuizResultReferencePrice(amount: number): string {
  return `€${amount.toFixed(2).replace(".", ",")}`
}
