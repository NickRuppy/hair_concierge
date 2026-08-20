import { PersonalPlanQuizEntry } from "@/components/personal-plan-quiz/personal-plan-quiz-entry"
import type { FunnelLandingVariantProps } from "@/funnels/types"

export default function FunnelPersonalPlanQuizLandingVariant({
  personalPlanFieldTest = false,
  personalPlanQuizResume,
}: FunnelLandingVariantProps) {
  return <PersonalPlanQuizEntry fieldTest={personalPlanFieldTest} resume={personalPlanQuizResume} />
}
