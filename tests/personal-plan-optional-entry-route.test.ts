import assert from "node:assert/strict"
import test from "node:test"

import {
  createStage2OptionalEntryRouteHandler,
  type Stage2OptionalEntryRouteDeps,
} from "../src/app/api/personal-plan/stage-2/optional-entry/route"
import type { Stage2PersistedDraft } from "../src/lib/personal-plan/persistence/stage2-refinement-service"
import { Stage2RefinementError } from "../src/lib/personal-plan/refinement/gateway"
import type { PersonalPlanStage2Access } from "../src/lib/personal-plan/journey-access-loader"

const stage2Access: PersonalPlanStage2Access = { allowed: true }

const draft: Stage2PersistedDraft = {
  id: "draft-1",
  personalPlanId: "plan-1",
  baseInitialNeedVersionId: "initial-1",
  schemaVersion: 1,
  preparedArtifactSourceId: "lead-1",
  baseInputSnapshot: {},
  pathVersion: "stage2-v1",
  triggerContext: {
    relevantCategories: ["shampoo"],
    hasReportedIrritatedScalp: false,
    dryShampooBridgeEligibility: "ineligible",
  },
  answers: { currentProductCategories: ["shampoo"] },
  completedQuestionIds: ["current_product_categories"],
  answerProvenance: { current_product_categories: "user" },
  moduleProjections: {},
  revision: 1,
  status: "in_progress",
  refinedVersionId: null,
}

function deps(overrides: Partial<Stage2OptionalEntryRouteDeps> = {}): Stage2OptionalEntryRouteDeps {
  return {
    enabled: () => true,
    getUserId: async () => "owner-1",
    loadStage2Access: async () => stage2Access,
    openOptionalRefinement: async () => draft,
    ...overrides,
  }
}

function request(body: unknown) {
  return new Request("http://test/api/personal-plan/stage-2/optional-entry", {
    method: "POST",
    body: JSON.stringify(body),
  })
}

test("optional Stage 2 entry preserves feature/auth/stage gates before opening a draft", async () => {
  let response = await createStage2OptionalEntryRouteHandler(deps({ enabled: () => false }))(
    request({ module: "products" }),
  )
  assert.deepEqual(
    [response.status, await response.json()],
    [404, { error: "personal_plan_not_available" }],
  )
  assert.equal(response.headers.get("Cache-Control"), "no-store")

  response = await createStage2OptionalEntryRouteHandler(deps({ getUserId: async () => null }))(
    request({ module: "products" }),
  )
  assert.deepEqual([response.status, await response.json()], [401, { error: "unauthorized" }])

  let opens = 0
  response = await createStage2OptionalEntryRouteHandler(
    deps({
      loadStage2Access: async () => ({ allowed: false }),
      openOptionalRefinement: async () => {
        opens += 1
        return draft
      },
    }),
  )(request({ module: "products" }))
  assert.deepEqual([response.status, await response.json()], [409, { error: "stage_not_ready" }])
  assert.equal(opens, 0)
})

test("optional Stage 2 entry accepts only the module body and derives the user server-side", async () => {
  const calls: unknown[] = []
  const handler = createStage2OptionalEntryRouteHandler(
    deps({
      openOptionalRefinement: async (input) => {
        calls.push(input)
        return draft
      },
    }),
  )

  let response = await handler(request({ module: "products", userId: "forged" }))
  assert.deepEqual([response.status, await response.json()], [400, { error: "invalid_request" }])

  response = await handler(request({ module: "habits" }))
  assert.equal(response.status, 200)
  assert.match(response.headers.get("Server-Timing") ?? "", /operation;dur=/)
  assert.deepEqual(calls, [{ userId: "owner-1", module: "habits" }])
  assert.deepEqual((await response.json()).answers, { currentProductCategories: ["shampoo"] })
})

test("optional Stage 2 entry maps conflict, validation and temporary failures", async () => {
  for (const [code, status] of [
    ["invalid_answer", 422],
    ["revision_conflict", 409],
    ["temporarily_unavailable", 503],
  ] as const) {
    const response = await createStage2OptionalEntryRouteHandler(
      deps({
        openOptionalRefinement: async () => {
          throw new Stage2RefinementError(code)
        },
      }),
    )(request({ module: "products" }))
    assert.deepEqual([response.status, await response.json()], [status, { error: code }])
  }
})
