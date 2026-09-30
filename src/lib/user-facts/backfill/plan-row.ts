import type {
  PersonalPlanRefinementAnswersV1,
  Stage2QuestionId,
} from "@/lib/personal-plan/refinement/types"
import { BRUSH_TYPES, type BrushType } from "@/lib/vocabulary/onboarding-care"

import { completenessFieldProvenance } from "../completeness-defaults"
import { deriveCareHabitsColumns, deriveDiagnosticsColumns } from "../derive-legacy-columns"
import { toCareHabitsPatch, toFieldProvenance } from "../from-refinement-draft"
import { mergeDiagnosticsPatch, type DiagnosticsAnswerGroup } from "../hand-edit"
import {
  CARE_HABITS_SCHEMA_VERSION,
  DIAGNOSTICS_SCHEMA_VERSION,
  QUIZ_CONTEXT_SCHEMA_VERSION,
  careHabitsV1Schema,
  diagnosticsV1Schema,
  toTakenAt,
  type CareHabitsPatch,
  type CareHabitsV1,
  type DiagnosticsV1,
  type DiagnosticsPatch,
  type DomainProvenance,
  type FactsProvenance,
  type FieldProvenanceValue,
  type QuizContextPatch,
} from "../schema"
import type { ColumnFinding, ToleratedDifferenceId } from "./detect-hand-edits"
import {
  legacyColumnsToCareHabits,
  type LegacyCareHabitColumns,
} from "./legacy-columns-to-care-habits"
import {
  hasLegacyDiagnosticSignal,
  type LegacyDiagnosticColumns,
} from "./legacy-columns-to-diagnostics"
import {
  resolveStage2Head,
  type BackfillDraftRow,
  type BackfillNeedVersionRow,
  type BackfillPlanRow,
} from "./resolve-stage2-head"
import {
  DIAGNOSTICS_OWNED_COLUMNS,
  selectDiagnosticsSource,
  type DiagnosticsColumnConflictField,
  type DiagnosticsColumnErasureField,
} from "./select-diagnostics-source"

/**
 * Pure composition of one user's backfill plan: which fact domains to write, from which
 * source, with which provenance — and, for everything it refuses to write, why. The script
 * around it only loads rows, prints this plan and (under `--apply`) hands each write to
 * `saveUserFacts`.
 *
 * Rules, all from the plan (§4a F24/F25/F27, §5 P4/H3/R1, §8 task 6):
 *  - diagnostics: attached artifact -> legacy lead -> legacy columns (P4).
 *  - quiz_context: only an artifact carries the 8 reflective answers.
 *  - care_habits: the immutable Stage-2 head whenever ANY refined version exists for the
 *    plan — never the legacy columns while one does. An unresolvable head is reported and
 *    nothing is written for that domain.
 *  - `brushesCombs` is always lifted from `brush_type`: no Stage-2 version ever carried a
 *    brush answer, so it is merged into whichever care_habits patch this row produces.
 *  - Idempotency is PER DOMAIN (fix round 2, P2), not per row: a domain is planned when its
 *    stored value is NULL and no live writer owns it, whatever `facts_revision` says; a
 *    domain that already holds a document is only re-opened by `--catch-up`, and only when
 *    the backfill itself wrote it and its legacy columns have changed since.
 *
 *  - diagnostics (task 7): the winning quiz is the one TAKEN last, and every column a user edited
 *    by hand after it wins over it (`detect-hand-edits.ts`) — provenance `user` for those
 *    fields and `editedAt` = the best known edit time (the iOS edit's publication, else
 *    `hair_profiles.updated_at`), so a quiz taken later still replaces the edit and an older one
 *    does not (`quizSupersedesFacts`). Everything the owner signs off is collected in `report`.
 *
 * No I/O, no `server-only`.
 */

export type LegacyProfileColumns = LegacyDiagnosticColumns &
  LegacyCareHabitColumns & { brush_type: string[] | null }

export type LoadedUserRow = {
  userId: string
  /** Only ever used as the CAS baseline for this row's writes (the script pins every write to
   * it). The plan gate is per DOMAIN and never reads it — see `gateDomain`. */
  factsRevision: number
  factsProvenance: FactsProvenance
  columns: LegacyProfileColumns
  /** Whether the row's `diagnostics` / `care_habits` / `quiz_context` column holds a document
   * at all. Kept apart from `storedDiagnostics` / `storedCareHabits`, which are `null` both
   * for an absent document and for one that does not parse — a distinction the per-domain
   * guard needs: absent means "backfill it", unreadable means "leave it for review". */
  storedDomains: Record<"diagnostics" | "care_habits" | "quiz_context", boolean>
  /** The documents already stored on the row. Only the catch-up comparison reads them: they
   * are what the legacy columns are supposed to equal, so a difference is proof a legacy
   * writer changed the columns after the backfill wrote its facts. */
  storedDiagnostics: DiagnosticsV1 | null
  storedCareHabits: CareHabitsV1 | null
  artifact: {
    id: string
    leadId: string
    quizAnswers: unknown
    createdAt?: string | null
    /** `personal_plan_prepared_artifacts.canonical_profile`: what main's paid link projected. */
    canonicalProfile?: unknown
  } | null
  /** The NEWEST legacy lead; `olderLegacyLeads` holds the rest, newest first. */
  legacyLead: { id: string; quizAnswers: unknown; createdAt?: string | null } | null
  olderLegacyLeads?: { id: string; quizAnswers: unknown; createdAt?: string | null }[]
  /** `hair_profiles.updated_at`: the edit time when nothing better is known. */
  updatedAt?: string | null
  /** When the user's last iOS profile edit / registration was published
   * (`scanner_profile_edits` -> its context version's `created_at`). */
  lastProfileEditAt?: string | null
  plan: BackfillPlanRow | null
  needVersions: readonly BackfillNeedVersionRow[]
  drafts: readonly BackfillDraftRow[]
}

export type PlannedFactsWrite =
  | {
      domain: "diagnostics"
      patch: DiagnosticsPatch
      provenance: DomainProvenance
      fieldCount: number
      detail?: string
    }
  | {
      domain: "quiz_context"
      patch: QuizContextPatch
      provenance: DomainProvenance
      fieldCount: number
      detail?: string
    }
  | {
      domain: "care_habits"
      patch: CareHabitsPatch
      provenance: DomainProvenance
      fieldCount: number
      detail?: string
    }

/** A legacy column the planned writes would change, before -> after (order and `[]`/NULL
 * differences are not changes). */
export type VisibleColumnChange = {
  domain: "diagnostics" | "care_habits"
  column: string
  before: string
  after: string
}

/** Everything the dry-run report shows for one row (task 7). */
export type BackfillRowReport = {
  sourceNote?: string
  editedGroups: DiagnosticsAnswerGroup[]
  ambiguousGroups: DiagnosticsAnswerGroup[]
  findings: ColumnFinding[]
  tolerated: { column: string; id: ToleratedDifferenceId }[]
  notes: string[]
  editedAt?: { at: string; basis: "ios_profile_edit" | "profile_updated_at" | "backfill_time" }
  visibleChanges: VisibleColumnChange[]
}

export type UserFactsBackfillPlan = {
  userId: string
  writes: PlannedFactsWrite[]
  report: BackfillRowReport
  /** Domains (or whole rows) deliberately left alone, with the reason. */
  skips: string[]
  /** Domains whose source could not be resolved at all; these need a human, not a guess. */
  unresolvable: string[]
  conflict?: {
    sourceKind: "artifact" | "lead"
    sourceId: string
    fields: DiagnosticsColumnConflictField[]
    erasures: DiagnosticsColumnErasureField[]
  }
}

export type PlanUserFactsBackfillOptions = {
  now: string
  catchUp: boolean
}

/** The provenance source kinds this backfill itself writes. Every other kind belongs to a
 * live writer and is never overwritten, not even in catch-up mode. */
const BACKFILL_SOURCE_KINDS = new Set<DomainProvenance["source"]["kind"]>([
  "legacy_columns",
  "personal_plan_artifact",
  "legacy_lead",
  "refined_version",
])

const BRUSH_TYPE_VALUES = new Set<string>(BRUSH_TYPES)

type DomainGate = { plan: true } | { plan: false; reason: string }

/** The columns `user_facts_save_v1` recomputes from the `care_habits` document. */
const CARE_HABITS_OWNED_COLUMNS = [
  "drying_method",
  "heat_styling",
  "styling_tools",
  "uses_heat_protection",
  "towel_material",
  "towel_technique",
  "night_protection",
  "brush_type",
] as const

/** Arrays compare element-wise (so `[]` equals `[]`); everything else compares strictly, which
 * makes `null` equal `null` and a NULL column differ from any derived value. */
function columnValuesEqual(left: unknown, right: unknown): boolean {
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right)) return false
    return left.length === right.length && left.every((value, index) => value === right[index])
  }
  return left === right
}

/**
 * The catch-up signal (controller ruling 2026-09-16, I1). It is CONTENT-based, never
 * timestamp-based: `user_facts_save_v1` itself sets `hair_profiles.updated_at`, so after an
 * `--apply` every backfilled row would look "changed" and a pre-deploy catch-up would re-plan
 * the whole population.
 *
 * Instead, the stored domain document is re-derived into legacy columns — exactly what the
 * RPC wrote into them — and compared with the columns as they stand now. A difference can
 * only have come from a still-live legacy writer, so the domain is re-imported from the
 * authorities; an exact match means nothing happened and the row is left alone.
 */
function legacyColumnsDivergedFromStoredFacts(
  domain: "diagnostics" | "care_habits" | "quiz_context",
  row: LoadedUserRow,
): DomainGate {
  if (domain === "quiz_context") {
    return {
      plan: false,
      reason:
        "quiz_context: owns no legacy columns, so no legacy writer can have changed it since the backfill",
    }
  }

  const stored = domain === "diagnostics" ? row.storedDiagnostics : row.storedCareHabits
  if (!stored) {
    return {
      plan: false,
      reason: `${domain}: provenance says the backfill wrote it, but the stored document is missing or unreadable; left for review`,
    }
  }

  const derived: Record<string, unknown> =
    domain === "diagnostics"
      ? deriveDiagnosticsColumns(stored as DiagnosticsV1)
      : deriveCareHabitsColumns(stored as CareHabitsV1)
  const ownedColumns: readonly string[] =
    domain === "diagnostics" ? DIAGNOSTICS_OWNED_COLUMNS : CARE_HABITS_OWNED_COLUMNS

  const changed = ownedColumns.filter(
    (column) =>
      !columnValuesEqual(
        // `?? null`: an optional column (`primary_concern`) absent from an older snapshot
        // reads as SQL NULL, like the derived side's "nothing".
        (row.columns as unknown as Record<string, unknown>)[column] ?? null,
        derived[column] ?? null,
      ),
  )

  if (changed.length === 0) {
    return {
      plan: false,
      reason: `${domain}: legacy columns still match the stored facts (nothing changed since the backfill)`,
    }
  }
  return { plan: true }
}

/**
 * The per-domain plan gate (controller ruling, fix round 2, P2). `facts_revision` is NOT the
 * gate: a run that wrote diagnostics and then failed on quiz_context left the row at
 * revision 1, and a row-level guard made it unrepairable — every rerun skipped it, and
 * `--catch-up` refused the missing domain for having no provenance of its own.
 *
 * A domain is planned when it holds NO document AND no live writer owns it. That both makes
 * the backfill resumable and lets it close the authority gap for a domain still empty on a
 * row some other writer has already touched. A domain that DOES hold a document is only ever
 * re-opened by `--catch-up`, under the unchanged content-divergence rule below.
 */
function gateDomain(
  domain: "diagnostics" | "care_habits" | "quiz_context",
  row: LoadedUserRow,
  options: PlanUserFactsBackfillOptions,
): DomainGate {
  const provenance = row.factsProvenance[domain]

  if (!row.storedDomains[domain]) {
    if (provenance && !BACKFILL_SOURCE_KINDS.has(provenance.source.kind)) {
      return {
        plan: false,
        reason: `${domain}: empty but last written by ${provenance.source.kind} (a live writer; never filled in by the backfill)`,
      }
    }
    return { plan: true }
  }

  if (!options.catchUp) {
    return {
      plan: false,
      reason: `${domain}: already written (re-run with --catch-up to re-check changed legacy columns)`,
    }
  }
  if (!provenance) {
    return {
      plan: false,
      reason: `${domain}: facts_revision=${row.factsRevision} but no ${domain} provenance (not a backfill row; left for review)`,
    }
  }
  if (!BACKFILL_SOURCE_KINDS.has(provenance.source.kind)) {
    return {
      plan: false,
      reason: `${domain}: last written by ${provenance.source.kind} (a live writer; never overwritten by the backfill)`,
    }
  }
  return legacyColumnsDivergedFromStoredFacts(domain, row)
}

function liftBrushesCombs(brushType: string[] | null): BrushType[] | undefined {
  if (brushType === null) return undefined
  const lifted: BrushType[] = []
  for (const value of brushType) {
    if (BRUSH_TYPE_VALUES.has(value) && !lifted.includes(value as BrushType)) {
      lifted.push(value as BrushType)
    }
  }
  return lifted
}

function countFields(patch: Record<string, unknown>): number {
  return Object.entries(patch).filter(([key, value]) => key !== "source" && value !== null).length
}

const DIAGNOSTICS_DOCUMENT_FIELDS = Object.keys(diagnosticsV1Schema.shape).filter(
  (field) => field !== "source",
)

function renderValue(value: unknown): string {
  if (value === null || value === undefined) return "NULL"
  if (Array.isArray(value)) return value.length > 0 ? value.join(",") : "[]"
  return String(value)
}

/** Order-free, `[]` equals NULL: the canonical forms the plan's migration table accepts. */
function canonicalColumn(value: unknown): string {
  if (Array.isArray(value)) return value.length > 0 ? JSON.stringify([...value].sort()) : "null"
  return JSON.stringify(value ?? null)
}

function visibleChanges(
  domain: VisibleColumnChange["domain"],
  columns: readonly string[],
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): VisibleColumnChange[] {
  return columns
    .filter((column) => canonicalColumn(before[column]) !== canonicalColumn(after[column]))
    .map((column) => ({
      domain,
      column,
      before: renderValue(before[column]),
      after: renderValue(after[column]),
    }))
}

/** The best known time of the hand edit (brief: the iOS edit's timestamp, else `updated_at`). */
function editTime(row: LoadedUserRow, now: string): NonNullable<BackfillRowReport["editedAt"]> {
  const ios = toTakenAt(row.lastProfileEditAt)
  if (ios) return { at: ios, basis: "ios_profile_edit" }
  const updated = toTakenAt(row.updatedAt)
  if (updated) return { at: updated, basis: "profile_updated_at" }
  return { at: now, basis: "backfill_time" }
}

function planDiagnosticsAndContext(
  row: LoadedUserRow,
  options: PlanUserFactsBackfillOptions,
  plan: UserFactsBackfillPlan,
): void {
  const diagnosticsGate = gateDomain("diagnostics", row, options)
  const quizContextGate = gateDomain("quiz_context", row, options)

  // Each domain reports its own gate at its own decision point, so a row that has nothing to
  // write for a domain never prints a skip line about it.
  const hasAnySource =
    row.artifact !== null || row.legacyLead !== null || hasLegacyDiagnosticSignal(row.columns)
  if (!hasAnySource) return

  const selected = selectDiagnosticsSource({
    artifact: row.artifact,
    legacyLead: row.legacyLead,
    olderLegacyLeads: row.olderLegacyLeads,
    columns: row.columns,
    existingFacts: {
      diagnostics: row.storedDiagnostics,
      fields: row.factsProvenance.diagnostics?.fields,
    },
    catchUp: options.catchUp,
  })

  for (const unusable of selected.unusableSources) {
    plan.skips.push(
      `diagnostics: ${unusable.kind} ${unusable.id} could not be projected (${unusable.reason}); fell through to ${selected.sourceKind}`,
    )
  }

  // A columns-only import needs the row to actually carry a legacy answer; otherwise the
  // "document" would be nothing but a source envelope and would still consume the
  // revision-0 guard.
  if (selected.sourceKind === "columns" && !hasLegacyDiagnosticSignal(row.columns)) return

  if (selected.conflict && selected.sourceKind !== "columns") {
    plan.conflict = {
      sourceKind: selected.sourceKind,
      sourceId: selected.sourceId!,
      fields: selected.conflict.fields,
      erasures: selected.conflict.erasures,
    }
  }

  const sourceKind =
    selected.sourceKind === "artifact"
      ? ("personal_plan_artifact" as const)
      : selected.sourceKind === "lead"
        ? ("legacy_lead" as const)
        : ("legacy_columns" as const)

  const handEdits = selected.handEdits
  if (selected.sourceOrderNote) plan.report.sourceNote = selected.sourceOrderNote

  if (diagnosticsGate.plan) {
    const patch: DiagnosticsPatch = { ...selected.diagnostics }
    // A stored document (only `--catch-up` re-plans one) is REPLACED, not merged into: a field
    // the new document drops must not survive from the old one.
    if (row.storedDiagnostics) {
      for (const field of DIAGNOSTICS_DOCUMENT_FIELDS) {
        if ((patch as Record<string, unknown>)[field] === undefined) {
          ;(patch as Record<string, unknown>)[field] = null
        }
      }
    }
    // Decision wave 1, item B + wave-1 fix F2: the completeness defaults are marked `assumed`,
    // the values kept from the existing profile keep their provenance, and both are named on
    // the dry-run line. Task 7: a hand-edited column's field is `user`, a column the quiz never
    // wrote that fills its gap is `unknown_historical`.
    const assumed = selected.assumedFields
    const kept = selected.keptFields
    const fields: Record<string, FieldProvenanceValue> = {}
    for (const field of handEdits?.userFields ?? []) fields[field] = "user"
    for (const field of handEdits?.keptFields ?? []) fields[field] = "unknown_historical"
    Object.assign(fields, completenessFieldProvenance(assumed, kept))
    const edited =
      handEdits !== undefined &&
      handEdits.editedGroups.length + handEdits.ambiguousGroups.length > 0
    const editedAt = edited ? editTime(row, options.now) : undefined
    const details = [
      ...(kept.length > 0
        ? [`kept ${kept.map(({ field }) => `${field}=${patch[field]}`).join(", ")}`]
        : []),
      ...(assumed.length > 0
        ? [`assumed ${assumed.map((field) => `${field}=${patch[field]}`).join(", ")}`]
        : []),
    ]
    plan.writes.push({
      domain: "diagnostics",
      patch,
      provenance: {
        source: { kind: sourceKind, ...(selected.sourceId ? { id: selected.sourceId } : {}) },
        schemaVersion: DIAGNOSTICS_SCHEMA_VERSION,
        at: options.now,
        ...(editedAt ? { editedAt: editedAt.at } : {}),
        ...(Object.keys(fields).length > 0 ? { fields } : {}),
      },
      fieldCount: countFields(patch),
      ...(details.length > 0 ? { detail: details.join("; ") } : {}),
    })

    if (handEdits) {
      plan.report.editedGroups = handEdits.editedGroups
      plan.report.ambiguousGroups = handEdits.ambiguousGroups
      plan.report.findings = handEdits.findings
      plan.report.tolerated = handEdits.tolerated
      plan.report.notes.push(...handEdits.notes)
    }
    if (editedAt) plan.report.editedAt = editedAt
    const after = deriveDiagnosticsColumns(mergeDiagnosticsPatch(row.storedDiagnostics, patch))
    plan.report.visibleChanges.push(
      ...visibleChanges(
        "diagnostics",
        DIAGNOSTICS_OWNED_COLUMNS,
        row.columns as unknown as Record<string, unknown>,
        after,
      ),
    )
  } else {
    plan.skips.push(diagnosticsGate.reason)
  }

  if (selected.quizContext && Object.keys(selected.quizContext).length > 0) {
    if (quizContextGate.plan) {
      const patch: QuizContextPatch = { ...selected.quizContext }
      plan.writes.push({
        domain: "quiz_context",
        patch,
        provenance: {
          source: { kind: sourceKind, ...(selected.sourceId ? { id: selected.sourceId } : {}) },
          schemaVersion: QUIZ_CONTEXT_SCHEMA_VERSION,
          at: options.now,
        },
        fieldCount: countFields(patch),
      })
    } else {
      plan.skips.push(quizContextGate.reason)
    }
  }
}

/** Care habits keep today's conversion (task 7 addendum: four product decisions pending); the
 * report still lists every column the write changes, erasures included. */
function reportCareChanges(
  row: LoadedUserRow,
  patch: CareHabitsPatch,
  plan: UserFactsBackfillPlan,
): void {
  const merged: Record<string, unknown> = { ...(row.storedCareHabits ?? {}), ...patch }
  for (const [key, value] of Object.entries(patch)) if (value === null) delete merged[key]
  const parsed = careHabitsV1Schema.safeParse(merged)
  if (!parsed.success) return
  plan.report.visibleChanges.push(
    ...visibleChanges(
      "care_habits",
      CARE_HABITS_OWNED_COLUMNS,
      row.columns as unknown as Record<string, unknown>,
      deriveCareHabitsColumns(parsed.data),
    ),
  )
}

function planCareHabits(
  row: LoadedUserRow,
  options: PlanUserFactsBackfillOptions,
  plan: UserFactsBackfillPlan,
): void {
  const gate = gateDomain("care_habits", row, options)
  const brushesCombs = liftBrushesCombs(row.columns.brush_type)
  const hasRefinedVersion = row.needVersions.some((version) => version.kind === "refined")

  if (!hasRefinedVersion) {
    if (!gate.plan) {
      plan.skips.push(gate.reason)
      return
    }
    const patch: CareHabitsPatch = {
      ...legacyColumnsToCareHabits(row.columns),
      ...(brushesCombs ? { brushesCombs } : {}),
    }
    if (Object.keys(patch).length === 0) return

    // Legacy columns carry no per-answer provenance at all — nothing here is provable.
    const fields: Record<string, FieldProvenanceValue> = {}
    for (const key of Object.keys(patch)) fields[key] = "unknown_historical"

    reportCareChanges(row, patch, plan)
    plan.writes.push({
      domain: "care_habits",
      patch,
      provenance: {
        source: { kind: "legacy_columns" },
        schemaVersion: CARE_HABITS_SCHEMA_VERSION,
        at: options.now,
        fields,
      },
      fieldCount: countFields(patch),
      detail: "no refined version",
    })
    return
  }

  const head = resolveStage2Head({
    plan: row.plan,
    needVersions: row.needVersions,
    drafts: row.drafts,
  })

  if (head.kind === "none") {
    plan.unresolvable.push(
      "care_habits: refined versions exist but the plan has no current_refined_need_version_id",
    )
    return
  }
  if (head.kind === "unresolvable") {
    plan.unresolvable.push(`care_habits: ${head.reason}`)
    return
  }
  if (!gate.plan) {
    plan.skips.push(gate.reason)
    return
  }

  const patch: CareHabitsPatch = {
    ...toCareHabitsPatch(head.answers as PersonalPlanRefinementAnswersV1),
    ...(brushesCombs ? { brushesCombs } : {}),
  }

  const fields = toFieldProvenance({
    completedQuestionIds: head.completedQuestionIds as Stage2QuestionId[],
    answerProvenance: head.answerProvenance,
  })
  if (head.provenanceSource === "unknown_historical") {
    // F27: nothing about this head's answers is provable, so no field may claim "user".
    // The question-id -> field mapping still comes from `toFieldProvenance` so it is never
    // duplicated here.
    for (const key of Object.keys(fields)) fields[key] = "unknown_historical"
  }
  if (brushesCombs) fields.brushesCombs = "unknown_historical"

  reportCareChanges(row, patch, plan)
  plan.writes.push({
    domain: "care_habits",
    patch,
    provenance: {
      source: { kind: "refined_version", id: head.version.id },
      schemaVersion: CARE_HABITS_SCHEMA_VERSION,
      at: options.now,
      fields,
    },
    fieldCount: countFields(patch),
    detail: `provenance ${head.provenanceSource}`,
  })
}

export function planUserFactsBackfill(
  row: LoadedUserRow,
  options: PlanUserFactsBackfillOptions,
): UserFactsBackfillPlan {
  const plan: UserFactsBackfillPlan = {
    userId: row.userId,
    writes: [],
    report: {
      editedGroups: [],
      ambiguousGroups: [],
      findings: [],
      tolerated: [],
      notes: [],
      visibleChanges: [],
    },
    skips: [],
    unresolvable: [],
  }

  planDiagnosticsAndContext(row, options, plan)
  planCareHabits(row, options, plan)
  return plan
}
