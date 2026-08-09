import assert from "node:assert/strict"
import test from "node:test"

import {
  CATEGORY_ROLE_POLICIES,
  createProposedProductPortfolio,
  resolveStage3ProductLoadResolution,
  type Stage3CategoryRequirement,
  type Stage3ProductDraft,
} from "../src/lib/personal-plan/products"
import type { Stage3AuthoritySnapshotV1 } from "../src/lib/personal-plan/products/contracts"

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

test("pending products enter the portfolio only when the user keeps the pending review", () => {
  const base = completedDraft()
  const pendingProduct = {
    capturedProductId: "pending-conditioner",
    userProductId: "user-product-pending-conditioner",
    identity: {
      kind: "pending_submission" as const,
      submissionId: "submission-pending-conditioner",
      displayName: "Conditioner in Prüfung",
      category: "conditioner" as const,
      reviewStatus: "pending_review" as const,
    },
    frequencyRange: "weekly_2x" as const,
    ownership: "owned" as const,
    source: "intake_fallback" as const,
  }
  const decisionKey = "decision:conditioner:conditioner_rinse_out:pending-conditioner"
  const pendingDraft = (choiceState: "pending_review" | "unassigned"): Stage3ProductDraft => ({
    ...base,
    orderedCategories: ["conditioner"],
    categoryCursor: null,
    products: [pendingProduct],
    roleAssignments: [
      {
        capturedProductId: pendingProduct.capturedProductId,
        category: "conditioner",
        roles: ["conditioner_rinse_out"],
      },
    ],
    uncoveredRoles: [],
    decisions: [
      {
        decisionKey,
        category: "conditioner",
        role: "conditioner_rinse_out",
        capturedProductId: pendingProduct.capturedProductId,
        verdict: "unknown",
        choiceState,
        criterionResults: [],
        recommendation: null,
        limitationAcknowledged: false,
      },
    ],
    completedCaptureCategories: ["conditioner"],
    completedDecisionKeys: [decisionKey],
  })

  const kept = createProposedProductPortfolio(pendingDraft("pending_review"), [requirements[0]], {
    portfolioVersionId: "portfolio-pending-kept",
    createdAt: now,
  })
  const skipped = createProposedProductPortfolio(pendingDraft("unassigned"), [requirements[0]], {
    portfolioVersionId: "portfolio-pending-skipped",
    createdAt: now,
  })

  assert.equal(kept.pendingProducts.length, 1)
  assert.equal(kept.uncoveredRoles[0]?.reason, "pending_review")
  assert.deepEqual(skipped.pendingProducts, [])
  assert.equal(skipped.uncoveredRoles[0]?.reason, "unassigned")
})

function productLoadSnapshot(): Stage3AuthoritySnapshotV1 {
  return {
    schemaVersion: 1,
    refinedNeedVersionId: "refined-v1",
    refinedInputHash: "refined-input-v1",
    productLoadContext: {
      schemaVersion: 1,
      scalpOiliness: "balanced",
      deepCleansingScalpPause: false,
      hasLowVolumeOrWeighedDown: false,
      shampooFrequency: "weekly_2x",
      oilPurposes: [],
    },
    categoryDecisions: [
      {
        category: "deep_cleansing_shampoo",
        resolution: "resolved",
        needTier: "not_needed",
        roles: [],
        target: null,
        frequency: null,
        reasons: [],
        executionState: "available",
        executionPauseReason: null,
        deferredFacts: [],
      },
      {
        category: "scalp_care",
        resolution: "resolved",
        needTier: "not_needed",
        roles: [],
        target: null,
        frequency: null,
        reasons: [],
        executionState: "available",
        executionPauseReason: null,
        deferredFacts: [],
      },
    ],
    coverage: [],
    orderedCategories: ["dry_shampoo"],
    inventoryOnlyCategories: ["dry_shampoo"],
    authorityVersions: Object.fromEntries(
      Object.entries(CATEGORY_ROLE_POLICIES).map(([category, policy]) => [
        category,
        policy.authorityVersion,
      ]),
    ) as Stage3AuthoritySnapshotV1["authorityVersions"],
  }
}

function productLoadDraft(): {
  draft: Stage3ProductDraft
  requirements: Stage3CategoryRequirement[]
} {
  const requirements: Stage3CategoryRequirement[] = [
    {
      category: "dry_shampoo",
      requiredRoles: [],
      needSummary: "Aktuell verwendetes Trockenshampoo erfassen",
      authorityVersion: CATEGORY_ROLE_POLICIES.dry_shampoo.authorityVersion,
    },
  ]
  const draft = {
    schemaVersion: 1,
    status: "active",
    authorityVersions: {
      dry_shampoo: CATEGORY_ROLE_POLICIES.dry_shampoo.authorityVersion,
      deep_cleansing_shampoo: CATEGORY_ROLE_POLICIES.deep_cleansing_shampoo.authorityVersion,
      scalp_care: CATEGORY_ROLE_POLICIES.scalp_care.authorityVersion,
    },
    draftId: "draft-product-load-portfolio",
    userId: "user-1",
    personalPlanId: "plan-1",
    refinedVersionId: "refined-v1",
    staleRefinedVersionId: null,
    revision: 5,
    pass: "product_decisions",
    orderedCategories: ["dry_shampoo", "deep_cleansing_shampoo", "scalp_care"],
    categoryCursor: null,
    products: [
      {
        capturedProductId: "dry-shampoo-1",
        userProductId: "user-product-dry-shampoo-1",
        identity: {
          kind: "pending_submission",
          submissionId: "submission-dry-shampoo-1",
          displayName: "Trockenshampoo in Prüfung",
          category: "dry_shampoo",
          reviewStatus: "pending_review",
        },
        frequencyRange: "weekly_3_4x",
        ownership: "owned",
        source: "intake_fallback",
      },
    ],
    roleAssignments: [],
    uncoveredRoles: [
      {
        category: "deep_cleansing_shampoo",
        role: "residue_reset",
        reason: "no_product_owned",
      },
      {
        category: "scalp_care",
        role: "scalp_exfoliant",
        reason: "no_product_owned",
      },
    ],
    decisions: [
      {
        decisionKey: "decision:deep_cleansing_shampoo:residue_reset:gap",
        category: "deep_cleansing_shampoo",
        role: "residue_reset",
        capturedProductId: null,
        verdict: "unknown",
        choiceState: "unassigned",
        criterionResults: [],
        recommendation: null,
        limitationAcknowledged: false,
      },
      {
        decisionKey: "decision:scalp_care:scalp_exfoliant:gap",
        category: "scalp_care",
        role: "scalp_exfoliant",
        capturedProductId: null,
        verdict: "unknown",
        choiceState: "unassigned",
        criterionResults: [],
        recommendation: null,
        limitationAcknowledged: false,
      },
    ],
    completedCaptureCategories: ["dry_shampoo", "deep_cleansing_shampoo", "scalp_care"],
    completedDecisionKeys: [
      "decision:deep_cleansing_shampoo:residue_reset:gap",
      "decision:scalp_care:scalp_exfoliant:gap",
    ],
    createdAt: now,
    updatedAt: now,
    authoritySnapshot: productLoadSnapshot(),
  } satisfies Stage3ProductDraft
  return {
    draft: { ...draft, productLoadResolution: resolveStage3ProductLoadResolution(draft) },
    requirements,
  }
}

test("portfolio freezes the server-created product-load overlay and rejects stale fingerprints", () => {
  const { draft, requirements } = productLoadDraft()

  const portfolio = createProposedProductPortfolio(draft, requirements, {
    portfolioVersionId: "portfolio-product-load",
    createdAt: now,
  })

  assert.equal(portfolio.schemaVersion, 2)
  assert.equal(portfolio.productLoadResolution?.capturedFrequencyFingerprint.length, 64)
  assert.deepEqual(
    portfolio.productLoadResolution?.decisions.map((decision) => decision.category),
    ["deep_cleansing_shampoo", "scalp_care"],
  )

  assert.throws(
    () =>
      createProposedProductPortfolio(
        {
          ...draft,
          productLoadResolution: {
            ...draft.productLoadResolution!,
            capturedFrequencyFingerprint: "stale",
          },
        },
        requirements,
        { portfolioVersionId: "portfolio-product-load", createdAt: now },
      ),
    /stale_product_load_resolution/,
  )
})
