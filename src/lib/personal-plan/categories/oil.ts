import type {
  OilFunctionalBenefit,
  PlanCareWeight,
  PlanCategoryDecision,
  PlanCoverageOwnership,
  PlanFunctionPriority,
  PlanNeedAssessment,
  PlanNeedTier,
  PlanProductRole,
  PlanProfile,
  PlanReasonFact,
} from "../types"

type OilRole = Extract<
  PlanProductRole,
  "pre_wash_fibre_treatment" | "leave_on_fibre_conditioning" | "dry_finish"
>

type OilRoleTarget = Extract<
  NonNullable<PlanCategoryDecision["target"]>,
  { category: "oil" }
>["roleTargets"][number]

const ROLE_ORDER: readonly OilRole[] = [
  "pre_wash_fibre_treatment",
  "leave_on_fibre_conditioning",
  "dry_finish",
]

function has<T extends string>(values: readonly T[], value: T): boolean {
  return values.includes(value)
}

function reason(id: string, salience: PlanReasonFact["salience"] = "primary"): PlanReasonFact {
  return { id, salience, evidence: [], values: {} }
}

function strongest(left: PlanNeedTier, right: PlanNeedTier): PlanNeedTier {
  if (left === "basis" || right === "basis") return "basis"
  if (left === "optional" || right === "optional") return "optional"
  return "not_needed"
}

function materialStructuralVulnerability(assessments: PlanNeedAssessment): boolean {
  return (
    assessments.damage.chemicalStress > 0 ||
    assessments.damage.structuralSignals.includes("elastic_response:snaps")
  )
}

function healthyManageableLengths(profile: PlanProfile, assessments: PlanNeedAssessment): boolean {
  return (
    !has(profile.concerns, "dry_lengths") &&
    !has(profile.concerns, "tangling") &&
    !has(profile.concerns, "breakage") &&
    !has(profile.concerns, "split_ends") &&
    profile.hair.surface !== "rough" &&
    !materialStructuralVulnerability(assessments) &&
    !has(profile.concerns, "lost_shape") &&
    !has(profile.goals, "shape_definition")
  )
}

function priority(hasConcern: boolean, hasGoal: boolean): PlanFunctionPriority {
  if (hasConcern && hasGoal) return 3
  if (hasConcern) return 2
  return 1
}

function leaveOnWeight(profile: PlanProfile): PlanCareWeight {
  const loadSensitive = has(profile.concerns, "low_volume_or_weighed_down")
  if (profile.hair.thickness === "fine") return "light"
  if (profile.hair.thickness === "normal") return loadSensitive ? "light" : "medium"
  return loadSensitive ? "medium" : "rich"
}

function benefit(
  benefit: OilFunctionalBenefit,
  priorityValue: PlanFunctionPriority,
  ownership: PlanCoverageOwnership,
) {
  return { benefit, priority: priorityValue, ownership }
}

function dryFinish(
  profile: PlanProfile,
  assessments: PlanNeedAssessment,
): OilRoleTarget & {
  ruleId: string
} {
  const lowShine = has(profile.concerns, "low_shine")
  const shineGoal = has(profile.goals, "shine")
  const frizz = has(profile.concerns, "frizz_flyaways")
  const frizzGoal = has(profile.goals, "frizz_surface")
  const dryOrRough = has(profile.concerns, "dry_lengths") || profile.hair.surface === "rough"

  let tier: PlanNeedTier = "not_needed"
  let ruleId = "oil.dry_finish.no_job"
  let selectedBenefit: OilFunctionalBenefit = "shine"

  if (lowShine) {
    tier = "basis"
    ruleId = "oil.dry_finish.low_shine"
    selectedBenefit = "shine"
  } else if (shineGoal && healthyManageableLengths(profile, assessments)) {
    tier = "basis"
    ruleId = "oil.dry_finish.shine_goal_direct"
    selectedBenefit = "shine"
  } else if (shineGoal) {
    tier = "optional"
    ruleId = "oil.dry_finish.shine_goal_support"
    selectedBenefit = "shine"
  } else if (frizz) {
    tier = "optional"
    ruleId = "oil.dry_finish.frizz_flyaways"
    selectedBenefit = "smoothing_frizz_control"
  } else if (frizzGoal) {
    tier = "optional"
    ruleId = "oil.dry_finish.frizz_goal"
    selectedBenefit = "smoothing_frizz_control"
  } else if (dryOrRough) {
    tier = "optional"
    ruleId = "oil.dry_finish.dry_rough_support"
    selectedBenefit = "smoothing_frizz_control"
  }

  return {
    role: "dry_finish",
    tier: tier === "not_needed" ? "optional" : tier,
    weight: leaveOnWeight(profile),
    functionalBenefits:
      tier === "not_needed"
        ? []
        : [
            benefit(
              selectedBenefit,
              selectedBenefit === "shine"
                ? priority(lowShine, shineGoal)
                : priority(frizz || dryOrRough, frizzGoal),
              selectedBenefit === "shine" && tier === "basis" ? "primary" : "supporting",
            ),
          ],
    ruleId,
  }
}

function preWash(
  profile: PlanProfile,
  assessments: PlanNeedAssessment,
): OilRoleTarget & {
  ruleId: string
} {
  const vulnerable = materialStructuralVulnerability(assessments)
  const breakage = has(profile.concerns, "breakage")
  const splitEnds = has(profile.concerns, "split_ends")
  const dryRough = has(profile.concerns, "dry_lengths") && profile.hair.surface === "rough"
  const goalLed = has(profile.goals, "strength_ends") || has(profile.goals, "moisture")
  const vulnerabilitySignal = breakage || splitEnds || dryRough || vulnerable

  let tier: PlanNeedTier = "not_needed"
  let ruleId = "oil.pre_wash_fibre_treatment.no_job"

  if (breakage && vulnerable) {
    tier = "basis"
    ruleId = "oil.pre_wash_fibre_treatment.breakage_corroborated"
  } else if (dryRough && vulnerable) {
    tier = "basis"
    ruleId = "oil.pre_wash_fibre_treatment.dry_rough_treated"
  } else if (goalLed && vulnerabilitySignal) {
    tier = "optional"
    ruleId = "oil.pre_wash_fibre_treatment.goal_corroborated"
  } else if (breakage) {
    tier = "optional"
    ruleId = "oil.pre_wash_fibre_treatment.breakage_alone"
  } else if (splitEnds) {
    tier = "optional"
    ruleId = "oil.pre_wash_fibre_treatment.split_ends_support"
  } else if (dryRough) {
    tier = "optional"
    ruleId = "oil.pre_wash_fibre_treatment.dry_rough"
  } else if (vulnerable) {
    tier = "optional"
    ruleId = "oil.pre_wash_fibre_treatment.structural_exposure_only"
  }

  return {
    role: "pre_wash_fibre_treatment",
    tier: tier === "not_needed" ? "optional" : tier,
    weight: null,
    functionalBenefits:
      tier === "not_needed"
        ? []
        : [
            benefit(
              "slip_manageability",
              priority(breakage || splitEnds || dryRough, goalLed),
              "supporting",
            ),
          ],
    ruleId,
  }
}

function dampLeaveOn(
  profile: PlanProfile,
  assessments: PlanNeedAssessment,
): OilRoleTarget & {
  ruleId: string
} {
  const frizz = has(profile.concerns, "frizz_flyaways")
  const frizzGoal = has(profile.goals, "frizz_surface")
  const dryOrRough = has(profile.concerns, "dry_lengths") || profile.hair.surface === "rough"
  const tangling = has(profile.concerns, "tangling")
  const healthy = healthyManageableLengths(profile, assessments)

  let tier: PlanNeedTier = "not_needed"
  let ruleId = "oil.leave_on_fibre_conditioning.no_job"
  let selectedBenefit: OilFunctionalBenefit = "smoothing_frizz_control"

  if (profile.hair.texture === "coily" && (frizz || frizzGoal)) {
    tier = "basis"
    ruleId = "oil.leave_on_fibre_conditioning.coily_frizz_layer"
  } else if ((frizz || frizzGoal) && healthy) {
    tier = "basis"
    ruleId = "oil.leave_on_fibre_conditioning.frizz_direct"
  } else if (frizz || frizzGoal) {
    tier = "optional"
    ruleId = "oil.leave_on_fibre_conditioning.frizz_support"
  } else if (dryOrRough) {
    tier = "optional"
    ruleId = "oil.leave_on_fibre_conditioning.dry_rough_support"
  } else if (tangling) {
    tier = "optional"
    ruleId = "oil.leave_on_fibre_conditioning.tangling_support"
    selectedBenefit = "slip_manageability"
  }

  return {
    role: "leave_on_fibre_conditioning",
    tier: tier === "not_needed" ? "optional" : tier,
    weight: leaveOnWeight(profile),
    functionalBenefits:
      tier === "not_needed"
        ? []
        : [
            benefit(
              selectedBenefit,
              selectedBenefit === "slip_manageability"
                ? priority(tangling, has(profile.goals, "manageability_styling"))
                : priority(frizz || dryOrRough, frizzGoal),
              tier === "basis" ? "primary" : "supporting",
            ),
          ],
    ruleId,
  }
}

function includedTarget(target: OilRoleTarget & { ruleId: string }): OilRoleTarget | null {
  if (target.functionalBenefits.length === 0) return null
  return {
    role: target.role,
    tier: target.tier,
    weight: target.weight,
    functionalBenefits: target.functionalBenefits,
  }
}

function cadence(role: OilRole, tier: Exclude<PlanNeedTier, "not_needed">) {
  if (tier === "optional") {
    return { role, tier, cadence: "optional_allocation_deferred_to_day_type" as const }
  }
  if (role === "pre_wash_fibre_treatment") {
    return { role, tier, cadence: "before_every_compatible_wash" as const }
  }
  if (role === "leave_on_fibre_conditioning") {
    return { role, tier, cadence: "after_every_compatible_wash" as const }
  }
  return { role, tier, cadence: "finish_after_every_compatible_wash" as const }
}

export function buildOilDecision(
  profile: PlanProfile,
  assessments: PlanNeedAssessment,
): PlanCategoryDecision {
  const evaluated = [
    preWash(profile, assessments),
    dampLeaveOn(profile, assessments),
    dryFinish(profile, assessments),
  ]
  const includedWithRules = evaluated.flatMap((item) => {
    if (item.functionalBenefits.length === 0) return []
    return [item]
  })
  const included = evaluated.flatMap((item) => {
    const target = includedTarget(item)
    return target ? [target] : []
  })
  const aggregateTier = included.reduce<PlanNeedTier>(
    (tier, item) => strongest(tier, item.tier),
    "not_needed",
  )

  if (aggregateTier === "not_needed") {
    return {
      category: "oil",
      resolution: "resolved",
      needTier: "not_needed",
      roles: [],
      target: null,
      frequency: null,
      reasons: evaluated.map((item) => reason(item.ruleId, "detail")),
      executionState: "available",
      executionPauseReason: null,
      deferredFacts: [],
    }
  }

  const includedRulesByRole = new Map(includedWithRules.map((item) => [item.role, item.ruleId]))
  const roleTargets = ROLE_ORDER.flatMap((role) => included.filter((item) => item.role === role))
  const roles = roleTargets.map((item) => item.role)
  return {
    category: "oil",
    resolution: "resolved",
    needTier: aggregateTier,
    roles,
    target: {
      category: "oil",
      roles,
      roleTargets,
    },
    frequency: {
      kind: "role_based_wash_linked",
      roleFrequencies: roleTargets.map((item) => cadence(item.role, item.tier)),
    },
    reasons: roleTargets.map((item, index) =>
      reason(
        includedRulesByRole.get(item.role) ?? "oil.role.unclassified",
        index < 2 ? "primary" : "secondary",
      ),
    ),
    executionState: "available",
    executionPauseReason: null,
    deferredFacts: [],
  }
}
