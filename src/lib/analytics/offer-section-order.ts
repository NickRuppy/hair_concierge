import type { OfferSectionId } from "./events"

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

export function resolveOfferSectionIndex(offerVariant: string, sectionId: OfferSectionId): number {
  const order: readonly OfferSectionId[] =
    offerVariant === "guided-story"
      ? GUIDED_STORY_SECTION_ORDER
      : offerVariant === "app-value-stack"
        ? APP_VALUE_STACK_SECTION_ORDER
        : DEFAULT_SECTION_ORDER
  const index = order.indexOf(sectionId)
  return index >= 0 ? index : order.length
}
