import {
  DIAGNOSTIC_CONCERNS,
  DIAGNOSTIC_GOALS,
  type DiagnosticConcern,
  type DiagnosticGoal,
  type PersonalPlanDiagnosticInput,
} from "@/lib/quiz/diagnostic-input"

export const PERSONAL_PLAN_QUIZ_GOALS = DIAGNOSTIC_GOALS

export type PersonalPlanQuizGoal = DiagnosticGoal

export const PERSONAL_PLAN_QUIZ_CONCERNS = DIAGNOSTIC_CONCERNS

export type PersonalPlanQuizConcern = DiagnosticConcern

export type PersonalPlanQuizConcernRecurrence = {
  concernId: PersonalPlanQuizConcern
  frequency: "often" | "sometimes" | "rather_not"
}

/**
 * Durable V2 answers only. Conversion admissions, the daily-time commitment,
 * loading commitments, email, and consent intentionally live outside this type.
 */
export type PersonalPlanQuizAnswers = PersonalPlanDiagnosticInput & {
  routineClarity?: "clear" | "partial" | "trial_and_error" | "none"
  resultReliability?: "mostly" | "sometimes" | "rarely"
  adaptationConfidence?: "yes" | "partly" | "no"
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
  /** Optional, non-diagnostic detail captured alongside current concerns. */
  currentConcernsOtherText?: string
}

export type PersonalPlanQuizEphemeralState = {
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
  serverDraftId?: string
  serverRevision?: number
  browserGeneration?: number
}

export type PersonalPlanQuizServerSnapshot = {
  draftId: string
  draft: PersonalPlanQuizDraft
  revision: number
  browserGeneration: number
}

export type PersonalPlanQuizResumeBootstrap = {
  enabled: boolean
  snapshot: PersonalPlanQuizServerSnapshot | null
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

export const PERSONAL_PLAN_QUIZ_VERSION = 3 as const
export const PERSONAL_PLAN_QUIZ_KIND = "personal_plan" as const

export type PersonalPlanQuizSubmissionEnvelope = {
  kind: typeof PERSONAL_PLAN_QUIZ_KIND
  version: typeof PERSONAL_PLAN_QUIZ_VERSION
  answers: PersonalPlanQuizAnswers
}
