import type {
  BondbuilderCategoryDecision,
  CategoryFitEvaluation,
  DamageAssessment,
  InterventionPlan,
  NormalizedProfile,
} from "@/lib/recommendation-engine/types"
import {
  deriveBondApplicationMode,
  deriveBondRepairIntensity,
  getPlannedStep,
} from "@/lib/recommendation-engine/categories/shared"

export interface BondbuilderFitSpec {
  bond_repair_intensity: "maintenance" | "intensive" | null
  application_mode: "pre_shampoo" | "post_wash_leave_in" | null
}

export function buildBondbuilderCategoryDecision(
  profile: NormalizedProfile,
  damage: DamageAssessment,
  plan: InterventionPlan,
): BondbuilderCategoryDecision {
  const step = getPlannedStep(plan, "bondbuilder")

  if (!step) {
    return {
      category: "bondbuilder",
      relevant: false,
      action: null,
      planReasonCodes: [],
      currentInventory: profile.routineInventory.bondbuilder,
      targetProfile: null,
      notes: [],
    }
  }

  return {
    category: "bondbuilder",
    relevant: true,
    action: step.action,
    planReasonCodes: step.reasonCodes,
    currentInventory: profile.routineInventory.bondbuilder,
    targetProfile: {
      bondRepairIntensity: deriveBondRepairIntensity(damage),
      applicationMode: deriveBondApplicationMode(profile),
    },
    notes: [],
  }
}

export function evaluateBondbuilderFit(
  decision: BondbuilderCategoryDecision,
  spec: BondbuilderFitSpec | null,
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
      reasonCodes: ["bondbuilder_specs_missing"],
      missingFields: ["bond_repair_intensity", "application_mode"],
    }
  }

  const missingFields: string[] = []
  if (decision.targetProfile.bondRepairIntensity && !spec.bond_repair_intensity) {
    missingFields.push("bond_repair_intensity")
  }
  if (decision.targetProfile.applicationMode && !spec.application_mode) {
    missingFields.push("application_mode")
  }

  if (missingFields.length > 0) {
    return {
      status: "unknown",
      reasonCodes: ["bondbuilder_fit_missing_structured_fields"],
      missingFields,
    }
  }

  const reasonCodes: string[] = []
  const intensityMatch = decision.targetProfile.bondRepairIntensity === spec.bond_repair_intensity
  const modeMatch = decision.targetProfile.applicationMode === spec.application_mode

  if (intensityMatch) reasonCodes.push("bondbuilder_intensity_exact_match")
  else if (
    decision.targetProfile.bondRepairIntensity === "maintenance" &&
    spec.bond_repair_intensity === "intensive"
  ) {
    reasonCodes.push("bondbuilder_intensity_stronger_than_needed")
  } else {
    reasonCodes.push("bondbuilder_intensity_mismatch")
  }

  if (modeMatch) reasonCodes.push("bondbuilder_application_mode_exact_match")
  else reasonCodes.push("bondbuilder_application_mode_mismatch")

  if (!intensityMatch) {
    if (
      decision.targetProfile.bondRepairIntensity === "maintenance" &&
      spec.bond_repair_intensity === "intensive"
    ) {
      return {
        status: "supportive",
        reasonCodes,
        missingFields: [],
      }
    }

    return {
      status: "mismatch",
      reasonCodes,
      missingFields: [],
    }
  }

  return {
    status: modeMatch ? "ideal" : "supportive",
    reasonCodes,
    missingFields: [],
  }
}
