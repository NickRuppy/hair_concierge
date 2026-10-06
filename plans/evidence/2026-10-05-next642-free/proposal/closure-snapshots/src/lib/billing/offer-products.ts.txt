export const PERSONAL_PLAN_ONCE_KIND = "personal_plan_once" as const

export const PERSONAL_PLAN_ONCE_PRODUCT = {
  amount: 29.99,
  amountMinor: 2_999,
  analyticsId: PERSONAL_PLAN_ONCE_KIND,
  currency: "EUR",
  description: "Einmalige Erstellung eines persönlichen Haarplans · Kein Abo",
  name: "Persönlicher Haarplan",
  paypalCategory: "DIGITAL_GOODS",
  plannedRegularPrice: 49.99,
  sku: PERSONAL_PLAN_ONCE_KIND,
} as const

export function getPersonalPlanOnceStripePriceId(
  environment: { STRIPE_PRICE_ID_PERSONAL_PLAN_ONCE?: string } = {
    STRIPE_PRICE_ID_PERSONAL_PLAN_ONCE: process.env.STRIPE_PRICE_ID_PERSONAL_PLAN_ONCE,
  },
): string {
  return environment.STRIPE_PRICE_ID_PERSONAL_PLAN_ONCE?.trim() ?? ""
}

export type PersonalPlanOnceStripePrice = {
  active: boolean
  currency: string
  id: string
  metadata: Record<string, string>
  recurring: unknown
  tax_behavior: string | null
  type: string
  unit_amount: number | null
  product: string | { active: boolean; metadata: Record<string, string>; name: string }
}

export function validatePersonalPlanOnceStripePrice(
  price: PersonalPlanOnceStripePrice,
  expectedPriceId: string,
): string[] {
  const issues: string[] = []
  const product = typeof price.product === "string" ? null : price.product

  if (!expectedPriceId || price.id !== expectedPriceId) issues.push("price_id")
  if (!price.active) issues.push("price_inactive")
  if (price.type !== "one_time" || price.recurring !== null) issues.push("price_recurring")
  if (price.currency.toLowerCase() !== "eur") issues.push("currency")
  if (price.unit_amount !== PERSONAL_PLAN_ONCE_PRODUCT.amountMinor) issues.push("amount")
  if (price.tax_behavior !== "inclusive") issues.push("tax_behavior")
  if (price.metadata.product_kind !== PERSONAL_PLAN_ONCE_KIND) issues.push("price_metadata")
  if (!product) {
    issues.push("product_not_expanded")
  } else {
    if (!product.active) issues.push("product_inactive")
    if (product.name !== PERSONAL_PLAN_ONCE_PRODUCT.name) issues.push("product_name")
    if (product.metadata.product_kind !== PERSONAL_PLAN_ONCE_KIND) issues.push("product_metadata")
  }

  return issues
}
