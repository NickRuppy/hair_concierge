import { pathToFileURL } from "node:url"
import type { SupabaseClient } from "@supabase/supabase-js"

import { createAdminClient } from "../../src/lib/supabase/admin"
import {
  planUserFactsBackfill,
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
  type CareHabitsV1,
  type DiagnosticsV1,
} from "../../src/lib/user-facts/schema"
import { saveUserFacts } from "../../src/lib/user-facts/save"

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
  /** Everything the loader itself refuses or disambiguates, printed under SKIPPED. */
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
  if (userIds.length === 0) return { rows: [], notes: [], count: 0, lastUserId: null }

  const [artifacts, leads, plans] = await Promise.all([
    runQuery(
      client
        .from<Record<string, unknown>>("personal_plan_prepared_artifacts")
        .select("id, lead_id, user_id, created_at, quiz_answers")
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
  ])

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
      notes.push(`${userId}: ${userLeads.length} legacy leads; used the newest`)
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
      notes.push(`${userId}: facts_provenance is unreadable; left untouched for review`)
      continue
    }

    rows.push({
      userId,
      factsRevision: typeof profile.facts_revision === "number" ? profile.facts_revision : 0,
      factsProvenance: provenance.data,
      columns: toColumns(profile),
      storedDomains: {
        diagnostics: profile.diagnostics !== null && profile.diagnostics !== undefined,
        care_habits: profile.care_habits !== null && profile.care_habits !== undefined,
        quiz_context: profile.quiz_context !== null && profile.quiz_context !== undefined,
      },
      storedDiagnostics: readStoredDiagnostics(profile.diagnostics),
      storedCareHabits: readStoredCareHabits(profile.care_habits),
      artifact:
        artifactRow && artifactId && artifactLeadId
          ? { id: artifactId, leadId: artifactLeadId, quizAnswers: artifactRow.quiz_answers }
          : null,
      legacyLead: leadRow && leadId ? { id: leadId, quizAnswers: leadRow.quiz_answers } : null,
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

  return { rows, notes, count: profiles.length, lastUserId: userIds.at(-1) ?? null }
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
   * to the CAS this run pinned to the revision it loaded (fix round 2, P1). The row is left
   * for the next run, never retried here — every revision derived from that snapshot is
   * stale. Reported under SKIPPED, not as a failure: a live writer winning the race is the
   * CAS working, not the page breaking. */
  revisionConflicts: number
  /** Rows where the winning source would blank a diagnostics-owned column that carries a
   * value today (I2). Counted apart from a value conflict: this is data loss, not disagreement. */
  erasures: number
  unresolvable: number
  skipped: number
  applied: number
  /** `user_facts_save_v1` returned `preserved`, i.e. it declined the write and kept what was
   * there. Not an applied change. */
  preserved: number
  failures: { userId: string; domain: string; reason: string }[]
  pageComplete: boolean
  nextCursor: string | null
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
  const revisionConflictLines: string[] = []
  let revisionConflicts = 0
  const failures: BackfillSummary["failures"] = []
  const writesByDomain: Record<string, number> = {}
  const writesBySource: Record<string, number> = {}

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

    for (const line of page.notes) skipLines.push(`  ${line}`)

    for (const row of page.rows) {
      const plan: UserFactsBackfillPlan = planUserFactsBackfill(row, {
        now,
        catchUp: options.catchUp,
      })

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

      // The revision this row is pinned to for its next write (CAS, fix round 2 P1): the
      // revision the page loaded, then whatever each applied write hands back. A fresh row
      // is 0, which `user_facts_save_v1` accepts as "no profile row yet".
      let expectedRevision = row.factsRevision
      // Once a concurrent writer wins the CAS, every revision derived from this row's loaded
      // snapshot is stale — the remaining domains are left for the next run, not guessed at.
      let rowConflicted = false

      for (const write of plan.writes) {
        writesPlanned += 1
        writesByDomain[write.domain] = (writesByDomain[write.domain] ?? 0) + 1
        writesBySource[write.provenance.source.kind] =
          (writesBySource[write.provenance.source.kind] ?? 0) + 1

        if (!options.apply) {
          log(describeWrite(write, prefix, row.userId))
          continue
        }

        if (rowConflicted) {
          revisionConflictLines.push(
            `    ${row.userId} ${write.domain}: not attempted — the loaded snapshot is stale after the conflict above`,
          )
          log(`${describeWrite(write, prefix, row.userId)} -> skipped (stale snapshot)`)
          continue
        }

        try {
          const result = await saveUserFacts(deps.supabase, {
            userId: row.userId,
            domain: write.domain,
            patch: write.patch,
            provenance: write.provenance,
            expectedRevision,
            mode: "upsert",
          } as Parameters<typeof saveUserFacts>[1])

          if (result.status === "ok" || result.status === "preserved") {
            if (result.status === "preserved") preserved += 1
            else applied += 1
            expectedRevision = result.revision
            log(
              `${describeWrite(write, prefix, row.userId)} -> ${result.status} rev ${result.revision}`,
            )
          } else if (result.status === "revision_conflict") {
            rowConflicted = true
            revisionConflicts += 1
            revisionConflictLines.push(
              `    ${row.userId} ${write.domain}: revision_conflict (pinned to ${expectedRevision}, row is at ${result.revision}); left for the next run`,
            )
            log(
              `${describeWrite(write, prefix, row.userId)} -> revision_conflict rev ${result.revision}`,
            )
          } else {
            failures.push({ userId: row.userId, domain: write.domain, reason: result.status })
            log(`${describeWrite(write, prefix, row.userId)} -> ${result.status}`)
          }
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error)
          failures.push({ userId: row.userId, domain: write.domain, reason })
          log(`${describeWrite(write, prefix, row.userId)} -> FAILED ${reason}`)
        }
      }
    }

    usersExamined += page.count
    cursor = page.lastUserId ?? cursor
    lastPageFull = page.count === pageSize
    if (options.userId || !lastPageFull) break
  }

  log("")
  log(`P4 CONFLICTS (${conflictRows} conflicts, ${erasureRows} erasures)`)
  for (const line of conflictLines) log(line)
  log("")
  log(`UNRESOLVABLE (${unresolvableLines.length})`)
  for (const line of unresolvableLines) log(line)
  log("")
  log(`SKIPPED (${skipLines.length})`)
  for (const line of skipLines) log(line)
  log(`  CONFLICTS (concurrent writer) (${revisionConflicts})`)
  for (const line of revisionConflictLines) log(line)

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
    unresolvable: unresolvableLines.length,
    skipped: skipLines.length,
    applied,
    preserved,
    failures,
    pageComplete: failures.length === 0,
    nextCursor,
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
