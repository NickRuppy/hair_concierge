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
  const renderRequests: Parameters<AgentModelClient["renderFinalAnswer"]>[0][] = []
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
    async renderFinalAnswer(input) {
      renderRequests.push(input)
      const { packet } = input
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

  assert.equal(renderRequests.length, 1)
  const finalRenderPrompt = renderRequests[0]?.systemPrompt
  assert.ok(finalRenderPrompt)
  assert.equal(selectProductsInputs[0]?.requestedGoal, "shine")
  assert.equal(result.final_answer, "Ich wuerde mit der leichteren Shampoo-Option starten.")
  assert.deepEqual(
    result.tool_calls.map((call) => call.name),
    ["get_user_context", "load_guidance", "select_products"],
  )
  assert.equal(result.route_trace.user_job, "product_pick")
  assert.equal(result.route_trace.required_playbook_id, "playbook:recommend_products")

  // Classic Compare final render prompt does not require the conversation context packet
  assert.doesNotMatch(finalRenderPrompt, /packet\.conversation_context/)
  assert.doesNotMatch(finalRenderPrompt, /move_hint=/)
  assert.match(finalRenderPrompt, /aktuelle Nutzer-Delta/)
  assert.match(finalRenderPrompt, /nicht.*komplette.*Thema.*neu/i)

  // Classic Compare final render prompt keeps internal labels hidden without context-packet labels
  assert.match(finalRenderPrompt, /Interne Labels/)
  assert.match(finalRenderPrompt, /nie in der Nutzerantwort ausgeben/i)
  assert.doesNotMatch(finalRenderPrompt, /conversation_context/)

  // final render prompt supports recommend-with-caveat policy
  assert.match(finalRenderPrompt, /recommend_with_caveat/)
  assert.match(finalRenderPrompt, /Produkte.*nennen.*Caveat|Caveat.*Produkte/i)

  // final render prompt requires concrete endings and sharper scalp followups
  assert.match(finalRenderPrompt, /fettige\/gelbliche Schuppen/)
  assert.match(finalRenderPrompt, /trockene kleine Schueppchen/)
  assert.match(finalRenderPrompt, /Vermeide generische Abschlusssaetze/)
  assert.match(finalRenderPrompt, /konkreten Option/)

  // final render prompt keeps pre-wash oil away from scalp-treatment claims
  assert.match(finalRenderPrompt, /Bei Pre-Wash-Oel/)
  assert.match(finalRenderPrompt, /Laengen und Spitzen/)
  assert.match(finalRenderPrompt, /Nicht sagen, dass Oel die Kopfhaut beruhigt/)
  assert.match(finalRenderPrompt, /Schuppen\/Juckreiz loest/)

  // final render prompt ties conceptual oil comparisons back to the user
  assert.match(finalRenderPrompt, /konzeptuellen Oel-Vergleichen/)
  assert.match(finalRenderPrompt, /kurzen \"in deinem Fall\"-Satz/)
  assert.match(finalRenderPrompt, /Pre-Wash/)
  assert.match(finalRenderPrompt, /Finish-Oel/)

  // final render prompt preserves all selected product options in order
  assert.match(finalRenderPrompt, /alle Produkte aus selected_products\.products/)
  assert.match(finalRenderPrompt, /gegebenen Reihenfolge/)
  assert.match(finalRenderPrompt, /nicht eigenmaechtig von drei Tool-Produkten auf zwei/)

  // final render prompt hides internal fallback markers from users
  assert.match(finalRenderPrompt, /intern mit "Fallback:" markiert/)
  assert.match(finalRenderPrompt, /nie in der Nutzerantwort ausgeben/)
  assert.match(finalRenderPrompt, /schwaecheren Optionen nur nachgeordnet/)

  // final render prompt preserves spray versus cream leave-in comparisons
  assert.match(finalRenderPrompt, /Spray-vs-Creme-Leave-in/)
  assert.match(finalRenderPrompt, /Ersetze das Spray nicht durch eine Lotion/)

  // final render prompt explains the one-less-product value of integrated leave-in heat protection
  assert.match(finalRenderPrompt, /verwende im Einstieg ausdruecklich/)
  assert.match(finalRenderPrompt, /ein Produkt weniger/)
  assert.match(finalRenderPrompt, /Zwei-in-eins-Route/)
  assert.match(finalRenderPrompt, /separaten Hitzeschutz behalten/)

  // final render prompt requires profile deviation notices up front
  assert.match(finalRenderPrompt, /Pflicht: Wenn selected_products\.profile_basis/)
  assert.match(finalRenderPrompt, /Profil-Hinweis:/)
  assert.match(finalRenderPrompt, /ersten Antwortsatz/)
  assert.match(finalRenderPrompt, /nicht als dauerhaft gespeicherte Profilkorrektur/)

  // final render prompt gives conceptual split-end mask answers enough substance
  assert.match(finalRenderPrompt, /konzeptuellen Spliss-Fragen zu Masken/)
  assert.match(finalRenderPrompt, /3-5 kurzen Saetzen/)
  assert.match(finalRenderPrompt, /physischer Faserschaden/)
  assert.match(finalRenderPrompt, /sichtbaren Spliss schneiden lassen/)
  assert.match(finalRenderPrompt, /Keine Produktliste/)

  // final render prompt keeps dry shampoo as a narrow bridge with hard-no guardrails
  assert.match(finalRenderPrompt, /Bei Trockenshampoo/)
  assert.match(finalRenderPrompt, /Between-Wash-Bruecke/)
  assert.match(finalRenderPrompt, /reinigt die Kopfhaut nicht/)
  assert.match(finalRenderPrompt, /spaeter ausgewaschen/)
  assert.match(finalRenderPrompt, /keine Trockenshampoo-Produkte erfinden/)
  assert.match(finalRenderPrompt, /keine Ersatzprodukte wie Babypuder/)
  assert.match(finalRenderPrompt, /Auch ohne selected_products/)
  assert.match(finalRenderPrompt, /route\.product_category=dry_shampoo/)

  // final render prompt deduplicates the mandatory dry-shampoo caveat
  assert.match(finalRenderPrompt, /Trockenshampoo-Caveat/)
  assert.match(finalRenderPrompt, /nur einmal pro Antwort/)
  assert.match(finalRenderPrompt, /nicht unter jedem Produkt wiederholen/)
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
