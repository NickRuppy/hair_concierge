import assert from "node:assert/strict"
import test from "node:test"

import { createAcceptIdealPlanRouteHandler } from "../src/app/api/personal-plan/accept-ideal-plan/route"
import { STAGE1_STAGE2_LAB_ENVELOPE } from "../src/app/labs/personal-plan-stage-1-2/fixture"
import { computeNeedPlan } from "../src/lib/personal-plan/compute-stage1"
import { deriveStage2TriggerContext } from "../src/lib/personal-plan/refinement/stage1-adapter"
import {
  acceptIdealPlan,
  DirectAcceptanceError,
  type AcceptIdealPlanDeps,
} from "../src/lib/personal-plan/direct-acceptance/accept"
import type { Stage2PersistedDraft } from "../src/lib/personal-plan/persistence/stage2-refinement-service"
import { CATEGORY_ROLE_POLICIES } from "../src/lib/personal-plan/products/authorities"
import type { Stage3AuthorityFactBundle } from "../src/lib/personal-plan/products/authority/catalog-facts"
import type {
  Stage3CategoryRequirement,
  Stage3ProductDraft,
} from "../src/lib/personal-plan/products/contracts"
import {
  createProductionStage3ProductsGateway,
  type Stage3ProductionPersistence,
} from "../src/lib/personal-plan/products/production-persistence-gateway"
import { createProposedProductPortfolio } from "../src/lib/personal-plan/products/portfolio"
import {
  addCapturedProduct,
  assignProductRoles,
  completeCaptureCategory,
  createStage3Draft,
} from "../src/lib/personal-plan/products/state-machine"
import type { ShoppingBudget } from "../src/lib/user-facts/schema"

/*
 * Journey 5 on the server (Task 5): with the shopping-budget gate on, direct acceptance refuses
 * with `budget_required` BEFORE any write, and with a saved budget the planned purchase is the
 * budget-allocated default — through the real Stage-3 gateway, not a fake.
 */

const USER_ID = "owner-a"
const GAP_KEY = "decision:conditioner:conditioner_rinse_out:gap"
const STRICT_5: ShoppingBudget = { kind: "capped", limitEur: 5, allowExceptions: false }

const requirements: Stage3CategoryRequirement[] = [
  {
    category: "conditioner",
    requiredRoles: ["conditioner_rinse_out"],
    needSummary: "Pflege",
    authorityVersion: CATEGORY_ROLE_POLICIES.conditioner.authorityVersion,
  },
]

/* ---------------------------------------------------------------- budget_required gate */

type Recorded = {
  refinementLoads: number
  refinementSaves: number
  budgetReads: number
  stage3Calls: string[]
}

function labTriggerContext() {
  const initial = computeNeedPlan({
    rawEnvelope: STAGE1_STAGE2_LAB_ENVELOPE,
    artifactId: "11111111-1111-4111-8111-111111111111",
    projection: "initial_quiz",
    computationVersion: "stage1-v1",
    createdAt: "2026-08-16T09:00:00.000Z",
  })
  assert.equal(initial.status, "ready")
  if (initial.status !== "ready") throw new Error("unreachable")
  return deriveStage2TriggerContext(initial.snapshot)
}

/** A fresh, untouched Stage-2 draft, as `loadOrCreate` returns it on a first accept. */
function untouchedDraft(): Stage2PersistedDraft {
  return {
    ...completedRefinementDraft(),
    triggerContext: labTriggerContext(),
    answers: {} as never,
    completedQuestionIds: [],
    revision: 1,
    status: "in_progress",
    refinedVersionId: null,
    directAcceptanceOwned: false,
  }
}

function gateDeps(options: {
  enabled?: boolean
  budget?: ShoppingBudget | null
  withLoader?: boolean
  recorded: Recorded
  activeRoutineVersionId?: string | null
  unrefinedDirectAccept?: boolean
  draft?: Stage2PersistedDraft
}): AcceptIdealPlanDeps {
  const { recorded } = options
  const stage3 = (name: string) => async () => {
    recorded.stage3Calls.push(name)
    throw new Error(`unexpected stage3 ${name}`)
  }
  return {
    userId: USER_ID,
    flags: {
      stage2Enabled: true,
      stage3Enabled: true,
      stage4Enabled: true,
      ...(options.enabled !== undefined ? { shoppingBudgetEnabled: options.enabled } : {}),
    },
    ...(options.withLoader === false
      ? {}
      : {
          loadShoppingBudget: async () => {
            recorded.budgetReads += 1
            return options.budget ?? null
          },
        }),
    refinementPersistence: {
      loadOrCreate: async () => {
        recorded.refinementLoads += 1
        return options.draft ?? untouchedDraft()
      },
      save: async () => {
        recorded.refinementSaves += 1
        throw new Error("stop after the gate")
      },
    } as never,
    loadKnownCareAnswers: async () => ({ answers: {}, questionIds: [] }),
    planState: {
      loadActiveRoutineVersionId: async () => options.activeRoutineVersionId ?? null,
      isUnrefinedDirectAccept: async () => options.unrefinedDirectAccept === true,
    },
    stage3Gateway: {
      loadOrCreate: stage3("loadOrCreate"),
      evaluateDecisions: stage3("evaluateDecisions"),
      resolveDecisions: stage3("resolveDecisions"),
      complete: stage3("complete"),
    } as never,
  }
}

const freshRecorded = (): Recorded => ({
  refinementLoads: 0,
  refinementSaves: 0,
  budgetReads: 0,
  stage3Calls: [],
})

test("J5-GATE: flag on without a saved budget refuses with budget_required before any write", async () => {
  for (const roleSelection of ["seen", "server_recommended"] as const) {
    const recorded = freshRecorded()
    await assert.rejects(
      acceptIdealPlan(gateDeps({ enabled: true, budget: null, recorded }), {
        seenRoles: [],
        roleSelection,
      }),
      (error: unknown) =>
        error instanceof DirectAcceptanceError && error.code === "budget_required",
    )
    // The draft is only read (to find the plan): no answers saved, Stage 3 untouched.
    assert.deepEqual(recorded, { ...freshRecorded(), refinementLoads: 1, budgetReads: 1 })
  }
})

test("J5-GATE: an already-accepted plan wins over a missing budget — never asked for one", async () => {
  const recorded = freshRecorded()
  await assert.rejects(
    acceptIdealPlan(
      gateDeps({ enabled: true, budget: null, recorded, activeRoutineVersionId: "routine-1" }),
      { seenRoles: [] },
    ),
    (error: unknown) =>
      error instanceof DirectAcceptanceError && error.code === "plan_already_accepted",
  )
  assert.equal(recorded.budgetReads, 0)
  assert.equal(recorded.refinementSaves, 0)
  assert.deepEqual(recorded.stage3Calls, [])
})

test("J5-GATE: the idempotent double-accept replay is accepted already and skips the budget", async () => {
  const recorded = freshRecorded()
  await assert.rejects(
    acceptIdealPlan(
      gateDeps({
        enabled: true,
        budget: null,
        recorded,
        activeRoutineVersionId: "routine-1",
        unrefinedDirectAccept: true,
        draft: completedRefinementDraft(),
      }),
      { seenRoles: [] },
    ),
    // Past every guard: the replay goes on into Stage 3 (unwired here).
    /unexpected stage3 loadOrCreate/,
  )
  assert.equal(recorded.budgetReads, 0)
})

test("J5-GATE: a saved budget passes the gate (the chain continues into Stage 2)", async () => {
  const recorded = freshRecorded()
  await assert.rejects(
    acceptIdealPlan(gateDeps({ enabled: true, budget: STRICT_5, recorded }), { seenRoles: [] }),
    /stop after the gate/,
  )
  assert.equal(recorded.budgetReads, 1)
  assert.equal(recorded.refinementSaves, 1)
})

test("J5-GATE: flag off never reads the budget — pre-budget behaviour", async () => {
  for (const enabled of [false, undefined]) {
    const recorded = freshRecorded()
    await assert.rejects(
      acceptIdealPlan(gateDeps({ enabled, budget: null, recorded }), { seenRoles: [] }),
      /stop after the gate/,
    )
    assert.equal(recorded.budgetReads, 0)
    assert.equal(recorded.refinementSaves, 1)
  }
})

test("J5-GATE: flag on without a wired loader is a wiring error, never an accept", async () => {
  const recorded = freshRecorded()
  await assert.rejects(
    acceptIdealPlan(gateDeps({ enabled: true, withLoader: false, recorded }), { seenRoles: [] }),
    (error: unknown) =>
      error instanceof Error &&
      !(error instanceof DirectAcceptanceError) &&
      error.message === "direct_accept_shopping_budget_loader_missing",
  )
  assert.equal(recorded.refinementSaves, 0)
  assert.deepEqual(recorded.stage3Calls, [])
})

test("J5-ROUTE: the accept route answers budget_required as 409", async () => {
  const route = createAcceptIdealPlanRouteHandler({
    enabled: () => true,
    getUserId: async () => USER_ID,
    loadJourneyAccess: async () =>
      ({
        kind: "personal_plan",
        frontier: "stage2",
        allowed: { stage1: true, stage2: true, stage3: false, stage4: false, stage5: false },
        nextHref: "/plan-start",
        personalPlanId: "plan-a",
      }) as never,
    checkRateLimit: (async () => ({ allowed: true })) as never,
    accept: async () => {
      throw new DirectAcceptanceError("budget_required")
    },
  })
  const response = await route(
    new Request("https://example.com/api/personal-plan/accept-ideal-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seenRoles: [] }),
    }),
  )
  assert.equal(response.status, 409)
  assert.deepEqual(await response.json(), { error: "budget_required" })
})

/* ---------------------------------------------------------------- real gateway, saved budget */

function gapDraft(): Stage3ProductDraft {
  const initial = createStage3Draft({
    draftId: "draft-budget",
    userId: USER_ID,
    personalPlanId: "plan-a",
    refinedVersionId: "refined-a",
    requirements,
    now: "2026-10-09T00:00:00.000Z",
  })
  // Same construction as the Stage-3 budget gateway suite: capture one product, finish the
  // category (→ decision pass), then strip it so the role is an empty slot.
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
      refinedNeedVersionId: "refined-a",
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

function conditioner(productId: string, priceEur: number, sortOrder: number) {
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
    catalogSortOrder: sortOrder,
    priceEur,
    purchaseLinkStatus: "available" as const,
    currency: "EUR",
    spec: {
      thickness: "normal",
      proteinMoistureBalance: "moisture",
      weight: "light",
      repairSupportLevel: "medium",
      balanceDirection: "moisture",
      targetFit: "matched" as const,
    },
  }
}

/** Fit order: the 20 € conditioner first, then an equally fitting 4 € one. */
const CATALOG: Stage3AuthorityFactBundle = {
  productFacts: null,
  recommendationCandidates: [conditioner("pricey", 20, 1), conditioner("cheap", 4, 2)],
  heatCarrierCoverage: { carrierCategory: null, verifiedRoutes: [] },
}

function stage3Persistence(
  budget: ShoppingBudget | null,
  saved: Stage3ProductDraft[],
): Stage3ProductionPersistence {
  let draft = gapDraft()
  return {
    loadOrCreate: async () => ({ draft, requirements }),
    save: async (input) => {
      saved.push(input.draft)
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
    loadRequirements: async () => requirements,
    loadCompletedPortfolio: async () =>
      createProposedProductPortfolio({ ...draft, status: "active" }, requirements, {
        portfolioVersionId: "portfolio-a",
        createdAt: "2026-10-09T00:01:00.000Z",
      }),
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
    loadCurrentRefinedVersionId: async () => "refined-a",
    loadAuthorityFacts: async () => CATALOG,
    loadDraft: async (input) => (input.userId === USER_ID ? draft : null),
    loadShoppingContext: async () => ({ budget, currentConcerns: [], primaryConcern: null }),
    loadCatalogPackagePrices: async () => [],
  }
}

/** A complete direct-acceptance-owned Stage-2 draft: completion short-circuits to its version. */
function completedRefinementDraft(): Stage2PersistedDraft {
  return {
    id: "stage2-a",
    personalPlanId: "plan-a",
    baseInitialNeedVersionId: "need-a",
    schemaVersion: 1,
    preparedArtifactSourceId: "artifact-a",
    baseInputSnapshot: null,
    pathVersion: "v1",
    triggerContext: {} as never,
    answers: { washFrequency: "weekly_2x" } as never,
    completedQuestionIds: ["wash_frequency"] as never,
    answerProvenance: {} as never,
    moduleProjections: {} as never,
    revision: 3,
    status: "complete",
    refinedVersionId: "refined-a",
    directAcceptanceOwned: true,
  }
}

function realGatewayDeps(
  budget: ShoppingBudget | null,
  saved: Stage3ProductDraft[],
  shoppingBudgetEnabled = true,
) {
  return {
    userId: USER_ID,
    flags: { stage2Enabled: true, stage3Enabled: true, stage4Enabled: true, shoppingBudgetEnabled },
    loadShoppingBudget: async () => budget,
    refinementPersistence: {
      loadOrCreate: async () => completedRefinementDraft(),
    } as never,
    loadKnownCareAnswers: async () => ({ answers: {}, questionIds: [] }),
    planState: {
      loadActiveRoutineVersionId: async () => null,
      isUnrefinedDirectAccept: async () => false,
    },
    stage3Gateway: createProductionStage3ProductsGateway({
      userId: USER_ID,
      shoppingBudgetEnabled,
      persistence: stage3Persistence(budget, saved),
    }),
  } satisfies AcceptIdealPlanDeps
}

test("J5-PERSIST control: with the gate off the same accept plans the price-neutral 20 € pick", async () => {
  const saved: Stage3ProductDraft[] = []
  await acceptIdealPlan(realGatewayDeps(STRICT_5, saved, false), {
    seenRoles: [{ decisionKey: GAP_KEY, productId: "pricey", factFingerprint: "facts-pricey" }],
  }).catch(() => {})
  const decision = saved.flatMap((draft) => draft.decisions).find((d) => d.decisionKey === GAP_KEY)
  assert.equal(decision?.recommendation?.productId, "pricey")
})

test("J5-PERSIST: with strict 5 € the persisted plan_recommendation is the allocated affordable default", async () => {
  // Price-neutral, the 20 € conditioner leads the fit order; the strict 5 € allocation makes
  // the equally fitting 4 € one the default, and THAT is what the accept plans.
  const saved: Stage3ProductDraft[] = []
  await acceptIdealPlan(realGatewayDeps(STRICT_5, saved), {
    seenRoles: [{ decisionKey: GAP_KEY, productId: "cheap", factFingerprint: "facts-cheap" }],
  }).catch(() => {
    // Completion needs the Stage-4 compiler this harness does not wire; the decision write
    // before it is what this test pins.
  })
  const planned = saved.flatMap((draft) => draft.decisions)
  assert.equal(planned.length > 0, true)
  const decision = planned.find((candidate) => candidate.decisionKey === GAP_KEY)
  assert.equal(decision?.choiceState, "planned_purchase")
  assert.equal(decision?.recommendation?.productId, "cheap")
  assert.equal(decision?.authorityEvidence?.recommendationFactFingerprint, "facts-cheap")
})

test("J5-PERSIST: a client that saw the price-neutral product is stale under the saved budget", async () => {
  const saved: Stage3ProductDraft[] = []
  await assert.rejects(
    acceptIdealPlan(realGatewayDeps(STRICT_5, saved), {
      seenRoles: [{ decisionKey: GAP_KEY, productId: "pricey", factFingerprint: "facts-pricey" }],
    }),
    (error: unknown) => error instanceof DirectAcceptanceError && error.code === "seen_state_stale",
  )
  assert.deepEqual(saved, [])
})

test("J5-PERSIST: server-recommended provisioning plans the allocated default too", async () => {
  const saved: Stage3ProductDraft[] = []
  await acceptIdealPlan(realGatewayDeps(STRICT_5, saved), {
    seenRoles: [],
    roleSelection: "server_recommended",
  }).catch(() => {})
  const decision = saved.flatMap((draft) => draft.decisions).find((d) => d.decisionKey === GAP_KEY)
  assert.equal(decision?.recommendation?.productId, "cheap")
})
