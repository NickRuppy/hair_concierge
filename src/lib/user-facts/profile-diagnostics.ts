import {
  hasLegacyDiagnosticSignal,
  legacyColumnsToDiagnostics,
  type LegacyDiagnosticColumns,
} from "./backfill/legacy-columns-to-diagnostics"
import { diagnosticsV1Schema, type DiagnosticsV1 } from "./schema"

/**
 * The diagnostics a `hair_profiles` row stands for, in the quiz's vocabulary: the stored facts
 * document, or — for a row the backfill has not reached yet — what its legacy columns convert to
 * under migration table M (`legacyColumnsToDiagnostics`, the backfill's own conversion; there is
 * no second table). Shared by the web editors (preselection), the profile display and the web
 * save (the base a partial edit is written over). Pure; safe on the client.
 */

type ProfileRow = Record<string, unknown>

function text(row: ProfileRow, key: string): string | null {
  return typeof row[key] === "string" ? (row[key] as string) : null
}

function list(row: ProfileRow, key: string): string[] | null {
  const value = row[key]
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : null
}

export function legacyDiagnosticColumnsOf(row: ProfileRow): LegacyDiagnosticColumns {
  return {
    hair_texture: text(row, "hair_texture"),
    thickness: text(row, "thickness"),
    density: text(row, "density"),
    hair_length: text(row, "hair_length"),
    cuticle_condition: text(row, "cuticle_condition"),
    protein_moisture_balance: text(row, "protein_moisture_balance"),
    scalp_type: text(row, "scalp_type"),
    scalp_condition: text(row, "scalp_condition"),
    chemical_treatment: list(row, "chemical_treatment"),
    concerns: list(row, "concerns"),
    goals: list(row, "goals"),
    desired_volume: text(row, "desired_volume"),
    primary_concern: text(row, "primary_concern"),
  }
}

/** The document the row's legacy columns stand for, or `null` when they carry no answer. */
export function diagnosticsFromLegacyColumns(row: ProfileRow): DiagnosticsV1 | null {
  const columns = legacyDiagnosticColumnsOf(row)
  return hasLegacyDiagnosticSignal(columns) ? legacyColumnsToDiagnostics(columns, {}) : null
}

/** Display/preselection read: the stored document when it parses, else the columns. */
export function readProfileDiagnostics(row: ProfileRow | null | undefined): DiagnosticsV1 | null {
  if (!row) return null
  if (row.diagnostics !== null && row.diagnostics !== undefined) {
    const parsed = diagnosticsV1Schema.safeParse(row.diagnostics)
    if (parsed.success) return parsed.data
  }
  return diagnosticsFromLegacyColumns(row)
}
