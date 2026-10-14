export const PERSONAL_PLAN_PRICING_EXPERIMENT = {
  id: "personal_plan_pricing_v1",
  revision: 1,
  packageKey: "meta_personal_plan_v1",
  baseVariant: "personal-plan-v1",
  variants: ["personal-plan-membership-v1", "personal-plan-one-time-v1"],
} as const

export type PersonalPlanPricingExperimentVariant =
  (typeof PERSONAL_PLAN_PRICING_EXPERIMENT.variants)[number]
export type PersonalPlanPricingMode = "membership" | "one_time"

const EXPERIMENT_VARIANTS = new Set<string>(PERSONAL_PLAN_PRICING_EXPERIMENT.variants)

export function isPersonalPlanPricingExperimentVariant(
  offerVariant: string | null | undefined,
): offerVariant is PersonalPlanPricingExperimentVariant {
  return typeof offerVariant === "string" && EXPERIMENT_VARIANTS.has(offerVariant)
}

export function assignPersonalPlanPricingExperimentVariant(
  _sessionId: string,
): PersonalPlanPricingExperimentVariant {
  void _sessionId
  return "personal-plan-membership-v1"
}

export function resolvePersonalPlanPricingMode(offerVariant: string): PersonalPlanPricingMode {
  return offerVariant === "personal-plan-one-time-v1" ? "one_time" : "membership"
}
