import { quizAnswersSchema } from "@/lib/quiz/validators"
import type { QuizAnswers } from "@/lib/quiz/types"
import {
  quizContextReplacementPatch,
  quizSupersedesFacts,
  quizWinnerDiagnosticsWrite,
} from "@/lib/user-facts/account-link"
import { deriveDiagnosticsColumns } from "@/lib/user-facts/derive-legacy-columns"
import {
  PROFILE_SOURCE_LEAD_ID,
  ProfileFactsError,
  buildHandEditFacts,
  mergeDiagnosticsPatch,
  validatedDiagnosticsWrite,
  type HandEditFactsWrite,
  type HandEditField,
  type HandEditValues,
} from "@/lib/user-facts/hand-edit"
import { projectLegacyLeadToFacts } from "@/lib/user-facts/project-legacy-lead"
import type { UserFacts } from "@/lib/user-facts/read"
import {
  DIAGNOSTICS_SCHEMA_VERSION,
  QUIZ_CONTEXT_SCHEMA_VERSION,
  domainProvenanceSchema,
  quizContextPatchSchema,
} from "@/lib/user-facts/schema"

/**
 * Clean-switch tasks 3 + 4 (plan 2026-09-30 §4): the facts the two iOS SQL writers hand to
 * `user_facts_save_v1` inside their own transaction, built from the submitted (legacy
 * German-keyed) quiz answers. Deterministic and I/O-free; the vocabulary conversion is the
 * existing legacy-lead projection (`projectLegacyLeadToFacts` → `buildLegacyQuizStage1Source`
 * → `resolveVisibleDiagnosticGoals`) — this module only decides WHICH projected fields a write
 * names; the hand-edit rules themselves are shared with the web editors
 * (`src/lib/user-facts/hand-edit.ts`).
 *
 * Two kinds of write:
 *  - a HAND EDIT (`buildMobileHandEditFacts`): the iOS profile edit, and the registration
 *    "missing" completion (which names only the missing groups). Provenance
 *    `profile_editor` + `editedAt`, so a quiz taken later replaces it and an older quiz linked
 *    later does not (`quizSupersedesFacts`), and Stage 1 emits the edited native envelope.
 *  - a QUIZ TAKEN NOW (`buildMobileQuizFacts`): registration create / replace. Exactly the
 *    web account link's winner write (`quizWinnerDiagnosticsWrite`): full replacement,
 *    completeness defaults, `legacy_lead` provenance, a stored quiz_context cleared (F4).
 */

/** The ten regular iOS question groups (`mobileEditQuestions`, `missingProfileQuestions`). */
export const MOBILE_ANSWER_GROUPS = [
  "structure",
  "thickness",
  "density",
  "hair_length",
  "fingertest",
  "pulltest",
  "treatment",
  "scalp_type",
  "concerns",
  "goals",
] as const
export type MobileAnswerGroup = (typeof MOBILE_ANSWER_GROUPS)[number]

/** Which native diagnostics fields each question group answers. */
const FIELDS_BY_GROUP: Record<MobileAnswerGroup, readonly HandEditField[]> = {
  structure: ["texture"],
  thickness: ["thickness"],
  density: ["density"],
  hair_length: ["hairLength"],
  fingertest: ["hairSurface"],
  pulltest: ["elasticResponse"],
  treatment: ["chemicalTreatments"],
  scalp_type: ["scalpOiliness", "scalpConcerns"],
  concerns: ["currentConcerns", "primaryConcern"],
  goals: ["goals", "volumeDirection"],
}

export { PROFILE_SOURCE_LEAD_ID }

export type StoredFacts = Pick<
  UserFacts,
  "diagnostics" | "provenance" | "quizContext" | "legacyColumns"
>

export type MobileFactsWrite = HandEditFactsWrite

/** The builders' refusals; one class with the web editors (`src/lib/user-facts/hand-edit.ts`). */
export { ProfileFactsError as MobileProfileFactsError }

/** The `p_facts` argument both SQL functions take. */
export function toProfileFactsArgument(write: MobileFactsWrite): {
  diagnostics: MobileFactsWrite["diagnostics"]
  quiz_context?: NonNullable<MobileFactsWrite["quizContext"]>
} {
  return {
    diagnostics: write.diagnostics,
    ...(write.quizContext ? { quiz_context: write.quizContext } : {}),
  }
}

function parseAnswers(answers: QuizAnswers): QuizAnswers {
  const parsed = quizAnswersSchema.safeParse(answers)
  if (!parsed.success) {
    throw new ProfileFactsError(
      "invalid_answers",
      "mobile profile facts: the answers are not a complete quiz",
      parsed.error,
    )
  }
  return parsed.data as QuizAnswers
}

/** Migration table M ("the stored direction is kept"): a directional LEGACY goal in the
 * submitted answers is the profile's stored goal handed back unchanged by the edit screen
 * (`withSavedOptions`), so its direction is kept; the quiz's own `volume_balance` card follows
 * hair type (no direction). */
function legacyVolumeDirection(goals: readonly string[] | undefined): "more" | "less" | null {
  if (goals?.includes("volume")) return "more"
  if (goals?.includes("less_volume")) return "less"
  return null
}

/**
 * A hand edit of the answered groups (task 3: all ten; task 4 "missing": the missing ones).
 *
 * - Names every field of the given groups with the projected value (JSON null clears), except
 *   an unstated main problem: an answer set without `primary_concern` leaves the stored pick
 *   alone, and the derived column ignores it once it is no longer a current concern — the same
 *   outcome the `primary_concern` trigger produced for the old direct column write.
 * - A stored document is required to be complete only where it is written: with NO stored
 *   document (or a `legacy_columns` backfill document, which has no quiz envelope) the write
 *   names every group and a `legacy_quiz` source built from the answers, because the door
 *   derives all 13 columns from the document and a partial new document would NULL the rest.
 * - `completion: true` (registration "missing" mode) first applies "latest own quiz wins" with
 *   the quiz taken now; a plain edit is the newest word by definition.
 * - Per-field provenance: `user` for every value that differs from the stored one; an
 *   unchanged value keeps whatever marker it had (an assumed default stays `assumed`).
 */
export function buildMobileHandEditFacts(input: {
  answers: QuizAnswers
  stored: StoredFacts | null
  now: string
  groups?: readonly MobileAnswerGroup[]
  completion?: boolean
}): MobileFactsWrite {
  const answers = parseAnswers(input.answers)
  const existing = input.stored?.diagnostics ?? null
  if (input.completion && !quizSupersedesFacts(input.stored, input.now)) {
    throw new ProfileFactsError("not_newer", "mobile profile facts: a newer quiz is stored")
  }

  const projection = projectLegacyLeadToFacts({
    leadId: PROFILE_SOURCE_LEAD_ID,
    quizAnswers: answers,
  }).diagnostics
  const newSource = !existing || existing.source.kind === "legacy_columns"
  const groups = newSource ? MOBILE_ANSWER_GROUPS : (input.groups ?? MOBILE_ANSWER_GROUPS)

  const values: HandEditValues = {}
  for (const group of groups) {
    for (const field of FIELDS_BY_GROUP[group]) {
      const value =
        field === "volumeDirection" ? legacyVolumeDirection(answers.goals) : projection[field]
      if (field === "primaryConcern" && value === undefined) continue
      values[field] = value ?? null
    }
  }
  return buildHandEditFacts({
    values,
    stored: existing,
    storedProvenance: input.stored?.provenance.diagnostics ?? null,
    newSource: () => projection.source,
    now: input.now,
  })
}

/**
 * A quiz taken now (task 4: registration create / replace): the web account link's winner
 * write for a legacy lead, verbatim — `quizSupersedesFacts` with `takenAt = now`, then
 * `quizWinnerDiagnosticsWrite` (full replacement + completeness defaults) and, when the
 * profile has a quiz_context from an earlier artifact, its clearing replacement (F4).
 */
export function buildMobileQuizFacts(input: {
  answers: QuizAnswers
  leadId: string
  stored: StoredFacts | null
  now: string
}): MobileFactsWrite {
  const answers = parseAnswers(input.answers)
  if (!quizSupersedesFacts(input.stored, input.now)) {
    throw new ProfileFactsError("not_newer", "mobile profile facts: a newer quiz is stored")
  }
  const projection = projectLegacyLeadToFacts({
    leadId: input.leadId,
    quizAnswers: answers,
    takenAt: input.now,
  }).diagnostics
  const winner = quizWinnerDiagnosticsWrite(projection, input.stored)
  const provenanceSource = { kind: "legacy_lead" as const, id: input.leadId }
  const diagnostics = validatedDiagnosticsWrite(winner.patch, {
    source: provenanceSource,
    schemaVersion: DIAGNOSTICS_SCHEMA_VERSION,
    at: input.now,
    fields: winner.fields,
  })

  let quizContext: MobileFactsWrite["quizContext"]
  if (input.stored?.quizContext) {
    const patch = quizContextPatchSchema.parse(quizContextReplacementPatch({}))
    quizContext = {
      patch,
      provenance: domainProvenanceSchema.parse({
        source: provenanceSource,
        schemaVersion: QUIZ_CONTEXT_SCHEMA_VERSION,
        at: input.now,
      }),
    }
  }
  return {
    diagnostics,
    ...(quizContext ? { quizContext } : {}),
    columns: deriveDiagnosticsColumns(
      mergeDiagnosticsPatch(input.stored?.diagnostics ?? null, diagnostics.patch),
    ),
  }
}
