import type {
  CareBalanceCadencePolicy,
  CareBalanceFrequencyDelta,
  CareBalanceFrequencyTargetBand,
  CareBalanceFrequencyTarget,
  ShampooCadenceAssessment,
} from "@/lib/recommendation-engine/types"
import { compareProductFrequencies, type ProductFrequency } from "@/lib/vocabulary"

const FREQUENCY_ORDER: ProductFrequency[] = [
  "less_than_monthly",
  "monthly_1x",
  "biweekly_1x",
  "weekly_1x",
  "weekly_2x",
  "weekly_3_4x",
  "weekly_5_6x",
  "daily_1x",
]

export interface CareBalanceFrequencyTargetInput {
  cadencePolicy: CareBalanceCadencePolicy
  currentFrequency: ProductFrequency | null
  shampooCadenceAssessment?: ShampooCadenceAssessment | null
}

function frequencyTarget(
  currentFrequency: ProductFrequency | null,
  minFrequency: ProductFrequency,
  maxFrequency: ProductFrequency,
  preferredFrequency: ProductFrequency,
): CareBalanceFrequencyTarget {
  return {
    minFrequency,
    maxFrequency,
    preferredFrequency,
    delta: deriveDelta(currentFrequency, minFrequency, maxFrequency),
  }
}

function deriveDelta(
  currentFrequency: ProductFrequency | null,
  minFrequency: ProductFrequency,
  maxFrequency: ProductFrequency,
): CareBalanceFrequencyDelta {
  if (currentFrequency === null) return "missing"

  const minComparison = compareProductFrequencies(currentFrequency, minFrequency)
  const maxComparison = compareProductFrequencies(currentFrequency, maxFrequency)
  if (minComparison === null || maxComparison === null) return "unknown"
  if (minComparison < 0) return "below"
  if (maxComparison > 0) return "above"
  return "in_range"
}

function lowerFrequency(frequency: ProductFrequency): ProductFrequency {
  const index = FREQUENCY_ORDER.indexOf(frequency)
  return FREQUENCY_ORDER[Math.max(0, index - 1)] ?? frequency
}

function mapShampooTarget(
  input: CareBalanceFrequencyTargetInput,
): CareBalanceFrequencyTarget | null {
  const target = input.shampooCadenceAssessment?.target
  if (!target) return null

  return frequencyTarget(
    input.currentFrequency,
    target.minFrequency,
    target.maxFrequency,
    target.preferredFrequency,
  )
}

function mapConditionerTarget(
  input: CareBalanceFrequencyTargetInput,
  policy: Extract<CareBalanceCadencePolicy, { kind: "match_shampoo_frequency" }>,
): CareBalanceFrequencyTarget | null {
  const shampooTarget = input.shampooCadenceAssessment?.target
  if (!shampooTarget && policy.shampooFrequency === null) return null

  if (!shampooTarget) {
    const shampooFrequency = policy.shampooFrequency
    if (shampooFrequency === null) return null
    const preferred =
      policy.expected === "most_washes" ? lowerFrequency(shampooFrequency) : shampooFrequency
    return frequencyTarget(input.currentFrequency, preferred, shampooFrequency, preferred)
  }

  if (policy.expected === "most_washes") {
    const preferred = lowerFrequency(shampooTarget.preferredFrequency)
    return frequencyTarget(
      input.currentFrequency,
      shampooTarget.minFrequency,
      shampooTarget.preferredFrequency,
      preferred,
    )
  }

  return frequencyTarget(
    input.currentFrequency,
    shampooTarget.minFrequency,
    shampooTarget.maxFrequency,
    shampooTarget.preferredFrequency,
  )
}

function mapPolicyBandTarget(
  input: CareBalanceFrequencyTargetInput,
  targetBand: CareBalanceFrequencyTargetBand,
): CareBalanceFrequencyTarget {
  return frequencyTarget(
    input.currentFrequency,
    targetBand.minFrequency,
    targetBand.maxFrequency,
    targetBand.preferredFrequency,
  )
}

function mapHeatTarget(input: CareBalanceFrequencyTargetInput): CareBalanceFrequencyTarget | null {
  const policy = input.cadencePolicy
  if (policy.kind !== "match_heat_exposure") return null
  return policy.targetBand ? mapPolicyBandTarget(input, policy.targetBand) : null
}

export function mapCadencePolicyToFrequencyTarget(
  input: CareBalanceFrequencyTargetInput,
): CareBalanceFrequencyTarget | null {
  switch (input.cadencePolicy.kind) {
    case "baseline_cleansing":
      return mapShampooTarget(input)
    case "match_shampoo_frequency":
      return mapConditionerTarget(input, input.cadencePolicy)
    case "need_based_support":
      return mapPolicyBandTarget(input, input.cadencePolicy.targetBand)
    case "match_heat_exposure":
      return mapHeatTarget(input)
    case "protocol_based":
      return mapPolicyBandTarget(input, input.cadencePolicy.targetBand)
    case "occasional_reset":
      return mapPolicyBandTarget(input, input.cadencePolicy.targetBand)
    case "bridge_between_washes":
      return mapPolicyBandTarget(input, input.cadencePolicy.targetBand)
    case "not_applicable":
      return null
  }
}
