import assert from "node:assert/strict"
import test from "node:test"

import type { AgentModelClient } from "../src/lib/agent/orchestrator/model-client"
import {
  deriveRequestedGoal,
  runShadowAgentTurn,
} from "../src/lib/agent/orchestrator/run-shadow-agent-turn"

test("deriveRequestedGoal detects German shine intent with and without umlauts", () => {
  assert.equal(deriveRequestedGoal("Ich will mehr Glanz."), "shine")
  assert.equal(deriveRequestedGoal("Wie werden meine Haare glaenzender?"), "shine")
  assert.equal(deriveRequestedGoal("Wie werden meine Haare glänzender?"), "shine")
})

test("runShadowAgentTurn executes tool calls and stops on final answer", async () => {
  const selectProductsInputs: Record<string, unknown>[] = []
  const fakeModel: AgentModelClient = {
    async classifyRoute() {
      return {
        user_job: "product_pick" as const,
        product_category: "shampoo" as const,
        requested_overlay_ids: [],
        requested_topic_ids: [],
        requested_routine_id: null,
        concerns: [],
        confidence: 0.94,
        evidence: ["User asks which shampoo fits."],
        ambiguity: null,
      }
    },
    async renderFinalAnswer({ packet }) {
      assert.equal(packet.route.user_job, "product_pick")
      assert.deepEqual(packet.route.guidance_ids, [
        "playbook:recommend_products",
        "overlay:fine_hair",
      ])
      assert.equal(packet.selected_products?.category, "shampoo")
      assert.equal(packet.selected_products?.product_response_policy, "redirect_to_better_lever")
      assert.match(packet.selected_products?.policy_reason ?? "", /Shampoo/)
      return "Ich wuerde mit der leichteren Shampoo-Option starten."
    },
  }

  const result = await runShadowAgentTurn({
    message: "Welches Shampoo gibt meinem feinen Haar mehr Glanz?",
    modelClient: fakeModel,
    tools: {
      get_user_context: async () => ({ suggested_overlays: ["overlay:fine_hair"] }),
      load_guidance: async () => ({ items: [] }),
      select_products: async (input) => {
        selectProductsInputs.push(input)

        return {
          category: input.category,
          decision: "not_recommended",
          product_response_policy: "redirect_to_better_lever",
          policy_reason: "Shampoo ist nicht der erste Hebel.",
          profile_basis: [],
          category_guidance: "",
          products: [{ rank: 1, name: "Light Shampoo" }],
          comparison_facts: null,
          missing_info: [],
        }
      },
      build_or_fix_routine: async () => ({ steps: [] }),
    },
  })

  assert.equal(selectProductsInputs[0]?.requestedGoal, "shine")
  assert.equal(result.final_answer, "Ich wuerde mit der leichteren Shampoo-Option starten.")
  assert.deepEqual(
    result.tool_calls.map((call) => call.name),
    ["get_user_context", "load_guidance", "select_products"],
  )
  assert.equal(result.route_trace.user_job, "product_pick")
  assert.equal(result.route_trace.required_playbook_id, "playbook:recommend_products")
})

test("runShadowAgentTurn throws when a required runtime tool is missing", async () => {
  const fakeModel: AgentModelClient = {
    async classifyRoute() {
      return {
        user_job: "product_pick" as const,
        product_category: "shampoo" as const,
        requested_overlay_ids: [],
        requested_topic_ids: [],
        requested_routine_id: null,
        concerns: [],
        confidence: 0.94,
        evidence: [],
        ambiguity: null,
      }
    },
    async renderFinalAnswer() {
      return "never reached"
    },
  }

  await assert.rejects(
    () =>
      runShadowAgentTurn({
        message: "Teste den Guard.",
        modelClient: fakeModel,
        tools: {
          load_guidance: async () => ({ items: [] }),
          select_products: async () => ({ recommended: [] }),
          build_or_fix_routine: async () => ({ steps: [] }),
        } as never,
      }),
    /Unknown tool: get_user_context/,
  )
})

test("runShadowAgentTurn keeps usage answers off product tools", async () => {
  const fakeModel: AgentModelClient = {
    async classifyRoute() {
      return {
        user_job: "usage" as const,
        product_category: "shampoo" as const,
        requested_overlay_ids: [],
        requested_topic_ids: ["topic:cwc_owc" as const],
        requested_routine_id: null,
        concerns: ["dry_lengths" as const],
        confidence: 0.91,
        evidence: ["User asks how to apply shampoo."],
        ambiguity: null,
      }
    },
    async renderFinalAnswer({ packet }) {
      assert.equal(packet.selected_products, null)
      assert.equal(packet.route.required_playbook_id, "playbook:usage_and_application")
      assert.deepEqual(packet.route.guidance_ids, [
        "playbook:usage_and_application",
        "topic:cwc_owc",
      ])
      return "Massiere Shampoo nur an der Kopfhaut ein."
    },
  }

  const result = await runShadowAgentTurn({
    message: "Wie soll ich mein Shampoo anwenden?",
    modelClient: fakeModel,
    tools: {
      get_user_context: async () => ({ suggested_overlays: [] }),
      load_guidance: async () => ({ items: [] }),
      select_products: async () => {
        throw new Error("select_products should not run")
      },
      build_or_fix_routine: async () => ({ steps: [] }),
    },
  })

  assert.equal(result.final_answer, "Massiere Shampoo nur an der Kopfhaut ein.")
  assert.deepEqual(
    result.tool_calls.map((call) => call.name),
    ["get_user_context", "load_guidance"],
  )
})

test("runShadowAgentTurn filters fallback products only from the renderer packet", async () => {
  const fakeModel: AgentModelClient = {
    async classifyRoute() {
      return {
        user_job: "product_pick" as const,
        product_category: "shampoo" as const,
        requested_overlay_ids: [],
        requested_topic_ids: [],
        requested_routine_id: null,
        concerns: ["oily_roots" as const],
        confidence: 0.94,
        evidence: ["User asks which shampoo fits."],
        ambiguity: null,
      }
    },
    async renderFinalAnswer({ packet }) {
      assert.deepEqual(
        packet.selected_products?.products.map((product) => product.product_id),
        ["p-1"],
      )
      assert.equal(JSON.stringify(packet.selected_products).includes("Fallback:"), false)
      assert.equal(packet.selected_products?.comparison_facts, null)
      assert.deepEqual(packet.selected_products?.unsupported_requested_signals, [])
      return "Ich zeige nur den sicheren Treffer."
    },
  }

  const result = await runShadowAgentTurn({
    message: "Mein Ansatz fettet schnell, welches Shampoo soll ich nehmen?",
    modelClient: fakeModel,
    tools: {
      get_user_context: async () => ({ suggested_overlays: [] }),
      load_guidance: async () => ({ items: [] }),
      select_products: async (input) => ({
        category: input.category,
        decision: "recommended",
        product_response_policy: "explain_then_recommend",
        policy_reason: "Shampoo kann beim fettenden Ansatz helfen.",
        profile_basis: [],
        category_guidance: "",
        products: [
          {
            rank: 1,
            product_id: "p-1",
            name: "Primary Shampoo",
            brand: null,
            fit_reason: "Passt zum Kopfhaut-Fokus.",
            caveat: null,
            supported_claims: [],
            unsupported_requested_signals: [],
          },
          {
            rank: 2,
            product_id: "p-2",
            name: "Fallback Shampoo",
            brand: null,
            fit_reason: "Fallback-Treffer.",
            caveat: "Fallback: Dieser Treffer passt nicht exakt zum abgeleiteten Shampoo-Fokus.",
            supported_claims: [],
            unsupported_requested_signals: [
              {
                field: "chemical_treatment",
                value: "colored",
                reason: "no_structured_product_data",
                user_message: "Zum Farbschutz habe ich aktuell keine sichere Produktangabe.",
              },
            ],
          },
          {
            rank: 3,
            product_id: "p-3",
            name: "Second Fallback Shampoo",
            brand: null,
            fit_reason: "Fallback-Treffer.",
            caveat: "Fallback: Dieser Treffer passt nicht exakt zum abgeleiteten Shampoo-Fokus.",
            supported_claims: [],
            unsupported_requested_signals: [],
          },
        ],
        comparison_facts: {
          "p-1": ["Fit: idealer Treffer"],
          "p-2": ["Fit: weicht ab", "Fallback: ja"],
          "p-3": ["Fit: weicht ab", "Fallback: ja"],
        },
        missing_info: [],
        unsupported_requested_signals: [
          {
            field: "chemical_treatment",
            value: "colored",
            reason: "no_structured_product_data",
            user_message: "Zum Farbschutz habe ich aktuell keine sichere Produktangabe.",
          },
        ],
      }),
      build_or_fix_routine: async () => ({ steps: [] }),
    },
  })

  const selectProductsCall = result.tool_calls.find((call) => call.name === "select_products")
  const rawOutput = selectProductsCall?.output as { products?: unknown[] } | undefined

  assert.equal(result.final_answer, "Ich zeige nur den sicheren Treffer.")
  assert.equal(rawOutput?.products?.length, 3)
})

test("runShadowAgentTurn preserves leave-in fallback products for caveated comparisons", async () => {
  const fakeModel: AgentModelClient = {
    async classifyRoute() {
      return {
        user_job: "product_pick" as const,
        product_category: "leave_in" as const,
        requested_overlay_ids: [],
        requested_topic_ids: [],
        requested_routine_id: null,
        concerns: [],
        confidence: 0.94,
        evidence: ["User asks which leave-in fits."],
        ambiguity: null,
      }
    },
    async renderFinalAnswer({ packet }) {
      assert.deepEqual(
        packet.selected_products?.products.map((product) => product.product_id),
        ["p-1", "p-2", "p-3"],
      )
      assert.deepEqual(packet.selected_products?.comparison_facts, {
        "p-1": ["Format: Lotion"],
        "p-2": ["Format: Creme"],
        "p-3": ["Format: Spray"],
      })
      assert.equal(
        packet.selected_products?.products.find((product) => product.product_id === "p-3")?.caveat,
        "Balance-Richtung ist nur als caveated Option passend.",
      )
      assert.equal(JSON.stringify(packet.selected_products).includes("Fallback:"), false)
      return "Ich zeige alle Leave-in-Optionen mit Caveat."
    },
  }

  const result = await runShadowAgentTurn({
    message: "Welches Leave-in passt mit Hitzeschutz?",
    modelClient: fakeModel,
    tools: {
      get_user_context: async () => ({ suggested_overlays: [] }),
      load_guidance: async () => ({ items: [] }),
      select_products: async (input) => ({
        category: input.category,
        decision: "recommended",
        product_response_policy: "recommend",
        policy_reason: "Leave-in passt.",
        profile_basis: [],
        category_guidance: "",
        products: [
          {
            rank: 1,
            product_id: "p-1",
            name: "Primary Leave-in",
            brand: null,
            fit_reason: "Passt.",
            caveat: null,
            supported_claims: [],
            unsupported_requested_signals: [],
          },
          {
            rank: 2,
            product_id: "p-2",
            name: "Cream Leave-in",
            brand: null,
            fit_reason: "Passt.",
            caveat: null,
            supported_claims: [],
            unsupported_requested_signals: [],
          },
          {
            rank: 3,
            product_id: "p-3",
            name: "Spray Leave-in",
            brand: null,
            fit_reason: "Nachgeordneter Treffer.",
            caveat: "Fallback: Balance-Richtung ist nur als caveated Option passend.",
            supported_claims: [],
            unsupported_requested_signals: [],
          },
        ],
        comparison_facts: {
          "p-1": ["Format: Lotion"],
          "p-2": ["Format: Creme"],
          "p-3": ["Format: Spray"],
        },
        missing_info: [],
        unsupported_requested_signals: [],
      }),
      build_or_fix_routine: async () => ({ steps: [] }),
    },
  })

  assert.equal(result.final_answer, "Ich zeige alle Leave-in-Optionen mit Caveat.")
})
