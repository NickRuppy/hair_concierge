import type {
  CategoryFitEvaluation,
  DryShampooCategoryDecision,
  InterventionPlan,
  NormalizedProfile,
  RecommendationRequestContext,
} from "@/lib/recommendation-engine/types"
import { deriveScalpTypeFocus, getPlannedStep } from "@/lib/recommendation-engine/categories/shared"
import { emptyRecommendationRequestContext } from "@/lib/recommendation-engine/request-context"

export interface DryShampooFitSpec {
  scalp_type_focus?: "oily" | "balanced" | null
  primary_effect?: "classic_refresh" | "sensitive_refresh" | "volume_texture" | null
  scalp_sensitivity_fit?: "normal_only" | "sensitive_ok" | null
}

export function buildDryShampooCategoryDecision(
  profile: NormalizedProfile,
  plan: InterventionPlan,
  requestContext: RecommendationRequestContext = emptyRecommendationRequestContext(),
): DryShampooCategoryDecision {
  const step = getPlannedStep(plan, "dry_shampoo")
  const explicitRequest = requestContext.requestedCategory === "dry_shampoo"

  if (!step && !explicitRequest) {
    return {
      category: "dry_shampoo",
      relevant: false,
      action: null,
      planReasonCodes: [],
      currentInventory: profile.routineInventory.dry_shampoo,
      targetProfile: null,
      notes: [],
    }
  }

  const scalpTypeFocus = deriveScalpTypeFocus(profile)

  return {
    category: "dry_shampoo",
    relevant: true,
    action: step?.action ?? "add",
    planReasonCodes: step?.reasonCodes ?? ["explicit_dry_shampoo_request"],
    currentInventory: profile.routineInventory.dry_shampoo,
    targetProfile: {
      scalpTypeFocus: scalpTypeFocus === "dry" ? "balanced" : scalpTypeFocus,
    },
    notes: scalpTypeFocus === "dry" ? ["dry_shampoo_never_targets_dry_scalp"] : [],
  }
}

function resolveDryShampooScalpFocus(spec: DryShampooFitSpec): "oily" | "balanced" | null {
  if (spec.scalp_type_focus) return spec.scalp_type_focus
  if (spec.scalp_sensitivity_fit === "sensitive_ok") return "balanced"
  if (
    spec.scalp_sensitivity_fit === "normal_only" ||
    spec.primary_effect === "classic_refresh" ||
    spec.primary_effect === "volume_texture"
  ) {
    return "oily"
  }

  return null
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
      missingFields: ["scalp_type_focus"],
    }
  }

  const scalpFocus = resolveDryShampooScalpFocus(spec)

  if (!decision.targetProfile.scalpTypeFocus || !scalpFocus) {
    return {
      status: "unknown",
      reasonCodes: ["dry_shampoo_fit_missing_scalp_focus"],
      missingFields: ["scalp_type_focus"],
    }
  }

  if (decision.targetProfile.scalpTypeFocus === scalpFocus) {
    return {
      status: "ideal",
      reasonCodes: ["dry_shampoo_scalp_focus_exact_match"],
      missingFields: [],
    }
  }

  if (decision.targetProfile.scalpTypeFocus === "oily" && scalpFocus === "balanced") {
    return {
      status: "supportive",
      reasonCodes: ["dry_shampoo_scalp_focus_close_match"],
      missingFields: [],
    }
  }

  return {
    status: "mismatch",
    reasonCodes: ["dry_shampoo_scalp_focus_mismatch"],
    missingFields: [],
  }
}
