import { z } from "zod"

import { personalPlanDurableAnswersBaseSchema } from "@/lib/personal-plan-quiz/persistence"
import {
  PROFILE_SOURCE_LEAD_ID,
  buildHandEditFacts,
  type HandEditFactsWrite,
  type HandEditValues,
} from "@/lib/user-facts/hand-edit"
import { diagnosticsFromLegacyColumns } from "@/lib/user-facts/profile-diagnostics"
import type { UserFacts } from "@/lib/user-facts/read"
import {
  UserFactsIncompleteError,
  type DiagnosticsSource,
  type DiagnosticsV1,
} from "@/lib/user-facts/schema"
import { toStage1Source } from "@/lib/user-facts/stage1-source"

/**
 * Clean-switch task 5 (plan 2026-09-30 §4): what the web profile editors send to
 * `POST /api/profile/answers` — the quiz's own vocabulary, i.e. the native diagnostics values —
 * and how that becomes a hand edit through `user_facts_save_v1` (`buildHandEditFacts`, the same
 * rules as the iOS edit). Pure; the schema is also the client's payload contract.
 *
 * An edit names whole answer groups. Every field is optional (unnamed = unchanged); the three
 * problem fields form one group (`currentConcerns` + note + main problem) and are validated
 * together with the quiz's rules: at least one problem or a note, the note at most 50
 * characters, and with two or more problems a main problem among them.
 */

const base = personalPlanDurableAnswersBaseSchema.shape

export const profileAnswersSchema = z
  .object({
    texture: base.texture,
    thickness: base.thickness,
    density: base.density,
    hairLength: base.hairLength,
    hairSurface: base.hairSurface,
    elasticResponse: base.elasticResponse,
    chemicalTreatments: base.chemicalTreatments,
    scalpOiliness: base.scalpOiliness,
    scalpConcerns: base.scalpConcerns,
    currentConcerns: base.currentConcerns,
    currentConcernsOtherText: z.string().max(50).nullable(),
    primaryConcern: base.currentConcerns.element.nullable(),
    goals: base.goals,
  })
  .partial()
  .strict()
  .superRefine((answers, context) => {
    if (Object.keys(answers).length === 0) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Keine Antworten zum Speichern" })
    }
    if (answers.chemicalTreatments?.includes("natural") && answers.chemicalTreatments.length > 1) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["chemicalTreatments"],
        message: "Naturhaar kann nicht mit chemischen Behandlungen kombiniert werden",
      })
    }

    const namesProblems =
      answers.currentConcerns !== undefined ||
      answers.currentConcernsOtherText !== undefined ||
      answers.primaryConcern !== undefined
    if (!namesProblems) return
    const concerns = answers.currentConcerns
    if (!concerns) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["currentConcerns"],
        message: "Notiz und Hauptproblem nur zusammen mit den Anliegen",
      })
      return
    }
    if (concerns.length === 0 && !answers.currentConcernsOtherText?.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["currentConcerns"],
        message: "Mindestens ein Anliegen oder eine Notiz",
      })
    }
    const pick = answers.primaryConcern
    if (pick && !concerns.includes(pick)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["primaryConcern"],
        message: "Das Hauptproblem muss eines der Anliegen sein",
      })
    }
    if (concerns.length >= 2 && !pick) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["primaryConcern"],
        message: "Bei mehreren Anliegen fehlt das Hauptproblem",
      })
    }
  })

export type ProfileAnswers = z.infer<typeof profileAnswersSchema>

export type ProfileAnswersStoredFacts = Pick<
  UserFacts,
  "diagnostics" | "provenance" | "quizContext" | "legacyColumns"
>

const SIMPLE_FIELDS = [
  "texture",
  "thickness",
  "density",
  "hairLength",
  "hairSurface",
  "elasticResponse",
  "chemicalTreatments",
  "scalpOiliness",
  "scalpConcerns",
] as const

/**
 * The hand edit a web save writes. `row` is the profile row the save read (`to_jsonb`), used
 * only when the row has no facts document yet: its legacy columns (migration table M) are the
 * base the edit is written over, so a partial edit never erases what it did not name.
 */
export function buildProfileAnswersFacts(input: {
  answers: ProfileAnswers
  stored: ProfileAnswersStoredFacts | null
  row: Record<string, unknown> | null
  now: string
}): HandEditFactsWrite {
  const { answers } = input
  const stored = input.stored?.diagnostics ?? null
  const baseDocument = stored || !input.row ? null : diagnosticsFromLegacyColumns(input.row)
  const reference = stored ?? baseDocument

  const values: HandEditValues = {}
  for (const field of SIMPLE_FIELDS) {
    if (answers[field] !== undefined) values[field] = answers[field]
  }

  if (answers.currentConcerns !== undefined) {
    const concerns = answers.currentConcerns
    values.currentConcerns = concerns
    // Her stated main problem only: with one problem that one is her main problem anyway (the
    // derived column resolves it), so only a pick between two or more is stored.
    values.primaryConcern = concerns.length >= 2 ? (answers.primaryConcern ?? null) : null
    values.currentConcernsOtherText = answers.currentConcernsOtherText?.trim() || null
  }

  if (answers.goals !== undefined) {
    values.goals = answers.goals
    // Plan §3: the stored direction of the volume goal is kept while she keeps that goal; a
    // volume goal she adds now follows her hair type, one she removes takes its direction along.
    const keepsVolume =
      answers.goals.includes("volume_balance") && reference?.goals?.includes("volume_balance")
    if (!keepsVolume && reference?.volumeDirection !== undefined) values.volumeDirection = null
  }

  return buildHandEditFacts({
    values,
    stored,
    storedProvenance: input.stored?.provenance.diagnostics ?? null,
    base: baseDocument,
    newSource: (merged) => profileEditorSource(merged, input.now),
    now: input.now,
  })
}

/** The source of a document the web editor creates (or re-sources from `legacy_columns`): a
 * `legacy_quiz` envelope under the profile placeholder lead, like the iOS edit's. `raw` is the
 * Stage-1 source the edited document emits when it is complete, `null` while it is not. */
function profileEditorSource(
  merged: Omit<DiagnosticsV1, "source">,
  now: string,
): DiagnosticsSource {
  const source = {
    kind: "legacy_quiz" as const,
    version: 1 as const,
    leadId: PROFILE_SOURCE_LEAD_ID,
  }
  try {
    const raw = toStage1Source({
      diagnostics: { ...merged, source: { ...source, raw: null } },
      editedAt: now,
    })
    return { ...source, raw }
  } catch (error) {
    if (error instanceof UserFactsIncompleteError) return { ...source, raw: null }
    throw error
  }
}
