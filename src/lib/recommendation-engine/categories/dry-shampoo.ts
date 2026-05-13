import type {
  CategoryFitEvaluation,
  DryShampooCategoryDecision,
  DryShampooTargetProfile,
  InterventionPlan,
  NormalizedProfile,
  RecommendationRequestContext,
  ResetAssessment,
} from "@/lib/recommendation-engine/types"
import { getPlannedStep, isFrequencyAtLeast } from "@/lib/recommendation-engine/categories/shared"
import { emptyRecommendationRequestContext } from "@/lib/recommendation-engine/request-context"

export interface DryShampooFitSpec {
  primary_effect: DryShampooTargetProfile["primaryEffectTarget"] | null
  hair_color_fit: DryShampooTargetProfile["hairColorFitTarget"] | null
  scalp_sensitivity_fit: "sensitive_ok" | "normal_only" | null
  format: NonNullable<DryShampooTargetProfile["preferredFormat"]> | null
}

const HARD_NO_REASONS = new Set([
  "dry_shampoo_scalp_issue_hard_no",
  "dry_shampoo_buildup_hard_no",
  "dry_shampoo_frequent_use_reset_needed",
  "dry_shampoo_dry_breakage_hard_no",
  "dry_shampoo_respiratory_aerosol_caution",
  "dry_shampoo_child_context_hard_no",
])

function profileHardNoReasons(profile: NormalizedProfile): string[] {
  const reasons: string[] = []

  if (
    profile.scalpCondition === "irritated" ||
    profile.scalpCondition === "dry_flakes" ||
    profile.concerns.includes("dandruff")
  ) {
    reasons.push("dry_shampoo_scalp_issue_hard_no")
  }

  if (profile.concerns.includes("hair_loss")) {
    reasons.push("dry_shampoo_scalp_issue_hard_no")
  }

  const currentUse = profile.routineInventory.dry_shampoo?.frequencyBand ?? null
  if (isFrequencyAtLeast(currentUse, "3_4x")) {
    reasons.push("dry_shampoo_frequent_use_reset_needed")
  }

  return Array.from(new Set(reasons))
}

function hasResetHardNo(reset: ResetAssessment | null): boolean {
  return (
    reset?.triggers.includes("frequent_dry_shampoo_use") ||
    reset?.triggers.includes("dry_shampoo_reset_pressure") ||
    reset?.triggers.some(
      (trigger) =>
        trigger.includes("coated") ||
        trigger.includes("buildup") ||
        trigger.includes("waxy") ||
        trigger.includes("product_buildup"),
    ) === true
  )
}

export function buildDryShampooCategoryDecision(
  profile: NormalizedProfile,
  plan: InterventionPlan,
  requestContext: RecommendationRequestContext = emptyRecommendationRequestContext(),
  reset: ResetAssessment | null = null,
): DryShampooCategoryDecision {
  const step = getPlannedStep(plan, "dry_shampoo")
  const bridgeReasons = requestContext.dryShampooBridgeNeedReasonCodes ?? []
  const requestCautions = requestContext.dryShampooCautionReasonCodes ?? []
  const cautionReasons = Array.from(new Set([...requestCautions, ...profileHardNoReasons(profile)]))
  const hardNo =
    cautionReasons.some((reason) => HARD_NO_REASONS.has(reason)) || hasResetHardNo(reset)
  const oilyScalpOnly =
    bridgeReasons.length === 0 &&
    (profile.scalpType === "oily" || profile.concerns.includes("oily_scalp"))

  if (!step || hardNo || bridgeReasons.length === 0) {
    return {
      category: "dry_shampoo",
      relevant: false,
      action: step?.action ?? null,
      planReasonCodes: step?.reasonCodes ?? [],
      currentInventory: profile.routineInventory.dry_shampoo,
      targetProfile: null,
      notes: [
        ...(oilyScalpOnly ? ["dry_shampoo_oily_scalp_alone_not_enough"] : []),
        ...cautionReasons,
        ...(hasResetHardNo(reset) ? ["dry_shampoo_frequent_use_reset_needed"] : []),
      ],
    }
  }

  const requiresSensitiveFit = requestContext.dryShampooRequiresSensitiveFit === true
  const targetProfile: DryShampooTargetProfile = {
    primaryEffectTarget:
      requestContext.dryShampooPrimaryEffectRequest ??
      (requiresSensitiveFit ? "sensitive_refresh" : "classic_refresh"),
    hairColorFitTarget: requestContext.dryShampooHairColorFitRequest ?? "universal",
    requiresSensitiveFit,
    preferredFormat: requestContext.dryShampooPreferredFormat ?? null,
    bridgeNeedReasonCodes: bridgeReasons,
    cautionReasonCodes: cautionReasons,
  }

  return {
    category: "dry_shampoo",
    relevant: true,
    action: step.action,
    planReasonCodes: step.reasonCodes,
    currentInventory: profile.routineInventory.dry_shampoo,
    targetProfile,
    notes: cautionReasons,
  }
}

function isTintMismatch(
  target: DryShampooTargetProfile["hairColorFitTarget"],
  actual: DryShampooFitSpec["hair_color_fit"],
): boolean {
  if (!actual || actual === "universal" || target === "universal") return false
  if (target === actual) return false
  return true
}

export function evaluateDryShampooFit(
  decision: DryShampooCategoryDecision,
  spec: DryShampooFitSpec | null,
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
      reasonCodes: ["dry_shampoo_specs_missing"],
      missingFields: ["primary_effect", "hair_color_fit", "scalp_sensitivity_fit", "format"],
    }
  }

  const target = decision.targetProfile
  const missingFields = (
    ["primary_effect", "hair_color_fit", "scalp_sensitivity_fit", "format"] as const
  ).filter((field) => !spec[field])

  if (missingFields.length > 0) {
    return {
      status: "unknown",
      reasonCodes: ["dry_shampoo_specs_incomplete"],
      missingFields,
    }
  }

  if (
    isTintMismatch(target.hairColorFitTarget, spec.hair_color_fit) ||
    (target.requiresSensitiveFit && spec.scalp_sensitivity_fit === "normal_only") ||
    (target.cautionReasonCodes?.includes("dry_shampoo_avoid_aerosol_format_request") &&
      spec.format === "aerosol_spray")
  ) {
    return {
      status: "mismatch",
      reasonCodes: ["dry_shampoo_fit_hard_mismatch"],
      missingFields: [],
    }
  }

  const primaryExact = spec.primary_effect === target.primaryEffectTarget
  const sensitiveBridge =
    target.requiresSensitiveFit &&
    target.primaryEffectTarget === "classic_refresh" &&
    spec.primary_effect === "sensitive_refresh"
  const colorFits =
    spec.hair_color_fit === "universal" || spec.hair_color_fit === target.hairColorFitTarget
  const sensitivityFits =
    !target.requiresSensitiveFit || spec.scalp_sensitivity_fit === "sensitive_ok"
  const formatFits = !target.preferredFormat || spec.format === target.preferredFormat

  if ((primaryExact || sensitiveBridge) && colorFits && sensitivityFits && formatFits) {
    return {
      status: "ideal",
      reasonCodes: ["dry_shampoo_fit_exact_match"],
      missingFields: [],
    }
  }

  if ((primaryExact || sensitiveBridge || spec.primary_effect === "classic_refresh") && colorFits) {
    return {
      status: "supportive",
      reasonCodes: ["dry_shampoo_fit_supportive_match"],
      missingFields: [],
    }
  }

  return {
    status: "mismatch",
    reasonCodes: ["dry_shampoo_fit_mismatch"],
    missingFields: [],
  }
}
