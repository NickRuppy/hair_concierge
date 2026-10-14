import assert from "node:assert/strict"
import test from "node:test"

import {
  createPersonalPlanPreparePostHandler,
  PersonalPlanPrepareConflictError,
  persistPersonalPlanPreparedArtifact,
  type PersonalPlanPrepareArtifactInput,
  type PersonalPlanPrepareRouteDeps,
} from "../src/app/api/quiz/personal-plan-prepare/route"
import {
  PERSONAL_PLAN_PREPARE_IP_RATE_LIMIT,
  PERSONAL_PLAN_PREPARE_JOURNEY_RATE_LIMIT,
  QUIZ_LEAD_RATE_LIMIT,
} from "../src/lib/rate-limit"

const body = {
  preparationId: "11111111-1111-4111-8111-111111111111",
  claimToken: "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8",
  answers: {
    texture: "wavy",
    thickness: "fine",
    density: "medium",
    goals: ["shine", "moisture"],
    routineClarity: "partial",
    resultReliability: "sometimes",
    adaptationConfidence: "partly",
    currentConcerns: ["low_shine", "frizz_flyaways"],
    hairLength: "medium",
    hairSurface: "slightly_uneven",
    elasticResponse: "stretches_stays",
    chemicalTreatments: ["colored"],
    scalpOiliness: "balanced",
    scalpConcerns: [],
    previousAttempts: "some_steps_helped",
    blockers: ["product_fit"],
    routineStyle: "simple_reliable",
    meaningfulMoment: "everyday",
  },
}

function request(value: unknown = body) {
  return new Request("https://chaarlie.de/api/quiz/personal-plan-prepare", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": "203.0.113.5, 10.0.0.4",
    },
    body: JSON.stringify(value),
  })
}

function dependencies(overrides: Partial<PersonalPlanPrepareRouteDeps> = {}) {
  const order: string[] = []
  const rateCalls: Array<{ identifier: string; prefix: string }> = []
  const preparations: PersonalPlanPrepareArtifactInput[] = []
  const warnings: string[] = []
  const deps: PersonalPlanPrepareRouteDeps = {
    enabled: () => true,
    checkRateLimit: async (identifier, config) => {
      order.push(`rate:${config.prefix}`)
      rateCalls.push({ identifier, prefix: config.prefix })
      return { allowed: true }
    },
    retryAfterSeconds: () => 7,
    resolveContext: async () => {
      order.push("context")
      return { status: "ready", userId: null, journeyRateLimitId: "draft:draft-1" }
    },
    createLegacyCredential: () => ({
      preparationId: "22222222-2222-4222-8222-222222222222",
      claimToken: "legacy-browser-claim-token-with-forty-plus-characters",
      claimTokenHash: "a".repeat(64),
    }),
    prepareArtifact: async (input) => {
      order.push("prepare")
      preparations.push(input)
      return { artifactId: input.preparationId, expiresAt: input.expiresAt, replayed: false }
    },
    now: () => Date.parse("2026-09-01T17:00:00.000Z"),
    warnRateLimited: (scope) => warnings.push(scope),
    ...overrides,
  }
  return { deps, order, rateCalls, preparations, warnings }
}

test("prepare protection has dedicated short-window journey and IP budgets", () => {
  assert.deepEqual(PERSONAL_PLAN_PREPARE_JOURNEY_RATE_LIMIT, {
    prefix: "personal-plan-prepare-journey",
    limit: 10,
    windowMs: 10_000,
  })
  assert.deepEqual(PERSONAL_PLAN_PREPARE_IP_RATE_LIMIT, {
    prefix: "personal-plan-prepare-ip",
    limit: 100,
    windowMs: 10_000,
  })
  assert.notEqual(PERSONAL_PLAN_PREPARE_JOURNEY_RATE_LIMIT.prefix, QUIZ_LEAD_RATE_LIMIT.prefix)
  assert.notEqual(PERSONAL_PLAN_PREPARE_IP_RATE_LIMIT.prefix, QUIZ_LEAD_RATE_LIMIT.prefix)
})

test("prepare preserves disabled and unavailable context boundaries", async () => {
  const disabled = dependencies({ enabled: () => false })
  let response = await createPersonalPlanPreparePostHandler(disabled.deps)(request())
  assert.equal(response.status, 404)
  assert.equal(disabled.rateCalls.length, 0)

  const unavailable = dependencies({
    resolveContext: async () => ({ status: "unavailable" }),
  })
  response = await createPersonalPlanPreparePostHandler(unavailable.deps)(request())
  assert.equal(response.status, 503)
  assert.equal(unavailable.preparations.length, 0)
})

test("prepare maps an unexpected context throw to its structured server error", async () => {
  const fixture = dependencies({
    resolveContext: async () => {
      throw new Error("context unavailable")
    },
  })
  const originalError = console.error
  const errors: unknown[][] = []
  console.error = (...args) => errors.push(args)
  try {
    const response = await createPersonalPlanPreparePostHandler(fixture.deps)(request())
    assert.equal(response.status, 500)
    assert.deepEqual(await response.json(), { error: "Plan konnte nicht vorbereitet werden" })
    assert.equal(errors.length, 1)
  } finally {
    console.error = originalError
  }
})

test("prepare applies the IP ceiling before journey resolution and persists the browser replay identity", async () => {
  const fixture = dependencies()
  const response = await createPersonalPlanPreparePostHandler(fixture.deps)(request())

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), {
    artifactId: body.preparationId,
    claimToken: body.claimToken,
    status: "ready",
    expiresAt: "2026-09-01T18:00:00.000Z",
  })
  assert.deepEqual(fixture.order, [
    `rate:${PERSONAL_PLAN_PREPARE_IP_RATE_LIMIT.prefix}`,
    "context",
    `rate:${PERSONAL_PLAN_PREPARE_JOURNEY_RATE_LIMIT.prefix}`,
    "prepare",
  ])
  assert.deepEqual(fixture.rateCalls, [
    { identifier: "203.0.113.5", prefix: PERSONAL_PLAN_PREPARE_IP_RATE_LIMIT.prefix },
    { identifier: "draft:draft-1", prefix: PERSONAL_PLAN_PREPARE_JOURNEY_RATE_LIMIT.prefix },
  ])
  assert.equal(fixture.preparations[0].preparationId, body.preparationId)
  assert.match(fixture.preparations[0].claimTokenHash, /^[0-9a-f]{64}$/)
})

test("prepare skips the journey bucket when no verified identity resolves", async () => {
  const fixture = dependencies({
    resolveContext: async () => ({ status: "ready", userId: null, journeyRateLimitId: null }),
  })
  const response = await createPersonalPlanPreparePostHandler(fixture.deps)(request())

  assert.equal(response.status, 200)
  assert.deepEqual(fixture.rateCalls, [
    { identifier: "203.0.113.5", prefix: PERSONAL_PLAN_PREPARE_IP_RATE_LIMIT.prefix },
  ])
})

test("prepare returns Retry-After only for a real rejected limiter", async () => {
  const ipLimited = dependencies({
    checkRateLimit: async () => ({ allowed: false }),
    resolveContext: async () => {
      throw new Error("IP rejection must happen before context resolution")
    },
  })
  let response = await createPersonalPlanPreparePostHandler(ipLimited.deps)(request())
  assert.equal(response.status, 429)
  assert.equal(response.headers.get("retry-after"), "7")
  assert.deepEqual(ipLimited.warnings, ["ip"])

  let calls = 0
  const unavailable = dependencies({
    checkRateLimit: async () => {
      calls += 1
      return calls === 1 ? { allowed: true } : { allowed: false, error: "service_unavailable" }
    },
  })
  response = await createPersonalPlanPreparePostHandler(unavailable.deps)(request())
  assert.equal(response.status, 503)
  assert.equal(response.headers.get("retry-after"), null)
})

test("prepare gives already-open legacy pages a server replay credential", async () => {
  const fixture = dependencies()
  const response = await createPersonalPlanPreparePostHandler(fixture.deps)(
    request({ answers: body.answers }),
  )
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), {
    artifactId: "22222222-2222-4222-8222-222222222222",
    claimToken: "legacy-browser-claim-token-with-forty-plus-characters",
    status: "ready",
    expiresAt: "2026-09-01T18:00:00.000Z",
  })
  assert.equal(fixture.preparations.length, 1)
  assert.equal(fixture.preparations[0].claimTokenHash, "a".repeat(64))
})

test("prepare rejects a partial replay credential before persistence", async () => {
  const fixture = dependencies()
  const response = await createPersonalPlanPreparePostHandler(fixture.deps)(
    request({
      answers: body.answers,
      preparationId: body.preparationId,
    }),
  )
  assert.equal(response.status, 400)
  assert.equal(fixture.preparations.length, 0)
})

test("prepare returns a stable conflict response for mismatched replay credentials", async () => {
  const fixture = dependencies({
    prepareArtifact: async () => {
      throw new PersonalPlanPrepareConflictError()
    },
  })
  const response = await createPersonalPlanPreparePostHandler(fixture.deps)(request())
  assert.equal(response.status, 409)
  assert.deepEqual(await response.json(), { error: "preparation_conflict" })
})

test("production persistence maps conflicts, validates receipts, and purges only after inserts", async () => {
  const fixture = dependencies()
  await createPersonalPlanPreparePostHandler(fixture.deps)(request())
  const input = fixture.preparations[0]

  for (const code of ["22023", "23505"]) {
    await assert.rejects(
      persistPersonalPlanPreparedArtifact(input, async () => ({
        data: null,
        error: { code },
      })),
      PersonalPlanPrepareConflictError,
    )
  }
  await assert.rejects(
    persistPersonalPlanPreparedArtifact(input, async () => ({ data: [], error: null })),
    /no artifact receipt/,
  )

  const replayCalls: string[] = []
  const replay = await persistPersonalPlanPreparedArtifact(input, async (name) => {
    replayCalls.push(name)
    return {
      data: [
        {
          artifact_id: input.preparationId,
          artifact_expires_at: input.expiresAt,
          replayed: true,
        },
      ],
      error: null,
    }
  })
  assert.equal(replay.replayed, true)
  assert.deepEqual(replayCalls, ["prepare_personal_plan_artifact"])

  const insertCalls: string[] = []
  const inserted = await persistPersonalPlanPreparedArtifact(input, async (name) => {
    insertCalls.push(name)
    return name === "prepare_personal_plan_artifact"
      ? {
          data: [
            {
              artifact_id: input.preparationId,
              artifact_expires_at: input.expiresAt,
              replayed: false,
            },
          ],
          error: null,
        }
      : { data: 2, error: null }
  })
  assert.equal(inserted.replayed, false)
  assert.deepEqual(insertCalls, [
    "prepare_personal_plan_artifact",
    "purge_expired_personal_plan_artifacts",
  ])
})
