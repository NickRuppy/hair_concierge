import type {
  PlanCategoryDecision,
  PlanDamageAssessment,
  PlanNeedTier,
  PlanProfile,
  PlanReasonFact,
} from "../types"

type StrongBondbuilderIndicator = "breakage" | "hair_damage" | "rough_surface" | "snaps"

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

function strongIndicators(profile: PlanProfile): StrongBondbuilderIndicator[] {
  const indicators: StrongBondbuilderIndicator[] = []
  if (hasConcern(profile, "breakage")) indicators.push("breakage")
  if (hasConcern(profile, "hair_damage")) indicators.push("hair_damage")
  if (profile.hair.surface === "rough") indicators.push("rough_surface")
  if (profile.hair.elasticity === "snaps") indicators.push("snaps")
  return indicators
}

function inclusionRule(
  profile: PlanProfile,
  indicators: StrongBondbuilderIndicator[],
): { id: string; tier: PlanNeedTier } {
  const treatmentSet = new Set(profile.hair.chemicalTreatments)
  const hasColored = treatmentSet.has("colored")
  const hasPermed = treatmentSet.has("permed")

  if (treatmentSet.has("lightened")) return { id: "bondbuilder.inclusion.lightened", tier: "basis" }
  if (treatmentSet.has("chemically_straightened")) {
    return { id: "bondbuilder.inclusion.chemical_straightening", tier: "basis" }
  }
  if (hasColored && hasPermed) {
    return { id: "bondbuilder.inclusion.colored_and_permed", tier: "basis" }
  }
  if (hasColored && indicators.length >= 1) {
    return { id: "bondbuilder.inclusion.colored_with_damage", tier: "basis" }
  }
  if (hasPermed && indicators.length >= 1) {
    return { id: "bondbuilder.inclusion.permed_with_damage", tier: "basis" }
  }
  if (indicators.length >= 2) {
    return { id: "bondbuilder.inclusion.two_strong_indicators", tier: "basis" }
  }
  if (hasColored) return { id: "bondbuilder.inclusion.colored_only", tier: "optional" }
  if (hasPermed) return { id: "bondbuilder.inclusion.permed_only", tier: "optional" }
  if (indicators.length === 1) {
    return { id: "bondbuilder.inclusion.one_strong_indicator", tier: "optional" }
  }
  return { id: "bondbuilder.inclusion.no_job", tier: "not_needed" }
}

function indicatorReasons(
  profile: PlanProfile,
  indicators: StrongBondbuilderIndicator[],
): PlanReasonFact[] {
  const reasons: PlanReasonFact[] = []

  for (const indicator of indicators) {
    if (indicator === "breakage") {
      reasons.push(reason("bondbuilder.reason.breakage", "primary", "currentConcerns"))
    }
    if (indicator === "hair_damage") {
      reasons.push(reason("bondbuilder.reason.hair_damage", "primary", "currentConcerns"))
    }
    if (indicator === "rough_surface") {
      reasons.push(reason("bondbuilder.reason.rough_surface", "primary", "hairSurface"))
    }
    if (indicator === "snaps") {
      reasons.push(reason("bondbuilder.reason.snaps", "primary", "elasticResponse"))
    }
  }

  for (const treatment of profile.hair.chemicalTreatments) {
    if (treatment === "lightened") {
      reasons.push(reason("bondbuilder.reason.lightened", "primary", "chemicalTreatments"))
    }
    if (treatment === "chemically_straightened") {
      reasons.push(
        reason("bondbuilder.reason.chemical_straightening", "primary", "chemicalTreatments"),
      )
    }
    if (treatment === "colored") {
      reasons.push(reason("bondbuilder.reason.colored", "secondary", "chemicalTreatments"))
    }
    if (treatment === "permed") {
      reasons.push(reason("bondbuilder.reason.permed", "secondary", "chemicalTreatments"))
    }
  }

  if (
    profile.hair.chemicalTreatments.includes("colored") &&
    profile.hair.chemicalTreatments.includes("permed")
  ) {
    reasons.push(reason("bondbuilder.reason.colored_and_permed", "primary", "chemicalTreatments"))
  }
  if (hasConcern(profile, "split_ends")) {
    reasons.push(reason("bondbuilder.reason.split_ends_context", "detail", "currentConcerns"))
  }
  if (profile.goals.includes("strength_ends")) {
    reasons.push(reason("bondbuilder.reason.strength_goal_context", "detail", "goals"))
  }

  return reasons
}

export function buildBondbuilderDecision(
  profile: PlanProfile,
  damage: PlanDamageAssessment,
): PlanCategoryDecision {
  const indicators = strongIndicators(profile)
  const inclusion = inclusionRule(profile, indicators)
  const reasons = [
    reason(inclusion.id, "primary", "bondbuilder_inclusion_rule", {}, "assessment"),
    ...indicatorReasons(profile, indicators),
  ]

  if (damage.heatSignals.length > 0) {
    reasons.push(
      reason(
        "bondbuilder.reason.heat_prevention_primary",
        "detail",
        "damage.heatSignals",
        {},
        "assessment",
      ),
    )
  }

  if (inclusion.tier === "not_needed") {
    return {
      category: "bondbuilder",
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

  return {
    category: "bondbuilder",
    resolution: "resolved",
    needTier: inclusion.tier,
    roles: ["specialized_bond_treatment"],
    target: {
      category: "bondbuilder",
      roles: ["specialized_bond_treatment"],
      requiredFunction: "support_stressed_hair_resilience",
      mechanismTarget: "mechanism_neutral",
    },
    frequency: { kind: "product_protocol_course", role: "specialized_bond_treatment" },
    reasons,
    executionState: "available",
    executionPauseReason: null,
    deferredFacts: [],
  }
}
