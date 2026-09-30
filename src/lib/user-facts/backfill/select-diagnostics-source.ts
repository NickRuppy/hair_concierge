import type { QuizAnswers } from "@/lib/quiz/types"

import {
  applyCompletenessDefaults,
  existingCompletenessValues,
  type CompletenessDefaultField,
  type ExistingCompletenessValues,
  type KeptField,
} from "../completeness-defaults"
import { deriveDiagnosticsColumns } from "../derive-legacy-columns"
import { projectArtifactToFacts } from "../project-artifact"
import { projectLegacyLeadToFacts } from "../project-legacy-lead"
import {
  toTakenAt,
  type DiagnosticsV1,
  type DomainProvenance,
  type FieldProvenanceValue,
  type QuizContextV1,
} from "../schema"
import {
  COMPARED_COLUMNS,
  columnsMatchOldWriter,
  detectHandEdits,
  oldWriterColumnsForArtifact,
  oldWriterColumnsForLead,
  type HandEditAnalysis,
  type OldWriterColumns,
} from "./detect-hand-edits"
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
 * Decision wave 1, item B (Nick, 2026-09-30) + wave-1 fix F2: the winning projection gets the
 * two completeness fills BEFORE the P4 diff, so the conflict/erasure report shows exactly what
 * the write would store. A field the winner lacks is filled from the EXISTING profile's real
 * value first (stored facts, else the legacy column) — so it never shows up as a conflict or
 * an erasure — and only when there is none from the default (density -> "medium", hair length
 * -> "long", marked assumed). The signal check runs on the projection WITHOUT either fill — a
 * filled value is never a diagnostic signal.
 *
 * Clean-switch task 7 (plan 2026-09-30 §3):
 *  - "latest own quiz wins": the candidates are ordered by the time each quiz was TAKEN — a
 *    legacy lead taken after the attached artifact wins over it, and an older lead is still a
 *    fallback when every newer quiz is unusable. Without both timestamps the order stays
 *    artifact -> newest lead -> older leads.
 *  - "a hand edit newer than a quiz is kept": the winner's projection runs through
 *    `detectHandEdits` BEFORE the completeness fills, so every column a user changed after that
 *    quiz wins over it (see `detect-hand-edits.ts`), and the P4 diff below then only shows what
 *    no rule explains.
 *  - fix round 5: a row that is exactly a NON-winning quiz's last link is that link, not edits
 *    (I4) — and since fix round 6 the winner's answers replace it (§3), with a SOURCE NOTE and
 *    every visible change in the report; `--catch-up` compares the columns with the STORED document when that document came
 *    from the winning quiz, so only what changed since `--apply` is an edit (I2).
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
  /** The artifact's lead or the lead itself; absent for the columns branch. */
  sourceLeadId?: string
  /** The artifact id / lead id the diagnostics came from; absent for the columns branch. */
  sourceId?: string
  diagnostics: DiagnosticsV1
  /** Completeness defaults applied to `diagnostics`; the planner records each as `assumed`. */
  assumedFields: CompletenessDefaultField[]
  /** Fields filled from the existing profile instead (F2), with the provenance they keep. */
  keptFields: KeptField[]
  quizContext?: QuizContextV1
  conflict?: { fields: DiagnosticsColumnConflictField[]; erasures: DiagnosticsColumnErasureField[] }
  /** Higher-precedence sources that exist but could not be projected (reported, never guessed
   * around). */
  unusableSources: UnusableDiagnosticsSource[]
  /** Which columns were edited by hand after the winning quiz (artifact / lead only). */
  handEdits?: HandEditAnalysis
  /** Set when the quiz-time order put a legacy lead ahead of the attached artifact. */
  sourceOrderNote?: string
  /** Set when the columns are exactly what a NON-winning quiz's link wrote (fix round 5, I4);
   * the winner replaces them (fix round 6, I4). */
  lastLinkNote?: string
  /** `--catch-up` against the stored document (fix round 5, I2): the stored document's
   * provenance, whose `editedAt` and `user` fields carry over. Absent on a first run and when a
   * different quiz than the stored one now wins. */
  catchUpBase?: DomainProvenance
  /** `--catch-up` where a different quiz than the stored document's now wins. */
  catchUpNote?: string
}

type LegacyLeadCandidate = { id: string; quizAnswers: unknown; createdAt?: string | null }

export type SelectDiagnosticsSourceInput = {
  /** `createdAt`: the quiz's own timestamp, stored as `source.takenAt` (wave-1 fix F1). */
  artifact: {
    id: string
    leadId: string
    quizAnswers: unknown
    createdAt?: string | null
    /** The `canonical_profile` main's paid link projected into the columns (task 7). */
    canonicalProfile?: unknown
  } | null
  /** The user's NEWEST legacy lead. */
  legacyLead: LegacyLeadCandidate | null
  /** The user's other legacy leads, newest first: fallbacks, and evidence for the goals rule. */
  olderLegacyLeads?: readonly LegacyLeadCandidate[]
  columns: LegacyDiagnosticColumns
  /** The diagnostics document already stored on the row (only in `--catch-up`) and its
   * per-field provenance: F2's "facts, else legacy column" existing value. */
  existingFacts?: {
    diagnostics: DiagnosticsV1 | null
    fields?: Record<string, FieldProvenanceValue>
    /** The stored domain provenance: in `--catch-up` it names the quiz the stored document came
     * from, so the columns are compared with that document rather than the quiz's old writer. */
    provenance?: DomainProvenance | null
  }
  /** `--catch-up`: the columns changed after the stored facts, so they are the newer existing
   * value (wave-1 fix round 2). */
  catchUp?: boolean
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

type Candidate =
  | { kind: "artifact"; artifact: NonNullable<SelectDiagnosticsSourceInput["artifact"]> }
  | { kind: "lead"; lead: LegacyLeadCandidate }

function takenTime(value: string | null | undefined): number | null {
  const iso = toTakenAt(value)
  return iso ? Date.parse(iso) : null
}

/** "Latest own quiz wins" (plan §3): the lead only moves ahead of the artifact when both quiz
 * times are known and the lead's is later. */
function orderCandidates(input: SelectDiagnosticsSourceInput): {
  candidates: Candidate[]
  note?: string
} {
  const leads: Candidate[] = [
    ...(input.legacyLead ? [input.legacyLead] : []),
    ...(input.olderLegacyLeads ?? []),
  ].map((lead) => ({ kind: "lead" as const, lead }))
  if (!input.artifact) return { candidates: leads }
  const artifact: Candidate = { kind: "artifact", artifact: input.artifact }
  const artifactTime = takenTime(input.artifact.createdAt)
  const leadTime = takenTime(input.legacyLead?.createdAt)
  if (input.legacyLead && artifactTime !== null && leadTime !== null && leadTime > artifactTime) {
    const newer = leads.filter(
      (candidate) =>
        candidate.kind === "lead" && (takenTime(candidate.lead.createdAt) ?? 0) > artifactTime,
    )
    const older = leads.filter((candidate) => !newer.includes(candidate))
    return {
      candidates: [...newer, artifact, ...older],
      note: `legacy lead ${input.legacyLead.id} (${toTakenAt(input.legacyLead.createdAt)}) was taken after artifact ${input.artifact.id} (${toTakenAt(input.artifact.createdAt)}): the lead wins`,
    }
  }
  return { candidates: [artifact, ...leads] }
}

function oldWriterOf(candidate: Candidate): OldWriterColumns | null {
  return candidate.kind === "artifact"
    ? oldWriterColumnsForArtifact(candidate.artifact)
    : oldWriterColumnsForLead(candidate.lead.quizAnswers)
}

function candidateId(candidate: Candidate): string {
  return candidate.kind === "artifact" ? candidate.artifact.id : candidate.lead.id
}

function candidateTakenAt(candidate: Candidate): string | null | undefined {
  return candidate.kind === "artifact" ? candidate.artifact.createdAt : candidate.lead.createdAt
}

function candidateLabel(candidate: Candidate): string {
  const taken = toTakenAt(candidateTakenAt(candidate))
  return `${candidate.kind === "artifact" ? "artifact" : "legacy lead"} ${candidateId(candidate)}${taken ? ` (${taken})` : ""}`
}

/** Whether the stored document came from this candidate (its provenance names it). */
function storedFrom(provenance: DomainProvenance | null | undefined, candidate: Candidate) {
  const source = provenance?.source
  if (!source?.id) return false
  return candidate.kind === "artifact"
    ? source.kind === "personal_plan_artifact" && source.id === candidate.artifact.id
    : source.kind === "legacy_lead" && source.id === candidate.lead.id
}

/** The stored document's own derived columns: exactly what the door wrote into the row — the
 * "old writer" of a `--catch-up` run (fix round 5, I2). */
function storedDocumentColumns(stored: DiagnosticsV1): OldWriterColumns {
  const derived = deriveDiagnosticsColumns(stored)
  const written: OldWriterColumns = {}
  for (const column of COMPARED_COLUMNS) written[column] = derived[column]
  return written
}

export function selectDiagnosticsSource(
  input: SelectDiagnosticsSourceInput,
): SelectedDiagnosticsSource {
  const unusableSources: UnusableDiagnosticsSource[] = []
  const existing: ExistingCompletenessValues = existingCompletenessValues({
    diagnostics: input.existingFacts?.diagnostics,
    fields: input.existingFacts?.fields,
    columns: input.columns,
    preferColumns: input.catchUp === true,
  })
  const { candidates, note } = orderCandidates(input)

  for (const candidate of candidates) {
    try {
      const projected =
        candidate.kind === "artifact"
          ? projectArtifactToFacts({
              envelope: candidate.artifact.quizAnswers,
              artifactId: candidate.artifact.id,
              leadId: candidate.artifact.leadId,
              takenAt: candidate.artifact.createdAt,
            })
          : projectLegacyLeadToFacts({
              leadId: candidate.lead.id,
              quizAnswers: candidate.lead.quizAnswers as QuizAnswers,
              takenAt: candidate.lead.createdAt,
            })
      if (!hasDiagnosticSignal(projected.diagnostics)) {
        throw new Error("no_diagnostic_signal")
      }
      const storedProvenance = input.existingFacts?.provenance
      const storedDocument = input.existingFacts?.diagnostics
      const catchUpBase =
        input.catchUp === true && storedDocument && storedFrom(storedProvenance, candidate)
          ? storedProvenance!
          : undefined
      let handEdits: HandEditAnalysis
      let lastLinkNote: string | undefined
      if (catchUpBase) {
        // After `--apply` the columns are the door's derivation of the stored document: only a
        // column that differs from it changed since, and every other one keeps the document's
        // native value.
        handEdits = detectHandEdits({
          native: storedDocument!,
          columns: input.columns,
          oldWriter: storedDocumentColumns(storedDocument!),
        })
      } else {
        const others = candidates.filter((other) => other !== candidate)
        const olderQuizGoals = others
          .map((other) => oldWriterOf(other)?.goals)
          .filter((goals): goals is string[] => Array.isArray(goals) && goals.length > 0)
        const detect = (lastLink?: OldWriterColumns) =>
          detectHandEdits({
            native: projected.diagnostics,
            columns: input.columns,
            oldWriter: oldWriterOf(candidate),
            olderQuizGoals,
            ...(lastLink ? { lastLink } : {}),
          })
        handEdits = detect()
        // The row may reflect the LAST LINK rather than the winner (fix round 5, I4). A
        // goals-only difference is not that: main's link kept existing goals when a later quiz
        // was linked (the goals rule in `detect-hand-edits.ts` lists it as ambiguous).
        const differsBeyondGoals = handEdits.findings.some(
          (finding) =>
            (finding.verdict === "edited" || finding.verdict === "ambiguous") &&
            finding.column !== "goals",
        )
        if (differsBeyondGoals) {
          for (const other of others) {
            const written = oldWriterOf(other)
            if (!written || !columnsMatchOldWriter(input.columns, written)) continue
            handEdits = detect(written)
            const winnerTime = takenTime(candidateTakenAt(candidate))
            const otherTime = takenTime(candidateTakenAt(other))
            const order =
              winnerTime !== null && otherTime !== null && winnerTime > otherTime
                ? "taken later"
                : "wins by precedence (quiz times unknown)"
            lastLinkNote = `columns matched quiz ${candidateLabel(other)}, winner ${candidateLabel(candidate)} ${order}: the winner's answers replace the columns; every visible change is listed`
            break
          }
        }
      }
      const { diagnostics, assumedFields, keptFields } = applyCompletenessDefaults(
        handEdits.diagnostics,
        existing,
      )
      const conflict = detectConflict(diagnostics, input.columns)
      const winnerIsFirst = candidate === candidates[0]
      const storedSource = storedProvenance?.source
      const catchUpNote =
        input.catchUp === true && storedDocument && !catchUpBase && storedSource
          ? `catch-up: ${candidateLabel(candidate)} now wins over the stored ${storedSource.kind}${storedSource.id ? ` ${storedSource.id}` : ""}; compared with its old writer like a first run`
          : undefined
      return {
        sourceKind: candidate.kind,
        sourceId: candidateId(candidate),
        sourceLeadId: candidate.kind === "artifact" ? candidate.artifact.leadId : candidate.lead.id,
        diagnostics,
        assumedFields,
        keptFields,
        ...("quizContext" in projected
          ? { quizContext: (projected as { quizContext: QuizContextV1 }).quizContext }
          : {}),
        ...(conflict ? { conflict } : {}),
        unusableSources,
        handEdits,
        ...(note && winnerIsFirst ? { sourceOrderNote: note } : {}),
        ...(lastLinkNote ? { lastLinkNote } : {}),
        ...(catchUpBase ? { catchUpBase } : {}),
        ...(catchUpNote ? { catchUpNote } : {}),
      }
    } catch (error) {
      unusableSources.push({
        kind: candidate.kind,
        id: candidateId(candidate),
        reason: messageOf(error),
      })
    }
  }

  const leadId = input.legacyLead?.id ?? input.artifact?.leadId
  const { diagnostics, assumedFields, keptFields } = applyCompletenessDefaults(
    legacyColumnsToDiagnostics(input.columns, leadId ? { leadId } : {}),
    existing,
  )
  return {
    sourceKind: "columns",
    diagnostics,
    assumedFields,
    keptFields,
    unusableSources,
  }
}
