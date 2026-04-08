import type { ProductFrequency } from "@/lib/vocabulary/frequencies"
import type {
  WashFrequency,
  HeatStyling,
  StylingTool,
  PostWashAction,
  RoutineProduct,
  MechanicalStressFactor,
} from "@/lib/vocabulary"
import type {
  TowelTechnique,
  BrushType,
  NightProtection,
  DryingMethod,
} from "@/lib/vocabulary/onboarding-care"

/**
 * Map a ProductFrequency from shampoo drill-down to the old WashFrequency enum.
 * Old values: daily, every_2_3_days, once_weekly, rarely
 */
export function mapShampooFrequency(freq: ProductFrequency): WashFrequency {
  switch (freq) {
    case "daily":
      return "daily"
    case "5_6x":
      return "daily" // near-daily, closest match
    case "3_4x":
      return "every_2_3_days"
    case "1_2x":
      return "once_weekly"
    case "rarely":
      return "rarely"
  }
}

/**
 * Map a ProductFrequency from heat frequency to the old HeatStyling enum.
 * Old values: daily, several_weekly, once_weekly, rarely, never
 */
export function mapHeatFrequency(freq: ProductFrequency): HeatStyling {
  switch (freq) {
    case "daily":
      return "daily"
    case "5_6x":
      return "several_weekly"
    case "3_4x":
      return "several_weekly"
    case "1_2x":
      return "once_weekly"
    case "rarely":
      return "rarely"
  }
}

/**
 * Derive mechanical_stress_factors from care-habit answers.
 * Maps: towel_technique 'rubbeln' -> 'towel_rubbing',
 *       brush_type in ['paddle','round'] -> 'rough_brushing',
 *       night_protection includes 'tight_hairstyles' -> 'tight_hairstyles'
 */
export function deriveMechanicalStressFactors(
  towelTechnique: TowelTechnique | null,
  brushType: BrushType | null,
  nightProtection: NightProtection[],
): MechanicalStressFactor[] {
  const factors: MechanicalStressFactor[] = []
  if (towelTechnique === "rubbeln") factors.push("towel_rubbing")
  if (brushType === "paddle" || brushType === "round")
    factors.push("rough_brushing")
  if (nightProtection.includes("tight_hairstyles"))
    factors.push("tight_hairstyles")
  return factors
}

/**
 * Derive post_wash_actions from drying method and heat tools.
 */
export function derivePostWashActions(
  dryingMethod: DryingMethod[],
  hasHeatTools: boolean,
): PostWashAction[] {
  const actions: PostWashAction[] = []
  if (dryingMethod.includes("air_dry")) actions.push("air_dry")
  if (
    dryingMethod.includes("blow_dry") ||
    dryingMethod.includes("blow_dry_diffuser")
  )
    actions.push("blow_dry_only")
  if (hasHeatTools) actions.push("heat_tool_styling")
  return actions
}

/**
 * Map selected product checklist categories to old current_routine_products enum values.
 * Only maps categories that exist in the old RoutineProduct type.
 */
export function mapProductChecklistToRoutineProducts(
  selectedProducts: string[],
): RoutineProduct[] {
  const validProducts: RoutineProduct[] = [
    "shampoo",
    "conditioner",
    "leave_in",
    "oil",
    "mask",
    "heat_protectant",
    "serum",
    "scrub",
  ]
  return selectedProducts.filter((p): p is RoutineProduct =>
    validProducts.includes(p as RoutineProduct),
  )
}

/**
 * Auto-reconcile diffusor: if drying_method includes blow_dry_diffuser,
 * ensure styling_tools includes 'diffuser'.
 */
export function reconcileDiffusor(
  selectedHeatTools: string[],
  dryingMethod: DryingMethod[],
): StylingTool[] {
  const tools = [...selectedHeatTools] as StylingTool[]
  if (
    dryingMethod.includes("blow_dry_diffuser") &&
    !tools.includes("diffuser")
  ) {
    tools.push("diffuser")
  }
  return tools
}
