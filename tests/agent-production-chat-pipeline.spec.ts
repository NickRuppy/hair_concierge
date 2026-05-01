import assert from "node:assert/strict"
import test from "node:test"
import type { PropagateAttributesParams } from "@langfuse/tracing"

import {
  buildRouterDecision,
  mapAgentIntent,
  mapAgentProductCategory,
  productsForRenderedPacket,
  runProductionAgentPipeline,
} from "../src/lib/agent/production/chat-pipeline"
import type { AgentModelClient } from "../src/lib/agent/orchestrator/model-client"
import { createChatPostHandler } from "../src/app/api/chat/route"
import type {
  AgentRoutePacket,
  AgentRuntimePacket,
} from "../src/lib/agent/orchestrator/route-packet"
import type { SelectedProductsProjection } from "../src/lib/agent/tools/select-products"
import type { Product } from "../src/lib/types"

function createRoute(overrides: Partial<AgentRoutePacket> = {}): AgentRoutePacket {
  return {
    user_job: "product_pick",
    product_category: "shampoo",
    requested_overlay_ids: [],
    requested_topic_ids: [],
    requested_routine_id: null,
    concerns: [],
    active_profile_signals: [],
    confidence: 0.91,
    evidence: ["User asks for a product."],
    ambiguity: null,
    required_playbook_id: "playbook:recommend_products",
    guidance_ids: ["playbook:recommend_products"],
    tool_plan: ["select_products"],
    routine_objective: null,
    validation_warnings: [],
    ...overrides,
  }
}

function createProduct(id: string): Product {
  return {
    id,
    name: `Produkt ${id}`,
    brand: "Testmarke",
    description: null,
    short_description: null,
    category: "Shampoo",
    affiliate_link: null,
    image_url: null,
    price_eur: 9.99,
    currency: "EUR",
    tags: [],
    suitable_thicknesses: [],
    suitable_concerns: [],
    shampoo_bucket_pairs: null,
    is_active: true,
    sort_order: 0,
    recommendation_meta: null,
    created_at: "2026-04-29T00:00:00.000Z",
    updated_at: "2026-04-29T00:00:00.000Z",
  }
}

function createTextStream(content: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(content))
      controller.close()
    },
  })
}

function parseSseEvents(text: string): Array<{ type: string; data: unknown }> {
  return text
    .trim()
    .split("\n\n")
    .map((block) => {
      const dataLine = block.split("\n").find((line) => line.startsWith("data: "))
      assert.ok(dataLine, `Missing SSE data line in ${block}`)
      return JSON.parse(dataLine.slice("data: ".length)) as { type: string; data: unknown }
    })
}

function propagateAttributesStub<A extends unknown[], F extends (...args: A) => ReturnType<F>>(
  _attributes: PropagateAttributesParams,
  work: F,
): ReturnType<F> {
  return work(...([] as unknown as A))
}

function createFakeAdmin() {
  const inserts: Record<string, unknown[]> = {
    conversations: [],
    messages: [],
    conversation_turn_traces: [],
  }
  const updates: Record<string, unknown[]> = {
    conversations: [],
    profiles: [],
  }
  let messageCounter = 0

  const createChain = (table: string) => {
    let operation: "insert" | "update" | "select" | null = null
    let payload: unknown = null

    const resolveSingle = () => {
      if (table === "conversations" && operation === "insert") {
        return Promise.resolve({ data: { id: "conversation-1" }, error: null })
      }

      if (table === "messages" && operation === "insert") {
        messageCounter += 1
        return Promise.resolve({ data: { id: `message-${messageCounter}` }, error: null })
      }

      if (table === "profiles" && operation === "select") {
        return Promise.resolve({ data: { message_count_this_month: 4 }, error: null })
      }

      return Promise.resolve({ data: null, error: null })
    }

    const chain = {
      insert(value: unknown) {
        operation = "insert"
        payload = value
        inserts[table] = [...(inserts[table] ?? []), value]
        return chain
      },
      update(value: unknown) {
        operation = "update"
        payload = value
        updates[table] = [...(updates[table] ?? []), value]
        return chain
      },
      select() {
        operation = operation ?? "select"
        return chain
      },
      eq() {
        return chain
      },
      single: resolveSingle,
      then<TResult1 = { data: unknown; error: null }, TResult2 = never>(
        onfulfilled?:
          | ((value: { data: unknown; error: null }) => TResult1 | PromiseLike<TResult1>)
          | null,
        onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
      ) {
        void payload
        return resolveSingle().then(onfulfilled, onrejected)
      },
    }

    return chain
  }

  return {
    inserts,
    updates,
    client: {
      from: createChain,
    },
  }
}

test("production agent compatibility maps route jobs into legacy chat metadata", () => {
  assert.equal(mapAgentIntent(createRoute({ user_job: "product_pick" })), "product_recommendation")
  assert.equal(mapAgentIntent(createRoute({ user_job: "routine_structure" })), "routine_help")
  assert.equal(mapAgentIntent(createRoute({ user_job: "usage" })), "hair_care_advice")
  assert.equal(mapAgentProductCategory(createRoute({ product_category: "shampoo" })), "shampoo")
  assert.equal(
    mapAgentProductCategory(createRoute({ user_job: "routine_structure", product_category: null })),
    "routine",
  )
})

test("production agent router decision marks missing product info as clarify-only", () => {
  const selectedProducts: SelectedProductsProjection = {
    category: "shampoo",
    decision: "needs_more_info",
    product_response_policy: "needs_more_info",
    policy_reason: "Missing profile data.",
    profile_basis: [],
    category_guidance: "Bitte klaeren.",
    products: [],
    comparison_facts: null,
    missing_info: [
      {
        key: "thickness",
        label: "Haardicke",
        blocking: true,
        detail: "Ohne Haardicke kann die Shampoo-Auswahl nicht sinnvoll eingegrenzt werden.",
      },
    ],
    unsupported_requested_signals: [],
  }

  const decision = buildRouterDecision({
    route: createRoute(),
    selectedProducts,
  })

  assert.equal(decision.response_mode, "clarify_only")
  assert.equal(decision.retrieval_mode, "hybrid")
  assert.deepEqual(decision.policy_overrides, [
    "agent_v1_front_door",
    "product_policy:needs_more_info",
    "missing_shampoo_profile",
  ])
  assert.match(decision.clarification_reason ?? "", /Haardicke/)
})

test("production agent product cards follow the renderer packet order", () => {
  const selectedProducts = [createProduct("fallback"), createProduct("primary")]
  const runtimePacket = {
    selected_products: {
      products: [
        {
          product_id: "primary",
        },
      ],
    },
  } as AgentRuntimePacket

  assert.deepEqual(
    productsForRenderedPacket({ runtimePacket, selectedProducts }).map((product) => product.id),
    ["primary"],
  )
})

test("production agent pipeline marks debug trace as agent final render", async () => {
  const fakeModel: AgentModelClient = {
    async classifyRoute() {
      return {
        user_job: "usage",
        product_category: "shampoo",
        requested_overlay_ids: [],
        requested_topic_ids: [],
        requested_routine_id: null,
        concerns: [],
        confidence: 0.9,
        evidence: ["User asks how to use shampoo."],
        ambiguity: null,
      }
    },
    async renderFinalAnswer() {
      return "Nutze Shampoo nur am Ansatz."
    },
  }

  const result = await runProductionAgentPipeline(
    {
      message: "Wie benutze ich Shampoo richtig?",
      conversationId: "conversation-1",
      userId: "user-1",
      requestId: "request-1",
    },
    {
      modelClient: fakeModel,
      loadConversationHistory: async () => [],
      getUserContext: async () => ({
        profile: null,
        routine_inventory: [],
        relevant_memory: [],
        derived_signals: [],
        suggested_overlays: [],
        missing_profile: [],
      }),
      loadUserMemoryContext: async () => ({
        enabled: true,
        entries: [],
        promptContext: null,
        dislikedProductNames: [],
      }),
    },
  )

  assert.equal(result.debugTrace.prompt.kind, "agent_final_render")
  assert.ok(result.debugTrace.decision_context.engine_trace)
  assert.equal(
    result.debugTrace.decision_context.engine_trace.request_context.requestedCategory,
    "shampoo",
  )
  assert.equal(
    result.debugTrace.decision_context.engine_trace.categories.shampoo.category,
    "shampoo",
  )
  assert.deepEqual(result.debugTrace.response_composition, {
    path: "agent_final_render",
    migration_mode: "legacy_only",
    fallback_reason: null,
    rendering_path: null,
    plan_type: "agent_v1",
    attachment_mode: null,
  })
})

test("POST /api/chat streams agent v1 contract and persists assistant metadata", async () => {
  const fakeAdmin = createFakeAdmin()
  const persistedTurnTraces: unknown[] = []
  const matchedProduct = createProduct("primary")
  const categoryDecision = {
    category: "shampoo",
    relevant: true,
  }
  const engineTrace = {
    categories: {
      shampoo: categoryDecision,
    },
  }
  const debugTrace = {
    request_id: "request-1",
    route_packet: { product_category: "shampoo" },
    response_composition: {
      path: "agent_final_render",
      migration_mode: "legacy_only",
      fallback_reason: null,
      rendering_path: null,
      plan_type: "agent_v1",
      attachment_mode: null,
    },
  }
  const routerDecision = {
    retrieval_mode: "hybrid",
    response_mode: "answer_direct",
    confidence: 0.92,
    slot_completeness: 1,
    policy_overrides: ["agent_v1_front_door", "product_policy:recommend"],
  }
  const pipelineCalls: unknown[] = []
  const handler = createChatPostHandler({
    createClient: async () =>
      ({
        auth: {
          getUser: async () => ({ data: { user: { id: "user-1" } } }),
        },
      }) as never,
    checkRateLimit: async () => ({ allowed: true }) as never,
    ensureLangfuseTracing: () => null,
    flushLangfuseClient: async () => {},
    getLangfuseClient: () => ({ getTraceUrl: async () => "https://trace.test/request-1" }) as never,
    getLangfuseRelease: () => "test-release",
    resolveLangfuseTraceId: () => "trace-1",
    startObservation: () =>
      ({
        otelSpan: {},
        update: () => {},
        end: () => {},
      }) as never,
    propagateAttributes: propagateAttributesStub as never,
    otelContext: {
      active: () => ({}),
      with: (_context: unknown, work: () => unknown) => work(),
    } as never,
    otelTrace: {
      setSpan: () => ({}),
    } as never,
    randomUUID: () => "request-1",
    now: () => 100,
    persistConversationTurnTrace: async (trace) => {
      persistedTurnTraces.push(trace)
    },
    loadRuntimeDeps: async () =>
      ({
        createAdminClient: () => fakeAdmin.client,
        runProductionAgentPipeline: async (params: unknown) => {
          pipelineCalls.push(params)
          return {
            stream: createTextStream("Das ist die Agent-v1-Antwort."),
            conversationId: "conversation-1",
            intent: "product_recommendation",
            matchedProducts: [matchedProduct],
            sources: [],
            retrievalSummary: { final_context_count: 0 },
            routerDecision,
            categoryDecision,
            engineTrace,
            debugTrace,
          }
        },
        buildAssistantRagContext: (
          sources: unknown[],
          decision: unknown,
          trace: unknown,
          responseMode: unknown,
        ) => ({
          sources,
          category_decision: decision,
          engine_trace: trace,
          response_mode: responseMode,
        }),
        buildDoneEventData: (params: unknown) => params,
        extractConversationMemory: async () => {},
        buildRetrievalDebugEventData: (trace: unknown) => ({ trace }),
        finalizeChatTurnTrace: (trace: unknown, final: unknown) => ({
          trace,
          final,
          response_composition: (trace as { response_composition: unknown }).response_composition,
          decision_context: {
            engine_trace: engineTrace,
            matched_products: [matchedProduct],
          },
        }),
        summarizeEngineTraceForLangfuse: (trace: unknown) => ({ trace }),
        summarizeProductsForLangfuse: (products: unknown) => products,
        chatMessageSchema: {
          safeParse: (body: unknown) => ({
            success: true,
            data: body as { message: string; conversation_id?: string | null },
          }),
        },
        generateConversationTitle: async () => {},
      }) as never,
  })

  const response = await handler(
    new Request("http://localhost/api/chat", {
      method: "POST",
      body: JSON.stringify({ message: "Welches Shampoo passt?" }),
    }),
  )
  const events = parseSseEvents(await response.text())

  assert.equal(response.headers.get("content-type"), "text/event-stream")
  assert.deepEqual(
    events.map((event) => event.type),
    [
      "conversation_id",
      "langfuse_trace",
      "confidence",
      "retrieval_debug",
      "content_delta",
      "product_recommendations",
      "assistant_message",
      "done",
    ],
  )
  assert.deepEqual(pipelineCalls[0], {
    message: "Welches Shampoo passt?",
    conversationId: "conversation-1",
    userId: "user-1",
    requestId: "request-1",
  })
  assert.deepEqual((events[5] as { data: Product[] }).data, [matchedProduct])

  const assistantInsert = fakeAdmin.inserts.messages[1] as {
    content: string
    product_recommendations: Product[]
    rag_context: Record<string, unknown>
  }
  assert.equal(assistantInsert.content, "Das ist die Agent-v1-Antwort.")
  assert.deepEqual(assistantInsert.product_recommendations, [matchedProduct])
  assert.deepEqual(assistantInsert.rag_context.category_decision, categoryDecision)
  assert.deepEqual(assistantInsert.rag_context.engine_trace, engineTrace)
  assert.equal(assistantInsert.rag_context.response_mode, "answer_direct")
  assert.deepEqual(persistedTurnTraces[0], {
    conversation_id: "conversation-1",
    user_id: "user-1",
    user_message_id: "message-1",
    assistant_message_id: "message-2",
    langfuse_trace_id: "trace-1",
    langfuse_trace_url: "https://trace.test/request-1",
    status: "completed",
    trace: {
      trace: debugTrace,
      final: {
        assistant_content: "Das ist die Agent-v1-Antwort.",
        sources: [],
        product_count: 1,
        status: "completed",
        stream_read_ms: 0,
        total_ms: 0,
      },
      response_composition: debugTrace.response_composition,
      decision_context: {
        engine_trace: engineTrace,
        matched_products: [matchedProduct],
      },
    },
  })
})
