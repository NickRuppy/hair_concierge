import assert from "node:assert/strict"
import test from "node:test"

import { createHttpStage2RefinementGateway } from "../src/lib/personal-plan/refinement/http-gateway"
import { createHttpStage3IntakeClient } from "../src/lib/personal-plan/products/http-gateway"

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
