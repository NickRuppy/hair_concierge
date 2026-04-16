import type {
  BondApplicationMode,
  BondRepairIntensity,
  CanonicalBalanceTarget,
  CanonicalRepairLevel,
  CanonicalWeight,
  DamageAssessment,
  EngineCategoryId,
  InterventionPlan,
  InterventionStep,
  NormalizedProfile,
  PeelingType,
  ScalpTypeFocus,
} from "@/lib/recommendation-engine/types"
import type { ProductFrequency } from "@/lib/vocabulary"

const PRODUCT_FREQUENCY_RANK: Record<ProductFrequency, number> = {
  rarely: 0,
  "1_2x": 1,
  "3_4x": 2,
  "5_6x": 3,
  daily: 4,
}

const RESIDUE_PRONE_CATEGORIES: Array<Exclude<EngineCategoryId, "routine">> = [
  "oil",
  "leave_in",
  "mask",
  "dry_shampoo",
]

export interface BuildupResetNeed {
  level: "none" | "low" | "moderate" | "high"
  reasonCodes: string[]
}

export function getPlannedStep(
  plan: InterventionPlan,
  category: Exclude<EngineCategoryId, "routine">,
): InterventionStep | null {
  return plan.steps.find((step) => step.category === category) ?? null
}

export function getRoutineFrequencyBand(
  profile: NormalizedProfile,
  category: Exclude<EngineCategoryId, "routine">,
): ProductFrequency | null {
  return profile.routineInventory[category]?.frequencyBand ?? null
}

export function isFrequencyAtLeast(
  frequencyBand: ProductFrequency | null,
  threshold: ProductFrequency,
): boolean {
  if (!frequencyBand) return false
  return PRODUCT_FREQUENCY_RANK[frequencyBand] >= PRODUCT_FREQUENCY_RANK[threshold]
}

export function deriveTargetWeight(profile: NormalizedProfile): CanonicalWeight | null {
  if (!profile.thickness || !profile.density) return null

  if (profile.thickness === "fine") {
    return profile.density === "low" ? "light" : "medium"
  }

  if (profile.thickness === "normal") {
    if (profile.density === "low") return "light"
    if (profile.density === "medium") return "medium"
    return "rich"
  }

  if (profile.density === "low") return "medium"
  return "rich"
}

export function deriveBalanceTarget(damage: DamageAssessment): CanonicalBalanceTarget | null {
  return damage.balanceDirection
}

export function deriveRepairLevel(damage: DamageAssessment): CanonicalRepairLevel | null {
  if (damage.repairPriority === "high") return "high"
  if (damage.repairPriority === "medium") return "medium"

  if (
    damage.overallLevel === "moderate" ||
    damage.overallLevel === "high" ||
    damage.overallLevel === "severe"
  ) {
    return "medium"
  }

  return "low"
}

export function compareWeightFit(
  expected: CanonicalWeight | null,
  actual: CanonicalWeight | null,
): "exact" | "close" | "mismatch" | "unknown" {
  if (!expected || !actual) return "unknown"

  const ranks: Record<CanonicalWeight, number> = {
    light: 0,
    medium: 1,
    rich: 2,
  }

  const distance = Math.abs(ranks[expected] - ranks[actual])
  if (distance === 0) return "exact"
  if (distance === 1) return "close"
  return "mismatch"
}

export function compareRepairLevelFit(
  expected: CanonicalRepairLevel | null,
  actual: CanonicalRepairLevel | null,
): "exact" | "close" | "mismatch" | "unknown" {
  if (!expected || !actual) return "unknown"

  const ranks: Record<CanonicalRepairLevel, number> = {
    low: 0,
    medium: 1,
    high: 2,
  }

  const distance = Math.abs(ranks[expected] - ranks[actual])
  if (distance === 0) return "exact"
  if (distance === 1) return "close"
  return "mismatch"
}

export function compareBalanceFit(
  expected: CanonicalBalanceTarget | null,
  actual: CanonicalBalanceTarget | null,
): "exact" | "close" | "mismatch" | "unknown" {
  if (!expected || !actual) return "unknown"
  if (expected === actual) return "exact"

  if (expected === "balanced" || actual === "balanced") {
    return "close"
  }

  return "mismatch"
}

export function deriveScalpTypeFocus(profile: NormalizedProfile): ScalpTypeFocus | null {
  if (profile.scalpType === "oily") return "oily"
  if (
    profile.scalpType === "dry" ||
    profile.scalpCondition === "dry_flakes" ||
    profile.scalpCondition === "irritated"
  ) {
    return "dry"
  }
  if (profile.scalpType === "balanced" || profile.scalpCondition) return "balanced"
  return null
}

export function hasScalpDrynessOrIrritationRisk(
  profile: NormalizedProfile,
  damage: DamageAssessment,
): boolean {
  return (
    profile.scalpType === "dry" ||
    profile.scalpCondition === "dry_flakes" ||
    profile.scalpCondition === "irritated" ||
    profile.concerns.includes("dryness") ||
    damage.overallLevel === "high" ||
    damage.overallLevel === "severe"
  )
}

export function deriveBuildupResetNeed(profile: NormalizedProfile): BuildupResetNeed {
  let score = 0
  const reasonCodes = new Set<string>()

  const dryShampooFrequency = getRoutineFrequencyBand(profile, "dry_shampoo")
  const oilyScalp = profile.scalpType === "oily" || profile.concerns.includes("oily_scalp")
  const residueProneLoad = RESIDUE_PRONE_CATEGORIES.filter(
    (category) => profile.routineInventory[category] !== null,
  ).length

  if (oilyScalp) {
    score += 1
    reasonCodes.add("oily_scalp")
  }

  if (residueProneLoad >= 3) {
    score += 2
    reasonCodes.add("heavy_residue_prone_routine")
  } else if (residueProneLoad >= 2) {
    score += 1
    reasonCodes.add("heavy_residue_prone_routine")
  }

  if (isFrequencyAtLeast(dryShampooFrequency, "5_6x")) {
    score += 2
    reasonCodes.add("frequent_dry_shampoo_use")
    reasonCodes.add("dry_shampoo_reset_pressure")
  } else if (isFrequencyAtLeast(dryShampooFrequency, "3_4x")) {
    score += 1
    reasonCodes.add("dry_shampoo_reset_pressure")
  }

  if (
    (profile.washFrequency === "once_weekly" || profile.washFrequency === "rarely") &&
    (oilyScalp || residueProneLoad >= 2 || dryShampooFrequency !== null)
  ) {
    score += 1
    reasonCodes.add("low_wash_cadence_relative_to_load")
  }

  if (oilyScalp && residueProneLoad >= 2) {
    reasonCodes.add("oily_scalp_plus_residue_load")
  }

  if (score <= 0) {
    return {
      level: "none",
      reasonCodes: [],
    }
  }

  if (score === 1) {
    return {
      level: "low",
      reasonCodes: Array.from(reasonCodes),
    }
  }

  if (score <= 3) {
    return {
      level: "moderate",
      reasonCodes: Array.from(reasonCodes),
    }
  }

  return {
    level: "high",
    reasonCodes: Array.from(reasonCodes),
  }
}

export function hasBetweenWashBridgeNeed(profile: NormalizedProfile): boolean {
  const betweenWashDays = profile.washFrequency !== null && profile.washFrequency !== "daily"
  const oilyBridgeNeed = profile.scalpType === "oily" || profile.concerns.includes("oily_scalp")
  const currentDryShampooUse = profile.routineInventory.dry_shampoo !== null

  return betweenWashDays && profile.scalpType !== "dry" && (oilyBridgeNeed || currentDryShampooUse)
}

export function derivePeelingType(profile: NormalizedProfile): PeelingType | null {
  if (!profile.scalpType && !profile.scalpCondition) return null

  if (
    profile.scalpType === "dry" ||
    profile.scalpCondition === "dry_flakes" ||
    profile.scalpCondition === "irritated"
  ) {
    return "acid_serum"
  }

  if (profile.scalpType === "oily") {
    return "physical_scrub"
  }

  return "acid_serum"
}

export function deriveBondRepairIntensity(damage: DamageAssessment): BondRepairIntensity | null {
  if (damage.bondBuilderPriority === "none") return null
  return damage.bondBuilderPriority === "recommend" ? "intensive" : "maintenance"
}

export function deriveBondApplicationMode(profile: NormalizedProfile): BondApplicationMode | null {
  if (!profile.postWashActions.length && profile.heatStyling === null) return null

  if (
    profile.heatStyling === "daily" ||
    profile.heatStyling === "several_weekly" ||
    profile.postWashActions.includes("heat_tool_styling") ||
    profile.postWashActions.includes("blow_dry_only")
  ) {
    return "post_wash_leave_in"
  }

  return "pre_shampoo"
}
