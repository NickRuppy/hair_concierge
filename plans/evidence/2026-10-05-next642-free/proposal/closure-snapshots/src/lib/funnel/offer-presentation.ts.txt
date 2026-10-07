export const ORGANIC_PLAN_OFFER_VARIANT = "organic-plan-v1"

export const RETIRED_LEGACY_OFFER_VARIANTS = new Set<string>([
  "default",
  "app-value-stack",
  "guided-story",
  "guided-story-locked",
  "guided-story-founder-letter",
  "guided-story-potential",
])

/** Maps retired presentation IDs while preserving the stored tracking arm. */
export function resolveOfferPresentationVariant(variant: string): string {
  return RETIRED_LEGACY_OFFER_VARIANTS.has(variant) ? ORGANIC_PLAN_OFFER_VARIANT : variant
}
