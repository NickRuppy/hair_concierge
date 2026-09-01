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
/**
 * Same for the confirm — but `stale_proposal` is deliberately NOT here.
 *
 * A retry re-reads the same rows and rebuilds the same request, so anything a
 * retry cannot change must be terminal or the outbox claim re-arms forever.
 * `revision_conflict` and `stale_source` name a value another writer moved,
 * which the next pass reads afresh. `stale_proposal` means the proposal this
 * very call staged is not the plan's pending one, or is no longer pending
 * (`20260808062603:411-414`) — a state the identical next attempt reproduces.
 */
const CONFIRM_CONFLICTS = new Set(["revision_conflict", "stale_source"])

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
 *    (`20260808070000:76-88`).
 *
 *    This writes a NEW Routine version row carrying the historical payload,
 *    rather than re-pointing at the old one. The RPC's `ON CONFLICT
 *    (personal_plan_id, source_portfolio_version_id, payload_hash) DO NOTHING`
 *    does not match the original row, because that row's `payload_hash` was
 *    taken over the payload as SUBMITTED while the row STORES the same payload
 *    with `versionId` / `planId` / `parentVersionId` / `createdAt` / `source`
 *    injected (`20260808070000:91-111`), and only `versionId`/`createdAt` are
 *    stripped before hashing. The new row is harmless and carries the same
 *    user-visible content and the same source lineage, which is what the
 *    caller's re-read classifies on. It does mean a REPEATED flip re-uses the
 *    row this service created the first time, which is why the proposal
 *    fingerprint below must vary per attempt.
 * 2. `personal_plan_confirm_routine_proposal` on the proposal that staged.
 *
 * A value another writer moved is reported as a retryable `conflict`; anything
 * an identical retry would reproduce is terminal. The caller decides the
 * outcome from an owner-scoped re-read, never from this result.
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
  // A missing or foreign plan row is an ownership/infrastructure fact, not
  // "this draft never produced a Routine" — the caller maps the latter to the
  // routine page's pending-proposal recovery, which would be a lie here.
  if (!plan) return { status: "unavailable", reason: "plan_unavailable" }

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

  // A PENDING proposal for this very Routine means the completion that staged
  // it never got its confirm — a lost-response replay, not a historical reuse.
  // That case belongs to the person: the routine page's own "Änderungen prüfen"
  // recovery is the next step (fix round 1, IMPORTANT 2). Staging over it would
  // also supersede every other pending proposal on the plan
  // (`20260808070000:181-183`), silently discarding a review the person may be
  // in the middle of.
  const pendingProposal = (await readMaybeSingle(
    client
      .from("personal_plan_routine_proposals")
      .select("id")
      .eq("candidate_routine_version_id", routine.id)
      .eq("user_id", userId)
      .eq("personal_plan_id", personalPlanId)
      .eq("status", "pending")
      .limit(1)
      .maybeSingle(),
  )) as { id: string } | null
  if (pendingProposal) return { status: "unavailable", reason: "proposal_pending" }

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
    // The proposal fingerprint is `sha256(payload_hash : delta : direct_keys)`
    // (`20260808070000:115-117`), and every other input here is deterministic
    // for a given pair of versions. Without something per-transition, a person
    // who flips back a SECOND time (A→B→A→B→A) re-derives the fingerprint of
    // the proposal the FIRST re-activation already had accepted; the stager
    // then returns `already_staged` for that accepted proposal without
    // re-pending it (`20260808070000:152-179`) and the confirm answers
    // `stale_proposal` forever. Naming the exact transition — which Routine is
    // being restored, over which currently active one, at which plan revision —
    // makes each attempt its own proposal, while an identical RETRY at the same
    // plan revision still re-finds its own pending proposal and confirms it.
    p_direct_operation_keys: [
      `refinement_recompute:reactivate:${routine.id}:${plan.active_routine_version_id ?? "none"}:${plan.revision}`,
    ],
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
