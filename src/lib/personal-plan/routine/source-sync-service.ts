import type { SupabaseClient } from "@supabase/supabase-js"

import type { PersonalPlanRoutineTerminalSourceDetails } from "@/lib/observability/personal-plan-application"

import type { RoutineRefinedNeedClassification } from "../refinement-recompute/module-driven-classification"
import type { Stage3RecomputeResult } from "../refinement-recompute/types"
import {
  parseProposedProductPortfolio,
  type AnyProposedProductPortfolio,
} from "../products/contracts"
import {
  diffRoutinePayloads,
  hashRoutineSemantics,
  PERSONAL_PLAN_ROUTINE_COMPILER_VERSION,
  type RoutineCompiledPayload,
  type RoutineProposalDelta,
} from "../routine-candidate-compiler"
import { semanticHash } from "./canonicalize"
import { resolveRoutineItemCadence } from "./cadence"
import type { RoutineCadenceAuthorityReader } from "./cadence-authority"
import { routinePayloadV1Schema } from "./contracts"
import {
  reconcileRoutineUserProductSource,
  type RoutineSourceUserProduct,
} from "./source-reconciler"

export type RoutineSourceClaim = {
  outboxId: string
  userId: string
  personalPlanId: string
  sourceKind: string
  sourceKey: string
  observedRevision: number
  leaseToken: string
}

type RoutineSourcePlan = {
  id: string
  revision: number
  sourceRevision: number
  activeRoutineVersionId: string | null
}

type RoutineSourceBase = {
  routine: RoutineCompiledPayload
  portfolio: AnyProposedProductPortfolio
  sourceProductDraftId: string
  sourceProductDraftRevision: number
}

export function parseRoutineSourceBaseSnapshots(input: {
  routine: unknown
  portfolio: unknown
  sourceProductDraftId: unknown
  sourceProductDraftRevision: unknown
}): RoutineSourceBase | null {
  try {
    return {
      routine: routinePayloadV1Schema.parse(input.routine) as RoutineCompiledPayload,
      portfolio: parseProposedProductPortfolio(input.portfolio, { includeV4: true }),
      sourceProductDraftId: String(input.sourceProductDraftId),
      sourceProductDraftRevision: Number(input.sourceProductDraftRevision),
    }
  } catch {
    return null
  }
}

type SourceTransitionOutcome =
  | "staged"
  | "already_staged"
  | "suppressed_rejected"
  | "no_semantic_change"
  | "stale_active_version"
  | "revision_conflict"
  | "source_revision_conflict"
  | "stale_source"
  | "invalid_source"
  | "temporarily_unavailable"

export type RoutineSourceSyncRepository = {
  loadPlan(userId: string): Promise<RoutineSourcePlan | null>
  claim(userId: string, personalPlanId: string, limit: number): Promise<RoutineSourceClaim[]>
  loadBase(userId: string, plan: RoutineSourcePlan): Promise<RoutineSourceBase | null>
  loadUserProduct(userId: string, sourceKey: string): Promise<RoutineSourceUserProduct | null>
  recordNoChange(input: {
    userId: string
    plan: RoutineSourcePlan
    sourceFingerprint: string
  }): Promise<SourceTransitionOutcome>
  stage(input: {
    userId: string
    plan: RoutineSourcePlan
    sourceKey: string
    portfolio: AnyProposedProductPortfolio
    routine: RoutineCompiledPayload
    delta: unknown
    origin: "acquisition"
  }): Promise<SourceTransitionOutcome>
  finish(input: { claim: RoutineSourceClaim; errorCode: string | null }): Promise<boolean>
}

export type RoutineSourceSyncResult =
  | { status: "no_personal_plan" }
  | {
      status: "processed"
      processed: number
      terminalized: number
      deferred: number
      unfinished: number
      proposalStaged: boolean
      /**
       * A module-driven refined-need claim healed inline: a successor Routine
       * was compiled AND activated during this sync. Unlike `proposalStaged`
       * there is nothing for the user to confirm, so the client reloads the
       * Routine view on this signal too.
       */
      recomputeApplied: boolean
    }
  | { status: "conflict"; reason: string }
  | { status: "temporarily_unavailable" }

/**
 * The self-heal lane (T1.5). Optional: without it every `refined_need` claim
 * keeps its historical blanket-terminal behavior, so non-production
 * constructions of this service stay valid.
 */
export type RoutineRefinedNeedRecomputeLane = {
  /** Owner-scoped lineage read — see `refinement-recompute/module-driven-classification.ts`. */
  classify(input: {
    userId: string
    personalPlanId: string
    refinedVersionId: string
  }): Promise<RoutineRefinedNeedClassification>
  recompute(input: {
    userId: string
    personalPlanId: string
    refinedVersionId: string
  }): Promise<Stage3RecomputeResult>
}

/** Retryable recompute failure: non-terminal, so the outbox re-arms in 30s. */
const REFINEMENT_RECOMPUTE_RETRY_ERROR = "refinement_recompute_retry"
/** Non-retryable recompute failure: terminal, so the outbox row parks. */
const REFINEMENT_RECOMPUTE_TERMINAL_ERROR = "terminal_refinement_recompute_blocked"

export type RoutineSuccessorCadenceResolver = (
  routine: RoutineCompiledPayload,
) => Promise<RoutineCompiledPayload>

function terminalSourceError(claim: RoutineSourceClaim, reason?: string): string | null {
  if (claim.sourceKind === "refined_need") return "terminal_refinement_pending_stage3"
  if (claim.sourceKind === "portfolio_version") return "terminal_unsupported_routine_source"
  if (claim.sourceKind !== "user_product") return null
  if (reason === "user_product_not_found") return "terminal_user_product_not_found"
  if (reason === "category_mismatch") return "terminal_category_mismatch"
  if (reason === "invalid_product_state") return "terminal_invalid_product_state"
  return null
}

function isTerminalSourceError(reason: string | null | undefined): reason is `terminal_${string}` {
  return Boolean(reason?.startsWith("terminal_"))
}

function productIdForCadence(item: RoutineCompiledPayload["items"][number]): string | null {
  return item.product.kind === "owned" || item.product.kind === "planned"
    ? item.product.productId
    : null
}

export async function resolveSuccessorRoutineCadences(input: {
  routine: RoutineCompiledPayload
  authorityReader: RoutineCadenceAuthorityReader
}): Promise<RoutineCompiledPayload> {
  const productIds = input.routine.items
    .map(productIdForCadence)
    .filter((productId): productId is string => Boolean(productId))
  const authorityFacts = await input.authorityReader.load({ productIds })
  const routine = structuredClone(input.routine)
  routine.source.compilerVersion = PERSONAL_PLAN_ROUTINE_COMPILER_VERSION
  routine.source.authorityVersions.routine = PERSONAL_PLAN_ROUTINE_COMPILER_VERSION
  routine.items = routine.items.map((item) => {
    const resolved = resolveRoutineItemCadence({
      category: item.category,
      role: item.role,
      productId: productIdForCadence(item),
      recommended: item.cadence.recommended,
      userOverride:
        typeof item.cadence.userOverride === "string" ? item.cadence.userOverride : null,
      authorityFacts,
    })
    return {
      ...item,
      cadence: {
        ...item.cadence,
        ...(resolved ? { resolved } : {}),
      },
    }
  })
  return routine
}

export function alignLegacyCadenceForDelta(
  previous: RoutineCompiledPayload,
  next: RoutineCompiledPayload,
): RoutineCompiledPayload {
  const aligned = structuredClone(previous)
  const nextByItemKey = new Map(next.items.map((item) => [item.itemKey, item]))
  aligned.items = aligned.items.map((item) => {
    if (item.cadence.resolved) return item
    const successor = nextByItemKey.get(item.itemKey)
    if (!successor?.cadence.resolved) return item
    return {
      ...item,
      cadence: { ...item.cadence, resolved: successor.cadence.resolved },
    }
  })
  return aligned
}

const successfulOutcomes = new Set<SourceTransitionOutcome>([
  "staged",
  "already_staged",
  "suppressed_rejected",
  "no_semantic_change",
])

export function createRoutineSourceSyncService(input: {
  repository: RoutineSourceSyncRepository
  cadenceAuthorityReader?: RoutineCadenceAuthorityReader
  resolveCadences?: RoutineSuccessorCadenceResolver
  reportTerminalSource?: (details: PersonalPlanRoutineTerminalSourceDetails) => void
  refinementRecompute?: RoutineRefinedNeedRecomputeLane
}) {
  const resolveCadences =
    input.resolveCadences ??
    (input.cadenceAuthorityReader
      ? (routine: RoutineCompiledPayload) =>
          resolveSuccessorRoutineCadences({
            routine,
            authorityReader: input.cadenceAuthorityReader!,
          })
      : async (routine: RoutineCompiledPayload) => routine)
  /**
   * The batch tail: finish every claim under its decided error code, report the
   * terminal ones, and reduce the batch to a single result. `claimErrors` holds
   * `null` for a claim that was decided as successfully processed (only the
   * self-heal lane does that today) — distinct from an absent entry, which
   * falls back to the batch-level transition error.
   */
  async function settleClaims(settle: {
    claims: RoutineSourceClaim[]
    claimErrors: Map<string, string | null>
    outcome: SourceTransitionOutcome | null
    changed: boolean
    recomputeApplied: boolean
  }): Promise<RoutineSourceSyncResult> {
    const { claims, claimErrors, outcome } = settle
    const transitionError = outcome && !successfulOutcomes.has(outcome) ? outcome : null
    const finishTransitionError =
      transitionError === "invalid_source" ? "terminal_invalid_source" : transitionError
    const errorCodeFor = (claim: RoutineSourceClaim) =>
      claimErrors.has(claim.outboxId)
        ? (claimErrors.get(claim.outboxId) ?? null)
        : finishTransitionError
    const finished = await Promise.all(
      claims.map((claim) => input.repository.finish({ claim, errorCode: errorCodeFor(claim) })),
    )
    for (const [index, claim] of claims.entries()) {
      if (!finished[index]) continue
      const terminalCode = errorCodeFor(claim)
      if (!isTerminalSourceError(terminalCode)) continue
      try {
        input.reportTerminalSource?.({
          planId: claim.personalPlanId,
          sourceKind: claim.sourceKind,
          observedRevision: claim.observedRevision,
          terminalCode,
        })
      } catch {
        // Observability must never make a durably settled source retry.
      }
    }
    if (transitionError) return { status: "conflict", reason: transitionError }
    const unfinished = finished.filter((didFinish) => !didFinish).length
    const deferredErrors = claims
      .map((claim, index) => (finished[index] ? claimErrors.get(claim.outboxId) : undefined))
      .filter((reason): reason is string => Boolean(reason) && !isTerminalSourceError(reason))
    const deferredError = deferredErrors[0]
    // A staged sibling change — or a healed module recompute, which is already
    // active rather than merely proposed — is a successful user-visible outcome.
    // Keep unresolved claims retryable without hiding it behind a batch-level
    // conflict. If every claim was deferred, retain the conflict response so
    // background callers know there was no progress to surface.
    if (deferredError && !settle.changed && !settle.recomputeApplied)
      return { status: "conflict", reason: deferredError }
    if (unfinished > 0 && outcome !== "staged" && outcome !== "already_staged")
      return { status: "temporarily_unavailable" }
    const terminalized = claims.filter(
      (claim, index) => finished[index] && isTerminalSourceError(claimErrors.get(claim.outboxId)),
    ).length
    return {
      status: "processed",
      processed: claims.length - terminalized - deferredErrors.length - unfinished,
      terminalized,
      deferred: deferredErrors.length,
      unfinished,
      proposalStaged: outcome === "staged" || outcome === "already_staged",
      recomputeApplied: settle.recomputeApplied,
    }
  }

  /**
   * Requirement 4d(i)/(ii): module-driven `refined_need` claims are processed in
   * their own exclusive pass, BEFORE the ordinary reconciliation base is
   * loaded. A successful recompute activates a Routine and advances the plan's
   * revision / source revision / active version, so every sibling claim in the
   * same batch has to be reconciled and CAS-staged against the post-activation
   * state — never the pre-batch snapshot.
   */
  async function runRefinedNeedRecomputes(pass: {
    userId: string
    plan: RoutineSourcePlan
    claims: RoutineSourceClaim[]
    claimErrors: Map<string, string | null>
  }): Promise<{ ran: boolean; applied: boolean }> {
    const lane = input.refinementRecompute
    // Without an active Routine there is nothing to recompute against; the
    // orchestrator would only report `no_active_routine`. Keep the historical
    // terminal behavior for that cohort instead, at zero extra round trips.
    if (!lane || !pass.plan.activeRoutineVersionId) return { ran: false, applied: false }
    let ran = false
    let applied = false
    for (const claim of pass.claims) {
      if (claim.sourceKind !== "refined_need") continue
      const lineage = {
        userId: pass.userId,
        personalPlanId: pass.plan.id,
        refinedVersionId: claim.sourceKey,
      }
      let classification: RoutineRefinedNeedClassification
      try {
        classification = await lane.classify(lineage)
      } catch {
        // The classification read is infrastructure, not a verdict. Re-arm this
        // one claim instead of stranding the whole leased batch on a 503.
        pass.claimErrors.set(claim.outboxId, REFINEMENT_RECOMPUTE_RETRY_ERROR)
        continue
      }
      // Today's linear refinement, the Stage-3 Routine-authority repair and
      // editor edits keep the existing terminal handling.
      if (classification === "not_module_driven") continue
      if (classification === "stale_target") {
        // A newer refined version supersedes this claim and carries its own
        // outbox row: settle this one as processed for its observed revision.
        pass.claimErrors.set(claim.outboxId, null)
        continue
      }
      ran = true
      // The orchestrator reports failure rather than throwing (T1.3), but a
      // rejection must never leave the batch mid-flight either.
      const result = await lane.recompute(lineage).catch(
        (): Stage3RecomputeResult => ({
          status: "unavailable",
          reason: "unexpected_error",
          retryable: true,
        }),
      )
      if (result.status === "applied") applied = true
      pass.claimErrors.set(
        claim.outboxId,
        result.status === "unavailable"
          ? result.retryable
            ? REFINEMENT_RECOMPUTE_RETRY_ERROR
            : REFINEMENT_RECOMPUTE_TERMINAL_ERROR
          : null,
      )
    }
    return { ran, applied }
  }

  return {
    async sync(request: { userId: string; limit?: number }): Promise<RoutineSourceSyncResult> {
      const claimedPlan = await input.repository.loadPlan(request.userId)
      if (!claimedPlan) return { status: "no_personal_plan" }
      const claims = await input.repository.claim(
        request.userId,
        claimedPlan.id,
        Math.min(Math.max(request.limit ?? 20, 1), 100),
      )
      if (claims.length === 0)
        return {
          status: "processed",
          processed: 0,
          terminalized: 0,
          deferred: 0,
          unfinished: 0,
          proposalStaged: false,
          recomputeApplied: false,
        }

      const claimErrors = new Map<string, string | null>()
      const recompute = await runRefinedNeedRecomputes({
        userId: request.userId,
        plan: claimedPlan,
        claims,
        claimErrors,
      })
      // Reload the plan whenever the recompute ran at all: `applied` is not the
      // only outcome that can have advanced plan state (a concurrent activation
      // reported as `unavailable` moved it too).
      const plan = recompute.ran
        ? ((await input.repository.loadPlan(request.userId)) ?? claimedPlan)
        : claimedPlan
      const remainingClaims = claims.filter((claim) => !claimErrors.has(claim.outboxId))
      if (remainingClaims.length === 0) {
        return settleClaims({
          claims,
          claimErrors,
          outcome: null,
          changed: false,
          recomputeApplied: recompute.applied,
        })
      }

      const base = await input.repository.loadBase(request.userId, plan)
      if (!base) {
        // The lane ran BEFORE the base load, so its outcomes are already final:
        // settle through the same tail so lane-decided terminal codes are still
        // reported and a committed activation still reaches the client.
        for (const claim of remainingClaims) {
          claimErrors.set(claim.outboxId, "routine_source_base_unavailable")
        }
        const settled = await settleClaims({
          claims,
          claimErrors,
          outcome: null,
          changed: false,
          recomputeApplied: recompute.applied,
        })
        // An unavailable base is a batch-level infrastructure failure: keep
        // today's 503 unless the lane already committed something the client
        // has to see, in which case the healed result is the honest answer.
        return recompute.applied ? settled : { status: "temporarily_unavailable" }
      }

      let routine = base.routine
      let portfolio = base.portfolio
      const changedClaims: RoutineSourceClaim[] = []
      const directChangesByItemKey = new Map<string, RoutineProposalDelta["direct"][number]>()
      for (const claim of remainingClaims) {
        if (claim.sourceKind !== "user_product") {
          claimErrors.set(
            claim.outboxId,
            terminalSourceError(claim) ?? "unsupported_routine_source",
          )
          continue
        }
        const userProduct = await input.repository.loadUserProduct(request.userId, claim.sourceKey)
        if (!userProduct) {
          claimErrors.set(
            claim.outboxId,
            terminalSourceError(claim, "user_product_not_found") ?? "user_product_not_found",
          )
          continue
        }
        const result = reconcileRoutineUserProductSource({
          routine,
          portfolio,
          userProduct,
          sourceRevision: plan.sourceRevision,
        })
        if (result.status === "invalid_source") {
          claimErrors.set(
            claim.outboxId,
            terminalSourceError(claim, result.reason) ?? result.reason,
          )
          continue
        }
        if (result.status === "changed") {
          routine = result.routine
          portfolio = result.portfolio
          changedClaims.push(claim)
          for (const change of result.delta.direct) {
            directChangesByItemKey.set(change.itemKey, change)
          }
        }
      }

      let outcome: SourceTransitionOutcome | null = null
      if (changedClaims.length > 0) {
        // Product replacement preserves the old frozen cadence while the pure
        // source reconciler is building the batch. Resolve once against the
        // complete successor candidate before hashing, diffing, or staging it.
        routine = await resolveCadences(routine)
        const sourceClaims = changedClaims
          .map((claim) => [claim.sourceKind, claim.sourceKey, claim.observedRevision] as const)
          .sort(
            ([kindA, keyA, revisionA], [kindB, keyB, revisionB]) =>
              kindA.localeCompare(kindB) || keyA.localeCompare(keyB) || revisionA - revisionB,
          )
        const stageSourceKey = sourceClaims[0]?.[1]
        if (!stageSourceKey) throw new Error("Missing source claim for routine successor")
        routine.source.sourceFingerprint = semanticHash({
          sourceRevision: plan.sourceRevision,
          sourceKind: "user_product",
          sourceClaims,
          routineSemantics: hashRoutineSemantics(routine),
        })
        const delta = diffRoutinePayloads(
          alignLegacyCadenceForDelta(base.routine, routine),
          routine,
          [],
        )
        delta.direct = delta.consequential
          .filter((change) => directChangesByItemKey.has(change.itemKey))
          .map((change) => directChangesByItemKey.get(change.itemKey) ?? change)
        delta.consequential = delta.consequential.filter(
          (change) => !directChangesByItemKey.has(change.itemKey),
        )
        outcome = await input.repository.stage({
          userId: request.userId,
          plan,
          sourceKey: stageSourceKey,
          portfolio,
          routine,
          // The proposal is a whole successor candidate, not a last-event
          // patch: recompute its delta from the base after every batch change.
          delta,
          origin: "acquisition",
        })
      } else if (claimErrors.size === 0) {
        outcome = await input.repository.recordNoChange({
          userId: request.userId,
          plan,
          sourceFingerprint: semanticHash({
            sourceRevision: plan.sourceRevision,
            claims: claims.map((claim) => [claim.sourceKind, claim.sourceKey]).sort(),
            routineSourceFingerprint: base.routine.source.sourceFingerprint,
          }),
        })
      }

      return settleClaims({
        claims,
        claimErrors,
        outcome,
        changed: changedClaims.length > 0,
        recomputeApplied: recompute.applied,
      })
    },
  }
}

function rpcOutcome(data: unknown, error: unknown): SourceTransitionOutcome {
  if (error || !data || typeof data !== "object") return "temporarily_unavailable"
  const value = String((data as Record<string, unknown>).outcome)
  return [
    "staged",
    "already_staged",
    "suppressed_rejected",
    "no_semantic_change",
    "stale_active_version",
    "revision_conflict",
    "source_revision_conflict",
    "stale_source",
    "invalid_source",
  ].includes(value)
    ? (value as SourceTransitionOutcome)
    : "temporarily_unavailable"
}

export function createSupabaseRoutineSourceSyncRepository(
  client: SupabaseClient,
): RoutineSourceSyncRepository {
  return {
    async loadPlan(userId) {
      const { data, error } = await client
        .from("personal_plans")
        .select("id,revision,source_revision,active_routine_version_id,pending_routine_proposal_id")
        .eq("user_id", userId)
        .maybeSingle()
      if (error) throw error
      return data
        ? {
            id: String(data.id),
            revision: Number(data.revision),
            sourceRevision: Number(data.source_revision),
            activeRoutineVersionId: data.active_routine_version_id
              ? String(data.active_routine_version_id)
              : null,
          }
        : null
    },
    async claim(userId, personalPlanId, limit) {
      const { data, error } = await client.rpc("personal_plan_claim_owner_routine_source_changes", {
        p_user_id: userId,
        p_personal_plan_id: personalPlanId,
        p_limit: limit,
        p_lease_seconds: 60,
      })
      if (error) throw error
      return (data ?? []).map((row: Record<string, unknown>) => ({
        outboxId: String(row.outbox_id),
        userId: String(row.user_id),
        personalPlanId: String(row.personal_plan_id),
        sourceKind: String(row.source_kind),
        sourceKey: String(row.source_key),
        observedRevision: Number(row.observed_revision),
        leaseToken: String(row.lease_token),
      }))
    },
    async loadBase(userId, plan) {
      let versionId = plan.activeRoutineVersionId
      if (!versionId) {
        const { data: proposal, error: proposalError } = await client
          .from("personal_plan_routine_proposals")
          .select("candidate_routine_version_id")
          .eq("user_id", userId)
          .eq("personal_plan_id", plan.id)
          .eq("status", "pending")
          .maybeSingle()
        if (proposalError) throw proposalError
        versionId = proposal?.candidate_routine_version_id
          ? String(proposal.candidate_routine_version_id)
          : null
      }
      if (!versionId) return null
      const { data: version, error: versionError } = await client
        .from("personal_plan_routine_versions")
        .select(
          "payload,source_portfolio_version_id,source_product_draft_id,source_product_draft_revision",
        )
        .eq("id", versionId)
        .eq("user_id", userId)
        .eq("personal_plan_id", plan.id)
        .maybeSingle()
      if (versionError || !version) return null
      const { data: portfolio, error: portfolioError } = await client
        .from("personal_plan_portfolio_versions")
        .select("snapshot")
        .eq("id", version.source_portfolio_version_id)
        .eq("user_id", userId)
        .eq("personal_plan_id", plan.id)
        .maybeSingle()
      if (portfolioError || !portfolio?.snapshot) return null
      return parseRoutineSourceBaseSnapshots({
        routine: version.payload,
        portfolio: portfolio.snapshot,
        sourceProductDraftId: version.source_product_draft_id,
        sourceProductDraftRevision: version.source_product_draft_revision,
      })
    },
    async loadUserProduct(userId, sourceKey) {
      const { data, error } = await client
        .from("user_products")
        .select(
          "id,category,catalog_product_id,brand_text,product_name_text,identity_status,ownership_status",
        )
        .eq("id", sourceKey)
        .eq("user_id", userId)
        .maybeSingle()
      if (error) throw error
      if (!data) return null
      const displayName = [data.brand_text, data.product_name_text].filter(Boolean).join(" ").trim()
      return {
        id: String(data.id),
        category: String(data.category),
        catalogProductId: data.catalog_product_id ? String(data.catalog_product_id) : null,
        displayName: displayName || "Produkt",
        identityStatus: data.identity_status as RoutineSourceUserProduct["identityStatus"],
        ownershipStatus: data.ownership_status as RoutineSourceUserProduct["ownershipStatus"],
      }
    },
    async recordNoChange({ userId, plan, sourceFingerprint }) {
      const { data, error } = await client.rpc("personal_plan_record_routine_no_semantic_change", {
        p_user_id: userId,
        p_personal_plan_id: plan.id,
        p_expected_active_routine_version_id: plan.activeRoutineVersionId,
        p_expected_revision: plan.revision,
        p_expected_source_revision: plan.sourceRevision,
        p_source_fingerprint: sourceFingerprint,
      })
      return rpcOutcome(data, error)
    },
    async stage({ userId, plan, sourceKey, portfolio, routine, delta, origin }) {
      const { data, error } = await client.rpc("personal_plan_stage_routine_source_successor", {
        p_user_id: userId,
        p_personal_plan_id: plan.id,
        p_expected_active_routine_version_id: plan.activeRoutineVersionId,
        p_expected_revision: plan.revision,
        p_expected_source_revision: plan.sourceRevision,
        p_source_kind: "user_product",
        p_source_key: sourceKey,
        p_portfolio_schema_version: portfolio.schemaVersion,
        p_portfolio_snapshot: portfolio,
        p_routine_schema_version: routine.schemaVersion,
        p_routine_compiler_version: routine.source.compilerVersion,
        p_routine_authority_versions: routine.source.authorityVersions,
        p_routine_source_fingerprint: routine.source.sourceFingerprint,
        p_routine_payload: routine,
        p_proposal_delta: delta,
        p_direct_operation_keys: [],
        p_origin: origin,
      })
      return rpcOutcome(data, error)
    },
    async finish({ claim, errorCode }) {
      const { data, error } = await client.rpc("personal_plan_finish_routine_source_change", {
        p_outbox_id: claim.outboxId,
        p_lease_token: claim.leaseToken,
        p_processed_revision: claim.observedRevision,
        p_error_code: errorCode,
      })
      return !error && data === true
    },
  }
}
