import assert from "node:assert/strict"
import test from "node:test"

import { createHttpStage2RefinementGateway } from "../src/lib/personal-plan/refinement/http-gateway"
import {
  createHttpStage3IntakeClient,
  createHttpStage3ProductsGateway,
} from "../src/lib/personal-plan/products/http-gateway"

test("optional inventory entry is a POST separate from baseline draft loading", async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = []
  const gateway = createHttpStage3ProductsGateway({
    fetch: async (url, init) => {
      requests.push({ url: String(url), init })
      return new Response(JSON.stringify({ draft: { draftId: "imported", revision: 0 } }))
    },
  })
  const input = { personalPlanId: "plan", refinedVersionId: "refined" }
  await gateway.openOptionalInventory?.(input)
  assert.equal(requests.length, 1)
  assert.equal(requests[0].url, "/api/personal-plan/stage-3/optional-entry")
  assert.equal(requests[0].init?.method, "POST")
  assert.deepEqual(JSON.parse(String(requests[0].init?.body)), input)
  await gateway.loadOrCreate({ ...input, draftId: "draft", userId: "owner", requirements: [] })
  assert.equal(requests[1].init?.method, "GET")
})

test("optional Stage 2 entry uses a separate POST and returns the prepared successor revision", async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = []
  const gateway = createHttpStage2RefinementGateway({
    fetch: async (url, init) => {
      requests.push({ url: String(url), init })
      return new Response(
        JSON.stringify({ sessionId: "successor", revision: 0, status: "in_progress" }),
      )
    },
  })
  const session = await gateway.openOptionalRefinement?.("products")
  assert.equal(requests.length, 1)
  assert.equal(requests[0].url, "/api/personal-plan/stage-2/optional-entry")
  assert.equal(requests[0].init?.method, "POST")
  assert.deepEqual(JSON.parse(String(requests[0].init?.body)), { module: "products" })
  assert.equal(session?.revision, 0)
  await gateway.load()
  assert.equal(requests[1].url, "/api/personal-plan/stage-2")
  assert.equal(requests[1].init?.method, "GET")
})

test("the browser Stage 2 gateway maps a failed load to a typed error and retries with a fresh request", async () => {
  let calls = 0
  const gateway = createHttpStage2RefinementGateway({
    fetch: async () => {
      calls += 1
      if (calls === 1)
        return new Response(JSON.stringify({ error: "temporarily_unavailable" }), { status: 503 })
      return new Response(JSON.stringify({ schemaVersion: 1, status: "in_progress" }), {
        status: 200,
      })
    },
  })

  await assert.rejects(gateway.load(), { code: "temporarily_unavailable" })
  const session = await gateway.load()
  assert.equal(calls, 2)
  assert.equal(session.status, "in_progress")
})

test("the browser Stage 2 gateway saves and completes the final page in one request", async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = []
  const gateway = createHttpStage2RefinementGateway({
    fetch: async (input, init) => {
      requests.push({ url: String(input), init })
      return new Response(
        JSON.stringify({
          session: { schemaVersion: 1, status: "in_progress", revision: 7 },
          handoff: { refinedVersionId: "refined-7", nextHref: "/plan-start" },
        }),
        { status: 200 },
      )
    },
  })

  const result = await gateway.saveAnswerAndComplete?.({
    questionId: "night_protection",
    answer: [],
    expectedRevision: 6,
  })

  assert.deepEqual(result?.handoff, {
    refinedVersionId: "refined-7",
    nextHref: "/plan-start",
  })
  assert.equal(requests.length, 1)
  assert.equal(requests[0]?.url, "/api/personal-plan/stage-2")
  assert.equal(requests[0]?.init?.method, "PATCH")
  assert.deepEqual(JSON.parse(String(requests[0]?.init?.body)), {
    questionId: "night_protection",
    answer: [],
    expectedRevision: 6,
    completeAfterSave: true,
  })
})

test("the browser Stage 2 gateway preserves the durable final page on completion failure", async () => {
  const savedSession = { schemaVersion: 1, status: "in_progress", revision: 7 }
  const gateway = createHttpStage2RefinementGateway({
    fetch: async () =>
      new Response(JSON.stringify({ error: "completion_failed", savedSession }), { status: 503 }),
  })

  await assert.rejects(
    gateway.saveAnswerAndComplete!({
      questionId: "night_protection",
      answer: [],
      expectedRevision: 6,
    }),
    (error: unknown) => {
      assert.equal((error as { code?: unknown }).code, "completion_failed")
      assert.deepEqual((error as { savedSession?: unknown }).savedSession, savedSession)
      return true
    },
  )
})

test("the browser intake client posts a stable UUID idempotency key with valid manual input", async () => {
  let request: RequestInit | undefined
  const client = createHttpStage3IntakeClient({
    fetch: async (_url, init) => {
      request = init
      return new Response(JSON.stringify({ draft: { draftId: "draft" } }), { status: 201 })
    },
  })
  await client.submit({
    draftId: "11111111-1111-4111-8111-111111111111",
    expectedRevision: 2,
    idempotencyKey: "22222222-2222-4222-8222-222222222222",
    input: {
      intake_method: "manual",
      brand_text: "Unbekannte Marke",
      product_name_text: "Shampoo",
      frequency_range: "weekly_2x",
    },
  })
  assert.equal(
    (request?.headers as Record<string, string>)["Idempotency-Key"],
    "22222222-2222-4222-8222-222222222222",
  )
  assert.deepEqual(JSON.parse(String(request?.body)), {
    draftId: "11111111-1111-4111-8111-111111111111",
    expectedRevision: 2,
    input: {
      intake_method: "manual",
      brand_text: "Unbekannte Marke",
      product_name_text: "Shampoo",
      frequency_range: "weekly_2x",
    },
  })
})
