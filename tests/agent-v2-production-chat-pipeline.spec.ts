import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import {
  classifyAgentV2ProductionSafetyMode,
  runAgentV2ProductionPipeline,
} from "../src/lib/agent-v2/production/chat-pipeline"
import { createChatPostHandler } from "../src/app/api/chat/route"
import { loadAgentV2ProductionConversationHistory } from "../src/lib/agent-v2/production/conversation-history"
import { deriveMatchedProducts } from "../src/lib/agent-v2/production/product-output"
import { createDefaultConversationState } from "../src/lib/chat-runtime/conversation-state"
import { buildRecommendationEngineRuntimeForChat } from "../src/lib/recommendation-engine"
import type {
  createSelectProductsTool,
  SelectProductsToolResult,
} from "../src/lib/agent/tools/select-products"
import type {
  AgentV2RoutineThreadContext,
  AgentV2SessionMemoryWrite,
} from "../src/lib/agent-v2/contracts"
import type { AgentV2ResponsesTurnResult } from "../src/lib/agent-v2/runtime/responses-agent"
import type { AgentV2SelectProductsProjection } from "../src/lib/agent-v2/tools/select-products-projection"
import type { ConversationState, HairProfile, Message, Product } from "../src/lib/types"
import {
  createDefaultAgentV2ConversationState,
  normalizeAgentV2ConversationState,
  type AgentV2ConversationStateV2,
} from "../src/lib/agent-v2/production/persisted-session-state"
import { buildRetrievalDebugEventData } from "../src/lib/chat-runtime/debug-trace"

type SelectProductsToolParams = Parameters<ReturnType<typeof createSelectProductsTool>>[0]

const verifyConversationOwnership = async ({
  conversationId,
  userId,
}: {
  conversationId: string
  userId: string
}) => {
  assert.equal(typeof conversationId, "string")
  assert.equal(typeof userId, "string")
  return true
}

function createProduct(id: string): Product & { similarity: number } {
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
    similarity: 0.9,
    created_at: "2026-04-29T00:00:00.000Z",
    updated_at: "2026-04-29T00:00:00.000Z",
  }
}

function createCompleteHairProfile(overrides: Partial<HairProfile> = {}): HairProfile {
  return {
    id: "profile-1",
    user_id: "user-1",
    hair_texture: "wavy",
    thickness: "fine",
    density: "medium",
    concerns: ["frizz"],
    products_used: null,
    shampoo_frequency: "weekly_3_4x",
    heat_styling: "rarely",
    styling_tools: [],
    goals: ["curl_definition"],
    cuticle_condition: "rough",
    protein_moisture_balance: "stretches_bounces",
    scalp_type: "balanced",
    scalp_condition: null,
    chemical_treatment: ["natural"],
    desired_volume: "balanced",
    routine_preference: "balanced",
    current_routine_products: ["shampoo", "conditioner"],
    towel_material: null,
    towel_technique: null,
    drying_method: "air_dry",
    brush_type: null,
    night_protection: [],
    uses_heat_protection: false,
    additional_notes: null,
    conversation_memory: null,
    created_at: "2026-04-29T00:00:00.000Z",
    updated_at: "2026-04-29T00:00:00.000Z",
    ...overrides,
  }
}

function createMessage(index: number): Message {
  return {
    id: `message-${index}`,
    conversation_id: "conversation-1",
    role: index % 2 === 0 ? "assistant" : "user",
    content: `Message ${index}`,
    product_recommendations: null,
    rag_context: null,
    token_usage: null,
    langfuse_trace_id: null,
    langfuse_trace_url: null,
    user_feedback_score: null,
    user_feedback_at: null,
    created_at: `2026-05-29T10:${String(index).padStart(2, "0")}:00.000Z`,
  }
}

async function readStream(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let output = ""

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    output += decoder.decode(value, { stream: true })
  }

  return output + decoder.decode()
}

function createTextStream(text: string): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text))
      controller.close()
    },
  })
}

test("chat product intake offer is driven by structured pipeline metadata and preserves model copy", async () => {
  const modelAnswer =
    "Danke dir. Dieses konkrete Pantene-Shampoo kenne ich noch nicht sicher in unserer Produktdatenbank. Damit ich es wirklich passend zu deiner Routine einschätzen kann, kannst du es kurz hinzufügen."
  const productIntakeOffer = {
    id: "offer-1",
    source: "chat",
    reason: "product_lookup_not_found",
    category: "shampoo",
    extracted_identity: {
      brand_text: "Pantene",
      product_name_text: "Pro-V Repair & Care Shampoo",
    },
  }
  const messageRows: Array<Record<string, unknown>> = []
  const conversationUpdates: Array<Record<string, unknown>> = []
  const statePersistenceCalls: unknown[] = []
  const memoryExtractionCalls: unknown[] = []
  const traceRows: Array<Record<string, unknown>> = []
  let decisionContextProductIntakeOffer: unknown = null
  const admin = createFakeChatAdminClient({ messageRows, conversationUpdates })

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
    getLangfuseClient: () =>
      ({
        getTraceUrl: async () => "https://langfuse.test/trace/trace-1",
      }) as never,
    getLangfuseRelease: () => "test-release",
    resolveLangfuseTraceId: () => "trace-1",
    startObservation: () =>
      ({
        otelSpan: {},
        update: () => {},
        end: () => {},
      }) as never,
    propagateAttributes: ((_attributes: unknown, fn: () => unknown) => fn()) as never,
    otelContext: {
      active: () => ({}),
      with: async (_context: unknown, fn: () => unknown) => fn(),
    } as never,
    otelTrace: {
      setSpan: () => ({}),
    } as never,
    loadRuntimeDeps: async () =>
      ({
        createAdminClient: () => admin,
        runAgentV2ProductionPipeline: async () => ({
          stream: createTextStream(modelAnswer),
          intent: "product_question",
          matchedProducts: [],
          sources: [{ title: "Source that should not be shown" }],
          retrievalSummary: { final_context_count: 0 },
          routerDecision: {
            confidence: 0.8,
            retrieval_mode: "semantic",
            response_mode: "answer",
          },
          conversationStateTransition: { next_state: "should_not_persist" },
          categoryDecision: undefined,
          engineTrace: undefined,
          debugTrace: {},
          visibleFailure: false,
          answerMode: "product_recommendation",
          productIntakeOffer,
        }),
        buildAssistantDecisionContext: (
          _sources: unknown,
          _categoryDecision: unknown,
          _engineTrace: unknown,
          _responseMode: unknown,
          productIntakeOffer: unknown,
        ) => {
          decisionContextProductIntakeOffer = productIntakeOffer
          return { product_intake_offer: productIntakeOffer }
        },
        buildDoneEventData: ({ intent }: { intent: string }) => ({ intent }),
        extractConversationMemory: (...args: unknown[]) => {
          memoryExtractionCalls.push(args)
          return Promise.resolve()
        },
        buildRetrievalDebugEventData: () => ({ route_debug: true }),
        finalizeChatTurnTrace: (_trace: unknown, params: Record<string, unknown>) => ({
          response_composition: {},
          decision_context: {
            engine_trace: null,
            matched_products: [],
          },
          conversation_state_persistence: params.conversation_state_persistence,
        }),
        summarizeEngineTraceForLangfuse: () => null,
        summarizeProductsForLangfuse: () => [],
        summarizeAgentV2TraceForLangfuse: () => null,
        persistConversationStateTransition: async (...args: unknown[]) => {
          statePersistenceCalls.push(args)
          return { status: "persisted", error: null }
        },
        chatMessageSchema: {
          safeParse: (value: unknown) => ({ success: true, data: value }),
        },
        generateConversationTitle: async () => {},
      }) as never,
    persistConversationTurnTrace: async (row) => {
      traceRows.push(row)
    },
    randomUUID: () => "offer-1",
    now: () => 0,
  })

  const response = await handler(
    new Request("https://example.test/api/chat", {
      method: "POST",
      body: JSON.stringify({
        message: "Ich benutze Pantene Pro-V Shampoo. Passt das gut zu mir?",
        conversation_id: "conversation-1",
      }),
    }),
  )
  const responseText = await response.text()

  assert.equal(response.status, 200)
  assert.match(responseText, /product_intake_offer/)
  assert.match(responseText, new RegExp(modelAnswer))
  assert.equal(messageRows[1]?.content, modelAnswer)
  assert.deepEqual(decisionContextProductIntakeOffer, productIntakeOffer)
  assert.deepEqual(
    (messageRows[1]?.rag_context as { product_intake_offer?: unknown } | undefined)
      ?.product_intake_offer,
    productIntakeOffer,
  )
  assert.equal(statePersistenceCalls.length, 0)
  assert.equal(memoryExtractionCalls.length, 0)
  assert.equal(traceRows.length, 1)
})

test("chat route does not infer product intake offer from raw user message", async () => {
  const modelAnswer =
    "Ich kann das konkrete Produkt nur bewerten, wenn es in der Produktdatenbank sicher gefunden wurde."
  const messageRows: Array<Record<string, unknown>> = []
  const conversationUpdates: Array<Record<string, unknown>> = []
  const statePersistenceCalls: unknown[] = []
  const memoryExtractionCalls: unknown[] = []
  const traceRows: Array<Record<string, unknown>> = []
  const admin = createFakeChatAdminClient({ messageRows, conversationUpdates })

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
    getLangfuseClient: () =>
      ({
        getTraceUrl: async () => "https://langfuse.test/trace/trace-1",
      }) as never,
    getLangfuseRelease: () => "test-release",
    resolveLangfuseTraceId: () => "trace-1",
    startObservation: () =>
      ({
        otelSpan: {},
        update: () => {},
        end: () => {},
      }) as never,
    propagateAttributes: ((_attributes: unknown, fn: () => unknown) => fn()) as never,
    otelContext: {
      active: () => ({}),
      with: async (_context: unknown, fn: () => unknown) => fn(),
    } as never,
    otelTrace: {
      setSpan: () => ({}),
    } as never,
    loadRuntimeDeps: async () =>
      ({
        createAdminClient: () => admin,
        runAgentV2ProductionPipeline: async () => ({
          stream: createTextStream(modelAnswer),
          intent: "routine_question",
          matchedProducts: [],
          sources: [],
          retrievalSummary: { final_context_count: 0 },
          routerDecision: {
            confidence: 0.8,
            retrieval_mode: "semantic",
            response_mode: "answer",
          },
          conversationStateTransition: { next_state: "persist" },
          categoryDecision: undefined,
          engineTrace: undefined,
          debugTrace: {},
          visibleFailure: false,
          answerMode: "product_recommendation",
        }),
        buildAssistantDecisionContext: (
          _sources: unknown,
          _categoryDecision: unknown,
          _engineTrace: unknown,
          _responseMode: unknown,
          productIntakeOffer: unknown,
        ) => ({ product_intake_offer: productIntakeOffer }),
        buildDoneEventData: ({ intent }: { intent: string }) => ({ intent }),
        extractConversationMemory: (...args: unknown[]) => {
          memoryExtractionCalls.push(args)
          return Promise.resolve()
        },
        buildRetrievalDebugEventData: () => ({ route_debug: true }),
        finalizeChatTurnTrace: (_trace: unknown, params: Record<string, unknown>) => ({
          response_composition: {},
          decision_context: {
            engine_trace: null,
            matched_products: [],
          },
          conversation_state_persistence: params.conversation_state_persistence,
        }),
        summarizeEngineTraceForLangfuse: () => null,
        summarizeProductsForLangfuse: () => [],
        summarizeAgentV2TraceForLangfuse: () => null,
        persistConversationStateTransition: async (...args: unknown[]) => {
          statePersistenceCalls.push(args)
          return { status: "persisted", error: null }
        },
        chatMessageSchema: {
          safeParse: (value: unknown) => ({ success: true, data: value }),
        },
        generateConversationTitle: async () => {},
      }) as never,
    persistConversationTurnTrace: async (row) => {
      traceRows.push(row)
    },
    randomUUID: () => "offer-1",
    now: () => 0,
  })

  const response = await handler(
    new Request("https://example.test/api/chat", {
      method: "POST",
      body: JSON.stringify({
        message: "Ich benutze Pantene Pro-V Shampoo. Passt das gut zu mir?",
        conversation_id: "conversation-1",
      }),
    }),
  )
  const responseText = await response.text()

  assert.equal(response.status, 200)
  assert.doesNotMatch(responseText, /product_intake_offer/)
  assert.match(responseText, new RegExp(modelAnswer))
  assert.equal(messageRows[1]?.content, modelAnswer)
  assert.equal(statePersistenceCalls.length, 1)
  assert.equal(memoryExtractionCalls.length, 1)
  assert.equal(traceRows.length, 1)
})

function createFakeChatAdminClient(params: {
  messageRows: Array<Record<string, unknown>>
  conversationUpdates: Array<Record<string, unknown>>
}) {
  return {
    from(table: string) {
      const query = {
        operation: null as "insert" | "update" | "select" | null,
        payload: null as Record<string, unknown> | null,
        filters: [] as Array<{ column: string; value: unknown }>,
        insert(payload: Record<string, unknown>) {
          this.operation = "insert"
          this.payload = payload
          if (table === "messages") {
            params.messageRows.push(payload)
          }
          return this
        },
        update(payload: Record<string, unknown>) {
          this.operation = "update"
          this.payload = payload
          if (table === "conversations") {
            params.conversationUpdates.push(payload)
          }
          return this
        },
        select() {
          this.operation = this.operation ?? "select"
          return this
        },
        eq(column: string, value: unknown) {
          this.filters.push({ column, value })
          return this
        },
        async single() {
          if (table === "conversations") {
            return { data: { id: "conversation-1" }, error: null }
          }
          if (table === "messages" && this.operation === "insert") {
            return { data: { id: `message-${params.messageRows.length}` }, error: null }
          }
          if (table === "profiles") {
            return { data: { message_count_this_month: 0 }, error: null }
          }
          return { data: null, error: null }
        },
      }

      return query
    },
  }
}

function createAgentV2Result(): AgentV2ResponsesTurnResult {
  return {
    accepted_session_memory_writes: [],
    final_answer: {
      answer_mode: "product_recommendation",
      interpreted_intent: "User wants a shampoo recommendation.",
      request_interpretation: {
        primary_intent: "product_recommendation",
        product_request_kind: "specific_products",
        routine_intent: "none",
        care_category: "shampoo",
        requested_product_count: 1,
        count_policy: "exact",
        evidence_quote: "Welches Shampoo passt?",
        specific_product_candidate: false,
        confidence: 0.95,
      },
      confidence: 0.92,
      extracted_constraints: {
        hair_concerns: ["frizz"],
        goals: [],
        product_categories: ["shampoo"],
        budget_eur: null,
        avoid_ingredients: [],
        allergies: [],
        preferences: [],
        routine_layer: null,
        raw_constraints: ["Welches Shampoo passt?"],
      },
      missing_information: [],
      safety_flags: [],
      tool_grounding: {
        used_guidance_package_ids: ["base.advisor_rules.v1", "category.shampoo.v1"],
        used_product_tool: true,
        used_routine_tool: false,
        product_ids: ["primary"],
        routine_step_ids: [],
        hard_rule_ids: [],
      },
      routine_context: {
        active: false,
        routine_layer: null,
        step_id: null,
        category: "shampoo",
        return_path: [],
      },
      pending_routine_action: null,
      session_memory_writes: [],
      payload: {
        user_facing_answer_de: "Nimm zuerst Produkt primary.",
        recommendations: [
          {
            product_id: "primary",
            reason_de: "Passt zu deinem Profil.",
            usage_de: null,
            caveat_de: null,
          },
        ],
        comparison_notes_de: [],
        usage_notes_de: [],
        next_step_offer_de: null,
      },
    },
    trace: {
      engine: "agent_v2",
      model: "gpt-5.4-mini",
      endpoint: "responses",
      reasoning_effort: "medium",
      safety_mode: "normal",
      answer_mode: "product_recommendation",
      named_product_context: null,
      response_ids: ["response-1"],
      model_steps: [
        {
          response_id: "response-1",
          tool_call_count: 1,
          terminal_answer_count: 0,
          output_types: ["function_call"],
          latency_ms: 7,
        },
      ],
      tool_calls: [
        {
          call_id: "select-1",
          name: "select_products",
          arguments: { category: "shampoo" },
          latency_ms: 1,
        },
      ],
      blocked_tool_calls: [],
      loaded_guidance_package_ids: ["base.advisor_rules.v1", "category.shampoo.v1"],
      validation_errors: [],
      validation_warnings: [],
      request_interpretation: null,
      request_interpretation_summary: null,
      bounded_repair_kind: null,
      repair_attempts: [],
      routine_thread_context_active: false,
      routine_thread_context: null,
      final_product_ids: ["primary"],
      routine_layer: null,
      session_memory_writes: [],
      dropped_session_memory_writes: [],
      injected_session_memory: [],
      langfuse: {
        enabled: true,
        trace_id: null,
        trace_url: null,
      },
      failure_stage: null,
    },
  }
}

test("AgentV2 persisted state defaults to an empty version-2 envelope", () => {
  const state = createDefaultAgentV2ConversationState()

  assert.equal(state.version, 2)
  assert.equal(state.engine, "agent_v2_care_balance")
  assert.equal(state.agent_v2.routine_thread_context, null)
  assert.deepEqual(state.agent_v2.prior_selected_product_projections, [])
  assert.deepEqual(state.agent_v2.session_memory, [])
})

test("AgentV2 production conversation history loads the latest ten messages chronologically", async () => {
  const returnedMessages = Array.from({ length: 10 }, (_, index) => createMessage(12 - index))
  const calls: Array<{ name: string; args: unknown[] }> = []
  const fakeClient = {
    from(table: string) {
      calls.push({ name: "from", args: [table] })
      return {
        select(columns: string) {
          calls.push({ name: "select", args: [columns] })
          return {
            eq(column: string, value: string) {
              calls.push({ name: "eq", args: [column, value] })
              return {
                order(column: string, options: { ascending: boolean }) {
                  calls.push({ name: "order", args: [column, options] })
                  return {
                    async limit(count: number) {
                      calls.push({ name: "limit", args: [count] })
                      return { data: returnedMessages, error: null }
                    },
                  }
                },
              }
            },
          }
        },
      }
    },
  }

  const messages = await loadAgentV2ProductionConversationHistory("conversation-1", fakeClient)

  assert.deepEqual(calls.find((call) => call.name === "order")?.args, [
    "created_at",
    { ascending: false },
  ])
  assert.deepEqual(calls.find((call) => call.name === "limit")?.args, [10])
  assert.deepEqual(
    messages.map((message) => message.content),
    [
      "Message 3",
      "Message 4",
      "Message 5",
      "Message 6",
      "Message 7",
      "Message 8",
      "Message 9",
      "Message 10",
      "Message 11",
      "Message 12",
    ],
  )
})

test("AgentV2 persisted state ignores legacy behavior fields without flat AgentV2 context", () => {
  const state = normalizeAgentV2ConversationState({
    version: 1,
    active_topic: "routine",
    routine_layer: "basics",
    pending_offer: "routine_goals_or_problems",
    answered_slots: ["routine"],
    last_assistant_action: "asked_routine_basics",
    last_product_category: "leave_in",
  })

  assert.equal(state.version, 2)
  assert.equal(state.engine, "agent_v2_care_balance")
  assert.equal(state.agent_v2.routine_thread_context, null)
  assert.deepEqual(state.agent_v2.prior_selected_product_projections, [])
  assert.deepEqual(state.agent_v2.session_memory, [])
})

test("AgentV2 persisted state promotes flat AgentV2 fields from current version-1 rows", () => {
  const routineThread: AgentV2RoutineThreadContext = {
    active: true,
    current_layer: "basics",
    last_answer_mode: "routine",
    last_routine_categories: ["leave_in"],
    last_user_goal: "Ich will meine Routine einfacher machen.",
    summary_de: "Leave-in ist der erste Zusatz.",
    pending_routine_action: null,
    visible_steps: [],
  }
  const sessionMemory: AgentV2SessionMemoryWrite = {
    type: "preference",
    text: "User likes light products.",
    evidence_quote: "Ich mag leichte Produkte.",
    confidence: 0.9,
    ttl: "session",
    affects_recommendations: true,
    expires_at_turn: null,
  }

  const state = normalizeAgentV2ConversationState({
    version: 1,
    active_topic: "routine",
    routine_layer: "goals",
    agent_v2_routine_thread_context: routineThread,
    agent_v2_prior_selected_product_projections: [
      {
        tool_name: "select_products",
        category: "leave_in",
        valid_product_ids: ["leave-in-1"],
        products: [
          {
            product_id: "leave-in-1",
            name: "Leave-in Beispiel",
            rank: 1,
          },
        ],
      },
    ],
    agent_v2_session_memory: [sessionMemory],
  })

  assert.equal(state.version, 2)
  assert.deepEqual(state.agent_v2.routine_thread_context, routineThread)
  assert.equal(state.agent_v2.prior_selected_product_projections.length, 1)
  assert.equal(state.agent_v2.session_memory.length, 1)
})

test("AgentV2 persisted state recovers from malformed persisted state", () => {
  const state = normalizeAgentV2ConversationState({
    version: 2,
    engine: "agent_v2_care_balance",
    agent_v2: {
      routine_thread_context: { active: "not-a-boolean" },
      prior_selected_product_projections: "bad",
      session_memory: [{ type: "bad" }],
    },
  })

  assert.equal(state.version, 2)
  assert.deepEqual(state.agent_v2.prior_selected_product_projections, [])
  assert.deepEqual(state.agent_v2.session_memory, [])
  assert.equal(state.agent_v2.routine_thread_context, null)
})

test("AgentV2 production pipeline rejects mismatched user and conversation before loading history or state", async () => {
  let historyLoaded = false
  let stateLoaded = false

  await assert.rejects(
    () =>
      runAgentV2ProductionPipeline(
        {
          message: "Hallo",
          conversationId: "conversation-owned-by-user-2",
          userId: "user-1",
          requestId: "request-ownership",
        },
        {
          verifyConversationOwnership: async ({ conversationId, userId }) => {
            assert.equal(conversationId, "conversation-owned-by-user-2")
            assert.equal(userId, "user-1")
            return false
          },
          loadConversationHistory: async () => {
            historyLoaded = true
            return []
          },
          getUserContext: async () => ({
            profile: createCompleteHairProfile(),
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
          loadConversationState: async () => {
            stateLoaded = true
            return createDefaultConversationState()
          },
          runAgentV2ResponsesTurn: async () => createAgentV2Result(),
        },
      ),
    /does not belong to user/i,
  )

  assert.equal(historyLoaded, false)
  assert.equal(stateLoaded, false)
})

test("AgentV2 production pipeline returns cards, trace, and CareBalance context", async () => {
  const primaryProduct = createProduct("primary")
  const fallbackProduct = createProduct("fallback")
  const hairProfile = createCompleteHairProfile()
  const selection: SelectProductsToolResult = {
    projection: {
      category: "shampoo",
      decision: "recommended",
      product_response_policy: "recommend",
      policy_reason: "Explicit product ask.",
      profile_basis: [],
      category_guidance: "Shampoo passt als konkrete Produktempfehlung.",
      products: [fallbackProduct, primaryProduct].map((product, index) => ({
        rank: index + 1,
        product_id: product.id,
        name: product.name,
        brand: product.brand,
        price_eur: product.price_eur,
        currency: product.currency,
        fit_reason: `Passt ${product.id}.`,
        caveat: null,
        supported_claims: [],
        unsupported_requested_signals: [],
      })),
      comparison_facts: null,
      missing_info: [],
      unsupported_requested_signals: [],
    },
    products: [fallbackProduct, primaryProduct],
    effectiveHairProfile: hairProfile,
    runtime: buildRecommendationEngineRuntimeForChat({
      hairProfile,
      routineItems: [],
      productCategory: "shampoo",
      message: "Welches Shampoo passt?",
    }),
  }
  let sawCareBalanceContext = false
  let selectedProductsCalled = false

  const result = await runAgentV2ProductionPipeline(
    {
      message: "Welches Shampoo passt?",
      conversationId: "conversation-1",
      userId: "user-1",
      requestId: "request-1",
    },
    {
      verifyConversationOwnership,
      loadConversationHistory: async () =>
        [
          {
            id: "m1",
            conversation_id: "conversation-1",
            role: "user",
            content: "Sensitive recent context",
            product_recommendations: null,
            rag_context: null,
            token_usage: null,
            langfuse_trace_id: null,
            langfuse_trace_url: null,
            user_feedback_score: null,
            user_feedback_at: null,
            created_at: "2026-05-12T10:01:00.000Z",
          },
        ] satisfies Message[],
      getUserContext: async () => ({
        profile: hairProfile,
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
      loadConversationState: async (): Promise<ConversationState> =>
        createDefaultConversationState(),
      client: {
        responses: {
          create: async () => ({ output: [] }),
        },
      },
      createSelectProductsTool:
        (options = {}) =>
        async (input: SelectProductsToolParams) => {
          selectedProductsCalled = true
          assert.equal(input.category, "shampoo")
          options.onResult?.(selection)
          return selection.projection
        },
      runAgentV2ResponsesTurn: async (params) => {
        sawCareBalanceContext = Boolean(params.userContext.careBalanceContext)
        await params.tools.select_products({ category: "shampoo" })
        return createAgentV2Result()
      },
    },
  )

  assert.equal(sawCareBalanceContext, true)
  assert.equal(selectedProductsCalled, true)
  assert.equal(await readStream(result.stream), "Nimm zuerst Produkt primary.")
  assert.equal(result.intent, "product_recommendation")
  assert.deepEqual(
    result.matchedProducts.map((product) => product.id),
    ["primary"],
  )
  assert.equal(result.routerDecision.retrieval_mode, "agent_v2_responses")
  assert.equal(result.routerDecision.response_mode, "answer_direct")
  assert.equal(result.conversationStateTransition.updated_by_engine, "agent_v2_care_balance")
  assert.equal(result.categoryDecision?.category, "shampoo")
  assert.equal(result.engineTrace?.request_context.requestedCategory, "shampoo")
  assert.equal(result.debugTrace.engine_variant, "agent_v2_care_balance")
  assert.equal(result.debugTrace.agent_v2_trace?.engine, "agent_v2")
  assert.equal(result.debugTrace.latencies_ms.product_matching_ms, 0)
  assert.equal(result.debugTrace.latencies_ms.agent_model_ms, 7)
  assert.equal(result.debugTrace.latencies_ms.agent_tool_ms, 1)
  assert.equal(typeof result.debugTrace.latencies_ms.agent_runtime_ms, "number")
  assert.deepEqual(
    result.debugTrace.agent_v2_trace?.tool_calls.map((call) => call.name),
    ["select_products"],
  )
  assert.equal(result.debugTrace.response_composition.attachment_mode, "cards")
  assert.equal(result.debugTrace.user_message, "[agent_v2_user_message chars=22]")
  assert.equal(JSON.stringify(result.debugTrace.prompt).includes("Welches Shampoo passt?"), false)
  assert.equal(JSON.stringify(result.debugTrace.prompt).includes("Sensitive recent context"), false)
  const debugEvent = buildRetrievalDebugEventData(result.debugTrace)
  assert.equal(debugEvent.agent_v2_visible_failure, false)
  assert.deepEqual(debugEvent.agent_v2_latency_ms, {
    runtime: result.debugTrace.latencies_ms.agent_runtime_ms,
    turn_gate: null,
    model: 7,
    tools: 1,
    model_steps: 1,
    tool_calls: 1,
  })
  assert.deepEqual(debugEvent.agent_v2_state, {
    version: 2,
    engine: "agent_v2_care_balance",
    routine_thread: {
      active: false,
      current_layer: null,
      visible_step_count: 0,
    },
    prior_product_projection_count: 1,
    session_memory_count: 0,
    changed_fields: ["agent_v2"],
  })
  assert.equal(JSON.stringify(debugEvent).includes("prior_selected_product_projections"), false)
  const failedDebugEvent = buildRetrievalDebugEventData({
    ...result.debugTrace,
    agent_v2_trace: {
      ...result.debugTrace.agent_v2_trace!,
      failure_stage: "repair_failed",
    },
  })
  assert.equal(failedDebugEvent.agent_v2_visible_failure, true)
  assert.equal(failedDebugEvent.visible_failure, true)
})

test("AgentV2 production pipeline keeps parallel select_products results isolated", async () => {
  const hairProfile = createCompleteHairProfile()
  const shampooProduct = createProduct("shampoo-product")
  const conditionerProduct = createProduct("conditioner-product")
  const shampooSelection: SelectProductsToolResult = {
    projection: {
      category: "shampoo",
      decision: "recommended",
      product_response_policy: "recommend",
      policy_reason: "Explicit shampoo comparison.",
      profile_basis: [],
      category_guidance: "Shampoo passt als konkrete Produktempfehlung.",
      products: [
        {
          rank: 1,
          product_id: shampooProduct.id,
          name: shampooProduct.name,
          brand: shampooProduct.brand,
          price_eur: shampooProduct.price_eur,
          currency: shampooProduct.currency,
          fit_reason: "Passt als Shampoo.",
          caveat: null,
          supported_claims: [],
          unsupported_requested_signals: [],
        },
      ],
      comparison_facts: null,
      missing_info: [],
      unsupported_requested_signals: [],
    },
    products: [shampooProduct],
    effectiveHairProfile: hairProfile,
    runtime: buildRecommendationEngineRuntimeForChat({
      hairProfile,
      routineItems: [],
      productCategory: "shampoo",
      message: "Vergleiche Shampoo und Conditioner.",
    }),
  }
  const conditionerSelection: SelectProductsToolResult = {
    projection: {
      category: "conditioner",
      decision: "recommended",
      product_response_policy: "recommend",
      policy_reason: "Explicit conditioner comparison.",
      profile_basis: [],
      category_guidance: "Conditioner passt als konkrete Produktempfehlung.",
      products: [
        {
          rank: 1,
          product_id: conditionerProduct.id,
          name: conditionerProduct.name,
          brand: conditionerProduct.brand,
          price_eur: conditionerProduct.price_eur,
          currency: conditionerProduct.currency,
          fit_reason: "Passt als Conditioner.",
          caveat: null,
          supported_claims: [],
          unsupported_requested_signals: [],
        },
      ],
      comparison_facts: null,
      missing_info: [],
      unsupported_requested_signals: [],
    },
    products: [conditionerProduct],
    effectiveHairProfile: hairProfile,
    runtime: buildRecommendationEngineRuntimeForChat({
      hairProfile,
      routineItems: [],
      productCategory: "conditioner",
      message: "Vergleiche Shampoo und Conditioner.",
    }),
  }
  const resolvers = new Map<string, (value: SelectProductsToolResult) => void>()

  const result = await runAgentV2ProductionPipeline(
    {
      message: "Vergleiche Shampoo und Conditioner.",
      conversationId: "conversation-1",
      userId: "user-1",
      requestId: "request-parallel-select-products",
    },
    {
      verifyConversationOwnership,
      loadConversationHistory: async () => [],
      getUserContext: async () => ({
        profile: hairProfile,
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
      loadConversationState: async (): Promise<ConversationState> =>
        createDefaultConversationState(),
      createSelectProductsTool:
        (options = {}) =>
        async (input: SelectProductsToolParams) =>
          new Promise((resolve) => {
            resolvers.set(input.category, (result) => {
              options.onResult?.(result)
              resolve(result.projection)
            })
          }),
      runAgentV2ResponsesTurn: async (params) => {
        const shampooPromise = params.tools.select_products({ category: "shampoo" })
        const conditionerPromise = params.tools.select_products({ category: "conditioner" })

        resolvers.get("conditioner")?.(conditionerSelection)
        resolvers.get("shampoo")?.(shampooSelection)

        const [shampooProjection, conditionerProjection] = (await Promise.all([
          shampooPromise,
          conditionerPromise,
        ])) as [AgentV2SelectProductsProjection, AgentV2SelectProductsProjection]

        assert.equal(shampooProjection.category, "shampoo")
        assert.equal(conditionerProjection.category, "conditioner")
        return createAgentV2Result()
      },
    },
  )
})

test("AgentV2 production pipeline surfaces product intake offer from lookup result", async () => {
  const hairProfile = createCompleteHairProfile()
  const agentResult = createAgentV2Result()
  agentResult.final_answer = {
    ...agentResult.final_answer,
    answer_mode: "general_advice",
    interpreted_intent: "User asks about their own named product.",
    request_interpretation: {
      primary_intent: "general_advice",
      product_request_kind: "product_detail",
      routine_intent: "none",
      care_category: "shampoo",
      requested_product_count: null,
      count_policy: "none",
      evidence_quote: "Pantene Pro-V Volume Pur Shampoo",
      specific_product_candidate: true,
      confidence: 0.88,
    },
    tool_grounding: {
      used_guidance_package_ids: ["base.advisor_rules.v1"],
      used_product_tool: false,
      used_routine_tool: false,
      product_ids: [],
      routine_step_ids: [],
      hard_rule_ids: [],
    },
    payload: {
      user_facing_answer_de:
        "Danke dir. Dieses konkrete Shampoo kenne ich noch nicht sicher in unserer Produktdatenbank. Du kannst es kurz hinzufügen, dann prüfen wir es sauber.",
      category_or_topic: "shampoo",
      key_points_de: [],
      next_step_offer_de: null,
    },
  }

  const result = await runAgentV2ProductionPipeline(
    {
      message: "Ich nutze Pantene Pro-V Volume Pur Shampoo. Passt das zu mir?",
      conversationId: "conversation-1",
      userId: "user-1",
      requestId: "request-lookup",
      productIntakeEnabled: true,
    },
    {
      verifyConversationOwnership,
      loadConversationHistory: async () => [],
      getUserContext: async () => ({
        profile: hairProfile,
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
      loadConversationState: async (): Promise<ConversationState> =>
        createDefaultConversationState(),
      client: {
        responses: {
          create: async () => ({ output: [] }),
        },
      },
      createProductIntakeRepository: () =>
        ({
          loadCatalog: async () => ({ products: [], identifiers: [] }),
          loadBrandResolutionCatalog: async () => ({
            brands: [{ id: "brand-pantene", canonical_name: "Pantene" }],
            productLines: [
              { id: "line-pro-v", brand_id: "brand-pantene", canonical_name: "Pro-V" },
            ],
            brandAliases: [
              {
                brand_id: "brand-pantene",
                product_line_id: "line-pro-v",
                alias: "Pantene Pro-V",
              },
            ],
          }),
        }) as never,
      runAgentV2ResponsesTurn: async (params) => {
        await params.tools.lookup_product_candidate({
          category: "shampoo",
          brand_text: "Pantene Pro-V",
          product_name_text: "Volume Pur Shampoo",
          reason: "User asks whether their own named product suits them.",
          evidence_quote: "Pantene Pro-V Volume Pur Shampoo",
        })
        return agentResult
      },
    },
  )

  assert.deepEqual(result.productIntakeOffer, {
    id: "product-intake-request-lookup",
    source: "chat",
    reason: "product_lookup_not_found",
    category: "shampoo",
    extracted_identity: {
      brand_text: "Pantene Pro-V",
      product_name_text: "Volume Pur Shampoo",
    },
  })
  assert.equal(
    await readStream(result.stream),
    agentResult.final_answer.payload.user_facing_answer_de,
  )
})

test("AgentV2 production pipeline renders intake when lookup category is inferred from answer target", async () => {
  const hairProfile = createCompleteHairProfile()
  const agentResult = createAgentV2Result()
  agentResult.final_answer = {
    ...agentResult.final_answer,
    answer_mode: "general_advice",
    interpreted_intent: "User asks about their own named shampoo without saying the category word.",
    request_interpretation: {
      primary_intent: "general_advice",
      product_request_kind: "product_detail",
      routine_intent: "none",
      care_category: "shampoo",
      requested_product_count: null,
      count_policy: "none",
      evidence_quote: "Pantene Pro-V Volume Pur",
      specific_product_candidate: true,
      confidence: 0.88,
    },
    tool_grounding: {
      used_guidance_package_ids: ["base.advisor_rules.v1", "category.shampoo.v1"],
      used_product_tool: false,
      used_routine_tool: false,
      product_ids: [],
      routine_step_ids: [],
      hard_rule_ids: [],
    },
    payload: {
      user_facing_answer_de:
        "Dieses konkrete Produkt kenne ich noch nicht sicher in unserer Produktdatenbank. Du kannst es kurz hinzufügen, dann prüfen wir es sauber.",
      category_or_topic: "shampoo",
      key_points_de: [],
      next_step_offer_de: null,
    },
  }

  const result = await runAgentV2ProductionPipeline(
    {
      message: "Was hältst du von Pantene Pro-V Volume Pur?",
      conversationId: "conversation-1",
      userId: "user-1",
      requestId: "request-inferred-category-lookup",
      productIntakeEnabled: true,
    },
    {
      verifyConversationOwnership,
      loadConversationHistory: async () => [],
      getUserContext: async () => ({
        profile: hairProfile,
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
      loadConversationState: async (): Promise<ConversationState> =>
        createDefaultConversationState(),
      client: {
        responses: {
          create: async () => ({ output: [] }),
        },
      },
      createProductIntakeRepository: () =>
        ({
          loadCatalog: async () => ({ products: [], identifiers: [] }),
          loadBrandResolutionCatalog: async () => ({
            brands: [{ id: "brand-pantene", canonical_name: "Pantene" }],
            productLines: [
              { id: "line-pro-v", brand_id: "brand-pantene", canonical_name: "Pro-V" },
            ],
            brandAliases: [
              {
                brand_id: "brand-pantene",
                product_line_id: "line-pro-v",
                alias: "Pantene Pro-V",
              },
            ],
          }),
        }) as never,
      runAgentV2ResponsesTurn: async (params) => {
        await params.tools.lookup_product_candidate({
          category: "shampoo",
          brand_text: "Pantene Pro-V",
          product_name_text: "Volume Pur",
          reason: "User asks about a concrete product and the model inferred shampoo.",
          evidence_quote: "Pantene Pro-V Volume Pur",
        })
        return agentResult
      },
    },
  )

  assert.deepEqual(result.productIntakeOffer, {
    id: "product-intake-request-inferred-category-lookup",
    source: "chat",
    reason: "product_lookup_not_found",
    category: "shampoo",
    extracted_identity: {
      brand_text: "Pantene Pro-V",
      product_name_text: "Volume Pur",
    },
  })
})

test("AgentV2 production pipeline does not render intake for background product mentions", async () => {
  const hairProfile = createCompleteHairProfile()
  const agentResult = createAgentV2Result()
  agentResult.final_answer = {
    ...agentResult.final_answer,
    answer_mode: "general_advice",
    interpreted_intent: "User asks about washing frequency with current product as context.",
    request_interpretation: {
      primary_intent: "general_advice",
      product_request_kind: "none",
      routine_intent: "none",
      care_category: "shampoo",
      requested_product_count: null,
      count_policy: "none",
      evidence_quote: "Wie oft sollte ich meine Haare waschen",
      specific_product_candidate: true,
      confidence: 0.88,
    },
    tool_grounding: {
      used_guidance_package_ids: [
        "base.advisor_rules.v1",
        "base.general_advice.v1",
        "category.shampoo.v1",
      ],
      used_product_tool: false,
      used_routine_tool: false,
      product_ids: [],
      routine_step_ids: [],
      hard_rule_ids: [],
    },
    payload: {
      user_facing_answer_de:
        "Für die Waschfrequenz zählt vor allem deine Kopfhaut. Starte nach Bedarf und beobachte, wie schnell der Ansatz nachfettet.",
      category_or_topic: "shampoo",
      key_points_de: ["Die Waschfrequenz hängt eher von Kopfhaut und Alltag ab."],
      next_step_offer_de: null,
    },
  }

  const result = await runAgentV2ProductionPipeline(
    {
      message:
        "Ich benutze Pantene Pro-V Volume Pur Shampoo. Wie oft sollte ich meine Haare waschen?",
      conversationId: "conversation-1",
      userId: "user-1",
      requestId: "request-background-product",
      productIntakeEnabled: true,
    },
    {
      verifyConversationOwnership,
      loadConversationHistory: async () => [],
      getUserContext: async () => ({
        profile: hairProfile,
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
      loadConversationState: async (): Promise<ConversationState> =>
        createDefaultConversationState(),
      client: {
        responses: {
          create: async () => ({ output: [] }),
        },
      },
      createProductIntakeRepository: () =>
        ({
          loadCatalog: async () => ({ products: [], identifiers: [] }),
          loadBrandResolutionCatalog: async () => ({
            brands: [],
            productLines: [],
            brandAliases: [],
          }),
        }) as never,
      runAgentV2ResponsesTurn: async () => agentResult,
    },
  )

  assert.equal(result.productIntakeOffer, null)
  assert.equal(
    await readStream(result.stream),
    agentResult.final_answer.payload.user_facing_answer_de,
  )
})

test("AgentV2 production pipeline does not render intake from over-eager lookup for background product mention", async () => {
  const hairProfile = createCompleteHairProfile()
  const agentResult = createAgentV2Result()
  agentResult.final_answer = {
    ...agentResult.final_answer,
    answer_mode: "general_advice",
    interpreted_intent: "User asks about washing frequency with current product as context.",
    request_interpretation: {
      primary_intent: "general_advice",
      product_request_kind: "none",
      routine_intent: "none",
      care_category: "shampoo",
      requested_product_count: null,
      count_policy: "none",
      evidence_quote: "Wie oft sollte ich meine Haare waschen",
      specific_product_candidate: true,
      confidence: 0.88,
    },
    tool_grounding: {
      used_guidance_package_ids: [
        "base.advisor_rules.v1",
        "base.general_advice.v1",
        "category.shampoo.v1",
      ],
      used_product_tool: false,
      used_routine_tool: false,
      product_ids: [],
      routine_step_ids: [],
      hard_rule_ids: [],
    },
    payload: {
      user_facing_answer_de:
        "Für die Waschfrequenz zählt vor allem deine Kopfhaut. Starte nach Bedarf und beobachte, wie schnell der Ansatz nachfettet.",
      category_or_topic: "shampoo",
      key_points_de: ["Die Waschfrequenz hängt eher von Kopfhaut und Alltag ab."],
      next_step_offer_de: null,
    },
  }

  const result = await runAgentV2ProductionPipeline(
    {
      message:
        "Ich benutze Pantene Pro-V Volume Pur Shampoo. Wie oft sollte ich meine Haare waschen?",
      conversationId: "conversation-1",
      userId: "user-1",
      requestId: "request-background-overeager-lookup",
      productIntakeEnabled: true,
    },
    {
      verifyConversationOwnership,
      loadConversationHistory: async () => [],
      getUserContext: async () => ({
        profile: hairProfile,
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
      loadConversationState: async (): Promise<ConversationState> =>
        createDefaultConversationState(),
      client: {
        responses: {
          create: async () => ({ output: [] }),
        },
      },
      createProductIntakeRepository: () =>
        ({
          loadCatalog: async () => ({ products: [], identifiers: [] }),
          loadBrandResolutionCatalog: async () => ({
            brands: [{ id: "brand-pantene", canonical_name: "Pantene" }],
            productLines: [
              { id: "line-pro-v", brand_id: "brand-pantene", canonical_name: "Pro-V" },
            ],
            brandAliases: [
              {
                brand_id: "brand-pantene",
                product_line_id: "line-pro-v",
                alias: "Pantene Pro-V",
              },
            ],
          }),
        }) as never,
      runAgentV2ResponsesTurn: async (params) => {
        await params.tools.lookup_product_candidate({
          category: "shampoo",
          brand_text: "Pantene Pro-V",
          product_name_text: "Volume Pur Shampoo",
          reason: "Over-eager lookup for a background product mention.",
          evidence_quote: "Pantene Pro-V Volume Pur Shampoo",
        })
        return agentResult
      },
    },
  )

  assert.equal(result.productIntakeOffer, null)
  assert.equal(
    await readStream(result.stream),
    agentResult.final_answer.payload.user_facing_answer_de,
  )
})

test("AgentV2 production pipeline does not render intake from background lookup on other-category recommendation", async () => {
  const hairProfile = createCompleteHairProfile()
  const agentResult = createAgentV2Result()
  agentResult.final_answer = {
    ...agentResult.final_answer,
    answer_mode: "product_recommendation",
    interpreted_intent:
      "User mentions their current shampoo as context and asks for a conditioner recommendation.",
    request_interpretation: {
      primary_intent: "product_recommendation",
      product_request_kind: "specific_products",
      routine_intent: "none",
      care_category: "conditioner",
      requested_product_count: 1,
      count_policy: "exact",
      evidence_quote: "welchen Conditioner empfiehlst du dazu",
      specific_product_candidate: true,
      confidence: 0.88,
    },
    extracted_constraints: {
      ...agentResult.final_answer.extracted_constraints,
      product_categories: ["conditioner"],
      raw_constraints: ["welchen Conditioner empfiehlst du dazu"],
    },
    tool_grounding: {
      used_guidance_package_ids: ["base.advisor_rules.v1", "category.conditioner.v1"],
      used_product_tool: true,
      used_routine_tool: false,
      product_ids: ["primary"],
      routine_step_ids: [],
      hard_rule_ids: [],
    },
    routine_context: {
      active: false,
      routine_layer: null,
      step_id: null,
      category: "conditioner",
      return_path: [],
    },
    payload: {
      user_facing_answer_de:
        "Als Conditioner würde ich dir ein leichtes Produkt empfehlen, das deine Längen weich macht, ohne sie zu beschweren.",
      recommendations: [
        {
          product_id: "primary",
          reason_de: "Passt zu deinem Profil.",
          usage_de: null,
          caveat_de: null,
        },
      ],
      comparison_notes_de: [],
      usage_notes_de: [],
      next_step_offer_de: null,
    },
  }

  const result = await runAgentV2ProductionPipeline(
    {
      message:
        "Ich benutze Pantene Pro-V Volume Pur Shampoo, welchen Conditioner empfiehlst du dazu?",
      conversationId: "conversation-1",
      userId: "user-1",
      requestId: "request-background-lookup-other-category",
      productIntakeEnabled: true,
    },
    {
      verifyConversationOwnership,
      loadConversationHistory: async () => [],
      getUserContext: async () => ({
        profile: hairProfile,
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
      loadConversationState: async (): Promise<ConversationState> =>
        createDefaultConversationState(),
      client: {
        responses: {
          create: async () => ({ output: [] }),
        },
      },
      createProductIntakeRepository: () =>
        ({
          loadCatalog: async () => ({ products: [], identifiers: [] }),
          loadBrandResolutionCatalog: async () => ({
            brands: [{ id: "brand-pantene", canonical_name: "Pantene" }],
            productLines: [
              { id: "line-pro-v", brand_id: "brand-pantene", canonical_name: "Pro-V" },
            ],
            brandAliases: [
              {
                brand_id: "brand-pantene",
                product_line_id: "line-pro-v",
                alias: "Pantene Pro-V",
              },
            ],
          }),
        }) as never,
      runAgentV2ResponsesTurn: async (params) => {
        await params.tools.lookup_product_candidate({
          category: "shampoo",
          brand_text: "Pantene Pro-V",
          product_name_text: "Volume Pur Shampoo",
          reason: "Over-eager lookup for a background product mention.",
          evidence_quote: "Pantene Pro-V Volume Pur Shampoo",
        })
        return agentResult
      },
    },
  )

  assert.equal(result.productIntakeOffer, null)
  assert.equal(
    await readStream(result.stream),
    agentResult.final_answer.payload.user_facing_answer_de,
  )
})

test("AgentV2 production pipeline does not render intake from an over-eager lookup when final answer has no specific product candidate", async () => {
  const hairProfile = createCompleteHairProfile()
  const agentResult = createAgentV2Result()
  agentResult.final_answer = {
    ...agentResult.final_answer,
    answer_mode: "general_advice",
    interpreted_intent: "User asks a broad category question, not to assess a concrete product.",
    request_interpretation: {
      primary_intent: "general_advice",
      product_request_kind: "none",
      routine_intent: "none",
      care_category: "shampoo",
      requested_product_count: null,
      count_policy: "none",
      evidence_quote: "Welche Shampoos passen zu mir?",
      specific_product_candidate: false,
      confidence: 0.88,
    },
    tool_grounding: {
      used_guidance_package_ids: ["base.advisor_rules.v1", "base.general_advice.v1"],
      used_product_tool: false,
      used_routine_tool: false,
      product_ids: [],
      routine_step_ids: [],
      hard_rule_ids: [],
    },
    payload: {
      user_facing_answer_de:
        "Bei deinem Haar sollte ein Shampoo mild reinigen und den Ansatz nicht beschweren.",
      category_or_topic: "shampoo",
      key_points_de: ["Milde Reinigung ist hier wichtiger als ein stark klärender Effekt."],
      next_step_offer_de: null,
    },
  }

  const result = await runAgentV2ProductionPipeline(
    {
      message: "Welche Shampoos passen zu mir?",
      conversationId: "conversation-1",
      userId: "user-1",
      requestId: "request-overeager-lookup",
      productIntakeEnabled: true,
    },
    {
      verifyConversationOwnership,
      loadConversationHistory: async () => [],
      getUserContext: async () => ({
        profile: hairProfile,
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
      loadConversationState: async (): Promise<ConversationState> =>
        createDefaultConversationState(),
      client: {
        responses: {
          create: async () => ({ output: [] }),
        },
      },
      createProductIntakeRepository: () =>
        ({
          loadCatalog: async () => ({ products: [], identifiers: [] }),
          loadBrandResolutionCatalog: async () => ({
            brands: [{ id: "brand-acme", canonical_name: "Acme" }],
            productLines: [],
            brandAliases: [],
          }),
        }) as never,
      runAgentV2ResponsesTurn: async (params) => {
        await params.tools.lookup_product_candidate({
          category: "shampoo",
          brand_text: "Acme",
          product_name_text: "Ghost Shampoo",
          reason: "Over-eager tool call unrelated to the final broad answer.",
          evidence_quote: "Acme Ghost Shampoo",
        })
        return agentResult
      },
    },
  )

  assert.equal(result.productIntakeOffer, null)
  assert.equal(
    await readStream(result.stream),
    agentResult.final_answer.payload.user_facing_answer_de,
  )
})

test("AgentV2 production pipeline does not render intake from a wrong branded lookup", async () => {
  const hairProfile = createCompleteHairProfile()
  const agentResult = createAgentV2Result()
  agentResult.final_answer = {
    ...agentResult.final_answer,
    answer_mode: "constraint_blocked",
    interpreted_intent: "User asks for Chaarlie's opinion on their own conditioner.",
    request_interpretation: {
      primary_intent: "product_recommendation",
      product_request_kind: "product_detail",
      routine_intent: "none",
      care_category: "conditioner",
      requested_product_count: null,
      count_policy: "none",
      evidence_quote: "miracles conditioner",
      specific_product_candidate: true,
      confidence: 0.9,
    },
    tool_grounding: {
      used_guidance_package_ids: ["base.advisor_rules.v1", "category.conditioner.v1"],
      used_product_tool: false,
      used_routine_tool: false,
      product_ids: [],
      routine_step_ids: [],
      hard_rule_ids: [],
    },
    payload: {
      user_facing_answer_de:
        "Diesen konkreten Jean & Lean Miracles Conditioner kann ich noch nicht zuverlässig bewerten, weil er nicht eindeutig in meinen Produktdaten ist.",
      blocking_constraints: ["product_not_verified"],
      safe_alternative_de: "Du kannst ihn hinzufügen, damit ich ihn später konkret einordnen kann.",
    },
  }

  const result = await runAgentV2ProductionPipeline(
    {
      message: "kannst du mir sagen, was du von meinem jean & lean miracles conditioner hältst",
      conversationId: "conversation-1",
      userId: "user-1",
      requestId: "request-wrong-generic-intake",
      productIntakeEnabled: true,
    },
    {
      verifyConversationOwnership,
      loadConversationHistory: async () => [],
      getUserContext: async () => ({
        profile: hairProfile,
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
      loadConversationState: async (): Promise<ConversationState> =>
        createDefaultConversationState(),
      client: {
        responses: {
          create: async () => ({ output: [] }),
        },
      },
      createProductIntakeRepository: () =>
        ({
          loadCatalog: async () => ({ products: [], identifiers: [] }),
          loadBrandResolutionCatalog: async () => ({
            brands: [{ id: "brand-pantene", canonical_name: "Pantene" }],
            productLines: [],
            brandAliases: [],
          }),
        }) as never,
      runAgentV2ResponsesTurn: async (params) => {
        await params.tools.lookup_product_candidate({
          category: "conditioner",
          brand_text: "Pantene",
          product_name_text: "Miracles Conditioner",
          reason: "Wrong generic candidate.",
          evidence_quote: "miracles conditioner",
        })
        return agentResult
      },
    },
  )

  assert.equal(result.productIntakeOffer, null)
})

test("AgentV2 production pipeline does not render intake from a wrong category lookup with matching brand text", async () => {
  const hairProfile = createCompleteHairProfile()
  const agentResult = createAgentV2Result()
  agentResult.final_answer = {
    ...agentResult.final_answer,
    answer_mode: "constraint_blocked",
    interpreted_intent: "User asks for Chaarlie's opinion on their own conditioner.",
    request_interpretation: {
      primary_intent: "product_recommendation",
      product_request_kind: "product_detail",
      routine_intent: "none",
      care_category: "conditioner",
      requested_product_count: null,
      count_policy: "none",
      evidence_quote: "Acme Hydra Glow Conditioner",
      specific_product_candidate: true,
      confidence: 0.9,
    },
    tool_grounding: {
      used_guidance_package_ids: ["base.advisor_rules.v1", "category.conditioner.v1"],
      used_product_tool: false,
      used_routine_tool: false,
      product_ids: [],
      routine_step_ids: [],
      hard_rule_ids: [],
    },
    payload: {
      user_facing_answer_de:
        "Diesen konkreten Acme Hydra Glow Conditioner kann ich noch nicht zuverlässig bewerten, weil er nicht eindeutig in meinen Produktdaten ist.",
      blocking_constraints: ["product_not_verified"],
      safe_alternative_de: "Du kannst ihn hinzufügen, damit ich ihn später konkret einordnen kann.",
    },
  }

  const result = await runAgentV2ProductionPipeline(
    {
      message: "Was hältst du von meinem Acme Hydra Glow Conditioner?",
      conversationId: "conversation-1",
      userId: "user-1",
      requestId: "request-wrong-category-intake",
      productIntakeEnabled: true,
    },
    {
      verifyConversationOwnership,
      loadConversationHistory: async () => [],
      getUserContext: async () => ({
        profile: hairProfile,
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
      loadConversationState: async (): Promise<ConversationState> =>
        createDefaultConversationState(),
      client: {
        responses: {
          create: async () => ({ output: [] }),
        },
      },
      createProductIntakeRepository: () =>
        ({
          loadCatalog: async () => ({ products: [], identifiers: [] }),
          loadBrandResolutionCatalog: async () => ({
            brands: [{ id: "brand-acme", canonical_name: "Acme" }],
            productLines: [],
            brandAliases: [],
          }),
        }) as never,
      runAgentV2ResponsesTurn: async (params) => {
        await params.tools.lookup_product_candidate({
          category: "shampoo",
          brand_text: "Acme",
          product_name_text: "Hydra Glow",
          reason: "Wrong category candidate with overlapping brand and line text.",
          evidence_quote: "Acme Hydra Glow",
        })
        return agentResult
      },
    },
  )

  assert.equal(result.productIntakeOffer, null)
})

test("AgentV2 production pipeline scopes lookup to public products and user-owned matched products", async () => {
  const hairProfile = createCompleteHairProfile()
  const agentResult = createAgentV2Result()
  const lookupResults: Array<{ status: string; productId: string | null }> = []
  const loadCatalogModes: unknown[] = []

  const result = await runAgentV2ProductionPipeline(
    {
      message: "Passt mein Testmarke Owned Conditioner zu mir?",
      conversationId: "conversation-1",
      userId: "user-1",
      requestId: "owned-lookup",
      productIntakeEnabled: true,
    },
    {
      verifyConversationOwnership,
      loadConversationHistory: async () => [],
      getUserContext: async () => ({
        profile: hairProfile,
        routine_inventory: [
          {
            category: "conditioner",
            product_name: "Owned Conditioner",
            frequency_range: "weekly_1x",
            product_id: "owned-conditioner",
            match_status: "matched",
          },
        ],
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
      loadConversationState: async (): Promise<ConversationState> =>
        createDefaultConversationState(),
      client: {
        responses: {
          create: async () => ({ output: [] }),
        },
      },
      createProductIntakeRepository: () =>
        ({
          loadCatalog: async (params: unknown) => {
            loadCatalogModes.push(params)
            return {
              products: [
                {
                  id: "public-conditioner",
                  name: "Public Conditioner",
                  brand_id: "brand-test",
                  category_key: "conditioner",
                  is_active: true,
                  lifecycle_status: "active",
                  is_chaarlie_recommended: true,
                },
                {
                  id: "owned-conditioner",
                  name: "Owned Conditioner",
                  brand_id: "brand-test",
                  category_key: "conditioner",
                  is_active: true,
                  lifecycle_status: "active",
                  is_chaarlie_recommended: false,
                },
                {
                  id: "hidden-conditioner",
                  name: "Hidden Conditioner",
                  brand_id: "brand-test",
                  category_key: "conditioner",
                  is_active: true,
                  lifecycle_status: "active",
                  is_chaarlie_recommended: false,
                },
              ],
              identifiers: [
                {
                  product_id: "hidden-conditioner",
                  identifier_type: "retailer_sku",
                  identifier_value: "hidden-sku",
                  normalized_identifier_value: "hidden-sku",
                },
              ],
            }
          },
          loadBrandResolutionCatalog: async () => ({
            brands: [{ id: "brand-test", canonical_name: "Testmarke" }],
            productLines: [],
            brandAliases: [],
          }),
        }) as never,
      runAgentV2ResponsesTurn: async (params) => {
        const ownedResult = await params.tools.lookup_product_candidate({
          category: "conditioner",
          brand_text: "Testmarke",
          product_name_text: "Owned Conditioner",
          reason: "The user asks whether their owned product suits them.",
          evidence_quote: "Testmarke Owned Conditioner",
        })
        const hiddenResult = await params.tools.lookup_product_candidate({
          category: "conditioner",
          brand_text: "Testmarke",
          product_name_text: "Hidden Conditioner",
          reason: "The user asks about a non-owned non-recommended product.",
          evidence_quote: "Testmarke Hidden Conditioner",
        })
        lookupResults.push(summarizeLookupResult(ownedResult), summarizeLookupResult(hiddenResult))
        return agentResult
      },
    },
  )

  assert.deepEqual(loadCatalogModes, [{ eligibilityMode: "intake_dedupe" }])
  assert.deepEqual(lookupResults, [
    { status: "found_exact", productId: "owned-conditioner" },
    { status: "not_found", productId: null },
  ])
  assert.equal(result.productIntakeOffer, null)
})

function summarizeLookupResult(result: unknown): { status: string; productId: string | null } {
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    return { status: "invalid", productId: null }
  }

  const record = result as Record<string, unknown>
  const product =
    record.product && typeof record.product === "object" && !Array.isArray(record.product)
      ? (record.product as Record<string, unknown>)
      : null

  return {
    status: typeof record.status === "string" ? record.status : "invalid",
    productId: typeof product?.id === "string" ? product.id : null,
  }
}

test("AgentV2 production pipeline defaults product intake lookup off", async () => {
  const hairProfile = createCompleteHairProfile()
  const agentResult = createAgentV2Result()
  let observedProductIntakeEnabled: boolean | undefined

  const result = await runAgentV2ProductionPipeline(
    {
      message: "Ich nutze Pantene Pro-V Volume Pur Shampoo. Passt das zu mir?",
      conversationId: "conversation-1",
      userId: "user-1",
      requestId: "request-default-disabled-lookup",
    },
    {
      verifyConversationOwnership,
      loadConversationHistory: async () => [],
      getUserContext: async () => ({
        profile: hairProfile,
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
      loadConversationState: async (): Promise<ConversationState> =>
        createDefaultConversationState(),
      client: {
        responses: {
          create: async () => ({ output: [] }),
        },
      },
      runAgentV2ResponsesTurn: async (params) => {
        observedProductIntakeEnabled = params.productIntakeEnabled
        return agentResult
      },
    },
  )

  assert.equal(observedProductIntakeEnabled, false)
  assert.equal(result.productIntakeOffer, null)
})

test("AgentV2 production pipeline disables product intake lookup when feature flag is off", async () => {
  const hairProfile = createCompleteHairProfile()
  const agentResult = createAgentV2Result()
  let observedProductIntakeEnabled: boolean | undefined

  const result = await runAgentV2ProductionPipeline(
    {
      message: "Ich nutze Pantene Pro-V Volume Pur Shampoo. Passt das zu mir?",
      conversationId: "conversation-1",
      userId: "user-1",
      requestId: "request-disabled-lookup",
      productIntakeEnabled: false,
    },
    {
      verifyConversationOwnership,
      loadConversationHistory: async () => [],
      getUserContext: async () => ({
        profile: hairProfile,
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
      loadConversationState: async (): Promise<ConversationState> =>
        createDefaultConversationState(),
      client: {
        responses: {
          create: async () => ({ output: [] }),
        },
      },
      runAgentV2ResponsesTurn: async (params) => {
        observedProductIntakeEnabled = params.productIntakeEnabled
        return agentResult
      },
    },
  )

  assert.equal(observedProductIntakeEnabled, false)
  assert.equal(result.productIntakeOffer, null)
})

test("AgentV2 production pipeline exposes intake only for not-found supported product lookups", async () => {
  const hairProfile = createCompleteHairProfile()
  const cases = [
    {
      label: "not_found",
      input: {
        category: "shampoo",
        brand_text: "Unbekannte Testmarke",
        product_name_text: "Hydra Glow Shampoo",
        reason: "User asks whether their own product suits them.",
        evidence_quote: "Unbekannte Testmarke Hydra Glow Shampoo",
      },
      expectIntake: true,
    },
    {
      label: "insufficient_identity",
      input: {
        category: "shampoo",
        brand_text: "Unbekannte Testmarke",
        product_name_text: "",
        reason: "User asks about an underspecified product.",
        evidence_quote: "mein Shampoo",
      },
      expectIntake: false,
    },
    {
      label: "partial_unclear_category",
      expectedStatus: "insufficient_identity",
      input: {
        category: null,
        brand_text: "Garnier",
        product_name_text: "Hair Food",
        reason: "User asks about a partial concrete product without clear use category.",
        evidence_quote: "Was hältst du von Garnier Hair Food?",
      },
      expectIntake: false,
    },
    {
      label: "ambiguous",
      input: {
        category: "shampoo",
        brand_text: "Unbekannte Testmarke",
        product_name_text: "Hydra Glow Shampoo",
        reason: "User asks about a product with multiple possible catalog matches.",
        evidence_quote: "Unbekannte Testmarke Hydra Glow Shampoo",
      },
      catalog: {
        products: [
          {
            id: "hydra-glow-a",
            name: "Hydra Glow Shampoo",
            brandId: "brand-unknown",
            categoryKey: "shampoo",
            isActive: true,
            lifecycleStatus: "active",
            isChaarlieRecommended: true,
          },
          {
            id: "hydra-glow-b",
            name: "Hydra Glow Shampoo",
            brandId: "brand-unknown",
            categoryKey: "shampoo",
            isActive: true,
            lifecycleStatus: "active",
            isChaarlieRecommended: true,
          },
        ],
        identifiers: [],
      },
      brandCatalog: {
        brands: [{ id: "brand-unknown", canonical_name: "Unbekannte Testmarke" }],
        productLines: [],
        brandAliases: [],
      },
      expectIntake: false,
    },
    {
      label: "unsupported_category",
      input: {
        category: "hairspray",
        brand_text: "Unbekannte Testmarke",
        product_name_text: "Hydra Glow Haarspray",
        reason: "User asks about an unsupported product category.",
        evidence_quote: "Unbekannte Testmarke Hydra Glow Haarspray",
      },
      expectIntake: false,
    },
  ] as const

  for (const testCase of cases) {
    let observedStatus: string | null = null
    const result = await runAgentV2ProductionPipeline(
      {
        message: "Ich benutze ein Produkt. Passt das zu mir?",
        conversationId: `conversation-${testCase.label}`,
        userId: "user-1",
        requestId: `request-${testCase.label}`,
        productIntakeEnabled: true,
      },
      {
        verifyConversationOwnership,
        loadConversationHistory: async () => [],
        getUserContext: async () => ({
          profile: hairProfile,
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
        loadConversationState: async (): Promise<ConversationState> =>
          createDefaultConversationState(),
        client: {
          responses: {
            create: async () => ({ output: [] }),
          },
        },
        createProductIntakeRepository: () =>
          ({
            loadCatalog: async () =>
              "catalog" in testCase ? testCase.catalog : { products: [], identifiers: [] },
            loadBrandResolutionCatalog: async () =>
              "brandCatalog" in testCase
                ? testCase.brandCatalog
                : {
                    brands: [],
                    productLines: [],
                    brandAliases: [],
                  },
          }) as never,
        runAgentV2ResponsesTurn: async (params) => {
          const lookupResult = await params.tools.lookup_product_candidate(testCase.input)
          observedStatus =
            lookupResult && typeof lookupResult === "object" && "status" in lookupResult
              ? String(lookupResult.status)
              : null
          if (testCase.expectIntake) {
            const agentResult = createAgentV2Result()
            agentResult.final_answer = {
              ...agentResult.final_answer,
              answer_mode: "general_advice",
              interpreted_intent: "User asks about their own named product.",
              request_interpretation: {
                primary_intent: "general_advice",
                product_request_kind: "product_detail",
                routine_intent: "none",
                care_category: "shampoo",
                requested_product_count: null,
                count_policy: "none",
                evidence_quote: "Unbekannte Testmarke Hydra Glow Shampoo",
                specific_product_candidate: true,
                confidence: 0.88,
              },
              tool_grounding: {
                used_guidance_package_ids: ["base.advisor_rules.v1"],
                used_product_tool: false,
                used_routine_tool: false,
                product_ids: [],
                routine_step_ids: [],
                hard_rule_ids: [],
              },
              payload: {
                user_facing_answer_de:
                  "Dieses konkrete Shampoo ist noch nicht in unserer Produktdatenbank.",
                category_or_topic: "shampoo",
                key_points_de: [],
                next_step_offer_de: null,
              },
            }
            return agentResult
          }
          return createAgentV2Result()
        },
      },
    )

    assert.equal(
      observedStatus,
      "expectedStatus" in testCase ? testCase.expectedStatus : testCase.label,
    )
    assert.equal(Boolean(result.productIntakeOffer), testCase.expectIntake)
  }
})

test("AgentV2 production pipeline does not render intake for broad brand-family asks without lookup", async () => {
  const hairProfile = createCompleteHairProfile()
  const agentResult = createAgentV2Result()
  let lookupCalled = false

  const result = await runAgentV2ProductionPipeline(
    {
      message: "Welche Pantene Produkte empfiehlst du?",
      conversationId: "conversation-broad-brand",
      userId: "user-1",
      requestId: "request-broad-brand",
      productIntakeEnabled: true,
    },
    {
      verifyConversationOwnership,
      loadConversationHistory: async () => [],
      getUserContext: async () => ({
        profile: hairProfile,
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
      loadConversationState: async (): Promise<ConversationState> =>
        createDefaultConversationState(),
      client: {
        responses: {
          create: async () => ({ output: [] }),
        },
      },
      createProductIntakeRepository: () =>
        ({
          loadCatalog: async () => ({ products: [], identifiers: [] }),
          loadBrandResolutionCatalog: async () => ({
            brands: [{ id: "brand-pantene", canonical_name: "Pantene" }],
            productLines: [],
            brandAliases: [],
          }),
        }) as never,
      runAgentV2ResponsesTurn: async (params) => {
        const originalLookup = params.tools.lookup_product_candidate
        params.tools.lookup_product_candidate = async (input) => {
          lookupCalled = true
          return originalLookup(input)
        }
        return agentResult
      },
    },
  )

  assert.equal(lookupCalled, false)
  assert.equal(result.productIntakeOffer, null)
})

test("AgentV2 production pipeline memoizes product lookup catalogs per turn", async () => {
  const hairProfile = createCompleteHairProfile()
  const agentResult = createAgentV2Result()
  let loadCatalogCalls = 0
  let loadBrandCatalogCalls = 0

  await runAgentV2ProductionPipeline(
    {
      message: "Ich nutze Pantene Pro-V Volume Pur Shampoo. Passt das zu mir?",
      conversationId: "conversation-1",
      userId: "user-1",
      requestId: "request-lookup-cache",
      productIntakeEnabled: true,
    },
    {
      verifyConversationOwnership,
      loadConversationHistory: async () => [],
      getUserContext: async () => ({
        profile: hairProfile,
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
      loadConversationState: async (): Promise<ConversationState> =>
        createDefaultConversationState(),
      client: {
        responses: {
          create: async () => ({ output: [] }),
        },
      },
      createProductIntakeRepository: () =>
        ({
          loadCatalog: async () => {
            loadCatalogCalls += 1
            return { products: [], identifiers: [] }
          },
          loadBrandResolutionCatalog: async () => {
            loadBrandCatalogCalls += 1
            return {
              brands: [{ id: "brand-pantene", canonical_name: "Pantene" }],
              productLines: [],
              brandAliases: [],
            }
          },
        }) as never,
      runAgentV2ResponsesTurn: async (params) => {
        await params.tools.lookup_product_candidate({
          category: "shampoo",
          brand_text: "Pantene",
          product_name_text: "Volume Pur Shampoo",
          reason: "First check.",
          evidence_quote: "Pantene Pro-V Volume Pur Shampoo",
        })
        await params.tools.lookup_product_candidate({
          category: "shampoo",
          brand_text: "Pantene",
          product_name_text: "Volume Pur Shampoo",
          reason: "Second check.",
          evidence_quote: "Pantene Pro-V Volume Pur Shampoo",
        })
        return agentResult
      },
    },
  )

  assert.equal(loadCatalogCalls, 1)
  assert.equal(loadBrandCatalogCalls, 1)
})

test("AgentV2 production pipeline exposes boundary answer mode without products", async () => {
  const hairProfile = createCompleteHairProfile()
  const boundaryResult = createAgentV2Result()
  boundaryResult.final_answer = {
    ...boundaryResult.final_answer,
    answer_mode: "domain_boundary",
    interpreted_intent: "User asks outside supported hair care.",
    request_interpretation: {
      primary_intent: "unknown",
      product_request_kind: "none",
      routine_intent: "none",
      care_category: "none",
      requested_product_count: null,
      count_policy: "none",
      evidence_quote: "welchen nagellack soll ich kaufen?",
      specific_product_candidate: false,
      confidence: 0.9,
    },
    tool_grounding: {
      used_guidance_package_ids: [
        "base.advisor_rules.v1",
        "base.answer_contract.v1",
        "base.tone_and_format.v1",
      ],
      used_product_tool: false,
      used_routine_tool: false,
      product_ids: [],
      routine_step_ids: [],
      hard_rule_ids: [],
    },
    routine_context: {
      active: false,
      routine_layer: null,
      step_id: null,
      category: null,
      return_path: [],
    },
    session_memory_writes: [],
    payload: {
      user_facing_answer_de:
        "Bei Nagellack kann ich dir nicht sinnvoll helfen. Ich unterstütze dich gern bei Haarpflege, Kopfhaut, Styling oder passenden Produkten.",
      boundary_kind: "unsupported_domain",
      redirect_topic_de: "Haarpflege, Kopfhaut, Styling oder passende Produkte",
    },
  }
  boundaryResult.trace = {
    ...boundaryResult.trace,
    answer_mode: "domain_boundary",
    tool_calls: [
      {
        call_id: "gate-1",
        name: "classify_turn_gate",
        arguments: { gate_status: "domain_boundary" },
        latency_ms: 1,
      },
    ],
    turn_gate: {
      proposed: {
        gate_status: "domain_boundary",
        evidence_quote: "welchen nagellack soll ich kaufen?",
        confidence: 0.9,
        boundary_kind: "unsupported_domain",
      },
      authorized: {
        gate_status: "domain_boundary",
        evidence_quote: "welchen nagellack soll ich kaufen?",
        confidence: 0.9,
        boundary_kind: "unsupported_domain",
      },
      safety_mode: "normal",
      advisor_continuation_allowed: false,
      enabled: true,
      latency_ms: 8,
    },
    final_product_ids: [],
    session_memory_writes: [],
  }

  const result = await runAgentV2ProductionPipeline(
    {
      message: "welchen nagellack soll ich kaufen?",
      conversationId: "conversation-1",
      userId: "user-1",
      requestId: "request-1",
    },
    {
      verifyConversationOwnership,
      loadConversationHistory: async () => [],
      getUserContext: async () => ({
        profile: hairProfile,
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
      loadConversationState: async (): Promise<ConversationState> =>
        createDefaultConversationState(),
      client: {
        responses: {
          create: async () => ({ output: [] }),
        },
      },
      runAgentV2ResponsesTurn: async () => boundaryResult,
    },
  )

  assert.equal(result.answerMode, "domain_boundary")
  assert.equal(result.intent, "general_chat")
  assert.deepEqual(result.matchedProducts, [])
  assert.equal(result.categoryDecision, undefined)
  assert.equal(result.engineTrace, undefined)
  assert.equal(result.debugTrace.response_composition.attachment_mode, "text_only")
  assert.equal(result.debugTrace.latencies_ms.agent_turn_gate_ms, 8)
  assert.equal(
    await readStream(result.stream),
    boundaryResult.final_answer.payload.user_facing_answer_de,
  )
})

test("/api/chat persists visible boundary turns while skipping AgentV2 state and memory mutation", async () => {
  const messageRows: Array<Record<string, unknown>> = []
  const conversationUpdates: Array<Record<string, unknown>> = []
  const traceRows: Array<Record<string, unknown>> = []
  const statePersistenceCalls: unknown[] = []
  const memoryExtractionCalls: unknown[] = []
  const boundaryAnswer =
    "Bei Nagellack kann ich dir nicht sinnvoll helfen. Ich unterstütze dich gern bei Haarpflege."
  const routerDecision = {
    retrieval_mode: "agent_v2_responses",
    response_mode: "answer_direct",
    slot_completeness: 1,
    confidence: 0.95,
    policy_overrides: [],
  } as const
  const debugTrace = {
    request_id: "request-1",
    started_at: "2026-06-04T12:00:00.000Z",
    user_message: "[agent_v2_user_message chars=32]",
    conversation_id: "conversation-1",
    intent: "general_chat",
    product_category: null,
    conversation_history_count: 0,
    classification: {
      intent: "general_chat",
      product_category: null,
      complexity: "simple",
      needs_clarification: false,
      retrieval_mode: "agent_v2_responses",
      normalized_filters: {},
      router_confidence: 0.95,
    },
    router_decision: routerDecision,
    conversation_state: {
      previous_state: null,
      next_state: null,
      changed_fields: [],
      updated_by_engine: "agent_v2_care_balance",
    },
    clarification_questions: [],
    hair_profile_snapshot: null,
    memory_context: null,
    retrieval: {
      retrieved_count: 0,
      chunks: [],
      citations: [],
    },
    decision_context: {
      should_plan_routine: false,
      routine_plan: null,
      category_decision: null,
      engine_trace: null,
      matched_products: [],
    },
    prompt_refs: {
      classification: null,
      synthesis: null,
    },
    prompt: {
      prompt_id: "agent_v2",
      prompt_ref: null,
      included_sections: [],
      estimated_tokens: 0,
    },
    response_composition: {
      attachment_mode: "text_only",
    },
    engine_variant: "agent_v2_care_balance",
    agent_v2_trace: {
      engine: "agent_v2",
      model: "gpt-5.4-mini",
      endpoint: "responses",
      reasoning_effort: "medium",
      safety_mode: "normal",
      answer_mode: "domain_boundary",
      response_ids: ["response-1"],
      model_steps: [],
      tool_calls: [
        {
          call_id: "gate-1",
          name: "classify_turn_gate",
          arguments: { gate_status: "domain_boundary" },
          latency_ms: 1,
        },
      ],
      blocked_tool_calls: [],
      loaded_guidance_package_ids: [],
      validation_errors: [],
      validation_warnings: [],
      request_interpretation: null,
      request_interpretation_summary: null,
      bounded_repair_kind: null,
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
      turn_gate: {
        proposed: {
          gate_status: "domain_boundary",
          evidence_quote: "welchen nagellack soll ich kaufen?",
          confidence: 0.9,
          boundary_kind: "unsupported_domain",
        },
        authorized: {
          gate_status: "domain_boundary",
          evidence_quote: "welchen nagellack soll ich kaufen?",
          confidence: 0.9,
          boundary_kind: "unsupported_domain",
        },
        safety_mode: "normal",
        advisor_continuation_allowed: false,
        enabled: true,
        latency_ms: 8,
      },
    },
    latencies_ms: {
      classification_ms: 0,
      hair_profile_load_ms: 0,
      memory_load_ms: 0,
      routine_planning_ms: 0,
      history_load_ms: 0,
      router_ms: 0,
      conversation_create_ms: 0,
      retrieval_ms: 0,
      product_matching_ms: 0,
      prompt_build_ms: 0,
      stream_setup_ms: 0,
      agent_runtime_ms: 10,
      agent_turn_gate_ms: 8,
      agent_model_ms: 9,
      agent_tool_ms: 1,
    },
  }
  const admin = createFakeChatAdminClient({
    messageRows,
    conversationUpdates,
  })
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
    getLangfuseClient: () =>
      ({
        getTraceUrl: async () => "https://langfuse.test/trace/trace-1",
      }) as never,
    getLangfuseRelease: () => "test-release",
    resolveLangfuseTraceId: () => "trace-1",
    startObservation: () =>
      ({
        otelSpan: {},
        update: () => {},
        end: () => {},
      }) as never,
    propagateAttributes: ((_attributes: unknown, fn: () => unknown) => fn()) as never,
    otelContext: {
      active: () => ({}),
      with: async (_context: unknown, fn: () => unknown) => fn(),
    } as never,
    otelTrace: {
      setSpan: () => ({}),
    } as never,
    loadRuntimeDeps: async () =>
      ({
        createAdminClient: () => admin,
        runAgentV2ProductionPipeline: async () => ({
          stream: createTextStream(boundaryAnswer),
          intent: "general_chat",
          matchedProducts: [],
          sources: [],
          retrievalSummary: { final_context_count: 0 },
          routerDecision,
          conversationStateTransition: debugTrace.conversation_state,
          categoryDecision: undefined,
          engineTrace: undefined,
          debugTrace,
          visibleFailure: false,
          answerMode: "domain_boundary",
        }),
        buildAssistantDecisionContext: () => null,
        buildDoneEventData: ({ intent }: { intent: string }) => ({ intent }),
        extractConversationMemory: (...args: unknown[]) => {
          memoryExtractionCalls.push(args)
          return Promise.resolve()
        },
        buildRetrievalDebugEventData: () => ({ route_debug: true }),
        finalizeChatTurnTrace: (
          trace: Record<string, unknown>,
          params: Record<string, unknown>,
        ) => ({
          ...trace,
          status: params.status,
          conversation_state_persistence: params.conversation_state_persistence,
        }),
        summarizeEngineTraceForLangfuse: () => null,
        summarizeProductsForLangfuse: () => [],
        summarizeAgentV2TraceForLangfuse: () => ({ answer_mode: "domain_boundary" }),
        persistConversationStateTransition: async (...args: unknown[]) => {
          statePersistenceCalls.push(args)
          return { status: "persisted", error: null }
        },
        chatMessageSchema: {
          safeParse: (value: unknown) => ({ success: true, data: value }),
        },
        generateConversationTitle: async () => {},
      }) as never,
    persistConversationTurnTrace: async (row) => {
      traceRows.push(row)
    },
    randomUUID: () => "request-1",
    now: () => 0,
  })

  const response = await handler(
    new Request("https://example.test/api/chat", {
      method: "POST",
      body: JSON.stringify({
        message: "welchen nagellack soll ich kaufen?",
        conversation_id: "conversation-1",
      }),
    }),
  )
  const responseText = await response.text()

  assert.equal(response.status, 200)
  assert.match(responseText, /conversation_id/)
  assert.match(responseText, new RegExp(boundaryAnswer))
  assert.deepEqual(
    messageRows.map((row) => row.role),
    ["user", "assistant"],
  )
  assert.equal(messageRows[0]?.content, "welchen nagellack soll ich kaufen?")
  assert.equal(messageRows[1]?.content, boundaryAnswer)
  assert.equal(conversationUpdates.length, 1)
  assert.equal(statePersistenceCalls.length, 0)
  assert.equal(memoryExtractionCalls.length, 0)
  assert.equal(traceRows.length, 1)
  const persistedTrace = traceRows[0]?.trace as
    | { conversation_state_persistence?: { status?: string; error?: string | null } }
    | undefined
  assert.deepEqual(persistedTrace?.conversation_state_persistence, {
    status: "skipped",
    error: "answer_mode_no_state_mutation",
  })
})

test("AgentV2 production pipeline uses observed OpenAI and managed prompt refs by default", async () => {
  const previousOpenAIKey = process.env.OPENAI_API_KEY
  const previousObservationFlag = process.env.AGENT_V2_LANGFUSE_OBSERVATION
  process.env.OPENAI_API_KEY = "test-openai-key"
  delete process.env.AGENT_V2_LANGFUSE_OBSERVATION

  const managedRef = {
    name: "chaarlie-agent-v2-responses-care-balance",
    version: 17,
    label: "production",
    is_fallback: false,
  }
  const observedClient = { responses: { create: async () => ({ output: [] }) } }
  let observedConfig: { generationName?: unknown; langfusePrompt?: unknown } | null = null
  let receivedClient: unknown = null

  try {
    const result = await runAgentV2ProductionPipeline(
      {
        message: "Welches Shampoo passt?",
        conversationId: "conversation-1",
        userId: "user-1",
        requestId: "request-1",
      },
      {
        verifyConversationOwnership,
        loadConversationHistory: async () => [],
        getUserContext: async () => ({
          profile: createCompleteHairProfile(),
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
        loadConversationState: async (): Promise<ConversationState> =>
          createDefaultConversationState(),
        getManagedTextPromptTemplate: async () => ({
          template: "Managed AgentV2 prompt",
          ref: managedRef,
        }),
        getObservedOpenAI: (config) => {
          observedConfig = config ?? {}
          return observedClient as never
        },
        runAgentV2ResponsesTurn: async (params) => {
          receivedClient = params.client
          return createAgentV2Result()
        },
      },
    )

    assert.equal(receivedClient, observedClient)
    assert.notEqual(observedConfig, null)
    const capturedObservedConfig = observedConfig as unknown as {
      generationName?: unknown
      langfusePrompt?: unknown
    }
    assert.equal(capturedObservedConfig.generationName, "agent-v2-responses-step")
    assert.deepEqual(capturedObservedConfig.langfusePrompt, {
      name: managedRef.name,
      version: managedRef.version,
      isFallback: managedRef.is_fallback,
    })
    assert.deepEqual(result.debugTrace.prompt.prompt_ref, managedRef)
    assert.deepEqual(result.debugTrace.prompt_refs.classification, managedRef)
  } finally {
    if (previousOpenAIKey === undefined) {
      delete process.env.OPENAI_API_KEY
    } else {
      process.env.OPENAI_API_KEY = previousOpenAIKey
    }
    if (previousObservationFlag === undefined) {
      delete process.env.AGENT_V2_LANGFUSE_OBSERVATION
    } else {
      process.env.AGENT_V2_LANGFUSE_OBSERVATION = previousObservationFlag
    }
  }
})

test("AgentV2 production pipeline can disable observed OpenAI via rollback flag", async () => {
  const previousOpenAIKey = process.env.OPENAI_API_KEY
  const previousObservationFlag = process.env.AGENT_V2_LANGFUSE_OBSERVATION
  process.env.OPENAI_API_KEY = "test-openai-key"
  process.env.AGENT_V2_LANGFUSE_OBSERVATION = "disabled"

  const rawClient = { responses: { create: async () => ({ output: [] }) } }
  const observedClient = { responses: { create: async () => ({ output: [] }) } }
  let observedCalled = false
  let receivedClient: unknown = null

  try {
    await runAgentV2ProductionPipeline(
      {
        message: "Welches Shampoo passt?",
        conversationId: "conversation-1",
        userId: "user-1",
        requestId: "request-1",
      },
      {
        verifyConversationOwnership,
        loadConversationHistory: async () => [],
        getUserContext: async () => ({
          profile: createCompleteHairProfile(),
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
        loadConversationState: async (): Promise<ConversationState> =>
          createDefaultConversationState(),
        getManagedTextPromptTemplate: async () => ({
          template: "Fallback AgentV2 prompt",
          ref: {
            name: "chaarlie-agent-v2-responses-care-balance",
            version: null,
            label: "staging",
            is_fallback: true,
          },
        }),
        getOpenAI: () => rawClient as never,
        getObservedOpenAI: () => {
          observedCalled = true
          return observedClient as never
        },
        runAgentV2ResponsesTurn: async (params) => {
          receivedClient = params.client
          return createAgentV2Result()
        },
      },
    )

    assert.equal(observedCalled, false)
    assert.equal(receivedClient, rawClient)
  } finally {
    if (previousOpenAIKey === undefined) {
      delete process.env.OPENAI_API_KEY
    } else {
      process.env.OPENAI_API_KEY = previousOpenAIKey
    }
    if (previousObservationFlag === undefined) {
      delete process.env.AGENT_V2_LANGFUSE_OBSERVATION
    } else {
      process.env.AGENT_V2_LANGFUSE_OBSERVATION = previousObservationFlag
    }
  }
})

test("AgentV2 production pipeline treats any runtime failure stage as visible failure", async () => {
  const hairProfile = createCompleteHairProfile()
  const product = createProduct("primary")
  const selection: SelectProductsToolResult = {
    projection: {
      category: "shampoo",
      decision: "recommended",
      product_response_policy: "recommend",
      policy_reason: "Explicit product ask.",
      profile_basis: [],
      category_guidance: "Shampoo passt als konkrete Produktempfehlung.",
      products: [
        {
          rank: 1,
          product_id: product.id,
          name: product.name,
          brand: product.brand,
          price_eur: product.price_eur,
          currency: product.currency,
          fit_reason: "Passt.",
          caveat: null,
          supported_claims: [],
          unsupported_requested_signals: [],
        },
      ],
      comparison_facts: null,
      missing_info: [],
      unsupported_requested_signals: [],
    },
    products: [product],
    effectiveHairProfile: hairProfile,
    runtime: buildRecommendationEngineRuntimeForChat({
      hairProfile,
      routineItems: [],
      productCategory: "shampoo",
      message: "Welches Shampoo passt?",
    }),
  }
  const failedResult = createAgentV2Result()
  failedResult.trace.failure_stage = "repair_failed"
  failedResult.trace.validation_errors = []

  const result = await runAgentV2ProductionPipeline(
    {
      message: "Welches Shampoo passt?",
      conversationId: "conversation-1",
      userId: "user-1",
      requestId: "request-1",
    },
    {
      verifyConversationOwnership,
      loadConversationHistory: async () => [],
      getUserContext: async () => ({
        profile: hairProfile,
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
      loadConversationState: async (): Promise<ConversationState> =>
        createDefaultConversationState(),
      client: {
        responses: {
          create: async () => ({ output: [] }),
        },
      },
      createSelectProductsTool:
        (options = {}) =>
        async () => {
          options.onResult?.(selection)
          return selection.projection
        },
      runAgentV2ResponsesTurn: async (params) => {
        await params.tools.select_products({ category: "shampoo" })
        return failedResult
      },
    },
  )

  assert.equal(result.visibleFailure, true)
  assert.equal(result.routerDecision.response_mode, "clarify_only")
  assert.deepEqual(result.matchedProducts, [])
  assert.equal(result.categoryDecision, undefined)
  assert.equal(result.engineTrace, undefined)
  const nextState = result.conversationStateTransition.next_state as AgentV2ConversationStateV2
  assert.deepEqual(nextState.agent_v2.prior_selected_product_projections, [])
  assert.equal(buildRetrievalDebugEventData(result.debugTrace).agent_v2_visible_failure, true)
})

test("AgentV2 product cards do not fall back to unrelated current-turn products for prior-only ids", () => {
  const currentProduct = createProduct("current-product")
  const hairProfile = createCompleteHairProfile()
  const answer = createAgentV2Result().final_answer
  if (answer.answer_mode !== "product_recommendation") {
    throw new Error("Expected product recommendation fixture")
  }
  answer.tool_grounding.product_ids = ["prior-product"]
  answer.payload.recommendations = [
    {
      product_id: "prior-product",
      reason_de: "War im vorherigen Turn sichtbar.",
      usage_de: null,
      caveat_de: null,
    },
  ]

  assert.deepEqual(
    deriveMatchedProducts({
      answer,
      selectedProductResults: [
        {
          projection: {
            category: "leave_in",
            decision: "recommended",
            product_response_policy: "recommend",
            policy_reason: "Current turn selection.",
            profile_basis: [],
            category_guidance: "",
            products: [
              {
                rank: 1,
                product_id: currentProduct.id,
                name: currentProduct.name,
                brand: currentProduct.brand,
                price_eur: currentProduct.price_eur,
                currency: currentProduct.currency,
                fit_reason: "Current turn product.",
                caveat: null,
                supported_claims: [],
                unsupported_requested_signals: [],
              },
            ],
            comparison_facts: null,
            missing_info: [],
            unsupported_requested_signals: [],
          },
          products: [currentProduct],
          effectiveHairProfile: hairProfile,
          runtime: buildRecommendationEngineRuntimeForChat({
            hairProfile,
            routineItems: [],
            productCategory: "leave_in",
            message: "Warum dieses Produkt?",
          }),
        },
      ],
    }),
    [],
  )
})

test("AgentV2 production safety mode hard-stops severe persistent shedding", () => {
  assert.equal(
    classifyAgentV2ProductionSafetyMode(
      "Ich verliere extrem viele Haare seit Wochen und es wird nicht besser",
    ),
    "hard_short_circuit",
  )
})

test("AgentV2 production pipeline carries persisted routine thread context into the runtime", async () => {
  const pendingRoutineContext: AgentV2RoutineThreadContext = {
    active: true,
    current_layer: "basics",
    last_answer_mode: "routine",
    last_routine_categories: ["leave_in"],
    last_user_goal: "Ich will meine Routine erweitern.",
    summary_de: "Leave-in ist der sichtbare naechste Schritt.",
    pending_routine_action: {
      action: "add_step",
      routine_layer: "basics",
      category: "leave_in",
      source: "assistant_offer",
    },
    visible_steps: [
      {
        step_id: "maintenance-leave-in",
        label_de: "Leave-in",
        category: "leave_in",
        action: "add",
        necessity: "recommended",
        already_in_current_routine: false,
        order: 1,
        routine_layer: "basics",
      },
    ],
  }
  let receivedRoutineContext: unknown
  let receivedRoutineLayer: unknown

  const result = await runAgentV2ProductionPipeline(
    {
      message: "ja bitte",
      conversationId: "conversation-1",
      userId: "user-1",
      requestId: "request-1",
    },
    {
      verifyConversationOwnership,
      loadConversationHistory: async () => [],
      getUserContext: async () => ({
        profile: createCompleteHairProfile(),
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
      loadConversationState: async (): Promise<ConversationState> =>
        ({
          ...createDefaultConversationState(),
          active_topic: "routine",
          routine_layer: "goals",
          agent_v2_routine_thread_context: pendingRoutineContext,
        }) as ConversationState,
      client: {
        responses: {
          create: async () => ({ output: [] }),
        },
      },
      runAgentV2ResponsesTurn: async (params) => {
        receivedRoutineContext = params.routineThreadContext
        receivedRoutineLayer = params.currentRoutineLayer
        return createAgentV2Result()
      },
    },
  )

  const routineContext = receivedRoutineContext as AgentV2RoutineThreadContext | null
  assert.equal(routineContext?.pending_routine_action?.category, "leave_in")
  assert.equal(routineContext?.visible_steps[0]?.step_id, "maintenance-leave-in")
  assert.equal(receivedRoutineLayer, "basics")
  const nextState = result.conversationStateTransition.next_state as AgentV2ConversationStateV2
  assert.equal(nextState.agent_v2.routine_thread_context?.active, false)
})

test("AgentV2 production pipeline carries persisted surfaced product facts into the runtime", async () => {
  const priorProjection: Partial<AgentV2SelectProductsProjection> = {
    tool_name: "select_products",
    category: "leave_in",
    valid_product_ids: ["leave-in-1"],
    products: [
      {
        product_id: "leave-in-1",
        rank: 1,
        name: "Grounded Leave-in",
        brand: "Testmarke",
        price_eur: 12,
        currency: "EUR",
        fit_reason: "War im letzten Turn sichtbar.",
        caveat: null,
        supported_claims: [],
        unsupported_requested_signals: [],
      },
    ],
  }
  let receivedPriorProjectionCount = 0

  await runAgentV2ProductionPipeline(
    {
      message: "Warum genau dieses Produkt?",
      conversationId: "conversation-1",
      userId: "user-1",
      requestId: "request-1",
    },
    {
      verifyConversationOwnership,
      loadConversationHistory: async () => [],
      getUserContext: async () => ({
        profile: createCompleteHairProfile(),
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
      loadConversationState: async (): Promise<ConversationState> =>
        ({
          ...createDefaultConversationState(),
          agent_v2_prior_selected_product_projections: [priorProjection],
        }) as ConversationState,
      client: {
        responses: {
          create: async () => ({ output: [] }),
        },
      },
      runAgentV2ResponsesTurn: async (params) => {
        receivedPriorProjectionCount = params.priorSelectedProductProjections?.length ?? 0
        return createAgentV2Result()
      },
    },
  )

  assert.equal(receivedPriorProjectionCount, 1)
})

test("AgentV2 production pipeline carries session memory through conversation state", async () => {
  const persistedMemory: AgentV2SessionMemoryWrite = {
    type: "preference",
    text: "User likes light leave-ins.",
    evidence_quote: "Ich mag leichte Leave-ins.",
    confidence: 0.9,
    ttl: "session",
    affects_recommendations: true,
    expires_at_turn: null,
  }
  const acceptedMemory: AgentV2SessionMemoryWrite = {
    type: "constraint",
    text: "User wants fewer steps.",
    evidence_quote: "Ich will weniger Schritte.",
    confidence: 0.85,
    ttl: "session",
    affects_recommendations: true,
    expires_at_turn: null,
  }
  let receivedSessionMemoryCount = 0

  const result = await runAgentV2ProductionPipeline(
    {
      message: "Was passt dann?",
      conversationId: "conversation-1",
      userId: "user-1",
      requestId: "request-1",
    },
    {
      verifyConversationOwnership,
      loadConversationHistory: async () => [],
      getUserContext: async () => ({
        profile: createCompleteHairProfile(),
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
      loadConversationState: async (): Promise<ConversationState> =>
        ({
          ...createDefaultConversationState(),
          agent_v2_session_memory: [persistedMemory],
        }) as ConversationState,
      client: {
        responses: {
          create: async () => ({ output: [] }),
        },
      },
      runAgentV2ResponsesTurn: async (params) => {
        receivedSessionMemoryCount = params.userContext.sessionMemory.length
        return {
          ...createAgentV2Result(),
          accepted_session_memory_writes: [acceptedMemory],
        }
      },
    },
  )

  assert.equal(receivedSessionMemoryCount, 1)
  const nextState = result.conversationStateTransition.next_state as AgentV2ConversationStateV2
  assert.equal(nextState.agent_v2.session_memory.length, 2)
})

test("AgentV2 production pipeline ignores legacy V1 routine fields without flat AgentV2 context", async () => {
  let receivedRoutineContext: unknown = "not-called"
  let receivedRoutineLayer: unknown = "not-called"

  await runAgentV2ProductionPipeline(
    {
      message: "Welches Shampoo passt?",
      conversationId: "conversation-1",
      userId: "user-1",
      requestId: "request-1",
    },
    {
      verifyConversationOwnership,
      loadConversationHistory: async () => [],
      getUserContext: async () => ({
        profile: createCompleteHairProfile(),
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
      loadConversationState: async (): Promise<ConversationState> =>
        ({
          ...createDefaultConversationState(),
          active_topic: "routine",
          routine_layer: "basics",
        }) as ConversationState,
      client: {
        responses: {
          create: async () => ({ output: [] }),
        },
      },
      runAgentV2ResponsesTurn: async (params) => {
        receivedRoutineContext = params.routineThreadContext
        receivedRoutineLayer = params.currentRoutineLayer
        return createAgentV2Result()
      },
    },
  )

  assert.equal(receivedRoutineContext, null)
  assert.equal(receivedRoutineLayer, null)
})

test("/api/chat imports only the AgentV2 production chat pipeline", async () => {
  const routeSource = await readFile("src/app/api/chat/route.ts", "utf8")
  const legacyProductionImport = "@/lib/agent/" + "legacy-production"
  const legacyProductionRunner = "runProduction" + "AgentPipeline"

  assert.match(routeSource, /@\/lib\/agent-v2\/production\/chat-pipeline/)
  assert.doesNotMatch(routeSource, /@\/lib\/agent\/production/)
  assert.doesNotMatch(routeSource, new RegExp(legacyProductionImport.replaceAll("/", "\\/")))
  assert.doesNotMatch(routeSource, new RegExp(`\\b${legacyProductionRunner}\\b`))
  assert.match(routeSource, /\brunAgentV2ProductionPipeline\b/)
})
