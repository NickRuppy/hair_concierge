import {
  routinePayloadV1Schema,
  routineProposalDeltaV1Schema,
  type PersonalPlanRoutineView,
} from "./contracts"
import {
  loadOwnerPendingRoutineProposal,
  loadOwnerRoutinePlan,
  loadOwnerRoutineVersion,
  type PersonalPlanRoutineReadClient,
} from "./repository"

export async function loadPersonalPlanRoutineView(input: {
  client: PersonalPlanRoutineReadClient
  userId: string
  enabled: boolean
}): Promise<PersonalPlanRoutineView | { status: "no_personal_plan" }> {
  const plan = await loadOwnerRoutinePlan(input.client, input.userId)
  if (!plan) return { status: "no_personal_plan" }
  const active = plan.active_routine_version_id
    ? await loadOwnerRoutineVersion(
        input.client,
        input.userId,
        plan.id,
        plan.active_routine_version_id,
      )
    : null
  const activeVersion = active
    ? { id: active.id, payload: routinePayloadV1Schema.parse(active.payload) }
    : null
  if (!input.enabled)
    return {
      status: activeVersion ? "active" : "stage4_not_available",
      personalPlanId: plan.id,
      planRevision: plan.revision,
      sourceRevision: plan.source_revision,
      activeVersion,
      pendingProposal: null,
    }
  if (!plan.pending_routine_proposal_id)
    return {
      status: activeVersion ? "active" : "personal_plan_incomplete",
      personalPlanId: plan.id,
      planRevision: plan.revision,
      sourceRevision: plan.source_revision,
      activeVersion,
      pendingProposal: null,
    }
  const proposal = await loadOwnerPendingRoutineProposal(
    input.client,
    input.userId,
    plan.id,
    plan.pending_routine_proposal_id,
  )
  if (!proposal)
    return {
      status: activeVersion ? "active" : "personal_plan_incomplete",
      personalPlanId: plan.id,
      planRevision: plan.revision,
      sourceRevision: plan.source_revision,
      activeVersion,
      pendingProposal: null,
    }
  const candidate = await loadOwnerRoutineVersion(
    input.client,
    input.userId,
    plan.id,
    proposal.candidate_routine_version_id,
  )
  if (!candidate)
    return {
      status: activeVersion ? "active" : "personal_plan_incomplete",
      personalPlanId: plan.id,
      planRevision: plan.revision,
      sourceRevision: plan.source_revision,
      activeVersion,
      pendingProposal: null,
    }
  return {
    status: activeVersion ? "active" : "proposal",
    personalPlanId: plan.id,
    planRevision: plan.revision,
    sourceRevision: plan.source_revision,
    activeVersion,
    pendingProposal: {
      id: proposal.id,
      candidateVersionId: proposal.candidate_routine_version_id,
      sourceRevision: proposal.source_revision,
      delta: routineProposalDeltaV1Schema.parse(proposal.delta),
      candidate: routinePayloadV1Schema.parse(candidate.payload),
    },
  }
}

export async function loadPersonalPlanRoutineAttention(input: {
  client: PersonalPlanRoutineReadClient
  userId: string
  enabled: boolean
}): Promise<{ hasPendingProposal: boolean }> {
  if (!input.enabled) return { hasPendingProposal: false }
  const plan = await loadOwnerRoutinePlan(input.client, input.userId)
  return { hasPendingProposal: Boolean(plan?.pending_routine_proposal_id) }
}
