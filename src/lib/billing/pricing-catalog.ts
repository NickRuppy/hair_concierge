import { resolvePersonalPlanPricingMode } from "@/lib/funnel/personal-plan-pricing-experiment"

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

export function resolveSubscriptionPricingCatalog(input: {
  checkoutContext?: "membership_reactivation"
  launchPricingEnabled: boolean
  offerVariant?: string | null
  quizKind?: "legacy" | "personal_plan" | null
}): SubscriptionPricingCatalog {
  if (
    input.checkoutContext === "membership_reactivation" ||
    input.quizKind !== "personal_plan" ||
    !input.launchPricingEnabled ||
    resolvePersonalPlanPricingMode(input.offerVariant ?? "personal-plan-v1") === "one_time"
  ) {
    return STANDARD_PRICING_CATALOG
  }

  return PERSONAL_PLAN_LAUNCH_PRICING_CATALOG
}
