import type { QuizAnswers } from "./types"

export const QUIZ_STRUCTURE_VALUES = ["straight", "wavy", "curly", "coily"] as const
export const QUIZ_THICKNESS_VALUES = ["fine", "normal", "coarse"] as const
export const QUIZ_FINGERTEST_VALUES = ["glatt", "leicht_uneben", "rau"] as const
export const QUIZ_PULLTEST_VALUES = [
  "stretches_bounces",
  "stretches_stays",
  "snaps",
] as const
export const QUIZ_SCALP_TYPE_VALUES = ["fettig", "ausgeglichen", "trocken"] as const
export const QUIZ_SCALP_CONDITION_VALUES = [
  "keine",
  "schuppen",
  "trockene_schuppen",
  "gereizt",
] as const
export const QUIZ_TREATMENT_VALUES = ["natur", "gefaerbt", "blondiert"] as const

type StoredQuizAnswers = Partial<QuizAnswers> & {
  goals?: string[]
  scalp?: string
  pulltest?: string
  treatment?: string[]
}

const LEGACY_PULLTEST_MAP: Record<string, QuizAnswers["pulltest"]> = {
  elastisch: "stretches_bounces",
  ueberdehnt: "stretches_stays",
  bricht: "snaps",
}

function isAllowedValue<T extends readonly string[]>(
  value: unknown,
  allowed: T
): value is T[number] {
  return typeof value === "string" && allowed.includes(value)
}

function sortTreatments(treatment: unknown): QuizAnswers["treatment"] | undefined {
  if (!Array.isArray(treatment)) return undefined

  const unique = QUIZ_TREATMENT_VALUES.filter((value) =>
    treatment.includes(value)
  )

  if (unique.length === 0) return undefined
  if (unique.includes("natur") && unique.length > 1) {
    return unique.filter((value) => value !== "natur")
  }

  return [...unique]
}

export function toggleTreatmentSelection(
  current: string[],
  value: string
): string[] {
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

export function normalizeStoredQuizAnswers(raw: StoredQuizAnswers | Record<string, unknown> | null | undefined): QuizAnswers {
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

  if (!scalpType && typeof source.scalp === "string") {
    if (source.scalp === "fettig_schuppen") {
      scalpType = "fettig"
      scalpCondition = "schuppen"
    } else if (source.scalp === "unauffaellig") {
      scalpType = "ausgeglichen"
      scalpCondition = "keine"
    } else if (isAllowedValue(source.scalp, QUIZ_SCALP_TYPE_VALUES)) {
      scalpType = source.scalp
      scalpCondition = "keine"
    }
  }

  if (scalpType && !scalpCondition) {
    scalpCondition = "keine"
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
    scalp_condition: scalpCondition,
    treatment: sortTreatments(source.treatment),
  }
}

export function canonicalizeQuizAnswers(answers: QuizAnswers): QuizAnswers {
  return {
    ...normalizeStoredQuizAnswers(answers),
    treatment: sortTreatments(answers.treatment),
  }
}

export function areQuizAnswersEqual(left: QuizAnswers, right: QuizAnswers): boolean {
  return JSON.stringify(canonicalizeQuizAnswers(left)) === JSON.stringify(canonicalizeQuizAnswers(right))
}
