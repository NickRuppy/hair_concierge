import type { LeaveInStylingContext } from "@/lib/leave-in/constants"
import type {
  BrushType,
  DryingMethod,
  HeatStyling,
  StylingTool,
  TowelTechnique,
} from "@/lib/vocabulary"
import { hasMechanicalStressBrush } from "@/lib/profile/brush-type"

export function hasAnsweredArrayValues<T>(value: readonly T[] | null | undefined): boolean {
  return Array.isArray(value) && value.length > 0
}

export function isExplicitNoneArray<T>(value: readonly T[] | null | undefined): boolean {
  return Array.isArray(value) && value.length === 0
}

export function hasDirectMechanicalStressSignals(
  towelTechnique: TowelTechnique | null | undefined,
  brushTypes: readonly BrushType[] | null | undefined,
): boolean {
  return towelTechnique === "rough_rubbing" || hasMechanicalStressBrush(brushTypes)
}

export function deriveLeaveInStylingContextFromStages(
  dryingMethod: DryingMethod | null | undefined,
  heatStyling: HeatStyling | null | undefined,
  stylingTools: readonly StylingTool[] | null | undefined,
): LeaveInStylingContext | null {
  if (
    dryingMethod === "blow_dry" ||
    dryingMethod === "blow_dry_diffuser" ||
    ((heatStyling === "rarely" ||
      heatStyling === "once_weekly" ||
      heatStyling === "several_weekly" ||
      heatStyling === "daily") &&
      hasAnsweredArrayValues(stylingTools))
  ) {
    return "heat_style"
  }

  if (dryingMethod === "air_dry") {
    return "air_dry"
  }

  return null
}
