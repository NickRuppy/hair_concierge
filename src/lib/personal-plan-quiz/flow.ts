import type { PersonalPlanQuizAnswers, PersonalPlanQuizScreenId } from "./types"

export type PersonalPlanQuizTransitionDirection = "forward" | "back"

export function getPersonalPlanQuizTransitionDirection(
  action: "advance" | "return",
): PersonalPlanQuizTransitionDirection {
  return action === "return" ? "back" : "forward"
}

export type PersonalPlanConflictPrompt = {
  id:
    | "oily_roots_dry_lengths"
    | "care_without_weight"
    | "care_without_losing_volume"
    | "definition_without_dryness"
    | "strength_without_stiffness"
  question: string
  options: readonly [
    { value: "often"; label: string },
    { value: "sometimes"; label: string },
    { value: "rather_not"; label: string },
  ]
}

const FREQUENCY_OPTIONS = [
  { value: "often", label: "Ja, häufig" },
  { value: "sometimes", label: "Manchmal" },
  { value: "rather_not", label: "Eher nicht" },
] as const

const ASPIRATION_OPTIONS = [
  { value: "often", label: "Ja, sehr" },
  { value: "sometimes", label: "Etwas" },
  { value: "rather_not", label: "Eher nicht" },
] as const

function hasDrynessNeed(answers: PersonalPlanQuizAnswers): boolean {
  return (
    answers.goals?.some((goal) => goal === "moisture" || goal === "frizz_surface") === true ||
    answers.currentConcerns?.some(
      (concern) => concern === "dry_lengths" || concern === "frizz_flyaways",
    ) === true ||
    answers.hairSurface === "rough"
  )
}

export function derivePersonalPlanConflictPrompt(
  answers: PersonalPlanQuizAnswers,
): PersonalPlanConflictPrompt | null {
  if (answers.scalpOiliness === "oily" && hasDrynessNeed(answers)) {
    return {
      id: "oily_roots_dry_lengths",
      question: "Wird dein Ansatz schnell fettig, während deine Längen trocken bleiben?",
      options: FREQUENCY_OPTIONS,
    }
  }

  if (answers.thickness === "fine" && hasDrynessNeed(answers)) {
    return {
      id: "care_without_weight",
      question: "Braucht dein Haar Pflege, wirkt damit aber schnell schwer?",
      options: FREQUENCY_OPTIONS,
    }
  }

  if (answers.goals?.includes("volume_balance") && hasDrynessNeed(answers)) {
    return {
      id: "care_without_losing_volume",
      question: "Wünschst du dir mehr Pflege, ohne Volumen und Leichtigkeit zu verlieren?",
      options: ASPIRATION_OPTIONS,
    }
  }

  if (
    (answers.texture === "curly" || answers.texture === "coily") &&
    (answers.goals?.includes("shape_definition") || answers.currentConcerns?.includes("lost_shape"))
  ) {
    return {
      id: "definition_without_dryness",
      question: "Wünschst du dir Definition, ohne dass dein Haar trocken oder fest wirkt?",
      options: ASPIRATION_OPTIONS,
    }
  }

  const hasTreatment =
    answers.chemicalTreatments?.some((treatment) => treatment !== "natural") === true
  const hasStrengthNeed =
    answers.goals?.includes("strength_ends") ||
    answers.currentConcerns?.some(
      (concern) => concern === "breakage" || concern === "split_ends",
    ) ||
    answers.elasticResponse === "snaps"
  if (hasTreatment && hasStrengthNeed) {
    return {
      id: "strength_without_stiffness",
      question: "Möchtest du dein Haar stärken, ohne dass es an Geschmeidigkeit verliert?",
      options: ASPIRATION_OPTIONS,
    }
  }

  return null
}

const PRIMARY_SEQUENCE: PersonalPlanQuizScreenId[] = [
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
]

export function getNextPersonalPlanQuizScreen(
  screen: PersonalPlanQuizScreenId,
  answers: PersonalPlanQuizAnswers,
): PersonalPlanQuizScreenId | null {
  if (screen === "admission_recurrence") {
    return derivePersonalPlanConflictPrompt(answers)
      ? "admission_conflict"
      : "admission_practical_cost"
  }
  if (screen === "admission_conflict") return "admission_practical_cost"

  if (screen === "scalp_concerns" && !answers.currentConcerns?.length) {
    return derivePersonalPlanConflictPrompt(answers)
      ? "admission_conflict"
      : "admission_practical_cost"
  }

  const index = PRIMARY_SEQUENCE.indexOf(screen)
  return index === -1 ? null : (PRIMARY_SEQUENCE[index + 1] ?? null)
}

export function appendPersonalPlanQuizHistory(
  history: PersonalPlanQuizScreenId[],
  screen: PersonalPlanQuizScreenId,
): PersonalPlanQuizScreenId[] {
  return history.at(-1) === screen ? history : [...history, screen]
}

export type PersonalPlanQuizSectionId =
  | "hair_profile"
  | "goals_and_context"
  | "analysis"
  | "plan_direction"
  | "completion"

const SCREEN_SECTIONS: Record<PersonalPlanQuizScreenId, PersonalPlanQuizSectionId> = {
  texture: "hair_profile",
  thickness: "hair_profile",
  density: "hair_profile",
  early_proof: "goals_and_context",
  goals: "goals_and_context",
  routine_clarity: "goals_and_context",
  result_reliability: "goals_and_context",
  adaptation_confidence: "goals_and_context",
  current_problems: "goals_and_context",
  analysis_bridge: "analysis",
  hair_length: "analysis",
  hair_surface: "analysis",
  elastic_response: "analysis",
  midpoint_profile: "analysis",
  chemical_treatments: "analysis",
  scalp_oiliness: "analysis",
  scalp_concerns: "analysis",
  admission_recurrence: "analysis",
  admission_conflict: "analysis",
  admission_practical_cost: "analysis",
  admission_emotional_relevance: "analysis",
  positive_reframe: "plan_direction",
  previous_attempts: "plan_direction",
  blockers: "plan_direction",
  routine_style: "plan_direction",
  meaningful_moment: "plan_direction",
  profile_summary: "plan_direction",
  daily_time: "completion",
  plan_loading: "completion",
  email_capture: "completion",
}

export function getPersonalPlanQuizSectionId(
  screen: PersonalPlanQuizScreenId,
): PersonalPlanQuizSectionId {
  return SCREEN_SECTIONS[screen]
}
