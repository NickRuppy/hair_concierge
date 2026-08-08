import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import {
  createStage3RouteHandlers,
  type Stage3RouteDeps,
} from "../src/app/api/personal-plan/stage-3/route"

const draft = {
  schemaVersion: 1 as const,
  status: "active" as const,
  authorityVersions: {},
  draftId: "11111111-1111-4111-8111-111111111111",
  userId: "owner-1",
  personalPlanId: "22222222-2222-4222-8222-222222222222",
  refinedVersionId: "33333333-3333-4333-8333-333333333333",
  staleRefinedVersionId: null,
  revision: 2,
  pass: "product_capture" as const,
  orderedCategories: ["shampoo" as const],
  categoryCursor: "shampoo",
  products: [],
  roleAssignments: [],
  uncoveredRoles: [],
  decisions: [],
  completedCaptureCategories: [],
  completedDecisionKeys: [],
  createdAt: "2026-08-08T00:00:00.000Z",
  updatedAt: "2026-08-08T00:00:00.000Z",
}
const requirements = [
  {
    category: "shampoo" as const,
    requiredRoles: ["shampoo_everyday" as const],
    needSummary: "Reinigung",
    authorityVersion: "personal-plan.shampoo.v1",
  },
]

function deps(overrides: Partial<Stage3RouteDeps> = {}): Stage3RouteDeps {
  return {
    enabled: () => true,
    getUserId: async () => "owner-1",
    checkRateLimit: async () => ({ allowed: true }),
    gatewayFor: (userId) => ({
      loadOrCreate: async (input) => ({
        status: "active",
        draft: {
          ...draft,
          userId,
          personalPlanId: input.personalPlanId,
          refinedVersionId: input.refinedVersionId,
        },
        requirements,
      }),
      mutate: async () => ({ status: "saved", draft }),
      search: async () => ({
        status: "ready",
        requestToken: 1,
        result: { query: "ab", category: "shampoo", candidates: [], totalCapped: false },
      }),
      invalidateForRefinedVersion: async () => ({ status: "active", draft, requirements }),
      complete: async () => {
        throw new Error("not used")
      },
    }),
    ...overrides,
  }
}

test("Stage 3 main boundary preserves flag, auth, validation and per-owner rate-limit outcomes", async () => {
  const url = `http://test/api/personal-plan/stage-3?personalPlanId=${draft.personalPlanId}&refinedVersionId=${draft.refinedVersionId}`
  let response = await createStage3RouteHandlers(deps({ enabled: () => false })).GET(
    new Request(url),
  )
  assert.deepEqual(
    [response!.status, await response!.json()],
    [404, { error: "personal_plan_not_available" }],
  )
  response = await createStage3RouteHandlers(deps({ getUserId: async () => null })).GET(
    new Request(url),
  )
  assert.deepEqual([response!.status, await response!.json()], [401, { error: "unauthorized" }])
  response = await createStage3RouteHandlers(deps()).GET(
    new Request("http://test/api/personal-plan/stage-3"),
  )
  assert.deepEqual([response!.status, await response!.json()], [400, { error: "invalid_request" }])
  response = await createStage3RouteHandlers(
    deps({
      checkRateLimit: async (id) => {
        assert.equal(id, "owner-1")
        return { allowed: false }
      },
    }),
  ).PATCH(
    new Request(url, {
      method: "PATCH",
      body: JSON.stringify({
        draftId: draft.draftId,
        expectedRevision: 2,
        mutation: { type: "remove_captured_product", capturedProductId: "x" },
      }),
    }),
  )
  assert.equal(response!.status, 429)
  assert.equal(response!.headers.get("Retry-After"), "60")
})

test("Stage 3 main boundary derives owner server-side and maps conflicts", async () => {
  let owner = ""
  const handlers = createStage3RouteHandlers(
    deps({
      gatewayFor: (userId) => {
        owner = userId
        return {
          ...deps().gatewayFor(userId),
          mutate: async () => ({ status: "conflict", latestDraft: draft }),
        }
      },
    }),
  )
  const response = await handlers.PATCH(
    new Request("http://test/api/personal-plan/stage-3", {
      method: "PATCH",
      body: JSON.stringify({
        draftId: draft.draftId,
        expectedRevision: 2,
        mutation: { type: "remove_captured_product", capturedProductId: "x" },
      }),
    }),
  )
  assert.equal(owner, "owner-1")
  assert.deepEqual(
    [response!.status, await response!.json()],
    [409, { error: "revision_conflict", latestDraft: draft }],
  )
})

test("Stage 3 GET is not mutation-rate-limited and PATCH rejects forged/server-only payloads", async () => {
  let rateChecks = 0
  const handlers = createStage3RouteHandlers(
    deps({
      checkRateLimit: async () => {
        rateChecks += 1
        return { allowed: true }
      },
    }),
  )
  const url = `http://test/api/personal-plan/stage-3?personalPlanId=${draft.personalPlanId}&refinedVersionId=${draft.refinedVersionId}`
  let response = await handlers.GET(new Request(url))
  assert.equal(response!.status, 200)
  assert.equal(rateChecks, 0)

  response = await handlers.PATCH(
    new Request(url, {
      method: "PATCH",
      body: JSON.stringify({
        draftId: draft.draftId,
        expectedRevision: 2,
        mutation: {
          type: "capture_pending_submission",
          userProductId: "forged",
          submissionId: "forged",
          displayName: "forged",
          category: "shampoo",
          reviewStatus: "pending_review",
          frequencyRange: "weekly_1x",
        },
      }),
    }),
  )
  assert.deepEqual([response!.status, await response!.json()], [400, { error: "invalid_request" }])
  assert.equal(rateChecks, 1)
})

test("Stage 3 GET exposes the authoritative refined requirements", async () => {
  const url = `http://test/api/personal-plan/stage-3?personalPlanId=${draft.personalPlanId}&refinedVersionId=${draft.refinedVersionId}`
  const response = await createStage3RouteHandlers(deps()).GET(new Request(url))
  const body = await response!.json()
  assert.deepEqual(body.requirements, requirements)
})

test("production Stage 3 completion composes the deterministic compiler and one-RPC stager", async () => {
  const source = await readFile(
    new URL("../src/app/api/personal-plan/stage-3/complete/route.ts", import.meta.url),
    "utf8",
  )
  assert.match(source, /compiler:\s*createInitialRoutineCandidateCompiler\(\)/)
  assert.match(source, /stager:\s*createRoutineProposalStagerRpcAdapter\(\{\s*client:/)
})
