import assert from "node:assert/strict"
import test from "node:test"

import {
  loadOwnerPortfolioPresentation,
  routinePresentationLabels,
} from "../src/lib/personal-plan/routine/portfolio-presentation"
import type { ProposedProductPortfolio } from "../src/lib/personal-plan/products/contracts"
import { createPortfolioPresentationRouteHandlers } from "../src/app/api/personal-plan/portfolio-presentation/route"

const ids = {
  user: "user-1",
  plan: "plan-1",
  portfolio: "portfolio-1",
}

function v3Snapshot(): ProposedProductPortfolio {
  return {
    schemaVersion: 3,
    portfolioVersionId: ids.portfolio,
    personalPlanId: ids.plan,
    refinedVersionId: "refined-1",
    sourceDraftRevision: 1,
    categoryResolutions: [],
    ownedProducts: [],
    plannedPurchases: [
      {
        plannedPurchaseId: "planned-1",
        sourceDecisionKey: "decision-replace",
        category: "shampoo",
        role: "shampoo_everyday",
        recommendationId: "recommendation-1",
        productId: "product-new",
        displayName: "Neues Shampoo",
        reason: "Passt besser",
        authorityRuleId: "rule-1",
      },
    ],
    pendingProducts: [],
    uncoveredRoles: [],
    retainedOwnedProducts: [
      {
        capturedProductId: "captured-old",
        userProductId: "usage-old",
        productId: "product-old",
        displayName: "Altes Shampoo",
        category: "shampoo",
        role: "shampoo_everyday",
        sourceDecisionKey: "decision-replace",
        planStatus: "not_used",
      },
    ],
    createdAt: "2026-08-13T00:00:00.000Z",
  }
}

test("loads a strict owner, plan, and portfolio-scoped v3 snapshot for downstream presentation", async () => {
  const calls: Array<[string, string]> = []
  const query: any = {
    select: () => query,
    eq: (column: string, value: string) => {
      calls.push([column, value])
      return query
    },
    maybeSingle: async () => ({ data: { id: ids.portfolio, snapshot: v3Snapshot() }, error: null }),
  }
  const result = await loadOwnerPortfolioPresentation(
    {
      from: () => query,
    },
    ids.user,
    ids.plan,
    ids.portfolio,
  )

  assert.equal(result?.schemaVersion, 3)
  assert.equal(result?.retainedOwnedProducts[0]?.displayName, "Altes Shampoo")
  assert.deepEqual(calls, [
    ["id", ids.portfolio],
    ["user_id", ids.user],
    ["personal_plan_id", ids.plan],
  ])
})

test("uses v3-only labels for a replacement and an informed override, preserving legacy wording", () => {
  const v3 = routinePresentationLabels({
    schemaVersion: 3,
    plannedPurchaseDecisionKeys: ["decision-replace"],
    retainedOwnedProducts: [],
  })
  assert.equal(v3.plannedLabelFor(["decision-replace"]), "Noch kaufen")
  assert.equal(v3.fitLabelFor("informed_override"), "Mit Einschränkung")

  const legacy = routinePresentationLabels(null)
  assert.equal(legacy.plannedLabelFor(["decision-replace"]), null)
  assert.equal(legacy.fitLabelFor("informed_override"), null)
})

test("presents v4 replacement metadata while leaving retained inventory display-only", async () => {
  const snapshot = {
    ...v3Snapshot(),
    schemaVersion: 4 as const,
    inventoryDispositions: [],
    retainedInventoryProducts: [
      {
        kind: "catalog_product" as const,
        capturedProductId: "inventory-captured-1",
        userProductId: "inventory-user-product-1",
        productId: "inventory-product-1",
        displayName: "Nicht verwendetes Trockenshampoo",
        category: "dry_shampoo" as const,
        role: null,
        sourceDispositionKey: "inventory:dry-shampoo:1",
        planStatus: "not_used" as const,
        reason: "category_not_in_final_plan" as const,
      },
    ],
  }
  const query = {
    select: () => query,
    eq: () => query,
    maybeSingle: async () => ({ data: { id: ids.portfolio, snapshot }, error: null }),
  }

  const presentation = await loadOwnerPortfolioPresentation(
    { from: () => query },
    ids.user,
    ids.plan,
    ids.portfolio,
  )

  assert.equal(presentation?.schemaVersion, 4)
  assert.deepEqual(presentation?.retainedInventoryProducts, snapshot.retainedInventoryProducts)
  assert.equal(
    routinePresentationLabels(presentation).plannedLabelFor(["decision-replace"]),
    "Noch kaufen",
  )
})

test("fails closed when a stored portfolio snapshot is not strict", async () => {
  const query: any = {
    select: () => query,
    eq: () => query,
    maybeSingle: async () => ({
      data: { id: ids.portfolio, snapshot: { ...v3Snapshot(), unexpected: true } },
      error: null,
    }),
  }
  await assert.rejects(
    loadOwnerPortfolioPresentation({ from: () => query }, ids.user, ids.plan, ids.portfolio),
  )
})

test("marks a v3 pending-source replacement as Noch kaufen even without a retained catalog product", async () => {
  const snapshot = v3Snapshot()
  snapshot.retainedOwnedProducts = []
  snapshot.plannedPurchases[0].sourceDecisionKey = "decision-pending-replace"
  snapshot.categoryResolutions = [
    {
      decisionKey: "decision-pending-replace",
      category: "shampoo",
      role: "shampoo_everyday",
      verdict: "unknown",
      choiceState: "planned_purchase",
      capturedProductId: "captured-pending",
      executable: false,
      gapPreserved: true,
    },
  ]
  const query = {
    select: () => query,
    eq: () => query,
    maybeSingle: async () => ({ data: { id: ids.portfolio, snapshot }, error: null }),
  }
  const presentation = await loadOwnerPortfolioPresentation(
    { from: () => query },
    ids.user,
    ids.plan,
    ids.portfolio,
  )
  const labels = routinePresentationLabels(presentation)
  assert.equal(labels.plannedLabelFor(["decision-pending-replace"]), "Noch kaufen")
})

test("marks a v3 planned purchase without an owned source as Noch kaufen", async () => {
  const snapshot = v3Snapshot()
  snapshot.retainedOwnedProducts = []
  snapshot.categoryResolutions = [
    {
      decisionKey: "decision-replace",
      category: "shampoo",
      role: "shampoo_everyday",
      verdict: "ideal",
      choiceState: "planned_purchase",
      capturedProductId: null,
      executable: false,
      gapPreserved: true,
    },
  ]
  const query = {
    select: () => query,
    eq: () => query,
    maybeSingle: async () => ({ data: { id: ids.portfolio, snapshot }, error: null }),
  }

  const presentation = await loadOwnerPortfolioPresentation(
    { from: () => query },
    ids.user,
    ids.plan,
    ids.portfolio,
  )

  assert.deepEqual(presentation?.plannedPurchaseDecisionKeys, ["decision-replace"])
  assert.equal(
    routinePresentationLabels(presentation).plannedLabelFor(["decision-replace"]),
    "Noch kaufen",
  )
})

test("presents one retained owned product when the same product filled multiple replaced roles", async () => {
  const snapshot = v3Snapshot()
  snapshot.retainedOwnedProducts!.push({
    ...snapshot.retainedOwnedProducts![0],
    role: "shampoo_dandruff",
    sourceDecisionKey: "decision-replace-second-role",
  })
  snapshot.plannedPurchases.push({
    ...snapshot.plannedPurchases[0],
    plannedPurchaseId: "planned-2",
    sourceDecisionKey: "decision-replace-second-role",
  })
  const query = {
    select: () => query,
    eq: () => query,
    maybeSingle: async () => ({ data: { id: ids.portfolio, snapshot }, error: null }),
  }

  const presentation = await loadOwnerPortfolioPresentation(
    { from: () => query },
    ids.user,
    ids.plan,
    ids.portfolio,
  )

  assert.equal(presentation?.retainedOwnedProducts.length, 1)
  assert.deepEqual(presentation?.plannedPurchaseDecisionKeys, [
    "decision-replace",
    "decision-replace-second-role",
  ])
})

test("profile presentation API authenticates, owner-scopes its active portfolio, and returns JSON-safe arrays", async () => {
  const calls: Array<[string, string]> = []
  const client = {
    from(table: string) {
      const query: any = {
        select: () => query,
        eq: (column: string, value: string) => {
          calls.push([column, value])
          return query
        },
        maybeSingle: async () => ({
          data:
            table === "personal_plans"
              ? {
                  id: ids.plan,
                  revision: 1,
                  source_revision: 1,
                  active_routine_version_id: "routine-1",
                  pending_routine_proposal_id: null,
                }
              : table === "personal_plan_routine_versions"
                ? { id: "routine-1", payload: {}, source_portfolio_version_id: ids.portfolio }
                : { id: ids.portfolio, snapshot: v3Snapshot() },
          error: null,
        }),
      }
      return query
    },
  }
  const response = await createPortfolioPresentationRouteHandlers({
    getUserId: async () => ids.user,
    client: () => client as never,
  }).GET()
  const body = await response.json()

  assert.equal(response.status, 200)
  assert.equal(response.headers.get("Cache-Control"), "no-store")
  assert.deepEqual(body.presentation.plannedPurchaseDecisionKeys, ["decision-replace"])
  assert.deepEqual(
    body.presentation.retainedOwnedProducts.map(
      (product: { displayName: string }) => product.displayName,
    ),
    ["Altes Shampoo"],
  )
  assert.ok(calls.some(([column, value]) => column === "user_id" && value === ids.user))
})

test("profile presentation API rejects unauthenticated reads", async () => {
  const response = await createPortfolioPresentationRouteHandlers({
    getUserId: async () => null,
    client: () => {
      throw new Error("must not construct client")
    },
  }).GET()
  assert.equal(response.status, 401)
})
