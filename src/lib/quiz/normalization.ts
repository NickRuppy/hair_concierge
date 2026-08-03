import type { QuizAnswers } from "./types"
import { HAIR_LENGTHS } from "@/lib/vocabulary"
import { GOALS } from "@/lib/vocabulary/concerns-goals"
import { PROFILE_CONCERNS, type Goal, type ProfileConcern } from "@/lib/vocabulary"
import { DIAGNOSTIC_CONCERNS, DIAGNOSTIC_GOALS } from "./diagnostic-input"

export const QUIZ_STRUCTURE_VALUES = ["straight", "wavy", "curly", "coily"] as const
export const QUIZ_THICKNESS_VALUES = ["fine", "normal", "coarse"] as const
export const QUIZ_DENSITY_VALUES = ["low", "medium", "high"] as const
export const QUIZ_HAIR_LENGTH_VALUES = HAIR_LENGTHS
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
/** Full allowed set for new starts plus historical stored values. */
export const QUIZ_ANSWER_CONCERN_VALUES = [
  ...QUIZ_CONCERN_VALUES,
  ...DIAGNOSTIC_CONCERNS.filter((value) => !QUIZ_CONCERN_VALUES.includes(value as never)),
] as const
export const QUIZ_TREATMENT_VALUES = [
  "natur",
  "gefaerbt",
  "blondiert",
  "dauerwelle",
  "chemisch_geglaettet",
] as const

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

export const QUIZ_GOAL_VALUES = [
  ...GOALS,
  ...DIAGNOSTIC_GOALS.filter((value) => !GOALS.includes(value as never)),
] as const

function sortConcerns(concerns: unknown): QuizAnswers["concerns"] | undefined {
  if (!Array.isArray(concerns)) return undefined

  const unique = QUIZ_ANSWER_CONCERN_VALUES.filter((value) => concerns.includes(value))

  if (unique.length === 0) return []

  return unique
}

function normalizeConcernOtherText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined

  const trimmed = value.trim()
  if (trimmed.length === 0) return undefined

  return trimmed
}

function normalizeGoals(raw: unknown): QuizAnswers["goals"] {
  if (!Array.isArray(raw)) return undefined

  const allowed = new Set<string>(QUIZ_GOAL_VALUES)
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
  }

  if (seen.size === 0) return undefined
  return QUIZ_GOAL_VALUES.filter((g) => seen.has(g))
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

  if (!QUIZ_ANSWER_CONCERN_VALUES.includes(value as (typeof QUIZ_ANSWER_CONCERN_VALUES)[number])) {
    return sortConcerns(current) ?? []
  }

  const set = new Set(current)

  if (set.has(value)) {
    set.delete(value)
  } else {
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
    density: isAllowedValue(source.density, QUIZ_DENSITY_VALUES) ? source.density : undefined,
    hair_length: isAllowedValue(source.hair_length, QUIZ_HAIR_LENGTH_VALUES)
      ? source.hair_length
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

/**
 * Compatibility boundary for established profile, routine and Customer.io
 * consumers. New quiz-only families deliberately do not become onboarding
 * options; unavailable historical equivalents are omitted rather than guessed.
 */
export function projectQuizAnswersToLegacyVocabulary(answers: QuizAnswers): {
  concerns: ProfileConcern[]
  goals: Goal[]
} {
  const concernMap: Partial<Record<string, ProfileConcern>> = {
    hair_damage: "hair_damage",
    breakage: "breakage",
    split_ends: "split_ends",
    dryness: "dryness",
    dry_lengths: "dryness",
    frizz: "frizz",
    frizz_flyaways: "frizz",
    tangling: "tangling",
  }
  const hasFineOrLowDensity = answers.thickness === "fine" || answers.density === "low"
  const hasControlSignal =
    answers.thickness === "coarse" ||
    answers.density === "high" ||
    answers.structure === "wavy" ||
    answers.structure === "curly" ||
    answers.structure === "coily"
  const goalMap: Partial<Record<string, Goal>> = {
    moisture: "moisture",
    frizz_surface: "less_frizz",
    less_frizz: "less_frizz",
    shine: "shine",
    shape_definition: "curl_definition",
    curl_definition: "curl_definition",
    strength_ends: "anti_breakage",
    anti_breakage: "anti_breakage",
    less_split_ends: "less_split_ends",
    scalp_balance: "healthy_scalp",
    healthy_scalp: "healthy_scalp",
    manageability_styling: "less_frizz",
    volume: "volume",
    less_volume: "less_volume",
    healthier_hair: "healthier_hair",
    color_protection: "color_protection",
    strengthen: "strengthen",
  }
  const projectedGoals = new Set<Goal>()
  for (const value of answers.goals ?? []) {
    if (value === "volume_balance") {
      // The neutral user-facing family only receives a directional legacy goal
      // when factual signals support one; it never claims the opposite result.
      if (hasFineOrLowDensity) projectedGoals.add("volume")
      else if (hasControlSignal) projectedGoals.add("less_volume")
      continue
    }
    const mapped = goalMap[value]
    if (mapped) projectedGoals.add(mapped)
  }
  if (projectedGoals.has("volume") && projectedGoals.has("less_volume")) {
    projectedGoals.delete(hasFineOrLowDensity ? "less_volume" : "volume")
  }

  const projectedConcerns = new Set<ProfileConcern>()
  for (const value of answers.concerns ?? []) {
    const mapped = concernMap[value]
    if (mapped) projectedConcerns.add(mapped)
  }
  return {
    concerns: PROFILE_CONCERNS.filter((value) => projectedConcerns.has(value)),
    goals: GOALS.filter((value) => projectedGoals.has(value)),
  }
}

/**
 * Supplies established narrative, routine and email builders with their
 * original vocabulary while retaining every factual answer unchanged.
 */
export function projectQuizAnswersForLegacyConsumers(answers: QuizAnswers): QuizAnswers {
  const normalized = canonicalizeQuizAnswers(answers)
  const legacyVocabulary = projectQuizAnswersToLegacyVocabulary(normalized)

  return {
    ...normalized,
    concerns: legacyVocabulary.concerns,
    goals: legacyVocabulary.goals,
  }
}

export function areQuizAnswersEqual(left: QuizAnswers, right: QuizAnswers): boolean {
  return (
    JSON.stringify(canonicalizeQuizAnswers(left)) === JSON.stringify(canonicalizeQuizAnswers(right))
  )
}
