import assert from "node:assert/strict"
import test from "node:test"
import type { PropagateAttributesParams } from "@langfuse/tracing"

import { createChatPostHandler } from "../src/app/api/chat/route"
import { runProductionAgentPipeline } from "../src/lib/agent/production/chat-pipeline"
import type {
  AgenticToolLoopModelClient,
  AgenticToolLoopModelStep,
} from "../src/lib/agent/orchestrator/model-client"
import { buildRecommendationEngineRuntimeForChat } from "../src/lib/recommendation-engine"
import { createDefaultConversationState } from "../src/lib/rag/conversation-state"
import type {
  BuildOrFixRoutineProjection,
  BuildOrFixRoutineToolInput,
} from "../src/lib/agent/tools/build-or-fix-routine"
import type { LoadAdvisorGuidanceInput } from "../src/lib/agent/tools/load-advisor-guidance"
import type {
  createSelectProductsTool,
  SelectedProductsProjection,
  SelectProductsToolResult,
} from "../src/lib/agent/tools/select-products"
import type { ConversationStateTransition, HairProfile, Message, Product } from "../src/lib/types"

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

function createTextStream(content: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(content))
      controller.close()
    },
  })
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
    const filters: Record<string, unknown> = {}

    const resolveSingle = (): Promise<{ data: unknown; error: unknown }> => {
      if (table === "conversations" && operation === "insert") {
        return Promise.resolve({ data: { id: "conversation-1" }, error: null })
      }

      if (table === "conversations" && operation === "select") {
        if (filters.id === "other-conversation" || filters.user_id !== "user-1") {
          return Promise.resolve({
            data: null,
            error: { message: "conversation not found" },
          })
        }

        return Promise.resolve({ data: { id: filters.id ?? "conversation-1" }, error: null })
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
      eq(column: string, value: unknown) {
        filters[column] = value
        return chain
      },
      single: resolveSingle,
      then<TResult1 = { data: unknown; error: unknown }, TResult2 = never>(
        onfulfilled?:
          | ((value: { data: unknown; error: unknown }) => TResult1 | PromiseLike<TResult1>)
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

function createConversationStateTransition(): ConversationStateTransition {
  const previousState = createDefaultConversationState()

  return {
    previous_state: previousState,
    next_state: {
      ...previousState,
      active_topic: "shampoo",
      last_product_category: "shampoo",
      last_assistant_action: "answered_direct",
    },
    reason: "product_topic_started",
    changed_fields: ["active_topic", "last_product_category", "last_assistant_action"],
    classifier_override: null,
    updated_by_engine: "tool_loop",
  }
}

function createUserContext(profile: HairProfile | null = createCompleteHairProfile()) {
  return {
    profile,
    routine_inventory: [],
    relevant_memory: [],
    derived_signals: [],
    suggested_overlays: [],
    missing_profile: [],
  }
}

function createMemoryContext() {
  return {
    enabled: true,
    entries: [],
    promptContext: null,
    dislikedProductNames: [],
  }
}

function createTerminalStep(params: {
  answer: string
  productIds?: string[]
  activeTopic?: string | null
  lastProductCategory?: string | null
  lastAssistantAction?: string
  reason?: string
}): AgenticToolLoopModelStep {
  return {
    type: "tool_calls",
    calls: [
      {
        id: "final-1",
        name: "submit_final_answer",
        input: {
          answer: params.answer,
          product_ids: params.productIds ?? [],
          state_patch: {
            active_topic: params.activeTopic ?? null,
            routine_layer: null,
            last_product_category: params.lastProductCategory ?? null,
            last_assistant_action: params.lastAssistantAction ?? "answered_direct",
            topic_relation: "category_switch",
            reason: params.reason ?? "tool_loop_answered",
          },
        },
      },
    ],
  }
}

function createFakeToolLoopModel(steps: AgenticToolLoopModelStep[]): AgenticToolLoopModelClient {
  const queue = [...steps]

  return {
    async runStep() {
      const step = queue.shift()
      assert.ok(step, "Unexpected extra model step")
      return step
    },
    async classifyRoute() {
      throw new Error("Classic classifyRoute must not be called")
    },
    async renderFinalAnswer() {
      throw new Error("Classic renderFinalAnswer must not be called")
    },
  } as AgenticToolLoopModelClient
}

function createSelectedProductsResult(params: {
  projection: SelectedProductsProjection
  products: Product[]
  message: string
}): SelectProductsToolResult {
  const effectiveHairProfile = createCompleteHairProfile()
  return {
    projection: params.projection,
    products: params.products as SelectProductsToolResult["products"],
    effectiveHairProfile,
    runtime: buildRecommendationEngineRuntimeForChat({
      hairProfile: effectiveHairProfile,
      routineItems: [],
      productCategory: params.projection.category,
      message: params.message,
    }),
  }
}

function createSelectedProductsProjection(
  products: Product[],
  overrides: Partial<SelectedProductsProjection> = {},
): SelectedProductsProjection {
  return {
    category: "shampoo",
    decision: "recommended",
    product_response_policy: "recommend",
    policy_reason: "Explicit product ask.",
    profile_basis: [],
    category_guidance: "Shampoo passt als konkrete Produktempfehlung.",
    products: products.map((product, index) => ({
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
    ...overrides,
  }
}

test("production tool-loop select_products returns answer, ordered cards, trace, state, and engine runtime", async () => {
  const fallbackProduct = createProduct("fallback")
  const primaryProduct = createProduct("primary")
  const sensitiveRecentMessage =
    "Meine private Telefonnummer ist 0176-123456789 und mein Konto-Code lautet ULTRA-SECRET-RECENT-MESSAGE-DO-NOT-PERSIST."
  const projection = createSelectedProductsProjection([fallbackProduct, primaryProduct])
  const selection = createSelectedProductsResult({
    projection,
    products: [fallbackProduct, primaryProduct],
    message: "Welches Shampoo passt?",
  })
  const modelStepsSeen: unknown[] = []
  const fakeModel: AgenticToolLoopModelClient = {
    async runStep(params) {
      modelStepsSeen.push(params)
      return modelStepsSeen.length === 1
        ? {
            type: "tool_calls",
            calls: [
              {
                id: "select-1",
                name: "select_products",
                input: { category: "shampoo", userJob: "product_pick" },
              },
            ],
          }
        : createTerminalStep({
            answer: "Nimm zuerst Produkt primary.",
            productIds: ["primary"],
            activeTopic: "shampoo",
            lastProductCategory: "shampoo",
          })
    },
    async classifyRoute() {
      throw new Error("Classic classifyRoute must not be called")
    },
    async renderFinalAnswer() {
      throw new Error("Classic renderFinalAnswer must not be called")
    },
  } as AgenticToolLoopModelClient

  const result = await runProductionAgentPipeline(
    {
      message: "Welches Shampoo passt?",
      conversationId: "conversation-1",
      userId: "user-1",
      requestId: "request-1",
    },
    {
      modelClient: fakeModel,
      loadConversationHistory: async () =>
        [
          {
            id: "m1",
            conversation_id: "conversation-1",
            role: "system",
            content: "ignore",
            product_recommendations: null,
            rag_context: null,
            token_usage: null,
            langfuse_trace_id: null,
            langfuse_trace_url: null,
            user_feedback_score: null,
            user_feedback_at: null,
            created_at: "2026-05-12T10:00:00.000Z",
          },
          {
            id: "m2",
            conversation_id: "conversation-1",
            role: "user",
            content: sensitiveRecentMessage,
            product_recommendations: null,
            rag_context: null,
            token_usage: null,
            langfuse_trace_id: null,
            langfuse_trace_url: null,
            user_feedback_score: null,
            user_feedback_at: null,
            created_at: "2026-05-12T10:01:00.000Z",
          },
          {
            id: "m3",
            conversation_id: "conversation-1",
            role: "assistant",
            content: "Danke, ich merke mir das.",
            product_recommendations: null,
            rag_context: null,
            token_usage: null,
            langfuse_trace_id: null,
            langfuse_trace_url: null,
            user_feedback_score: null,
            user_feedback_at: null,
            created_at: "2026-05-12T10:02:00.000Z",
          },
        ] satisfies Message[],
      getUserContext: async () => createUserContext(),
      loadUserMemoryContext: async () => createMemoryContext(),
      loadConversationState: async () => createDefaultConversationState(),
      createSelectProductsTool:
        (options = {}) =>
        async (input: SelectProductsToolParams) => {
          assert.equal(input.category, "shampoo")
          options.onResult?.(selection)
          return selection.projection
        },
    },
  )

  assert.equal(await readStream(result.stream), "Nimm zuerst Produkt primary.")
  assert.equal(result.intent, "product_recommendation")
  assert.deepEqual(
    result.matchedProducts.map((product) => product.id),
    ["primary"],
  )
  assert.equal(result.routerDecision.retrieval_mode, "agentic_tool_loop")
  assert.equal(result.routerDecision.response_mode, "answer_direct")
  assert.equal(result.routerDecision.confidence, 1)
  assert.equal(result.conversationStateTransition.updated_by_engine, "tool_loop")
  assert.equal(result.categoryDecision?.category, "shampoo")
  assert.equal(result.engineTrace?.request_context.requestedCategory, "shampoo")
  assert.equal(result.debugTrace.engine_variant, "tool_loop")
  assert.equal(result.debugTrace.agentic_tool_loop?.engine_variant, "tool_loop")
  assert.equal(result.debugTrace.agentic_tool_loop?.answer_composition_mode, "inline_context")
  assert.equal(result.debugTrace.agentic_tool_loop?.tool_calls[0]?.name, "select_products")
  assert.equal(
    result.debugTrace.decision_context.engine_trace?.request_context.requestedCategory,
    "shampoo",
  )
  assert.equal(result.debugTrace.response_composition.attachment_mode, "cards")

  const firstUserMessage = (
    modelStepsSeen[0] as { messages: Array<{ role: string; content: string }> }
  ).messages[0]
  const payload = JSON.parse(firstUserMessage.content) as {
    recent_messages: Array<{ role: string; content: string }>
  }
  assert.deepEqual(payload.recent_messages, [
    { role: "user", content: sensitiveRecentMessage },
    { role: "assistant", content: "Danke, ich merke mir das." },
  ])

  const debugPromptPayload = JSON.parse(result.debugTrace.prompt.messages[0]?.content ?? "{}") as {
    latest_user_message_chars?: number
    recent_message_count?: number
  }
  assert.equal(debugPromptPayload.recent_message_count, 2)
  assert.equal(debugPromptPayload.latest_user_message_chars, "Welches Shampoo passt?".length)
  assert.equal(result.debugTrace.user_message, "[tool_loop_user_message chars=22]")
  assert.equal(JSON.stringify(result.debugTrace.prompt).includes("Welches Shampoo passt?"), false)
  assert.equal(JSON.stringify(result.debugTrace.prompt).includes(sensitiveRecentMessage), false)
})

test("production tool-loop falls back to deterministic selected order when terminal product ids are invalid", async () => {
  const fallbackProduct = createProduct("fallback")
  const primaryProduct = createProduct("primary")
  const projection = createSelectedProductsProjection([fallbackProduct, primaryProduct])
  const selection = createSelectedProductsResult({
    projection,
    products: [fallbackProduct, primaryProduct],
    message: "Welches Shampoo passt?",
  })

  const result = await runProductionAgentPipeline(
    {
      message: "Welches Shampoo passt?",
      conversationId: "conversation-1",
      userId: "user-1",
      requestId: "request-1",
    },
    {
      modelClient: createFakeToolLoopModel([
        {
          type: "tool_calls",
          calls: [
            {
              id: "select-1",
              name: "select_products",
              input: { category: "shampoo", userJob: "product_pick" },
            },
          ],
        },
        createTerminalStep({
          answer: "Hier sind zwei Optionen.",
          productIds: ["missing-product"],
          activeTopic: "shampoo",
          lastProductCategory: "shampoo",
        }),
      ]),
      loadConversationHistory: async () => [],
      getUserContext: async () => createUserContext(),
      loadUserMemoryContext: async () => createMemoryContext(),
      loadConversationState: async () => createDefaultConversationState(),
      createSelectProductsTool:
        (options = {}) =>
        async () => {
          options.onResult?.(selection)
          return selection.projection
        },
    },
  )

  assert.deepEqual(
    result.matchedProducts.map((product) => product.id),
    ["fallback", "primary"],
  )
})

test("production tool-loop conceptual guidance has no products and exposes loaded guidance ids", async () => {
  const result = await runProductionAgentPipeline(
    {
      message: "Was ist der Unterschied zwischen Leave-in und Conditioner?",
      conversationId: "conversation-1",
      userId: "user-1",
      requestId: "request-1",
    },
    {
      modelClient: createFakeToolLoopModel([
        {
          type: "tool_calls",
          calls: [
            {
              id: "guidance-1",
              name: "load_advisor_guidance",
              input: {
                intent: "category_explanation",
                category: "leave_in",
                categories: ["leave_in", "conditioner"],
                profileFocus: [],
              },
            },
          ],
        },
        createTerminalStep({
          answer: "Conditioner wird ausgespuelt, Leave-in bleibt im Haar.",
        }),
      ]),
      loadConversationHistory: async () => [],
      getUserContext: async () => createUserContext(),
      loadUserMemoryContext: async () => createMemoryContext(),
      loadConversationState: async () => createDefaultConversationState(),
      loadAdvisorGuidance: async (input: LoadAdvisorGuidanceInput) => ({
        loaded_guidance_ids: ["topic:leave_in", "topic:conditioner"],
        direct_answer_frame: `Guidance for ${input.category}`,
        key_advice_points: [],
        profile_interpretation: [],
        category_implications: [],
        category_sections: [],
        avoid: [],
        proactive_next_step_options: [],
      }),
    },
  )

  assert.equal(result.intent, "hair_care_advice")
  assert.deepEqual(result.matchedProducts, [])
  assert.equal(result.routerDecision.response_mode, "answer_direct")
  assert.equal(result.debugTrace.response_composition.attachment_mode, "text_only")
  assert.deepEqual(result.debugTrace.agentic_tool_loop?.loaded_guidance_ids, [
    "topic:leave_in",
    "topic:conditioner",
  ])
  assert.equal(result.debugTrace.decision_context.engine_trace, null)
})

test("production tool-loop routine path returns routine intent and projected routine trace", async () => {
  const routinePlan: BuildOrFixRoutineProjection = {
    objective: "build_routine",
    steps: [
      {
        id: "base-shampoo",
        label: "Shampoo",
        necessity: "core",
        action: "add",
        category: "shampoo",
        frequency: "Waschtag",
        reasons: ["Basis"],
        caveats: [],
        fillable: true,
      },
    ],
    missing_info: [],
    confidence: 0.8,
  }

  const result = await runProductionAgentPipeline(
    {
      message: "Baue mir eine Routine.",
      conversationId: "conversation-1",
      userId: "user-1",
      requestId: "request-1",
    },
    {
      modelClient: createFakeToolLoopModel([
        {
          type: "tool_calls",
          calls: [
            {
              id: "routine-1",
              name: "build_or_fix_routine",
              input: { objective: "build_routine", layer: "basics" },
            },
          ],
        },
        createTerminalStep({
          answer: "Starte mit einem milden Shampoo.",
          activeTopic: "routine",
          lastAssistantAction: "answered_routine",
          reason: "routine_started",
        }),
      ]),
      loadConversationHistory: async () => [],
      getUserContext: async () => createUserContext(),
      loadUserMemoryContext: async () => createMemoryContext(),
      loadConversationState: async () => createDefaultConversationState(),
      createBuildOrFixRoutineTool: () => async (input: BuildOrFixRoutineToolInput) => {
        assert.equal(input.objective, "build_routine")
        return routinePlan
      },
    },
  )

  assert.equal(result.intent, "routine_help")
  assert.equal(result.conversationStateTransition.next_state.active_topic, "routine")
  assert.equal(result.debugTrace.decision_context.should_plan_routine, true)
  assert.equal(result.debugTrace.agentic_tool_loop?.tool_calls[0]?.name, "build_or_fix_routine")
  assert.match(result.debugTrace.agentic_tool_loop?.tool_calls[0]?.output_summary ?? "", /routine/)
})

test("production tool-loop visible failure becomes general chat with clarify-only compatibility", async () => {
  const result = await runProductionAgentPipeline(
    {
      message: "???",
      conversationId: "conversation-1",
      userId: "user-1",
      requestId: "request-1",
    },
    {
      modelClient: createFakeToolLoopModel([
        { type: "message", content: "Ich weiss nicht." },
        { type: "message", content: "Immer noch nicht." },
        { type: "message", content: "Nope." },
        { type: "message", content: "Nope." },
        { type: "message", content: "repair failed" },
      ]),
      loadConversationHistory: async () => [],
      getUserContext: async () => createUserContext(null),
      loadUserMemoryContext: async () => createMemoryContext(),
      loadConversationState: async () => createDefaultConversationState(),
    },
  )

  assert.equal(result.intent, "general_chat")
  assert.equal(result.routerDecision.response_mode, "clarify_only")
  assert.equal(result.routerDecision.confidence, 0)
  assert.equal(result.conversationStateTransition.reason, "tool_loop_visible_failure")
  assert.equal(result.visibleFailure, true)
  assert.equal(result.debugTrace.agentic_tool_loop?.visible_failure, true)
})

test("production tool-loop visible failure normalizes product artifacts at pipeline boundary", async () => {
  const product = createProduct("primary")
  const selection = createSelectedProductsResult({
    projection: createSelectedProductsProjection([product]),
    products: [product],
    message: "Welches Shampoo passt?",
  })

  const result = await runProductionAgentPipeline(
    {
      message: "Welches Shampoo passt?",
      conversationId: "conversation-1",
      userId: "user-1",
      requestId: "request-1",
    },
    {
      modelClient: createFakeToolLoopModel([
        {
          type: "tool_calls",
          calls: [
            {
              id: "select-1",
              name: "select_products",
              input: { category: "shampoo", userJob: "product_pick" },
            },
          ],
        },
        { type: "message", content: "not terminal" },
        { type: "message", content: "still not terminal" },
        { type: "message", content: "repair requested" },
        { type: "message", content: "repair failed" },
      ]),
      loadConversationHistory: async () => [],
      getUserContext: async () => createUserContext(),
      loadUserMemoryContext: async () => createMemoryContext(),
      loadConversationState: async () => createDefaultConversationState(),
      createSelectProductsTool:
        (options = {}) =>
        async () => {
          options.onResult?.(selection)
          return selection.projection
        },
    },
  )

  assert.equal(result.visibleFailure, true)
  assert.deepEqual(result.matchedProducts, [])
  assert.equal(result.categoryDecision, undefined)
  assert.equal(result.engineTrace, undefined)
  assert.equal(result.debugTrace.decision_context.category_decision, null)
  assert.equal(result.debugTrace.decision_context.engine_trace, null)
  assert.deepEqual(result.debugTrace.decision_context.matched_products, [])
  assert.equal(result.debugTrace.response_composition.attachment_mode, "text_only")
})

test("POST /api/chat rejects existing conversations that do not belong to the user", async () => {
  const fakeAdmin = createFakeAdmin()
  const pipelineCalls: unknown[] = []
  const handler = createChatPostHandler({
    createClient: async () =>
      ({
        auth: {
          getUser: async () => ({ data: { user: { id: "user-1" } } }),
        },
      }) as never,
    checkRateLimit: async () => ({ allowed: true }) as never,
    loadRuntimeDeps: async () =>
      ({
        createAdminClient: () => fakeAdmin.client,
        runProductionAgentPipeline: async (params: unknown) => {
          pipelineCalls.push(params)
          throw new Error("pipeline should not run")
        },
        buildAssistantRagContext: () => ({}),
        buildDoneEventData: (params: unknown) => params,
        persistConversationStateTransition: async () => ({ status: "persisted", error: null }),
        extractConversationMemory: async () => {},
        buildRetrievalDebugEventData: (trace: unknown) => ({ trace }),
        finalizeChatTurnTrace: (trace: unknown) => trace,
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
      body: JSON.stringify({
        message: "Hallo",
        conversation_id: "other-conversation",
      }),
    }),
  )
  const body = (await response.json()) as { error?: string }

  assert.equal(response.status, 404)
  assert.equal(body.error, "Unterhaltung nicht gefunden")
  assert.deepEqual(pipelineCalls, [])
  assert.deepEqual(fakeAdmin.inserts.messages, [])
})

test("POST /api/chat streams pipeline contract and persists assistant metadata", async () => {
  const fakeAdmin = createFakeAdmin()
  const persistedTurnTraces: unknown[] = []
  const persistedStateTransitions: unknown[] = []
  const conversationStateTransition = createConversationStateTransition()
  const matchedProduct = createProduct("primary")
  const categoryDecision = {
    category: "shampoo",
    relevant: true,
  }
  const engineTrace = {
    request_context: { requestedCategory: "shampoo" },
    categories: {
      shampoo: categoryDecision,
    },
  }
  const debugTrace: Record<string, unknown> = {
    request_id: "request-1",
    engine_variant: "tool_loop",
    conversation_state: conversationStateTransition,
    response_composition: {
      path: "agentic_tool_loop",
      migration_mode: "tool_loop",
      fallback_reason: null,
      rendering_path: null,
      plan_type: "tool_loop",
      attachment_mode: "cards",
    },
  }
  const routerDecision = {
    retrieval_mode: "agentic_tool_loop",
    response_mode: "answer_direct",
    confidence: 1,
    slot_completeness: 1,
    policy_overrides: ["agentic_tool_loop", "product_policy:recommend"],
  }
  const pipelineCalls: unknown[] = []
  const observationUpdates: unknown[] = []
  const agenticToolLoopTrace = {
    engine_variant: "tool_loop",
    answer_composition_mode: "composer_context",
    loaded_guidance_ids: ["topic:shampoo", "overlay:fine_hair"],
    answer_context_capsule_ids: ["global.natural_consultant"],
    consultation_brief_summary: null,
    repair_attempts: [
      {
        reason: "missing_terminal_answer",
        instruction_label: "terminal_protocol_repair",
      },
    ],
    failure_stage: null,
    visible_failure: false,
    model_steps: [
      {
        step_index: 1,
        type: "tool_calls",
        finish_reason: "tool_calls",
        tool_call_names: ["select_products"],
      },
      {
        step_index: 2,
        type: "tool_calls",
        finish_reason: "tool_calls",
        tool_call_names: ["submit_final_answer"],
      },
    ],
    tool_calls: [
      {
        id: "select-1",
        name: "select_products",
        status: "executed",
        latency_ms: 25,
      },
      {
        id: "final-1",
        name: "submit_final_answer",
        status: "executed",
        latency_ms: 5,
      },
    ],
    blocked_tool_calls: [],
    guardrails: [],
    latency_ms: 120,
    token_usage: null,
  }
  debugTrace.agentic_tool_loop = agenticToolLoopTrace
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
        update: (payload: unknown) => {
          observationUpdates.push(payload)
        },
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
            stream: createTextStream("Das ist die Tool-Loop-Antwort."),
            conversationId: "conversation-1",
            intent: "product_recommendation",
            matchedProducts: [matchedProduct],
            sources: [],
            retrievalSummary: { final_context_count: 0 },
            routerDecision,
            conversationStateTransition,
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
          category_decision: decision ?? null,
          engine_trace: trace ?? null,
          response_mode: responseMode,
        }),
        buildDoneEventData: (params: unknown) => params,
        persistConversationStateTransition: async (_admin: unknown, params: unknown) => {
          persistedStateTransitions.push(params)
          return { status: "persisted", error: null }
        },
        extractConversationMemory: async () => {},
        buildRetrievalDebugEventData: (trace: unknown) => ({ trace }),
        finalizeChatTurnTrace: (trace: unknown, final: unknown) => ({
          trace,
          final,
          agentic_tool_loop: (trace as { agentic_tool_loop?: unknown }).agentic_tool_loop,
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
  assert.equal(assistantInsert.content, "Das ist die Tool-Loop-Antwort.")
  assert.deepEqual(assistantInsert.product_recommendations, [matchedProduct])
  assert.deepEqual(assistantInsert.rag_context.category_decision, categoryDecision)
  assert.deepEqual(assistantInsert.rag_context.engine_trace, engineTrace)
  assert.equal(assistantInsert.rag_context.response_mode, "answer_direct")
  assert.deepEqual(persistedStateTransitions[0], {
    conversationId: "conversation-1",
    userId: "user-1",
    transition: conversationStateTransition,
  })
  assert.equal(persistedTurnTraces.length, 1)
  const observationOutput = (observationUpdates.at(-1) as { output: Record<string, unknown> })
    .output
  assert.equal("engine_trace" in observationOutput, false)
  assert.equal("matched_products" in observationOutput, false)
  assert.deepEqual(observationOutput.agentic_tool_loop_summary, {
    model_step_count: 2,
    tool_call_count: 2,
    repair_count: 1,
    visible_failure: false,
    failure_stage: null,
    loaded_guidance_ids: ["topic:shampoo", "overlay:fine_hair"],
  })
})

test("POST /api/chat persists visible pipeline failures as failed assistant turns", async () => {
  const fakeAdmin = createFakeAdmin()
  const persistedTurnTraces: unknown[] = []
  const persistedStateTransitions: unknown[] = []
  let memoryExtractionCalls = 0
  const conversationStateTransition = createConversationStateTransition()
  const matchedProduct = createProduct("primary")
  const failureCopy =
    "Entschuldige, ich konnte deine Frage gerade nicht eindeutig genug einordnen. Formulier sie bitte noch einmal etwas konkreter, dann helfe ich dir direkt weiter."
  const debugTrace = {
    request_id: "request-1",
    engine_variant: "tool_loop",
    product_category: "shampoo",
    classification: {
      product_category: "shampoo",
    },
    router_decision: {
      policy_overrides: ["agentic_tool_loop", "product_policy:recommend", "visible_failure"],
    },
    conversation_state: conversationStateTransition,
    decision_context: {
      category_decision: { category: "shampoo" },
      engine_trace: { request_context: { requestedCategory: "shampoo" } },
      matched_products: [
        {
          id: matchedProduct.id,
          name: matchedProduct.name,
          score: 0.9,
        },
      ],
    },
    agentic_tool_loop: {
      engine_variant: "tool_loop",
      answer_composition_mode: "composer_context",
      loaded_guidance_ids: ["topic:shampoo"],
      answer_context_capsule_ids: [],
      consultation_brief_summary: null,
      repair_attempts: [
        {
          reason: "missing_terminal_answer",
          instruction_label: "terminal_protocol_repair",
        },
      ],
      failure_stage: "repair_failed",
      visible_failure: true,
      model_steps: [],
      tool_calls: [],
      blocked_tool_calls: [],
      guardrails: [],
      latency_ms: 120,
      token_usage: null,
    },
    response_composition: {
      path: "agentic_tool_loop",
      migration_mode: "tool_loop",
      fallback_reason: null,
      rendering_path: null,
      plan_type: "tool_loop",
      attachment_mode: "cards",
    },
  }
  const categoryDecision = { category: "shampoo", relevant: true }
  const engineTrace = { request_context: { requestedCategory: "shampoo" } }
  const routerDecision = {
    retrieval_mode: "agentic_tool_loop",
    response_mode: "clarify_only",
    confidence: 0,
    slot_completeness: 0,
    policy_overrides: ["agentic_tool_loop", "product_policy:recommend", "visible_failure"],
  }
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
        runProductionAgentPipeline: async () => ({
          stream: createTextStream(failureCopy),
          conversationId: "conversation-1",
          intent: "general_chat",
          matchedProducts: [matchedProduct],
          sources: [],
          retrievalSummary: { final_context_count: 0 },
          routerDecision,
          conversationStateTransition,
          categoryDecision,
          engineTrace,
          debugTrace,
          visibleFailure: true,
        }),
        buildAssistantRagContext: (
          sources: unknown[],
          decision: unknown,
          trace: unknown,
          responseMode: unknown,
        ) => ({
          sources,
          category_decision: decision ?? null,
          engine_trace: trace ?? null,
          response_mode: responseMode,
        }),
        buildDoneEventData: (params: unknown) => params,
        persistConversationStateTransition: async (_admin: unknown, params: unknown) => {
          persistedStateTransitions.push(params)
          return { status: "persisted", error: null }
        },
        extractConversationMemory: async () => {
          memoryExtractionCalls += 1
        },
        buildRetrievalDebugEventData: (trace: unknown) => ({
          product_category: (trace as { product_category?: unknown }).product_category,
          policy_overrides:
            (trace as { router_decision?: { policy_overrides?: unknown[] } }).router_decision
              ?.policy_overrides ?? [],
          matched_products:
            (trace as { decision_context?: { matched_products?: unknown[] } }).decision_context
              ?.matched_products ?? [],
          attachment_mode: (trace as { response_composition: { attachment_mode: unknown } })
            .response_composition.attachment_mode,
        }),
        finalizeChatTurnTrace: (trace: unknown, final: unknown) => ({
          trace,
          final,
          agentic_tool_loop: (trace as { agentic_tool_loop?: unknown }).agentic_tool_loop,
          response_composition: (trace as { response_composition: unknown }).response_composition,
          decision_context: (trace as { decision_context: unknown }).decision_context,
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
      body: JSON.stringify({ message: "Kannst du das einordnen?" }),
    }),
  )
  const events = parseSseEvents(await response.text())

  assert.deepEqual(
    events.map((event) => event.type),
    [
      "conversation_id",
      "langfuse_trace",
      "confidence",
      "retrieval_debug",
      "content_delta",
      "assistant_message",
      "done",
    ],
  )
  assert.equal((events[4] as { data: string }).data, failureCopy)
  const doneEvent = events[6] as {
    data: {
      categoryDecision?: unknown
      category_decision?: unknown
      routerDecision?: { policy_overrides?: unknown[] }
    }
  }
  assert.equal(doneEvent.data.categoryDecision, undefined)
  assert.equal(doneEvent.data.category_decision, undefined)
  assert.deepEqual(doneEvent.data.routerDecision?.policy_overrides, [
    "agentic_tool_loop",
    "visible_failure",
  ])
  const retrievalDebugEvent = events[3] as {
    data: {
      product_category: unknown
      policy_overrides: unknown[]
      matched_products: unknown[]
      attachment_mode: string
    }
  }
  assert.equal(retrievalDebugEvent.data.product_category, null)
  assert.deepEqual(retrievalDebugEvent.data.policy_overrides, [
    "agentic_tool_loop",
    "visible_failure",
  ])
  assert.deepEqual(retrievalDebugEvent.data.matched_products, [])
  assert.equal(retrievalDebugEvent.data.attachment_mode, "text_only")
  assert.equal(
    events.some((event) => event.type === "product_recommendations"),
    false,
  )

  const assistantInsert = fakeAdmin.inserts.messages[1] as {
    content: string
    product_recommendations: Product[] | null
    rag_context: Record<string, unknown>
  }
  assert.equal(assistantInsert.content, failureCopy)
  assert.equal(assistantInsert.product_recommendations, null)
  assert.equal(assistantInsert.rag_context.category_decision, null)
  assert.equal(assistantInsert.rag_context.engine_trace, null)
  assert.deepEqual(persistedStateTransitions, [])
  assert.equal(memoryExtractionCalls, 0)

  assert.equal(persistedTurnTraces.length, 1)
  const persistedTurnTrace = persistedTurnTraces[0] as {
    status: string
    assistant_message_id: string | null
    trace: {
      trace: {
        product_category: unknown
        classification: { product_category: unknown }
        router_decision: { policy_overrides: unknown[] }
      }
      final: { status: string; product_count: number }
      agentic_tool_loop?: { visible_failure?: boolean }
      response_composition: { attachment_mode: string }
      decision_context: {
        category_decision: unknown
        engine_trace: unknown
        matched_products: unknown[]
      }
    }
  }
  assert.equal(persistedTurnTrace.status, "failed")
  assert.equal(persistedTurnTrace.assistant_message_id, "message-2")
  assert.equal(persistedTurnTrace.trace.trace.product_category, null)
  assert.equal(persistedTurnTrace.trace.trace.classification.product_category, null)
  assert.deepEqual(persistedTurnTrace.trace.trace.router_decision.policy_overrides, [
    "agentic_tool_loop",
    "visible_failure",
  ])
  assert.equal(persistedTurnTrace.trace.final.status, "failed")
  assert.equal(persistedTurnTrace.trace.final.product_count, 0)
  assert.equal(persistedTurnTrace.trace.agentic_tool_loop?.visible_failure, true)
  assert.equal(persistedTurnTrace.trace.response_composition.attachment_mode, "text_only")
  assert.equal(persistedTurnTrace.trace.decision_context.category_decision, null)
  assert.equal(persistedTurnTrace.trace.decision_context.engine_trace, null)
  assert.deepEqual(persistedTurnTrace.trace.decision_context.matched_products, [])
})

test("POST /api/chat continues stream when conversation state persistence rejects", async () => {
  const fakeAdmin = createFakeAdmin()
  const persistedTurnTraces: unknown[] = []
  const conversationStateTransition = createConversationStateTransition()
  const matchedProduct = createProduct("primary")
  const categoryDecision = {
    category: "shampoo",
    relevant: true,
  }
  const engineTrace = {
    request_context: { requestedCategory: "shampoo" },
    categories: {
      shampoo: categoryDecision,
    },
  }
  const debugTrace = {
    request_id: "request-1",
    engine_variant: "tool_loop",
    conversation_state: conversationStateTransition,
    response_composition: {
      path: "agentic_tool_loop",
      migration_mode: "tool_loop",
      fallback_reason: null,
      rendering_path: null,
      plan_type: "tool_loop",
      attachment_mode: "cards",
    },
  }
  const routerDecision = {
    retrieval_mode: "agentic_tool_loop",
    response_mode: "answer_direct",
    confidence: 1,
    slot_completeness: 1,
    policy_overrides: ["agentic_tool_loop", "product_policy:recommend"],
  }
  let persistenceAttemptedAfterAssistantSave = false
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
        runProductionAgentPipeline: async () => ({
          stream: createTextStream("Das ist die Tool-Loop-Antwort."),
          conversationId: "conversation-1",
          intent: "product_recommendation",
          matchedProducts: [matchedProduct],
          sources: [],
          retrievalSummary: { final_context_count: 0 },
          routerDecision,
          conversationStateTransition,
          categoryDecision,
          engineTrace,
          debugTrace,
        }),
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
        persistConversationStateTransition: async () => {
          persistenceAttemptedAfterAssistantSave = fakeAdmin.inserts.messages.length === 2
          throw new Error("state persistence unavailable")
        },
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

  assert.equal(persistenceAttemptedAfterAssistantSave, true)
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
  assert.equal(
    events.some((event) => event.type === "error"),
    false,
  )
  assert.equal(persistedTurnTraces.length, 1)
  assert.deepEqual(
    (
      persistedTurnTraces[0] as {
        trace: { final: { conversation_state_persistence: unknown } }
      }
    ).trace.final.conversation_state_persistence,
    {
      status: "failed",
      error: "state persistence unavailable",
    },
  )
})
