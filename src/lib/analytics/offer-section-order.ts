import type { OfferSectionId } from "./events"
import { isGuidedStoryFamilyVariant } from "@/lib/funnel/offer-experiment"

const DEFAULT_SECTION_ORDER = [
  "personalized_analysis",
  "mini_routine",
  "locked_routine",
  "unlock_explanation",
  "product_story_chat",
  "product_story_routine",
  "product_story_products",
  "subscription_explanation",
  "pricing",
  "guarantee",
  "faq",
  "final_cta",
] as const satisfies readonly OfferSectionId[]

const APP_VALUE_STACK_SECTION_ORDER = [
  "hero",
  "personalized_analysis",
  "mini_routine",
  "locked_routine",
  "unlock_explanation",
  "product_story_routine",
  "product_story_chat",
  "product_story_products",
  "testimonials",
  "pricing",
  "faq",
  "final_cta",
] as const satisfies readonly OfferSectionId[]

const GUIDED_STORY_SECTION_ORDER = [
  "personalized_analysis",
  "mini_routine",
  "locked_routine",
  "product_story_chat",
  "product_story_routine",
  "testimonials",
  "pricing",
  "faq",
  "product_story_chat_answer",
] as const satisfies readonly OfferSectionId[]

const GUIDED_STORY_FOUNDER_LETTER_SECTION_ORDER = [
  "personalized_analysis",
  "founder_letter",
  "mini_routine",
  "locked_routine",
  "product_story_chat",
  "product_story_routine",
  "testimonials",
  "pricing",
  "faq",
  "product_story_chat_answer",
] as const satisfies readonly OfferSectionId[]

const PERSONAL_PLAN_SECTION_ORDER = [
  "hero",
  "personal_plan_diagnosis",
  "personal_plan_complete_plan",
  "personal_plan_method",
  "personal_plan_before_after",
  "pricing",
  "personal_plan_survey",
  "testimonials",
  "guarantee",
  "faq",
  "final_cta",
] as const satisfies readonly OfferSectionId[]

export function resolveOfferSectionIndex(offerVariant: string, sectionId: OfferSectionId): number {
  const order: readonly OfferSectionId[] =
    offerVariant === "personal-plan-v1"
      ? PERSONAL_PLAN_SECTION_ORDER
      : isGuidedStoryFamilyVariant(offerVariant)
        ? offerVariant === "guided-story-founder-letter"
          ? GUIDED_STORY_FOUNDER_LETTER_SECTION_ORDER
          : GUIDED_STORY_SECTION_ORDER
        : offerVariant === "app-value-stack"
          ? APP_VALUE_STACK_SECTION_ORDER
          : DEFAULT_SECTION_ORDER
  const index = order.indexOf(sectionId)
  return index >= 0 ? index : order.length
}
