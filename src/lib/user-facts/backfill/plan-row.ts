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
  quizContextV1Schema,
  sameFactsDocument,
  sameQuizSourceIdentity,
  toTakenAt,
  type CareHabitsPatch,
  type CareHabitsV1,
  type DiagnosticsV1,
  type DiagnosticsPatch,
  type DomainProvenance,
  type FactsProvenance,
  type FieldProvenanceValue,
  type QuizContextPatch,
  type QuizContextV1,
} from "../schema"
import {
  sameColumn,
  type ColumnFinding,
  type HandEditAnalysis,
  type ToleratedDifferenceId,
} from "./detect-hand-edits"
import {
  convertLegacyCareColumns,
  type CareConversionRule,
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
  type SelectedDiagnosticsSource,
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
 *    fields and `editedAt` = the edit's known lower bound (`editTime`, fix round 5 ruling), so a
 *    quiz taken later still replaces the edit and an older one does not (`quizSupersedesFacts`). Everything the owner signs off is collected in `report`.
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
  /** `hair_profiles.updated_at` exactly as loaded (a string, microseconds kept) — ONLY the
   * row-content CAS token the script hands the door with every write (fix round 6, I1): the
   * deployed legacy writers change columns without touching `facts_revision`. Never an edit time
   * (every write bumps it, the chat's memory included — see `lastProfileEditAt`). */
  loadedUpdatedAt?: string | null
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
  /** The stored quiz_context (`null`: none, or unreadable — `storedDomains` tells them apart).
   * Only `--catch-up` reads it: when the winning quiz changed, the context follows it (fix round
   * 6, I3). */
  storedQuizContext?: QuizContextV1 | null
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
  /** When the user's last iOS profile edit / registration was published
   * (`scanner_profile_edits` -> its context version's `created_at`). `hair_profiles.updated_at`
   * is deliberately NOT an edit time: every write bumps it, the chat's `conversation_memory`
   * included (fix round 5, I3). */
  lastProfileEditAt?: string | null
  /** `scanner_profile_edits.profile_snapshot`: the whole `hair_profiles` row that iOS
   * publication left. Only an edited column that still equals it dates from that publication. */
  lastProfileEditSnapshot?: Record<string, unknown> | null
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
  /** Set when many rows share one change whose `after` differs per row (the report's pattern
   * table groups by it instead of by the values). */
  pattern?: "primary_concern_only_concern"
}

/** How the planned `editedAt` was chosen (fix round 5 ruling on I3). */
export type EditTimeBasis =
  /** The edited columns equal the iOS publication's `profile_snapshot`: its context version time. */
  | "ios_profile_edit"
  /** Only known to be newer than the winning quiz: its `takenAt` + 1 ms. */
  | "after_quiz"
  /** `--catch-up`: changed since the backfill wrote the document: its `at`. */
  | "after_backfill"
  /** `--catch-up`: the stored document's `editedAt` carries over. */
  | "stored_edited_at"
  /** Nothing known at all (a quiz without a time): the run time. */
  | "backfill_time"

export type EditTime = {
  at: string
  basis: EditTimeBasis
  /** Every candidate time, printed in the report beside the chosen one. */
  candidates: Partial<Record<Exclude<EditTimeBasis, "backfill_time">, string>>
}

/** Everything the dry-run report shows for one row (task 7). */
export type BackfillRowReport = {
  sourceNote?: string
  /** The columns are what a non-winning quiz's link wrote (fix round 5, I4); the winner's answers
   * replace them and `visibleChanges` lists every change (fix round 6, I4). */
  lastLinkNote?: string
  editedGroups: DiagnosticsAnswerGroup[]
  ambiguousGroups: DiagnosticsAnswerGroup[]
  findings: ColumnFinding[]
  tolerated: { column: string; id: ToleratedDifferenceId }[]
  notes: string[]
  editedAt?: EditTime
  visibleChanges: VisibleColumnChange[]
  /** The product owner's care-habit decisions 1/2 (Nick 2026-09-30) this row's planned care
   * write applied — listed apart in the report ("care habits: converted by rule"). */
  careRules: CareConversionRule[]
}

export type UserFactsBackfillPlan = {
  userId: string
  writes: PlannedFactsWrite[]
  report: BackfillRowReport
  /** Domains (or whole rows) deliberately left alone, with the reason. */
  skips: string[]
  /** Informational lines about a planned write (a source that fell through, a catch-up source
   * change) — never counted as skips. */
  notes: string[]
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

/**
 * The ownership rule for `quiz_context` (plan §3; fix round 7, B). A context written by the
 * account link or by this backfill — provenance `personal_plan_artifact` / `legacy_lead` —
 * belongs to the quiz it came from and follows the latest-quiz rule: when a later-taken quiz
 * wins, the backfill's catch-up MAY replace or clear it. A context
 * written by any other kind — a user edit (`feinschliff_draft`, `onboarding`, `profile_editor`),
 * `account_link`, or a kind added later — and a stored context without any provenance are NEVER
 * touched by the backfill.
 */
const QUIZ_OWNED_CONTEXT_KINDS = new Set<DomainProvenance["source"]["kind"]>([
  "personal_plan_artifact",
  "legacy_lead",
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

function plusOneMillisecond(iso: string | undefined): string | undefined {
  return iso ? new Date(Date.parse(iso) + 1).toISOString() : undefined
}

function latest(
  times: readonly (readonly [EditTimeBasis, string | undefined])[],
): { at: string; basis: EditTimeBasis } | undefined {
  let best: { at: string; basis: EditTimeBasis } | undefined
  for (const [basis, at] of times) {
    if (at && (!best || Date.parse(at) > Date.parse(best.at))) best = { at, basis }
  }
  return best
}

/**
 * The `editedAt` of a backfilled hand edit (fix round 5 ruling on I3). Only a LOWER bound of the
 * edit is known, and never from `hair_profiles.updated_at` (every write bumps it, the chat's
 * memory included — a quiz taken before a chat but linked after the backfill would lose):
 *  - a web / ambiguous edit is only known to be newer than the winning quiz: its `takenAt` + 1 ms
 *    (in `--catch-up` also newer than the backfill's own write of the document: its `at`);
 *  - an iOS publication (`scanner_profile_edits`) dates exactly the edited columns that still
 *    equal its `profile_snapshot`; an edited column that differs from the snapshot is newer than
 *    that publication: max(iOS time, the bound above).
 * One `editedAt` per domain: the latest over the edited groups; in `--catch-up` the stored
 * `editedAt` carries over and is never lowered.
 */
function editTime(
  row: LoadedUserRow,
  selected: SelectedDiagnosticsSource,
  handEdits: HandEditAnalysis,
  now: string,
): EditTime | undefined {
  const stored = toTakenAt(selected.catchUpBase?.editedAt ?? undefined)
  const changed = handEdits.findings.filter(
    (finding) => finding.verdict === "edited" || finding.verdict === "ambiguous",
  )
  if (changed.length === 0) {
    return stored
      ? { at: stored, basis: "stored_edited_at", candidates: { stored_edited_at: stored } }
      : undefined
  }

  const source = selected.diagnostics.source
  const afterQuiz = plusOneMillisecond("takenAt" in source ? toTakenAt(source.takenAt) : undefined)
  const afterBackfill = selected.catchUpBase ? toTakenAt(selected.catchUpBase.at) : undefined
  const ios = toTakenAt(row.lastProfileEditAt)
  const snapshot = row.lastProfileEditSnapshot ?? null
  const columns = row.columns as unknown as Record<string, string | string[] | null>

  const groupTimes: [EditTimeBasis, string | undefined][] = []
  for (const group of new Set(changed.map((finding) => finding.group))) {
    const inSnapshot =
      ios !== undefined &&
      snapshot !== null &&
      changed
        .filter((finding) => finding.group === group)
        .every((finding) =>
          sameColumn(
            finding.column,
            columns[finding.column] ?? null,
            (snapshot[finding.column] ?? null) as string | string[] | null,
          ),
        )
    const time = inSnapshot
      ? { at: ios, basis: "ios_profile_edit" as const }
      : latest([
          ["ios_profile_edit", ios],
          ["after_quiz", afterQuiz],
          ["after_backfill", afterBackfill],
        ])
    if (time) groupTimes.push([time.basis, time.at])
  }

  const chosen = latest([...groupTimes, ["stored_edited_at", stored]])
  const candidates: EditTime["candidates"] = {
    ...(ios ? { ios_profile_edit: ios } : {}),
    ...(afterQuiz ? { after_quiz: afterQuiz } : {}),
    ...(afterBackfill ? { after_backfill: afterBackfill } : {}),
    ...(stored ? { stored_edited_at: stored } : {}),
  }
  return chosen ? { ...chosen, candidates } : { at: now, basis: "backfill_time", candidates }
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
      provenance: row.factsProvenance.diagnostics ?? null,
    },
    catchUp: options.catchUp,
  })

  // Informational: the row still gets its write from the next source.
  for (const unusable of selected.unusableSources) {
    plan.notes.push(
      `diagnostics: ${unusable.kind} ${unusable.id} could not be projected (${unusable.reason}); fell through to ${selected.sourceKind}`,
    )
  }
  if (selected.catchUpNote) plan.notes.push(`diagnostics: ${selected.catchUpNote}`)

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
  if (selected.lastLinkNote) plan.report.lastLinkNote = selected.lastLinkNote

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
    // `--catch-up` against the stored document: its field markers carry over (a field the new
    // document no longer holds drops out), then the edits made since are marked on top.
    const fields: Record<string, FieldProvenanceValue> = {}
    for (const [field, value] of Object.entries(selected.catchUpBase?.fields ?? {})) {
      if ((patch as Record<string, unknown>)[field] != null) fields[field] = value
    }
    for (const field of handEdits?.userFields ?? []) fields[field] = "user"
    for (const field of handEdits?.keptFields ?? []) fields[field] = "unknown_historical"
    Object.assign(fields, completenessFieldProvenance(assumed, kept))
    const editedAt = handEdits ? editTime(row, selected, handEdits, options.now) : undefined
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
      ).map((change) =>
        // The door derives her only concern as the main problem when she named none: one
        // pattern for the whole population, whatever that concern is (plan §5).
        change.column === "primary_concern" &&
        change.before === "NULL" &&
        after.concerns.length === 1 &&
        after.primary_concern === after.concerns[0]
          ? { ...change, pattern: "primary_concern_only_concern" as const }
          : change,
      ),
    )
  } else {
    plan.skips.push(diagnosticsGate.reason)
  }

  // Fix round 6 (I3): `--catch-up` re-plans diagnostics from a DIFFERENT quiz than the stored
  // document's (one linked through the legacy columns between --apply and the catch-up). The
  // context follows it, by the live link's rule: an artifact brings its own, a legacy lead
  // clears one that holds answers. The ordinary gate would refuse the domain (it owns no legacy
  // columns), so this case is decided here.
  const winnerChanged =
    options.catchUp &&
    diagnosticsGate.plan &&
    row.storedDiagnostics !== null &&
    selected.sourceKind !== "columns" &&
    !sameQuizSourceIdentity(row.storedDiagnostics.source, selected.diagnostics.source)
  if (winnerChanged) {
    planCatchUpQuizContext(row, selected, sourceKind, options, plan)
  } else if (selected.quizContext && Object.keys(selected.quizContext).length > 0) {
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

const QUIZ_CONTEXT_FIELDS = Object.keys(quizContextV1Schema.shape)

/** The label the report uses for a stored diagnostics source. */
function storedSourceLabel(source: DiagnosticsV1["source"]): string {
  if (source.kind === "legacy_columns") return "legacy columns"
  const id = source.artifactId ? `artifact ${source.artifactId}` : `legacy lead ${source.leadId}`
  return source.takenAt ? `${id} (${source.takenAt})` : id
}

/** Fix round 6 (I3): the quiz_context write of a `--catch-up` whose winning quiz changed. */
function planCatchUpQuizContext(
  row: LoadedUserRow,
  selected: SelectedDiagnosticsSource,
  sourceKind: "personal_plan_artifact" | "legacy_lead" | "legacy_columns",
  options: PlanUserFactsBackfillOptions,
  plan: UserFactsBackfillPlan,
): void {
  const taken =
    "takenAt" in selected.diagnostics.source ? selected.diagnostics.source.takenAt : undefined
  const winner = `${selected.sourceKind === "artifact" ? "artifact" : "legacy lead"} ${selected.sourceId}${taken ? ` (${taken})` : ""}`
  const lead = `quiz_context: catch-up — ${winner} now wins over the stored ${storedSourceLabel(row.storedDiagnostics!.source)}`
  const provenance = row.factsProvenance.quiz_context
  // The ownership guard (see QUIZ_OWNED_CONTEXT_KINDS): only a context the account link or the
  // backfill wrote follows the new winner; a user edit's context is never replaced.
  if (provenance && !QUIZ_OWNED_CONTEXT_KINDS.has(provenance.source.kind)) {
    plan.skips.push(
      `${lead}, but quiz_context was last written by ${provenance.source.kind} (a live writer; never overwritten by the backfill)`,
    )
    return
  }
  if (!provenance && row.storedDomains.quiz_context) {
    plan.skips.push(
      `${lead}, but the stored quiz_context carries no quiz_context provenance (no known writer; left for review)`,
    )
    return
  }
  const stored = row.storedQuizContext ?? null
  if (row.storedDomains.quiz_context && stored === null) {
    plan.skips.push(`${lead}, but the stored quiz_context is unreadable; left for review`)
    return
  }
  const storedHasAnswers = stored !== null && Object.keys(stored).length > 0
  // The live link's rule (`writeAccountLinkFacts`): an artifact's own context; a legacy lead
  // carries none and clears one that holds answers.
  const target: QuizContextV1 | null =
    selected.sourceKind === "artifact" ? (selected.quizContext ?? {}) : storedHasAnswers ? {} : null
  // Already in that state: nothing to write (a rerun is idempotent).
  if (target === null) return
  if (stored !== null ? sameFactsDocument(stored, target) : Object.keys(target).length === 0) return
  const patch: Record<string, unknown> = {}
  for (const field of QUIZ_CONTEXT_FIELDS) patch[field] = null
  Object.assign(patch, target)
  plan.writes.push({
    domain: "quiz_context",
    patch: patch as QuizContextPatch,
    provenance: {
      source: { kind: sourceKind, ...(selected.sourceId ? { id: selected.sourceId } : {}) },
      schemaVersion: QUIZ_CONTEXT_SCHEMA_VERSION,
      at: options.now,
    },
    fieldCount: countFields(patch),
    detail:
      selected.sourceKind === "artifact"
        ? "catch-up: the new winner's context replaces the stored one"
        : "catch-up: a legacy lead carries no context; the stored one is cleared",
  })
  plan.notes.push(
    selected.sourceKind === "artifact"
      ? `${lead}; its quiz context replaces the stored one`
      : `${lead}; a legacy lead carries no quiz context, the stored one is cleared`,
  )
}

/** Care habits go through the one conversion, with the product owner's four decisions
 * (Nick 2026-09-30); the report lists every column the write changes, erasures (decisions 3/4)
 * included, and the rows decisions 1/2 reshaped under their own heading. */
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
    const converted = convertLegacyCareColumns(row.columns)
    const patch: CareHabitsPatch = {
      ...converted.careHabits,
      ...(brushesCombs ? { brushesCombs } : {}),
    }
    if (Object.keys(patch).length === 0) {
      // Values the one conversion cannot hold at all: nothing to write, but never silent.
      const carried = CARE_HABITS_OWNED_COLUMNS.filter((column) => {
        const value = (row.columns as unknown as Record<string, unknown>)[column]
        return Array.isArray(value) ? value.length > 0 : typeof value === "string"
      })
      if (carried.length > 0) {
        plan.skips.push(
          `care_habits: the care columns carry values the conversion cannot represent (${carried
            .map(
              (column) =>
                `${column}=${renderValue((row.columns as unknown as Record<string, unknown>)[column])}`,
            )
            .join(", ")}); no document written — the next care write replaces them`,
        )
      }
      return
    }

    // Legacy columns carry no per-answer provenance at all — nothing here is provable.
    const fields: Record<string, FieldProvenanceValue> = {}
    for (const key of Object.keys(patch)) fields[key] = "unknown_historical"

    reportCareChanges(row, patch, plan)
    plan.report.careRules = converted.rules
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
      careRules: [],
    },
    skips: [],
    notes: [],
    unresolvable: [],
  }

  planDiagnosticsAndContext(row, options, plan)
  planCareHabits(row, options, plan)
  return plan
}
