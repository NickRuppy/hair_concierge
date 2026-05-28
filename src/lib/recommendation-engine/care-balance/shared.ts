import type { DamageAssessment, NormalizedProfile } from "@/lib/recommendation-engine/types"
import type { ProductFrequency, StylingTool } from "@/lib/vocabulary"

const PRODUCT_FREQUENCY_RANK: Record<ProductFrequency, number> = {
  rarely: 0,
  "1_2x": 1,
  "3_4x": 2,
  "5_6x": 3,
  daily: 4,
}

const DIRECT_HIGH_HEAT_TOOLS = new Set<StylingTool>([
  "flat_iron",
  "curling_iron",
  "wave_iron",
  "multi_tool",
])

const AIRFLOW_HEAT_TOOLS = new Set<StylingTool>(["blow_dryer", "diffuser"])
const MODERATE_HEAT_TOOLS = new Set<StylingTool>(["hot_air_brush", "thermal_rollers"])

export type FrequencyComparison = -1 | 0 | 1 | null

export type DeepCleansingVulnerabilityReasonCode =
  | "dry_scalp"
  | "dry_lengths_or_concerns"
  | "high_damage"
  | "color_or_bleach"
  | "curly_or_coily_texture"
  | "rough_cuticle"

export interface DeepCleansingVulnerability {
  vulnerable: boolean
  relevantTools: StylingTool[]
  reasonCodes: DeepCleansingVulnerabilityReasonCode[]
}

export type HeatExposureTier = "none" | "airflow" | "moderate" | "high_cumulative" | "high_direct"

export type HeatExposureReasonCode =
  | "airflow_heat_tool"
  | "moderate_heat_tool"
  | "cumulative_moderate_heat_tools"
  | "direct_high_heat_tool"

export interface HeatExposureClassification {
  tier: HeatExposureTier
  relevantTools: StylingTool[]
  reasonCodes: HeatExposureReasonCode[]
}

export function compareFrequencyBands(
  left: ProductFrequency | null,
  right: ProductFrequency | null,
): FrequencyComparison {
  if (!left || !right) return null

  const leftRank = PRODUCT_FREQUENCY_RANK[left]
  const rightRank = PRODUCT_FREQUENCY_RANK[right]

  if (leftRank === rightRank) return 0
  return leftRank < rightRank ? -1 : 1
}

export function hasDeepCleansingVulnerability(
  profile: NormalizedProfile,
  damage: DamageAssessment,
): DeepCleansingVulnerability {
  const reasonCodes: DeepCleansingVulnerabilityReasonCode[] = []
  const concerns = new Set(profile.concerns)

  if (profile.scalpType === "dry" || profile.scalpCondition === "dry_flakes") {
    reasonCodes.push("dry_scalp")
  }

  if (concerns.has("dryness") || profile.proteinMoistureBalance === "stretches_stays") {
    reasonCodes.push("dry_lengths_or_concerns")
  }

  if (damage.overallLevel === "high" || damage.overallLevel === "severe") {
    reasonCodes.push("high_damage")
  }

  if (
    profile.chemicalTreatment.includes("colored") ||
    profile.chemicalTreatment.includes("bleached")
  ) {
    reasonCodes.push("color_or_bleach")
  }

  if (profile.hairTexture === "curly" || profile.hairTexture === "coily") {
    reasonCodes.push("curly_or_coily_texture")
  }

  if (profile.cuticleCondition === "rough") {
    reasonCodes.push("rough_cuticle")
  }

  return {
    vulnerable: reasonCodes.length > 0,
    relevantTools: [],
    reasonCodes,
  }
}

export function classifyHeatExposure(profile: NormalizedProfile): HeatExposureClassification {
  const tools = [...(profile.stylingTools ?? [])]
  if (profile.dryingMethod === "blow_dry" && !tools.includes("blow_dryer")) {
    tools.push("blow_dryer")
  }
  if (profile.dryingMethod === "blow_dry_diffuser" && !tools.includes("diffuser")) {
    tools.push("diffuser")
  }

  const directHighHeatTools = tools.filter((tool) => DIRECT_HIGH_HEAT_TOOLS.has(tool))
  if (directHighHeatTools.length > 0) {
    return {
      tier: "high_direct",
      relevantTools: directHighHeatTools,
      reasonCodes: ["direct_high_heat_tool"],
    }
  }

  const moderateHeatTools = tools.filter((tool) => MODERATE_HEAT_TOOLS.has(tool))
  if (moderateHeatTools.length >= 2) {
    return {
      tier: "high_cumulative",
      relevantTools: moderateHeatTools,
      reasonCodes: ["cumulative_moderate_heat_tools"],
    }
  }

  if (moderateHeatTools.length === 1) {
    return {
      tier: "moderate",
      relevantTools: moderateHeatTools,
      reasonCodes: ["moderate_heat_tool"],
    }
  }

  const airflowHeatTools = tools.filter((tool) => AIRFLOW_HEAT_TOOLS.has(tool))
  if (airflowHeatTools.length > 0) {
    return {
      tier: "airflow",
      relevantTools: airflowHeatTools,
      reasonCodes: ["airflow_heat_tool"],
    }
  }

  return {
    tier: "none",
    relevantTools: [],
    reasonCodes: [],
  }
}
