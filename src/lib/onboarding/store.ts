import { create } from "zustand"
import type { HeatStyling, ProductFrequency } from "@/lib/vocabulary/frequencies"
import type {
  TowelMaterial,
  TowelTechnique,
  DryingMethod,
  BrushType,
  NightProtection,
} from "@/lib/vocabulary/onboarding-care"

/* ── Step type ── */

export type OnboardingStep =
  | "welcome"
  | "products_basics"
  | "products_extras"
  | "product_drilldown"
  | "heat_tools"
  | "heat_frequency"
  | "heat_protection"
  | "interstitial"
  | "towel_material"
  | "towel_technique"
  | "drying_method"
  | "brush_type"
  | "night_protection"
  | "celebration"

export type OnboardingEditScope = "products" | "styling" | "routine"

export function getOnboardingEditScope(step: OnboardingStep): OnboardingEditScope | null {
  switch (step) {
    case "products_basics":
    case "products_extras":
    case "product_drilldown":
      return "products"
    case "heat_tools":
    case "heat_frequency":
    case "heat_protection":
      return "styling"
    case "towel_material":
    case "towel_technique":
    case "drying_method":
    case "brush_type":
    case "night_protection":
      return "routine"
    default:
      return null
  }
}

/* ── Linear step order (branch-free segments) ── */

const LINEAR_BEFORE_HEAT: OnboardingStep[] = [
  "welcome",
  "products_basics",
  "products_extras",
  "product_drilldown",
  "heat_tools",
]

const HEAT_BRANCH: OnboardingStep[] = ["heat_frequency", "heat_protection"]

const LINEAR_AFTER_HEAT: OnboardingStep[] = [
  "interstitial",
  "towel_material",
  "towel_technique",
  "drying_method",
  "brush_type",
  "night_protection",
  "celebration",
]

/* ── State shape ── */

interface OnboardingState {
  currentStep: OnboardingStep

  // Product usage
  selectedBasicProducts: string[]
  selectedExtraProducts: string[]
  productDrilldowns: Record<string, { productName: string; frequency: ProductFrequency | null }>
  currentDrilldownIndex: number

  // Heat styling
  selectedHeatTools: string[]
  heatFrequency: HeatStyling | null
  usesHeatProtection: boolean | null

  // Care habits
  towelMaterial: TowelMaterial | null
  towelTechnique: TowelTechnique | null
  dryingMethod: DryingMethod | null
  brushType: BrushType | null
  nightProtection: NightProtection[]

  // Navigation
  goNext: () => void
  goBack: () => void
  setStep: (step: OnboardingStep) => void

  // Setters
  setSelectedBasicProducts: (products: string[]) => void
  setSelectedExtraProducts: (products: string[]) => void
  setProductDrilldown: (
    category: string,
    data: { productName: string; frequency: ProductFrequency | null },
  ) => void
  setCurrentDrilldownIndex: (index: number) => void
  setSelectedHeatTools: (tools: string[]) => void
  setHeatFrequency: (freq: HeatStyling | null) => void
  setUsesHeatProtection: (val: boolean | null) => void
  setTowelMaterial: (val: TowelMaterial | null) => void
  setTowelTechnique: (val: TowelTechnique | null) => void
  setDryingMethod: (val: DryingMethod | null) => void
  setBrushType: (val: BrushType | null) => void
  setNightProtection: (val: NightProtection[]) => void

  // Computed helpers
  allSelectedProducts: () => string[]
  drilldownCategories: () => string[]

  reset: () => void
}

/* ── Helpers ── */

function getAllSelectedProducts(state: {
  selectedBasicProducts: string[]
  selectedExtraProducts: string[]
}) {
  return [...state.selectedBasicProducts, ...state.selectedExtraProducts]
}

function getDrilldownCategories(state: {
  selectedBasicProducts: string[]
  selectedExtraProducts: string[]
}) {
  return getAllSelectedProducts(state)
}

/* ── Initial state (data only, no methods) ── */

const initialData = {
  currentStep: "welcome" as OnboardingStep,

  selectedBasicProducts: [] as string[],
  selectedExtraProducts: [] as string[],
  productDrilldowns: {} as Record<
    string,
    { productName: string; frequency: ProductFrequency | null }
  >,
  currentDrilldownIndex: 0,

  selectedHeatTools: [] as string[],
  heatFrequency: null as HeatStyling | null,
  usesHeatProtection: null as boolean | null,

  towelMaterial: null as TowelMaterial | null,
  towelTechnique: null as TowelTechnique | null,
  dryingMethod: null as DryingMethod | null,
  brushType: null as BrushType | null,
  nightProtection: [] as NightProtection[],
}

/* ── Store ── */

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  ...initialData,

  // ── Navigation ──

  goNext: () =>
    set((s) => {
      const categories = getDrilldownCategories(s)

      switch (s.currentStep) {
        // Drilldown: iterate through each selected product
        case "product_drilldown": {
          if (s.currentDrilldownIndex < categories.length - 1) {
            return { currentDrilldownIndex: s.currentDrilldownIndex + 1 }
          }
          return { currentStep: "heat_tools" }
        }

        // Heat tools: skip heat branch if none selected
        case "heat_tools": {
          if (s.selectedHeatTools.length === 0) {
            return { currentStep: "interstitial" }
          }
          return { currentStep: "heat_frequency" }
        }

        // Products extras → first drilldown
        case "products_extras":
          return { currentStep: "product_drilldown", currentDrilldownIndex: 0 }

        // Default: follow linear order
        default: {
          const full = buildFullOrder(s)
          const idx = full.indexOf(s.currentStep)
          if (idx < full.length - 1) {
            return { currentStep: full[idx + 1] }
          }
          return {}
        }
      }
    }),

  goBack: () =>
    set((s) => {
      const categories = getDrilldownCategories(s)

      switch (s.currentStep) {
        // Drilldown at index 0 → back to products_extras
        case "product_drilldown": {
          if (s.currentDrilldownIndex > 0) {
            return { currentDrilldownIndex: s.currentDrilldownIndex - 1 }
          }
          return { currentStep: "products_extras" }
        }

        // Heat tools → last drilldown
        case "heat_tools": {
          const lastIdx = Math.max(0, categories.length - 1)
          return {
            currentStep: "product_drilldown",
            currentDrilldownIndex: lastIdx,
          }
        }

        // Interstitial → depends on whether heat tools were selected
        case "interstitial": {
          if (s.selectedHeatTools.length > 0) {
            return { currentStep: "heat_protection" }
          }
          return { currentStep: "heat_tools" }
        }

        // Default: follow linear order backward
        default: {
          const full = buildFullOrder(s)
          const idx = full.indexOf(s.currentStep)
          if (idx > 0) {
            return { currentStep: full[idx - 1] }
          }
          return {}
        }
      }
    }),

  setStep: (step) => set({ currentStep: step }),

  // ── Setters ──

  setSelectedBasicProducts: (products) => set({ selectedBasicProducts: products }),
  setSelectedExtraProducts: (products) => set({ selectedExtraProducts: products }),
  setProductDrilldown: (category, data) =>
    set((s) => ({
      productDrilldowns: { ...s.productDrilldowns, [category]: data },
    })),
  setCurrentDrilldownIndex: (index) => set({ currentDrilldownIndex: index }),
  setSelectedHeatTools: (tools) => set({ selectedHeatTools: tools }),
  setHeatFrequency: (freq) => set({ heatFrequency: freq }),
  setUsesHeatProtection: (val) => set({ usesHeatProtection: val }),
  setTowelMaterial: (val) => set({ towelMaterial: val }),
  setTowelTechnique: (val) => set({ towelTechnique: val }),
  setDryingMethod: (val) => set({ dryingMethod: val }),
  setBrushType: (val) => set({ brushType: val }),
  setNightProtection: (val) => set({ nightProtection: val }),

  // ── Computed ──

  allSelectedProducts: () => getAllSelectedProducts(get()),
  drilldownCategories: () => getDrilldownCategories(get()),

  reset: () => set(initialData),
}))

/* ── Build the full linear order including/excluding heat branch ── */

function buildFullOrder(state: { selectedHeatTools: string[] }): OnboardingStep[] {
  const hasHeat = state.selectedHeatTools.length > 0
  return [...LINEAR_BEFORE_HEAT, ...(hasHeat ? HEAT_BRANCH : []), ...LINEAR_AFTER_HEAT]
}
