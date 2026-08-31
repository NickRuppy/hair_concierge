import assert from "node:assert/strict"
import test from "node:test"

import { CATEGORY_ROLE_POLICIES } from "../../../src/lib/personal-plan/products/authorities"
import type { Stage3AuthorityEvaluation } from "../../../src/lib/personal-plan/products/authority/contracts"
import type {
  AnyProposedProductPortfolio,
  PersonalPlanCategory,
  Stage3CategoryRequirement,
  Stage3ProductDraft,
} from "../../../src/lib/personal-plan/products/contracts"
import { stage3DecisionKey } from "../../../src/lib/personal-plan/products/contracts"
import type {
  Stage3CompleteResponse,
  Stage3MutationResponse,
} from "../../../src/lib/personal-plan/products/gateway"
import { createStage3Draft } from "../../../src/lib/personal-plan/products/state-machine"
import { recomputeRoutineAfterHabitsCompletion } from "../../../src/lib/personal-plan/refinement-recompute/orchestrator"
import type {
  Stage3RecomputeActiveRoutineVersion,
  Stage3RecomputeGateway,
  Stage3RecomputeRoutineStateReader,
  Stage3RehydrationPersistence,
} from "../../../src/lib/personal-plan/refinement-recompute/types"
import type { RoutinePayloadV1 } from "../../../src/lib/personal-plan/routine/contracts"
import type { PlanProductRole } from "../../../src/lib/personal-plan/types"

const USER_ID = "owner-a"
const PLAN_ID = "plan-a"
const REFINED_OLD = "refined-old"
const REFINED_NEW = "refined-new"

function requirement(
  category: PersonalPlanCategory,
  requiredRoles: PlanProductRole[],
): Stage3CategoryRequirement {
  return {
    category,
    requiredRoles,
    needSummary: category,
    authorityVersion: CATEGORY_ROLE_POLICIES[category].authorityVersion,
  }
}

const targetRequirements = [requirement("shampoo", ["shampoo_everyday"])]

/** The immutable Stage-3 draft the active routine version was compiled from. */
function sourceDraft(): Stage3ProductDraft {
  const base = createStage3Draft({
    draftId: "draft-source",
    userId: USER_ID,
    personalPlanId: PLAN_ID,
    refinedVersionId: REFINED_OLD,
    requirements: targetRequirements,
    now: "2026-08-20T00:00:00.000Z",
  })
  return {
    ...base,
    status: "completed",
    pass: "ready_for_routine",
    // Completion records source_product_draft_revision (9) and then bumps the
    // draft row, so the completed row sits one revision above the recorded one
    // (see EXPECTED_SOURCE_COMPLETION_REVISION_OFFSET in rehydration.ts).
    revision: 10,
    categoryCursor: null,
    completedCaptureCategories: ["shampoo"],
    products: [
      {
        capturedProductId: "capture-shampoo",
        userProductId: "owned-shampoo",
        identity: {
          kind: "catalog_product",
          productId: "catalog-shampoo",
          displayName: "Shampoo",
          category: "shampoo",
        },
        frequencyRange: "weekly_3_4x",
        ownership: "owned",
        source: "catalog_search",
      },
    ],
    roleAssignments: [
      { capturedProductId: "capture-shampoo", category: "shampoo", roles: ["shampoo_everyday"] },
    ],
    uncoveredRoles: [],
    decisions: [],
    completedDecisionKeys: [],
    inventoryDispositions: [],
  }
}

/** Freshly rebuilt, empty Stage-3 draft `loadOrCreate` hands back. */
function freshDraft(
  refinedVersionId: string,
  draftId = "draft-target",
  overrides: Partial<Stage3ProductDraft> = {},
): Stage3ProductDraft {
  return {
    ...createStage3Draft({
      draftId,
      userId: USER_ID,
      personalPlanId: PLAN_ID,
      refinedVersionId,
      requirements: targetRequirements,
      now: "2026-08-31T00:00:00.000Z",
    }),
    ...overrides,
  }
}

/** `loadOrCreate`'s full `Stage3DraftResponse` shape, from just a draft. */
function draftResponse(draft: Stage3ProductDraft, requirements = targetRequirements) {
  return { status: draft.status, draft, requirements }
}

function ownedRoutineItem(capturedProductId: string): RoutinePayloadV1["items"][number] {
  const key = stage3DecisionKey("shampoo", "shampoo_everyday", capturedProductId)
  return {
    itemKey: `item:${capturedProductId}`,
    assignmentKey: `assignment:${capturedProductId}`,
    category: "shampoo",
    role: "shampoo_everyday",
    purposeKey: "shampoo_everyday",
    roleOrder: 0,
    state: {
      systemAssessment: "basis",
      inclusion: "included",
      availability: "owned",
      fitDecision: "standard",
    },
    product: {
      kind: "owned",
      capturedProductId,
      productId: `catalog-${capturedProductId}`,
      displayName: "Shampoo",
    },
    cadence: { recommended: null, userOverride: null, displayKey: "personal_plan.cadence.none" },
    sourceDecisionKeys: [key],
    authorityRuleIds: [],
    executable: true,
  }
}

function routinePayload(items: RoutinePayloadV1["items"]): RoutinePayloadV1 {
  return {
    schemaVersion: 1,
    planId: PLAN_ID,
    versionId: "routine-payload-1",
    parentVersionId: null,
    source: {
      refinedVersionId: REFINED_OLD,
      productPortfolioVersionId: "portfolio-1",
      sourceFingerprint: "a".repeat(64),
      compilerVersion: "routine-compiler-v1",
      authorityVersions: {},
    },
    intent: {
      schemaVersion: 1,
      categories: [
        { category: "shampoo", inclusion: "included", inclusionSource: "stage3", assignments: [] },
      ],
    },
    sections: [
      { key: "basis", itemKeys: items.map((item) => item.itemKey) },
      { key: "optional", itemKeys: [] },
    ],
    items,
    createdAt: "2026-08-31T00:00:00.000Z",
  }
}

function ownedEvaluation(capturedProductId: string): Stage3AuthorityEvaluation {
  return {
    status: "known",
    category: "shampoo",
    subjectKey: stage3DecisionKey("shampoo", "shampoo_everyday", capturedProductId),
    verdict: "ideal",
    criteria: [],
    allowedActions: ["keep_owned"],
    recommendation: null,
    productFactFingerprint: null,
    recommendationFactFingerprint: null,
    coverageRuleIds: [],
  }
}

function unsupportedEvaluation(capturedProductId: string): Stage3AuthorityEvaluation {
  return {
    status: "unsupported",
    category: "shampoo",
    subjectKey: stage3DecisionKey("shampoo", "shampoo_everyday", capturedProductId),
    reason: "test_unsupported",
    allowedActions: [],
    coverageRuleIds: [],
  }
}

function activeRoutineVersion(input: {
  routineVersionId: string
  refinedVersionId: string
  productDraftId?: string | null
  productDraftRevision?: number | null
  items?: RoutinePayloadV1["items"]
}): Stage3RecomputeActiveRoutineVersion {
  return {
    routineVersionId: input.routineVersionId,
    payload: routinePayload(input.items ?? [ownedRoutineItem("capture-shampoo")]),
    source: {
      refinedVersionId: input.refinedVersionId,
      productDraftId: input.productDraftId === undefined ? "draft-source" : input.productDraftId,
      productDraftRevision:
        input.productDraftRevision === undefined ? 9 : input.productDraftRevision,
    },
  }
}

/** Sequential canned reads: first call returns responses[0], second responses[1], etc. */
function fakeRoutineState(responses: Array<Stage3RecomputeActiveRoutineVersion | null>) {
  const calls: unknown[] = []
  let index = 0
  const routineState: Stage3RecomputeRoutineStateReader = {
    loadActiveRoutineVersion: async (input) => {
      calls.push(input)
      const value = responses[Math.min(index, responses.length - 1)] ?? null
      index += 1
      return value
    },
  }
  return { routineState, calls }
}

function fakePersistence(
  drafts: Record<string, Stage3ProductDraft>,
  saveOutcome: "saved" | "revision_conflict" | "stale_source" = "saved",
) {
  const calls = { loadDraft: [] as unknown[], save: [] as unknown[] }
  const persistence: Stage3RehydrationPersistence = {
    loadDraft: async ({ userId, draftId }) => {
      calls.loadDraft.push({ userId, draftId })
      if (userId !== USER_ID) return null
      return drafts[draftId] ?? null
    },
    save: async ({ draftId, expectedRevision, draft }) => {
      calls.save.push({ draftId, expectedRevision })
      if (saveOutcome === "saved") {
        return { outcome: "saved" as const, draft: { ...draft, revision: expectedRevision + 1 } }
      }
      if (saveOutcome === "revision_conflict") {
        return {
          outcome: "revision_conflict" as const,
          draft: { ...draft, revision: expectedRevision + 5 },
        }
      }
      return { outcome: "stale_source" as const, draft }
    },
  }
  return { persistence, calls }
}

type GatewayHandlers = Partial<{
  loadOrCreate: Stage3RecomputeGateway["loadOrCreate"]
  evaluateDecisions: Stage3RecomputeGateway["evaluateDecisions"]
  reviewDecisionBundles: Stage3RecomputeGateway["reviewDecisionBundles"]
  resolveDecisions: Stage3RecomputeGateway["resolveDecisions"]
  complete: Stage3RecomputeGateway["complete"]
}>

function fakeGateway(handlers: GatewayHandlers) {
  const calls = {
    loadOrCreate: [] as unknown[],
    evaluateDecisions: [] as unknown[],
    reviewDecisionBundles: [] as unknown[],
    resolveDecisions: [] as Array<{ expectedRevision: number; count: number }>,
    complete: [] as unknown[],
  }
  function notConfigured(name: string): () => Promise<never> {
    return async () => {
      throw new Error(`fakeGateway.${name} was called but is not configured for this test`)
    }
  }
  const gateway: Stage3RecomputeGateway = {
    loadOrCreate: async (input) => {
      calls.loadOrCreate.push(input)
      return (handlers.loadOrCreate ?? notConfigured("loadOrCreate"))(input)
    },
    evaluateDecisions: async (input) => {
      calls.evaluateDecisions.push(input)
      return (handlers.evaluateDecisions ?? notConfigured("evaluateDecisions"))(input)
    },
    reviewDecisionBundles: async (input) => {
      calls.reviewDecisionBundles.push(input)
      return (handlers.reviewDecisionBundles ?? notConfigured("reviewDecisionBundles"))(input)
    },
    resolveDecisions: async (input) => {
      calls.resolveDecisions.push({
        expectedRevision: input.expectedRevision,
        count: input.intents.length,
      })
      return (handlers.resolveDecisions ?? notConfigured("resolveDecisions"))(input)
    },
    complete: async (input) => {
      calls.complete.push(input)
      return (handlers.complete ?? notConfigured("complete"))(input)
    },
  }
  return { gateway, calls }
}

/** Default resolveDecisions: bumps the revision by one and echoes intent count. */
function bumpingResolveDecisions(): Stage3RecomputeGateway["resolveDecisions"] {
  return async (input) => ({
    status: "saved",
    draft: freshDraft(REFINED_NEW, input.draftId, { revision: input.expectedRevision + 1 }),
  })
}

function readyForRoutine(
  overrides: Partial<Extract<Stage3CompleteResponse, { status: "ready_for_routine" }>> = {},
) {
  return async (): Promise<Stage3CompleteResponse> => ({
    status: "ready_for_routine",
    draft: freshDraft(REFINED_NEW),
    portfolio: {} as AnyProposedProductPortfolio,
    personalPlanId: PLAN_ID,
    refinedVersionId: REFINED_NEW,
    productPortfolioVersionId: "portfolio-2",
    // A deliberately misleading id: the orchestrator must never derive
    // `applied` from this field (production-persistence-gateway.ts:913,
    // stage3-persistence-supabase.ts:406).
    routineProposalId: "proposal-from-an-unrelated-accepted-flow",
    next: { stage: 4, href: "/routine" },
    ...overrides,
  })
}

const deps = (input: {
  gateway: Stage3RecomputeGateway
  persistence: Stage3RehydrationPersistence
  routineState: Stage3RecomputeRoutineStateReader
}) => input

test("happy path: distinct target version becomes active during the operation => applied, decided by re-read not proposal id", async () => {
  const starting = activeRoutineVersion({ routineVersionId: "rv-1", refinedVersionId: REFINED_OLD })
  const ending = activeRoutineVersion({ routineVersionId: "rv-2", refinedVersionId: REFINED_NEW })
  const { routineState, calls: routineCalls } = fakeRoutineState([starting, ending])
  const { persistence } = fakePersistence({
    "draft-source": sourceDraft(),
    "draft-target": freshDraft(REFINED_NEW),
  })
  const { gateway, calls } = fakeGateway({
    loadOrCreate: async () => draftResponse(freshDraft(REFINED_NEW)),
    evaluateDecisions: async () => [ownedEvaluation("capture-shampoo")],
    reviewDecisionBundles: async () => [],
    resolveDecisions: bumpingResolveDecisions(),
    complete: readyForRoutine(),
  })

  const result = await recomputeRoutineAfterHabitsCompletion(
    deps({ gateway, persistence, routineState }),
    { userId: USER_ID, personalPlanId: PLAN_ID, refinedVersionId: REFINED_NEW },
  )

  assert.deepEqual(result, { status: "applied", routineVersionId: "rv-2" })
  assert.equal(calls.resolveDecisions.length, 1)
  assert.equal(calls.complete.length, 1)
  assert.equal(routineCalls.length, 2)
})

test("already-active target at start => unchanged with zero mutations", async () => {
  const starting = activeRoutineVersion({ routineVersionId: "rv-1", refinedVersionId: REFINED_NEW })
  const { routineState, calls: routineCalls } = fakeRoutineState([starting])
  const { persistence, calls: persistenceCalls } = fakePersistence({})
  const { gateway, calls } = fakeGateway({})

  const result = await recomputeRoutineAfterHabitsCompletion(
    deps({ gateway, persistence, routineState }),
    { userId: USER_ID, personalPlanId: PLAN_ID, refinedVersionId: REFINED_NEW },
  )

  assert.deepEqual(result, { status: "unchanged" })
  assert.equal(routineCalls.length, 1)
  assert.equal(calls.loadOrCreate.length, 0)
  assert.equal(calls.resolveDecisions.length, 0)
  assert.equal(calls.complete.length, 0)
  assert.equal(persistenceCalls.loadDraft.length, 0)
  assert.equal(persistenceCalls.save.length, 0)
})

test("completed-draft replay after a lost response => applied via re-read, rehydration/decisions skipped", async () => {
  const starting = activeRoutineVersion({ routineVersionId: "rv-1", refinedVersionId: REFINED_OLD })
  const ending = activeRoutineVersion({ routineVersionId: "rv-2", refinedVersionId: REFINED_NEW })
  const { routineState } = fakeRoutineState([starting, ending])
  const { persistence, calls: persistenceCalls } = fakePersistence({
    "draft-source": sourceDraft(),
    "draft-target": freshDraft(REFINED_NEW),
  })
  const { gateway, calls } = fakeGateway({
    loadOrCreate: async () =>
      draftResponse(freshDraft(REFINED_NEW, "draft-target", { status: "completed", revision: 5 })),
    complete: readyForRoutine(),
  })

  const result = await recomputeRoutineAfterHabitsCompletion(
    deps({ gateway, persistence, routineState }),
    { userId: USER_ID, personalPlanId: PLAN_ID, refinedVersionId: REFINED_NEW },
  )

  assert.deepEqual(result, { status: "applied", routineVersionId: "rv-2" })
  assert.equal(calls.evaluateDecisions.length, 0)
  assert.equal(calls.reviewDecisionBundles.length, 0)
  assert.equal(calls.resolveDecisions.length, 0)
  assert.equal(calls.complete.length, 1)
  assert.equal((calls.complete[0] as { expectedRevision: number }).expectedRevision, 5)
  assert.equal(persistenceCalls.loadDraft.length, 0)
  assert.equal(persistenceCalls.save.length, 0)
})

test("a blocked subject => unavailable, non-retryable, no completion attempted", async () => {
  const starting = activeRoutineVersion({ routineVersionId: "rv-1", refinedVersionId: REFINED_OLD })
  const { routineState, calls: routineCalls } = fakeRoutineState([starting])
  const { persistence } = fakePersistence({
    "draft-source": sourceDraft(),
    "draft-target": freshDraft(REFINED_NEW),
  })
  const { gateway, calls } = fakeGateway({
    loadOrCreate: async () => draftResponse(freshDraft(REFINED_NEW)),
    evaluateDecisions: async () => [unsupportedEvaluation("capture-shampoo")],
    reviewDecisionBundles: async () => [],
  })

  const result = await recomputeRoutineAfterHabitsCompletion(
    deps({ gateway, persistence, routineState }),
    { userId: USER_ID, personalPlanId: PLAN_ID, refinedVersionId: REFINED_NEW },
  )

  assert.deepEqual(result, { status: "unavailable", reason: "decision_blocked", retryable: false })
  assert.equal(calls.resolveDecisions.length, 0)
  assert.equal(calls.complete.length, 0)
  // No end-of-operation re-read either: nothing was attempted.
  assert.equal(routineCalls.length, 1)
})

test("a rehydration CAS conflict => unavailable, retryable, decisions never evaluated", async () => {
  const starting = activeRoutineVersion({ routineVersionId: "rv-1", refinedVersionId: REFINED_OLD })
  const { routineState } = fakeRoutineState([starting])
  const { persistence } = fakePersistence(
    { "draft-source": sourceDraft(), "draft-target": freshDraft(REFINED_NEW) },
    "revision_conflict",
  )
  const { gateway, calls } = fakeGateway({
    loadOrCreate: async () => draftResponse(freshDraft(REFINED_NEW)),
  })

  const result = await recomputeRoutineAfterHabitsCompletion(
    deps({ gateway, persistence, routineState }),
    { userId: USER_ID, personalPlanId: PLAN_ID, refinedVersionId: REFINED_NEW },
  )

  assert.deepEqual(result, {
    status: "unavailable",
    reason: "rehydration_conflict",
    retryable: true,
  })
  assert.equal(calls.evaluateDecisions.length, 0)
})

test("a legacy active routine version with no recorded source draft id => unavailable, non-retryable", async () => {
  const starting = activeRoutineVersion({
    routineVersionId: "rv-1",
    refinedVersionId: REFINED_OLD,
    productDraftId: null,
    productDraftRevision: null,
  })
  const { routineState } = fakeRoutineState([starting])
  const { persistence, calls: persistenceCalls } = fakePersistence({})
  const { gateway, calls } = fakeGateway({})

  const result = await recomputeRoutineAfterHabitsCompletion(
    deps({ gateway, persistence, routineState }),
    { userId: USER_ID, personalPlanId: PLAN_ID, refinedVersionId: REFINED_NEW },
  )

  assert.deepEqual(result, {
    status: "unavailable",
    reason: "legacy_source_draft",
    retryable: false,
  })
  assert.equal(calls.loadOrCreate.length, 0)
  assert.equal(persistenceCalls.loadDraft.length, 0)
})

test("the target refined version is no longer the plan's current one => superseded, retryable", async () => {
  const starting = activeRoutineVersion({ routineVersionId: "rv-1", refinedVersionId: REFINED_OLD })
  const { routineState } = fakeRoutineState([starting])
  const { persistence, calls: persistenceCalls } = fakePersistence({})
  const { gateway } = fakeGateway({
    // The stale-rebuild path silently landed on a version nobody asked for.
    loadOrCreate: async () => draftResponse(freshDraft("refined-even-newer")),
  })

  const result = await recomputeRoutineAfterHabitsCompletion(
    deps({ gateway, persistence, routineState }),
    { userId: USER_ID, personalPlanId: PLAN_ID, refinedVersionId: REFINED_NEW },
  )

  assert.deepEqual(result, { status: "unavailable", reason: "superseded", retryable: true })
  assert.equal(persistenceCalls.loadDraft.length, 0)
})

test("more than 25 intents are resolved in batches of the authority decision limit, threading the revision", async () => {
  const capturedProductIds = Array.from({ length: 30 }, (_, index) => `capture-${index}`)
  const items = capturedProductIds.map(ownedRoutineItem)
  const evaluations = capturedProductIds.map(ownedEvaluation)
  const starting = activeRoutineVersion({
    routineVersionId: "rv-1",
    refinedVersionId: REFINED_OLD,
    items,
  })
  const ending = activeRoutineVersion({ routineVersionId: "rv-2", refinedVersionId: REFINED_NEW })
  const { routineState } = fakeRoutineState([starting, ending])
  const { persistence } = fakePersistence({
    "draft-source": sourceDraft(),
    "draft-target": freshDraft(REFINED_NEW),
  })
  const { gateway, calls } = fakeGateway({
    loadOrCreate: async () => draftResponse(freshDraft(REFINED_NEW)),
    evaluateDecisions: async () => evaluations,
    reviewDecisionBundles: async () => [],
    resolveDecisions: bumpingResolveDecisions(),
    complete: readyForRoutine(),
  })

  const result = await recomputeRoutineAfterHabitsCompletion(
    deps({ gateway, persistence, routineState }),
    { userId: USER_ID, personalPlanId: PLAN_ID, refinedVersionId: REFINED_NEW },
  )

  assert.equal(result.status, "applied")
  assert.equal(calls.resolveDecisions.length, 2)
  assert.equal(calls.resolveDecisions[0]?.count, 25)
  assert.equal(calls.resolveDecisions[1]?.count, 5)
  assert.equal(
    calls.resolveDecisions[1]?.expectedRevision,
    (calls.resolveDecisions[0]?.expectedRevision ?? 0) + 1,
  )
  const completeCall = calls.complete[0] as { expectedRevision: number }
  assert.equal(
    completeCall.expectedRevision,
    (calls.resolveDecisions[1]?.expectedRevision ?? 0) + 1,
  )
})

test("a concurrent lane activates a third refined version => unavailable, retryable, not derived from the completion status", async () => {
  const starting = activeRoutineVersion({ routineVersionId: "rv-1", refinedVersionId: REFINED_OLD })
  const ending = activeRoutineVersion({
    routineVersionId: "rv-3",
    refinedVersionId: "refined-third",
  })
  const { routineState } = fakeRoutineState([starting, ending])
  const { persistence } = fakePersistence({
    "draft-source": sourceDraft(),
    "draft-target": freshDraft(REFINED_NEW),
  })
  const { gateway } = fakeGateway({
    loadOrCreate: async () => draftResponse(freshDraft(REFINED_NEW)),
    evaluateDecisions: async () => [ownedEvaluation("capture-shampoo")],
    reviewDecisionBundles: async () => [],
    resolveDecisions: bumpingResolveDecisions(),
    complete: readyForRoutine(),
  })

  const result = await recomputeRoutineAfterHabitsCompletion(
    deps({ gateway, persistence, routineState }),
    { userId: USER_ID, personalPlanId: PLAN_ID, refinedVersionId: REFINED_NEW },
  )

  assert.deepEqual(result, {
    status: "unavailable",
    reason: "concurrent_activation",
    retryable: true,
  })
})

test("a completion conflict whose re-read shows the target active anyway => applied, never trusting the conflict alone", async () => {
  const starting = activeRoutineVersion({ routineVersionId: "rv-1", refinedVersionId: REFINED_OLD })
  const ending = activeRoutineVersion({ routineVersionId: "rv-2", refinedVersionId: REFINED_NEW })
  const { routineState } = fakeRoutineState([starting, ending])
  const { persistence } = fakePersistence({
    "draft-source": sourceDraft(),
    "draft-target": freshDraft(REFINED_NEW),
  })
  const { gateway } = fakeGateway({
    loadOrCreate: async () => draftResponse(freshDraft(REFINED_NEW)),
    evaluateDecisions: async () => [ownedEvaluation("capture-shampoo")],
    reviewDecisionBundles: async () => [],
    resolveDecisions: bumpingResolveDecisions(),
    complete: async (input) => ({
      status: "conflict",
      latestDraft: freshDraft(REFINED_NEW, input.draftId),
    }),
  })

  const result = await recomputeRoutineAfterHabitsCompletion(
    deps({ gateway, persistence, routineState }),
    { userId: USER_ID, personalPlanId: PLAN_ID, refinedVersionId: REFINED_NEW },
  )

  assert.deepEqual(result, { status: "applied", routineVersionId: "rv-2" })
})

test("a completion conflict whose re-read shows nothing new => unavailable, retryable", async () => {
  const starting = activeRoutineVersion({ routineVersionId: "rv-1", refinedVersionId: REFINED_OLD })
  const { routineState } = fakeRoutineState([starting, starting])
  const { persistence } = fakePersistence({
    "draft-source": sourceDraft(),
    "draft-target": freshDraft(REFINED_NEW),
  })
  const { gateway } = fakeGateway({
    loadOrCreate: async () => draftResponse(freshDraft(REFINED_NEW)),
    evaluateDecisions: async () => [ownedEvaluation("capture-shampoo")],
    reviewDecisionBundles: async () => [],
    resolveDecisions: bumpingResolveDecisions(),
    complete: async (input) => ({
      status: "conflict",
      latestDraft: freshDraft(REFINED_NEW, input.draftId),
    }),
  })

  const result = await recomputeRoutineAfterHabitsCompletion(
    deps({ gateway, persistence, routineState }),
    { userId: USER_ID, personalPlanId: PLAN_ID, refinedVersionId: REFINED_NEW },
  )

  assert.deepEqual(result, {
    status: "unavailable",
    reason: "completion_conflict",
    retryable: true,
  })
})

test("completion reports not_ready => unavailable, non-retryable", async () => {
  const starting = activeRoutineVersion({ routineVersionId: "rv-1", refinedVersionId: REFINED_OLD })
  const { routineState } = fakeRoutineState([starting, starting])
  const { persistence } = fakePersistence({
    "draft-source": sourceDraft(),
    "draft-target": freshDraft(REFINED_NEW),
  })
  const { gateway } = fakeGateway({
    loadOrCreate: async () => draftResponse(freshDraft(REFINED_NEW)),
    evaluateDecisions: async () => [ownedEvaluation("capture-shampoo")],
    reviewDecisionBundles: async () => [],
    resolveDecisions: bumpingResolveDecisions(),
    complete: async (input) => ({
      status: "not_ready",
      draft: freshDraft(REFINED_NEW, input.draftId),
    }),
  })

  const result = await recomputeRoutineAfterHabitsCompletion(
    deps({ gateway, persistence, routineState }),
    { userId: USER_ID, personalPlanId: PLAN_ID, refinedVersionId: REFINED_NEW },
  )

  assert.deepEqual(result, {
    status: "unavailable",
    reason: "completion_not_ready",
    retryable: false,
  })
})

test("a conflict from resolveDecisions => unavailable, retryable, completion never attempted", async () => {
  const starting = activeRoutineVersion({ routineVersionId: "rv-1", refinedVersionId: REFINED_OLD })
  const { routineState } = fakeRoutineState([starting])
  const { persistence } = fakePersistence({
    "draft-source": sourceDraft(),
    "draft-target": freshDraft(REFINED_NEW),
  })
  const { gateway, calls } = fakeGateway({
    loadOrCreate: async () => draftResponse(freshDraft(REFINED_NEW)),
    evaluateDecisions: async () => [ownedEvaluation("capture-shampoo")],
    reviewDecisionBundles: async () => [],
    resolveDecisions: async (input) => ({
      status: "conflict",
      latestDraft: freshDraft(REFINED_NEW, input.draftId),
    }),
  })

  const result = await recomputeRoutineAfterHabitsCompletion(
    deps({ gateway, persistence, routineState }),
    { userId: USER_ID, personalPlanId: PLAN_ID, refinedVersionId: REFINED_NEW },
  )

  assert.deepEqual(result, { status: "unavailable", reason: "resolve_conflict", retryable: true })
  assert.equal(calls.complete.length, 0)
})

test("no active routine at all => unavailable, non-retryable, no gateway calls", async () => {
  const { routineState } = fakeRoutineState([null])
  const { persistence } = fakePersistence({})
  const { gateway, calls } = fakeGateway({})

  const result = await recomputeRoutineAfterHabitsCompletion(
    deps({ gateway, persistence, routineState }),
    { userId: USER_ID, personalPlanId: PLAN_ID, refinedVersionId: REFINED_NEW },
  )

  assert.deepEqual(result, { status: "unavailable", reason: "no_active_routine", retryable: false })
  assert.equal(calls.loadOrCreate.length, 0)
})

test("the habits module completion never throws: a rejecting dependency becomes an unavailable, retryable result", async () => {
  const routineState: Stage3RecomputeRoutineStateReader = {
    loadActiveRoutineVersion: async () => {
      throw new Error("network blip")
    },
  }
  const { persistence } = fakePersistence({})
  const { gateway } = fakeGateway({})

  const result = await recomputeRoutineAfterHabitsCompletion(
    deps({ gateway, persistence, routineState }),
    { userId: USER_ID, personalPlanId: PLAN_ID, refinedVersionId: REFINED_NEW },
  )

  assert.deepEqual(result, { status: "unavailable", reason: "unexpected_error", retryable: true })
})

test("a thrown Stage3AuthorityMutationError from a stale bundle during resolve also becomes unavailable, retryable", async () => {
  const starting = activeRoutineVersion({ routineVersionId: "rv-1", refinedVersionId: REFINED_OLD })
  const { routineState } = fakeRoutineState([starting])
  const { persistence } = fakePersistence({
    "draft-source": sourceDraft(),
    "draft-target": freshDraft(REFINED_NEW),
  })
  const { gateway } = fakeGateway({
    loadOrCreate: async () => draftResponse(freshDraft(REFINED_NEW)),
    evaluateDecisions: async () => [ownedEvaluation("capture-shampoo")],
    reviewDecisionBundles: async () => [],
    resolveDecisions: async () => {
      throw new Error("stage3_replacement_candidate_invalid")
    },
  })

  const result = await recomputeRoutineAfterHabitsCompletion(
    deps({ gateway, persistence, routineState }),
    { userId: USER_ID, personalPlanId: PLAN_ID, refinedVersionId: REFINED_NEW },
  )

  assert.deepEqual(result, { status: "unavailable", reason: "unexpected_error", retryable: true })
})
