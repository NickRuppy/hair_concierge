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
    assert.equal(body.toolLoopVariant, "guidance_tool")
    assert.equal(body.results.length, 2)
    assert.equal(body.results[0].system, "classic")
    assert.equal(body.results[1].system, "tool_loop")
    assert.equal(body.results[1].error, "OpenAI API key fehlt lokal.")
  }))

test("handleAgentCompareRequest supports blinded multi-turn classic vs tool-loop runs", async () =>
  withNodeEnv("development", async () => {
    const { handleAgentCompareRequest } = await importRoute()
    const seenTurns: string[][] = []
    const seenVariants: Array<string | undefined> = []
    const consultationBrief = {
      charter: ["Answer the current user delta first."],
      routine_staging: [],
      product_vs_education: [],
      profile_overlays: [],
      candidate_guidance: [
        { id: "topic:shampoo", kind: "topic", title: "Shampoo", content: "Shampoo guidance" },
      ],
    }
    const response = await handleAgentCompareRequest(
      {
        userId: "user-42",
        turns: ["Ich will meine Routine vereinfachen.", "ok und welcges Shampoo?"],
        blinded: true,
        toolLoopVariant: "composer_context",
      },
      {
        listEligibleCompareUsers: async () => [],
        loadCompareUserSnapshot: async () => {
          throw new Error("not used")
        },
        runCurrentComparisonForUser: async ({ turns, toolLoopVariant }) => {
          seenTurns.push(turns ?? [])
          seenVariants.push(toolLoopVariant)
          return {
            system: "classic",
            answer: "Classic Antwort",
            latency_ms: 120,
            debug_lines: [],
            matched_products: [],
            error: null,
          }
        },
        runShadowComparisonForUser: async ({ turns, toolLoopVariant }) => {
          seenTurns.push(turns ?? [])
          seenVariants.push(toolLoopVariant)
          return {
            system: "tool_loop",
            answer: "Tool Loop Antwort",
            latency_ms: 90,
            debug_lines: ["tool_loop: select_products -> submit_final_answer"],
            matched_products: [{ name: "Light Shampoo", category: "shampoo" }],
            tool_loop_trace: {
              consultation_brief: consultationBrief,
              tool_calls: [{ name: "select_products" }],
            },
            error: null,
          }
        },
      },
    )

    assert.equal(response.status, 200)
    const body = await response.json()
    assert.deepEqual(body.turns, [
      "Ich will meine Routine vereinfachen.",
      "ok und welcges Shampoo?",
    ])
    assert.equal(body.prompt, "ok und welcges Shampoo?")
    assert.equal(body.blinded, true)
    assert.equal(body.toolLoopVariant, "composer_context")
    assert.deepEqual(seenTurns, [
      ["Ich will meine Routine vereinfachen.", "ok und welcges Shampoo?"],
      ["Ich will meine Routine vereinfachen.", "ok und welcges Shampoo?"],
    ])
    assert.deepEqual(seenVariants, ["composer_context", "composer_context"])
    assert.deepEqual(
      body.results.map((entry: { display_label: string }) => entry.display_label),
      ["Variante A", "Variante B"],
    )
    assert.deepEqual([...body.results.map((entry: { system: string }) => entry.system)].sort(), [
      "classic",
      "tool_loop",
    ])
    const toolLoopResult = body.results.find(
      (entry: { system: string }) => entry.system === "tool_loop",
    )
    assert.deepEqual(toolLoopResult?.tool_loop_trace?.consultation_brief, consultationBrief)
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

test("judgment route accepts the guidance-tool compare variant", async () =>
  withNodeEnv("development", async () => {
    const { handleAgentCompareJudgmentRequest } = await importJudgmentRoute()
    let appended = false

    const response = await handleAgentCompareJudgmentRequest(
      {
        createdAt: "2026-05-11T12:00:00.000Z",
        user: {
          id: "user-42",
          label: "Lea · fine",
          full_name: "Lea",
        },
        prompt: "Brauche ich Leave-in?",
        toolLoopVariant: "guidance_tool",
        context: {
          user_id: "user-42",
          derived_signals: ["Haardicke: Fein"],
          routine_inventory: [],
          relevant_memory: [],
        },
        results: {
          current: {
            system: "classic",
            answer: "A",
            latency_ms: 100,
            debug_lines: [],
            matched_products: [],
            error: null,
          },
          agent: {
            system: "tool_loop",
            answer: "B",
            latency_ms: 90,
            debug_lines: ["tool_loop_variant: guidance_tool"],
            matched_products: [],
            product_trace: {
              category: "shampoo",
              decision: "recommended",
              product_response_policy: "recommend_with_caveat",
              policy_reason: "Shampoo ist nicht der staerkste Hebel fuer Laengen-Ziele.",
              profile_basis: ["Haardicke: Fein"],
              category_guidance: "Shampoo kann empfohlen werden, aber Laengenpflege ist staerker.",
              products: [],
              comparison_facts: null,
              missing_info: [],
              unsupported_requested_signals: [],
            },
            tool_loop_trace: {
              advisor_guidance: {
                loaded_guidance_ids: ["topic:leave_in"],
              },
            },
            error: null,
          },
        },
        judgment: {
          winner: "agent",
          primary_reason: "nuetzlicher",
          note: "mehr Kontext",
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

test("judgment route accepts heat temperature as an unsupported requested signal", async () =>
  withNodeEnv("development", async () => {
    const { handleAgentCompareJudgmentRequest } = await importJudgmentRoute()
    let appended = false

    const unsupportedHeatSignal = {
      field: "heat_temperature",
      value: "180 Grad",
      reason: "no_structured_product_data",
      user_message: "Ich style bei 180 Grad. Welches Leave-in passt?",
    }

    const response = await handleAgentCompareJudgmentRequest(
      {
        createdAt: "2026-05-12T12:00:00.000Z",
        user: {
          id: "user-42",
          label: "Lea · fine",
          full_name: "Lea",
        },
        prompt: unsupportedHeatSignal.user_message,
        toolLoopVariant: "guidance_tool",
        context: {
          user_id: "user-42",
          derived_signals: ["Haardicke: Fein"],
          routine_inventory: [],
          relevant_memory: [],
        },
        results: {
          current: {
            system: "classic",
            answer: "A",
            latency_ms: 100,
            debug_lines: [],
            matched_products: [],
            error: null,
          },
          agent: {
            system: "tool_loop",
            answer: "B",
            latency_ms: 90,
            debug_lines: [],
            matched_products: [],
            product_trace: {
              category: "leave_in",
              decision: "recommended",
              product_response_policy: "recommend",
              policy_reason: "Explicit leave-in product ask.",
              profile_basis: ["Haardicke: Fein"],
              category_guidance: "Leave-in kann als leichter Schutz-/Styling-Booster passen.",
              products: [
                {
                  rank: 1,
                  product_id: "leave-in-1",
                  name: "Light Leave-in",
                  brand: "Test",
                  price_eur: null,
                  currency: null,
                  fit_reason: "Leichte Textur.",
                  caveat: null,
                  supported_claims: [],
                  unsupported_requested_signals: [unsupportedHeatSignal],
                },
              ],
              comparison_facts: null,
              missing_info: [],
              unsupported_requested_signals: [unsupportedHeatSignal],
            },
            error: null,
          },
        },
        judgment: {
          winner: "agent",
          primary_reason: "nuetzlicher",
          note: "Heat temperature is captured as unsupported structured data.",
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
          failure_bucket: "tool_not_called",
          critical_product_claim_failure: false,
        },
        rollout_metrics: {
          blinded_winner: "tool_loop",
          failure_bucket: "tool_not_called",
          critical_product_claim_failure: false,
          latency_ms: {
            classic: 120,
            tool_loop: 90,
          },
          tool_loop_model_steps: 2,
          tool_loop_tool_calls: 1,
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
    assert.deepEqual((savedPayloads[0] as { rollout_metrics?: unknown }).rollout_metrics, {
      blinded_winner: "tool_loop",
      failure_bucket: "tool_not_called",
      critical_product_claim_failure: false,
      latency_ms: {
        classic: 120,
        tool_loop: 90,
      },
      tool_loop_model_steps: 2,
      tool_loop_tool_calls: 1,
    })
  }))
