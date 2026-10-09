import { compareProductFrequencies, type ProductFrequency } from "@/lib/vocabulary/frequencies"
import { normalizeReasonSalience } from "../reasons"
import type {
  PlanCategoryDecision,
  PlanCategoryTarget,
  PlanNeedAssessment,
  PlanProfile,
  PlanReasonFact,
} from "../types"

type ShampooTarget = Extract<PlanCategoryTarget, { category: "shampoo" }>

const SCALP_CADENCE: Record<
  PlanNeedAssessment["shampooCadence"]["scalpRoute"],
  { preferred: ProductFrequency; min: ProductFrequency; max: ProductFrequency }
> = {
  oily: { preferred: "weekly_3_4x", min: "weekly_2x", max: "weekly_5_6x" },
  balanced: { preferred: "weekly_2x", min: "weekly_1x", max: "weekly_3_4x" },
  dry: { preferred: "weekly_1x", min: "biweekly_1x", max: "weekly_1x" },
}

function reason(
  id: string,
  salience: PlanReasonFact["salience"],
  key: string,
  values: PlanReasonFact["values"] = {},
): PlanReasonFact {
  return {
    id,
    salience,
    evidence: [{ source: "quiz", key }],
    values,
  }
}

function shampooFrequencyValue(profile: PlanProfile): ProductFrequency | null {
  if (profile.routine.shampooFrequency.state !== "known") return null
  return profile.routine.shampooFrequency.value === "does_not_wash"
    ? "less_than_monthly"
    : profile.routine.shampooFrequency.value
}

function nearestBoundary(
  current: ProductFrequency,
  min: ProductFrequency,
  max: ProductFrequency,
): ProductFrequency {
  if (compareProductFrequencies(current, min) === -1) return min
  if (compareProductFrequencies(current, max) === 1) return max
  return current
}

function everydayConstraint(profile: PlanProfile): ShampooTarget["everydayConstraint"] {
  const concerns = new Set(profile.scalp.concerns)
  const dryFlakes = concerns.has("dry_dandruff")
  const irritated = concerns.has("irritated")

  if (dryFlakes && irritated) return "gentle_dry_scalp_and_irritation_compatible"
  if (dryFlakes) return "gentle_dry_scalp"
  if (irritated) return "irritation_compatible"
  return "standard"
}

export function computeShampooDecision(
  profile: PlanProfile,
  assessments: PlanNeedAssessment,
): PlanCategoryDecision {
  const concerns = new Set(profile.scalp.concerns)
  const roles: ShampooTarget["roles"] = concerns.has("oily_dandruff")
    ? ["shampoo_everyday", "shampoo_dandruff"]
    : ["shampoo_everyday"]

  const cadence = SCALP_CADENCE[assessments.shampooCadence.scalpRoute]
  const currentFrequency = shampooFrequencyValue(profile)
  const targetFrequency = currentFrequency
    ? nearestBoundary(currentFrequency, cadence.min, cadence.max)
    : cadence.preferred
  const mode =
    currentFrequency && targetFrequency === currentFrequency
      ? "retained_current"
      : currentFrequency
        ? "nearest_boundary"
        : "quiz_starting_target"

  const target: ShampooTarget = {
    category: "shampoo",
    roles,
    scalpRoute: assessments.shampooCadence.scalpRoute,
    everydayConstraint: everydayConstraint(profile),
    requiresTargetedDandruffCapability: roles.includes("shampoo_dandruff"),
  }

  const reasons: PlanReasonFact[] = [
    reason("shampoo.inclusion.basis", "primary", "wet_cleansing_required"),
    reason("shampoo.role.everyday", "primary", "scalpOiliness", {
      scalpRoute: assessments.shampooCadence.scalpRoute,
    }),
    reason(`shampoo.cadence.${mode}`, "primary", "scalpOiliness", {
      target: targetFrequency,
      min: cadence.min,
      max: cadence.max,
    }),
    {
      id: "shampoo.cadence.total_budget",
      salience: "secondary",
      evidence: [{ source: "assessment", key: "shampooCadence" }],
      values: { target: targetFrequency },
    },
    {
      id: "shampoo.cadence.substitution",
      salience: "detail",
      evidence: [{ source: "assessment", key: "shampooCadence" }],
      values: { substitutesSpecialWash: true },
    },
  ]

  if (concerns.has("oily_dandruff")) {
    reasons.push(
      reason("shampoo.role.dandruff", "primary", "scalpConcerns", {
        concern: "oily_dandruff",
      }),
    )
  }
  if (concerns.has("dry_dandruff")) {
    reasons.push(
      reason("shampoo.role.dry_flakes", "primary", "scalpConcerns", {
        concern: "dry_dandruff",
      }),
    )
  }
  if (concerns.has("irritated")) {
    reasons.push(
      reason("shampoo.role.irritated", "primary", "scalpConcerns", {
        concern: "irritated",
      }),
    )
  }

  return {
    category: "shampoo",
    resolution: "resolved",
    needTier: "basis",
    roles,
    target,
    frequency: {
      kind: "wet_wash_total",
      mode,
      target: targetFrequency,
      allowedRange: { min: cadence.min, max: cadence.max },
      specialWashSubstitution: true,
    },
    reasons: normalizeReasonSalience(reasons),
    executionState: "available",
    executionPauseReason: null,
    deferredFacts:
      profile.routine.shampooFrequency.state === "unknown" ? ["shampoo_frequency"] : [],
  }
}
