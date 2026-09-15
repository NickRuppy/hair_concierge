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
 * The scalar diagnostic fields a legacy lead must carry for a fresh projection (controller
 * ruling 2026-09-15 made these OPTIONAL on `diagnosticsV1Schema` itself, so it can no longer be
 * relied on to reject an incomplete legacy lead here — completeness for a fresh projection is
 * enforced explicitly instead). The four array fields are excluded: `buildLegacyQuizStage1Source`
 * always defaults them to `[]`, so they are never `undefined`.
 */
const REQUIRED_LEGACY_SCALAR_FIELDS = [
  "texture",
  "thickness",
  "density",
  "hairLength",
  "hairSurface",
  "elasticResponse",
  "scalpOiliness",
] as const

/**
 * Projects a legacy German-keyed lead (`leads.quiz_answers`) into native-vocabulary
 * `DiagnosticsV1`. Legacy leads have no reflective quiz context, so there is no
 * `QuizContextV1` output. `diagnostics.source.raw` stores the BUILT Stage-1 source object
 * (`buildLegacyQuizStage1Source`'s result), because that is the object Stage-1 hashes — the
 * German answers themselves stay in `leads.quiz_answers`.
 *
 * `buildLegacyQuizStage1Source` never throws on missing facts; it copies whatever the source
 * `QuizAnswers` has (including `undefined` for a never-answered question). Native diagnostics
 * validation is what turns a legacy lead missing a required diagnostic answer into a thrown
 * error instead of a silent partial object.
 */
export function projectLegacyLeadToFacts(input: ProjectLegacyLeadInput): ProjectLegacyLeadResult {
  try {
    const legacySource = buildLegacyQuizStage1Source({
      leadId: input.leadId,
      answers: input.quizAnswers,
    })
    const answers = legacySource.answers

    for (const field of REQUIRED_LEGACY_SCALAR_FIELDS) {
      if (answers[field] === undefined) {
        throw new UnsupportedUserFactsSourceError(
          `Legacy lead ${input.leadId} is missing required diagnostic field "${field}"`,
        )
      }
    }

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
  } catch (cause) {
    if (cause instanceof UnsupportedUserFactsSourceError) throw cause
    throw new UnsupportedUserFactsSourceError(
      `Unable to project legacy lead ${input.leadId} into diagnostics facts`,
      cause,
    )
  }
}
