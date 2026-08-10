type Query = {
  select: (columns: string) => Query
  eq: (column: string, value: string) => Query
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
