import { MembershipReactivationPage } from "@/components/reactivation/membership-reactivation-page"
import { resolveSubscriptionPricingCatalog } from "@/lib/billing/pricing-catalog"
import { isPersonalPlanLaunchPricingEnabled } from "@/lib/funnel/flags"
import { buildQuizOfferPreview } from "@/lib/quiz/offer-preview"
import type { QuizAnswers } from "@/lib/quiz/types"

export function ProfileReactivationLab({ profileAnswers }: { profileAnswers: QuizAnswers }) {
  return (
    <MembershipReactivationPage
      firstName="Nick"
      pricingCatalog={resolveSubscriptionPricingCatalog(isPersonalPlanLaunchPricingEnabled())}
      returnDestination="/chat"
      routinePreview={buildQuizOfferPreview(profileAnswers)}
    />
  )
}
