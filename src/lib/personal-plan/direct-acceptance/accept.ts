import type {
  Stage2PersistedDraft,
  Stage2RefinementPersistence,
} from "../persistence/stage2-refinement-service"
import type {
  Stage3AuthorityEvaluation,
  Stage3AuthoritySemanticIntent,
} from "../products/authority/contracts"
import type { Stage3AuthorityProductionGateway } from "../products/production-persistence-gateway"
import { createPersistedStage2RefinementGateway } from "../refinement/production-persistence-gateway"
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
 * Turns the server's own authority evaluations into one planned-purchase intent
 * per role, after proving the client saw exactly the products the server would
 * plan right now.
 */
export function buildDirectAcceptanceIntents(
  evaluations: readonly Stage3AuthorityEvaluation[],
  seenRoles: readonly DirectAcceptanceSeenRole[],
): Stage3AuthoritySemanticIntent[] {
  const seenByKey = new Map(seenRoles.map((role) => [role.decisionKey, role]))
  if (seenByKey.size !== seenRoles.length || seenByKey.size !== evaluations.length) {
    throw new DirectAcceptanceError("seen_state_stale")
  }

  return evaluations.map((evaluation) => {
    if (
      evaluation.status !== "known" ||
      !evaluation.recommendation ||
      !evaluation.recommendationFactFingerprint ||
      !evaluation.allowedActions.includes("plan_recommendation")
    ) {
      throw new DirectAcceptanceError("recommendation_unavailable")
    }
    const seen = seenByKey.get(evaluation.subjectKey)
    if (
      !seen ||
      seen.productId !== evaluation.recommendation.productId ||
      seen.factFingerprint !== evaluation.recommendationFactFingerprint
    ) {
      throw new DirectAcceptanceError("seen_state_stale")
    }
    return {
      type: "resolve_decision",
      subjectKey: evaluation.subjectKey,
      action: "plan_recommendation",
    }
  })
}

export async function acceptIdealPlan(
  deps: AcceptIdealPlanDeps,
  input: AcceptIdealPlanInput,
): Promise<AcceptIdealPlanResult> {
  if (!deps.flags.stage2Enabled || !deps.flags.stage3Enabled || !deps.flags.stage4Enabled) {
    throw new DirectAcceptanceError("stage_not_available")
  }

  const { personalPlanId, refinedVersionId } = await completeSyntheticRefinement(deps)
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

  await deps.provenance.recordDirectAccept({
    userId: deps.userId,
    personalPlanId,
    refinedVersionId,
  })

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
async function completeSyntheticRefinement(
  deps: AcceptIdealPlanDeps,
): Promise<{ personalPlanId: string; refinedVersionId: string }> {
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

  if (draft.status === "complete" && draft.refinedVersionId) {
    return { personalPlanId: draft.personalPlanId, refinedVersionId: draft.refinedVersionId }
  }

  const saved = await deps.refinementPersistence.save({
    userId: deps.userId,
    draft,
    expectedRevision: draft.revision,
    answers: defaults.answers,
    completedQuestionIds: defaults.completedQuestionIds,
  })
  if (saved.outcome !== "saved") throw new DirectAcceptanceError("conflict")

  const handoff = await createPersistedStage2RefinementGateway({
    userId: deps.userId,
    persistence: deps.refinementPersistence,
  }).complete({ expectedRevision: saved.revision })

  return { personalPlanId: draft.personalPlanId, refinedVersionId: handoff.refinedVersionId }
}
