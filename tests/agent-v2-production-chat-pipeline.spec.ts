import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import {
  classifyAgentV2ProductionSafetyMode,
  runAgentV2ProductionPipeline,
} from "../src/lib/agent-v2/production/chat-pipeline"
import { loadAgentV2ProductionConversationHistory } from "../src/lib/agent-v2/production/conversation-history"
import { deriveMatchedProducts } from "../src/lib/agent-v2/production/product-output"
import { createDefaultConversationState } from "../src/lib/rag/conversation-state"
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
import { buildRetrievalDebugEventData } from "../src/lib/rag/debug-trace"

type SelectProductsToolParams = Parameters<ReturnType<typeof createSelectProductsTool>>[0]

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
    wash_frequency: "every_2_3_days",
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

  assert.match(routeSource, /@\/lib\/agent-v2\/production\/chat-pipeline/)
  assert.doesNotMatch(routeSource, /@\/lib\/agent\/production/)
  assert.doesNotMatch(routeSource, /@\/lib\/agent\/legacy-production/)
  assert.doesNotMatch(routeSource, /\brunProductionAgentPipeline\b/)
  assert.match(routeSource, /\brunAgentV2ProductionPipeline\b/)
})
