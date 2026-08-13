import assert from "node:assert/strict"
import test from "node:test"

import {
  CATEGORY_ROLE_POLICIES,
  createProposedProductPortfolio,
  resolveStage3ProductLoadResolution,
  type Stage3CategoryRequirement,
  type Stage3ProductDraft,
} from "../src/lib/personal-plan/products"
import {
  parseProposedProductPortfolio,
  type Stage3AuthoritySnapshotV1,
} from "../src/lib/personal-plan/products/contracts"

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

function replacementEvidence(decisionKey: string) {
  return {
    schemaVersion: 1 as const,
    subjectKey: decisionKey,
    refinedNeedVersionId: "refined-v1",
    refinedInputHash: "refined-input-v1",
    authorityVersion: CATEGORY_ROLE_POLICIES.conditioner.authorityVersion,
    productFactFingerprint: "facts-current-conditioner",
    recommendationFactFingerprint: "facts-catalog-conditioner-replacement",
    coverageRuleIds: ["conditioner.fixture.replacement"],
  }
}

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

test("portfolio v3 keeps a pending submission while projecting its selected verified replacement", () => {
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
  const draft = {
    ...base,
    orderedCategories: ["conditioner"],
    categoryCursor: null,
    products: [pendingProduct],
    roleAssignments: [
      {
        capturedProductId: pendingProduct.capturedProductId,
        category: "conditioner" as const,
        roles: ["conditioner_rinse_out" as const],
      },
    ],
    uncoveredRoles: [],
    decisions: [
      {
        decisionKey,
        category: "conditioner" as const,
        role: "conditioner_rinse_out" as const,
        capturedProductId: pendingProduct.capturedProductId,
        verdict: "mismatch" as const,
        choiceState: "planned_purchase" as const,
        resolutionAction: "select_replacement" as const,
        authorityEvidence: replacementEvidence(decisionKey),
        criterionResults: [],
        recommendation: {
          recommendationId: "rec-conditioner-replacement",
          productId: "catalog-conditioner-replacement",
          category: "conditioner" as const,
          role: "conditioner_rinse_out" as const,
          displayName: "Conditioner Ersatz",
          reason: "Deckt die geplante Routine ab",
          authorityRuleId: "conditioner.fixture.replacement",
        },
        limitationAcknowledged: false,
      },
    ],
    completedCaptureCategories: ["conditioner"],
    completedDecisionKeys: [decisionKey],
  } as unknown as Stage3ProductDraft

  const portfolio = createProposedProductPortfolio(draft, [requirements[0]], {
    portfolioVersionId: "portfolio-pending-replacement",
    createdAt: now,
  })

  assert.equal(portfolio.schemaVersion, 3)
  assert.equal(portfolio.categoryResolutions.length, 1)
  assert.deepEqual(portfolio.pendingProducts, [
    {
      capturedProductId: "pending-conditioner",
      userProductId: "user-product-pending-conditioner",
      submissionId: "submission-pending-conditioner",
      category: "conditioner",
      role: "conditioner_rinse_out",
      displayName: "Conditioner in Prüfung",
      reviewStatus: "pending_review",
    },
  ])
  assert.deepEqual(portfolio.plannedPurchases, [
    {
      plannedPurchaseId: `planned:${decisionKey}`,
      sourceDecisionKey: decisionKey,
      category: "conditioner",
      role: "conditioner_rinse_out",
      recommendationId: "rec-conditioner-replacement",
      productId: "catalog-conditioner-replacement",
      displayName: "Conditioner Ersatz",
      reason: "Deckt die geplante Routine ab",
      authorityRuleId: "conditioner.fixture.replacement",
    },
  ])
  assert.deepEqual(portfolio.uncoveredRoles, [
    {
      category: "conditioner",
      role: "conditioner_rinse_out",
      reason: "planned_purchase_not_acquired",
      linkedDecisionKey: decisionKey,
    },
    {
      category: "conditioner",
      role: "conditioner_rinse_out",
      reason: "pending_review",
      linkedDecisionKey: decisionKey,
    },
  ])
})

test("portfolio v3 moves a replaced catalog product to retained inventory", () => {
  const base = completedDraft()
  const decisionKey = "decision:conditioner:conditioner_rinse_out:conditioner-1"
  const draft = {
    ...base,
    orderedCategories: ["conditioner"],
    categoryCursor: null,
    products: [base.products[0]!],
    roleAssignments: [base.roleAssignments[0]!],
    uncoveredRoles: [],
    decisions: [
      {
        ...base.decisions[0]!,
        verdict: "mismatch" as const,
        choiceState: "planned_purchase" as const,
        resolutionAction: "select_replacement" as const,
        authorityEvidence: replacementEvidence(decisionKey),
        recommendation: {
          recommendationId: "rec-conditioner-replacement",
          productId: "catalog-conditioner-replacement",
          category: "conditioner" as const,
          role: "conditioner_rinse_out" as const,
          displayName: "Conditioner Ersatz",
          reason: "Deckt die geplante Routine ab",
          authorityRuleId: "conditioner.fixture.replacement",
        },
      },
    ],
    completedCaptureCategories: ["conditioner"],
    completedDecisionKeys: [decisionKey],
  } as unknown as Stage3ProductDraft

  const portfolio = createProposedProductPortfolio(draft, [requirements[0]], {
    portfolioVersionId: "portfolio-retained-replacement",
    createdAt: now,
  })

  assert.equal(portfolio.schemaVersion, 3)
  assert.deepEqual(portfolio.ownedProducts, [])
  assert.deepEqual(portfolio.retainedOwnedProducts, [
    {
      capturedProductId: "conditioner-1",
      userProductId: "user-product-conditioner-1",
      productId: "conditioner-product-1",
      displayName: "Conditioner A",
      category: "conditioner",
      role: "conditioner_rinse_out",
      sourceDecisionKey: decisionKey,
      planStatus: "not_used",
    },
  ])
  assert.deepEqual(
    portfolio.plannedPurchases.map((purchase) => purchase.plannedPurchaseId),
    [`planned:${decisionKey}`],
  )
})

test("portfolio v3 round-trips a selected replacement beside a legacy planned recommendation", () => {
  const base = completedDraft()
  const replacementDecisionKey = "decision:conditioner:conditioner_rinse_out:conditioner-1"
  const draft = {
    ...base,
    decisions: base.decisions.map((decision) =>
      decision.decisionKey === replacementDecisionKey
        ? {
            ...decision,
            verdict: "mismatch" as const,
            choiceState: "planned_purchase" as const,
            resolutionAction: "select_replacement" as const,
            authorityEvidence: replacementEvidence(replacementDecisionKey),
            recommendation: {
              recommendationId: "rec-conditioner-replacement",
              productId: "catalog-conditioner-replacement",
              category: "conditioner" as const,
              role: "conditioner_rinse_out" as const,
              displayName: "Conditioner Ersatz",
              reason: "Deckt die geplante Routine ab",
              authorityRuleId: "conditioner.fixture.replacement",
            },
          }
        : decision,
    ),
  } as Stage3ProductDraft

  const portfolio = createProposedProductPortfolio(draft, requirements, {
    portfolioVersionId: "portfolio-mixed-v3",
    createdAt: now,
  })
  const parsed = parseProposedProductPortfolio(portfolio)

  assert.equal(parsed.schemaVersion, 3)
  assert.deepEqual(
    parsed.plannedPurchases.map((purchase) => ({
      productId: purchase.productId,
      sourceDecisionKey: purchase.sourceDecisionKey,
    })),
    [
      {
        productId: "catalog-conditioner-replacement",
        sourceDecisionKey: replacementDecisionKey,
      },
      {
        productId: "catalog-oil-recommended",
        sourceDecisionKey: "decision:oil:pre_wash_fibre_treatment:oil-1",
      },
    ],
  )
})

test("portfolio v4 retains inventory-only catalog and pending products outside Routine-owned products", () => {
  const base = completedDraft()
  const inventoryOnlyProducts = [
    {
      capturedProductId: "dry-shampoo-owned",
      userProductId: "user-product-dry-shampoo-owned",
      identity: {
        kind: "catalog_product" as const,
        productId: "catalog-dry-shampoo-owned",
        displayName: "Trockenshampoo vorhanden",
        category: "dry_shampoo" as const,
      },
      frequencyRange: "weekly_1x" as const,
      ownership: "owned" as const,
      source: "catalog_search" as const,
    },
    {
      capturedProductId: "leave-in-pending",
      userProductId: "user-product-leave-in-pending",
      identity: {
        kind: "pending_submission" as const,
        submissionId: "submission-leave-in-pending",
        displayName: "Leave-in in Prüfung",
        category: "leave_in" as const,
        reviewStatus: "pending_review" as const,
      },
      frequencyRange: "weekly_2x" as const,
      ownership: "owned" as const,
      source: "intake_fallback" as const,
    },
  ]
  const inventoryDispositions = [
    {
      schemaVersion: 1 as const,
      dispositionKey: "inventory:dry_shampoo:dry-shampoo-owned",
      capturedProductId: "dry-shampoo-owned",
      category: "dry_shampoo" as const,
      planStatus: "not_used" as const,
      reason: "category_not_in_final_plan" as const,
      acknowledged: true,
      authorityFingerprint: "d".repeat(64),
    },
    {
      schemaVersion: 1 as const,
      dispositionKey: "inventory:leave_in:leave-in-pending",
      capturedProductId: "leave-in-pending",
      category: "leave_in" as const,
      planStatus: "not_used" as const,
      reason: "not_assigned_to_final_role" as const,
      acknowledged: true,
      authorityFingerprint: "d".repeat(64),
    },
  ]
  const draft: Stage3ProductDraft = {
    ...base,
    orderedCategories: [...base.orderedCategories, "dry_shampoo", "leave_in"],
    completedCaptureCategories: [...base.completedCaptureCategories, "dry_shampoo", "leave_in"],
    products: [...base.products, ...inventoryOnlyProducts],
    inventoryAuthority: {
      schemaVersion: 1,
      stage2RefinedNeedVersionId: "refined-v1",
      inventorySnapshotFingerprint: "c".repeat(64),
      status: "rejected",
      proposalFingerprint: "d".repeat(64),
      proposedInputHash: null,
      proposedOutputSnapshot: null,
      materialDelta: [],
      resolvedFingerprint: "d".repeat(64),
    },
    inventoryDispositions,
  }

  const portfolio = createProposedProductPortfolio(draft, requirements, {
    portfolioVersionId: "portfolio-v4-inventory",
    createdAt: now,
  })
  const parsed = parseProposedProductPortfolio(portfolio, { includeV4: true })

  assert.equal(parsed.schemaVersion, 4)
  assert.equal(parsed.ownedProducts.some((product) => product.category === "dry_shampoo"), false)
  assert.equal(parsed.ownedProducts.some((product) => product.category === "leave_in"), false)
  assert.deepEqual(parsed.retainedInventoryProducts, [
    {
      kind: "catalog_product",
      capturedProductId: "dry-shampoo-owned",
      userProductId: "user-product-dry-shampoo-owned",
      productId: "catalog-dry-shampoo-owned",
      displayName: "Trockenshampoo vorhanden",
      category: "dry_shampoo",
      role: null,
      sourceDispositionKey: "inventory:dry_shampoo:dry-shampoo-owned",
      planStatus: "not_used",
      reason: "category_not_in_final_plan",
    },
    {
      kind: "pending_submission",
      capturedProductId: "leave-in-pending",
      userProductId: "user-product-leave-in-pending",
      submissionId: "submission-leave-in-pending",
      displayName: "Leave-in in Prüfung",
      category: "leave_in",
      role: null,
      reviewStatus: "pending_review",
      sourceDispositionKey: "inventory:leave_in:leave-in-pending",
      planStatus: "not_used",
      reason: "not_assigned_to_final_role",
    },
  ])
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
