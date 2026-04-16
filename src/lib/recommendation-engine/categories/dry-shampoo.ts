import type {
  CategoryFitEvaluation,
  DryShampooCategoryDecision,
  InterventionPlan,
  NormalizedProfile,
} from "@/lib/recommendation-engine/types"
import { deriveScalpTypeFocus, getPlannedStep } from "@/lib/recommendation-engine/categories/shared"

export interface DryShampooFitSpec {
  scalp_type_focus: "oily" | "balanced" | null
}

export function buildDryShampooCategoryDecision(
  profile: NormalizedProfile,
  plan: InterventionPlan,
): DryShampooCategoryDecision {
  const step = getPlannedStep(plan, "dry_shampoo")

  if (!step) {
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
    action: step.action,
    planReasonCodes: step.reasonCodes,
    currentInventory: profile.routineInventory.dry_shampoo,
    targetProfile: {
      scalpTypeFocus: scalpTypeFocus === "dry" ? "balanced" : scalpTypeFocus,
    },
    notes: scalpTypeFocus === "dry" ? ["dry_shampoo_never_targets_dry_scalp"] : [],
  }
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

  if (!decision.targetProfile.scalpTypeFocus || !spec.scalp_type_focus) {
    return {
      status: "unknown",
      reasonCodes: ["dry_shampoo_fit_missing_scalp_focus"],
      missingFields: ["scalp_type_focus"],
    }
  }

  if (decision.targetProfile.scalpTypeFocus === spec.scalp_type_focus) {
    return {
      status: "ideal",
      reasonCodes: ["dry_shampoo_scalp_focus_exact_match"],
      missingFields: [],
    }
  }

  if (decision.targetProfile.scalpTypeFocus === "oily" && spec.scalp_type_focus === "balanced") {
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
