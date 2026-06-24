import type {
  CategoryFitEvaluation,
  CareNeedAssessment,
  CanonicalBalanceTarget,
  DamageAssessment,
  InterventionPlan,
  InterventionStep,
  LeaveInCareTarget,
  LeaveInCategoryDecision,
  LeaveInHeatProtectionNeed,
  LeaveInConditionerRelationship,
  LeaveInStylingPrepNeed,
  LeaveInStylingContext,
  NormalizedProfile,
  RecommendationRequestContext,
  ResetAssessment,
} from "@/lib/recommendation-engine/types"
import type {
  LeaveInApplicationStage,
  LeaveInCareBenefit,
  LeaveInFormat,
  LeaveInIngredientFlag,
  LeaveInRole,
} from "@/lib/leave-in/constants"
import { deriveLeaveInStylingContextFromStages } from "@/lib/profile/signal-derivations"
import {
  compareBalanceFit,
  compareWeightFit,
  deriveBalanceTarget,
  deriveTargetWeight,
  getPlannedStep,
} from "@/lib/recommendation-engine/categories/shared"
import type { HairThickness } from "@/lib/vocabulary"
import { hasPermTreatment } from "@/lib/profile/chemical-treatment"

export interface LeaveInFitSpec {
  product_id?: string
  format?: LeaveInFormat | null
  weight: "light" | "medium" | "rich" | null
  roles: LeaveInRole[]
  provides_heat_protection: boolean
  heat_protection_max_c?: number | null
  heat_activation_required?: boolean | null
  care_benefits: LeaveInCareBenefit[]
  ingredient_flags?: LeaveInIngredientFlag[] | null
  application_stage: LeaveInApplicationStage[]
  suitable_thicknesses?: HairThickness[] | null
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

function hasHighHeatTool(profile: NormalizedProfile): boolean {
  const tools = profile.stylingTools ?? []
  return tools.some(
    (tool) =>
      tool === "flat_iron" ||
      tool === "curling_iron" ||
      tool === "wave_iron" ||
      tool === "hot_air_brush" ||
      tool === "multi_tool",
  )
}

function hasBlowDryExposure(profile: NormalizedProfile): boolean {
  const tools = profile.stylingTools ?? []
  return (
    profile.dryingMethod === "blow_dry" ||
    profile.dryingMethod === "blow_dry_diffuser" ||
    tools.includes("blow_dryer") ||
    tools.includes("diffuser")
  )
}

function hasModerateHeatExposure(profile: NormalizedProfile): boolean {
  return hasBlowDryExposure(profile) || (profile.stylingTools ?? []).includes("thermal_rollers")
}

function hasNaturalDefinitionTexture(profile: NormalizedProfile): boolean {
  return (
    profile.hairTexture === "wavy" ||
    profile.hairTexture === "curly" ||
    profile.hairTexture === "coily"
  )
}

function hasDefinitionShapeContext(profile: NormalizedProfile): boolean {
  return (
    hasNaturalDefinitionTexture(profile) ||
    (profile.goals.includes("curl_definition") && hasPermTreatment(profile.chemicalTreatment))
  )
}

function deriveHeatProtectionNeed(profile: NormalizedProfile): LeaveInHeatProtectionNeed {
  if (hasHighHeatTool(profile)) return "high"
  if (hasModerateHeatExposure(profile)) return "moderate"

  if (
    profile.heatStyling === "rarely" ||
    profile.heatStyling === "once_weekly" ||
    profile.heatStyling === "several_weekly" ||
    profile.heatStyling === "daily"
  ) {
    return "high"
  }

  return "none"
}

function deriveStylingPrepNeed(
  profile: NormalizedProfile,
  careNeeds: CareNeedAssessment,
): LeaveInStylingPrepNeed {
  if (hasHighHeatTool(profile)) return "heat_style"

  if (
    hasDefinitionShapeContext(profile) &&
    (profile.dryingMethod === "blow_dry_diffuser" ||
      (profile.stylingTools ?? []).includes("diffuser") ||
      careNeeds.definitionSupportNeed !== "none")
  ) {
    return "definition"
  }

  if (
    !hasModerateHeatExposure(profile) &&
    (careNeeds.smoothingNeed === "moderate" || careNeeds.smoothingNeed === "high")
  ) {
    return "smooth_control"
  }

  return "none"
}

function deriveLeaveInNeedBucket(
  profile: NormalizedProfile,
  damage: DamageAssessment,
  careNeeds: CareNeedAssessment,
  heatProtectionNeed: LeaveInHeatProtectionNeed,
): LeaveInCareTarget | null {
  if (heatProtectionNeed !== "none" || careNeeds.thermalProtectionNeed !== "none") {
    return "heat_protect"
  }

  if (careNeeds.definitionSupportNeed !== "none" && hasDefinitionShapeContext(profile)) {
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
  requestContext?: RecommendationRequestContext,
): LeaveInConditionerRelationship | null {
  if (requestContext?.leaveInConditionerRelationshipRequest) {
    return requestContext.leaveInConditionerRelationshipRequest
  }

  if (requestContext?.requestedCategory === "leave_in") {
    return "booster_only"
  }

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
  heatProtectionNeed: LeaveInHeatProtectionNeed,
): LeaveInCareTarget[] {
  const careTargets = new Set<LeaveInCareTarget>()

  if (needBucket) careTargets.add(needBucket)

  if (heatProtectionNeed !== "none" || careNeeds.thermalProtectionNeed !== "none") {
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

function deriveSpecBalanceDirection(spec: LeaveInFitSpec): CanonicalBalanceTarget {
  const benefits = new Set(spec.care_benefits ?? [])
  const proteinSignals = benefits.has("protein")
  const moistureSignals =
    benefits.has("moisture") ||
    benefits.has("anti_frizz") ||
    benefits.has("detangling") ||
    benefits.has("shine")

  if (proteinSignals && !moistureSignals) return "protein"
  if (moistureSignals && !proteinSignals && !benefits.has("repair")) return "moisture"
  return "balanced"
}

function hasSeparateHeatProtectant(profile: NormalizedProfile): boolean {
  return profile.usesHeatProtection || Boolean(profile.routineInventory.heat_protectant?.present)
}

export function buildLeaveInCategoryDecision(
  profile: NormalizedProfile,
  damage: DamageAssessment,
  careNeeds: CareNeedAssessment,
  plan: InterventionPlan,
  requestContext?: RecommendationRequestContext,
  reset?: ResetAssessment,
): LeaveInCategoryDecision {
  const plannedStep = getPlannedStep(plan, "leave_in")
  const explicitRequest = requestContext?.requestedCategory === "leave_in"
  const step: InterventionStep | null =
    plannedStep ??
    (explicitRequest
      ? {
          category: "leave_in",
          action: "add",
          reasonCodes: ["explicit_leave_in_request"],
        }
      : null)

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

  const planReasonCodes = explicitRequest
    ? Array.from(new Set([...step.reasonCodes, "explicit_leave_in_request"]))
    : step.reasonCodes

  const notes: string[] = []
  const resetFirst = reset?.richOptionalCareRisk && reset.level === "strong"
  const stylingContext = deriveLeaveInStylingContext(profile)
  if (!stylingContext) {
    notes.push("leave_in_styling_context_unclear")
  }

  const conditionerRelationship = deriveConditionerRelationship(profile, requestContext)
  if (!conditionerRelationship) {
    notes.push("leave_in_relationship_needs_thickness_and_density")
  }

  const targetWeight =
    resetFirst && !requestContext?.leaveInWeightRequest
      ? "light"
      : (requestContext?.leaveInWeightRequest ?? deriveTargetWeight(profile))
  if (!targetWeight) {
    notes.push("leave_in_weight_needs_thickness_and_density")
  }

  const heatProtectionNeed =
    requestContext?.leaveInHeatProtectionRequest ?? deriveHeatProtectionNeed(profile)
  const hasSeparateHeatProtection =
    requestContext?.leaveInSeparateHeatProtectantMentioned || hasSeparateHeatProtectant(profile)
  const needBucket = deriveLeaveInNeedBucket(profile, damage, careNeeds, heatProtectionNeed)
  const stylingPrepNeed =
    heatProtectionNeed === "high" ? "heat_style" : deriveStylingPrepNeed(profile, careNeeds)
  const targetStylingContext =
    heatProtectionNeed === "high" || stylingPrepNeed === "heat_style"
      ? "heat_style"
      : stylingContext
  const careBenefits = deriveCareTargets(needBucket, damage, careNeeds, heatProtectionNeed)
  if (resetFirst) {
    notes.push("leave_in_lightweight_or_pause_until_reset")
  }

  return {
    category: "leave_in",
    relevant: true,
    action:
      resetFirst && step.action === "add" && !explicitRequest
        ? "behavior_change_only"
        : step.action,
    planReasonCodes: resetFirst
      ? [...planReasonCodes, "reset_first_overload_risk"]
      : planReasonCodes,
    currentInventory: profile.routineInventory.leave_in,
    targetProfile: {
      needBucket,
      stylingContext: targetStylingContext,
      heatProtectionNeed,
      stylingPrepNeed,
      conditionerRelationship,
      weight: targetWeight,
      balanceDirection: deriveBalanceTarget(damage),
      careBenefits,
      applicationStageNeed: heatProtectionNeed !== "none" ? "pre_heat" : null,
      hasSeparateHeatProtectant: hasSeparateHeatProtection,
      thickness: profile.thickness,
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
        "format",
        "weight",
        "roles",
        "provides_heat_protection",
        "heat_activation_required",
        "care_benefits",
        "ingredient_flags",
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
    decision.targetProfile.thickness &&
    (!spec.suitable_thicknesses || spec.suitable_thicknesses.length === 0)
  ) {
    missingFields.push("suitable_thicknesses")
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
  const balanceFit = compareBalanceFit(
    decision.targetProfile.balanceDirection,
    deriveSpecBalanceDirection(spec),
  )
  const thicknessFit =
    decision.targetProfile.thickness &&
    spec.suitable_thicknesses &&
    spec.suitable_thicknesses.length > 0
      ? spec.suitable_thicknesses.includes(decision.targetProfile.thickness)
        ? "exact"
        : "mismatch"
      : "unknown"
  const heatFit =
    decision.targetProfile.heatProtectionNeed === "high"
      ? spec.provides_heat_protection
        ? "exact"
        : "mismatch"
      : decision.targetProfile.heatProtectionNeed === "moderate"
        ? spec.provides_heat_protection
          ? "exact"
          : "close"
        : spec.heat_activation_required
          ? "mismatch"
          : "exact"
  const prepFit =
    decision.targetProfile.stylingPrepNeed === "heat_style"
      ? spec.roles.includes("styling_prep") || spec.application_stage.includes("pre_heat")
        ? "exact"
        : "mismatch"
      : decision.targetProfile.stylingPrepNeed === "definition"
        ? spec.care_benefits.includes("curl_definition") || spec.roles.includes("styling_prep")
          ? "exact"
          : "close"
        : decision.targetProfile.stylingPrepNeed === "smooth_control"
          ? spec.care_benefits.includes("anti_frizz") || spec.roles.includes("styling_prep")
            ? "exact"
            : "close"
          : "exact"

  if (thicknessFit === "exact") reasonCodes.push("leave_in_thickness_exact_match")
  if (thicknessFit === "unknown") reasonCodes.push("leave_in_thickness_unknown")
  if (thicknessFit === "mismatch") reasonCodes.push("leave_in_thickness_mismatch")
  if (weightFit === "exact") reasonCodes.push("leave_in_weight_exact_match")
  if (weightFit === "close") reasonCodes.push("leave_in_weight_close_match")
  if (weightFit === "mismatch") reasonCodes.push("leave_in_weight_mismatch")
  if (balanceFit === "exact") reasonCodes.push("leave_in_balance_exact_match")
  if (balanceFit === "close") reasonCodes.push("leave_in_balance_close_match")
  if (balanceFit === "mismatch") reasonCodes.push("leave_in_balance_mismatch")
  if (heatFit === "exact") reasonCodes.push("leave_in_heat_protection_exact_match")
  if (heatFit === "close") {
    reasonCodes.push(
      decision.targetProfile.heatProtectionNeed === "moderate" && !spec.provides_heat_protection
        ? "leave_in_moderate_heat_protection_gap"
        : "leave_in_heat_protection_bonus_match",
    )
  }
  if (heatFit === "mismatch") {
    reasonCodes.push(
      decision.targetProfile.heatProtectionNeed === "high"
        ? "leave_in_high_heat_protection_mismatch"
        : "leave_in_heat_activation_without_heat_mismatch",
    )
  }
  if (prepFit === "exact") reasonCodes.push("leave_in_styling_prep_exact_match")
  if (prepFit === "close") reasonCodes.push("leave_in_styling_prep_partial_match")
  if (prepFit === "mismatch") reasonCodes.push("leave_in_styling_prep_mismatch")

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
    benefitsFit =
      decision.targetProfile.needBucket === "heat_protect" && heatFit === "close"
        ? "close"
        : "mismatch"
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

  if (
    [thicknessFit, weightFit, relationshipFit, benefitsFit, balanceFit, heatFit, prepFit].includes(
      "mismatch",
    )
  ) {
    return {
      status: "mismatch",
      reasonCodes,
      missingFields: [],
    }
  }

  if (
    weightFit === "exact" &&
    relationshipFit === "exact" &&
    benefitsFit === "exact" &&
    balanceFit === "exact" &&
    heatFit === "exact" &&
    prepFit === "exact" &&
    (thicknessFit === "exact" || thicknessFit === "unknown")
  ) {
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
