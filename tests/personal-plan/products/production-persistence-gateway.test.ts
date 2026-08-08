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
} from "../../../src/lib/personal-plan/products/state-machine"
import { createProposedProductPortfolio } from "../../../src/lib/personal-plan/products/portfolio"
import type {
  Stage3CategoryRequirement,
  Stage3ProductDraft,
} from "../../../src/lib/personal-plan/products/contracts"

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
  return recordProductDecision(captureComplete, {
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
    loadRequirements: async () => requirements,
    loadCompletedPortfolio: async () =>
      createProposedProductPortfolio(
        { ...draft, status: "active", pass: "ready_for_routine" },
        requirements,
        { portfolioVersionId: "portfolio-a", createdAt: "2026-08-08T00:01:00.000Z" },
      ),
    loadRefinedNeedSnapshot: async () => ({ needs: [] }) as never,
    loadSourceRevision: async () => 7,
    loadDraft: async (input) => (input.userId === "owner-a" ? draft : null),
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
  const gateway = createProductionStage3ProductsGateway({
    userId: "owner-a",
    persistence: {
      ...persistence(),
      loadRefinedNeedSnapshot: async () => {
        sourceReadOrder.push("snapshot")
        return { needs: [] } as never
      },
      loadSourceRevision: async () => {
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
  const result = await gateway.complete({ draftId: "draft-a", expectedRevision: 4 })
  assert.equal(result.status, "ready_for_routine")
  if (result.status !== "ready_for_routine") return
  assert.equal(result.productPortfolioVersionId, "portfolio-a")
  assert.equal(result.routineProposalId, "proposal-a")
  assert.equal(stageCalls, 1)
  assert.ok(compilerInput)
  assert.equal((compilerInput as Record<string, unknown>).expectedSourceRevision, 7)
  assert.deepEqual((compilerInput as Record<string, unknown>).refinedNeedSnapshot, { needs: [] })
  assert.deepEqual(sourceReadOrder, ["snapshot", "source-revision", "compile"])
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
