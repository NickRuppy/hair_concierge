import { normalizeStoredQuizAnswers } from "./normalization"
import { QUIZ_QUESTION_STEPS } from "./questions"
import type { QuizAnswers, QuizStep } from "./types"

export const MIGRATION_QUIZ_CONTEXT_ENDPOINT = "/api/personal-plan/migration-quiz-context"
export const MIGRATION_LEAD_CAPTURE_NEXT_HREF = "/plan-bereit"

export type MigrationQuizContextPayload =
  | { status: "inactive" }
  | { status: "recover" }
  | { status: "unavailable" }
  | { status: "fresh_blank" }
  | { status: "prefill"; answers: QuizAnswers }

export type MigrationQuizPrefillState =
  | { status: "ignore" }
  | { status: "recover" }
  | { status: "unavailable" }
  | { status: "fresh_blank" }
  | { status: "prefill"; step: QuizStep; answers: QuizAnswers }

export function parseMigrationQuizContextPayload(value: unknown): MigrationQuizContextPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { status: "unavailable" }
  const row = value as Record<string, unknown>
  if (row.status === "recover") return { status: "recover" }
  if (row.status === "unavailable") return { status: "unavailable" }
  if (row.status === "fresh_blank") return { status: "fresh_blank" }
  if (row.status === "prefill" && isRecord(row.answers)) {
    return { status: "prefill", answers: normalizeMigrationQuizPrefillAnswers(row.answers) }
  }
  return { status: "unavailable" }
}

export function isMigrationQuizRecoverySearch(search: string): boolean {
  const params = new URLSearchParams(search)
  return (
    params.get("mode") === "retake" && params.get("returnTo") === MIGRATION_LEAD_CAPTURE_NEXT_HREF
  )
}

export function fallbackMigrationQuizContextPayload(
  migrationRecoveryIntent: boolean,
): MigrationQuizContextPayload {
  return migrationRecoveryIntent ? { status: "unavailable" } : { status: "inactive" }
}

export function normalizeMigrationQuizPrefillAnswers(raw: Record<string, unknown>): QuizAnswers {
  const answers = compactAnswers(normalizeStoredQuizAnswers(raw))
  if (!Array.isArray(raw.concerns)) delete answers.concerns
  if (!Array.isArray(raw.treatment)) delete answers.treatment
  if (!Array.isArray(raw.goals)) delete answers.goals
  return answers
}

export function deriveMigrationQuizPrefillState(input: {
  currentStep: QuizStep
  currentAnswers: QuizAnswers
  payload: MigrationQuizContextPayload
}): MigrationQuizPrefillState {
  if (input.payload.status === "recover") return { status: "recover" }
  if (input.payload.status === "unavailable") return { status: "unavailable" }
  if (input.currentStep !== 2 || Object.keys(input.currentAnswers).length > 0) {
    return { status: "ignore" }
  }
  if (input.payload.status === "fresh_blank") return { status: "fresh_blank" }
  if (input.payload.status !== "prefill") return { status: "ignore" }
  return {
    status: "prefill",
    step: firstMissingQuestionStep(input.payload.answers),
    answers: input.payload.answers,
  }
}

export function resolveLeadCaptureServerNextHref(
  value: unknown,
): typeof MIGRATION_LEAD_CAPTURE_NEXT_HREF | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return (value as Record<string, unknown>).nextHref === MIGRATION_LEAD_CAPTURE_NEXT_HREF
    ? MIGRATION_LEAD_CAPTURE_NEXT_HREF
    : null
}

export function resolveLeadCaptureRecoveryNextHref(
  response: { ok: boolean; status: number },
  value: unknown,
): typeof MIGRATION_LEAD_CAPTURE_NEXT_HREF | null {
  if (!response.ok && response.status === 403) return resolveLeadCaptureServerNextHref(value)
  return null
}

function firstMissingQuestionStep(answers: QuizAnswers): QuizStep {
  for (const step of QUIZ_QUESTION_STEPS) {
    if (!isStepAnswered(step, answers)) return step
  }
  return 9
}

function isStepAnswered(step: QuizStep, answers: QuizAnswers): boolean {
  switch (step) {
    case 2:
      return typeof answers.structure === "string"
    case 3:
      return typeof answers.thickness === "string"
    case 13:
      return typeof answers.density === "string"
    case 15:
      return typeof answers.hair_length === "string"
    case 4:
      return typeof answers.fingertest === "string"
    case 5:
      return typeof answers.pulltest === "string"
    case 7:
      return Array.isArray(answers.treatment) && answers.treatment.length > 0
    case 6:
      return (
        typeof answers.scalp_type === "string" &&
        typeof answers.has_scalp_issue === "boolean" &&
        (answers.has_scalp_issue === false || typeof answers.scalp_condition === "string")
      )
    case 8:
      return Array.isArray(answers.concerns)
    case 12:
      return Array.isArray(answers.goals) && answers.goals.length > 0
    default:
      return false
  }
}

function compactAnswers(answers: QuizAnswers): QuizAnswers {
  return Object.fromEntries(
    Object.entries(answers).filter(([, value]) => value !== undefined),
  ) as QuizAnswers
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}
