import assert from "node:assert/strict"
import test from "node:test"

import {
  CATEGORY_ROLE_POLICIES,
  PERSONAL_PLAN_PRODUCT_CATEGORIES,
  PLAN_PRODUCT_ROLES,
  deriveStage3DecisionSubjects,
  stage3CategoryRequirementSchema,
  stage3CapturedProductSchema,
  stage3ProductDecisionSchema,
  stage3RoleAssignmentSchema,
  validateStage3Draft,
  type Stage3ProductDraft,
} from "../src/lib/personal-plan/products"
import { classifyStage3DesiredState } from "../src/lib/personal-plan/products/recovery-desired-state"

const now = "2026-08-07T10:00:00.000Z"

function draft(overrides: Partial<Stage3ProductDraft> = {}): Stage3ProductDraft {
  return {
    schemaVersion: 1,
    status: "active",
    authorityVersions: { oil: CATEGORY_ROLE_POLICIES.oil.authorityVersion },
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
        userProductId: "user-product-oil-1",
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
    roleAssignments: [{ capturedProductId: "oil-1", category: "oil", roles: ["dry_finish"] }],
    uncoveredRoles: [],
    decisions: [],
    completedCaptureCategories: ["oil"],
    completedDecisionKeys: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

test("Stage 3 owns canonical PlanProductRole authorities without fixture provenance", () => {
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
  assert.deepEqual(CATEGORY_ROLE_POLICIES.oil.allowedRoles, [
    "pre_wash_fibre_treatment",
    "leave_on_fibre_conditioning",
    "dry_finish",
  ])
  assert.deepEqual(CATEGORY_ROLE_POLICIES.scalp_care.allowedRoles, [
    "scalp_comfort",
    "scalp_flake_oil_adjunct",
    "density_claim_tonic",
    "scalp_exfoliant",
  ])
  assert.deepEqual(CATEGORY_ROLE_POLICIES.heat_protectant.allowedRoles, ["pre_heat_protection"])
  assert.equal(
    CATEGORY_ROLE_POLICIES.conditioner.roleMultiplicity.conditioner_rinse_out,
    "multiple_products_per_role",
  )
  for (const policy of Object.values(CATEGORY_ROLE_POLICIES)) {
    assert.equal(policy.authorityVersion.startsWith("stage3.fixture."), false)
  }
})

test("every canonical role belongs to exactly one category policy", () => {
  for (const role of PLAN_PRODUCT_ROLES) {
    const owners = Object.values(CATEGORY_ROLE_POLICIES)
      .filter((policy) => policy.allowedRoles.some((allowedRole) => allowedRole === role))
      .map((policy) => policy.category)

    assert.equal(owners.length, 1, `${role} must have exactly one category owner`)
  }
})

test("captured products require exact identity, owned state, and canonical ProductFrequency", () => {
  const valid = {
    capturedProductId: "captured-1",
    userProductId: "user-product-1",
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
  const { userProductId: _missingUserProductId, ...withoutUserProductId } = valid
  assert.equal(stage3CapturedProductSchema.safeParse(withoutUserProductId).success, false)
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
    stage3CategoryRequirementSchema.safeParse({
      category: "oil",
      requiredRoles: ["conditioner_rinse_out"],
      needSummary: "Oil",
      authorityVersion: CATEGORY_ROLE_POLICIES.oil.authorityVersion,
    }).success,
    false,
  )
  assert.equal(
    stage3CategoryRequirementSchema.safeParse({
      category: "heat_protectant",
      requiredRoles: ["pre_heat_protection"],
      needSummary: "Heat",
      authorityVersion: CATEGORY_ROLE_POLICIES.heat_protectant.authorityVersion,
    }).success,
    false,
  )
  assert.equal(
    stage3RoleAssignmentSchema.safeParse({
      capturedProductId: "oil-1",
      category: "oil",
      roles: ["pre_wash_fibre_treatment", "leave_on_fibre_conditioning", "dry_finish"],
    }).success,
    true,
  )
  assert.equal(
    stage3RoleAssignmentSchema.safeParse({
      capturedProductId: "oil-1",
      category: "oil",
      roles: ["conditioner_rinse_out"],
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

test("replacement resolutions retain their semantic action and selected candidate in canonical state", () => {
  const decision = {
    decisionKey: "decision:oil:dry_finish:oil-1",
    category: "oil" as const,
    role: "dry_finish" as const,
    capturedProductId: "oil-1",
    verdict: "mismatch" as const,
    choiceState: "planned_purchase" as const,
    criterionResults: [],
    recommendation: {
      recommendationId: "replacement-1",
      productId: "replacement-1",
      category: "oil" as const,
      role: "dry_finish" as const,
      displayName: "Passendes Öl",
      reason: "Passt besser",
      authorityRuleId: "rule-1",
    },
    limitationAcknowledged: false,
    resolutionAction: "select_replacement" as const,
  }

  assert.equal(stage3ProductDecisionSchema.safeParse(decision).success, true)
  const replacementDraft = draft({ decisions: [decision] })
  assert.equal(
    classifyStage3DesiredState(replacementDraft, {
      type: "resolve_decision",
      subjectKey: decision.decisionKey,
      action: "select_replacement",
      selectedCandidateId: "replacement-1",
    }),
    "satisfied",
  )
  assert.equal(
    classifyStage3DesiredState(replacementDraft, {
      type: "resolve_decision",
      subjectKey: decision.decisionKey,
      action: "plan_recommendation",
      selectedCandidateId: "replacement-1",
    }),
    "different",
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
          userProductId: "user-product-conditioner-1",
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
          userProductId: "user-product-conditioner-2",
          identity: {
            kind: "catalog_product",
            productId: "conditioner-2",
            displayName: "Conditioner B",
            category: "conditioner",
          },
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
            userProductId: "user-product-oil-2",
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
        userProductId: "user-product-conditioner-1",
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
        userProductId: "user-product-conditioner-2",
        identity: {
          kind: "catalog_product",
          productId: "conditioner-2",
          displayName: "Conditioner B",
          category: "conditioner",
        },
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
    ],
    uncoveredRoles: [
      { category: "heat_protectant", role: "pre_heat_protection", reason: "no_product_owned" },
    ],
  })

  assert.deepEqual(subjects, [
    {
      decisionKey: "decision:conditioner:conditioner_rinse_out:conditioner-1",
      category: "conditioner",
      role: "conditioner_rinse_out",
      capturedProductId: "conditioner-1",
      subjectKind: "captured_product",
    },
    {
      decisionKey: "decision:conditioner:conditioner_rinse_out:conditioner-2",
      category: "conditioner",
      role: "conditioner_rinse_out",
      capturedProductId: "conditioner-2",
      subjectKind: "captured_product",
    },
    {
      decisionKey: "decision:heat_protectant:pre_heat_protection:gap",
      category: "heat_protectant",
      role: "pre_heat_protection",
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

test("decision subjects keep category and role authority order after a reopened category is appended", () => {
  const commonDraft = {
    ...draft(),
    orderedCategories: ["oil", "bondbuilder"],
    products: [],
    roleAssignments: [],
  } satisfies Stage3ProductDraft
  const oilGaps = [
    { category: "oil", role: "dry_finish", reason: "no_product_owned" },
    { category: "oil", role: "pre_wash_fibre_treatment", reason: "no_product_owned" },
    { category: "oil", role: "leave_on_fibre_conditioning", reason: "no_product_owned" },
  ] as const
  const bondbuilderGap = {
    category: "bondbuilder",
    role: "specialized_bond_treatment",
    reason: "no_product_owned",
  } as const
  const initialSubjects = deriveStage3DecisionSubjects({
    ...commonDraft,
    uncoveredRoles: [...oilGaps, bondbuilderGap],
  })
  const reopenedSubjects = deriveStage3DecisionSubjects({
    ...commonDraft,
    uncoveredRoles: [bondbuilderGap, ...oilGaps],
  })
  const expected = [
    "oil:pre_wash_fibre_treatment",
    "oil:leave_on_fibre_conditioning",
    "oil:dry_finish",
    "bondbuilder:specialized_bond_treatment",
  ]

  assert.deepEqual(
    initialSubjects.map((subject) => `${subject.category}:${subject.role}`),
    expected,
  )
  assert.deepEqual(
    reopenedSubjects.map((subject) => `${subject.category}:${subject.role}`),
    expected,
  )
})

test("an uncovered role can carry only an unassigned or planned-purchase decision", () => {
  const gap = {
    ...draft(),
    products: [],
    roleAssignments: [],
    uncoveredRoles: [
      {
        category: "oil" as const,
        role: "dry_finish" as const,
        reason: "no_product_owned" as const,
      },
    ],
  }
  const decision = {
    decisionKey: "decision:oil:dry_finish:gap",
    category: "oil" as const,
    role: "dry_finish" as const,
    capturedProductId: null,
    verdict: "ideal" as const,
    choiceState: "planned_purchase" as const,
    criterionResults: [],
    recommendation: {
      recommendationId: "recommend:oil-1:dry_finish",
      productId: "oil-1",
      category: "oil" as const,
      role: "dry_finish" as const,
      displayName: "Empfohlenes Oil",
      reason: "Passt zur Pflege.",
      authorityRuleId: "oil.selection.core_fit",
    },
    limitationAcknowledged: false,
  }

  assert.deepEqual(validateStage3Draft({ ...gap, decisions: [decision] }), [])
  assert.match(
    validateStage3Draft({ ...gap, decisions: [{ ...decision, choiceState: "owned_active" }] }).join(
      "\n",
    ),
    /must remain unassigned or planned/,
  )
})

test("a pending source may retain a planned replacement only through select_replacement", () => {
  const pendingProduct = {
    ...draft().products[0],
    identity: {
      kind: "pending_submission" as const,
      submissionId: "submission-oil-1",
      displayName: "Noch geprüftes Öl",
      category: "oil" as const,
      reviewStatus: "pending_review" as const,
    },
  }
  const replacementDecision = {
    decisionKey: "decision:oil:dry_finish:oil-1",
    category: "oil" as const,
    role: "dry_finish" as const,
    capturedProductId: "oil-1",
    verdict: "unknown" as const,
    choiceState: "planned_purchase" as const,
    criterionResults: [],
    recommendation: {
      recommendationId: "recommend:oil-replacement:dry_finish",
      productId: "oil-replacement",
      category: "oil" as const,
      role: "dry_finish" as const,
      displayName: "Passendes Öl",
      reason: "Als Alternative einplanen.",
      authorityRuleId: "oil.replacement",
    },
    limitationAcknowledged: false,
    resolutionAction: "select_replacement" as const,
  }
  const pendingDraft = draft({ products: [pendingProduct] })

  assert.deepEqual(validateStage3Draft({ ...pendingDraft, decisions: [replacementDecision] }), [])
  assert.match(
    validateStage3Draft({
      ...pendingDraft,
      decisions: [{ ...replacementDecision, resolutionAction: undefined }],
    }).join("\n"),
    /must remain pending_review or be left unassigned/,
  )
})
