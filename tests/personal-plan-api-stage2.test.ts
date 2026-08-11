import assert from "node:assert/strict"
import test from "node:test"

import {
  createStage2RouteHandlers,
  type Stage2RouteDeps,
} from "../src/app/api/personal-plan/stage-2/route"
import {
  createStage2CompleteRouteHandler,
  type Stage2CompleteRouteDeps,
} from "../src/app/api/personal-plan/stage-2/complete/route"
import {
  Stage2RefinementError,
  type Stage2RefinementGateway,
} from "../src/lib/personal-plan/refinement/gateway"
import { createStage2RefinementSession } from "../src/lib/personal-plan/refinement/session"
import type { PersonalPlanStage2Access } from "../src/lib/personal-plan/journey-access-loader"

const stage2Access: PersonalPlanStage2Access = { allowed: true }

const session = createStage2RefinementSession({
  pathVersion: "stage2.refinement.v1",
  triggerContext: {
    relevantCategories: ["shampoo" as const],
    hasReportedIrritatedScalp: false,
    dryShampooBridgeEligibility: "ineligible" as const,
  },
  answers: {},
  revision: 0,
  status: "in_progress" as const,
})

function gateway(overrides: Partial<Stage2RefinementGateway> = {}): Stage2RefinementGateway {
  return {
    load: async () => session,
    saveAnswer: async () => session,
    complete: async () => ({ refinedVersionId: "refined-1", nextHref: "/plan-start" }),
    ...overrides,
  }
}

function deps(overrides: Partial<Stage2RouteDeps> = {}): Stage2RouteDeps {
  return {
    enabled: () => true,
    getUserId: async () => "owner-1",
    loadStage2Access: async () => stage2Access,
    gatewayFor: () => gateway(),
    ...overrides,
  }
}

function completeDeps(overrides: Partial<Stage2CompleteRouteDeps> = {}): Stage2CompleteRouteDeps {
  return {
    enabled: () => true,
    getUserId: async () => "owner-1",
    loadStage2Access: async () => stage2Access,
    gatewayFor: () => gateway(),
    ...overrides,
  }
}

test("Stage 2 API preserves feature/auth boundaries and no-store responses", async () => {
  let response = await createStage2RouteHandlers(deps({ enabled: () => false })).GET()
  assert.deepEqual(
    [response.status, await response.json()],
    [404, { error: "personal_plan_not_available" }],
  )
  assert.equal(response.headers.get("Cache-Control"), "no-store")

  response = await createStage2RouteHandlers(deps({ getUserId: async () => null })).GET()
  assert.deepEqual([response.status, await response.json()], [401, { error: "unauthorized" }])
})

test("Stage 2 fails closed before constructing its gateway when Stage 1 is not reached", async () => {
  let gatewayCalls = 0
  const response = await createStage2RouteHandlers(
    deps({
      loadStage2Access: async () => ({ allowed: false }),
      gatewayFor: () => {
        gatewayCalls += 1
        return gateway()
      },
    }),
  ).GET()
  assert.deepEqual([response.status, await response.json()], [409, { error: "stage_not_ready" }])
  assert.equal(gatewayCalls, 0)
})

test("Stage 2 save rejects malformed JSON and unexpected body fields before reaching the gateway", async () => {
  let saves = 0
  const handlers = createStage2RouteHandlers(
    deps({
      gatewayFor: () =>
        gateway({
          saveAnswer: async () => {
            saves += 1
            return session
          },
        }),
    }),
  )
  for (const body of [
    "{",
    JSON.stringify({
      questionId: "current_product_categories",
      answer: [],
      expectedRevision: 0,
      userId: "forged",
    }),
  ]) {
    const response = await handlers.PATCH(
      new Request("http://test/api/personal-plan/stage-2", { method: "PATCH", body }),
    )
    assert.deepEqual([response.status, await response.json()], [400, { error: "invalid_request" }])
  }
  assert.equal(saves, 0)
})

test("Stage 2 save applies release and auth boundaries before parsing caller input", async () => {
  const malformed = new Request("http://test/api/personal-plan/stage-2", {
    method: "PATCH",
    body: "{",
  })
  let response = await createStage2RouteHandlers(deps({ enabled: () => false })).PATCH(malformed)
  assert.deepEqual(
    [response.status, await response.json()],
    [404, { error: "personal_plan_not_available" }],
  )
  response = await createStage2RouteHandlers(deps({ getUserId: async () => null })).PATCH(
    new Request("http://test/api/personal-plan/stage-2", { method: "PATCH", body: "{" }),
  )
  assert.deepEqual([response.status, await response.json()], [401, { error: "unauthorized" }])
})

test("Stage 2 save derives the owner server-side and maps validation, conflict and temporary failures", async () => {
  let owner = ""
  const save = new Request("http://test/api/personal-plan/stage-2", {
    method: "PATCH",
    body: JSON.stringify({
      questionId: "current_product_categories",
      answer: [],
      expectedRevision: 0,
    }),
  })
  let response = await createStage2RouteHandlers(
    deps({
      gatewayFor: (userId) => {
        owner = userId
        return gateway()
      },
    }),
  ).PATCH(save)
  assert.equal(owner, "owner-1")
  assert.equal(response.status, 200)
  assert.match(response.headers.get("Server-Timing") ?? "", /auth;dur=/)
  assert.match(response.headers.get("Server-Timing") ?? "", /journey;dur=/)
  assert.match(response.headers.get("Server-Timing") ?? "", /operation;dur=/)

  for (const [code, status] of [
    ["invalid_answer", 422],
    ["question_not_current", 422],
    ["revision_conflict", 409],
    ["temporarily_unavailable", 503],
  ] as const) {
    response = await createStage2RouteHandlers(
      deps({
        gatewayFor: () =>
          gateway({
            saveAnswer: async () => {
              throw new Stage2RefinementError(code)
            },
          }),
      }),
    ).PATCH(
      new Request("http://test/api/personal-plan/stage-2", {
        method: "PATCH",
        body: JSON.stringify({
          questionId: "current_product_categories",
          answer: [],
          expectedRevision: 0,
        }),
      }),
    )
    assert.deepEqual([response.status, await response.json()], [status, { error: code }])
  }
})

test("Stage 2 final save reuses one authorized gateway for durable save and completion", async () => {
  const calls: string[] = []
  const savedSession = { ...session, revision: 1 }
  const response = await createStage2RouteHandlers(
    deps({
      gatewayFor: () =>
        gateway({
          saveAnswer: async () => {
            calls.push("save")
            return savedSession
          },
          complete: async ({ expectedRevision }) => {
            calls.push(`complete:${expectedRevision}`)
            return { refinedVersionId: "refined-1", nextHref: "/plan-start" }
          },
        }),
    }),
  ).PATCH(
    new Request("http://test/api/personal-plan/stage-2", {
      method: "PATCH",
      body: JSON.stringify({
        questionId: "night_protection",
        answer: [],
        expectedRevision: 0,
        completeAfterSave: true,
      }),
    }),
  )

  assert.deepEqual(calls, ["save", "complete:1"])
  assert.deepEqual(await response.json(), {
    session: JSON.parse(JSON.stringify(savedSession)),
    handoff: { refinedVersionId: "refined-1", nextHref: "/plan-start" },
  })
})

test("Stage 2 final save reports a durable saved page when completion fails", async () => {
  const savedSession = { ...session, revision: 1 }
  const response = await createStage2RouteHandlers(
    deps({
      gatewayFor: () =>
        gateway({
          saveAnswer: async () => savedSession,
          complete: async () => {
            throw new Stage2RefinementError("completion_failed")
          },
        }),
    }),
  ).PATCH(
    new Request("http://test/api/personal-plan/stage-2", {
      method: "PATCH",
      body: JSON.stringify({
        questionId: "night_protection",
        answer: [],
        expectedRevision: 0,
        completeAfterSave: true,
      }),
    }),
  )

  assert.equal(response.status, 503)
  assert.deepEqual(await response.json(), {
    error: "completion_failed",
    savedSession: JSON.parse(JSON.stringify(savedSession)),
  })
})

test("Stage 2 completion is a separate strict POST with owner-derived success, conflict and temporary failure outcomes", async () => {
  let owner = ""
  const handler = createStage2CompleteRouteHandler(
    completeDeps({
      gatewayFor: (userId) => {
        owner = userId
        return gateway()
      },
    }),
  )
  let response = await handler(
    new Request("http://test/api/personal-plan/stage-2/complete", {
      method: "POST",
      body: JSON.stringify({ expectedRevision: 0 }),
    }),
  )
  assert.equal(owner, "owner-1")
  assert.deepEqual(
    [response.status, await response.json()],
    [200, { refinedVersionId: "refined-1", nextHref: "/plan-start" }],
  )
  assert.match(response.headers.get("Server-Timing") ?? "", /auth;dur=/)
  assert.match(response.headers.get("Server-Timing") ?? "", /journey;dur=/)
  assert.match(response.headers.get("Server-Timing") ?? "", /operation;dur=/)

  response = await handler(
    new Request("http://test/api/personal-plan/stage-2/complete", {
      method: "POST",
      body: JSON.stringify({ expectedRevision: 0, draftId: "forged" }),
    }),
  )
  assert.deepEqual([response.status, await response.json()], [400, { error: "invalid_request" }])

  for (const [code, status] of [
    ["incomplete_refinement", 422],
    ["revision_conflict", 409],
    ["temporarily_unavailable", 503],
  ] as const) {
    response = await createStage2CompleteRouteHandler(
      completeDeps({
        gatewayFor: () =>
          gateway({
            complete: async () => {
              throw new Stage2RefinementError(code)
            },
          }),
      }),
    )(
      new Request("http://test/api/personal-plan/stage-2/complete", {
        method: "POST",
        body: JSON.stringify({ expectedRevision: 0 }),
      }),
    )
    assert.deepEqual([response.status, await response.json()], [status, { error: code }])
  }
})
