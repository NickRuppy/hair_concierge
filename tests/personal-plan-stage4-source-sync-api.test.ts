import assert from "node:assert/strict"
import test from "node:test"

import { createPersonalPlanRoutineSyncRouteHandlers } from "../src/app/api/personal-plan/routine/sync/route"
import {
  createRoutineSourceSyncService,
  resolveSuccessorRoutineCadences,
  type RoutineSourceSyncRepository,
} from "../src/lib/personal-plan/routine/source-sync-service"
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
    deferred: 0,
    proposalStaged: false,
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
  const db = repository({
    async recordNoChange() {
      return "invalid_source"
    },
  })
  const result = await createRoutineSourceSyncService({ repository: db }).sync({
    userId: "owner-a",
  })

  assert.deepEqual(result, { status: "conflict", reason: "invalid_source" })
  assert.deepEqual(db.finished, [{ errorCode: "terminal_invalid_source" }])
})

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
    deferred: 1,
    proposalStaged: true,
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
    { status: "processed", processed: 2, deferred: 0, proposalStaged: true },
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
    deferred: 0,
    proposalStaged: true,
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
        }),
      }) as never,
  }).POST()
  assert.deepEqual(
    [response.status, await response.json()],
    [404, { error: "personal_plan_not_available" }],
  )
})
