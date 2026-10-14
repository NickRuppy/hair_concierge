import type { QuizAnswers, QuizStep } from "./types"
import { normalizeStoredQuizAnswers } from "./normalization"

export const QUIZ_DRAFT_STORAGE_KEY = "chaarlie:quiz-draft:v1"
export const QUIZ_DRAFT_TTL_MS = 1000 * 60 * 60 * 24 * 14

// v2 records the funnel package a draft's progress belongs to. v1 drafts (no
// package) still restore; they are organic progress by definition.
const QUIZ_DRAFT_VERSION = 2
const SUPPORTED_DRAFT_VERSIONS = new Set<number>([1, QUIZ_DRAFT_VERSION])
const HAIR_LENGTH_STEP: QuizStep = 15
const LEAD_CAPTURE_STEP: QuizStep = 9
const VALID_DRAFT_STEPS = new Set<QuizStep>([
  2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18,
])
const STEPS_AFTER_HAIR_LENGTH = new Set<QuizStep>([4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 17, 18])

export interface QuizDraft {
  version: typeof QUIZ_DRAFT_VERSION
  savedAt: number
  step: QuizStep
  answers: QuizAnswers
  /** Funnel package the saved progress belongs to; `null` = organic. */
  funnelPackageKey: string | null
}

interface StoredQuizDraft {
  version: number
  savedAt: number
  step: QuizStep
  answers: Record<string, unknown>
  funnelPackageKey?: unknown
}

interface QuizDraftInput {
  step: QuizStep
  answers: QuizAnswers
  funnelPackageKey?: string | null
}

function getBrowserStorage(): Storage | null {
  if (typeof window === "undefined") return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function getRestorableStep(step: QuizStep, answers?: QuizAnswers): QuizStep {
  if (answers && !answers.hair_length && STEPS_AFTER_HAIR_LENGTH.has(step)) {
    return HAIR_LENGTH_STEP
  }

  return step === 10 || step === 11 || step === 14 ? LEAD_CAPTURE_STEP : step
}

function normalizeDraftAnswers(raw: Record<string, unknown>): QuizAnswers {
  const normalized = normalizeStoredQuizAnswers(raw)
  const compact = Object.fromEntries(
    Object.entries(normalized).filter(([, value]) => value !== undefined),
  ) as QuizAnswers

  if (!Object.prototype.hasOwnProperty.call(raw, "concerns")) {
    delete compact.concerns
  }

  return compact
}

function isStoredQuizDraft(value: unknown): value is StoredQuizDraft {
  if (!value || typeof value !== "object") return false

  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.version === "number" &&
    SUPPORTED_DRAFT_VERSIONS.has(candidate.version) &&
    typeof candidate.savedAt === "number" &&
    typeof candidate.step === "number" &&
    VALID_DRAFT_STEPS.has(candidate.step as QuizStep) &&
    typeof candidate.answers === "object" &&
    candidate.answers !== null &&
    !Array.isArray(candidate.answers)
  )
}

export function saveQuizDraft(input: QuizDraftInput, storage = getBrowserStorage()) {
  if (!storage) return

  const draft: QuizDraft = {
    version: QUIZ_DRAFT_VERSION,
    savedAt: Date.now(),
    step: getRestorableStep(input.step, input.answers),
    answers: input.answers,
    funnelPackageKey: input.funnelPackageKey ?? null,
  }

  try {
    storage.setItem(QUIZ_DRAFT_STORAGE_KEY, JSON.stringify(draft))
  } catch {
    // Browser storage can be unavailable or full. Quiz navigation should still work.
  }
}

export function loadQuizDraft(storage = getBrowserStorage()): QuizDraft | null {
  if (!storage) return null

  let raw: string | null
  try {
    raw = storage.getItem(QUIZ_DRAFT_STORAGE_KEY)
  } catch {
    return null
  }

  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as unknown
    if (!isStoredQuizDraft(parsed)) {
      clearQuizDraft(storage)
      return null
    }

    if (Date.now() - parsed.savedAt > QUIZ_DRAFT_TTL_MS) {
      clearQuizDraft(storage)
      return null
    }

    const answers = normalizeDraftAnswers(parsed.answers)

    return {
      ...parsed,
      version: QUIZ_DRAFT_VERSION,
      step: getRestorableStep(parsed.step, answers),
      answers,
      funnelPackageKey:
        typeof parsed.funnelPackageKey === "string" ? parsed.funnelPackageKey : null,
    }
  } catch {
    clearQuizDraft(storage)
    return null
  }
}

export function clearQuizDraft(storage = getBrowserStorage()) {
  try {
    storage?.removeItem(QUIZ_DRAFT_STORAGE_KEY)
  } catch {
    // Ignore unavailable browser storage.
  }
}
