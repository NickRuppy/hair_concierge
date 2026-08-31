import assert from "node:assert/strict"
import test from "node:test"

import {
  createStage3OptionalEntryRouteHandler,
  type Stage3OptionalEntryRouteDeps,
} from "../src/app/api/personal-plan/stage-3/optional-entry/route"
import { Stage3AuthoritySnapshotError } from "../src/lib/personal-plan/products/authority/snapshot"
import type { Stage3DraftResponse } from "../src/lib/personal-plan/products/gateway"

const stage3Access = {
  kind: "personal_plan",
  frontier: "stage3",
  allowed: {
    stage1: true,
    stage2: true,
    stage3: true,
    stage4: false,
    stage5: false,
  },
  nextHref: "/plan-start",
  personalPlanId: "11111111-1111-4111-8111-111111111111",
} as const

const draftResponse: Stage3DraftResponse = {
  status: "active",
  requirements: [
    {
      category: "shampoo",
      requiredRoles: ["shampoo_everyday"],
      needSummary: "Basisreinigung",
      authorityVersion: "shampoo-v1",
    },
  ],
  draft: {
    schemaVersion: 1,
    status: "active",
    authorityVersions: { shampoo: "shampoo-v1" },
    draftId: "22222222-2222-4222-8222-222222222222",
    userId: "owner-1",
    personalPlanId: "11111111-1111-4111-8111-111111111111",
    refinedVersionId: "33333333-3333-4333-8333-333333333333",
    staleRefinedVersionId: null,
    revision: 0,
    pass: "product_capture",
    orderedCategories: ["shampoo"],
    categoryCursor: "shampoo",
    products: [],
    roleAssignments: [],
    uncoveredRoles: [],
    decisions: [],
    completedCaptureCategories: [],
    completedDecisionKeys: [],
    createdAt: "2026-08-28T00:00:00.000Z",
    updatedAt: "2026-08-28T00:00:00.000Z",
  },
}

function deps(overrides: Partial<Stage3OptionalEntryRouteDeps> = {}): Stage3OptionalEntryRouteDeps {
  return {
    enabled: () => true,
    getUserId: async () => "owner-1",
    loadJourneyAccess: async () => stage3Access,
    checkRateLimit: async () => ({ allowed: true }),
    openOptionalInventory: async () => draftResponse,
    ...overrides,
  }
}

function request(body: unknown) {
  return new Request("http://test/api/personal-plan/stage-3/optional-entry", {
    method: "POST",
    body: JSON.stringify(body),
  })
}

test("optional Stage 3 entry preserves app/auth/stage/rate gates before opening inventory", async () => {
  let response = await createStage3OptionalEntryRouteHandler(deps({ enabled: () => false }))(
    request({
      personalPlanId: "11111111-1111-4111-8111-111111111111",
      refinedVersionId: "33333333-3333-4333-8333-333333333333",
    }),
  )
  assert.deepEqual(
    [response.status, await response.json()],
    [404, { error: "personal_plan_not_available" }],
  )
  assert.equal(response.headers.get("Cache-Control"), "no-store")

  response = await createStage3OptionalEntryRouteHandler(deps({ getUserId: async () => null }))(
    request({
      personalPlanId: "11111111-1111-4111-8111-111111111111",
      refinedVersionId: "33333333-3333-4333-8333-333333333333",
    }),
  )
  assert.deepEqual([response.status, await response.json()], [401, { error: "unauthorized" }])

  let opens = 0
  response = await createStage3OptionalEntryRouteHandler(
    deps({
      loadJourneyAccess: async () => ({
        ...stage3Access,
        allowed: { ...stage3Access.allowed, stage3: false },
      }),
      openOptionalInventory: async () => {
        opens += 1
        return draftResponse
      },
    }),
  )(
    request({
      personalPlanId: "11111111-1111-4111-8111-111111111111",
      refinedVersionId: "33333333-3333-4333-8333-333333333333",
    }),
  )
  assert.deepEqual([response.status, await response.json()], [409, { error: "stage_not_ready" }])
  assert.equal(opens, 0)

  response = await createStage3OptionalEntryRouteHandler(
    deps({ checkRateLimit: async () => ({ allowed: false }) }),
  )(
    request({
      personalPlanId: "11111111-1111-4111-8111-111111111111",
      refinedVersionId: "33333333-3333-4333-8333-333333333333",
    }),
  )
  assert.deepEqual([response.status, await response.json()], [429, { error: "rate_limited" }])
  assert.match(response.headers.get("Retry-After") ?? "", /^\d+$/)
})

test("optional Stage 3 entry accepts only plan/refined ids and derives the owner server-side", async () => {
  const calls: unknown[] = []
  const handler = createStage3OptionalEntryRouteHandler(
    deps({
      openOptionalInventory: async (input) => {
        calls.push(input)
        return draftResponse
      },
    }),
  )

  let response = await handler(
    request({
      personalPlanId: "11111111-1111-4111-8111-111111111111",
      refinedVersionId: "33333333-3333-4333-8333-333333333333",
      userId: "forged",
    }),
  )
  assert.deepEqual([response.status, await response.json()], [400, { error: "invalid_request" }])

  response = await handler(
    request({
      personalPlanId: "11111111-1111-4111-8111-111111111111",
      refinedVersionId: "33333333-3333-4333-8333-333333333333",
    }),
  )
  assert.equal(response.status, 200)
  assert.match(response.headers.get("Server-Timing") ?? "", /operation;dur=/)
  assert.deepEqual(calls, [
    {
      userId: "owner-1",
      personalPlanId: "11111111-1111-4111-8111-111111111111",
      refinedVersionId: "33333333-3333-4333-8333-333333333333",
    },
  ])
  assert.deepEqual((await response.json()).requirements, draftResponse.requirements)
})

test("optional Stage 3 entry maps stale refined-source conflicts without disclosing drafts", async () => {
  const response = await createStage3OptionalEntryRouteHandler(
    deps({
      openOptionalInventory: async () => {
        throw new Stage3AuthoritySnapshotError("stale_refined_source")
      },
    }),
  )(
    request({
      personalPlanId: "11111111-1111-4111-8111-111111111111",
      refinedVersionId: "33333333-3333-4333-8333-333333333333",
    }),
  )

  assert.deepEqual(
    [response.status, await response.json()],
    [409, { error: "stale_refined_source" }],
  )
})
