import type { OfferSectionId } from "@/lib/analytics/events"

export const PERSONAL_PLAN_OFFER_HIGHLIGHTS_FOCUS =
  "personal_plan_complete_plan" satisfies OfferSectionId

export type PersonalPlanOfferFocusTarget = typeof PERSONAL_PLAN_OFFER_HIGHLIGHTS_FOCUS

export function resolvePersonalPlanOfferFocusTarget(
  focus: string | null,
): PersonalPlanOfferFocusTarget | null {
  return focus === PERSONAL_PLAN_OFFER_HIGHLIGHTS_FOCUS ? focus : null
}
