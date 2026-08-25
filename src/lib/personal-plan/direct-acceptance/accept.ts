import { computeNeedPlan } from "../compute-stage1"
import type {
  Stage2PersistedDraft,
  Stage2RefinementPersistence,
} from "../persistence/stage2-refinement-service"
import { PERSONAL_PLAN_STAGE1_COMPUTATION_VERSION } from "../persistence/stage1-service"
import { stage1PreviewedRoleDecisionKeys } from "../product-previews"
import type {
  Stage3AuthorityEvaluation,
  Stage3AuthoritySemanticIntent,
} from "../products/authority/contracts"
import type { Stage3DecisionDeferralReason } from "../products/contracts"
import type { Stage3AuthorityProductionGateway } from "../products/production-persistence-gateway"
import { createPersistedStage2RefinementGateway } from "../refinement/production-persistence-gateway"
import { buildAssumedAnswerProvenance } from "../refinement/answer-provenance"
import { semanticHash } from "../routine/canonicalize"

import {
  buildDirectAcceptanceStage2Defaults,
  type DirectAcceptanceStage2Defaults,
} from "./defaults"

/**
 * Direct acceptance drives the real Stage-2 → Stage-4 machinery headlessly with
 * a synthetic complete Stage-2 answer set. It never writes a parallel routine:
 * the existing refinement, product-draft, portfolio, compiler and activation
 * paths stay the only writers.
 */

export type DirectAcceptanceErrorCode =
  | "stage_not_available"
  | "seen_state_stale"
  | "recommendation_unavailable"
  | "conflict"
  | "acceptance_not_ready"
  /** A real Stage-2 refinement is already under way; accepting would discard it. */
  | "refinement_in_progress"
  /** The plan already has an active Routine that direct acceptance did not create. */
  | "plan_already_accepted"

export class DirectAcceptanceError extends Error {
  constructor(
    public readonly code: DirectAcceptanceErrorCode,
    message: string = code,
  ) {
    super(message)
    this.name = "DirectAcceptanceError"
  }
}

/**
 * The canonical per-role seen-state entry. `decisionKey` is the Stage-3
 * decision subject key (`decision:<category>:<role>:gap`), which is also the
 * authority evaluation's `subjectKey`. Price is deliberately outside the
 * fingerprint: the pinned thing is the product, not its price.
 */
export type DirectAcceptanceSeenRole = {
  decisionKey: string
  productId: string
  factFingerprint: string
}

export type AcceptIdealPlanInput = {
  seenRoles: readonly DirectAcceptanceSeenRole[]
}

export type AcceptIdealPlanResult = {
  status: "accepted"
  personalPlanId: string
  refinedVersionId: string
  productDraftId: string
  productPortfolioVersionId: string
  next: { stage: 4; href: string }
}

export type DirectAcceptanceStage3Gateway = Pick<
  Stage3AuthorityProductionGateway,
  "loadOrCreate" | "evaluateDecisions" | "resolveDecisions" | "complete"
>

export type DirectAcceptanceProvenanceWriter = {
  recordDirectAccept(input: {
    userId: string
    personalPlanId: string
    refinedVersionId: string
  }): Promise<void>
}

export type DirectAcceptancePlanStateReader = {
  loadActiveRoutineVersionId(input: {
    userId: string
    personalPlanId: string
  }): Promise<string | null>
}

export type AcceptIdealPlanDeps = {
  userId: string
  flags: { stage2Enabled: boolean; stage3Enabled: boolean; stage4Enabled: boolean }
  refinementPersistence: Stage2RefinementPersistence
  planState: DirectAcceptancePlanStateReader
  stage3Gateway: DirectAcceptanceStage3Gateway
  provenance: DirectAcceptanceProvenanceWriter
}

/**
 * Turns the server's own authority evaluations into one intent per role.
 *
 * Two kinds of role, one pass:
 *
 *   - a role the client SAW is pinned exactly as before — same decision key,
 *     same product, same fact fingerprint, or `seen_state_stale`. Nothing is
 *     bought that the person did not look at.
 *   - a role the client did NOT see is never planned. The server derives an
 *     explicit `leave_uncovered` decision for it and records WHY it deferred
 *     (see `Stage3DecisionDeferralReason`), so acceptance succeeds with an
 *     honest gap instead of failing the whole request.
 *
 * A seen role the server does not evaluate at all stays `seen_state_stale`:
 * that is the preview payload contradicting the server, not a gap.
 */
export function buildDirectAcceptanceIntents(
  evaluations: readonly Stage3AuthorityEvaluation[],
  seenRoles: readonly DirectAcceptanceSeenRole[],
  /**
   * Decision keys the Idealplan previewed — see `deferralReasonFor`. Required:
   * a defaulted empty set would silently downgrade every deferral reason.
   */
  previewedRoleKeys: ReadonlySet<string>,
): Stage3AuthoritySemanticIntent[] {
  const seenByKey = new Map(seenRoles.map((role) => [role.decisionKey, role]))
  const evaluatedKeys = new Set(evaluations.map((evaluation) => evaluation.subjectKey))
  if (
    seenByKey.size !== seenRoles.length ||
    // One subject, one evaluation is a server invariant; a duplicate would make
    // the seen-state join ambiguous and produce two intents for one subject.
    evaluatedKeys.size !== evaluations.length ||
    seenRoles.some((role) => !evaluatedKeys.has(role.decisionKey))
  ) {
    throw new DirectAcceptanceError("seen_state_stale")
  }

  return evaluations.flatMap((evaluation): Stage3AuthoritySemanticIntent[] => {
    const seen = seenByKey.get(evaluation.subjectKey)
    if (!seen) {
      // An authority that does not even allow leaving the role uncovered has no
      // decision this flow may author. Completion then reports it as
      // `acceptance_not_ready` rather than this code forging a forbidden action.
      if (!evaluation.allowedActions.includes("leave_uncovered" as never)) return []
      return [
        {
          type: "resolve_decision" as const,
          subjectKey: evaluation.subjectKey,
          action: "leave_uncovered" as const,
          deferralReason: deferralReasonFor(evaluation, previewedRoleKeys),
        },
      ]
    }
    if (
      evaluation.status !== "known" ||
      !evaluation.recommendation ||
      !evaluation.recommendationFactFingerprint ||
      !evaluation.allowedActions.includes("plan_recommendation")
    ) {
      throw new DirectAcceptanceError("recommendation_unavailable")
    }
    if (
      seen.productId !== evaluation.recommendation.productId ||
      seen.factFingerprint !== evaluation.recommendationFactFingerprint
    ) {
      throw new DirectAcceptanceError("seen_state_stale")
    }
    return [
      {
        type: "resolve_decision" as const,
        subjectKey: evaluation.subjectKey,
        action: "plan_recommendation" as const,
      },
    ]
  })
}

/**
 * Server truth only — two independent facts, three reasons:
 *
 *   - the role was NOT previewable at all → it exists only because the
 *     synthetic refinement defaults answered a deferred Stage-1 fact, so its
 *     product choice belongs to the refinement: `refinement_required`.
 *   - it was previewable and the engine has no buyable recommendation either →
 *     a real product gap: `no_product`.
 *   - it was previewable and the engine DOES have a buyable recommendation, but
 *     the person never echoed it → the Idealplan could not present it (missing
 *     packshot, fingerprint churn, verdict gating): `preview_unavailable`.
 *     Deferring it is still right — nothing unseen may be bought — but claiming
 *     a product gap would be false.
 */
function deferralReasonFor(
  evaluation: Stage3AuthorityEvaluation,
  previewedRoleKeys: ReadonlySet<string>,
): Stage3DecisionDeferralReason {
  if (!previewedRoleKeys.has(evaluation.subjectKey)) return "refinement_required"
  return hasBuyableRecommendation(evaluation) ? "preview_unavailable" : "no_product"
}

/** Exactly the shape `plan_recommendation` requires of a seen role. */
function hasBuyableRecommendation(evaluation: Stage3AuthorityEvaluation): boolean {
  return (
    evaluation.status === "known" &&
    Boolean(evaluation.recommendation) &&
    Boolean(evaluation.recommendationFactFingerprint) &&
    evaluation.allowedActions.includes("plan_recommendation")
  )
}

export async function acceptIdealPlan(
  deps: AcceptIdealPlanDeps,
  input: AcceptIdealPlanInput,
): Promise<AcceptIdealPlanResult> {
  if (!deps.flags.stage2Enabled || !deps.flags.stage3Enabled || !deps.flags.stage4Enabled) {
    throw new DirectAcceptanceError("stage_not_available")
  }

  const { personalPlanId, refinedVersionId, previewedRoleKeys } =
    await completeSyntheticRefinement(deps)
  const loaded = await deps.stage3Gateway.loadOrCreate({
    draftId: "server-derived",
    userId: deps.userId,
    requirements: [],
    personalPlanId,
    refinedVersionId,
  })

  let draft = loaded.draft
  if (draft.status === "active") {
    const intents = buildDirectAcceptanceIntents(
      await deps.stage3Gateway.evaluateDecisions({ draftId: draft.draftId }),
      input.seenRoles,
      previewedRoleKeys,
    )
    if (intents.length > 0) {
      const resolved = await deps.stage3Gateway.resolveDecisions({
        draftId: draft.draftId,
        expectedRevision: draft.revision,
        intents,
      })
      if (resolved.status !== "saved") throw new DirectAcceptanceError("conflict")
      draft = resolved.draft
    }
  }

  const completed = await deps.stage3Gateway.complete({
    draftId: draft.draftId,
    expectedRevision: draft.revision,
  })
  if (completed.status === "conflict") throw new DirectAcceptanceError("conflict")
  if (completed.status === "not_ready") throw new DirectAcceptanceError("acceptance_not_ready")

  // Best-effort: activation above has already committed, so the Routine is
  // live. A failed provenance write only means the refinement nudge may not
  // appear — it must never tell the user acceptance failed (and a retry would
  // converge to `conflict`, not to a second accept). Mirrors the same tradeoff
  // in routine/proposal-service.ts.
  try {
    await deps.provenance.recordDirectAccept({
      userId: deps.userId,
      personalPlanId,
      refinedVersionId,
    })
  } catch (error) {
    console.warn("personal_plan_direct_accept_provenance_write_failed", {
      code: (error as { code?: unknown } | null)?.code ?? null,
      message: error instanceof Error ? error.message : String(error),
    })
  }

  return {
    status: "accepted",
    personalPlanId,
    refinedVersionId,
    productDraftId: completed.draft.draftId,
    productPortfolioVersionId: completed.productPortfolioVersionId,
    next: completed.next,
  }
}

/** A draft the user has not touched yet, or one holding only our own defaults. */
function isDirectAcceptanceDraft(
  draft: Stage2PersistedDraft,
  defaults: DirectAcceptanceStage2Defaults,
): boolean {
  const isUntouched =
    Object.keys(draft.answers).length === 0 && draft.completedQuestionIds.length === 0
  if (isUntouched) return true
  // Key order survives a JSON round-trip unpredictably, so compare semantically.
  return (
    semanticHash({
      answers: draft.answers,
      completedQuestionIds: [...draft.completedQuestionIds].sort(),
    }) ===
    semanticHash({
      answers: defaults.answers,
      completedQuestionIds: [...defaults.completedQuestionIds].sort(),
    })
  )
}

/**
 * Writes the documented defaults into the real refinement draft and completes
 * it through the production Stage-2 gateway, so the refined need version is
 * produced by exactly the path interactive Stage 2 uses.
 *
 * Two server-side guards keep this from destroying real work. Neither relies on
 * the UI hiding the fork screen: a stale screen, back-navigation or a retry can
 * always POST this route.
 */
async function completeSyntheticRefinement(deps: AcceptIdealPlanDeps): Promise<{
  personalPlanId: string
  refinedVersionId: string
  previewedRoleKeys: ReadonlySet<string>
}> {
  const draft = await deps.refinementPersistence.loadOrCreate(deps.userId)
  const defaults = buildDirectAcceptanceStage2Defaults(draft.triggerContext)
  // `save` replaces the whole answer object, so a partially answered real
  // Stage 2 would be silently overwritten — and the CAS would happily pass,
  // because the revision is current.
  const ownedByDirectAcceptance = isDirectAcceptanceDraft(draft, defaults)
  if (!ownedByDirectAcceptance && draft.status === "in_progress") {
    throw new DirectAcceptanceError("refinement_in_progress")
  }

  // An active Routine this flow did not create must not be relabelled as a
  // direct accept. The pure double-accept retry is exempt: its refinement draft
  // is complete and still carries exactly these defaults.
  const activeRoutineVersionId = await deps.planState.loadActiveRoutineVersionId({
    userId: deps.userId,
    personalPlanId: draft.personalPlanId,
  })
  if (activeRoutineVersionId && !(draft.status === "complete" && ownedByDirectAcceptance)) {
    throw new DirectAcceptanceError("plan_already_accepted")
  }

  // Only computed once the guards above have let this accept through.
  const previewedRoleKeys = stage1PreviewedRoleKeysForDraft(draft)

  if (draft.status === "complete" && draft.refinedVersionId) {
    return {
      personalPlanId: draft.personalPlanId,
      refinedVersionId: draft.refinedVersionId,
      previewedRoleKeys,
    }
  }

  const saved = await deps.refinementPersistence.save({
    userId: deps.userId,
    draft,
    expectedRevision: draft.revision,
    answers: defaults.answers,
    completedQuestionIds: defaults.completedQuestionIds,
    // Every synthetic default this write produces is an assumption, never a
    // real answer — see refinement/answer-provenance.ts.
    answerProvenance: buildAssumedAnswerProvenance(defaults.completedQuestionIds),
  })
  if (saved.outcome !== "saved") throw new DirectAcceptanceError("conflict")

  const handoff = await createPersistedStage2RefinementGateway({
    userId: deps.userId,
    persistence: deps.refinementPersistence,
  }).complete({ expectedRevision: saved.revision })

  return {
    personalPlanId: draft.personalPlanId,
    refinedVersionId: handoff.refinedVersionId,
    previewedRoleKeys,
  }
}

/**
 * Recomputes the plan's own Idealplan projection from the immutable Stage-1
 * input the refinement draft carries, and asks the preview module which roles
 * it would show. Pure and read-only — no persistence and no catalog access,
 * because only the role SET is needed, never the products behind it.
 *
 * An input the Stage-1 computation can no longer parse yields the empty set,
 * which makes every unresolved role `refinement_required`: the conservative
 * side, since it never claims a product gap the plan cannot prove.
 */
function stage1PreviewedRoleKeysForDraft(draft: Stage2PersistedDraft): ReadonlySet<string> {
  const computed = computeNeedPlan({
    rawEnvelope: draft.baseInputSnapshot,
    artifactId: draft.preparedArtifactSourceId,
    projection: "initial_quiz",
    computationVersion: PERSONAL_PLAN_STAGE1_COMPUTATION_VERSION,
    createdAt: new Date().toISOString(),
  })
  return computed.status === "ready"
    ? stage1PreviewedRoleDecisionKeys(computed.snapshot)
    : new Set<string>()
}
