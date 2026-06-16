import type { OnboardingStep } from "@/lib/onboarding/store"
import type { TowelMaterial } from "@/lib/vocabulary/onboarding-care"

export const ROUTINE_STEPS: OnboardingStep[] = [
  "towel_material",
  "towel_technique",
  "drying_method",
  "brush_type",
  "night_protection",
]

export function getRoutineSteps({
  towelMaterial,
}: {
  towelMaterial: TowelMaterial | null
}): OnboardingStep[] {
  return towelMaterial === "no_towel"
    ? ROUTINE_STEPS.filter((step) => step !== "towel_technique")
    : ROUTINE_STEPS
}
