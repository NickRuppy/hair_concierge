import { pathToFileURL } from "node:url"
import type { SupabaseClient } from "@supabase/supabase-js"

import {
  createProductionFactsRecomputeDeps,
  syncPlanWithFacts,
} from "../../src/lib/personal-plan/facts-recompute"
import type {
  FactsRecomputePlan,
  FactsRecomputeSourceDraft,
  PersonalPlanRebaseOnFactsParams,
} from "../../src/lib/personal-plan/facts-recompute/types"
import { createAdminClient } from "../../src/lib/supabase/admin"

/**
 * READ-ONLY pre-deploy dry run (central profile PR2): runs the real facts-recompute lane with its
 * production reads for every plan user, but replaces the one write — the
 * `personal_plan_rebase_on_facts_v1` call — with a recorder. It answers "what would the lane do
 * for each real plan today, and can it build the rebase for the ones that differ?" without
 * touching the database. The companion `plan-hash-audit.ts` says WHICH answers differ.
 *
 * What it proves and what it does not: the lane's reads work on the real rows, the projection
 * can be built from the real drafts, and the assembled call passes the function's own
 * parameter rules against the plan state the lane loaded (`refusalReason` below mirrors them).
 * It does NOT execute the transaction, so constraint or lock behaviour is proven only by the
 * PGlite and Docker suites.
 *
 * Writes nothing. Prints totals only (no user ids or emails).
 *
 * Needs `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in the environment, like
 * `backfill.ts`. Run with:
 *   node --import ./tests/server-only-register.cjs --import tsx scripts/user-facts/plan-rebase-dry-run.ts
 */

const PAGE_SIZE = 200

type WouldRebase = {
  reusesInitial: boolean
  hasSourceDraft: boolean
  publishesRefined: boolean
}

export type DryRunOutcome =
  | { kind: "unchanged" }
  | { kind: "would_rebase"; rebase: WouldRebase }
  /** The call was assembled, but the function's parameter rules would refuse it. */
  | { kind: "would_be_refused"; reason: string }
  | { kind: "unavailable"; reason: string }
  | { kind: "no_plan" }

/**
 * The `invalid_source` rules of `personal_plan_rebase_on_facts_v1` (migration 20261003150000,
 * step 4) that depend on plan state, applied to the call the lane assembled. `null` = the call
 * satisfies them. Reason codes are the function's own.
 */
export function refusalReason(input: {
  plan: Pick<FactsRecomputePlan, "currentRefinedNeedVersionId">
  sourceDraft: Pick<FactsRecomputeSourceDraft, "status"> | null
  params: PersonalPlanRebaseOnFactsParams
}): string | null {
  const { plan, sourceDraft, params } = input
  const hasRefinedHead = plan.currentRefinedNeedVersionId !== null
  const hasRefined = params.p_refined_input_hash !== undefined
  const hasCareHabits =
    params.p_care_habits_patch !== undefined || params.p_care_habits_provenance !== undefined
  const hasClone = params.p_clone_answers !== undefined
  if (hasRefined !== hasRefinedHead) {
    return hasRefined ? "refined_parameters_forbidden" : "refined_parameters_required"
  }
  if (hasCareHabits !== hasRefined) {
    return hasCareHabits ? "care_habits_parameters_forbidden" : "care_habits_parameters_required"
  }
  if (hasRefinedHead && !sourceDraft) return "refined_head_without_draft"
  if (hasClone !== (sourceDraft !== null)) {
    return hasClone ? "clone_parameters_forbidden" : "clone_parameters_required"
  }
  if (sourceDraft?.status === "complete" && !hasRefined) return "complete_source_without_refined"
  return null
}

/** The lane over the production reads, with the RPC swapped for a recorder. */
export async function dryRunPlanUser(
  admin: SupabaseClient,
  userId: string,
): Promise<DryRunOutcome> {
  const production = createProductionFactsRecomputeDeps(admin)
  let recorded: PersonalPlanRebaseOnFactsParams | null = null
  let reusesInitial = false
  let plan: FactsRecomputePlan | null = null
  let sourceDraft: FactsRecomputeSourceDraft | null = null
  const result = await syncPlanWithFacts(
    {
      ...production,
      loadPlan: async (id) => (plan = await production.loadPlan(id)),
      loadSourceDraft: async (input) => (sourceDraft = await production.loadSourceDraft(input)),
      findInitialVersionId: async (input) => {
        const existing = await production.findInitialVersionId(input)
        reusesInitial = existing !== null
        return existing
      },
      rebase: async (params) => {
        recorded = params
        // Ends the lane without a retry; the recorder above is what this run reports.
        return { status: "invalid_source", reasonCode: "dry_run" }
      },
    },
    { userId },
  )
  if (recorded !== null && plan !== null) {
    const params = recorded as PersonalPlanRebaseOnFactsParams
    const refused = refusalReason({ plan, sourceDraft, params })
    if (refused) return { kind: "would_be_refused", reason: refused }
    return {
      kind: "would_rebase",
      rebase: {
        reusesInitial,
        hasSourceDraft: params.p_source_draft_id !== undefined,
        publishesRefined: params.p_refined_input_hash !== undefined,
      },
    }
  }
  if (result.status === "unchanged") return { kind: "unchanged" }
  if (result.status === "no_plan") return { kind: "no_plan" }
  if (result.status === "unavailable") return { kind: "unavailable", reason: result.reason }
  // `rebased` is unreachable: the recorder never reports it.
  return { kind: "unavailable", reason: "unexpected_rebased" }
}

async function listPlanUserIds(admin: SupabaseClient): Promise<string[]> {
  const userIds: string[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await admin
      .from("personal_plans")
      .select("user_id")
      .order("user_id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(`personal_plans read failed: ${error.message}`)
    const rows = (data ?? []) as { user_id: string }[]
    userIds.push(...rows.map((row) => row.user_id))
    if (rows.length < PAGE_SIZE) return userIds
  }
}

async function main() {
  const admin = createAdminClient()
  const summary = {
    total: 0,
    unchanged: 0,
    wouldRebase: { total: 0, withSourceDraft: 0, publishesRefined: 0, reusesInitial: 0 },
    wouldBeRefused: {} as Record<string, number>,
    unavailable: {} as Record<string, number>,
    noPlan: 0,
  }
  for (const userId of await listPlanUserIds(admin)) {
    summary.total += 1
    const outcome = await dryRunPlanUser(admin, userId)
    if (outcome.kind === "unchanged") summary.unchanged += 1
    else if (outcome.kind === "no_plan") summary.noPlan += 1
    else if (outcome.kind === "would_be_refused") {
      summary.wouldBeRefused[outcome.reason] = (summary.wouldBeRefused[outcome.reason] ?? 0) + 1
    } else if (outcome.kind === "unavailable") {
      summary.unavailable[outcome.reason] = (summary.unavailable[outcome.reason] ?? 0) + 1
    } else {
      summary.wouldRebase.total += 1
      if (outcome.rebase.hasSourceDraft) summary.wouldRebase.withSourceDraft += 1
      if (outcome.rebase.publishesRefined) summary.wouldRebase.publishesRefined += 1
      if (outcome.rebase.reusesInitial) summary.wouldRebase.reusesInitial += 1
    }
  }
  console.log("PLAN REBASE DRY RUN (read-only, no RPC call; parameter rules checked, not executed)")
  console.log(JSON.stringify(summary, null, 2))
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(
      `Plan rebase dry run failed: ${error instanceof Error ? error.message : String(error)}`,
    )
    process.exitCode = 1
  })
}
