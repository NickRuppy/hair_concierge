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

/** The Stage-1 preview payload: the role keys the cards showed, plus its verdict. */
async function previewPayload(envelope: PersonalPlanQuizSubmissionEnvelope) {
  const response = await computeStage1ProductExamplePreviews({
    personalPlanId: PERSONAL_PLAN_ID,
    sourceNeedVersionId: INITIAL_NEED_VERSION_ID,
    snapshot: initialSnapshot(envelope),
    loadCandidates: noCandidates,
  })
  return {
    roleKeys: [...response.previews.map((preview) => preview.decisionKey)].sort(),
    directAcceptance: response.directAcceptance,
  }
}

function categoryOf(decisionKey: string): string {
  return decisionKey.split(":")[1]!
}

/**
 * THE INVARIANT, in the form the product now guarantees. For every cohort,
 * exactly one of these must hold:
 *
 *   - the preview role set and the accept chain's evaluation set are EQUAL, and
 *     the payload offers direct acceptance; or
 *   - they diverge, and the payload refuses direct acceptance up front, naming
 *     every divergent category in `blockedCategories`.
 *
 * Any NEW divergence must fail this test rather than reach users as a 409:
 * a diverging cohort that the payload still marks `available: true` is exactly
 * the bug this net exists to catch.
 */
async function assertSeenStateJoin(envelope: PersonalPlanQuizSubmissionEnvelope) {
  const { roleKeys: seen, directAcceptance } = await previewPayload(envelope)
  const evaluated = acceptChainRoleKeys(envelope)
  const serverOnly = evaluated.filter((key) => !seen.includes(key))
  const clientOnly = seen.filter((key) => !evaluated.includes(key))

  // A role the client saw but the server will not evaluate is never recoverable
  // by refusing acceptance — it means the preview payload itself is wrong.
  assert.deepEqual(clientOnly, [], "previews showed a role the accept chain does not evaluate")

  if (serverOnly.length === 0) {
    assert.deepEqual(seen, evaluated)
    assert.deepEqual(
      directAcceptance,
      { available: true },
      "sets match, so direct acceptance must be offered",
    )
    return
  }

  assert.equal(
    directAcceptance.available,
    false,
    `sets diverge on ${serverOnly.join(", ")}, so the payload must refuse direct acceptance`,
  )
  if (directAcceptance.available) throw new Error("unreachable")
  assert.equal(directAcceptance.reason, "refinement_required")
  assert.deepEqual(
    [...directAcceptance.blockedCategories].sort(),
    [...new Set(serverOnly.map(categoryOf))].sort(),
    "every divergent category must be named in blockedCategories",
  )
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

test("the calm-scalp cohort joins cleanly and may accept directly", async () => {
  await assertSeenStateJoin(CALM_SCALP_ENVELOPE)

  const { directAcceptance } = await previewPayload(CALM_SCALP_ENVELOPE)
  assert.deepEqual(directAcceptance, { available: true })
})

/**
 * The cohort Task 1 pinned as problematic: reported scalp irritation on an oily
 * scalp. Stage 1 defers Scalp Care, so no card and no preview exists for it,
 * but the defaults must answer the deferred question to complete Stage 2, which
 * resolves the deferral — and `scalpOiliness` then produces a
 * `scalp_flake_oil_adjunct` role the client could never echo. See the pinned
 * test "resolving the deferred scalp question can still add Scalp Care for an
 * oily scalp" in tests/personal-plan-direct-acceptance.test.ts.
 *
 * Per controller ruling the cohort is excluded from direct acceptance for this
 * release, declared server-side in the payload rather than discovered as a 409.
 */
test("the irritated + oily scalp cohort is refused direct acceptance up front", async () => {
  await assertSeenStateJoin(STAGE1_STAGE2_LAB_ENVELOPE)

  const { directAcceptance } = await previewPayload(STAGE1_STAGE2_LAB_ENVELOPE)
  assert.deepEqual(directAcceptance, {
    available: false,
    reason: "refinement_required",
    blockedCategories: ["scalp_care"],
  })
})
