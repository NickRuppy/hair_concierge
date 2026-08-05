/**
 * Shared, quiz-owned taxonomy for the public three-row diagnosis. It is kept
 * separate from the profile/onboarding vocabulary: those consumers receive an
 * explicit projection instead of accidentally inheriting new quiz choices.
 */
export const DIAGNOSTIC_GOALS = [
  "moisture",
  "frizz_surface",
  "shine",
  "shape_definition",
  "volume_balance",
  "strength_ends",
  "scalp_balance",
  "manageability_styling",
] as const

export type DiagnosticGoal = (typeof DIAGNOSTIC_GOALS)[number]

export const DIAGNOSTIC_CONCERNS = [
  "dry_lengths",
  "frizz_flyaways",
  "low_shine",
  "lost_shape",
  "low_volume_or_weighed_down",
  "hair_damage",
  "hair_loss_or_thinning",
  "breakage",
  "split_ends",
  "tangling",
] as const

export type DiagnosticConcern = (typeof DIAGNOSTIC_CONCERNS)[number]

const VISIBLE_CONCERN_ALIASES: Readonly<Record<string, DiagnosticConcern>> = {
  dryness: "dry_lengths",
  frizz: "frizz_flyaways",
}

const VISIBLE_GOAL_ALIASES: Readonly<Record<string, DiagnosticGoal>> = {
  volume: "volume_balance",
  less_volume: "volume_balance",
  healthier_hair: "strength_ends",
  less_frizz: "frizz_surface",
  color_protection: "shine",
  healthy_scalp: "scalp_balance",
  curl_definition: "shape_definition",
  less_split_ends: "strength_ends",
  strengthen: "strength_ends",
  anti_breakage: "strength_ends",
}

/** Maps an old resumable draft into the current visible concern cards. */
export function resolveVisibleDiagnosticConcerns(values: readonly string[]): DiagnosticConcern[] {
  const selected = new Set(
    values.flatMap((value) => {
      const mapped = VISIBLE_CONCERN_ALIASES[value] ?? value
      return DIAGNOSTIC_CONCERNS.includes(mapped as DiagnosticConcern)
        ? [mapped as DiagnosticConcern]
        : []
    }),
  )
  return DIAGNOSTIC_CONCERNS.filter((value) => selected.has(value))
}

/** Maps an old resumable draft into the current visible goal cards. */
export function resolveVisibleDiagnosticGoals(values: readonly string[]): DiagnosticGoal[] {
  const selected = new Set(
    values.flatMap((value) => {
      const mapped = VISIBLE_GOAL_ALIASES[value] ?? value
      return DIAGNOSTIC_GOALS.includes(mapped as DiagnosticGoal) ? [mapped as DiagnosticGoal] : []
    }),
  )
  return DIAGNOSTIC_GOALS.filter((value) => selected.has(value))
}

export type PersonalPlanDiagnosticInput = {
  texture?: "straight" | "wavy" | "curly" | "coily"
  thickness?: "fine" | "normal" | "coarse"
  density?: "low" | "medium" | "high"
  goals?: DiagnosticGoal[]
  currentConcerns?: DiagnosticConcern[]
  concernRecurrence?: {
    concernId: DiagnosticConcern
    frequency: "often" | "sometimes" | "rather_not"
  }
  hairLength?: "very_short" | "short" | "medium" | "long" | "very_long"
  hairSurface?: "smooth" | "slightly_uneven" | "rough"
  elasticResponse?: "stretches_bounces" | "stretches_stays" | "snaps"
  chemicalTreatments?: Array<
    "natural" | "colored" | "lightened" | "permed" | "chemically_straightened"
  >
  scalpOiliness?: "oily" | "balanced" | "dry"
  scalpConcerns?: Array<"oily_dandruff" | "dry_dandruff" | "irritated">
}
