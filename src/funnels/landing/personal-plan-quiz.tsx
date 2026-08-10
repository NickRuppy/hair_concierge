import { PersonalPlanQuiz } from "@/components/personal-plan-quiz/personal-plan-quiz"
import type { FunnelLandingVariantProps } from "@/funnels/types"

export default function FunnelPersonalPlanQuizLandingVariant({
  personalPlanFieldTest = false,
  personalPlanQuizResume,
}: FunnelLandingVariantProps) {
  return <PersonalPlanQuiz fieldTest={personalPlanFieldTest} resume={personalPlanQuizResume} />
}
