import assert from "node:assert/strict"
import test from "node:test"

import { createStage3IntakeRouteHandlers } from "../src/app/api/personal-plan/stage-3/intake/route"

const stage3Access = {
  kind: "personal_plan" as const,
  personalPlanId: "55555555-5555-4555-8555-555555555555",
  frontier: "stage3" as const,
  nextHref: "/plan-start" as const,
  allowed: { stage1: true, stage2: true, stage3: true, stage4: false, stage5: false },
}

const userId = "11111111-1111-4111-8111-111111111111"
const key = "22222222-2222-4222-8222-222222222222"
const submissionId = "33333333-3333-4333-8333-333333333333"
const draftId = "44444444-4444-4444-8444-444444444444"
const draft = {
  schemaVersion: 1 as const,
  status: "active" as const,
  authorityVersions: {},
  draftId,
  userId,
  personalPlanId: "55555555-5555-4555-8555-555555555555",
  refinedVersionId: "66666666-6666-4666-8666-666666666666",
  staleRefinedVersionId: null,
  revision: 1,
  pass: "product_capture" as const,
  orderedCategories: ["mask" as const],
  categoryCursor: "mask",
  products: [],
  roleAssignments: [],
  uncoveredRoles: [],
  decisions: [],
  completedCaptureCategories: [],
  completedDecisionKeys: [],
  createdAt: "2026-08-08T00:00:00.000Z",
  updatedAt: "2026-08-08T00:00:00.000Z",
}

function repository(calls: string[]) {
  return {
    createSubmissionForUserProduct: async () => ({
      userProduct: {
        id: key,
        user_id: userId,
        category: "mask",
        catalog_product_id: null,
        brand_text: "Marke",
        product_name_text: "Maske",
        identity_status: "pending_review",
        ownership_status: "owned",
      },
      submission: {
        id: submissionId,
        user_id: userId,
        user_product_usage_id: null,
        user_product_id: key,
        source: "personal_plan",
        source_conversation_id: null,
        intake_method: "manual",
        category: "mask",
        brand_text: "Marke",
        product_name_text: "Maske",
        frequency_range: "weekly_1x",
        front_image_path: null,
        barcode_image_path: null,
        front_image_validation_status: null,
        front_image_validation_metadata: {},
        barcode_image_validation_status: null,
        barcode_image_validation_metadata: {},
        previous_product_id: null,
        previous_product_snapshot: {},
        status: "pending_review",
        researched_payload: {},
        intake_history: [],
        approved_product_id: null,
      },
      replayed: false,
    }),
    updateProductSubmission: async (id: string) => ({
      id,
      user_id: userId,
      user_product_usage_id: null,
      user_product_id: key,
      source: "personal_plan",
      source_conversation_id: null,
      intake_method: "manual",
      category: "mask",
      brand_text: "Marke",
      product_name_text: "Maske",
      frequency_range: "weekly_1x",
      front_image_path: null,
      barcode_image_path: null,
      front_image_validation_status: null,
      front_image_validation_metadata: {},
      barcode_image_validation_status: null,
      barcode_image_validation_metadata: {},
      previous_product_id: null,
      previous_product_snapshot: {},
      status: "pending_review",
      researched_payload: {},
      intake_history: [],
      approved_product_id: null,
    }),
    cancelSubmissionForUserProduct: async () => {
      calls.push("cancel")
      if (calls.includes("fail-cancel")) throw new Error("transport")
      return {}
    },
  } as never
}

test("Stage 3 intake rolls back a definite gateway conflict and tells the client to rotate its key", async () => {
  const calls: string[] = []
  const handlers = createStage3IntakeRouteHandlers({
    enabled: () => true,
    getUserId: async () => userId,
    loadJourneyAccess: async () => stage3Access,
    checkRateLimit: async () => ({ allowed: true }),
    repository: () => repository(calls),
    persistence: () =>
      ({
        loadDraft: async () => draft,
        loadRequirements: async () => [],
        save: async () => ({ outcome: "revision_conflict", draft }),
      }) as never,
  })
  const response = await handlers.POST(
    new Request("http://test", {
      method: "POST",
      headers: { "Idempotency-Key": key },
      body: JSON.stringify({
        draftId,
        expectedRevision: 1,
        input: {
          intake_method: "manual",
          brand_text: "Marke",
          product_name_text: "Maske",
          frequency_range: "weekly_1x",
        },
      }),
    }),
  )
  assert.deepEqual(
    [response.status, await response.json(), calls],
    [409, { error: "rolled_back", latestDraft: draft, rotateIdempotencyKey: true }, ["cancel"]],
  )
})

test("Stage 3 intake exposes failed compensation as same-key retryable work", async () => {
  const calls = ["fail-cancel"]
  const handlers = createStage3IntakeRouteHandlers({
    enabled: () => true,
    getUserId: async () => userId,
    loadJourneyAccess: async () => stage3Access,
    checkRateLimit: async () => ({ allowed: true }),
    repository: () => repository(calls),
    persistence: () =>
      ({
        loadDraft: async () => draft,
        loadRequirements: async () => [],
        save: async () => ({ outcome: "revision_conflict", draft }),
      }) as never,
  })
  const response = await handlers.POST(
    new Request("http://test", {
      method: "POST",
      body: JSON.stringify({
        draftId,
        expectedRevision: 1,
        idempotencyKey: key,
        input: {
          intake_method: "manual",
          brand_text: "Marke",
          product_name_text: "Maske",
          frequency_range: "weekly_1x",
        },
      }),
    }),
  )
  assert.deepEqual(
    [response.status, await response.json()],
    [503, { error: "compensation_pending", retryable: true, idempotencyKey: key }],
  )
})

test("Stage 3 intake treats a lost mutation response as a replay when the latest draft has the exact submission", async () => {
  const calls: string[] = []
  const latest = {
    ...draft,
    revision: 2,
    products: [
      {
        capturedProductId: key,
        userProductId: key,
        identity: {
          kind: "pending_submission" as const,
          submissionId,
          displayName: "Maske",
          category: "mask" as const,
          reviewStatus: "pending_review" as const,
        },
        frequencyRange: "weekly_1x" as const,
        ownership: "owned" as const,
        source: "intake_fallback" as const,
      },
    ],
  }
  let loads = 0
  const handlers = createStage3IntakeRouteHandlers({
    enabled: () => true,
    getUserId: async () => userId,
    loadJourneyAccess: async () => stage3Access,
    checkRateLimit: async () => ({ allowed: true }),
    repository: () => repository(calls),
    persistence: () =>
      ({
        loadDraft: async () => (++loads === 1 ? draft : latest),
        loadRequirements: async () => [],
        save: async () => ({ outcome: "revision_conflict", draft: latest }),
      }) as never,
  })
  const response = await handlers.POST(
    new Request("http://test", {
      method: "POST",
      body: JSON.stringify({
        draftId,
        expectedRevision: 1,
        idempotencyKey: key,
        input: {
          intake_method: "manual",
          brand_text: "Marke",
          product_name_text: "Maske",
          frequency_range: "weekly_1x",
        },
      }),
    }),
  )
  assert.equal(response.status, 200)
  assert.equal(calls.includes("cancel"), false)
})
