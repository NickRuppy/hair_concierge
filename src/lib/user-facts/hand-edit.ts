import { deriveDiagnosticsColumns, type DiagnosticsDerivedColumns } from "./derive-legacy-columns"
import {
  DIAGNOSTICS_SCHEMA_VERSION,
  diagnosticsPatchSchema,
  diagnosticsV1Schema,
  domainProvenanceSchema,
  type DiagnosticsPatch,
  type DiagnosticsSource,
  type DiagnosticsV1,
  type DomainProvenance,
  type FieldProvenanceValue,
  type QuizContextPatch,
} from "./schema"

/**
 * The rules of a HAND EDIT of the diagnostics facts (clean switch, plan 2026-09-30 §3), shared
 * by every editor that saves through `user_facts_save_v1`: the iOS profile edit and registration
 * "missing" completion (`src/lib/mobile/profile-facts-patch.ts`) and the web profile editors
 * (`src/lib/hair-profile/profile-answers.ts`). Each caller only decides WHICH native fields its
 * edit names and with what values; everything below is one rule set.
 *
 * - Provenance `profile_editor` + `editedAt`: a quiz taken later replaces the edit and an older
 *   quiz linked later does not (`quizSupersedesFacts`), and Stage 1 emits the edited envelope.
 * - Only a value that differs from what the profile holds is re-marked `user`; an unchanged value
 *   keeps its marker (an assumed completeness default stays `assumed`). No defaults are added.
 * - A stored `concernRecurrence` whose concern is no longer selected is cleared with the edit.
 * - An edit that changes no value the profile holds (its document, or on a row without one what
 *   its legacy columns convert to) is not an edit: it is marked `unchanged`, with an empty patch
 *   under the stored provenance — no `editedAt`, no markers, no new source.
 * - A missing document, or a `legacy_columns` backfill document (no quiz envelope, so Stage 1 can
 *   never emit it), gets the caller's `newSource`.
 *
 * Deterministic and I/O-free.
 */

/** `diagnostics.source.leadId` for a document a hand edit has to create: there is no lead
 * behind it. Same placeholder the scanner uses for an edited source (`rebaseScannerSource`). */
export const PROFILE_SOURCE_LEAD_ID = "profile"

export type HandEditField = Exclude<keyof DiagnosticsV1, "source">

/** The fields an edit names: a value, or `null` to clear the field. Unnamed = unchanged. */
export type HandEditValues = Partial<Record<HandEditField, unknown>>

export type HandEditFactsWrite = {
  diagnostics: { patch: DiagnosticsPatch; provenance: DomainProvenance }
  quizContext?: { patch: QuizContextPatch; provenance: DomainProvenance }
  /** The 13 diagnostics columns `user_facts_save_v1` derives from the merged document (the TS
   * oracle, parity-tested against the SQL) — what the row will hold after the write. */
  columns: DiagnosticsDerivedColumns
  /** Set when the edit changes no value the profile holds: not an edit (see `buildHandEditFacts`). */
  unchanged?: true
}

export class ProfileFactsError extends Error {
  constructor(
    readonly code: "invalid_answers" | "not_newer" | "invalid_document",
    message: string,
    readonly cause?: unknown,
  ) {
    super(message)
    this.name = "ProfileFactsError"
  }
}

export function sameFactValue(a: unknown, b: unknown): boolean {
  const canonical = (value: unknown) =>
    Array.isArray(value) ? JSON.stringify([...value].sort()) : JSON.stringify(value ?? null)
  return canonical(a) === canonical(b)
}

/** `user_facts_save_v1`'s merge: the patch over the old document, a top-level null clears. */
export function mergeDiagnosticsPatch(
  old: DiagnosticsV1 | null,
  patch: DiagnosticsPatch,
): DiagnosticsV1 {
  const next: Record<string, unknown> = { ...(old ?? {}), ...patch }
  for (const [key, value] of Object.entries(patch)) if (value === null) delete next[key]
  const parsed = diagnosticsV1Schema.safeParse(next)
  if (!parsed.success) {
    // Never hand the door a document `loadUserFacts` could not read back.
    throw new ProfileFactsError(
      "invalid_document",
      "profile facts: the merged diagnostics document would be invalid",
      parsed.error,
    )
  }
  return parsed.data
}

export function validatedDiagnosticsWrite(
  patch: DiagnosticsPatch,
  provenance: DomainProvenance,
): HandEditFactsWrite["diagnostics"] {
  const patchResult = diagnosticsPatchSchema.safeParse(patch)
  const provenanceResult = domainProvenanceSchema.safeParse(provenance)
  if (!patchResult.success || !provenanceResult.success) {
    throw new ProfileFactsError(
      "invalid_document",
      "profile facts: invalid patch or provenance",
      patchResult.error ?? provenanceResult.error,
    )
  }
  return { patch: patchResult.data, provenance: provenanceResult.data }
}

export function buildHandEditFacts(input: {
  /** The fields this edit names (`null` clears). */
  values: HandEditValues
  /** The diagnostics document the row holds, and its provenance. */
  stored: DiagnosticsV1 | null
  storedProvenance?: DomainProvenance | null
  /** Only when `stored` is null: the document the row's legacy columns stand for. It is written
   * in full under the edit, so a partial edit never erases the columns it did not name. */
  base?: DiagnosticsV1 | null
  /** The source written when the row has no document or a `legacy_columns` one. May use the
   * merged document the edit produces (without a source) and the per-field provenance it will
   * carry (an `assumed` default must never reach a Stage-1 envelope). */
  newSource: (
    merged: Omit<DiagnosticsV1, "source">,
    fields: Readonly<Record<string, FieldProvenanceValue>>,
  ) => DiagnosticsSource
  now: string
}): HandEditFactsWrite {
  const stored = input.stored
  const reference = stored ?? input.base ?? null

  const patch: Record<string, unknown> = {}
  if (!stored && input.base) {
    for (const [field, value] of Object.entries(input.base)) {
      if (field !== "source") patch[field] = value
    }
  }
  for (const [field, value] of Object.entries(input.values)) {
    if (value !== undefined) patch[field] = value
  }

  const recurrence = reference?.concernRecurrence
  const nextConcerns = patch.currentConcerns as string[] | null | undefined
  if (recurrence && nextConcerns !== undefined && !nextConcerns?.includes(recurrence.concernId)) {
    patch.concernRecurrence = null
  }

  // A hand edit that changes no value is not an edit (coordinator rule, 2026-09-30): no
  // `editedAt`, no re-marked provenance, nothing re-sourced — otherwise an unchanged user's
  // Stage-1 emission would flip from `source.raw` to a native envelope. The comparison is
  // against what the profile holds: its document, or — on a row without one — what its legacy
  // columns convert to (`base`). The result is marked `unchanged`; the web save then writes and
  // publishes nothing, the iOS publication sends the empty patch under the stored provenance.
  const changesStored =
    !reference ||
    Object.entries(patch).some(
      ([field, value]) => !sameFactValue(reference[field as HandEditField], value),
    )
  if (!changesStored) {
    return {
      diagnostics: validatedDiagnosticsWrite(
        {},
        input.storedProvenance ?? {
          source: { kind: "profile_editor" },
          schemaVersion: DIAGNOSTICS_SCHEMA_VERSION,
          at: input.now,
        },
      ),
      columns: deriveDiagnosticsColumns(reference),
      unchanged: true,
    }
  }

  const fields: Record<string, FieldProvenanceValue> = {}
  for (const [field, value] of Object.entries(patch)) {
    if (field === "source" || value === null) continue
    if (!sameFactValue(reference?.[field as HandEditField], value)) fields[field] = "user"
  }

  if (!stored || stored.source.kind === "legacy_columns") {
    // The merge needs a source to validate; the placeholder never leaves this block.
    const merged: Partial<DiagnosticsV1> = mergeDiagnosticsPatch(stored, {
      ...(patch as DiagnosticsPatch),
      source: PLACEHOLDER_SOURCE,
    })
    delete merged.source
    // The field markers the door will store: the stored ones, minus cleared fields, plus this
    // edit's (its merge rule, `user_facts_save_v1` step 6).
    const mergedFields: Record<string, FieldProvenanceValue> = {
      ...(input.storedProvenance?.fields ?? {}),
      ...fields,
    }
    for (const [field, value] of Object.entries(patch)) {
      if (value === null) delete mergedFields[field]
    }
    patch.source = input.newSource(merged as Omit<DiagnosticsV1, "source">, mergedFields)
  }
  const diagnostics = validatedDiagnosticsWrite(patch as DiagnosticsPatch, {
    source: { kind: "profile_editor" },
    schemaVersion: DIAGNOSTICS_SCHEMA_VERSION,
    at: input.now,
    editedAt: input.now,
    ...(Object.keys(fields).length > 0 ? { fields } : {}),
  })
  return {
    diagnostics,
    columns: deriveDiagnosticsColumns(mergeDiagnosticsPatch(stored, diagnostics.patch)),
  }
}

const PLACEHOLDER_SOURCE: DiagnosticsSource = {
  kind: "legacy_quiz",
  version: 1,
  leadId: "placeholder",
  raw: null,
}
