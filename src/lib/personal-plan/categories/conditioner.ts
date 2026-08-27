import type {
  ConditionerFunctionalNeed,
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
import { resolveVolumeDirection, volumeDirectionInputFor } from "../volume-direction"

const WEIGHT_ORDER: readonly PlanCareWeight[] = ["light", "medium", "rich"] as const

function has<T extends string>(values: readonly T[], value: T): boolean {
  return values.includes(value)
}

function shiftWeight(weight: PlanCareWeight, delta: -1 | 1): PlanCareWeight {
  const current = WEIGHT_ORDER.indexOf(weight)
  return WEIGHT_ORDER[Math.min(WEIGHT_ORDER.length - 1, Math.max(0, current + delta))]
}

function reason(
  id: string,
  salience: PlanReasonFact["salience"] = "primary",
  values: PlanReasonFact["values"] = {},
): PlanReasonFact {
  return {
    id,
    salience,
    evidence: [],
    values,
  }
}

function materialVeryShortSignal(profile: PlanProfile): boolean {
  const strongSignals = new Set<string>()
  const supportingSignals = new Set<string>()

  if (profile.hair.surface === "rough") strongSignals.add("hair_surface")
  if (profile.hair.surface === "slightly_uneven") supportingSignals.add("hair_surface")

  if (profile.hair.elasticity === "snaps") strongSignals.add("elasticity")
  if (profile.hair.elasticity === "stretches_stays") supportingSignals.add("elasticity")

  const treatments = new Set(profile.hair.chemicalTreatments)
  if (
    treatments.has("lightened") ||
    treatments.has("permed") ||
    treatments.has("chemically_straightened")
  ) {
    strongSignals.add("chemical_treatment")
  } else if (treatments.has("colored")) {
    supportingSignals.add("chemical_treatment")
  }

  const concerns = new Set(profile.concerns)
  if (
    concerns.has("dry_lengths") ||
    concerns.has("tangling") ||
    concerns.has("hair_damage") ||
    concerns.has("breakage") ||
    concerns.has("split_ends")
  ) {
    strongSignals.add("current_concern")
  }
  if (concerns.has("frizz_flyaways")) supportingSignals.add("current_concern")

  if (profile.hair.texture === "curly" || profile.hair.texture === "coily") {
    supportingSignals.add("texture")
  }

  if (
    has(profile.goals, "moisture") ||
    has(profile.goals, "frizz_surface") ||
    has(profile.goals, "strength_ends") ||
    has(profile.goals, "shape_definition")
  ) {
    supportingSignals.add("goal")
  }

  return strongSignals.size >= 1 || supportingSignals.size >= 2
}

function inclusionTier(profile: PlanProfile): {
  tier: PlanNeedTier
  ruleId: string
} {
  if (profile.hair.length !== "very_short") {
    return { tier: "basis", ruleId: "conditioner.inclusion.length_basis" }
  }

  if (materialVeryShortSignal(profile)) {
    return { tier: "optional", ruleId: "conditioner.inclusion.very_short_optional" }
  }

  return { tier: "not_needed", ruleId: "conditioner.inclusion.very_short_not_needed" }
}

function targetWeight(profile: PlanProfile): {
  weight: PlanCareWeight
  ruleIds: string[]
} {
  let weight: PlanCareWeight =
    profile.hair.thickness === "fine"
      ? "light"
      : profile.hair.thickness === "coarse"
        ? "rich"
        : "medium"
  const ruleIds = ["conditioner.weight.thickness"]

  if (has(profile.concerns, "low_volume_or_weighed_down")) {
    return {
      weight: shiftWeight(weight, -1),
      ruleIds: [...ruleIds, "conditioner.weight.volume_up"],
    }
  }

  if (has(profile.goals, "volume_balance")) {
    // Shared with the Hair Tools styling routes: one profile must never mean
    // "more volume" here and "less volume" there.
    const controlRoute = resolveVolumeDirection(volumeDirectionInputFor(profile)) === "control"

    weight = shiftWeight(weight, controlRoute ? 1 : -1)
    ruleIds.push(controlRoute ? "conditioner.weight.control" : "conditioner.weight.volume_up")
  }

  return { weight, ruleIds }
}

function uniqueGroups(values: Array<string | false>): Set<string> {
  return new Set(values.filter(Boolean) as string[])
}

function careDirection(profile: PlanProfile): {
  direction: PlanCareDirection
  ruleId: string
} {
  const moistureGroups = uniqueGroups([
    (has(profile.concerns, "dry_lengths") || has(profile.concerns, "tangling")) && "concern",
    has(profile.concerns, "frizz_flyaways") && "frizz",
    (has(profile.goals, "moisture") || has(profile.goals, "frizz_surface")) && "goal",
    (profile.hair.surface === "rough" || profile.hair.surface === "slightly_uneven") && "surface",
  ])
  const proteinGroups = uniqueGroups([
    (has(profile.concerns, "hair_damage") ||
      has(profile.concerns, "breakage") ||
      has(profile.concerns, "split_ends")) &&
      "concern",
    has(profile.goals, "strength_ends") && "goal",
    (has(profile.hair.chemicalTreatments, "lightened") ||
      has(profile.hair.chemicalTreatments, "permed") ||
      has(profile.hair.chemicalTreatments, "chemically_straightened")) &&
      "strong_treatment",
    has(profile.hair.chemicalTreatments, "colored") && "colored",
  ])

  if (profile.hair.elasticity === "snaps") {
    return {
      direction: proteinGroups.size >= 2 && moistureGroups.size === 0 ? "balanced" : "moisture",
      ruleId: "conditioner.balance.elasticity_snaps",
    }
  }

  if (profile.hair.elasticity === "stretches_stays") {
    return {
      direction: moistureGroups.size >= 2 && proteinGroups.size === 0 ? "balanced" : "protein",
      ruleId: "conditioner.balance.elasticity_stretches_stays",
    }
  }

  if (moistureGroups.size >= 2 && proteinGroups.size < 2) {
    return { direction: "moisture", ruleId: "conditioner.balance.context_moisture" }
  }
  if (proteinGroups.size >= 2 && moistureGroups.size < 2) {
    return { direction: "protein", ruleId: "conditioner.balance.context_protein" }
  }
  return { direction: "balanced", ruleId: "conditioner.balance.elasticity_balanced" }
}

function repairLevel(
  profile: PlanProfile,
  assessments: PlanNeedAssessment,
): {
  level: PlanRepairSupportLevel
  ruleId: string
} {
  if (assessments.damage.repairPriority === "high") {
    return { level: "high", ruleId: "conditioner.repair.high" }
  }
  if (assessments.damage.repairPriority === "medium") {
    return { level: "medium", ruleId: "conditioner.repair.medium" }
  }
  return { level: "low", ruleId: "conditioner.repair.low" }
}

function priority(hasConcern: boolean, hasGoal: boolean): PlanFunctionPriority {
  if (hasConcern && hasGoal) return 3
  if (hasConcern) return 2
  return 1
}

function functionalNeeds(profile: PlanProfile) {
  const needs: Array<{
    need: ConditionerFunctionalNeed
    priority: PlanFunctionPriority
    ownership: PlanCoverageOwnership
  }> = []

  const straightOrWavy = profile.hair.texture === "straight" || profile.hair.texture === "wavy"
  if (
    straightOrWavy &&
    (has(profile.concerns, "low_volume_or_weighed_down") || has(profile.goals, "volume_balance"))
  ) {
    needs.push({
      need: "volume_support",
      priority: priority(
        has(profile.concerns, "low_volume_or_weighed_down"),
        has(profile.goals, "volume_balance"),
      ),
      ownership: "supporting",
    })
  }

  if (has(profile.concerns, "frizz_flyaways") || has(profile.goals, "frizz_surface")) {
    needs.push({
      need: "frizz_smoothing",
      priority: priority(
        has(profile.concerns, "frizz_flyaways"),
        has(profile.goals, "frizz_surface"),
      ),
      ownership: "supporting",
    })
  }

  if (has(profile.concerns, "low_shine") || has(profile.goals, "shine")) {
    needs.push({
      need: "shine",
      priority: priority(has(profile.concerns, "low_shine"), has(profile.goals, "shine")),
      ownership: "supporting",
    })
  }

  if (has(profile.concerns, "tangling")) {
    needs.push({
      need: "detangling_slip",
      priority: has(profile.goals, "manageability_styling") ? 3 : 2,
      ownership: "primary",
    })
  }

  if (
    (profile.hair.texture === "wavy" ||
      profile.hair.texture === "curly" ||
      profile.hair.texture === "coily" ||
      has(profile.hair.chemicalTreatments, "permed")) &&
    (has(profile.concerns, "lost_shape") || has(profile.goals, "shape_definition"))
  ) {
    needs.push({
      need: "definition_support",
      priority: priority(
        has(profile.concerns, "lost_shape"),
        has(profile.goals, "shape_definition"),
      ),
      ownership: "supporting",
    })
  }

  if (has(profile.hair.chemicalTreatments, "colored")) {
    needs.push({
      need: "color_protection",
      priority: 2,
      ownership: "supporting",
    })
  }

  return needs
}

export function buildConditionerDecision(
  profile: PlanProfile,
  assessments: PlanNeedAssessment,
): PlanCategoryDecision {
  const inclusion = inclusionTier(profile)
  if (inclusion.tier === "not_needed") {
    return {
      category: "conditioner",
      resolution: "resolved",
      needTier: "not_needed",
      roles: [],
      target: null,
      frequency: null,
      reasons: [reason(inclusion.ruleId)],
      executionState: "available",
      executionPauseReason: null,
      deferredFacts: [],
    }
  }

  const weight = targetWeight(profile)
  const balance = careDirection(profile)
  const repair = repairLevel(profile, assessments)
  return {
    category: "conditioner",
    resolution: "resolved",
    needTier: inclusion.tier,
    roles: ["conditioner_rinse_out"],
    target: {
      category: "conditioner",
      roles: ["conditioner_rinse_out"],
      weight: weight.weight,
      careDirection: balance.direction,
      repairSupportLevel: repair.level,
      functionalNeeds: functionalNeeds(profile),
    },
    frequency: {
      kind: "after_each_eligible_wash",
      roles: ["conditioner_rinse_out"],
      dependsOn: "wet_wash_total",
      placementState: "known_after_refined_wash_cadence",
    },
    reasons: [
      reason(inclusion.ruleId),
      ...weight.ruleIds.map((id) => reason(id, "secondary", { weight: weight.weight })),
      reason(balance.ruleId, "secondary", { careDirection: balance.direction }),
      reason(repair.ruleId, "detail", { repairSupportLevel: repair.level }),
    ],
    executionState: "available",
    executionPauseReason: null,
    deferredFacts: [],
  }
}
