import assert from "node:assert/strict"
import test from "node:test"

import {
  CATEGORY_ROLE_POLICIES,
  addCapturedProduct,
  assignProductRoles,
  completeCaptureCategory,
  computeStage3PathState,
  createStage3Draft,
  invalidateDraftForRefinedVersion,
  markRoleUncovered,
  removeCapturedProduct,
  recordProductDecision,
  reopenCaptureCategory,
  type Stage3CategoryRequirement,
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

function addConditioner(
  draft = createStage3Draft({
    draftId: "draft-state",
    userId: "user-1",
    personalPlanId: "plan-1",
    refinedVersionId: "refined-v1",
    requirements,
    now,
  }),
  id: "conditioner-1" | "conditioner-2" = "conditioner-1",
) {
  return addCapturedProduct(draft, {
    capturedProductId: id,
    userProductId: `user-product-${id}`,
    identity: {
      kind: "catalog_product",
      productId: `${id}-product`,
      displayName: id === "conditioner-1" ? "Conditioner A" : "Conditioner B",
      category: "conditioner",
    },
    frequencyRange: "weekly_2x",
    ownership: "owned",
    source: "catalog_search",
  })
}

test("two suitable Conditioners remain separate decision subjects without a primary", () => {
  const initial = createStage3Draft({
    draftId: "draft-conditioner",
    userId: "user-1",
    personalPlanId: "plan-1",
    refinedVersionId: "refined-v1",
    requirements,
    now,
  })
  const withTwoConditioners = completeCaptureCategory(
    assignProductRoles(
      assignProductRoles(
        addConditioner(addConditioner(initial, "conditioner-1"), "conditioner-2"),
        {
          capturedProductId: "conditioner-1",
          category: "conditioner",
          roles: ["conditioner_rinse_out"],
        },
      ),
      {
        capturedProductId: "conditioner-2",
        category: "conditioner",
        roles: ["conditioner_rinse_out"],
      },
    ),
    "conditioner",
    requirements,
  )

  assert.equal(
    computeStage3PathState(withTwoConditioners, requirements).firstUnresolvedStepKey,
    "capture:oil",
  )

  const withRemainingCapture = completeCaptureCategory(
    markRoleUncovered(
      completeCaptureCategory(
        assignProductRoles(
          addCapturedProduct(withTwoConditioners, {
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
          }),
          {
            capturedProductId: "oil-1",
            category: "oil",
            roles: ["pre_wash_fibre_treatment", "leave_on_fibre_conditioning", "dry_finish"],
          },
        ),
        "oil",
        requirements,
      ),
      {
        category: "heat_protectant",
        role: "pre_heat_protection",
        reason: "no_product_owned",
      },
    ),
    "heat_protectant",
    requirements,
  )

  const decisionReady = computeStage3PathState(withRemainingCapture, requirements)
  assert.equal(decisionReady.pass, "product_decisions")
  assert.equal(decisionReady.canCompleteCapture, true)
  assert.equal(
    decisionReady.firstUnresolvedStepKey,
    "decision:conditioner:conditioner_rinse_out:conditioner-1",
  )

  const withOneDecision = recordProductDecision(withRemainingCapture, {
    decisionKey: "decision:conditioner:conditioner_rinse_out:conditioner-1",
    category: "conditioner",
    role: "conditioner_rinse_out",
    capturedProductId: "conditioner-1",
    verdict: "ideal",
    choiceState: "owned_active",
    criterionResults: [],
    recommendation: null,
    limitationAcknowledged: false,
  })
  assert.equal(
    computeStage3PathState(withOneDecision, requirements).firstUnresolvedStepKey,
    "decision:conditioner:conditioner_rinse_out:conditioner-2",
  )
})

test("explicit no-product capture marks a role uncovered and reaches decisions", () => {
  const initial = createStage3Draft({
    draftId: "draft-gap",
    userId: "user-1",
    personalPlanId: "plan-1",
    refinedVersionId: "refined-v1",
    requirements: [requirements[2]],
    now,
  })

  const gapDraft = completeCaptureCategory(
    markRoleUncovered(initial, {
      category: "heat_protectant",
      role: "pre_heat_protection",
      reason: "no_product_owned",
    }),
    "heat_protectant",
    [requirements[2]],
  )

  const path = computeStage3PathState(gapDraft, [requirements[2]])
  assert.equal(path.pass, "product_decisions")
  assert.equal(path.canCompleteCapture, true)
  assert.equal(path.firstUnresolvedStepKey, "decision:heat_protectant:pre_heat_protection:gap")
})

test("capture completion uses the refined need roles and never invents optional category roles", () => {
  const scalpRequirement: Stage3CategoryRequirement = {
    category: "scalp_care",
    requiredRoles: ["scalp_comfort"],
    needSummary: "Beruhigende Pflege für deine Kopfhaut",
    authorityVersion: CATEGORY_ROLE_POLICIES.scalp_care.authorityVersion,
  }
  const initial = createStage3Draft({
    draftId: "draft-scalp-subset",
    userId: "user-1",
    personalPlanId: "plan-1",
    refinedVersionId: "refined-v1",
    requirements: [scalpRequirement],
    now,
  })
  const assigned = assignProductRoles(
    addCapturedProduct(initial, {
      capturedProductId: "scalp-1",
      userProductId: "user-product-scalp-1",
      identity: {
        kind: "catalog_product",
        productId: "scalp-product-1",
        displayName: "Scalp Care",
        category: "scalp_care",
      },
      frequencyRange: "weekly_1x",
      ownership: "owned",
      source: "catalog_search",
    }),
    { capturedProductId: "scalp-1", category: "scalp_care", roles: ["scalp_comfort"] },
  )

  assert.equal(
    completeCaptureCategory(assigned, "scalp_care", [scalpRequirement]).pass,
    "product_decisions",
  )
})

test("one Oil can cover several exact purposes but two Oils cannot own the same purpose", () => {
  const initial = createStage3Draft({
    draftId: "draft-oil",
    userId: "user-1",
    personalPlanId: "plan-1",
    refinedVersionId: "refined-v1",
    requirements: [requirements[1]],
    now,
  })
  const withOilOne = addCapturedProduct(initial, {
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
  })

  assert.doesNotThrow(() =>
    assignProductRoles(withOilOne, {
      capturedProductId: "oil-1",
      category: "oil",
      roles: ["pre_wash_fibre_treatment", "leave_on_fibre_conditioning", "dry_finish"],
    }),
  )

  const withOilTwo = addCapturedProduct(withOilOne, {
    capturedProductId: "oil-2",
    userProductId: "user-product-oil-2",
    identity: {
      kind: "catalog_product",
      productId: "oil-product-2",
      displayName: "Oil B",
      category: "oil",
    },
    frequencyRange: "weekly_1x",
    ownership: "owned",
    source: "catalog_search",
  })
  assert.throws(
    () =>
      assignProductRoles(
        assignProductRoles(withOilTwo, {
          capturedProductId: "oil-1",
          category: "oil",
          roles: ["dry_finish"],
        }),
        { capturedProductId: "oil-2", category: "oil", roles: ["dry_finish"] },
      ),
    /role dry_finish already assigned/,
  )
})

test("recordProductDecision rejects arbitrary or mismatched decision subjects", () => {
  const captureComplete = completeCaptureCategory(
    assignProductRoles(addConditioner(undefined, "conditioner-1"), {
      capturedProductId: "conditioner-1",
      category: "conditioner",
      roles: ["conditioner_rinse_out"],
    }),
    "conditioner",
    requirements,
  )

  assert.throws(
    () =>
      recordProductDecision(captureComplete, {
        decisionKey: "decision:conditioner:conditioner_rinse_out:conditioner-2",
        category: "conditioner",
        role: "conditioner_rinse_out",
        capturedProductId: "conditioner-1",
        verdict: "ideal",
        choiceState: "owned_active",
        criterionResults: [],
        recommendation: null,
        limitationAcknowledged: false,
      }),
    /decision decision:conditioner:conditioner_rinse_out:conditioner-2 is not a derived decision subject/,
  )
})

test("refined-version invalidation is whole-draft and blocks portfolio creation", () => {
  const initial = createStage3Draft({
    draftId: "draft-stale",
    userId: "user-1",
    personalPlanId: "plan-1",
    refinedVersionId: "refined-v1",
    requirements,
    now,
  })
  const withProduct = addConditioner(initial)

  const stale = invalidateDraftForRefinedVersion(withProduct, "refined-v2", now)
  const stalePath = computeStage3PathState(stale, requirements)

  assert.equal(stale.status, "stale")
  assert.equal(stale.refinedVersionId, "refined-v1")
  assert.equal(stale.staleRefinedVersionId, "refined-v2")
  assert.deepEqual(stale.products, withProduct.products)
  assert.equal(stalePath.canCreatePortfolio, false)
  assert.ok(stalePath.blockingReasons.some((reason) => reason.code === "stale_refined_version"))
})

test("reopening one capture category prunes only that category decisions and keeps siblings", () => {
  const initial = createStage3Draft({
    draftId: "draft-reopen",
    userId: "user-1",
    personalPlanId: "plan-1",
    refinedVersionId: "refined-v1",
    requirements,
    now,
  })
  const conditionerComplete = completeCaptureCategory(
    assignProductRoles(addConditioner(initial), {
      capturedProductId: "conditioner-1",
      category: "conditioner",
      roles: ["conditioner_rinse_out"],
    }),
    "conditioner",
    requirements,
  )
  const oilComplete = completeCaptureCategory(
    assignProductRoles(
      addCapturedProduct(conditionerComplete, {
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
      }),
      {
        capturedProductId: "oil-1",
        category: "oil",
        roles: ["pre_wash_fibre_treatment", "leave_on_fibre_conditioning", "dry_finish"],
      },
    ),
    "oil",
    requirements,
  )
  const decided = recordProductDecision(
    recordProductDecision(oilComplete, {
      decisionKey: "decision:conditioner:conditioner_rinse_out:conditioner-1",
      category: "conditioner",
      role: "conditioner_rinse_out",
      capturedProductId: "conditioner-1",
      verdict: "ideal",
      choiceState: "owned_active",
      criterionResults: [],
      recommendation: null,
      limitationAcknowledged: false,
    }),
    {
      decisionKey: "decision:oil:dry_finish:oil-1",
      category: "oil",
      role: "dry_finish",
      capturedProductId: "oil-1",
      verdict: "supportive",
      choiceState: "owned_active",
      criterionResults: [],
      recommendation: null,
      limitationAcknowledged: false,
    },
  )

  const reopened = reopenCaptureCategory(decided, "oil")

  assert.equal(reopened.pass, "product_capture")
  assert.equal(reopened.categoryCursor, "oil")
  assert.deepEqual(reopened.completedCaptureCategories, ["conditioner"])
  assert.deepEqual(
    reopened.decisions.map((decision) => decision.decisionKey),
    ["decision:conditioner:conditioner_rinse_out:conditioner-1"],
  )
  assert.deepEqual(reopened.completedDecisionKeys, [
    "decision:conditioner:conditioner_rinse_out:conditioner-1",
  ])
  assert.deepEqual(
    reopened.products.map((product) => product.capturedProductId),
    ["conditioner-1", "oil-1"],
  )
})

test("removing a captured product prunes only that product descendants", () => {
  const initial = createStage3Draft({
    draftId: "draft-remove-product",
    userId: "user-1",
    personalPlanId: "plan-1",
    refinedVersionId: "refined-v1",
    requirements: [requirements[0]],
    now,
  })
  const withTwoConditioners = completeCaptureCategory(
    assignProductRoles(
      assignProductRoles(
        addConditioner(addConditioner(initial, "conditioner-1"), "conditioner-2"),
        {
          capturedProductId: "conditioner-1",
          category: "conditioner",
          roles: ["conditioner_rinse_out"],
        },
      ),
      {
        capturedProductId: "conditioner-2",
        category: "conditioner",
        roles: ["conditioner_rinse_out"],
      },
    ),
    "conditioner",
    [requirements[0]],
  )
  const decided = recordProductDecision(
    recordProductDecision(withTwoConditioners, {
      decisionKey: "decision:conditioner:conditioner_rinse_out:conditioner-1",
      category: "conditioner",
      role: "conditioner_rinse_out",
      capturedProductId: "conditioner-1",
      verdict: "ideal",
      choiceState: "owned_active",
      criterionResults: [],
      recommendation: null,
      limitationAcknowledged: false,
    }),
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
  )

  const pruned = removeCapturedProduct(decided, "conditioner-1")

  assert.deepEqual(
    pruned.products.map((product) => product.capturedProductId),
    ["conditioner-2"],
  )
  assert.deepEqual(pruned.roleAssignments, [
    {
      capturedProductId: "conditioner-2",
      category: "conditioner",
      roles: ["conditioner_rinse_out"],
    },
  ])
  assert.deepEqual(
    pruned.decisions.map((decision) => decision.decisionKey),
    ["decision:conditioner:conditioner_rinse_out:conditioner-2"],
  )
  assert.deepEqual(pruned.completedDecisionKeys, [
    "decision:conditioner:conditioner_rinse_out:conditioner-2",
  ])
})

test("updating role assignments after decisions prunes stale decision subjects", () => {
  const initial = createStage3Draft({
    draftId: "draft-update-roles",
    userId: "user-1",
    personalPlanId: "plan-1",
    refinedVersionId: "refined-v1",
    requirements: [requirements[1]],
    now,
  })
  const withOilRoles = assignProductRoles(
    addCapturedProduct(initial, {
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
    }),
    {
      capturedProductId: "oil-1",
      category: "oil",
      roles: ["dry_finish", "leave_on_fibre_conditioning"],
    },
  )
  const decided = recordProductDecision(
    recordProductDecision(withOilRoles, {
      decisionKey: "decision:oil:dry_finish:oil-1",
      category: "oil",
      role: "dry_finish",
      capturedProductId: "oil-1",
      verdict: "supportive",
      choiceState: "owned_active",
      criterionResults: [],
      recommendation: null,
      limitationAcknowledged: false,
    }),
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
  )

  const updated = assignProductRoles(decided, {
    capturedProductId: "oil-1",
    category: "oil",
    roles: ["dry_finish"],
  })

  assert.deepEqual(updated.roleAssignments, [
    { capturedProductId: "oil-1", category: "oil", roles: ["dry_finish"] },
  ])
  assert.deepEqual(
    updated.decisions.map((decision) => decision.decisionKey),
    ["decision:oil:dry_finish:oil-1"],
  )
  assert.deepEqual(updated.completedDecisionKeys, ["decision:oil:dry_finish:oil-1"])
})

test("marking a role uncovered removes conflicting assignments and decisions", () => {
  const initial = createStage3Draft({
    draftId: "draft-uncover",
    userId: "user-1",
    personalPlanId: "plan-1",
    refinedVersionId: "refined-v1",
    requirements: [requirements[1]],
    now,
  })
  const withOilRoles = assignProductRoles(
    addCapturedProduct(initial, {
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
    }),
    {
      capturedProductId: "oil-1",
      category: "oil",
      roles: ["dry_finish", "leave_on_fibre_conditioning"],
    },
  )
  const decided = recordProductDecision(withOilRoles, {
    decisionKey: "decision:oil:dry_finish:oil-1",
    category: "oil",
    role: "dry_finish",
    capturedProductId: "oil-1",
    verdict: "supportive",
    choiceState: "owned_active",
    criterionResults: [],
    recommendation: null,
    limitationAcknowledged: false,
  })

  const uncovered = markRoleUncovered(decided, {
    category: "oil",
    role: "dry_finish",
    reason: "no_product_owned",
  })

  assert.deepEqual(uncovered.roleAssignments, [
    { capturedProductId: "oil-1", category: "oil", roles: ["leave_on_fibre_conditioning"] },
  ])
  assert.deepEqual(uncovered.uncoveredRoles, [
    { category: "oil", role: "dry_finish", reason: "no_product_owned" },
  ])
  assert.deepEqual(uncovered.decisions, [])
  assert.deepEqual(uncovered.completedDecisionKeys, [])
})
