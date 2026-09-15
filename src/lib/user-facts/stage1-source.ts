import { canonicalizePersonalPlanAnswers } from "@/lib/personal-plan-quiz/persistence"

import type { DiagnosticsV1, QuizContextV1 } from "./schema"

export type ToStage1SourceInput = {
  diagnostics: DiagnosticsV1
  quizContext?: QuizContextV1 | null
  editedAt?: string | null
}

/** The 7 quiz-context fields the v3 envelope requires (`blockersOtherText` stays optional). */
const REQUIRED_V3_QUIZ_CONTEXT_FIELDS = [
  "routineClarity",
  "resultReliability",
  "adaptationConfidence",
  "previousAttempts",
  "blockers",
  "routineStyle",
  "meaningfulMoment",
] as const

type CompleteQuizContext = QuizContextV1 &
  Required<Pick<QuizContextV1, (typeof REQUIRED_V3_QUIZ_CONTEXT_FIELDS)[number]>>

function hasCompleteV3QuizContext(
  context: QuizContextV1 | null | undefined,
): context is CompleteQuizContext {
  if (!context) return false
  return REQUIRED_V3_QUIZ_CONTEXT_FIELDS.every((field) => context[field] !== undefined)
}

/**
 * Re-emits the Stage-1 source that Stage-1 hashes, from native-vocabulary facts (F26).
 *
 * - `editedAt` null/undefined: returns `diagnostics.source.raw` UNCHANGED (same key order,
 *   same arrays, same omitted-vs-empty arrays) — no re-canonicalisation.
 * - `editedAt` set: emits a native envelope instead.
 *   - A v3 envelope when `quizContext` carries all 7 required reflective answers (v2 is
 *     "promoted" to v3 the moment it is edited, since native diagnostics no longer
 *     distinguish v2 from v3 vocabulary).
 *   - A `legacy_quiz` source otherwise (legacy leads have no reflective quiz context).
 */
export function toStage1Source(input: ToStage1SourceInput): unknown {
  if (input.editedAt === null || input.editedAt === undefined) {
    // Deep-clone: `source.raw` is the same object every call for a given facts record, and
    // callers must not be able to corrupt it (or a later re-emission) by mutating what this
    // function hands back.
    return structuredClone(input.diagnostics.source.raw)
  }

  const { diagnostics, quizContext } = input

  if (hasCompleteV3QuizContext(quizContext)) {
    const answers = {
      texture: diagnostics.texture,
      thickness: diagnostics.thickness,
      density: diagnostics.density,
      goals: diagnostics.goals,
      currentConcerns: diagnostics.currentConcerns,
      ...(diagnostics.concernRecurrence
        ? { concernRecurrence: { ...diagnostics.concernRecurrence } }
        : {}),
      hairLength: diagnostics.hairLength,
      hairSurface: diagnostics.hairSurface,
      elasticResponse: diagnostics.elasticResponse,
      chemicalTreatments: diagnostics.chemicalTreatments,
      scalpOiliness: diagnostics.scalpOiliness,
      scalpConcerns: diagnostics.scalpConcerns,
      ...(diagnostics.currentConcernsOtherText
        ? { currentConcernsOtherText: diagnostics.currentConcernsOtherText }
        : {}),
      routineClarity: quizContext.routineClarity,
      resultReliability: quizContext.resultReliability,
      adaptationConfidence: quizContext.adaptationConfidence,
      previousAttempts: quizContext.previousAttempts,
      blockers: quizContext.blockers,
      routineStyle: quizContext.routineStyle,
      meaningfulMoment: quizContext.meaningfulMoment,
      ...(quizContext.blockersOtherText
        ? { blockersOtherText: quizContext.blockersOtherText }
        : {}),
    }
    // `canonicalizePersonalPlanAnswers` returns the finished `{kind, version, answers}`
    // envelope (it drops `currentConcernsOtherText` when blank and sorts every array); the
    // constructed `answers` above never carries a `source` key, so there is nothing to drop.
    return canonicalizePersonalPlanAnswers(answers)
  }

  // Legacy lead: no reflective quiz context to promote into a v3 envelope.
  return {
    kind: "legacy_quiz" as const,
    version: 1 as const,
    leadId: diagnostics.source.leadId,
    answers: {
      texture: diagnostics.texture,
      thickness: diagnostics.thickness,
      density: diagnostics.density,
      goals: [...diagnostics.goals].sort(),
      currentConcerns: [...diagnostics.currentConcerns].sort(),
      hairLength: diagnostics.hairLength,
      hairSurface: diagnostics.hairSurface,
      elasticResponse: diagnostics.elasticResponse,
      chemicalTreatments: [...diagnostics.chemicalTreatments].sort(),
      scalpOiliness: diagnostics.scalpOiliness,
      scalpConcerns: [...diagnostics.scalpConcerns].sort(),
    },
  }
}
