import type { QuizAnswers } from "./types"
import { GOALS } from "@/lib/vocabulary/concerns-goals"

const MAX_GOALS = 5

export const QUIZ_STRUCTURE_VALUES = ["straight", "wavy", "curly", "coily"] as const
export const QUIZ_THICKNESS_VALUES = ["fine", "normal", "coarse"] as const
export const QUIZ_FINGERTEST_VALUES = ["glatt", "leicht_uneben", "rau"] as const
export const QUIZ_PULLTEST_VALUES = ["stretches_bounces", "stretches_stays", "snaps"] as const
export const QUIZ_SCALP_TYPE_VALUES = ["fettig", "ausgeglichen", "trocken"] as const
export const QUIZ_SCALP_CONDITION_VALUES = ["schuppen", "trockene_schuppen", "gereizt"] as const
export const QUIZ_CONCERN_VALUES = [
  "hair_damage",
  "split_ends",
  "breakage",
  "dryness",
  "frizz",
  "tangling",
] as const
export const QUIZ_TREATMENT_VALUES = ["natur", "gefaerbt", "blondiert"] as const

type StoredQuizAnswers = Partial<QuizAnswers> & {
  goals?: string[]
  scalp?: string
  pulltest?: string
  concerns?: string[]
  treatment?: string[]
}

const LEGACY_PULLTEST_MAP: Record<string, QuizAnswers["pulltest"]> = {
  elastisch: "stretches_bounces",
  ueberdehnt: "stretches_stays",
  bricht: "snaps",
}

function isAllowedValue<T extends readonly string[]>(
  value: unknown,
  allowed: T,
): value is T[number] {
  return typeof value === "string" && allowed.includes(value)
}

function sortTreatments(treatment: unknown): QuizAnswers["treatment"] | undefined {
  if (!Array.isArray(treatment)) return undefined

  const unique = QUIZ_TREATMENT_VALUES.filter((value) => treatment.includes(value))

  if (unique.length === 0) return undefined
  if (unique.includes("natur") && unique.length > 1) {
    return unique.filter((value) => value !== "natur")
  }

  return [...unique]
}

function sortConcerns(concerns: unknown): QuizAnswers["concerns"] | undefined {
  if (!Array.isArray(concerns)) return undefined

  const unique = QUIZ_CONCERN_VALUES.filter((value) => concerns.includes(value))

  if (unique.length === 0) return []

  return unique.slice(0, 3)
}

function normalizeConcernOtherText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined

  const trimmed = value.trim()
  if (trimmed.length === 0) return undefined

  return trimmed
}

function normalizeGoals(raw: unknown): QuizAnswers["goals"] {
  if (!Array.isArray(raw)) return undefined

  const allowed = new Set<string>(GOALS)
  const seen = new Set<string>()

  // Walk input in user-chosen order so first-seen wins for the volume↔less_volume
  // mutual exclusion and the max-5 cap. Then emit in canonical GOALS order so
  // semantically-equal selections compare equal in `findReusableLead` JSON dedupe.
  for (const value of raw) {
    if (typeof value !== "string") continue
    if (!allowed.has(value)) continue
    if (seen.has(value)) continue
    if (value === "less_volume" && seen.has("volume")) continue
    if (value === "volume" && seen.has("less_volume")) continue
    seen.add(value)
    if (seen.size >= MAX_GOALS) break
  }

  if (seen.size === 0) return undefined
  return GOALS.filter((g) => seen.has(g))
}

export function toggleTreatmentSelection(current: string[], value: string): string[] {
  if (!QUIZ_TREATMENT_VALUES.includes(value as (typeof QUIZ_TREATMENT_VALUES)[number])) {
    return current
  }

  const set = new Set(current)

  if (value === "natur") {
    if (set.has("natur")) {
      set.delete("natur")
    } else {
      set.clear()
      set.add("natur")
    }
    return sortTreatments([...set]) ?? []
  }

  set.delete("natur")

  if (set.has(value)) {
    set.delete(value)
  } else {
    set.add(value)
  }

  return sortTreatments([...set]) ?? []
}

export function toggleConcernSelection(
  current: string[],
  value: string,
): NonNullable<QuizAnswers["concerns"]> {
  if (value === "none") {
    return []
  }

  if (!QUIZ_CONCERN_VALUES.includes(value as (typeof QUIZ_CONCERN_VALUES)[number])) {
    return sortConcerns(current) ?? []
  }

  const set = new Set(current)

  if (set.has(value)) {
    set.delete(value)
  } else if (set.size < 3) {
    set.add(value)
  }

  return sortConcerns([...set]) ?? []
}

export function normalizeStoredQuizAnswers(
  raw: StoredQuizAnswers | Record<string, unknown> | null | undefined,
): QuizAnswers {
  const source = (raw ?? {}) as StoredQuizAnswers

  const pulltest = isAllowedValue(source.pulltest, QUIZ_PULLTEST_VALUES)
    ? source.pulltest
    : typeof source.pulltest === "string"
      ? LEGACY_PULLTEST_MAP[source.pulltest]
      : undefined

  let scalpType = isAllowedValue(source.scalp_type, QUIZ_SCALP_TYPE_VALUES)
    ? source.scalp_type
    : undefined
  let scalpCondition = isAllowedValue(source.scalp_condition, QUIZ_SCALP_CONDITION_VALUES)
    ? source.scalp_condition
    : undefined
  let hasScalpIssue =
    typeof source.has_scalp_issue === "boolean" ? source.has_scalp_issue : undefined

  if (!scalpType && typeof source.scalp === "string") {
    if (source.scalp === "fettig_schuppen") {
      scalpType = "fettig"
      scalpCondition = "schuppen"
      hasScalpIssue = true
    } else if (source.scalp === "unauffaellig") {
      scalpType = "ausgeglichen"
      hasScalpIssue = false
    } else if (isAllowedValue(source.scalp, QUIZ_SCALP_TYPE_VALUES)) {
      scalpType = source.scalp
      hasScalpIssue = false
    }
  }

  if (source.scalp_condition === "keine") {
    hasScalpIssue = false
    scalpCondition = undefined
  } else if (scalpCondition && hasScalpIssue !== false) {
    hasScalpIssue = true
  }

  if (hasScalpIssue === undefined && scalpType && !scalpCondition) {
    hasScalpIssue = false
  }

  if (hasScalpIssue === false) {
    scalpCondition = undefined
  }

  return {
    structure: isAllowedValue(source.structure, QUIZ_STRUCTURE_VALUES)
      ? source.structure
      : undefined,
    thickness: isAllowedValue(source.thickness, QUIZ_THICKNESS_VALUES)
      ? source.thickness
      : undefined,
    fingertest: isAllowedValue(source.fingertest, QUIZ_FINGERTEST_VALUES)
      ? source.fingertest
      : undefined,
    pulltest,
    scalp_type: scalpType,
    has_scalp_issue: hasScalpIssue,
    scalp_condition: scalpCondition,
    concerns: sortConcerns(source.concerns) ?? [],
    concerns_other_text: normalizeConcernOtherText(source.concerns_other_text),
    treatment: sortTreatments(source.treatment),
    goals: normalizeGoals(source.goals),
  }
}

export function canonicalizeQuizAnswers(answers: QuizAnswers): QuizAnswers {
  const normalized = {
    ...normalizeStoredQuizAnswers(answers),
    concerns: sortConcerns(answers.concerns),
    concerns_other_text: normalizeConcernOtherText(answers.concerns_other_text),
    treatment: sortTreatments(answers.treatment),
    goals: normalizeGoals(answers.goals),
  }

  if (normalized.has_scalp_issue !== true) {
    normalized.scalp_condition = undefined
  }

  return normalized
}

export function areQuizAnswersEqual(left: QuizAnswers, right: QuizAnswers): boolean {
  return (
    JSON.stringify(canonicalizeQuizAnswers(left)) === JSON.stringify(canonicalizeQuizAnswers(right))
  )
}
