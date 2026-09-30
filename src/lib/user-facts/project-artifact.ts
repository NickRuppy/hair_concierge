import {
  normalizeV2Concerns,
  parseSupportedPersonalPlanQuizEnvelope,
} from "@/lib/personal-plan/input"

import { UnsupportedUserFactsSourceError, diagnosticsV1Schema, quizContextV1Schema } from "./schema"
import type { DiagnosticsV1, QuizContextV1 } from "./schema"

export type ProjectArtifactInput = {
  /** The raw, unvalidated v3 or v2 quiz envelope as stored verbatim (e.g.
   * `personal_plan_prepared_artifacts.quiz_answers`). */
  envelope: unknown
  artifactId: string
  leadId: string
}

export type ProjectArtifactResult = {
  diagnostics: DiagnosticsV1
  quizContext: QuizContextV1
}

/** The 8 reflective/quiz-context answers, present on both v3 and v2 envelopes. */
const QUIZ_CONTEXT_FIELDS = [
  "routineClarity",
  "resultReliability",
  "adaptationConfidence",
  "previousAttempts",
  "blockers",
  "blockersOtherText",
  "routineStyle",
  "meaningfulMoment",
] as const

function pickQuizContext(answers: Record<string, unknown>): QuizContextV1 {
  const picked: Record<string, unknown> = {}
  for (const field of QUIZ_CONTEXT_FIELDS) {
    if (answers[field] !== undefined) picked[field] = answers[field]
  }
  return quizContextV1Schema.parse(picked)
}

/** The 11 durable-diagnostic fields shared by v3 and v2 answers, read defensively (`!` on
 * scalars, `?? []` on arrays) because the shared quiz-draft interfaces mark every field
 * optional at the type level even though a successfully parsed envelope always carries them. */
function baseDiagnosticFields(answers: {
  texture?: string
  thickness?: string
  density?: string
  hairLength?: string
  hairSurface?: string
  elasticResponse?: string
  chemicalTreatments?: readonly string[]
  scalpOiliness?: string
  scalpConcerns?: readonly string[]
  goals?: readonly string[]
  currentConcernsOtherText?: string
}) {
  return {
    texture: answers.texture!,
    thickness: answers.thickness!,
    density: answers.density!,
    hairLength: answers.hairLength!,
    hairSurface: answers.hairSurface!,
    elasticResponse: answers.elasticResponse!,
    chemicalTreatments: [...(answers.chemicalTreatments ?? [])],
    scalpOiliness: answers.scalpOiliness!,
    scalpConcerns: [...(answers.scalpConcerns ?? [])],
    goals: [...(answers.goals ?? [])],
    ...(answers.currentConcernsOtherText
      ? { currentConcernsOtherText: answers.currentConcernsOtherText }
      : {}),
  }
}

/**
 * Projects a v3 or v2 personal-plan quiz envelope into native-vocabulary `DiagnosticsV1` +
 * `QuizContextV1`. `diagnostics.source.raw` stores `input.envelope` VERBATIM — the original
 * input object, not the zod-parsed reconstruction (F26 requires byte-identical, same-key-order
 * storage; `parseSupportedPersonalPlanQuizEnvelope`'s return value rebuilds the object in
 * schema-declared key order, so it must only be used to validate and to read typed field
 * values, never as the stored `raw`). v2 `currentConcerns` are decoded through the same
 * `normalizeV2Concerns`/`V2_CONCERN_MAP` Stage-1 uses so an unchanged user hashes identically
 * (F10) while `source.raw` keeps the original (still-`scalp_imbalance`-carrying) envelope.
 */
export function projectArtifactToFacts(input: ProjectArtifactInput): ProjectArtifactResult {
  const parsed = parseSupportedPersonalPlanQuizEnvelope(input.envelope)
  if (!parsed.ok) {
    throw new UnsupportedUserFactsSourceError(
      `Unsupported personal plan quiz envelope (${parsed.error.code}, version ${parsed.error.quizVersion ?? "unknown"})`,
    )
  }

  // Read typed field values from the validated/parsed envelope, but store the caller's
  // original (unreconstructed) object as `raw` below.
  const envelope = parsed.envelope

  const diagnostics = diagnosticsV1Schema.parse(
    envelope.version === 3
      ? {
          ...baseDiagnosticFields(envelope.answers),
          currentConcerns: [...(envelope.answers.currentConcerns ?? [])],
          ...(envelope.answers.primaryConcern
            ? { primaryConcern: envelope.answers.primaryConcern }
            : {}),
          ...(envelope.answers.concernRecurrence
            ? { concernRecurrence: envelope.answers.concernRecurrence }
            : {}),
          source: {
            kind: "personal_plan_v3" as const,
            version: 3 as const,
            leadId: input.leadId,
            artifactId: input.artifactId,
            raw: input.envelope,
          },
        }
      : {
          ...baseDiagnosticFields(envelope.answers),
          currentConcerns: normalizeV2Concerns(envelope.answers.currentConcerns),
          source: {
            kind: "personal_plan_v2" as const,
            version: 2 as const,
            leadId: input.leadId,
            artifactId: input.artifactId,
            raw: input.envelope,
          },
        },
  )

  const quizContext = pickQuizContext(envelope.answers as unknown as Record<string, unknown>)

  return { diagnostics, quizContext }
}
