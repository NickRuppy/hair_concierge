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
  "testimonials",
  "personal_plan_complete_plan",
  "personal_plan_method",
  "personal_plan_before_after",
  "personal_plan_survey",
  "guarantee",
  "faq",
  "final_cta",
] as const satisfies readonly OfferSectionId[]

/** `scan-regal-v1` — the scanner offer's own top-to-bottom order (variant B). */
const SCAN_REGAL_SECTION_ORDER = [
  "hero",
  "before_after",
  "scan_criteria",
  "product_tour",
  "pricing",
  "scan_coverage",
  "highlights",
  "method",
  "survey",
  "testimonials",
  "guarantee",
  "faq",
  "final_cta",
] as const satisfies readonly OfferSectionId[]

/** `discovery-call-v1` — booking replaces pricing as the conversion surface. */
const DISCOVERY_CALL_SECTION_ORDER = [
  "hero",
  "method",
  "booking",
  "testimonials",
  "free_explanation",
  "final_cta",
] as const satisfies readonly OfferSectionId[]

const SCANNER_REFINEMENT_SECTION_ORDER = [
  "hero",
  "personal_plan_diagnosis",
  "scan_criteria",
  "highlights",
  "method",
  "pricing",
  "product_tour",
  "testimonials",
  "faq",
] as const satisfies readonly OfferSectionId[]

export function resolveOfferSectionIndex(
  offerVariant: string,
  sectionId: OfferSectionId,
  offerRevision?: string,
): number {
  const presentationVariant = resolveOfferPresentationVariant(offerVariant)
  const order: readonly OfferSectionId[] =
    presentationVariant === "discovery-call-v1"
      ? DISCOVERY_CALL_SECTION_ORDER
      : presentationVariant === "scan-regal-v1"
        ? offerRevision === "scan_regal_refinement_v20"
          ? SCANNER_REFINEMENT_SECTION_ORDER
          : SCAN_REGAL_SECTION_ORDER
        : presentationVariant === "personal-plan-v1" ||
            isPersonalPlanPricingExperimentVariant(presentationVariant)
          ? PERSONAL_PLAN_SECTION_ORDER
          : ORGANIC_PLAN_SECTION_ORDER
  const index = order.indexOf(sectionId)
  return index >= 0 ? index : order.length
}
