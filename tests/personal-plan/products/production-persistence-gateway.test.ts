import assert from "node:assert/strict"
import test from "node:test"

import { CATEGORY_ROLE_POLICIES } from "../../../src/lib/personal-plan/products/authorities"
import {
  createProductionStage3ProductsGateway,
  Stage3ProductionUnavailableError,
  type Stage3ProductionPersistence,
} from "../../../src/lib/personal-plan/products/production-persistence-gateway"
import {
  addCapturedProduct,
  assignProductRoles,
  completeCaptureCategory,
  createStage3Draft,
  recordProductDecision,
  replaceCaptureCategorySnapshot,
} from "../../../src/lib/personal-plan/products/state-machine"
import { createProposedProductPortfolio } from "../../../src/lib/personal-plan/products/portfolio"
import type {
  Stage3CategoryRequirement,
  Stage3ProductDraft,
} from "../../../src/lib/personal-plan/products/contracts"
import type { Stage3AuthorityFactBundle } from "../../../src/lib/personal-plan/products/authority/catalog-facts"
import { Stage3AuthoritySnapshotError } from "../../../src/lib/personal-plan/products/authority/snapshot"

const requirements: Stage3CategoryRequirement[] = [
  {
    category: "conditioner",
    requiredRoles: ["conditioner_rinse_out"],
    needSummary: "Pflege",
    authorityVersion: CATEGORY_ROLE_POLICIES.conditioner.authorityVersion,
  },
]

function readyDraft(): Stage3ProductDraft {
  const initial = createStage3Draft({
    draftId: "draft-a",
    userId: "owner-a",
    personalPlanId: "plan-a",
    refinedVersionId: "refined-a",
    requirements,
    now: "2026-08-08T00:00:00.000Z",
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
  const captureComplete = completeCaptureCategory(assigned, "conditioner", requirements)
  const decided = recordProductDecision(captureComplete, {
    decisionKey: "decision:conditioner:conditioner_rinse_out:capture-a",
    category: "conditioner",
    role: "conditioner_rinse_out",
    capturedProductId: "capture-a",
    verdict: "ideal",
    choiceState: "owned_active",
    criterionResults: [],
    recommendation: null,
    limitationAcknowledged: false,
  })
  return {
    ...decided,
    authoritySnapshot: {
      schemaVersion: 1,
      refinedNeedVersionId: decided.refinedVersionId,
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

function persistence(draft = readyDraft()): Stage3ProductionPersistence {
  return {
    loadOrCreate: async (input) => {
      assert.equal(input.userId, "owner-a")
      return { draft, requirements }
    },
    save: async (input) => ({ outcome: "saved", draft: input.draft }),
    search: async (input) => ({
      query: input.query,
      category: input.category,
      candidates: [],
      totalCapped: false,
    }),
    resolveOwnedCatalogProduct: async () => null,
    loadCurrentCatalogProduct: async (input) => {
      const product = draft.products.find(
        (candidate) =>
          candidate.userProductId === input.userProductId &&
          candidate.identity.kind === "catalog_product" &&
          candidate.identity.productId === input.productId &&
          candidate.identity.category === input.category,
      )
      if (!product || product.identity.kind !== "catalog_product") return null
      return {
        userProductId: product.userProductId,
        productId: product.identity.productId,
        displayName: product.identity.displayName,
        imageUrl: product.identity.imageUrl ?? null,
        category: product.identity.category,
      }
    },
    loadRequirements: async () => requirements,
    loadCompletedPortfolio: async () =>
      createProposedProductPortfolio(
        { ...draft, status: "active", pass: "ready_for_routine" },
        requirements,
        { portfolioVersionId: "portfolio-a", createdAt: "2026-08-08T00:01:00.000Z" },
      ),
    loadRefinedNeedSnapshot: async () =>
      ({
        inputHash: draft.authoritySnapshot?.refinedInputHash ?? "refined-input-a",
        profile: {
          source: { projection: "refined_post_plan" },
          hair: { thickness: "normal" },
        },
      }) as never,
    loadSourceRevision: async () => 7,
    loadCurrentRefinedVersionId: async () => draft.refinedVersionId,
    loadAuthorityFacts: async (input) =>
      input.subject.category === "conditioner"
        ? conditionerFacts()
        : {
            productFacts: null,
            recommendationCandidates: [],
            heatCarrierCoverage: { carrierCategory: null, verifiedRoutes: [] },
          },
    loadDraft: async (input) => (input.userId === "owner-a" ? draft : null),
  }
}

test("catalog capture replay is idempotent after the first save committed", async () => {
  const initial = createStage3Draft({
    draftId: "draft-catalog-replay",
    userId: "owner-a",
    personalPlanId: "plan-a",
    refinedVersionId: "refined-a",
    requirements,
    now: "2026-08-08T00:00:00.000Z",
  })
  let saves = 0
  const gateway = createProductionStage3ProductsGateway({
    userId: "owner-a",
    persistence: {
      ...persistence(initial),
      resolveOwnedCatalogProduct: async () => ({
        userProductId: "owned-replayed-catalog",
        productId: "catalog-replayed",
        displayName: "Replay Conditioner",
        category: "conditioner",
        imageUrl: null,
      }),
      save: async (input) => {
        saves += 1
        return { outcome: "saved", draft: input.draft }
      },
    },
  })

  await gateway.loadOrCreate({
    draftId: "server-derived",
    userId: "owner-a",
    personalPlanId: "plan-a",
    refinedVersionId: "refined-a",
    requirements: [],
  })
  const mutation = {
    type: "capture_catalog_candidate" as const,
    candidateId: "catalog-replayed",
    frequencyRange: "weekly_2x" as const,
  }
  const first = await gateway.mutate({
    draftId: initial.draftId,
    expectedRevision: initial.revision,
    mutation,
  })
  assert.equal(first.status, "saved")
  if (first.status !== "saved") return

  const replay = await gateway.mutate({
    draftId: initial.draftId,
    expectedRevision: first.draft.revision,
    mutation,
  })

  assert.equal(replay.status, "saved")
  if (replay.status !== "saved") return
  assert.equal(replay.draft.revision, first.draft.revision)
  assert.equal(replay.draft.products.length, 1)
  assert.equal(saves, 2)
})

test("atomic category replacement swaps the full category in one acknowledged revision", async () => {
  const base = authorityDraft()
  const initial: Stage3ProductDraft = {
    ...base,
    pass: "product_capture",
    categoryCursor: "conditioner",
    completedCaptureCategories: [],
  }
  let saves = 0
  const gateway = createProductionStage3ProductsGateway({
    userId: "owner-a",
    persistence: {
      ...persistence(initial),
      loadDraft: async () => initial,
      resolveOwnedCatalogProduct: async ({ candidateId, category }) => ({
        userProductId: `owned-${candidateId}`,
        productId: candidateId,
        displayName: "Canonical Conditioner",
        category,
        imageUrl: null,
      }),
      save: async (input) => {
        saves += 1
        return { outcome: "saved" as const, draft: input.draft }
      },
    },
  })
  await gateway.loadOrCreate({
    draftId: "server-derived",
    userId: "owner-a",
    personalPlanId: "plan-a",
    refinedVersionId: "refined-a",
    requirements: [],
  })

  const result = await gateway.mutate({
    draftId: initial.draftId,
    expectedRevision: initial.revision,
    mutation: {
      type: "replace_capture_category",
      category: "conditioner",
      refinedNeedVersionId: "refined-a",
      refinedInputHash: "refined-input-a",
      categoryAuthorityVersion: CATEGORY_ROLE_POLICIES.conditioner.authorityVersion,
      candidates: [
        {
          kind: "catalog",
          candidateId: "catalog-replaced",
          frequencyRange: "weekly_2x",
          roles: ["conditioner_rinse_out"],
        },
      ],
      uncoveredRoles: [],
    },
  })

  assert.equal(result.status, "saved")
  assert.equal(saves, 1)
  if (result.status !== "saved") return
  assert.equal(result.draft.revision, initial.revision + 1)
  assert.deepEqual(
    result.draft.products.map((product) =>
      product.identity.kind === "catalog_product" ? product.identity.productId : "pending",
    ),
    ["catalog-replaced"],
  )
  assert.deepEqual(result.draft.roleAssignments, [
    {
      capturedProductId: "owned-catalog-replaced",
      category: "conditioner",
      roles: ["conditioner_rinse_out"],
    },
  ])
})

test("atomic category replacement revalidates assessment readiness before saving", async () => {
  const base = authorityDraft()
  const initial: Stage3ProductDraft = {
    ...base,
    pass: "product_capture",
    categoryCursor: "conditioner",
    completedCaptureCategories: [],
  }
  let saves = 0
  const gateway = createProductionStage3ProductsGateway({
    userId: "owner-a",
    persistence: {
      ...persistence(initial),
      loadDraft: async () => initial,
      resolveOwnedCatalogProduct: async ({ candidateId, category }) => ({
        userProductId: `owned-${candidateId}`,
        productId: candidateId,
        displayName: "Conditioner ohne aktuelle Analyse",
        category,
        imageUrl: null,
      }),
      loadAuthorityFacts: async () => ({
        productFacts: null,
        recommendationCandidates: [],
        heatCarrierCoverage: { carrierCategory: null, verifiedRoutes: [] },
      }),
      save: async (input) => {
        saves += 1
        return { outcome: "saved" as const, draft: input.draft }
      },
    },
  })

  await assert.rejects(
    () =>
      gateway.mutate({
        draftId: initial.draftId,
        expectedRevision: initial.revision,
        mutation: {
          type: "replace_capture_category",
          category: "conditioner",
          refinedNeedVersionId: "refined-a",
          refinedInputHash: "refined-input-a",
          categoryAuthorityVersion: CATEGORY_ROLE_POLICIES.conditioner.authorityVersion,
          candidates: [
            {
              kind: "catalog",
              candidateId: "catalog-stale-readiness",
              frequencyRange: "weekly_2x",
              roles: ["conditioner_rinse_out"],
            },
          ],
          uncoveredRoles: [],
        },
      }),
    /stage3_authority_candidate_invalid/,
  )
  assert.equal(saves, 0)
})

test("atomic category replacement preserves an owner-bound pending product for later analysis", async () => {
  const base = authorityDraft()
  const initial: Stage3ProductDraft = {
    ...base,
    pass: "product_capture",
    categoryCursor: "conditioner",
    completedCaptureCategories: [],
  }
  let saves = 0
  const gateway = createProductionStage3ProductsGateway({
    userId: "owner-a",
    persistence: {
      ...persistence(initial),
      loadDraft: async () => initial,
      resolveOwnedPendingProduct: async ({ userProductId, submissionId, category }) => ({
        userProductId,
        submissionId,
        displayName: "Conditioner in Analyse",
        reviewStatus: "pending_review",
        category,
      }),
      save: async (input) => {
        saves += 1
        return { outcome: "saved" as const, draft: input.draft }
      },
    },
  })

  const result = await gateway.mutate({
    draftId: initial.draftId,
    expectedRevision: initial.revision,
    mutation: {
      type: "replace_capture_category",
      category: "conditioner",
      refinedNeedVersionId: "refined-a",
      refinedInputHash: "refined-input-a",
      categoryAuthorityVersion: CATEGORY_ROLE_POLICIES.conditioner.authorityVersion,
      candidates: [
        {
          kind: "pending",
          userProductId: "pending-owned-a",
          submissionId: "pending-submission-a",
          frequencyRange: "weekly_2x",
          roles: ["conditioner_rinse_out"],
        },
      ],
      uncoveredRoles: [],
    },
  })

  assert.equal(result.status, "saved")
  assert.equal(saves, 1)
  if (result.status !== "saved") return
  assert.equal(result.draft.products[0]?.identity.kind, "pending_submission")
})

test("canonical category snapshot replacement prunes stale decisions and finalizes capture once", () => {
  const base = readyDraft()
  const draft: Stage3ProductDraft = {
    ...base,
    pass: "product_capture",
    categoryCursor: "conditioner",
    completedCaptureCategories: [],
  }

  const replaced = replaceCaptureCategorySnapshot(
    draft,
    "conditioner",
    [
      {
        capturedProductId: "capture-replacement",
        userProductId: "owned-replacement",
        identity: {
          kind: "catalog_product",
          productId: "catalog-replacement",
          displayName: "Ersatzpflege",
          category: "conditioner",
        },
        frequencyRange: "weekly_2x",
        ownership: "owned",
        source: "catalog_search",
      },
    ],
    [
      {
        capturedProductId: "capture-replacement",
        category: "conditioner",
        roles: ["conditioner_rinse_out"],
      },
    ],
    [],
    requirements,
  )

  assert.equal(replaced.revision, draft.revision + 1)
  assert.equal(replaced.pass, "product_decisions")
  assert.equal(replaced.categoryCursor, null)
  assert.deepEqual(replaced.completedCaptureCategories, ["conditioner"])
  assert.deepEqual(
    replaced.products.map((product) => product.capturedProductId),
    ["capture-replacement"],
  )
  assert.deepEqual(replaced.roleAssignments, [
    {
      capturedProductId: "capture-replacement",
      category: "conditioner",
      roles: ["conditioner_rinse_out"],
    },
  ])
  assert.deepEqual(replaced.decisions, [])
  assert.deepEqual(replaced.completedDecisionKeys, [])
})

test("catalog capture replay retains the current-refined-source save guard", async () => {
  const initial = createStage3Draft({
    draftId: "draft-catalog-replay-stale",
    userId: "owner-a",
    personalPlanId: "plan-a",
    refinedVersionId: "refined-a",
    requirements,
    now: "2026-08-08T00:00:00.000Z",
  })
  let saves = 0
  const gateway = createProductionStage3ProductsGateway({
    userId: "owner-a",
    persistence: {
      ...persistence(initial),
      resolveOwnedCatalogProduct: async () => ({
        userProductId: "owned-replayed-catalog",
        productId: "catalog-replayed",
        displayName: "Replay Conditioner",
        category: "conditioner",
        imageUrl: null,
      }),
      save: async (input) => {
        saves += 1
        return saves === 1
          ? { outcome: "saved" as const, draft: input.draft }
          : { outcome: "stale_source" as const, draft: input.draft }
      },
    },
  })

  await gateway.loadOrCreate({
    draftId: "server-derived",
    userId: "owner-a",
    personalPlanId: "plan-a",
    refinedVersionId: "refined-a",
    requirements: [],
  })
  const mutation = {
    type: "capture_catalog_candidate" as const,
    candidateId: "catalog-replayed",
    frequencyRange: "weekly_2x" as const,
  }
  const first = await gateway.mutate({
    draftId: initial.draftId,
    expectedRevision: initial.revision,
    mutation,
  })
  assert.equal(first.status, "saved")
  if (first.status !== "saved") return

  await assert.rejects(
    gateway.mutate({
      draftId: initial.draftId,
      expectedRevision: first.draft.revision,
      mutation,
    }),
    (error: unknown) =>
      error instanceof Stage3AuthoritySnapshotError && error.code === "stale_refined_source",
  )
  assert.equal(saves, 2)
})

test("loadOrCreate CAS-repairs a persisted cursorless capture draft", async () => {
  const initial = createStage3Draft({
    draftId: "draft-stranded-capture",
    userId: "owner-a",
    personalPlanId: "plan-a",
    refinedVersionId: "refined-a",
    requirements,
    now: "2026-08-08T00:00:00.000Z",
  })
  const stranded: Stage3ProductDraft = {
    ...initial,
    pass: "product_capture",
    categoryCursor: null,
    completedCaptureCategories: ["conditioner"],
    uncoveredRoles: [
      {
        category: "conditioner",
        role: "conditioner_rinse_out",
        reason: "no_product_owned",
      },
    ],
  }
  let saves = 0
  const gateway = createProductionStage3ProductsGateway({
    userId: "owner-a",
    persistence: {
      ...persistence(stranded),
      save: async (input) => {
        saves += 1
        return { outcome: "saved", draft: input.draft }
      },
    },
  })

  const result = await gateway.loadOrCreate({
    draftId: "server-derived",
    userId: "owner-a",
    personalPlanId: "plan-a",
    refinedVersionId: "refined-a",
    requirements: [],
  })

  assert.equal(saves, 1)
  assert.equal(result.draft.pass, "product_decisions")
  assert.equal(result.draft.categoryCursor, null)
  assert.equal(result.draft.revision, stranded.revision + 1)
})

test("loadOrCreate propagates a refined-source restart without caching an obsolete draft", async () => {
  const gateway = createProductionStage3ProductsGateway({
    userId: "owner-a",
    persistence: {
      ...persistence(),
      loadOrCreate: async () => {
        throw new Stage3AuthoritySnapshotError("stale_refined_source")
      },
    },
  })

  await assert.rejects(
    () =>
      gateway.loadOrCreate({
        draftId: "server-derived",
        userId: "owner-a",
        personalPlanId: "plan-a",
        refinedVersionId: "refined-a",
        requirements: [],
      }),
    (error: unknown) =>
      error instanceof Stage3AuthoritySnapshotError && error.code === "stale_refined_source",
  )
})

function authorityDraft(): Stage3ProductDraft {
  const draft = readyDraft()
  return {
    ...draft,
    decisions: [],
    completedDecisionKeys: [],
    authoritySnapshot: {
      schemaVersion: 1,
      refinedNeedVersionId: draft.refinedVersionId,
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

test("catalog search derives assessment context from the signed owner draft", async () => {
  const draft = authorityDraft()
  const received: Array<Parameters<Stage3ProductionPersistence["search"]>[0]> = []
  const gateway = createProductionStage3ProductsGateway({
    userId: "owner-a",
    persistence: {
      ...persistence(draft),
      search: async (input) => {
        received.push(input)
        return { query: input.query, category: input.category, candidates: [], totalCapped: false }
      },
    },
  })

  await gateway.search({
    draftId: draft.draftId,
    category: "conditioner",
    query: "pflege",
    requestToken: 1,
  })

  assert.deepEqual(received[0]?.assessmentContext, {
    hairThickness: "normal",
    requiredRoles: ["conditioner_rinse_out"],
    shampooTargets: [],
    conditionerTarget: { thickness: "normal", careDirection: "moisture" },
  })
})

function pendingAuthorityDraft(): Stage3ProductDraft {
  const draft = authorityDraft()
  return {
    ...draft,
    products: draft.products.map((product) => ({
      ...product,
      identity: {
        kind: "pending_submission" as const,
        submissionId: "submission-pending-a",
        displayName: "Conditioner in Prüfung",
        category: "conditioner" as const,
        reviewStatus: "pending_review" as const,
      },
      source: "intake_fallback" as const,
    })),
  }
}

function conditionerFacts(): Stage3AuthorityFactBundle {
  return {
    productFacts: {
      productId: "catalog-a",
      displayName: "Pflege",
      category: "conditioner",
      isActive: true,
      lifecycleStatus: "active",
      recommendable: false,
      suitableThicknesses: ["normal"],
      knownReaction: false,
      protocols: [
        {
          role: "conditioner_rinse_out",
          status: "verified_complete",
          fingerprint: "protocol-a",
        },
      ],
      factFingerprint: "facts-a",
      spec: {
        thickness: "normal",
        proteinMoistureBalance: "balanced",
        weight: "light",
        repairSupportLevel: "medium",
        balanceDirection: "moisture",
      },
    },
    recommendationCandidates: [],
    heatCarrierCoverage: { carrierCategory: null, verifiedRoutes: [] },
  }
}

function recommendationGapDraft(): Stage3ProductDraft {
  const draft = authorityDraft()
  return {
    ...draft,
    products: [],
    roleAssignments: [],
    uncoveredRoles: [
      {
        category: "conditioner",
        role: "conditioner_rinse_out",
        reason: "no_product_owned",
      },
    ],
  }
}

function conditionerRecommendationFacts(): Stage3AuthorityFactBundle {
  const facts = conditionerFacts()
  return {
    ...facts,
    productFacts: null,
    recommendationCandidates: [
      { ...facts.productFacts!, recommendable: true, productId: "recommended-conditioner" },
    ],
  }
}

test("production completion without an injected compiler performs no stage write", async () => {
  let stageCalls = 0
  const gateway = createProductionStage3ProductsGateway({
    userId: "owner-a",
    persistence: persistence(),
    stager: {
      stage: async () => {
        stageCalls += 1
        throw new Error("must not run")
      },
    },
  })
  await assert.rejects(
    () => gateway.complete({ draftId: "draft-a", expectedRevision: 4 }),
    Stage3ProductionUnavailableError,
  )
  assert.equal(stageCalls, 0)
})

test("injected compiler reaches the atomic stager exactly once and reuses stable completion IDs", async () => {
  let stageCalls = 0
  let compilerInput: Record<string, unknown> | null = null
  const sourceReadOrder: string[] = []
  let releaseSnapshot!: () => void
  const snapshotPending = new Promise<void>((resolve) => {
    releaseSnapshot = resolve
  })
  let sourceRevisionStarted = false
  const gateway = createProductionStage3ProductsGateway({
    userId: "owner-a",
    persistence: {
      ...persistence(),
      loadRefinedNeedSnapshot: async () => {
        sourceReadOrder.push("snapshot")
        await snapshotPending
        return {
          inputHash: "refined-input-a",
          profile: {
            source: { projection: "refined_post_plan" },
            hair: { thickness: "normal" },
          },
          needs: [],
        } as never
      },
      loadSourceRevision: async () => {
        sourceRevisionStarted = true
        sourceReadOrder.push("source-revision")
        return 7
      },
    },
    compiler: {
      compile: async (input) => {
        sourceReadOrder.push("compile")
        compilerInput = input
        return {
          schemaVersion: 1,
          compilerVersion: "test",
          authorityVersions: {},
          sourceFingerprint: "source",
          payload: {},
          proposalDelta: {},
        }
      },
    },
    stager: {
      stage: async () => {
        stageCalls += 1
        return {
          status: "completed",
          portfolioVersionId: "portfolio-a",
          routineVersionId: "routine-a",
          routineProposalId: "proposal-a",
          revision: 5,
        }
      },
    },
  })
  const completionPending = gateway.complete({ draftId: "draft-a", expectedRevision: 4 })
  await new Promise((resolve) => setImmediate(resolve))
  const sourceReadsStartedTogether = sourceRevisionStarted
  releaseSnapshot()
  const result = await completionPending
  assert.equal(result.status, "ready_for_routine")
  if (result.status !== "ready_for_routine") return
  assert.equal(result.productPortfolioVersionId, "portfolio-a")
  assert.equal(result.routineProposalId, "proposal-a")
  assert.equal(stageCalls, 1)
  assert.ok(compilerInput)
  assert.equal((compilerInput as Record<string, unknown>).expectedSourceRevision, 7)
  assert.deepEqual((compilerInput as Record<string, unknown>).refinedNeedSnapshot, {
    inputHash: "refined-input-a",
    profile: {
      source: { projection: "refined_post_plan" },
      hair: { thickness: "normal" },
    },
    needs: [],
  })
  assert.equal(sourceReadsStartedTogether, true)
  assert.deepEqual(sourceReadOrder.slice(0, 2).sort(), ["snapshot", "source-revision"])
  assert.equal(sourceReadOrder[2], "compile")
})

test("completion rehydrates canonical catalog identity before freezing the portfolio", async () => {
  let portfolioSnapshot: Record<string, unknown> | null = null
  const gateway = createProductionStage3ProductsGateway({
    userId: "owner-a",
    persistence: {
      ...persistence(),
      loadCurrentCatalogProduct: async () => ({
        userProductId: "owned-a",
        productId: "catalog-a",
        displayName: "OGX Renewing + Argan Oil of Morocco Conditioner",
        imageUrl: "https://example.test/current.jpg",
        category: "conditioner" as const,
      }),
      loadAuthorityFacts: async () => conditionerFacts(),
    } as unknown as Stage3ProductionPersistence,
    compiler: {
      compile: async (input) => {
        portfolioSnapshot = input.portfolioSnapshot as Record<string, unknown>
        return {
          schemaVersion: 1,
          compilerVersion: "test",
          authorityVersions: {},
          sourceFingerprint: "source",
          payload: {},
          proposalDelta: {},
        }
      },
    },
    stager: {
      stage: async () => ({
        status: "completed",
        portfolioVersionId: "portfolio-current-identity",
        routineVersionId: "routine-current-identity",
        routineProposalId: null,
        revision: 5,
      }),
    },
  })

  const result = await gateway.complete({ draftId: "draft-a", expectedRevision: 4 })

  assert.equal(result.status, "ready_for_routine")
  const capturedPortfolio = portfolioSnapshot as unknown as Record<string, unknown> | null
  assert.ok(capturedPortfolio)
  const ownedProducts = capturedPortfolio.ownedProducts as Array<Record<string, unknown>>
  assert.equal(ownedProducts[0]?.displayName, "OGX Renewing + Argan Oil of Morocco Conditioner")
})

test("completion stops before compile when current authority can no longer assess an owned product", async () => {
  let compileCalls = 0
  let stageCalls = 0
  const gateway = createProductionStage3ProductsGateway({
    userId: "owner-a",
    persistence: {
      ...persistence(),
      loadCurrentCatalogProduct: async () => ({
        userProductId: "owned-a",
        productId: "catalog-a",
        displayName: "Current Conditioner",
        imageUrl: null,
        category: "conditioner" as const,
      }),
      loadAuthorityFacts: async () => ({
        productFacts: null,
        recommendationCandidates: [],
        heatCarrierCoverage: { carrierCategory: null, verifiedRoutes: [] },
      }),
    } as unknown as Stage3ProductionPersistence,
    compiler: {
      compile: async () => {
        compileCalls += 1
        throw new Error("compile must not run")
      },
    },
    stager: {
      stage: async () => {
        stageCalls += 1
        throw new Error("stage must not run")
      },
    },
  })

  const result = await gateway.complete({ draftId: "draft-a", expectedRevision: 4 })

  assert.equal(result.status, "not_ready")
  assert.equal(compileCalls, 0)
  assert.equal(stageCalls, 0)
})

test("a source change between compile and stage is a reloadable conflict without a completion result", async () => {
  let stagedSourceRevision: number | null = null
  const gateway = createProductionStage3ProductsGateway({
    userId: "owner-a",
    persistence: persistence(),
    compiler: {
      compile: async () => ({
        schemaVersion: 1,
        compilerVersion: "test",
        authorityVersions: {},
        sourceFingerprint: "source",
        payload: {},
        proposalDelta: {},
      }),
    },
    stager: {
      stage: async (input) => {
        stagedSourceRevision = input.expectedSourceRevision
        return { status: "source_revision_conflict", currentSourceRevision: 8 }
      },
    },
  })

  const result = await gateway.complete({ draftId: "draft-a", expectedRevision: 4 })
  assert.equal(stagedSourceRevision, 7)
  assert.equal(result.status, "conflict")
})

test("a refined-source change between compile and stage restarts Stage 3 instead of returning an obsolete conflict", async () => {
  let reloads = 0
  const gateway = createProductionStage3ProductsGateway({
    userId: "owner-a",
    persistence: {
      ...persistence(),
      loadDraft: async () => {
        reloads += 1
        return readyDraft()
      },
    },
    compiler: {
      compile: async () => ({
        schemaVersion: 1,
        compilerVersion: "test",
        authorityVersions: {},
        sourceFingerprint: "source",
        payload: {},
        proposalDelta: {},
      }),
    },
    stager: {
      stage: async () => ({
        status: "stale_source",
        currentRefinedNeedVersionId: "refined-new",
      }),
    },
  })

  await assert.rejects(
    () => gateway.complete({ draftId: "draft-a", expectedRevision: 4 }),
    (error: unknown) =>
      error instanceof Stage3AuthoritySnapshotError && error.code === "stale_refined_source",
  )
  assert.equal(reloads, 1)
})

test("lost-response completion replays the same atomic stager without creating a successor draft", async () => {
  const completed = {
    ...readyDraft(),
    status: "completed" as const,
    pass: "ready_for_routine" as const,
    revision: 5,
  }
  let loadOrCreateCalls = 0
  let stageCalls = 0
  const gateway = createProductionStage3ProductsGateway({
    userId: "owner-a",
    persistence: {
      ...persistence(completed),
      loadOrCreate: async () => {
        loadOrCreateCalls += 1
        throw new Error("completion replay must not create a successor draft")
      },
    },
    compiler: {
      compile: async () => ({
        schemaVersion: 1,
        compilerVersion: "test",
        authorityVersions: {},
        sourceFingerprint: "source",
        payload: {},
        proposalDelta: {},
      }),
    },
    stager: {
      stage: async () => {
        stageCalls += 1
        return {
          status: "already_completed",
          portfolioVersionId: "portfolio-a",
          routineVersionId: "routine-a",
          routineProposalId: "proposal-a",
          revision: 5,
        }
      },
    },
  })

  const result = await gateway.complete({ draftId: "draft-a", expectedRevision: 4 })
  assert.equal(result.status, "ready_for_routine")
  assert.equal(loadOrCreateCalls, 0)
  assert.equal(stageCalls, 1)
})

test("owner isolation is enforced by the injected persistence boundary", async () => {
  const gateway = createProductionStage3ProductsGateway({
    userId: "owner-b",
    persistence: persistence(),
  })
  await assert.rejects(
    () => gateway.complete({ draftId: "draft-a", expectedRevision: 4 }),
    /stage3_draft_not_found/,
  )
})

test("CAS conflicts return the persistence canonical draft without overwriting it", async () => {
  const canonical = readyDraft()
  const gateway = createProductionStage3ProductsGateway({
    userId: "owner-a",
    persistence: {
      ...persistence(canonical),
      save: async () => ({ outcome: "revision_conflict", draft: { ...canonical, revision: 9 } }),
    },
  })
  const result = await gateway.mutate({
    draftId: "draft-a",
    expectedRevision: 4,
    mutation: { type: "complete_capture_category", category: "conditioner" },
  })
  assert.equal(result.status, "conflict")
  if (result.status === "conflict") assert.equal(result.latestDraft.revision, 9)
})

test("a save rejected after the refined pointer moves restarts Stage 3 instead of surfacing an old draft", async () => {
  const staleDraft = readyDraft()
  let saves = 0
  const gateway = createProductionStage3ProductsGateway({
    userId: "owner-a",
    persistence: {
      ...persistence(staleDraft),
      // Simulates the SQL transaction seeing that the parent plan now points
      // at a newer refined need after this request loaded its old draft.
      save: async () => {
        saves += 1
        return { outcome: "stale_source", draft: staleDraft }
      },
    },
  })

  await assert.rejects(
    () =>
      gateway.mutate({
        draftId: staleDraft.draftId,
        expectedRevision: staleDraft.revision,
        mutation: { type: "complete_capture_category", category: "conditioner" },
      }),
    (error: unknown) =>
      error instanceof Stage3AuthoritySnapshotError && error.code === "stale_refined_source",
  )
  assert.equal(saves, 1)
})

test("production gateway persists complete category assignments atomically and rejects incomplete replacement", async () => {
  const shampooRequirements: Stage3CategoryRequirement[] = [
    {
      category: "shampoo",
      requiredRoles: ["shampoo_everyday"],
      needSummary: "Sanfte Reinigung",
      authorityVersion: CATEGORY_ROLE_POLICIES.shampoo.authorityVersion,
    },
  ]
  let shampooDraft = createStage3Draft({
    draftId: "draft-shampoo-atomic",
    userId: "owner-a",
    personalPlanId: "plan-a",
    refinedVersionId: "refined-a",
    requirements: shampooRequirements,
    now: "2026-08-08T00:00:00.000Z",
  })
  for (const id of ["shampoo-a", "shampoo-b"] as const) {
    shampooDraft = addCapturedProduct(shampooDraft, {
      capturedProductId: id,
      userProductId: `owned-${id}`,
      identity: {
        kind: "catalog_product",
        productId: `catalog-${id}`,
        displayName: id,
        category: "shampoo",
      },
      frequencyRange: "weekly_2x",
      ownership: "owned",
      source: "catalog_search",
    })
  }
  let saves = 0
  const atomicPersistence: Stage3ProductionPersistence = {
    ...persistence(),
    loadDraft: async () => shampooDraft,
    loadRequirements: async () => shampooRequirements,
    save: async (input) => {
      saves += 1
      return { outcome: "saved", draft: input.draft }
    },
  }
  const gateway = createProductionStage3ProductsGateway({
    userId: "owner-a",
    persistence: atomicPersistence,
  })
  const result = await gateway.mutate({
    draftId: shampooDraft.draftId,
    expectedRevision: shampooDraft.revision,
    mutation: {
      type: "replace_category_role_assignments",
      category: "shampoo",
      assignments: [
        {
          capturedProductId: "shampoo-b",
          category: "shampoo",
          roles: ["shampoo_everyday"],
        },
      ],
    },
  })

  assert.equal(result.status, "saved")
  assert.equal(saves, 1)
  if (result.status === "saved") {
    assert.deepEqual(result.draft.roleAssignments, [
      {
        capturedProductId: "shampoo-b",
        category: "shampoo",
        roles: ["shampoo_everyday"],
      },
    ])
  }

  let invalidSaves = 0
  const invalidGateway = createProductionStage3ProductsGateway({
    userId: "owner-a",
    persistence: {
      ...atomicPersistence,
      save: async (input) => {
        invalidSaves += 1
        return { outcome: "saved", draft: input.draft }
      },
    },
  })
  await assert.rejects(
    () =>
      invalidGateway.mutate({
        draftId: shampooDraft.draftId,
        expectedRevision: shampooDraft.revision,
        mutation: {
          type: "replace_category_role_assignments",
          category: "shampoo",
          assignments: [],
        },
      }),
    /required role shampoo_everyday is uncovered/,
  )
  assert.equal(invalidSaves, 0)
})

test("production gateway finalizes category assignments and gaps with one CAS save", async () => {
  const shampooRequirements: Stage3CategoryRequirement[] = [
    {
      category: "shampoo",
      requiredRoles: ["shampoo_everyday"],
      needSummary: "Sanfte Reinigung",
      authorityVersion: CATEGORY_ROLE_POLICIES.shampoo.authorityVersion,
    },
  ]
  const shampooDraft = createStage3Draft({
    draftId: "draft-shampoo-finalize",
    userId: "owner-a",
    personalPlanId: "plan-a",
    refinedVersionId: "refined-a",
    requirements: shampooRequirements,
    now: "2026-08-08T00:00:00.000Z",
  })
  let saves = 0
  const gateway = createProductionStage3ProductsGateway({
    userId: "owner-a",
    persistence: {
      ...persistence(),
      loadDraft: async () => shampooDraft,
      loadRequirements: async () => shampooRequirements,
      save: async (input) => {
        saves += 1
        return { outcome: "saved", draft: input.draft }
      },
    },
  })

  const result = await gateway.mutate({
    draftId: shampooDraft.draftId,
    expectedRevision: shampooDraft.revision,
    mutation: {
      type: "finalize_capture_category",
      category: "shampoo",
      assignments: [],
      uncoveredRoles: [
        { category: "shampoo", role: "shampoo_everyday", reason: "no_product_owned" },
      ],
    },
  })

  assert.equal(result.status, "saved")
  assert.equal(saves, 1)
  if (result.status === "saved") {
    assert.equal(result.draft.revision, shampooDraft.revision + 1)
    assert.deepEqual(result.draft.completedCaptureCategories, ["shampoo"])
    assert.deepEqual(result.draft.uncoveredRoles, [
      { category: "shampoo", role: "shampoo_everyday", reason: "no_product_owned" },
    ])
  }
})

test("semantic decision intent is evaluated and persisted as a server-authored decision", async () => {
  const draft = authorityDraft()
  const saved: Stage3ProductDraft[] = []
  const gateway = createProductionStage3ProductsGateway({
    userId: "owner-a",
    persistence: {
      ...persistence(draft),
      loadAuthorityFacts: async () => conditionerFacts(),
      save: async (input) => {
        saved.push(input.draft)
        return { outcome: "saved", draft: input.draft }
      },
    },
  })

  const result = await gateway.resolveDecision({
    draftId: draft.draftId,
    expectedRevision: draft.revision,
    intent: {
      type: "resolve_decision",
      subjectKey: "decision:conditioner:conditioner_rinse_out:capture-a",
      action: "keep_owned",
    },
  })

  assert.equal(result.status, "saved")
  assert.equal(saved[0]?.decisions[0]?.choiceState, "owned_active")
  assert.equal(saved[0]?.decisions[0]?.verdict, "ideal")
  assert.deepEqual(saved[0]?.decisions[0]?.authorityEvidence, {
    schemaVersion: 1,
    subjectKey: "decision:conditioner:conditioner_rinse_out:capture-a",
    refinedNeedVersionId: "refined-a",
    refinedInputHash: "refined-input-a",
    authorityVersion: CATEGORY_ROLE_POLICIES.conditioner.authorityVersion,
    productFactFingerprint: "facts-a",
    recommendationFactFingerprint: null,
    coverageRuleIds: [],
  })
})

test("semantic decision batch evaluates every subject and persists one CAS revision", async () => {
  const first = authorityDraft()
  const draft: Stage3ProductDraft = {
    ...first,
    products: [
      ...first.products,
      {
        ...first.products[0]!,
        capturedProductId: "capture-b",
        userProductId: "owned-b",
        identity: {
          kind: "catalog_product",
          productId: "catalog-b",
          displayName: "Pflege B",
          category: "conditioner",
        },
      },
    ],
    roleAssignments: [
      ...first.roleAssignments,
      {
        capturedProductId: "capture-b",
        category: "conditioner",
        roles: ["conditioner_rinse_out"],
      },
    ],
  }
  let saves = 0
  const gateway = createProductionStage3ProductsGateway({
    userId: "owner-a",
    persistence: {
      ...persistence(draft),
      loadAuthorityFacts: async () => conditionerFacts(),
      save: async (input) => {
        saves += 1
        return { outcome: "saved", draft: input.draft }
      },
    },
  })

  const result = await gateway.resolveDecisions({
    draftId: draft.draftId,
    expectedRevision: draft.revision,
    intents: [
      {
        type: "resolve_decision",
        subjectKey: "decision:conditioner:conditioner_rinse_out:capture-a",
        action: "keep_owned",
      },
      {
        type: "resolve_decision",
        subjectKey: "decision:conditioner:conditioner_rinse_out:capture-b",
        action: "keep_owned",
      },
    ],
  })

  assert.equal(result.status, "saved")
  assert.equal(saves, 1)
  if (result.status === "saved") {
    assert.equal(result.draft.revision, draft.revision + 1)
    assert.deepEqual(
      result.draft.decisions.map((decision) => decision.decisionKey),
      [
        "decision:conditioner:conditioner_rinse_out:capture-a",
        "decision:conditioner:conditioner_rinse_out:capture-b",
      ],
    )
  }
})

test("semantic decision batch rejects duplicate subjects without a partial write", async () => {
  const draft = authorityDraft()
  let saves = 0
  const gateway = createProductionStage3ProductsGateway({
    userId: "owner-a",
    persistence: {
      ...persistence(draft),
      loadAuthorityFacts: async () => conditionerFacts(),
      save: async (input) => {
        saves += 1
        return { outcome: "saved", draft: input.draft }
      },
    },
  })
  const intent = {
    type: "resolve_decision" as const,
    subjectKey: "decision:conditioner:conditioner_rinse_out:capture-a",
    action: "keep_owned" as const,
  }

  await assert.rejects(
    () =>
      gateway.resolveDecisions({
        draftId: draft.draftId,
        expectedRevision: draft.revision,
        intents: [intent, intent],
      }),
    /stage3_authority_subject_invalid/,
  )
  assert.equal(saves, 0)
})

test("one immutable refined context is shared across multiple owned-product evaluations", async () => {
  const first = authorityDraft()
  const draft: Stage3ProductDraft = {
    ...first,
    products: [
      ...first.products,
      {
        ...first.products[0]!,
        capturedProductId: "capture-b",
        userProductId: "owned-b",
        identity: {
          kind: "catalog_product",
          productId: "catalog-b",
          displayName: "Pflege B",
          category: "conditioner",
        },
      },
    ],
    roleAssignments: [
      ...first.roleAssignments,
      {
        capturedProductId: "capture-b",
        category: "conditioner",
        roles: ["conditioner_rinse_out"],
      },
    ],
  }
  let currentVersionReads = 0
  let refinedSnapshotReads = 0
  let saves = 0
  const seenContexts = new Set<unknown>()
  const gateway = createProductionStage3ProductsGateway({
    userId: "owner-a",
    persistence: {
      ...persistence(draft),
      loadCurrentRefinedVersionId: async () => {
        currentVersionReads += 1
        return draft.refinedVersionId
      },
      loadRefinedNeedSnapshot: async () => {
        refinedSnapshotReads += 1
        return {
          inputHash: "refined-input-a",
          profile: {
            source: { projection: "refined_post_plan" },
            hair: { thickness: "normal" },
          },
        } as never
      },
      loadAuthorityFacts: async (input) => {
        seenContexts.add(input.context)
        return conditionerFacts()
      },
      save: async (input) => {
        saves += 1
        return { outcome: "saved", draft: input.draft }
      },
    },
  })

  const evaluations = await gateway.evaluateDecisions({ draftId: draft.draftId })

  assert.equal(evaluations.length, 2)
  assert.equal(currentVersionReads, 1)
  assert.equal(refinedSnapshotReads, 1)
  assert.equal(seenContexts.size, 1)
  assert.equal(saves, 0)
})

test("a server-selected conditioner recommendation persists as a planned purchase", async () => {
  const draft = recommendationGapDraft()
  const saved: Stage3ProductDraft[] = []
  const gateway = createProductionStage3ProductsGateway({
    userId: "owner-a",
    persistence: {
      ...persistence(draft),
      loadAuthorityFacts: async () => conditionerRecommendationFacts(),
      save: async (input) => {
        saved.push(input.draft)
        return { outcome: "saved", draft: input.draft }
      },
    },
  })

  const result = await gateway.resolveDecision({
    draftId: draft.draftId,
    expectedRevision: draft.revision,
    intent: {
      type: "resolve_decision",
      subjectKey: "decision:conditioner:conditioner_rinse_out:gap",
      action: "plan_recommendation",
      selectedCandidateId: "recommended-conditioner",
    },
  })

  assert.equal(result.status, "saved")
  assert.equal(saved[0]?.decisions[0]?.choiceState, "planned_purchase")
  assert.equal(saved[0]?.decisions[0]?.recommendation?.productId, "recommended-conditioner")
  assert.equal(saved[0]?.decisions[0]?.authorityEvidence?.recommendationFactFingerprint, "facts-a")
})

test("pending authority decisions distinguish keep_pending from leave_uncovered", async () => {
  const pending = pendingAuthorityDraft()

  async function resolve(action: "keep_pending" | "leave_uncovered") {
    const gateway = createProductionStage3ProductsGateway({
      userId: "owner-a",
      persistence: persistence(pending),
    })
    const result = await gateway.resolveDecision({
      draftId: pending.draftId,
      expectedRevision: pending.revision,
      intent: {
        type: "resolve_decision",
        subjectKey: "decision:conditioner:conditioner_rinse_out:capture-a",
        action,
      },
    })
    assert.equal(result.status, "saved")
    if (result.status !== "saved") throw new Error("expected saved pending decision")
    return result.draft.decisions[0]!
  }

  const kept = await resolve("keep_pending")
  const skipped = await resolve("leave_uncovered")

  assert.equal(kept.choiceState, "pending_review")
  assert.equal(skipped.choiceState, "unassigned")
})

test("forged subjects, actions, candidates and stale sources fail closed before persistence", async () => {
  const draft = authorityDraft()
  let saves = 0
  const base = persistence(draft)
  const gateway = createProductionStage3ProductsGateway({
    userId: "owner-a",
    persistence: {
      ...base,
      loadAuthorityFacts: async () => conditionerFacts(),
      save: async (input) => {
        saves += 1
        return { outcome: "saved", draft: input.draft }
      },
    },
  })

  await assert.rejects(
    () =>
      gateway.resolveDecision({
        draftId: draft.draftId,
        expectedRevision: draft.revision,
        intent: { type: "resolve_decision", subjectKey: "forged", action: "keep_owned" },
      }),
    /stage3_authority_subject_invalid/,
  )
  await assert.rejects(
    () =>
      gateway.resolveDecision({
        draftId: draft.draftId,
        expectedRevision: draft.revision,
        intent: {
          type: "resolve_decision",
          subjectKey: "decision:conditioner:conditioner_rinse_out:capture-a",
          action: "plan_recommendation",
          selectedCandidateId: "forged",
        },
      }),
    /stage3_authority_action_invalid/,
  )

  const gap = recommendationGapDraft()
  const recommendationGateway = createProductionStage3ProductsGateway({
    userId: "owner-a",
    persistence: {
      ...persistence(gap),
      loadAuthorityFacts: async () => conditionerRecommendationFacts(),
    },
  })
  await assert.rejects(
    () =>
      recommendationGateway.resolveDecision({
        draftId: gap.draftId,
        expectedRevision: gap.revision,
        intent: {
          type: "resolve_decision",
          subjectKey: "decision:conditioner:conditioner_rinse_out:gap",
          action: "plan_recommendation",
          selectedCandidateId: "forged",
        },
      }),
    /stage3_authority_candidate_invalid/,
  )

  const conflict = await gateway.resolveDecision({
    draftId: draft.draftId,
    expectedRevision: draft.revision - 1,
    intent: {
      type: "resolve_decision",
      subjectKey: "decision:conditioner:conditioner_rinse_out:capture-a",
      action: "keep_owned",
    },
  })
  assert.equal(conflict.status, "conflict")

  const staleGateway = createProductionStage3ProductsGateway({
    userId: "owner-a",
    persistence: { ...base, loadCurrentRefinedVersionId: async () => "refined-new" },
  })
  await assert.rejects(
    () =>
      staleGateway.resolveDecision({
        draftId: draft.draftId,
        expectedRevision: draft.revision,
        intent: {
          type: "resolve_decision",
          subjectKey: "decision:conditioner:conditioner_rinse_out:capture-a",
          action: "keep_owned",
        },
      }),
    /stale_refined_source/,
  )

  const malformedRefinedGateway = createProductionStage3ProductsGateway({
    userId: "owner-a",
    persistence: {
      ...base,
      loadRefinedNeedSnapshot: async () =>
        ({
          inputHash: "refined-input-a",
          profile: { source: { projection: "refined_post_plan" }, hair: {} },
        }) as never,
    },
  })
  await assert.rejects(
    () =>
      malformedRefinedGateway.resolveDecision({
        draftId: draft.draftId,
        expectedRevision: draft.revision,
        intent: {
          type: "resolve_decision",
          subjectKey: "decision:conditioner:conditioner_rinse_out:capture-a",
          action: "keep_owned",
        },
      }),
    /stale_refined_source/,
  )
  assert.equal(saves, 0)
})

test("production authority rejects a client-authored stale product-load overlay before persistence", async () => {
  const draft = {
    ...authorityDraft(),
    productLoadResolution: {
      schemaVersion: 1,
      refinedNeedVersionId: "refined-a",
      refinedInputHash: "refined-input-a",
      capturedFrequencyFingerprint: "client-authored",
      authorityVersions: {},
      requirements: [],
      decisions: [],
      coverage: [],
    },
  } satisfies Stage3ProductDraft
  let saves = 0
  const gateway = createProductionStage3ProductsGateway({
    userId: "owner-a",
    persistence: {
      ...persistence(draft),
      loadAuthorityFacts: async () => conditionerFacts(),
      save: async (input) => {
        saves += 1
        return { outcome: "saved", draft: input.draft }
      },
    },
  })

  await assert.rejects(
    () =>
      gateway.resolveDecision({
        draftId: draft.draftId,
        expectedRevision: draft.revision,
        intent: {
          type: "resolve_decision",
          subjectKey: "decision:conditioner:conditioner_rinse_out:capture-a",
          action: "keep_owned",
        },
      }),
    /stale_product_load_resolution/,
  )
  assert.equal(saves, 0)
})

test("production authority evaluates a supplemental product-load subject appended after base order", async () => {
  const dryShampooRequirement: Stage3CategoryRequirement = {
    category: "dry_shampoo",
    requiredRoles: [],
    needSummary: "Aktuell verwendetes Trockenshampoo erfassen",
    authorityVersion: CATEGORY_ROLE_POLICIES.dry_shampoo.authorityVersion,
  }
  const initial: Stage3ProductDraft = {
    ...createStage3Draft({
      draftId: "draft-product-load-authority",
      userId: "owner-a",
      personalPlanId: "plan-a",
      refinedVersionId: "refined-a",
      requirements: [dryShampooRequirement],
      now: "2026-08-08T00:00:00.000Z",
    }),
    authoritySnapshot: {
      schemaVersion: 1,
      refinedNeedVersionId: "refined-a",
      refinedInputHash: "refined-input-a",
      productLoadContext: {
        schemaVersion: 1,
        scalpOiliness: "balanced" as const,
        deepCleansingScalpPause: false,
        hasLowVolumeOrWeighedDown: false,
        shampooFrequency: "weekly_2x" as const,
        oilPurposes: [],
      },
      categoryDecisions: [
        {
          category: "deep_cleansing_shampoo" as const,
          resolution: "resolved" as const,
          needTier: "not_needed" as const,
          roles: [],
          target: null,
          frequency: null,
          reasons: [],
          executionState: "available" as const,
          executionPauseReason: null,
          deferredFacts: [],
        },
      ],
      coverage: [],
      orderedCategories: ["dry_shampoo" as const],
      inventoryOnlyCategories: ["dry_shampoo" as const],
      authorityVersions: Object.fromEntries(
        Object.entries(CATEGORY_ROLE_POLICIES).map(([category, policy]) => [
          category,
          policy.authorityVersion,
        ]),
      ) as never,
    },
  }
  const captured = addCapturedProduct(initial, {
    capturedProductId: "dry-shampoo-current",
    userProductId: "owned-dry-shampoo-current",
    identity: {
      kind: "pending_submission",
      submissionId: "submission-dry-shampoo-current",
      displayName: "Trockenshampoo in Prüfung",
      category: "dry_shampoo",
      reviewStatus: "pending_review",
    },
    frequencyRange: "weekly_3_4x",
    ownership: "owned",
    source: "intake_fallback",
  })
  const draft = completeCaptureCategory(captured, "dry_shampoo", [dryShampooRequirement])
  assert.equal(draft.productLoadResolution?.requirements[0]?.category, "deep_cleansing_shampoo")

  const gateway = createProductionStage3ProductsGateway({
    userId: "owner-a",
    persistence: {
      ...persistence(draft),
      loadRequirements: async () => [dryShampooRequirement],
    },
  })

  const evaluations = await gateway.evaluateDecisions({ draftId: draft.draftId })
  assert.equal(evaluations[0]?.subjectKey, "decision:deep_cleansing_shampoo:residue_reset:gap")
})

test("production authority uses product-load coverage to suppress duplicate scalp care purchase", async () => {
  const dryShampooRequirement: Stage3CategoryRequirement = {
    category: "dry_shampoo",
    requiredRoles: [],
    needSummary: "Aktuelles Trockenshampoo erfassen.",
    authorityVersion: CATEGORY_ROLE_POLICIES.dry_shampoo.authorityVersion,
  }
  const initial: Stage3ProductDraft = {
    ...createStage3Draft({
      draftId: "draft-product-load-coverage",
      userId: "owner-a",
      personalPlanId: "plan-a",
      refinedVersionId: "refined-a",
      requirements: [dryShampooRequirement],
      now: "2026-08-08T00:00:00.000Z",
    }),
    authoritySnapshot: {
      schemaVersion: 1,
      refinedNeedVersionId: "refined-a",
      refinedInputHash: "refined-input-a",
      productLoadContext: {
        schemaVersion: 1,
        scalpOiliness: "balanced" as const,
        deepCleansingScalpPause: false,
        hasLowVolumeOrWeighedDown: false,
        shampooFrequency: "weekly_2x" as const,
        oilPurposes: [],
      },
      categoryDecisions: [
        {
          category: "deep_cleansing_shampoo" as const,
          resolution: "resolved" as const,
          needTier: "not_needed" as const,
          roles: [],
          target: null,
          frequency: null,
          reasons: [],
          executionState: "available" as const,
          executionPauseReason: null,
          deferredFacts: [],
        },
      ],
      coverage: [],
      orderedCategories: ["dry_shampoo" as const],
      inventoryOnlyCategories: ["dry_shampoo" as const],
      authorityVersions: Object.fromEntries(
        Object.entries(CATEGORY_ROLE_POLICIES).map(([category, policy]) => [
          category,
          policy.authorityVersion,
        ]),
      ) as never,
    },
  }
  const captured = addCapturedProduct(initial, {
    capturedProductId: "dry-shampoo-current",
    userProductId: "owned-dry-shampoo-current",
    identity: {
      kind: "pending_submission",
      submissionId: "submission-dry-shampoo-current",
      displayName: "Trockenshampoo in Prüfung",
      category: "dry_shampoo",
      reviewStatus: "pending_review",
    },
    frequencyRange: "weekly_3_4x",
    ownership: "owned",
    source: "intake_fallback",
  })
  const draft = completeCaptureCategory(captured, "dry_shampoo", [dryShampooRequirement])
  assert.equal(
    draft.productLoadResolution?.coverage[0]?.ruleId,
    "portfolio.reset.deep_cleansing_primary",
  )

  const gateway = createProductionStage3ProductsGateway({
    userId: "owner-a",
    persistence: {
      ...persistence(draft),
      loadRequirements: async () => [dryShampooRequirement],
      loadAuthorityFacts: async (input) => ({
        productFacts: null,
        recommendationCandidates:
          input.subject.category === "scalp_care"
            ? [
                {
                  productId: "recommended-scalp-exfoliant",
                  displayName: "Kopfhaut-Peeling",
                  category: "scalp_care",
                  isActive: true,
                  lifecycleStatus: "active",
                  recommendable: true,
                  suitableThicknesses: ["normal"],
                  knownReaction: false,
                  protocols: [
                    {
                      role: "scalp_exfoliant",
                      status: "verified_complete",
                      fingerprint: "protocol-scalp-exfoliant",
                    },
                  ],
                  factFingerprint: "facts-scalp-exfoliant",
                  spec: {
                    primaryRole: "scalp_exfoliant",
                    presentationFormat: "peeling",
                    rinseMode: "rinse_off",
                  },
                },
              ]
            : [],
        heatCarrierCoverage: { carrierCategory: null, verifiedRoutes: [] },
      }),
    },
  })

  const evaluations = await gateway.evaluateDecisions({ draftId: draft.draftId })
  const scalpEvaluation = evaluations.find(
    (evaluation) => evaluation.subjectKey === "decision:scalp_care:scalp_exfoliant:gap",
  )
  assert.equal(scalpEvaluation?.status, "known")
  assert.deepEqual(scalpEvaluation?.allowedActions, ["leave_uncovered"])
  assert.equal(scalpEvaluation?.recommendation, null)
  assert.deepEqual(scalpEvaluation?.coverageRuleIds, ["portfolio.reset.deep_cleansing_primary"])
})

test("missing and stale authority snapshots fail closed", async () => {
  const draft = authorityDraft()
  for (const stale of [
    { ...draft, authoritySnapshot: undefined },
    {
      ...draft,
      authoritySnapshot: { ...draft.authoritySnapshot!, refinedInputHash: "" },
    },
  ]) {
    const gateway = createProductionStage3ProductsGateway({
      userId: "owner-a",
      persistence: persistence(stale),
    })
    await assert.rejects(
      () => gateway.evaluateDecisions({ draftId: stale.draftId }),
      /stale_authority_snapshot/,
    )
  }
})

test("v1 owned-fit snapshots fail closed after the authority semantic correction", async () => {
  const draft = authorityDraft()
  const authoritySnapshot = draft.authoritySnapshot!
  const stale = {
    ...draft,
    authoritySnapshot: {
      ...authoritySnapshot,
      authorityVersions: {
        ...authoritySnapshot.authorityVersions,
        shampoo: "personal-plan.shampoo.v1",
      },
    },
  }
  const gateway = createProductionStage3ProductsGateway({
    userId: "owner-a",
    persistence: persistence(stale),
  })

  await assert.rejects(
    () => gateway.evaluateDecisions({ draftId: stale.draftId }),
    /stale_authority_snapshot/,
  )
})
