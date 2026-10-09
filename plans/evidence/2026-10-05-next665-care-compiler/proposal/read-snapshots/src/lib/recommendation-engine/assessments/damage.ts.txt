import type {
  BalanceDirection,
  BondBuilderPriority,
  DamageAssessment,
  DamageLevel,
  NormalizedProfile,
  RepairPriority,
} from "@/lib/recommendation-engine/types"
import { getBrushMechanicalStressContribution } from "@/lib/profile/brush-type"
import { isExplicitNoneArray } from "@/lib/profile/signal-derivations"
import {
  getChemicalTreatmentDamageDrivers,
  getChemicalTreatmentDamageWeight,
  hasBleachTreatment,
  hasColorOrBleachTreatment,
  hasShapeChangingTreatment,
} from "@/lib/profile/chemical-treatment"
import { scoreToDamageLevel } from "@/lib/recommendation-engine/utils/levels"

function deriveStructuralConcernContribution(profile: NormalizedProfile): {
  score: number
  drivers: string[]
} {
  const drivers: string[] = []
  const concerns = new Set(profile.concerns)

  if (concerns.has("breakage")) {
    drivers.push("concern_breakage")
  }
  if (concerns.has("hair_damage")) {
    drivers.push("concern_hair_damage")
  }
  if (concerns.has("split_ends")) {
    drivers.push("concern_split_ends")
  }

  if (drivers.length >= 2) {
    drivers.push("concern_structural_cluster")
  }

  let score = 0
  if (concerns.has("breakage")) score += 4
  if (concerns.has("hair_damage")) score += 3
  if (concerns.has("split_ends")) score += 2

  return {
    score: Math.min(score, 5),
    drivers,
  }
}

function deriveBalanceDirection(profile: NormalizedProfile): BalanceDirection | null {
  switch (profile.proteinMoistureBalance) {
    case "stretches_stays":
      return "protein"
    case "snaps":
      return "moisture"
    case "stretches_bounces":
      return "balanced"
    default:
      return null
  }
}

function deriveRepairPriority(
  structuralLevel: DamageLevel,
  heatLevel: DamageLevel,
  mechanicalLevel: DamageLevel,
): RepairPriority {
  if (structuralLevel === "high" || structuralLevel === "severe" || heatLevel === "severe") {
    return "high"
  }

  if (structuralLevel === "moderate" || heatLevel === "high" || mechanicalLevel === "high") {
    return "medium"
  }

  return "low"
}

function deriveBondBuilderPriority(
  profile: NormalizedProfile,
  structuralLevel: DamageLevel,
): BondBuilderPriority {
  const hasBleach = hasBleachTreatment(profile.chemicalTreatment)
  const hasShapeChangingStress = hasShapeChangingTreatment(profile.chemicalTreatment)
  const hasSnapPattern = profile.proteinMoistureBalance === "snaps"
  const hasRepairGoal =
    profile.goals.includes("anti_breakage") ||
    profile.goals.includes("strengthen") ||
    profile.goals.includes("healthier_hair")
  const hasShapeDamageContext =
    profile.cuticleCondition === "rough" ||
    profile.concerns.includes("breakage") ||
    profile.concerns.includes("hair_damage") ||
    hasSnapPattern ||
    profile.proteinMoistureBalance === "stretches_stays" ||
    profile.heatStyling === "daily" ||
    profile.heatStyling === "several_weekly" ||
    hasRepairGoal ||
    hasColorOrBleachTreatment(profile.chemicalTreatment)

  if (
    structuralLevel === "severe" ||
    (hasBleach && hasSnapPattern) ||
    (hasBleach && structuralLevel === "high")
  ) {
    return "recommend"
  }

  if (
    hasBleach ||
    hasSnapPattern ||
    structuralLevel === "high" ||
    (hasShapeChangingStress && hasShapeDamageContext && structuralLevel === "moderate")
  ) {
    return "consider"
  }

  return "none"
}

export function buildDamageAssessment(profile: NormalizedProfile): DamageAssessment {
  let structuralScore = 0
  let heatScore = 0
  let mechanicalScore = 0

  const activeDamageDrivers: string[] = []
  const activeProtectiveFactors: string[] = []
  const missingInputs: string[] = []

  switch (profile.cuticleCondition) {
    case "slightly_rough":
      structuralScore += 2
      activeDamageDrivers.push("cuticle_slightly_rough")
      break
    case "rough":
      structuralScore += 4
      activeDamageDrivers.push("cuticle_rough")
      break
    case "smooth":
      activeProtectiveFactors.push("cuticle_smooth")
      break
    default:
      missingInputs.push("cuticle_condition")
  }

  switch (profile.proteinMoistureBalance) {
    case "stretches_stays":
      structuralScore += 2
      activeDamageDrivers.push("protein_direction_weakness")
      break
    case "snaps":
      structuralScore += 3
      activeDamageDrivers.push("brittle_snap_pattern")
      break
    case "stretches_bounces":
      activeProtectiveFactors.push("balanced_pull_test")
      break
    default:
      missingInputs.push("protein_moisture_balance")
  }

  structuralScore += getChemicalTreatmentDamageWeight(profile.chemicalTreatment)
  activeDamageDrivers.push(...getChemicalTreatmentDamageDrivers(profile.chemicalTreatment))

  const structuralConcernContribution = deriveStructuralConcernContribution(profile)
  structuralScore += structuralConcernContribution.score
  activeDamageDrivers.push(...structuralConcernContribution.drivers)

  switch (profile.heatStyling) {
    case "daily":
      heatScore += 4
      activeDamageDrivers.push("daily_heat")
      break
    case "several_weekly":
      heatScore += 3
      activeDamageDrivers.push("frequent_heat")
      break
    case "once_weekly":
      heatScore += 2
      activeDamageDrivers.push("weekly_heat")
      break
    case "rarely":
      heatScore += 1
      break
    case "never":
      activeProtectiveFactors.push("no_heat_styling")
      break
    default:
      missingInputs.push("heat_styling")
  }

  if (profile.heatStyling && profile.heatStyling !== "never") {
    if (profile.usesHeatProtection) {
      heatScore = Math.max(0, heatScore - 1)
      activeProtectiveFactors.push("uses_heat_protection")
    } else {
      heatScore += 1
      activeDamageDrivers.push("missing_heat_protection")
    }
  }

  if (profile.towelTechnique === "rough_rubbing") {
    mechanicalScore += 2
    activeDamageDrivers.push("towel_rubbing")
  } else if (profile.towelTechnique === "gentle_press") {
    activeProtectiveFactors.push("gentle_towel_technique")
  }

  const brushMechanicalStress = getBrushMechanicalStressContribution(profile.brushType)
  mechanicalScore += brushMechanicalStress.score
  activeDamageDrivers.push(...brushMechanicalStress.drivers)

  if (isExplicitNoneArray(profile.nightProtection)) {
    mechanicalScore += 1
    activeDamageDrivers.push("missing_night_protection")
  } else if ((profile.nightProtection?.length ?? 0) > 0) {
    activeProtectiveFactors.push("night_protection_present")
  } else {
    missingInputs.push("night_protection")
  }

  const structuralLevel = scoreToDamageLevel(structuralScore)
  const heatLevel = scoreToDamageLevel(heatScore)
  const mechanicalLevel = scoreToDamageLevel(mechanicalScore)
  const overallLevel = scoreToDamageLevel(Math.max(structuralScore, heatScore, mechanicalScore))

  return {
    overallLevel,
    structuralLevel,
    heatLevel,
    mechanicalLevel,
    repairPriority: deriveRepairPriority(structuralLevel, heatLevel, mechanicalLevel),
    balanceDirection: deriveBalanceDirection(profile),
    bondBuilderPriority: deriveBondBuilderPriority(profile, structuralLevel),
    activeDamageDrivers,
    activeProtectiveFactors,
    confidence: missingInputs.length >= 3 ? "low" : missingInputs.length > 0 ? "medium" : "high",
    missingInputs,
  }
}
