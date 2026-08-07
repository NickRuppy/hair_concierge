import assert from "node:assert/strict"
import test from "node:test"

import {
  CATEGORY_AUTHORITY_STUBS,
  OIL_PURPOSES,
  PERSONAL_PLAN_PRODUCT_CATEGORIES,
  deriveStage3DecisionSubjects,
  stage3CapturedProductSchema,
  stage3ProductDecisionSchema,
  stage3RoleAssignmentSchema,
  validateStage3Draft,
  type Stage3ProductDraft,
} from "../src/lib/personal-plan/products"

const now = "2026-08-07T10:00:00.000Z"

function draft(overrides: Partial<Stage3ProductDraft> = {}): Stage3ProductDraft {
  return {
    schemaVersion: 1,
    status: "active",
    authorityVersions: { oil: CATEGORY_AUTHORITY_STUBS.oil.authorityVersion },
    draftId: "draft-contract",
    userId: "user-1",
    personalPlanId: "plan-1",
    refinedVersionId: "refined-v1",
    staleRefinedVersionId: null,
    revision: 0,
    pass: "product_decisions",
    orderedCategories: ["oil"],
    categoryCursor: "oil",
    products: [
      {
        capturedProductId: "oil-1",
        identity: {
          kind: "catalog_product",
          productId: "catalog-oil-1",
          displayName: "Locken Oil",
          category: "oil",
        },
        frequencyRange: "weekly_2x",
        ownership: "owned",
        source: "catalog_search",
      },
    ],
    roleAssignments: [
      { capturedProductId: "oil-1", category: "oil", roles: ["dry_finish"] },
    ],
    uncoveredRoles: [],
    decisions: [],
    completedCaptureCategories: ["oil"],
    completedDecisionKeys: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

test("Stage 3 owns exact category, Oil purpose, and Conditioner coverage literals", () => {
  assert.deepEqual(PERSONAL_PLAN_PRODUCT_CATEGORIES, [
    "shampoo",
    "conditioner",
    "leave_in",
    "heat_protectant",
    "oil",
    "mask",
    "scalp_care",
    "dry_shampoo",
    "bondbuilder",
    "deep_cleansing_shampoo",
  ])
  assert.deepEqual(OIL_PURPOSES, ["prewash_lengths", "damp_leave_on", "dry_finish", "scalp"])
  assert.deepEqual(CATEGORY_AUTHORITY_STUBS.oil.requiredRoles, [
    "prewash_lengths",
    "damp_leave_on",
    "dry_finish",
    "scalp",
  ])
  assert.deepEqual(CATEGORY_AUTHORITY_STUBS.conditioner.requiredRoles, ["category_coverage"])
  assert.equal(
    CATEGORY_AUTHORITY_STUBS.conditioner.roleMultiplicity.category_coverage,
    "multiple_products_per_role",
  )
  assert.equal(CATEGORY_AUTHORITY_STUBS.heat_protectant.catalogSupport, "fixture_only")
  assert.equal(CATEGORY_AUTHORITY_STUBS.scalp_care.catalogSupport, "fixture_only")
})

test("captured products require exact identity, owned state, and canonical ProductFrequency", () => {
  const valid = {
    capturedProductId: "captured-1",
    identity: {
      kind: "catalog_product",
      productId: "product-1",
      displayName: "Produkt",
      category: "shampoo",
    },
    frequencyRange: "weekly_2x",
    ownership: "owned",
    source: "catalog_search",
  }
  assert.equal(stage3CapturedProductSchema.safeParse(valid).success, true)
  assert.equal(
    stage3CapturedProductSchema.safeParse({ ...valid, frequencyRange: "sometimes" }).success,
    false,
  )
  assert.equal(
    stage3CapturedProductSchema.safeParse({
      ...valid,
      identity: { ...valid.identity, category: "styling_gel" },
    }).success,
    false,
  )
})

test("role and decision schemas enforce category authority and explicit allowed choices", () => {
  assert.equal(
    stage3RoleAssignmentSchema.safeParse({
      capturedProductId: "oil-1",
      category: "oil",
      roles: ["prewash_lengths", "damp_leave_on", "dry_finish", "scalp"],
    }).success,
    true,
  )
  assert.equal(
    stage3RoleAssignmentSchema.safeParse({
      capturedProductId: "oil-1",
      category: "oil",
      roles: ["category_coverage"],
    }).success,
    false,
  )

  const decision = {
    decisionKey: "decision:oil:dry_finish:oil-1",
    category: "oil",
    role: "dry_finish",
    capturedProductId: "oil-1",
    verdict: "ideal",
    choiceState: "owned_active",
    criterionResults: [],
    recommendation: null,
    limitationAcknowledged: false,
  }
  assert.equal(stage3ProductDecisionSchema.safeParse(decision).success, true)
  assert.equal(
    stage3ProductDecisionSchema.safeParse({ ...decision, verdict: "unknown" }).success,
    false,
  )
  assert.equal(
    stage3ProductDecisionSchema.safeParse({
      ...decision,
      verdict: "mismatch",
      choiceState: "owned_override",
      limitationAcknowledged: false,
    }).success,
    false,
  )
})

test("draft validation allows Conditioner coverage multiplicity but rejects duplicate Oil purpose ownership", () => {
  assert.deepEqual(validateStage3Draft(draft()), [])

  assert.deepEqual(
    validateStage3Draft({
      ...draft(),
      orderedCategories: ["conditioner"],
      products: [
        {
          ...draft().products[0],
          capturedProductId: "conditioner-1",
          identity: {
            kind: "catalog_product",
            productId: "conditioner-1",
            displayName: "Conditioner A",
            category: "conditioner",
          },
        },
        {
          ...draft().products[0],
          capturedProductId: "conditioner-2",
          identity: {
            kind: "catalog_product",
            productId: "conditioner-2",
            displayName: "Conditioner B",
            category: "conditioner",
          },
        },
      ],
      roleAssignments: [
        { capturedProductId: "conditioner-1", category: "conditioner", roles: ["category_coverage"] },
        { capturedProductId: "conditioner-2", category: "conditioner", roles: ["category_coverage"] },
      ],
    }),
    [],
  )

  assert.match(
    validateStage3Draft(
      draft({
        products: [
          ...draft().products,
          {
            capturedProductId: "oil-2",
            identity: {
              kind: "catalog_product",
              productId: "catalog-oil-2",
              displayName: "Zweites Oil",
              category: "oil",
            },
            frequencyRange: "weekly_1x",
            ownership: "owned",
            source: "catalog_search",
          },
        ],
        roleAssignments: [
          { capturedProductId: "oil-1", category: "oil", roles: ["dry_finish"] },
          { capturedProductId: "oil-2", category: "oil", roles: ["dry_finish"] },
        ],
      }),
    ).join("\n"),
    /role dry_finish already assigned/,
  )
})

test("decision subjects are derived per assigned product-role or explicit gap", () => {
  const subjects = deriveStage3DecisionSubjects({
    ...draft(),
    orderedCategories: ["conditioner"],
    products: [
      {
        ...draft().products[0],
        capturedProductId: "conditioner-1",
        identity: {
          kind: "catalog_product",
          productId: "conditioner-1",
          displayName: "Conditioner A",
          category: "conditioner",
        },
      },
      {
        ...draft().products[0],
        capturedProductId: "conditioner-2",
        identity: {
          kind: "catalog_product",
          productId: "conditioner-2",
          displayName: "Conditioner B",
          category: "conditioner",
        },
      },
    ],
    roleAssignments: [
      { capturedProductId: "conditioner-1", category: "conditioner", roles: ["category_coverage"] },
      { capturedProductId: "conditioner-2", category: "conditioner", roles: ["category_coverage"] },
    ],
    uncoveredRoles: [
      { category: "heat_protectant", role: "heat_protection_hot_tools", reason: "no_product_owned" },
    ],
  })

  assert.deepEqual(subjects, [
    {
      decisionKey: "decision:conditioner:category_coverage:conditioner-1",
      category: "conditioner",
      role: "category_coverage",
      capturedProductId: "conditioner-1",
      subjectKind: "captured_product",
    },
    {
      decisionKey: "decision:conditioner:category_coverage:conditioner-2",
      category: "conditioner",
      role: "category_coverage",
      capturedProductId: "conditioner-2",
      subjectKind: "captured_product",
    },
    {
      decisionKey: "decision:heat_protectant:heat_protection_hot_tools:gap",
      category: "heat_protectant",
      role: "heat_protection_hot_tools",
      capturedProductId: null,
      subjectKind: "uncovered_role",
    },
  ])

  assert.match(
    validateStage3Draft({
      ...draft(),
      decisions: [
        {
          decisionKey: "decision:oil:dry_finish:oil-2",
          category: "oil",
          role: "dry_finish",
          capturedProductId: "oil-1",
          verdict: "ideal",
          choiceState: "owned_active",
          criterionResults: [],
          recommendation: null,
          limitationAcknowledged: false,
        },
      ],
    }).join("\n"),
    /decision decision:oil:dry_finish:oil-2 is not a derived decision subject/,
  )
})
