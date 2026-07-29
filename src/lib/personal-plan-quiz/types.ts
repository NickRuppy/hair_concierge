export const PERSONAL_PLAN_QUIZ_GOALS = [
  "moisture",
  "frizz_surface",
  "shine",
  "shape_definition",
  "volume_balance",
  "strength_ends",
  "scalp_balance",
  "manageability_styling",
] as const

export type PersonalPlanQuizGoal = (typeof PERSONAL_PLAN_QUIZ_GOALS)[number]

export const PERSONAL_PLAN_QUIZ_CONCERNS = [
  "dry_dull_lengths",
  "frizz_flyaways",
  "low_shine",
  "lost_shape",
  "low_volume_or_weighed_down",
  "breakage_or_split_ends",
  "tangling",
  "scalp_imbalance",
] as const

export type PersonalPlanQuizConcern = (typeof PERSONAL_PLAN_QUIZ_CONCERNS)[number]

/**
 * Durable V2 answers only. Conversion admissions, the daily-time commitment,
 * loading commitments, email, and consent intentionally live outside this type.
 */
export type PersonalPlanQuizAnswers = {
  texture?: "straight" | "wavy" | "curly" | "coily"
  thickness?: "fine" | "normal" | "coarse"
  density?: "low" | "medium" | "high"
  goals?: PersonalPlanQuizGoal[]
  routineClarity?: "clear" | "partial" | "trial_and_error" | "none"
  resultReliability?: "mostly" | "sometimes" | "rarely"
  adaptationConfidence?: "yes" | "partly" | "no"
  currentConcerns?: PersonalPlanQuizConcern[]
  hairLength?: "very_short" | "short" | "medium" | "long" | "very_long"
  hairSurface?: "smooth" | "slightly_uneven" | "rough"
  elasticResponse?: "stretches_bounces" | "stretches_stays" | "snaps" | "unknown"
  chemicalTreatments?: Array<
    "natural" | "colored" | "lightened" | "permed" | "chemically_straightened"
  >
  scalpOiliness?: "oily" | "balanced" | "dry"
  scalpConcerns?: Array<"oily_dandruff" | "dry_dandruff" | "irritated">
  previousAttempts?:
    | "nothing_reliably_worked"
    | "some_steps_helped"
    | "little_targeted_trial"
    | "mostly_works"
  blockers?: Array<
    | "conflicting_tips"
    | "product_fit"
    | "application_uncertainty"
    | "different_scalp_and_lengths"
    | "routine_too_complex"
    | "time_and_cost"
    | "consistency"
    | "other"
  >
  routineStyle?:
    | "simple_reliable"
    | "intentional_caring"
    | "flexible_versatile"
    | "precise_goal_oriented"
  meaningfulMoment?: "everyday" | "work" | "social" | "going_out" | "special_occasions"
  /** Optional free-text detail captured when "Etwas anderes" is chosen on the blockers screen. */
  blockersOtherText?: string
}

export type PersonalPlanQuizEphemeralState = {
  admissionRecurrence?: "often" | "sometimes" | "rather_not"
  admissionConflict?: "often" | "sometimes" | "rather_not"
  admissionPracticalCost?: "often" | "sometimes" | "rather_not"
  admissionEmotionalRelevance?: "very" | "somewhat" | "less"
  dailyTime?: "5_minutes" | "10_minutes" | "15_minutes" | "20_plus_minutes"
  microcommitments?: Array<"understand" | "personalize" | "implement">
}

export type PersonalPlanQuizDraft = {
  screen: PersonalPlanQuizScreenId
  history: PersonalPlanQuizScreenId[]
  answers: PersonalPlanQuizAnswers
}

export const PERSONAL_PLAN_QUIZ_SCREEN_IDS = [
  "texture",
  "thickness",
  "density",
  "early_proof",
  "goals",
  "routine_clarity",
  "result_reliability",
  "adaptation_confidence",
  "current_problems",
  "analysis_bridge",
  "hair_length",
  "hair_surface",
  "elastic_response",
  "midpoint_profile",
  "chemical_treatments",
  "scalp_oiliness",
  "scalp_concerns",
  "admission_recurrence",
  "admission_conflict",
  "admission_practical_cost",
  "admission_emotional_relevance",
  "positive_reframe",
  "previous_attempts",
  "blockers",
  "routine_style",
  "meaningful_moment",
  "profile_summary",
  "daily_time",
  "plan_loading",
  "email_capture",
] as const

export type PersonalPlanQuizScreenId = (typeof PERSONAL_PLAN_QUIZ_SCREEN_IDS)[number]

export const PERSONAL_PLAN_QUIZ_VERSION = 2 as const
export const PERSONAL_PLAN_QUIZ_KIND = "personal_plan" as const

export type PersonalPlanQuizSubmissionEnvelope = {
  kind: typeof PERSONAL_PLAN_QUIZ_KIND
  version: typeof PERSONAL_PLAN_QUIZ_VERSION
  answers: PersonalPlanQuizAnswers
}
