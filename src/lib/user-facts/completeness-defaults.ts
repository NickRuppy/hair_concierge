import { diagnosticsV1Schema, type DiagnosticsV1, type FieldProvenanceValue } from "./schema"

/**
 * Decision wave 1, item B (Nick, 2026-09-30): the ONLY two completeness defaults for stored
 * diagnostics — no other field is ever defaulted.
 *  - no density      -> `density: "medium"`
 *  - no hair length  -> `hairLength: "long"`
 *
 * Wave-1 fix F2: a default only fills a HOLE. When the winning projection lacks the field but
 * the EXISTING profile has a real value for it (see `existingCompletenessValues`), that value
 * is kept — with its existing provenance — and only when neither has one is the default
 * applied (marked `assumed`).
 *
 * Applied to the NATIVE diagnostics of a projection (artifact / legacy lead / legacy columns)
 * by the account-link writer and by the backfill planner. `source` — and with it
 * `source.raw` — is carried through by reference and never modified, so an unedited facts
 * record still re-emits the original envelope via `toStage1Source` and neither a guessed nor a
 * carried-over value ever enters a plan computation.
 *
 * Pure: no I/O, no `server-only`.
 */

export type CompletenessDefaultField = "density" | "hairLength"

const COMPLETENESS_FIELDS = ["density", "hairLength"] as const satisfies CompletenessDefaultField[]

const DEFAULTS: Record<CompletenessDefaultField, string> = {
  density: "medium",
  hairLength: "long",
}

/** The legacy `hair_profiles` column each completeness field derives into. */
const COLUMN_OF: Record<CompletenessDefaultField, "density" | "hair_length"> = {
  density: "density",
  hairLength: "hair_length",
}

/** A real value the existing profile already has, and the per-field provenance it carries
 * there (`undefined` when the stored document never recorded one). */
export type ExistingFieldValue = { value: string; provenance?: FieldProvenanceValue }

export type ExistingCompletenessValues = Partial<
  Record<CompletenessDefaultField, ExistingFieldValue>
>

export type KeptField = { field: CompletenessDefaultField; provenance?: FieldProvenanceValue }

export type CompletenessDefaultsResult = {
  diagnostics: DiagnosticsV1
  /** The fields this call filled with a default, in a fixed order; the caller records each one
   * as `fields.<name> = "assumed"` in the domain provenance. */
  assumedFields: CompletenessDefaultField[]
  /** The fields this call filled from the existing profile (F2), in the same fixed order, with
   * the provenance they keep. */
  keptFields: KeptField[]
}

function parseField(field: CompletenessDefaultField, value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const parsed = diagnosticsV1Schema.shape[field].safeParse(value)
  return parsed.success ? (parsed.data as string) : undefined
}

/**
 * F2: the real density / hair length the existing profile already has — "facts, else legacy
 * column" (Nick, 2026-09-30).
 *  - a facts value counts unless its provenance marks it `assumed` (a default is no real
 *    value); it keeps that provenance.
 *  - otherwise the legacy column counts (`unknown_historical`: nothing about it is provable) —
 *    unless it is merely the derived projection of that same assumed fact.
 *  - a value outside the native vocabulary is no value at all.
 *  - `preferColumns` (the backfill's `--catch-up`, wave-1 fix round 2): that mode only runs
 *    because a live legacy writer changed the columns AFTER the stored facts were written, so
 *    a column value is the newer real value and comes first; the stored fact is the fallback.
 */
export function existingCompletenessValues(input: {
  diagnostics?: DiagnosticsV1 | null
  fields?: Record<string, FieldProvenanceValue> | null
  columns?: { density?: string | null; hair_length?: string | null } | null
  preferColumns?: boolean
}): ExistingCompletenessValues {
  const existing: ExistingCompletenessValues = {}
  for (const field of COMPLETENESS_FIELDS) {
    const factsValue = parseField(field, input.diagnostics?.[field])
    const factsProvenance = input.fields?.[field]
    if (input.preferColumns) {
      const newerColumn = parseField(field, input.columns?.[COLUMN_OF[field]])
      if (newerColumn !== undefined) {
        existing[field] = { value: newerColumn, provenance: "unknown_historical" }
        continue
      }
    }
    if (factsValue !== undefined && factsProvenance !== "assumed") {
      existing[field] = {
        value: factsValue,
        ...(factsProvenance ? { provenance: factsProvenance } : {}),
      }
      continue
    }
    const columnValue = parseField(field, input.columns?.[COLUMN_OF[field]])
    if (columnValue !== undefined && columnValue !== factsValue) {
      existing[field] = { value: columnValue, provenance: "unknown_historical" }
    }
  }
  return existing
}

export function applyCompletenessDefaults(
  diagnostics: DiagnosticsV1,
  existing: ExistingCompletenessValues = {},
): CompletenessDefaultsResult {
  const assumedFields: CompletenessDefaultField[] = []
  const keptFields: KeptField[] = []
  const next: Record<string, unknown> = { ...diagnostics }

  for (const field of COMPLETENESS_FIELDS) {
    if (next[field] !== undefined) continue
    const kept = existing[field]
    if (kept) {
      next[field] = kept.value
      keptFields.push({ field, ...(kept.provenance ? { provenance: kept.provenance } : {}) })
    } else {
      next[field] = DEFAULTS[field]
      assumedFields.push(field)
    }
  }

  return { diagnostics: next as DiagnosticsV1, assumedFields, keptFields }
}

/** `{ density: "assumed", hairLength: "user", ... }` for a provenance `fields` map: every
 * default as `assumed`, every kept value with the provenance it already had. */
export function completenessFieldProvenance(
  assumedFields: readonly CompletenessDefaultField[],
  keptFields: readonly KeptField[] = [],
): Record<string, FieldProvenanceValue> {
  const fields: Record<string, FieldProvenanceValue> = {}
  for (const field of assumedFields) fields[field] = "assumed"
  for (const kept of keptFields) if (kept.provenance) fields[kept.field] = kept.provenance
  return fields
}
