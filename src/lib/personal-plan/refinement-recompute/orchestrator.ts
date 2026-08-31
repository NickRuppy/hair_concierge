import { STAGE3_AUTHORITY_DECISION_BATCH_LIMIT } from "@/lib/personal-plan/products/authority/contracts"

import { buildStage3RecomputeIntents } from "./intents"
import { rehydrateStage3ProductDraft } from "./rehydration"
import type {
  Stage3RecomputeDeps,
  Stage3RecomputeInput,
  Stage3RecomputeResult,
  Stage3RecomputeUnavailableReason,
  Stage3RehydrationUnavailableReason,
} from "./types"

/**
 * Revision/CAS races the rehydration service surfaces are worth retrying; every
 * other rehydration reason names a legacy, unparsable or not-yet-completed
 * source/target row that a retry cannot fix on its own. See T1.1's report.
 */
const RETRYABLE_REHYDRATION_REASONS = new Set<Stage3RehydrationUnavailableReason>([
  "source_revision_mismatch",
  "target_draft_stale_source",
])

function unavailable(
  reason: Stage3RecomputeUnavailableReason,
  retryable: boolean,
): Stage3RecomputeResult {
  return { status: "unavailable", reason, retryable }
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const batches: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size))
  }
  return batches
}

/**
 * Headless recompute lane: after a Verhalten (habits) module completion
 * produces a NEW current refined need version for a person with an ACTIVE
 * routine, rebuilds the Stage-3 draft on that version, rehydrates it from the
 * routine's immutable source draft (T1.1), re-authors decision-preserving
 * intents (T1.2), completes the draft and lets the existing completion path
 * (`personal_plan_complete_draft_activate_v2`, invoked inside `complete`)
 * activate the successor routine immediately — the same headless shape
 * `acceptIdealPlan` uses (`direct-acceptance/accept.ts:205`).
 *
 * Never throws: every dependency failure — a rejected promise from `deps`, or
 * an unexpected mutation error the gateway throws — is caught and reported as
 * a retryable `unavailable`, so a failing recompute can never fail the habits
 * module completion that triggered it.
 *
 * `applied` / `unchanged` are decided by comparing an owner-scoped read of the
 * active routine's source BEFORE any work against the SAME read taken AFTER
 * completion — never from the completion call's own return value. A replayed
 * `complete()` call returns the stored receipt for an already-completed draft
 * without proving THIS call was the one that activated it
 * (`production-persistence-gateway.ts:913`, `stage3-persistence-supabase.ts:406`),
 * so only the re-read is trustworthy.
 */
export async function recomputeRoutineAfterHabitsCompletion(
  deps: Stage3RecomputeDeps,
  input: Stage3RecomputeInput,
): Promise<Stage3RecomputeResult> {
  try {
    const { userId, personalPlanId, refinedVersionId } = input

    // 1. Owner-scoped starting state, captured before any work.
    const starting = await deps.routineState.loadActiveRoutineVersion({ userId, personalPlanId })
    if (!starting) return unavailable("no_active_routine", false)

    // `unchanged` is decided against this starting read alone — a routine
    // already built on the target version needs no recompute, regardless of
    // whether the routine version's source draft can still be verified.
    if (starting.source.refinedVersionId === refinedVersionId) {
      return { status: "unchanged" }
    }

    if (starting.source.productDraftId === null || starting.source.productDraftRevision === null) {
      return unavailable("legacy_source_draft", false)
    }

    // 2. Draft acquisition on the current refined version. `loadOrCreate`'s
    // stale-rebuild path (`loadOrCreateOnCurrentRefinedVersion`) keeps this
    // fail-safe if `refinedVersionId` itself races out from under us before
    // the RPC runs: it lands on whatever the plan's actual current version is
    // rather than throwing, so the check below is what turns that outcome
    // into a typed, reported `superseded` instead of silently recomputing for
    // a version nobody asked for.
    const loaded = await deps.gateway.loadOrCreate({
      draftId: "server-derived",
      userId,
      personalPlanId,
      refinedVersionId,
      requirements: [],
      rebuildOnStaleRefinedVersion: true,
    })
    if (loaded.draft.refinedVersionId !== refinedVersionId) {
      return unavailable("superseded", true)
    }

    let draft = loaded.draft

    // A draft already COMPLETED on the target version at start (lost-response
    // replay) skips straight to the completion call below, which returns the
    // stored receipt for a completed draft without re-mutating anything; the
    // re-read afterwards is what actually classifies the outcome.
    if (draft.status === "active") {
      const rehydrated = await rehydrateStage3ProductDraft({
        persistence: deps.persistence,
        userId,
        personalPlanId,
        target: { draftId: draft.draftId, revision: draft.revision },
        source: {
          draftId: starting.source.productDraftId,
          revision: starting.source.productDraftRevision,
        },
      })
      if (rehydrated.status === "conflict") return unavailable("rehydration_conflict", true)
      if (rehydrated.status === "unavailable") {
        return unavailable(rehydrated.reason, RETRYABLE_REHYDRATION_REASONS.has(rehydrated.reason))
      }
      draft = rehydrated.draft

      // 3. Evaluate + review bundles back-to-back against this same draft
      // state, then resolve immediately: the gateway re-derives alternatives
      // at resolve time, so any mutation interleaved here would invalidate
      // the candidates the intent builder selected (T1.2 fix-round appendix,
      // handover note (a)).
      const evaluations = await deps.gateway.evaluateDecisions({ draftId: draft.draftId })
      const reviewBundles = await deps.gateway.reviewDecisionBundles({ draftId: draft.draftId })
      const intentPlan = buildStage3RecomputeIntents({
        evaluations,
        reviewBundles,
        routine: starting.payload,
      })

      // Any blocked subject makes the whole recompute unavailable rather than
      // completing with a silently unresolved decision (T1.2 fix-round F6):
      // the existing routine stays active, no partial completion is attempted.
      if (intentPlan.blocked.length > 0) return unavailable("decision_blocked", false)

      let expectedRevision = draft.revision
      for (const batch of chunk(intentPlan.intents, STAGE3_AUTHORITY_DECISION_BATCH_LIMIT)) {
        const resolved = await deps.gateway.resolveDecisions({
          draftId: draft.draftId,
          expectedRevision,
          intents: batch,
        })
        if (resolved.status === "conflict") return unavailable("resolve_conflict", true)
        draft = resolved.draft
        expectedRevision = draft.revision
      }
    }

    // 4. Completion. `markUnrefinedDirectAccept: false` — this lane never
    // marks the plan as an unrefined direct accept; the person went through a
    // real refinement module.
    const completed = await deps.gateway.complete({
      draftId: draft.draftId,
      expectedRevision: draft.revision,
      markUnrefinedDirectAccept: false,
    })
    const completionFailure: {
      reason: Stage3RecomputeUnavailableReason
      retryable: boolean
    } | null =
      completed.status === "not_ready"
        ? { reason: "completion_not_ready", retryable: false }
        : completed.status === "conflict"
          ? { reason: "completion_conflict", retryable: true }
          : null

    // 5. Applied/unchanged/unavailable is decided ONLY by re-reading the
    // active routine's source now, relative to the starting state captured in
    // step 1 — never from `completed`'s own status or `routineProposalId`.
    const ending = await deps.routineState.loadActiveRoutineVersion({ userId, personalPlanId })
    if (ending && ending.source.refinedVersionId === refinedVersionId) {
      return { status: "applied", routineVersionId: ending.routineVersionId }
    }
    if (completionFailure) return unavailable(completionFailure.reason, completionFailure.retryable)
    // The completion call itself reported success, but the re-read shows
    // neither the target nor (by construction, since we would have returned
    // above) still the starting source: a concurrent lane won the plan's
    // active routine with something else.
    return unavailable("concurrent_activation", true)
  } catch {
    // Never let a habits module completion fail because recompute failed —
    // every dependency rejection (network/infra, or a thrown
    // `Stage3AuthorityMutationError` from a stale bundle) becomes a retryable
    // unavailable instead of propagating.
    return unavailable("unexpected_error", true)
  }
}
