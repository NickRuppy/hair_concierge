import type {
  CategoryFitEvaluation,
  CareNeedAssessment,
  DamageAssessment,
  InterventionPlan,
  LeaveInCareTarget,
  LeaveInCategoryDecision,
  LeaveInConditionerRelationship,
  LeaveInStylingContext,
  NormalizedProfile,
} from "@/lib/recommendation-engine/types"
import type {
  LeaveInApplicationStage,
  LeaveInCareBenefit,
  LeaveInRole,
} from "@/lib/leave-in/constants"
import { deriveLeaveInStylingContextFromStages } from "@/lib/profile/signal-derivations"
import {
  compareWeightFit,
  deriveTargetWeight,
  getPlannedStep,
} from "@/lib/recommendation-engine/categories/shared"

export interface LeaveInFitSpec {
  weight: "light" | "medium" | "rich" | null
  roles: LeaveInRole[]
  provides_heat_protection: boolean
  care_benefits: LeaveInCareBenefit[]
  application_stage: LeaveInApplicationStage[]
}

const LEAVE_IN_CARE_TARGET_PRIORITY: LeaveInCareTarget[] = [
  "heat_protect",
  "curl_definition",
  "repair",
  "detangle_smooth",
]

function deriveLeaveInStylingContext(profile: NormalizedProfile): LeaveInStylingContext | null {
  return deriveLeaveInStylingContextFromStages(
    profile.dryingMethod,
    profile.heatStyling,
    profile.stylingTools,
  )
}

function deriveLeaveInNeedBucket(
  profile: NormalizedProfile,
  damage: DamageAssessment,
  careNeeds: CareNeedAssessment,
): LeaveInCareTarget | null {
  if (
    profile.heatStyling &&
    profile.heatStyling !== "never" &&
    careNeeds.thermalProtectionNeed !== "none"
  ) {
    return "heat_protect"
  }

  if (
    careNeeds.definitionSupportNeed !== "none" &&
    (profile.hairTexture === "wavy" ||
      profile.hairTexture === "curly" ||
      profile.hairTexture === "coily")
  ) {
    return "curl_definition"
  }

  if (
    damage.repairPriority === "high" ||
    damage.overallLevel === "high" ||
    damage.overallLevel === "severe"
  ) {
    return "repair"
  }

  if (
    careNeeds.hydrationNeed !== "none" ||
    careNeeds.smoothingNeed !== "none" ||
    careNeeds.detanglingNeed !== "none"
  ) {
    return "detangle_smooth"
  }

  return null
}

function deriveConditionerRelationship(
  profile: NormalizedProfile,
): LeaveInConditionerRelationship | null {
  if (!profile.thickness || !profile.density) return null

  if (profile.thickness === "fine" || profile.density === "low") {
    return "replacement_capable"
  }

  return "booster_only"
}

function deriveCareTargets(
  needBucket: LeaveInCareTarget | null,
  damage: DamageAssessment,
  careNeeds: CareNeedAssessment,
): LeaveInCareTarget[] {
  const careTargets = new Set<LeaveInCareTarget>()

  if (needBucket) careTargets.add(needBucket)

  if (careNeeds.thermalProtectionNeed !== "none") {
    careTargets.add("heat_protect")
  }
  if (
    needBucket === "curl_definition" ||
    careNeeds.definitionSupportNeed === "moderate" ||
    careNeeds.definitionSupportNeed === "high" ||
    careNeeds.definitionSupportNeed === "severe"
  ) {
    careTargets.add("curl_definition")
  }
  if (damage.repairPriority === "high") {
    careTargets.add("repair")
  }
  if (
    careNeeds.hydrationNeed !== "none" ||
    careNeeds.smoothingNeed !== "none" ||
    careNeeds.detanglingNeed !== "none"
  ) {
    careTargets.add("detangle_smooth")
  }

  return LEAVE_IN_CARE_TARGET_PRIORITY.filter((target) => careTargets.has(target))
}

function deriveSpecConditionerRelationship(roles: LeaveInRole[]): LeaveInConditionerRelationship {
  if (roles.includes("replacement_conditioner")) {
    return "replacement_capable"
  }

  return "booster_only"
}

function deriveSpecCareTargets(spec: LeaveInFitSpec): LeaveInCareTarget[] {
  const careTargets = new Set<LeaveInCareTarget>()
  const benefits = spec.care_benefits ?? []
  const stages = spec.application_stage ?? []

  if (spec.provides_heat_protection || stages.includes("pre_heat")) {
    careTargets.add("heat_protect")
  }
  if (benefits.includes("curl_definition")) {
    careTargets.add("curl_definition")
  }
  if (benefits.includes("repair") || benefits.includes("protein")) {
    careTargets.add("repair")
  }
  if (
    benefits.includes("moisture") ||
    benefits.includes("anti_frizz") ||
    benefits.includes("detangling")
  ) {
    careTargets.add("detangle_smooth")
  }

  return LEAVE_IN_CARE_TARGET_PRIORITY.filter((target) => careTargets.has(target))
}

export function buildLeaveInCategoryDecision(
  profile: NormalizedProfile,
  damage: DamageAssessment,
  careNeeds: CareNeedAssessment,
  plan: InterventionPlan,
): LeaveInCategoryDecision {
  const step = getPlannedStep(plan, "leave_in")

  if (!step) {
    return {
      category: "leave_in",
      relevant: false,
      action: null,
      planReasonCodes: [],
      currentInventory: profile.routineInventory.leave_in,
      targetProfile: null,
      notes: [],
    }
  }

  const notes: string[] = []
  const stylingContext = deriveLeaveInStylingContext(profile)
  if (!stylingContext) {
    notes.push("leave_in_styling_context_unclear")
  }

  const conditionerRelationship = deriveConditionerRelationship(profile)
  if (!conditionerRelationship) {
    notes.push("leave_in_relationship_needs_thickness_and_density")
  }

  const targetWeight = deriveTargetWeight(profile)
  if (!targetWeight) {
    notes.push("leave_in_weight_needs_thickness_and_density")
  }

  const needBucket = deriveLeaveInNeedBucket(profile, damage, careNeeds)
  const careBenefits = deriveCareTargets(needBucket, damage, careNeeds)

  return {
    category: "leave_in",
    relevant: true,
    action: step.action,
    planReasonCodes: step.reasonCodes,
    currentInventory: profile.routineInventory.leave_in,
    targetProfile: {
      needBucket,
      stylingContext,
      conditionerRelationship,
      weight: targetWeight,
      careBenefits,
    },
    notes,
  }
}

export function evaluateLeaveInFit(
  decision: LeaveInCategoryDecision,
  spec: LeaveInFitSpec | null,
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
      reasonCodes: ["leave_in_specs_missing"],
      missingFields: [
        "weight",
        "roles",
        "provides_heat_protection",
        "care_benefits",
        "application_stage",
      ],
    }
  }

  const reasonCodes: string[] = []
  const missingFields: string[] = []

  if (decision.targetProfile.weight && !spec.weight) {
    missingFields.push("weight")
  }
  if (decision.targetProfile.conditionerRelationship && spec.roles.length === 0) {
    missingFields.push("roles")
  }
  if (
    decision.targetProfile.careBenefits.includes("heat_protect") &&
    spec.application_stage.length === 0
  ) {
    missingFields.push("application_stage")
  }
  if (
    decision.targetProfile.careBenefits.length > 0 &&
    spec.care_benefits.length === 0 &&
    !spec.provides_heat_protection
  ) {
    missingFields.push("care_benefits")
  }

  if (missingFields.length > 0) {
    return {
      status: "unknown",
      reasonCodes: ["leave_in_fit_missing_structured_fields"],
      missingFields,
    }
  }

  const weightFit = compareWeightFit(decision.targetProfile.weight, spec.weight)
  const actualRelationship = deriveSpecConditionerRelationship(spec.roles)
  const actualCareTargets = deriveSpecCareTargets(spec)

  if (weightFit === "exact") reasonCodes.push("leave_in_weight_exact_match")
  if (weightFit === "close") reasonCodes.push("leave_in_weight_close_match")
  if (weightFit === "mismatch") reasonCodes.push("leave_in_weight_mismatch")

  let relationshipFit: "exact" | "close" | "mismatch" = "exact"
  if (
    decision.targetProfile.conditionerRelationship &&
    decision.targetProfile.conditionerRelationship !== actualRelationship
  ) {
    relationshipFit =
      decision.targetProfile.conditionerRelationship === "booster_only" &&
      actualRelationship === "replacement_capable"
        ? "close"
        : "mismatch"
  }

  if (relationshipFit === "exact") {
    reasonCodes.push("leave_in_relationship_exact_match")
  } else if (relationshipFit === "close") {
    reasonCodes.push("leave_in_relationship_close_match")
  } else {
    reasonCodes.push("leave_in_relationship_mismatch")
  }

  const missingBenefits = decision.targetProfile.careBenefits.filter(
    (target) => !actualCareTargets.includes(target),
  )
  const matchedBenefits = decision.targetProfile.careBenefits.filter((target) =>
    actualCareTargets.includes(target),
  )

  let benefitsFit: "exact" | "close" | "mismatch" = "exact"
  if (
    decision.targetProfile.needBucket &&
    !actualCareTargets.includes(decision.targetProfile.needBucket)
  ) {
    benefitsFit = "mismatch"
  } else if (missingBenefits.length > 0) {
    benefitsFit = matchedBenefits.length > 0 ? "close" : "mismatch"
  }

  if (benefitsFit === "exact") {
    reasonCodes.push("leave_in_benefits_exact_match")
  } else if (benefitsFit === "close") {
    reasonCodes.push("leave_in_benefits_partial_match")
  } else {
    reasonCodes.push("leave_in_benefits_mismatch")
  }

  if ([weightFit, relationshipFit, benefitsFit].includes("mismatch")) {
    return {
      status: "mismatch",
      reasonCodes,
      missingFields: [],
    }
  }

  if (weightFit === "exact" && relationshipFit === "exact" && benefitsFit === "exact") {
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
