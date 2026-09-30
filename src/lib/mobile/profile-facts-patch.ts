import { quizAnswersSchema } from "@/lib/quiz/validators"
import type { QuizAnswers } from "@/lib/quiz/types"
import {
  hasQuizContextAnswers,
  quizContextReplacementPatch,
  quizSupersedesFacts,
  quizWinnerDiagnosticsWrite,
} from "@/lib/user-facts/account-link"
import { deriveDiagnosticsColumns } from "@/lib/user-facts/derive-legacy-columns"
import {
  DIAGNOSTICS_ANSWER_GROUPS,
  FIELDS_BY_ANSWER_GROUP,
  PROFILE_SOURCE_LEAD_ID,
  ProfileFactsError,
  buildHandEditFacts,
  mergeDiagnosticsPatch,
  sameFactValue,
  validatedDiagnosticsWrite,
  type DiagnosticsAnswerGroup,
  type HandEditFactsWrite,
  type HandEditField,
  type HandEditValues,
} from "@/lib/user-facts/hand-edit"
import { projectLegacyLeadToFacts } from "@/lib/user-facts/project-legacy-lead"
import { diagnosticsToQuizAnswers } from "@/lib/user-facts/quiz-answers"
import type { UserFacts } from "@/lib/user-facts/read"
import {
  DIAGNOSTICS_SCHEMA_VERSION,
  QUIZ_CONTEXT_SCHEMA_VERSION,
  domainProvenanceSchema,
  quizContextPatchSchema,
  type DiagnosticsV1,
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

/** The ten regular iOS question groups (`mobileEditQuestions`, `missingProfileQuestions`) — the
 * shared hand-edit groups (`src/lib/user-facts/hand-edit.ts`). */
export const MOBILE_ANSWER_GROUPS = DIAGNOSTICS_ANSWER_GROUPS
export type MobileAnswerGroup = DiagnosticsAnswerGroup

/** Which native diagnostics fields each question group answers. */
const FIELDS_BY_GROUP = FIELDS_BY_ANSWER_GROUP

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

/** The native field values an answer set names for the given groups (JSON null clears). */
function namedValues(
  answers: QuizAnswers,
  projection: DiagnosticsV1,
  groups: readonly MobileAnswerGroup[],
): HandEditValues {
  const values: HandEditValues = {}
  for (const group of groups) {
    for (const field of FIELDS_BY_GROUP[group]) {
      const value =
        field === "volumeDirection"
          ? legacyVolumeDirection(answers.goals)
          : field === "currentConcernsOtherText"
            ? // The free concern text (max. 50 characters, `quizAnswersSchema`); blank clears.
              answers.concerns_other_text?.trim() || null
            : projection[field]
      if (field === "primaryConcern" && value === undefined) continue
      values[field] = value ?? null
    }
  }
  return values
}

/** What the edit screen showed for a stored document, as the values handing it back would name;
 * `null` when the shown answers are no complete answer set (nothing to compare against). */
function shownValues(
  stored: DiagnosticsV1,
  groups: readonly MobileAnswerGroup[],
): HandEditValues | null {
  const parsed = quizAnswersSchema.safeParse(diagnosticsToQuizAnswers(stored))
  if (!parsed.success) return null
  const answers = parsed.data as QuizAnswers
  const projection = projectLegacyLeadToFacts({
    leadId: PROFILE_SOURCE_LEAD_ID,
    quizAnswers: answers,
  }).diagnostics
  return namedValues(answers, projection, groups)
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
  /** The free concern text the edit screen showed when the facts hold none (the scanner's
   * edit-record / lead fallback, `editableScannerQuizAnswers`): handed back unchanged it is no
   * edit, so an unchanged submit stays a no-op. */
  shownOtherText?: string | null
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

  const values = namedValues(answers, projection, groups)
  if (!newSource) {
    // The answer format cannot hold every stored fact (several scalp concerns, "natural" beside a
    // chemical treatment, an absent array): the edit screen shows them through
    // `diagnosticsToQuizAnswers`. A group handed back exactly as shown is not a change of the
    // value it could not show — the stored fact stays.
    const shown = shownValues(existing!, groups)
    for (const field of Object.keys(values) as HandEditField[]) {
      if (
        shown &&
        field in shown &&
        sameFactValue(values[field], shown[field]) &&
        !sameFactValue(shown[field], existing![field])
      )
        delete values[field]
    }
  }
  if (
    existing &&
    existing.currentConcernsOtherText === undefined &&
    input.shownOtherText?.trim() &&
    values.currentConcernsOtherText === input.shownOtherText.trim()
  )
    delete values.currentConcernsOtherText
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
 * profile has a quiz_context with answers from an earlier artifact, its clearing replacement
 * (F4; an already-cleared `{}` counts as absent).
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
  // A stored `{}` (an earlier clear) counts as absent: nothing to clear again.
  if (hasQuizContextAnswers(input.stored?.quizContext)) {
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
