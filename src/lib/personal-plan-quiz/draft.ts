import {
  PERSONAL_PLAN_QUIZ_CONCERNS,
  PERSONAL_PLAN_QUIZ_GOALS,
  PERSONAL_PLAN_QUIZ_SCREEN_IDS,
  type PersonalPlanQuizAnswers,
  type PersonalPlanQuizDraft,
  type PersonalPlanQuizScreenId,
} from "./types"

export const PERSONAL_PLAN_QUIZ_DRAFT_STORAGE_KEY = "chaarlie:personal-plan-quiz-draft:v4"
export const PERSONAL_PLAN_PREPARED_PLAN_STORAGE_KEY = "chaarlie:personal-plan-quiz-prepared:v1"
const DRAFT_VERSION = 4

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">

const screenSet = new Set<string>(PERSONAL_PLAN_QUIZ_SCREEN_IDS)

function stringValue(value: unknown, allowed: readonly string[]): string | undefined {
  return typeof value === "string" && allowed.includes(value) ? value : undefined
}

function stringList(value: unknown, allowed: readonly string[]): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const selected = new Set(value.filter((item): item is string => typeof item === "string"))
  const canonical = allowed.filter((item) => selected.has(item))
  return canonical.length ? canonical : undefined
}

function nonNegativeSafeInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : undefined
}

function uuidValue(value: unknown): string | undefined {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : undefined
}

export function sanitizePersonalPlanQuizAnswers(value: unknown): PersonalPlanQuizAnswers {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  const input = value as Record<string, unknown>
  const answers: PersonalPlanQuizAnswers = {}
  const singleFields = {
    texture: ["straight", "wavy", "curly", "coily"],
    thickness: ["fine", "normal", "coarse"],
    density: ["low", "medium", "high"],
    routineClarity: ["clear", "partial", "trial_and_error", "none"],
    resultReliability: ["mostly", "sometimes", "rarely"],
    adaptationConfidence: ["yes", "partly", "no"],
    hairLength: ["very_short", "short", "medium", "long", "very_long"],
    hairSurface: ["smooth", "slightly_uneven", "rough"],
    elasticResponse: ["stretches_bounces", "stretches_stays", "snaps"],
    scalpOiliness: ["oily", "balanced", "dry"],
    previousAttempts: [
      "nothing_reliably_worked",
      "some_steps_helped",
      "little_targeted_trial",
      "mostly_works",
    ],
    routineStyle: [
      "simple_reliable",
      "intentional_caring",
      "flexible_versatile",
      "precise_goal_oriented",
    ],
    meaningfulMoment: ["everyday", "work", "social", "going_out", "special_occasions"],
  } as const
  for (const [key, allowed] of Object.entries(singleFields)) {
    const parsed = stringValue(input[key], allowed)
    if (parsed) Object.assign(answers, { [key]: parsed })
  }

  const lists = {
    goals: PERSONAL_PLAN_QUIZ_GOALS,
    chemicalTreatments: ["natural", "colored", "lightened", "permed", "chemically_straightened"],
    blockers: [
      "conflicting_tips",
      "product_fit",
      "application_uncertainty",
      "different_scalp_and_lengths",
      "routine_too_complex",
      "time_and_cost",
      "consistency",
      "other",
    ],
  } as const
  for (const [key, allowed] of Object.entries(lists)) {
    const parsed = stringList(input[key], allowed)
    if (parsed?.length) Object.assign(answers, { [key]: parsed })
  }

  if (Array.isArray(input.currentConcerns)) {
    const currentConcerns = stringList(input.currentConcerns, PERSONAL_PLAN_QUIZ_CONCERNS)
    answers.currentConcerns = (currentConcerns ?? []) as PersonalPlanQuizAnswers["currentConcerns"]
  }

  if (
    input.concernRecurrence &&
    typeof input.concernRecurrence === "object" &&
    !Array.isArray(input.concernRecurrence)
  ) {
    const recurrence = input.concernRecurrence as Record<string, unknown>
    const concernId = stringValue(recurrence.concernId, PERSONAL_PLAN_QUIZ_CONCERNS)
    const frequency = stringValue(recurrence.frequency, ["often", "sometimes", "rather_not"])
    if (concernId && frequency && answers.currentConcerns?.includes(concernId as never)) {
      answers.concernRecurrence = {
        concernId: concernId as NonNullable<
          PersonalPlanQuizAnswers["concernRecurrence"]
        >["concernId"],
        frequency: frequency as NonNullable<
          PersonalPlanQuizAnswers["concernRecurrence"]
        >["frequency"],
      }
    }
  }

  if (Array.isArray(input.scalpConcerns)) {
    const scalpConcerns = stringList(input.scalpConcerns, [
      "oily_dandruff",
      "dry_dandruff",
      "irritated",
    ])
    answers.scalpConcerns = (scalpConcerns ?? []) as PersonalPlanQuizAnswers["scalpConcerns"]
  }

  if (typeof input.blockersOtherText === "string") {
    const trimmed = input.blockersOtherText.trim().slice(0, 280)
    if (trimmed) answers.blockersOtherText = trimmed
  }

  if (typeof input.currentConcernsOtherText === "string") {
    const trimmed = input.currentConcernsOtherText.trim().slice(0, 50)
    if (trimmed) answers.currentConcernsOtherText = trimmed
  }

  if (answers.chemicalTreatments?.includes("natural") && answers.chemicalTreatments.length > 1) {
    answers.chemicalTreatments = ["natural"]
  }

  return answers
}

export function getPersonalPlanQuizAnswersKey(value: unknown): string {
  return JSON.stringify(sanitizePersonalPlanQuizAnswers(value))
}

export function savePersonalPlanQuizDraft(
  draft: PersonalPlanQuizDraft,
  storage: StorageLike,
): void {
  const history = draft.history.filter((screen) => screenSet.has(screen))
  const serverDraftId = uuidValue(draft.serverDraftId)
  const serverRevision = nonNegativeSafeInteger(draft.serverRevision)
  const browserGeneration = nonNegativeSafeInteger(draft.browserGeneration)
  try {
    storage.setItem(
      PERSONAL_PLAN_QUIZ_DRAFT_STORAGE_KEY,
      JSON.stringify({
        version: DRAFT_VERSION,
        screen: draft.screen,
        history,
        answers: sanitizePersonalPlanQuizAnswers(draft.answers),
        ...(serverDraftId ? { serverDraftId } : {}),
        ...(serverRevision !== undefined ? { serverRevision } : {}),
        ...(browserGeneration !== undefined ? { browserGeneration } : {}),
      }),
    )
  } catch {
    // Draft persistence is optional. The active React session remains usable.
  }
}

export function loadPersonalPlanQuizDraft(storage: StorageLike): PersonalPlanQuizDraft | null {
  try {
    const raw = storage.getItem(PERSONAL_PLAN_QUIZ_DRAFT_STORAGE_KEY)
    if (!raw) return null
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== "object" || Array.isArray(value)) return null
    const draft = value as Record<string, unknown>
    if (
      draft.version !== DRAFT_VERSION ||
      typeof draft.screen !== "string" ||
      !screenSet.has(draft.screen)
    ) {
      return null
    }
    const history = Array.isArray(draft.history)
      ? draft.history.filter(
          (item): item is PersonalPlanQuizScreenId =>
            typeof item === "string" && screenSet.has(item),
        )
      : []
    const answers = sanitizePersonalPlanQuizAnswers(draft.answers)
    const serverDraftId = uuidValue(draft.serverDraftId)
    const serverRevision = nonNegativeSafeInteger(draft.serverRevision)
    const browserGeneration = nonNegativeSafeInteger(draft.browserGeneration)
    const rawAnswers =
      draft.answers && typeof draft.answers === "object" && !Array.isArray(draft.answers)
        ? (draft.answers as Record<string, unknown>)
        : {}
    const screen = draft.screen as PersonalPlanQuizScreenId
    const elasticScreenIndex = PERSONAL_PLAN_QUIZ_SCREEN_IDS.indexOf("elastic_response")
    const currentScreenIndex = PERSONAL_PLAN_QUIZ_SCREEN_IDS.indexOf(screen)
    const hasStaleElasticityOptOut = rawAnswers.elasticResponse === "unknown"

    if (hasStaleElasticityOptOut && currentScreenIndex >= elasticScreenIndex) {
      const elasticHistoryIndex = history.indexOf("elastic_response")
      return {
        screen: "elastic_response",
        history: elasticHistoryIndex === -1 ? history : history.slice(0, elasticHistoryIndex),
        answers,
        ...(serverDraftId ? { serverDraftId } : {}),
        ...(serverRevision !== undefined ? { serverRevision } : {}),
        ...(browserGeneration !== undefined ? { browserGeneration } : {}),
      }
    }

    return {
      screen,
      history,
      answers,
      ...(serverDraftId ? { serverDraftId } : {}),
      ...(serverRevision !== undefined ? { serverRevision } : {}),
      ...(browserGeneration !== undefined ? { browserGeneration } : {}),
    }
  } catch {
    return null
  }
}

export function clearPersonalPlanQuizDraft(storage: StorageLike): boolean {
  try {
    storage.removeItem(PERSONAL_PLAN_QUIZ_DRAFT_STORAGE_KEY)
    return true
  } catch {
    // Storage can be unavailable in private or restricted browser contexts.
    return false
  }
}

export function clearPersonalPlanPreparedPlanClaim(storage: StorageLike): boolean {
  try {
    storage.removeItem(PERSONAL_PLAN_PREPARED_PLAN_STORAGE_KEY)
    return true
  } catch {
    // Storage can be unavailable in private or restricted browser contexts.
    return false
  }
}
