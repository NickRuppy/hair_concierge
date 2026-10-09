import assert from "node:assert/strict"
import test from "node:test"

import { CATEGORY_ROLE_POLICIES } from "../../../src/lib/personal-plan/products/authorities"
import { BONDBUILDER_TIE_DEFAULT_PRODUCT_ID } from "../../../src/lib/personal-plan/products/authority/categories/bondbuilder"
import type { Stage3AuthorityFactBundle } from "../../../src/lib/personal-plan/products/authority/catalog-facts"
import type {
  Stage3CategoryRequirement,
  Stage3ProductDraft,
} from "../../../src/lib/personal-plan/products/contracts"
import { parseStage3BootstrapResponse } from "../../../src/lib/personal-plan/products/bootstrap-response"
import {
  createProductionStage3ProductsGateway,
  Stage3AuthorityMutationError,
  type Stage3CatalogPackagePrice,
  type Stage3ProductionPersistence,
} from "../../../src/lib/personal-plan/products/production-persistence-gateway"
import { createProposedProductPortfolio } from "../../../src/lib/personal-plan/products/portfolio"
import {
  addCapturedProduct,
  assignProductRoles,
  completeCaptureCategory,
} from "../../../src/lib/personal-plan/products/state-machine"
import { createStage3Draft } from "../../../src/lib/personal-plan/products/state-machine"
import { composeStage3BootstrapResponse } from "../../../src/lib/personal-plan/products/stage3-bootstrap-response-server"
import type { ShoppingBudget } from "../../../src/lib/user-facts/schema"

const GAP_KEY = "decision:conditioner:conditioner_rinse_out:gap"

const STRICT_5: ShoppingBudget = { kind: "capped", limitEur: 5, allowExceptions: false }
const FLEX_5: ShoppingBudget = { kind: "capped", limitEur: 5, allowExceptions: true }
const UNCAPPED: ShoppingBudget = { kind: "uncapped" }

const requirements: Stage3CategoryRequirement[] = [
  {
    category: "conditioner",
    requiredRoles: ["conditioner_rinse_out"],
    needSummary: "Pflege",
    authorityVersion: CATEGORY_ROLE_POLICIES.conditioner.authorityVersion,
  },
]

/** A decision-ready draft whose conditioner role is an empty slot (no owned product). */
function gapDraft(): Stage3ProductDraft {
  const initial = createStage3Draft({
    draftId: "draft-budget",
    userId: "owner-a",
    personalPlanId: "plan-a",
    refinedVersionId: "refined-a",
    requirements,
    now: "2026-10-09T00:00:00.000Z",
  })
  const captured = addCapturedProduct(initial, {
    capturedProductId: "capture-a",
    userProductId: "owned-a",
    identity: {
      kind: "catalog_product",
      productId: "catalog-a",
      displayName: "Pflege",
      category: "conditioner",
    },
    frequencyRange: "weekly_2x",
    ownership: "owned",
    source: "catalog_search",
  })
  const assigned = assignProductRoles(captured, {
    capturedProductId: "capture-a",
    category: "conditioner",
    roles: ["conditioner_rinse_out"],
  })
  const ready = completeCaptureCategory(assigned, "conditioner", requirements)
  return {
    ...ready,
    products: [],
    roleAssignments: [],
    uncoveredRoles: [
      { category: "conditioner", role: "conditioner_rinse_out", reason: "no_product_owned" },
    ],
    decisions: [],
    completedDecisionKeys: [],
    authoritySnapshot: {
      schemaVersion: 1,
      refinedNeedVersionId: ready.refinedVersionId,
      refinedInputHash: "refined-input-a",
      categoryDecisions: [
        {
          category: "conditioner",
          resolution: "resolved",
          needTier: "basis",
          roles: ["conditioner_rinse_out"],
          target: {
            category: "conditioner",
            roles: ["conditioner_rinse_out"],
            weight: "light",
            careDirection: "moisture",
            repairSupportLevel: "medium",
            functionalNeeds: [],
          },
          frequency: null,
          reasons: [],
          executionState: "available",
          executionPauseReason: null,
          deferredFacts: [],
        },
      ],
      coverage: [],
      orderedCategories: ["conditioner"],
      authorityVersions: Object.fromEntries(
        Object.entries(CATEGORY_ROLE_POLICIES).map(([category, policy]) => [
          category,
          policy.authorityVersion,
        ]),
      ) as never,
    },
  }
}

function conditioner(
  productId: string,
  options: { priceEur: number; sortOrder: number; weight?: string },
) {
  return {
    productId,
    displayName: productId,
    category: "conditioner" as const,
    isActive: true,
    lifecycleStatus: "active",
    recommendable: true,
    suitableThicknesses: ["normal"],
    knownReaction: false,
    protocols: [
      {
        role: "conditioner_rinse_out" as const,
        status: "verified_complete" as const,
        fingerprint: `protocol-${productId}`,
      },
    ],
    factFingerprint: `facts-${productId}`,
    catalogSortOrder: options.sortOrder,
    priceEur: options.priceEur,
    purchaseLinkStatus: "available" as const,
    currency: "EUR",
    spec: {
      thickness: "normal",
      proteinMoistureBalance: "moisture",
      weight: options.weight ?? "light",
      repairSupportLevel: "medium",
      balanceDirection: "moisture",
      targetFit: "matched" as const,
    },
  }
}

function facts(candidates: ReturnType<typeof conditioner>[]): Stage3AuthorityFactBundle {
  return {
    productFacts: null,
    recommendationCandidates: candidates,
    heatCarrierCoverage: { carrierCategory: null, verifiedRoutes: [] },
  }
}

/** Fit order: pricey (20 €) first, then three affordable on-target conditioners. */
const ONE_PRICEY_THREE_AFFORDABLE = facts([
  conditioner("pricey", { priceEur: 20, sortOrder: 1 }),
  conditioner("cheap-a", { priceEur: 4, sortOrder: 2 }),
  conditioner("cheap-b", { priceEur: 5, sortOrder: 3 }),
  conditioner("cheap-c", { priceEur: 3.5, sortOrder: 4 }),
])

function persistence(
  draft: Stage3ProductDraft,
  options: {
    budget: ShoppingBudget | null
    facts: Stage3AuthorityFactBundle | ((category: string) => Stage3AuthorityFactBundle)
    onBudgetRead?: () => void
    saved?: Stage3ProductDraft[]
    currentConcerns?: string[]
    primaryConcern?: string | null
    prices?: Stage3CatalogPackagePrice[]
    onPriceRead?: (productIds: string[]) => void
  },
): Stage3ProductionPersistence {
  return {
    loadOrCreate: async () => ({ draft, requirements }),
    save: async (input) => {
      options.saved?.push(input.draft)
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
    loadRequirements: async () => requirements,
    loadCompletedPortfolio: async () =>
      createProposedProductPortfolio(
        { ...draft, status: "active", pass: "ready_for_routine" },
        requirements,
        { portfolioVersionId: "portfolio-a", createdAt: "2026-10-09T00:01:00.000Z" },
      ),
    loadRefinedNeedSnapshot: async () =>
      ({
        inputHash: "refined-input-a",
        profile: {
          source: { projection: "refined_post_plan" },
          hair: { thickness: "normal" },
          concerns: [],
        },
      }) as never,
    loadSourceRevision: async () => 7,
    loadCurrentRefinedVersionId: async () => draft.refinedVersionId,
    loadAuthorityFacts: async (input) =>
      typeof options.facts === "function" ? options.facts(input.subject.category) : options.facts,
    loadDraft: async (input) => (input.userId === "owner-a" ? draft : null),
    loadShoppingContext: async () => {
      options.onBudgetRead?.()
      return {
        budget: options.budget,
        currentConcerns: options.currentConcerns ?? [],
        primaryConcern: options.primaryConcern ?? null,
      }
    },
    loadCatalogPackagePrices: async (productIds) => {
      options.onPriceRead?.(productIds)
      return (options.prices ?? []).filter((price) => productIds.includes(price.productId))
    },
  }
}

function gateway(
  draft: Stage3ProductDraft,
  options: Parameters<typeof persistence>[1] & { enabled?: boolean },
  extra: Partial<Parameters<typeof createProductionStage3ProductsGateway>[0]> = {},
) {
  return createProductionStage3ProductsGateway({
    userId: "owner-a",
    shoppingBudgetEnabled: options.enabled ?? true,
    persistence: persistence(draft, options),
    ...extra,
  })
}

const completingPipeline = (onStage: () => void) => ({
  compiler: {
    compile: async () => ({
      schemaVersion: 1 as const,
      compilerVersion: "test",
      authorityVersions: {},
      sourceFingerprint: "source",
      payload: {},
      proposalDelta: {},
    }),
  },
  stager: {
    stage: async () => {
      onStage()
      return {
        status: "completed" as const,
        portfolioVersionId: "portfolio-budget",
        routineVersionId: "routine-budget",
        routineProposalId: "proposal-budget",
        revision: 99,
      }
    },
  },
})

test("B-INT-STR-2: strict 5 € recommends the first affordable fit and shows affordable only", async () => {
  const draft = gapDraft()
  const [review] = await gateway(draft, {
    budget: STRICT_5,
    facts: ONE_PRICEY_THREE_AFFORDABLE,
  }).reviewDecisionBundles({ draftId: draft.draftId })

  assert.equal(review!.authorityEvaluation.status, "known")
  if (review!.authorityEvaluation.status !== "known") return
  assert.equal(review!.authorityEvaluation.recommendation?.productId, "cheap-a")
  assert.equal(review!.authorityEvaluation.recommendationFactFingerprint, "facts-cheap-a")
  assert.deepEqual(
    review!.fitComparison.alternatives.map((candidate) => candidate.productId),
    ["cheap-a", "cheap-b", "cheap-c"],
  )
  assert.equal(review!.fitComparison.defaultProductId, "cheap-a")
  assert.equal(review!.fitComparison.budgetNotice, null)
  assert.equal(review!.fitComparison.budgetException, null)
  const alternative = review!.fitComparison.products.find(
    (product) => product.productId === "cheap-b",
  )
  assert.deepEqual(alternative?.presentation, {
    priceLabel: "5,00\u00a0€",
    netContentLabel: null,
    packagePriceEur: 5,
    overBudget: false,
    labelKind: "within_budget",
  })
})

test("B-INT-STR-0: strict budget with nothing affordable has no recommendation and cannot plan one", async () => {
  const draft = gapDraft()
  const budgeted = gateway(draft, {
    budget: STRICT_5,
    facts: facts([
      conditioner("pricey", { priceEur: 20, sortOrder: 1 }),
      conditioner("mid", { priceEur: 12, sortOrder: 2 }),
    ]),
  })
  const [review] = await budgeted.reviewDecisionBundles({ draftId: draft.draftId })

  assert.equal(review!.authorityEvaluation.status, "known")
  if (review!.authorityEvaluation.status !== "known") return
  assert.equal(review!.authorityEvaluation.recommendation, null)
  assert.equal(review!.authorityEvaluation.allowedActions.includes("plan_recommendation"), false)
  assert.equal(review!.fitComparison.defaultProductId, null)
  assert.equal(review!.fitComparison.budgetNotice, "strict_none_affordable")
  assert.deepEqual(
    review!.fitComparison.alternatives.map((candidate) => candidate.productId),
    ["mid", "pricey"],
  )

  await assert.rejects(
    () =>
      budgeted.resolveDecision({
        draftId: draft.draftId,
        expectedRevision: draft.revision,
        intent: { type: "resolve_decision", subjectKey: GAP_KEY, action: "plan_recommendation" },
      }),
    (error: unknown) => error instanceof Stage3AuthorityMutationError,
  )
})

test("B-INT-FLX: a flexible exception with a closer weight becomes the recommendation and persists", async () => {
  const draft = gapDraft()
  // Fit order: the light (on-target) 20 € conditioner, then a medium 4 € one (one stop off).
  const catalog = facts([
    conditioner("light-pricey", { priceEur: 20, sortOrder: 1 }),
    conditioner("medium-cheap", { priceEur: 4, sortOrder: 2, weight: "medium" }),
  ])
  const strictReview = (
    await gateway(draft, { budget: STRICT_5, facts: catalog }).reviewDecisionBundles({
      draftId: draft.draftId,
    })
  )[0]!
  assert.equal(
    strictReview.authorityEvaluation.status === "known" &&
      strictReview.authorityEvaluation.recommendation?.productId,
    "medium-cheap",
  )

  const saved: Stage3ProductDraft[] = []
  const flexible = gateway(draft, { budget: FLEX_5, facts: catalog, saved })
  const [review] = await flexible.reviewDecisionBundles({ draftId: draft.draftId })
  assert.equal(review!.authorityEvaluation.status, "known")
  if (review!.authorityEvaluation.status !== "known") return
  assert.equal(review!.authorityEvaluation.recommendation?.productId, "light-pricey")
  assert.equal(review!.fitComparison.defaultProductId, "light-pricey")
  assert.equal(review!.fitComparison.budgetNotice, "flex_improvement")
  assert.deepEqual(review!.fitComparison.budgetException, {
    kind: "improvement",
    improvedDimensionIds: ["conditioner.weight"],
  })
  assert.deepEqual(
    review!.fitComparison.products.map((product) => [
      product.productId,
      product.presentation?.overBudget,
      product.presentation?.labelKind,
    ]),
    [
      ["light-pricey", true, "recommended"],
      ["medium-cheap", false, "within_budget"],
    ],
  )

  const result = await flexible.resolveDecision({
    draftId: draft.draftId,
    expectedRevision: draft.revision,
    intent: {
      type: "resolve_decision",
      subjectKey: GAP_KEY,
      action: "plan_recommendation",
      selectedCandidateId: "light-pricey",
    },
  })
  assert.equal(result.status, "saved")
  const decision = saved[0]!.decisions[0]!
  assert.equal(decision.choiceState, "planned_purchase")
  assert.equal(decision.recommendation?.productId, "light-pricey")
  assert.equal(decision.authorityEvidence?.recommendationFactFingerprint, "facts-light-pricey")
})

test("B-INT-PRES: an accepted over-budget choice stays completion-current after the budget lowers", async () => {
  const draft = gapDraft()
  const saved: Stage3ProductDraft[] = []
  const result = await gateway(draft, {
    budget: UNCAPPED,
    facts: ONE_PRICEY_THREE_AFFORDABLE,
    saved,
  }).resolveDecision({
    draftId: draft.draftId,
    expectedRevision: draft.revision,
    intent: { type: "resolve_decision", subjectKey: GAP_KEY, action: "plan_recommendation" },
  })
  assert.equal(result.status, "saved")
  assert.equal(saved[0]!.decisions[0]!.recommendation?.productId, "pricey")

  let stageCalls = 0
  const completion = await gateway(
    saved[0]!,
    { budget: STRICT_5, facts: ONE_PRICEY_THREE_AFFORDABLE },
    completingPipeline(() => (stageCalls += 1)),
  ).complete({ draftId: draft.draftId, expectedRevision: saved[0]!.revision })

  assert.equal(completion.status, "ready_for_routine")
  assert.equal(stageCalls, 1)
})

test("B-INT-PRES: a chosen replacement outside the budget list stays valid at completion", async () => {
  const draft = gapDraft()
  const saved: Stage3ProductDraft[] = []
  await gateway(draft, {
    budget: UNCAPPED,
    facts: ONE_PRICEY_THREE_AFFORDABLE,
    saved,
  }).resolveDecision({
    draftId: draft.draftId,
    expectedRevision: draft.revision,
    intent: {
      type: "resolve_decision",
      subjectKey: GAP_KEY,
      action: "select_replacement",
      selectedCandidateId: "pricey",
      selectedCandidateFactFingerprint: "facts-pricey",
    },
  })
  const chosen = saved[0]!

  const strict = gateway(chosen, { budget: STRICT_5, facts: ONE_PRICEY_THREE_AFFORDABLE })
  const [review] = await strict.reviewDecisionBundles({ draftId: chosen.draftId })
  assert.deepEqual(
    review!.fitComparison.alternatives.map((candidate) => candidate.productId),
    ["pricey", "cheap-a", "cheap-b"],
  )

  let stageCalls = 0
  const completion = await gateway(
    chosen,
    { budget: STRICT_5, facts: ONE_PRICEY_THREE_AFFORDABLE },
    completingPipeline(() => (stageCalls += 1)),
  ).complete({ draftId: chosen.draftId, expectedRevision: chosen.revision })
  assert.equal(completion.status, "ready_for_routine")
  assert.equal(stageCalls, 1)
})

test("B-INT-PEND: a pending choice outside the budget list is preserved in the preview", async () => {
  const draft = gapDraft()
  const preview = await gateway(draft, {
    budget: STRICT_5,
    facts: ONE_PRICEY_THREE_AFFORDABLE,
  }).previewDecisionBundles({
    draftId: draft.draftId,
    expectedRevision: draft.revision,
    intents: [
      {
        type: "resolve_decision",
        subjectKey: GAP_KEY,
        action: "select_replacement",
        selectedCandidateId: "pricey",
        selectedCandidateFactFingerprint: "facts-pricey",
      },
    ],
  })

  assert.equal(preview.status, "ready")
  if (preview.status !== "ready") return
  assert.deepEqual(
    preview.bundles[0]!.fitComparison.alternatives.map((candidate) => candidate.productId),
    ["pricey", "cheap-a", "cheap-b"],
  )
  assert.equal(preview.bundles[0]!.fitComparison.defaultProductId, "pricey")
})

test("B-INT-PEND: the pending choice commits even though the budget list no longer shows it", async () => {
  const draft = gapDraft()
  const saved: Stage3ProductDraft[] = []
  const budgeted = gateway(draft, { budget: STRICT_5, facts: ONE_PRICEY_THREE_AFFORDABLE, saved })
  const [review] = await budgeted.reviewDecisionBundles({ draftId: draft.draftId })
  assert.equal(
    review!.fitComparison.alternatives.some((candidate) => candidate.productId === "pricey"),
    false,
  )

  const result = await budgeted.resolveDecisions({
    draftId: draft.draftId,
    expectedRevision: draft.revision,
    intents: [
      {
        type: "resolve_decision",
        subjectKey: GAP_KEY,
        action: "plan_recommendation",
        selectedCandidateId: "pricey",
      },
    ],
  })
  assert.equal(result.status, "saved")
  assert.equal(saved[0]!.decisions[0]!.recommendation?.productId, "pricey")
})

test("B-INT-PEND: a pending choice outside the fit ranking is still rejected", async () => {
  const draft = gapDraft()
  await assert.rejects(
    () =>
      gateway(draft, { budget: STRICT_5, facts: ONE_PRICEY_THREE_AFFORDABLE }).resolveDecisions({
        draftId: draft.draftId,
        expectedRevision: draft.revision,
        intents: [
          {
            type: "resolve_decision",
            subjectKey: GAP_KEY,
            action: "plan_recommendation",
            selectedCandidateId: "not-in-catalog",
          },
        ],
      }),
    (error: unknown) =>
      error instanceof Stage3AuthorityMutationError &&
      error.code === "stage3_authority_candidate_invalid",
  )
})

test("B-INT-MEMO: one review pass loads each subject's facts once", async () => {
  const draft = gapDraft()
  let factReads = 0
  const budgeted = createProductionStage3ProductsGateway({
    userId: "owner-a",
    shoppingBudgetEnabled: true,
    persistence: {
      ...persistence(draft, { budget: STRICT_5, facts: ONE_PRICEY_THREE_AFFORDABLE }),
      loadAuthorityFacts: async () => {
        factReads += 1
        return ONE_PRICEY_THREE_AFFORDABLE
      },
    },
  })
  await budgeted.reviewDecisionBundles({ draftId: draft.draftId })
  assert.equal(factReads, 1)
})

test("B-INT-OFF: flag off never reads the budget and leaves reviews price-neutral", async () => {
  const draft = gapDraft()
  let budgetReads = 0
  const off = gateway(draft, {
    enabled: false,
    budget: STRICT_5,
    facts: ONE_PRICEY_THREE_AFFORDABLE,
    onBudgetRead: () => (budgetReads += 1),
  })
  const [review] = await off.reviewDecisionBundles({ draftId: draft.draftId })
  await off.evaluateDecisions({ draftId: draft.draftId })

  assert.equal(await off.shoppingBudgetEnvelope({ draft }), null)
  assert.equal(budgetReads, 0)
  assert.equal(
    review!.authorityEvaluation.status === "known" &&
      review!.authorityEvaluation.recommendation?.productId,
    "pricey",
  )
  assert.deepEqual(
    review!.fitComparison.alternatives.map((candidate) => candidate.productId),
    ["pricey", "cheap-a", "cheap-b"],
  )
  assert.equal("defaultProductId" in review!.fitComparison, false)
  assert.equal("budgetNotice" in review!.fitComparison, false)
  assert.equal("budgetException" in review!.fitComparison, false)
  assert.deepEqual(
    review!.fitComparison.products.map((product) => Object.keys(product.presentation ?? {})),
    [
      ["priceLabel", "netContentLabel"],
      ["priceLabel", "netContentLabel"],
      ["priceLabel", "netContentLabel"],
    ],
  )
})

test("B-INT-ENV: flag on without a saved budget returns budget_required and skips reviews", async () => {
  const draft = gapDraft()
  const unbudgeted = gateway(draft, { budget: null, facts: ONE_PRICEY_THREE_AFFORDABLE })
  let reviewCalls = 0
  const response = await composeStage3BootstrapResponse({
    loaded: { status: draft.status, draft, requirements },
    reviewDecisionBundles: async (input) => {
      reviewCalls += 1
      return unbudgeted.reviewDecisionBundles(input)
    },
    shoppingBudgetEnvelope: (input) => unbudgeted.shoppingBudgetEnvelope(input),
  })

  assert.equal(reviewCalls, 0)
  assert.deepEqual(response.budget, { status: "budget_required", suggestion: null })
  assert.deepEqual(response.authorityEvaluations, [])
  assert.deepEqual(response.fitComparisons, [])
  const parsed = parseStage3BootstrapResponse(JSON.parse(JSON.stringify(response)), {
    personalPlanId: "plan-a",
    refinedVersionId: "refined-a",
  })
  assert.deepEqual(parsed.budget, { status: "budget_required", suggestion: null })
  assert.equal(parsed.status, "active")
})

test("B-INT-ENV: a saved budget is carried next to the unchanged review bundles", async () => {
  const draft = gapDraft()
  const budgeted = gateway(draft, { budget: STRICT_5, facts: ONE_PRICEY_THREE_AFFORDABLE })
  const response = await composeStage3BootstrapResponse({
    loaded: { status: draft.status, draft, requirements },
    reviewDecisionBundles: budgeted.reviewDecisionBundles.bind(budgeted),
    shoppingBudgetEnvelope: budgeted.shoppingBudgetEnvelope.bind(budgeted),
  })
  const bundlesOnly = await gateway(draft, {
    budget: STRICT_5,
    facts: ONE_PRICEY_THREE_AFFORDABLE,
  }).reviewDecisionBundles({ draftId: draft.draftId })

  assert.deepEqual(response.budget, { status: "saved", value: STRICT_5 })
  assert.equal(response.fitComparisons.length, 1)
  assert.deepEqual(
    response.authorityEvaluations,
    bundlesOnly.map((bundle) => bundle.authorityEvaluation),
  )
  const parsed = parseStage3BootstrapResponse(JSON.parse(JSON.stringify(response)), {
    personalPlanId: "plan-a",
    refinedVersionId: "refined-a",
  })
  assert.deepEqual(parsed.budget, { status: "saved", value: STRICT_5 })
})

test("B-INT-ENV: flag off or a capture-pass draft composes the bootstrap without budget state", async () => {
  const draft = gapDraft()
  const off = gateway(draft, {
    enabled: false,
    budget: STRICT_5,
    facts: ONE_PRICEY_THREE_AFFORDABLE,
  })
  const offResponse = await composeStage3BootstrapResponse({
    loaded: { status: draft.status, draft, requirements },
    reviewDecisionBundles: off.reviewDecisionBundles.bind(off),
    shoppingBudgetEnvelope: off.shoppingBudgetEnvelope.bind(off),
  })
  assert.equal("budget" in offResponse, false)
  assert.equal(offResponse.fitComparisons.length, 1)

  let gateCalls = 0
  const capture = { ...draft, pass: "product_capture" as const }
  const captureResponse = await composeStage3BootstrapResponse({
    loaded: { status: capture.status, draft: capture, requirements },
    shoppingBudgetEnvelope: async () => {
      gateCalls += 1
      return { status: "budget_required", suggestion: null }
    },
  })
  assert.equal(gateCalls, 0)
  assert.equal("budget" in captureResponse, false)
})

/* ------------------------------------------------------------ suggestion from owned products */

function draftOwning(
  owned: Array<{ productId: string | null; category: "shampoo" | "conditioner" | "mask" }>,
) {
  const draft = gapDraft()
  return {
    ...draft,
    products: owned.map((item, index) => ({
      capturedProductId: `capture-${index}`,
      userProductId: `owned-${index}`,
      identity: item.productId
        ? {
            kind: "catalog_product" as const,
            productId: item.productId,
            displayName: item.productId,
            category: item.category,
          }
        : {
            kind: "pending_submission" as const,
            submissionId: `submission-${index}`,
            displayName: `Unbekannt ${index}`,
            category: item.category,
            reviewStatus: "pending_review" as const,
          },
      frequencyRange: "weekly_2x" as const,
      ownership: "owned" as const,
      source: item.productId ? ("catalog_search" as const) : ("intake_fallback" as const),
    })),
  } as Stage3ProductDraft
}

const price = (productId: string, priceEur: number): Stage3CatalogPackagePrice => ({
  productId,
  priceEur,
  purchaseLinkStatus: "available",
})

async function suggestionFor(
  owned: Parameters<typeof draftOwning>[0],
  prices: Stage3CatalogPackagePrice[],
  onPriceRead?: (productIds: string[]) => void,
) {
  const draft = draftOwning(owned)
  return gateway(draft, {
    budget: null,
    facts: ONE_PRICEY_THREE_AFFORDABLE,
    prices,
    onPriceRead,
  }).shoppingBudgetEnvelope({ draft })
}

test("B-INT-SUG: owned products at 8/10/14 € suggest 15 € from one batched price read", async () => {
  const reads: string[][] = []
  const envelope = await suggestionFor(
    [
      { productId: "s", category: "shampoo" },
      { productId: "c", category: "conditioner" },
      { productId: "m", category: "mask" },
    ],
    [price("s", 8), price("c", 10), price("m", 14)],
    (ids) => reads.push(ids),
  )
  assert.deepEqual(envelope, { status: "budget_required", suggestion: 15 })
  assert.deepEqual(reads, [["s", "c", "m"]])
})

test("B-INT-SUG: a mixed 4/4/25 € set suggests nothing", async () => {
  assert.deepEqual(
    await suggestionFor(
      [
        { productId: "s", category: "shampoo" },
        { productId: "c", category: "conditioner" },
        { productId: "m", category: "mask" },
      ],
      [price("s", 4), price("c", 4), price("m", 25)],
    ),
    { status: "budget_required", suggestion: null },
  )
})

test("B-INT-SUG: an unknown product lowers price coverage below 80 % and suggests nothing", async () => {
  const owned = [
    { productId: "s", category: "shampoo" as const },
    { productId: "c", category: "conditioner" as const },
    { productId: "m", category: "mask" as const },
  ]
  const prices = [price("s", 3), price("c", 4), price("m", 5)]
  assert.deepEqual(await suggestionFor(owned, prices), {
    status: "budget_required",
    suggestion: 5,
  })
  assert.deepEqual(
    await suggestionFor([...owned, { productId: null, category: "shampoo" }], prices),
    { status: "budget_required", suggestion: null },
  )
  // An unbuyable link is unpriced as well.
  assert.deepEqual(
    await suggestionFor(owned, [
      price("s", 3),
      price("c", 4),
      { productId: "m", priceEur: 5, purchaseLinkStatus: "unavailable" },
    ]),
    { status: "budget_required", suggestion: null },
  )
})

/* ------------------------------------------------------------ portfolio rules across roles */

const CONDITIONER_KEY = GAP_KEY
const MASK_KEY = "decision:mask:intensive_conditioning_mask:gap"

function maskDecision(needTier: "basis" | "optional") {
  return {
    category: "mask" as const,
    resolution: "resolved" as const,
    needTier,
    roles: ["intensive_conditioning_mask" as const],
    target: {
      category: "mask" as const,
      roles: ["intensive_conditioning_mask"],
      needStrength: "standard",
      weight: "light",
      careDirection: "moisture",
      repairSupportLevel: "medium",
      functionalNeeds: [],
    },
    frequency: null,
    reasons: [],
    executionState: "available" as const,
    executionPauseReason: null,
    deferredFacts: [],
  }
}

/** Conditioner (basis) and mask gaps; the mask's need tier is configurable. */
function conditionerAndMaskDraft(maskTier: "basis" | "optional"): Stage3ProductDraft {
  const draft = gapDraft()
  const snapshot = draft.authoritySnapshot!
  return {
    ...draft,
    orderedCategories: ["conditioner", "mask"],
    authorityVersions: {
      ...draft.authorityVersions,
      mask: CATEGORY_ROLE_POLICIES.mask.authorityVersion,
    },
    uncoveredRoles: [
      ...draft.uncoveredRoles,
      { category: "mask", role: "intensive_conditioning_mask", reason: "no_product_owned" },
    ],
    authoritySnapshot: {
      ...snapshot,
      categoryDecisions: [...snapshot.categoryDecisions, maskDecision(maskTier) as never],
      orderedCategories: ["conditioner", "mask"],
    },
  }
}

function mask(
  productId: string,
  options: { priceEur: number; sortOrder: number; repairSupportLevel?: string },
) {
  return {
    productId,
    displayName: productId,
    category: "mask" as const,
    // Mask recommendations require a presentation image.
    presentationImageUrl: `https://example.test/${productId}.webp`,
    isActive: true,
    lifecycleStatus: "active",
    recommendable: true,
    suitableThicknesses: ["normal"],
    knownReaction: false,
    protocols: [
      {
        role: "intensive_conditioning_mask" as const,
        status: "verified_complete" as const,
        fingerprint: `protocol-${productId}`,
      },
    ],
    factFingerprint: `facts-${productId}`,
    catalogSortOrder: options.sortOrder,
    priceEur: options.priceEur,
    purchaseLinkStatus: "available" as const,
    currency: "EUR",
    spec: {
      weight: "light",
      careDirection: "moisture",
      repairSupportLevel: options.repairSupportLevel ?? "medium",
      functionalBenefits: [],
    },
  }
}

function maskFacts(candidates: ReturnType<typeof mask>[]): Stage3AuthorityFactBundle {
  return {
    productFacts: null,
    recommendationCandidates: candidates as never,
    heatCarrierCoverage: { carrierCategory: null, verifiedRoutes: [] },
  }
}

async function reviewsByKey(draft: Stage3ProductDraft, options: Parameters<typeof persistence>[1]) {
  const reviews = await gateway(draft, options).reviewDecisionBundles({ draftId: draft.draftId })
  return new Map(reviews.map((review) => [review.fitComparison.subjectKey, review.fitComparison]))
}

test("B-INT-GAP: an optional-tier category with nothing affordable is never a gap fill", async () => {
  const onlyPriceyMask = maskFacts([mask("mask-pricey", { priceEur: 30, sortOrder: 1 })])
  const catalog = (category: string) =>
    category === "mask" ? onlyPriceyMask : ONE_PRICEY_THREE_AFFORDABLE

  const optional = await reviewsByKey(conditionerAndMaskDraft("optional"), {
    budget: FLEX_5,
    facts: catalog,
  })
  assert.equal(optional.get(MASK_KEY)!.defaultProductId, null)
  assert.equal(optional.get(MASK_KEY)!.budgetException, null)
  assert.equal(optional.get(MASK_KEY)!.budgetNotice, null)
  assert.deepEqual(
    optional.get(MASK_KEY)!.alternatives.map((candidate) => candidate.productId),
    ["mask-pricey"],
  )
  // The equal-fit 20 € conditioner is no improvement, so the conditioner stays affordable.
  assert.equal(optional.get(CONDITIONER_KEY)!.defaultProductId, "cheap-a")

  const basis = await reviewsByKey(conditionerAndMaskDraft("basis"), {
    budget: FLEX_5,
    facts: catalog,
  })
  assert.equal(basis.get(MASK_KEY)!.defaultProductId, "mask-pricey")
  assert.deepEqual(basis.get(MASK_KEY)!.budgetException, { kind: "gap", improvedDimensionIds: [] })
  assert.equal(basis.get(MASK_KEY)!.budgetNotice, "flex_gap")
})

test("B-INT-GAP: an optional empty card does not use up the allowance of a required role", async () => {
  // Conditioner: a closer-weight 20 € option vs. a medium 4 € one → an ordinary improvement.
  const conditionerCatalog = facts([
    conditioner("light-pricey", { priceEur: 20, sortOrder: 1 }),
    conditioner("medium-cheap", { priceEur: 4, sortOrder: 2, weight: "medium" }),
  ])
  const onlyPriceyMask = maskFacts([mask("mask-pricey", { priceEur: 30, sortOrder: 1 })])
  const catalog = (category: string) => (category === "mask" ? onlyPriceyMask : conditionerCatalog)

  // Basis mask: the necessary gap takes the only slot (N = 2 → A = 1, G = 1 → 0 ordinary).
  const basis = await reviewsByKey(conditionerAndMaskDraft("basis"), {
    budget: FLEX_5,
    facts: catalog,
  })
  assert.equal(basis.get(CONDITIONER_KEY)!.defaultProductId, "medium-cheap")
  assert.equal(basis.get(CONDITIONER_KEY)!.budgetNotice, "allowance_used_elsewhere")

  // Optional mask: no gap, so the conditioner improvement gets the slot.
  const optional = await reviewsByKey(conditionerAndMaskDraft("optional"), {
    budget: FLEX_5,
    facts: catalog,
  })
  assert.equal(optional.get(CONDITIONER_KEY)!.defaultProductId, "light-pricey")
  assert.equal(optional.get(CONDITIONER_KEY)!.budgetNotice, "flex_improvement")
  assert.equal(optional.get(MASK_KEY)!.defaultProductId, null)
})

test("B-INT-CONCERN: a stated breakage main concern gives repair priority over a cheaper weight gain", async () => {
  // Conditioner: weight improvement for +4 €. Mask: repair improvement for +26 €. N = 2 → A = 1.
  const conditionerCatalog = facts([
    conditioner("light-pricey", { priceEur: 8, sortOrder: 1 }),
    conditioner("medium-cheap", { priceEur: 4, sortOrder: 2, weight: "medium" }),
  ])
  const maskCatalog = maskFacts([
    mask("repair-pricey", { priceEur: 30, sortOrder: 1 }),
    mask("low-repair-cheap", { priceEur: 4, sortOrder: 2, repairSupportLevel: "low" }),
  ])
  const catalog = (category: string) => (category === "mask" ? maskCatalog : conditionerCatalog)
  const draft = conditionerAndMaskDraft("basis")

  const withoutConcern = await reviewsByKey(draft, { budget: FLEX_5, facts: catalog })
  assert.equal(withoutConcern.get(CONDITIONER_KEY)!.defaultProductId, "light-pricey")
  assert.equal(withoutConcern.get(MASK_KEY)!.defaultProductId, "low-repair-cheap")

  const breakage = await reviewsByKey(draft, {
    budget: FLEX_5,
    facts: catalog,
    currentConcerns: ["breakage", "low_volume_or_weighed_down"],
    primaryConcern: "breakage",
  })
  assert.equal(breakage.get(MASK_KEY)!.defaultProductId, "repair-pricey")
  assert.deepEqual(breakage.get(MASK_KEY)!.budgetException, {
    kind: "improvement",
    improvedDimensionIds: ["mask.repair_support"],
  })
  assert.equal(breakage.get(CONDITIONER_KEY)!.defaultProductId, "medium-cheap")
  assert.equal(breakage.get(CONDITIONER_KEY)!.budgetNotice, "allowance_used_elsewhere")

  // A stale pick (not among the current concerns) is dropped: no statement, no priority.
  const stale = await reviewsByKey(draft, {
    budget: FLEX_5,
    facts: catalog,
    currentConcerns: ["dry_lengths", "tangling"],
    primaryConcern: "breakage",
  })
  assert.equal(stale.get(CONDITIONER_KEY)!.defaultProductId, "light-pricey")
})

/* ------------------------------------------------------------ budget required for new purchases */

const OWNED_KEY = "decision:conditioner:conditioner_rinse_out:capture-a"

/** The same conditioner role, covered by an owned on-target catalog product. */
function ownedDraft(): Stage3ProductDraft {
  return {
    ...gapDraft(),
    products: [
      {
        capturedProductId: "capture-a",
        userProductId: "owned-a",
        identity: {
          kind: "catalog_product",
          productId: "catalog-a",
          displayName: "Pflege",
          category: "conditioner",
        },
        frequencyRange: "weekly_2x",
        ownership: "owned",
        source: "catalog_search",
      },
    ],
    roleAssignments: [
      { capturedProductId: "capture-a", category: "conditioner", roles: ["conditioner_rinse_out"] },
    ],
    uncoveredRoles: [],
  } as Stage3ProductDraft
}

const isBudgetRequired = (error: unknown) =>
  error instanceof Stage3AuthorityMutationError && error.code === "budget_required"

test("B-INT-REQ: flag on without a budget rejects new-purchase resolutions and persists nothing", async () => {
  const draft = gapDraft()
  const saved: Stage3ProductDraft[] = []
  const unbudgeted = gateway(draft, { budget: null, facts: ONE_PRICEY_THREE_AFFORDABLE, saved })

  await assert.rejects(
    () =>
      unbudgeted.resolveDecision({
        draftId: draft.draftId,
        expectedRevision: draft.revision,
        intent: { type: "resolve_decision", subjectKey: GAP_KEY, action: "plan_recommendation" },
      }),
    isBudgetRequired,
  )
  await assert.rejects(
    () =>
      unbudgeted.resolveDecisions({
        draftId: draft.draftId,
        expectedRevision: draft.revision,
        intents: [
          {
            type: "resolve_decision",
            subjectKey: GAP_KEY,
            action: "select_replacement",
            selectedCandidateId: "cheap-a",
            selectedCandidateFactFingerprint: "facts-cheap-a",
          },
        ],
      }),
    isBudgetRequired,
  )
  assert.equal(saved.length, 0)
})

test("B-INT-REQ: the background recompute lane opts out and keeps the unknown-budget ranking", async () => {
  const draft = gapDraft()
  const saved: Stage3ProductDraft[] = []
  const recompute = gateway(
    draft,
    { budget: null, facts: ONE_PRICEY_THREE_AFFORDABLE, saved },
    { requireBudgetForNewPurchases: false },
  )

  await recompute.resolveDecision({
    draftId: draft.draftId,
    expectedRevision: draft.revision,
    intent: { type: "resolve_decision", subjectKey: GAP_KEY, action: "plan_recommendation" },
  })
  assert.equal(saved.length, 1)
})

test("B-INT-REQ: flag on without a budget still keeps an owned product", async () => {
  const draft = ownedDraft()
  const saved: Stage3ProductDraft[] = []
  const result = await gateway(draft, {
    budget: null,
    facts: {
      ...ONE_PRICEY_THREE_AFFORDABLE,
      productFacts: conditioner("catalog-a", { priceEur: 8, sortOrder: 0 }),
    },
    saved,
  }).resolveDecision({
    draftId: draft.draftId,
    expectedRevision: draft.revision,
    intent: { type: "resolve_decision", subjectKey: OWNED_KEY, action: "keep_owned" },
  })

  assert.equal(result.status, "saved")
  assert.equal(saved[0]!.decisions[0]!.choiceState, "owned_active")
})

test("B-INT-REQ: flag on without a budget refuses to complete a planned purchase", async () => {
  const draft = gapDraft()
  const saved: Stage3ProductDraft[] = []
  await gateway(draft, {
    budget: UNCAPPED,
    facts: ONE_PRICEY_THREE_AFFORDABLE,
    saved,
  }).resolveDecision({
    draftId: draft.draftId,
    expectedRevision: draft.revision,
    intent: { type: "resolve_decision", subjectKey: GAP_KEY, action: "plan_recommendation" },
  })
  const planned = saved[0]!

  let stageCalls = 0
  await assert.rejects(
    () =>
      gateway(
        planned,
        { budget: null, facts: ONE_PRICEY_THREE_AFFORDABLE },
        completingPipeline(() => (stageCalls += 1)),
      ).complete({ draftId: planned.draftId, expectedRevision: planned.revision }),
    isBudgetRequired,
  )
  assert.equal(stageCalls, 0)
})

test("B-INT-REQ: flag off resolves and completes a planned purchase without any budget", async () => {
  const draft = gapDraft()
  const saved: Stage3ProductDraft[] = []
  const result = await gateway(draft, {
    enabled: false,
    budget: null,
    facts: ONE_PRICEY_THREE_AFFORDABLE,
    saved,
  }).resolveDecision({
    draftId: draft.draftId,
    expectedRevision: draft.revision,
    intent: { type: "resolve_decision", subjectKey: GAP_KEY, action: "plan_recommendation" },
  })
  assert.equal(result.status, "saved")
  assert.equal(saved[0]!.decisions[0]!.recommendation?.productId, "pricey")

  let stageCalls = 0
  const completion = await gateway(
    saved[0]!,
    { enabled: false, budget: null, facts: ONE_PRICEY_THREE_AFFORDABLE },
    completingPipeline(() => (stageCalls += 1)),
  ).complete({ draftId: draft.draftId, expectedRevision: saved[0]!.revision })
  assert.equal(completion.status, "ready_for_routine")
  assert.equal(stageCalls, 1)
})

/* ------------------------------------------------------------ skipped roles are not purchases */

test("B-INT-SKIP: skipping an expensive mask frees the flexible slot for the conditioner improvement", async () => {
  const conditionerCatalog = facts([
    conditioner("light-pricey", { priceEur: 20, sortOrder: 1 }),
    conditioner("medium-cheap", { priceEur: 4, sortOrder: 2, weight: "medium" }),
  ])
  const onlyPriceyMask = maskFacts([mask("mask-pricey", { priceEur: 30, sortOrder: 1 })])
  const catalog = (category: string) => (category === "mask" ? onlyPriceyMask : conditionerCatalog)
  const draft = conditionerAndMaskDraft("basis")
  const skipMask = {
    type: "resolve_decision" as const,
    subjectKey: MASK_KEY,
    action: "leave_uncovered" as const,
  }

  // Pending skip: the preview already moves the slot to the conditioner.
  const preview = await gateway(draft, { budget: FLEX_5, facts: catalog }).previewDecisionBundles({
    draftId: draft.draftId,
    expectedRevision: draft.revision,
    intents: [skipMask],
  })
  assert.equal(preview.status, "ready")
  if (preview.status !== "ready") return
  const previewed = new Map(
    preview.bundles.map((bundle) => [bundle.fitComparison.subjectKey, bundle.fitComparison]),
  )
  assert.equal(previewed.get(CONDITIONER_KEY)!.defaultProductId, "light-pricey")
  assert.equal(previewed.get(CONDITIONER_KEY)!.budgetNotice, "flex_improvement")

  // Stored skip: never in N, no gap exception, no default.
  const saved: Stage3ProductDraft[] = []
  await gateway(draft, { budget: FLEX_5, facts: catalog, saved }).resolveDecision({
    draftId: draft.draftId,
    expectedRevision: draft.revision,
    intent: skipMask,
  })
  const skipped = await reviewsByKey(saved[0]!, { budget: FLEX_5, facts: catalog })
  assert.equal(skipped.get(CONDITIONER_KEY)!.defaultProductId, "light-pricey")
  assert.equal(skipped.get(CONDITIONER_KEY)!.budgetNotice, "flex_improvement")
  assert.equal(skipped.get(MASK_KEY)!.defaultProductId, null)
  assert.equal(skipped.get(MASK_KEY)!.budgetException, null)
  assert.equal(skipped.get(MASK_KEY)!.budgetNotice, null)
})

test("B-INT-SKIP: a skipped role keeps its price-neutral recommendation", async () => {
  const onlyPriceyMask = maskFacts([mask("mask-pricey", { priceEur: 30, sortOrder: 1 })])
  const catalog = (category: string) =>
    category === "mask" ? onlyPriceyMask : ONE_PRICEY_THREE_AFFORDABLE
  const draft = conditionerAndMaskDraft("basis")
  const saved: Stage3ProductDraft[] = []
  await gateway(draft, { budget: STRICT_5, facts: catalog, saved }).resolveDecision({
    draftId: draft.draftId,
    expectedRevision: draft.revision,
    intent: { type: "resolve_decision", subjectKey: MASK_KEY, action: "leave_uncovered" },
  })

  const reviews = await gateway(saved[0]!, {
    budget: STRICT_5,
    facts: catalog,
  }).reviewDecisionBundles({ draftId: draft.draftId })
  const maskReview = reviews.find((review) => review.fitComparison.subjectKey === MASK_KEY)!
  assert.equal(maskReview.authorityEvaluation.status, "known")
  if (maskReview.authorityEvaluation.status !== "known") return
  // A strict 5 € budget would drop the 30 € recommendation; a skipped role is not re-pointed.
  assert.equal(maskReview.authorityEvaluation.recommendation?.productId, "mask-pricey")
})

/* ------------------------------------------------- Bondbuilder trust pair (Nick, 2026-10-09) */

const BONDBUILDER_KEY = "decision:bondbuilder:specialized_bond_treatment:gap"
const STRICT_15: ShoppingBudget = { kind: "capped", limitEur: 15, allowExceptions: false }

/** Conditioner and Bondbuilder gaps (both basis tier). */
function conditionerAndBondbuilderDraft(): Stage3ProductDraft {
  const draft = gapDraft()
  const snapshot = draft.authoritySnapshot!
  return {
    ...draft,
    orderedCategories: ["conditioner", "bondbuilder"],
    authorityVersions: {
      ...draft.authorityVersions,
      bondbuilder: CATEGORY_ROLE_POLICIES.bondbuilder.authorityVersion,
    },
    uncoveredRoles: [
      ...draft.uncoveredRoles,
      { category: "bondbuilder", role: "specialized_bond_treatment", reason: "no_product_owned" },
    ],
    authoritySnapshot: {
      ...snapshot,
      categoryDecisions: [
        ...snapshot.categoryDecisions,
        {
          category: "bondbuilder",
          resolution: "resolved",
          needTier: "basis",
          roles: ["specialized_bond_treatment"],
          target: {
            category: "bondbuilder",
            roles: ["specialized_bond_treatment"],
            requiredFunction: "support_stressed_hair_resilience",
            mechanismTarget: "mechanism_neutral",
          },
          frequency: null,
          reasons: [],
          executionState: "available",
          executionPauseReason: null,
          deferredFacts: [],
        } as never,
      ],
      orderedCategories: ["conditioner", "bondbuilder"],
    },
  }
}

function bondbuilder(
  productId: string,
  options: { priceEur: number; sortOrder: number; trust: "high" | "medium" | "low" },
) {
  return {
    productId,
    displayName: productId,
    category: "bondbuilder" as const,
    presentationImageUrl: `https://example.test/${productId}.webp`,
    isActive: true,
    lifecycleStatus: "active",
    recommendable: true,
    suitableThicknesses: ["fine", "normal", "coarse"],
    knownReaction: false,
    protocols: [
      {
        role: "specialized_bond_treatment" as const,
        status: "verified_complete" as const,
        fingerprint: `protocol-${productId}`,
      },
    ],
    factFingerprint: `facts-${productId}`,
    catalogSortOrder: options.sortOrder,
    priceEur: options.priceEur,
    purchaseLinkStatus: "available" as const,
    currency: "EUR",
    spec: {
      applicationMode: "pre_shampoo",
      treatmentMode: "rinse_out",
      productFormat: "cream_treatment",
      usageProtocol: "olaplex_3plus",
      relationship: "standalone" as const,
      claimTrustLevel: options.trust,
    },
  }
}

// The production catalogue on 2026-10-09 (recommended + active), in catalogue order.
const K18_ID = BONDBUILDER_TIE_DEFAULT_PRODUCT_ID
const PRODUCTION_BONDBUILDERS: Stage3AuthorityFactBundle = {
  productFacts: null,
  recommendationCandidates: [
    bondbuilder("loreal-elvital-bond", { priceEur: 8.95, sortOrder: 1, trust: "medium" }),
    bondbuilder("ogx-sealing-serum", { priceEur: 18.68, sortOrder: 2, trust: "low" }),
    bondbuilder("redken-acidic-bonding", { priceEur: 25.5, sortOrder: 3, trust: "medium" }),
    bondbuilder("olaplex-3plus", { priceEur: 34, sortOrder: 4, trust: "high" }),
    bondbuilder("epres", { priceEur: 48, sortOrder: 5, trust: "high" }),
    bondbuilder("aveda", { priceEur: 52, sortOrder: 6, trust: "low" }),
    bondbuilder(K18_ID, { priceEur: 56.25, sortOrder: 7, trust: "high" }),
    bondbuilder("kerastase-premiere", { priceEur: 56.29, sortOrder: 8, trust: "medium" }),
  ] as never,
  heatCarrierCoverage: { carrierCategory: null, verifiedRoutes: [] },
}

const bondbuilderAndConditionerFacts = (category: string) =>
  category === "bondbuilder" ? PRODUCTION_BONDBUILDERS : ONE_PRICEY_THREE_AFFORDABLE

async function bondbuilderReview(budget: ShoppingBudget | null, enabled = true) {
  const draft = conditionerAndBondbuilderDraft()
  const reviews = await gateway(draft, {
    budget,
    enabled,
    facts: bondbuilderAndConditionerFacts,
  }).reviewDecisionBundles({ draftId: draft.draftId })
  const review = reviews.find((entry) => entry.fitComparison.subjectKey === BONDBUILDER_KEY)
  assert.ok(review)
  return review
}

test("B-INT-TRUST: Bis 15 € strict shows L'Oréal (default) next to the cheapest most trusted Olaplex", async () => {
  const review = await bondbuilderReview(STRICT_15)

  assert.equal(review.authorityEvaluation.status, "known")
  if (review.authorityEvaluation.status !== "known") return
  assert.equal(review.authorityEvaluation.recommendation?.productId, "loreal-elvital-bond")
  assert.equal(review.fitComparison.defaultProductId, "loreal-elvital-bond")
  assert.deepEqual(
    review.fitComparison.alternatives.map((candidate) => candidate.productId),
    ["loreal-elvital-bond", "olaplex-3plus", "epres"],
  )
  const olaplex = review.fitComparison.products.find(
    (product) => product.productId === "olaplex-3plus",
  )
  assert.equal(olaplex?.presentation?.overBudget, true)
  assert.equal(olaplex?.presentation?.labelKind, "alternative")
  assert.equal(review.fitComparison.budgetNotice, "strict_one_affordable")
  assert.equal(review.fitComparison.budgetException, null)
})

test("B-INT-TRUST: Bis 5 € strict preselects nothing, trust order with cheaper first per level", async () => {
  const review = await bondbuilderReview(STRICT_5)

  assert.equal(review.authorityEvaluation.status, "known")
  if (review.authorityEvaluation.status !== "known") return
  assert.equal(review.authorityEvaluation.recommendation, null)
  assert.equal(review.fitComparison.defaultProductId, null)
  assert.deepEqual(
    review.fitComparison.alternatives.map((candidate) => candidate.productId),
    ["olaplex-3plus", "epres", K18_ID],
  )
  assert.equal(review.fitComparison.budgetNotice, "strict_none_affordable")
})

test("B-INT-TRUST: uncapped and flag off both recommend K18 and rank by trust", async () => {
  for (const review of [await bondbuilderReview(UNCAPPED), await bondbuilderReview(null, false)]) {
    assert.equal(review.authorityEvaluation.status, "known")
    if (review.authorityEvaluation.status !== "known") return
    assert.equal(review.authorityEvaluation.recommendation?.productId, K18_ID)
    assert.deepEqual(
      review.fitComparison.alternatives.map((candidate) => candidate.productId),
      [K18_ID, "olaplex-3plus", "epres"],
    )
  }
})

/** The same catalogue before trust ranking: no trust levels. */
function untrustedBondbuilders(): Stage3AuthorityFactBundle {
  return {
    ...PRODUCTION_BONDBUILDERS,
    recommendationCandidates: (
      PRODUCTION_BONDBUILDERS.recommendationCandidates as ReturnType<typeof bondbuilder>[]
    ).map((candidate) => ({
      ...candidate,
      spec: { ...candidate.spec, claimTrustLevel: null },
    })) as never,
  }
}

function withChangedFingerprint(
  bundle: Stage3AuthorityFactBundle,
  productId: string,
): Stage3AuthorityFactBundle {
  return {
    ...bundle,
    recommendationCandidates: (
      bundle.recommendationCandidates as ReturnType<typeof bondbuilder>[]
    ).map((candidate) =>
      candidate.productId === productId
        ? { ...candidate, factFingerprint: `${candidate.factFingerprint}-v2` }
        : candidate,
    ) as never,
  }
}

/** Budget off: the person picked OGX while it was still on the (pre-trust) shortlist. */
async function storedOgxChoice() {
  const draft = conditionerAndBondbuilderDraft()
  const saved: Stage3ProductDraft[] = []
  const beforeTrust = (category: string) =>
    category === "bondbuilder" ? untrustedBondbuilders() : ONE_PRICEY_THREE_AFFORDABLE
  const [shown] = (
    await gateway(draft, {
      budget: null,
      enabled: false,
      facts: beforeTrust,
    }).reviewDecisionBundles({ draftId: draft.draftId })
  ).filter((review) => review.fitComparison.subjectKey === BONDBUILDER_KEY)
  assert.ok(
    shown!.fitComparison.alternatives.some((item) => item.productId === "ogx-sealing-serum"),
  )
  const result = await gateway(draft, {
    budget: null,
    enabled: false,
    facts: beforeTrust,
    saved,
  }).resolveDecisions({
    draftId: draft.draftId,
    expectedRevision: draft.revision,
    intents: [
      { type: "resolve_decision", subjectKey: GAP_KEY, action: "plan_recommendation" },
      {
        type: "resolve_decision",
        subjectKey: BONDBUILDER_KEY,
        action: "select_replacement",
        selectedCandidateId: "ogx-sealing-serum",
        selectedCandidateFactFingerprint: "facts-ogx-sealing-serum",
      },
    ],
  })
  assert.equal(result.status, "saved")
  return saved.at(-1)!
}

async function completeWith(
  draft: Stage3ProductDraft,
  bondbuilderFacts: Stage3AuthorityFactBundle,
) {
  let stageCalls = 0
  const completion = await gateway(
    draft,
    {
      budget: null,
      enabled: false,
      facts: (category) =>
        category === "bondbuilder" ? bondbuilderFacts : ONE_PRICEY_THREE_AFFORDABLE,
    },
    completingPipeline(() => (stageCalls += 1)),
  ).complete({ draftId: draft.draftId, expectedRevision: draft.revision })
  return { status: completion.status, stageCalls }
}

test("B-INT-TRUST-STORED: a stored replacement pushed off the shortlist by trust ranking still completes", async () => {
  const chosen = await storedOgxChoice()
  // With trust ranking OGX (low trust) would fall off the three-item shortlist; as the stored
  // choice it keeps the last slot so the review card still shows what the person picked …
  const [review] = (
    await gateway(chosen, {
      budget: null,
      enabled: false,
      facts: bondbuilderAndConditionerFacts,
    }).reviewDecisionBundles({ draftId: chosen.draftId })
  ).filter((entry) => entry.fitComparison.subjectKey === BONDBUILDER_KEY)
  assert.equal(review!.fitComparison.alternatives.length, 3)
  assert.equal(review!.fitComparison.alternatives.at(-1)?.productId, "ogx-sealing-serum")
  // … and the unchanged, still eligible stored choice stays completion-current.
  assert.deepEqual(await completeWith(chosen, PRODUCTION_BONDBUILDERS), {
    status: "ready_for_routine",
    stageCalls: 1,
  })
})

test("B-INT-TRUST-STORED: a stored replacement with changed facts is no longer current", async () => {
  const chosen = await storedOgxChoice()
  const result = await completeWith(
    chosen,
    withChangedFingerprint(PRODUCTION_BONDBUILDERS, "ogx-sealing-serum"),
  )
  assert.equal(result.status, "not_ready")
  assert.equal(result.stageCalls, 0)
})
