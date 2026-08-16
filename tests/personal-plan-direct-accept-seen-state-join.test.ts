import assert from "node:assert/strict"
import test from "node:test"

import { STAGE1_STAGE2_LAB_ENVELOPE } from "../src/app/labs/personal-plan-stage-1-2/fixture"
import { computeNeedPlan } from "../src/lib/personal-plan/compute-stage1"
import { buildDirectAcceptanceStage2Defaults } from "../src/lib/personal-plan/direct-acceptance/defaults"
import { stage3DecisionKey } from "../src/lib/personal-plan/products/contracts"
import { buildStage3EntryContext } from "../src/lib/personal-plan/products/stage2-entry-adapter"
import {
  computeStage1ProductExamplePreviews,
  type Stage1ProductExamplePreviewCandidateLoader,
} from "../src/lib/personal-plan/product-previews"
import {
  buildPlanRoutineContextFromCompletedRefinement,
  deriveStage2TriggerContext,
} from "../src/lib/personal-plan/refinement/stage1-adapter"
import type { PersonalPlanQuizSubmissionEnvelope } from "../src/lib/personal-plan-quiz/types"

/**
 * Direct acceptance is only sound if the two role sets it joins are EXACTLY
 * equal:
 *
 *   client `seenRoles` — the Stage-1 preview payload, computed from the
 *   UNREFINED initial snapshot (deferred and not-needed decisions never get a
 *   preview), and
 *
 *   server evaluations — the Stage-3 draft subjects, derived from the REFINED
 *   need version the synthetic Stage-2 defaults produce.
 *
 * `buildDirectAcceptanceIntents` throws `seen_state_stale` the moment the two
 * sets differ in size or content, so any divergence is a hard 409 for the whole
 * cohort. Every other test in the suite fabricates one of the two sides; this
 * one computes both from a single quiz envelope and joins them.
 */

const ARTIFACT_ID = "11111111-1111-4111-8111-111111111111"
const PERSONAL_PLAN_ID = "22222222-2222-4222-8222-222222222222"
const INITIAL_NEED_VERSION_ID = "33333333-3333-4333-8333-333333333333"
const REFINED_NEED_VERSION_ID = "44444444-4444-4444-8444-444444444444"
const CREATED_AT = "2026-08-16T09:00:00.000Z"

/**
 * The preview payload's role set is decided by the snapshot alone — the catalog
 * only decides whether a role resolves to a recommendation or to a fallback,
 * and both kinds carry the same `decisionKey`. An empty catalog therefore
 * yields exactly the key set the accept payload would echo.
 */
const noCandidates: Stage1ProductExamplePreviewCandidateLoader = async () => []

function initialSnapshot(envelope: PersonalPlanQuizSubmissionEnvelope) {
  const initial = computeNeedPlan({
    rawEnvelope: envelope,
    artifactId: ARTIFACT_ID,
    projection: "initial_quiz",
    computationVersion: "stage1-v1",
    createdAt: CREATED_AT,
  })
  if (initial.status !== "ready") throw new Error("initial snapshot is not ready")
  return initial.snapshot
}

/** The role keys the Stage-1 cards showed, i.e. the accept request's `seenRoles`. */
async function previewRoleKeys(envelope: PersonalPlanQuizSubmissionEnvelope): Promise<string[]> {
  const response = await computeStage1ProductExamplePreviews({
    personalPlanId: PERSONAL_PLAN_ID,
    sourceNeedVersionId: INITIAL_NEED_VERSION_ID,
    snapshot: initialSnapshot(envelope),
    loadCandidates: noCandidates,
  })
  return [...response.previews.map((preview) => preview.decisionKey)].sort()
}

/**
 * The subject keys the accept chain evaluates: direct acceptance answers
 * `currentProductCategories: []`, so the Stage-3 draft holds no captured
 * products and every required role of the refined plan is an uncovered role
 * keyed `decision:<category>:<role>:gap`.
 */
function acceptChainRoleKeys(envelope: PersonalPlanQuizSubmissionEnvelope): string[] {
  const triggerContext = deriveStage2TriggerContext(initialSnapshot(envelope))
  const defaults = buildDirectAcceptanceStage2Defaults(triggerContext)
  const refined = computeNeedPlan({
    rawEnvelope: envelope,
    artifactId: ARTIFACT_ID,
    projection: "refined_post_plan",
    computationVersion: "stage1-v1",
    createdAt: CREATED_AT,
    routine: buildPlanRoutineContextFromCompletedRefinement({
      triggerContext,
      answers: defaults.answers,
      completedQuestionIds: defaults.completedQuestionIds,
    }),
  })
  if (refined.status !== "ready") throw new Error("refined snapshot is not ready")

  const entry = buildStage3EntryContext(refined.snapshot, {
    personalPlanId: PERSONAL_PLAN_ID,
    refinedVersionId: REFINED_NEED_VERSION_ID,
  })
  return entry.orderedCategories
    .flatMap((requirement) =>
      requirement.requiredRoles.map((role) => stage3DecisionKey(requirement.category, role, null)),
    )
    .sort()
}

/** Same quiz, no reported scalp irritation: nothing is deferred at Stage 1. */
const CALM_SCALP_ENVELOPE: PersonalPlanQuizSubmissionEnvelope = {
  ...STAGE1_STAGE2_LAB_ENVELOPE,
  answers: { ...STAGE1_STAGE2_LAB_ENVELOPE.answers, scalpConcerns: [] },
}

/**
 * THE INVARIANT. The synthetic Stage-2 defaults must never add or remove a role
 * relative to the Stage-1 previews the user actually saw. If this fails, direct
 * accept 409s (`seen_state_stale`) for the affected cohort — the fork screen
 * cannot detect it client-side, because the extra role simply is not in the
 * preview payload.
 */
test("the defaults add no role the Stage-1 previews never showed (calm scalp)", async () => {
  assert.deepEqual(
    await previewRoleKeys(CALM_SCALP_ENVELOPE),
    acceptChainRoleKeys(CALM_SCALP_ENVELOPE),
  )
})

/** The one role the irritated + oily cohort's accept chain adds behind the user's back. */
const IRRITATED_OILY_DIVERGENCE = "decision:scalp_care:scalp_flake_oil_adjunct:gap"

/**
 * The cohort Task 1 pinned as problematic: reported scalp irritation on an oily
 * scalp. Stage 1 defers Scalp Care, so no card and no preview exists for it,
 * but answering the deferred question at all — which the defaults must do to
 * complete Stage 2 — resolves the deferral and `scalpOiliness` then produces a
 * `scalp_flake_oil_adjunct` role. See the pinned test "resolving the deferred
 * scalp question can still add Scalp Care for an oily scalp" in
 * tests/personal-plan-direct-acceptance.test.ts.
 *
 * MEASURED, NOT HYPOTHETICAL: the sets diverge by exactly one key today, so
 * `POST /api/personal-plan/accept-ideal-plan` returns 409 `seen_state_stale`
 * for this entire cohort and direct acceptance is unreachable for them. The
 * fork screen cannot detect this client-side — the extra role simply is not in
 * the preview payload it echoes.
 *
 * Held as `todo` rather than red on purpose: fixing it is a product decision
 * (drop the role, surface the category at Stage 1, or relax the accept
 * contract), not a test bug, and it is escalated for a controller ruling. Do
 * not "fix" this by loosening the assertion.
 */
test("the irritated + oily scalp cohort joins the same role set", { todo: true }, async () => {
  const seen = await previewRoleKeys(STAGE1_STAGE2_LAB_ENVELOPE)
  const evaluated = acceptChainRoleKeys(STAGE1_STAGE2_LAB_ENVELOPE)

  // Pins the exact, current shape of the divergence so a change in it is visible.
  assert.deepEqual(
    evaluated.filter((key) => !seen.includes(key)),
    [IRRITATED_OILY_DIVERGENCE],
  )
  assert.deepEqual(
    seen.filter((key) => !evaluated.includes(key)),
    [],
  )
  assert.deepEqual(seen, evaluated)
})
