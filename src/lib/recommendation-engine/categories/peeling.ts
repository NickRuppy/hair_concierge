import type {
  CategoryFitEvaluation,
  DamageAssessment,
  InterventionPlan,
  NormalizedProfile,
  PeelingCategoryDecision,
} from "@/lib/recommendation-engine/types"
import {
  derivePeelingType,
  deriveScalpTypeFocus,
  getPlannedStep,
  hasScalpDrynessOrIrritationRisk,
} from "@/lib/recommendation-engine/categories/shared"

export interface PeelingFitSpec {
  scalp_type_focus: "oily" | "balanced" | "dry" | null
  peeling_type: "acid_serum" | "physical_scrub" | null
}

export function buildPeelingCategoryDecision(
  profile: NormalizedProfile,
  damage: DamageAssessment,
  plan: InterventionPlan,
): PeelingCategoryDecision {
  const step = getPlannedStep(plan, "peeling")

  if (!step) {
    return {
      category: "peeling",
      relevant: false,
      action: null,
      planReasonCodes: [],
      currentInventory: profile.routineInventory.peeling,
      targetProfile: null,
      notes: [],
    }
  }

  const notes: string[] = []
  if (hasScalpDrynessOrIrritationRisk(profile, damage)) {
    notes.push("peeling_requires_caution_under_dryness_or_irritation_risk")
  }

  return {
    category: "peeling",
    relevant: true,
    action: step.action,
    planReasonCodes: step.reasonCodes,
    currentInventory: profile.routineInventory.peeling,
    targetProfile: {
      scalpTypeFocus: deriveScalpTypeFocus(profile),
      peelingType: derivePeelingType(profile),
    },
    notes,
  }
}

export function evaluatePeelingFit(
  decision: PeelingCategoryDecision,
  spec: PeelingFitSpec | null,
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
      reasonCodes: ["peeling_specs_missing"],
      missingFields: ["scalp_type_focus", "peeling_type"],
    }
  }

  const missingFields: string[] = []
  if (decision.targetProfile.scalpTypeFocus && !spec.scalp_type_focus) {
    missingFields.push("scalp_type_focus")
  }
  if (decision.targetProfile.peelingType && !spec.peeling_type) {
    missingFields.push("peeling_type")
  }

  if (missingFields.length > 0) {
    return {
      status: "unknown",
      reasonCodes: ["peeling_fit_missing_structured_fields"],
      missingFields,
    }
  }

  const exactScalpMatch = decision.targetProfile.scalpTypeFocus === spec.scalp_type_focus
  const exactTypeMatch = decision.targetProfile.peelingType === spec.peeling_type

  if (exactScalpMatch && exactTypeMatch) {
    return {
      status: "ideal",
      reasonCodes: ["peeling_scalp_focus_exact_match", "peeling_type_exact_match"],
      missingFields: [],
    }
  }

  if (!exactTypeMatch) {
    return {
      status: "mismatch",
      reasonCodes: ["peeling_type_mismatch"],
      missingFields: [],
    }
  }

  if (
    decision.targetProfile.scalpTypeFocus === "balanced" ||
    spec.scalp_type_focus === "balanced"
  ) {
    return {
      status: "supportive",
      reasonCodes: ["peeling_scalp_focus_close_match", "peeling_type_exact_match"],
      missingFields: [],
    }
  }

  return {
    status: "mismatch",
    reasonCodes: ["peeling_scalp_focus_mismatch", "peeling_type_exact_match"],
    missingFields: [],
  }
}
