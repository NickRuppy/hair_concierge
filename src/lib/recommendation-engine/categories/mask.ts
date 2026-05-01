import type {
  CategoryFitEvaluation,
  CanonicalRepairLevel,
  DamageAssessment,
  InterventionPlan,
  MaskCategoryDecision,
  NormalizedProfile,
  RecommendationRequestContext,
  ResetAssessment,
} from "@/lib/recommendation-engine/types"
import {
  deriveBalanceTarget,
  deriveRepairLevel,
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

function upliftRepairLevel(level: CanonicalRepairLevel | null): CanonicalRepairLevel | null {
  switch (level) {
    case "low":
      return "medium"
    case "medium":
      return "high"
    default:
      return level
  }
}

function deriveMaskTargetWeight(profile: NormalizedProfile): "light" | "medium" | "rich" | null {
  if (!profile.thickness || !profile.density) return null

  if (profile.thickness === "fine") return "light"

  if (profile.thickness === "normal") {
    if (profile.density === "low") return "light"
    if (profile.density === "medium") return "medium"
    return "rich"
  }

  if (profile.density === "low") return "medium"
  return "rich"
}

export function buildMaskCategoryDecision(
  profile: NormalizedProfile,
  damage: DamageAssessment,
  plan: InterventionPlan,
  requestContext: RecommendationRequestContext,
  reset?: ResetAssessment,
): MaskCategoryDecision {
  const step = getPlannedStep(plan, "mask")
  const explicitMaskRequest = requestContext.requestedCategory === "mask"
  const needStrength = deriveMaskNeedStrength(damage)
  const inferredMediumOrHigherNeed = needStrength >= 2

  if (!step && !explicitMaskRequest && !inferredMediumOrHigherNeed) {
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
  const strongResetFirst = reset?.richOptionalCareRisk && reset.level === "strong"
  const targetWeight = deriveMaskTargetWeight(profile)
  const baseRepairLevel = deriveRepairLevel(damage)
  const repairLevel =
    explicitMaskRequest && requestContext.maskIntensityRequest === "intensive"
      ? upliftRepairLevel(baseRepairLevel)
      : baseRepairLevel
  if (!targetWeight) {
    notes.push("mask_weight_needs_thickness_and_density")
  }
  notes.push("mask_concentration_is_temporary_repair_level_proxy")

  if (explicitMaskRequest && needStrength < 2) {
    notes.push("mask_explicit_request_optional_low_need")
  }
  if (explicitMaskRequest && requestContext.maskIntensityRequest === "intensive") {
    notes.push("mask_explicit_intensive_request_uplift")
  }
  if (strongResetFirst) {
    notes.push("mask_deemphasized_until_reset")
  }

  return {
    category: "mask",
    relevant: true,
    action: strongResetFirst
      ? profile.routineInventory.mask
        ? "decrease_frequency"
        : "behavior_change_only"
      : (step?.action ?? (profile.routineInventory.mask ? "keep" : "add")),
    planReasonCodes: step
      ? explicitMaskRequest
        ? [
            ...step.reasonCodes,
            "explicit_mask_request",
            ...(strongResetFirst ? ["reset_first_overload_risk"] : []),
          ]
        : step.reasonCodes
      : explicitMaskRequest
        ? ["explicit_mask_request", ...(strongResetFirst ? ["reset_first_overload_risk"] : [])]
        : ["derived_medium_mask_need", ...(strongResetFirst ? ["reset_first_overload_risk"] : [])],
    currentInventory: profile.routineInventory.mask,
    targetProfile: {
      balance: deriveBalanceTarget(damage),
      repairLevel,
      weight: targetWeight,
      needStrength,
      role: strongResetFirst ? "optional" : needStrength >= 2 ? "fixed" : "optional",
      intensityRequest: requestContext.maskIntensityRequest,
      thickness: profile.thickness,
      density: profile.density,
    },
    notes,
  }
}

type AxisFit = "exact" | "supportive" | "mismatch" | "unknown"

function evaluateMaskBalanceFit(
  expected: NonNullable<MaskCategoryDecision["targetProfile"]>["balance"],
  actual: MaskFitSpec["balance_direction"],
): { fit: AxisFit; reasonCodes: string[] } {
  if (!expected || !actual) {
    return { fit: "unknown", reasonCodes: [] }
  }

  if (expected === actual) {
    return { fit: "exact", reasonCodes: ["mask_balance_exact_match"] }
  }

  if (actual === "balanced") {
    return {
      fit: "supportive",
      reasonCodes: ["mask_balance_close_match", "mask_balanced_bridge_supportive"],
    }
  }

  if (expected === "balanced") {
    return {
      fit: "supportive",
      reasonCodes: ["mask_balance_close_match"],
    }
  }

  return {
    fit: "mismatch",
    reasonCodes: ["mask_balance_mismatch", "mask_wrong_balance_stiff_dull_risk"],
  }
}

function evaluateMaskConcentrationFit(
  target: NonNullable<MaskCategoryDecision["targetProfile"]>,
  actual: "low" | "medium" | "high" | null | undefined,
): { fit: AxisFit; reasonCodes: string[] } {
  if (!target.repairLevel || !actual) {
    return { fit: "unknown", reasonCodes: [] }
  }

  if (target.needStrength >= 3 || target.repairLevel === "high") {
    if (actual === "high") {
      return { fit: "exact", reasonCodes: ["mask_concentration_exact_match"] }
    }
    if (actual === "medium") {
      return { fit: "supportive", reasonCodes: ["mask_concentration_close_match"] }
    }
    return {
      fit: "mismatch",
      reasonCodes: [
        "mask_concentration_mismatch",
        "mask_low_concentration_may_be_underpowered_caveat",
      ],
    }
  }

  if (target.intensityRequest === "intensive" && target.repairLevel === "medium") {
    if (actual === "medium") {
      return {
        fit: "exact",
        reasonCodes: [
          "mask_concentration_exact_match",
          "mask_optional_overcare_caveat",
          "mask_high_intensity_use_sparingly_caveat",
        ],
      }
    }
    if (actual === "high") {
      return {
        fit: "supportive",
        reasonCodes: [
          "mask_concentration_close_match",
          "mask_optional_overcare_caveat",
          "mask_high_intensity_use_sparingly_caveat",
        ],
      }
    }
    return {
      fit: "supportive",
      reasonCodes: [
        "mask_concentration_close_match",
        "mask_low_concentration_may_be_underpowered_caveat",
      ],
    }
  }

  if (target.needStrength <= 1 || target.repairLevel === "low") {
    if (actual === "low") {
      return { fit: "exact", reasonCodes: ["mask_concentration_exact_match"] }
    }
    if (actual === "medium") {
      return {
        fit: "supportive",
        reasonCodes: ["mask_concentration_close_match", "mask_optional_overcare_caveat"],
      }
    }
    return {
      fit: "mismatch",
      reasonCodes: [
        "mask_concentration_mismatch",
        "mask_optional_overcare_caveat",
        "mask_high_intensity_use_sparingly_caveat",
      ],
    }
  }

  if (actual === "medium") {
    return { fit: "exact", reasonCodes: ["mask_concentration_exact_match"] }
  }

  if (actual === "high") {
    return {
      fit: "supportive",
      reasonCodes: ["mask_concentration_close_match", "mask_high_intensity_use_sparingly_caveat"],
    }
  }

  return {
    fit: "supportive",
    reasonCodes: [
      "mask_concentration_close_match",
      "mask_low_concentration_may_be_underpowered_caveat",
    ],
  }
}

function evaluateMaskWeightFit(
  target: NonNullable<MaskCategoryDecision["targetProfile"]>,
  actual: MaskFitSpec["weight"],
): { fit: AxisFit; reasonCodes: string[] } {
  if (!target.weight || !actual) {
    return { fit: "unknown", reasonCodes: [] }
  }

  if (target.weight === actual) {
    return { fit: "exact", reasonCodes: ["mask_weight_exact_match"] }
  }

  const fineOrLowDensity = target.thickness === "fine" || target.density === "low"
  if ((fineOrLowDensity || target.weight === "light") && actual === "rich") {
    return {
      fit: "mismatch",
      reasonCodes: ["mask_weight_mismatch", "mask_rich_weight_can_weigh_down_caveat"],
    }
  }

  if (target.weight === "rich" && actual === "light") {
    return {
      fit: "supportive",
      reasonCodes: ["mask_weight_close_match", "mask_light_weight_may_be_underpowered_caveat"],
    }
  }

  return {
    fit: "supportive",
    reasonCodes:
      actual === "rich"
        ? ["mask_weight_close_match", "mask_rich_weight_can_weigh_down_caveat"]
        : ["mask_weight_close_match"],
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

  const weightFit = evaluateMaskWeightFit(decision.targetProfile, spec.weight)
  const concentrationFit = evaluateMaskConcentrationFit(decision.targetProfile, repairLevel)
  const balanceFit = evaluateMaskBalanceFit(
    decision.targetProfile.balance,
    spec.balance_direction ?? null,
  )

  const axisFits = [weightFit, concentrationFit, balanceFit]
  const reasonCodes = axisFits.flatMap((fit) => fit.reasonCodes)

  if (axisFits.some((fit) => fit.fit === "mismatch")) {
    return {
      status: "mismatch",
      reasonCodes,
      missingFields: [],
    }
  }

  if (axisFits.every((fit) => fit.fit === "exact" || fit.fit === "unknown")) {
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
