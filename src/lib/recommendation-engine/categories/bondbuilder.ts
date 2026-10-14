import type {
  BondbuilderCategoryDecision,
  DamageAssessment,
  InterventionPlan,
  NormalizedProfile,
  RecommendationRequestContext,
} from "@/lib/recommendation-engine/types"
import {
  deriveBondApplicationMode,
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
