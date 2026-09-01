import assert from "node:assert/strict"
import test from "node:test"

import { createPersonalPlanRoutineSyncRouteHandlers } from "../src/app/api/personal-plan/routine/sync/route"
import {
  createRoutineSourceSyncService,
  parseRoutineSourceBaseSnapshots,
  resolveSuccessorRoutineCadences,
  type RoutineRefinedNeedRecomputeLane,
  type RoutineSourceSyncRepository,
} from "../src/lib/personal-plan/routine/source-sync-service"
import { createProductionRoutineSourceSyncService } from "../src/lib/personal-plan/routine/production-sync-service"
import type { ProposedProductPortfolio } from "../src/lib/personal-plan/products/contracts"
import type { RoutineCompiledPayload } from "../src/lib/personal-plan/routine-candidate-compiler"

const claim = {
  outboxId: "outbox-a",
  userId: "owner-a",
  personalPlanId: "plan-a",
  sourceKind: "user_product",
  sourceKey: "user-product-a",
  observedRevision: 4,
  leaseToken: "lease-a",
}

const routine = {
  schemaVersion: 1,
  planId: "plan-a",
  versionId: "routine-a",
  parentVersionId: null,
  source: {
    refinedVersionId: "refined-a",
    productPortfolioVersionId: "portfolio-a",
    sourceFingerprint: "a".repeat(64),
    compilerVersion: "v1",
    authorityVersions: {},
  },
  intent: { schemaVersion: 1, categories: [] },
  sections: [
    { key: "basis", itemKeys: [] },
    { key: "optional", itemKeys: [] },
  ],
  items: [],
} as RoutineCompiledPayload

const portfolio = {
  schemaVersion: 1,
  portfolioVersionId: "portfolio-a",
  personalPlanId: "plan-a",
  refinedVersionId: "refined-a",
  sourceDraftRevision: 1,
  categoryResolutions: [],
  ownedProducts: [],
  plannedPurchases: [],
  pendingProducts: [],
  uncoveredRoles: [],
  createdAt: "2026-08-08T00:00:00.000Z",
} satisfies ProposedProductPortfolio

test("stored source snapshots fail closed instead of throwing on a legacy portfolio shape", () => {
  const legacyPortfolio = {
    ...portfolio,
    ownedProducts: [
      {
        capturedProductId: "captured-a",
        userProductId: "owned-a",
        productId: "product-a",
        displayName: "Legacy Shampoo",
        category: "shampoo",
        role: "shampoo_everyday",
        frequencyRange: "weekly_2x",
      },
    ],
  }
  assert.equal(
    parseRoutineSourceBaseSnapshots({
      routine,
      portfolio: legacyPortfolio,
      sourceProductDraftId: "draft-a",
      sourceProductDraftRevision: 4,
    }),
    null,
  )
})

const claimB = {
  ...claim,
  outboxId: "outbox-b",
  sourceKey: "user-product-b",
  leaseToken: "lease-b",
}

function acquisitionBase(): {
  routine: RoutineCompiledPayload
  portfolio: ProposedProductPortfolio
} {
  const plannedPurchases = [
    ["planned-a", "product-a", "shampoo", "shampoo_everyday"],
    ["planned-b", "product-b", "conditioner", "conditioner_rinse_out"],
  ] as const
  const categories = plannedPurchases.map(
    ([plannedPurchaseId, productId, category, role], index) => ({
      category,
      inclusion: "included" as const,
      inclusionSource: "stage3" as const,
      assignments: [
        {
          assignmentKey: `assignment-${index}`,
          role,
          productRef: { kind: "planned" as const, plannedPurchaseId, productId },
          cadenceOverride: null,
          fitDecision: "standard" as const,
        },
      ],
    }),
  )
  const items = plannedPurchases.map(([plannedPurchaseId, productId, category, role], index) => ({
    itemKey: `item-${index}`,
    assignmentKey: `assignment-${index}`,
    category,
    role,
    purposeKey: `purpose-${index}`,
    roleOrder: index,
    state: {
      systemAssessment: "basis" as const,
      inclusion: "included" as const,
      availability: "planned" as const,
      fitDecision: "standard" as const,
    },
    product: {
      kind: "planned" as const,
      plannedPurchaseId,
      productId,
      displayName: `Produkt ${index}`,
    },
    cadence: { recommended: null, userOverride: null, displayKey: "daily" },
    sourceDecisionKeys: [`decision-${index}`],
    authorityRuleIds: [],
    executable: true,
  }))
  return {
    routine: {
      ...routine,
      intent: { schemaVersion: 1, categories },
      sections: [
        { key: "basis", itemKeys: items.map((item) => item.itemKey) },
        { key: "optional", itemKeys: [] },
      ],
      items,
    },
    portfolio: {
      ...portfolio,
      plannedPurchases: plannedPurchases.map(
        ([plannedPurchaseId, productId, category, role], index) => ({
          plannedPurchaseId,
          productId,
          displayName: `Produkt ${index}`,
          category,
          role,
          recommendationId: `recommendation-${index}`,
          reason: "Testempfehlung",
          authorityRuleId: "test-authority",
        }),
      ),
      categoryResolutions: plannedPurchases.map(([, , category, role], index) => ({
        decisionKey: `decision-${index}`,
        category,
        role,
        verdict: "ideal" as const,
        choiceState: "planned_purchase" as const,
        capturedProductId: null,
        executable: true,
        gapPreserved: false,
      })),
    },
  }
}

function repository(overrides: Partial<RoutineSourceSyncRepository> = {}) {
  const finished: Array<{ errorCode: string | null }> = []
  const recorded: string[] = []
  const value: RoutineSourceSyncRepository & {
    finished: typeof finished
    recorded: typeof recorded
  } = {
    async loadPlan() {
      return {
        id: "plan-a",
        revision: 2,
        sourceRevision: 4,
        activeRoutineVersionId: "routine-a",
      }
    },
    async claim() {
      return [claim]
    },
    async loadBase() {
      return {
        routine,
        portfolio,
        sourceProductDraftId: "draft-a",
        sourceProductDraftRevision: 1,
      }
    },
    async loadUserProduct() {
      return {
        id: "user-product-a",
        category: "conditioner",
        catalogProductId: "unrelated-product",
        displayName: "Unrelated",
        identityStatus: "matched",
        ownershipStatus: "owned",
      }
    },
    async recordNoChange(input) {
      recorded.push(input.sourceFingerprint)
      return "no_semantic_change"
    },
    async stage() {
      return "staged"
    },
    async finish(input) {
      finished.push({ errorCode: input.errorCode })
      return true
    },
    finished,
    recorded,
    ...overrides,
  }
  return value
}

test("owner sync records and acknowledges a semantic no-op", async () => {
  const db = repository()
  const result = await createRoutineSourceSyncService({ repository: db }).sync({
    userId: "owner-a",
  })

  assert.deepEqual(result, {
    status: "processed",
    processed: 1,
    terminalized: 0,
    deferred: 0,
    unfinished: 0,
    proposalStaged: false,
    recomputeApplied: false,
  })
  assert.equal(db.recorded.length, 1)
  assert.deepEqual(db.finished, [{ errorCode: null }])
})

test("a failed source transition is requeued instead of acknowledged", async () => {
  const db = repository({
    async recordNoChange() {
      return "source_revision_conflict"
    },
  })
  const result = await createRoutineSourceSyncService({ repository: db }).sync({
    userId: "owner-a",
  })

  assert.equal(result.status, "conflict")
  assert.deepEqual(db.finished, [{ errorCode: "source_revision_conflict" }])
})

test("a terminal invalid candidate is finished instead of retried forever", async () => {
  const reported: unknown[] = []
  const db = repository({
    async recordNoChange() {
      return "invalid_source"
    },
  })
  const result = await createRoutineSourceSyncService({
    repository: db,
    reportTerminalSource(details) {
      reported.push(details)
    },
  }).sync({ userId: "owner-a" })

  assert.deepEqual(result, { status: "conflict", reason: "invalid_source" })
  assert.deepEqual(db.finished, [{ errorCode: "terminal_invalid_source" }])
  assert.deepEqual(reported, [
    {
      planId: "plan-a",
      sourceKind: "user_product",
      observedRevision: 4,
      terminalCode: "terminal_invalid_source",
    },
  ])
})

test("an active-plan refined need is terminalized when no recompute lane is wired", async () => {
  const reported: unknown[] = []
  const db = repository({
    async claim() {
      return [
        {
          ...claim,
          sourceKind: "refined_need",
          sourceKey: "refined-a",
        },
      ]
    },
  })

  const result = await createRoutineSourceSyncService({
    repository: db,
    reportTerminalSource(details) {
      reported.push(details)
    },
  }).sync({ userId: "owner-a" })

  assert.deepEqual(result, {
    status: "processed",
    processed: 0,
    terminalized: 1,
    deferred: 0,
    unfinished: 0,
    proposalStaged: false,
    recomputeApplied: false,
  })
  assert.deepEqual(db.finished, [{ errorCode: "terminal_refinement_pending_stage3" }])
  assert.deepEqual(reported, [
    {
      planId: "plan-a",
      sourceKind: "refined_need",
      observedRevision: 4,
      terminalCode: "terminal_refinement_pending_stage3",
    },
  ])
})

const refinedClaim = {
  ...claim,
  outboxId: "outbox-refined",
  sourceKind: "refined_need",
  sourceKey: "refined-b",
  leaseToken: "lease-refined",
}

type LaneCall = { userId: string; personalPlanId: string; refinedVersionId: string }

function recomputeLane(
  overrides: Partial<RoutineRefinedNeedRecomputeLane> = {},
): RoutineRefinedNeedRecomputeLane & { classified: LaneCall[]; recomputed: LaneCall[] } {
  const classified: LaneCall[] = []
  const recomputed: LaneCall[] = []
  return {
    classified,
    recomputed,
    async classify(input) {
      classified.push(input)
      return "module_driven"
    },
    async recompute(input) {
      recomputed.push(input)
      return { status: "applied", routineVersionId: "routine-next" }
    },
    ...overrides,
  }
}

test("a module-driven refined need runs the recompute and reports the healed result", async () => {
  const reported: unknown[] = []
  const db = repository({
    async claim() {
      return [refinedClaim]
    },
  })
  const lane = recomputeLane()

  const result = await createRoutineSourceSyncService({
    repository: db,
    refinementRecompute: lane,
    reportTerminalSource(details) {
      reported.push(details)
    },
  }).sync({ userId: "owner-a" })

  assert.deepEqual(result, {
    status: "processed",
    processed: 1,
    terminalized: 0,
    deferred: 0,
    unfinished: 0,
    proposalStaged: false,
    recomputeApplied: true,
  })
  assert.deepEqual(lane.classified, [
    { userId: "owner-a", personalPlanId: "plan-a", refinedVersionId: "refined-b" },
  ])
  assert.deepEqual(lane.recomputed, [
    { userId: "owner-a", personalPlanId: "plan-a", refinedVersionId: "refined-b" },
  ])
  assert.deepEqual(db.finished, [{ errorCode: null }])
  assert.deepEqual(reported, [])
})

test("an unchanged recompute settles the claim without claiming a client-visible change", async () => {
  const db = repository({
    async claim() {
      return [refinedClaim]
    },
  })
  const lane = recomputeLane({
    async recompute() {
      return { status: "unchanged" }
    },
  })

  const result = await createRoutineSourceSyncService({
    repository: db,
    refinementRecompute: lane,
  }).sync({ userId: "owner-a" })

  assert.deepEqual(result, {
    status: "processed",
    processed: 1,
    terminalized: 0,
    deferred: 0,
    unfinished: 0,
    proposalStaged: false,
    recomputeApplied: false,
  })
  assert.deepEqual(db.finished, [{ errorCode: null }])
})

test("a superseded refined need is settled without running the recompute", async () => {
  const db = repository({
    async claim() {
      return [refinedClaim]
    },
  })
  const lane = recomputeLane({
    async classify() {
      return "stale_target"
    },
  })

  const result = await createRoutineSourceSyncService({
    repository: db,
    refinementRecompute: lane,
  }).sync({ userId: "owner-a" })

  assert.deepEqual(result, {
    status: "processed",
    processed: 1,
    terminalized: 0,
    deferred: 0,
    unfinished: 0,
    proposalStaged: false,
    recomputeApplied: false,
  })
  assert.deepEqual(lane.recomputed, [])
  assert.deepEqual(db.finished, [{ errorCode: null }])
})

test("a non-module-driven refined need keeps today's terminal behavior", async () => {
  const reported: unknown[] = []
  const db = repository({
    async claim() {
      return [refinedClaim]
    },
  })
  const lane = recomputeLane({
    async classify() {
      return "not_module_driven"
    },
  })

  const result = await createRoutineSourceSyncService({
    repository: db,
    refinementRecompute: lane,
    reportTerminalSource(details) {
      reported.push(details)
    },
  }).sync({ userId: "owner-a" })

  assert.deepEqual(result, {
    status: "processed",
    processed: 0,
    terminalized: 1,
    deferred: 0,
    unfinished: 0,
    proposalStaged: false,
    recomputeApplied: false,
  })
  assert.deepEqual(lane.recomputed, [])
  assert.deepEqual(db.finished, [{ errorCode: "terminal_refinement_pending_stage3" }])
  assert.deepEqual(reported, [
    {
      planId: "plan-a",
      sourceKind: "refined_need",
      observedRevision: 4,
      terminalCode: "terminal_refinement_pending_stage3",
    },
  ])
})

test("a plan without an active Routine never reaches the classification read", async () => {
  const db = repository({
    async loadPlan() {
      return { id: "plan-a", revision: 2, sourceRevision: 4, activeRoutineVersionId: null }
    },
    async claim() {
      return [refinedClaim]
    },
  })
  const lane = recomputeLane()

  const result = await createRoutineSourceSyncService({
    repository: db,
    refinementRecompute: lane,
  }).sync({ userId: "owner-a" })

  assert.equal(result.status, "processed")
  assert.deepEqual(lane.classified, [])
  assert.deepEqual(lane.recomputed, [])
  assert.deepEqual(db.finished, [{ errorCode: "terminal_refinement_pending_stage3" }])
})

test("a retryable recompute failure re-arms the claim on a non-terminal code", async () => {
  const reported: unknown[] = []
  const db = repository({
    async claim() {
      return [refinedClaim]
    },
  })
  const lane = recomputeLane({
    async recompute() {
      return { status: "unavailable", reason: "resolve_conflict", retryable: true }
    },
  })

  const result = await createRoutineSourceSyncService({
    repository: db,
    refinementRecompute: lane,
    reportTerminalSource(details) {
      reported.push(details)
    },
  }).sync({ userId: "owner-a" })

  assert.deepEqual(result, { status: "conflict", reason: "refinement_recompute_retry" })
  assert.deepEqual(db.finished, [{ errorCode: "refinement_recompute_retry" }])
  assert.deepEqual(reported, [])
})

test("a non-retryable recompute failure parks the claim on a terminal code", async () => {
  const reported: unknown[] = []
  const db = repository({
    async claim() {
      return [refinedClaim]
    },
  })
  const lane = recomputeLane({
    async recompute() {
      return { status: "unavailable", reason: "pending_proposal_staged", retryable: false }
    },
  })

  const result = await createRoutineSourceSyncService({
    repository: db,
    refinementRecompute: lane,
    reportTerminalSource(details) {
      reported.push(details)
    },
  }).sync({ userId: "owner-a" })

  assert.deepEqual(result, {
    status: "processed",
    processed: 0,
    terminalized: 1,
    deferred: 0,
    unfinished: 0,
    proposalStaged: false,
    recomputeApplied: false,
  })
  assert.deepEqual(db.finished, [{ errorCode: "terminal_refinement_recompute_blocked" }])
  assert.deepEqual(reported, [
    {
      planId: "plan-a",
      sourceKind: "refined_need",
      observedRevision: 4,
      terminalCode: "terminal_refinement_recompute_blocked",
    },
  ])
})

test("a recompute failure never hides an applied sibling recompute behind a batch conflict", async () => {
  const db = repository({
    async claim() {
      return [
        refinedClaim,
        { ...refinedClaim, outboxId: "outbox-refined-2", sourceKey: "refined-c" },
      ]
    },
  })
  const lane = recomputeLane({
    async recompute(input) {
      return input.refinedVersionId === "refined-b"
        ? { status: "applied", routineVersionId: "routine-next" }
        : { status: "unavailable", reason: "resolve_conflict", retryable: true }
    },
  })

  const result = await createRoutineSourceSyncService({
    repository: db,
    refinementRecompute: lane,
  }).sync({ userId: "owner-a" })

  assert.deepEqual(result, {
    status: "processed",
    processed: 1,
    terminalized: 0,
    deferred: 1,
    unfinished: 0,
    proposalStaged: false,
    recomputeApplied: true,
  })
  assert.deepEqual(db.finished, [{ errorCode: null }, { errorCode: "refinement_recompute_retry" }])
})

test("a failing self-heal lane re-arms its own claim instead of stranding the batch", async () => {
  const base = acquisitionBase()
  for (const failing of ["classify", "recompute"] as const) {
    const db = repository({
      async claim() {
        return [claim, refinedClaim]
      },
      async loadBase() {
        return { ...base, sourceProductDraftId: "draft-a", sourceProductDraftRevision: 1 }
      },
      async loadUserProduct(_, sourceKey) {
        return {
          id: sourceKey,
          category: "shampoo",
          catalogProductId: "product-a",
          displayName: "Shampoo A",
          identityStatus: "matched",
          ownershipStatus: "owned",
        }
      },
      async stage() {
        return "staged"
      },
    })
    const lane = recomputeLane({
      async classify() {
        if (failing === "classify") throw new Error("classification read failed")
        return "module_driven"
      },
      async recompute() {
        throw new Error("recompute rejected")
      },
    })

    const result = await createRoutineSourceSyncService({
      repository: db,
      refinementRecompute: lane,
    }).sync({ userId: "owner-a" })

    // The sibling product claim still stages its successor proposal.
    assert.deepEqual(result, {
      status: "processed",
      processed: 1,
      terminalized: 0,
      deferred: 1,
      unfinished: 0,
      proposalStaged: true,
      recomputeApplied: false,
    })
    assert.deepEqual(db.finished, [
      { errorCode: null },
      { errorCode: "refinement_recompute_retry" },
    ])
  }
})

test("a module-driven recompute runs before, and reloads the base for, its sibling product claims", async () => {
  const base = acquisitionBase()
  const calls: string[] = []
  const staged: Array<{ plan: { revision: number; sourceRevision: number } }> = []
  let planRevision = 2
  const db = repository({
    async loadPlan() {
      calls.push(`loadPlan:${planRevision}`)
      return {
        id: "plan-a",
        revision: planRevision,
        sourceRevision: planRevision + 2,
        activeRoutineVersionId: `routine-${planRevision}`,
      }
    },
    async claim() {
      calls.push("claim")
      // The product claim is listed first: the exclusive pass must not depend
      // on the refined claim happening to be claimed first.
      return [claim, refinedClaim]
    },
    async loadBase(_, plan) {
      calls.push(`loadBase:${plan.revision}`)
      return { ...base, sourceProductDraftId: "draft-a", sourceProductDraftRevision: 1 }
    },
    async loadUserProduct(_, sourceKey) {
      calls.push("loadUserProduct")
      return {
        id: sourceKey,
        category: "shampoo",
        catalogProductId: "product-a",
        displayName: "Shampoo A",
        identityStatus: "matched",
        ownershipStatus: "owned",
      }
    },
    async stage(input) {
      calls.push(`stage:${input.plan.revision}`)
      staged.push(input)
      return "staged"
    },
  })
  const lane = recomputeLane({
    async classify(input) {
      calls.push("classify")
      return input.refinedVersionId === refinedClaim.sourceKey ? "module_driven" : "stale_target"
    },
    async recompute() {
      calls.push("recompute")
      // A successful activation advances the plan's CAS state.
      planRevision = 5
      return { status: "applied", routineVersionId: "routine-5" }
    },
  })

  const result = await createRoutineSourceSyncService({
    repository: db,
    refinementRecompute: lane,
  }).sync({ userId: "owner-a" })

  assert.deepEqual(calls, [
    "loadPlan:2",
    "claim",
    "classify",
    "recompute",
    "loadPlan:5",
    "loadBase:5",
    "loadUserProduct",
    "stage:5",
  ])
  assert.deepEqual(staged[0]?.plan, {
    id: "plan-a",
    revision: 5,
    sourceRevision: 7,
    activeRoutineVersionId: "routine-5",
  })
  assert.deepEqual(result, {
    status: "processed",
    processed: 2,
    terminalized: 0,
    deferred: 0,
    unfinished: 0,
    proposalStaged: true,
    recomputeApplied: true,
  })
  assert.deepEqual(db.finished, [{ errorCode: null }, { errorCode: null }])
})

/**
 * The self-heal lane records a `null` (successfully settled) entry in
 * `claimErrors` for every refined claim it classified. Keying the no-change
 * branch off `claimErrors.size` therefore made a MIXED batch — one healed
 * recompute plus one ordinary source claim that reconciles to a no-op — skip
 * `recordNoChange` entirely, so `last_evaluated_source_fingerprint` was never
 * advanced and the same no-op claim re-evaluated on every later sync.
 */
test("a healed recompute never suppresses the sibling no-op's evaluated fingerprint", async () => {
  const db = repository({
    async claim() {
      return [claim, refinedClaim]
    },
  })
  const lane = recomputeLane()

  const result = await createRoutineSourceSyncService({
    repository: db,
    refinementRecompute: lane,
  }).sync({ userId: "owner-a" })

  assert.equal(db.recorded.length, 1, "the sibling no-op must still record no change")
  assert.deepEqual(result, {
    status: "processed",
    processed: 2,
    terminalized: 0,
    deferred: 0,
    unfinished: 0,
    proposalStaged: false,
    recomputeApplied: true,
  })
  assert.deepEqual(db.finished, [{ errorCode: null }, { errorCode: null }])
})

/**
 * ...but a remaining claim that ended in a real (non-terminal) error must still
 * suppress it: the batch did not evaluate cleanly, so its fingerprint may not
 * be advanced.
 */
test("an unresolved sibling still suppresses the no-change fingerprint", async () => {
  const db = repository({
    async claim() {
      return [claim, claimB, refinedClaim]
    },
    async loadUserProduct(_, sourceKey) {
      if (sourceKey === claimB.sourceKey) return null
      return {
        id: sourceKey,
        category: "conditioner",
        catalogProductId: "unrelated-product",
        displayName: "Unrelated",
        identityStatus: "matched",
        ownershipStatus: "owned",
      }
    },
  })
  const lane = recomputeLane()

  await createRoutineSourceSyncService({
    repository: db,
    refinementRecompute: lane,
  }).sync({ userId: "owner-a" })

  assert.equal(db.recorded.length, 0)
})

test("an unavailable base keeps the lane's already-final outcomes", async () => {
  const reported: unknown[] = []
  const db = repository({
    async claim() {
      return [claim, refinedClaim]
    },
    async loadBase() {
      return null
    },
  })
  const lane = recomputeLane()

  const result = await createRoutineSourceSyncService({
    repository: db,
    refinementRecompute: lane,
    reportTerminalSource(details) {
      reported.push(details)
    },
  }).sync({ userId: "owner-a" })

  // The activation already committed, so the client must still learn about it
  // even though the sibling product claim could not be reconciled.
  assert.deepEqual(result, {
    status: "processed",
    processed: 1,
    terminalized: 0,
    deferred: 1,
    unfinished: 0,
    proposalStaged: false,
    recomputeApplied: true,
  })
  assert.deepEqual(db.finished, [
    { errorCode: "routine_source_base_unavailable" },
    { errorCode: null },
  ])
})

test("an unavailable base still reports a lane-terminalized claim, and stays a 503 without a heal", async () => {
  const reported: unknown[] = []
  const db = repository({
    async claim() {
      return [claim, refinedClaim]
    },
    async loadBase() {
      return null
    },
  })
  const lane = recomputeLane({
    async recompute() {
      return { status: "unavailable", reason: "decision_blocked", retryable: false }
    },
  })

  const result = await createRoutineSourceSyncService({
    repository: db,
    refinementRecompute: lane,
    reportTerminalSource(details) {
      reported.push(details)
    },
  }).sync({ userId: "owner-a" })

  assert.deepEqual(result, { status: "temporarily_unavailable" })
  assert.deepEqual(db.finished, [
    { errorCode: "routine_source_base_unavailable" },
    { errorCode: "terminal_refinement_recompute_blocked" },
  ])
  // Without this the parked row would be invisible to Stage-5 dashboards.
  assert.deepEqual(reported, [
    {
      planId: "plan-a",
      sourceKind: "refined_need",
      observedRevision: 4,
      terminalCode: "terminal_refinement_recompute_blocked",
    },
  ])
})

test("a recompute that ran without applying reloads the base but reports no client-visible change", async () => {
  const base = acquisitionBase()
  const loadedPlans: number[] = []
  let planRevision = 2
  const db = repository({
    async loadPlan() {
      loadedPlans.push(planRevision)
      return {
        id: "plan-a",
        revision: planRevision,
        sourceRevision: planRevision + 2,
        activeRoutineVersionId: "routine-a",
      }
    },
    async claim() {
      return [claim, refinedClaim]
    },
    async loadBase() {
      return { ...base, sourceProductDraftId: "draft-a", sourceProductDraftRevision: 1 }
    },
    async loadUserProduct(_, sourceKey) {
      return {
        id: sourceKey,
        category: "shampoo",
        catalogProductId: "product-a",
        displayName: "Shampoo A",
        identityStatus: "matched",
        ownershipStatus: "owned",
      }
    },
    async stage() {
      return "staged"
    },
  })
  const lane = recomputeLane({
    async recompute() {
      // The Stage-2 route's inline lane already activated this version; the
      // worker's own run observes it as a no-op.
      planRevision = 4
      return { status: "unchanged" }
    },
  })

  const result = await createRoutineSourceSyncService({
    repository: db,
    refinementRecompute: lane,
  }).sync({ userId: "owner-a" })

  // `ran` drives the reload (state may have moved under us) — `applied` alone
  // drives the client's reload signal.
  assert.deepEqual(loadedPlans, [2, 4])
  assert.equal(result.status === "processed" && result.recomputeApplied, false)
})

test("a lane-settled claim never inherits a sibling's batch transition error", async () => {
  const base = acquisitionBase()
  const db = repository({
    async claim() {
      return [claim, refinedClaim]
    },
    async loadBase() {
      return { ...base, sourceProductDraftId: "draft-a", sourceProductDraftRevision: 1 }
    },
    async loadUserProduct(_, sourceKey) {
      return {
        id: sourceKey,
        category: "shampoo",
        catalogProductId: "product-a",
        displayName: "Shampoo A",
        identityStatus: "matched",
        ownershipStatus: "owned",
      }
    },
    async stage() {
      return "revision_conflict"
    },
  })

  const result = await createRoutineSourceSyncService({
    repository: db,
    refinementRecompute: recomputeLane(),
  }).sync({ userId: "owner-a" })

  assert.deepEqual(result, { status: "conflict", reason: "revision_conflict" })
  // The staging conflict re-arms the product claim; the recompute the lane
  // already committed must not be re-armed with it.
  assert.deepEqual(db.finished, [{ errorCode: "revision_conflict" }, { errorCode: null }])
})

test("a lost finish lease heals on the next worker without a second activation", async () => {
  // Models the orchestrator's start-state capture: the recompute activates only
  // while the plan's active Routine is not already sourced from the target.
  let activeRefinedVersion = "refined-a"
  let activations = 0
  const lane = () =>
    recomputeLane({
      async recompute(input) {
        if (activeRefinedVersion === input.refinedVersionId) return { status: "unchanged" }
        activeRefinedVersion = input.refinedVersionId
        activations += 1
        return { status: "applied", routineVersionId: "routine-next" }
      },
    })

  const workerA = repository({
    async claim() {
      return [refinedClaim]
    },
    // The lease was lost (or the finish response never landed): the outbox row
    // stays claimable instead of settling.
    async finish() {
      return false
    },
  })
  const resultA = await createRoutineSourceSyncService({
    repository: workerA,
    refinementRecompute: lane(),
  }).sync({ userId: "owner-a" })
  assert.deepEqual(resultA, { status: "temporarily_unavailable" })
  assert.equal(activations, 1)

  const workerB = repository({
    async claim() {
      // Reclaimed by a later visit under a fresh lease token.
      return [{ ...refinedClaim, leaseToken: "lease-refined-2" }]
    },
  })
  const resultB = await createRoutineSourceSyncService({
    repository: workerB,
    refinementRecompute: lane(),
  }).sync({ userId: "owner-a" })

  assert.deepEqual(resultB, {
    status: "processed",
    processed: 1,
    terminalized: 0,
    deferred: 0,
    unfinished: 0,
    proposalStaged: false,
    recomputeApplied: false,
  })
  assert.deepEqual(workerB.finished, [{ errorCode: null }])
  assert.equal(activations, 1)
})

test("an unknown active-plan source kind is terminalized without retrying", async () => {
  const db = repository({
    async claim() {
      return [{ ...claim, sourceKind: "portfolio_version", sourceKey: "portfolio-a" }]
    },
  })

  const result = await createRoutineSourceSyncService({ repository: db }).sync({
    userId: "owner-a",
  })

  assert.deepEqual(result, {
    status: "processed",
    processed: 0,
    terminalized: 1,
    deferred: 0,
    unfinished: 0,
    proposalStaged: false,
    recomputeApplied: false,
  })
  assert.deepEqual(db.finished, [{ errorCode: "terminal_unsupported_routine_source" }])
})

test("a genuinely unknown future source kind remains retryable for deploy compatibility", async () => {
  const db = repository({
    async claim() {
      return [{ ...claim, sourceKind: "future_source_kind", sourceKey: "future-a" }]
    },
  })

  assert.deepEqual(
    await createRoutineSourceSyncService({ repository: db }).sync({ userId: "owner-a" }),
    { status: "conflict", reason: "unsupported_routine_source" },
  )
  assert.deepEqual(db.finished, [{ errorCode: "unsupported_routine_source" }])
})

test("a lost source lease is not counted or reported as terminalized", async () => {
  const reported: unknown[] = []
  const db = repository({
    async claim() {
      return [{ ...claim, sourceKind: "portfolio_version", sourceKey: "portfolio-a" }]
    },
    async finish() {
      return false
    },
  })

  const result = await createRoutineSourceSyncService({
    repository: db,
    reportTerminalSource(details) {
      reported.push(details)
    },
  }).sync({ userId: "owner-a" })

  assert.deepEqual(result, { status: "temporarily_unavailable" })
  assert.deepEqual(reported, [])
})

test("a deleted user-product source is terminal while pending review remains retryable", async () => {
  const db = repository({
    async loadUserProduct() {
      return null
    },
  })

  const result = await createRoutineSourceSyncService({ repository: db }).sync({
    userId: "owner-a",
  })

  assert.deepEqual(result, {
    status: "processed",
    processed: 0,
    terminalized: 1,
    deferred: 0,
    unfinished: 0,
    proposalStaged: false,
    recomputeApplied: false,
  })
  assert.deepEqual(db.finished, [{ errorCode: "terminal_user_product_not_found" }])
})

for (const terminalCase of [
  {
    name: "category mismatch",
    category: "conditioner",
    ownershipStatus: "owned" as const,
    errorCode: "terminal_category_mismatch",
  },
  {
    name: "archived product state",
    category: "shampoo",
    ownershipStatus: "archived" as const,
    errorCode: "terminal_invalid_product_state",
  },
]) {
  test(`${terminalCase.name} is terminal for the exact observed source revision`, async () => {
    const base = acquisitionBase()
    const db = repository({
      async loadBase() {
        return { ...base, sourceProductDraftId: "draft-a", sourceProductDraftRevision: 1 }
      },
      async loadUserProduct() {
        return {
          id: claim.sourceKey,
          category: terminalCase.category,
          catalogProductId: "product-a",
          displayName: "Shampoo A",
          identityStatus: "matched",
          ownershipStatus: terminalCase.ownershipStatus,
        }
      },
    })

    assert.deepEqual(
      await createRoutineSourceSyncService({ repository: db }).sync({ userId: "owner-a" }),
      {
        status: "processed",
        processed: 0,
        terminalized: 1,
        deferred: 0,
        unfinished: 0,
        proposalStaged: false,
        recomputeApplied: false,
      },
    )
    assert.deepEqual(db.finished, [{ errorCode: terminalCase.errorCode }])
  })
}

test("unresolved product-review source is retried rather than acknowledged as no change", async () => {
  const db = repository({
    async loadUserProduct() {
      return {
        id: "user-product-a",
        category: "conditioner",
        catalogProductId: null,
        displayName: "Produkt",
        identityStatus: "pending_review",
        ownershipStatus: "owned",
      }
    },
  })
  const result = await createRoutineSourceSyncService({ repository: db }).sync({
    userId: "owner-a",
  })
  assert.deepEqual(result, { status: "conflict", reason: "unresolved_product_review" })
  assert.equal(db.recorded.length, 0)
  assert.deepEqual(db.finished, [{ errorCode: "unresolved_product_review" }])
})

test("a deferred product review does not block an independent changed claim", async () => {
  const base = acquisitionBase()
  const staged: Array<{ sourceKey: string; delta: unknown; routine: RoutineCompiledPayload }> = []
  const db = repository({
    async claim() {
      return [claim, claimB]
    },
    async loadBase() {
      return { ...base, sourceProductDraftId: "draft-a", sourceProductDraftRevision: 1 }
    },
    async loadUserProduct(_, sourceKey) {
      if (sourceKey === claim.sourceKey)
        return {
          id: sourceKey,
          category: "shampoo",
          catalogProductId: "product-a",
          displayName: "Shampoo A",
          identityStatus: "matched",
          ownershipStatus: "owned",
        }
      return {
        id: sourceKey,
        category: "conditioner",
        catalogProductId: null,
        displayName: "Conditioner B",
        identityStatus: "pending_review",
        ownershipStatus: "owned",
      }
    },
    async stage(input) {
      staged.push(input)
      return "staged"
    },
  })

  // The unresolved review remains retryable, while the staged sibling proposal
  // is exposed as the successful user-visible result of this batch.
  const result = await createRoutineSourceSyncService({ repository: db }).sync({
    userId: "owner-a",
  })
  assert.deepEqual(result, {
    status: "processed",
    processed: 1,
    terminalized: 0,
    deferred: 1,
    unfinished: 0,
    proposalStaged: true,
    recomputeApplied: false,
  })
  assert.equal(staged.length, 1)
  assert.ok(
    (staged[0]?.delta as { direct: Array<{ itemKey: string }> }).direct.some(
      (entry) => entry.itemKey === "item-0",
    ),
  )
  assert.deepEqual(db.finished, [{ errorCode: null }, { errorCode: "unresolved_product_review" }])
})

test("two changed claims stage one complete deterministic successor delta", async () => {
  const base = acquisitionBase()
  const staged: Array<{ sourceKey: string; delta: unknown; routine: RoutineCompiledPayload }> = []
  const db = repository({
    async claim() {
      // Deliberately reverse the input order: selection of the source event and
      // candidate fingerprint must not depend on outbox claim order.
      return [claimB, claim]
    },
    async loadBase() {
      return { ...base, sourceProductDraftId: "draft-a", sourceProductDraftRevision: 1 }
    },
    async loadUserProduct(_, sourceKey) {
      return sourceKey === claim.sourceKey
        ? {
            id: sourceKey,
            category: "shampoo",
            catalogProductId: "product-a",
            displayName: "Shampoo A",
            identityStatus: "matched",
            ownershipStatus: "owned",
          }
        : {
            id: sourceKey,
            category: "conditioner",
            catalogProductId: "product-b",
            displayName: "Conditioner B",
            identityStatus: "matched",
            ownershipStatus: "owned",
          }
    },
    async stage(input) {
      staged.push(input)
      return "staged"
    },
  })

  assert.deepEqual(
    await createRoutineSourceSyncService({ repository: db }).sync({ userId: "owner-a" }),
    {
      status: "processed",
      processed: 2,
      terminalized: 0,
      deferred: 0,
      unfinished: 0,
      proposalStaged: true,
      recomputeApplied: false,
    },
  )
  assert.equal(staged.length, 1)
  assert.equal(staged[0]?.sourceKey, "user-product-a")
  const delta = staged[0]?.delta as { direct: Array<{ itemKey: string }>; consequential: unknown[] }
  assert.deepEqual(delta.direct.map((entry) => entry.itemKey).sort(), ["item-0", "item-1"])
  assert.deepEqual(delta.consequential, [])
  assert.notEqual(
    staged[0]?.routine.source.sourceFingerprint,
    base.routine.source.sourceFingerprint,
  )
  assert.deepEqual(db.finished, [{ errorCode: null }, { errorCode: null }])
})

test("successor cadence is re-resolved once after the complete acquisition batch", async () => {
  const base = acquisitionBase()
  const staged: Array<{ routine: RoutineCompiledPayload }> = []
  let resolutionCalls = 0
  const db = repository({
    async claim() {
      return [claimB, claim]
    },
    async loadBase() {
      return { ...base, sourceProductDraftId: "draft-a", sourceProductDraftRevision: 1 }
    },
    async loadUserProduct(_, sourceKey) {
      return sourceKey === claim.sourceKey
        ? {
            id: sourceKey,
            category: "shampoo",
            catalogProductId: "product-a",
            displayName: "Shampoo A",
            identityStatus: "matched",
            ownershipStatus: "owned",
          }
        : {
            id: sourceKey,
            category: "conditioner",
            catalogProductId: "product-b",
            displayName: "Conditioner B",
            identityStatus: "matched",
            ownershipStatus: "owned",
          }
    },
    async stage(input) {
      staged.push(input)
      return "staged"
    },
  })

  const result = await createRoutineSourceSyncService({
    repository: db,
    async resolveCadences(candidate) {
      resolutionCalls += 1
      assert.deepEqual(
        candidate.items.map((item) => item.product.kind),
        ["owned", "owned"],
      )
      const resolved = structuredClone(candidate)
      resolved.items[0]!.cadence.resolved = {
        copyDe: "2× pro Woche",
        source: "category",
      }
      return resolved
    },
  }).sync({ userId: "owner-a" })

  assert.deepEqual(result, {
    status: "processed",
    processed: 2,
    terminalized: 0,
    deferred: 0,
    unfinished: 0,
    proposalStaged: true,
    recomputeApplied: false,
  })
  assert.equal(resolutionCalls, 1)
  assert.equal(staged.length, 1)
  assert.equal(staged[0]?.routine.items[0]?.cadence.resolved?.copyDe, "2× pro Woche")
})

test("legacy cadence enrichment is not presented as a change to untouched Routine items", async () => {
  const base = acquisitionBase()
  // Match the source reconciler's stable projection for the untouched item so
  // this fixture isolates cadence enrichment rather than pre-existing fixture drift.
  base.routine.items[1]!.roleOrder = 0
  base.routine.items[1]!.executable = false
  const staged: Array<{ delta: unknown }> = []
  const db = repository({
    async loadBase() {
      return { ...base, sourceProductDraftId: "draft-a", sourceProductDraftRevision: 1 }
    },
    async loadUserProduct() {
      return {
        id: claim.sourceKey,
        category: "shampoo",
        catalogProductId: "product-a",
        displayName: "Shampoo A",
        identityStatus: "matched",
        ownershipStatus: "owned",
      }
    },
    async stage(input) {
      staged.push(input)
      return "staged"
    },
  })

  const result = await createRoutineSourceSyncService({
    repository: db,
    async resolveCadences(candidate) {
      const resolved = structuredClone(candidate)
      resolved.items = resolved.items.map((item) => ({
        ...item,
        cadence: {
          ...item.cadence,
          resolved: { copyDe: "Nach deinem Plan", source: "category" as const },
        },
      }))
      return resolved
    },
  }).sync({ userId: "owner-a" })

  assert.equal(result.status, "processed")
  const delta = staged[0]?.delta as {
    direct: Array<{ itemKey: string }>
    consequential: Array<{ itemKey: string }>
  }
  assert.deepEqual(
    delta.direct.map((entry) => entry.itemKey),
    ["item-0"],
  )
  assert.deepEqual(delta.consequential, [])
})

test("successor cadence authority binds the acquired exact Bondbuilder course", async () => {
  const base = acquisitionBase().routine
  const successor = structuredClone(base)
  successor.items = [
    {
      ...successor.items[0]!,
      category: "bondbuilder",
      role: "specialized_bond_treatment",
      product: {
        kind: "owned",
        capturedProductId: "captured-bond",
        productId: "product-bond",
        displayName: "Bondbuilder",
      },
      cadence: {
        recommended: {
          kind: "product_protocol_course",
          role: "specialized_bond_treatment",
        },
        userOverride: null,
        displayKey: "personal_plan.cadence.product_protocol_course",
        resolved: {
          copyDe: "Nach Herstellerangabe",
          source: "safe_generic_fallback",
          gapCode: "exact_product_cadence_unavailable",
        },
      },
    },
  ]

  let loads = 0
  const resolved = await resolveSuccessorRoutineCadences({
    routine: successor,
    authorityReader: {
      async load({ productIds }) {
        loads += 1
        assert.deepEqual(productIds, ["product-bond"])
        return [
          {
            productId: "product-bond",
            category: "bondbuilder",
            role: "specialized_bond_treatment",
            cadence: {
              kind: "label_course",
              copy_de: "Alle ein bis drei Haarwäschen anwenden.",
            },
          },
        ]
      },
    },
  })

  assert.equal(loads, 1)
  assert.deepEqual(resolved.items[0]?.cadence.resolved, {
    copyDe: "Alle ein bis drei Haarwäschen anwenden.",
    source: "exact_product_protocol",
  })
  assert.equal(resolved.source.compilerVersion, "personal-plan-routine-compiler.v2")
  assert.equal(resolved.source.authorityVersions.routine, "personal-plan-routine-compiler.v2")
})

test("sync route authenticates before admin service construction and respects the composed gate", async () => {
  let constructed = false
  let response = await createPersonalPlanRoutineSyncRouteHandlers({
    enabled: () => true,
    getUserId: async () => null,
    loadJourneyAccess: async () => ({ kind: "legacy" }),
    service: () => {
      constructed = true
      return {} as never
    },
  }).POST()
  assert.deepEqual([response.status, await response.json()], [401, { error: "unauthorized" }])
  assert.equal(constructed, false)

  response = await createPersonalPlanRoutineSyncRouteHandlers({
    enabled: () => false,
    getUserId: async () => "owner-a",
    loadJourneyAccess: async () => ({ kind: "legacy" }),
    service: () =>
      ({
        sync: async () => ({
          status: "processed",
          processed: 0,
          deferred: 0,
          proposalStaged: false,
          recomputeApplied: false,
        }),
      }) as never,
  }).POST()
  assert.deepEqual(
    [response.status, await response.json()],
    [404, { error: "personal_plan_not_available" }],
  )
})

test("the sync route passes the healed-recompute signal through to the client", async () => {
  const response = await createPersonalPlanRoutineSyncRouteHandlers({
    enabled: () => true,
    getUserId: async () => "owner-a",
    loadJourneyAccess: async () => ({
      kind: "personal_plan",
      frontier: "stage4",
      allowed: { stage1: true, stage2: true, stage3: true, stage4: true, stage5: false },
      nextHref: "/routine",
      personalPlanId: "plan-a",
    }),
    service: () =>
      ({
        sync: async () => ({
          status: "processed",
          processed: 1,
          terminalized: 0,
          deferred: 0,
          unfinished: 0,
          proposalStaged: false,
          recomputeApplied: true,
        }),
      }) as never,
  }).POST()

  assert.deepEqual(
    [response.status, await response.json()],
    [
      200,
      {
        status: "processed",
        processed: 1,
        terminalized: 0,
        deferred: 0,
        unfinished: 0,
        proposalStaged: false,
        recomputeApplied: true,
      },
    ],
  )
})

/**
 * The production construction both outbox callers use — the sync route and the
 * acquisition service (`createSupabaseRoutineAcquisitionService`), which claims
 * from the same outbox and would otherwise park a healable claim forever.
 */
test("the production sync service heals a module-driven refined claim instead of terminalizing it", async () => {
  const planId = "11111111-1111-4111-8111-111111111111"
  const activeVersionId = "22222222-2222-4222-8222-222222222222"
  const refinedVersionId = "33333333-3333-4333-8333-333333333333"
  const reads: string[] = []
  const rpcs: Array<{ name: string; args: Record<string, unknown> }> = []

  const rows: Record<string, unknown> = {
    personal_plans: {
      id: planId,
      revision: 3,
      source_revision: 6,
      active_routine_version_id: activeVersionId,
      pending_routine_proposal_id: null,
      current_refined_need_version_id: refinedVersionId,
    },
    personal_plan_routine_versions: {
      id: activeVersionId,
      payload: {
        ...routine,
        planId,
        versionId: activeVersionId,
        source: { ...routine.source, refinedVersionId },
        createdAt: "2026-08-31T00:00:00.000Z",
      },
      // Already sourced from the claim's target: the orchestrator's start-state
      // capture short-circuits to `unchanged` with zero mutations.
      source_refined_need_version_id: refinedVersionId,
      source_product_draft_id: "draft-a",
      source_product_draft_revision: 2,
    },
  }
  const admin = {
    from(table: string) {
      reads.push(table)
      const query = {
        select: () => query,
        eq: () => query,
        maybeSingle: async () => ({ data: rows[table] ?? null, error: null }),
        then: (
          resolve: (value: { data: unknown; error: unknown }) => unknown,
          reject: (reason: unknown) => unknown,
        ) =>
          Promise.resolve(
            table === "personal_plan_refinement_drafts"
              ? {
                  data: [
                    {
                      module_projections: {
                        habits: {
                          needVersionId: refinedVersionId,
                          projectedAtRevision: 3,
                          stage3Handoff: false,
                        },
                      },
                      result_refined_need_version_id: null,
                    },
                  ],
                  error: null,
                }
              : { data: [], error: null },
          ).then(resolve, reject),
      }
      return query
    },
    async rpc(name: string, args: Record<string, unknown>) {
      rpcs.push({ name, args })
      if (name === "personal_plan_claim_owner_routine_source_changes") {
        return {
          data: [
            {
              outbox_id: "outbox-refined",
              user_id: "owner-a",
              personal_plan_id: planId,
              source_kind: "refined_need",
              source_key: refinedVersionId,
              observed_revision: 6,
              lease_token: "lease-refined",
            },
          ],
          error: null,
        }
      }
      if (name === "personal_plan_finish_routine_source_change") return { data: true, error: null }
      throw new Error(`unexpected rpc ${name}`)
    },
  }

  const result = await createProductionRoutineSourceSyncService(admin as never).sync({
    userId: "owner-a",
  })

  assert.deepEqual(result, {
    status: "processed",
    processed: 1,
    terminalized: 0,
    deferred: 0,
    unfinished: 0,
    proposalStaged: false,
    recomputeApplied: false,
  })
  // The lane engaged: the module lineage was actually read...
  assert.ok(reads.includes("personal_plan_refinement_drafts"))
  // ...and the claim settled instead of parking on the old blanket terminal code.
  assert.deepEqual(
    rpcs
      .filter((call) => call.name === "personal_plan_finish_routine_source_change")
      .map((call) => call.args.p_error_code),
    [null],
  )
})
