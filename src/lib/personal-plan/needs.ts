import type {
  PlanChemicalTreatment,
  PlanDamageAssessment,
  PlanDamageLevel,
  PlanHairLossBoundaryAssessment,
  PlanHeatExposureAssessment,
  PlanNeedAssessment,
  PlanProfile,
  PlanRepairPriority,
  PlanResetLoadAssessment,
  PlanScalpBuildupAssessment,
  PlanShampooCadenceAssessment,
} from "./types"

function chemicalStress(treatments: readonly PlanChemicalTreatment[]): 0 | 1 | 2 | 3 | 4 {
  const selected = new Set(treatments)
  if (selected.has("lightened")) return 4
  if (selected.has("chemically_straightened")) return 3
  if (selected.has("colored") && selected.has("permed")) return 3
  if (selected.has("colored") || selected.has("permed")) return 2
  return 0
}

const DAMAGE_LEVEL_RANK: Record<PlanDamageLevel, number> = {
  none: 0,
  low: 1,
  moderate: 2,
  high: 3,
  severe: 4,
}

function damageLevel(score: number): PlanDamageLevel {
  if (score <= 0) return "none"
  if (score <= 1) return "low"
  if (score <= 3) return "moderate"
  if (score <= 5) return "high"
  return "severe"
}

function repairPriority(
  structural: PlanDamageLevel,
  heat: PlanDamageLevel,
  mechanical: PlanDamageLevel,
): PlanRepairPriority {
  if (DAMAGE_LEVEL_RANK[structural] >= DAMAGE_LEVEL_RANK.high || heat === "severe") {
    return "high"
  }
  if (
    DAMAGE_LEVEL_RANK[structural] >= DAMAGE_LEVEL_RANK.moderate ||
    DAMAGE_LEVEL_RANK[heat] >= DAMAGE_LEVEL_RANK.moderate ||
    DAMAGE_LEVEL_RANK[mechanical] >= DAMAGE_LEVEL_RANK.moderate
  ) {
    return "medium"
  }
  if (structural !== "none" || heat !== "none" || mechanical !== "none") return "low"
  return "none"
}

function heatScore(profile: PlanProfile): number {
  if (profile.routine.heatToolUse.state === "unknown") return 0
  return profile.routine.heatToolUse.value.reduce((highest, event) => {
    const score =
      event.frequency === "daily_1x"
        ? 4
        : event.frequency === "weekly_5_6x" ||
            event.frequency === "weekly_3_4x" ||
            event.frequency === "weekly_2x"
          ? 3
          : event.frequency === "weekly_1x"
            ? 2
            : 1
    return Math.max(highest, score)
  }, 0)
}

function buildDamageAssessment(profile: PlanProfile): PlanDamageAssessment {
  const sourceFacts: string[] = []
  const structuralSignals: string[] = []
  let structuralScore = 0

  if (profile.hair.surface === "rough") {
    structuralScore += 4
    structuralSignals.push("hair_surface:rough")
  } else if (profile.hair.surface === "slightly_uneven") {
    structuralScore += 2
    structuralSignals.push("hair_surface:slightly_uneven")
  } else {
    sourceFacts.push("hair_surface:smooth")
  }

  sourceFacts.push(`elastic_response:${profile.hair.elasticity}`)
  if (profile.hair.elasticity === "snaps") {
    structuralSignals.push("elastic_response:snaps")
  } else if (profile.hair.elasticity === "stretches_stays") {
    structuralSignals.push("elastic_response:stretches_stays")
  }

  const treatmentStress = chemicalStress(profile.hair.chemicalTreatments)
  structuralScore += treatmentStress
  for (const treatment of profile.hair.chemicalTreatments) {
    sourceFacts.push(`chemical_treatment:${treatment}`)
  }

  let concernScore = 0
  const concernSet = new Set(profile.concerns)
  if (concernSet.has("breakage")) {
    concernScore += 4
    structuralSignals.push("concern:breakage")
  }
  if (concernSet.has("hair_damage")) {
    concernScore += 3
    structuralSignals.push("concern:hair_damage")
  }
  if (concernSet.has("split_ends")) {
    concernScore += 2
    structuralSignals.push("concern:split_ends")
  }
  structuralScore += Math.min(concernScore, 5)
  sourceFacts.push(...structuralSignals)

  const structuralLevel = damageLevel(structuralScore)
  const computedHeatScore = heatScore(profile)
  const heatLevel = damageLevel(computedHeatScore)
  const mechanicalLevel = damageLevel(0)

  return {
    knowledgeState: profile.routine.heatToolUse.state === "known" ? "known" : "partial",
    sourceFacts,
    chemicalStress: treatmentStress,
    structuralLevel,
    heatLevel,
    mechanicalLevel,
    structuralSignals,
    mechanicalSignals: [],
    heatSignals:
      profile.routine.heatToolUse.state === "known"
        ? profile.routine.heatToolUse.value.map((event) => `heat_route:${event.route}`)
        : [],
    repairPriority: repairPriority(structuralLevel, heatLevel, mechanicalLevel),
    missingInputs: profile.routine.heatToolUse.state === "unknown" ? ["heat_tool_use"] : [],
  }
}

const CADENCE_BY_SCALP: Record<
  PlanProfile["scalp"]["oiliness"],
  Pick<PlanShampooCadenceAssessment, "preferred" | "minimum" | "maximum">
> = {
  oily: { preferred: "weekly_3_4x", minimum: "weekly_2x", maximum: "weekly_5_6x" },
  balanced: { preferred: "weekly_2x", minimum: "weekly_1x", maximum: "weekly_3_4x" },
  dry: { preferred: "weekly_1x", minimum: "biweekly_1x", maximum: "weekly_1x" },
}

function buildShampooCadenceAssessment(profile: PlanProfile): PlanShampooCadenceAssessment {
  const target = CADENCE_BY_SCALP[profile.scalp.oiliness]
  return {
    knowledgeState: profile.routine.shampooFrequency.state === "known" ? "known" : "partial",
    sourceFacts: [`scalp.oiliness:${profile.scalp.oiliness}`],
    scalpRoute: profile.scalp.oiliness,
    ...target,
    current: profile.routine.shampooFrequency,
  }
}

function buildResetLoadAssessment(profile: PlanProfile): PlanResetLoadAssessment {
  const oilyScalp = profile.scalp.oiliness === "oily"
  const shampooFrequency = profile.routine.shampooFrequency
  const sourceFacts = oilyScalp ? ["scalp.oiliness:oily"] : []
  if (shampooFrequency.state === "known") {
    sourceFacts.push(`shampoo_frequency:${shampooFrequency.value}`)
  }
  return {
    knowledgeState: "partial",
    sourceFacts,
    knownScore: oilyScalp ? 1 : 0,
    unknownSignals: [
      "dry_shampoo",
      "leave_in",
      "finishing_oil",
      ...(shampooFrequency.state === "unknown" ? (["shampoo_frequency"] as const) : []),
    ],
    missingInputs: [
      "current_product_load",
      ...(shampooFrequency.state === "unknown" ? (["shampoo_frequency"] as const) : []),
    ],
  }
}

function buildScalpBuildupAssessment(): PlanScalpBuildupAssessment {
  return { knowledgeState: "unknown", state: "unknown", sourceFacts: [] }
}

function buildHeatExposureAssessment(profile: PlanProfile): PlanHeatExposureAssessment {
  if (profile.routine.heatToolUse.state === "unknown") {
    return { knowledgeState: "unknown", state: "unknown", events: [], sourceFacts: [] }
  }

  const events = profile.routine.heatToolUse.value
  const hasUnclassified = events.some((event) => event.route === "unclassified")
  return {
    knowledgeState: hasUnclassified ? "partial" : "known",
    state: events.length > 0 ? "present" : "absent",
    events,
    sourceFacts: events.map((event) => `heat_route:${event.route}`),
  }
}

function buildHairLossBoundary(profile: PlanProfile): PlanHairLossBoundaryAssessment {
  if (!profile.concerns.includes("hair_loss_or_thinning")) {
    return { state: "absent", sourceFacts: [] }
  }
  return {
    state: "present",
    sourceFacts: ["hair_loss_or_thinning"],
    redFlagDetail: "unassessed",
    cosmeticClaimBoundary: "limited_evidence_only",
  }
}

export function buildPlanNeedAssessment(profile: PlanProfile): PlanNeedAssessment {
  return {
    damage: buildDamageAssessment(profile),
    shampooCadence: buildShampooCadenceAssessment(profile),
    resetLoad: buildResetLoadAssessment(profile),
    scalpBuildup: buildScalpBuildupAssessment(),
    heatExposure: buildHeatExposureAssessment(profile),
    hairLossBoundary: buildHairLossBoundary(profile),
  }
}
