import type {
  PersonalPlanRefinementAnswersV1,
  Stage2QuestionId,
} from "@/lib/personal-plan/refinement/types"
import { BRUSH_TYPES, type BrushType } from "@/lib/vocabulary/onboarding-care"

import { toCareHabitsPatch, toFieldProvenance } from "../from-refinement-draft"
import {
  CARE_HABITS_SCHEMA_VERSION,
  DIAGNOSTICS_SCHEMA_VERSION,
  QUIZ_CONTEXT_SCHEMA_VERSION,
  type CareHabitsPatch,
  type DiagnosticsPatch,
  type DomainProvenance,
  type FactsProvenance,
  type FieldProvenanceValue,
  type QuizContextPatch,
} from "../schema"
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
  selectDiagnosticsSource,
  type DiagnosticsColumnConflictField,
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
 *  - Idempotency: only `facts_revision = 0` rows are planned, unless `--catch-up` re-opens a
 *    domain the backfill itself last wrote and whose legacy columns have changed since.
 *
 * No I/O, no `server-only`.
 */

export type LegacyProfileColumns = LegacyDiagnosticColumns &
  LegacyCareHabitColumns & { brush_type: string[] | null }

export type LoadedUserRow = {
  userId: string
  factsRevision: number
  /** `hair_profiles.updated_at`, the only evidence a legacy writer touched the row after the
   * backfill wrote its facts (the catch-up predicate). */
  updatedAt: string | null
  factsProvenance: FactsProvenance
  columns: LegacyProfileColumns
  artifact: { id: string; leadId: string; quizAnswers: unknown } | null
  legacyLead: { id: string; quizAnswers: unknown } | null
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

export type UserFactsBackfillPlan = {
  userId: string
  writes: PlannedFactsWrite[]
  /** Domains (or whole rows) deliberately left alone, with the reason. */
  skips: string[]
  /** Domains whose source could not be resolved at all; these need a human, not a guess. */
  unresolvable: string[]
  conflict?: {
    sourceKind: "artifact" | "lead"
    sourceId: string
    fields: DiagnosticsColumnConflictField[]
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

/** Only ever reached for a `facts_revision = 0` row (always planned) or, in catch-up mode,
 * for a row the backfill itself wrote — `planUserFactsBackfill` returns before this for every
 * other already-written row. */
function gateDomain(
  domain: "diagnostics" | "care_habits" | "quiz_context",
  row: LoadedUserRow,
): DomainGate {
  if (row.factsRevision === 0) return { plan: true }

  const provenance = row.factsProvenance[domain]
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
  const changedAt = row.updatedAt ? Date.parse(row.updatedAt) : Number.NaN
  const writtenAt = Date.parse(provenance.at)
  if (!(changedAt > writtenAt)) {
    return {
      plan: false,
      reason: `${domain}: legacy columns unchanged since the backfill wrote them (${provenance.at})`,
    }
  }
  return { plan: true }
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
  return Object.keys(patch).filter((key) => key !== "source").length
}

function planDiagnosticsAndContext(
  row: LoadedUserRow,
  options: PlanUserFactsBackfillOptions,
  plan: UserFactsBackfillPlan,
): void {
  const diagnosticsGate = gateDomain("diagnostics", row)
  const quizContextGate = gateDomain("quiz_context", row)

  // Each domain reports its own gate at its own decision point, so a row that has nothing to
  // write for a domain never prints a skip line about it.
  const hasAnySource =
    row.artifact !== null || row.legacyLead !== null || hasLegacyDiagnosticSignal(row.columns)
  if (!hasAnySource) return

  const selected = selectDiagnosticsSource({
    artifact: row.artifact,
    legacyLead: row.legacyLead,
    columns: row.columns,
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
    }
  }

  const sourceKind =
    selected.sourceKind === "artifact"
      ? ("personal_plan_artifact" as const)
      : selected.sourceKind === "lead"
        ? ("legacy_lead" as const)
        : ("legacy_columns" as const)

  if (diagnosticsGate.plan) {
    const patch: DiagnosticsPatch = { ...selected.diagnostics }
    plan.writes.push({
      domain: "diagnostics",
      patch,
      provenance: {
        source: { kind: sourceKind, ...(selected.sourceId ? { id: selected.sourceId } : {}) },
        schemaVersion: DIAGNOSTICS_SCHEMA_VERSION,
        at: options.now,
      },
      fieldCount: countFields(patch),
    })
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

function planCareHabits(
  row: LoadedUserRow,
  options: PlanUserFactsBackfillOptions,
  plan: UserFactsBackfillPlan,
): void {
  const gate = gateDomain("care_habits", row)
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
    skips: [],
    unresolvable: [],
  }

  if (row.factsRevision !== 0 && !options.catchUp) {
    plan.skips.push(
      `facts_revision=${row.factsRevision} (already written; re-run with --catch-up to re-check changed legacy columns)`,
    )
    return plan
  }

  planDiagnosticsAndContext(row, options, plan)
  planCareHabits(row, options, plan)
  return plan
}
