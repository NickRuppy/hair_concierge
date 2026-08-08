import assert from "node:assert/strict"
import test from "node:test"

import type { ProposedProductPortfolio } from "../src/lib/personal-plan/products/contracts"
import {
  reconcileRoutineUserProductSource,
  type RoutineSourceUserProduct,
} from "../src/lib/personal-plan/routine/source-reconciler"
import type { RoutineCompiledPayload } from "../src/lib/personal-plan/routine-candidate-compiler"

const assignmentKey = "assignment:oil:dry_finish:planned-oil"
const decisionKey = "decision:oil:dry_finish:none"

function portfolio(): ProposedProductPortfolio {
  return {
    schemaVersion: 1,
    portfolioVersionId: "portfolio-a",
    personalPlanId: "plan-a",
    refinedVersionId: "refined-a",
    sourceDraftRevision: 3,
    categoryResolutions: [
      {
        decisionKey,
        category: "oil",
        role: "dry_finish",
        verdict: "ideal",
        choiceState: "planned_purchase",
        capturedProductId: null,
        executable: false,
        gapPreserved: true,
      },
    ],
    ownedProducts: [],
    plannedPurchases: [
      {
        plannedPurchaseId: "planned-oil",
        category: "oil",
        role: "dry_finish",
        recommendationId: "recommendation-oil",
        productId: "product-oil",
        displayName: "Leichtes Öl",
        reason: "Passt zu deiner Routine",
        authorityRuleId: "oil.v1",
      },
    ],
    pendingProducts: [],
    uncoveredRoles: [
      {
        category: "oil",
        role: "dry_finish",
        reason: "planned_purchase_not_acquired",
        linkedDecisionKey: decisionKey,
      },
    ],
    createdAt: "2026-08-08T00:00:00.000Z",
  }
}

function routine(): RoutineCompiledPayload {
  return {
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
    intent: {
      schemaVersion: 1,
      categories: [
        {
          category: "oil",
          inclusion: "included",
          inclusionSource: "stage3",
          assignments: [
            {
              assignmentKey,
              role: "dry_finish",
              productRef: {
                kind: "planned",
                plannedPurchaseId: "planned-oil",
                productId: "product-oil",
              },
              cadenceOverride: null,
              fitDecision: "standard",
            },
          ],
        },
      ],
    },
    sections: [
      { key: "basis", itemKeys: [] },
      { key: "optional", itemKeys: ["item:oil:dry_finish:planned-oil"] },
    ],
    items: [
      {
        itemKey: "item:oil:dry_finish:planned-oil",
        assignmentKey,
        category: "oil",
        role: "dry_finish",
        purposeKey: "dry_finish",
        roleOrder: 0,
        state: {
          systemAssessment: "optional",
          inclusion: "included",
          availability: "planned",
          fitDecision: "standard",
        },
        product: {
          kind: "planned",
          plannedPurchaseId: "planned-oil",
          productId: "product-oil",
          displayName: "Leichtes Öl",
        },
        cadence: {
          recommended: null,
          userOverride: null,
          displayKey: "personal_plan.cadence.none",
        },
        sourceDecisionKeys: [decisionKey],
        authorityRuleIds: ["oil.v1"],
        executable: false,
      },
    ],
  }
}

const acquired: RoutineSourceUserProduct = {
  id: "user-product-oil",
  category: "oil",
  catalogProductId: "product-oil",
  displayName: "Leichtes Öl",
  identityStatus: "matched",
  ownershipStatus: "owned",
}

test("planned exact-product acquisition produces an immutable successor proposal input", () => {
  const previousRoutine = routine()
  const previousPortfolio = portfolio()
  const result = reconcileRoutineUserProductSource({
    routine: previousRoutine,
    portfolio: previousPortfolio,
    userProduct: acquired,
    sourceRevision: 8,
  })

  assert.equal(result.status, "changed")
  if (result.status !== "changed") return
  assert.equal(result.portfolio.ownedProducts.at(-1)?.frequencyRange, null)
  assert.equal(result.origin, "acquisition")
  assert.equal(result.routine.items[0].product.kind, "owned")
  assert.equal(result.routine.items[0].executable, true)
  assert.equal(result.routine.items[0].assignmentKey, assignmentKey)
  assert.equal(result.portfolio.plannedPurchases.length, 0)
  assert.equal(result.portfolio.ownedProducts[0]?.userProductId, acquired.id)
  assert.equal(result.portfolio.categoryResolutions[0]?.choiceState, "owned_active")
  assert.equal(result.delta.direct.length, 1)
  assert.equal(result.delta.consequential.length, 0)
  assert.equal(previousRoutine.items[0].product.kind, "planned")
  assert.equal(previousPortfolio.plannedPurchases.length, 1)
})

test("an unrelated owned product is a semantic no-op", () => {
  const result = reconcileRoutineUserProductSource({
    routine: routine(),
    portfolio: portfolio(),
    userProduct: { ...acquired, id: "unrelated", catalogProductId: "another-product" },
    sourceRevision: 8,
  })
  assert.deepEqual(result, { status: "no_semantic_change" })
})

test("a category-mismatched source identity is rejected", () => {
  const result = reconcileRoutineUserProductSource({
    routine: routine(),
    portfolio: portfolio(),
    userProduct: { ...acquired, category: "mask" },
    sourceRevision: 8,
  })
  assert.deepEqual(result, { status: "invalid_source", reason: "category_mismatch" })
})
