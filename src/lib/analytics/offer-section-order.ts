import type { OfferSectionId } from "./events"
import { resolveOfferPresentationVariant } from "@/lib/funnel/offer-presentation"
import { isPersonalPlanPricingExperimentVariant } from "@/lib/funnel/personal-plan-pricing-experiment"

const ORGANIC_PLAN_SECTION_ORDER = [
  "hero",
  "personal_plan_diagnosis",
  "personal_plan_complete_plan",
  "pricing",
  "personal_plan_method",
  "personal_plan_before_after",
  "personal_plan_survey",
  "testimonials",
  "guarantee",
  "faq",
  "final_cta",
] as const satisfies readonly OfferSectionId[]

const PERSONAL_PLAN_SECTION_ORDER = [
  "hero",
  "personal_plan_diagnosis",
  "pricing",
  "personal_plan_complete_plan",
  "personal_plan_method",
  "personal_plan_before_after",
  "personal_plan_survey",
  "testimonials",
  "guarantee",
  "faq",
  "final_cta",
] as const satisfies readonly OfferSectionId[]

export function resolveOfferSectionIndex(offerVariant: string, sectionId: OfferSectionId): number {
  const presentationVariant = resolveOfferPresentationVariant(offerVariant)
  const order: readonly OfferSectionId[] =
    presentationVariant === "personal-plan-v1" ||
    isPersonalPlanPricingExperimentVariant(presentationVariant)
      ? PERSONAL_PLAN_SECTION_ORDER
      : ORGANIC_PLAN_SECTION_ORDER
  const index = order.indexOf(sectionId)
  return index >= 0 ? index : order.length
}
