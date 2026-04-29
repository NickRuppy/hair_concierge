import type {
  CategoryFitEvaluation,
  ConditionerCategoryDecision,
  DamageAssessment,
  InterventionPlan,
  NormalizedProfile,
} from "@/lib/recommendation-engine/types"
import {
  compareBalanceFit,
  compareRepairLevelFit,
  compareWeightFit,
  deriveBalanceTarget,
  deriveRepairLevel,
  deriveTargetWeight,
  getPlannedStep,
} from "@/lib/recommendation-engine/categories/shared"
import type { HairThickness } from "@/lib/vocabulary"

export interface ConditionerFitSpec {
  weight: "light" | "medium" | "rich" | null
  repair_level: "low" | "medium" | "high" | null
  balance_direction?: "protein" | "moisture" | "balanced" | null
  suitable_thicknesses?: HairThickness[] | null
}

export function buildConditionerCategoryDecision(
  profile: NormalizedProfile,
  damage: DamageAssessment,
  plan: InterventionPlan,
): ConditionerCategoryDecision {
  const step = getPlannedStep(plan, "conditioner")
  const hasConditioner = profile.routineInventory.conditioner !== null
  const notes: string[] = []
  const targetWeight = deriveTargetWeight(profile)
  if (!targetWeight) {
    notes.push("conditioner_weight_needs_thickness_and_density")
  }
  if (!profile.thickness) {
    notes.push("conditioner_profile_thickness_missing")
  }

  return {
    category: "conditioner",
    relevant: true,
    action: step?.action ?? (hasConditioner ? "keep" : "add"),
    planReasonCodes: step?.reasonCodes ?? [
      "baseline_core_care",
      hasConditioner ? "conditioner_already_present" : "missing_conditioner_inventory",
    ],
    currentInventory: profile.routineInventory.conditioner,
    targetProfile: {
      balance: deriveBalanceTarget(damage),
      repairLevel: deriveRepairLevel(damage),
      weight: targetWeight,
      thickness: profile.thickness,
      activeDamageDrivers: damage.activeDamageDrivers,
    },
    notes,
  }
}

export function evaluateConditionerFit(
  decision: ConditionerCategoryDecision,
  spec: ConditionerFitSpec | null,
): CategoryFitEvaluation {
  if (!decision.relevant || !decision.targetProfile) {
    return {
      status: "not_applicable",
      reasonCodes: [],
      missingFields: [],
    }
  }

  const missingFields: string[] = []
  if (!spec) {
    return {
      status: "unknown",
      reasonCodes: ["conditioner_specs_missing"],
      missingFields: ["weight", "repair_level", "balance_direction"],
    }
  }

  if (decision.targetProfile.weight && !spec.weight) missingFields.push("weight")
  if (decision.targetProfile.repairLevel && !spec.repair_level) missingFields.push("repair_level")
  if (decision.targetProfile.balance && !spec.balance_direction) {
    missingFields.push("balance_direction")
  }
  if (
    decision.targetProfile.thickness &&
    (!spec.suitable_thicknesses || spec.suitable_thicknesses.length === 0)
  ) {
    missingFields.push("suitable_thicknesses")
  }

  if (missingFields.length > 0) {
    return {
      status: "unknown",
      reasonCodes: ["conditioner_fit_missing_structured_fields"],
      missingFields,
    }
  }

  const weightFit = compareWeightFit(decision.targetProfile.weight, spec.weight)
  const repairFit = compareRepairLevelFit(decision.targetProfile.repairLevel, spec.repair_level)
  const balanceFit = compareBalanceFit(
    decision.targetProfile.balance,
    spec.balance_direction ?? null,
  )
  const thicknessFit =
    decision.targetProfile.thickness &&
    spec.suitable_thicknesses &&
    spec.suitable_thicknesses.length > 0
      ? spec.suitable_thicknesses.includes(decision.targetProfile.thickness)
        ? "exact"
        : "mismatch"
      : "unknown"

  const reasonCodes: string[] = []
  const fitStates = [weightFit, repairFit, balanceFit, thicknessFit]

  if (thicknessFit === "exact") reasonCodes.push("conditioner_thickness_exact_match")
  if (thicknessFit === "unknown") reasonCodes.push("conditioner_thickness_unknown")
  if (thicknessFit === "mismatch") reasonCodes.push("conditioner_thickness_mismatch")
  if (weightFit === "exact") reasonCodes.push("conditioner_weight_exact_match")
  if (repairFit === "exact") reasonCodes.push("conditioner_repair_exact_match")
  if (balanceFit === "exact") reasonCodes.push("conditioner_balance_exact_match")
  if (weightFit === "close") reasonCodes.push("conditioner_weight_close_match")
  if (repairFit === "close") reasonCodes.push("conditioner_repair_close_match")
  if (balanceFit === "close") reasonCodes.push("conditioner_balance_close_match")
  if (weightFit === "mismatch") reasonCodes.push("conditioner_weight_mismatch")
  if (repairFit === "mismatch") reasonCodes.push("conditioner_repair_mismatch")
  if (balanceFit === "mismatch") reasonCodes.push("conditioner_balance_mismatch")

  if (fitStates.includes("mismatch")) {
    return {
      status: "mismatch",
      reasonCodes,
      missingFields: [],
    }
  }

  if (fitStates.every((state) => state === "exact" || state === "unknown")) {
    return {
      status: "ideal",
      reasonCodes,
      missingFields: [],
    }
  }

  return {
    status: "supportive",
    reasonCodes,
    missingFields: [],
  }
}
