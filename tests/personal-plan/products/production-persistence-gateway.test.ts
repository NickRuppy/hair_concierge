import assert from "node:assert/strict"
import test from "node:test"

import { CATEGORY_ROLE_POLICIES } from "../../../src/lib/personal-plan/products/authorities"
import {
  createProductionStage3ProductsGateway,
  Stage3AuthorityMutationError,
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
  PersonalPlanCategory,
  Stage3CategoryRequirement,
  Stage3ProductDraft,
} from "../../../src/lib/personal-plan/products/contracts"
import {
  PERSONAL_PLAN_PRODUCT_CATEGORIES,
  STAGE3_DECISION_DEFERRAL_REASONS,
  stage3InventoryDispositionKey,
  validateStage3Draft,
  type Stage3DecisionDeferralReason,
} from "../../../src/lib/personal-plan/products/contracts"
import type { Stage3AuthorityFactBundle } from "../../../src/lib/personal-plan/products/authority/catalog-facts"
import { isValidPersistedCategoryDecision } from "../../../src/lib/personal-plan/products/authority/category-decision-schema"
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
    resolveNeedRevision: async (input) => ({ outcome: "saved", draft: input.draft }),
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

test("load returns restored catalog thumbnails as an ephemeral projection", async () => {
  const draft = readyDraft()
  const gateway = createProductionStage3ProductsGateway({
    userId: "owner-a",
    thumbnailsEnabled: true,
    persistence: {
      ...persistence(draft),
      loadCurrentCatalogProduct: async () => ({
        userProductId: "owned-a",
        productId: "catalog-a",
        displayName: "Pflege",
        imageUrl: "https://example.test/canonical.webp",
        thumbnailImageUrl: "https://example.test/thumbnail.webp",
        category: "conditioner",
      }),
    },
  })

  const response = await gateway.loadOrCreate({
    draftId: "ignored",
    userId: "owner-a",
    personalPlanId: "plan-a",
    refinedVersionId: "refined-a",
    requirements,
  })

  assert.deepEqual(response.catalogThumbnails, {
    "catalog-a": "https://example.test/thumbnail.webp",
  })
  assert.equal("thumbnailImageUrl" in response.draft.products[0]!.identity, false)
})

test("flag-off load performs no thumbnail enrichment reads", async () => {
  const draft = readyDraft()
  let currentProductReads = 0
  const gateway = createProductionStage3ProductsGateway({
    userId: "owner-a",
    thumbnailsEnabled: false,
    persistence: {
      ...persistence(draft),
      loadCurrentCatalogProduct: async () => {
        currentProductReads += 1
        return null
      },
    },
  })

  const response = await gateway.loadOrCreate({
    draftId: "ignored",
    userId: "owner-a",
    personalPlanId: "plan-a",
    refinedVersionId: "refined-a",
    requirements,
  })

  assert.equal(response.catalogThumbnails, undefined)
  assert.equal(currentProductReads, 0)
})

test("preparing an externally opened draft primes the exact draft used for decision reviews", async () => {
  const draft = readyDraft()
  let draftReloads = 0
  const gateway = createProductionStage3ProductsGateway({
    userId: "owner-a",
    persistence: {
      ...persistence(draft),
      loadDraft: async () => {
        draftReloads += 1
        return { ...draft, revision: draft.revision + 1 }
      },
    },
  })

  const prepared = await gateway.prepareLoadedDraft({
    status: draft.status,
    draft,
    requirements,
  })
  const reviews = await gateway.reviewDecisionBundles({ draftId: draft.draftId })

  assert.equal(prepared.draft.revision, draft.revision)
  assert.equal(draftReloads, 0)
  assert.deepEqual(
    reviews.map((review) => review.authorityEvaluation.subjectKey),
    ["decision:conditioner:conditioner_rinse_out:capture-a"],
  )
})

test("preparing an externally opened draft rejects a different owner", async () => {
  const draft = readyDraft()
  const gateway = createProductionStage3ProductsGateway({
    userId: "owner-a",
    persistence: persistence(draft),
  })

  await assert.rejects(
    () =>
      gateway.prepareLoadedDraft({
        status: draft.status,
        draft: { ...draft, userId: "owner-b" },
        requirements,
      }),
    /stage3_draft_not_found/,
  )
})

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
  assert.equal(saves, 1)
})

test("inventory disposition acknowledgement is server-applied, CAS guarded, and idempotent", async () => {
  const draft: Stage3ProductDraft = {
    ...readyDraft(),
    roleAssignments: [],
    decisions: [],
    completedDecisionKeys: [],
    inventoryDispositions: [
      {
        schemaVersion: 1,
        dispositionKey: "inventory:conditioner:capture-a",
        capturedProductId: "capture-a",
        category: "conditioner",
        planStatus: "not_used",
        reason: "not_assigned_to_final_role",
        acknowledged: false,
        authorityFingerprint: "a".repeat(64),
      },
    ],
  }
  let saves = 0
  const gateway = createProductionStage3ProductsGateway({
    userId: "owner-a",
    persistence: {
      ...persistence(draft),
      save: async (input) => {
        saves += 1
        return { outcome: "saved" as const, draft: input.draft }
      },
    },
  })
  await gateway.loadOrCreate({
    draftId: "server-derived",
    userId: "owner-a",
    personalPlanId: draft.personalPlanId,
    refinedVersionId: draft.refinedVersionId,
    requirements: [],
  })
  const input = {
    draftId: draft.draftId,
    expectedRevision: draft.revision,
    dispositionKey: "inventory:conditioner:capture-a",
  }
  const first = await gateway.acknowledgeInventoryDisposition(input)
  assert.equal(first.status, "saved")
  if (first.status !== "saved") return
  assert.equal(first.draft.inventoryDispositions?.[0]?.acknowledged, true)
  assert.equal(saves, 1)

  const replay = await gateway.acknowledgeInventoryDisposition(input)
  assert.equal(replay.status, "saved")
  assert.equal(saves, 1)
})

test("mixed final-role and current-only inventory reviews skip fit authority for the disposition", async () => {
  const base = readyDraft()
  const draft: Stage3ProductDraft = {
    ...base,
    orderedCategories: ["conditioner", "dry_shampoo"],
    products: [
      ...base.products,
      {
        capturedProductId: "capture-current-only",
        userProductId: "owned-current-only",
        identity: {
          kind: "pending_submission",
          submissionId: "submission-current-only",
          displayName: "Trockenshampoo außerhalb des Plans",
          category: "dry_shampoo",
          reviewStatus: "pending_review",
        },
        frequencyRange: "weekly_2x",
        ownership: "owned",
        source: "existing_inventory",
      },
    ],
    authoritySnapshot: {
      ...base.authoritySnapshot!,
      orderedCategories: ["conditioner", "dry_shampoo"],
      inventoryOnlyCategories: ["dry_shampoo"],
    },
    inventoryDispositions: [
      {
        schemaVersion: 1,
        dispositionKey: stage3InventoryDispositionKey("dry_shampoo", "capture-current-only"),
        capturedProductId: "capture-current-only",
        category: "dry_shampoo",
        planStatus: "not_used",
        reason: "category_not_in_final_plan",
        acknowledged: false,
        authorityFingerprint: "a".repeat(64),
      },
    ],
  }
  let authorityFactReads = 0
  const gateway = createProductionStage3ProductsGateway({
    userId: "owner-a",
    persistence: {
      ...persistence(draft),
      loadAuthorityFacts: async (input) => {
        authorityFactReads += 1
        assert.equal(input.subject.category, "conditioner")
        return conditionerFacts()
      },
    },
  })
  await gateway.loadOrCreate({
    draftId: "server-derived",
    userId: "owner-a",
    personalPlanId: draft.personalPlanId,
    refinedVersionId: draft.refinedVersionId,
    requirements: [],
  })

  const reviews = await gateway.reviewDecisionBundles({ draftId: draft.draftId })
  assert.deepEqual(
    reviews.map((review) => review.authorityEvaluation.subjectKey),
    ["decision:conditioner:conditioner_rinse_out:capture-a"],
  )
  assert.equal(authorityFactReads, 1)

  const acknowledged = await gateway.acknowledgeInventoryDisposition({
    draftId: draft.draftId,
    expectedRevision: draft.revision,
    dispositionKey: stage3InventoryDispositionKey("dry_shampoo", "capture-current-only"),
  })
  assert.equal(acknowledged.status, "saved")
  if (acknowledged.status === "saved") {
    assert.equal(acknowledged.draft.inventoryDispositions?.[0]?.acknowledged, true)
  }
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

test("catalog capture replay verifies the current refined source before returning its receipt", async () => {
  const initial = createStage3Draft({
    draftId: "draft-catalog-replay-stale",
    userId: "owner-a",
    personalPlanId: "plan-a",
    refinedVersionId: "refined-a",
    requirements,
    now: "2026-08-08T00:00:00.000Z",
  })
  let saves = 0
  let currentRefinedVersionId = initial.refinedVersionId
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
        return { outcome: "saved" as const, draft: input.draft }
      },
      loadCurrentRefinedVersionId: async () => currentRefinedVersionId,
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

  currentRefinedVersionId = "refined-new"
  await assert.rejects(
    () =>
      gateway.mutate({
        draftId: initial.draftId,
        expectedRevision: first.draft.revision,
        mutation,
      }),
    (error: unknown) =>
      error instanceof Stage3AuthoritySnapshotError && error.code === "stale_refined_source",
  )
  assert.equal(saves, 1)
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

test("catalog search translates Shampoo constraints into stored route semantics", async () => {
  const base = authorityDraft()
  const shampooRequirement: Stage3CategoryRequirement = {
    category: "shampoo",
    requiredRoles: ["shampoo_everyday"],
    needSummary: "Sanfte Reinigung für gereizte Kopfhaut",
    authorityVersion: CATEGORY_ROLE_POLICIES.shampoo.authorityVersion,
  }
  const draft: Stage3ProductDraft = {
    ...base,
    authorityVersions: {
      ...base.authorityVersions,
      shampoo: CATEGORY_ROLE_POLICIES.shampoo.authorityVersion,
    },
    orderedCategories: ["shampoo"],
    categoryCursor: "shampoo",
    authoritySnapshot: {
      ...base.authoritySnapshot!,
      orderedCategories: ["shampoo"],
      categoryDecisions: [
        {
          category: "shampoo",
          resolution: "resolved",
          needTier: "basis",
          roles: ["shampoo_everyday"],
          target: {
            category: "shampoo",
            roles: ["shampoo_everyday"],
            scalpRoute: "balanced",
            everydayConstraint: "irritation_compatible",
            requiresTargetedDandruffCapability: false,
          },
          frequency: null,
          reasons: [],
          executionState: "available",
          executionPauseReason: null,
          deferredFacts: [],
        },
      ],
    },
  }
  const received: Array<Parameters<Stage3ProductionPersistence["search"]>[0]> = []
  const gateway = createProductionStage3ProductsGateway({
    userId: "owner-a",
    persistence: {
      ...persistence(draft),
      loadOrCreate: async () => ({ draft, requirements: [shampooRequirement] }),
      loadRequirements: async () => [shampooRequirement],
      search: async (input) => {
        received.push(input)
        return { query: input.query, category: input.category, candidates: [], totalCapped: false }
      },
    },
  })

  await gateway.search({
    draftId: draft.draftId,
    category: "shampoo",
    query: "shampoo",
    requestToken: 1,
  })

  assert.deepEqual(received[0]?.assessmentContext.shampooTargets, [
    { thickness: "normal", shampooBucket: "irritationen", scalpRoute: "irritated" },
  ])
})

test("catalog search consistently preserves the derived Shampoo target route", async () => {
  const base = authorityDraft()
  const shampooRequirement: Stage3CategoryRequirement = {
    category: "shampoo",
    requiredRoles: ["shampoo_everyday"],
    needSummary: "Sanfte Reinigung für gereizte Kopfhaut",
    authorityVersion: CATEGORY_ROLE_POLICIES.shampoo.authorityVersion,
  }
  const draft: Stage3ProductDraft = {
    ...base,
    authorityVersions: {
      ...base.authorityVersions,
      shampoo: CATEGORY_ROLE_POLICIES.shampoo.authorityVersion,
    },
    orderedCategories: ["shampoo"],
    categoryCursor: "shampoo",
    authoritySnapshot: {
      ...base.authoritySnapshot!,
      orderedCategories: ["shampoo"],
      categoryDecisions: [
        {
          category: "shampoo",
          resolution: "resolved",
          needTier: "basis",
          roles: ["shampoo_everyday"],
          target: {
            category: "shampoo",
            roles: ["shampoo_everyday"],
            scalpRoute: "balanced",
            everydayConstraint: "irritation_compatible",
            requiresTargetedDandruffCapability: false,
          },
          frequency: null,
          reasons: [],
          executionState: "available",
          executionPauseReason: null,
          deferredFacts: [],
        },
      ],
    },
  }
  const received: Array<Parameters<Stage3ProductionPersistence["search"]>[0]> = []
  const gateway = createProductionStage3ProductsGateway({
    userId: "owner-a",
    persistence: {
      ...persistence(draft),
      loadOrCreate: async () => ({ draft, requirements: [shampooRequirement] }),
      loadRequirements: async () => [shampooRequirement],
      search: async (input) => {
        received.push(input)
        return { query: input.query, category: input.category, candidates: [], totalCapped: false }
      },
    },
  })

  await gateway.search({
    draftId: draft.draftId,
    category: "shampoo",
    query: "shampoo",
    requestToken: 1,
  })

  assert.equal(received[0]?.assessmentContext.shampooTargets[0]?.scalpRoute, "irritated")
})

test("catalog search permits signed inventory-only categories while heat retains its refined decision", async () => {
  for (const category of PERSONAL_PLAN_PRODUCT_CATEGORIES) {
    const requirement: Stage3CategoryRequirement = {
      category,
      requiredRoles: [],
      needSummary: `Aktuelles ${category} erfassen`,
      authorityVersion: CATEGORY_ROLE_POLICIES[category].authorityVersion,
    }
    const base = authorityDraft()
    const draft: Stage3ProductDraft = {
      ...base,
      draftId: `draft-inventory-only-${category}`,
      orderedCategories: [category],
      authoritySnapshot: {
        ...base.authoritySnapshot!,
        categoryDecisions:
          category === "heat_protectant"
            ? [
                {
                  category: "heat_protectant",
                  resolution: "deferred_until_post_plan_onboarding",
                  needTier: null,
                  roles: [],
                  target: {
                    category: "heat_protectant",
                    roles: [],
                    qualifyingRoutes: [],
                    carrierPolicy: "integrated_or_separate_verified_binary_capability",
                  },
                  frequency: null,
                  reasons: [],
                  executionState: "available",
                  executionPauseReason: null,
                  deferredFacts: ["heat_tool_use"],
                },
              ]
            : [],
        orderedCategories: [category],
        inventoryOnlyCategories: [category],
      },
    }
    const received: Array<Parameters<Stage3ProductionPersistence["search"]>[0]> = []
    const gateway = createProductionStage3ProductsGateway({
      userId: "owner-a",
      persistence: {
        ...persistence(draft),
        loadOrCreate: async () => ({ draft, requirements: [requirement] }),
        loadRequirements: async () => [requirement],
        search: async (input) => {
          received.push(input)
          return {
            query: input.query,
            category: input.category,
            candidates: [],
            totalCapped: false,
          }
        },
      },
    })

    await gateway.search({
      draftId: draft.draftId,
      category,
      query: "produkt",
      requestToken: 1,
    })

    assert.deepEqual(received[0]?.assessmentContext, {
      hairThickness: "normal",
      requiredRoles: [],
      shampooTargets: [],
      conditionerTarget: null,
    })
  }
})

test("catalog search rejects unsigned inventory-only access and missing canonical requirements", async () => {
  const category: PersonalPlanCategory = "conditioner"
  const requirement: Stage3CategoryRequirement = {
    category,
    requiredRoles: [],
    needSummary: "Aktuellen Conditioner erfassen",
    authorityVersion: CATEGORY_ROLE_POLICIES[category].authorityVersion,
  }
  const base = authorityDraft()
  const inventoryOnlyDraft: Stage3ProductDraft = {
    ...base,
    authoritySnapshot: {
      ...base.authoritySnapshot!,
      categoryDecisions: [],
      orderedCategories: [category],
      inventoryOnlyCategories: [category],
    },
  }

  const unsignedGateway = createProductionStage3ProductsGateway({
    userId: "owner-a",
    persistence: {
      ...persistence({
        ...inventoryOnlyDraft,
        authoritySnapshot: {
          ...inventoryOnlyDraft.authoritySnapshot!,
          inventoryOnlyCategories: [],
        },
      }),
      loadRequirements: async () => [requirement],
    },
  })
  await assert.rejects(
    () =>
      unsignedGateway.search({
        draftId: inventoryOnlyDraft.draftId,
        category,
        query: "produkt",
        requestToken: 1,
      }),
    /stale_authority_snapshot/,
  )

  const missingRequirementGateway = createProductionStage3ProductsGateway({
    userId: "owner-a",
    persistence: {
      ...persistence(inventoryOnlyDraft),
      loadRequirements: async () => [],
    },
  })
  await assert.rejects(
    () =>
      missingRequirementGateway.search({
        draftId: inventoryOnlyDraft.draftId,
        category,
        query: "produkt",
        requestToken: 1,
      }),
    /stale_authority_snapshot/,
  )
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
        targetFit: "matched",
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
  return {
    productFacts: null,
    recommendationCandidates: [
      conditionerProductFacts("recommended-conditioner", {
        fingerprint: "facts-supportive-conditioner",
        weight: "medium",
      }),
    ],
    heatCarrierCoverage: { carrierCategory: null, verifiedRoutes: [] },
  }
}

function conditionerReplacementFacts(): Stage3AuthorityFactBundle {
  return {
    productFacts: conditionerProductFacts("catalog-a", {
      displayName: "Zu reichhaltige Pflege",
      fingerprint: "facts-owned-mismatch",
      recommendable: false,
      weight: "rich",
      proteinMoistureBalance: "protein",
    }),
    recommendationCandidates: [
      conditionerProductFacts("replacement-1", { sortOrder: 1 }),
      conditionerProductFacts("replacement-2", { sortOrder: 2 }),
      conditionerProductFacts("replacement-3", { sortOrder: 3 }),
      conditionerProductFacts("replacement-4", { sortOrder: 4, weight: "medium" }),
    ],
    heatCarrierCoverage: { carrierCategory: null, verifiedRoutes: [] },
  }
}

function conditionerProductFacts(
  productId: string,
  overrides: {
    displayName?: string
    fingerprint?: string
    recommendable?: boolean
    sortOrder?: number
    weight?: string
    proteinMoistureBalance?: string
  } = {},
) {
  return {
    productId,
    displayName: overrides.displayName ?? productId,
    category: "conditioner" as const,
    isActive: true,
    lifecycleStatus: "active",
    recommendable: overrides.recommendable ?? true,
    suitableThicknesses: ["normal"],
    knownReaction: false,
    protocols: [
      {
        role: "conditioner_rinse_out" as const,
        status: "verified_complete" as const,
        fingerprint: `protocol-${productId}`,
      },
    ],
    factFingerprint: overrides.fingerprint ?? `facts-${productId}`,
    catalogSortOrder: overrides.sortOrder ?? null,
    spec: {
      thickness: "normal",
      proteinMoistureBalance: overrides.proteinMoistureBalance ?? "moisture",
      weight: overrides.weight ?? "light",
      repairSupportLevel: "medium",
      balanceDirection: "moisture",
      targetFit: "matched" as const,
    },
  }
}

function selectedReplacementDraft(recommendationFactFingerprint: string): Stage3ProductDraft {
  const draft = authorityDraft()
  const decision = {
    decisionKey: "decision:conditioner:conditioner_rinse_out:capture-a",
    category: "conditioner" as const,
    role: "conditioner_rinse_out" as const,
    capturedProductId: "capture-a",
    verdict: "mismatch" as const,
    choiceState: "planned_purchase" as const,
    resolutionAction: "select_replacement" as const,
    criterionResults: [],
    recommendation: {
      recommendationId: "recommend:replacement-2:conditioner_rinse_out",
      productId: "replacement-2",
      category: "conditioner" as const,
      role: "conditioner_rinse_out" as const,
      displayName: "replacement-2",
      reason: "Passt zum Conditioner-Zielprofil.",
      authorityRuleId: "conditioner.selection.core_fit",
    },
    limitationAcknowledged: false,
    authorityEvidence: {
      schemaVersion: 1 as const,
      subjectKey: "decision:conditioner:conditioner_rinse_out:capture-a",
      refinedNeedVersionId: draft.refinedVersionId,
      refinedInputHash: draft.authoritySnapshot!.refinedInputHash,
      authorityVersion: draft.authoritySnapshot!.authorityVersions.conditioner,
      productFactFingerprint: "facts-owned-mismatch",
      recommendationFactFingerprint,
      coverageRuleIds: [],
    },
  }
  return {
    ...draft,
    decisions: [decision],
    completedDecisionKeys: [decision.decisionKey],
    revision: draft.revision + 1,
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
  const cadenceReads: string[][] = []
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
    cadenceAuthorityReader: {
      load: async ({ productIds }) => {
        sourceReadOrder.push("cadence")
        cadenceReads.push([...productIds])
        return []
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
  assert.deepEqual(cadenceReads, [["catalog-a"]])
  assert.deepEqual((compilerInput as Record<string, unknown>).cadenceAuthorityFacts, [])
  assert.deepEqual(sourceReadOrder.slice(2), ["cadence", "compile"])
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

test("completed draft returns its canonical receipt without compiling or staging again", async () => {
  const completed = {
    ...readyDraft(),
    status: "completed" as const,
    pass: "ready_for_routine" as const,
    revision: 5,
  }
  const portfolio = createProposedProductPortfolio(
    { ...completed, status: "active", pass: "ready_for_routine" },
    requirements,
    { portfolioVersionId: "portfolio-a", createdAt: "2026-08-08T00:01:00.000Z" },
  )
  let compileCalls = 0
  let stageCalls = 0
  const gateway = createProductionStage3ProductsGateway({
    userId: "owner-a",
    persistence: {
      ...persistence(completed),
      loadCompletionReceipt: async () => ({
        portfolio,
        productPortfolioVersionId: "portfolio-a",
        routineVersionId: "routine-a",
        routineProposalId: "proposal-a",
      }),
    },
    compiler: {
      compile: async () => {
        compileCalls += 1
        throw new Error("receipt replay must not compile")
      },
    },
    stager: {
      stage: async () => {
        stageCalls += 1
        throw new Error("receipt replay must not stage")
      },
    },
  })

  const result = await gateway.complete({ draftId: "draft-a", expectedRevision: 4 })
  assert.equal(result.status, "ready_for_routine")
  assert.equal(result.productPortfolioVersionId, "portfolio-a")
  assert.equal(result.routineProposalId, "proposal-a")
  assert.equal(compileCalls, 0)
  assert.equal(stageCalls, 0)
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
    mutation: { type: "remove_captured_product", capturedProductId: "capture-a" },
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
        mutation: { type: "remove_captured_product", capturedProductId: "capture-a" },
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

test("a committed semantic decision is its receipt even when authority facts later become unavailable", async () => {
  const source = authorityDraft()
  const decision = {
    decisionKey: "decision:conditioner:conditioner_rinse_out:capture-a",
    category: "conditioner" as const,
    role: "conditioner_rinse_out" as const,
    capturedProductId: "capture-a",
    verdict: "ideal" as const,
    choiceState: "owned_active" as const,
    criterionResults: [],
    recommendation: null,
    limitationAcknowledged: false,
    authorityEvidence: {
      schemaVersion: 1 as const,
      subjectKey: "decision:conditioner:conditioner_rinse_out:capture-a",
      refinedNeedVersionId: source.refinedVersionId,
      refinedInputHash: source.authoritySnapshot!.refinedInputHash,
      authorityVersion: source.authoritySnapshot!.authorityVersions.conditioner,
      productFactFingerprint: "facts-a",
      recommendationFactFingerprint: null,
      coverageRuleIds: [],
    },
  }
  const committed = {
    ...source,
    decisions: [decision],
    completedDecisionKeys: [decision.decisionKey],
    revision: source.revision + 1,
  }
  let factReads = 0
  const gateway = createProductionStage3ProductsGateway({
    userId: "owner-a",
    persistence: {
      ...persistence(committed),
      loadAuthorityFacts: async () => {
        factReads += 1
        throw new Error("authority facts unavailable")
      },
    },
  })

  const result = await gateway.resolveDecision({
    draftId: committed.draftId,
    expectedRevision: source.revision,
    intent: {
      type: "resolve_decision",
      subjectKey: decision.decisionKey,
      action: "keep_owned",
    },
  })

  assert.deepEqual(result, { status: "saved", draft: committed })
  assert.equal(factReads, 0)
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

test("a batch revalidates Heat Protectant against the projected planned leave-on Oil", async () => {
  const base = authorityDraft()
  const oilSubjectKey = "decision:oil:leave_on_fibre_conditioning:gap"
  const heatSubjectKey = "decision:heat_protectant:pre_heat_protection:gap"
  const draft: Stage3ProductDraft = {
    ...base,
    products: [],
    roleAssignments: [],
    decisions: [],
    completedDecisionKeys: [],
    uncoveredRoles: [
      { category: "oil", role: "leave_on_fibre_conditioning", reason: "no_product_owned" },
      { category: "heat_protectant", role: "pre_heat_protection", reason: "no_product_owned" },
    ],
    orderedCategories: ["oil", "heat_protectant"],
    authorityVersions: Object.fromEntries(
      Object.entries(CATEGORY_ROLE_POLICIES).map(([category, policy]) => [
        category,
        policy.authorityVersion,
      ]),
    ) as never,
    authoritySnapshot: {
      ...base.authoritySnapshot!,
      orderedCategories: ["oil", "heat_protectant"],
      categoryDecisions: [
        {
          category: "oil",
          resolution: "resolved",
          needTier: "basis",
          roles: ["leave_on_fibre_conditioning"],
          target: {
            category: "oil",
            roles: ["leave_on_fibre_conditioning"],
            roleTargets: [
              {
                role: "leave_on_fibre_conditioning",
                tier: "basis",
                weight: "light",
                functionalBenefits: [],
              },
            ],
          },
          frequency: null,
          reasons: [],
          executionState: "available",
          executionPauseReason: null,
          deferredFacts: [],
        },
        {
          category: "heat_protectant",
          resolution: "resolved",
          needTier: "basis",
          roles: ["pre_heat_protection"],
          target: {
            category: "heat_protectant",
            roles: ["pre_heat_protection"],
            qualifyingRoutes: ["direct_contact_heat"],
            carrierPolicy: "integrated_or_separate_verified_binary_capability",
          },
          frequency: null,
          reasons: [],
          executionState: "available",
          executionPauseReason: null,
          deferredFacts: [],
        },
      ],
    },
  }
  const oilCandidate = {
    productId: "planned-oil",
    displayName: "Geplantes Öl",
    category: "oil",
    isActive: true,
    lifecycleStatus: "active",
    recommendable: true,
    suitableThicknesses: ["normal"],
    knownReaction: false,
    protocols: [
      {
        role: "leave_on_fibre_conditioning",
        status: "verified_complete",
        fingerprint: "oil-protocol",
      },
    ],
    factFingerprint: "oil-facts",
    spec: {
      weight: "light",
      roleSupport: { leave_on_fibre_conditioning: true },
      targetThicknessEligible: true,
      providesHeatProtection: true,
    },
  }
  const heatCandidate = {
    productId: "planned-heat",
    displayName: "Geplanter Hitzeschutz",
    category: "heat_protectant",
    isActive: true,
    lifecycleStatus: "active",
    recommendable: true,
    suitableThicknesses: ["normal"],
    knownReaction: false,
    protocols: [
      { role: "pre_heat_protection", status: "verified_complete", fingerprint: "heat-protocol" },
    ],
    factFingerprint: "heat-facts",
    spec: { format: "spray", providesHeatProtection: true },
  }
  let saves = 0
  let carrierVerified = true
  const gateway = createProductionStage3ProductsGateway({
    userId: "owner-a",
    persistence: {
      ...persistence(draft),
      loadAuthorityFacts: async (input) => {
        if (input.subject.category === "oil") {
          return {
            productFacts: null,
            recommendationCandidates: [oilCandidate],
            heatCarrierCoverage: { carrierCategory: null, verifiedRoutes: [] },
          } as never
        }
        const projectedOil = input.draft.decisions.some(
          (decision) => decision.category === "oil" && decision.choiceState === "planned_purchase",
        )
        return {
          productFacts: null,
          recommendationCandidates: [heatCandidate],
          heatCarrierCoverage:
            projectedOil && carrierVerified
              ? { carrierCategory: "oil", verifiedRoutes: ["direct_contact_heat"] }
              : { carrierCategory: null, verifiedRoutes: [] },
        } as never
      },
      save: async (input) => {
        saves += 1
        return { outcome: "saved", draft: input.draft }
      },
    },
  })
  const oilIntent = {
    type: "resolve_decision" as const,
    subjectKey: oilSubjectKey,
    action: "plan_recommendation" as const,
    selectedCandidateId: "planned-oil",
  }

  const preview = await gateway.previewDecisionBundles({
    draftId: draft.draftId,
    expectedRevision: draft.revision,
    intents: [oilIntent],
  })
  assert.equal(preview.status, "ready")
  if (preview.status === "ready") {
    assert.deepEqual(preview.autoResolvedIntents, [
      {
        type: "resolve_decision",
        subjectKey: heatSubjectKey,
        action: "leave_uncovered",
      },
    ])
    assert.equal(
      preview.bundles.some((bundle) => bundle.authorityEvaluation.subjectKey === heatSubjectKey),
      false,
    )
  }
  assert.equal(saves, 0)

  carrierVerified = false
  const partialPreview = await gateway.previewDecisionBundles({
    draftId: draft.draftId,
    expectedRevision: draft.revision,
    intents: [oilIntent],
  })
  assert.equal(partialPreview.status, "ready")
  if (partialPreview.status === "ready") {
    assert.deepEqual(partialPreview.autoResolvedIntents, [])
    assert.equal(
      partialPreview.bundles.some(
        (bundle) => bundle.authorityEvaluation.subjectKey === heatSubjectKey,
      ),
      true,
    )
  }
  assert.equal(saves, 0)
  carrierVerified = true

  await assert.rejects(
    () =>
      gateway.resolveDecisions({
        draftId: draft.draftId,
        expectedRevision: draft.revision,
        intents: [
          oilIntent,
          {
            type: "resolve_decision",
            subjectKey: heatSubjectKey,
            action: "plan_recommendation",
            selectedCandidateId: "planned-heat",
          },
        ],
      }),
    (error: unknown) =>
      error instanceof Stage3AuthorityMutationError &&
      error.code === "stage3_authority_action_invalid",
  )
  assert.equal(saves, 0)

  const result = await gateway.resolveDecisions({
    draftId: draft.draftId,
    expectedRevision: draft.revision,
    intents: [
      oilIntent,
      { type: "resolve_decision", subjectKey: heatSubjectKey, action: "leave_uncovered" },
    ],
  })
  assert.equal(result.status, "saved")
  assert.equal(saves, 1)
  if (result.status === "saved") {
    assert.equal(result.draft.revision, draft.revision + 1)
    assert.deepEqual(
      result.draft.decisions.map((decision) => decision.decisionKey),
      [oilSubjectKey, heatSubjectKey],
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

test("an uncovered supportive conditioner alternative is allowlisted, persists, and remains completion-current", async () => {
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

  const reviews = await gateway.reviewDecisionBundles({ draftId: draft.draftId })
  assert.deepEqual(
    reviews[0]?.fitComparison.alternatives.map((candidate) => ({
      productId: candidate.productId,
      verdict: candidate.verdict,
      factFingerprint: candidate.factFingerprint,
    })),
    [
      {
        productId: "recommended-conditioner",
        verdict: "supportive",
        factFingerprint: "facts-supportive-conditioner",
      },
    ],
  )

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
  assert.equal(
    saved[0]?.decisions[0]?.authorityEvidence?.recommendationFactFingerprint,
    "facts-supportive-conditioner",
  )
  if (result.status !== "saved") return

  let stageCalls = 0
  const completionGateway = createProductionStage3ProductsGateway({
    userId: "owner-a",
    persistence: {
      ...persistence(result.draft),
      loadAuthorityFacts: async () => conditionerRecommendationFacts(),
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
          status: "completed",
          portfolioVersionId: "portfolio-supportive",
          routineVersionId: "routine-supportive",
          routineProposalId: "proposal-supportive",
          revision: result.draft.revision + 1,
        }
      },
    },
  })

  const completion = await completionGateway.complete({
    draftId: result.draft.draftId,
    expectedRevision: result.draft.revision,
  })

  assert.equal(completion.status, "ready_for_routine")
  assert.equal(stageCalls, 1)
  assert.deepEqual(
    completion.status === "ready_for_routine"
      ? completion.portfolio.plannedPurchases.map((product) => product.productId)
      : [],
    ["recommended-conditioner"],
  )
})

test("selected replacement candidate #2 and #3 persist exact recommendation evidence", async () => {
  for (const selectedCandidateId of ["replacement-2", "replacement-3"] as const) {
    const draft = authorityDraft()
    const saved: Stage3ProductDraft[] = []
    const gateway = createProductionStage3ProductsGateway({
      userId: "owner-a",
      persistence: {
        ...persistence(draft),
        loadAuthorityFacts: async () => conditionerReplacementFacts(),
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
        action: "select_replacement",
        selectedCandidateId,
        selectedCandidateFactFingerprint: `facts-${selectedCandidateId}`,
      },
    })

    assert.equal(result.status, "saved")
    const decision = saved[0]?.decisions[0]
    assert.equal(decision?.choiceState, "planned_purchase")
    assert.equal(decision?.resolutionAction, "select_replacement")
    assert.equal(decision?.recommendation?.productId, selectedCandidateId)
    assert.equal(
      decision?.authorityEvidence?.recommendationFactFingerprint,
      `facts-${selectedCandidateId}`,
    )
    assert.equal(decision?.authorityEvidence?.productFactFingerprint, "facts-owned-mismatch")
  }
})

test("selected replacement must be present in the bounded current comparison before save", async () => {
  const draft = authorityDraft()
  let saves = 0
  const gateway = createProductionStage3ProductsGateway({
    userId: "owner-a",
    persistence: {
      ...persistence(draft),
      loadAuthorityFacts: async () => conditionerReplacementFacts(),
      save: async (input) => {
        saves += 1
        return { outcome: "saved", draft: input.draft }
      },
    },
  })

  for (const selectedCandidateId of ["replacement-4", "forged"]) {
    await assert.rejects(
      () =>
        gateway.resolveDecision({
          draftId: draft.draftId,
          expectedRevision: draft.revision,
          intent: {
            type: "resolve_decision",
            subjectKey: "decision:conditioner:conditioner_rinse_out:capture-a",
            action: "select_replacement",
            selectedCandidateId,
            selectedCandidateFactFingerprint: `facts-${selectedCandidateId}`,
          },
        }),
      (error: unknown) =>
        error instanceof Stage3AuthorityMutationError &&
        error.code === "stage3_replacement_candidate_invalid",
    )
  }
  assert.equal(saves, 0)
})

test("selected replacement rejects changed facts for the same viewed candidate", async () => {
  const draft = authorityDraft()
  let saves = 0
  const gateway = createProductionStage3ProductsGateway({
    userId: "owner-a",
    persistence: {
      ...persistence(draft),
      loadAuthorityFacts: async () => conditionerReplacementFacts(),
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
          action: "select_replacement",
          selectedCandidateId: "replacement-2",
          selectedCandidateFactFingerprint: "facts-replacement-2-viewed",
        },
      }),
    (error: unknown) =>
      error instanceof Stage3AuthorityMutationError &&
      error.code === "stage3_replacement_candidate_invalid",
  )
  assert.equal(saves, 0)
})

test("replacement completion rejects stale recommendation fingerprints before compile", async () => {
  const draft = selectedReplacementDraft("facts-replacement-2-old")
  let compileCalls = 0
  const gateway = createProductionStage3ProductsGateway({
    userId: "owner-a",
    persistence: {
      ...persistence(draft),
      loadCurrentCatalogProduct: async () => ({
        userProductId: "owned-a",
        productId: "catalog-a",
        displayName: "Current Conditioner",
        imageUrl: null,
        category: "conditioner" as const,
      }),
      loadAuthorityFacts: async () => conditionerReplacementFacts(),
    } as unknown as Stage3ProductionPersistence,
    compiler: {
      compile: async () => {
        compileCalls += 1
        throw new Error("compile must not run for stale replacement")
      },
    },
    stager: {
      stage: async () => {
        throw new Error("stage must not run for stale replacement")
      },
    },
  })

  const result = await gateway.complete({
    draftId: draft.draftId,
    expectedRevision: draft.revision,
  })

  assert.equal(result.status, "not_ready")
  assert.equal(compileCalls, 0)
})

test("review bundles reuse one authority fact read for evaluation and comparison", async () => {
  const draft = authorityDraft()
  let factReads = 0
  const gateway = createProductionStage3ProductsGateway({
    userId: "owner-a",
    persistence: {
      ...persistence(draft),
      loadAuthorityFacts: async () => {
        factReads += 1
        return conditionerReplacementFacts()
      },
    },
  })

  const bundles = await gateway.reviewDecisionBundles({ draftId: draft.draftId })

  assert.equal(factReads, 1)
  assert.equal(bundles.length, 1)
  assert.equal(bundles[0]?.authorityEvaluation.subjectKey, bundles[0]?.fitComparison.subjectKey)
  assert.deepEqual(
    bundles[0]?.fitComparison.alternatives.map((candidate) => candidate.productId),
    ["replacement-1", "replacement-2", "replacement-3"],
  )
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

/**
 * A server-derived deferral records WHY the role was left uncovered, on the
 * decision itself — the draft is the only place that reason has to survive, so
 * no schema migration is involved. Direct acceptance is the writer
 * (`direct-acceptance/accept.ts`); the reason is never taken from a client.
 */
test("a server-derived deferral persists its reason on the uncovered decision", async () => {
  const pending = pendingAuthorityDraft()

  async function resolve(deferralReason: Stage3DecisionDeferralReason) {
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
        action: "leave_uncovered",
        deferralReason,
      },
    })
    assert.equal(result.status, "saved")
    if (result.status !== "saved") throw new Error("expected a saved deferral")
    return result.draft.decisions[0]!
  }

  const refinement = await resolve("refinement_required")
  assert.equal(refinement.choiceState, "unassigned")
  assert.equal(refinement.resolutionAction, "leave_uncovered")
  assert.equal(refinement.deferralReason, "refinement_required")
  assert.deepEqual(validateStage3Draft({ ...pending, decisions: [refinement] }), [])

  // Every reason of the union has to survive the same write path.
  for (const reason of STAGE3_DECISION_DEFERRAL_REASONS) {
    assert.equal((await resolve(reason)).deferralReason, reason)
  }
})

test("a deferral reason on any other action is rejected before persistence", async () => {
  const pending = pendingAuthorityDraft()
  let saves = 0
  const base = persistence(pending)
  const gateway = createProductionStage3ProductsGateway({
    userId: "owner-a",
    persistence: {
      ...base,
      save: async (input) => {
        saves += 1
        return base.save(input)
      },
    },
  })

  await assert.rejects(
    () =>
      gateway.resolveDecision({
        draftId: pending.draftId,
        expectedRevision: pending.revision,
        intent: {
          type: "resolve_decision",
          subjectKey: "decision:conditioner:conditioner_rinse_out:capture-a",
          action: "keep_pending",
          deferralReason: "no_product",
        },
      }),
    (error: unknown) =>
      error instanceof Stage3AuthorityMutationError &&
      error.code === "stage3_authority_action_invalid",
  )
  assert.equal(saves, 0)
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

test("production authority keeps fit evaluation suppressed while a need revision is pending", async () => {
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
  assert.equal(draft.productLoadResolution, undefined)
  assert.equal(draft.inventoryAuthority?.status, "pending")

  const gateway = createProductionStage3ProductsGateway({
    userId: "owner-a",
    persistence: {
      ...persistence(draft),
      loadRequirements: async () => [dryShampooRequirement],
    },
  })

  const evaluations = await gateway.evaluateDecisions({ draftId: draft.draftId })
  assert.deepEqual(evaluations, [])
})

test("production repairs and accepts inventory authority from the owner-scoped refined snapshot", async () => {
  const requirement: Stage3CategoryRequirement = {
    category: "dry_shampoo",
    requiredRoles: [],
    needSummary: "Aktuelles Trockenshampoo erfassen",
    authorityVersion: CATEGORY_ROLE_POLICIES.dry_shampoo.authorityVersion,
  }
  const baseSnapshot = {
    inputHash: "refined-input-a",
    profile: {
      source: { projection: "refined_post_plan" },
      hair: { thickness: "normal" },
      retainedAnswer: "survives",
    },
    decisions: [],
    coverage: [],
    renderedOrder: ["dry_shampoo"],
  } as never
  const initial = createStage3Draft({
    draftId: "draft-snapshot-wire",
    userId: "owner-a",
    personalPlanId: "plan-a",
    refinedVersionId: "refined-a",
    requirements: [requirement],
    now: "2026-08-08T00:00:00.000Z",
    authoritySnapshot: {
      schemaVersion: 1,
      refinedNeedVersionId: "refined-a",
      refinedInputHash: "refined-input-a",
      productLoadContext: {
        schemaVersion: 1,
        scalpOiliness: "balanced",
        deepCleansingScalpPause: false,
        hasLowVolumeOrWeighedDown: false,
        shampooFrequency: "weekly_2x",
        oilPurposes: [],
      },
      categoryDecisions: [],
      coverage: [],
      orderedCategories: ["dry_shampoo"],
      inventoryOnlyCategories: ["dry_shampoo"],
      authorityVersions: Object.fromEntries(
        Object.entries(CATEGORY_ROLE_POLICIES).map(([category, policy]) => [
          category,
          policy.authorityVersion,
        ]),
      ) as never,
    },
  })
  const captured = addCapturedProduct(initial, {
    capturedProductId: "dry-snapshot",
    userProductId: "owned-dry-snapshot",
    identity: {
      kind: "pending_submission",
      submissionId: "submission-dry-snapshot",
      displayName: "Trockenshampoo",
      category: "dry_shampoo",
      reviewStatus: "pending_review",
    },
    frequencyRange: "weekly_3_4x",
    ownership: "owned",
    source: "existing_inventory",
  })
  // Simulates an older cursorless persisted capture that must be repaired.
  let canonical: Stage3ProductDraft = {
    ...captured,
    pass: "product_capture",
    categoryCursor: null,
    completedCaptureCategories: ["dry_shampoo"],
  }
  let snapshotReads = 0
  const gateway = createProductionStage3ProductsGateway({
    userId: "owner-a",
    persistence: {
      ...persistence(canonical),
      loadOrCreate: async () => ({ draft: canonical, requirements: [requirement] }),
      loadDraft: async () => canonical,
      loadRequirements: async () => [requirement],
      loadRefinedNeedSnapshot: async () => {
        snapshotReads += 1
        return canonical.inventoryAuthority?.proposedOutputSnapshot ?? baseSnapshot
      },
      loadCurrentRefinedVersionId: async () => canonical.refinedVersionId,
      save: async (input) => {
        canonical = input.draft
        return { outcome: "saved", draft: canonical }
      },
      resolveNeedRevision: async (input) => {
        canonical = {
          ...input.draft,
          refinedVersionId: "refined-accepted",
          authoritySnapshot: {
            ...input.draft.authoritySnapshot!,
            refinedNeedVersionId: "refined-accepted",
            orderedCategories: input.draft.orderedCategories,
            inventoryOnlyCategories: ["dry_shampoo"],
          },
        }
        return { outcome: "saved", draft: canonical }
      },
    },
  })
  const repaired = await gateway.loadOrCreate({
    draftId: "server-derived",
    userId: "owner-a",
    personalPlanId: "plan-a",
    refinedVersionId: "refined-a",
    requirements: [],
  })
  const authority = repaired.draft.inventoryAuthority
  assert.equal(authority?.status, "pending")
  assert.equal(authority?.proposedOutputSnapshot?.profile.hair.thickness, "normal")
  assert.equal(
    (authority?.proposedOutputSnapshot?.profile as { retainedAnswer?: string })?.retainedAnswer,
    "survives",
  )
  const accepted = await gateway.resolveNeedRevision({
    draftId: repaired.draft.draftId,
    expectedRevision: repaired.draft.revision,
    expectedProposalFingerprint: authority!.proposalFingerprint!,
    action: "accept",
  })
  assert.equal(accepted.status, "saved")
  const evaluations = await gateway.evaluateDecisions({ draftId: repaired.draft.draftId })
  assert.ok(evaluations.length > 0)
  assert.ok(snapshotReads >= 2)
})

test("pending need authority retains the proposal delta instead of an executable coverage overlay", async () => {
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
  assert.equal(draft.productLoadResolution, undefined)
  assert.equal(draft.inventoryAuthority?.status, "pending")
  assert.ok(draft.inventoryAuthority?.materialDelta.length)

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
  assert.deepEqual(evaluations, [])
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

test("loadOrCreate refreshes an active Shampoo v3 snapshot to v4 and leaves completed v3 immutable", async () => {
  const draft = authorityDraft()
  const authoritySnapshot = draft.authoritySnapshot!
  const stale = {
    ...draft,
    orderedCategories: ["conditioner", "shampoo"] as PersonalPlanCategory[],
    authorityVersions: {
      ...draft.authorityVersions,
      shampoo: "personal-plan.shampoo.v3",
    },
    authoritySnapshot: {
      ...authoritySnapshot,
      orderedCategories: ["conditioner", "shampoo"] as PersonalPlanCategory[],
      inventoryOnlyCategories: [],
      categoryDecisions: [
        ...authoritySnapshot.categoryDecisions,
        {
          category: "shampoo" as const,
          resolution: "resolved" as const,
          needTier: "basis" as const,
          roles: ["shampoo_everyday" as const],
          target: {
            category: "shampoo" as const,
            roles: ["shampoo_everyday" as const],
            scalpRoute: "balanced" as const,
            everydayConstraint: "standard" as const,
            requiresTargetedDandruffCapability: false,
          },
          frequency: null,
          reasons: [],
          executionState: "available" as const,
          executionPauseReason: null,
          deferredFacts: [],
        },
      ],
      authorityVersions: {
        ...authoritySnapshot.authorityVersions,
        shampoo: "personal-plan.shampoo.v3",
      },
    },
  }
  const refreshed = {
    ...stale,
    revision: stale.revision + 1,
    authorityVersions: {
      ...stale.authorityVersions,
      shampoo: CATEGORY_ROLE_POLICIES.shampoo.authorityVersion,
    },
    decisions: [],
    completedDecisionKeys: [],
    authoritySnapshot: {
      ...stale.authoritySnapshot,
      authorityVersions: {
        ...stale.authoritySnapshot.authorityVersions,
        shampoo: CATEGORY_ROLE_POLICIES.shampoo.authorityVersion,
      },
    },
  }
  let refreshCalls = 0
  const gateway = createProductionStage3ProductsGateway({
    userId: "owner-a",
    persistence: {
      ...persistence(stale),
      loadRefinedNeedSnapshot: async () => refinedSnapshotForAuthority(refreshed),
      refreshAuthorityDraft: async (input: { draftId: string; expectedRevision: number }) => {
        refreshCalls += 1
        assert.equal(input.draftId, stale.draftId)
        assert.equal(input.expectedRevision, stale.revision)
        return { outcome: "saved" as const, draft: refreshed }
      },
    } as never,
  })

  const resumed = await gateway.loadOrCreate({
    draftId: "server-derived",
    userId: "owner-a",
    personalPlanId: stale.personalPlanId,
    refinedVersionId: stale.refinedVersionId,
    requirements,
  })

  assert.equal(refreshCalls, 1)
  assert.equal(
    resumed.draft.authoritySnapshot?.authorityVersions.shampoo,
    CATEGORY_ROLE_POLICIES.shampoo.authorityVersion,
  )
  assert.equal(
    resumed.draft.authorityVersions.shampoo,
    CATEGORY_ROLE_POLICIES.shampoo.authorityVersion,
  )
  assert.deepEqual(resumed.draft.decisions, [])

  const completed = { ...stale, status: "completed" as const }
  const completedGateway = createProductionStage3ProductsGateway({
    userId: "owner-a",
    persistence: {
      ...persistence(completed),
      refreshAuthorityDraft: async () => {
        throw new Error("completed draft must remain immutable")
      },
    } as never,
  })
  const frozen = await completedGateway.loadOrCreate({
    draftId: "server-derived",
    userId: "owner-a",
    personalPlanId: completed.personalPlanId,
    refinedVersionId: completed.refinedVersionId,
    requirements,
  })
  assert.equal(frozen.draft.status, "completed")
  assert.equal(
    frozen.draft.authoritySnapshot?.authorityVersions.shampoo,
    "personal-plan.shampoo.v3",
  )
  assert.deepEqual(await completedGateway.evaluateDecisions({ draftId: completed.draftId }), [])
  assert.deepEqual(await completedGateway.reviewDecisionBundles({ draftId: completed.draftId }), [])
})

test("authority refresh admits only an agreed Shampoo v3 snapshot with every other authority current", async () => {
  const current = authorityDraft()
  const exact = {
    ...current,
    orderedCategories: ["conditioner", "shampoo"] as PersonalPlanCategory[],
    authorityVersions: {
      ...current.authorityVersions,
      shampoo: "personal-plan.shampoo.v3",
    },
    authoritySnapshot: {
      ...current.authoritySnapshot!,
      orderedCategories: ["conditioner", "shampoo"] as PersonalPlanCategory[],
      inventoryOnlyCategories: [],
      categoryDecisions: [
        ...current.authoritySnapshot!.categoryDecisions,
        {
          category: "shampoo" as const,
          resolution: "resolved" as const,
          needTier: "basis" as const,
          roles: ["shampoo_everyday" as const],
          target: {
            category: "shampoo" as const,
            roles: ["shampoo_everyday" as const],
            scalpRoute: "balanced" as const,
            everydayConstraint: "standard" as const,
            requiresTargetedDandruffCapability: false,
          },
          frequency: null,
          reasons: [],
          executionState: "available" as const,
          executionPauseReason: null,
          deferredFacts: [],
        },
      ],
      authorityVersions: {
        ...current.authoritySnapshot!.authorityVersions,
        shampoo: "personal-plan.shampoo.v3",
      },
    },
  }
  const invalidDrafts = [
    {
      name: "unknown Shampoo version",
      draft: {
        ...exact,
        authorityVersions: { ...exact.authorityVersions, shampoo: "personal-plan.shampoo.v2" },
        authoritySnapshot: {
          ...exact.authoritySnapshot,
          authorityVersions: {
            ...exact.authoritySnapshot.authorityVersions,
            shampoo: "personal-plan.shampoo.v2",
          },
        },
      },
    },
    {
      name: "draft and signed version disagreement",
      draft: {
        ...exact,
        authoritySnapshot: {
          ...exact.authoritySnapshot,
          authorityVersions: {
            ...exact.authoritySnapshot.authorityVersions,
            shampoo: "personal-plan.shampoo.v2",
          },
        },
      },
    },
    {
      name: "non-Shampoo authority drift",
      draft: {
        ...exact,
        authorityVersions: {
          ...exact.authorityVersions,
          conditioner: "personal-plan.conditioner.v2",
        },
        authoritySnapshot: {
          ...exact.authoritySnapshot,
          authorityVersions: {
            ...exact.authoritySnapshot.authorityVersions,
            conditioner: "personal-plan.conditioner.v2",
          },
        },
      },
    },
    {
      name: "missing required category decision",
      draft: {
        ...exact,
        authoritySnapshot: { ...exact.authoritySnapshot, categoryDecisions: [] },
      },
    },
    {
      name: "malformed category decision",
      draft: {
        ...exact,
        authoritySnapshot: {
          ...exact.authoritySnapshot,
          categoryDecisions: [
            { ...exact.authoritySnapshot.categoryDecisions[0]!, roles: "shampoo_everyday" },
          ],
        },
      },
    },
    {
      name: "unknown draft authority category",
      draft: {
        ...exact,
        authorityVersions: { ...exact.authorityVersions, mystery: "personal-plan.mystery.v1" },
      },
    },
    {
      name: "unknown signed authority category",
      draft: {
        ...exact,
        authoritySnapshot: {
          ...exact.authoritySnapshot,
          authorityVersions: {
            ...exact.authoritySnapshot.authorityVersions,
            mystery: "personal-plan.mystery.v1",
          },
        },
      },
    },
    {
      name: "invalid but array-shaped role",
      draft: tamperSnapshotDecision(exact, "shampoo", { roles: ["not_a_real_role"] }),
    },
    {
      name: "non-object target",
      draft: tamperSnapshotDecision(exact, "shampoo", { target: 7 }),
    },
    {
      name: "target category and shape disagreement",
      draft: tamperSnapshotDecision(exact, "shampoo", {
        target: {
          category: "conditioner",
          roles: ["conditioner_rinse_out"],
          weight: "light",
          careDirection: "moisture",
          repairSupportLevel: "medium",
          functionalNeeds: [],
        },
      }),
    },
    {
      name: "invalid need tier",
      draft: tamperSnapshotDecision(exact, "shampoo", { needTier: 2 }),
    },
    {
      name: "malformed frequency",
      draft: tamperSnapshotDecision(exact, "shampoo", {
        frequency: { kind: "wet_wash_total", target: "weekly_2x" },
      }),
    },
    {
      name: "malformed reason",
      draft: tamperSnapshotDecision(exact, "shampoo", {
        reasons: [{ id: 9, salience: "primary", evidence: [], values: {} }],
      }),
    },
    {
      name: "malformed execution pause reason",
      draft: tamperSnapshotDecision(exact, "shampoo", {
        executionState: "paused",
        executionPauseReason: { id: "pause", salience: "invalid", evidence: [], values: {} },
      }),
    },
    {
      name: "schema-valid forged reason",
      expectSchemaValid: true,
      draft: tamperSnapshotDecision(exact, "shampoo", {
        reasons: [
          {
            id: "forged_but_well_formed",
            salience: "primary",
            evidence: [{ source: "assessment", key: "hair.thickness" }],
            values: { thickness: "normal" },
          },
        ],
      }),
    },
    {
      name: "schema-valid unrelated deferred fact",
      expectSchemaValid: true,
      draft: tamperSnapshotDecision(exact, "shampoo", {
        deferredFacts: ["current_product_load"],
      }),
    },
    {
      name: "schema-valid not-needed tier with active Shampoo target",
      expectSchemaValid: true,
      draft: tamperSnapshotDecision(exact, "shampoo", { needTier: "not_needed" }),
    },
    {
      name: "schema-valid Conditioner wash-total frequency",
      expectSchemaValid: true,
      draft: tamperSnapshotDecision(exact, "conditioner", {
        frequency: {
          kind: "wet_wash_total",
          mode: "retained_current",
          target: "weekly_2x",
          allowedRange: { min: "weekly_1x", max: "weekly_3_4x" },
          specialWashSubstitution: true,
        },
      }),
    },
  ]

  for (const invalidDraft of invalidDrafts) {
    const { name, draft } = invalidDraft
    if ("expectSchemaValid" in invalidDraft && invalidDraft.expectSchemaValid) {
      assert.equal(
        draft.authoritySnapshot!.categoryDecisions.every(isValidPersistedCategoryDecision),
        true,
        `${name} must reach semantic-authenticity validation`,
      )
    }
    let refreshCalls = 0
    const gateway = createProductionStage3ProductsGateway({
      userId: "owner-a",
      persistence: {
        ...persistence(draft as Stage3ProductDraft),
        loadRefinedNeedSnapshot: async () => refinedSnapshotForAuthority(exact),
        refreshAuthorityDraft: async () => {
          refreshCalls += 1
          return { outcome: "saved" as const, draft: current }
        },
      },
    })

    await assert.rejects(
      () => gateway.evaluateDecisions({ draftId: draft.draftId }),
      /stale_authority_snapshot/,
      name,
    )
    assert.equal(refreshCalls, 0, name)
  }
})

function refinedSnapshotForAuthority(source: Stage3ProductDraft) {
  const snapshot = source.authoritySnapshot!
  return {
    inputHash: snapshot.refinedInputHash,
    profile: {
      source: { projection: "refined_post_plan" },
      hair: { thickness: "normal" },
    },
    decisions: snapshot.categoryDecisions,
    coverage: snapshot.coverage,
    renderedOrder: snapshot.orderedCategories,
  } as never
}

function tamperSnapshotDecision(
  source: Stage3ProductDraft,
  category: PersonalPlanCategory,
  patch: Record<string, unknown>,
): Stage3ProductDraft {
  return {
    ...source,
    authoritySnapshot: {
      ...source.authoritySnapshot!,
      categoryDecisions: source.authoritySnapshot!.categoryDecisions.map((decision) =>
        decision.category === category ? ({ ...decision, ...patch } as never) : decision,
      ),
    },
  }
}

/* ── Stage-3 re-entry after a Stage-2 module completion staled the draft ── */

/**
 * Task 1.6 (a): `complete_module` stales the active Stage-3 draft of the
 * previous refined version. Re-entering Stage 3 with the now-stale version must
 * rebuild on the current one instead of dead-ending — the staled draft's
 * selections are gone by design.
 */
function emptyDraftOn(refinedVersionId: string): Stage3ProductDraft {
  const seed = readyDraft()
  return {
    ...createStage3Draft({
      draftId: "draft-b",
      userId: "owner-a",
      personalPlanId: "plan-a",
      refinedVersionId,
      requirements,
      now: "2026-08-25T00:00:00.000Z",
    }),
    authoritySnapshot: { ...seed.authoritySnapshot!, refinedNeedVersionId: refinedVersionId },
  }
}

function stalingPersistence(options: {
  currentRefinedVersionId: string
  loads: string[]
}): Stage3ProductionPersistence {
  const staled = readyDraft()
  return {
    ...persistence(staled),
    loadOrCreate: async (input) => {
      options.loads.push(input.refinedVersionId)
      if (input.refinedVersionId !== options.currentRefinedVersionId) {
        throw new Stage3AuthoritySnapshotError("stale_refined_source")
      }
      return { draft: emptyDraftOn(input.refinedVersionId), requirements }
    },
    loadCurrentRefinedVersionId: async () => options.currentRefinedVersionId,
  }
}

test("a Stage-3 load rebuilds on the current refined version after a module completion staled its draft", async () => {
  const loads: string[] = []
  const gateway = createProductionStage3ProductsGateway({
    userId: "owner-a",
    persistence: stalingPersistence({ currentRefinedVersionId: "refined-b", loads }),
  })

  const loaded = await gateway.loadOrCreate({
    draftId: "server-derived",
    userId: "owner-a",
    requirements: [],
    personalPlanId: "plan-a",
    refinedVersionId: "refined-a",
    rebuildOnStaleRefinedVersion: true,
  })

  assert.deepEqual(loads, ["refined-a", "refined-b"])
  assert.equal(loaded.draft.refinedVersionId, "refined-b")
  assert.equal(loaded.status, "active")
  // The staled draft's user selections are lost by design.
  assert.deepEqual(loaded.draft.products, [])
  assert.deepEqual(loaded.draft.decisions, [])
  assert.deepEqual(loaded.draft.completedCaptureCategories, [])
})

test("a Stage-3 load without the re-entry opt-in still fails closed on a stale refined version", async () => {
  const loads: string[] = []
  const gateway = createProductionStage3ProductsGateway({
    userId: "owner-a",
    persistence: stalingPersistence({ currentRefinedVersionId: "refined-b", loads }),
  })

  await assert.rejects(
    gateway.loadOrCreate({
      draftId: "server-derived",
      userId: "owner-a",
      requirements: [],
      personalPlanId: "plan-a",
      refinedVersionId: "refined-a",
    }),
    (error: unknown) =>
      error instanceof Stage3AuthoritySnapshotError && error.code === "stale_refined_source",
  )
  assert.deepEqual(loads, ["refined-a"])
})

test("the Stage-3 re-entry rebuild is attempted exactly once", async () => {
  const loads: string[] = []
  const gateway = createProductionStage3ProductsGateway({
    userId: "owner-a",
    persistence: {
      ...stalingPersistence({ currentRefinedVersionId: "refined-b", loads }),
      // The head moved again between the failed load and the head read.
      loadCurrentRefinedVersionId: async () => "refined-c",
    },
  })

  await assert.rejects(
    gateway.loadOrCreate({
      draftId: "server-derived",
      userId: "owner-a",
      requirements: [],
      personalPlanId: "plan-a",
      refinedVersionId: "refined-a",
      rebuildOnStaleRefinedVersion: true,
    }),
    (error: unknown) =>
      error instanceof Stage3AuthoritySnapshotError && error.code === "stale_refined_source",
  )
  assert.deepEqual(loads, ["refined-a", "refined-c"])
})

test("a Stage-3 re-entry never rebuilds on the version it was already asked for", async () => {
  const loads: string[] = []
  const gateway = createProductionStage3ProductsGateway({
    userId: "owner-a",
    persistence: {
      ...stalingPersistence({ currentRefinedVersionId: "refined-b", loads }),
      // The head agrees with the caller, so the stale error came from elsewhere
      // and retrying the identical load would only loop.
      loadCurrentRefinedVersionId: async () => "refined-a",
    },
  })

  await assert.rejects(
    gateway.loadOrCreate({
      draftId: "server-derived",
      userId: "owner-a",
      requirements: [],
      personalPlanId: "plan-a",
      refinedVersionId: "refined-a",
      rebuildOnStaleRefinedVersion: true,
    }),
    (error: unknown) =>
      error instanceof Stage3AuthoritySnapshotError && error.code === "stale_refined_source",
  )
  assert.deepEqual(loads, ["refined-a"])
})
