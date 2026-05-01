import type {
  CategoryFitEvaluation,
  DamageAssessment,
  DeepCleansingShampooCategoryDecision,
  InterventionPlan,
  NormalizedProfile,
  RecommendationRequestContext,
  ResetAssessment,
  ResetFocus,
  ResetIntensity,
} from "@/lib/recommendation-engine/types"
import { deriveScalpTypeFocus, getPlannedStep } from "@/lib/recommendation-engine/categories/shared"

export interface DeepCleansingShampooFitSpec {
  scalp_type_focus: "oily" | "balanced" | "dry" | null
  reset_intensity?: ResetIntensity | null
  reset_focus?: ResetFocus | null
  color_treated_suitability?: "suitable" | "unsuitable_or_unknown" | null
}

function deriveTargetIntensity(
  reset: ResetAssessment,
  profile: NormalizedProfile,
): ResetIntensity | null {
  if (reset.level === "none" || reset.level === "possible") return "gentle"

  const cautious =
    reset.cautionFlags.length > 0 ||
    profile.hairTexture === "curly" ||
    profile.hairTexture === "coily"

  if (reset.level === "strong") {
    return cautious ? "medium" : "strong"
  }

  return cautious ? "gentle" : "medium"
}

function isColorTreated(profile: NormalizedProfile): boolean {
  return (
    profile.chemicalTreatment.includes("colored") || profile.chemicalTreatment.includes("bleached")
  )
}

export function buildDeepCleansingShampooCategoryDecision(
  profile: NormalizedProfile,
  damage: DamageAssessment,
  plan: InterventionPlan,
  requestContext: RecommendationRequestContext,
  reset: ResetAssessment,
): DeepCleansingShampooCategoryDecision {
  const step = getPlannedStep(plan, "deep_cleansing_shampoo")
  const explicitRequest = requestContext.requestedCategory === "deep_cleansing_shampoo"
  const productEligible =
    explicitRequest || reset.level === "likely" || reset.level === "strong" || Boolean(step)

  if (!productEligible) {
    return {
      category: "deep_cleansing_shampoo",
      relevant: reset.level === "possible",
      action: null,
      planReasonCodes:
        reset.level === "possible" ? ["guidance_only_possible_reset", ...reset.triggers] : [],
      currentInventory: profile.routineInventory.deep_cleansing_shampoo,
      targetProfile: null,
      notes: reset.level === "possible" ? ["guidance_only_possible_reset"] : [],
    }
  }

  const notes: string[] = []

  if (requestContext.scalpTreatmentIntent) {
    return {
      category: "deep_cleansing_shampoo",
      relevant: true,
      action: "behavior_change_only",
      planReasonCodes: ["scalp_treatment_needed", ...reset.triggers],
      currentInventory: profile.routineInventory.deep_cleansing_shampoo,
      targetProfile: null,
      notes: ["scalp_treatment_needed"],
    }
  }

  if (reset.level === "likely" && damage.overallLevel !== "low" && damage.overallLevel !== "none") {
    notes.push("deep_reset_requires_caution_under_damage_pressure")
  }
  if (reset.level === "possible") {
    notes.push("guidance_only_possible_reset")
  }

  return {
    category: "deep_cleansing_shampoo",
    relevant: true,
    action: step?.action ?? (profile.routineInventory.deep_cleansing_shampoo ? "keep" : "add"),
    planReasonCodes: [
      ...(step?.reasonCodes ?? []),
      ...(explicitRequest ? ["explicit_deep_cleansing_request"] : []),
      ...reset.triggers,
    ],
    currentInventory: profile.routineInventory.deep_cleansing_shampoo,
    targetProfile: {
      scalpTypeFocus: deriveScalpTypeFocus(profile),
      resetNeedLevel: reset.level,
      resetFocus: reset.resetFocus ?? "general_buildup",
      targetIntensity: deriveTargetIntensity(reset, profile),
      colorTreatedCaution: isColorTreated(profile),
      colorSafeRequest: requestContext.colorSafeRequest,
      cautionFlags: reset.cautionFlags,
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

  const target = decision.targetProfile
  const reasonCodes: string[] = []
  const missingFields: string[] = []

  if (!spec.reset_focus) {
    missingFields.push("reset_focus")
  } else if (target.resetFocus === spec.reset_focus) {
    reasonCodes.push("deep_cleansing_reset_focus_exact_match")
  } else if (spec.reset_focus === "broad_spectrum") {
    reasonCodes.push("deep_cleansing_reset_focus_close_match")
  } else if (target.resetFocus === "broad_spectrum") {
    reasonCodes.push("deep_cleansing_reset_focus_partial_match")
  } else {
    reasonCodes.push("deep_cleansing_reset_focus_mismatch")
  }

  if (!spec.reset_intensity || !target.targetIntensity) {
    missingFields.push("reset_intensity")
  } else if (target.targetIntensity === spec.reset_intensity) {
    reasonCodes.push("deep_cleansing_reset_intensity_exact_match")
  } else if (
    target.targetIntensity === "medium" ||
    spec.reset_intensity === "medium" ||
    (target.targetIntensity === "strong" && spec.reset_intensity === "gentle")
  ) {
    reasonCodes.push("deep_cleansing_reset_intensity_close_match")
  } else {
    reasonCodes.push("deep_cleansing_reset_intensity_mismatch")
  }

  if (target.colorSafeRequest && spec.color_treated_suitability === "suitable") {
    reasonCodes.push("deep_cleansing_color_safe_exact_match")
  } else if (target.colorSafeRequest && spec.color_treated_suitability !== "suitable") {
    reasonCodes.push("deep_cleansing_color_safe_mismatch")
  }

  if (!target.scalpTypeFocus || !spec.scalp_type_focus) {
    missingFields.push("scalp_type_focus")
    return {
      status: missingFields.length >= 3 ? "unknown" : "supportive",
      reasonCodes: [...reasonCodes, "deep_cleansing_fit_missing_scalp_focus"],
      missingFields,
    }
  }

  if (target.scalpTypeFocus === spec.scalp_type_focus) {
    reasonCodes.push("deep_cleansing_scalp_focus_exact_match")
  } else if (target.scalpTypeFocus === "balanced" || spec.scalp_type_focus === "balanced") {
    reasonCodes.push("deep_cleansing_scalp_focus_close_match")
  } else {
    reasonCodes.push("deep_cleansing_scalp_focus_mismatch")
  }

  if (
    reasonCodes.includes("deep_cleansing_reset_focus_mismatch") ||
    reasonCodes.includes("deep_cleansing_color_safe_mismatch")
  ) {
    return { status: "mismatch", reasonCodes, missingFields }
  }

  if (reasonCodes.some((code) => code.endsWith("_mismatch"))) {
    return { status: "supportive", reasonCodes, missingFields }
  }

  return {
    status: missingFields.length > 0 ? "supportive" : "ideal",
    reasonCodes,
    missingFields,
  }
}
