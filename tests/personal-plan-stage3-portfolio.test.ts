import assert from "node:assert/strict"
import test from "node:test"

import {
  CATEGORY_AUTHORITY_STUBS,
  createProposedProductPortfolio,
  type Stage3CategoryRequirement,
  type Stage3ProductDraft,
} from "../src/lib/personal-plan/products"

const now = "2026-08-07T10:00:00.000Z"
const requirements: Stage3CategoryRequirement[] = [
  {
    category: "conditioner",
    requiredRoles: ["category_coverage"],
    needSummary: "Pflege nach jeder Wäsche",
    authorityVersion: CATEGORY_AUTHORITY_STUBS.conditioner.authorityVersion,
  },
  {
    category: "oil",
    requiredRoles: ["prewash_lengths", "damp_leave_on", "dry_finish", "scalp"],
    needSummary: "Längen versiegeln und Pre-Wash unterstützen",
    authorityVersion: CATEGORY_AUTHORITY_STUBS.oil.authorityVersion,
  },
  {
    category: "heat_protectant",
    requiredRoles: ["heat_protection_hot_tools"],
    needSummary: "Schutz vor Hitze",
    authorityVersion: CATEGORY_AUTHORITY_STUBS.heat_protectant.authorityVersion,
  },
]

function completedDraft(): Stage3ProductDraft {
  return {
    schemaVersion: 1,
    status: "active",
    authorityVersions: {
      conditioner: CATEGORY_AUTHORITY_STUBS.conditioner.authorityVersion,
      oil: CATEGORY_AUTHORITY_STUBS.oil.authorityVersion,
      heat_protectant: CATEGORY_AUTHORITY_STUBS.heat_protectant.authorityVersion,
    },
    draftId: "draft-portfolio",
    userId: "user-1",
    personalPlanId: "plan-1",
    refinedVersionId: "refined-v1",
    staleRefinedVersionId: null,
    revision: 12,
    pass: "product_decisions",
    orderedCategories: ["conditioner", "oil", "heat_protectant"],
    categoryCursor: "heat_protectant",
    products: [
      {
        capturedProductId: "conditioner-1",
        identity: {
          kind: "catalog_product",
          productId: "conditioner-product-1",
          displayName: "Conditioner A",
          category: "conditioner",
        },
        frequencyRange: "weekly_2x",
        ownership: "owned",
        source: "catalog_search",
      },
      {
        capturedProductId: "conditioner-2",
        identity: {
          kind: "catalog_product",
          productId: "conditioner-product-2",
          displayName: "Conditioner B",
          category: "conditioner",
        },
        frequencyRange: "weekly_1x",
        ownership: "owned",
        source: "catalog_search",
      },
      {
        capturedProductId: "oil-1",
        identity: {
          kind: "catalog_product",
          productId: "oil-product-1",
          displayName: "Oil A",
          category: "oil",
        },
        frequencyRange: "weekly_1x",
        ownership: "owned",
        source: "catalog_search",
      },
    ],
    roleAssignments: [
      { capturedProductId: "conditioner-1", category: "conditioner", roles: ["category_coverage"] },
      { capturedProductId: "conditioner-2", category: "conditioner", roles: ["category_coverage"] },
      {
        capturedProductId: "oil-1",
        category: "oil",
        roles: ["prewash_lengths", "damp_leave_on", "dry_finish", "scalp"],
      },
    ],
    uncoveredRoles: [
      {
        category: "heat_protectant",
        role: "heat_protection_hot_tools",
        reason: "no_product_owned",
      },
    ],
    decisions: [
      {
        decisionKey: "decision:conditioner:category_coverage:conditioner-1",
        category: "conditioner",
        role: "category_coverage",
        capturedProductId: "conditioner-1",
        verdict: "ideal",
        choiceState: "owned_active",
        criterionResults: [],
        recommendation: null,
        limitationAcknowledged: false,
      },
      {
        decisionKey: "decision:conditioner:category_coverage:conditioner-2",
        category: "conditioner",
        role: "category_coverage",
        capturedProductId: "conditioner-2",
        verdict: "supportive",
        choiceState: "owned_active",
        criterionResults: [],
        recommendation: null,
        limitationAcknowledged: false,
      },
      {
        decisionKey: "decision:oil:prewash_lengths:oil-1",
        category: "oil",
        role: "prewash_lengths",
        capturedProductId: "oil-1",
        verdict: "mismatch",
        choiceState: "planned_purchase",
        criterionResults: [],
        recommendation: {
          recommendationId: "rec-oil-1",
          category: "oil",
          role: "prewash_lengths",
          displayName: "Empfohlenes Oil",
          reason: "Bessere Pre-Wash-Pflege",
          authorityRuleId: "oil.fixture.prewash_lengths",
        },
        limitationAcknowledged: false,
      },
      {
        decisionKey: "decision:oil:damp_leave_on:oil-1",
        category: "oil",
        role: "damp_leave_on",
        capturedProductId: "oil-1",
        verdict: "supportive",
        choiceState: "owned_active",
        criterionResults: [],
        recommendation: null,
        limitationAcknowledged: false,
      },
      {
        decisionKey: "decision:oil:dry_finish:oil-1",
        category: "oil",
        role: "dry_finish",
        capturedProductId: "oil-1",
        verdict: "mismatch",
        choiceState: "owned_override",
        criterionResults: [],
        recommendation: null,
        limitationAcknowledged: true,
      },
      {
        decisionKey: "decision:oil:scalp:oil-1",
        category: "oil",
        role: "scalp",
        capturedProductId: "oil-1",
        verdict: "supportive",
        choiceState: "owned_active",
        criterionResults: [],
        recommendation: null,
        limitationAcknowledged: false,
      },
      {
        decisionKey: "decision:heat_protectant:heat_protection_hot_tools:gap",
        category: "heat_protectant",
        role: "heat_protection_hot_tools",
        capturedProductId: null,
        verdict: "unknown",
        choiceState: "unassigned",
        criterionResults: [],
        recommendation: null,
        limitationAcknowledged: false,
      },
    ],
    completedCaptureCategories: ["conditioner", "oil", "heat_protectant"],
    completedDecisionKeys: [
      "decision:conditioner:category_coverage:conditioner-1",
      "decision:conditioner:category_coverage:conditioner-2",
      "decision:oil:prewash_lengths:oil-1",
      "decision:oil:damp_leave_on:oil-1",
      "decision:oil:dry_finish:oil-1",
      "decision:oil:scalp:oil-1",
      "decision:heat_protectant:heat_protection_hot_tools:gap",
    ],
    createdAt: now,
    updatedAt: now,
  }
}

test("portfolio keeps two suitable Conditioners executable and preserves planned or uncovered gaps", () => {
  const portfolio = createProposedProductPortfolio(completedDraft(), requirements, {
    portfolioVersionId: "portfolio-v1",
    createdAt: now,
  })

  assert.deepEqual(
    portfolio.ownedProducts.map((product) => ({
      capturedProductId: product.capturedProductId,
      category: product.category,
      role: product.role,
      choiceState: product.choiceState,
    })),
    [
      {
        capturedProductId: "conditioner-1",
        category: "conditioner",
        role: "category_coverage",
        choiceState: "owned_active",
      },
      {
        capturedProductId: "conditioner-2",
        category: "conditioner",
        role: "category_coverage",
        choiceState: "owned_active",
      },
      {
        capturedProductId: "oil-1",
        category: "oil",
        role: "damp_leave_on",
        choiceState: "owned_active",
      },
      {
        capturedProductId: "oil-1",
        category: "oil",
        role: "dry_finish",
        choiceState: "owned_override",
      },
      {
        capturedProductId: "oil-1",
        category: "oil",
        role: "scalp",
        choiceState: "owned_active",
      },
    ],
  )
  assert.deepEqual(portfolio.plannedPurchases, [
    {
      plannedPurchaseId: "planned:oil:prewash_lengths",
      category: "oil",
      role: "prewash_lengths",
      recommendationId: "rec-oil-1",
      displayName: "Empfohlenes Oil",
      reason: "Bessere Pre-Wash-Pflege",
      authorityRuleId: "oil.fixture.prewash_lengths",
    },
  ])
  assert.deepEqual(portfolio.uncoveredRoles, [
    {
      category: "oil",
      role: "prewash_lengths",
      reason: "planned_purchase_not_acquired",
      linkedDecisionKey: "decision:oil:prewash_lengths:oil-1",
    },
    {
      category: "heat_protectant",
      role: "heat_protection_hot_tools",
      reason: "no_product_owned",
      linkedDecisionKey: "decision:heat_protectant:heat_protection_hot_tools:gap",
    },
  ])
})

test("portfolio rejects stale or incomplete drafts", () => {
  assert.throws(
    () =>
      createProposedProductPortfolio(
        { ...completedDraft(), status: "stale", staleRefinedVersionId: "refined-v2" },
        requirements,
        { portfolioVersionId: "portfolio-v1", createdAt: now },
      ),
    /Cannot create portfolio from incomplete draft/,
  )
  assert.throws(
    () =>
      createProposedProductPortfolio(
        { ...completedDraft(), decisions: completedDraft().decisions.slice(0, 1) },
        requirements,
        { portfolioVersionId: "portfolio-v1", createdAt: now },
      ),
    /Cannot create portfolio from incomplete draft/,
  )
})
