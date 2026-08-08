import type {
  MaskFunctionalNeed,
  PlanCareDirection,
  PlanCareWeight,
  PlanCategoryDecision,
  PlanCoverageOwnership,
  PlanDamageAssessment,
  PlanFunctionPriority,
  PlanNeedTier,
  PlanProfile,
  PlanReasonFact,
  PlanRepairSupportLevel,
} from "../types"

type StrongMaskNeed = "dry_lengths" | "rough_surface" | "hair_damage" | "breakage" | "tangling"

function reason(
  id: string,
  salience: PlanReasonFact["salience"],
  key: string,
  values: PlanReasonFact["values"] = {},
  source: PlanReasonFact["evidence"][number]["source"] = "quiz",
): PlanReasonFact {
  return { id, salience, evidence: [{ source, key }], values }
}

function hasConcern(profile: PlanProfile, concern: PlanProfile["concerns"][number]): boolean {
  return profile.concerns.includes(concern)
}

function hasGoal(profile: PlanProfile, goal: PlanProfile["goals"][number]): boolean {
  return profile.goals.includes(goal)
}

function strongObservedNeeds(profile: PlanProfile): StrongMaskNeed[] {
  const needs: StrongMaskNeed[] = []
  if (hasConcern(profile, "dry_lengths")) needs.push("dry_lengths")
  if (profile.hair.surface === "rough") needs.push("rough_surface")
  if (hasConcern(profile, "hair_damage")) needs.push("hair_damage")
  if (hasConcern(profile, "breakage")) needs.push("breakage")
  if (hasConcern(profile, "tangling")) needs.push("tangling")
  return needs
}

function hasMeaningfulExposure(profile: PlanProfile, damage: PlanDamageAssessment): boolean {
  return (
    profile.hair.chemicalTreatments.some((treatment) => treatment !== "natural") ||
    damage.heatLevel === "moderate" ||
    damage.heatLevel === "high" ||
    damage.heatLevel === "severe" ||
    damage.mechanicalLevel === "moderate" ||
    damage.mechanicalLevel === "high" ||
    damage.mechanicalLevel === "severe"
  )
}

function maskWeight(profile: PlanProfile): PlanCareWeight {
  const base: PlanCareWeight =
    profile.hair.thickness === "fine"
      ? "light"
      : profile.hair.thickness === "coarse"
        ? "rich"
        : "medium"

  if (!hasConcern(profile, "low_volume_or_weighed_down")) return base
  if (base === "rich") return "medium"
  return "light"
}

function careDirection(profile: PlanProfile): PlanCareDirection {
  if (profile.hair.elasticity === "snaps") return "moisture"
  if (profile.hair.elasticity === "stretches_stays") return "protein"
  return "balanced"
}

function repairSupport(profile: PlanProfile, damage: PlanDamageAssessment): PlanRepairSupportLevel {
  if (damage.repairPriority === "high" || profile.hair.chemicalTreatments.includes("lightened")) {
    return "high"
  }
  if (
    damage.repairPriority === "medium" ||
    profile.hair.chemicalTreatments.some((treatment) => treatment !== "natural") ||
    hasConcern(profile, "split_ends")
  ) {
    return "medium"
  }
  return "low"
}

function functionalPriority(currentProblem: boolean, matchingGoal: boolean): PlanFunctionPriority {
  if (currentProblem && matchingGoal) return 3
  if (currentProblem) return 2
  return 1
}

function functionalNeeds(profile: PlanProfile): Array<{
  need: MaskFunctionalNeed
  priority: PlanFunctionPriority
  ownership: PlanCoverageOwnership
}> {
  const needs: Array<{
    need: MaskFunctionalNeed
    priority: PlanFunctionPriority
    ownership: PlanCoverageOwnership
  }> = []

  const rough = profile.hair.surface === "rough"
  const frizzContext =
    rough || hasConcern(profile, "frizz_flyaways") || hasGoal(profile, "frizz_surface")
  if (frizzContext) {
    needs.push({
      need: "smoothing_frizz_control",
      priority: functionalPriority(
        rough || hasConcern(profile, "frizz_flyaways"),
        hasGoal(profile, "frizz_surface"),
      ),
      ownership: rough ? "required" : "supporting",
    })
  }

  if (hasConcern(profile, "tangling")) {
    needs.push({
      need: "detangling_slip",
      priority: functionalPriority(true, hasGoal(profile, "manageability_styling")),
      ownership: "required",
    })
  }

  if (hasConcern(profile, "low_shine") || hasGoal(profile, "shine")) {
    needs.push({
      need: "shine",
      priority: functionalPriority(hasConcern(profile, "low_shine"), hasGoal(profile, "shine")),
      ownership: "supporting",
    })
  }

  return needs
}

function inclusionRule(
  profile: PlanProfile,
  damage: PlanDamageAssessment,
  strongNeeds: StrongMaskNeed[],
): { id: string; tier: PlanNeedTier } {
  const exposure = hasMeaningfulExposure(profile, damage)

  if (strongNeeds.length >= 2) {
    return { id: "mask.inclusion.two_observed_needs", tier: "basis" }
  }
  if (strongNeeds.length >= 1 && exposure) {
    return { id: "mask.inclusion.observed_plus_exposure", tier: "basis" }
  }
  if (strongNeeds.length === 1) {
    return { id: "mask.inclusion.one_observed_need", tier: "optional" }
  }
  if (hasConcern(profile, "split_ends")) {
    return { id: "mask.inclusion.split_ends_supporting", tier: "optional" }
  }
  if (exposure) {
    return { id: "mask.inclusion.exposure_only", tier: "optional" }
  }
  if (profile.hair.surface === "slightly_uneven") {
    return { id: "mask.inclusion.slightly_uneven_surface", tier: "optional" }
  }
  if (profile.hair.elasticity === "snaps" || profile.hair.elasticity === "stretches_stays") {
    return { id: "mask.inclusion.non_balanced_elasticity", tier: "optional" }
  }
  if (hasGoal(profile, "moisture") || hasGoal(profile, "strength_ends")) {
    return { id: "mask.inclusion.goal_only", tier: "optional" }
  }
  if (profile.hair.texture === "coily") {
    return { id: "mask.inclusion.coily_only", tier: "optional" }
  }
  return { id: "mask.inclusion.no_job", tier: "not_needed" }
}

function highNeed(
  profile: PlanProfile,
  damage: PlanDamageAssessment,
  strongNeeds: StrongMaskNeed[],
): boolean {
  if (damage.repairPriority === "high" || profile.hair.chemicalTreatments.includes("lightened")) {
    return true
  }
  return strongNeeds.includes("dry_lengths") && strongNeeds.includes("rough_surface")
}

function maskReasons(
  profile: PlanProfile,
  damage: PlanDamageAssessment,
  ruleId: string,
  strongNeeds: StrongMaskNeed[],
): PlanReasonFact[] {
  const reasons = [reason(ruleId, "primary", "mask_inclusion_rule", {}, "assessment")]

  for (const need of strongNeeds) {
    if (need === "dry_lengths")
      reasons.push(reason("mask.reason.dry_lengths", "primary", "currentConcerns"))
    if (need === "rough_surface")
      reasons.push(reason("mask.reason.rough_surface", "primary", "hairSurface"))
    if (need === "hair_damage")
      reasons.push(reason("mask.reason.hair_damage", "primary", "currentConcerns"))
    if (need === "breakage")
      reasons.push(reason("mask.reason.breakage", "primary", "currentConcerns"))
    if (need === "tangling")
      reasons.push(reason("mask.reason.tangling", "primary", "currentConcerns"))
  }

  if (hasConcern(profile, "split_ends")) {
    reasons.push(reason("mask.reason.split_ends_supporting", "secondary", "currentConcerns"))
  }
  if (profile.hair.chemicalTreatments.some((treatment) => treatment !== "natural")) {
    reasons.push(
      reason("mask.reason.chemical_exposure", "secondary", "chemicalTreatments", {
        chemicalStress: damage.chemicalStress,
      }),
    )
  }
  if (damage.heatSignals.length > 0) {
    reasons.push(
      reason("mask.reason.heat_exposure", "secondary", "damage.heatSignals", {}, "assessment"),
    )
  }
  if (damage.mechanicalSignals.length > 0) {
    reasons.push(
      reason(
        "mask.reason.mechanical_exposure",
        "secondary",
        "damage.mechanicalSignals",
        {},
        "assessment",
      ),
    )
  }
  if (profile.hair.elasticity === "snaps" || profile.hair.elasticity === "stretches_stays") {
    reasons.push(reason("mask.reason.elasticity_direction", "detail", "elasticResponse"))
  }

  return reasons
}

export function buildMaskDecision(
  profile: PlanProfile,
  damage: PlanDamageAssessment,
): PlanCategoryDecision {
  const strongNeeds = strongObservedNeeds(profile)
  const inclusion = inclusionRule(profile, damage, strongNeeds)
  const reasons = maskReasons(profile, damage, inclusion.id, strongNeeds)

  if (inclusion.tier === "not_needed") {
    return {
      category: "mask",
      resolution: "resolved",
      needTier: "not_needed",
      roles: [],
      target: null,
      frequency: null,
      reasons,
      executionState: "available",
      executionPauseReason: null,
      deferredFacts: [],
    }
  }

  const needStrength =
    inclusion.tier === "basis" && highNeed(profile, damage, strongNeeds) ? "high" : "standard"
  const weightSensitive = hasConcern(profile, "low_volume_or_weighed_down")
  const deferredFacts =
    inclusion.tier === "basis" && profile.routine.shampooFrequency.state === "unknown"
      ? (["shampoo_frequency"] as const)
      : []

  return {
    category: "mask",
    resolution: deferredFacts.length > 0 ? "partially_resolved" : "resolved",
    needTier: inclusion.tier,
    roles: ["intensive_conditioning_mask"],
    target: {
      category: "mask",
      roles: ["intensive_conditioning_mask"],
      needStrength,
      weight: maskWeight(profile),
      careDirection: careDirection(profile),
      repairSupportLevel: repairSupport(profile, damage),
      functionalNeeds: functionalNeeds(profile),
    },
    frequency:
      inclusion.tier === "basis"
        ? {
            kind: "mask_regular_interval",
            role: "intensive_conditioning_mask",
            needStrength,
            baseInterval:
              needStrength === "high"
                ? weightSensitive
                  ? "biweekly_1x"
                  : "weekly_1x"
                : weightSensitive
                  ? "every_3_weeks"
                  : "biweekly_1x",
            placementState:
              profile.routine.shampooFrequency.state === "known"
                ? "placed_on_eligible_wash"
                : "blocked_until_wash_frequency_known",
          }
        : {
            kind: "unscheduled_as_needed",
            roles: ["intensive_conditioning_mask"],
            boundary: "optional_intensive_care_template",
          },
    reasons,
    executionState: "available",
    executionPauseReason: null,
    deferredFacts: [...deferredFacts],
  }
}
