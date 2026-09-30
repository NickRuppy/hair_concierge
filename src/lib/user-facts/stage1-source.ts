import { canonicalizePersonalPlanAnswers } from "@/lib/personal-plan-quiz/persistence"

import {
  UnsupportedUserFactsSourceError,
  UserFactsIncompleteError,
  type DiagnosticsV1,
  type QuizContextV1,
} from "./schema"

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

/** The 11 diagnostic fields (7 scalars + 4 arrays) a native EDITED emission requires —
 * `diagnosticsV1Schema` made every one of these OPTIONAL for STORED diagnostics (controller
 * ruling 2026-09-15), so this is where completeness for an edited emission is checked instead
 * (task 4 fix round 1). `concernRecurrence`/`currentConcernsOtherText`/`source` stay excluded:
 * they were already optional before that ruling. */
const REQUIRED_STAGE1_DIAGNOSTIC_FIELDS = [
  "texture",
  "thickness",
  "density",
  "hairLength",
  "hairSurface",
  "elasticResponse",
  "scalpOiliness",
  "chemicalTreatments",
  "scalpConcerns",
  "goals",
  "currentConcerns",
] as const

type CompleteDiagnostics = DiagnosticsV1 &
  Required<Pick<DiagnosticsV1, (typeof REQUIRED_STAGE1_DIAGNOSTIC_FIELDS)[number]>>

function findMissingDiagnosticFields(diagnostics: DiagnosticsV1): string[] {
  return REQUIRED_STAGE1_DIAGNOSTIC_FIELDS.filter((field) => diagnostics[field] === undefined)
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
  // Backfill-only source (controller ruling 2026-09-15): a legacy-columns snapshot carries no
  // quiz envelope at all, so it can never be Stage-1-computable — neither unedited (there is
  // no verbatim envelope to re-emit) nor edited (there is no quiz context to promote from).
  if (input.diagnostics.source.kind === "legacy_columns") {
    throw new UnsupportedUserFactsSourceError(
      "toStage1Source: legacy_columns diagnostics have no quiz envelope to emit",
    )
  }

  if (input.editedAt === null || input.editedAt === undefined) {
    // Deep-clone: `source.raw` is the same object every call for a given facts record, and
    // callers must not be able to corrupt it (or a later re-emission) by mutating what this
    // function hands back.
    return structuredClone(input.diagnostics.source.raw)
  }

  const { diagnostics, quizContext } = input

  // Completeness for an EDITED emission is enforced here, before either branch below: raw
  // re-emission (above) needs no completeness, but synthesising a native envelope does, and
  // this is the exact boundary the controller ruling names (task 4 fix round 1).
  const missingFields = findMissingDiagnosticFields(diagnostics)
  if (missingFields.length > 0) {
    throw new UserFactsIncompleteError(
      `toStage1Source: diagnostics are missing required field(s) for an edited emission: ${missingFields.join(", ")}`,
      missingFields,
    )
  }
  const completeDiagnostics = diagnostics as CompleteDiagnostics

  if (hasCompleteV3QuizContext(quizContext)) {
    const answers = {
      texture: completeDiagnostics.texture,
      thickness: completeDiagnostics.thickness,
      density: completeDiagnostics.density,
      goals: completeDiagnostics.goals,
      currentConcerns: completeDiagnostics.currentConcerns,
      // `canonicalizePersonalPlanAnswers` drops a pick that is no longer one of
      // `currentConcerns` (main #611), exactly like the quiz's own submission path.
      ...(completeDiagnostics.primaryConcern
        ? { primaryConcern: completeDiagnostics.primaryConcern }
        : {}),
      ...(completeDiagnostics.concernRecurrence
        ? { concernRecurrence: { ...completeDiagnostics.concernRecurrence } }
        : {}),
      hairLength: completeDiagnostics.hairLength,
      hairSurface: completeDiagnostics.hairSurface,
      elasticResponse: completeDiagnostics.elasticResponse,
      chemicalTreatments: completeDiagnostics.chemicalTreatments,
      scalpOiliness: completeDiagnostics.scalpOiliness,
      scalpConcerns: completeDiagnostics.scalpConcerns,
      ...(completeDiagnostics.currentConcernsOtherText
        ? { currentConcernsOtherText: completeDiagnostics.currentConcernsOtherText }
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

  // Legacy lead: no reflective quiz context to promote into a v3 envelope. `completeDiagnostics`
  // is already verified complete by the guard above, so no `!` assertions are needed here.
  // `primaryConcern` is deliberately NOT emitted: `buildLegacyQuizStage1Source` does not carry
  // it, so an edited legacy emission must hash exactly like the built legacy source.
  return {
    kind: "legacy_quiz" as const,
    version: 1 as const,
    leadId: diagnostics.source.leadId,
    answers: {
      texture: completeDiagnostics.texture,
      thickness: completeDiagnostics.thickness,
      density: completeDiagnostics.density,
      goals: [...completeDiagnostics.goals].sort(),
      currentConcerns: [...completeDiagnostics.currentConcerns].sort(),
      hairLength: completeDiagnostics.hairLength,
      hairSurface: completeDiagnostics.hairSurface,
      elasticResponse: completeDiagnostics.elasticResponse,
      chemicalTreatments: [...completeDiagnostics.chemicalTreatments].sort(),
      scalpOiliness: completeDiagnostics.scalpOiliness,
      scalpConcerns: [...completeDiagnostics.scalpConcerns].sort(),
    },
  }
}
