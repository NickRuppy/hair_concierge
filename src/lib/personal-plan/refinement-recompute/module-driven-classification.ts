import { mapModuleProjections } from "@/lib/personal-plan/persistence/stage2-refinement-supabase"

/**
 * Classification of a `refined_need` Routine-source claim (T1.5).
 *
 * - `stale_target`     the claim's refined version is no longer the plan's
 *                      current one; a newer change supersedes it.
 * - `module_driven`    the version came out of a Stage-2 MODULE projection, so
 *                      the headless recompute owns it.
 * - `not_module_driven` today's linear refinement / Stage-3 repair lineage,
 *                      which keeps the worker's existing terminal behavior.
 */
export type RoutineRefinedNeedClassification =
  | "stale_target"
  | "module_driven"
  | "not_module_driven"

type QueryResult = { data: unknown; error: unknown }
/** A PostgREST filter builder: chainable, and itself the thenable that runs the read. */
type FilterQuery = PromiseLike<QueryResult> & {
  eq: (column: string, value: unknown) => FilterQuery
  maybeSingle: () => PromiseLike<QueryResult>
}
export type RoutineRefinedNeedClassificationClient = {
  from: (table: string) => { select: (columns: string) => FilterQuery }
}

type RefinementLineageRow = {
  module_projections: unknown
  result_refined_need_version_id: unknown
}

function hasModuleLineage(row: RefinementLineageRow, refinedVersionId: string): boolean {
  // `mapModuleProjections` is the repo's canonical reader for this column; it
  // keeps only the known Stage-2 module keys, which is exactly the set
  // `personal_plan_complete_stage2_module` can ever write.
  const projections = mapModuleProjections(row.module_projections)
  if (Object.keys(projections).length === 0) return false
  if (row.result_refined_need_version_id === refinedVersionId) return true
  return Object.values(projections).some(
    (projection) => projection?.needVersionId === refinedVersionId,
  )
}

/**
 * Owner-scoped read behind the sync worker's self-heal lane. It answers the two
 * questions the outbox row itself cannot (`RoutineSourceClaim` carries no
 * lineage, only `sourceKind`/`sourceKey`).
 *
 * The module-driven rule mirrors the v2 activation SQL gate
 * (`20260825140000_personal_plan_refinement_recompute_activation.sql`): a
 * refinement draft of this plan carries a non-empty `module_projections` AND the
 * version is either one of its projection `needVersionId`s or its
 * `result_refined_need_version_id`. The SQL gate's second condition ("no prior
 * Routine was compiled from this version") is deliberately NOT mirrored here: it
 * governs whether that completion may activate immediately, and the completion
 * itself still evaluates it. Reading it here would only duplicate the RPC's own
 * decision one round trip earlier.
 */
export async function classifyModuleDrivenRefinedVersion(input: {
  client: RoutineRefinedNeedClassificationClient
  userId: string
  personalPlanId: string
  refinedVersionId: string
}): Promise<RoutineRefinedNeedClassification> {
  const { data: plan, error: planError } = await input.client
    .from("personal_plans")
    .select("current_refined_need_version_id")
    .eq("id", input.personalPlanId)
    .eq("user_id", input.userId)
    .maybeSingle()
  if (planError) throw planError
  const currentRefinedVersionId = (plan as { current_refined_need_version_id?: unknown } | null)
    ?.current_refined_need_version_id
  if (currentRefinedVersionId !== input.refinedVersionId) return "stale_target"

  const { data: drafts, error: draftsError } = await input.client
    .from("personal_plan_refinement_drafts")
    .select("module_projections,result_refined_need_version_id")
    .eq("personal_plan_id", input.personalPlanId)
    .eq("user_id", input.userId)
  if (draftsError) throw draftsError
  const rows = (Array.isArray(drafts) ? drafts : []) as RefinementLineageRow[]
  return rows.some((row) => hasModuleLineage(row, input.refinedVersionId))
    ? "module_driven"
    : "not_module_driven"
}
