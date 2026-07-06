import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const mutableEnv = process.env as Record<string, string | undefined>

async function importRoute() {
  return import("../src/app/api/labs/agent-compare/route")
}

async function importJudgmentRoute() {
  return import("../src/app/api/labs/agent-compare/judgments/route")
}

async function importCompareLab() {
  return import("../src/components/labs/agent-compare-lab")
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

test("compare lab route keeps heavy dev-only runners behind dynamic imports", async () => {
  const routeSource = await readFile("src/app/api/labs/agent-compare/route.ts", "utf8")

  assert.doesNotMatch(routeSource, /import .*run-agent-v2/)
  assert.doesNotMatch(routeSource, /import .*run-agentic-tool-loop/)
  assert.doesNotMatch(routeSource, /import .*run-shadow-agent/)
  assert.doesNotMatch(routeSource, /from \"@\/lib\/agent\/compare\/run-compare\"/)
  assert.match(routeSource, /await import\(\"@\/lib\/agent-v2\/compare\/run-agent-v2\"\)/)
  assert.match(routeSource, /await import\(\"@\/lib\/agent\/compare\/run-agentic-tool-loop\"\)/)
  assert.doesNotMatch(routeSource, /import\(path\)/)
})

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
            { category: "shampoo", product_name: "Soft Wash", frequency_range: "weekly_2x" },
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

test("POST rejects whitespace-only prompts and turns before calling compare execution", async () =>
  withNodeEnv("development", async () => {
    const { handleAgentCompareRequest } = await importRoute()
    let runnerCalls = 0
    const response = await handleAgentCompareRequest(
      { userId: "user-42", prompt: "   ", turns: ["\t  "] },
      {
        listEligibleCompareUsers: async () => [],
        loadCompareUserSnapshot: async () => {
          throw new Error("not used")
        },
        runCurrentComparisonForUser: async () => {
          runnerCalls += 1
          throw new Error("not used")
        },
        runShadowComparisonForUser: async () => {
          runnerCalls += 1
          throw new Error("not used")
        },
      },
    )

    assert.equal(response.status, 400)
    assert.match((await response.json()).error, /Ungueltige/)
    assert.equal(runnerCalls, 0)
  }))

test("handleAgentCompareRequest defaults to AgentV2 CareBalance production path", async () =>
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
        runAgentV2CareBalanceComparisonForUser: async ({ userId, prompt }) => ({
          system: "agent_v2_care_balance",
          answer: `AgentV2 CareBalance Antwort fuer ${userId}: ${prompt}`,
          latency_ms: 95,
          debug_lines: [],
          matched_products: [],
          error: null,
        }),
      },
    )

    assert.equal(response.status, 200)
    const body = await response.json()
    assert.equal(body.userId, "user-42")
    assert.equal(body.prompt, "Eigenes Prompt")
    assert.equal(body.toolLoopVariant, "guidance_tool")
    assert.equal(body.results.length, 1)
    assert.equal(body.results[0].system, "agent_v2_care_balance")
    assert.equal(body.results[0].display_label, "AgentV2 GPT-5.4-mini + CareBalance")
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
        systems: ["classic", "tool_loop"],
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

test("handleAgentCompareRequest preserves AgentV2 request interpretation trace in blinded mode", async () =>
  withNodeEnv("development", async () => {
    const { handleAgentCompareRequest } = await importRoute()
    const response = await handleAgentCompareRequest(
      {
        userId: "user-42",
        prompt: "Zeig mir bitte zwei Conditioner.",
        blinded: true,
        systems: ["tool_loop", "agent_v2"],
      },
      {
        listEligibleCompareUsers: async () => [],
        loadCompareUserSnapshot: async () => {
          throw new Error("not used")
        },
        runCurrentComparisonForUser: async () => {
          throw new Error("not used")
        },
        runShadowComparisonForUser: async () => ({
          system: "tool_loop",
          answer: "Tool Loop Antwort",
          latency_ms: 120,
          debug_lines: [],
          matched_products: [],
          error: null,
        }),
        runAgentV2ComparisonForUser: async () => ({
          system: "agent_v2",
          answer: "AgentV2 Antwort",
          latency_ms: 90,
          debug_lines: [],
          matched_products: [],
          agent_v2_trace: {
            engine: "agent_v2",
            model: "gpt-5.4-mini",
            endpoint: "responses",
            reasoning_effort: "low",
            safety_mode: "normal",
            answer_mode: "product_recommendation",
            named_product_context: null,
            request_interpretation_summary:
              "Intent: product_recommendation · specific_products · conditioner · 2 exact · confidence 0.91",
            request_interpretation: {
              primary_intent: "product_recommendation",
              product_request_kind: "specific_products",
              routine_intent: "none",
              care_category: "conditioner",
              requested_product_count: 2,
              count_policy: "exact",
              evidence_quote: "zwei Conditioner",
              specific_product_candidate: false,
              confidence: 0.91,
            },
            validation_warnings: [
              {
                validator_id: "unnecessary_product_tool_call",
                message: "Unnecessary tool call: load_advisor_guidance",
                severity: "warn",
              },
            ],
            bounded_repair_kind: "terminal_only",
            response_ids: ["resp_1"],
            tool_calls: [{ call_id: "call_products", name: "select_products" }],
            loaded_guidance_package_ids: [],
            model_steps: [{ response_id: "resp_1" }],
            blocked_tool_calls: [],
            validation_errors: [],
            repair_attempts: [
              {
                reason: "validation_failed",
                validation_errors: [],
              },
            ],
            routine_thread_context_active: false,
            routine_thread_context: null,
            final_product_ids: [],
            routine_layer: null,
            session_memory_writes: [],
            dropped_session_memory_writes: [],
            injected_session_memory: [],
            langfuse: {
              enabled: false,
              trace_id: null,
              trace_url: null,
            },
            failure_stage: null,
          },
          error: null,
        }),
      },
    )

    assert.equal(response.status, 200)
    const body = await response.json()
    assert.deepEqual(
      body.results.map((entry: { display_label: string }) => entry.display_label),
      ["Variante A", "Variante B"],
    )
    const agentV2Result = body.results.find(
      (entry: { system: string }) => entry.system === "agent_v2",
    )
    assert.equal(
      agentV2Result?.agent_v2_trace.request_interpretation_summary,
      "Intent: product_recommendation · specific_products · conditioner · 2 exact · confidence 0.91",
    )
    assert.deepEqual(agentV2Result?.agent_v2_trace.validation_warnings, [
      {
        validator_id: "unnecessary_product_tool_call",
        message: "Unnecessary tool call: load_advisor_guidance",
        severity: "warn",
      },
    ])
    assert.equal(agentV2Result?.agent_v2_trace.bounded_repair_kind, "terminal_only")
  }))

test("handleAgentCompareRequest compares AgentV2 baseline with AgentV2 CareBalance variant", async () =>
  withNodeEnv("development", async () => {
    const { handleAgentCompareRequest } = await importRoute()
    const seen: string[] = []
    const response = await handleAgentCompareRequest(
      {
        userId: "user-42",
        prompt: "Welches Oel passt bei Build-up und taeglicher Oel-Nutzung?",
        systems: ["agent_v2", "agent_v2_care_balance"],
      },
      {
        listEligibleCompareUsers: async () => [],
        loadCompareUserSnapshot: async () => {
          throw new Error("not used")
        },
        runCurrentComparisonForUser: async () => {
          throw new Error("classic should not run")
        },
        runShadowComparisonForUser: async () => {
          throw new Error("tool loop should not run")
        },
        runAgentV2ComparisonForUser: async () => {
          seen.push("baseline")
          return {
            system: "agent_v2",
            answer: "AgentV2 Antwort",
            latency_ms: 90,
            debug_lines: [],
            matched_products: [],
            error: null,
          }
        },
        runAgentV2CareBalanceComparisonForUser: async () => {
          seen.push("care_balance")
          return {
            system: "agent_v2_care_balance",
            answer: "AgentV2 CareBalance Antwort",
            latency_ms: 95,
            debug_lines: [],
            matched_products: [],
            care_balance_trace: {
              mode: "production_decision_context",
              authority: {
                product_truth: false,
                persistent_routine_storage: false,
                current_turn_category_decision: true,
                soft_product_ranking_hints: true,
              },
              rows: [],
              comparison: null,
              current_turn_facts: [],
              conflicts: [],
            },
            error: null,
          }
        },
      },
    )

    assert.equal(response.status, 200)
    const body = await response.json()
    assert.deepEqual(seen, ["baseline", "care_balance"])
    assert.deepEqual(
      body.results.map((entry: { system: string; display_label: string }) => [
        entry.system,
        entry.display_label,
      ]),
      [
        ["agent_v2", "AgentV2 GPT-5.4-mini"],
        ["agent_v2_care_balance", "AgentV2 GPT-5.4-mini + CareBalance"],
      ],
    )
    assert.equal(body.results[1].care_balance_trace.mode, "production_decision_context")
    assert.equal(body.results[1].care_balance_trace.authority.current_turn_category_decision, true)
  }))

test("handleAgentCompareRequest can run AgentV2 CareBalance as the only compare system", async () =>
  withNodeEnv("development", async () => {
    const { handleAgentCompareRequest } = await importRoute()
    let legacyCalls = 0
    let careBalanceCalls = 0
    const response = await handleAgentCompareRequest(
      {
        userId: "user-42",
        prompt: "Muss ich K18 auswaschen und wie oft soll ich es benutzen?",
        blinded: false,
        systems: ["agent_v2_care_balance"],
      },
      {
        listEligibleCompareUsers: async () => [],
        loadCompareUserSnapshot: async () => {
          throw new Error("not used")
        },
        runCurrentComparisonForUser: async () => {
          legacyCalls += 1
          throw new Error("classic should not run")
        },
        runShadowComparisonForUser: async () => {
          legacyCalls += 1
          throw new Error("tool loop should not run")
        },
        runAgentV2CareBalanceComparisonForUser: async () => {
          careBalanceCalls += 1
          return {
            system: "agent_v2_care_balance",
            answer: "AgentV2 CareBalance Antwort",
            latency_ms: 90,
            debug_lines: [],
            matched_products: [],
            error: null,
          }
        },
      },
    )

    assert.equal(response.status, 200)
    const body = await response.json()
    assert.equal(legacyCalls, 0)
    assert.equal(careBalanceCalls, 1)
    assert.equal(body.blinded, undefined)
    assert.deepEqual(
      body.results.map((entry: { system: string; display_label: string }) => [
        entry.system,
        entry.display_label,
      ]),
      [["agent_v2_care_balance", "AgentV2 GPT-5.4-mini + CareBalance"]],
    )
  }))

test("compare lab rejects saving stale results for a different loaded user", async () => {
  const { canSaveAgentCompareJudgment } = await importCompareLab()
  const result = {
    userId: "user-a",
    prompt: "Welches Shampoo passt?",
    results: [],
  }
  const option = {
    id: "user-b",
    label: "Mara · curly",
    full_name: "Mara",
  }
  const context = {
    user_id: "user-b",
    derived_signals: [],
    routine_inventory: [],
    relevant_memory: [],
  }
  const currentResult = {
    system: "classic" as const,
    answer: "A",
    latency_ms: 100,
    debug_lines: [],
    matched_products: [],
    error: null,
  }
  const agentResult = {
    system: "tool_loop" as const,
    answer: "B",
    latency_ms: 90,
    debug_lines: [],
    matched_products: [],
    error: null,
  }

  assert.equal(
    canSaveAgentCompareJudgment({
      result,
      selectedUser: context,
      selectedUserOption: option,
      currentResult,
      agentResult,
    }),
    false,
  )
})

test("compare lab allows saving AgentV2 CareBalance-only review results", async () => {
  const { canSaveAgentCompareJudgment } = await importCompareLab()
  const agentResult = {
    system: "agent_v2_care_balance" as const,
    answer: "A",
    latency_ms: 100,
    debug_lines: [],
    matched_products: [],
    error: null,
  }
  const result = {
    userId: "user-a",
    prompt: "Was waere der naechste beste Schritt?",
    results: [agentResult],
  }
  const option = {
    id: "user-a",
    label: "Nick · straight · fine",
    full_name: "Nick",
  }
  const context = {
    user_id: "user-a",
    derived_signals: [],
    routine_inventory: [],
    relevant_memory: [],
  }

  assert.equal(
    canSaveAgentCompareJudgment({
      result,
      selectedUser: context,
      selectedUserOption: option,
      currentResult: null,
      agentResult,
    }),
    true,
  )
})

test("compare lab coerces impossible stale current winners to tie", async () => {
  const { normalizeWinnerForResults } = await importCompareLab()

  assert.equal(normalizeWinnerForResults("current", null), "tie")
  assert.equal(
    normalizeWinnerForResults("current", {
      system: "classic",
      answer: "A",
      latency_ms: 100,
      debug_lines: [],
      matched_products: [],
      error: null,
    }),
    "current",
  )
  assert.equal(normalizeWinnerForResults("agent", null), "agent")
})

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

test("judgment route rejects stale current winner without a current result", async () =>
  withNodeEnv("development", async () => {
    const { handleAgentCompareJudgmentRequest } = await importJudgmentRoute()
    let appended = false

    const response = await handleAgentCompareJudgmentRequest(
      {
        createdAt: "2026-05-28T10:00:00.000Z",
        user: {
          id: "user-42",
          label: "Nick · straight · fine",
          full_name: "Nick",
        },
        prompt: "Was waere der naechste beste Schritt?",
        context: {
          user_id: "user-42",
          derived_signals: [],
          routine_inventory: [],
          relevant_memory: [],
        },
        results: {
          agent: {
            system: "agent_v2_care_balance",
            answer: "AgentV2 CareBalance Antwort",
            latency_ms: 95,
            debug_lines: [],
            matched_products: [],
            error: null,
          },
        },
        judgment: {
          winner: "current",
          primary_reason: "nuetzlicher",
          note: "stale UI state",
        },
      },
      {
        appendJudgmentLog: async () => {
          appended = true
        },
      },
    )

    assert.equal(response.status, 400)
    assert.match((await response.json()).error, /Ungueltiges/)
    assert.equal(appended, false)
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

test("judgment route accepts legacy Oel-Zweck missing-info labels", async () =>
  withNodeEnv("development", async () => {
    const { handleAgentCompareJudgmentRequest } = await importJudgmentRoute()
    const savedPayloads: unknown[] = []

    const response = await handleAgentCompareJudgmentRequest(
      {
        createdAt: "2026-06-01T12:00:00.000Z",
        user: {
          id: "user-42",
          label: "Lea · fine",
          full_name: "Lea",
        },
        prompt: "Welches Öl passt?",
        toolLoopVariant: "guidance_tool",
        context: {
          user_id: "user-42",
          derived_signals: ["Haardicke: Fein"],
          routine_inventory: [],
          relevant_memory: [],
        },
        results: {
          agent: {
            system: "tool_loop",
            answer: "B",
            latency_ms: 90,
            debug_lines: [],
            matched_products: [],
            product_trace: {
              category: "oil",
              decision: "needs_more_info",
              product_response_policy: "needs_more_info",
              policy_reason: "Öl-Zweck fehlt.",
              profile_basis: ["Haardicke: Fein"],
              category_guidance: "Öl-Auswahl braucht den Zweck.",
              products: [],
              comparison_facts: null,
              missing_info: [
                {
                  key: "oil_purpose",
                  label: "Oel-Zweck",
                  blocking: true,
                  detail: "Es fehlt noch dein Öl-Zweck für die Öl-Auswahl.",
                },
              ],
              unsupported_requested_signals: [],
            },
            error: null,
          },
        },
        judgment: {
          winner: "agent",
          primary_reason: "nuetzlicher",
          note: "Legacy label accepted.",
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
    assert.equal(
      (
        savedPayloads[0] as {
          results: { agent: { product_trace: { missing_info: Array<{ label: string }> } } }
        }
      ).results.agent.product_trace.missing_info[0].label,
      "Öl-Zweck",
    )
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
            { category: "conditioner", product_name: "Soft Care", frequency_range: "weekly_2x" },
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

test("judgment POST accepts AgentV2 compare systems and metrics", async () =>
  withNodeEnv("development", async () => {
    const { handleAgentCompareJudgmentRequest } = await importJudgmentRoute()
    const savedPayloads: unknown[] = []

    const response = await handleAgentCompareJudgmentRequest(
      {
        createdAt: "2026-05-15T10:00:00.000Z",
        user: {
          id: "user-42",
          label: "Lea · fein · trocken",
          full_name: "Lea",
        },
        prompt: "Routine verbessern",
        toolLoopVariant: "guidance_tool",
        context: {
          user_id: "user-42",
          derived_signals: ["Haardicke: Fein"],
          routine_inventory: [],
          relevant_memory: [],
        },
        results: {
          current: {
            system: "tool_loop",
            answer: "Tool Loop Antwort",
            latency_ms: 120,
            debug_lines: [],
            matched_products: [],
            error: null,
          },
          agent: {
            system: "agent_v2",
            answer: "AgentV2 Antwort",
            latency_ms: 90,
            debug_lines: [],
            matched_products: [],
            agent_v2_trace: {
              model_steps: [{ response_id: "resp_1" }],
              tool_calls: [{ name: "load_advisor_guidance" }],
            },
            error: null,
          },
        },
        judgment: {
          winner: "agent",
          primary_reason: "nuetzlicher",
          note: "Besser.",
          failure_bucket: "none",
          critical_product_claim_failure: false,
        },
        rollout_metrics: {
          blinded_winner: "agent_v2",
          failure_bucket: "none",
          critical_product_claim_failure: false,
          latency_ms: {
            tool_loop: 120,
            agent_v2: 90,
          },
          tool_loop_model_steps: null,
          tool_loop_tool_calls: null,
          agent_v2_model_steps: 1,
          agent_v2_tool_calls: 1,
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
    const saved = savedPayloads[0] as {
      results: { current: { system: string }; agent: { system: string } }
      rollout_metrics?: unknown
    }
    assert.equal(saved.results.current.system, "tool_loop")
    assert.equal(saved.results.agent.system, "agent_v2")
    assert.deepEqual(saved.rollout_metrics, {
      blinded_winner: "agent_v2",
      failure_bucket: "none",
      critical_product_claim_failure: false,
      latency_ms: {
        tool_loop: 120,
        agent_v2: 90,
      },
      tool_loop_model_steps: null,
      tool_loop_tool_calls: null,
      agent_v2_model_steps: 1,
      agent_v2_tool_calls: 1,
    })
  }))

test("judgment POST accepts AgentV2 CareBalance-only review records and metrics", async () =>
  withNodeEnv("development", async () => {
    const { handleAgentCompareJudgmentRequest } = await importJudgmentRoute()
    const savedPayloads: unknown[] = []

    const response = await handleAgentCompareJudgmentRequest(
      {
        createdAt: "2026-05-26T10:00:00.000Z",
        user: {
          id: "user-42",
          label: "Nick · straight · fine",
          full_name: "Nick",
        },
        prompt: "Was waere der naechste beste Schritt?",
        toolLoopVariant: "guidance_tool",
        context: {
          user_id: "user-42",
          derived_signals: ["Haardicke: Fein"],
          routine_inventory: [],
          relevant_memory: [],
        },
        results: {
          agent: {
            system: "agent_v2_care_balance",
            answer: "AgentV2 CareBalance Antwort",
            latency_ms: 95,
            debug_lines: [],
            matched_products: [],
            agent_v2_trace: {
              model_steps: [{ response_id: "resp_1" }, { response_id: "resp_2" }],
              tool_calls: [{ name: "load_advisor_guidance" }, { name: "select_products" }],
            },
            error: null,
          },
        },
        judgment: {
          winner: "agent",
          primary_reason: "nuetzlicher",
          note: "Single-system review.",
          failure_bucket: "other",
          critical_product_claim_failure: false,
        },
        rollout_metrics: {
          blinded_winner: "agent_v2_care_balance",
          failure_bucket: "other",
          critical_product_claim_failure: false,
          latency_ms: {
            agent_v2_care_balance: 95,
          },
          tool_loop_model_steps: null,
          tool_loop_tool_calls: null,
          agent_v2_care_balance_model_steps: 2,
          agent_v2_care_balance_tool_calls: 2,
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
    const saved = savedPayloads[0] as {
      results: { current?: { system: string }; agent: { system: string } }
      rollout_metrics?: unknown
    }
    assert.equal(saved.results.current, undefined)
    assert.equal(saved.results.agent.system, "agent_v2_care_balance")
    assert.deepEqual(saved.rollout_metrics, {
      blinded_winner: "agent_v2_care_balance",
      failure_bucket: "other",
      critical_product_claim_failure: false,
      latency_ms: {
        agent_v2_care_balance: 95,
      },
      tool_loop_model_steps: null,
      tool_loop_tool_calls: null,
      agent_v2_care_balance_model_steps: 2,
      agent_v2_care_balance_tool_calls: 2,
    })
  }))

test("analysis snapshot extracts AgentV2 trace tool calls and guidance ids", async () => {
  const { buildCompareAnalysisSnapshot } = await importCompareLab()
  const snapshot = buildCompareAnalysisSnapshot({
    userLabel: "Lea · fein",
    includeSystem: true,
    result: {
      prompt: "Welches Produkt genau?",
      blinded: false,
      toolLoopVariant: "guidance_tool",
      results: [
        {
          system: "agent_v2",
          answer: "Antwort",
          latency_ms: 123,
          debug_lines: [],
          matched_products: [],
          agent_v2_trace: {
            engine: "agent_v2",
            model: "gpt-5.4-mini",
            endpoint: "responses",
            reasoning_effort: "low",
            safety_mode: "normal",
            answer_mode: null,
            named_product_context: null,
            request_interpretation_summary: null,
            request_interpretation: null,
            validation_warnings: [],
            bounded_repair_kind: null,
            response_ids: ["resp_1"],
            tool_calls: [
              {
                call_id: "call_guidance",
                name: "load_advisor_guidance",
                output_summary: "guidance_ids=base.product_recommendation.v1, category.leave_in.v1",
              },
              { call_id: "call_products", name: "select_products", output_summary: "products=3" },
            ],
            loaded_guidance_package_ids: ["base.product_recommendation.v1", "category.leave_in.v1"],
            model_steps: [{ response_id: "resp_1" }],
            blocked_tool_calls: [],
            validation_errors: [],
            repair_attempts: [],
            routine_thread_context_active: false,
            routine_thread_context: null,
            final_product_ids: [],
            routine_layer: null,
            session_memory_writes: [],
            dropped_session_memory_writes: [],
            injected_session_memory: [],
            langfuse: {
              enabled: false,
              trace_id: null,
              trace_url: null,
            },
            failure_stage: null,
          },
          error: null,
        },
      ],
    },
  })

  assert.deepEqual(snapshot.results[0]?.tool_calls, ["load_advisor_guidance", "select_products"])
  assert.deepEqual(snapshot.results[0]?.guidance_ids, [
    "base.product_recommendation.v1",
    "category.leave_in.v1",
  ])
})

test("AgentV2 trace display data separates warnings from fatal validation errors", async () => {
  const { buildAgentV2TraceDisplayData } = await importCompareLab()
  const display = buildAgentV2TraceDisplayData({
    engine: "agent_v2",
    model: "gpt-5.4-mini",
    endpoint: "responses",
    reasoning_effort: "low",
    safety_mode: "normal",
    answer_mode: "product_recommendation",
    named_product_context: null,
    request_interpretation_summary:
      "Intent: product_recommendation · specific_products · conditioner · 2 exact · confidence 0.91",
    request_interpretation: {
      primary_intent: "product_recommendation",
      product_request_kind: "specific_products",
      routine_intent: "none",
      care_category: "conditioner",
      requested_product_count: 2,
      count_policy: "exact",
      evidence_quote: "zwei Conditioner",
      specific_product_candidate: false,
      confidence: 0.91,
    },
    validation_warnings: [
      {
        validator_id: "unnecessary_product_tool_call",
        message: "Unnecessary tool call: load_advisor_guidance",
        severity: "warn",
      },
    ],
    bounded_repair_kind: null,
    response_ids: [],
    tool_calls: [],
    loaded_guidance_package_ids: [],
    model_steps: [],
    blocked_tool_calls: [],
    validation_errors: [
      { validator_id: "known_product_ids", message: "Unknown product id", severity: "block" },
    ],
    repair_attempts: [],
    routine_thread_context_active: false,
    routine_thread_context: null,
    final_product_ids: [],
    routine_layer: null,
    session_memory_writes: [],
    dropped_session_memory_writes: [],
    injected_session_memory: [],
    langfuse: {
      enabled: false,
      trace_id: null,
      trace_url: null,
    },
    failure_stage: null,
  })

  assert.equal(
    display.interpretationSummary,
    "Intent: product_recommendation · specific_products · conditioner · 2 exact · confidence 0.91",
  )
  assert.deepEqual(display.warnings, ["Unnecessary tool call: load_advisor_guidance"])
  assert.deepEqual(display.validationErrors, ["known_product_ids"])
})
