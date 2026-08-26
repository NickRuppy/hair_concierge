type Query = {
  select: (columns: string) => Query
  eq: (column: string, value: unknown) => Query
  in?: (column: string, values: string[]) => Query
  maybeSingle: () => Promise<{ data: unknown; error: unknown }>
}
export type PersonalPlanRoutineReadClient = { from: (table: string) => Query }

export type RoutinePlanRow = {
  id: string
  revision: number
  source_revision: number
  active_routine_version_id: string | null
  pending_routine_proposal_id: string | null
}

export type RoutineVersionRow = {
  id: string
  payload: unknown
  source_refined_need_version_id?: string
  source_portfolio_version_id?: string
  source_product_draft_id?: string
  source_product_draft_revision?: number
}
export type RoutineProposalRow = {
  id: string
  candidate_routine_version_id: string
  source_revision: number
  delta: unknown
}
export type RefinedNeedSnapshotRow = {
  id: string
  output_snapshot: unknown
}
export type RoutineCatalogProductPresentationRow = {
  id: string
  name: string | null
  image_url: string | null
  category_key?: string | null
  category?: string | null
  is_active?: boolean | null
  lifecycle_status?: string | null
}

export async function loadOwnerRoutinePlan(
  client: PersonalPlanRoutineReadClient,
  userId: string,
): Promise<RoutinePlanRow | null> {
  const { data, error } = await client
    .from("personal_plans")
    .select("id, revision, source_revision, active_routine_version_id, pending_routine_proposal_id")
    .eq("user_id", userId)
    .maybeSingle()
  if (error) throw error
  return data as RoutinePlanRow | null
}

export async function loadOwnerRoutineVersion(
  client: PersonalPlanRoutineReadClient,
  userId: string,
  planId: string,
  versionId: string,
): Promise<RoutineVersionRow | null> {
  const { data, error } = await client
    .from("personal_plan_routine_versions")
    .select(
      "id, payload, source_refined_need_version_id, source_portfolio_version_id, source_product_draft_id, source_product_draft_revision",
    )
    .eq("id", versionId)
    .eq("user_id", userId)
    .eq("personal_plan_id", planId)
    .maybeSingle()
  if (error) throw error
  return data as RoutineVersionRow | null
}
export async function loadOwnerPendingRoutineProposal(
  client: PersonalPlanRoutineReadClient,
  userId: string,
  planId: string,
  proposalId: string,
): Promise<RoutineProposalRow | null> {
  const { data, error } = await client
    .from("personal_plan_routine_proposals")
    .select("id, candidate_routine_version_id, source_revision, delta")
    .eq("id", proposalId)
    .eq("user_id", userId)
    .eq("personal_plan_id", planId)
    .maybeSingle()
  if (error) throw error
  return data as RoutineProposalRow | null
}

/** Immutable source authority for the frozen Routine projection. */
export async function loadOwnerRefinedNeedSnapshot(
  client: PersonalPlanRoutineReadClient,
  userId: string,
  planId: string,
  refinedVersionId: string,
): Promise<RefinedNeedSnapshotRow | null> {
  const { data, error } = await client
    .from("personal_plan_need_versions")
    .select("id, output_snapshot")
    .eq("id", refinedVersionId)
    .eq("user_id", userId)
    .eq("personal_plan_id", planId)
    .eq("kind", "refined")
    .maybeSingle()
  if (error) throw error
  return data as RefinedNeedSnapshotRow | null
}

export async function loadActiveRoutineCatalogProductPresentation(
  client: PersonalPlanRoutineReadClient,
  productIds: readonly string[],
): Promise<RoutineCatalogProductPresentationRow[]> {
  const ids = [...new Set(productIds.filter(Boolean))].slice(0, 64)
  if (ids.length === 0) return []

  const base = client
    .from("products")
    .select("id, name, image_url, category_key, is_active, lifecycle_status")
    .eq("is_active", true)
    .eq("lifecycle_status", "active")
  if (typeof base.in !== "function") return []
  const query = base.in("id", ids)
  const { data, error } = await (query as unknown as PromiseLike<{
    data: unknown[] | null
    error: unknown
  }>)
  if (error) throw error
  return (data ?? []) as RoutineCatalogProductPresentationRow[]
}
