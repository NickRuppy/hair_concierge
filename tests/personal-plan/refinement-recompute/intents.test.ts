import assert from "node:assert/strict"
import test from "node:test"

import type {
  Stage3AuthorityActionKind,
  Stage3AuthorityEvaluation,
  Stage3KnownAuthorityEvaluation,
} from "../../../src/lib/personal-plan/products/authority/contracts"
import type {
  PersonalPlanCategory,
  Stage3Recommendation,
} from "../../../src/lib/personal-plan/products/contracts"
import { stage3DecisionKey } from "../../../src/lib/personal-plan/products/contracts"
import type { Stage3SelectedComparisonCandidate } from "../../../src/lib/personal-plan/products/fit-comparison"
import type { Stage3DecisionReviewBundle } from "../../../src/lib/personal-plan/products/production-persistence-gateway"
import type { RoutinePayloadV1 } from "../../../src/lib/personal-plan/routine/contracts"
import { routinePayloadV1Schema } from "../../../src/lib/personal-plan/routine/contracts"
import type { PlanProductRole } from "../../../src/lib/personal-plan/types"
import { buildStage3RecomputeIntents } from "../../../src/lib/personal-plan/refinement-recompute/intents"

const PLAN_ID = "11111111-1111-4111-8111-111111111111"
const REFINED_VERSION_ID = "22222222-2222-4222-8222-222222222222"
const SOURCE_FINGERPRINT = "a".repeat(64)

type RoutineItem = RoutinePayloadV1["items"][number]

function decisionKey(
  category: PersonalPlanCategory,
  role: PlanProductRole,
  capturedProductId: string | null,
) {
  return stage3DecisionKey(category, role, capturedProductId)
}

/** A compiled Routine item, shaped exactly as `routine-candidate-compiler` emits it. */
function routineItem(input: {
  category: PersonalPlanCategory
  role: PlanProductRole
  capturedProductId?: string | null
  inclusion?: "included" | "excluded"
  fitDecision?: "standard" | "informed_override"
  product: RoutineItem["product"]
}): RoutineItem {
  const capturedProductId = input.capturedProductId ?? null
  const key = decisionKey(input.category, input.role, capturedProductId)
  const availability =
    input.product.kind === "none"
      ? ("none" as const)
      : input.product.kind === "pending_review"
        ? ("pending_review" as const)
        : input.product.kind
  return {
    itemKey: `item:${input.category}:${input.role}`,
    assignmentKey: `assignment:${input.category}:${input.role}`,
    category: input.category,
    role: input.role,
    purposeKey: input.role,
    roleOrder: 0,
    state: {
      systemAssessment: "basis",
      inclusion: input.inclusion ?? "included",
      availability,
      fitDecision: input.fitDecision ?? "standard",
    },
    product: input.product,
    cadence: { recommended: null, userOverride: null, displayKey: "personal_plan.cadence.none" },
    sourceDecisionKeys: [key],
    authorityRuleIds: [],
    executable: input.product.kind === "owned" && (input.inclusion ?? "included") === "included",
  }
}

/**
 * Compiles the `intent.categories` the compiler would emit for these items: a
 * category is `included` when any of its items is, and the exclusion source
 * says who excluded it — `"stage3"` for a system deferral, `"user"` for the
 * person's own Routine edit. The builder reads exactly these two fields, so a
 * fixture that leaves them out cannot distinguish the two causes.
 */
function intentCategories(
  items: RoutineItem[],
  userExcluded: PersonalPlanCategory[],
): RoutinePayloadV1["intent"]["categories"] {
  const categories = [...new Set(items.map((item) => item.category))]
  return categories.map((category) => {
    const categoryItems = items.filter((item) => item.category === category)
    const included = categoryItems.some((item) => item.state.inclusion === "included")
    return {
      category,
      inclusion: included ? ("included" as const) : ("excluded" as const),
      inclusionSource: userExcluded.includes(category) ? ("user" as const) : ("stage3" as const),
      // The builder reads inclusion only; assignments stay empty on purpose.
      assignments: [],
    }
  })
}

function routine(
  items: RoutineItem[],
  options: { userExcluded?: PersonalPlanCategory[] } = {},
): RoutinePayloadV1 {
  return {
    schemaVersion: 1,
    planId: PLAN_ID,
    versionId: "routine-version-1",
    parentVersionId: null,
    source: {
      refinedVersionId: REFINED_VERSION_ID,
      productPortfolioVersionId: "portfolio-1",
      sourceFingerprint: SOURCE_FINGERPRINT,
      compilerVersion: "routine-compiler-v1",
      authorityVersions: {},
    },
    intent: {
      schemaVersion: 1,
      categories: intentCategories(items, options.userExcluded ?? []),
    },
    sections: [
      { key: "basis", itemKeys: items.map((item) => item.itemKey) },
      { key: "optional", itemKeys: [] },
    ],
    items,
    createdAt: "2026-08-31T00:00:00.000Z",
  }
}

function recommendation(
  productId: string,
  category: PersonalPlanCategory,
  role: PlanProductRole,
): Stage3Recommendation {
  return {
    recommendationId: `recommendation:${productId}`,
    productId,
    category,
    role,
    displayName: `Produkt ${productId}`,
    reason: "passt zu deinem Profil",
    authorityRuleId: `${category}.rule.v1`,
  }
}

function knownEvaluation(input: {
  category: PersonalPlanCategory
  role: PlanProductRole
  capturedProductId?: string | null
  allowedActions: Stage3AuthorityActionKind[]
  recommendationProductId?: string | null
  recommendationFactFingerprint?: string | null
  verdict?: Stage3KnownAuthorityEvaluation["verdict"]
}): Stage3KnownAuthorityEvaluation {
  const recommended = input.recommendationProductId
    ? recommendation(input.recommendationProductId, input.category, input.role)
    : null
  return {
    status: "known",
    category: input.category,
    subjectKey: decisionKey(input.category, input.role, input.capturedProductId ?? null),
    verdict: input.verdict ?? "ideal",
    criteria: [],
    allowedActions: input.allowedActions,
    recommendation: recommended,
    productFactFingerprint: input.capturedProductId ? "b".repeat(64) : null,
    recommendationFactFingerprint: recommended
      ? input.recommendationFactFingerprint === undefined
        ? "c".repeat(64)
        : input.recommendationFactFingerprint
      : null,
    coverageRuleIds: [],
  }
}

function candidate(
  productId: string,
  category: PersonalPlanCategory,
  role: PlanProductRole,
  factFingerprint = "d".repeat(64),
): Stage3SelectedComparisonCandidate {
  return {
    productId,
    category,
    role,
    verdict: "supportive",
    criteria: [],
    recommendation: recommendation(productId, category, role),
    factFingerprint,
  }
}

function reviewBundle(
  evaluation: Stage3AuthorityEvaluation,
  alternatives: Stage3SelectedComparisonCandidate[],
  role: PlanProductRole,
): Stage3DecisionReviewBundle {
  return {
    authorityEvaluation: evaluation,
    fitComparison: {
      schemaVersion: 1,
      mode: "comparison",
      category: evaluation.category,
      role,
      subjectKey: evaluation.subjectKey,
      sourceIdentity: null,
      products: [],
      alternatives,
      dimensions: [],
    },
  }
}

test("the routine fixture is a legal routine payload", () => {
  const payload = routine([
    routineItem({
      category: "shampoo",
      role: "shampoo_everyday",
      capturedProductId: "captured-1",
      product: {
        kind: "owned",
        capturedProductId: "captured-1",
        productId: "product-owned",
        displayName: "Shampoo",
      },
    }),
  ])
  assert.equal(routinePayloadV1Schema.safeParse(payload).success, true)
})

test("an owned product whose verdict still fits is kept", () => {
  const evaluation = knownEvaluation({
    category: "shampoo",
    role: "shampoo_everyday",
    capturedProductId: "captured-1",
    allowedActions: ["keep_owned", "plan_recommendation", "leave_uncovered"],
    recommendationProductId: "product-recommended",
  })
  const plan = buildStage3RecomputeIntents({
    evaluations: [evaluation],
    reviewBundles: [reviewBundle(evaluation, [], "shampoo_everyday")],
    routine: routine([
      routineItem({
        category: "shampoo",
        role: "shampoo_everyday",
        capturedProductId: "captured-1",
        product: {
          kind: "owned",
          capturedProductId: "captured-1",
          productId: "product-owned",
          displayName: "Shampoo",
        },
      }),
    ]),
  })
  assert.deepEqual(plan, {
    intents: [
      { type: "resolve_decision", subjectKey: evaluation.subjectKey, action: "keep_owned" },
    ],
    blocked: [],
  })
})

test("an owned product with a previously acknowledged mismatch is re-acknowledged", () => {
  const evaluation = knownEvaluation({
    category: "conditioner",
    role: "conditioner_rinse_out",
    capturedProductId: "captured-2",
    allowedActions: ["acknowledge_override", "plan_recommendation", "leave_uncovered"],
    recommendationProductId: "product-recommended",
    verdict: "mismatch",
  })
  const plan = buildStage3RecomputeIntents({
    evaluations: [evaluation],
    reviewBundles: [reviewBundle(evaluation, [], "conditioner_rinse_out")],
    routine: routine([
      routineItem({
        category: "conditioner",
        role: "conditioner_rinse_out",
        capturedProductId: "captured-2",
        fitDecision: "informed_override",
        product: {
          kind: "owned",
          capturedProductId: "captured-2",
          productId: "product-owned",
          displayName: "Conditioner",
        },
      }),
    ]),
  })
  assert.deepEqual(plan.intents, [
    {
      type: "resolve_decision",
      subjectKey: evaluation.subjectKey,
      action: "acknowledge_override",
    },
  ])
  assert.deepEqual(plan.blocked, [])
})

test("a product still in review is kept pending", () => {
  const subjectKey = decisionKey("mask", "intensive_conditioning_mask", "captured-3")
  const evaluation: Stage3AuthorityEvaluation = {
    status: "pending",
    category: "mask",
    subjectKey,
    reason: "product_intake_pending",
    allowedActions: ["keep_pending", "leave_uncovered"],
    coverageRuleIds: [],
  }
  const plan = buildStage3RecomputeIntents({
    evaluations: [evaluation],
    reviewBundles: [reviewBundle(evaluation, [], "intensive_conditioning_mask")],
    routine: routine([
      routineItem({
        category: "mask",
        role: "intensive_conditioning_mask",
        capturedProductId: "captured-3",
        product: { kind: "pending_review", submissionId: "submission-1", displayName: "Maske" },
      }),
    ]),
  })
  assert.deepEqual(plan.intents, [{ type: "resolve_decision", subjectKey, action: "keep_pending" }])
})

test("a planned product that is still the primary recommendation is re-planned", () => {
  const evaluation = knownEvaluation({
    category: "shampoo",
    role: "shampoo_everyday",
    allowedActions: ["plan_recommendation", "leave_uncovered"],
    recommendationProductId: "product-planned",
  })
  const plan = buildStage3RecomputeIntents({
    evaluations: [evaluation],
    reviewBundles: [reviewBundle(evaluation, [], "shampoo_everyday")],
    routine: routine([
      routineItem({
        category: "shampoo",
        role: "shampoo_everyday",
        product: {
          kind: "planned",
          plannedPurchaseId: "planned-1",
          productId: "product-planned",
          displayName: "Shampoo",
        },
      }),
    ]),
  })
  assert.deepEqual(plan.intents, [
    {
      type: "resolve_decision",
      subjectKey: evaluation.subjectKey,
      action: "plan_recommendation",
    },
  ])
})

test("a still-primary planned product the authority cannot plan is kept as a candidate", () => {
  const evaluation = knownEvaluation({
    category: "shampoo",
    role: "shampoo_everyday",
    allowedActions: ["leave_uncovered"],
    recommendationProductId: "product-planned",
  })
  const plan = buildStage3RecomputeIntents({
    evaluations: [evaluation],
    reviewBundles: [
      reviewBundle(
        evaluation,
        [candidate("product-planned", "shampoo", "shampoo_everyday")],
        "shampoo_everyday",
      ),
    ],
    routine: routine([
      routineItem({
        category: "shampoo",
        role: "shampoo_everyday",
        product: {
          kind: "planned",
          plannedPurchaseId: "planned-1",
          productId: "product-planned",
          displayName: "Shampoo",
        },
      }),
    ]),
  })
  assert.deepEqual(plan.intents, [
    {
      type: "resolve_decision",
      subjectKey: evaluation.subjectKey,
      action: "select_replacement",
      selectedCandidateId: "product-planned",
      selectedCandidateFactFingerprint: "d".repeat(64),
    },
  ])
})

test("a planned product that is now an alternative candidate is selected as a replacement", () => {
  const evaluation = knownEvaluation({
    category: "shampoo",
    role: "shampoo_everyday",
    allowedActions: ["plan_recommendation", "leave_uncovered"],
    recommendationProductId: "product-new-primary",
  })
  const plan = buildStage3RecomputeIntents({
    evaluations: [evaluation],
    reviewBundles: [
      reviewBundle(
        evaluation,
        [candidate("product-planned", "shampoo", "shampoo_everyday", "e".repeat(64))],
        "shampoo_everyday",
      ),
    ],
    routine: routine([
      routineItem({
        category: "shampoo",
        role: "shampoo_everyday",
        product: {
          kind: "planned",
          plannedPurchaseId: "planned-1",
          productId: "product-planned",
          displayName: "Shampoo",
        },
      }),
    ]),
  })
  assert.deepEqual(plan.intents, [
    {
      type: "resolve_decision",
      subjectKey: evaluation.subjectKey,
      action: "select_replacement",
      selectedCandidateId: "product-planned",
      selectedCandidateFactFingerprint: "e".repeat(64),
    },
  ])
})

test("a select_replacement is emitted even when the action is not in allowedActions", () => {
  // `select_replacement` is exempt from the allowedActions membership check
  // (production-persistence-gateway.ts) and validated against the bundle instead.
  const evaluation = knownEvaluation({
    category: "shampoo",
    role: "shampoo_everyday",
    allowedActions: ["leave_uncovered"],
    recommendationProductId: null,
  })
  const plan = buildStage3RecomputeIntents({
    evaluations: [evaluation],
    reviewBundles: [
      reviewBundle(
        evaluation,
        [candidate("product-planned", "shampoo", "shampoo_everyday")],
        "shampoo_everyday",
      ),
    ],
    routine: routine([
      routineItem({
        category: "shampoo",
        role: "shampoo_everyday",
        product: {
          kind: "planned",
          plannedPurchaseId: "planned-1",
          productId: "product-planned",
          displayName: "Shampoo",
        },
      }),
    ]),
  })
  assert.equal(plan.intents[0]?.action, "select_replacement")
})

test("an unresolvable planned product never plans the new, unseen recommendation", () => {
  // Founder ruling R5: the replacement recommendation is a product this person
  // has never seen, so it is deferred rather than planned on their behalf.
  const evaluation = knownEvaluation({
    category: "shampoo",
    role: "shampoo_everyday",
    allowedActions: ["plan_recommendation", "leave_uncovered"],
    recommendationProductId: "product-new-primary",
  })
  const plan = buildStage3RecomputeIntents({
    evaluations: [evaluation],
    // The previously planned product is gone from the candidate set.
    reviewBundles: [reviewBundle(evaluation, [], "shampoo_everyday")],
    routine: routine([
      routineItem({
        category: "shampoo",
        role: "shampoo_everyday",
        product: {
          kind: "planned",
          plannedPurchaseId: "planned-1",
          productId: "product-gone",
          displayName: "Shampoo",
        },
      }),
    ]),
  })
  assert.deepEqual(plan.intents, [
    {
      type: "resolve_decision",
      subjectKey: evaluation.subjectKey,
      action: "leave_uncovered",
      deferralReason: "unseen_recommendation",
    },
  ])
})

test("a planned candidate without a fact fingerprint is not selected as a replacement", () => {
  const evaluation = knownEvaluation({
    category: "shampoo",
    role: "shampoo_everyday",
    allowedActions: ["leave_uncovered"],
    recommendationProductId: null,
  })
  const plan = buildStage3RecomputeIntents({
    evaluations: [evaluation],
    reviewBundles: [
      reviewBundle(
        evaluation,
        [candidate("product-planned", "shampoo", "shampoo_everyday", "")],
        "shampoo_everyday",
      ),
    ],
    routine: routine([
      routineItem({
        category: "shampoo",
        role: "shampoo_everyday",
        product: {
          kind: "planned",
          plannedPurchaseId: "planned-1",
          productId: "product-planned",
          displayName: "Shampoo",
        },
      }),
    ]),
  })
  assert.deepEqual(plan.intents, [
    {
      type: "resolve_decision",
      subjectKey: evaluation.subjectKey,
      action: "leave_uncovered",
      deferralReason: "no_product",
    },
  ])
})

test("a replacement is never selected against a non-known evaluation", () => {
  // `resolveDecisions` does not re-check the status for `select_replacement`,
  // so the builder refuses rather than writing a decision against a verdict the
  // authority never established.
  const subjectKey = decisionKey("shampoo", "shampoo_everyday", null)
  const evaluation: Stage3AuthorityEvaluation = {
    status: "unknown",
    category: "shampoo",
    subjectKey,
    missingFacts: ["catalog_product_facts"],
    criteria: [],
    allowedActions: ["leave_uncovered"],
    coverageRuleIds: [],
  }
  const plan = buildStage3RecomputeIntents({
    evaluations: [evaluation],
    reviewBundles: [
      reviewBundle(
        evaluation,
        [candidate("product-planned", "shampoo", "shampoo_everyday")],
        "shampoo_everyday",
      ),
    ],
    routine: routine([
      routineItem({
        category: "shampoo",
        role: "shampoo_everyday",
        product: {
          kind: "planned",
          plannedPurchaseId: "planned-1",
          productId: "product-planned",
          displayName: "Shampoo",
        },
      }),
    ]),
  })
  assert.deepEqual(plan.intents, [
    {
      type: "resolve_decision",
      subjectKey,
      action: "leave_uncovered",
      deferralReason: "no_product",
    },
  ])
})

test("an unresolvable planned product with no buyable recommendation becomes a product gap", () => {
  const evaluation = knownEvaluation({
    category: "shampoo",
    role: "shampoo_everyday",
    allowedActions: ["leave_uncovered"],
    recommendationProductId: null,
  })
  const plan = buildStage3RecomputeIntents({
    evaluations: [evaluation],
    reviewBundles: [reviewBundle(evaluation, [], "shampoo_everyday")],
    routine: routine([
      routineItem({
        category: "shampoo",
        role: "shampoo_everyday",
        product: {
          kind: "planned",
          plannedPurchaseId: "planned-1",
          productId: null,
          displayName: "Shampoo",
        },
      }),
    ]),
  })
  assert.deepEqual(plan.intents, [
    {
      type: "resolve_decision",
      subjectKey: evaluation.subjectKey,
      action: "leave_uncovered",
      deferralReason: "no_product",
    },
  ])
})

test("a role the person deliberately left uncovered stays uncovered without a deferral reason", () => {
  const evaluation = knownEvaluation({
    category: "mask",
    role: "intensive_conditioning_mask",
    allowedActions: ["plan_recommendation", "leave_uncovered"],
    recommendationProductId: "product-recommended",
  })
  const plan = buildStage3RecomputeIntents({
    evaluations: [evaluation],
    reviewBundles: [reviewBundle(evaluation, [], "intensive_conditioning_mask")],
    routine: routine(
      [
        routineItem({
          category: "mask",
          role: "intensive_conditioning_mask",
          inclusion: "excluded",
          product: { kind: "none", displayName: null },
        }),
      ],
      { userExcluded: ["mask"] },
    ),
  })
  assert.deepEqual(plan.intents, [
    { type: "resolve_decision", subjectKey: evaluation.subjectKey, action: "leave_uncovered" },
  ])
})

test("a role Stage 3 previously deferred re-derives its deferral reason", () => {
  // The compiler flattens a `leave_uncovered` decision onto an excluded item,
  // losing the reason. `inclusionSource: "stage3"` is what still says the
  // system, not the person, left the role empty.
  const evaluation = knownEvaluation({
    category: "mask",
    role: "intensive_conditioning_mask",
    allowedActions: ["plan_recommendation", "leave_uncovered"],
    recommendationProductId: "product-recommended",
  })
  const plan = buildStage3RecomputeIntents({
    evaluations: [evaluation],
    reviewBundles: [reviewBundle(evaluation, [], "intensive_conditioning_mask")],
    routine: routine([
      routineItem({
        category: "mask",
        role: "intensive_conditioning_mask",
        inclusion: "excluded",
        product: { kind: "none", displayName: null },
      }),
    ]),
  })
  assert.deepEqual(plan.intents, [
    {
      type: "resolve_decision",
      subjectKey: evaluation.subjectKey,
      action: "leave_uncovered",
      deferralReason: "unseen_recommendation",
    },
  ])
})

test("a Stage-3 deferred role with no buyable recommendation re-derives no_product", () => {
  const evaluation = knownEvaluation({
    category: "mask",
    role: "intensive_conditioning_mask",
    allowedActions: ["leave_uncovered"],
    recommendationProductId: null,
  })
  const plan = buildStage3RecomputeIntents({
    evaluations: [evaluation],
    reviewBundles: [reviewBundle(evaluation, [], "intensive_conditioning_mask")],
    routine: routine([
      routineItem({
        category: "mask",
        role: "intensive_conditioning_mask",
        inclusion: "excluded",
        product: { kind: "none", displayName: null },
      }),
    ]),
  })
  assert.deepEqual(plan.intents, [
    {
      type: "resolve_decision",
      subjectKey: evaluation.subjectKey,
      action: "leave_uncovered",
      deferralReason: "no_product",
    },
  ])
})

test("a role excluded inside a still-included category counts as a Stage-3 deferral", () => {
  const deferred = knownEvaluation({
    category: "shampoo",
    role: "shampoo_dandruff",
    allowedActions: ["leave_uncovered"],
    recommendationProductId: null,
  })
  const plan = buildStage3RecomputeIntents({
    evaluations: [deferred],
    reviewBundles: [reviewBundle(deferred, [], "shampoo_dandruff")],
    routine: routine(
      [
        routineItem({
          category: "shampoo",
          role: "shampoo_everyday",
          capturedProductId: "captured-1",
          product: {
            kind: "owned",
            capturedProductId: "captured-1",
            productId: "product-owned",
            displayName: "Shampoo",
          },
        }),
        routineItem({
          category: "shampoo",
          role: "shampoo_dandruff",
          inclusion: "excluded",
          product: { kind: "none", displayName: null },
        }),
      ],
      // Even flagged as user-excluded, the category itself stays included, so
      // the empty role can only come from Stage 3.
      { userExcluded: ["shampoo"] },
    ),
  })
  assert.equal(plan.intents[0]?.deferralReason, "no_product")
})

test("a user-excluded category with an owned product keeps it when leave_uncovered is forbidden", () => {
  // The real shape for an `ideal` owned product: `["keep_owned"]` and nothing
  // else (`authority/categories/mask.ts:316`, `categories/shampoo.ts:248`).
  // Plan decision 12: losing the manual exclusion beats blocking the recompute.
  const evaluation = knownEvaluation({
    category: "conditioner",
    role: "conditioner_rinse_out",
    capturedProductId: "captured-9",
    allowedActions: ["keep_owned"],
  })
  const plan = buildStage3RecomputeIntents({
    evaluations: [evaluation],
    reviewBundles: [reviewBundle(evaluation, [], "conditioner_rinse_out")],
    routine: routine(
      [
        routineItem({
          category: "conditioner",
          role: "conditioner_rinse_out",
          capturedProductId: "captured-9",
          inclusion: "excluded",
          product: {
            kind: "owned",
            capturedProductId: "captured-9",
            productId: "product-owned",
            displayName: "Conditioner",
          },
        }),
      ],
      { userExcluded: ["conditioner"] },
    ),
  })
  assert.deepEqual(plan, {
    intents: [
      { type: "resolve_decision", subjectKey: evaluation.subjectKey, action: "keep_owned" },
    ],
    blocked: [],
  })
})

test("a user-excluded category with a mismatching owned product falls back to acknowledging it", () => {
  const evaluation = knownEvaluation({
    category: "mask",
    role: "intensive_conditioning_mask",
    capturedProductId: "captured-9",
    allowedActions: ["acknowledge_override"],
    verdict: "mismatch",
  })
  const plan = buildStage3RecomputeIntents({
    evaluations: [evaluation],
    reviewBundles: [reviewBundle(evaluation, [], "intensive_conditioning_mask")],
    routine: routine(
      [
        routineItem({
          category: "mask",
          role: "intensive_conditioning_mask",
          capturedProductId: "captured-9",
          inclusion: "excluded",
          product: {
            kind: "owned",
            capturedProductId: "captured-9",
            productId: "product-owned",
            displayName: "Maske",
          },
        }),
      ],
      { userExcluded: ["mask"] },
    ),
  })
  assert.deepEqual(plan.intents, [
    {
      type: "resolve_decision",
      subjectKey: evaluation.subjectKey,
      action: "acknowledge_override",
    },
  ])
})

test("a user-excluded category with a supportive owned product stays uncovered", () => {
  // `supportive` is the verdict that does allow `leave_uncovered`
  // (`categories/shampoo.ts:251`), so the person's exclusion survives.
  const evaluation = knownEvaluation({
    category: "conditioner",
    role: "conditioner_rinse_out",
    capturedProductId: "captured-9",
    allowedActions: ["keep_owned", "leave_uncovered"],
    verdict: "supportive",
  })
  const plan = buildStage3RecomputeIntents({
    evaluations: [evaluation],
    reviewBundles: [reviewBundle(evaluation, [], "conditioner_rinse_out")],
    routine: routine(
      [
        routineItem({
          category: "conditioner",
          role: "conditioner_rinse_out",
          capturedProductId: "captured-9",
          inclusion: "excluded",
          product: {
            kind: "owned",
            capturedProductId: "captured-9",
            productId: "product-owned",
            displayName: "Conditioner",
          },
        }),
      ],
      { userExcluded: ["conditioner"] },
    ),
  })
  assert.deepEqual(plan.intents, [
    { type: "resolve_decision", subjectKey: evaluation.subjectKey, action: "leave_uncovered" },
  ])
})

test("a user-excluded pending product is kept pending when leave_uncovered is forbidden", () => {
  const subjectKey = decisionKey("mask", "intensive_conditioning_mask", "captured-3")
  const evaluation: Stage3AuthorityEvaluation = {
    status: "pending",
    category: "mask",
    subjectKey,
    reason: "product_intake_pending",
    allowedActions: ["keep_pending"],
    coverageRuleIds: [],
  }
  const plan = buildStage3RecomputeIntents({
    evaluations: [evaluation],
    reviewBundles: [reviewBundle(evaluation, [], "intensive_conditioning_mask")],
    routine: routine(
      [
        routineItem({
          category: "mask",
          role: "intensive_conditioning_mask",
          capturedProductId: "captured-3",
          inclusion: "excluded",
          product: { kind: "pending_review", submissionId: "submission-1", displayName: "Maske" },
        }),
      ],
      { userExcluded: ["mask"] },
    ),
  })
  assert.deepEqual(plan.intents, [{ type: "resolve_decision", subjectKey, action: "keep_pending" }])
})

test("a new role without a buyable recommendation is a product gap", () => {
  const evaluation = knownEvaluation({
    category: "leave_in",
    role: "post_wash_leave_in",
    allowedActions: ["leave_uncovered"],
    recommendationProductId: null,
  })
  const plan = buildStage3RecomputeIntents({
    evaluations: [evaluation],
    reviewBundles: [reviewBundle(evaluation, [], "post_wash_leave_in")],
    routine: routine([]),
  })
  assert.deepEqual(plan.intents, [
    {
      type: "resolve_decision",
      subjectKey: evaluation.subjectKey,
      action: "leave_uncovered",
      deferralReason: "no_product",
    },
  ])
})

test("a new role with an unseen buyable recommendation defers instead of planning it", () => {
  const evaluation = knownEvaluation({
    category: "leave_in",
    role: "post_wash_leave_in",
    allowedActions: ["plan_recommendation", "leave_uncovered"],
    recommendationProductId: "product-unseen",
  })
  const plan = buildStage3RecomputeIntents({
    evaluations: [evaluation],
    reviewBundles: [reviewBundle(evaluation, [], "post_wash_leave_in")],
    routine: routine([]),
  })
  assert.deepEqual(plan.intents, [
    {
      type: "resolve_decision",
      subjectKey: evaluation.subjectKey,
      action: "leave_uncovered",
      deferralReason: "unseen_recommendation",
    },
  ])
})

test("a new role whose recommendation has no fact fingerprint is a product gap", () => {
  const evaluation = knownEvaluation({
    category: "leave_in",
    role: "post_wash_leave_in",
    allowedActions: ["plan_recommendation", "leave_uncovered"],
    recommendationProductId: "product-unseen",
    recommendationFactFingerprint: null,
  })
  const plan = buildStage3RecomputeIntents({
    evaluations: [evaluation],
    reviewBundles: [reviewBundle(evaluation, [], "post_wash_leave_in")],
    routine: routine([]),
  })
  assert.equal(plan.intents[0]?.deferralReason, "no_product")
})

test("an unsupported evaluation yields a blocked marker and no intent", () => {
  const subjectKey = decisionKey("bondbuilder", "specialized_bond_treatment", null)
  const plan = buildStage3RecomputeIntents({
    evaluations: [
      {
        status: "unsupported",
        category: "bondbuilder",
        subjectKey,
        reason: "category_authority_unavailable",
        allowedActions: [],
        coverageRuleIds: [],
      },
    ],
    reviewBundles: [],
    routine: routine([]),
  })
  assert.deepEqual(plan, { intents: [], blocked: [{ subjectKey, blocked: "unsupported" }] })
})

test("a role present in the routine but absent from the evaluations produces no intent", () => {
  const plan = buildStage3RecomputeIntents({
    evaluations: [],
    reviewBundles: [],
    routine: routine([
      routineItem({
        category: "shampoo",
        role: "shampoo_everyday",
        capturedProductId: "captured-1",
        product: {
          kind: "owned",
          capturedProductId: "captured-1",
          productId: "product-owned",
          displayName: "Shampoo",
        },
      }),
    ]),
  })
  assert.deepEqual(plan, { intents: [], blocked: [] })
})

test("keep_owned falls back to acknowledge_override when the verdict turned into a mismatch", () => {
  const evaluation = knownEvaluation({
    category: "shampoo",
    role: "shampoo_everyday",
    capturedProductId: "captured-1",
    allowedActions: ["acknowledge_override", "plan_recommendation", "leave_uncovered"],
    recommendationProductId: "product-recommended",
    verdict: "mismatch",
  })
  const plan = buildStage3RecomputeIntents({
    evaluations: [evaluation],
    reviewBundles: [reviewBundle(evaluation, [], "shampoo_everyday")],
    routine: routine([
      routineItem({
        category: "shampoo",
        role: "shampoo_everyday",
        capturedProductId: "captured-1",
        product: {
          kind: "owned",
          capturedProductId: "captured-1",
          productId: "product-owned",
          displayName: "Shampoo",
        },
      }),
    ]),
  })
  assert.deepEqual(plan.intents, [
    {
      type: "resolve_decision",
      subjectKey: evaluation.subjectKey,
      action: "acknowledge_override",
    },
  ])
})

test("acknowledge_override falls back to keep_owned when the mismatch is gone", () => {
  const evaluation = knownEvaluation({
    category: "shampoo",
    role: "shampoo_everyday",
    capturedProductId: "captured-1",
    allowedActions: ["keep_owned", "leave_uncovered"],
  })
  const plan = buildStage3RecomputeIntents({
    evaluations: [evaluation],
    reviewBundles: [reviewBundle(evaluation, [], "shampoo_everyday")],
    routine: routine([
      routineItem({
        category: "shampoo",
        role: "shampoo_everyday",
        capturedProductId: "captured-1",
        fitDecision: "informed_override",
        product: {
          kind: "owned",
          capturedProductId: "captured-1",
          productId: "product-owned",
          displayName: "Shampoo",
        },
      }),
    ]),
  })
  assert.deepEqual(plan.intents, [
    { type: "resolve_decision", subjectKey: evaluation.subjectKey, action: "keep_owned" },
  ])
})

test("an owned product the new authority cannot judge ends at leave_uncovered", () => {
  const subjectKey = decisionKey("shampoo", "shampoo_everyday", "captured-1")
  const evaluation: Stage3AuthorityEvaluation = {
    status: "unknown",
    category: "shampoo",
    subjectKey,
    missingFacts: ["spec.thickness"],
    criteria: [],
    allowedActions: ["leave_uncovered"],
    coverageRuleIds: [],
  }
  const plan = buildStage3RecomputeIntents({
    evaluations: [evaluation],
    reviewBundles: [reviewBundle(evaluation, [], "shampoo_everyday")],
    routine: routine([
      routineItem({
        category: "shampoo",
        role: "shampoo_everyday",
        capturedProductId: "captured-1",
        product: {
          kind: "owned",
          capturedProductId: "captured-1",
          productId: "product-owned",
          displayName: "Shampoo",
        },
      }),
    ]),
  })
  assert.deepEqual(plan.intents, [
    { type: "resolve_decision", subjectKey, action: "leave_uncovered" },
  ])
})

test("a subject that allows no action at all is blocked rather than forced", () => {
  const evaluation = knownEvaluation({
    category: "shampoo",
    role: "shampoo_everyday",
    capturedProductId: "captured-1",
    allowedActions: [],
  })
  const plan = buildStage3RecomputeIntents({
    evaluations: [evaluation],
    reviewBundles: [reviewBundle(evaluation, [], "shampoo_everyday")],
    routine: routine([
      routineItem({
        category: "shampoo",
        role: "shampoo_everyday",
        capturedProductId: "captured-1",
        product: {
          kind: "owned",
          capturedProductId: "captured-1",
          productId: "product-owned",
          displayName: "Shampoo",
        },
      }),
    ]),
  })
  assert.deepEqual(plan, {
    intents: [],
    blocked: [{ subjectKey: evaluation.subjectKey, blocked: "no_allowed_action" }],
  })
})

test("an owned product the rehydrated draft never captured is blocked, not dropped", () => {
  // The acquire/scan path flips a PLANNED routine item to `owned`
  // (`routine/source-reconciler.ts:40-59`, `scan/saved-state.ts:200`) without
  // ever writing a capture into the routine's immutable source draft, so
  // rehydration has nothing to copy: the subject comes back as the same
  // uncovered-role key (`…:null`) whose evaluation carries no product facts.
  // Walking KEEP_OWNED_CHAIN would end at `leave_uncovered` — the person's own
  // product would vanish from the plan while the recompute reported `applied`.
  const evaluation = knownEvaluation({
    category: "shampoo",
    role: "shampoo_everyday",
    allowedActions: ["plan_recommendation", "leave_uncovered"],
    recommendationProductId: "product-recommended",
  })
  assert.equal(evaluation.productFactFingerprint, null)
  const plan = buildStage3RecomputeIntents({
    evaluations: [evaluation],
    reviewBundles: [reviewBundle(evaluation, [], "shampoo_everyday")],
    routine: routine([
      routineItem({
        category: "shampoo",
        role: "shampoo_everyday",
        // The item still points at the uncovered-role decision key it was
        // planned under; only its product turned into an owned one.
        capturedProductId: null,
        product: {
          kind: "owned",
          capturedProductId: "acquired:user-product-1",
          productId: "product-recommended",
          displayName: "Shampoo",
        },
      }),
    ]),
  })
  assert.deepEqual(plan, {
    intents: [],
    blocked: [{ subjectKey: evaluation.subjectKey, blocked: "owned_capture_missing" }],
  })
})

test("a pending product the rehydrated draft never captured is blocked, not dropped", () => {
  const evaluation = knownEvaluation({
    category: "mask",
    role: "intensive_conditioning_mask",
    allowedActions: ["plan_recommendation", "leave_uncovered"],
    recommendationProductId: "product-recommended",
  })
  const plan = buildStage3RecomputeIntents({
    evaluations: [evaluation],
    reviewBundles: [reviewBundle(evaluation, [], "intensive_conditioning_mask")],
    routine: routine([
      routineItem({
        category: "mask",
        role: "intensive_conditioning_mask",
        capturedProductId: null,
        product: { kind: "pending_review", submissionId: "submission-1", displayName: "Maske" },
      }),
    ]),
  })
  assert.deepEqual(plan, {
    intents: [],
    blocked: [{ subjectKey: evaluation.subjectKey, blocked: "owned_capture_missing" }],
  })
})

test("the same input twice produces the same plan", () => {
  const owned = knownEvaluation({
    category: "shampoo",
    role: "shampoo_everyday",
    capturedProductId: "captured-1",
    allowedActions: ["keep_owned", "leave_uncovered"],
  })
  const planned = knownEvaluation({
    category: "conditioner",
    role: "conditioner_rinse_out",
    allowedActions: ["plan_recommendation", "leave_uncovered"],
    recommendationProductId: "product-new-primary",
  })
  const newRole = knownEvaluation({
    category: "leave_in",
    role: "post_wash_leave_in",
    allowedActions: ["plan_recommendation", "leave_uncovered"],
    recommendationProductId: "product-unseen",
  })
  const input = {
    evaluations: [owned, planned, newRole],
    reviewBundles: [
      reviewBundle(owned, [], "shampoo_everyday"),
      reviewBundle(
        planned,
        [candidate("product-planned", "conditioner", "conditioner_rinse_out")],
        "conditioner_rinse_out",
      ),
      reviewBundle(newRole, [], "post_wash_leave_in"),
    ],
    routine: routine([
      routineItem({
        category: "shampoo",
        role: "shampoo_everyday",
        capturedProductId: "captured-1",
        product: {
          kind: "owned",
          capturedProductId: "captured-1",
          productId: "product-owned",
          displayName: "Shampoo",
        },
      }),
      routineItem({
        category: "conditioner",
        role: "conditioner_rinse_out",
        product: {
          kind: "planned",
          plannedPurchaseId: "planned-1",
          productId: "product-planned",
          displayName: "Conditioner",
        },
      }),
    ]),
  }
  const first = buildStage3RecomputeIntents(input)
  const second = buildStage3RecomputeIntents(input)
  assert.deepEqual(first, second)
  assert.deepEqual(
    first.intents.map((intent) => intent.action),
    ["keep_owned", "select_replacement", "leave_uncovered"],
  )
})
