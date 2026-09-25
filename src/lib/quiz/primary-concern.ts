import { QUIZ_ANSWER_CONCERN_VALUES, QUIZ_CONCERN_VALUES } from "./normalization"
import type { QuizAnswers } from "./types"

/**
 * The main problem she STATED (discovery batch 7, F1; plan Rev. 3 §1.1). With two or
 * more concerns selected the quiz asks „Wenn du dich auf eins konzentrieren müsstest –
 * was stört dich am meisten?"; with exactly one, that one is the main problem.
 *
 * The inferred weight ranking this replaces is retired (ruling F1.2): no statement → no
 * main problem, and every consumer falls back to neutral copy instead of claiming she
 * said something. Everything here runs on the RAW quiz vocabulary — the legacy
 * projection drops `low_shine`, `lost_shape`, `low_volume_or_weighed_down` and would
 * turn two raw concerns into one.
 */

export type QuizAnswerConcern = (typeof QUIZ_ANSWER_CONCERN_VALUES)[number]
/** The six-code vocabulary the need lane (and its copy) was built on. */
export type LegacyQuizConcern = (typeof QUIZ_CONCERN_VALUES)[number]

const LEGACY_ALIASES: Partial<Record<QuizAnswerConcern, LegacyQuizConcern>> = {
  dry_lengths: "dryness",
  frizz_flyaways: "frizz",
}

function isQuizAnswerConcern(value: unknown): value is QuizAnswerConcern {
  return (
    typeof value === "string" && (QUIZ_ANSWER_CONCERN_VALUES as readonly string[]).includes(value)
  )
}

/** The pick sheet opens only when there is something to choose between. */
export function requiresPrimaryConcernPick(concerns: readonly string[]): boolean {
  return concerns.length >= 2
}

/** A pick is only valid while it is one of her selected concerns; a stale one is dropped. */
export function reconcilePrimaryConcern<T extends string>(
  concerns: readonly string[],
  primaryConcern: T | undefined,
): T | undefined {
  return primaryConcern !== undefined && concerns.includes(primaryConcern)
    ? primaryConcern
    : undefined
}

export function resolveStatedPrimaryConcern(
  answers: Pick<QuizAnswers, "concerns" | "primary_concern">,
): QuizAnswerConcern | null {
  const concerns = [...new Set((answers.concerns ?? []).filter(isQuizAnswerConcern))]
  const picked = answers.primary_concern
  if (isQuizAnswerConcern(picked) && concerns.includes(picked)) return picked
  return concerns.length === 1 ? concerns[0] : null
}

/** Legacy-mappable concerns only; the four newer codes have no legacy equivalent. */
export function toLegacyQuizConcern(concern: QuizAnswerConcern | null): LegacyQuizConcern | null {
  if (!concern) return null
  if ((QUIZ_CONCERN_VALUES as readonly string[]).includes(concern)) {
    return concern as LegacyQuizConcern
  }
  return LEGACY_ALIASES[concern] ?? null
}
