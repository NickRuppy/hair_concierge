import type { DiagnosticsV1, FieldProvenanceValue } from "./schema"

/**
 * Decision wave 1, item B (Nick, 2026-09-30): the ONLY two completeness defaults for stored
 * diagnostics — no other field is ever defaulted.
 *  - no density      -> `density: "medium"`
 *  - no hair length  -> `hairLength: "long"`
 *
 * Applied to the NATIVE diagnostics of a projection (artifact / legacy lead / legacy columns)
 * by the account-link writer and by the backfill planner. `source` — and with it
 * `source.raw` — is carried through by reference and never modified, so an unedited facts
 * record still re-emits the original envelope via `toStage1Source` and a guessed value never
 * enters a plan computation.
 *
 * Pure: no I/O, no `server-only`.
 */

export type CompletenessDefaultField = "density" | "hairLength"

export type CompletenessDefaultsResult = {
  diagnostics: DiagnosticsV1
  /** The fields this call filled in, in a fixed order; the caller records each one as
   * `fields.<name> = "assumed"` in the domain provenance. */
  assumedFields: CompletenessDefaultField[]
}

export function applyCompletenessDefaults(diagnostics: DiagnosticsV1): CompletenessDefaultsResult {
  const assumedFields: CompletenessDefaultField[] = []
  const next: DiagnosticsV1 = { ...diagnostics }

  if (next.density === undefined) {
    next.density = "medium"
    assumedFields.push("density")
  }
  if (next.hairLength === undefined) {
    next.hairLength = "long"
    assumedFields.push("hairLength")
  }

  return { diagnostics: next, assumedFields }
}

/** `{ density: "assumed", ... }` for a provenance `fields` map. */
export function assumedFieldProvenance(
  assumedFields: readonly CompletenessDefaultField[],
): Record<string, FieldProvenanceValue> {
  return Object.fromEntries(assumedFields.map((field) => [field, "assumed" as const]))
}
