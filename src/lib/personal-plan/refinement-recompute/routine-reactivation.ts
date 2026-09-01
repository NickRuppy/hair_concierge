import type { Stage3RecomputeRoutineReactivation } from "./types"

type QueryResult = { data: unknown; error: unknown }
/** A PostgREST filter builder: chainable, and itself the thenable that runs the read. */
type FilterQuery = PromiseLike<QueryResult> & {
  eq: (column: string, value: unknown) => FilterQuery
  order: (column: string, options: { ascending: boolean }) => FilterQuery
  limit: (count: number) => FilterQuery
  maybeSingle: () => PromiseLike<QueryResult>
}

export type RoutineReactivationClient = {
  from: (table: string) => { select: (columns: string) => FilterQuery }
  rpc(
    functionName:
      | "personal_plan_stage_routine_successor"
      | "personal_plan_confirm_routine_proposal",
    args: Record<string, unknown>,
  ): PromiseLike<QueryResult>
}

/** Staging outcomes that mean "the plan moved under us", not "this is invalid". */
const STAGE_CONFLICTS = new Set([
  "stale_active_version",
  "revision_conflict",
  "source_revision_conflict",
])
/** Same for the confirm: a moved plan, a superseded proposal, a moved source. */
const CONFIRM_CONFLICTS = new Set(["revision_conflict", "stale_proposal", "stale_source"])

function outcomeOf(data: unknown): Record<string, unknown> | null {
  return data && typeof data === "object" ? (data as Record<string, unknown>) : null
}

async function readMaybeSingle(query: PromiseLike<QueryResult>): Promise<unknown> {
  const { data, error } = await query
  if (error) throw error
  return data ?? null
}

type RoutineVersionRow = {
  id: string
  schema_version: number
  compiler_version: string
  authority_versions: unknown
  source_fingerprint: string
  source_refined_need_version_id: string
  source_portfolio_version_id: string
  source_product_draft_id: string
  source_product_draft_revision: number
  payload: unknown
}

/**
 * Makes the Routine version compiled from `productDraftId` the plan's active
 * Routine again, using only the existing lifecycle RPCs.
 *
 * Why this exists: Stage-2 dedupes refined need versions by input hash
 * (`20260825130000`), so a person who returns to an earlier answer set (A→B→A)
 * moves the plan's head back to a refined version whose Stage-3 draft is
 * already `completed`. The completion path can only replay that draft's stored
 * receipt (`production-persistence-gateway.ts:913-916`) — it re-activates
 * nothing — while the Routine compiled from it still exists, merely superseded.
 * Per the plan's silent-apply ruling (R2) the honest outcome is to put it back
 * in front of the person.
 *
 * Two sequential RPCs, each with its own compare-and-set:
 * 1. `personal_plan_stage_routine_successor` with the HISTORICAL Routine's own
 *    source metadata and compiled payload. Its `stale_source` guards all pass
 *    for this shape: the plan's `current_refined_need_version_id` is that
 *    version again, and the portfolio/draft rows are exactly the ones it names
 *    (`20260808070000:76-88`). Its `ON CONFLICT (personal_plan_id,
 *    source_portfolio_version_id, payload_hash) DO NOTHING` means the identical
 *    payload re-uses the existing Routine version row rather than duplicating it.
 * 2. `personal_plan_confirm_routine_proposal` on the proposal that staged.
 *
 * Anything moving in between is reported as a retryable `conflict`; the caller
 * decides the outcome from an owner-scoped re-read, never from this result.
 */
export async function reactivateRoutineForProductDraft(input: {
  client: RoutineReactivationClient
  userId: string
  personalPlanId: string
  productDraftId: string
}): Promise<Stage3RecomputeRoutineReactivation> {
  const { client, userId, personalPlanId, productDraftId } = input

  const plan = (await readMaybeSingle(
    client
      .from("personal_plans")
      .select("id, revision, source_revision, active_routine_version_id")
      .eq("id", personalPlanId)
      .eq("user_id", userId)
      .maybeSingle(),
  )) as {
    revision: number
    source_revision: number
    active_routine_version_id: string | null
  } | null
  if (!plan) return { status: "unavailable", reason: "no_routine_for_draft" }

  // The same two-step join the completion receipt loader uses
  // (`stage3-persistence-supabase.ts:515-535`): the portfolio a completed draft
  // froze is unique, and the FIRST Routine compiled from that portfolio is the
  // one Stage-3 completion produced. Later successors on the same portfolio are
  // Routine-editor edits, which plan decision 12 does not preserve across a
  // recompute anyway.
  const portfolio = (await readMaybeSingle(
    client
      .from("personal_plan_portfolio_versions")
      .select("id")
      .eq("source_product_draft_id", productDraftId)
      .eq("user_id", userId)
      .eq("personal_plan_id", personalPlanId)
      .maybeSingle(),
  )) as { id: string } | null
  if (!portfolio) return { status: "unavailable", reason: "no_routine_for_draft" }

  const routine = (await readMaybeSingle(
    client
      .from("personal_plan_routine_versions")
      .select(
        "id, schema_version, compiler_version, authority_versions, source_fingerprint, source_refined_need_version_id, source_portfolio_version_id, source_product_draft_id, source_product_draft_revision, payload",
      )
      .eq("source_portfolio_version_id", portfolio.id)
      .eq("user_id", userId)
      .eq("personal_plan_id", personalPlanId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
  )) as RoutineVersionRow | null
  if (!routine) return { status: "unavailable", reason: "no_routine_for_draft" }
  if (plan.active_routine_version_id === routine.id) return { status: "unchanged" }

  const stageResponse = await client.rpc("personal_plan_stage_routine_successor", {
    p_user_id: userId,
    p_personal_plan_id: personalPlanId,
    p_expected_active_routine_version_id: plan.active_routine_version_id,
    p_expected_revision: plan.revision,
    p_expected_source_revision: plan.source_revision,
    p_source_refined_need_version_id: routine.source_refined_need_version_id,
    p_source_portfolio_version_id: routine.source_portfolio_version_id,
    p_source_product_draft_id: routine.source_product_draft_id,
    p_source_product_draft_revision: routine.source_product_draft_revision,
    p_routine_schema_version: routine.schema_version,
    p_routine_compiler_version: routine.compiler_version,
    p_routine_authority_versions: routine.authority_versions ?? {},
    p_routine_source_fingerprint: routine.source_fingerprint,
    p_routine_payload: routine.payload,
    // Nothing about the Routine's own content changes — this restores a payload
    // the person already had. An empty delta is the truthful description, and
    // it is only ever read in the window before the confirm below lands.
    p_proposal_delta: { schemaVersion: 1, direct: [], consequential: [], unchangedItemCount: 0 },
    p_direct_operation_keys: [],
    // Not an editor edit: this is the system's own refinement recompute, the
    // same origin the sync worker's self-heal pass stages under.
    p_origin: "source_sync",
  })
  if (stageResponse.error) return { status: "unavailable", reason: "stage_rejected" }
  const staged = outcomeOf(stageResponse.data)
  const stageOutcome = staged ? String(staged.outcome) : null
  if (stageOutcome && STAGE_CONFLICTS.has(stageOutcome)) return { status: "conflict" }
  if (
    (stageOutcome !== "staged" && stageOutcome !== "already_staged") ||
    typeof staged?.routineProposalId !== "string" ||
    typeof staged?.revision !== "number"
  ) {
    return { status: "unavailable", reason: "stage_rejected" }
  }

  const confirmResponse = await client.rpc("personal_plan_confirm_routine_proposal", {
    p_user_id: userId,
    p_personal_plan_id: personalPlanId,
    p_proposal_id: staged.routineProposalId,
    p_expected_revision: staged.revision,
  })
  if (confirmResponse.error) return { status: "unavailable", reason: "confirm_rejected" }
  const confirmed = outcomeOf(confirmResponse.data)
  const confirmOutcome = confirmed ? String(confirmed.outcome) : null
  if (confirmOutcome === "accepted" || confirmOutcome === "already_accepted") {
    return { status: "activated", routineVersionId: String(staged.routineVersionId ?? routine.id) }
  }
  if (confirmOutcome && CONFIRM_CONFLICTS.has(confirmOutcome)) return { status: "conflict" }
  return { status: "unavailable", reason: "confirm_rejected" }
}
