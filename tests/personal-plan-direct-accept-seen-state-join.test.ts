import assert from "node:assert/strict"
import test from "node:test"

import { STAGE1_STAGE2_LAB_ENVELOPE } from "../src/app/labs/personal-plan-stage-1-2/fixture"
import { computeNeedPlan } from "../src/lib/personal-plan/compute-stage1"
import { buildDirectAcceptanceStage2Defaults } from "../src/lib/personal-plan/direct-acceptance/defaults"
import { CATEGORY_ROLE_POLICIES } from "../src/lib/personal-plan/products/authorities"
import type { Stage3BondbuilderFacts } from "../src/lib/personal-plan/products/authority/contracts"
import { evaluateStage3Authority } from "../src/lib/personal-plan/products/authority/evaluate"
import { stage3DecisionKey } from "../src/lib/personal-plan/products/contracts"
import { buildStage3EntryContext } from "../src/lib/personal-plan/products/stage2-entry-adapter"
import type { PlanHairThickness } from "../src/lib/personal-plan/types"
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

/** The refined need version the synthetic Stage-2 defaults produce. */
function refinedSnapshot(envelope: PersonalPlanQuizSubmissionEnvelope) {
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
  return refined.snapshot
}

/**
 * The subject keys the accept chain evaluates: direct acceptance answers
 * `currentProductCategories: []`, so the Stage-3 draft holds no captured
 * products and every required role of the refined plan is an uncovered role
 * keyed `decision:<category>:<role>:gap`.
 */
function acceptChainRoleKeys(envelope: PersonalPlanQuizSubmissionEnvelope): string[] {
  const entry = buildStage3EntryContext(refinedSnapshot(envelope), {
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

/**
 * `defaultsWouldAddScalpCareRoles` (product-previews.ts) mirrors FOUR
 * scalp-care predicates; the two cohorts above only exercise the `oily` one.
 * These three cover the rest — dry oiliness, dry dandruff, and
 * hair_loss_or_thinning — each combined with reported irritation, because
 * irritation is what defers Scalp Care at Stage 1 in the first place.
 * A cohort that diverges must be refused up front, never discovered as a 409.
 */
const IRRITATED_DRY_ENVELOPE: PersonalPlanQuizSubmissionEnvelope = {
  ...STAGE1_STAGE2_LAB_ENVELOPE,
  answers: { ...STAGE1_STAGE2_LAB_ENVELOPE.answers, scalpOiliness: "dry" },
}

const IRRITATED_DRY_DANDRUFF_ENVELOPE: PersonalPlanQuizSubmissionEnvelope = {
  ...STAGE1_STAGE2_LAB_ENVELOPE,
  answers: {
    ...STAGE1_STAGE2_LAB_ENVELOPE.answers,
    scalpOiliness: "balanced",
    scalpConcerns: ["irritated", "dry_dandruff"],
  },
}

const IRRITATED_HAIR_LOSS_ENVELOPE: PersonalPlanQuizSubmissionEnvelope = {
  ...STAGE1_STAGE2_LAB_ENVELOPE,
  answers: {
    ...STAGE1_STAGE2_LAB_ENVELOPE.answers,
    scalpOiliness: "balanced",
    currentConcerns: ["dry_lengths", "hair_loss_or_thinning"],
    concernRecurrence: { concernId: "dry_lengths", frequency: "often" },
  },
}

/**
 * THE STRONG FORM OF THE JOIN.
 *
 * Every cohort above loads an EMPTY catalog, so every preview is a fallback and
 * the assertions can only compare decision KEYS. But `seenRoles` echoes three
 * values per role — `decisionKey`, `productId` and `factFingerprint` — and
 * `buildDirectAcceptanceIntents` rejects a value mismatch exactly as hard as a
 * missing key. A key-set-only net therefore proves key-set stability, nothing
 * about the products.
 *
 * This cohort supplies a real (fake) catalog carrying the production Bondbuilder
 * situation — three equally ideal candidates, one of them the tie default — and
 * joins at value level. The two sides are genuinely different computations:
 * the preview evaluates the authority against the INITIAL snapshot's category
 * decision, while the accept chain evaluates it against the REFINED snapshot the
 * synthetic Stage-2 defaults produce. If the tie default ever resolved
 * differently on the two sides (a different product, or the same product with a
 * different fingerprint), the whole cohort would meet a 409 — and it must fail
 * here instead.
 */
const BONDBUILDER_TIE_ROLE = "specialized_bond_treatment" as const

/**
 * Pinned as a LITERAL on purpose. Importing
 * `BONDBUILDER_TIE_DEFAULT_PRODUCT_ID` would make this fixture move with the
 * production constant, so the join would keep passing self-consistently even if
 * the default silently changed to another product. The catalog id is the
 * product decision — it belongs in the test as data.
 */
const K18_PRODUCT_ID = "38dace91-0fba-49ee-a93f-ac36e488fe4b"

function bondbuilderTieCandidates(thickness: PlanHairThickness): Stage3BondbuilderFacts[] {
  const candidate = (productId: string, displayName: string): Stage3BondbuilderFacts => ({
    productId,
    displayName,
    category: "bondbuilder",
    isActive: true,
    lifecycleStatus: "active",
    recommendable: true,
    // Deliberately pinned to the initial snapshot's thickness rather than made
    // universally suitable: a thickness drift between the two snapshots must
    // break this join loudly instead of being papered over.
    suitableThicknesses: [thickness],
    knownReaction: false,
    protocols: [
      { role: BONDBUILDER_TIE_ROLE, status: "verified_complete", fingerprint: `p-${productId}` },
    ],
    presentationImageUrl: `https://example.com/${productId}.webp`,
    factFingerprint: `facts-${productId}`,
    spec: {
      applicationMode: "pre_shampoo",
      treatmentMode: "rinse_out",
      productFormat: "treatment",
      usageProtocol: "course",
      relationship: "standalone",
    },
  })

  return [
    candidate("olaplex-no3", "OLAPLEX No.3PLUS Complete Repair Treatment"),
    candidate(K18_PRODUCT_ID, "K18 Leave-In Molecular Repair Hair Mask"),
    candidate("epres", "Epres Bond Repair Treatment"),
  ]
}

/**
 * What the accept chain's own authority evaluation produces for the uncovered
 * Bondbuilder subject of the REFINED plan — the server side of the join.
 */
function acceptChainBondbuilderEvaluation(
  envelope: PersonalPlanQuizSubmissionEnvelope,
  candidates: Stage3BondbuilderFacts[],
) {
  const refined = refinedSnapshot(envelope)
  const entry = buildStage3EntryContext(refined, {
    personalPlanId: PERSONAL_PLAN_ID,
    refinedVersionId: REFINED_NEED_VERSION_ID,
  })
  const requirement = entry.orderedCategories.find((item) => item.category === "bondbuilder")
  if (!requirement) throw new Error("the refined plan has no bondbuilder requirement")
  if (!requirement.requiredRoles.includes(BONDBUILDER_TIE_ROLE)) {
    throw new Error("the refined plan does not require the bondbuilder tie role")
  }
  const categoryDecision = refined.decisions.find((item) => item.category === "bondbuilder")
  if (!categoryDecision) throw new Error("the refined snapshot has no bondbuilder decision")

  return evaluateStage3Authority({
    category: "bondbuilder",
    authorityVersion: CATEGORY_ROLE_POLICIES.bondbuilder.authorityVersion,
    refinedVersionId: REFINED_NEED_VERSION_ID,
    refinedInputHash: refined.inputHash,
    subjectKey: stage3DecisionKey("bondbuilder", BONDBUILDER_TIE_ROLE, null),
    role: BONDBUILDER_TIE_ROLE,
    // Direct acceptance answers `currentProductCategories: []`, so the subject
    // is an uncovered gap with no captured product.
    capturedProductId: null,
    subjectIdentity: null,
    categoryDecision,
    coverage: refined.coverage,
    hairThickness: refined.profile.hair.thickness,
    productFacts: null,
    recommendationCandidates: candidates,
    heatCarrierCoverage: { carrierCategory: null, verifiedRoutes: [] },
  } as never)
}

test("the Bondbuilder tie cohort joins on product identity, not only on role keys", async () => {
  const envelope = CALM_SCALP_ENVELOPE
  const initial = initialSnapshot(envelope)
  const candidates = bondbuilderTieCandidates(initial.profile.hair.thickness)

  const response = await computeStage1ProductExamplePreviews({
    personalPlanId: PERSONAL_PLAN_ID,
    sourceNeedVersionId: INITIAL_NEED_VERSION_ID,
    snapshot: initial,
    loadCandidates: async (selection) =>
      selection.category === "bondbuilder" ? candidates : ([] as never),
  })

  const decisionKey = stage3DecisionKey("bondbuilder", BONDBUILDER_TIE_ROLE, null)
  const preview = response.previews.find((entry) => entry.decisionKey === decisionKey)
  assert.ok(preview, "the tie cohort must produce a bondbuilder preview")
  assert.equal(
    preview.kind,
    "recommendation",
    "the tie default must resolve to a buyable product, not a fallback",
  )
  if (preview.kind !== "recommendation") throw new Error("unreachable")
  assert.equal(preview.productId, K18_PRODUCT_ID)

  const server = acceptChainBondbuilderEvaluation(envelope, candidates)
  assert.equal(server.status, "known")
  if (server.status !== "known") throw new Error("unreachable")

  // The two values the client echoes at accept time, compared to the two the
  // server will compute for the same subject.
  assert.equal(
    server.recommendation?.productId,
    preview.productId,
    "the accept chain must plan exactly the product the preview showed",
  )
  assert.equal(
    server.recommendationFactFingerprint,
    preview.factFingerprint,
    "the accept chain must plan it on exactly the facts the preview echoed",
  )
  assert.deepEqual(response.directAcceptance, { available: true })

  // And the key-level invariant still holds for this cohort.
  await assertSeenStateJoin(envelope)
})

for (const [name, envelope] of [
  ["irritated + dry scalp", IRRITATED_DRY_ENVELOPE],
  ["irritated + dry dandruff", IRRITATED_DRY_DANDRUFF_ENVELOPE],
  ["irritated + hair loss or thinning", IRRITATED_HAIR_LOSS_ENVELOPE],
] as const) {
  test(`the ${name} cohort either joins cleanly or is refused up front`, async () => {
    await assertSeenStateJoin(envelope)

    const { directAcceptance } = await previewPayload(envelope)
    if (directAcceptance.available) return
    assert.equal(directAcceptance.reason, "refinement_required")
    assert.ok(
      directAcceptance.blockedCategories.includes("scalp_care"),
      "a scalp-care divergence must name scalp_care in blockedCategories",
    )
  })
}
