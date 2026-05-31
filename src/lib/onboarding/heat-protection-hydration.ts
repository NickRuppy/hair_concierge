import type { OnboardingEditScope, OnboardingStep } from "./store"

const AFTER_HEAT_PROTECTION_STEPS = new Set<OnboardingStep>([
  "interstitial",
  "towel_material",
  "towel_technique",
  "drying_method",
  "brush_type",
  "night_protection",
  "celebration",
])

export function shouldHydrateStoredHeatProtection({
  storedValue,
  initialStep,
  onboardingCompleted,
  editScope,
  singleStepEdit,
}: {
  storedValue: boolean | null | undefined
  initialStep: OnboardingStep
  onboardingCompleted: boolean
  editScope: OnboardingEditScope | null
  singleStepEdit: boolean
}): boolean {
  if (storedValue == null) return false
  if (storedValue === true) return true

  return (
    onboardingCompleted ||
    singleStepEdit ||
    editScope === "styling" ||
    AFTER_HEAT_PROTECTION_STEPS.has(initialStep)
  )
}
