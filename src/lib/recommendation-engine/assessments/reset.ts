import type {
  NormalizedProfile,
  RecommendationRequestContext,
  ResetAssessment,
  ResetFocus,
  ResetLevel,
  ResetTriggerSource,
} from "@/lib/recommendation-engine/types"
import type { ProductFrequency } from "@/lib/vocabulary"

const PRODUCT_FREQUENCY_RANK: Record<ProductFrequency, number> = {
  rarely: 0,
  "1_2x": 1,
  "3_4x": 2,
  "5_6x": 3,
  daily: 4,
}

function addSignal(
  state: {
    score: number
    triggers: Set<string>
    sources: Set<ResetTriggerSource>
  },
  score: number,
  trigger: string,
  source: ResetTriggerSource,
) {
  state.score += score
  state.triggers.add(trigger)
  state.sources.add(source)
}

function isFrequencyAtLeast(
  frequencyBand: ProductFrequency | null,
  threshold: ProductFrequency,
): boolean {
  if (!frequencyBand) return false
  return PRODUCT_FREQUENCY_RANK[frequencyBand] >= PRODUCT_FREQUENCY_RANK[threshold]
}

function getFrequency(
  profile: NormalizedProfile,
  category: keyof NormalizedProfile["routineInventory"],
) {
  return profile.routineInventory[category]?.frequencyBand ?? null
}

function mapScoreToLevel(score: number): ResetLevel {
  if (score <= 0) return "none"
  if (score === 1) return "possible"
  if (score <= 3) return "likely"
  return "strong"
}

function deriveCautionFlags(profile: NormalizedProfile): string[] {
  const flags = new Set<string>()

  if (profile.scalpType === "dry" || profile.scalpCondition === "dry_flakes") {
    flags.add("dry_scalp")
  }
  if (profile.scalpCondition === "irritated") {
    flags.add("sensitive_or_irritated_scalp")
  }
  if (profile.concerns.includes("dryness")) {
    flags.add("dry_lengths")
  }
  if (profile.hairTexture === "curly" || profile.hairTexture === "coily") {
    flags.add(`${profile.hairTexture}_hair`)
  }
  if (
    profile.chemicalTreatment.includes("bleached") ||
    profile.chemicalTreatment.includes("colored")
  ) {
    flags.add("color_or_bleach_caution")
  }
  if (profile.cuticleCondition === "rough") {
    flags.add("fragility_caution")
  }

  return Array.from(flags)
}

function chooseResetFocus(
  requestFocus: ResetFocus | null,
  triggers: Set<string>,
): ResetFocus | null {
  if (requestFocus) return requestFocus

  const mineralTrigger = [...triggers].some(
    (trigger) =>
      trigger.includes("hard_water") ||
      trigger.includes("chlorine") ||
      trigger.includes("swimming") ||
      trigger.includes("mineral") ||
      trigger.includes("metal"),
  )

  if (mineralTrigger) return "metal_mineral_hard_water"
  if (triggers.size > 0) return "product_sebum_buildup"
  return null
}

export function buildResetAssessment(
  profile: NormalizedProfile,
  requestContext: RecommendationRequestContext,
): ResetAssessment {
  const state = {
    score: 0,
    triggers: new Set<string>(),
    sources: new Set<ResetTriggerSource>(),
  }

  for (const trigger of requestContext.resetTriggerTerms) {
    const source: ResetTriggerSource =
      trigger.includes("mineral") || trigger.includes("chlorine") || trigger.includes("hard_water")
        ? "environment"
        : trigger.includes("coated") || trigger.includes("buildup")
          ? "symptom"
          : "explicit_request"
    addSignal(state, source === "explicit_request" || source === "symptom" ? 3 : 2, trigger, source)
  }

  const residueProneCategories = ["oil", "leave_in", "mask", "dry_shampoo"] as const
  const residueProneLoad = residueProneCategories.filter(
    (category) => profile.routineInventory[category] !== null,
  ).length
  const dryShampooFrequency = getFrequency(profile, "dry_shampoo")
  const oilFrequency = getFrequency(profile, "oil")
  const maskFrequency = getFrequency(profile, "mask")
  const oilyScalp = profile.scalpType === "oily" || profile.concerns.includes("oily_scalp")

  if (residueProneLoad >= 3) {
    addSignal(state, 2, "heavy_residue_prone_routine", "routine_exposure")
  } else if (residueProneLoad >= 2) {
    addSignal(state, 1, "residue_prone_routine", "routine_exposure")
  }

  if (isFrequencyAtLeast(dryShampooFrequency, "5_6x")) {
    addSignal(state, 2, "frequent_dry_shampoo_use", "routine_exposure")
  } else if (isFrequencyAtLeast(dryShampooFrequency, "3_4x")) {
    addSignal(state, 1, "dry_shampoo_reset_pressure", "routine_exposure")
  }

  if (isFrequencyAtLeast(oilFrequency, "3_4x")) {
    addSignal(state, 1, "frequent_oil_use", "routine_exposure")
  }

  if (isFrequencyAtLeast(maskFrequency, "3_4x")) {
    addSignal(state, 1, "frequent_mask_use", "routine_exposure")
  }

  if (
    (profile.washFrequency === "once_weekly" || profile.washFrequency === "rarely") &&
    (oilyScalp || residueProneLoad >= 2 || dryShampooFrequency !== null)
  ) {
    addSignal(state, 1, "low_wash_cadence_relative_to_load", "routine_exposure")
  }

  if (oilyScalp && residueProneLoad >= 2) {
    addSignal(state, 1, "oily_scalp_plus_residue_load", "routine_exposure")
  }

  const level = mapScoreToLevel(state.score)
  const overloadRisk = mapScoreToLevel(
    Math.max(0, state.score + (residueProneLoad >= 3 ? 1 : 0) - (oilyScalp ? 0 : 1)),
  )

  return {
    level,
    triggers: Array.from(state.triggers),
    triggerSources: Array.from(state.sources),
    resetFocus: chooseResetFocus(requestContext.resetFocusRequest, state.triggers),
    overloadRisk,
    richOptionalCareRisk: overloadRisk === "likely" || overloadRisk === "strong",
    cautionFlags: deriveCautionFlags(profile),
  }
}
