import { quizAnswersSchema } from "@/lib/quiz/validators"
import type { QuizAnswers } from "@/lib/quiz/types"
import {
  quizContextReplacementPatch,
  quizSupersedesFacts,
  quizWinnerDiagnosticsWrite,
} from "@/lib/user-facts/account-link"
import {
  deriveDiagnosticsColumns,
  type DiagnosticsDerivedColumns,
} from "@/lib/user-facts/derive-legacy-columns"
import { projectLegacyLeadToFacts } from "@/lib/user-facts/project-legacy-lead"
import type { UserFacts } from "@/lib/user-facts/read"
import {
  DIAGNOSTICS_SCHEMA_VERSION,
  QUIZ_CONTEXT_SCHEMA_VERSION,
  diagnosticsPatchSchema,
  diagnosticsV1Schema,
  domainProvenanceSchema,
  quizContextPatchSchema,
  type DiagnosticsPatch,
  type DiagnosticsV1,
  type DomainProvenance,
  type FieldProvenanceValue,
  type QuizContextPatch,
} from "@/lib/user-facts/schema"

/**
 * Clean-switch tasks 3 + 4 (plan 2026-09-30 §4): the facts the two iOS SQL writers hand to
 * `user_facts_save_v1` inside their own transaction, built from the submitted (legacy
 * German-keyed) quiz answers. Deterministic and I/O-free; the vocabulary conversion is the
 * existing legacy-lead projection (`projectLegacyLeadToFacts` → `buildLegacyQuizStage1Source`
 * → `resolveVisibleDiagnosticGoals`) — this module only decides WHICH projected fields a write
 * names and with what provenance.
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

type DiagnosticsField = Exclude<keyof DiagnosticsV1, "source">

/** Which native diagnostics fields each question group answers. */
const FIELDS_BY_GROUP: Record<MobileAnswerGroup, readonly DiagnosticsField[]> = {
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

/** `diagnostics.source.leadId` for a document a hand edit has to create: there is no lead
 * behind it. Same placeholder the scanner uses for an edited source (`rebaseScannerSource`). */
export const PROFILE_SOURCE_LEAD_ID = "profile"

export type StoredFacts = Pick<
  UserFacts,
  "diagnostics" | "provenance" | "quizContext" | "legacyColumns"
>

export type MobileFactsWrite = {
  diagnostics: { patch: DiagnosticsPatch; provenance: DomainProvenance }
  quizContext?: { patch: QuizContextPatch; provenance: DomainProvenance }
  /** The 13 diagnostics columns `user_facts_save_v1` derives from the merged document (the TS
   * oracle, parity-tested against the SQL) — what the row will hold after the write. */
  columns: DiagnosticsDerivedColumns
}

export class MobileProfileFactsError extends Error {
  constructor(
    readonly code: "invalid_answers" | "not_newer" | "invalid_document",
    message: string,
    readonly cause?: unknown,
  ) {
    super(message)
    this.name = "MobileProfileFactsError"
  }
}

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
    throw new MobileProfileFactsError(
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

function sameValue(a: unknown, b: unknown): boolean {
  const canonical = (value: unknown) =>
    Array.isArray(value) ? JSON.stringify([...value].sort()) : JSON.stringify(value ?? null)
  return canonical(a) === canonical(b)
}

/** `user_facts_save_v1`'s merge: the patch over the old document, a top-level null clears. */
function mergedDocument(old: DiagnosticsV1 | null, patch: DiagnosticsPatch): DiagnosticsV1 {
  const next: Record<string, unknown> = { ...(old ?? {}), ...patch }
  for (const [key, value] of Object.entries(patch)) if (value === null) delete next[key]
  const parsed = diagnosticsV1Schema.safeParse(next)
  if (!parsed.success) {
    // Never hand the door a document `loadUserFacts` could not read back.
    throw new MobileProfileFactsError(
      "invalid_document",
      "mobile profile facts: the merged diagnostics document would be invalid",
      parsed.error,
    )
  }
  return parsed.data
}

function validated(
  patch: DiagnosticsPatch,
  provenance: DomainProvenance,
): MobileFactsWrite["diagnostics"] {
  const patchResult = diagnosticsPatchSchema.safeParse(patch)
  const provenanceResult = domainProvenanceSchema.safeParse(provenance)
  if (!patchResult.success || !provenanceResult.success) {
    throw new MobileProfileFactsError(
      "invalid_document",
      "mobile profile facts: invalid patch or provenance",
      patchResult.error ?? provenanceResult.error,
    )
  }
  return { patch: patchResult.data, provenance: provenanceResult.data }
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
    throw new MobileProfileFactsError("not_newer", "mobile profile facts: a newer quiz is stored")
  }

  const projection = projectLegacyLeadToFacts({
    leadId: PROFILE_SOURCE_LEAD_ID,
    quizAnswers: answers,
  }).diagnostics
  const newSource = !existing || existing.source.kind === "legacy_columns"
  const groups = newSource ? MOBILE_ANSWER_GROUPS : (input.groups ?? MOBILE_ANSWER_GROUPS)

  const patch: Record<string, unknown> = {}
  for (const group of groups) {
    for (const field of FIELDS_BY_GROUP[group]) {
      const value =
        field === "volumeDirection" ? legacyVolumeDirection(answers.goals) : projection[field]
      if (field === "primaryConcern" && value === undefined) continue
      patch[field] = value ?? null
    }
  }
  const recurrence = existing?.concernRecurrence
  const nextConcerns = patch.currentConcerns as string[] | null | undefined
  if (recurrence && nextConcerns !== undefined && !nextConcerns?.includes(recurrence.concernId)) {
    patch.concernRecurrence = null
  }
  if (newSource) patch.source = projection.source

  const fields: Record<string, FieldProvenanceValue> = {}
  for (const [field, value] of Object.entries(patch)) {
    if (field === "source" || value === null) continue
    if (!sameValue(existing?.[field as DiagnosticsField], value)) fields[field] = "user"
  }
  const diagnostics = validated(patch as DiagnosticsPatch, {
    source: { kind: "profile_editor" },
    schemaVersion: DIAGNOSTICS_SCHEMA_VERSION,
    at: input.now,
    editedAt: input.now,
    ...(Object.keys(fields).length > 0 ? { fields } : {}),
  })
  return {
    diagnostics,
    columns: deriveDiagnosticsColumns(mergedDocument(existing, diagnostics.patch)),
  }
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
    throw new MobileProfileFactsError("not_newer", "mobile profile facts: a newer quiz is stored")
  }
  const projection = projectLegacyLeadToFacts({
    leadId: input.leadId,
    quizAnswers: answers,
    takenAt: input.now,
  }).diagnostics
  const winner = quizWinnerDiagnosticsWrite(projection, input.stored)
  const provenanceSource = { kind: "legacy_lead" as const, id: input.leadId }
  const diagnostics = validated(winner.patch, {
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
      mergedDocument(input.stored?.diagnostics ?? null, diagnostics.patch),
    ),
  }
}
