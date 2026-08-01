export const STANDARD_PRICING_CATALOG = "standard" as const
export const PERSONAL_PLAN_LAUNCH_PRICING_CATALOG = "personal_plan_launch_v1" as const

export type SubscriptionPricingCatalog =
  | typeof STANDARD_PRICING_CATALOG
  | typeof PERSONAL_PLAN_LAUNCH_PRICING_CATALOG

export function parseSubscriptionPricingCatalog(value: unknown): SubscriptionPricingCatalog | null {
  return value === STANDARD_PRICING_CATALOG || value === PERSONAL_PLAN_LAUNCH_PRICING_CATALOG
    ? value
    : null
}

export function resolveSubscriptionPricingCatalog(
  launchPricingEnabled: boolean,
): SubscriptionPricingCatalog {
  return launchPricingEnabled ? PERSONAL_PLAN_LAUNCH_PRICING_CATALOG : STANDARD_PRICING_CATALOG
}
