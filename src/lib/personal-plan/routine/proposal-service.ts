import { CATEGORY_ROLE_POLICIES } from "../products/authorities"
import {
  applyRoutineEdits,
  diffRoutinePayloads,
  hashRoutineSemantics,
  type RoutineCompiledPayload,
  type RoutineEditOperation,
} from "../routine-candidate-compiler"
import { routinePayloadV1Schema, type RoutineProposalDeltaV1 } from "./contracts"
import {
  loadOwnerPendingRoutineProposal,
  loadOwnerRoutinePlan,
  loadOwnerRoutineVersion,
  type PersonalPlanRoutineReadClient,
  type RoutinePlanRow,
  type RoutineVersionRow,
} from "./repository"
import { numberField, transitionOutcome, type RoutineTransitionRpc } from "./transitions"

type Repository = {
  loadPlan(userId: string): Promise<RoutinePlanRow | null>
  loadVersion(userId: string, planId: string, versionId: string): Promise<RoutineVersionRow | null>
  loadPending?(
    userId: string,
    planId: string,
    proposalId: string,
  ): Promise<{ candidate_routine_version_id: string } | null>
}
type ProposalInput = {
  userId: string
  expectedRevision: number
  expectedSourceRevision: number
  operations: RoutineEditOperation[]
}
export type RoutineProposalResult =
  | {
      status: "staged" | "already_staged"
      routineVersionId: string
      routineProposalId: string
      revision: number
    }
  | { status: "no_semantic_change"; revision: number }
  | { status: "invalid_request"; reason: string }
  | {
      status: "conflict"
      reason:
        | "stale_active_version"
        | "stale_proposal"
        | "revision_conflict"
        | "source_revision_conflict"
        | "stale_source"
    }
  | { status: "temporarily_unavailable" }
export type RoutineProposalResolveResult =
  | { status: "accepted" | "rejected"; revision: number }
  | { status: "initial_proposal_not_rejectable" }
  | { status: "invalid_request"; reason: string }
  | {
      status: "conflict"
      reason:
        | "stale_proposal"
        | "revision_conflict"
        | "stale_active_version"
        | "source_revision_conflict"
        | "stale_source"
    }
  | { status: "temporarily_unavailable" }

function productIdentity(
  ref: RoutineEditOperation extends never
    ? never
    : Extract<RoutineEditOperation, { kind: "assignment_replace" }>["productRef"],
): string {
  if (ref.kind === "owned") return `owned:${ref.capturedProductId}:${ref.productId}`
  if (ref.kind === "planned") return `planned:${ref.plannedPurchaseId}:${ref.productId ?? ""}`
  if (ref.kind === "pending_review")
    return `pending_review:${ref.capturedProductId}:${ref.submissionId}`
  return "none"
}
function payloadIdentities(payload: RoutineCompiledPayload): Map<string, Set<string>> {
  const identities = new Map<string, Set<string>>()
  for (const category of payload.intent.categories) {
    for (const assignment of category.assignments) {
      const identity = productIdentity(assignment.productRef)
      identities.set(identity, new Set([...(identities.get(identity) ?? []), category.category]))
    }
  }
  return identities
}
function mapConflict(outcome: string): RoutineProposalResult | RoutineProposalResolveResult | null {
  return [
    "stale_active_version",
    "stale_proposal",
    "revision_conflict",
    "source_revision_conflict",
    "stale_source",
  ].includes(outcome)
    ? { status: "conflict", reason: outcome as "stale_active_version" }
    : null
}

export function createRoutineProposalService(input: {
  repository: Repository
  rpc: RoutineTransitionRpc
}) {
  async function baseFor(userId: string) {
    const plan = await input.repository.loadPlan(userId)
    if (!plan) return null
    let versionId = plan.active_routine_version_id
    if (!versionId && plan.pending_routine_proposal_id && input.repository.loadPending) {
      versionId =
        (await input.repository.loadPending(userId, plan.id, plan.pending_routine_proposal_id))
          ?.candidate_routine_version_id ?? null
    }
    if (!versionId) return { plan, version: null }
    return { plan, version: await input.repository.loadVersion(userId, plan.id, versionId) }
  }
  return {
    async propose(request: ProposalInput): Promise<RoutineProposalResult> {
      try {
        const loaded = await baseFor(request.userId)
        if (!loaded?.version)
          return { status: "invalid_request", reason: "routine_candidate_unavailable" }
        if (loaded.plan.revision !== request.expectedRevision)
          return { status: "conflict", reason: "revision_conflict" }
        if (loaded.plan.source_revision !== request.expectedSourceRevision)
          return { status: "conflict", reason: "source_revision_conflict" }
        const previous = routinePayloadV1Schema.parse(
          loaded.version.payload,
        ) as RoutineCompiledPayload
        const frozen = payloadIdentities(previous)
        for (const operation of request.operations) {
          if (
            operation.kind === "category_inclusion" &&
            !previous.intent.categories.some((entry) => entry.category === operation.category)
          )
            return { status: "invalid_request", reason: "unknown_category" }
          if (operation.kind !== "category_inclusion") {
            const category = previous.intent.categories.find((entry) =>
              entry.assignments.some(
                (assignment) => assignment.assignmentKey === operation.assignmentKey,
              ),
            )
            if (!category) return { status: "invalid_request", reason: "unknown_assignment" }
            if (
              operation.kind === "assignment_role" &&
              !CATEGORY_ROLE_POLICIES[category.category].allowedRoles.includes(
                operation.role as never,
              )
            )
              return { status: "invalid_request", reason: "invalid_role" }
            if (
              operation.kind === "assignment_replace" &&
              !frozen.get(productIdentity(operation.productRef))?.has(category.category)
            )
              return { status: "invalid_request", reason: "product_identity_not_frozen" }
          }
        }
        const next = applyRoutineEdits(previous, request.operations)
        next.parentVersionId = loaded.plan.active_routine_version_id
        const source = loaded.version
        if (
          !source.source_refined_need_version_id ||
          !source.source_portfolio_version_id ||
          !source.source_product_draft_id ||
          source.source_product_draft_revision === undefined
        )
          return { status: "invalid_request", reason: "source_metadata_unavailable" }
        if (hashRoutineSemantics(previous) === hashRoutineSemantics(next)) {
          const response = await input.rpc("personal_plan_record_routine_no_semantic_change", {
            p_user_id: request.userId,
            p_personal_plan_id: loaded.plan.id,
            p_expected_active_routine_version_id: loaded.plan.active_routine_version_id,
            p_expected_revision: request.expectedRevision,
            p_expected_source_revision: request.expectedSourceRevision,
            p_source_fingerprint: previous.source.sourceFingerprint,
          })
          const outcome = !response.error && transitionOutcome(response.data)
          if (!outcome) return { status: "temporarily_unavailable" }
          const conflict = mapConflict(String(outcome.outcome))
          if (conflict) return conflict as RoutineProposalResult
          const revision = numberField(outcome, "revision")
          return String(outcome.outcome) === "no_semantic_change" && revision !== null
            ? { status: "no_semantic_change", revision }
            : { status: "temporarily_unavailable" }
        }
        const delta = diffRoutinePayloads(
          previous,
          next,
          request.operations,
        ) as RoutineProposalDeltaV1
        const response = await input.rpc("personal_plan_stage_routine_successor", {
          p_user_id: request.userId,
          p_personal_plan_id: loaded.plan.id,
          p_expected_active_routine_version_id: loaded.plan.active_routine_version_id,
          p_expected_revision: request.expectedRevision,
          p_expected_source_revision: request.expectedSourceRevision,
          p_source_refined_need_version_id: source.source_refined_need_version_id,
          p_source_portfolio_version_id: source.source_portfolio_version_id,
          p_source_product_draft_id: source.source_product_draft_id,
          p_source_product_draft_revision: source.source_product_draft_revision,
          p_routine_schema_version: next.schemaVersion,
          p_routine_compiler_version: next.source.compilerVersion,
          p_routine_authority_versions: next.source.authorityVersions,
          p_routine_source_fingerprint: next.source.sourceFingerprint,
          p_routine_payload: next,
          p_proposal_delta: delta,
          p_direct_operation_keys: request.operations.map((operation) =>
            operation.kind === "category_inclusion"
              ? `category:${operation.category}`
              : operation.assignmentKey,
          ),
          p_origin: "editor",
        })
        const outcome = !response.error && transitionOutcome(response.data)
        if (!outcome) return { status: "temporarily_unavailable" }
        const conflict = mapConflict(String(outcome.outcome))
        if (conflict) return conflict as RoutineProposalResult
        const revision = numberField(outcome, "revision")
        const routineVersionId = outcome.routineVersionId
        const routineProposalId = outcome.routineProposalId
        return (outcome.outcome === "staged" || outcome.outcome === "already_staged") &&
          revision !== null &&
          typeof routineVersionId === "string" &&
          typeof routineProposalId === "string"
          ? { status: outcome.outcome, routineVersionId, routineProposalId, revision }
          : { status: "temporarily_unavailable" }
      } catch {
        return { status: "temporarily_unavailable" }
      }
    },
    async resolve(inputRequest: {
      userId: string
      proposalId: string
      action: "accept" | "reject"
      expectedRevision: number
    }): Promise<RoutineProposalResolveResult> {
      try {
        const plan = await input.repository.loadPlan(inputRequest.userId)
        if (!plan) return { status: "invalid_request", reason: "personal_plan_not_found" }
        const name =
          inputRequest.action === "accept"
            ? "personal_plan_confirm_routine_proposal"
            : "personal_plan_reject_routine_proposal"
        const response = await input.rpc(name, {
          p_user_id: inputRequest.userId,
          p_personal_plan_id: plan.id,
          p_proposal_id: inputRequest.proposalId,
          p_expected_revision: inputRequest.expectedRevision,
        })
        const outcome = !response.error && transitionOutcome(response.data)
        if (!outcome) return { status: "temporarily_unavailable" }
        const conflict = mapConflict(String(outcome.outcome))
        if (conflict) return conflict as RoutineProposalResolveResult
        if (outcome.outcome === "initial_proposal_not_rejectable")
          return { status: "initial_proposal_not_rejectable" }
        const revision = numberField(outcome, "revision")
        return (outcome.outcome === "accepted" || outcome.outcome === "rejected") &&
          revision !== null
          ? { status: outcome.outcome, revision }
          : { status: "invalid_request", reason: "invalid_source" }
      } catch {
        return { status: "temporarily_unavailable" }
      }
    },
  }
}

export function createSupabaseRoutineProposalService(input: {
  client: PersonalPlanRoutineReadClient & { rpc: RoutineTransitionRpc }
}) {
  return createRoutineProposalService({
    repository: {
      loadPlan: (userId) => loadOwnerRoutinePlan(input.client, userId),
      loadVersion: (userId, planId, versionId) =>
        loadOwnerRoutineVersion(input.client, userId, planId, versionId),
      async loadPending(userId, planId, proposalId) {
        return loadOwnerPendingRoutineProposal(input.client, userId, planId, proposalId)
      },
    },
    rpc: input.client.rpc.bind(input.client),
  })
}
