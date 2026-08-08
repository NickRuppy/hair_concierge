import assert from "node:assert/strict"
import test from "node:test"

import {
  CATEGORY_ROLE_POLICIES,
  createProposedProductPortfolio,
  type Stage3CategoryRequirement,
  type Stage3ProductDraft,
} from "../src/lib/personal-plan/products"

const now = "2026-08-07T10:00:00.000Z"
const requirements: Stage3CategoryRequirement[] = [
  {
    category: "conditioner",
    requiredRoles: ["conditioner_rinse_out"],
    needSummary: "Pflege nach jeder Wäsche",
    authorityVersion: CATEGORY_ROLE_POLICIES.conditioner.authorityVersion,
  },
  {
    category: "oil",
    requiredRoles: ["pre_wash_fibre_treatment", "leave_on_fibre_conditioning", "dry_finish"],
    needSummary: "Längen versiegeln und Pre-Wash unterstützen",
    authorityVersion: CATEGORY_ROLE_POLICIES.oil.authorityVersion,
  },
  {
    category: "heat_protectant",
    requiredRoles: ["pre_heat_protection"],
    qualifyingRoutes: ["direct_contact_heat"],
    needSummary: "Schutz vor Hitze",
    authorityVersion: CATEGORY_ROLE_POLICIES.heat_protectant.authorityVersion,
  },
]

function completedDraft(): Stage3ProductDraft {
  return {
    schemaVersion: 1,
    status: "active",
    authorityVersions: {
      conditioner: CATEGORY_ROLE_POLICIES.conditioner.authorityVersion,
      oil: CATEGORY_ROLE_POLICIES.oil.authorityVersion,
      heat_protectant: CATEGORY_ROLE_POLICIES.heat_protectant.authorityVersion,
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
        userProductId: "user-product-conditioner-1",
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
        userProductId: "user-product-conditioner-2",
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
        userProductId: "user-product-oil-1",
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
      {
        capturedProductId: "conditioner-1",
        category: "conditioner",
        roles: ["conditioner_rinse_out"],
      },
      {
        capturedProductId: "conditioner-2",
        category: "conditioner",
        roles: ["conditioner_rinse_out"],
      },
      {
        capturedProductId: "oil-1",
        category: "oil",
        roles: ["pre_wash_fibre_treatment", "leave_on_fibre_conditioning", "dry_finish"],
      },
    ],
    uncoveredRoles: [
      {
        category: "heat_protectant",
        role: "pre_heat_protection",
        reason: "no_product_owned",
      },
    ],
    decisions: [
      {
        decisionKey: "decision:conditioner:conditioner_rinse_out:conditioner-1",
        category: "conditioner",
        role: "conditioner_rinse_out",
        capturedProductId: "conditioner-1",
        verdict: "ideal",
        choiceState: "owned_active",
        criterionResults: [],
        recommendation: null,
        limitationAcknowledged: false,
      },
      {
        decisionKey: "decision:conditioner:conditioner_rinse_out:conditioner-2",
        category: "conditioner",
        role: "conditioner_rinse_out",
        capturedProductId: "conditioner-2",
        verdict: "supportive",
        choiceState: "owned_active",
        criterionResults: [],
        recommendation: null,
        limitationAcknowledged: false,
      },
      {
        decisionKey: "decision:oil:pre_wash_fibre_treatment:oil-1",
        category: "oil",
        role: "pre_wash_fibre_treatment",
        capturedProductId: "oil-1",
        verdict: "mismatch",
        choiceState: "planned_purchase",
        criterionResults: [],
        recommendation: {
          recommendationId: "rec-oil-1",
          productId: "catalog-oil-recommended",
          category: "oil",
          role: "pre_wash_fibre_treatment",
          displayName: "Empfohlenes Oil",
          reason: "Bessere Pre-Wash-Pflege",
          authorityRuleId: "oil.fixture.pre_wash_fibre_treatment",
        },
        limitationAcknowledged: false,
      },
      {
        decisionKey: "decision:oil:leave_on_fibre_conditioning:oil-1",
        category: "oil",
        role: "leave_on_fibre_conditioning",
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
        decisionKey: "decision:heat_protectant:pre_heat_protection:gap",
        category: "heat_protectant",
        role: "pre_heat_protection",
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
      "decision:conditioner:conditioner_rinse_out:conditioner-1",
      "decision:conditioner:conditioner_rinse_out:conditioner-2",
      "decision:oil:pre_wash_fibre_treatment:oil-1",
      "decision:oil:dry_finish:oil-1",
      "decision:oil:leave_on_fibre_conditioning:oil-1",
      "decision:heat_protectant:pre_heat_protection:gap",
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
        role: "conditioner_rinse_out",
        choiceState: "owned_active",
      },
      {
        capturedProductId: "conditioner-2",
        category: "conditioner",
        role: "conditioner_rinse_out",
        choiceState: "owned_active",
      },
      {
        capturedProductId: "oil-1",
        category: "oil",
        role: "leave_on_fibre_conditioning",
        choiceState: "owned_active",
      },
      {
        capturedProductId: "oil-1",
        category: "oil",
        role: "dry_finish",
        choiceState: "owned_override",
      },
    ],
  )
  assert.deepEqual(portfolio.plannedPurchases, [
    {
      plannedPurchaseId: "planned:oil:pre_wash_fibre_treatment",
      category: "oil",
      role: "pre_wash_fibre_treatment",
      recommendationId: "rec-oil-1",
      productId: "catalog-oil-recommended",
      displayName: "Empfohlenes Oil",
      reason: "Bessere Pre-Wash-Pflege",
      authorityRuleId: "oil.fixture.pre_wash_fibre_treatment",
    },
  ])
  assert.deepEqual(portfolio.uncoveredRoles, [
    {
      category: "oil",
      role: "pre_wash_fibre_treatment",
      reason: "planned_purchase_not_acquired",
      linkedDecisionKey: "decision:oil:pre_wash_fibre_treatment:oil-1",
    },
    {
      category: "heat_protectant",
      role: "pre_heat_protection",
      reason: "no_product_owned",
      linkedDecisionKey: "decision:heat_protectant:pre_heat_protection:gap",
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
