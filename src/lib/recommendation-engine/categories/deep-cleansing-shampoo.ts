import type {
  CategoryFitEvaluation,
  DamageAssessment,
  DeepCleansingShampooCategoryDecision,
  InterventionPlan,
  NormalizedProfile,
} from "@/lib/recommendation-engine/types"
import {
  deriveBuildupResetNeed,
  deriveScalpTypeFocus,
  getPlannedStep,
} from "@/lib/recommendation-engine/categories/shared"

export interface DeepCleansingShampooFitSpec {
  scalp_type_focus: "oily" | "balanced" | "dry" | null
}

export function buildDeepCleansingShampooCategoryDecision(
  profile: NormalizedProfile,
  damage: DamageAssessment,
  plan: InterventionPlan,
): DeepCleansingShampooCategoryDecision {
  const step = getPlannedStep(plan, "deep_cleansing_shampoo")

  if (!step) {
    return {
      category: "deep_cleansing_shampoo",
      relevant: false,
      action: null,
      planReasonCodes: [],
      currentInventory: profile.routineInventory.deep_cleansing_shampoo,
      targetProfile: null,
      notes: [],
    }
  }

  const resetNeed = deriveBuildupResetNeed(profile)
  const notes: string[] = []

  if (
    resetNeed.level === "moderate" &&
    damage.overallLevel !== "low" &&
    damage.overallLevel !== "none"
  ) {
    notes.push("deep_reset_requires_caution_under_damage_pressure")
  }

  return {
    category: "deep_cleansing_shampoo",
    relevant: true,
    action: step.action,
    planReasonCodes: step.reasonCodes,
    currentInventory: profile.routineInventory.deep_cleansing_shampoo,
    targetProfile: {
      scalpTypeFocus: deriveScalpTypeFocus(profile),
      resetNeedLevel: resetNeed.level,
    },
    notes,
  }
}

export function evaluateDeepCleansingShampooFit(
  decision: DeepCleansingShampooCategoryDecision,
  spec: DeepCleansingShampooFitSpec | null,
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
      reasonCodes: ["deep_cleansing_specs_missing"],
      missingFields: ["scalp_type_focus"],
    }
  }

  if (!decision.targetProfile.scalpTypeFocus || !spec.scalp_type_focus) {
    return {
      status: "unknown",
      reasonCodes: ["deep_cleansing_fit_missing_scalp_focus"],
      missingFields: ["scalp_type_focus"],
    }
  }

  if (decision.targetProfile.scalpTypeFocus === spec.scalp_type_focus) {
    return {
      status: "ideal",
      reasonCodes: ["deep_cleansing_scalp_focus_exact_match"],
      missingFields: [],
    }
  }

  if (
    decision.targetProfile.scalpTypeFocus === "balanced" ||
    spec.scalp_type_focus === "balanced"
  ) {
    return {
      status: "supportive",
      reasonCodes: ["deep_cleansing_scalp_focus_close_match"],
      missingFields: [],
    }
  }

  return {
    status: "mismatch",
    reasonCodes: ["deep_cleansing_scalp_focus_mismatch"],
    missingFields: [],
  }
}
