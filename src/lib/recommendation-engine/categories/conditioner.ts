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

export interface ConditionerFitSpec {
  weight: "light" | "medium" | "rich" | null
  repair_level: "low" | "medium" | "high" | null
  balance_direction?: "protein" | "moisture" | "balanced" | null
}

export function buildConditionerCategoryDecision(
  profile: NormalizedProfile,
  damage: DamageAssessment,
  plan: InterventionPlan,
): ConditionerCategoryDecision {
  const step = getPlannedStep(plan, "conditioner")

  if (!step) {
    return {
      category: "conditioner",
      relevant: false,
      action: null,
      planReasonCodes: [],
      currentInventory: profile.routineInventory.conditioner,
      targetProfile: null,
      notes: [],
    }
  }

  const notes: string[] = []
  const targetWeight = deriveTargetWeight(profile)
  if (!targetWeight) {
    notes.push("conditioner_weight_needs_thickness_and_density")
  }

  return {
    category: "conditioner",
    relevant: true,
    action: step.action,
    planReasonCodes: step.reasonCodes,
    currentInventory: profile.routineInventory.conditioner,
    targetProfile: {
      balance: deriveBalanceTarget(damage),
      repairLevel: deriveRepairLevel(damage),
      weight: targetWeight,
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

  const reasonCodes: string[] = []
  const fitStates = [weightFit, repairFit, balanceFit]

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
