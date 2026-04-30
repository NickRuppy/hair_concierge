import assert from "node:assert/strict"
import test from "node:test"

const mutableEnv = process.env as Record<string, string | undefined>

async function importRoute() {
  return import("../src/app/api/labs/agent-compare/route")
}

async function importJudgmentRoute() {
  return import("../src/app/api/labs/agent-compare/judgments/route")
}

function withNodeEnv(value: string, run: () => Promise<void>) {
  const previous = mutableEnv.NODE_ENV
  mutableEnv.NODE_ENV = value

  return run().finally(() => {
    mutableEnv.NODE_ENV = previous
  })
}

test("GET rejects the compare lab route outside development", async () =>
  withNodeEnv("production", async () => {
    const { GET } = await importRoute()
    const response = await GET(new Request("http://localhost/api/labs/agent-compare"))

    assert.equal(response.status, 404)
    assert.deepEqual(await response.json(), {
      error: "Nur lokal in development verfuegbar.",
    })
  }))

test("GET returns eligible users and an optional selected-user snapshot in development", async () =>
  withNodeEnv("development", async () => {
    const { handleAgentCompareGetRequest } = await importRoute()
    const response = await handleAgentCompareGetRequest(
      new URL("http://localhost/api/labs/agent-compare?userId=user-2"),
      {
        listEligibleCompareUsers: async () => [
          { id: "user-1", label: "Lea · fine", full_name: "Lea" },
          { id: "user-2", label: "Mara · curly", full_name: "Mara" },
        ],
        loadCompareUserSnapshot: async (userId) => ({
          user_id: userId,
          derived_signals: ["Haardicke: Fein"],
          routine_inventory: [
            { category: "shampoo", product_name: "Soft Wash", frequency_range: "2_3x" },
          ],
          relevant_memory: [
            { id: "memory-1", kind: "preference", content: "Routine soll einfach sein." },
          ],
        }),
        runCurrentComparisonForUser: async () => {
          throw new Error("not used")
        },
        runShadowComparisonForUser: async () => {
          throw new Error("not used")
        },
      },
    )

    assert.equal(response.status, 200)
    const body = await response.json()
    assert.deepEqual(body.users, [
      { id: "user-1", label: "Lea · fine", full_name: "Lea" },
      { id: "user-2", label: "Mara · curly", full_name: "Mara" },
    ])
    assert.equal(body.selectedUser?.user_id, "user-2")
    assert.deepEqual(body.selectedUser?.derived_signals, ["Haardicke: Fein"])
  }))

test("POST validates the request body before calling compare execution", async () =>
  withNodeEnv("development", async () => {
    const { handleAgentCompareRequest } = await importRoute()
    const response = await handleAgentCompareRequest(
      { userId: "", prompt: "" },
      {
        listEligibleCompareUsers: async () => [],
        loadCompareUserSnapshot: async () => {
          throw new Error("not used")
        },
        runCurrentComparisonForUser: async () => {
          throw new Error("not used")
        },
        runShadowComparisonForUser: async () => {
          throw new Error("not used")
        },
      },
    )

    assert.equal(response.status, 400)
    assert.match((await response.json()).error, /Ungueltige/)
  }))

test("handleAgentCompareRequest returns both compare columns, including partial failures", async () =>
  withNodeEnv("development", async () => {
    const { handleAgentCompareRequest } = await importRoute()
    const response = await handleAgentCompareRequest(
      {
        userId: "user-42",
        prompt: "Eigenes Prompt",
      },
      {
        listEligibleCompareUsers: async () => [],
        loadCompareUserSnapshot: async () => {
          throw new Error("not used")
        },
        runCurrentComparisonForUser: async ({ userId, prompt }) => ({
          system: "current",
          answer: `Aktuelles System Antwort fuer ${userId}`,
          latency_ms: 120,
          debug_lines: ["2 Quellen", "1 Produktmatch", `Prompt: ${prompt}`],
          matched_products: [{ name: "Light Shampoo", category: "shampoo" }],
          error: null,
        }),
        runShadowComparisonForUser: async () => {
          throw new Error("OpenAI API key fehlt lokal.")
        },
      },
    )

    assert.equal(response.status, 200)
    const body = await response.json()
    assert.equal(body.userId, "user-42")
    assert.equal(body.prompt, "Eigenes Prompt")
    assert.equal(body.results.length, 2)
    assert.equal(body.results[0].system, "current")
    assert.equal(body.results[1].system, "agent")
    assert.equal(body.results[1].error, "OpenAI API key fehlt lokal.")
  }))

test("judgment route accepts a valid compare judgment in development", async () =>
  withNodeEnv("development", async () => {
    const { handleAgentCompareJudgmentRequest } = await importJudgmentRoute()
    let appended = false

    const response = await handleAgentCompareJudgmentRequest(
      {
        createdAt: "2026-04-24T10:00:00.000Z",
        user: {
          id: "user-42",
          label: "Lea · fine",
          full_name: "Lea",
        },
        prompt: "Eigenes Prompt",
        context: {
          user_id: "user-42",
          derived_signals: ["Haardicke: Fein"],
          routine_inventory: [],
          relevant_memory: [],
        },
        results: {
          current: {
            system: "current",
            answer: "A",
            latency_ms: 100,
            debug_lines: [],
            matched_products: [],
            error: null,
          },
          agent: {
            system: "agent",
            answer: "B",
            latency_ms: 90,
            debug_lines: [],
            matched_products: [],
            error: null,
          },
        },
        judgment: {
          winner: "agent",
          primary_reason: "nuetzlicher",
          note: "besser",
        },
      },
      {
        appendJudgmentLog: async () => {
          appended = true
        },
      },
    )

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { ok: true })
    assert.equal(appended, true)
  }))

test("judgment POST accepts a valid compare record in development", async () =>
  withNodeEnv("development", async () => {
    const { handleAgentCompareJudgmentRequest } = await importJudgmentRoute()
    const savedPayloads: unknown[] = []

    const response = await handleAgentCompareJudgmentRequest(
      {
        createdAt: "2026-04-24T08:00:00.000Z",
        user: {
          id: "user-42",
          label: "Lea · fein · trocken",
          full_name: "Lea",
        },
        prompt: "Welche Pflege passt zu mir?",
        context: {
          user_id: "user-42",
          derived_signals: ["Haardicke: Fein"],
          routine_inventory: [
            { category: "conditioner", product_name: "Soft Care", frequency_range: "2_3x" },
          ],
          relevant_memory: [
            { id: "memory-1", kind: "preference", content: "Routine soll einfach sein." },
          ],
        },
        results: {
          current: {
            system: "current",
            answer: "Aktuelles System",
            latency_ms: 120,
            debug_lines: [],
            matched_products: [],
            error: null,
          },
          agent: {
            system: "agent",
            answer: "Neuer Agent",
            latency_ms: 90,
            debug_lines: [],
            matched_products: [],
            error: null,
          },
        },
        judgment: {
          winner: "agent",
          primary_reason: "nuetzlicher",
          note: "Antwortet direkter.",
        },
      },
      {
        appendJudgmentLog: async (payload) => {
          savedPayloads.push(payload)
        },
      },
    )

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { ok: true })
    assert.equal(savedPayloads.length, 1)
  }))
