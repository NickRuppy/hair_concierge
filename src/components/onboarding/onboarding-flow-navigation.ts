import type { OnboardingEditScope, OnboardingStep } from "@/lib/onboarding/store"

type OnboardingNavigationSnapshot = {
  currentDrilldownIndex: number
  drilldownCategories: () => unknown[]
  selectedHeatTools: string[]
}

export function shouldReturnAfterScopeStep(
  completedStep: OnboardingStep,
  state: OnboardingNavigationSnapshot,
  editScope: OnboardingEditScope | null,
) {
  switch (editScope) {
    case "products": {
      const lastDrilldownIndex = state.drilldownCategories().length - 1
      return (
        completedStep === "product_drilldown" && state.currentDrilldownIndex >= lastDrilldownIndex
      )
    }
    case "styling":
      return (
        (completedStep === "heat_tools" && state.selectedHeatTools.length === 0) ||
        completedStep === "heat_protection"
      )
    case "routine":
      return completedStep === "night_protection"
    default:
      return false
  }
}

export function getFinalContinueLabel(
  currentStep: OnboardingStep,
  state: OnboardingNavigationSnapshot,
  editScope: OnboardingEditScope | null,
  singleStepEdit: boolean,
  returnTo: string | null,
) {
  if (!returnTo) return "Weiter"

  if (
    singleStepEdit &&
    (currentStep === "product_drilldown" ||
      currentStep === "heat_tools" ||
      currentStep === "drying_method" ||
      currentStep === "night_protection")
  ) {
    return "Speichern und zurück zum Profil"
  }

  if (currentStep === "night_protection" && editScope === "routine") {
    return "Speichern und zurück zum Profil"
  }

  if (
    currentStep === "product_drilldown" &&
    editScope === "products" &&
    shouldReturnAfterScopeStep(currentStep, state, editScope)
  ) {
    return "Speichern und zurück zum Profil"
  }

  return "Weiter"
}
