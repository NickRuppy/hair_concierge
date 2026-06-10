import type {
  CareBalanceCadencePolicy,
  CareBalanceRecommendation,
  CareBalanceReasonCode,
  CareBalanceRow,
  CareBalanceSelectionHint,
  CareBalanceSet,
  CareBalanceStatus,
  CareBalanceStrength,
  CareNeedAssessment,
  DamageAssessment,
  EffectiveCareContext,
  InventoryCategory,
  NormalizedProfile,
  ResetAssessment,
} from "@/lib/recommendation-engine/types"
import type { ProductFrequency } from "@/lib/vocabulary"
import {
  classifyHeatExposure,
  compareFrequencyBands,
  hasDeepCleansingVulnerability,
} from "@/lib/recommendation-engine/care-balance/shared"

export interface CareBalanceEvaluationInput {
  context: EffectiveCareContext
  damage: DamageAssessment
  careNeeds: CareNeedAssessment
  reset: ResetAssessment
}

type CareBalanceEvaluator = (input: CareBalanceEvaluationInput) => CareBalanceRow

const STRONG_CATEGORIES = [
  "shampoo",
  "conditioner",
  "leave_in",
  "mask",
  "oil",
  "heat_protectant",
  "bondbuilder",
  "deep_cleansing_shampoo",
  "dry_shampoo",
  "peeling",
] as const satisfies InventoryCategory[]

function getRoutineItem(profile: NormalizedProfile, category: InventoryCategory) {
  return profile.routineInventory[category]
}

function defaultCadencePolicy(): CareBalanceCadencePolicy {
  return {
    kind: "not_applicable",
  }
}

function selectionHints(reasonCodes: CareBalanceReasonCode[]): CareBalanceSelectionHint[] {
  if (reasonCodes.length === 0) return []

  return [
    {
      code: "category_framing",
      reasonCodes,
    },
  ]
}

function row(
  input: CareBalanceEvaluationInput,
  category: InventoryCategory,
  values: {
    primaryStatus?: CareBalanceStatus
    recommendation?: CareBalanceRecommendation
    recommendationStrength?: CareBalanceStrength
    confidence?: CareBalanceRow["confidence"]
    decisiveReasonCodes?: CareBalanceReasonCode[]
    contextReasonCodes?: CareBalanceReasonCode[]
    cadencePolicy?: CareBalanceCadencePolicy
    selectionHintReasonCodes?: CareBalanceReasonCode[]
  } = {},
): CareBalanceRow {
  const item = getRoutineItem(input.context.normalized, category)
  const decisiveReasonCodes = values.decisiveReasonCodes ?? []
  const contextReasonCodes = values.contextReasonCodes ?? []

  return {
    category,
    present: item?.present ?? false,
    currentFrequency: item?.frequencyBand ?? null,
    primaryStatus: values.primaryStatus ?? (item?.present ? "matched" : "not_relevant"),
    recommendation: values.recommendation ?? "no_action",
    recommendationStrength: values.recommendationStrength ?? "low",
    confidence: values.confidence ?? input.damage.confidence,
    decisiveReasonCodes,
    contextReasonCodes,
    cadencePolicy: values.cadencePolicy ?? defaultCadencePolicy(),
    selectionHints: selectionHints(values.selectionHintReasonCodes ?? decisiveReasonCodes),
  }
}

function targetConditionerCadence(profile: NormalizedProfile): ProductFrequency | null {
  return profile.shampooFrequency
}

function isAtLeast(frequency: ProductFrequency | null, threshold: ProductFrequency): boolean {
  const comparison = compareFrequencyBands(frequency, threshold)
  return comparison === 0 || comparison === 1
}

function evaluateShampoo(input: CareBalanceEvaluationInput): CareBalanceRow {
  const item = getRoutineItem(input.context.normalized, "shampoo")
  if (!item) {
    return row(input, "shampoo", {
      primaryStatus: "missing_needed",
      recommendation: "add",
      recommendationStrength: "high",
      confidence: "high",
      decisiveReasonCodes: ["shampoo_missing"],
    })
  }

  return row(input, "shampoo")
}

function evaluateConditioner(input: CareBalanceEvaluationInput): CareBalanceRow {
  const profile = input.context.normalized
  const item = getRoutineItem(profile, "conditioner")
  const targetFrequency = targetConditionerCadence(profile)
  const needReasons: string[] = []

  if (profile.concerns.includes("dryness") || input.careNeeds.hydrationNeed !== "none") {
    needReasons.push("dry_lengths")
  }
  if (profile.concerns.includes("tangling") || input.careNeeds.detanglingNeed !== "none") {
    needReasons.push("tangled_lengths")
  }

  if (!item && needReasons.length > 0) {
    return row(input, "conditioner", {
      primaryStatus: "missing_needed",
      recommendation: "add",
      recommendationStrength: "high",
      decisiveReasonCodes: ["conditioner_missing", ...needReasons],
      cadencePolicy: {
        kind: "match_shampoo_frequency",
        shampooFrequency: profile.shampooFrequency,
        expected: "after_every_wash",
      },
    })
  }

  if (
    item &&
    targetFrequency &&
    compareFrequencyBands(item.frequencyBand, targetFrequency) === -1
  ) {
    return row(input, "conditioner", {
      primaryStatus: "underused",
      recommendation: "increase_frequency",
      recommendationStrength: "medium",
      decisiveReasonCodes: ["conditioner_below_shampoo_cadence"],
      contextReasonCodes: [`shampoo_cadence_${profile.shampooFrequency}`],
      cadencePolicy: {
        kind: "match_shampoo_frequency",
        shampooFrequency: profile.shampooFrequency,
        expected: "after_every_wash",
      },
    })
  }

  if (
    item &&
    item.frequencyBand === "daily_1x" &&
    input.careNeeds.volumeDirection === "volume" &&
    needReasons.length === 0
  ) {
    return row(input, "conditioner", {
      primaryStatus: "overused",
      recommendation: "decrease_frequency",
      recommendationStrength: "medium",
      decisiveReasonCodes: ["conditioner_load_pressure"],
      contextReasonCodes: ["volume_goal"],
      cadencePolicy: {
        kind: "match_shampoo_frequency",
        shampooFrequency: profile.shampooFrequency,
        expected: "most_washes",
      },
    })
  }

  return row(input, "conditioner", {
    cadencePolicy: {
      kind: "match_shampoo_frequency",
      shampooFrequency: profile.shampooFrequency,
      expected: "after_every_wash",
    },
  })
}

function evaluateLeaveIn(input: CareBalanceEvaluationInput): CareBalanceRow {
  const profile = input.context.normalized
  const item = getRoutineItem(profile, "leave_in")
  const needReasons = [
    ...(profile.concerns.includes("frizz") ? ["frizz"] : []),
    ...(profile.concerns.includes("tangling") ? ["tangling"] : []),
  ]

  if (!item && needReasons.length > 0) {
    return row(input, "leave_in", {
      primaryStatus: "missing_needed",
      recommendation: "add",
      recommendationStrength: "medium",
      decisiveReasonCodes: ["leave_in_missing", ...needReasons],
    })
  }

  return row(input, "leave_in")
}

function evaluateMask(input: CareBalanceEvaluationInput): CareBalanceRow {
  const item = getRoutineItem(input.context.normalized, "mask")
  if (item && isAtLeast(item.frequencyBand, "weekly_3_4x") && input.reset.level !== "none") {
    return row(input, "mask", {
      primaryStatus: "overused",
      recommendation: "decrease_frequency",
      recommendationStrength: "medium",
      decisiveReasonCodes: ["frequent_mask_use", "buildup_pressure"],
      contextReasonCodes: input.reset.triggers,
      cadencePolicy: {
        kind: "need_based_support",
        supportNeed: input.damage.overallLevel,
        loadSensitive: true,
        suggestedBand: "weekly_1x",
      },
    })
  }

  return row(input, "mask")
}

function evaluateOil(input: CareBalanceEvaluationInput): CareBalanceRow {
  const item = getRoutineItem(input.context.normalized, "oil")
  if (
    item?.frequencyBand === "daily_1x" &&
    (input.reset.level !== "none" || input.careNeeds.volumeDirection === "volume")
  ) {
    return row(input, "oil", {
      primaryStatus: "overused",
      recommendation: "decrease_frequency",
      recommendationStrength: "medium",
      decisiveReasonCodes: ["daily_oil_use", "buildup_or_flatness_pressure"],
      contextReasonCodes: [
        ...input.reset.triggers,
        ...(input.careNeeds.volumeDirection === "volume" ? ["volume_goal"] : []),
      ],
      cadencePolicy: {
        kind: "need_based_support",
        supportNeed: input.careNeeds.hydrationNeed,
        loadSensitive: true,
        suggestedBand: "weekly_1x",
      },
    })
  }

  return row(input, "oil")
}

function evaluateHeatProtectant(input: CareBalanceEvaluationInput): CareBalanceRow {
  const item = getRoutineItem(input.context.normalized, "heat_protectant")
  const heat = classifyHeatExposure(input.context.normalized)

  if (!item && (heat.tier === "high_direct" || heat.tier === "high_cumulative")) {
    return row(input, "heat_protectant", {
      primaryStatus: "missing_needed",
      recommendation: "add",
      recommendationStrength: "high",
      decisiveReasonCodes: ["heat_protectant_missing", ...heat.reasonCodes],
      contextReasonCodes: heat.reasonCodes,
      cadencePolicy: {
        kind: "match_heat_exposure",
        heatExposureTier: heat.tier,
        relevantTools: heat.relevantTools,
        expected: "with_meaningful_heat",
      },
    })
  }

  if (
    item &&
    heat.tier === "high_cumulative" &&
    compareFrequencyBands(item.frequencyBand, "weekly_3_4x") === -1
  ) {
    return row(input, "heat_protectant", {
      primaryStatus: "underused",
      recommendation: "increase_frequency",
      recommendationStrength: "medium",
      decisiveReasonCodes: ["heat_protectant_below_heat_cadence", ...heat.reasonCodes],
      contextReasonCodes: heat.reasonCodes,
      cadencePolicy: {
        kind: "match_heat_exposure",
        heatExposureTier: heat.tier,
        relevantTools: heat.relevantTools,
        expected: "with_meaningful_heat",
      },
    })
  }

  return row(input, "heat_protectant", {
    contextReasonCodes: heat.reasonCodes,
    cadencePolicy: {
      kind: "match_heat_exposure",
      heatExposureTier: heat.tier,
      relevantTools: heat.relevantTools,
      expected: heat.tier === "airflow" ? "optional_for_airflow_only" : "with_meaningful_heat",
    },
  })
}

function evaluateBondbuilder(input: CareBalanceEvaluationInput): CareBalanceRow {
  const item = getRoutineItem(input.context.normalized, "bondbuilder")
  if (!item && input.damage.bondBuilderPriority === "recommend") {
    return row(input, "bondbuilder", {
      primaryStatus: "missing_needed",
      recommendation: "add",
      recommendationStrength: "high",
      decisiveReasonCodes: ["bondbuilder_missing", "high_bond_repair_priority"],
      contextReasonCodes: input.damage.activeDamageDrivers,
      cadencePolicy: {
        kind: "protocol_based",
        priority: input.damage.bondBuilderPriority,
        suggestedBand: "weekly_1x",
      },
    })
  }

  return row(input, "bondbuilder")
}

function evaluateDeepCleansingShampoo(input: CareBalanceEvaluationInput): CareBalanceRow {
  const profile = input.context.normalized
  const item = getRoutineItem(profile, "deep_cleansing_shampoo")
  const vulnerability = hasDeepCleansingVulnerability(profile, input.damage)

  if (item && isAtLeast(item.frequencyBand, "weekly_3_4x")) {
    return row(input, "deep_cleansing_shampoo", {
      primaryStatus: "overused",
      recommendation: "decrease_frequency",
      recommendationStrength: "high",
      decisiveReasonCodes: ["frequent_deep_cleansing_use"],
      contextReasonCodes: vulnerability.reasonCodes,
      cadencePolicy: {
        kind: "occasional_reset",
        resetNeed: input.reset.level,
        cautionAtOrAbove: "weekly_3_4x",
        vulnerableCautionAtOrAbove: "weekly_1x",
      },
    })
  }

  if (item?.frequencyBand === "weekly_1x" && vulnerability.vulnerable) {
    return row(input, "deep_cleansing_shampoo", {
      primaryStatus: "safety_caution",
      recommendation: "decrease_frequency",
      recommendationStrength: "medium",
      decisiveReasonCodes: ["deep_cleansing_vulnerability", ...vulnerability.reasonCodes],
      cadencePolicy: {
        kind: "occasional_reset",
        resetNeed: input.reset.level,
        cautionAtOrAbove: "weekly_3_4x",
        vulnerableCautionAtOrAbove: "weekly_1x",
      },
    })
  }

  return row(input, "deep_cleansing_shampoo", {
    contextReasonCodes: vulnerability.reasonCodes,
    cadencePolicy: {
      kind: "occasional_reset",
      resetNeed: input.reset.level,
      cautionAtOrAbove: "weekly_3_4x",
      vulnerableCautionAtOrAbove: "weekly_1x",
    },
  })
}

function evaluateDryShampoo(input: CareBalanceEvaluationInput): CareBalanceRow {
  const item = getRoutineItem(input.context.normalized, "dry_shampoo")
  if (item?.frequencyBand === "daily_1x" && input.reset.level !== "none") {
    return row(input, "dry_shampoo", {
      primaryStatus: "overused",
      recommendation: "decrease_frequency",
      recommendationStrength: "medium",
      decisiveReasonCodes: ["daily_dry_shampoo_use", "reset_pressure"],
      contextReasonCodes: input.reset.triggers,
      cadencePolicy: {
        kind: "bridge_between_washes",
        shampooFrequency: input.context.normalized.shampooFrequency,
        expected: "short_bridge_only",
      },
    })
  }

  return row(input, "dry_shampoo")
}

function evaluatePeeling(input: CareBalanceEvaluationInput): CareBalanceRow {
  const profile = input.context.normalized
  const item = getRoutineItem(profile, "peeling")
  if (item && profile.scalpCondition === "irritated") {
    return row(input, "peeling", {
      primaryStatus: "safety_caution",
      recommendation: "decrease_frequency",
      recommendationStrength: "high",
      decisiveReasonCodes: ["irritated_scalp", "peeling_present"],
      cadencePolicy: {
        kind: "occasional_reset",
        resetNeed: input.reset.level,
        cautionAtOrAbove: "weekly_3_4x",
        vulnerableCautionAtOrAbove: "weekly_1x",
      },
    })
  }

  return row(input, "peeling")
}

const EVALUATORS: Record<(typeof STRONG_CATEGORIES)[number], CareBalanceEvaluator> = {
  shampoo: evaluateShampoo,
  conditioner: evaluateConditioner,
  leave_in: evaluateLeaveIn,
  mask: evaluateMask,
  oil: evaluateOil,
  heat_protectant: evaluateHeatProtectant,
  bondbuilder: evaluateBondbuilder,
  deep_cleansing_shampoo: evaluateDeepCleansingShampoo,
  dry_shampoo: evaluateDryShampoo,
  peeling: evaluatePeeling,
}

export function buildCareBalanceSet(input: CareBalanceEvaluationInput): CareBalanceSet {
  return {
    rows: STRONG_CATEGORIES.map((category) => EVALUATORS[category](input)),
  }
}
