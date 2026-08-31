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
import type { Stage3RecomputeResult } from "../src/lib/personal-plan/refinement-recompute/types"

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
    // Default: "no active routine" — the vast majority of Stage 2 tests never
    // touch the habits-recompute lane, so this must be a harmless no-op.
    runHabitsRecompute: async () => null,
    ...overrides,
  }
}

function moduleCompletionResult(
  overrides: Partial<{
    module: "products" | "habits"
    refinedVersionId: string
    status: "in_progress" | "complete"
    stage3Handoff: boolean
  }> = {},
) {
  return {
    module: "habits" as const,
    refinedVersionId: "refined-habits-1",
    status: "in_progress" as const,
    stage3Handoff: false,
    nextHref: "/plan-start" as const,
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

test("Stage 2 module save completes exactly the requested module on the same gateway", async () => {
  const calls: string[] = []
  const savedSession = { ...session, revision: 3 }
  const moduleCompletion = {
    module: "products" as const,
    refinedVersionId: "refined-7",
    status: "in_progress" as const,
    stage3Handoff: true,
    nextHref: "/plan-start" as const,
  }
  const response = await createStage2RouteHandlers(
    deps({
      gatewayFor: () =>
        gateway({
          saveAnswer: async () => {
            calls.push("save")
            return savedSession
          },
          complete: async () => {
            calls.push("complete")
            return { refinedVersionId: "refined-1", nextHref: "/plan-start" }
          },
          completeModule: async ({ module: stage2Module, expectedRevision }) => {
            calls.push(`completeModule:${stage2Module}:${expectedRevision}`)
            return moduleCompletion
          },
        }),
    }),
  ).PATCH(
    new Request("http://test/api/personal-plan/stage-2", {
      method: "PATCH",
      body: JSON.stringify({
        questionId: "wet_wash_frequency",
        answer: "weekly_2x",
        expectedRevision: 2,
        completeModuleAfterSave: "products",
      }),
    }),
  )

  assert.deepEqual(calls, ["save", "completeModule:products:3"])
  assert.deepEqual(await response.json(), {
    session: JSON.parse(JSON.stringify(savedSession)),
    moduleCompletion,
  })
})

test("Stage 2 module save rejects an unknown module and a doubled completion request", async () => {
  let saves = 0
  const handler = createStage2RouteHandlers(
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
  const patch = (body: unknown) =>
    handler.PATCH(
      new Request("http://test/api/personal-plan/stage-2", {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    )
  const base = { questionId: "night_protection", answer: [], expectedRevision: 0 }

  let response = await patch({ ...base, completeModuleAfterSave: "colour" })
  assert.deepEqual([response.status, await response.json()], [400, { error: "invalid_request" }])

  response = await patch({
    ...base,
    completeAfterSave: true,
    completeModuleAfterSave: "habits",
  })
  assert.deepEqual([response.status, await response.json()], [400, { error: "invalid_request" }])
  assert.equal(saves, 0)
})

test("Stage 2 module save reports a durable saved page when the module completion fails", async () => {
  const savedSession = { ...session, revision: 1 }
  const response = await createStage2RouteHandlers(
    deps({
      gatewayFor: () =>
        gateway({
          saveAnswer: async () => savedSession,
          completeModule: async () => {
            throw new Stage2RefinementError("revision_conflict")
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
        completeModuleAfterSave: "habits",
      }),
    }),
  )

  assert.equal(response.status, 409)
  assert.deepEqual(await response.json(), {
    error: "revision_conflict",
    savedSession: JSON.parse(JSON.stringify(savedSession)),
  })
})

test("Stage 2 module save fails closed on a gateway that cannot project a module", async () => {
  const savedSession = { ...session, revision: 1 }
  const response = await createStage2RouteHandlers(
    deps({
      // `completeModule` is optional; fixture gateways do not implement it. The
      // answer must still be durably saved and reported back to the caller.
      gatewayFor: () => gateway({ saveAnswer: async () => savedSession }),
    }),
  ).PATCH(
    new Request("http://test/api/personal-plan/stage-2", {
      method: "PATCH",
      body: JSON.stringify({
        questionId: "night_protection",
        answer: [],
        expectedRevision: 0,
        completeModuleAfterSave: "products",
      }),
    }),
  )

  assert.equal(response.status, 503)
  assert.deepEqual(await response.json(), {
    error: "temporarily_unavailable",
    savedSession: JSON.parse(JSON.stringify(savedSession)),
  })
})

test("Stage 2 save without a completion flag stays a plain save for existing clients", async () => {
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
          complete: async () => {
            calls.push("complete")
            return { refinedVersionId: "refined-1", nextHref: "/plan-start" }
          },
          completeModule: async () => {
            calls.push("completeModule")
            throw new Error("unexpected module completion")
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
      }),
    }),
  )

  assert.deepEqual(calls, ["save"])
  assert.deepEqual(await response.json(), JSON.parse(JSON.stringify(savedSession)))
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

test("Stage 2 habits module completion (non-closing) runs the recompute lane and reports its outcome", async () => {
  const savedSession = { ...session, revision: 4 }
  const moduleCompletion = moduleCompletionResult({ status: "in_progress" })
  const recomputeCalls: Array<{ userId: string; refinedVersionId: string }> = []
  const response = await createStage2RouteHandlers(
    deps({
      gatewayFor: () =>
        gateway({
          saveAnswer: async () => savedSession,
          completeModule: async () => moduleCompletion,
        }),
      runHabitsRecompute: async (input) => {
        recomputeCalls.push(input)
        return { status: "applied", routineVersionId: "routine-2" } satisfies Stage3RecomputeResult
      },
    }),
  ).PATCH(
    new Request("http://test/api/personal-plan/stage-2", {
      method: "PATCH",
      body: JSON.stringify({
        questionId: "wet_wash_frequency",
        answer: "weekly_2x",
        expectedRevision: 3,
        completeModuleAfterSave: "habits",
      }),
    }),
  )

  assert.deepEqual(recomputeCalls, [{ userId: "owner-1", refinedVersionId: "refined-habits-1" }])
  assert.deepEqual(await response.json(), {
    session: JSON.parse(JSON.stringify(savedSession)),
    moduleCompletion: { ...moduleCompletion, recompute: { outcome: "applied" } },
  })
})

test("Stage 2 habits module completion (closing, status complete) also runs the recompute lane", async () => {
  const savedSession = { ...session, revision: 5 }
  const moduleCompletion = moduleCompletionResult({ status: "complete" })
  let calls = 0
  const response = await createStage2RouteHandlers(
    deps({
      gatewayFor: () =>
        gateway({
          saveAnswer: async () => savedSession,
          completeModule: async () => moduleCompletion,
        }),
      runHabitsRecompute: async () => {
        calls += 1
        return { status: "unchanged" } satisfies Stage3RecomputeResult
      },
    }),
  ).PATCH(
    new Request("http://test/api/personal-plan/stage-2", {
      method: "PATCH",
      body: JSON.stringify({
        questionId: "wet_wash_frequency",
        answer: "weekly_2x",
        expectedRevision: 4,
        completeModuleAfterSave: "habits",
      }),
    }),
  )

  assert.equal(calls, 1)
  assert.deepEqual(await response.json(), {
    session: JSON.parse(JSON.stringify(savedSession)),
    moduleCompletion: { ...moduleCompletion, recompute: { outcome: "unchanged" } },
  })
})

test("Stage 2 products module completion never runs the recompute lane", async () => {
  const savedSession = { ...session, revision: 2 }
  const moduleCompletion = moduleCompletionResult({
    module: "products",
    status: "in_progress",
    stage3Handoff: true,
  })
  let calls = 0
  const response = await createStage2RouteHandlers(
    deps({
      gatewayFor: () =>
        gateway({
          saveAnswer: async () => savedSession,
          completeModule: async () => moduleCompletion,
        }),
      runHabitsRecompute: async () => {
        calls += 1
        return null
      },
    }),
  ).PATCH(
    new Request("http://test/api/personal-plan/stage-2", {
      method: "PATCH",
      body: JSON.stringify({
        questionId: "wet_wash_frequency",
        answer: "weekly_2x",
        expectedRevision: 1,
        completeModuleAfterSave: "products",
      }),
    }),
  )

  assert.equal(calls, 0)
  assert.deepEqual(await response.json(), {
    session: JSON.parse(JSON.stringify(savedSession)),
    moduleCompletion,
  })
})

test("Stage 2 legacy completeAfterSave never runs the recompute lane", async () => {
  const savedSession = { ...session, revision: 1 }
  let calls = 0
  const response = await createStage2RouteHandlers(
    deps({
      gatewayFor: () =>
        gateway({
          saveAnswer: async () => savedSession,
          complete: async () => ({ refinedVersionId: "refined-legacy", nextHref: "/plan-start" }),
        }),
      runHabitsRecompute: async () => {
        calls += 1
        return null
      },
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

  assert.equal(calls, 0)
  assert.deepEqual(await response.json(), {
    session: JSON.parse(JSON.stringify(savedSession)),
    handoff: { refinedVersionId: "refined-legacy", nextHref: "/plan-start" },
  })
})

test("Stage 2 habits module completion omits the recompute field entirely when there is no active routine", async () => {
  const savedSession = { ...session, revision: 3 }
  const moduleCompletion = moduleCompletionResult({ status: "in_progress" })
  const response = await createStage2RouteHandlers(
    deps({
      gatewayFor: () =>
        gateway({
          saveAnswer: async () => savedSession,
          completeModule: async () => moduleCompletion,
        }),
      runHabitsRecompute: async () => null,
    }),
  ).PATCH(
    new Request("http://test/api/personal-plan/stage-2", {
      method: "PATCH",
      body: JSON.stringify({
        questionId: "wet_wash_frequency",
        answer: "weekly_2x",
        expectedRevision: 2,
        completeModuleAfterSave: "habits",
      }),
    }),
  )

  assert.deepEqual(await response.json(), {
    session: JSON.parse(JSON.stringify(savedSession)),
    moduleCompletion,
  })
})

test("Stage 2 habits module completion isolates a throwing recompute lane behind a 200 with outcome unavailable", async () => {
  const savedSession = { ...session, revision: 6 }
  const moduleCompletion = moduleCompletionResult({ status: "in_progress" })
  const response = await createStage2RouteHandlers(
    deps({
      gatewayFor: () =>
        gateway({
          saveAnswer: async () => savedSession,
          completeModule: async () => moduleCompletion,
        }),
      runHabitsRecompute: async () => {
        throw new Error("boom")
      },
    }),
  ).PATCH(
    new Request("http://test/api/personal-plan/stage-2", {
      method: "PATCH",
      body: JSON.stringify({
        questionId: "wet_wash_frequency",
        answer: "weekly_2x",
        expectedRevision: 5,
        completeModuleAfterSave: "habits",
      }),
    }),
  )

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), {
    session: JSON.parse(JSON.stringify(savedSession)),
    moduleCompletion: { ...moduleCompletion, recompute: { outcome: "unavailable" } },
  })
})

test("Stage 2 habits module completion reports an unavailable orchestrator result without leaking its reason or retryability", async () => {
  const savedSession = { ...session, revision: 7 }
  const moduleCompletion = moduleCompletionResult({ status: "complete" })
  const response = await createStage2RouteHandlers(
    deps({
      gatewayFor: () =>
        gateway({
          saveAnswer: async () => savedSession,
          completeModule: async () => moduleCompletion,
        }),
      runHabitsRecompute: async () =>
        ({
          status: "unavailable",
          reason: "decision_blocked",
          retryable: false,
        }) satisfies Stage3RecomputeResult,
    }),
  ).PATCH(
    new Request("http://test/api/personal-plan/stage-2", {
      method: "PATCH",
      body: JSON.stringify({
        questionId: "wet_wash_frequency",
        answer: "weekly_2x",
        expectedRevision: 6,
        completeModuleAfterSave: "habits",
      }),
    }),
  )

  assert.equal(response.status, 200)
  const body = (await response.json()) as { moduleCompletion: Record<string, unknown> }
  assert.deepEqual(body.moduleCompletion.recompute, { outcome: "unavailable" })
})

test("Stage 2 habits recompute lane reports transition timing and a structured log line", async () => {
  const savedSession = { ...session, revision: 8 }
  const moduleCompletion = moduleCompletionResult({ status: "in_progress" })
  const originalInfo = console.info
  const timingEvents: Array<[string, Record<string, unknown>]> = []
  const infoEvents: Array<[string, Record<string, unknown>]> = []
  console.info = ((event: string, details: Record<string, unknown>) => {
    if (event === "personal_plan_transition_performance") timingEvents.push([event, details])
    else if (event === "personal_plan_stage2_api") infoEvents.push([event, details])
  }) as typeof console.info
  try {
    await createStage2RouteHandlers(
      deps({
        gatewayFor: () =>
          gateway({
            saveAnswer: async () => savedSession,
            completeModule: async () => moduleCompletion,
          }),
        runHabitsRecompute: async () =>
          ({
            status: "unavailable",
            reason: "resolve_conflict",
            retryable: true,
          }) satisfies Stage3RecomputeResult,
      }),
    ).PATCH(
      new Request("http://test/api/personal-plan/stage-2", {
        method: "PATCH",
        body: JSON.stringify({
          questionId: "wet_wash_frequency",
          answer: "weekly_2x",
          expectedRevision: 7,
          completeModuleAfterSave: "habits",
        }),
      }),
    )
  } finally {
    console.info = originalInfo
  }

  const timing = timingEvents.find(([, details]) => details.operation === "stage2_habits_recompute")
  assert.ok(timing, "expected a stage2_habits_recompute transition timing event")
  assert.equal(timing?.[1].outcome, "unavailable:resolve_conflict")

  const log = infoEvents.find(([, details]) => details.event === "habits_recompute")
  assert.ok(log, "expected a habits_recompute log line")
  assert.deepEqual(log?.[1], {
    event: "habits_recompute",
    outcome: "unavailable",
    reason: "resolve_conflict",
    retryable: true,
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
