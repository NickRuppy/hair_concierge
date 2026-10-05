import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import type { SupabaseClient } from "@supabase/supabase-js"

import { computeNeedPlan } from "../../src/lib/personal-plan/compute-stage1"
import {
  hashPersonalPlanNeedVersionInput,
  type JsonValue,
} from "../../src/lib/personal-plan/persistence/index"
import { PERSONAL_PLAN_STAGE1_COMPUTATION_VERSION } from "../../src/lib/personal-plan/persistence/stage1-service"
import { createAdminClient } from "../../src/lib/supabase/admin"
import {
  loadUserFacts,
  toStage1SourceFromFacts,
  type UserFacts,
} from "../../src/lib/user-facts/read"
import {
  UnsupportedUserFactsSourceError,
  UserFactsIncompleteError,
} from "../../src/lib/user-facts/schema"

/**
 * READ-ONLY pre-deploy audit (central profile PR2, task 6): which plan users have profile facts
 * that would produce a different Stage-1 input hash than their plan's current initial version?
 * Those are the users whose plan the facts-driven recompute would rebase the next time they
 * open the Routine tab, load the plan start, or edit their profile.
 *
 * Writes nothing to the database. Prints totals only (no user ids or emails). With
 * `--out <dir>` it also writes `plan-hash-audit.json` with per-user detail (user ids included:
 * archive it outside the repo, it is not a repo artifact).
 *
 * Needs `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in the environment, like
 * `backfill.ts`. Run with:
 *   node --import ./tests/server-only-register.cjs --import tsx scripts/user-facts/plan-hash-audit.ts [--out <dir>]
 */

const PAGE_SIZE = 200

export type AuditPlanUserInput = {
  facts: UserFacts | null
  currentInitial: {
    inputHash: string
    inputSnapshot: unknown
    preparedArtifactSourceId: string | null
    stage1SourceLeadId: string | null
  }
}

export type AuditPlanUserResult = {
  status: "identical" | "differs" | "not_computable"
  reason?: string
  changedFields?: string[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .filter((key) => value[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`
  }
  return JSON.stringify(value) ?? "null"
}

/** Best effort: the answer keys (and other top-level source keys, e.g. `leadId`) whose values
 * differ between the stored source and the facts-derived one. Array order counts, because the
 * hash is order-sensitive. */
function changedSourceFields(stored: unknown, next: unknown): string[] {
  const changed = new Set<string>()
  const storedRecord = isRecord(stored) ? stored : {}
  const nextRecord = isRecord(next) ? next : {}
  for (const key of new Set([...Object.keys(storedRecord), ...Object.keys(nextRecord)])) {
    if (key === "answers" && isRecord(storedRecord.answers) && isRecord(nextRecord.answers)) {
      const storedAnswers = storedRecord.answers
      const nextAnswers = nextRecord.answers
      for (const answerKey of new Set([
        ...Object.keys(storedAnswers),
        ...Object.keys(nextAnswers),
      ])) {
        if (canonicalJson(storedAnswers[answerKey]) !== canonicalJson(nextAnswers[answerKey])) {
          changed.add(answerKey)
        }
      }
    } else if (canonicalJson(storedRecord[key]) !== canonicalJson(nextRecord[key])) {
      changed.add(key)
    }
  }
  return [...changed].sort()
}

/**
 * Pure: builds the Stage-1 source from the facts and hashes it exactly like
 * `stage1-service.ts` does for a new plan, then compares with the plan's current initial
 * version.
 */
export function auditPlanUser(input: AuditPlanUserInput): AuditPlanUserResult {
  const { facts, currentInitial } = input
  if (!facts) return { status: "not_computable", reason: "no_facts" }

  let source: ReturnType<typeof toStage1SourceFromFacts>
  try {
    source = toStage1SourceFromFacts(facts)
  } catch (error) {
    if (error instanceof UnsupportedUserFactsSourceError) {
      return { status: "not_computable", reason: "legacy_columns" }
    }
    if (error instanceof UserFactsIncompleteError) {
      return { status: "not_computable", reason: "incomplete_facts" }
    }
    throw error
  }
  if (!source) return { status: "not_computable", reason: "no_diagnostics" }

  const artifactId = currentInitial.preparedArtifactSourceId ?? currentInitial.stage1SourceLeadId
  if (!artifactId) return { status: "not_computable", reason: "no_source_id" }

  const computed = computeNeedPlan({
    rawEnvelope: source,
    artifactId,
    projection: "initial_quiz",
    computationVersion: PERSONAL_PLAN_STAGE1_COMPUTATION_VERSION,
    createdAt: new Date().toISOString(),
  })
  if (computed.status !== "ready") return { status: "not_computable", reason: "stage1_not_ready" }

  const nextInputSnapshot = computed.snapshot.sourceQuiz as unknown as JsonValue
  const nextHash = hashPersonalPlanNeedVersionInput({
    schemaVersion: computed.snapshot.schemaVersion,
    computationVersion: computed.snapshot.computationVersion,
    inputSnapshot: nextInputSnapshot,
  })
  if (nextHash === currentInitial.inputHash) return { status: "identical" }

  return {
    status: "differs",
    changedFields: changedSourceFields(currentInitial.inputSnapshot, nextInputSnapshot),
  }
}

export type AuditedPlanUser = {
  userId: string
  result: AuditPlanUserResult
  hasActiveRoutine: boolean
  handEdited: boolean
}

export type AuditSummary = {
  total: number
  byStatus: { identical: number; differs: number; not_computable: number }
  differs: {
    byChangedFields: Record<string, number>
    withActiveRoutine: number
    handEdited: number
    notHandEdited: number
  }
  notComputable: { byReason: Record<string, number> }
}

function increment(counts: Record<string, number>, key: string) {
  counts[key] = (counts[key] ?? 0) + 1
}

/** Counts only: nothing in the summary identifies a user. */
export function summarizeAudit(rows: readonly AuditedPlanUser[]): AuditSummary {
  const summary: AuditSummary = {
    total: rows.length,
    byStatus: { identical: 0, differs: 0, not_computable: 0 },
    differs: { byChangedFields: {}, withActiveRoutine: 0, handEdited: 0, notHandEdited: 0 },
    notComputable: { byReason: {} },
  }
  for (const row of rows) {
    summary.byStatus[row.result.status] += 1
    if (row.result.status === "differs") {
      increment(
        summary.differs.byChangedFields,
        (row.result.changedFields ?? []).join(",") || "(none found)",
      )
      if (row.hasActiveRoutine) summary.differs.withActiveRoutine += 1
      if (row.handEdited) summary.differs.handEdited += 1
      else summary.differs.notHandEdited += 1
    } else if (row.result.status === "not_computable") {
      increment(summary.notComputable.byReason, row.result.reason ?? "unknown")
    }
  }
  return summary
}

function parseArguments(argv: string[]): { outDir: string | null } {
  let outDir: string | null = null
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === "--out") {
      outDir = argv[index + 1] ?? null
      if (!outDir) throw new Error("--out needs a directory")
      index += 1
    } else if (arg.startsWith("--out=")) {
      outDir = arg.slice("--out=".length)
      if (!outDir) throw new Error("--out needs a directory")
    } else {
      throw new Error(`Unknown flag "${arg}". Use: [--out <dir>]`)
    }
  }
  return { outDir }
}

type Row = Record<string, unknown>

async function selectRows(
  query: PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>,
  label: string,
): Promise<Row[]> {
  const { data, error } = await query
  if (error) throw new Error(`${label} query failed: ${error.message}`)
  return (Array.isArray(data) ? data : []) as Row[]
}

function readString(value: unknown): string | null {
  return typeof value === "string" ? value : null
}

async function loadAllPlans(supabase: SupabaseClient): Promise<Row[]> {
  const plans: Row[] = []
  let cursor: string | null = null
  for (;;) {
    let query = supabase
      .from("personal_plans")
      .select("id, user_id, current_initial_need_version_id, active_routine_version_id")
      .order("id")
      .limit(PAGE_SIZE)
    if (cursor) query = query.gt("id", cursor)
    const page = await selectRows(query, "personal_plans")
    plans.push(...page)
    if (page.length < PAGE_SIZE) return plans
    cursor = readString(page[page.length - 1].id)
    if (!cursor) return plans
  }
}

async function auditPlanRow(supabase: SupabaseClient, plan: Row, versions: Map<string, Row>) {
  const userId = readString(plan.user_id)
  if (!userId) return null
  const hasActiveRoutine = readString(plan.active_routine_version_id) !== null

  const versionId = readString(plan.current_initial_need_version_id)
  const version = versionId ? versions.get(versionId) : undefined
  if (!version) {
    return {
      userId,
      result: { status: "not_computable", reason: "no_initial_version" },
      hasActiveRoutine,
      handEdited: false,
    } satisfies AuditedPlanUser
  }

  let facts: UserFacts | null
  try {
    facts = await loadUserFacts(supabase, userId)
  } catch {
    return {
      userId,
      result: { status: "not_computable", reason: "facts_unreadable" },
      hasActiveRoutine,
      handEdited: false,
    } satisfies AuditedPlanUser
  }

  return {
    userId,
    result: auditPlanUser({
      facts,
      currentInitial: {
        inputHash: String(version.input_hash),
        inputSnapshot: version.input_snapshot,
        preparedArtifactSourceId: readString(version.prepared_artifact_source_id),
        stage1SourceLeadId: readString(version.stage1_source_lead_id),
      },
    }),
    hasActiveRoutine,
    handEdited: Boolean(facts?.provenance.diagnostics?.editedAt),
  } satisfies AuditedPlanUser
}

export async function runPlanHashAudit(supabase: SupabaseClient): Promise<AuditedPlanUser[]> {
  const plans = await loadAllPlans(supabase)
  const versions = new Map<string, Row>()
  const versionIds = plans
    .map((plan) => readString(plan.current_initial_need_version_id))
    .filter((id): id is string => id !== null)
  for (let start = 0; start < versionIds.length; start += PAGE_SIZE) {
    const rows = await selectRows(
      supabase
        .from("personal_plan_need_versions")
        .select(
          "id, input_hash, input_snapshot, prepared_artifact_source_id, stage1_source_lead_id",
        )
        .in("id", versionIds.slice(start, start + PAGE_SIZE)),
      "personal_plan_need_versions",
    )
    for (const row of rows) {
      const id = readString(row.id)
      if (id) versions.set(id, row)
    }
  }

  const audited: AuditedPlanUser[] = []
  for (const plan of plans) {
    const row = await auditPlanRow(supabase, plan, versions)
    if (row) audited.push(row)
  }
  return audited
}

async function main() {
  const { outDir } = parseArguments(process.argv.slice(2))
  const audited = await runPlanHashAudit(createAdminClient())
  const summary = summarizeAudit(audited)

  console.log("PLAN HASH AUDIT (read-only)")
  console.log(JSON.stringify(summary, null, 2))

  if (outDir) {
    mkdirSync(outDir, { recursive: true })
    const file = join(outDir, "plan-hash-audit.json")
    writeFileSync(file, `${JSON.stringify({ summary, users: audited }, null, 2)}\n`)
    console.log(`Per-user detail (contains user ids) written to ${file}`)
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(
      `Plan hash audit failed: ${error instanceof Error ? error.message : String(error)}`,
    )
    process.exitCode = 1
  })
}
