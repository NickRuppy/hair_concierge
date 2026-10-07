import { isProductFrequencyAtLeast } from "@/lib/vocabulary/frequencies"
import type {
  LeaveInFunction,
  PlanCareDirection,
  PlanCareWeight,
  PlanCategoryDecision,
  PlanCoverageOwnership,
  PlanFunctionPriority,
  PlanNeedAssessment,
  PlanNeedTier,
  PlanProfile,
  PlanReasonFact,
  PlanRepairSupportLevel,
} from "../types"

const WEIGHTS: readonly PlanCareWeight[] = ["light", "medium", "rich"] as const

function has<T extends string>(values: readonly T[], value: T): boolean {
  return values.includes(value)
}

function reason(id: string, salience: PlanReasonFact["salience"] = "primary"): PlanReasonFact {
  return { id, salience, evidence: [], values: {} }
}

function shift(weight: PlanCareWeight, delta: -1 | 1): PlanCareWeight {
  const index = WEIGHTS.indexOf(weight)
  return WEIGHTS[Math.min(WEIGHTS.length - 1, Math.max(0, index + delta))]
}

function baseWeight(profile: PlanProfile): PlanCareWeight {
  const weight =
    profile.hair.thickness === "fine"
      ? "light"
      : profile.hair.thickness === "coarse"
        ? "rich"
        : "medium"
  return has(profile.concerns, "low_volume_or_weighed_down") ? shift(weight, -1) : weight
}

function contextualCareDirection(profile: PlanProfile): PlanCareDirection {
  const moisture =
    Number(has(profile.concerns, "dry_lengths") || has(profile.concerns, "tangling")) +
    Number(has(profile.concerns, "frizz_flyaways")) +
    Number(has(profile.goals, "moisture") || has(profile.goals, "frizz_surface")) +
    Number(profile.hair.surface === "rough" || profile.hair.surface === "slightly_uneven")
  const protein =
    Number(
      has(profile.concerns, "hair_damage") ||
        has(profile.concerns, "breakage") ||
        has(profile.concerns, "split_ends"),
    ) +
    Number(has(profile.goals, "strength_ends")) +
    Number(
      has(profile.hair.chemicalTreatments, "lightened") ||
        has(profile.hair.chemicalTreatments, "permed") ||
        has(profile.hair.chemicalTreatments, "chemically_straightened"),
    )

  if (profile.hair.elasticity === "snaps")
    return protein >= 2 && moisture === 0 ? "balanced" : "moisture"
  if (profile.hair.elasticity === "stretches_stays") {
    return moisture >= 2 && protein === 0 ? "balanced" : "protein"
  }
  if (moisture >= 2 && protein < 2) return "moisture"
  if (protein >= 2 && moisture < 2) return "protein"
  return "balanced"
}

function repairLevel(assessments: PlanNeedAssessment): PlanRepairSupportLevel {
  if (assessments.damage.repairPriority === "high") return "high"
  if (assessments.damage.repairPriority === "medium") return "medium"
  return "low"
}

function priority(hasConcern: boolean, hasGoal: boolean): PlanFunctionPriority {
  if (hasConcern && hasGoal) return 3
  if (hasConcern) return 2
  return 1
}

function recurringHeat(assessments: PlanNeedAssessment): boolean {
  return assessments.heatExposure.events.some(
    (event) =>
      (event.route === "airflow_shaping" || event.route === "direct_contact_heat") &&
      isProductFrequencyAtLeast(event.frequency, "weekly_1x"),
  )
}

function heatOnlyKnown(assessments: PlanNeedAssessment): boolean {
  return assessments.heatExposure.state === "present" && assessments.heatExposure.events.length > 0
}

function careSignals(profile: PlanProfile, assessments: PlanNeedAssessment) {
  const concerns = new Set(profile.concerns)
  const goals = new Set(profile.goals)
  const strongTreatment =
    has(profile.hair.chemicalTreatments, "lightened") ||
    has(profile.hair.chemicalTreatments, "permed") ||
    has(profile.hair.chemicalTreatments, "chemically_straightened")
  const materialRepair =
    (assessments.damage.repairPriority === "medium" ||
      assessments.damage.repairPriority === "high") &&
    (assessments.damage.structuralSignals.length > 0 ||
      assessments.damage.mechanicalSignals.length > 0)

  return {
    dry: concerns.has("dry_lengths"),
    rough: profile.hair.surface === "rough",
    tangling: concerns.has("tangling"),
    frizz: concerns.has("frizz_flyaways"),
    lowShine: concerns.has("low_shine"),
    lostShape: concerns.has("lost_shape"),
    breakageOrSplit: concerns.has("breakage") || concerns.has("split_ends"),
    moistureGoal: goals.has("moisture"),
    frizzGoal: goals.has("frizz_surface"),
    shineGoal: goals.has("shine"),
    strengthGoal: goals.has("strength_ends"),
    definitionGoal: goals.has("shape_definition"),
    manageabilityGoal: goals.has("manageability_styling"),
    strongTreatment,
    coloredOnly: has(profile.hair.chemicalTreatments, "colored") && !strongTreatment,
    materialRepair,
  }
}

function inclusion(
  profile: PlanProfile,
  assessments: PlanNeedAssessment,
): {
  tier: PlanNeedTier
  ruleId: string
} {
  const s = careSignals(profile, assessments)
  const careFrizz = s.frizz && (s.dry || s.rough || s.tangling)
  const qualifyingHeatCare =
    s.dry ||
    s.rough ||
    s.moistureGoal ||
    careFrizz ||
    profile.hair.texture === "curly" ||
    profile.hair.texture === "coily" ||
    s.strongTreatment ||
    s.materialRepair

  if (s.tangling) return { tier: "basis", ruleId: "leave_in.inclusion.detangling" }
  if (s.dry && s.rough) return { tier: "basis", ruleId: "leave_in.inclusion.dry_rough" }
  if (s.dry && s.moistureGoal)
    return { tier: "basis", ruleId: "leave_in.inclusion.dry_moisture_goal" }
  if (s.dry && s.tangling) return { tier: "basis", ruleId: "leave_in.inclusion.dry_tangling" }
  if (careFrizz) return { tier: "basis", ruleId: "leave_in.inclusion.care_frizz" }
  if (s.strongTreatment)
    return { tier: "basis", ruleId: "leave_in.inclusion.intensive_treatment_care" }
  if (profile.hair.texture === "coily")
    return { tier: "basis", ruleId: "leave_in.inclusion.coily_texture" }
  if (recurringHeat(assessments) && qualifyingHeatCare) {
    return { tier: "basis", ruleId: "leave_in.inclusion.recurring_heat_care" }
  }

  if (
    (profile.hair.texture === "wavy" || profile.hair.texture === "curly") &&
    (s.definitionGoal || s.lostShape)
  ) {
    return { tier: "optional", ruleId: "leave_in.inclusion.definition_only" }
  }
  if (
    s.dry ||
    s.rough ||
    s.moistureGoal ||
    (s.frizz && !s.lostShape) ||
    profile.hair.texture === "curly"
  ) {
    return { tier: "optional", ruleId: "leave_in.inclusion.single_care_signal" }
  }
  if (s.coloredOnly) return { tier: "optional", ruleId: "leave_in.inclusion.colored_only" }
  if (s.shineGoal || s.lowShine)
    return { tier: "optional", ruleId: "leave_in.inclusion.shine_only" }
  if (s.breakageOrSplit || s.strengthGoal) {
    return { tier: "optional", ruleId: "leave_in.inclusion.repair_only" }
  }
  if (s.manageabilityGoal)
    return { tier: "optional", ruleId: "leave_in.inclusion.manageability_goal_only" }

  if (heatOnlyKnown(assessments)) return { tier: "not_needed", ruleId: "leave_in.inclusion.no_job" }
  return { tier: "not_needed", ruleId: "leave_in.inclusion.no_job" }
}

function functions(profile: PlanProfile, assessments: PlanNeedAssessment) {
  const s = careSignals(profile, assessments)
  const functions: Array<{
    function: LeaveInFunction
    priority: PlanFunctionPriority
    ownership: PlanCoverageOwnership
  }> = []

  if (s.tangling) {
    functions.push({
      function: "detangle",
      priority: s.manageabilityGoal ? 3 : 2,
      ownership: "required",
    })
  }
  if (s.dry || s.rough || s.moistureGoal || profile.hair.texture === "coily") {
    functions.push({
      function: "moisture_softness",
      priority: priority(s.dry || s.rough, s.moistureGoal),
      ownership:
        s.dry && (s.rough || s.moistureGoal || profile.hair.texture === "coily")
          ? "required"
          : "supporting",
    })
  }
  if (s.frizz || s.frizzGoal) {
    functions.push({
      function: "smooth_anti_frizz",
      priority: priority(s.frizz, s.frizzGoal),
      ownership: s.frizz && (s.dry || s.rough || s.tangling) ? "required" : "supporting",
    })
  }
  if (recurringHeat(assessments) && functions.length > 0) {
    functions.push({ function: "heat_protect", priority: 2, ownership: "required" })
  }
  if (s.breakageOrSplit || s.strengthGoal || assessments.damage.repairPriority !== "none") {
    functions.push({
      function: "repair_support",
      priority: priority(s.breakageOrSplit, s.strengthGoal),
      ownership: "supporting",
    })
  }
  if (
    (profile.hair.texture === "wavy" ||
      profile.hair.texture === "curly" ||
      profile.hair.texture === "coily") &&
    (s.definitionGoal || s.lostShape)
  ) {
    functions.push({
      function: "curl_shape_support",
      priority: priority(s.lostShape, s.definitionGoal),
      ownership: "supporting",
    })
  }
  if (s.lowShine || s.shineGoal) {
    functions.push({
      function: "shine_support",
      priority: priority(s.lowShine, s.shineGoal),
      ownership: "supporting",
    })
  }

  return functions
}

export function buildLeaveInDecision(
  profile: PlanProfile,
  assessments: PlanNeedAssessment,
): PlanCategoryDecision {
  const resolved = inclusion(profile, assessments)
  if (resolved.tier === "not_needed") {
    return {
      category: "leave_in",
      resolution: "resolved",
      needTier: "not_needed",
      roles: [],
      target: null,
      frequency: null,
      reasons: [reason(resolved.ruleId)],
      executionState: "available",
      executionPauseReason: null,
      deferredFacts: [],
    }
  }

  const targetFunctions = functions(profile, assessments)
  const includeHeatRole = targetFunctions.some((candidate) => candidate.function === "heat_protect")
  const roles = includeHeatRole
    ? (["post_wash_leave_in", "pre_heat_application"] as const)
    : (["post_wash_leave_in"] as const)

  return {
    category: "leave_in",
    resolution: "resolved",
    needTier: resolved.tier,
    roles: [...roles],
    target: {
      category: "leave_in",
      roles: [...roles],
      weight: baseWeight(profile),
      careDirection: contextualCareDirection(profile),
      repairSupportLevel: repairLevel(assessments),
      functions: targetFunctions,
      conditionerReplacementEligible:
        profile.hair.thickness === "fine" && profile.hair.length === "very_short",
    },
    frequency: {
      kind: "after_each_eligible_wash",
      roles: ["post_wash_leave_in"],
      dependsOn: "wet_wash_total",
      placementState: "known_after_refined_wash_cadence",
    },
    reasons: [
      reason(resolved.ruleId),
      reason("leave_in.target.weight", "secondary"),
      reason("leave_in.target.care_direction", "secondary"),
      reason("leave_in.target.repair_support", "detail"),
      ...(includeHeatRole ? [reason("leave_in.occurrence.pre_heat_application", "secondary")] : []),
    ],
    executionState: "available",
    executionPauseReason: null,
    deferredFacts: [],
  }
}
