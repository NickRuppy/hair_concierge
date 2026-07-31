import { PersonalPlanQuiz } from "@/components/personal-plan-quiz/personal-plan-quiz"
import type { FunnelLandingVariantProps } from "@/funnels/types"

export default function FunnelPersonalPlanQuizLandingVariant({
  personalPlanQuizResume,
}: FunnelLandingVariantProps) {
  return <PersonalPlanQuiz resume={personalPlanQuizResume} />
}
