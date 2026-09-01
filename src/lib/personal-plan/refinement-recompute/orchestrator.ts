import { STAGE3_AUTHORITY_DECISION_BATCH_LIMIT } from "@/lib/personal-plan/products/authority/contracts"
import type { Stage3ProductDraft } from "@/lib/personal-plan/products/contracts"

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
  cause?: unknown,
): Stage3RecomputeResult {
  return cause === undefined
    ? { status: "unavailable", reason, retryable }
    : { status: "unavailable", reason, retryable, cause }
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
    // a version nobody asked for. Reused for the post-rehydration
    // re-acquisition below (fix round 1 CRITICAL 1), so the same race
    // detection applies there too.
    type Acquisition =
      | { ok: true; draft: Stage3ProductDraft }
      | { ok: false; result: Stage3RecomputeResult }
    async function acquireDraft(): Promise<Acquisition> {
      const loaded = await deps.gateway.loadOrCreate({
        draftId: "server-derived",
        userId,
        personalPlanId,
        refinedVersionId,
        requirements: [],
        rebuildOnStaleRefinedVersion: true,
      })
      if (loaded.draft.refinedVersionId !== refinedVersionId) {
        return { ok: false, result: unavailable("superseded", true) }
      }
      return { ok: true, draft: loaded.draft }
    }

    const acquired = await acquireDraft()
    if (!acquired.ok) return acquired.result
    let draft = acquired.draft

    // `"stale"` never resolves itself here — a fresh invocation rebuilds on
    // the current refined version instead (fix round 1 MINOR 4).
    if (draft.status === "stale") return unavailable("draft_stale", true)

    // A draft already COMPLETED on the target version at start (a lost-response
    // replay, or an A→B→A return to an earlier answer set) skips straight to
    // the completion call below, which returns the stored receipt for a
    // completed draft without re-mutating anything; the re-read afterwards is
    // what actually classifies the outcome.
    const completedAtAcquisition = draft.status === "completed"

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

      // CRITICAL fix (fix round 1, finding 1): rehydration writes through
      // `deps.persistence.save()` directly — the SAME underlying store the
      // gateway's own persistence uses, but NOT through the gateway. The
      // gateway memoizes the draft it last loaded per draftId
      // (`cached` in `production-persistence-gateway.ts`, served by
      // `current()` at :354-357 to every one of `evaluateDecisions`,
      // `reviewDecisionBundles`, `resolveDecisions` and `complete`) and that
      // memo was set by `acquireDraft()` above, BEFORE rehydration ran. Left
      // alone, every call below would silently operate on the pre-rehydration
      // (empty) draft. Re-running `loadOrCreate` is what resets that memo —
      // `cached = loaded` unconditionally at `:718-727` — to the rehydrated
      // row now on disk.
      const reacquired = await acquireDraft()
      if (!reacquired.ok) return reacquired.result
      if (
        reacquired.draft.draftId !== rehydrated.draft.draftId ||
        reacquired.draft.revision !== rehydrated.draft.revision
      ) {
        return unavailable("rehydration_reload_conflict", true)
      }
      draft = reacquired.draft

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

      // 3b. Retained inventory. A product the new plan no longer assigns to a
      // role becomes a "Nicht verwendete Produkte" disposition, and
      // `computeStage3PathState` refuses `canCreatePortfolio` while any of them
      // is unacknowledged — there is no decision intent for them
      // (`authorityDecisionSubjects` filters inventory dispositions out), so
      // nothing above can answer one. The person is not in this loop to answer
      // it either, and founder ruling R2 says plan changes from Verhalten
      // answers are applied silently; the product stays visible under
      // "Nicht verwendete Produkte" on the Routine. So this lane acknowledges
      // them through the real server-owned transition rather than letting a
      // re-derived disposition dead-end the whole recompute.
      for (const disposition of draft.inventoryDispositions ?? []) {
        if (disposition.acknowledged) continue
        const acknowledged = await deps.gateway.acknowledgeInventoryDisposition({
          draftId: draft.draftId,
          expectedRevision,
          dispositionKey: disposition.dispositionKey,
        })
        if (acknowledged.status === "conflict") return unavailable("acknowledge_conflict", true)
        draft = acknowledged.draft
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

    // 5. Applied/unchanged/unavailable is decided ONLY by re-reading the
    // active routine's source now, relative to the starting state captured in
    // step 1 — never from `completed`'s own status or `routineProposalId`.
    const ending = await deps.routineState.loadActiveRoutineVersion({ userId, personalPlanId })
    if (ending && ending.source.refinedVersionId === refinedVersionId) {
      return { status: "applied", routineVersionId: ending.routineVersionId }
    }

    if (completed.status === "not_ready") return unavailable("completion_not_ready", false)
    if (completed.status === "conflict") return unavailable("completion_conflict", true)

    // completed.status === "ready_for_routine" from here: it reported
    // success, but the re-read did not show the target active.

    // 6. Only reachable for a draft that was ALREADY completed when this pass
    // acquired it: `complete()` then short-circuits to the stored receipt
    // (production-persistence-gateway.ts:913-916) and activates nothing. Two
    // situations produce it, and neither can be told apart from the receipt —
    // its `routineProposalId` is returned regardless of the proposal's status
    // (stage3-persistence-supabase.ts:406):
    //
    //   (a) a lost-response replay whose confirm never landed, and
    //   (b) A→B→A — the person returned to an earlier answer set, Stage-2's
    //       input-hash dedupe (20260825130000) handed back the OLD refined
    //       version and moved the plan's head to it, so acquisition lands on
    //       that version's historical completed draft.
    //
    // What both share is the fact that decides the fix: a Routine compiled from
    // the target version's draft ALREADY EXISTS and is simply not active. Per
    // the plan's silent-apply ruling (R2) the honest outcome is to make it
    // active again — staged as a successor of the CURRENT active Routine and
    // confirmed, through the existing lifecycle RPCs.
    if (
      completedAtAcquisition &&
      ending?.source.refinedVersionId === starting.source.refinedVersionId
    ) {
      const reactivated = await deps.routineReactivator.reactivateRoutineForProductDraft({
        userId,
        personalPlanId,
        productDraftId: draft.draftId,
      })
      if (reactivated.status === "conflict") return unavailable("reactivation_conflict", true)
      if (reactivated.status === "activated" || reactivated.status === "unchanged") {
        // Same rule as everywhere else in this lane: the owner-scoped re-read
        // decides, never the mutation's own report.
        const afterReactivation = await deps.routineState.loadActiveRoutineVersion({
          userId,
          personalPlanId,
        })
        if (afterReactivation?.source.refinedVersionId === refinedVersionId) {
          return { status: "applied", routineVersionId: afterReactivation.routineVersionId }
        }
        return unavailable("concurrent_activation", true)
      }
      if (reactivated.reason !== "no_routine_for_draft") {
        return unavailable("reactivation_rejected", false)
      }
      // Nothing was ever compiled from this completed draft, so there is
      // nothing to re-activate: fall through to the pre-existing classification.
    }

    if (
      completed.routineProposalId !== null &&
      ending?.source.refinedVersionId === starting.source.refinedVersionId
    ) {
      // A routine proposal is staged rather than activated because its confirm
      // didn't land (20260825140000:121-129). The routine page's own
      // pending-proposal "Änderungen prüfen" recovery is the correct next step
      // here, not an automatic retry — see fix round 1 IMPORTANT 2.
      return unavailable("pending_proposal_staged", false)
    }

    // Neither the target nor a staged-but-unconfirmed proposal explains the
    // re-read: a concurrent lane won the plan's active routine with
    // something else entirely.
    return unavailable("concurrent_activation", true)
  } catch (error) {
    // Never let a habits module completion fail because recompute failed —
    // every dependency rejection (network/infra, or a thrown
    // `Stage3AuthorityMutationError` from a stale bundle) becomes a retryable
    // unavailable instead of propagating. `cause` carries the error through
    // for logging (fix round 1 MINOR 5).
    return unavailable("unexpected_error", true, error)
  }
}
