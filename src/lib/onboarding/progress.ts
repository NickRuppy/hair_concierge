import type { OnboardingStep } from "./store"

const PRODUCTS_STEPS: OnboardingStep[] = ["products_basics", "products_extras"]
const STYLING_STEPS: OnboardingStep[] = [
  "heat_tools",
  "heat_frequency",
  "heat_protection",
  "interstitial",
]
const ROUTINE_STEPS: OnboardingStep[] = [
  "towel_material",
  "towel_technique",
  "drying_method",
  "brush_type",
  "night_protection",
]

const STEP_LABELS: Record<OnboardingStep, string> = {
  welcome: "Willkommen",
  products_basics: "Produkte Basics",
  products_extras: "Produkte Extras",
  product_drilldown: "Produkt-Details",
  heat_tools: "Heat-Tools",
  heat_frequency: "Heat-Frequenz",
  heat_protection: "Hitzeschutz",
  interstitial: "Styling-Check",
  towel_material: "Handtuch-Material",
  towel_technique: "Handtuch-Technik",
  drying_method: "Trocknen",
  brush_type: "Bürste",
  night_protection: "Nachtschutz",
  celebration: "Abschluss",
}

export interface OnboardingProgressInput {
  currentStep: OnboardingStep
  currentDrilldownIndex: number
  drilldownCount: number
  selectedHeatTools: string[]
}

export interface OnboardingProgressMilestone {
  label: "Produkte" | "Styling" | "Alltag"
  percent: number
}

export interface OnboardingProgressState {
  path: string[]
  currentIndex: number
  currentSectionIndex: number
  currentLabel: string
  totalSteps: number
  progressPercent: number
  milestones: [
    OnboardingProgressMilestone,
    OnboardingProgressMilestone,
    OnboardingProgressMilestone,
  ]
}

function roundPercent(value: number): number {
  return Math.round(value)
}

function buildDrilldownSteps(drilldownCount: number): string[] {
  const safeCount = Math.max(1, drilldownCount)
  return Array.from({ length: safeCount }, (_, index) => `product_drilldown_${index + 1}`)
}

export function buildOnboardingProgressPath({
  drilldownCount,
  selectedHeatTools,
}: Pick<OnboardingProgressInput, "drilldownCount" | "selectedHeatTools">): string[] {
  const hasHeatTools = selectedHeatTools.length > 0

  return [
    ...PRODUCTS_STEPS,
    ...buildDrilldownSteps(drilldownCount),
    "heat_tools",
    ...(hasHeatTools ? ["heat_frequency", "heat_protection"] : []),
    ...STYLING_STEPS.slice(-1),
    ...ROUTINE_STEPS,
  ]
}

function getCurrentPathKey({
  currentStep,
  currentDrilldownIndex,
}: Pick<OnboardingProgressInput, "currentStep" | "currentDrilldownIndex">): string {
  if (currentStep === "product_drilldown") {
    return `product_drilldown_${Math.max(0, currentDrilldownIndex) + 1}`
  }

  return currentStep
}

function getCurrentLabel(input: OnboardingProgressInput): string {
  if (input.currentStep === "product_drilldown") {
    return `Produkt-Details ${Math.max(0, input.currentDrilldownIndex) + 1}`
  }

  return STEP_LABELS[input.currentStep]
}

export function buildOnboardingProgressState(
  input: OnboardingProgressInput,
): OnboardingProgressState {
  const path = buildOnboardingProgressPath(input)
  const currentPathKey = getCurrentPathKey(input)
  const currentIndex = Math.max(0, path.indexOf(currentPathKey))
  const totalSteps = path.length
  const progressPercent = roundPercent(((currentIndex + 1) / totalSteps) * 100)

  const productsCount = PRODUCTS_STEPS.length + Math.max(1, input.drilldownCount)
  const stylingCount = 1 + (input.selectedHeatTools.length > 0 ? 2 : 0) + 1
  const productsPercent = roundPercent((productsCount / totalSteps) * 100)
  const stylingPercent = roundPercent(((productsCount + stylingCount) / totalSteps) * 100)
  const currentSectionIndex =
    currentIndex < productsCount ? 0 : currentIndex < productsCount + stylingCount ? 1 : 2

  return {
    path,
    currentIndex,
    currentSectionIndex,
    currentLabel: getCurrentLabel(input),
    totalSteps,
    progressPercent,
    milestones: [
      { label: "Produkte", percent: productsPercent },
      { label: "Styling", percent: stylingPercent },
      { label: "Alltag", percent: 100 },
    ],
  }
}
