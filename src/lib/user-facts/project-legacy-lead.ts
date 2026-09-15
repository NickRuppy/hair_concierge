import { buildLegacyQuizStage1Source } from "@/lib/personal-plan/input"
import type { QuizAnswers } from "@/lib/quiz/types"

import { UnsupportedUserFactsSourceError, diagnosticsV1Schema } from "./schema"
import type { DiagnosticsV1 } from "./schema"

export type ProjectLegacyLeadInput = {
  leadId: string
  quizAnswers: QuizAnswers
}

export type ProjectLegacyLeadResult = {
  diagnostics: DiagnosticsV1
}

/**
 * Projects a legacy German-keyed lead (`leads.quiz_answers`) into native-vocabulary
 * `DiagnosticsV1`. Legacy leads have no reflective quiz context, so there is no
 * `QuizContextV1` output. `diagnostics.source.raw` stores the BUILT Stage-1 source object
 * (`buildLegacyQuizStage1Source`'s result), because that is the object Stage-1 hashes — the
 * German answers themselves stay in `leads.quiz_answers`.
 *
 * Controller ruling (task 5a fix round 1, 2026-09-15, finding I2): a legacy lead missing one or
 * more of the 7 scalar diagnostics no longer throws — it returns PARTIAL diagnostics carrying
 * only the fields the built legacy source has (the four array fields are never `undefined`;
 * `buildLegacyQuizStage1Source` always defaults them to `[]`). Partial stored diagnostics are
 * legal (the schema ruling that made every field but `source` optional on `diagnosticsV1Schema`);
 * completeness is enforced at the Stage-1 boundary instead (`toStage1Source` throws
 * `UserFactsIncompleteError` for an EDITED emission missing a required field), and today's
 * pre-PR1 writer linked such leads with a sparse profile too — payment/activation call sites
 * must keep working for an incomplete legacy lead. This function throws
 * `UnsupportedUserFactsSourceError` ONLY when `quizAnswers` is not a usable record at all, i.e.
 * `buildLegacyQuizStage1Source` itself cannot run.
 */
export function projectLegacyLeadToFacts(input: ProjectLegacyLeadInput): ProjectLegacyLeadResult {
  let legacySource: ReturnType<typeof buildLegacyQuizStage1Source>
  try {
    legacySource = buildLegacyQuizStage1Source({
      leadId: input.leadId,
      answers: input.quizAnswers,
    })
  } catch (cause) {
    throw new UnsupportedUserFactsSourceError(
      `Unable to project legacy lead ${input.leadId} into diagnostics facts`,
      cause,
    )
  }

  const answers = legacySource.answers
  const diagnostics = diagnosticsV1Schema.parse({
    texture: answers.texture,
    thickness: answers.thickness,
    density: answers.density,
    hairLength: answers.hairLength,
    hairSurface: answers.hairSurface,
    elasticResponse: answers.elasticResponse,
    chemicalTreatments: answers.chemicalTreatments,
    scalpOiliness: answers.scalpOiliness,
    scalpConcerns: answers.scalpConcerns,
    goals: answers.goals,
    currentConcerns: answers.currentConcerns,
    source: { kind: "legacy_quiz", version: 1, leadId: input.leadId, raw: legacySource },
  })

  return { diagnostics }
}
