import { pathToFileURL } from "node:url"
import type { SupabaseClient } from "@supabase/supabase-js"

import { createAdminClient } from "../../src/lib/supabase/admin"
import {
  planUserFactsBackfill,
  type EditTime,
  type EditTimeBasis,
  type LegacyProfileColumns,
  type LoadedUserRow,
  type PlannedFactsWrite,
  type UserFactsBackfillPlan,
} from "../../src/lib/user-facts/backfill/plan-row"
import type {
  BackfillDraftRow,
  BackfillNeedVersionRow,
  BackfillPlanRow,
} from "../../src/lib/user-facts/backfill/resolve-stage2-head"
import {
  careHabitsV1Schema,
  diagnosticsV1Schema,
  factsProvenanceSchema,
  quizContextV1Schema,
  type CareHabitsV1,
  type DiagnosticsV1,
  type QuizContextV1,
} from "../../src/lib/user-facts/schema"
import { saveUserFacts } from "../../src/lib/user-facts/save"
import type { CareConversionRule } from "../../src/lib/user-facts/backfill/legacy-columns-to-care-habits"

/**
 * One-off backfill of the `hair_profiles` fact domains (`diagnostics`, `care_habits`,
 * `quiz_context`) for users who predate the writers that maintain them.
 *
 * DRY RUN BY DEFAULT: without `--apply` it only reads and prints the diff it would write.
 * Idempotent: only `facts_revision = 0` rows are planned, unless `--catch-up` re-opens a
 * domain the backfill itself wrote whose legacy columns a still-live legacy writer has
 * changed since (F07/F08 — run once more right before the PR2 deploy).
 *
 * This file is I/O only: bounded paged loading, printing, and (under `--apply`) handing each
 * planned write to `saveUserFacts`. Every rule lives in `src/lib/user-facts/backfill/`.
 */

const PAGE_SIZE = 200

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const HAIR_PROFILE_COLUMNS = [
  "user_id",
  "facts_revision",
  "facts_provenance",
  "diagnostics",
  "care_habits",
  "quiz_context",
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
  "towel_material",
  "towel_technique",
  "drying_method",
  "styling_tools",
  "heat_styling",
  "uses_heat_protection",
  "night_protection",
  "brush_type",
  "desired_volume",
  "primary_concern",
  // Fix round 6 (I1): the row-content CAS token, never an edit time.
  "updated_at",
].join(", ")

export type BackfillOptions = {
  apply: boolean
  catchUp: boolean
  limit: number
  userId: string | undefined
}

export function parseBackfillArguments(argv: string[]): BackfillOptions {
  let apply = false
  let dryRun = false
  let catchUp = false
  let limit = 500
  let userId: string | undefined

  for (const arg of argv) {
    if (arg === "--apply") apply = true
    else if (arg === "--dry-run") dryRun = true
    else if (arg === "--catch-up") catchUp = true
    else if (arg.startsWith("--limit=")) {
      limit = Number(arg.slice("--limit=".length))
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100000) {
        throw new Error(`--limit must be a whole number between 1 and 100000 (got "${arg}")`)
      }
    } else if (arg.startsWith("--user=")) {
      userId = arg.slice("--user=".length)
      if (!UUID_PATTERN.test(userId)) {
        throw new Error(`--user must be a user uuid (got "${arg}")`)
      }
    } else {
      throw new Error(
        `Unknown flag "${arg}". Use: [--dry-run | --apply] [--catch-up] [--user=<uuid>] [--limit=<n>]`,
      )
    }
  }

  if (apply && dryRun) {
    throw new Error("Choose either --apply or --dry-run, not both (--dry-run is the default)")
  }

  return { apply, catchUp, limit, userId }
}

type QueryResult<Row> = { data: Row[] | null; error: { message: string } | null }

type QueryBuilder<Row> = PromiseLike<QueryResult<Row>> & {
  select: (columns: string) => QueryBuilder<Row>
  eq: (column: string, value: unknown) => QueryBuilder<Row>
  in: (column: string, values: unknown[]) => QueryBuilder<Row>
  gt: (column: string, value: unknown) => QueryBuilder<Row>
  order: (column: string) => QueryBuilder<Row>
  limit: (count: number) => QueryBuilder<Row>
}

type BackfillClient = {
  from: <Row extends Record<string, unknown>>(table: string) => QueryBuilder<Row>
}

function asClient(supabase: SupabaseClient): BackfillClient {
  return supabase as unknown as BackfillClient
}

async function runQuery<Row extends Record<string, unknown>>(
  query: QueryBuilder<Row>,
  label: string,
): Promise<Row[]> {
  const { data, error } = await query
  if (error) throw new Error(`${label} query failed: ${error.message}`)
  return Array.isArray(data) ? data : []
}

function readString(value: unknown): string | null {
  return typeof value === "string" ? value : null
}

function readStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null
  return value.filter((entry): entry is string => typeof entry === "string")
}

function readBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null
}

function toColumns(row: Record<string, unknown>): LegacyProfileColumns {
  return {
    hair_texture: readString(row.hair_texture),
    thickness: readString(row.thickness),
    density: readString(row.density),
    hair_length: readString(row.hair_length),
    cuticle_condition: readString(row.cuticle_condition),
    protein_moisture_balance: readString(row.protein_moisture_balance),
    scalp_type: readString(row.scalp_type),
    scalp_condition: readString(row.scalp_condition),
    chemical_treatment: readStringArray(row.chemical_treatment),
    concerns: readStringArray(row.concerns),
    goals: readStringArray(row.goals),
    towel_material: readString(row.towel_material),
    towel_technique: readString(row.towel_technique),
    drying_method: readString(row.drying_method),
    styling_tools: readStringArray(row.styling_tools),
    heat_styling: readString(row.heat_styling),
    uses_heat_protection: readBoolean(row.uses_heat_protection),
    night_protection: readStringArray(row.night_protection),
    brush_type: readStringArray(row.brush_type),
    desired_volume: readString(row.desired_volume),
    primary_concern: readString(row.primary_concern),
  }
}

/** The stored documents, or `null` when there is none or it does not parse. Only the catch-up
 * comparison reads them, and `plan-row.ts` turns a `null` into an explicit "left for review"
 * skip rather than a blind re-write. */
function readStoredDiagnostics(value: unknown): DiagnosticsV1 | null {
  if (value === null || value === undefined) return null
  const parsed = diagnosticsV1Schema.safeParse(value)
  return parsed.success ? parsed.data : null
}

function readStoredCareHabits(value: unknown): CareHabitsV1 | null {
  if (value === null || value === undefined) return null
  const parsed = careHabitsV1Schema.safeParse(value)
  return parsed.success ? parsed.data : null
}

function readStoredQuizContext(value: unknown): QuizContextV1 | null {
  if (value === null || value === undefined) return null
  const parsed = quizContextV1Schema.safeParse(value)
  return parsed.success ? parsed.data : null
}

/** Newest first, mirroring the "most recent legacy lead wins" rule in
 * `src/lib/quiz/link-to-profile.ts:192-198`. */
function newestFirst(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return [...rows].sort((left, right) =>
    String(right.created_at ?? "").localeCompare(String(left.created_at ?? "")),
  )
}

function groupBy(
  rows: Record<string, unknown>[],
  key: string,
): Map<string, Record<string, unknown>[]> {
  const grouped = new Map<string, Record<string, unknown>[]>()
  for (const row of rows) {
    const value = readString(row[key])
    if (!value) continue
    const bucket = grouped.get(value)
    if (bucket) bucket.push(row)
    else grouped.set(value, [row])
  }
  return grouped
}

type LoadedPage = {
  /** Rows that can be planned. A row whose `facts_provenance` cannot be parsed is deliberately
   * NOT here: without readable provenance the catch-up gate cannot be evaluated safely, so the
   * row is reported and left alone rather than written blind. */
  rows: LoadedUserRow[]
  /** Rows the loader refuses (printed and counted under SKIPPED). */
  skips: string[]
  /** What the loader disambiguated (several leads, artifacts, plans): informational, printed
   * under NOTES and never counted as skips. */
  notes: string[]
  /** Profiles the page actually read (blocked rows included), for the limit and the cursor. */
  count: number
  lastUserId: string | null
}

async function loadPage(
  supabase: SupabaseClient,
  options: { userId: string | undefined; cursor: string | null; pageSize: number },
): Promise<LoadedPage> {
  const client = asClient(supabase)

  let profileQuery = client
    .from<Record<string, unknown>>("hair_profiles")
    .select(HAIR_PROFILE_COLUMNS)
  if (options.userId) profileQuery = profileQuery.eq("user_id", options.userId)
  else if (options.cursor) profileQuery = profileQuery.gt("user_id", options.cursor)
  const profiles = await runQuery(
    profileQuery.order("user_id").limit(options.pageSize),
    "hair_profiles",
  )

  const userIds = profiles
    .map((row) => readString(row.user_id))
    .filter((value): value is string => value !== null)
  if (userIds.length === 0) return { rows: [], skips: [], notes: [], count: 0, lastUserId: null }

  const [artifacts, leads, plans, profileEdits] = await Promise.all([
    runQuery(
      client
        .from<Record<string, unknown>>("personal_plan_prepared_artifacts")
        .select("id, lead_id, user_id, created_at, quiz_answers, canonical_profile")
        .in("user_id", userIds)
        .eq("status", "attached"),
      "personal_plan_prepared_artifacts",
    ),
    runQuery(
      client
        .from<Record<string, unknown>>("leads")
        .select("id, user_id, created_at, quiz_answers")
        .in("user_id", userIds)
        .eq("quiz_kind", "legacy"),
      "leads",
    ),
    runQuery(
      client
        .from<Record<string, unknown>>("personal_plans")
        .select("id, user_id, current_refined_need_version_id")
        .in("user_id", userIds),
      "personal_plans",
    ),
    // Task 7: the iOS edit / registration leaves one row per user; the time of its publication
    // is the created_at of the context version it points at (the table has no timestamp), and
    // `profile_snapshot` is the row it left (fix round 5: only columns still equal to it date
    // from that publication).
    runQuery(
      client
        .from<Record<string, unknown>>("scanner_profile_edits")
        .select("user_id, context_version_id, profile_snapshot")
        .in("user_id", userIds),
      "scanner_profile_edits",
    ),
  ])

  const editVersionIds = profileEdits
    .map((row) => readString(row.context_version_id))
    .filter((value): value is string => value !== null)
  const editVersions = editVersionIds.length
    ? await runQuery(
        client
          .from<Record<string, unknown>>("scanner_context_versions")
          .select("id, created_at")
          .in("id", editVersionIds),
        "scanner_context_versions",
      )
    : []
  const editVersionTime = new Map(
    editVersions.map((row) => [readString(row.id), readString(row.created_at)] as const),
  )
  const lastEditByUser = new Map<
    string,
    { at: string | null; snapshot: Record<string, unknown> | null }
  >()
  for (const edit of profileEdits) {
    const userId = readString(edit.user_id)
    if (userId) {
      const snapshot = edit.profile_snapshot
      lastEditByUser.set(userId, {
        at: editVersionTime.get(readString(edit.context_version_id)) ?? null,
        snapshot:
          typeof snapshot === "object" && snapshot !== null && !Array.isArray(snapshot)
            ? (snapshot as Record<string, unknown>)
            : null,
      })
    }
  }

  const planIds = plans
    .map((row) => readString(row.id))
    .filter((value): value is string => value !== null)

  const [needVersions, drafts] = planIds.length
    ? await Promise.all([
        runQuery(
          client
            .from<Record<string, unknown>>("personal_plan_need_versions")
            .select(
              "id, personal_plan_id, kind, parent_need_version_id, computation_version, input_snapshot, output_snapshot",
            )
            .in("personal_plan_id", planIds)
            .eq("kind", "refined"),
          "personal_plan_need_versions",
        ),
        runQuery(
          client
            .from<Record<string, unknown>>("personal_plan_refinement_drafts")
            .select(
              "id, personal_plan_id, revision, answer_provenance, completed_question_ids, module_projections, result_refined_need_version_id",
            )
            .in("personal_plan_id", planIds),
          "personal_plan_refinement_drafts",
        ),
      ])
    : [[], []]

  const artifactsByUser = groupBy(artifacts, "user_id")
  const leadsByUser = groupBy(leads, "user_id")
  const plansByUser = groupBy(plans, "user_id")
  const versionsByPlan = groupBy(needVersions, "personal_plan_id")
  const draftsByPlan = groupBy(drafts, "personal_plan_id")

  const skips: string[] = []
  const notes: string[] = []
  const rows: LoadedUserRow[] = []

  for (const profile of profiles) {
    const userId = readString(profile.user_id)
    if (!userId) continue

    const userArtifacts = newestFirst(artifactsByUser.get(userId) ?? [])
    const userLeads = newestFirst(leadsByUser.get(userId) ?? [])
    const userPlans = plansByUser.get(userId) ?? []
    if (userArtifacts.length > 1) {
      notes.push(`${userId}: ${userArtifacts.length} attached artifacts; used the newest`)
    }
    if (userLeads.length > 1) {
      notes.push(
        `${userId}: ${userLeads.length} legacy leads; the newest by quiz time competes, the older ones are fallbacks`,
      )
    }
    if (userPlans.length > 1) {
      notes.push(`${userId}: ${userPlans.length} personal plans; used the first`)
    }

    const artifactRow = userArtifacts[0]
    const artifactId = artifactRow ? readString(artifactRow.id) : null
    const artifactLeadId = artifactRow ? readString(artifactRow.lead_id) : null
    const leadRow = userLeads[0]
    const leadId = leadRow ? readString(leadRow.id) : null
    const planRow = userPlans[0]
    const planId = planRow ? readString(planRow.id) : null

    const provenance = factsProvenanceSchema.safeParse(profile.facts_provenance ?? {})
    if (!provenance.success) {
      skips.push(`${userId}: facts_provenance is unreadable; left untouched for review`)
      continue
    }

    rows.push({
      userId,
      factsRevision: typeof profile.facts_revision === "number" ? profile.facts_revision : 0,
      // Kept as the string PostgREST sent: a Date would drop the microseconds the door compares.
      loadedUpdatedAt: readString(profile.updated_at),
      factsProvenance: provenance.data,
      columns: toColumns(profile),
      storedDomains: {
        diagnostics: profile.diagnostics !== null && profile.diagnostics !== undefined,
        care_habits: profile.care_habits !== null && profile.care_habits !== undefined,
        quiz_context: profile.quiz_context !== null && profile.quiz_context !== undefined,
      },
      storedDiagnostics: readStoredDiagnostics(profile.diagnostics),
      storedCareHabits: readStoredCareHabits(profile.care_habits),
      storedQuizContext: readStoredQuizContext(profile.quiz_context),
      artifact:
        artifactRow && artifactId && artifactLeadId
          ? {
              id: artifactId,
              leadId: artifactLeadId,
              quizAnswers: artifactRow.quiz_answers,
              createdAt: readString(artifactRow.created_at),
              canonicalProfile: artifactRow.canonical_profile,
            }
          : null,
      legacyLead:
        leadRow && leadId
          ? {
              id: leadId,
              quizAnswers: leadRow.quiz_answers,
              createdAt: readString(leadRow.created_at),
            }
          : null,
      olderLegacyLeads: userLeads.slice(1).flatMap((lead) => {
        const id = readString(lead.id)
        return id
          ? [{ id, quizAnswers: lead.quiz_answers, createdAt: readString(lead.created_at) }]
          : []
      }),
      lastProfileEditAt: lastEditByUser.get(userId)?.at ?? null,
      lastProfileEditSnapshot: lastEditByUser.get(userId)?.snapshot ?? null,
      plan:
        planRow && planId
          ? ({
              id: planId,
              current_refined_need_version_id: readString(planRow.current_refined_need_version_id),
            } satisfies BackfillPlanRow)
          : null,
      needVersions: (planId ? (versionsByPlan.get(planId) ?? []) : []).map(
        (row) => row as unknown as BackfillNeedVersionRow,
      ),
      drafts: (planId ? (draftsByPlan.get(planId) ?? []) : []).map(
        (row) => row as unknown as BackfillDraftRow,
      ),
    })
  }

  return { rows, skips, notes, count: profiles.length, lastUserId: userIds.at(-1) ?? null }
}

function describeWrite(write: PlannedFactsWrite, prefix: string, userId: string): string {
  const source = write.provenance.source
  const sourceLabel = source.id ? `${source.kind} ${source.id}` : source.kind
  const detail = write.detail ? `; ${write.detail}` : ""
  return `${prefix} ${userId} ${write.domain} <- ${sourceLabel} (${write.fieldCount} fields${detail})`
}

export type BackfillSummary = {
  mode: "dry-run" | "apply"
  catchUp: boolean
  usersExamined: number
  writesPlanned: number
  writesByDomain: Record<string, number>
  writesBySource: Record<string, number>
  conflicts: number
  /** Domains a concurrent writer beat us to: `user_facts_save_v1` answered `revision_conflict`
   * to the CAS this run pinned to the revision and the `updated_at` it loaded (fix round 2, P1;
   * fix round 6, I1 — a legacy column write bumps only the latter). The row is left
   * for the next run, never retried here — every revision derived from that snapshot is
   * stale. Reported under SKIPPED, not as a failure: a live writer winning the race is the
   * CAS working, not the page breaking. */
  revisionConflicts: number
  /** Rows where the winning source would blank a diagnostics-owned column that carries a
   * value today (I2). Counted apart from a value conflict: this is data loss, not disagreement. */
  erasures: number
  /** Task 7: rows with at least one answer group edited by hand after the winning quiz. */
  handEditedRows: number
  /** Task 7: rows with a difference no rule classifies (treated as a hand edit). */
  ambiguousRows: number
  /** Task 7: rows whose planned writes change at least one legacy column. */
  visibleChangeRows: number
  /** Fix round 4: rows per care-habit decision (1 `never_with_tools`, 2 `dryer_only_protection`)
   * the planned care write applied. */
  careRuleRows: Partial<Record<CareConversionRule, number>>
  unresolvable: number
  /** Domains or rows deliberately left alone. Informational lines are NOT skips (`notes`). */
  skipped: number
  /** Informational lines (several leads/artifacts/plans, a source that fell through, a
   * catch-up source change), printed under NOTES. */
  notes: number
  applied: number
  /** `user_facts_save_v1` returned `preserved`, i.e. it declined the write and kept what was
   * there. Not an applied change. */
  preserved: number
  failures: { userId: string; domain: string; reason: string }[]
  pageComplete: boolean
  nextCursor: string | null
}

type RowOutcome = { row: LoadedUserRow; plan: UserFactsBackfillPlan }

/** The product owner's care-habit decisions 1 and 2 (Nick 2026-09-30), as the report names them. */
const CARE_RULE_LABELS: Record<CareConversionRule, string> = {
  never_with_tools: "„Nie“ next to selected tools: no heat tools, no heat events",
  dryer_only_protection:
    "dryer/diffuser only with protection „Ja“: heat_protectant added to currentProductCategories",
}

/** How the report names an `editedAt` basis and its candidates (fix round 5, I3). */
const EDIT_TIME_LABELS: Record<EditTimeBasis, string> = {
  ios_profile_edit: "iOS edit",
  after_quiz: "quiz taken + 1 ms",
  after_backfill: "backfill write",
  stored_edited_at: "stored editedAt",
  backfill_time: "run time",
}

function countBy<Key extends string>(keys: Key[]): string {
  const counts = new Map<Key, number>()
  for (const key of keys) counts.set(key, (counts.get(key) ?? 0) + 1)
  return [...counts.entries()].map(([key, count]) => `${key} ${count}`).join(", ")
}

function sourceLabel(plan: UserFactsBackfillPlan): string {
  const write = plan.writes.find((entry) => entry.domain === "diagnostics")
  if (!write) return "no diagnostics write"
  const source = write.provenance.source
  return source.id ? `${source.kind} ${source.id}` : source.kind
}

function editTimeLine(editedAt: EditTime | undefined): string {
  if (!editedAt) return ""
  const candidates = (Object.keys(EDIT_TIME_LABELS) as EditTimeBasis[])
    .filter((basis) => basis !== "backfill_time")
    .map((basis) => {
      const at = editedAt.candidates[basis as Exclude<EditTimeBasis, "backfill_time">]
      return basis === "ios_profile_edit" || basis === "after_quiz" || at
        ? `${EDIT_TIME_LABELS[basis]} ${at ?? "none"}`
        : null
    })
    .filter((entry): entry is string => entry !== null)
  return ` — editedAt ${editedAt.at} (${EDIT_TIME_LABELS[editedAt.basis]}; candidates: ${candidates.join(", ")})`
}

/** Order-free rendering, so one change pattern counts once however the arrays were ordered. */
function patternValue(value: string): string {
  return value.includes(",") ? value.split(",").sort().join(",") : value
}

/** The "change pattern -> count" table (fix round 5): every visible column change grouped by
 * column and before -> after, most frequent first. */
function changePatterns(outcomes: RowOutcome[]): { key: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const { plan } of outcomes) {
    for (const change of plan.report.visibleChanges) {
      const key =
        change.pattern === "primary_concern_only_concern"
          ? `${change.domain}.${change.column}: NULL -> her only concern (the door names it the main problem)`
          : `${change.domain}.${change.column}: ${patternValue(change.before)} -> ${patternValue(change.after)}`
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
  }
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((left, right) => right.count - left.count || left.key.localeCompare(right.key))
}

/**
 * The owner's sign-off report (task 7): a summary table first, then the change-pattern table,
 * then one section per question he has to answer, each listing user ids. Pure formatting over
 * the plans.
 */
function reportLines(
  outcomes: RowOutcome[],
  summary: BackfillSummary,
  extra: {
    conflictLines: string[]
    unresolvableLines: string[]
    skipLines: string[]
    noteLines: string[]
    revisionConflictLines: string[]
  },
): string[] {
  const lines: string[] = []
  const edited = outcomes.filter(({ plan }) => plan.report.editedGroups.length > 0)
  const ambiguous = outcomes.filter(({ plan }) => plan.report.ambiguousGroups.length > 0)
  const changed = outcomes.filter(({ plan }) => plan.report.visibleChanges.length > 0)
  const withDefaults = outcomes.filter(({ plan }) =>
    plan.writes.some((write) => write.detail?.includes("assumed")),
  )
  const kept = outcomes.filter(
    ({ plan }) =>
      plan.report.findings.some((finding) => finding.verdict === "kept") ||
      plan.writes.some((write) => write.domain === "diagnostics" && write.detail?.includes("kept")),
  )
  const sourceNotes = outcomes.filter(({ plan }) => plan.report.sourceNote)
  const lastLinks = outcomes.filter(({ plan }) => plan.report.lastLinkNote)
  const ruleRows = outcomes.filter(({ plan }) => plan.report.careRules.length > 0)
  const tolerated = outcomes.flatMap(({ plan }) => plan.report.tolerated.map((entry) => entry.id))
  const changedColumns = outcomes.flatMap(({ plan }) =>
    plan.report.visibleChanges.map((change) => `${change.domain}.${change.column}`),
  )
  const assumedFields = outcomes.flatMap(({ plan }) =>
    plan.writes.flatMap((write) =>
      Object.entries(write.provenance.fields ?? {})
        .filter(([, value]) => value === "assumed" && write.domain === "diagnostics")
        .map(([field]) => field),
    ),
  )
  const patterns = changePatterns(outcomes)

  const row = (label: string, value: string | number) =>
    lines.push(`  ${label.padEnd(42)} ${value}`)
  lines.push(`USER FACTS BACKFILL REPORT (${summary.mode}${summary.catchUp ? ", catch-up" : ""})`)
  lines.push("")
  lines.push("SUMMARY")
  row("profiles examined", summary.usersExamined)
  row(
    "writes planned",
    `${summary.writesPlanned} (${countBy(
      outcomes.flatMap(({ plan }) => plan.writes.map((write) => write.domain)),
    )})`,
  )
  row(
    "diagnostics sources",
    countBy(
      outcomes.flatMap(({ plan }) =>
        plan.writes
          .filter((write) => write.domain === "diagnostics")
          .map((write) => write.provenance.source.kind),
      ),
    ) || "-",
  )
  row(
    "rows with hand-edited groups",
    `${edited.length}${edited.length ? ` (${countBy(edited.flatMap(({ plan }) => plan.report.editedGroups))})` : ""}`,
  )
  row(
    "ambiguous rows (treated as edits)",
    `${ambiguous.length}${ambiguous.length ? ` (${countBy(ambiguous.flatMap(({ plan }) => plan.report.ambiguousGroups))})` : ""}`,
  )
  row(
    "rows with visible changes",
    `${changed.length}${changed.length ? ` (${countBy(changedColumns)})` : ""}`,
  )
  row(
    "rows with defaults applied",
    `${withDefaults.length}${assumedFields.length ? ` (${countBy(assumedFields)})` : ""}`,
  )
  row(
    "care habits converted by rule",
    `${ruleRows.length}${ruleRows.length ? ` (${countBy(ruleRows.flatMap(({ plan }) => plan.report.careRules))})` : ""}`,
  )
  row("rows keeping profile values", kept.length)
  const keptDirections = outcomes.flatMap(({ plan }) =>
    plan.report.keptVolumeDirection ? [plan.report.keptVolumeDirection.value] : [],
  )
  row(
    "stored volume directions kept",
    `${keptDirections.length}${keptDirections.length ? ` (${countBy(keptDirections)})` : ""}`,
  )
  row("rows where a later lead beat the artifact", sourceNotes.length)
  row("rows an older quiz's link wrote (winner replaces)", lastLinks.length)
  row("tolerated differences (not edits)", tolerated.length ? countBy(tolerated) : "0")
  row("erasures (P4)", summary.erasures)
  row("conflicts (P4)", summary.conflicts)
  row("unresolvable", summary.unresolvable)
  row("skipped", summary.skipped)
  row("notes (informational, not skips)", summary.notes)
  if (summary.mode === "apply") {
    row("applied / preserved", `${summary.applied} / ${summary.preserved}`)
    row("concurrent-writer conflicts", summary.revisionConflicts)
    row("failures", summary.failures.length)
  }

  lines.push("")
  lines.push(`CHANGE PATTERNS (${patterns.length}) — column: before -> after, rows`)
  for (const { key, count } of patterns) lines.push(`  ${key.padEnd(90)} ${count}`)

  lines.push("")
  lines.push(
    `HAND-EDITED GROUPS (${edited.length} rows) — the column wins; editedAt marks the edit`,
  )
  for (const { row: loaded, plan } of edited) {
    lines.push(
      `  ${loaded.userId} [${sourceLabel(plan)}] ${plan.report.editedGroups.join(", ")}${editTimeLine(plan.report.editedAt)}`,
    )
    for (const finding of plan.report.findings.filter((entry) => entry.verdict === "edited")) {
      lines.push(
        `    ${finding.column}: column=${finding.columnValue} old writer=${finding.oldWriterValue}`,
      )
    }
    for (const note of plan.report.notes) lines.push(`    note: ${note}`)
  }

  lines.push("")
  lines.push(`AMBIGUOUS (${ambiguous.length} rows) — not classifiable, treated as hand edits`)
  for (const { row: loaded, plan } of ambiguous) {
    const alsoEdited = plan.report.editedGroups.length > 0
    lines.push(
      `  ${loaded.userId} [${sourceLabel(plan)}] ${plan.report.ambiguousGroups.join(", ")}${alsoEdited ? "" : editTimeLine(plan.report.editedAt)}`,
    )
    for (const finding of plan.report.findings.filter((entry) => entry.verdict === "ambiguous")) {
      lines.push(
        `    ${finding.column}: column=${finding.columnValue} old writer=${finding.oldWriterValue} — ${finding.reason}`,
      )
    }
    // An edited row printed its notes above already.
    if (!alsoEdited) for (const note of plan.report.notes) lines.push(`    note: ${note}`)
  }

  lines.push("")
  lines.push(`VISIBLE CHANGES (${changed.length} rows) — legacy column before -> after`)
  for (const { row: loaded, plan } of changed) {
    lines.push(`  ${loaded.userId} [${sourceLabel(plan)}]`)
    for (const change of plan.report.visibleChanges) {
      lines.push(`    ${change.domain}.${change.column}: ${change.before} -> ${change.after}`)
    }
  }

  lines.push("")
  lines.push(`CARE HABITS: CONVERTED BY RULE (${ruleRows.length} rows)`)
  for (const rule of Object.keys(CARE_RULE_LABELS) as CareConversionRule[]) {
    const users = ruleRows.filter(({ plan }) => plan.report.careRules.includes(rule))
    if (users.length === 0) continue
    lines.push(`  ${rule} (${users.length}) — ${CARE_RULE_LABELS[rule]}`)
    for (const { row: loaded } of users) lines.push(`    ${loaded.userId}`)
  }

  lines.push("")
  lines.push(`DEFAULTS AND KEPT PROFILE VALUES (${new Set([...withDefaults, ...kept]).size} rows)`)
  for (const outcome of outcomes) {
    const detail = outcome.plan.writes.find((write) => write.domain === "diagnostics")?.detail
    const keptFindings = outcome.plan.report.findings.filter((entry) => entry.verdict === "kept")
    if (!detail && keptFindings.length === 0) continue
    const parts = [
      ...(detail ? [detail] : []),
      ...keptFindings.map(
        (finding) => `kept ${finding.column}=${finding.columnValue} (the quiz never wrote it)`,
      ),
    ]
    lines.push(`  ${outcome.row.userId} ${parts.join("; ")}`)
  }

  lines.push("")
  lines.push(
    `SOURCE CHOICE (${new Set([...sourceNotes, ...lastLinks]).size} rows) — latest own quiz wins`,
  )
  for (const { row: loaded, plan } of sourceNotes) {
    lines.push(`  ${loaded.userId} ${plan.report.sourceNote}`)
  }
  // Fix round 6 (I4): the winner replaces what the older quiz's link wrote — every resulting
  // visible change is repeated here, beside the note, for the owner.
  for (const { row: loaded, plan } of lastLinks) {
    lines.push(`  ${loaded.userId} SOURCE NOTE: ${plan.report.lastLinkNote}`)
    for (const change of plan.report.visibleChanges) {
      lines.push(`    ${change.domain}.${change.column}: ${change.before} -> ${change.after}`)
    }
  }

  lines.push("")
  lines.push(`P4 CONFLICTS (${summary.conflicts} conflicts, ${summary.erasures} erasures)`)
  lines.push(...extra.conflictLines)
  lines.push("")
  lines.push(`UNRESOLVABLE (${extra.unresolvableLines.length})`)
  lines.push(...extra.unresolvableLines)
  lines.push("")
  lines.push(`SKIPPED (${extra.skipLines.length})`)
  lines.push(...extra.skipLines)
  lines.push(`  CONFLICTS (concurrent writer) (${summary.revisionConflicts})`)
  lines.push(...extra.revisionConflictLines)
  lines.push("")
  lines.push(`NOTES (${extra.noteLines.length}) — informational, not skips`)
  lines.push(...extra.noteLines)
  return lines
}

export async function runUserFactsBackfill(
  argv: string[],
  deps: { supabase: SupabaseClient; now?: string; log?: (line: string) => void },
): Promise<BackfillSummary> {
  const options = parseBackfillArguments(argv)
  const log = deps.log ?? ((line: string) => console.log(line))
  const now = deps.now ?? new Date().toISOString()
  const prefix = options.apply ? "[apply]" : "[dry]"

  const conflictLines: string[] = []
  let conflictRows = 0
  let erasureRows = 0
  const unresolvableLines: string[] = []
  const skipLines: string[] = []
  const noteLines: string[] = []
  const revisionConflictLines: string[] = []
  let revisionConflicts = 0
  const failures: BackfillSummary["failures"] = []
  const writesByDomain: Record<string, number> = {}
  const writesBySource: Record<string, number> = {}
  const outcomes: RowOutcome[] = []
  // A dry run prints the report first and the planned writes after it; `--apply` streams each
  // write as it happens (progress survives a crash) and prints the report at the end.
  const writeLines: string[] = []
  const writeLine = (line: string) => (options.apply ? log(line) : writeLines.push(line))

  let usersExamined = 0
  let writesPlanned = 0
  let applied = 0
  let preserved = 0
  let cursor: string | null = null
  let lastPageFull = false

  while (usersExamined < options.limit) {
    const pageSize = Math.min(PAGE_SIZE, options.limit - usersExamined)
    const page = await loadPage(deps.supabase, { userId: options.userId, cursor, pageSize })
    if (page.count === 0) break

    for (const line of page.skips) skipLines.push(`  ${line}`)
    for (const line of page.notes) noteLines.push(`  ${line}`)

    for (const row of page.rows) {
      const plan: UserFactsBackfillPlan = planUserFactsBackfill(row, {
        now,
        catchUp: options.catchUp,
      })
      outcomes.push({ row, plan })

      if (plan.conflict) {
        const origin = `${row.userId} diagnostics from ${plan.conflict.sourceKind} ${plan.conflict.sourceId}`
        if (plan.conflict.fields.length > 0) {
          conflictRows += 1
          conflictLines.push(
            `  ${origin}: ${plan.conflict.fields
              .map((field) => `${field.field} columns=${field.column} derived=${field.derived}`)
              .join("; ")}`,
          )
        }
        if (plan.conflict.erasures.length > 0) {
          erasureRows += 1
          conflictLines.push(
            `  ${origin}: ${plan.conflict.erasures
              .map((field) => `erasure ${field.field} columns=${field.column} derived=<none>`)
              .join("; ")}`,
          )
        }
      }
      for (const reason of plan.unresolvable) unresolvableLines.push(`  ${row.userId} ${reason}`)
      for (const reason of plan.skips) skipLines.push(`  ${row.userId} ${reason}`)
      for (const note of plan.notes) noteLines.push(`  ${row.userId} ${note}`)

      // The revision this row is pinned to for its next write (CAS, fix round 2 P1): the
      // revision the page loaded, then whatever each applied write hands back. A fresh row
      // is 0, which `user_facts_save_v1` accepts as "no profile row yet".
      let expectedRevision = row.factsRevision
      // Fix round 6 (I1): the revision only sees door writes. The deployed legacy writers still
      // change columns without bumping it (rollout step 2), so every write is also pinned to the
      // row's `updated_at` as loaded — then to what each applied write hands back.
      let expectedUpdatedAt = row.loadedUpdatedAt ?? undefined
      // Once a concurrent writer wins the CAS, every revision derived from this row's loaded
      // snapshot is stale — the remaining domains are left for the next run, not guessed at.
      let rowConflicted = false

      for (const write of plan.writes) {
        writesPlanned += 1
        writesByDomain[write.domain] = (writesByDomain[write.domain] ?? 0) + 1
        writesBySource[write.provenance.source.kind] =
          (writesBySource[write.provenance.source.kind] ?? 0) + 1

        if (!options.apply) {
          writeLine(describeWrite(write, prefix, row.userId))
          continue
        }

        if (rowConflicted) {
          revisionConflictLines.push(
            `    ${row.userId} ${write.domain}: not attempted — the loaded snapshot is stale after the conflict above`,
          )
          writeLine(`${describeWrite(write, prefix, row.userId)} -> skipped (stale snapshot)`)
          continue
        }

        try {
          const result = await saveUserFacts(deps.supabase, {
            userId: row.userId,
            domain: write.domain,
            patch: write.patch,
            provenance: write.provenance,
            expectedRevision,
            ...(expectedUpdatedAt !== undefined ? { expectedUpdatedAt } : {}),
            mode: "upsert",
          } as Parameters<typeof saveUserFacts>[1])

          if (result.status === "ok" || result.status === "preserved") {
            if (result.status === "preserved") preserved += 1
            else applied += 1
            expectedRevision = result.revision
            // A result without it keeps the old token: the next write then conflicts, never
            // writes unguarded.
            if (result.updatedAt !== undefined) expectedUpdatedAt = result.updatedAt
            writeLine(
              `${describeWrite(write, prefix, row.userId)} -> ${result.status} rev ${result.revision}`,
            )
          } else if (result.status === "revision_conflict") {
            rowConflicted = true
            revisionConflicts += 1
            revisionConflictLines.push(
              result.reason === "updated_at_mismatch"
                ? `    ${row.userId} ${write.domain}: updated_at changed since the load (loaded ${expectedUpdatedAt}); a write outside the door landed (a legacy writer, or any other row write); nothing written, left for the next run / --catch-up`
                : `    ${row.userId} ${write.domain}: revision_conflict (pinned to ${expectedRevision}, row is at ${result.revision}); left for the next run`,
            )
            writeLine(
              `${describeWrite(write, prefix, row.userId)} -> revision_conflict rev ${result.revision}`,
            )
          } else {
            failures.push({ userId: row.userId, domain: write.domain, reason: result.status })
            writeLine(`${describeWrite(write, prefix, row.userId)} -> ${result.status}`)
          }
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error)
          failures.push({ userId: row.userId, domain: write.domain, reason })
          writeLine(`${describeWrite(write, prefix, row.userId)} -> FAILED ${reason}`)
        }
      }
    }

    usersExamined += page.count
    cursor = page.lastUserId ?? cursor
    lastPageFull = page.count === pageSize
    if (options.userId || !lastPageFull) break
  }

  const nextCursor =
    !options.userId && lastPageFull && usersExamined >= options.limit ? cursor : null

  const summary: BackfillSummary = {
    mode: options.apply ? "apply" : "dry-run",
    catchUp: options.catchUp,
    usersExamined,
    writesPlanned,
    writesByDomain,
    writesBySource,
    conflicts: conflictRows,
    revisionConflicts,
    erasures: erasureRows,
    handEditedRows: outcomes.filter(({ plan }) => plan.report.editedGroups.length > 0).length,
    ambiguousRows: outcomes.filter(({ plan }) => plan.report.ambiguousGroups.length > 0).length,
    visibleChangeRows: outcomes.filter(({ plan }) => plan.report.visibleChanges.length > 0).length,
    careRuleRows: outcomes.reduce<Partial<Record<CareConversionRule, number>>>(
      (counts, { plan }) => {
        for (const rule of plan.report.careRules) counts[rule] = (counts[rule] ?? 0) + 1
        return counts
      },
      {},
    ),
    unresolvable: unresolvableLines.length,
    skipped: skipLines.length,
    notes: noteLines.length,
    applied,
    preserved,
    failures,
    pageComplete: failures.length === 0,
    nextCursor,
  }

  if (options.apply) log("")
  for (const line of reportLines(outcomes, summary, {
    conflictLines,
    unresolvableLines,
    skipLines,
    noteLines,
    revisionConflictLines,
  })) {
    log(line)
  }
  if (!options.apply) {
    log("")
    log(`PLANNED WRITES (${writeLines.length})`)
    for (const line of writeLines) log(line)
  }

  log("")
  log("SUMMARY")
  log(JSON.stringify(summary, null, 2))

  return summary
}

async function main() {
  // Validate the CLI before constructing a configured admin client.
  parseBackfillArguments(process.argv.slice(2))
  const summary = await runUserFactsBackfill(process.argv.slice(2), {
    supabase: createAdminClient(),
  })
  if (!summary.pageComplete) process.exitCode = 2
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(
      `User facts backfill failed before completing the page: ${error instanceof Error ? error.message : String(error)}`,
    )
    process.exitCode = 1
  })
}
