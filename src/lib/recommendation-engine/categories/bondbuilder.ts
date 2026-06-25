import type {
  BondbuilderCategoryDecision,
  CategoryFitEvaluation,
  DamageAssessment,
  InterventionPlan,
  NormalizedProfile,
  RecommendationRequestContext,
} from "@/lib/recommendation-engine/types"
import {
  deriveBondApplicationMode,
  deriveBondRepairIntensity,
  getPlannedStep,
} from "@/lib/recommendation-engine/categories/shared"
import { emptyRecommendationRequestContext } from "@/lib/recommendation-engine/request-context"

function includesAny(values: readonly string[], needles: readonly string[]): boolean {
  return needles.some((needle) => values.includes(needle))
}

function deriveLaneHints(damage: DamageAssessment): {
  chemicalCrosslinkLane: boolean
  peptideChainLane: boolean
  mixedOrSevereCombo: boolean
  proteinBalanceSupportingOnly: boolean
  reasonCodes: string[]
} {
  const drivers = damage.activeDamageDrivers
  const chemicalCrosslinkLane = includesAny(drivers, [
    "bleached_hair",
    "colored_hair",
    "permed_hair",
    "chemically_straightened_hair",
  ])
  const peptideChainLane = includesAny(drivers, [
    "brittle_snap_pattern",
    "protein_direction_weakness",
    "daily_heat",
    "frequent_heat",
    "concern_breakage",
    "concern_structural_cluster",
  ])
  const mixedOrSevereCombo =
    damage.structuralLevel === "severe" ||
    (damage.bondBuilderPriority === "recommend" && chemicalCrosslinkLane && peptideChainLane)
  const proteinBalanceSupportingOnly =
    includesAny(drivers, ["brittle_snap_pattern", "protein_direction_weakness"]) &&
    damage.bondBuilderPriority === "none"
  const reasonCodes: string[] = []

  if (chemicalCrosslinkLane) reasonCodes.push("bondbuilder_chemical_crosslink_lane")
  if (peptideChainLane) reasonCodes.push("bondbuilder_peptide_chain_lane")
  if (mixedOrSevereCombo) reasonCodes.push("bondbuilder_mixed_severe_combo")
  if (proteinBalanceSupportingOnly) {
    reasonCodes.push("bondbuilder_protein_balance_supporting_only")
  }

  return {
    chemicalCrosslinkLane,
    peptideChainLane,
    mixedOrSevereCombo,
    proteinBalanceSupportingOnly,
    reasonCodes,
  }
}

export interface BondbuilderFitSpec {
  bond_repair_intensity: "maintenance" | "intensive" | null
  application_mode: "pre_shampoo" | "post_wash_leave_in" | null
  bond_repair_axis?: "disulfide_crosslink" | "peptide_chain" | null
  treatment_mode?: "rinse_out" | "leave_in" | null
  product_format?:
    | "cream_treatment"
    | "primer_treatment"
    | "leave_in_mask"
    | "spray_treatment"
    | null
  usage_protocol?:
    | "olaplex_3plus"
    | "olaplex_0_booster"
    | "olaplex_3_legacy"
    | "k18_leave_in"
    | "epres_spray"
    | null
}

export function buildBondbuilderCategoryDecision(
  profile: NormalizedProfile,
  damage: DamageAssessment,
  plan: InterventionPlan,
  requestContext: RecommendationRequestContext = emptyRecommendationRequestContext(),
): BondbuilderCategoryDecision {
  const step = getPlannedStep(plan, "bondbuilder")
  const laneHints = deriveLaneHints(damage)
  const explicitBondbuilderRequest = requestContext.requestedCategory === "bondbuilder"

  if (!step) {
    if (explicitBondbuilderRequest) {
      return {
        category: "bondbuilder",
        relevant: true,
        action: null,
        planReasonCodes: ["bondbuilder_explicit_optional_low_need", ...laneHints.reasonCodes],
        currentInventory: profile.routineInventory.bondbuilder,
        targetProfile: {
          bondRepairIntensity: deriveBondRepairIntensity(damage) ?? "maintenance",
          applicationMode: deriveBondApplicationMode(profile),
          chemicalCrosslinkLane: laneHints.chemicalCrosslinkLane,
          peptideChainLane: laneHints.peptideChainLane,
          mixedOrSevereCombo: laneHints.mixedOrSevereCombo,
          proteinBalanceSupportingOnly: laneHints.proteinBalanceSupportingOnly,
          role: "optional",
        },
        notes: ["bondbuilder_explicit_request_optional_low_need"],
      }
    }

    return {
      category: "bondbuilder",
      relevant: false,
      action: null,
      planReasonCodes: laneHints.proteinBalanceSupportingOnly
        ? ["bondbuilder_protein_balance_supporting_only"]
        : [],
      currentInventory: profile.routineInventory.bondbuilder,
      targetProfile: null,
      notes: [],
    }
  }

  return {
    category: "bondbuilder",
    relevant: true,
    action: step.action,
    planReasonCodes: [...step.reasonCodes, ...laneHints.reasonCodes],
    currentInventory: profile.routineInventory.bondbuilder,
    targetProfile: {
      bondRepairIntensity: deriveBondRepairIntensity(damage),
      applicationMode: deriveBondApplicationMode(profile),
      chemicalCrosslinkLane: laneHints.chemicalCrosslinkLane,
      peptideChainLane: laneHints.peptideChainLane,
      mixedOrSevereCombo: laneHints.mixedOrSevereCombo,
      proteinBalanceSupportingOnly: laneHints.proteinBalanceSupportingOnly,
      role: "recommended",
    },
    notes: [],
  }
}

export function evaluateBondbuilderFit(
  decision: BondbuilderCategoryDecision,
  spec: BondbuilderFitSpec | null,
): CategoryFitEvaluation {
  if (!decision.relevant || !decision.targetProfile) {
    return {
      status: "not_applicable",
      reasonCodes: [],
      missingFields: [],
    }
  }

  if (!spec) {
    return {
      status: "unknown",
      reasonCodes: ["bondbuilder_specs_missing"],
      missingFields: ["bond_repair_intensity"],
    }
  }

  const missingFields: string[] = []
  if (decision.targetProfile.bondRepairIntensity && !spec.bond_repair_intensity) {
    missingFields.push("bond_repair_intensity")
  }

  if (missingFields.length > 0) {
    return {
      status: "unknown",
      reasonCodes: ["bondbuilder_fit_missing_structured_fields"],
      missingFields,
    }
  }

  const reasonCodes: string[] = []
  const intensityMatch = decision.targetProfile.bondRepairIntensity === spec.bond_repair_intensity

  if (intensityMatch) reasonCodes.push("bondbuilder_intensity_exact_match")
  else if (
    decision.targetProfile.bondRepairIntensity === "maintenance" &&
    spec.bond_repair_intensity === "intensive"
  ) {
    reasonCodes.push("bondbuilder_intensity_stronger_than_needed")
  } else {
    reasonCodes.push("bondbuilder_intensity_mismatch")
  }

  if (!intensityMatch) {
    if (
      decision.targetProfile.bondRepairIntensity === "maintenance" &&
      spec.bond_repair_intensity === "intensive"
    ) {
      return {
        status: "supportive",
        reasonCodes,
        missingFields: [],
      }
    }

    return {
      status: "mismatch",
      reasonCodes,
      missingFields: [],
    }
  }

  return {
    status: "ideal",
    reasonCodes,
    missingFields: [],
  }
}
