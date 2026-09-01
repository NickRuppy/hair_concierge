import assert from "node:assert/strict"
import test from "node:test"

import { CATEGORY_ROLE_POLICIES } from "../../../src/lib/personal-plan/products/authorities"
import type { Stage3AuthorityFactBundle } from "../../../src/lib/personal-plan/products/authority/catalog-facts"
import type {
  PersonalPlanCategory,
  Stage3CategoryRequirement,
  Stage3ProductDraft,
} from "../../../src/lib/personal-plan/products/contracts"
import { createProposedProductPortfolio } from "../../../src/lib/personal-plan/products/portfolio"
import {
  createProductionStage3ProductsGateway,
  type Stage3ProductionPersistence,
} from "../../../src/lib/personal-plan/products/production-persistence-gateway"
import {
  addCapturedProduct,
  assignProductRoles,
  completeCaptureCategory,
  createStage3Draft,
} from "../../../src/lib/personal-plan/products/state-machine"
import { recomputeRoutineAfterHabitsCompletion } from "../../../src/lib/personal-plan/refinement-recompute/orchestrator"
import type {
  Stage3RecomputeActiveRoutineVersion,
  Stage3RecomputeDeps,
} from "../../../src/lib/personal-plan/refinement-recompute/types"
import type { RoutinePayloadV1 } from "../../../src/lib/personal-plan/routine/contracts"
import type { PlanCategoryDecision } from "../../../src/lib/personal-plan/types"

/**
 * End-to-end integration lane for the headless habits recompute.
 *
 * Unlike `orchestrator.test.ts` (fake gateway) this drives the REAL production
 * gateway — `createProductionStage3ProductsGateway`, i.e. the real Stage-3
 * state machine, the real authority evaluation, the real portfolio builder and
 * the real completion path — against an in-memory persistence store. Only I/O
 * is faked; every state transition below is production code.
 *
 * That is the only way to see the defect this file exists for: a rebuilt
 * Stage-3 draft for a person who OWNS products starts in the `product_capture`
 * pass (`createStage3Draft` marks only NON-owned categories capture-complete),
 * so a rehydration that copies captures without driving the canonical capture
 * completion can never reach `canCreatePortfolio` and `complete()` answers
 * `not_ready` forever — for the lane's main cohort.
 */

const OWNER = "owner-a"
const PLAN_ID = "5f2b4b2a-0000-4000-8000-000000000001"
const REFINED_OLD = "5f2b4b2a-0000-4000-8000-0000000000aa"
const REFINED_NEW = "5f2b4b2a-0000-4000-8000-0000000000bb"

const requirements: Stage3CategoryRequirement[] = [
  {
    category: "conditioner",
    requiredRoles: ["conditioner_rinse_out"],
    needSummary: "Pflege",
    authorityVersion: CATEGORY_ROLE_POLICIES.conditioner.authorityVersion,
  },
]

const conditionerDecision: PlanCategoryDecision = {
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
}

function authoritySnapshot(
  refinedVersionId: string,
  refinedInputHash: string,
): NonNullable<Stage3ProductDraft["authoritySnapshot"]> {
  return {
    schemaVersion: 1,
    refinedNeedVersionId: refinedVersionId,
    refinedInputHash,
    // The real Stage-2 entry adapter always writes this, and its
    // `ownedCategories` is exactly what leaves an owned category
    // capture-INCOMPLETE on a freshly rebuilt draft.
    productLoadContext: {
      schemaVersion: 1,
      scalpOiliness: "balanced",
      deepCleansingScalpPause: false,
      hasLowVolumeOrWeighedDown: false,
      shampooFrequency: null,
      oilPurposes: [],
      ownedCategories: ["conditioner"],
    },
    categoryDecisions: [conditionerDecision],
    coverage: [],
    orderedCategories: ["conditioner"],
    authorityVersions: Object.fromEntries(
      Object.entries(CATEGORY_ROLE_POLICIES).map(([category, policy]) => [
        category,
        policy.authorityVersion,
      ]),
    ) as never,
  }
}

function conditionerFacts(productId: string, factFingerprint: string): Stage3AuthorityFactBundle {
  return {
    productFacts: {
      productId,
      displayName: "Pflege",
      category: "conditioner",
      isActive: true,
      lifecycleStatus: "active",
      recommendable: false,
      suitableThicknesses: ["normal"],
      knownReaction: false,
      protocols: [
        { role: "conditioner_rinse_out", status: "verified_complete", fingerprint: "protocol-a" },
      ],
      factFingerprint,
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

/** The immutable Stage-3 draft the active Routine version was compiled from. */
function sourceDraft(options: { retainedProduct: boolean }): Stage3ProductDraft {
  let draft = createStage3Draft({
    draftId: "draft-old",
    userId: OWNER,
    personalPlanId: PLAN_ID,
    refinedVersionId: REFINED_OLD,
    requirements,
    authoritySnapshot: authoritySnapshot(REFINED_OLD, "refined-input-old"),
    now: "2026-08-20T00:00:00.000Z",
  })
  draft = addCapturedProduct(draft, {
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
  if (options.retainedProduct) {
    draft = addCapturedProduct(draft, {
      capturedProductId: "capture-b",
      userProductId: "owned-b",
      identity: {
        kind: "catalog_product",
        productId: "catalog-b",
        displayName: "Alte Pflege",
        category: "conditioner",
      },
      frequencyRange: "weekly_1x",
      ownership: "owned",
      source: "existing_inventory",
    })
  }
  draft = assignProductRoles(draft, {
    capturedProductId: "capture-a",
    category: "conditioner",
    roles: ["conditioner_rinse_out"],
  })
  draft = completeCaptureCategory(draft, "conditioner", requirements)
  return {
    ...draft,
    status: "completed",
    pass: "ready_for_routine",
    // Completion freezes `source_product_draft_revision` and only then bumps
    // the row, so the completed draft sits exactly one revision above it.
    revision: 10,
    inventoryDispositions: (draft.inventoryDispositions ?? []).map((disposition) => ({
      ...disposition,
      acknowledged: true,
    })),
  }
}

function activeRoutinePayload(): RoutinePayloadV1 {
  return {
    schemaVersion: 1,
    planId: PLAN_ID,
    versionId: "routine-old",
    parentVersionId: null,
    source: {
      refinedVersionId: REFINED_OLD,
      productPortfolioVersionId: "portfolio-old",
      sourceFingerprint: "f".repeat(64),
      compilerVersion: "test",
      authorityVersions: {},
    },
    intent: {
      schemaVersion: 1,
      categories: [
        {
          category: "conditioner",
          inclusion: "included",
          inclusionSource: "stage3",
          assignments: [
            {
              assignmentKey: "assignment-a",
              role: "conditioner_rinse_out",
              productRef: { kind: "owned", capturedProductId: "capture-a", productId: "catalog-a" },
              cadenceOverride: null,
              fitDecision: "standard",
            },
          ],
        },
      ],
    },
    sections: [
      { key: "basis", itemKeys: ["item-a"] },
      { key: "optional", itemKeys: [] },
    ],
    items: [
      {
        itemKey: "item-a",
        assignmentKey: "assignment-a",
        category: "conditioner",
        role: "conditioner_rinse_out",
        purposeKey: "purpose-a",
        roleOrder: 0,
        state: {
          systemAssessment: "basis",
          inclusion: "included",
          availability: "owned",
          fitDecision: "standard",
        },
        product: {
          kind: "owned",
          capturedProductId: "capture-a",
          productId: "catalog-a",
          displayName: "Pflege",
        },
        cadence: { recommended: null, userOverride: null, displayKey: "weekly_2x" },
        sourceDecisionKeys: ["decision:conditioner:conditioner_rinse_out:capture-a"],
        authorityRuleIds: [],
        executable: true,
      },
    ],
    createdAt: "2026-08-20T00:00:00.000Z",
  } as RoutinePayloadV1
}

type World = {
  drafts: Map<string, Stage3ProductDraft>
  currentRefinedVersionId: string
  sourceRevision: number
  activeRoutine: Stage3RecomputeActiveRoutineVersion
  /** draftId -> the frozen completion receipt SQL would have written. */
  receipts: Map<
    string,
    { portfolioVersionId: string; routineVersionId: string; routineProposalId: string | null }
  >
  routineVersions: number
}

function createWorld(options: { retainedProduct: boolean }): World {
  const source = sourceDraft(options)
  return {
    drafts: new Map([[source.draftId, source]]),
    currentRefinedVersionId: REFINED_NEW,
    sourceRevision: 7,
    activeRoutine: {
      routineVersionId: "routine-old",
      payload: activeRoutinePayload(),
      source: {
        refinedVersionId: REFINED_OLD,
        productDraftId: "draft-old",
        productDraftRevision: 9,
      },
    },
    receipts: new Map([
      [
        "draft-old",
        {
          portfolioVersionId: "portfolio-old",
          routineVersionId: "routine-old",
          routineProposalId: null,
        },
      ],
    ]),
    routineVersions: 1,
  }
}

function refinedInputHashFor(refinedVersionId: string): string {
  return refinedVersionId === REFINED_OLD ? "refined-input-old" : "refined-input-new"
}

function createPersistence(world: World): Stage3ProductionPersistence {
  return {
    async loadOrCreate({ personalPlanId, refinedVersionId }) {
      const existing = [...world.drafts.values()].find(
        (draft) => draft.refinedVersionId === refinedVersionId && draft.status !== "stale",
      )
      if (existing) return { draft: existing, requirements }
      const created = createStage3Draft({
        draftId: `draft-${refinedVersionId}`,
        userId: OWNER,
        personalPlanId,
        refinedVersionId,
        requirements,
        authoritySnapshot: authoritySnapshot(
          refinedVersionId,
          refinedInputHashFor(refinedVersionId),
        ),
        now: "2026-08-31T00:00:00.000Z",
      })
      world.drafts.set(created.draftId, created)
      return { draft: created, requirements }
    },
    async save({ draftId, expectedRevision, draft }) {
      const stored = world.drafts.get(draftId)
      if (!stored) throw new Error(`unknown draft ${draftId}`)
      if (stored.revision !== expectedRevision) {
        return { outcome: "revision_conflict", draft: stored }
      }
      const next = { ...draft, revision: expectedRevision + 1 }
      world.drafts.set(draftId, next)
      return { outcome: "saved", draft: next }
    },
    async resolveNeedRevision({ draftId, expectedRevision, draft }) {
      const next = { ...draft, revision: expectedRevision + 1 }
      world.drafts.set(draftId, next)
      return { outcome: "saved", draft: next }
    },
    async search(input) {
      return { query: input.query, category: input.category, candidates: [], totalCapped: false }
    },
    async resolveOwnedCatalogProduct() {
      return null
    },
    async loadCurrentCatalogProduct(input) {
      return {
        userProductId: input.userProductId,
        productId: input.productId,
        displayName: input.productId === "catalog-a" ? "Pflege" : "Alte Pflege",
        imageUrl: null,
        category: input.category,
      }
    },
    async loadRequirements() {
      return requirements
    },
    async loadCompletedPortfolio({ draftId }) {
      const draft = world.drafts.get(draftId)
      if (!draft) return null
      return createProposedProductPortfolio({ ...draft, status: "active" }, requirements, {
        portfolioVersionId: world.receipts.get(draftId)?.portfolioVersionId ?? "portfolio-x",
        createdAt: "2026-08-31T00:01:00.000Z",
      })
    },
    async loadCompletionReceipt({ draftId }) {
      const receipt = world.receipts.get(draftId)
      const draft = world.drafts.get(draftId)
      if (!receipt || !draft) return null
      return {
        portfolio: createProposedProductPortfolio({ ...draft, status: "active" }, requirements, {
          portfolioVersionId: receipt.portfolioVersionId,
          createdAt: "2026-08-31T00:01:00.000Z",
        }),
        productPortfolioVersionId: receipt.portfolioVersionId,
        routineVersionId: receipt.routineVersionId,
        routineProposalId: receipt.routineProposalId,
      }
    },
    async loadRefinedNeedSnapshot({ refinedVersionId }) {
      return {
        inputHash: refinedInputHashFor(refinedVersionId),
        profile: {
          source: { projection: "refined_post_plan" },
          hair: { thickness: "normal" },
        },
      } as never
    },
    async loadSourceRevision() {
      return world.sourceRevision
    },
    async loadCurrentRefinedVersionId() {
      return world.currentRefinedVersionId
    },
    async loadAuthorityFacts({ subject }) {
      const productId =
        subject.capturedProductId === "capture-b" ? "catalog-b" : ("catalog-a" as string)
      return subject.category === ("conditioner" as PersonalPlanCategory)
        ? conditionerFacts(productId, `facts-${productId}`)
        : {
            productFacts: null,
            recommendationCandidates: [],
            heatCarrierCoverage: { carrierCategory: null, verifiedRoutes: [] },
          }
    },
    async loadDraft({ userId, draftId }) {
      if (userId !== OWNER) return null
      return world.drafts.get(draftId) ?? null
    },
  }
}

function createDeps(world: World): Stage3RecomputeDeps {
  const persistence = createPersistence(world)
  return {
    gateway: createProductionStage3ProductsGateway({
      userId: OWNER,
      persistence,
      compiler: {
        async compile() {
          return {
            schemaVersion: 1,
            compilerVersion: "test",
            authorityVersions: {},
            sourceFingerprint: "b".repeat(64),
            payload: { steps: [] },
            proposalDelta: {},
          }
        },
      },
      stager: {
        /**
         * Mirrors `personal_plan_complete_draft_activate_v2` for a
         * module-driven completion: complete the draft, freeze the portfolio,
         * compile the successor Routine and activate it in the same
         * transaction (no pending proposal).
         */
        async stage({ productDraftId }) {
          const draft = world.drafts.get(productDraftId)
          if (!draft) throw new Error(`unknown draft ${productDraftId}`)
          const existing = world.receipts.get(productDraftId)
          if (draft.status === "completed" && existing) {
            return {
              status: "already_completed",
              portfolioVersionId: existing.portfolioVersionId,
              routineVersionId: existing.routineVersionId,
              routineProposalId: existing.routineProposalId,
              revision: draft.revision,
            }
          }
          world.routineVersions += 1
          const routineVersionId = `routine-${world.routineVersions}`
          const portfolioVersionId = `portfolio-${world.routineVersions}`
          const completed: Stage3ProductDraft = {
            ...draft,
            status: "completed",
            pass: "ready_for_routine",
            revision: draft.revision + 1,
          }
          world.drafts.set(productDraftId, completed)
          world.receipts.set(productDraftId, {
            portfolioVersionId,
            routineVersionId,
            routineProposalId: null,
          })
          world.activeRoutine = {
            routineVersionId,
            payload: { ...activeRoutinePayload(), versionId: routineVersionId },
            source: {
              refinedVersionId: draft.refinedVersionId,
              productDraftId,
              productDraftRevision: draft.revision,
            },
          }
          return {
            status: "completed",
            portfolioVersionId,
            routineVersionId,
            routineProposalId: null,
            revision: completed.revision,
          }
        },
      },
    }),
    persistence,
    routineState: {
      async loadActiveRoutineVersion() {
        return world.activeRoutine
      },
    },
    routineReactivator: {
      async reactivateRoutineForProductDraft() {
        // These scenarios acquire an ACTIVE draft, so the A→B→A re-activation
        // path is never reached. Its own coverage is the real-SQL lane in
        // tests/personal-plan-refinement-recompute-activation-migration.test.ts.
        throw new Error("routineReactivator must not be reached on the rehydration path")
      },
    },
  }
}

test("a rebuilt draft for a person who owns products completes and activates", async () => {
  const world = createWorld({ retainedProduct: false })

  const result = await recomputeRoutineAfterHabitsCompletion(createDeps(world), {
    userId: OWNER,
    personalPlanId: PLAN_ID,
    refinedVersionId: REFINED_NEW,
  })

  assert.deepEqual(result, { status: "applied", routineVersionId: "routine-2" })
  assert.equal(world.activeRoutine.source.refinedVersionId, REFINED_NEW)

  const rebuilt = world.drafts.get(`draft-${REFINED_NEW}`)!
  assert.equal(rebuilt.status, "completed")
  // The person's own product survived the recompute.
  assert.deepEqual(
    rebuilt.roleAssignments.map((assignment) => [assignment.category, ...assignment.roles]),
    [["conditioner", "conditioner_rinse_out"]],
  )
  assert.deepEqual(
    rebuilt.decisions.map((decision) => [decision.decisionKey, decision.choiceState]),
    [["decision:conditioner:conditioner_rinse_out:capture-a", "owned_active"]],
  )
})

test("a retained (unassigned) product's disposition never blocks the recompute", async () => {
  const world = createWorld({ retainedProduct: true })

  const result = await recomputeRoutineAfterHabitsCompletion(createDeps(world), {
    userId: OWNER,
    personalPlanId: PLAN_ID,
    refinedVersionId: REFINED_NEW,
  })

  assert.deepEqual(result, { status: "applied", routineVersionId: "routine-2" })

  const rebuilt = world.drafts.get(`draft-${REFINED_NEW}`)!
  const dispositions = rebuilt.inventoryDispositions ?? []
  assert.deepEqual(
    dispositions.map((disposition) => [disposition.capturedProductId, disposition.acknowledged]),
    [["capture-b", true]],
  )
  // Derived by the real state machine, not hand-written by the rehydration.
  assert.match(dispositions[0]!.authorityFingerprint, /^[0-9a-f]{64}$/)
  assert.equal(dispositions[0]!.reason, "not_assigned_to_final_role")
})
