import {
  compareProductFrequencies,
  isProductFrequencyAtLeast,
  type ScalpCondition,
  type ScalpType,
  type ProductFrequency,
} from "@/lib/vocabulary"
import type {
  NormalizedProfile,
  ResetAssessment,
  ShampooCadenceAssessment,
  ShampooCadenceBand,
  ShampooCadenceDelta,
  ShampooCadencePositionInRange,
  ShampooCadenceTarget,
} from "@/lib/recommendation-engine/types"

const BAND_ORDER: ShampooCadenceBand[] = ["low", "medium", "high"]

const TARGETS_BY_BAND: Record<ShampooCadenceBand, ShampooCadenceTarget> = {
  low: {
    band: "low",
    minFrequency: "biweekly_1x",
    maxFrequency: "weekly_1x",
    preferredFrequency: "weekly_1x",
  },
  medium: {
    band: "medium",
    minFrequency: "weekly_1x",
    maxFrequency: "weekly_3_4x",
    preferredFrequency: "weekly_2x",
  },
  high: {
    band: "high",
    minFrequency: "weekly_2x",
    maxFrequency: "weekly_5_6x",
    preferredFrequency: "weekly_3_4x",
  },
}

const FIBER_CONCERNS = ["dryness", "frizz", "breakage", "split_ends", "hair_damage"] as const

function shiftBand(band: ShampooCadenceBand, direction: "up" | "down"): ShampooCadenceBand {
  const index = BAND_ORDER.indexOf(band)
  const nextIndex = direction === "up" ? index + 1 : index - 1
  return BAND_ORDER[Math.max(0, Math.min(BAND_ORDER.length - 1, nextIndex))]
}

function getCurrentShampooFrequency(profile: NormalizedProfile): ProductFrequency | null {
  return (
    profile.routineInventory.shampoo?.frequencyBand ??
    profile.shampooFrequency ??
    "less_than_monthly"
  )
}

export function deriveBaseShampooCadenceBand(input: {
  scalpType: ScalpType | null
  scalpCondition: ScalpCondition | null
  hasDandruffConcern?: boolean
}): {
  band: ShampooCadenceBand | null
  reasonCode: string
} {
  if (input.scalpCondition === "dandruff") {
    return { band: "high", reasonCode: "base_scalp_condition_dandruff" }
  }

  if (input.scalpCondition === "irritated") {
    return { band: "medium", reasonCode: "base_scalp_condition_irritated" }
  }

  if (input.scalpCondition === "dry_flakes") {
    return { band: "low", reasonCode: "base_scalp_condition_dry_flakes" }
  }

  if (input.hasDandruffConcern) {
    return { band: "high", reasonCode: "base_concern_dandruff" }
  }

  if (input.scalpType === "oily") {
    return { band: "high", reasonCode: "base_scalp_type_oily" }
  }

  if (input.scalpType === "balanced") {
    return { band: "medium", reasonCode: "base_scalp_type_balanced" }
  }

  if (input.scalpType === "dry") {
    return { band: "low", reasonCode: "base_scalp_type_dry" }
  }

  return { band: null, reasonCode: "base_scalp_state_unknown" }
}

export function deriveBaseShampooCadenceTarget(input: {
  scalpType: ScalpType | null
  scalpCondition: ScalpCondition | null
  hasDandruffConcern?: boolean
}): ShampooCadenceTarget | null {
  const { band } = deriveBaseShampooCadenceBand(input)
  return band ? TARGETS_BY_BAND[band] : null
}

function deriveBaseBand(profile: NormalizedProfile): {
  band: ShampooCadenceBand | null
  reasonCode: string
} {
  return deriveBaseShampooCadenceBand({
    scalpType: profile.scalpType,
    scalpCondition: profile.scalpCondition,
    hasDandruffConcern: profile.concerns.includes("dandruff"),
  })
}

function hasFiberConcern(profile: NormalizedProfile): boolean {
  return FIBER_CONCERNS.some((concern) => profile.concerns.includes(concern))
}

function hasStackedFiberFragility(profile: NormalizedProfile): boolean {
  const fiberConcernCount = FIBER_CONCERNS.filter((concern) =>
    profile.concerns.includes(concern),
  ).length
  const texturedFragility =
    (profile.hairTexture === "curly" || profile.hairTexture === "coily") && hasFiberConcern(profile)
  const chemicalFragility =
    profile.chemicalTreatment.some((treatment) => treatment !== "natural") &&
    hasFiberConcern(profile)

  return texturedFragility || chemicalFragility || fiberConcernCount >= 2
}

function addModifierCodes(
  profile: NormalizedProfile,
  reset: ResetAssessment | null,
): {
  up: string[]
  down: string[]
} {
  const up = new Set<string>()
  const down = new Set<string>()

  if (profile.concerns.includes("oily_scalp")) {
    up.add("modifier_up_oily_scalp_concern")
  }

  if (profile.goals.includes("healthy_scalp")) {
    up.add("modifier_up_healthy_scalp_goal")
  }

  if (isProductFrequencyAtLeast(profile.routineInventory.dry_shampoo?.frequencyBand, "weekly_2x")) {
    up.add("modifier_up_frequent_dry_shampoo")
  }

  if (isCadenceRelevantReset(reset)) {
    up.add("modifier_up_cadence_relevant_reset")
  }

  if (hasStackedFiberFragility(profile)) {
    down.add("modifier_down_stacked_fiber_fragility")
  }

  return {
    up: Array.from(up),
    down: Array.from(down),
  }
}

function isCadenceRelevantReset(reset: ResetAssessment | null): boolean {
  if (reset?.level !== "likely" && reset?.level !== "strong") return false

  return reset.triggers.some(
    (trigger) =>
      trigger === "heavy_residue_prone_routine" ||
      trigger === "residue_prone_routine" ||
      trigger === "frequent_dry_shampoo_use" ||
      trigger === "dry_shampoo_reset_pressure" ||
      trigger === "frequent_oil_use" ||
      trigger === "frequent_mask_use" ||
      trigger === "low_wash_cadence_relative_to_load" ||
      trigger === "oily_scalp_plus_residue_load" ||
      trigger.includes("buildup") ||
      trigger.includes("coated") ||
      trigger.includes("sebum"),
  )
}

function deriveCaveatCodes(
  profile: NormalizedProfile,
  baseReasonCode: string,
  hasUpModifier: boolean,
  hasDownModifier: boolean,
): string[] {
  const caveats = new Set<string>()

  if (baseReasonCode.startsWith("base_scalp_condition_") && profile.scalpType === "oily") {
    caveats.add("secondary_scalp_type_oily")
  }

  if (hasUpModifier && hasDownModifier) {
    caveats.add("conflicting_cadence_modifiers")
  }

  return Array.from(caveats)
}

function applyModifiers(
  baseBand: ShampooCadenceBand,
  upCodes: string[],
  downCodes: string[],
): ShampooCadenceBand {
  if (upCodes.length > 0 && downCodes.length > 0) return baseBand
  if (upCodes.length > 0) return shiftBand(baseBand, "up")
  if (downCodes.length > 0) return shiftBand(baseBand, "down")
  return baseBand
}

function derivePositionInRange(
  currentFrequency: ProductFrequency,
  target: ShampooCadenceTarget,
): ShampooCadencePositionInRange | null {
  if (compareProductFrequencies(currentFrequency, target.preferredFrequency) === 0) {
    return "preferred"
  }
  if (compareProductFrequencies(currentFrequency, target.minFrequency) === 0) {
    return "lower_edge"
  }
  if (compareProductFrequencies(currentFrequency, target.maxFrequency) === 0) {
    return "upper_edge"
  }

  return null
}

function deriveDelta(
  currentFrequency: ProductFrequency | null,
  target: ShampooCadenceTarget | null,
): {
  delta: ShampooCadenceDelta
  positionInRange: ShampooCadencePositionInRange | null
} {
  if (currentFrequency === null || target === null) {
    return { delta: "unknown", positionInRange: null }
  }

  const minComparison = compareProductFrequencies(currentFrequency, target.minFrequency)
  const maxComparison = compareProductFrequencies(currentFrequency, target.maxFrequency)

  if (minComparison === null || maxComparison === null) {
    return { delta: "unknown", positionInRange: null }
  }

  if (minComparison < 0) {
    return { delta: "below", positionInRange: null }
  }

  if (maxComparison > 0) {
    return { delta: "above", positionInRange: null }
  }

  return {
    delta: "near",
    positionInRange: derivePositionInRange(currentFrequency, target),
  }
}

export function buildShampooCadenceAssessment(
  profile: NormalizedProfile,
  reset: ResetAssessment | null = null,
): ShampooCadenceAssessment {
  const currentFrequency = getCurrentShampooFrequency(profile)
  const base = deriveBaseBand(profile)
  const reasonCodes = new Set<string>([base.reasonCode])

  if (base.band === null) {
    return {
      currentFrequency,
      baseBand: null,
      target: null,
      delta: "unknown",
      positionInRange: null,
      reasonCodes: Array.from(reasonCodes),
      caveatCodes: [],
    }
  }

  const modifiers = addModifierCodes(profile, reset)
  for (const code of [...modifiers.up, ...modifiers.down]) {
    reasonCodes.add(code)
  }

  const adjustedBand = applyModifiers(base.band, modifiers.up, modifiers.down)
  const target = TARGETS_BY_BAND[adjustedBand]
  const delta = deriveDelta(currentFrequency, target)
  const caveatCodes = deriveCaveatCodes(
    profile,
    base.reasonCode,
    modifiers.up.length > 0,
    modifiers.down.length > 0,
  )

  return {
    currentFrequency,
    baseBand: base.band,
    target,
    delta: delta.delta,
    positionInRange: delta.positionInRange,
    reasonCodes: Array.from(reasonCodes),
    caveatCodes,
  }
}
