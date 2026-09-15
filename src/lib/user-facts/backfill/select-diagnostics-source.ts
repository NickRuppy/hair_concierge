import type { QuizAnswers } from "@/lib/quiz/types"

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
 * columns and compared with what the row already stores. Only a field where BOTH sides carry
 * a value and the values differ counts as a conflict — a null column is "no prior answer",
 * not a disagreement. Nothing is skipped or changed because of a conflict; it is reported so
 * Nick sees it in the dry run (measured exposure: 1 user).
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

export type DiagnosticsColumnConflictField = {
  field: (typeof CONFLICT_FIELDS)[number]
  column: string
  derived: string
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
  quizContext?: QuizContextV1
  conflict?: { fields: DiagnosticsColumnConflictField[] }
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

function detectConflict(
  diagnostics: DiagnosticsV1,
  columns: LegacyDiagnosticColumns,
): { fields: DiagnosticsColumnConflictField[] } | undefined {
  const derived = deriveDiagnosticsColumns(diagnostics)
  const fields: DiagnosticsColumnConflictField[] = []

  for (const field of CONFLICT_FIELDS) {
    const columnValue = columns[field]
    const derivedValue = derived[field]
    if (columnValue === null || derivedValue === null) continue
    if (columnValue === derivedValue) continue
    fields.push({ field, column: columnValue, derived: derivedValue })
  }

  return fields.length > 0 ? { fields } : undefined
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
      const conflict = detectConflict(projected.diagnostics, input.columns)
      return {
        sourceKind: "artifact",
        sourceId: input.artifact.id,
        diagnostics: projected.diagnostics,
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
      const conflict = detectConflict(projected.diagnostics, input.columns)
      return {
        sourceKind: "lead",
        sourceId: input.legacyLead.id,
        diagnostics: projected.diagnostics,
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
  return {
    sourceKind: "columns",
    diagnostics: legacyColumnsToDiagnostics(input.columns, leadId ? { leadId } : {}),
    unusableSources,
  }
}
