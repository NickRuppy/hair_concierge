import type {
  CareBalanceCadencePolicy,
  CareBalanceFrequencyTargetBand,
  CareBalanceRecommendation,
  CareBalanceReasonCode,
  CareBalanceRow,
  CareBalanceSelectionHint,
  CareBalanceSet,
  CareBalanceStatus,
  CareBalanceStrength,
  CareNeedAssessment,
  DamageAssessment,
  DamageLevel,
  EffectiveCareContext,
  InventoryCategory,
  NormalizedProfile,
  ResetAssessment,
  ShampooCadenceAssessment,
} from "@/lib/recommendation-engine/types"
import type { ProductFrequency, ProfileConcern } from "@/lib/vocabulary"
import {
  classifyHeatExposure,
  compareFrequencyBands,
  hasDeepCleansingVulnerability,
} from "@/lib/recommendation-engine/care-balance/shared"
import { mapCadencePolicyToFrequencyTarget } from "@/lib/recommendation-engine/care-balance/frequency-targets"
import { buildShampooCadenceAssessment } from "@/lib/recommendation-engine/shampoo-cadence"

export interface CareBalanceEvaluationInput {
  context: EffectiveCareContext
  damage: DamageAssessment
  careNeeds: CareNeedAssessment
  reset: ResetAssessment
  shampooCadenceAssessment?: ShampooCadenceAssessment | null
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

const DAMAGE_ORDER: DamageLevel[] = ["none", "low", "moderate", "high", "severe"]

function getRoutineItem(profile: NormalizedProfile, category: InventoryCategory) {
  return profile.routineInventory[category]
}

function isDamageAtLeast(level: DamageLevel | undefined, threshold: DamageLevel): boolean {
  if (!level) return false
  return DAMAGE_ORDER.indexOf(level) >= DAMAGE_ORDER.indexOf(threshold)
}

function hasAnyConcern(profile: NormalizedProfile, concerns: ProfileConcern[]): boolean {
  return concerns.some((concern) => profile.concerns.includes(concern))
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
  const cadencePolicy = values.cadencePolicy ?? defaultCadencePolicy()
  const currentFrequency = item?.frequencyBand ?? null

  return {
    category,
    present: item?.present ?? false,
    currentFrequency,
    primaryStatus: values.primaryStatus ?? (item?.present ? "matched" : "not_relevant"),
    recommendation: values.recommendation ?? "no_action",
    recommendationStrength: values.recommendationStrength ?? "low",
    confidence: values.confidence ?? input.damage.confidence,
    decisiveReasonCodes,
    contextReasonCodes,
    cadencePolicy,
    frequencyTarget: mapCadencePolicyToFrequencyTarget({
      cadencePolicy,
      currentFrequency,
      shampooCadenceAssessment: input.shampooCadenceAssessment,
    }),
    selectionHints: selectionHints(values.selectionHintReasonCodes ?? decisiveReasonCodes),
  }
}

function leaveInSuggestedBand(input: CareBalanceEvaluationInput): ProductFrequency {
  const profile = input.context.normalized
  const highNeed =
    profile.hairTexture === "curly" ||
    profile.hairTexture === "coily" ||
    hasAnyConcern(profile, ["dryness", "frizz", "tangling", "hair_damage"]) ||
    isDamageAtLeast(input.damage.overallLevel, "high") ||
    isDamageAtLeast(input.careNeeds.hydrationNeed, "high") ||
    isDamageAtLeast(input.careNeeds.detanglingNeed, "high") ||
    isDamageAtLeast(input.careNeeds.smoothingNeed, "high")
  const mediumNeed =
    hasAnyConcern(profile, ["dryness", "frizz", "tangling"]) ||
    isDamageAtLeast(input.careNeeds.hydrationNeed, "moderate") ||
    isDamageAtLeast(input.careNeeds.detanglingNeed, "moderate") ||
    isDamageAtLeast(input.careNeeds.smoothingNeed, "moderate")

  if (highNeed) return "weekly_3_4x"
  if (mediumNeed) return "weekly_2x"
  return "weekly_1x"
}

function targetBand(
  minFrequency: ProductFrequency,
  maxFrequency: ProductFrequency,
  preferredFrequency: ProductFrequency,
): CareBalanceFrequencyTargetBand {
  return {
    minFrequency,
    maxFrequency,
    preferredFrequency,
  }
}

function leaveInTargetBand(suggestedBand: ProductFrequency): CareBalanceFrequencyTargetBand {
  if (isAtLeast(suggestedBand, "weekly_3_4x")) {
    return targetBand("weekly_3_4x", "daily_1x", "weekly_3_4x")
  }
  if (isAtLeast(suggestedBand, "weekly_2x")) {
    return targetBand("weekly_2x", "weekly_3_4x", "weekly_2x")
  }
  return targetBand("weekly_1x", "weekly_2x", "weekly_1x")
}

function maskSuggestedBand(input: CareBalanceEvaluationInput): ProductFrequency {
  const profile = input.context.normalized
  const lowNeed =
    profile.thickness === "fine" ||
    profile.scalpType === "oily" ||
    input.careNeeds.volumeDirection === "volume"

  return lowNeed ? "biweekly_1x" : "weekly_1x"
}

function maskTargetBand(
  suggestedBand: ProductFrequency,
  supportNeed: DamageLevel,
): CareBalanceFrequencyTargetBand {
  if (isAtLeast(suggestedBand, "weekly_2x") || isDamageAtLeast(supportNeed, "high")) {
    return targetBand("weekly_1x", "weekly_2x", "weekly_1x")
  }
  if (suggestedBand === "monthly_1x" || suggestedBand === "biweekly_1x") {
    return targetBand("monthly_1x", "biweekly_1x", "biweekly_1x")
  }
  return targetBand("biweekly_1x", "weekly_1x", "weekly_1x")
}

function oilSuggestedBand(input: CareBalanceEvaluationInput): ProductFrequency {
  const profile = input.context.normalized
  const highNeed =
    profile.thickness === "coarse" ||
    profile.hairTexture === "curly" ||
    profile.hairTexture === "coily" ||
    isDamageAtLeast(input.careNeeds.hydrationNeed, "high") ||
    hasAnyConcern(profile, ["dryness", "frizz"])

  return highNeed ? "weekly_2x" : "weekly_1x"
}

function oilTargetBand(
  suggestedBand: ProductFrequency,
  supportNeed: DamageLevel,
): CareBalanceFrequencyTargetBand {
  if (isAtLeast(suggestedBand, "weekly_2x") || isDamageAtLeast(supportNeed, "high")) {
    return targetBand("weekly_2x", "weekly_3_4x", "weekly_2x")
  }
  return targetBand("monthly_1x", "weekly_1x", "weekly_1x")
}

function heatTargetBand(
  heatStyling: CareBalanceEvaluationInput["context"]["normalized"]["heatStyling"],
): CareBalanceFrequencyTargetBand | null {
  switch (heatStyling) {
    case "rarely":
      return targetBand("less_than_monthly", "monthly_1x", "less_than_monthly")
    case "once_weekly":
      return targetBand("weekly_1x", "weekly_1x", "weekly_1x")
    case "several_weekly":
      return targetBand("weekly_2x", "weekly_5_6x", "weekly_3_4x")
    case "daily":
      return targetBand("weekly_5_6x", "daily_1x", "daily_1x")
    case "never":
    case null:
      return null
  }
}

function protocolTargetBand(suggestedBand: ProductFrequency): CareBalanceFrequencyTargetBand {
  return targetBand("biweekly_1x", "weekly_2x", suggestedBand)
}

function deepCleansingTargetBand(
  resetLevel: ResetAssessment["level"],
  vulnerable: boolean,
): CareBalanceFrequencyTargetBand {
  if (vulnerable) return targetBand("less_than_monthly", "biweekly_1x", "monthly_1x")
  if (resetLevel === "strong") return targetBand("monthly_1x", "weekly_1x", "biweekly_1x")
  if (resetLevel === "likely") return targetBand("monthly_1x", "biweekly_1x", "biweekly_1x")
  return targetBand("less_than_monthly", "monthly_1x", "monthly_1x")
}

function peelingTargetBand(
  resetLevel: ResetAssessment["level"],
  irritatedScalp: boolean,
): CareBalanceFrequencyTargetBand {
  if (irritatedScalp) return targetBand("less_than_monthly", "monthly_1x", "monthly_1x")
  if (resetLevel === "strong" || resetLevel === "likely") {
    return targetBand("monthly_1x", "biweekly_1x", "biweekly_1x")
  }
  return targetBand("less_than_monthly", "monthly_1x", "monthly_1x")
}

function dryShampooTargetBand(input: CareBalanceEvaluationInput): CareBalanceFrequencyTargetBand {
  const shampooFrequency = input.context.normalized.shampooFrequency
  const shampooCadenceHigh = input.shampooCadenceAssessment?.target?.band === "high"
  const lowShampooCadence =
    shampooFrequency === "weekly_1x" ||
    shampooFrequency === "biweekly_1x" ||
    shampooFrequency === "monthly_1x" ||
    shampooFrequency === "less_than_monthly"

  if (lowShampooCadence) {
    return targetBand("weekly_1x", "weekly_2x", "weekly_1x")
  }
  if (shampooCadenceHigh) {
    return targetBand("less_than_monthly", "weekly_1x", "weekly_1x")
  }
  return targetBand("less_than_monthly", "weekly_3_4x", "weekly_1x")
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
      cadencePolicy: {
        kind: "baseline_cleansing",
        shampooFrequency: input.context.normalized.shampooFrequency,
      },
    })
  }

  return row(input, "shampoo", {
    cadencePolicy: {
      kind: "baseline_cleansing",
      shampooFrequency: input.context.normalized.shampooFrequency,
    },
  })
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
  const suggestedBand = leaveInSuggestedBand(input)
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
      cadencePolicy: {
        kind: "need_based_support",
        supportNeed: input.careNeeds.hydrationNeed,
        loadSensitive: false,
        suggestedBand,
        targetBand: leaveInTargetBand(suggestedBand),
      },
    })
  }

  return row(input, "leave_in", {
    cadencePolicy: {
      kind: "need_based_support",
      supportNeed: input.careNeeds.hydrationNeed,
      loadSensitive: false,
      suggestedBand,
      targetBand: leaveInTargetBand(suggestedBand),
    },
  })
}

function evaluateMask(input: CareBalanceEvaluationInput): CareBalanceRow {
  const item = getRoutineItem(input.context.normalized, "mask")
  const suggestedBand = maskSuggestedBand(input)
  if (
    item &&
    (item.frequencyBand === "daily_1x" ||
      (isAtLeast(item.frequencyBand, "weekly_3_4x") && input.reset.level !== "none"))
  ) {
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
        suggestedBand,
        targetBand: maskTargetBand(suggestedBand, input.damage.overallLevel),
      },
    })
  }

  return row(input, "mask", {
    cadencePolicy: {
      kind: "need_based_support",
      supportNeed: input.damage.overallLevel,
      loadSensitive: true,
      suggestedBand,
      targetBand: maskTargetBand(suggestedBand, input.damage.overallLevel),
    },
  })
}

function evaluateOil(input: CareBalanceEvaluationInput): CareBalanceRow {
  const item = getRoutineItem(input.context.normalized, "oil")
  const suggestedBand = oilSuggestedBand(input)
  if (item?.frequencyBand === "daily_1x") {
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
        suggestedBand,
        targetBand: oilTargetBand(suggestedBand, input.careNeeds.hydrationNeed),
      },
    })
  }

  return row(input, "oil", {
    cadencePolicy: {
      kind: "need_based_support",
      supportNeed: input.careNeeds.hydrationNeed,
      loadSensitive: true,
      suggestedBand,
      targetBand: oilTargetBand(suggestedBand, input.careNeeds.hydrationNeed),
    },
  })
}

function evaluateHeatProtectant(input: CareBalanceEvaluationInput): CareBalanceRow {
  const item = getRoutineItem(input.context.normalized, "heat_protectant")
  const heat = classifyHeatExposure(input.context.normalized)
  const hasRequiredHeatTool =
    heat.relevantTools.length > 0 && heat.tier !== "airflow" && heat.tier !== "none"
  const targetBand = hasRequiredHeatTool
    ? heatTargetBand(input.context.normalized.heatStyling)
    : null

  if (!item && targetBand) {
    return row(input, "heat_protectant", {
      primaryStatus: "missing_needed",
      recommendation: "add",
      recommendationStrength:
        input.context.normalized.heatStyling === "daily" ||
        input.context.normalized.heatStyling === "several_weekly"
          ? "high"
          : "medium",
      decisiveReasonCodes: ["heat_protectant_missing", ...heat.reasonCodes],
      contextReasonCodes: heat.reasonCodes,
      cadencePolicy: {
        kind: "match_heat_exposure",
        heatExposureTier: heat.tier,
        relevantTools: heat.relevantTools,
        expected: "with_meaningful_heat",
        targetBand,
      },
    })
  }

  if (
    item &&
    targetBand &&
    compareFrequencyBands(item.frequencyBand, targetBand.minFrequency) === -1
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
        targetBand,
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
      targetBand,
    },
  })
}

function evaluateBondbuilder(input: CareBalanceEvaluationInput): CareBalanceRow {
  const item = getRoutineItem(input.context.normalized, "bondbuilder")
  const suggestedBand = input.damage.bondBuilderPriority === "recommend" ? "weekly_2x" : "weekly_1x"
  if (item?.frequencyBand === "daily_1x") {
    return row(input, "bondbuilder", {
      primaryStatus: "overused",
      recommendation: "decrease_frequency",
      recommendationStrength: "medium",
      decisiveReasonCodes: ["daily_bondbuilder_use"],
      contextReasonCodes: input.damage.activeDamageDrivers,
      cadencePolicy: {
        kind: "protocol_based",
        priority: input.damage.bondBuilderPriority,
        suggestedBand,
        targetBand: protocolTargetBand(suggestedBand),
      },
    })
  }

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
        targetBand: protocolTargetBand("weekly_1x"),
      },
    })
  }

  return row(input, "bondbuilder", {
    cadencePolicy: {
      kind: "protocol_based",
      priority: input.damage.bondBuilderPriority,
      suggestedBand,
      targetBand: protocolTargetBand(suggestedBand),
    },
  })
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
        vulnerableCautionAtOrAbove: vulnerability.vulnerable ? "weekly_1x" : null,
        targetBand: deepCleansingTargetBand(input.reset.level, vulnerability.vulnerable),
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
        targetBand: deepCleansingTargetBand(input.reset.level, true),
      },
    })
  }

  return row(input, "deep_cleansing_shampoo", {
    contextReasonCodes: vulnerability.reasonCodes,
    cadencePolicy: {
      kind: "occasional_reset",
      resetNeed: input.reset.level,
      cautionAtOrAbove: "weekly_3_4x",
      vulnerableCautionAtOrAbove: vulnerability.vulnerable ? "weekly_1x" : null,
      targetBand: deepCleansingTargetBand(input.reset.level, vulnerability.vulnerable),
    },
  })
}

function evaluateDryShampoo(input: CareBalanceEvaluationInput): CareBalanceRow {
  const item = getRoutineItem(input.context.normalized, "dry_shampoo")
  if (item?.frequencyBand === "daily_1x") {
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
        targetBand: dryShampooTargetBand(input),
      },
    })
  }

  return row(input, "dry_shampoo", {
    cadencePolicy: {
      kind: "bridge_between_washes",
      shampooFrequency: input.context.normalized.shampooFrequency,
      expected: "short_bridge_only",
      targetBand: dryShampooTargetBand(input),
    },
  })
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
        targetBand: peelingTargetBand(input.reset.level, true),
      },
    })
  }

  return row(input, "peeling", {
    cadencePolicy: {
      kind: "occasional_reset",
      resetNeed: input.reset.level,
      cautionAtOrAbove: "weekly_3_4x",
      vulnerableCautionAtOrAbove: null,
      targetBand: peelingTargetBand(input.reset.level, false),
    },
  })
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
  const shampooCadenceAssessment =
    input.shampooCadenceAssessment ??
    buildShampooCadenceAssessment(input.context.normalized, input.reset)
  const evaluationInput: CareBalanceEvaluationInput = {
    ...input,
    shampooCadenceAssessment,
  }

  return {
    rows: STRONG_CATEGORIES.map((category) => EVALUATORS[category](evaluationInput)),
  }
}
