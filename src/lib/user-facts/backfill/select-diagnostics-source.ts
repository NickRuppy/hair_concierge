import type { QuizAnswers } from "@/lib/quiz/types"

import { applyCompletenessDefaults, type CompletenessDefaultField } from "../completeness-defaults"
import { deriveDiagnosticsColumns } from "../derive-legacy-columns"
import { projectArtifactToFacts } from "../project-artifact"
import { projectLegacyLeadToFacts } from "../project-legacy-lead"
import type { DiagnosticsV1, QuizContextV1 } from "../schema"
import {
  legacyColumnsToDiagnostics,
  type LegacyDiagnosticColumns,
} from "./legacy-columns-to-diagnostics"

/**
 * P4 source precedence for the diagnostics backfill: the attached personal-plan artifact wins,
 * then the legacy lead, then the row's own legacy columns. The artifact/lead branches are real
 * quiz envelopes (richer and native); the columns branch is the lossy last resort.
 *
 * P4 (b) also asks for the disagreement to be VISIBLE rather than silently overwritten: when
 * an artifact or lead wins, the diagnostics it projects are re-derived back into legacy
 * columns and compared with what the row already stores. Two kinds of divergence are
 * reported, and nothing is skipped or changed because of either:
 *  - a CONFLICT: both sides carry a value on one of the fields legacy readers branch on, and
 *    the values differ (a null column is "no prior answer", not a disagreement).
 *  - an ERASURE (controller ruling 2026-09-16, I2): the column carries a value and the
 *    winner's derived value is `null`/`[]`. `user_facts_save_v1` rewrites every
 *    diagnostics-owned column from the merged document, so a PARTIAL winner (an incomplete
 *    legacy lead) silently nulls columns legacy readers use. Nick has to see that before
 *    `--apply`, so it is listed across ALL diagnostics-owned columns, not just the six
 *    conflict fields.
 *
 * Decision wave 1, item B (Nick, 2026-09-30): the winning projection gets the two completeness
 * defaults (`applyCompletenessDefaults`: density -> "medium", hair length -> "long") BEFORE the
 * P4 diff, so the conflict/erasure report shows exactly what the write would store (a default
 * that replaces a real column value surfaces as a conflict). The signal check runs on the
 * projection WITHOUT defaults — a default is never a diagnostic signal.
 *
 * Pure: no I/O, no `server-only`.
 */

/** The fields a legacy reader actually branches on, and the ones the plan names for the P4
 * diff. Derived-only aggregates (concerns/goals/chemical_treatment) are deliberately out:
 * they are lossy in both directions and would drown the signal. */
const CONFLICT_FIELDS = [
  "hair_texture",
  "thickness",
  "density",
  "hair_length",
  "scalp_type",
  "scalp_condition",
] as const

/** Every legacy column `user_facts_save_v1` recomputes from the `diagnostics` document, i.e.
 * every column a partial winner can erase. */
export const DIAGNOSTICS_OWNED_COLUMNS = [
  "hair_texture",
  "thickness",
  "density",
  "hair_length",
  "cuticle_condition",
  "protein_moisture_balance",
  "scalp_type",
  "scalp_condition",
  "chemical_treatment",
  "concerns",
  "goals",
  "desired_volume",
  "primary_concern",
] as const

export type DiagnosticsColumnConflictField = {
  field: (typeof CONFLICT_FIELDS)[number]
  column: string
  derived: string
}

export type DiagnosticsColumnErasureField = {
  field: (typeof DIAGNOSTICS_OWNED_COLUMNS)[number]
  /** The value the column carries today and that the winner would blank out. */
  column: string
}

export type UnusableDiagnosticsSource = {
  kind: "artifact" | "lead"
  id: string
  reason: string
}

export type SelectedDiagnosticsSource = {
  sourceKind: "artifact" | "lead" | "columns"
  /** The artifact id / lead id the diagnostics came from; absent for the columns branch. */
  sourceId?: string
  diagnostics: DiagnosticsV1
  /** Completeness defaults applied to `diagnostics`; the planner records each as `assumed`. */
  assumedFields: CompletenessDefaultField[]
  quizContext?: QuizContextV1
  conflict?: { fields: DiagnosticsColumnConflictField[]; erasures: DiagnosticsColumnErasureField[] }
  /** Higher-precedence sources that exist but could not be projected (reported, never guessed
   * around). */
  unusableSources: UnusableDiagnosticsSource[]
}

export type SelectDiagnosticsSourceInput = {
  artifact: { id: string; leadId: string; quizAnswers: unknown } | null
  legacyLead: { id: string; quizAnswers: unknown } | null
  columns: LegacyDiagnosticColumns
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * A projected source only wins if it actually says something. `projectLegacyLeadToFacts`
 * returns PARTIAL diagnostics for an incomplete lead (task 5a ruling), and an empty or
 * unreadable `leads.quiz_answers` projects into a document carrying nothing but the four
 * always-present empty arrays. Letting that win would not just add nothing, it would erase
 * the row's `concerns`/`goals`/`chemical_treatment` columns (an empty array is a real value
 * the RPC derives and writes), so a signal-free projection steps aside for the next source.
 */
function hasDiagnosticSignal(diagnostics: DiagnosticsV1): boolean {
  return Object.entries(diagnostics).some(([field, value]) => {
    if (field === "source") return false
    if (Array.isArray(value)) return value.length > 0
    return value !== undefined
  })
}

function columnCarriesValue(value: string | string[] | null): boolean {
  return Array.isArray(value) ? value.length > 0 : value !== null
}

function renderColumnValue(value: string | readonly string[]): string {
  return Array.isArray(value) ? value.join(",") : (value as string)
}

function detectConflict(
  diagnostics: DiagnosticsV1,
  columns: LegacyDiagnosticColumns,
):
  | { fields: DiagnosticsColumnConflictField[]; erasures: DiagnosticsColumnErasureField[] }
  | undefined {
  const derived = deriveDiagnosticsColumns(diagnostics)
  const fields: DiagnosticsColumnConflictField[] = []
  const erasures: DiagnosticsColumnErasureField[] = []

  for (const field of CONFLICT_FIELDS) {
    const columnValue = columns[field]
    const derivedValue = derived[field]
    if (columnValue === null || derivedValue === null) continue
    if (columnValue === derivedValue) continue
    fields.push({ field, column: columnValue, derived: derivedValue })
  }

  for (const field of DIAGNOSTICS_OWNED_COLUMNS) {
    const columnValue = columns[field] ?? null
    const derivedValue = derived[field] ?? null
    if (!columnCarriesValue(columnValue)) continue
    if (columnCarriesValue(derivedValue)) continue
    erasures.push({ field, column: renderColumnValue(columnValue!) })
  }

  return fields.length > 0 || erasures.length > 0 ? { fields, erasures } : undefined
}

export function selectDiagnosticsSource(
  input: SelectDiagnosticsSourceInput,
): SelectedDiagnosticsSource {
  const unusableSources: UnusableDiagnosticsSource[] = []

  if (input.artifact) {
    try {
      const projected = projectArtifactToFacts({
        envelope: input.artifact.quizAnswers,
        artifactId: input.artifact.id,
        leadId: input.artifact.leadId,
      })
      if (!hasDiagnosticSignal(projected.diagnostics)) {
        throw new Error("no_diagnostic_signal")
      }
      const { diagnostics, assumedFields } = applyCompletenessDefaults(projected.diagnostics)
      const conflict = detectConflict(diagnostics, input.columns)
      return {
        sourceKind: "artifact",
        sourceId: input.artifact.id,
        diagnostics,
        assumedFields,
        quizContext: projected.quizContext,
        ...(conflict ? { conflict } : {}),
        unusableSources,
      }
    } catch (error) {
      unusableSources.push({
        kind: "artifact",
        id: input.artifact.id,
        reason: messageOf(error),
      })
    }
  }

  if (input.legacyLead) {
    try {
      const projected = projectLegacyLeadToFacts({
        leadId: input.legacyLead.id,
        quizAnswers: input.legacyLead.quizAnswers as QuizAnswers,
      })
      if (!hasDiagnosticSignal(projected.diagnostics)) {
        throw new Error("no_diagnostic_signal")
      }
      const { diagnostics, assumedFields } = applyCompletenessDefaults(projected.diagnostics)
      const conflict = detectConflict(diagnostics, input.columns)
      return {
        sourceKind: "lead",
        sourceId: input.legacyLead.id,
        diagnostics,
        assumedFields,
        ...(conflict ? { conflict } : {}),
        unusableSources,
      }
    } catch (error) {
      unusableSources.push({
        kind: "lead",
        id: input.legacyLead.id,
        reason: messageOf(error),
      })
    }
  }

  const leadId = input.legacyLead?.id ?? input.artifact?.leadId
  const { diagnostics, assumedFields } = applyCompletenessDefaults(
    legacyColumnsToDiagnostics(input.columns, leadId ? { leadId } : {}),
  )
  return {
    sourceKind: "columns",
    diagnostics,
    assumedFields,
    unusableSources,
  }
}
