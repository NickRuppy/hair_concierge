import assert from "node:assert/strict"
import test from "node:test"

import {
  CATEGORY_ROLE_POLICIES,
  addCapturedProduct,
  assignProductRoles,
  completeCaptureCategory,
  computeStage3PathState,
  createStage3Draft,
  effectiveStage3Coverage,
  finalizeCaptureCategory,
  invalidateDraftForRefinedVersion,
  markRoleUncovered,
  removeCapturedProduct,
  replaceCategoryRoleAssignments,
  recordProductDecision,
  reopenCaptureCategory,
  resolveStage3NeedRevision,
  resolveStage3ProductLoadResolution,
  acknowledgeStage3InventoryDisposition,
  finalizeStage3CaptureWithoutInventoryAuthority,
  type Stage3CategoryRequirement,
} from "../src/lib/personal-plan/products"
import type { InitialNeedPlanSnapshot } from "../src/lib/personal-plan/types"
import type { Stage3AuthoritySnapshotV1 } from "../src/lib/personal-plan/products/contracts"
import type { Stage3ProductDraft } from "../src/lib/personal-plan/products/contracts"

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

test("Stage 2 ownership skips known-empty capture categories without claiming product coverage", () => {
  const authoritySnapshot: Stage3AuthoritySnapshotV1 = {
    schemaVersion: 1,
    refinedNeedVersionId: "refined-v1",
    refinedInputHash: "hash-v1",
    categoryDecisions: [],
    coverage: [],
    orderedCategories: requirements.map(({ category }) => category),
    authorityVersions: Object.fromEntries(
      requirements.map(({ category, authorityVersion }) => [category, authorityVersion]),
    ) as Stage3AuthoritySnapshotV1["authorityVersions"],
    productLoadContext: {
      schemaVersion: 1,
      scalpOiliness: "balanced",
      deepCleansingScalpPause: false,
      hasLowVolumeOrWeighedDown: false,
      shampooFrequency: "weekly_2x",
      oilPurposes: ["dry_finish"],
      ownedCategories: ["oil"],
    },
  }

  const draft = createStage3Draft({
    draftId: "draft-owned-only",
    userId: "user-1",
    personalPlanId: "plan-1",
    refinedVersionId: "refined-v1",
    requirements,
    authoritySnapshot,
    now,
  })

  assert.equal(draft.categoryCursor, "oil")
  assert.deepEqual(draft.completedCaptureCategories, ["conditioner", "heat_protectant"])
  assert.deepEqual(
    draft.uncoveredRoles.map(({ category, role }) => [category, role]),
    [
      ["conditioner", "conditioner_rinse_out"],
      ["heat_protectant", "pre_heat_protection"],
    ],
  )
  assert.equal(draft.products.length, 0)
})

test("known-empty Stage 2 ownership enters product decisions instead of a cursorless capture", () => {
  const authoritySnapshot: Stage3AuthoritySnapshotV1 = {
    schemaVersion: 1,
    refinedNeedVersionId: "refined-empty-owned",
    refinedInputHash: "hash-empty-owned",
    categoryDecisions: [],
    coverage: [],
    orderedCategories: requirements.map(({ category }) => category),
    authorityVersions: Object.fromEntries(
      requirements.map(({ category, authorityVersion }) => [category, authorityVersion]),
    ) as Stage3AuthoritySnapshotV1["authorityVersions"],
    productLoadContext: {
      schemaVersion: 1,
      scalpOiliness: "balanced",
      deepCleansingScalpPause: false,
      hasLowVolumeOrWeighedDown: false,
      shampooFrequency: "weekly_2x",
      oilPurposes: [],
      ownedCategories: [],
    },
  }

  const draft = createStage3Draft({
    draftId: "draft-empty-owned",
    userId: "user-1",
    personalPlanId: "plan-1",
    refinedVersionId: "refined-empty-owned",
    requirements,
    authoritySnapshot,
    now,
  })

  assert.equal(draft.pass, "product_decisions")
  assert.equal(draft.categoryCursor, null)
  assert.deepEqual(
    draft.completedCaptureCategories,
    requirements.map(({ category }) => category),
  )
  assert.equal(
    draft.uncoveredRoles.length,
    requirements.flatMap(({ requiredRoles }) => requiredRoles).length,
  )
})

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

test("capture completion advances the server cursor and clears it with the last category", () => {
  const initial = createStage3Draft({
    draftId: "draft-cursor",
    userId: "user-1",
    personalPlanId: "plan-1",
    refinedVersionId: "refined-v1",
    requirements: [requirements[0], requirements[2]],
    now,
  })
  const conditionerComplete = completeCaptureCategory(
    assignProductRoles(addConditioner(initial), {
      capturedProductId: "conditioner-1",
      category: "conditioner",
      roles: ["conditioner_rinse_out"],
    }),
    "conditioner",
    [requirements[0], requirements[2]],
  )

  assert.equal(conditionerComplete.pass, "product_capture")
  assert.equal(conditionerComplete.categoryCursor, "heat_protectant")

  const allComplete = completeCaptureCategory(
    markRoleUncovered(conditionerComplete, {
      category: "heat_protectant",
      role: "pre_heat_protection",
      reason: "no_product_owned",
    }),
    "heat_protectant",
    [requirements[0], requirements[2]],
  )
  assert.equal(allComplete.pass, "product_decisions")
  assert.equal(allComplete.categoryCursor, null)
})

function currentOnlyAuthoritySnapshot(
  orderedCategories: Stage3AuthoritySnapshotV1["orderedCategories"],
  oilPurposes: NonNullable<Stage3AuthoritySnapshotV1["productLoadContext"]>["oilPurposes"] = [
    "dry_finish",
  ],
): Stage3AuthoritySnapshotV1 {
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
      oilPurposes,
    },
    categoryDecisions: [
      {
        category: "deep_cleansing_shampoo",
        resolution: "resolved",
        needTier: "not_needed",
        roles: [],
        target: null,
        frequency: null,
        reasons: [
          {
            id: "deep_cleansing.inclusion.none",
            salience: "primary",
            evidence: [],
            values: { resetLoad: 0 },
          },
        ],
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
    orderedCategories,
    inventoryOnlyCategories: [...orderedCategories],
    authorityVersions: Object.fromEntries(
      Object.entries(CATEGORY_ROLE_POLICIES).map(([category, policy]) => [
        category,
        policy.authorityVersion,
      ]),
    ) as Stage3AuthoritySnapshotV1["authorityVersions"],
  }
}

const currentOnlyRequirements: Stage3CategoryRequirement[] = [
  {
    category: "dry_shampoo",
    requiredRoles: [],
    needSummary: "Aktuell verwendetes Trockenshampoo erfassen",
    authorityVersion: CATEGORY_ROLE_POLICIES.dry_shampoo.authorityVersion,
  },
  {
    category: "leave_in",
    requiredRoles: [],
    needSummary: "Aktuell verwendetes Leave-in erfassen",
    authorityVersion: CATEGORY_ROLE_POLICIES.leave_in.authorityVersion,
  },
  {
    category: "oil",
    requiredRoles: [],
    needSummary: "Aktuell verwendetes Oil erfassen",
    authorityVersion: CATEGORY_ROLE_POLICIES.oil.authorityVersion,
  },
]

const deepCleansingBasisDecision: Stage3AuthoritySnapshotV1["categoryDecisions"][number] = {
  category: "deep_cleansing_shampoo",
  resolution: "resolved",
  needTier: "basis",
  roles: ["residue_reset"],
  target: { category: "deep_cleansing_shampoo", roles: ["residue_reset"] },
  frequency: {
    kind: "every_nth_wash",
    roles: ["residue_reset"],
    every: 3,
    substitutesRegularShampoo: true,
  },
  reasons: [],
  executionState: "available",
  executionPauseReason: null,
  deferredFacts: [],
}

const scalpExfoliantDecision: Stage3AuthoritySnapshotV1["categoryDecisions"][number] = {
  category: "scalp_care",
  resolution: "resolved",
  needTier: "optional",
  roles: ["scalp_exfoliant"],
  target: {
    category: "scalp_care",
    roles: ["scalp_exfoliant"],
    roleTargets: [{ role: "scalp_exfoliant", coverage: "primary" }],
  },
  frequency: {
    kind: "role_keyed_product_protocol",
    roleFrequencies: [{ role: "scalp_exfoliant", cadence: "occasional_according_to_product" }],
  },
  reasons: [],
  executionState: "available",
  executionPauseReason: null,
  deferredFacts: [],
}

const deepCleansingScalpResetCoverage: Stage3AuthoritySnapshotV1["coverage"][number] = {
  job: "scalp_root_reset",
  ruleId: "portfolio.reset.deep_cleansing_primary",
  primaryCategories: ["deep_cleansing_shampoo"],
  supportingCategories: ["scalp_care"],
  outcome: "duplicate_purchase_suppressed",
}

function productLoadCaptureDraft() {
  let draft: Stage3ProductDraft = {
    ...createStage3Draft({
      draftId: "draft-product-load",
      userId: "user-1",
      personalPlanId: "plan-1",
      refinedVersionId: "refined-v1",
      requirements: currentOnlyRequirements,
      now,
    }),
    authoritySnapshot: currentOnlyAuthoritySnapshot(["dry_shampoo", "leave_in", "oil"]),
  }

  draft = addCapturedProduct(draft, {
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
  })
  draft = addCapturedProduct(draft, {
    capturedProductId: "leave-in-1",
    userProductId: "user-product-leave-in-1",
    identity: {
      kind: "catalog_product",
      productId: "leave-in-product-1",
      displayName: "Leave-in A",
      category: "leave_in",
    },
    frequencyRange: "weekly_1x",
    ownership: "owned",
    source: "catalog_search",
  })
  draft = addCapturedProduct(draft, {
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
  return draft
}

test("current-only captured categories can complete without fabricated required roles", () => {
  const draft = completeCaptureCategory(
    completeCaptureCategory(productLoadCaptureDraft(), "dry_shampoo", currentOnlyRequirements),
    "leave_in",
    currentOnlyRequirements,
  )

  const path = computeStage3PathState(draft, currentOnlyRequirements)
  assert.equal(path.pass, "product_capture")
  assert.deepEqual(path.orderedStepKeys, ["capture:dry_shampoo", "capture:leave_in", "capture:oil"])
  assert.equal(
    path.blockingReasons.some((reason) => reason.code === "role_uncovered"),
    false,
  )
})

test("final capture opens an explicit need-revision review instead of applying a hidden overlay", () => {
  const draft = completeCaptureCategory(
    completeCaptureCategory(
      completeCaptureCategory(productLoadCaptureDraft(), "dry_shampoo", currentOnlyRequirements),
      "leave_in",
      currentOnlyRequirements,
    ),
    "oil",
    currentOnlyRequirements,
  )

  assert.equal(draft.pass, "need_revision_review")
  assert.equal(draft.productLoadResolution, undefined)
  assert.deepEqual(draft.orderedCategories, ["dry_shampoo", "leave_in", "oil"])
  assert.equal(draft.inventoryAuthority?.status, "pending")
  assert.equal(draft.inventoryAuthority?.schemaVersion, 1)
  assert.equal(draft.inventoryAuthority?.proposalFingerprint?.length, 64)
  assert.deepEqual(
    draft.inventoryAuthority?.proposedOutputSnapshot?.decisions.map((decision) => ({
      category: decision.category,
      roles: decision.roles,
      tier: decision.needTier,
      frequency: decision.frequency,
    })),
    [
      {
        category: "deep_cleansing_shampoo",
        roles: ["residue_reset"],
        tier: "basis",
        frequency: {
          kind: "every_nth_wash",
          roles: ["residue_reset"],
          every: 3,
          substitutesRegularShampoo: true,
        },
      },
      {
        category: "scalp_care",
        roles: ["scalp_exfoliant"],
        tier: "optional",
        frequency: {
          kind: "role_keyed_product_protocol",
          roleFrequencies: [
            { role: "scalp_exfoliant", cadence: "occasional_according_to_product" },
          ],
        },
      },
    ],
  )
  assert.deepEqual(draft.uncoveredRoles, [])
  assert.equal(computeStage3PathState(draft, currentOnlyRequirements).canCreatePortfolio, false)
})

test("gate-off capture preserves Stage 2 authority without a hidden inventory overlay", () => {
  const pending = completeCaptureCategory(
    completeCaptureCategory(
      completeCaptureCategory(productLoadCaptureDraft(), "dry_shampoo", currentOnlyRequirements),
      "leave_in",
      currentOnlyRequirements,
    ),
    "oil",
    currentOnlyRequirements,
  )
  const gateOff = finalizeStage3CaptureWithoutInventoryAuthority(pending)

  assert.equal(gateOff.pass, "product_decisions")
  assert.equal(gateOff.refinedVersionId, pending.refinedVersionId)
  assert.equal(gateOff.inventoryAuthority, undefined)
  assert.equal(gateOff.productLoadResolution, undefined)
  assert.deepEqual(gateOff.orderedCategories, pending.orderedCategories)
})

test("no-change inventory dispositions distinguish in-plan extras from inventory-only categories", () => {
  const conditionerRequirement: Stage3CategoryRequirement = {
    category: "conditioner",
    requiredRoles: ["conditioner_rinse_out"],
    needSummary: "Pflege nach jeder Wäsche",
    authorityVersion: CATEGORY_ROLE_POLICIES.conditioner.authorityVersion,
  }
  const dryShampooRequirement: Stage3CategoryRequirement = {
    category: "dry_shampoo",
    requiredRoles: [],
    needSummary: "Aktuell verwendetes Trockenshampoo erfassen",
    authorityVersion: CATEGORY_ROLE_POLICIES.dry_shampoo.authorityVersion,
  }
  const mixedRequirements = [conditionerRequirement, dryShampooRequirement]
  const authoritySnapshot: Stage3AuthoritySnapshotV1 = {
    schemaVersion: 1,
    refinedNeedVersionId: "refined-mixed-v1",
    refinedInputHash: "refined-mixed-input",
    categoryDecisions: [
      {
        category: "conditioner",
        resolution: "resolved",
        needTier: "basis",
        roles: ["conditioner_rinse_out"],
        target: {
          category: "conditioner",
          roles: ["conditioner_rinse_out"],
          weight: "light",
          careDirection: "moisture",
          repairSupportLevel: "medium",
          functionalNeeds: [],
        },
        frequency: null,
        reasons: [],
        executionState: "available",
        executionPauseReason: null,
        deferredFacts: [],
      },
    ],
    coverage: [],
    orderedCategories: ["conditioner", "dry_shampoo"],
    inventoryOnlyCategories: ["dry_shampoo"],
    authorityVersions: Object.fromEntries(
      Object.entries(CATEGORY_ROLE_POLICIES).map(([category, policy]) => [
        category,
        policy.authorityVersion,
      ]),
    ) as Stage3AuthoritySnapshotV1["authorityVersions"],
  }
  let draft = createStage3Draft({
    draftId: "draft-mixed-dispositions",
    userId: "user-1",
    personalPlanId: "plan-1",
    refinedVersionId: "refined-mixed-v1",
    requirements: mixedRequirements,
    authoritySnapshot,
    now,
  })
  draft = assignProductRoles(
    addCapturedProduct(addConditioner(addConditioner(draft, "conditioner-1"), "conditioner-2"), {
      capturedProductId: "dry-shampoo-1",
      userProductId: "user-product-dry-shampoo-1",
      identity: {
        kind: "catalog_product",
        productId: "dry-shampoo-product-1",
        displayName: "Trockenshampoo A",
        category: "dry_shampoo",
      },
      frequencyRange: "monthly_1x",
      ownership: "owned",
      source: "catalog_search",
    }),
    {
      capturedProductId: "conditioner-1",
      category: "conditioner",
      roles: ["conditioner_rinse_out"],
    },
  )

  const completed = completeCaptureCategory(
    completeCaptureCategory(draft, "conditioner", mixedRequirements),
    "dry_shampoo",
    mixedRequirements,
  )

  assert.equal(completed.inventoryAuthority?.status, "not_needed")
  assert.deepEqual(
    completed.inventoryDispositions?.map((disposition) => [
      disposition.capturedProductId,
      disposition.reason,
    ]),
    [
      ["conditioner-2", "not_assigned_to_final_role"],
      ["dry-shampoo-1", "category_not_in_final_plan"],
    ],
  )
})

test("deferred owned heat protection blocks completion without creating a not-used disposition", () => {
  const heatRequirement: Stage3CategoryRequirement = {
    category: "heat_protectant",
    requiredRoles: [],
    needSummary: "Vorhandenen Hitzeschutz erfassen",
    authorityVersion: CATEGORY_ROLE_POLICIES.heat_protectant.authorityVersion,
  }
  const authoritySnapshot: Stage3AuthoritySnapshotV1 = {
    schemaVersion: 1,
    refinedNeedVersionId: "refined-deferred-heat",
    refinedInputHash: "a".repeat(64),
    categoryDecisions: [
      {
        category: "heat_protectant",
        resolution: "deferred_until_post_plan_onboarding",
        needTier: null,
        roles: [],
        target: {
          category: "heat_protectant",
          roles: [],
          qualifyingRoutes: [],
          carrierPolicy: "integrated_or_separate_verified_binary_capability",
        },
        frequency: null,
        reasons: [],
        executionState: "available",
        executionPauseReason: null,
        deferredFacts: ["heat_tool_use"],
      },
    ],
    coverage: [],
    orderedCategories: ["heat_protectant"],
    inventoryOnlyCategories: ["heat_protectant"],
    authorityVersions: Object.fromEntries(
      Object.entries(CATEGORY_ROLE_POLICIES).map(([category, policy]) => [
        category,
        policy.authorityVersion,
      ]),
    ) as Stage3AuthoritySnapshotV1["authorityVersions"],
    productLoadContext: {
      schemaVersion: 1,
      scalpOiliness: "balanced",
      deepCleansingScalpPause: false,
      hasLowVolumeOrWeighedDown: false,
      shampooFrequency: "weekly_2x",
      oilPurposes: [],
      ownedCategories: ["heat_protectant"],
    },
  }
  let draft = createStage3Draft({
    draftId: "draft-deferred-heat",
    userId: "user-deferred-heat",
    personalPlanId: "plan-deferred-heat",
    refinedVersionId: "refined-deferred-heat",
    requirements: [heatRequirement],
    authoritySnapshot,
    now,
  })
  draft = addCapturedProduct(draft, {
    capturedProductId: "heat-owned",
    userProductId: "user-product-heat-owned",
    identity: {
      kind: "catalog_product",
      productId: "catalog-heat-owned",
      displayName: "Hitzeschutz Spray",
      category: "heat_protectant",
    },
    frequencyRange: "weekly_2x",
    ownership: "owned",
    source: "existing_inventory",
  })

  const finalized = finalizeStage3CaptureWithoutInventoryAuthority(draft)
  const path = computeStage3PathState(finalized, [heatRequirement])

  assert.deepEqual(finalized.inventoryDispositions, [])
  assert.equal(path.canCreatePortfolio, false)
  assert.ok(
    path.blockingReasons.some((reason) => reason.code === "inventory_clarification_required"),
  )
})

test("a newer confirmed no-heat authority replaces clarification with the normal not-used result", () => {
  const heatRequirement: Stage3CategoryRequirement = {
    category: "heat_protectant",
    requiredRoles: [],
    needSummary: "Vorhandenen Hitzeschutz erfassen",
    authorityVersion: CATEGORY_ROLE_POLICIES.heat_protectant.authorityVersion,
  }
  const authoritySnapshot: Stage3AuthoritySnapshotV1 = {
    schemaVersion: 1,
    refinedNeedVersionId: "refined-confirmed-no-heat",
    refinedInputHash: "b".repeat(64),
    categoryDecisions: [
      {
        category: "heat_protectant",
        resolution: "resolved",
        needTier: "not_needed",
        roles: [],
        target: {
          category: "heat_protectant",
          roles: [],
          qualifyingRoutes: [],
          carrierPolicy: "integrated_or_separate_verified_binary_capability",
        },
        frequency: null,
        reasons: [],
        executionState: "available",
        executionPauseReason: null,
        deferredFacts: [],
      },
    ],
    coverage: [],
    orderedCategories: ["heat_protectant"],
    inventoryOnlyCategories: ["heat_protectant"],
    authorityVersions: Object.fromEntries(
      Object.entries(CATEGORY_ROLE_POLICIES).map(([category, policy]) => [
        category,
        policy.authorityVersion,
      ]),
    ) as Stage3AuthoritySnapshotV1["authorityVersions"],
    productLoadContext: {
      schemaVersion: 1,
      scalpOiliness: "balanced",
      deepCleansingScalpPause: false,
      hasLowVolumeOrWeighedDown: false,
      shampooFrequency: "weekly_2x",
      oilPurposes: [],
      ownedCategories: ["heat_protectant"],
    },
  }
  let draft = createStage3Draft({
    draftId: "draft-confirmed-no-heat",
    userId: "user-confirmed-no-heat",
    personalPlanId: "plan-confirmed-no-heat",
    refinedVersionId: "refined-confirmed-no-heat",
    requirements: [heatRequirement],
    authoritySnapshot,
    now,
  })
  draft = addCapturedProduct(draft, {
    capturedProductId: "heat-owned-confirmed",
    userProductId: "user-product-heat-owned-confirmed",
    identity: {
      kind: "catalog_product",
      productId: "catalog-heat-owned-confirmed",
      displayName: "Hitzeschutz Spray",
      category: "heat_protectant",
    },
    frequencyRange: "weekly_2x",
    ownership: "owned",
    source: "existing_inventory",
  })

  const finalized = finalizeStage3CaptureWithoutInventoryAuthority(draft)
  const disposition = finalized.inventoryDispositions?.[0]
  const path = computeStage3PathState(finalized, [heatRequirement])

  assert.equal(disposition?.reason, "category_not_in_final_plan")
  assert.equal(disposition?.acknowledged, false)
  assert.equal(
    path.blockingReasons.some((reason) => reason.code === "inventory_clarification_required"),
    false,
  )
  assert.equal(path.canCreatePortfolio, false)

  const acknowledged = acknowledgeStage3InventoryDisposition(
    finalized,
    disposition?.dispositionKey ?? "missing",
  )
  assert.equal(computeStage3PathState(acknowledged, [heatRequirement]).canCreatePortfolio, true)
})

test("rejecting a need revision creates current inventory dispositions that block until acknowledged", () => {
  const pending = completeCaptureCategory(
    completeCaptureCategory(
      completeCaptureCategory(productLoadCaptureDraft(), "dry_shampoo", currentOnlyRequirements),
      "leave_in",
      currentOnlyRequirements,
    ),
    "oil",
    currentOnlyRequirements,
  )
  const proposalFingerprint = pending.inventoryAuthority?.proposalFingerprint
  assert.ok(proposalFingerprint)

  const rejected = resolveStage3NeedRevision(pending, {
    action: "reject",
    expectedProposalFingerprint: proposalFingerprint,
    requirements: currentOnlyRequirements,
  })
  const rejectedPath = computeStage3PathState(rejected, currentOnlyRequirements)

  assert.equal(rejected.pass, "product_decisions")
  assert.equal(rejected.inventoryAuthority?.status, "rejected")
  assert.equal(rejected.inventoryDispositions?.length, 3)
  assert.equal(rejectedPath.canCreatePortfolio, false)
  assert.ok(
    rejectedPath.blockingReasons.some(
      (reason) => reason.code === "inventory_disposition_unacknowledged",
    ),
  )

  const acknowledged = rejected.inventoryDispositions!.reduce(
    (draft, disposition) =>
      acknowledgeStage3InventoryDisposition(draft, disposition.dispositionKey),
    rejected,
  )

  assert.equal(
    computeStage3PathState(acknowledged, currentOnlyRequirements).canCreatePortfolio,
    true,
  )
})

test("accepting a need revision rebases to the accepted authority without inventing product ownership", () => {
  const pending = completeCaptureCategory(
    completeCaptureCategory(
      completeCaptureCategory(productLoadCaptureDraft(), "dry_shampoo", currentOnlyRequirements),
      "leave_in",
      currentOnlyRequirements,
    ),
    "oil",
    currentOnlyRequirements,
  )
  const proposal = pending.inventoryAuthority?.proposedOutputSnapshot
  const proposalFingerprint = pending.inventoryAuthority?.proposalFingerprint
  assert.ok(proposal)
  assert.ok(proposalFingerprint)
  const acceptedRequirements: Stage3CategoryRequirement[] = proposal.renderedOrder.map(
    (category) => {
      const decision = proposal.decisions.find((candidate) => candidate.category === category)
      if (!decision) throw new Error(`missing decision for ${category}`)
      return {
        category,
        requiredRoles: decision.roles,
        needSummary: category,
        authorityVersion: CATEGORY_ROLE_POLICIES[category].authorityVersion,
      }
    },
  )
  const acceptedSnapshot: Stage3AuthoritySnapshotV1 = {
    ...pending.authoritySnapshot!,
    refinedNeedVersionId: "refined-accepted-v1",
    refinedInputHash: proposal.inputHash,
    categoryDecisions: proposal.decisions,
    coverage: proposal.coverage,
    orderedCategories: [...proposal.renderedOrder],
    inventoryOnlyCategories: [],
  }

  const accepted = resolveStage3NeedRevision(pending, {
    action: "accept",
    expectedProposalFingerprint: proposalFingerprint,
    refinedVersionId: "refined-accepted-v1",
    requirements: acceptedRequirements,
    authoritySnapshot: acceptedSnapshot,
  })

  assert.equal(accepted.refinedVersionId, "refined-accepted-v1")
  assert.equal(accepted.inventoryAuthority?.status, "accepted")
  assert.deepEqual(
    accepted.uncoveredRoles.map((role) => [role.category, role.role]),
    [
      ["deep_cleansing_shampoo", "residue_reset"],
      ["scalp_care", "scalp_exfoliant"],
    ],
  )
  assert.deepEqual(
    accepted.inventoryDispositions?.map((disposition) => disposition.capturedProductId),
    ["dry-shampoo-1", "leave-in-1", "oil-1"],
  )
  assert.deepEqual(accepted.decisions, [])
})

test("product-load weighed-down corroboration only adds one Reset point with a weekly load signal", () => {
  const dryShampooRequirement: Stage3CategoryRequirement = {
    category: "dry_shampoo",
    requiredRoles: [],
    needSummary: "Aktuell verwendetes Trockenshampoo erfassen",
    authorityVersion: CATEGORY_ROLE_POLICIES.dry_shampoo.authorityVersion,
  }
  const base = createStage3Draft({
    draftId: "draft-product-load-weighed-down",
    userId: "user-1",
    personalPlanId: "plan-1",
    refinedVersionId: "refined-v1",
    requirements: [dryShampooRequirement],
    now,
  })
  const authoritySnapshot = currentOnlyAuthoritySnapshot(["dry_shampoo"])
  const withCorroborator = (draft: Stage3ProductDraft): Stage3ProductDraft => ({
    ...draft,
    authoritySnapshot: {
      ...authoritySnapshot,
      productLoadContext: {
        ...authoritySnapshot.productLoadContext!,
        hasLowVolumeOrWeighedDown: true,
      },
    },
  })

  assert.equal(resolveStage3ProductLoadResolution(withCorroborator(base)), undefined)

  const belowWeekly = resolveStage3ProductLoadResolution(
    addCapturedProduct(withCorroborator(base), {
      capturedProductId: "dry-shampoo-monthly",
      userProductId: "user-product-dry-shampoo-monthly",
      identity: {
        kind: "catalog_product",
        productId: "dry-shampoo-product-monthly",
        displayName: "Trockenshampoo monatlich",
        category: "dry_shampoo",
      },
      frequencyRange: "monthly_1x",
      ownership: "owned",
      source: "catalog_search",
    }),
  )
  assert.equal(belowWeekly, undefined)

  const scoreThree = resolveStage3ProductLoadResolution(
    addCapturedProduct(withCorroborator(base), {
      capturedProductId: "dry-shampoo-weekly",
      userProductId: "user-product-dry-shampoo-weekly",
      identity: {
        kind: "catalog_product",
        productId: "dry-shampoo-product-weekly",
        displayName: "Trockenshampoo wöchentlich",
        category: "dry_shampoo",
      },
      frequencyRange: "weekly_3_4x",
      ownership: "owned",
      source: "catalog_search",
    }),
  )
  const scoreThreeDecision = scoreThree?.decisions.find(
    (decision) => decision.category === "deep_cleansing_shampoo",
  )
  assert.equal(scoreThreeDecision?.frequency?.kind, "every_nth_wash")
  assert.equal(
    scoreThreeDecision?.frequency?.kind === "every_nth_wash"
      ? scoreThreeDecision.frequency.every
      : null,
    4,
  )
  assert.equal(
    scoreThreeDecision?.reasons.find(
      (candidate) => candidate.id === "deep_cleansing.inclusion.basis",
    )?.values.resetLoad,
    3,
  )
})

test("product-load Reset score four switches Deep Cleansing to every third wash", () => {
  const stage3Requirements: Stage3CategoryRequirement[] = [
    {
      category: "dry_shampoo",
      requiredRoles: [],
      needSummary: "Aktuell verwendetes Trockenshampoo erfassen",
      authorityVersion: CATEGORY_ROLE_POLICIES.dry_shampoo.authorityVersion,
    },
    {
      category: "leave_in",
      requiredRoles: [],
      needSummary: "Aktuelles Leave-in erfassen",
      authorityVersion: CATEGORY_ROLE_POLICIES.leave_in.authorityVersion,
    },
  ]
  const authoritySnapshot = currentOnlyAuthoritySnapshot(["dry_shampoo", "leave_in"])
  const base: Stage3ProductDraft = {
    ...createStage3Draft({
      draftId: "draft-product-load-high-reset",
      userId: "user-1",
      personalPlanId: "plan-1",
      refinedVersionId: "refined-v1",
      requirements: stage3Requirements,
      now,
    }),
    authoritySnapshot: {
      ...authoritySnapshot,
      productLoadContext: {
        ...authoritySnapshot.productLoadContext!,
        hasLowVolumeOrWeighedDown: true,
      },
    },
  }
  const withDryShampoo = addCapturedProduct(base, {
    capturedProductId: "dry-shampoo-high-reset",
    userProductId: "user-product-dry-shampoo-high-reset",
    identity: {
      kind: "catalog_product",
      productId: "dry-shampoo-product-high-reset",
      displayName: "Trockenshampoo häufig",
      category: "dry_shampoo",
    },
    frequencyRange: "weekly_3_4x",
    ownership: "owned",
    source: "catalog_search",
  })
  const resolution = resolveStage3ProductLoadResolution(
    addCapturedProduct(withDryShampoo, {
      capturedProductId: "leave-in-high-reset",
      userProductId: "user-product-leave-in-high-reset",
      identity: {
        kind: "catalog_product",
        productId: "leave-in-product-high-reset",
        displayName: "Leave-in wöchentlich",
        category: "leave_in",
      },
      frequencyRange: "weekly_1x",
      ownership: "owned",
      source: "catalog_search",
    }),
  )
  const decision = resolution?.decisions.find(
    (candidate) => candidate.category === "deep_cleansing_shampoo",
  )
  assert.equal(decision?.frequency?.kind, "every_nth_wash")
  assert.equal(decision?.frequency?.kind === "every_nth_wash" ? decision.frequency.every : null, 3)
  assert.equal(
    decision?.reasons.find((candidate) => candidate.id === "deep_cleansing.inclusion.high_load")
      ?.values.resetLoad,
    4,
  )
})

test("product-load coverage links base Deep Cleansing to overlay Scalp Care", () => {
  const draft = productLoadCaptureDraft()
  const snapshot = currentOnlyAuthoritySnapshot(["dry_shampoo", "leave_in", "oil"])
  const completed = completeCaptureCategory(
    completeCaptureCategory(
      completeCaptureCategory(
        {
          ...draft,
          authoritySnapshot: {
            ...snapshot,
            categoryDecisions: [
              deepCleansingBasisDecision,
              ...snapshot.categoryDecisions.filter(
                (decision) => decision.category !== "deep_cleansing_shampoo",
              ),
            ],
          },
        },
        "dry_shampoo",
        currentOnlyRequirements,
      ),
      "leave_in",
      currentOnlyRequirements,
    ),
    "oil",
    currentOnlyRequirements,
  )

  assert.deepEqual(
    completed.inventoryAuthority?.proposedOutputSnapshot?.decisions
      .filter((decision) => decision.category === "scalp_care")
      .map((decision) => decision.category),
    ["scalp_care"],
  )
  assert.deepEqual(completed.inventoryAuthority?.proposedOutputSnapshot?.coverage, [
    deepCleansingScalpResetCoverage,
  ])
})

test("inventory authority proposals preserve the immutable base refined snapshot payload", () => {
  const baseCoverage: InitialNeedPlanSnapshot["coverage"][number] = {
    job: "dry_shampoo_bridge",
    ruleId: "portfolio.dry_shampoo_bridge.base",
    primaryCategories: ["dry_shampoo"],
    supportingCategories: [],
    outcome: "owned",
  }
  const snapshot = currentOnlyAuthoritySnapshot(["dry_shampoo", "leave_in", "oil"])
  const authoritySnapshot: Stage3AuthoritySnapshotV1 = {
    ...snapshot,
    coverage: [baseCoverage],
    categoryDecisions: [
      deepCleansingBasisDecision,
      ...snapshot.categoryDecisions.filter(
        (decision) => decision.category !== "deep_cleansing_shampoo",
      ),
    ],
  }
  const baseRefinedSnapshot = {
    schemaVersion: 1,
    snapshotKind: "initial_need",
    computationVersion: "stage2.refined.immutable.v7",
    inputHash: "refined-input-v1",
    createdAt: "2026-08-13T08:00:00.000Z",
    sourceQuiz: {
      kind: "personal_plan",
      version: 2,
      answers: {
        thickness: "fine",
        goals: ["hydration"],
      },
    },
    profile: {
      source: {
        quizVersion: 2,
        artifactId: "stage2-artifact-1",
        projection: "refined_post_plan",
      },
      hair: {
        texture: "wavy",
        thickness: "fine",
        density: "medium",
        length: "medium",
        surface: "frizzy",
        elasticity: "normal",
        chemicalTreatments: ["none"],
      },
      scalp: {
        oiliness: "balanced",
        concerns: [],
        irritationState: { state: "known", value: "normal" },
      },
      goals: ["hydration"],
      concerns: ["low_volume_or_weighed_down"],
      concernRecurrence: { state: "known", value: "sometimes" },
      routine: {
        currentProductLoad: { state: "unknown", reason: "current_product_load" },
        shampooFrequency: { state: "known", value: "weekly_2x" },
        heatToolUse: { state: "unknown", reason: "heat_tool_use" },
        mechanicalExposureSignals: [],
        dryShampooBridgePreference: {
          state: "unknown",
          reason: "dry_shampoo_bridge_preference",
        },
        scalpIrritationState: { state: "known", value: "normal" },
      },
    },
    assessments: {
      sentinel: "stage2-assessments-are-preserved",
      resetLoad: { knownScore: 1, missingInputs: ["current_product_load"] },
    },
    decisions: [
      deepCleansingBasisDecision,
      {
        category: "heat_protectant",
        resolution: "resolved",
        needTier: "not_needed",
        roles: [],
        target: null,
        frequency: null,
        reasons: [],
        executionState: "paused",
        executionPauseReason: {
          id: "heat_protectant.pause.no_heat",
          salience: "primary",
          evidence: [],
          values: {},
        },
        deferredFacts: ["heat_tool_use"],
      },
    ],
    coverage: [],
    productPreviews: [
      {
        category: "conditioner",
        state: "absent",
        reason: "deferred_fit",
        selectionRuleIds: ["preview.conditioner.deferred"],
        selectionVersion: "preview-v1",
      },
    ],
    renderedOrder: ["deep_cleansing_shampoo"],
    deferredFacts: ["heat_tool_use"],
  } as unknown as InitialNeedPlanSnapshot
  const draft = {
    ...productLoadCaptureDraft(),
    authoritySnapshot,
  }

  const completed = completeCaptureCategory(
    completeCaptureCategory(
      completeCaptureCategory(draft, "dry_shampoo", currentOnlyRequirements),
      "leave_in",
      currentOnlyRequirements,
    ),
    "oil",
    currentOnlyRequirements,
    { baseRefinedSnapshot },
  )
  const proposed = completed.inventoryAuthority?.proposedOutputSnapshot

  assert.equal(completed.pass, "need_revision_review")
  assert.equal(proposed?.sourceQuiz, baseRefinedSnapshot.sourceQuiz)
  assert.equal(proposed?.profile, baseRefinedSnapshot.profile)
  assert.equal(proposed?.profile.hair.thickness, "fine")
  assert.equal(proposed?.assessments, baseRefinedSnapshot.assessments)
  assert.equal(proposed?.productPreviews, baseRefinedSnapshot.productPreviews)
  assert.equal(proposed?.deferredFacts, baseRefinedSnapshot.deferredFacts)
  assert.equal(proposed?.createdAt, baseRefinedSnapshot.createdAt)
  assert.equal(proposed?.computationVersion, "stage3.product_load_refined_snapshot.v1")
  assert.notEqual(proposed?.inputHash, baseRefinedSnapshot.inputHash)
  assert.deepEqual(
    proposed?.decisions.map((decision) => [decision.category, decision.roles]),
    [
      ["deep_cleansing_shampoo", ["residue_reset"]],
      ["heat_protectant", []],
      ["scalp_care", ["scalp_exfoliant"]],
    ],
  )
  assert.equal(
    proposed?.decisions.find((decision) => decision.category === "heat_protectant")?.executionState,
    "paused",
  )
  assert.equal(
    proposed?.decisions.filter((decision) => decision.category === "heat_protectant").length,
    1,
  )
  assert.deepEqual(proposed?.coverage, [baseCoverage, deepCleansingScalpResetCoverage])
  assert.deepEqual(proposed?.renderedOrder, ["deep_cleansing_shampoo", "scalp_care"])
})

test("product-load Deep Cleansing overlay preserves irritated or dry-flake scalp pause", () => {
  const dryShampooRequirement: Stage3CategoryRequirement = {
    category: "dry_shampoo",
    requiredRoles: [],
    needSummary: "Aktuell verwendetes Trockenshampoo erfassen",
    authorityVersion: CATEGORY_ROLE_POLICIES.dry_shampoo.authorityVersion,
  }
  const snapshot = currentOnlyAuthoritySnapshot(["dry_shampoo"])
  const initial: Stage3ProductDraft = {
    ...createStage3Draft({
      draftId: "draft-product-load-scalp-pause",
      userId: "user-1",
      personalPlanId: "plan-1",
      refinedVersionId: "refined-v1",
      requirements: [dryShampooRequirement],
      now,
    }),
    authoritySnapshot: {
      ...snapshot,
      productLoadContext: {
        ...snapshot.productLoadContext!,
        deepCleansingScalpPause: true,
      },
    },
  }
  const completed = completeCaptureCategory(
    addCapturedProduct(initial, {
      capturedProductId: "dry-shampoo-current",
      userProductId: "user-product-dry-shampoo-current",
      identity: {
        kind: "catalog_product",
        productId: "dry-shampoo-product-current",
        displayName: "Trockenshampoo aktuell",
        category: "dry_shampoo",
      },
      frequencyRange: "weekly_3_4x",
      ownership: "owned",
      source: "catalog_search",
    }),
    "dry_shampoo",
    [dryShampooRequirement],
  )
  const deepCleansing = completed.inventoryAuthority?.proposedOutputSnapshot?.decisions.find(
    (decision) => decision.category === "deep_cleansing_shampoo",
  )

  assert.equal(deepCleansing?.executionState, "paused")
  assert.equal(deepCleansing?.executionPauseReason?.id, "deep_cleansing.safety.scalp_pause")
})

test("product-load coverage links overlay Deep Cleansing to base Scalp Care", () => {
  const leaveInRequirement: Stage3CategoryRequirement = {
    category: "leave_in",
    requiredRoles: [],
    needSummary: "Aktuell verwendetes Leave-in erfassen",
    authorityVersion: CATEGORY_ROLE_POLICIES.leave_in.authorityVersion,
  }
  const snapshot = currentOnlyAuthoritySnapshot(["leave_in"])
  const initial: Stage3ProductDraft = {
    ...createStage3Draft({
      draftId: "draft-product-load-base-scalp",
      userId: "user-1",
      personalPlanId: "plan-1",
      refinedVersionId: "refined-v1",
      requirements: [leaveInRequirement],
      now,
    }),
    authoritySnapshot: {
      ...snapshot,
      categoryDecisions: [
        ...snapshot.categoryDecisions.filter((decision) => decision.category !== "scalp_care"),
        scalpExfoliantDecision,
      ],
    },
  }
  const captured = addCapturedProduct(initial, {
    capturedProductId: "leave-in-current",
    userProductId: "user-product-leave-in-current",
    identity: {
      kind: "catalog_product",
      productId: "leave-in-product-current",
      displayName: "Leave-in aktuell",
      category: "leave_in",
    },
    frequencyRange: "weekly_1x",
    ownership: "owned",
    source: "catalog_search",
  })
  const completed = completeCaptureCategory(captured, "leave_in", [leaveInRequirement])

  assert.deepEqual(
    completed.inventoryAuthority?.proposedOutputSnapshot?.decisions
      .filter((decision) => decision.category === "deep_cleansing_shampoo")
      .map((decision) => decision.category),
    ["deep_cleansing_shampoo"],
  )
  assert.deepEqual(completed.inventoryAuthority?.proposedOutputSnapshot?.coverage, [
    deepCleansingScalpResetCoverage,
  ])
})

test("effective product-load coverage dedupes base and overlay ledger facts", () => {
  const draft = productLoadCaptureDraft()
  const snapshot = currentOnlyAuthoritySnapshot(["dry_shampoo", "leave_in", "oil"])
  const completed = completeCaptureCategory(
    completeCaptureCategory(
      completeCaptureCategory(
        {
          ...draft,
          authoritySnapshot: {
            ...snapshot,
            coverage: [deepCleansingScalpResetCoverage],
            categoryDecisions: [
              {
                ...deepCleansingBasisDecision,
                frequency: {
                  kind: "every_nth_wash",
                  roles: ["residue_reset"],
                  every: 4,
                  substitutesRegularShampoo: true,
                },
              },
              scalpExfoliantDecision,
            ],
          },
        },
        "dry_shampoo",
        currentOnlyRequirements,
      ),
      "leave_in",
      currentOnlyRequirements,
    ),
    "oil",
    currentOnlyRequirements,
  )

  const resolution = resolveStage3ProductLoadResolution({
    ...completed,
    productLoadResolution: undefined,
  })
  assert.equal(resolution?.coverage.length, 0)
  assert.deepEqual(effectiveStage3Coverage(completed), [deepCleansingScalpResetCoverage])
})

test("product-load Scalp Care overlay preserves an existing stronger base decision", () => {
  const draft = productLoadCaptureDraft()
  const snapshot = currentOnlyAuthoritySnapshot(["dry_shampoo", "leave_in", "oil"])
  const scalp = snapshot.categoryDecisions.find((decision) => decision.category === "scalp_care")
  if (!scalp) throw new Error("expected scalp decision")
  const strongerSnapshot: Stage3AuthoritySnapshotV1 = {
    ...snapshot,
    categoryDecisions: [
      ...snapshot.categoryDecisions.filter((decision) => decision.category !== "scalp_care"),
      {
        ...scalp,
        needTier: "basis",
        roles: ["scalp_comfort"],
        target: {
          category: "scalp_care",
          roles: ["scalp_comfort"],
          roleTargets: [{ role: "scalp_comfort", coverage: "supporting" }],
        },
        frequency: {
          kind: "role_keyed_product_protocol",
          roleFrequencies: [{ role: "scalp_comfort", cadence: "regular_according_to_product" }],
        },
      },
    ],
  }
  const completed = completeCaptureCategory(
    completeCaptureCategory(
      completeCaptureCategory(
        { ...draft, authoritySnapshot: strongerSnapshot },
        "dry_shampoo",
        currentOnlyRequirements,
      ),
      "leave_in",
      currentOnlyRequirements,
    ),
    "oil",
    currentOnlyRequirements,
  )

  const scalpOverlay = completed.inventoryAuthority?.proposedOutputSnapshot?.decisions.find(
    (decision) => decision.category === "scalp_care",
  )
  assert.equal(scalpOverlay?.needTier, "basis")
  assert.deepEqual(scalpOverlay?.roles, ["scalp_comfort", "scalp_exfoliant"])
  assert.deepEqual(scalpOverlay?.frequency, {
    kind: "role_keyed_product_protocol",
    roleFrequencies: [
      { role: "scalp_comfort", cadence: "regular_according_to_product" },
      { role: "scalp_exfoliant", cadence: "occasional_according_to_product" },
    ],
  })
})

function oilOnlyDraft(
  oilPurposes: NonNullable<Stage3AuthoritySnapshotV1["productLoadContext"]>["oilPurposes"],
) {
  const oilRequirement: Stage3CategoryRequirement = {
    category: "oil",
    requiredRoles: [],
    needSummary: "Aktuell verwendetes Oil erfassen",
    authorityVersion: CATEGORY_ROLE_POLICIES.oil.authorityVersion,
  }
  const draft: Stage3ProductDraft = {
    ...createStage3Draft({
      draftId: `draft-oil-${oilPurposes.join("-") || "none"}`,
      userId: "user-1",
      personalPlanId: "plan-1",
      refinedVersionId: "refined-v1",
      requirements: [oilRequirement],
      now,
    }),
    authoritySnapshot: currentOnlyAuthoritySnapshot(["oil"], oilPurposes),
  }
  return completeCaptureCategory(
    addCapturedProduct(draft, {
      capturedProductId: "oil-current",
      userProductId: "user-product-oil-current",
      identity: {
        kind: "catalog_product",
        productId: "oil-product-current",
        displayName: "Oil aktuell",
        category: "oil",
      },
      frequencyRange: "weekly_1x",
      ownership: "owned",
      source: "catalog_search",
    }),
    "oil",
    [oilRequirement],
  )
}

test("captured weekly Oil with confirmed scalp purpose adds Scalp Care exfoliant load", () => {
  const draft = oilOnlyDraft(["scalp"])
  assert.deepEqual(
    draft.inventoryAuthority?.proposedOutputSnapshot?.decisions
      .filter((decision) => decision.category === "scalp_care")
      .map((decision) => ({
        category: decision.category,
        roles: decision.roles,
      })),
    [{ category: "scalp_care", roles: ["scalp_exfoliant"] }],
  )
})

test("multiple captured Oils do not inherit category-level purpose frequency load", () => {
  const oilRequirement: Stage3CategoryRequirement = {
    category: "oil",
    requiredRoles: [],
    needSummary: "Aktuell verwendete Oils erfassen",
    authorityVersion: CATEGORY_ROLE_POLICIES.oil.authorityVersion,
  }
  let draft: Stage3ProductDraft = {
    ...createStage3Draft({
      draftId: "draft-oil-ambiguous-purpose",
      userId: "user-1",
      personalPlanId: "plan-1",
      refinedVersionId: "refined-v1",
      requirements: [oilRequirement],
      now,
    }),
    authoritySnapshot: currentOnlyAuthoritySnapshot(["oil"], ["dry_finish", "scalp"]),
  }
  draft = addCapturedProduct(draft, {
    capturedProductId: "oil-current-a",
    userProductId: "user-product-oil-current-a",
    identity: {
      kind: "catalog_product",
      productId: "oil-product-current-a",
      displayName: "Oil aktuell A",
      category: "oil",
    },
    frequencyRange: "daily_1x",
    ownership: "owned",
    source: "catalog_search",
  })
  draft = addCapturedProduct(draft, {
    capturedProductId: "oil-current-b",
    userProductId: "user-product-oil-current-b",
    identity: {
      kind: "catalog_product",
      productId: "oil-product-current-b",
      displayName: "Oil aktuell B",
      category: "oil",
    },
    frequencyRange: "weekly_1x",
    ownership: "owned",
    source: "catalog_search",
  })
  draft = completeCaptureCategory(draft, "oil", [oilRequirement])

  assert.equal(draft.productLoadResolution, undefined)
})

test("captured weekly Oil without scalp or dry-finish purpose does not create product-load overlay", () => {
  const draft = oilOnlyDraft([])
  assert.equal(draft.productLoadResolution, undefined)
})

test("capture edits clear the pending need authority and dependent decisions", () => {
  const completed = completeCaptureCategory(
    completeCaptureCategory(
      completeCaptureCategory(productLoadCaptureDraft(), "dry_shampoo", currentOnlyRequirements),
      "leave_in",
      currentOnlyRequirements,
    ),
    "oil",
    currentOnlyRequirements,
  )

  const reopened = reopenCaptureCategory(completed, "dry_shampoo")

  assert.equal(reopened.productLoadResolution, undefined)
  assert.equal(reopened.inventoryAuthority, undefined)
  assert.deepEqual(reopened.decisions, [])
  assert.equal(reopened.orderedCategories.includes("deep_cleansing_shampoo"), false)
  assert.equal(reopened.completedCaptureCategories.includes("deep_cleansing_shampoo"), false)
  assert.equal(reopened.authorityVersions.deep_cleansing_shampoo, undefined)
})

test("atomic category replacement clears and reassigns two-product Shampoo ownership", () => {
  const shampooRequirement: Stage3CategoryRequirement = {
    category: "shampoo",
    requiredRoles: ["shampoo_everyday"],
    needSummary: "Sanfte Reinigung",
    authorityVersion: CATEGORY_ROLE_POLICIES.shampoo.authorityVersion,
  }
  let draft = createStage3Draft({
    draftId: "draft-shampoo-replacement",
    userId: "user-1",
    personalPlanId: "plan-1",
    refinedVersionId: "refined-v1",
    requirements: [shampooRequirement],
    now,
  })
  for (const id of ["shampoo-a", "shampoo-b"] as const) {
    draft = addCapturedProduct(draft, {
      capturedProductId: id,
      userProductId: `user-product-${id}`,
      identity: {
        kind: "catalog_product",
        productId: `product-${id}`,
        displayName: id,
        category: "shampoo",
      },
      frequencyRange: "weekly_2x",
      ownership: "owned",
      source: "catalog_search",
    })
  }

  const assignedA = replaceCategoryRoleAssignments(
    draft,
    "shampoo",
    [
      {
        capturedProductId: "shampoo-a",
        category: "shampoo",
        roles: ["shampoo_everyday"],
      },
    ],
    [shampooRequirement],
  )
  const reassignedB = replaceCategoryRoleAssignments(
    assignedA,
    "shampoo",
    [
      {
        capturedProductId: "shampoo-b",
        category: "shampoo",
        roles: ["shampoo_everyday"],
      },
    ],
    [shampooRequirement],
  )

  assert.deepEqual(reassignedB.roleAssignments, [
    {
      capturedProductId: "shampoo-b",
      category: "shampoo",
      roles: ["shampoo_everyday"],
    },
  ])
  assert.throws(
    () =>
      replaceCategoryRoleAssignments(
        reassignedB,
        "shampoo",
        [
          {
            capturedProductId: "shampoo-a",
            category: "shampoo",
            roles: ["shampoo_everyday"],
          },
          {
            capturedProductId: "shampoo-b",
            category: "shampoo",
            roles: ["shampoo_everyday"],
          },
        ],
        [shampooRequirement],
      ),
    /role shampoo_everyday already assigned/,
  )
})

test("atomic category replacement moves Oil roles and clears the previous product in one revision", () => {
  const oilRequirement = requirements[1]
  let draft = createStage3Draft({
    draftId: "draft-oil-replacement",
    userId: "user-1",
    personalPlanId: "plan-1",
    refinedVersionId: "refined-v1",
    requirements: [oilRequirement],
    now,
  })
  for (const id of ["oil-a", "oil-b"] as const) {
    draft = addCapturedProduct(draft, {
      capturedProductId: id,
      userProductId: `user-product-${id}`,
      identity: {
        kind: "catalog_product",
        productId: `product-${id}`,
        displayName: id,
        category: "oil",
      },
      frequencyRange: "weekly_1x",
      ownership: "owned",
      source: "catalog_search",
    })
  }
  const initial = replaceCategoryRoleAssignments(
    draft,
    "oil",
    [
      {
        capturedProductId: "oil-a",
        category: "oil",
        roles: ["pre_wash_fibre_treatment", "dry_finish"],
      },
      {
        capturedProductId: "oil-b",
        category: "oil",
        roles: ["leave_on_fibre_conditioning"],
      },
    ],
    [oilRequirement],
  )
  const reassigned = replaceCategoryRoleAssignments(
    initial,
    "oil",
    [
      {
        capturedProductId: "oil-a",
        category: "oil",
        roles: ["pre_wash_fibre_treatment"],
      },
      {
        capturedProductId: "oil-b",
        category: "oil",
        roles: ["leave_on_fibre_conditioning", "dry_finish"],
      },
    ],
    [oilRequirement],
  )

  assert.equal(reassigned.revision, initial.revision + 1)
  assert.deepEqual(reassigned.roleAssignments, [
    {
      capturedProductId: "oil-a",
      category: "oil",
      roles: ["pre_wash_fibre_treatment"],
    },
    {
      capturedProductId: "oil-b",
      category: "oil",
      roles: ["leave_on_fibre_conditioning", "dry_finish"],
    },
  ])
  assert.throws(
    () =>
      replaceCategoryRoleAssignments(
        reassigned,
        "oil",
        [
          {
            capturedProductId: "oil-b",
            category: "oil",
            roles: ["leave_on_fibre_conditioning", "dry_finish"],
          },
        ],
        [oilRequirement],
      ),
    /required role pre_wash_fibre_treatment is uncovered/,
  )
})

test("finalizing a capture category assigns, records unique gaps, and completes in one revision", () => {
  const oilRequirement = requirements[1]
  let draft = createStage3Draft({
    draftId: "draft-oil-finalize",
    userId: "user-1",
    personalPlanId: "plan-1",
    refinedVersionId: "refined-v1",
    requirements: [oilRequirement],
    now,
  })
  draft = addCapturedProduct(draft, {
    capturedProductId: "oil-a",
    userProductId: "user-product-oil-a",
    identity: {
      kind: "catalog_product",
      productId: "product-oil-a",
      displayName: "Oil A",
      category: "oil",
    },
    frequencyRange: "weekly_1x",
    ownership: "owned",
    source: "catalog_search",
  })

  const finalized = finalizeCaptureCategory(
    draft,
    "oil",
    [
      {
        capturedProductId: "oil-a",
        category: "oil",
        roles: ["dry_finish"],
      },
    ],
    [
      { category: "oil", role: "pre_wash_fibre_treatment", reason: "not_ready_to_decide" },
      { category: "oil", role: "pre_wash_fibre_treatment", reason: "not_ready_to_decide" },
      { category: "oil", role: "leave_on_fibre_conditioning", reason: "not_ready_to_decide" },
    ],
    [oilRequirement],
  )

  assert.equal(finalized.revision, draft.revision + 1)
  assert.equal(finalized.pass, "product_decisions")
  assert.equal(finalized.categoryCursor, null)
  assert.deepEqual(finalized.completedCaptureCategories, ["oil"])
  assert.deepEqual(finalized.roleAssignments, [
    { capturedProductId: "oil-a", category: "oil", roles: ["dry_finish"] },
  ])
  assert.deepEqual(finalized.uncoveredRoles, [
    { category: "oil", role: "pre_wash_fibre_treatment", reason: "not_ready_to_decide" },
    { category: "oil", role: "leave_on_fibre_conditioning", reason: "not_ready_to_decide" },
  ])
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
