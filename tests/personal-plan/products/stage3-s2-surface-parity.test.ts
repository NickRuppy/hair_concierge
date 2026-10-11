import assert from "node:assert/strict"
import test from "node:test"

import { computeNeedPlan } from "../../../src/lib/personal-plan/compute-stage1"
import {
  acceptIdealPlan,
  buildDirectAcceptanceIntents,
  DirectAcceptanceError,
  type AcceptIdealPlanDeps,
} from "../../../src/lib/personal-plan/direct-acceptance/accept"
import { resolveMobileScan } from "../../../src/lib/mobile/scan-service"
import { CATEGORY_ROLE_POLICIES } from "../../../src/lib/personal-plan/products/authorities"
import {
  createProductionStage3ProductsGateway,
  type Stage3ProductionPersistence,
} from "../../../src/lib/personal-plan/products/production-persistence-gateway"
import { createProposedProductPortfolio } from "../../../src/lib/personal-plan/products/portfolio"
import {
  addCapturedProduct,
  assignProductRoles,
  completeCaptureCategory,
  createStage3Draft,
} from "../../../src/lib/personal-plan/products/state-machine"
import type { ScanEvaluationContext } from "../../../src/lib/scan/profile-context"
import { computeStage1ProductExamplePreviews } from "../../../src/lib/personal-plan/product-previews"
import type {
  Stage3AuthorityInput,
  Stage3CategoryProductFacts,
} from "../../../src/lib/personal-plan/products/authority/contracts"
import { evaluateStage3Authority } from "../../../src/lib/personal-plan/products/authority/evaluate"
import {
  buildStage3SelectionProfile,
  type Stage3VisibleHairColor,
} from "../../../src/lib/personal-plan/products/authority/selection-profile"
import {
  stage3DecisionKey,
  type Stage3CategoryRequirement,
  type Stage3ProductDraft,
} from "../../../src/lib/personal-plan/products/contracts"
import { rankStage3ComparisonCandidates } from "../../../src/lib/personal-plan/products/fit-comparison"
import { buildScanVerdict } from "../../../src/lib/scan/resolve-verdict"
import type {
  InitialNeedPlanSnapshot,
  PlanProductRole,
  PlanProfile,
} from "../../../src/lib/personal-plan/types"
import { COMPLETE_V3_PLAN_ENVELOPE } from "../fixtures"
import {
  DEEP,
  DRY,
  DRY_CATALOG,
  SCALP,
  SCALP_CATALOG,
  deepCatalogWithExpectedTargets,
  s2Input,
} from "./fixtures/s2-catalog-2026-10-09"

/**
 * T2.7: one rule everywhere. For each S2 profile example the plan authority, the comparison
 * ranking, the Stage-1 preview, the scan verdict and the direct-acceptance seen-state agree.
 */

function baseSnapshot(): InitialNeedPlanSnapshot {
  const result = computeNeedPlan({
    rawEnvelope: COMPLETE_V3_PLAN_ENVELOPE,
    artifactId: "11111111-1111-4111-8111-111111111111",
    projection: "initial_quiz",
    computationVersion: "stage1-v1",
    createdAt: "2026-10-11T10:00:00.000Z",
  })
  if (result.status !== "ready") throw new Error("expected ready snapshot")
  return result.snapshot
}

type Example = {
  name: string
  category: "dry_shampoo" | "deep_cleansing_shampoo" | "scalp_care"
  role: PlanProductRole
  profile: (profile: PlanProfile) => PlanProfile
  color: Stage3VisibleHairColor | null
  candidates: Stage3CategoryProductFacts[]
  winner: string
  /**
   * Native (iOS) carousel head when scanning `scanned`. DOCUMENTED EXCEPTION, not a parity
   * guarantee: native presentation sorts the eligible pool by verdict, then EUR price
   * (`compareNativePresentationCandidates`, fit-comparison.ts), so it can differ from the
   * web/plan winner. Pinned here so a change is a visible decision.
   */
  nativeHead: string
  /** A catalogue product that is not the winner, scanned on the web. */
  scanned: string
}

const examples: Example[] = [
  {
    name: "D2 sensitive scalp, brown",
    category: "dry_shampoo",
    role: "root_refresh_bridge",
    profile: (p) => ({
      ...p,
      scalp: { ...p.scalp, concerns: ["irritated"] },
      goals: [],
      concerns: [],
    }),
    color: "brown",
    candidates: DRY_CATALOG,
    winner: DRY.baleaSensitive.productId,
    scanned: DRY.batisteOriginal.productId,
    nativeHead: DRY.baleaSchaum.productId,
  },
  {
    name: "D3 volume more (straight, fine), brown",
    category: "dry_shampoo",
    role: "root_refresh_bridge",
    profile: (p) => ({
      ...p,
      hair: { ...p.hair, texture: "straight", thickness: "fine" },
      scalp: { ...p.scalp, concerns: [] },
      goals: ["volume_balance"],
      concerns: [],
    }),
    color: "brown",
    candidates: DRY_CATALOG,
    winner: DRY.got2bVolumen.productId,
    scanned: DRY.batisteOriginal.productId,
    nativeHead: DRY.got2bVolumen.productId,
  },
  {
    name: "D5 brown, normal scalp, no direction",
    category: "dry_shampoo",
    role: "root_refresh_bridge",
    profile: (p) => ({ ...p, scalp: { ...p.scalp, concerns: [] }, goals: [], concerns: [] }),
    color: "brown",
    candidates: DRY_CATALOG,
    winner: DRY.batisteOriginal.productId,
    scanned: DRY.batisteBlond.productId,
    nativeHead: DRY.baleaSchaum.productId,
  },
  {
    name: "C1 oily scalp",
    category: "deep_cleansing_shampoo",
    role: "residue_reset",
    profile: (p) => ({ ...p, scalp: { ...p.scalp, oiliness: "oily" } }),
    color: null,
    candidates: deepCatalogWithExpectedTargets(),
    winner: DEEP.gliss.productId,
    scanned: DEEP.isana.productId,
    nativeHead: DEEP.balea.productId,
  },
  {
    name: "C3 balanced scalp",
    category: "deep_cleansing_shampoo",
    role: "residue_reset",
    profile: (p) => ({ ...p, scalp: { ...p.scalp, oiliness: "balanced" } }),
    color: null,
    candidates: deepCatalogWithExpectedTargets(),
    winner: DEEP.neqi.productId,
    scanned: DEEP.balea.productId,
    nativeHead: DEEP.isana.productId,
  },
  {
    name: "scalp exfoliant",
    category: "scalp_care",
    role: "scalp_exfoliant",
    profile: (p) => p,
    color: null,
    candidates: SCALP_CATALOG,
    winner: SCALP.baleaPeeling.productId,
    scanned: SCALP.isanaPeeling.productId,
    nativeHead: SCALP.baleaPeeling.productId,
  },
]

function withImages(candidates: Stage3CategoryProductFacts[]): Stage3CategoryProductFacts[] {
  return candidates.map((candidate) => ({
    ...candidate,
    presentationImageUrl: `https://example.com/${candidate.productId}.webp`,
  }))
}

function setup(example: Example) {
  const base = baseSnapshot()
  const authorityInput = s2Input({
    category: example.category,
    role: example.role,
    candidates: withImages(example.candidates) as never,
  }) as Stage3AuthorityInput
  const snapshot: InitialNeedPlanSnapshot = {
    ...base,
    profile: example.profile(base.profile),
    decisions: [authorityInput.categoryDecision],
    renderedOrder: [example.category],
    coverage: [],
  }
  const selectionProfile = buildStage3SelectionProfile(snapshot, example.color)
  return {
    snapshot,
    input: {
      ...authorityInput,
      subjectKey: stage3DecisionKey(example.category, example.role, null),
      selectionProfile,
    } as Stage3AuthorityInput,
  }
}

for (const example of examples) {
  test(`${example.name}: plan, comparison, preview, scan and acceptance agree on the winner`, async () => {
    const { snapshot, input } = setup(example)

    // (a) the authority pick (Stage 3 plan)
    const evaluation = evaluateStage3Authority(input)
    assert.equal(evaluation.status, "known")
    if (evaluation.status !== "known") return
    assert.equal(evaluation.recommendation?.productId, example.winner)

    // (b) the comparison ranking head
    assert.equal(rankStage3ComparisonCandidates(input)[0]?.productId, example.winner)

    // (c) the Stage-1 preview (fake loader) with the same root colour
    const previews = await computeStage1ProductExamplePreviews({
      personalPlanId: "plan-s2",
      sourceNeedVersionId: "need-s2",
      snapshot,
      loadCandidates: async () => input.recommendationCandidates,
      visibleHairColor: example.color,
    })
    const preview = previews.previews[0]
    assert.equal(preview?.kind, "recommendation")
    if (preview?.kind !== "recommendation") return
    assert.equal(preview.productId, example.winner)

    // (d) the web scan of a non-winner offers the winner first
    const scanned = input.recommendationCandidates.find(
      (candidate) => candidate.productId === example.scanned,
    )!
    const verdict = buildScanVerdict({
      category: example.category,
      decision: input.categoryDecision,
      productFacts: scanned,
      recommendationCandidates: input.recommendationCandidates,
      coverage: [],
      hairThickness: "normal",
      selectionProfile: buildStage3SelectionProfile(snapshot, example.color),
      heatCarrierCoverage: { carrierCategory: null, verifiedRoutes: [] },
      refinedVersionId: "refined-s2",
      refinedInputHash: snapshot.inputHash,
    })
    assert.equal(verdict.kind, "in_catalog")
    if (verdict.kind !== "in_catalog") return
    assert.equal(verdict.alternatives[0]?.productId, example.winner)

    // (e) direct acceptance: the gateway evaluation (same slice builder, same colour loader)
    // accepts the previewed product without `seen_state_stale`.
    const intents = buildDirectAcceptanceIntents(
      [evaluation],
      [
        {
          decisionKey: preview.decisionKey,
          productId: preview.productId,
          factFingerprint: preview.factFingerprint,
        },
      ],
      new Set([preview.decisionKey]),
    )
    assert.deepEqual(
      intents.map((intent) => intent.action),
      ["plan_recommendation"],
    )
  })
}

test("a root colour that differs between preview and acceptance would change a tinted verdict (parity guard)", () => {
  const example = examples[2]!
  const { snapshot, input } = setup(example)
  const bruenett = input.recommendationCandidates.find(
    (candidate) => candidate.productId === DRY.batisteBruenett.productId,
  )!
  const verdictFor = (color: Stage3VisibleHairColor | null) => {
    const evaluation = evaluateStage3Authority({
      ...input,
      selectionProfile: buildStage3SelectionProfile(snapshot, color),
      capturedProductId: null,
      subjectIdentity: {
        kind: "catalog_product",
        productId: bruenett.productId,
        displayName: bruenett.displayName,
        category: "dry_shampoo",
      },
      productFacts: bruenett as never,
      recommendationCandidates: [],
    })
    return evaluation.status === "known" ? evaluation.verdict : evaluation.status
  }
  assert.equal(verdictFor("brown"), "ideal")
  assert.equal(verdictFor(null), "supportive")
})

/* ---------------------------------------------- F3: real mobile scan service */

function productRow(facts: Stage3CategoryProductFacts) {
  return {
    id: facts.productId,
    name: facts.displayName,
    brand: null,
    category_key: facts.category,
    image_url: `https://example.com/${facts.productId}.webp`,
    price_eur: facts.priceEur ?? null,
    currency: "EUR",
    affiliate_link: null,
    purchase_link_status: "available",
    price_checked_at: null,
    sort_order: facts.catalogSortOrder ?? null,
  }
}

for (const example of examples) {
  test(`${example.name}: the real mobile scan service grades like the web; native head is the documented exception`, async () => {
    const { snapshot, input } = setup(example)
    const candidates = input.recommendationCandidates
    const context = {
      snapshot,
      snapshotSource: "refined",
      refinedVersionId: "refined-s2",
      refinedInputHash: snapshot.inputHash,
    } as unknown as ScanEvaluationContext
    const result = await resolveMobileScan(
      {} as never,
      context,
      { productId: example.scanned, visibleHairColor: example.color },
      {
        isQuarantined: async () => false,
        loadProductById: (async (_client: unknown, id: string) => {
          const facts = candidates.find((candidate) => candidate.productId === id)
          return facts ? productRow(facts) : null
        }) as never,
        loadScanProductFacts: (async (_c: unknown, _cat: unknown, productId: string) =>
          candidates.find((candidate) => candidate.productId === productId) ?? null) as never,
        loadRecommendationCandidates: (async (_c: unknown, request: { roles: string[] }) =>
          Object.fromEntries(request.roles.map((role) => [role, candidates]))) as never,
        loadQuarantinedProductIdsAmong: async () => new Set<string>(),
      },
    )
    const web = buildScanVerdict({
      category: example.category,
      decision: input.categoryDecision,
      productFacts: candidates.find((candidate) => candidate.productId === example.scanned)!,
      recommendationCandidates: candidates,
      coverage: [],
      hairThickness: snapshot.profile.hair.thickness,
      selectionProfile: buildStage3SelectionProfile(snapshot, example.color),
      heatCarrierCoverage: { carrierCategory: null, verifiedRoutes: [] },
      refinedVersionId: "refined-s2",
      refinedInputHash: snapshot.inputHash,
    })
    assert.equal(result.kind, "assessment")
    assert.equal(web.kind, "in_catalog")
    if (result.kind !== "assessment" || web.kind !== "in_catalog") return
    // Same profile slice, same verdict for the scanned product on both surfaces.
    assert.equal(result.verdict, web.verdict)
    // Web offers the plan winner first.
    assert.equal(web.alternatives[0]?.productId, example.winner)
    // Native: verdict, then EUR price (documented exception; see `nativeHead`).
    assert.equal(result.alternatives[0]?.product.id, example.nativeHead)
  })
}

/* ------------------------------- F3: real gateway direct-acceptance round trip */

const DRY_REQUIREMENTS: Stage3CategoryRequirement[] = [
  {
    category: "dry_shampoo",
    requiredRoles: ["root_refresh_bridge"],
    needSummary: "Ansatz auffrischen",
    authorityVersion: CATEGORY_ROLE_POLICIES.dry_shampoo.authorityVersion,
  },
]
const DRY_GAP_KEY = stage3DecisionKey("dry_shampoo", "root_refresh_bridge", null)

function dryGapDraft(decision: Stage3AuthorityInput["categoryDecision"]): Stage3ProductDraft {
  const initial = createStage3Draft({
    draftId: "draft-s2",
    userId: "owner-s2",
    personalPlanId: "plan-s2",
    refinedVersionId: "refined-s2",
    requirements: DRY_REQUIREMENTS,
    now: "2026-10-11T00:00:00.000Z",
  })
  const captured = addCapturedProduct(initial, {
    capturedProductId: "capture-s2",
    userProductId: "owned-s2",
    identity: {
      kind: "catalog_product",
      productId: DRY.batisteOriginal.productId,
      displayName: DRY.batisteOriginal.displayName,
      category: "dry_shampoo",
    },
    frequencyRange: "weekly_2x",
    ownership: "owned",
    source: "catalog_search",
  })
  const assigned = assignProductRoles(captured, {
    capturedProductId: "capture-s2",
    category: "dry_shampoo",
    roles: ["root_refresh_bridge"],
  })
  const ready = completeCaptureCategory(assigned, "dry_shampoo", DRY_REQUIREMENTS)
  return {
    ...ready,
    products: [],
    roleAssignments: [],
    uncoveredRoles: [
      { category: "dry_shampoo", role: "root_refresh_bridge", reason: "no_product_owned" },
    ],
    decisions: [],
    completedDecisionKeys: [],
    authoritySnapshot: {
      schemaVersion: 1,
      refinedNeedVersionId: "refined-s2",
      refinedInputHash: "refined-input-s2",
      categoryDecisions: [decision],
      coverage: [],
      orderedCategories: ["dry_shampoo"],
      authorityVersions: Object.fromEntries(
        Object.entries(CATEGORY_ROLE_POLICIES).map(([category, policy]) => [
          category,
          policy.authorityVersion,
        ]),
      ) as never,
    },
  }
}

function acceptDeps(options: {
  decision: Stage3AuthorityInput["categoryDecision"]
  refinedProfile: PlanProfile
  color: Stage3VisibleHairColor | null
  candidates: Stage3CategoryProductFacts[]
  saved: Stage3ProductDraft[]
}): AcceptIdealPlanDeps {
  let draft = dryGapDraft(options.decision)
  const persistence: Stage3ProductionPersistence = {
    loadOrCreate: async () => ({ draft, requirements: DRY_REQUIREMENTS }),
    save: async (input) => {
      options.saved.push(input.draft)
      draft = input.draft
      return { outcome: "saved", draft: input.draft }
    },
    resolveNeedRevision: async (input) => ({ outcome: "saved", draft: input.draft }),
    search: async (input) => ({
      query: input.query,
      category: input.category,
      candidates: [],
      totalCapped: false,
    }),
    resolveOwnedCatalogProduct: async () => null,
    loadCurrentCatalogProduct: async () => null,
    loadRequirements: async () => DRY_REQUIREMENTS,
    loadCompletedPortfolio: async () =>
      createProposedProductPortfolio({ ...draft, status: "active" }, DRY_REQUIREMENTS, {
        portfolioVersionId: "portfolio-s2",
        createdAt: "2026-10-11T00:01:00.000Z",
      }),
    loadRefinedNeedSnapshot: async () =>
      ({
        inputHash: "refined-input-s2",
        profile: {
          ...options.refinedProfile,
          source: { ...options.refinedProfile.source, projection: "refined_post_plan" },
        },
      }) as never,
    loadSourceRevision: async () => 7,
    loadCurrentRefinedVersionId: async () => "refined-s2",
    loadAuthorityFacts: async () => ({
      productFacts: null,
      recommendationCandidates: options.candidates,
      heatCarrierCoverage: { carrierCategory: null, verifiedRoutes: [] },
    }),
    loadDraft: async (input) => (input.userId === "owner-s2" ? draft : null),
    loadShoppingContext: async () => ({ budget: null, currentConcerns: [], primaryConcern: null }),
    loadVisibleHairColor: async () => options.color,
    loadCatalogPackagePrices: async () => [],
  }
  return {
    userId: "owner-s2",
    flags: {
      stage2Enabled: true,
      stage3Enabled: true,
      stage4Enabled: true,
      shoppingBudgetEnabled: false,
    },
    loadShoppingBudget: async () => null,
    refinementPersistence: {
      loadOrCreate: async () => ({
        id: "stage2-s2",
        personalPlanId: "plan-s2",
        baseInitialNeedVersionId: "need-s2",
        schemaVersion: 1,
        preparedArtifactSourceId: "artifact-s2",
        baseInputSnapshot: null,
        pathVersion: "v1",
        triggerContext: {},
        answers: { washFrequency: "weekly_2x" },
        completedQuestionIds: ["wash_frequency"],
        answerProvenance: {},
        moduleProjections: {},
        revision: 3,
        status: "complete",
        refinedVersionId: "refined-s2",
        directAcceptanceOwned: true,
      }),
    } as never,
    loadKnownCareAnswers: async () => ({ answers: {}, questionIds: [] }),
    planState: {
      loadActiveRoutineVersionId: async () => null,
      isUnrefinedDirectAccept: async () => false,
    },
    stage3Gateway: createProductionStage3ProductsGateway({
      userId: "owner-s2",
      shoppingBudgetEnabled: false,
      persistence,
    }),
  } satisfies AcceptIdealPlanDeps
}

async function previewSeenRole(example: Example) {
  const { snapshot, input } = setup(example)
  const previews = await computeStage1ProductExamplePreviews({
    personalPlanId: "plan-s2",
    sourceNeedVersionId: "need-s2",
    snapshot,
    loadCandidates: async () => input.recommendationCandidates,
    visibleHairColor: example.color,
  })
  const preview = previews.previews[0]
  if (preview?.kind !== "recommendation") throw new Error("expected a recommendation preview")
  return {
    snapshot,
    input,
    seen: {
      decisionKey: preview.decisionKey,
      productId: preview.productId,
      factFingerprint: preview.factFingerprint,
    },
  }
}

test("D2 via the real gateway: the previewed sensitive-scalp pick is accepted and planned", async () => {
  const example = examples[0]!
  const { snapshot, input, seen } = await previewSeenRole(example)
  assert.equal(seen.decisionKey, DRY_GAP_KEY)
  const saved: Stage3ProductDraft[] = []
  await acceptIdealPlan(
    acceptDeps({
      decision: input.categoryDecision,
      refinedProfile: snapshot.profile,
      color: example.color,
      candidates: input.recommendationCandidates,
      saved,
    }),
    { seenRoles: [seen] },
  ).catch((error: unknown) => {
    // Completion needs the Stage-4 compiler this harness does not wire; the decision write
    // before it is what this test pins. A seen-state failure must not be swallowed.
    if (error instanceof DirectAcceptanceError) throw error
  })
  const decision = saved
    .flatMap((draft) => draft.decisions)
    .find((entry) => entry.decisionKey === DRY_GAP_KEY)
  assert.equal(decision?.choiceState, "planned_purchase")
  assert.equal(decision?.recommendation?.productId, DRY.baleaSensitive.productId)
})

test("D2 via the real gateway: a refined profile without the sensitivity makes the preview stale", async () => {
  const example = examples[0]!
  const { snapshot, input, seen } = await previewSeenRole(example)
  const saved: Stage3ProductDraft[] = []
  await assert.rejects(
    acceptIdealPlan(
      acceptDeps({
        decision: input.categoryDecision,
        refinedProfile: { ...snapshot.profile, scalp: { ...snapshot.profile.scalp, concerns: [] } },
        color: example.color,
        candidates: input.recommendationCandidates,
        saved,
      }),
      { seenRoles: [seen] },
    ),
    (error: unknown) => error instanceof DirectAcceptanceError && error.code === "seen_state_stale",
  )
  assert.deepEqual(saved, [])
})
