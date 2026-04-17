import type { LeaveInStylingContext } from "@/lib/leave-in/constants"
import type {
  BrushType,
  DryingMethod,
  HeatStyling,
  NightProtection,
  StylingTool,
  TowelTechnique,
} from "@/lib/vocabulary"

export function hasAnsweredArrayValues<T>(value: readonly T[] | null | undefined): boolean {
  return Array.isArray(value) && value.length > 0
}

export function isExplicitNoneArray<T>(value: readonly T[] | null | undefined): boolean {
  return Array.isArray(value) && value.length === 0
}

export function hasDirectMechanicalStressSignals(
  towelTechnique: TowelTechnique | null | undefined,
  brushType: BrushType | null | undefined,
  nightProtection: readonly NightProtection[] | null | undefined,
): boolean {
  return (
    towelTechnique === "rubbeln" ||
    brushType === "paddle" ||
    brushType === "round" ||
    (nightProtection?.includes("tight_hairstyles") ?? false)
  )
}

export function deriveMechanicalStressLevelFromBehaviors(
  towelTechnique: TowelTechnique | null | undefined,
  brushType: BrushType | null | undefined,
  nightProtection: readonly NightProtection[] | null | undefined,
): "low" | "medium" | "high" {
  let count = 0

  if (towelTechnique === "rubbeln") count += 1
  if (brushType === "paddle" || brushType === "round") count += 1
  if (nightProtection?.includes("tight_hairstyles")) count += 1

  if (count === 0) return "low"
  if (count === 1) return "medium"
  return "high"
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
