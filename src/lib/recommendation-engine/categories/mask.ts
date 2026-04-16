import type {
  CategoryFitEvaluation,
  DamageAssessment,
  InterventionPlan,
  MaskCategoryDecision,
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

export interface MaskFitSpec {
  weight: "light" | "medium" | "rich" | null
  concentration?: "low" | "medium" | "high" | null
  repair_level?: "low" | "medium" | "high" | null
  balance_direction?: "protein" | "moisture" | "balanced" | null
}

function deriveMaskNeedStrength(damage: DamageAssessment): 0 | 1 | 2 | 3 {
  if (damage.repairPriority === "high" || damage.overallLevel === "severe") return 3
  if (damage.repairPriority === "medium" || damage.overallLevel === "high") return 2
  if (damage.overallLevel === "moderate") return 1
  return 0
}

export function buildMaskCategoryDecision(
  profile: NormalizedProfile,
  damage: DamageAssessment,
  plan: InterventionPlan,
): MaskCategoryDecision {
  const step = getPlannedStep(plan, "mask")

  if (!step) {
    return {
      category: "mask",
      relevant: false,
      action: null,
      planReasonCodes: [],
      currentInventory: profile.routineInventory.mask,
      targetProfile: null,
      notes: [],
    }
  }

  const notes: string[] = []
  const targetWeight = deriveTargetWeight(profile)
  if (!targetWeight) {
    notes.push("mask_weight_needs_thickness_and_density")
  }
  notes.push("mask_concentration_is_temporary_repair_level_proxy")

  return {
    category: "mask",
    relevant: true,
    action: step.action,
    planReasonCodes: step.reasonCodes,
    currentInventory: profile.routineInventory.mask,
    targetProfile: {
      balance: deriveBalanceTarget(damage),
      repairLevel: deriveRepairLevel(damage),
      weight: targetWeight,
      needStrength: deriveMaskNeedStrength(damage),
    },
    notes,
  }
}

export function evaluateMaskFit(
  decision: MaskCategoryDecision,
  spec: MaskFitSpec | null,
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
      reasonCodes: ["mask_specs_missing"],
      missingFields: ["weight", "repair_level", "balance_direction"],
    }
  }

  const repairLevel = spec.repair_level ?? spec.concentration ?? null
  const missingFields: string[] = []

  if (decision.targetProfile.weight && !spec.weight) missingFields.push("weight")
  if (decision.targetProfile.repairLevel && !repairLevel) missingFields.push("repair_level")
  if (decision.targetProfile.balance && !spec.balance_direction) {
    missingFields.push("balance_direction")
  }

  if (missingFields.length > 0) {
    return {
      status: "unknown",
      reasonCodes: ["mask_fit_missing_structured_fields"],
      missingFields,
    }
  }

  const weightFit = compareWeightFit(decision.targetProfile.weight, spec.weight)
  const repairFit = compareRepairLevelFit(decision.targetProfile.repairLevel, repairLevel)
  const balanceFit = compareBalanceFit(
    decision.targetProfile.balance,
    spec.balance_direction ?? null,
  )

  const reasonCodes: string[] = []
  const fitStates = [weightFit, repairFit, balanceFit]

  if (weightFit === "exact") reasonCodes.push("mask_weight_exact_match")
  if (repairFit === "exact") reasonCodes.push("mask_repair_exact_match")
  if (balanceFit === "exact") reasonCodes.push("mask_balance_exact_match")
  if (weightFit === "close") reasonCodes.push("mask_weight_close_match")
  if (repairFit === "close") reasonCodes.push("mask_repair_close_match")
  if (balanceFit === "close") reasonCodes.push("mask_balance_close_match")
  if (weightFit === "mismatch") reasonCodes.push("mask_weight_mismatch")
  if (repairFit === "mismatch") reasonCodes.push("mask_repair_mismatch")
  if (balanceFit === "mismatch") reasonCodes.push("mask_balance_mismatch")

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
