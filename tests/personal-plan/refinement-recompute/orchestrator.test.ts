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
  Stage3RecomputeDeps,
  Stage3RecomputeGateway,
  Stage3RecomputeRoutineReactivation,
  Stage3RecomputeRoutineReactivator,
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
    // A subject the draft holds a capture for always carries the product's own
    // fact fingerprint (`authority/categories/shampoo.ts:255`); null there is
    // what tells the intent builder no captured product exists to keep.
    productFactFingerprint: "b".repeat(64),
    recommendationFactFingerprint: null,
    coverageRuleIds: [],
  }
}

/**
 * The source draft for the acquired-owned-product scenario: the person PLANNED
 * this role's product in Stage 3, so the completed source draft carries no
 * capture for it at all.
 */
function plannedSourceDraft(): Stage3ProductDraft {
  return { ...sourceDraft(), products: [], roleAssignments: [] }
}

/**
 * What the acquire/scan path leaves behind (`routine/source-reconciler.ts:40-59`,
 * `scan/saved-state.ts:200`): the item's product became `owned` with an
 * `acquired:<userProductId>` capture id, while `sourceDecisionKeys` still names
 * the ORIGINAL uncovered-role subject the `plan_recommendation` was decided on.
 * The flip never writes that product back into the immutable source draft.
 */
function acquiredOwnedRoutineItem(): RoutinePayloadV1["items"][number] {
  return {
    ...ownedRoutineItem("acquired:user-product-1"),
    sourceDecisionKeys: [stage3DecisionKey("shampoo", "shampoo_everyday", null)],
  }
}

/** What the rehydrated draft reports for that role: an uncovered role. */
function uncoveredRoleEvaluation(): Stage3AuthorityEvaluation {
  return {
    status: "known",
    category: "shampoo",
    subjectKey: stage3DecisionKey("shampoo", "shampoo_everyday", null),
    verdict: "ideal",
    criteria: [],
    allowedActions: ["plan_recommendation", "leave_uncovered"],
    recommendation: {
      recommendationId: "recommendation:catalog-shampoo",
      productId: "catalog-shampoo",
      category: "shampoo",
      role: "shampoo_everyday",
      displayName: "Shampoo",
      reason: "passt zu deinem Profil",
      authorityRuleId: "shampoo.rule.v1",
    },
    productFactFingerprint: null,
    recommendationFactFingerprint: "c".repeat(64),
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
    loadRequirements: async () => targetRequirements,
    loadRefinedNeedSnapshot: async () =>
      ({
        inputHash: "refined-input-new",
        profile: {
          source: { projection: "refined_post_plan" },
          hair: { thickness: "normal" },
        },
      }) as never,
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
  acknowledgeInventoryDisposition: Stage3RecomputeGateway["acknowledgeInventoryDisposition"]
  complete: Stage3RecomputeGateway["complete"]
}>

function fakeGateway(handlers: GatewayHandlers) {
  const calls = {
    loadOrCreate: [] as unknown[],
    evaluateDecisions: [] as unknown[],
    reviewDecisionBundles: [] as unknown[],
    resolveDecisions: [] as Array<{ expectedRevision: number; count: number }>,
    acknowledgeInventoryDisposition: [] as Array<{
      expectedRevision: number
      dispositionKey: string
    }>,
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
    acknowledgeInventoryDisposition: async (input) => {
      calls.acknowledgeInventoryDisposition.push({
        expectedRevision: input.expectedRevision,
        dispositionKey: input.dispositionKey,
      })
      return (
        handlers.acknowledgeInventoryDisposition ?? notConfigured("acknowledgeInventoryDisposition")
      )(input)
    },
    complete: async (input) => {
      calls.complete.push(input)
      return (handlers.complete ?? notConfigured("complete"))(input)
    },
  }
  return { gateway, calls }
}

/**
 * `loadOrCreate` for tests where rehydration is expected to run: the first
 * call (before rehydration) returns the fresh, revision-0 draft; every call
 * after that returns revision 1, matching what `fakePersistence`'s
 * rehydration write bumps it to (`expectedRevision + 1`). This is what the
 * orchestrator's post-rehydration re-acquisition (fix round 1 CRITICAL 1)
 * expects to see when it resets the gateway's per-draft memo to the
 * rehydrated row.
 */
function reacquiringLoadOrCreate(
  refinedVersionId = REFINED_NEW,
  draftId = "draft-target",
): Stage3RecomputeGateway["loadOrCreate"] {
  let call = 0
  return async () => {
    call += 1
    return draftResponse(freshDraft(refinedVersionId, draftId, { revision: call === 1 ? 0 : 1 }))
  }
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

/** Records every re-activation attempt; answers with a canned result. */
function fakeReactivator(
  result: Stage3RecomputeRoutineReactivation = {
    status: "unavailable",
    reason: "no_routine_for_draft",
  },
) {
  const calls: Array<{ personalPlanId: string; productDraftId: string }> = []
  const routineReactivator: Stage3RecomputeRoutineReactivator = {
    reactivateRoutineForProductDraft: async (input) => {
      calls.push({ personalPlanId: input.personalPlanId, productDraftId: input.productDraftId })
      return result
    },
  }
  return { routineReactivator, calls }
}

const deps = (input: {
  gateway: Stage3RecomputeGateway
  persistence: Stage3RehydrationPersistence
  routineState: Stage3RecomputeRoutineStateReader
  routineReactivator?: Stage3RecomputeRoutineReactivator
}): Stage3RecomputeDeps => ({
  ...input,
  routineReactivator: input.routineReactivator ?? {
    reactivateRoutineForProductDraft: async () => {
      throw new Error("routineReactivator was called but is not configured for this test")
    },
  },
})

test("happy path: distinct target version becomes active during the operation => applied, decided by re-read not proposal id", async () => {
  const starting = activeRoutineVersion({ routineVersionId: "rv-1", refinedVersionId: REFINED_OLD })
  const ending = activeRoutineVersion({ routineVersionId: "rv-2", refinedVersionId: REFINED_NEW })
  const { routineState, calls: routineCalls } = fakeRoutineState([starting, ending])
  const { persistence } = fakePersistence({
    "draft-source": sourceDraft(),
    "draft-target": freshDraft(REFINED_NEW),
  })
  const { gateway, calls } = fakeGateway({
    loadOrCreate: reacquiringLoadOrCreate(),
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
    loadOrCreate: reacquiringLoadOrCreate(),
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

test("composition: a routine product the rehydrated draft cannot see => unavailable, non-retryable, nothing resolved or completed", async () => {
  // End-to-end shape of the acquire/scan case: the routine owns a product that
  // was PLANNED in the source draft, so rehydration copies no capture for it
  // and the fresh evaluation is an uncovered role. Without the fail-close the
  // whole pass would resolve `leave_uncovered`, complete, and report `applied`
  // — dropping the person's product behind a success toast.
  const starting = activeRoutineVersion({
    routineVersionId: "rv-1",
    refinedVersionId: REFINED_OLD,
    items: [acquiredOwnedRoutineItem()],
  })
  const { routineState, calls: routineCalls } = fakeRoutineState([starting])
  const { persistence, calls: persistenceCalls } = fakePersistence({
    "draft-source": plannedSourceDraft(),
    "draft-target": freshDraft(REFINED_NEW),
  })
  const { gateway, calls } = fakeGateway({
    loadOrCreate: reacquiringLoadOrCreate(),
    evaluateDecisions: async () => [uncoveredRoleEvaluation()],
    reviewDecisionBundles: async () => [],
    // `resolveDecisions` and `complete` stay unconfigured on purpose: calling
    // either one throws and fails this test loudly.
  })

  const result = await recomputeRoutineAfterHabitsCompletion(
    deps({ gateway, persistence, routineState }),
    { userId: USER_ID, personalPlanId: PLAN_ID, refinedVersionId: REFINED_NEW },
  )

  assert.deepEqual(result, { status: "unavailable", reason: "decision_blocked", retryable: false })
  // Blocking is detected only after evaluate + bundles ran against the
  // rehydrated draft, so those two are expected to have happened.
  assert.equal(persistenceCalls.save.length, 1)
  assert.equal(calls.evaluateDecisions.length, 1)
  assert.equal(calls.reviewDecisionBundles.length, 1)
  assert.equal(calls.resolveDecisions.length, 0)
  assert.equal(calls.complete.length, 0)
  // No end-of-operation re-read: the routine was never touched, so there is
  // nothing to classify and no toast to raise.
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
    loadOrCreate: reacquiringLoadOrCreate(),
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
    loadOrCreate: reacquiringLoadOrCreate(),
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
    loadOrCreate: reacquiringLoadOrCreate(),
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
    loadOrCreate: reacquiringLoadOrCreate(),
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
    loadOrCreate: reacquiringLoadOrCreate(),
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
    loadOrCreate: reacquiringLoadOrCreate(),
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

  assert.equal(result.status, "unavailable")
  if (result.status !== "unavailable") return
  assert.equal(result.reason, "unexpected_error")
  assert.equal(result.retryable, true)
  // fix round 1 MINOR 5: the caught error is carried out for logging.
  assert.ok(result.cause instanceof Error)
  assert.equal((result.cause as Error).message, "network blip")
})

test("a thrown Stage3AuthorityMutationError from a stale bundle during resolve also becomes unavailable, retryable", async () => {
  const starting = activeRoutineVersion({ routineVersionId: "rv-1", refinedVersionId: REFINED_OLD })
  const { routineState } = fakeRoutineState([starting])
  const { persistence } = fakePersistence({
    "draft-source": sourceDraft(),
    "draft-target": freshDraft(REFINED_NEW),
  })
  const { gateway } = fakeGateway({
    loadOrCreate: reacquiringLoadOrCreate(),
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

  assert.equal(result.status, "unavailable")
  if (result.status !== "unavailable") return
  assert.equal(result.reason, "unexpected_error")
  assert.equal(result.retryable, true)
  assert.ok(result.cause instanceof Error)
})

// ---------------------------------------------------------------------------
// Fix round 1 regressions
// ---------------------------------------------------------------------------

/**
 * A gateway that behaves like the REAL production gateway's per-draft memo
 * (`cached` in `production-persistence-gateway.ts`, served by `current()` to
 * every one of `evaluateDecisions`/`reviewDecisionBundles`/`resolveDecisions`/
 * `complete`): `loadOrCreate` snapshots whatever is in `sharedStore` at that
 * moment and every later call is served from that snapshot, NOT from
 * `sharedStore`, until the next `loadOrCreate` call. Rehydration writes
 * through `deps.persistence.save()` directly into the SAME `sharedStore` —
 * exactly like the real gateway and the real rehydration service share one
 * underlying Supabase table — without going through this gateway at all.
 *
 * Against this fake, the pre-fix orchestrator (a single `loadOrCreate` call,
 * no post-rehydration re-acquisition) evaluates and completes the STALE,
 * pre-rehydration snapshot: zero role assignments, so zero evaluations, so
 * zero intents, so `complete()` runs with `expectedRevision` from the
 * rehydrated draft (1) against a snapshot still at revision 0 — a permanent
 * `completion_conflict`, never `applied`, on every retry. The fixed
 * orchestrator's second `loadOrCreate` resets the snapshot to the rehydrated
 * row first, so `complete()` succeeds and the re-read shows the target active.
 */
function sharedStoreGateway(sharedStore: Record<string, Stage3ProductDraft>, draftKey: string) {
  let snapshot: Stage3ProductDraft | null = null
  const calls = {
    loadOrCreate: [] as unknown[],
    evaluateDecisions: [] as unknown[],
    resolveDecisions: [] as unknown[],
    complete: [] as unknown[],
  }
  const gateway: Stage3RecomputeGateway = {
    loadOrCreate: async (input) => {
      calls.loadOrCreate.push(input)
      snapshot = sharedStore[draftKey]!
      return draftResponse(snapshot)
    },
    evaluateDecisions: async (input) => {
      calls.evaluateDecisions.push(input)
      if (!snapshot || snapshot.draftId !== input.draftId) {
        throw new Error("evaluateDecisions called against an unknown draftId")
      }
      // Mirrors the real gateway: one evaluation per role assignment on
      // whatever snapshot is currently cached — empty pre-rehydration.
      return snapshot.roleAssignments.map((assignment) =>
        ownedEvaluation(assignment.capturedProductId),
      )
    },
    reviewDecisionBundles: async () => [],
    acknowledgeInventoryDisposition: async () => {
      throw new Error("this fixture's drafts carry no inventory dispositions")
    },
    resolveDecisions: async (input) => {
      calls.resolveDecisions.push(input)
      if (!snapshot || snapshot.revision !== input.expectedRevision) {
        return { status: "conflict", latestDraft: snapshot ?? sharedStore[draftKey]! }
      }
      snapshot = { ...snapshot, revision: snapshot.revision + 1 }
      sharedStore[draftKey] = snapshot
      return { status: "saved", draft: snapshot }
    },
    complete: async (input) => {
      calls.complete.push(input)
      if (
        !snapshot ||
        snapshot.revision !== input.expectedRevision ||
        snapshot.status !== "active"
      ) {
        return { status: "conflict", latestDraft: snapshot ?? sharedStore[draftKey]! }
      }
      snapshot = { ...snapshot, status: "completed" }
      sharedStore[draftKey] = snapshot
      return {
        status: "ready_for_routine",
        draft: snapshot,
        portfolio: {} as AnyProposedProductPortfolio,
        personalPlanId: PLAN_ID,
        refinedVersionId: REFINED_NEW,
        productPortfolioVersionId: "portfolio-2",
        routineProposalId: null,
        next: { stage: 4, href: "/routine" },
      }
    },
  }
  return { gateway, calls }
}

/** `Stage3RehydrationPersistence` writing into the SAME store the gateway reads. */
function sharedStorePersistence(
  sharedStore: Record<string, Stage3ProductDraft>,
  extraDrafts: Record<string, Stage3ProductDraft>,
): Stage3RehydrationPersistence {
  return {
    loadRequirements: async () => targetRequirements,
    loadRefinedNeedSnapshot: async () =>
      ({
        inputHash: "refined-input-new",
        profile: {
          source: { projection: "refined_post_plan" },
          hair: { thickness: "normal" },
        },
      }) as never,
    loadDraft: async ({ userId, draftId }) => {
      if (userId !== USER_ID) return null
      return sharedStore[draftId] ?? extraDrafts[draftId] ?? null
    },
    save: async ({ draftId, expectedRevision, draft }) => {
      const saved = { ...draft, revision: expectedRevision + 1 }
      sharedStore[draftId] = saved
      return { outcome: "saved", draft: saved }
    },
  }
}

test("REGRESSION (fix round 1 CRITICAL 1): the gateway's per-draft memo from the first loadOrCreate is reset after rehydration, not served stale", async () => {
  const draftKey = "draft-target"
  const sharedStore: Record<string, Stage3ProductDraft> = {
    [draftKey]: freshDraft(REFINED_NEW, draftKey),
  }
  const persistence = sharedStorePersistence(sharedStore, { "draft-source": sourceDraft() })
  const { gateway, calls } = sharedStoreGateway(sharedStore, draftKey)

  const starting = activeRoutineVersion({ routineVersionId: "rv-1", refinedVersionId: REFINED_OLD })
  let routineStateCall = 0
  const routineState: Stage3RecomputeRoutineStateReader = {
    loadActiveRoutineVersion: async () => {
      routineStateCall += 1
      if (routineStateCall === 1) return starting
      // Reflects reality: the routine only advances once the draft this
      // fake gateway is tracking actually reached "completed".
      return sharedStore[draftKey]?.status === "completed"
        ? activeRoutineVersion({ routineVersionId: "rv-2", refinedVersionId: REFINED_NEW })
        : starting
    },
  }

  const result = await recomputeRoutineAfterHabitsCompletion(
    deps({ gateway, persistence, routineState }),
    { userId: USER_ID, personalPlanId: PLAN_ID, refinedVersionId: REFINED_NEW },
  )

  assert.deepEqual(result, { status: "applied", routineVersionId: "rv-2" })
  // Proves the re-acquisition actually happened: the initial load, plus one
  // more after rehydration, resetting the gateway's memo.
  assert.equal(calls.loadOrCreate.length, 2)
  assert.equal(sharedStore[draftKey]?.status, "completed")
})

test("a completion whose receipt stages a pending proposal but whose re-read still shows the starting source => pending_proposal_staged, non-retryable", async () => {
  const starting = activeRoutineVersion({ routineVersionId: "rv-1", refinedVersionId: REFINED_OLD })
  // A replayed complete() short-circuited to the stored receipt without this
  // attempt's confirm landing: the routine never left its starting source.
  const { routineState } = fakeRoutineState([starting, starting])
  const { persistence } = fakePersistence({
    "draft-source": sourceDraft(),
    "draft-target": freshDraft(REFINED_NEW),
  })
  const { gateway } = fakeGateway({
    loadOrCreate: reacquiringLoadOrCreate(),
    evaluateDecisions: async () => [ownedEvaluation("capture-shampoo")],
    reviewDecisionBundles: async () => [],
    resolveDecisions: bumpingResolveDecisions(),
    complete: readyForRoutine({ routineProposalId: "proposal-staged-not-confirmed" }),
  })

  const result = await recomputeRoutineAfterHabitsCompletion(
    deps({ gateway, persistence, routineState }),
    { userId: USER_ID, personalPlanId: PLAN_ID, refinedVersionId: REFINED_NEW },
  )

  assert.deepEqual(result, {
    status: "unavailable",
    reason: "pending_proposal_staged",
    retryable: false,
  })
})

test("a completion whose receipt carries no proposal id and whose re-read shows the starting source stays concurrent_activation, not pending_proposal_staged", async () => {
  const starting = activeRoutineVersion({ routineVersionId: "rv-1", refinedVersionId: REFINED_OLD })
  const { routineState } = fakeRoutineState([starting, starting])
  const { persistence } = fakePersistence({
    "draft-source": sourceDraft(),
    "draft-target": freshDraft(REFINED_NEW),
  })
  const { gateway } = fakeGateway({
    loadOrCreate: reacquiringLoadOrCreate(),
    evaluateDecisions: async () => [ownedEvaluation("capture-shampoo")],
    reviewDecisionBundles: async () => [],
    resolveDecisions: bumpingResolveDecisions(),
    complete: readyForRoutine({ routineProposalId: null }),
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

/**
 * A→B→A. The person answered Verhalten one way, changed their mind, then went
 * back. Stage-2 dedupes refined versions by input hash
 * (`20260825130000`), so the third completion hands back the FIRST version and
 * moves the plan's head to it — and draft acquisition lands on that version's
 * long-since COMPLETED Stage-3 draft. `complete()` can then only replay the
 * stored receipt, whose `routineProposalId` is a proposal that was ACCEPTED
 * ages ago (the receipt loader does not check status,
 * `stage3-persistence-supabase.ts:406`), so the lane used to report a terminal
 * `pending_proposal_staged` and the plan stayed on B forever.
 *
 * The target version's Routine still exists — it is only inactive. Founder
 * ruling R2 (changes are applied silently) makes re-activating it the correct
 * outcome.
 */
test("a completed draft whose Routine exists but is inactive is re-activated => applied", async () => {
  const starting = activeRoutineVersion({ routineVersionId: "rv-b", refinedVersionId: REFINED_OLD })
  const reactivated = activeRoutineVersion({
    routineVersionId: "rv-a",
    refinedVersionId: REFINED_NEW,
  })
  // Before, after the receipt replay (unchanged), and after the re-activation.
  const { routineState } = fakeRoutineState([starting, starting, reactivated])
  const { persistence, calls: persistenceCalls } = fakePersistence({})
  const { gateway, calls } = fakeGateway({
    loadOrCreate: async () =>
      draftResponse(freshDraft(REFINED_NEW, "draft-historical", { status: "completed" })),
    complete: readyForRoutine({ routineProposalId: "proposal-accepted-long-ago" }),
  })
  const { routineReactivator, calls: reactivations } = fakeReactivator({
    status: "activated",
    routineVersionId: "rv-a",
  })

  const result = await recomputeRoutineAfterHabitsCompletion(
    deps({ gateway, persistence, routineState, routineReactivator }),
    { userId: USER_ID, personalPlanId: PLAN_ID, refinedVersionId: REFINED_NEW },
  )

  assert.deepEqual(result, { status: "applied", routineVersionId: "rv-a" })
  assert.deepEqual(reactivations, [{ personalPlanId: PLAN_ID, productDraftId: "draft-historical" }])
  // A completed draft is never rehydrated or re-decided.
  assert.equal(persistenceCalls.save.length, 0)
  assert.equal(calls.evaluateDecisions.length, 0)
})

/**
 * The controller ruling of fix round 1 (IMPORTANT 2) stands: a lost-response
 * replay whose proposal is still PENDING is the person's to confirm on the
 * routine page, and nothing may be staged over it — staging supersedes every
 * pending proposal on the plan (`20260808070000:181-183`). The reactivator is
 * the only layer that can see that proposal's status, so it reports
 * `proposal_pending` and the orchestrator keeps the terminal outcome.
 */
test("a still-pending proposal for the target Routine keeps pending_proposal_staged, unstaged", async () => {
  const starting = activeRoutineVersion({ routineVersionId: "rv-b", refinedVersionId: REFINED_OLD })
  const { routineState } = fakeRoutineState([starting, starting])
  const { persistence } = fakePersistence({})
  const { gateway } = fakeGateway({
    loadOrCreate: async () =>
      draftResponse(freshDraft(REFINED_NEW, "draft-historical", { status: "completed" })),
    complete: readyForRoutine({ routineProposalId: "proposal-staged-not-confirmed" }),
  })
  const { routineReactivator, calls: reactivations } = fakeReactivator({
    status: "unavailable",
    reason: "proposal_pending",
  })

  const result = await recomputeRoutineAfterHabitsCompletion(
    deps({ gateway, persistence, routineState, routineReactivator }),
    { userId: USER_ID, personalPlanId: PLAN_ID, refinedVersionId: REFINED_NEW },
  )

  assert.deepEqual(result, {
    status: "unavailable",
    reason: "pending_proposal_staged",
    retryable: false,
  })
  assert.equal(reactivations.length, 1)
})

test("a re-activation that finds no Routine for the completed draft keeps pending_proposal_staged", async () => {
  const starting = activeRoutineVersion({ routineVersionId: "rv-b", refinedVersionId: REFINED_OLD })
  const { routineState } = fakeRoutineState([starting, starting])
  const { persistence } = fakePersistence({})
  const { gateway } = fakeGateway({
    loadOrCreate: async () =>
      draftResponse(freshDraft(REFINED_NEW, "draft-historical", { status: "completed" })),
    complete: readyForRoutine({ routineProposalId: "proposal-staged-not-confirmed" }),
  })
  const { routineReactivator } = fakeReactivator({
    status: "unavailable",
    reason: "no_routine_for_draft",
  })

  const result = await recomputeRoutineAfterHabitsCompletion(
    deps({ gateway, persistence, routineState, routineReactivator }),
    { userId: USER_ID, personalPlanId: PLAN_ID, refinedVersionId: REFINED_NEW },
  )

  assert.deepEqual(result, {
    status: "unavailable",
    reason: "pending_proposal_staged",
    retryable: false,
  })
})

test("an unreadable plan row is terminal, never the routine page's proposal recovery", async () => {
  const starting = activeRoutineVersion({ routineVersionId: "rv-b", refinedVersionId: REFINED_OLD })
  const { routineState } = fakeRoutineState([starting, starting])
  const { persistence } = fakePersistence({})
  const { gateway } = fakeGateway({
    loadOrCreate: async () =>
      draftResponse(freshDraft(REFINED_NEW, "draft-historical", { status: "completed" })),
    complete: readyForRoutine({ routineProposalId: "proposal-accepted-long-ago" }),
  })
  const { routineReactivator } = fakeReactivator({
    status: "unavailable",
    reason: "plan_unavailable",
  })

  const result = await recomputeRoutineAfterHabitsCompletion(
    deps({ gateway, persistence, routineState, routineReactivator }),
    { userId: USER_ID, personalPlanId: PLAN_ID, refinedVersionId: REFINED_NEW },
  )

  assert.deepEqual(result, {
    status: "unavailable",
    reason: "reactivation_rejected",
    retryable: false,
  })
})

test("a CAS conflict between staging and confirming the historical Routine is retryable", async () => {
  const starting = activeRoutineVersion({ routineVersionId: "rv-b", refinedVersionId: REFINED_OLD })
  const { routineState } = fakeRoutineState([starting, starting])
  const { persistence } = fakePersistence({})
  const { gateway } = fakeGateway({
    loadOrCreate: async () =>
      draftResponse(freshDraft(REFINED_NEW, "draft-historical", { status: "completed" })),
    complete: readyForRoutine({ routineProposalId: "proposal-accepted-long-ago" }),
  })
  const { routineReactivator } = fakeReactivator({ status: "conflict" })

  const result = await recomputeRoutineAfterHabitsCompletion(
    deps({ gateway, persistence, routineState, routineReactivator }),
    { userId: USER_ID, personalPlanId: PLAN_ID, refinedVersionId: REFINED_NEW },
  )

  assert.deepEqual(result, {
    status: "unavailable",
    reason: "reactivation_conflict",
    retryable: true,
  })
})

test("a loaded draft in status stale => draft_stale, retryable, no rehydration attempted", async () => {
  const starting = activeRoutineVersion({ routineVersionId: "rv-1", refinedVersionId: REFINED_OLD })
  const { routineState } = fakeRoutineState([starting])
  const { persistence, calls: persistenceCalls } = fakePersistence({})
  const { gateway, calls } = fakeGateway({
    loadOrCreate: async () =>
      draftResponse(freshDraft(REFINED_NEW, "draft-target", { status: "stale" })),
  })

  const result = await recomputeRoutineAfterHabitsCompletion(
    deps({ gateway, persistence, routineState }),
    { userId: USER_ID, personalPlanId: PLAN_ID, refinedVersionId: REFINED_NEW },
  )

  assert.deepEqual(result, { status: "unavailable", reason: "draft_stale", retryable: true })
  assert.equal(calls.loadOrCreate.length, 1)
  assert.equal(persistenceCalls.loadDraft.length, 0)
})
