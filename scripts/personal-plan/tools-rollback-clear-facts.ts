import { pathToFileURL } from "node:url"
import type { SupabaseClient } from "@supabase/supabase-js"

import { createAdminClient } from "../../src/lib/supabase/admin"
import {
  careFactsFromToolInventory,
  reportedToolInventoryFromFacts,
} from "../../src/lib/personal-plan/tools/facts"
import { TOOL_FORM_PAGES, toolFormCareKey } from "../../src/lib/personal-plan/tools/labels"
import {
  domainProvenanceSchema,
  type CareHabitsPatch,
  type CareHabitsV1,
  type DomainProvenance,
  type FieldProvenanceValue,
} from "../../src/lib/user-facts/schema"
import { saveUserFacts } from "../../src/lib/user-facts/save"

/**
 * Rollback companion of the Hair Tools rollout (plan `plans/2026-10-09-hair-tools-port.md` §10):
 * clears the care facts the tools module added, so a hard revert leaves no key the previous code
 * cannot read.
 *
 * What it clears, per member:
 *   - `toolFamiliesWithSomething` and every `toolForms_<family>_<n>` page key — always;
 *   - with `--include-derived`, the derived thing-fields (`additionalHeatTools`, the `towel`
 *     (only when no technique is stored with it), `nightProtection`, `brushesCombs`) — but only where the stored value EQUALS what
 *     the stored tool pages derive and its provenance is `user`. The facts do not record which
 *     question wrote a field, so a value a Gewohnheiten answer also states is indistinguishable
 *     from a tools-derived one; a value that differs from the tool pages (a Gewohnheiten answer
 *     the pages do not explain) is never touched. Without the flag the derived fields stay: they
 *     are values the member reported and the previous code reads them as ordinary answers.
 *
 * Each clear is ONE `user_facts_save_v1` write for the `care_habits` domain with a top-level JSON
 * `null` per key. The function (SECURITY DEFINER) is the only writer the facts lock admits: it sets
 * the transaction-local `app.user_facts_writer` to the member's id itself, removes the cleared
 * keys' provenance fields together with the data, and re-derives the narrow legacy columns in the
 * same statement — so nothing here touches `hair_profiles` directly.
 *
 * DRY RUN BY DEFAULT: without `--apply` it only reads and prints the keys it would clear.
 * Idempotent: a member without any of the keys is not written (the RPC bumps `facts_revision` on
 * every write, so a blind second run would not be a no-op) — a repeat run finds nothing to do.
 * Guarded by the row's `facts_revision` (a concurrent edit is reported and left for the next run).
 *
 *   node --import ./tests/server-only-register.cjs --import tsx \
 *     scripts/personal-plan/tools-rollback-clear-facts.ts [--apply] [--include-derived] \
 *     [--user=<uuid>] [--limit=<n>]
 *
 * Deploy order for a real rollback: set `PERSONAL_PLAN_TOOLS_ROLLOUT=off` first (no new tool facts
 * can be written), run this, then revert the code. The additive migration stays.
 */

const PAGE_SIZE = 200
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type ToolsRollbackOptions = {
  apply: boolean
  includeDerived: boolean
  limit: number
  userId: string | undefined
}

export function parseToolsRollbackArguments(argv: string[]): ToolsRollbackOptions {
  let apply = false
  let dryRun = false
  let includeDerived = false
  let limit = 100000
  let userId: string | undefined
  for (const arg of argv) {
    if (arg === "--apply") apply = true
    else if (arg === "--dry-run") dryRun = true
    else if (arg === "--include-derived") includeDerived = true
    else if (arg.startsWith("--limit=")) {
      limit = Number(arg.slice("--limit=".length))
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1000000) {
        throw new Error(`--limit must be a whole number between 1 and 1000000 (got "${arg}")`)
      }
    } else if (arg.startsWith("--user=")) {
      userId = arg.slice("--user=".length)
      if (!UUID_PATTERN.test(userId)) throw new Error(`--user must be a user uuid (got "${arg}")`)
    } else {
      throw new Error(
        `Unknown flag "${arg}". Use: [--dry-run | --apply] [--include-derived] [--user=<uuid>] [--limit=<n>]`,
      )
    }
  }
  if (apply && dryRun) {
    throw new Error("Choose either --apply or --dry-run, not both (--dry-run is the default)")
  }
  return { apply, includeDerived, limit, userId }
}

/** Every care key the tools module introduced: the overview answer and one key per page. */
export const TOOL_CARE_KEYS: readonly string[] = [
  "toolFamiliesWithSomething",
  ...TOOL_FORM_PAGES.map((page) => toolFormCareKey(page.pageKey)),
]

export type ToolsRollbackRowPlan = {
  /** The `care_habits` patch: a top-level `null` clears a key (and its provenance field). */
  patch: CareHabitsPatch
  /** The keys the write removes (for the report). */
  clearedKeys: string[]
  /** The derived thing-fields among them (empty without `--include-derived`). */
  derivedKeys: string[]
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null)
}

/**
 * Pure: what to clear for one member's stored `care_habits` + provenance, or `null` when there is
 * nothing (the idempotent no-op).
 */
export function planToolsRollbackForRow(input: {
  careHabits: Partial<CareHabitsV1> | null
  fieldProvenance: Record<string, FieldProvenanceValue> | undefined
  includeDerived: boolean
}): ToolsRollbackRowPlan | null {
  const { careHabits, fieldProvenance, includeDerived } = input
  const facts = (careHabits ?? {}) as Record<string, unknown>
  const patch: Record<string, unknown> = {}
  const clearedKeys: string[] = []
  const derivedKeys: string[] = []

  for (const key of TOOL_CARE_KEYS) {
    if (facts[key] !== undefined || fieldProvenance?.[key] !== undefined) {
      patch[key] = null
      clearedKeys.push(key)
    }
  }

  if (includeDerived && clearedKeys.length > 0) {
    // Derive from the pages as stored BEFORE they are cleared, with the same oracle the write
    // path used. Only a user-provenance value that the pages fully explain is tools-derived.
    const inventory = reportedToolInventoryFromFacts(careHabits, fieldProvenance)
    const derived = careFactsFromToolInventory(inventory)
    const isUser = (key: string) => fieldProvenance?.[key] === "user"

    if (
      derived.additionalHeatTools !== undefined &&
      facts.additionalHeatTools !== undefined &&
      isUser("additionalHeatTools") &&
      sameJson(facts.additionalHeatTools, derived.additionalHeatTools)
    ) {
      patch.additionalHeatTools = null
      derivedKeys.push("additionalHeatTools")
    }
    if (
      derived.nightProtection !== undefined &&
      facts.nightProtection !== undefined &&
      isUser("nightProtection") &&
      sameJson(facts.nightProtection, derived.nightProtection)
    ) {
      patch.nightProtection = null
      derivedKeys.push("nightProtection")
    }
    if (
      derived.brushesCombs !== undefined &&
      facts.brushesCombs !== undefined &&
      isUser("brushesCombs") &&
      sameJson(facts.brushesCombs, derived.brushesCombs)
    ) {
      patch.brushesCombs = null
      derivedKeys.push("brushesCombs")
    }
    const towel = facts.towel as { material?: string; technique?: string } | undefined
    if (
      derived.towelMaterial !== undefined &&
      towel?.material !== undefined &&
      isUser("towel") &&
      towel.material === derived.towelMaterial &&
      // `towel` is one key (material is required, technique optional): a stored technique is a
      // Gewohnheiten answer of its own and cannot be kept without its material, so such a towel
      // stays whole.
      towel.technique === undefined
    ) {
      patch.towel = null
      derivedKeys.push("towel")
    }
    clearedKeys.push(...derivedKeys)
  }

  if (clearedKeys.length === 0) return null
  return { patch: patch as CareHabitsPatch, clearedKeys, derivedKeys }
}

/** The provenance envelope for the clear: the stored lineage, restamped. */
export function rollbackProvenance(
  stored: DomainProvenance | undefined,
  at: string,
): DomainProvenance {
  const parsed = domainProvenanceSchema.safeParse(stored)
  if (parsed.success) {
    // Keep who wrote the domain and its hand-edit time; only `at` moves. No `fields`: the RPC
    // drops the cleared keys' provenance itself and leaves every other field as it was.
    const { source, schemaVersion, editedAt } = parsed.data
    return { source, schemaVersion, at, ...(editedAt !== undefined ? { editedAt } : {}) }
  }
  return { source: { kind: "profile_editor" }, schemaVersion: 1, at }
}

type QueryResult<Row> = { data: Row[] | null; error: { message: string } | null }
type QueryBuilder<Row> = PromiseLike<QueryResult<Row>> & {
  select: (columns: string) => QueryBuilder<Row>
  eq: (column: string, value: unknown) => QueryBuilder<Row>
  gt: (column: string, value: unknown) => QueryBuilder<Row>
  order: (column: string) => QueryBuilder<Row>
  limit: (count: number) => QueryBuilder<Row>
}
type RollbackClient = {
  from: <Row extends Record<string, unknown>>(table: string) => QueryBuilder<Row>
}

export type ToolsRollbackSummary = {
  mode: "apply" | "dry-run"
  includeDerived: boolean
  membersExamined: number
  membersWithToolFacts: number
  keysPlanned: number
  applied: number
  conflicts: number
  failures: Array<{ userId: string; reason: string }>
}

export async function runToolsRollback(
  argv: string[],
  deps: { supabase: SupabaseClient; log?: (line: string) => void; now?: () => Date },
): Promise<ToolsRollbackSummary> {
  const options = parseToolsRollbackArguments(argv)
  const log = deps.log ?? ((line: string) => console.log(line))
  const now = deps.now ?? (() => new Date())
  const client = deps.supabase as unknown as RollbackClient

  const summary: ToolsRollbackSummary = {
    mode: options.apply ? "apply" : "dry-run",
    includeDerived: options.includeDerived,
    membersExamined: 0,
    membersWithToolFacts: 0,
    keysPlanned: 0,
    applied: 0,
    conflicts: 0,
    failures: [],
  }
  log(
    `Tools rollback — ${summary.mode}${options.includeDerived ? ", including derived thing-fields" : ""}`,
  )

  let cursor: string | null = null
  while (summary.membersExamined < options.limit) {
    const pageSize = Math.min(PAGE_SIZE, options.limit - summary.membersExamined)
    let query = client
      .from<Record<string, unknown>>("hair_profiles")
      .select("user_id, facts_revision, facts_provenance, care_habits")
      .order("user_id")
      .limit(pageSize)
    if (options.userId) query = query.eq("user_id", options.userId)
    else if (cursor) query = query.gt("user_id", cursor)
    const { data, error } = await query
    if (error) throw new Error(`hair_profiles query failed: ${error.message}`)
    const rows = Array.isArray(data) ? data : []

    for (const row of rows) {
      summary.membersExamined += 1
      const userId = String(row.user_id)
      const careHabits = (row.care_habits ?? null) as Partial<CareHabitsV1> | null
      const provenance = (row.facts_provenance ?? {}) as { care_habits?: DomainProvenance }
      const plan = planToolsRollbackForRow({
        careHabits,
        fieldProvenance: provenance.care_habits?.fields as
          | Record<string, FieldProvenanceValue>
          | undefined,
        includeDerived: options.includeDerived,
      })
      if (!plan) continue
      summary.membersWithToolFacts += 1
      summary.keysPlanned += plan.clearedKeys.length
      const line = `${userId}: clear ${plan.clearedKeys.join(", ")}`

      if (!options.apply) {
        log(line)
        continue
      }
      try {
        const result = await saveUserFacts(deps.supabase, {
          userId,
          domain: "care_habits",
          patch: plan.patch,
          provenance: rollbackProvenance(provenance.care_habits, now().toISOString()),
          expectedRevision: Number(row.facts_revision),
          mode: "upsert",
        })
        if (result.status === "ok" || result.status === "preserved") {
          summary.applied += 1
          log(`${line} -> ${result.status} rev ${result.revision}`)
        } else if (result.status === "revision_conflict") {
          summary.conflicts += 1
          log(`${line} -> revision_conflict (row is at ${result.revision}); left for the next run`)
        } else {
          summary.failures.push({ userId, reason: result.status })
          log(`${line} -> ${result.status}`)
        }
      } catch (caught) {
        const reason = caught instanceof Error ? caught.message : String(caught)
        summary.failures.push({ userId, reason })
        log(`${line} -> FAILED ${reason}`)
      }
    }

    if (options.userId || rows.length < pageSize) break
    cursor = String(rows[rows.length - 1]?.user_id)
  }

  log("")
  log("SUMMARY")
  log(JSON.stringify(summary, null, 2))
  return summary
}

async function main() {
  // Validate the CLI before constructing a configured admin client.
  parseToolsRollbackArguments(process.argv.slice(2))
  const summary = await runToolsRollback(process.argv.slice(2), { supabase: createAdminClient() })
  if (summary.failures.length > 0) process.exitCode = 2
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(
      `Tools rollback failed before completing: ${error instanceof Error ? error.message : String(error)}`,
    )
    process.exitCode = 1
  })
}
