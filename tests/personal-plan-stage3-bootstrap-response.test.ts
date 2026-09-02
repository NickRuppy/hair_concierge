import assert from "node:assert/strict"
import test from "node:test"

import { CATEGORY_ROLE_POLICIES } from "../src/lib/personal-plan/products/authorities"
import {
  stage3DecisionKey,
  stage3ProductDraftSchema,
} from "../src/lib/personal-plan/products/contracts"
import {
  parseStage3BootstrapResponse,
  Stage3BootstrapContractError,
} from "../src/lib/personal-plan/products/bootstrap-response"
import type { Stage3BootstrapResponse } from "../src/lib/personal-plan/products/gateway"
import {
  hasCompleteStage3DecisionReviews,
  stage3ReviewDecisionSubjects,
} from "../src/lib/personal-plan/products/stage3-bootstrap-review-contract"

const personalPlanId = "11111111-1111-4111-8111-111111111111"
const refinedVersionId = "33333333-3333-4333-8333-333333333333"

function validBootstrapResponse(): Stage3BootstrapResponse {
  const requirement = {
    category: "shampoo" as const,
    requiredRoles: ["shampoo_everyday" as const],
    needSummary: "Basisreinigung",
    authorityVersion: CATEGORY_ROLE_POLICIES.shampoo.authorityVersion,
  }
  return {
    status: "active" as const,
    requirements: [requirement],
    authorityEvaluations: [],
    fitComparisons: [],
    draft: {
      schemaVersion: 1 as const,
      status: "active" as const,
      authorityVersions: { shampoo: CATEGORY_ROLE_POLICIES.shampoo.authorityVersion },
      draftId: "22222222-2222-4222-8222-222222222222",
      userId: "owner-1",
      personalPlanId,
      refinedVersionId,
      staleRefinedVersionId: null,
      revision: 0,
      pass: "product_capture" as const,
      orderedCategories: ["shampoo" as const],
      categoryCursor: "shampoo",
      products: [],
      roleAssignments: [],
      uncoveredRoles: [],
      decisions: [],
      completedCaptureCategories: [],
      completedDecisionKeys: [],
      createdAt: "2026-09-01T10:00:00.000Z",
      updatedAt: "2026-09-01T10:00:00.000Z",
      authoritySnapshot: {
        schemaVersion: 1 as const,
        refinedNeedVersionId: refinedVersionId,
        refinedInputHash: "fixture-input-hash",
        categoryDecisions: [],
        coverage: [],
        orderedCategories: ["shampoo" as const],
        inventoryOnlyCategories: [],
        authorityVersions: Object.fromEntries(
          Object.entries(CATEGORY_ROLE_POLICIES).map(([category, policy]) => [
            category,
            policy.authorityVersion,
          ]),
        ) as Record<keyof typeof CATEGORY_ROLE_POLICIES, string>,
      },
    },
  }
}

function decisionReadyBootstrapResponse(): Stage3BootstrapResponse {
  const response = validBootstrapResponse()
  const subjectKey = stage3DecisionKey("shampoo", "shampoo_everyday", null)
  response.draft.pass = "product_decisions"
  response.draft.uncoveredRoles = [
    { category: "shampoo", role: "shampoo_everyday", reason: "no_product_owned" },
  ]
  response.authorityEvaluations = [
    { subjectKey } as Stage3BootstrapResponse["authorityEvaluations"][number],
  ]
  response.fitComparisons = [{ subjectKey } as Stage3BootstrapResponse["fitComparisons"][number]]
  return response
}

test("Stage 3 bootstrap parser accepts the canonical transport envelope", () => {
  const response = validBootstrapResponse()
  const draft = stage3ProductDraftSchema.safeParse(response.draft)
  assert.equal(draft.success, true, draft.error?.message)
  assert.deepEqual(
    parseStage3BootstrapResponse(response, { personalPlanId, refinedVersionId }),
    response,
  )
})

for (const [field, violation] of [
  ["authorityEvaluations", "missing_authority_evaluations"],
  ["fitComparisons", "missing_fit_comparisons"],
] as const) {
  test(`Stage 3 bootstrap parser rejects a successful response without ${field}`, () => {
    const response = validBootstrapResponse() as Record<string, unknown>
    delete response[field]
    assert.throws(
      () => parseStage3BootstrapResponse(response, { personalPlanId, refinedVersionId }),
      (error: unknown) =>
        error instanceof Stage3BootstrapContractError && error.violation === violation,
    )
  })
}

test("Stage 3 bootstrap parser rejects response identity drift", () => {
  const response = validBootstrapResponse()
  response.draft.refinedVersionId = "44444444-4444-4444-8444-444444444444"
  assert.throws(
    () => parseStage3BootstrapResponse(response, { personalPlanId, refinedVersionId }),
    (error: unknown) =>
      error instanceof Stage3BootstrapContractError &&
      error.violation === "refined_version_mismatch",
  )
})

test("Stage 3 bootstrap parser rejects an active decision draft without a complete review bundle", () => {
  const response = decisionReadyBootstrapResponse()
  response.fitComparisons = []

  assert.throws(
    () => parseStage3BootstrapResponse(response, { personalPlanId, refinedVersionId }),
    (error: unknown) =>
      error instanceof Stage3BootstrapContractError &&
      error.violation === "incomplete_decision_reviews",
  )
})

test("Stage 3 bootstrap parser rejects duplicate or misaligned decision review subjects", () => {
  const duplicate = decisionReadyBootstrapResponse()
  duplicate.authorityEvaluations = [
    duplicate.authorityEvaluations[0]!,
    duplicate.authorityEvaluations[0]!,
  ]
  const misaligned = decisionReadyBootstrapResponse()
  misaligned.fitComparisons = [
    {
      subjectKey: "decision:shampoo:shampoo_clarifying:none",
    } as Stage3BootstrapResponse["fitComparisons"][number],
  ]

  for (const response of [duplicate, misaligned]) {
    assert.throws(
      () => parseStage3BootstrapResponse(response, { personalPlanId, refinedVersionId }),
      (error: unknown) =>
        error instanceof Stage3BootstrapContractError &&
        error.violation === "incomplete_decision_reviews",
    )
  }
})

test("Stage 3 bootstrap review completeness excludes inventory dispositions", () => {
  const response = decisionReadyBootstrapResponse()
  response.draft.orderedCategories.push("dry_shampoo")
  response.draft.products.push({
    capturedProductId: "capture-current-only",
    userProductId: "owned-current-only",
    identity: {
      kind: "pending_submission",
      submissionId: "submission-current-only",
      displayName: "Trockenshampoo außerhalb des Plans",
      category: "dry_shampoo",
      reviewStatus: "pending_review",
    },
    frequencyRange: "weekly_2x",
    ownership: "owned",
    source: "existing_inventory",
  })
  response.draft.inventoryDispositions = [
    {
      schemaVersion: 1,
      dispositionKey: "inventory:dry_shampoo:capture-current-only",
      capturedProductId: "capture-current-only",
      category: "dry_shampoo",
      planStatus: "not_used",
      reason: "category_not_in_final_plan",
      acknowledged: false,
      authorityFingerprint: "a".repeat(64),
    },
  ]

  assert.deepEqual(
    stage3ReviewDecisionSubjects(response.draft).map((subject) => subject.decisionKey),
    response.authorityEvaluations.map((evaluation) => evaluation.subjectKey),
  )
  assert.equal(
    hasCompleteStage3DecisionReviews({
      draft: response.draft,
      authorityEvaluations: response.authorityEvaluations,
      fitComparisons: response.fitComparisons,
    }),
    true,
  )
})
