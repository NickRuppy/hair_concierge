import assert from "node:assert/strict"
import test from "node:test"

import { createChatPostHandler } from "../src/app/api/chat/route"
import { createProductSelectionPostHandler } from "../src/app/api/chat/product-selection/route"

function createTextStream(text: string): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text))
      controller.close()
    },
  })
}

function createMinimalRouteDebugTrace() {
  const routerDecision = {
    retrieval_mode: "agent_v2_responses",
    response_mode: "clarify_only",
    slot_completeness: 1,
    confidence: 0.8,
    policy_overrides: [],
  } as const
  return {
    request_id: "request-route-debug",
    started_at: "2026-06-25T12:00:00.000Z",
    user_message: "[agent_v2_user_message chars=64]",
    conversation_id: "conversation-1",
    intent: "product_question",
    product_category: "shampoo",
    conversation_history_count: 0,
    classification: {
      intent: "product_question",
      product_category: "shampoo",
      complexity: "simple",
      needs_clarification: true,
      retrieval_mode: "agent_v2_responses",
      normalized_filters: {},
      router_confidence: 0.8,
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
    agent_v2_trace: null,
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
      agent_runtime_ms: 0,
      agent_turn_gate_ms: null,
      agent_model_ms: null,
      agent_tool_ms: null,
    },
  } as never
}

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

function createFakeProductSelectionAdminClient(params: {
  sourceMessage: Record<string, unknown>
  conversation: Record<string, unknown>
  selectedProduct: Record<string, unknown>
  ownedProductIds?: readonly string[]
  verifiedSpecProductIds?: readonly string[]
  existingCategoryUsage?: Record<string, unknown> | null
  conversationState?: Record<string, unknown> | null
  conversationStateError?: { message: string } | null
  existingMessages?: Array<Record<string, unknown>>
  messageInsertError?: { code?: string; message: string } | null
}) {
  const insertedMessages: Array<Record<string, unknown>> = []
  const conversationUpdates: Array<Record<string, unknown>> = []
  const rpcCalls: Array<{ fn: string; args: Record<string, unknown> }> = []
  const client = {
    insertedMessages,
    conversationUpdates,
    rpcCalls,
    async rpc(fn: string, args: Record<string, unknown>) {
      rpcCalls.push({ fn, args })
      return {
        data: {
          id: "usage-linked-1",
          user_id: args.p_user_id,
          category: args.p_category,
          product_id: args.p_product_id,
          match_status: "matched",
        },
        error: null,
      }
    },
    from(table: string) {
      const query = {
        operation: null as "insert" | "update" | "select" | null,
        payload: null as Record<string, unknown> | null,
        filters: [] as Array<{ column: string; value: unknown }>,
        insert(payload: Record<string, unknown>) {
          this.operation = "insert"
          this.payload = payload
          if (table === "messages") {
            insertedMessages.push(payload)
          }
          return this
        },
        update(payload: Record<string, unknown>) {
          this.operation = "update"
          this.payload = payload
          if (table === "conversations") {
            conversationUpdates.push(payload)
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
        order() {
          return this
        },
        limit() {
          return this
        },
        async single() {
          if (table === "messages" && this.operation === "insert") {
            if (params.messageInsertError) {
              return { data: null, error: params.messageInsertError }
            }
            return { data: { id: `assistant-message-${insertedMessages.length}` }, error: null }
          }
          if (table === "messages") {
            const idFilter = this.filters.find((filter) => filter.column === "id")
            if (idFilter) {
              if (params.sourceMessage.id === idFilter.value) {
                return { data: params.sourceMessage, error: null }
              }
              const match = params.existingMessages?.find(
                (message) => message.id === idFilter.value,
              )
              return { data: match ?? null, error: match ? null : { message: "not found" } }
            }
            return { data: params.sourceMessage, error: null }
          }
          if (table === "conversations") {
            return { data: params.conversation, error: null }
          }
          if (table === "products") {
            return {
              data: {
                lifecycle_status: "active",
                is_chaarlie_recommended: true,
                ...params.selectedProduct,
              },
              error: null,
            }
          }
          if (table === "user_product_usage") {
            const productId = this.filters.find((filter) => filter.column === "product_id")?.value
            const isOwned =
              typeof productId === "string" && params.ownedProductIds?.includes(productId)
            if (isOwned) {
              return { data: { id: "usage-1", product_id: productId }, error: null }
            }
            const category = this.filters.find((filter) => filter.column === "category")?.value
            if (typeof category === "string" && params.existingCategoryUsage !== undefined) {
              return { data: params.existingCategoryUsage, error: null }
            }
            return { data: null, error: null }
          }
          return { data: null, error: null }
        },
        async maybeSingle() {
          if (table === "user_product_usage") {
            const productId = this.filters.find((filter) => filter.column === "product_id")?.value
            const isOwned =
              typeof productId === "string" && params.ownedProductIds?.includes(productId)
            if (isOwned) {
              return { data: { id: "usage-1", product_id: productId }, error: null }
            }
            const category = this.filters.find((filter) => filter.column === "category")?.value
            if (typeof category === "string" && params.existingCategoryUsage !== undefined) {
              return { data: params.existingCategoryUsage, error: null }
            }
            return { data: null, error: null }
          }
          if (table === "conversation_states") {
            if (params.conversationStateError) {
              return { data: null, error: params.conversationStateError }
            }
            return {
              data:
                params.conversationState === null
                  ? null
                  : { state: params.conversationState ?? null },
              error: null,
            }
          }
          return { data: null, error: null }
        },
        async then(resolve: (value: { data: unknown; error: null }) => unknown) {
          if (table.startsWith("product_")) {
            const productId = this.filters.find((filter) => filter.column === "product_id")?.value
            const hasSpecs =
              typeof productId === "string" && params.verifiedSpecProductIds?.includes(productId)
            return resolve({
              data: hasSpecs ? [{ product_id: productId }] : [],
              error: null,
            })
          }
          if (table === "messages" && this.operation === "select") {
            return resolve({ data: params.existingMessages ?? [], error: null })
          }
          return resolve({ data: null, error: null })
        },
      }

      return query
    },
  }

  return client
}

function createProductLookupClarificationSourceMessage(): Record<string, unknown> {
  return {
    id: "assistant-clarification-1",
    conversation_id: "conversation-1",
    role: "assistant",
    rag_context: {
      product_lookup_clarification: {
        id: "clarification-1",
        kind: "variant_selection",
        source: "chat",
        original_user_message: "Ich nutze Syoss Intense Volume Shampoo. Passt das zu mir?",
        query: {
          brand_text: "Syoss",
          product_name_text: "Intense Volume Shampoo",
          category: "shampoo",
        },
        copy: { prompt_de: "Welche Variante meinst du?" },
        candidates: [
          {
            product_id: "syoss-intense-volume-shampoo",
            name: "Syoss Intense Volume Shampoo",
            category: "shampoo",
            category_label_de: "Shampoo",
            reason: "same_brand_same_category",
          },
          {
            product_id: "syoss-intense-curls-shampoo",
            name: "Syoss Intense Curls Shampoo",
            category: "shampoo",
            category_label_de: "Shampoo",
            reason: "same_brand_same_category",
          },
        ],
        none_action: {
          label_de: "Nein, mein Produkt hinzufügen",
          product_intake_offer: {
            id: "offer-1",
            source: "chat",
            reason: "product_lookup_not_found",
            category: "shampoo",
          },
        },
      },
    },
  }
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
        buildAssistantDecisionContext: (params: { productIntakeOffer?: unknown }) => {
          decisionContextProductIntakeOffer = params.productIntakeOffer
          return { product_intake_offer: params.productIntakeOffer }
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
  assert.equal(statePersistenceCalls.length, 1)
  assert.equal(memoryExtractionCalls.length, 0)
  assert.equal(traceRows.length, 1)
})

test("chat product lookup clarification is driven by structured pipeline metadata and preserved", async () => {
  const modelAnswer =
    "Ich finde dieses Syoss Shampoo nicht eindeutig, aber ich habe eine mögliche Variante in unserer Datenbank gefunden."
  const productLookupClarification = {
    id: "clarification-1",
    kind: "variant_selection",
    source: "chat",
    query: {
      brand_text: "Syoss",
      product_name_text: "Intense Volume Shampoo",
      category: "shampoo",
    },
    copy: {
      prompt_de:
        "Ich finde Syoss Intense Volume Shampoo nicht eindeutig, aber ich habe dieses Syoss Shampoo in unserer Datenbank gefunden.",
    },
    candidates: [
      {
        product_id: "syoss-intense-curls-shampoo",
        name: "Intense Curls Shampoo",
        category: "shampoo",
        category_label_de: "Shampoo",
        reason: "same_brand_same_category",
      },
    ],
    none_action: {
      label_de: "Nein, mein Produkt hinzufügen",
      product_intake_offer: {
        id: "offer-clarification-1",
        source: "chat",
        reason: "product_lookup_not_found",
        category: "shampoo",
        extracted_identity: {
          brand_text: "Syoss",
          product_name_text: "Intense Volume Shampoo",
        },
      },
    },
  }
  const messageRows: Array<Record<string, unknown>> = []
  const conversationUpdates: Array<Record<string, unknown>> = []
  let decisionContextProductLookupClarification: unknown = null
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
    getLangfuseClient: () => null,
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
          sources: [],
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
          productIntakeOffer: null,
          productLookupClarification,
        }),
        buildAssistantDecisionContext: (params: { productLookupClarification?: unknown }) => {
          decisionContextProductLookupClarification = params.productLookupClarification
          return { product_lookup_clarification: params.productLookupClarification }
        },
        buildDoneEventData: ({ intent }: { intent: string }) => ({ intent }),
        extractConversationMemory: async () => {},
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
        persistConversationStateTransition: async () => ({ status: "skipped", error: null }),
        chatMessageSchema: {
          safeParse: (value: unknown) => ({ success: true, data: value }),
        },
        generateConversationTitle: async () => {},
      }) as never,
    persistConversationTurnTrace: async () => {},
    randomUUID: () => "message-id",
    now: () => 0,
  })

  const response = await handler(
    new Request("https://example.test/api/chat", {
      method: "POST",
      body: JSON.stringify({
        message: "Ich benutze Syoss Intense Volume Shampoo. Passt das zu mir?",
        conversation_id: "conversation-1",
      }),
    }),
  )
  const responseText = await response.text()

  assert.equal(response.status, 200)
  assert.match(responseText, /product_lookup_clarification/)
  assert.match(responseText, new RegExp(modelAnswer))
  assert.equal(messageRows[1]?.content, modelAnswer)
  assert.deepEqual(decisionContextProductLookupClarification, productLookupClarification)
  assert.deepEqual(
    (messageRows[1]?.rag_context as { product_lookup_clarification?: unknown } | undefined)
      ?.product_lookup_clarification,
    productLookupClarification,
  )
})

test("chat route preserves product lookup clarification from visible repair fallback", async () => {
  const modelAnswer =
    "Ich habe dazu Intense Curls Shampoo gefunden. Bitte bestätige kurz, ob du dieses Shampoo meinst."
  const productLookupClarification = {
    id: "clarification-visible-failure",
    kind: "variant_selection",
    source: "chat",
    original_user_message: "Ich benutze Syoss Intense Volume Shampoo. Passt das zu mir?",
    query: {
      brand_text: "Syoss",
      product_name_text: "Intense Volume Shampoo",
      category: "shampoo",
    },
    copy: {
      prompt_de:
        "Ich finde Syoss Intense Volume Shampoo nicht eindeutig, aber ich habe dieses Shampoo in unserer Datenbank gefunden.",
    },
    candidates: [
      {
        product_id: "syoss-intense-curls-shampoo",
        name: "Intense Curls Shampoo",
        category: "shampoo",
        category_label_de: "Shampoo",
        reason: "same_brand_same_category",
      },
    ],
    none_action: {
      label_de: "Nein, mein Produkt hinzufügen",
      product_intake_offer: {
        id: "offer-visible-failure",
        source: "chat",
        reason: "product_lookup_not_found",
        category: "shampoo",
        extracted_identity: {
          brand_text: "Syoss",
          product_name_text: "Intense Volume Shampoo",
        },
      },
    },
  }
  const messageRows: Array<Record<string, unknown>> = []
  const conversationUpdates: Array<Record<string, unknown>> = []
  let decisionContextProductLookupClarification: unknown = null
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
    getLangfuseClient: () => null,
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
          sources: [],
          retrievalSummary: { final_context_count: 0 },
          routerDecision: {
            confidence: 0.8,
            retrieval_mode: "agent_v2_responses",
            response_mode: "clarify_only",
            slot_completeness: 1,
            policy_overrides: [],
          },
          conversationStateTransition: { next_state: null },
          categoryDecision: undefined,
          engineTrace: undefined,
          debugTrace: createMinimalRouteDebugTrace(),
          visibleFailure: true,
          answerMode: "clarification",
          productIntakeOffer: null,
          productLookupClarification,
        }),
        buildAssistantDecisionContext: (params: { productLookupClarification?: unknown }) => {
          decisionContextProductLookupClarification = params.productLookupClarification
          return { product_lookup_clarification: params.productLookupClarification }
        },
        buildDoneEventData: ({ intent }: { intent: string }) => ({ intent }),
        extractConversationMemory: async () => {},
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
        persistConversationStateTransition: async () => ({ status: "skipped", error: null }),
        chatMessageSchema: {
          safeParse: (value: unknown) => ({ success: true, data: value }),
        },
        generateConversationTitle: async () => {},
      }) as never,
    persistConversationTurnTrace: async () => {},
    randomUUID: () => "message-id",
    now: () => 0,
  })

  const response = await handler(
    new Request("https://example.test/api/chat", {
      method: "POST",
      body: JSON.stringify({
        message: "Ich benutze Syoss Intense Volume Shampoo. Passt das zu mir?",
        conversation_id: "conversation-1",
      }),
    }),
  )
  const responseText = await response.text()

  assert.equal(response.status, 200)
  assert.match(responseText, /product_lookup_clarification/)
  assert.match(responseText, new RegExp(modelAnswer))
  assert.deepEqual(decisionContextProductLookupClarification, productLookupClarification)
  assert.deepEqual(
    (messageRows[1]?.rag_context as { product_lookup_clarification?: unknown } | undefined)
      ?.product_lookup_clarification,
    productLookupClarification,
  )
})

test("chat route preserves product intake offer from visible product lookup failure", async () => {
  const modelAnswer =
    "Ich konnte die Antwort gerade nicht sauber zusammensetzen. Versuch es bitte noch einmal mit derselben Frage."
  const productIntakeOffer = {
    id: "offer-visible-intake",
    source: "chat",
    reason: "product_lookup_not_found",
    category: "conditioner",
    extracted_identity: {
      brand_text: "Jean & Lean",
      product_name_text: "Conditioner",
    },
  }
  const messageRows: Array<Record<string, unknown>> = []
  const conversationUpdates: Array<Record<string, unknown>> = []
  let decisionContextProductIntakeOffer: unknown = null
  const conversationStateTransition = {
    next_state: {
      agent_v2: {
        active_product_contexts: [
          {
            status: "pending_review",
            product_id: null,
            submission_id: null,
            category: "conditioner",
            brand_text: "Jean & Lean",
            product_name_text: "Conditioner",
            display_name: "Jean & Lean Conditioner",
            original_user_message: "Was hältst du von meinem Jean & Lean Conditioner?",
            source: "product_intake_offer",
            updated_at: "2026-06-28T00:00:00.000Z",
          },
        ],
      },
    },
  }
  let persistedConversationStateTransition: unknown = null
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
    getLangfuseClient: () => null,
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
          sources: [],
          retrievalSummary: { final_context_count: 0 },
          routerDecision: {
            confidence: 0,
            retrieval_mode: "agent_v2_responses",
            response_mode: "clarify_only",
            slot_completeness: 1,
            policy_overrides: ["visible_failure"],
          },
          conversationStateTransition,
          categoryDecision: undefined,
          engineTrace: undefined,
          debugTrace: createMinimalRouteDebugTrace(),
          visibleFailure: true,
          answerMode: "clarification",
          productIntakeOffer,
          productLookupClarification: null,
        }),
        buildAssistantDecisionContext: (params: { productIntakeOffer?: unknown }) => {
          decisionContextProductIntakeOffer = params.productIntakeOffer
          return { product_intake_offer: params.productIntakeOffer }
        },
        buildDoneEventData: ({ intent }: { intent: string }) => ({ intent }),
        extractConversationMemory: async () => {},
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
        persistConversationStateTransition: async (
          _admin: unknown,
          params: { transition: unknown },
        ) => {
          persistedConversationStateTransition = params.transition
          return { status: "updated", error: null }
        },
        chatMessageSchema: {
          safeParse: (value: unknown) => ({ success: true, data: value }),
        },
        generateConversationTitle: async () => {},
      }) as never,
    persistConversationTurnTrace: async () => {},
    randomUUID: () => "message-id",
    now: () => 0,
  })

  const response = await handler(
    new Request("https://example.test/api/chat", {
      method: "POST",
      body: JSON.stringify({
        message: "Was hältst du von meinem Jean & Lean Conditioner?",
        conversation_id: "conversation-1",
      }),
    }),
  )
  const responseText = await response.text()

  assert.equal(response.status, 200)
  assert.match(responseText, /product_intake_offer/)
  assert.match(responseText, new RegExp(modelAnswer))
  assert.deepEqual(decisionContextProductIntakeOffer, productIntakeOffer)
  assert.deepEqual(
    (messageRows[1]?.rag_context as { product_intake_offer?: unknown } | undefined)
      ?.product_intake_offer,
    productIntakeOffer,
  )
  assert.deepEqual(persistedConversationStateTransition, conversationStateTransition)
})

test("chat product selection rejects products outside the persisted clarification candidates", async () => {
  const admin = createFakeProductSelectionAdminClient({
    sourceMessage: {
      id: "assistant-clarification-1",
      conversation_id: "conversation-1",
      role: "assistant",
      rag_context: {
        product_lookup_clarification: {
          id: "clarification-1",
          kind: "variant_selection",
          source: "chat",
          original_user_message: "Ich nutze Syoss Intense Volume Shampoo. Passt das zu mir?",
          query: {
            brand_text: "Syoss",
            product_name_text: "Intense Volume Shampoo",
            category: "shampoo",
          },
          copy: { prompt_de: "Welche Variante meinst du?" },
          candidates: [
            {
              product_id: "allowed-product",
              name: "Allowed Product",
              category: "shampoo",
              category_label_de: "Shampoo",
              reason: "same_brand_same_category",
            },
          ],
          none_action: {
            label_de: "Nein, mein Produkt hinzufügen",
            product_intake_offer: {
              id: "offer-1",
              source: "chat",
              reason: "product_lookup_not_found",
              category: "shampoo",
            },
          },
        },
      },
    },
    conversation: { id: "conversation-1", user_id: "user-1" },
    selectedProduct: {
      id: "different-product",
      name: "Different Product",
      category_key: "shampoo",
      is_active: true,
    },
  })
  let pipelineCalled = false
  const handler = createProductSelectionPostHandler({
    createClient: async () =>
      ({
        auth: {
          getUser: async () => ({ data: { user: { id: "user-1" } } }),
        },
      }) as never,
    createAdminClient: () => admin as never,
    runAgentV2ProductionPipeline: async () => {
      pipelineCalled = true
      throw new Error("pipeline should not be called")
    },
  })

  const response = await handler(
    new Request("https://example.test/api/chat/product-selection", {
      method: "POST",
      body: JSON.stringify({
        conversation_id: "conversation-1",
        assistant_message_id: "assistant-clarification-1",
        clarification_id: "clarification-1",
        selected_product_id: "different-product",
      }),
    }),
  )

  assert.equal(response.status, 400)
  assert.equal(pipelineCalled, false)
  assert.equal(admin.insertedMessages.length, 0)
})

test("chat product selection rejects unauthenticated users before admin work", async () => {
  let adminCreated = false
  const handler = createProductSelectionPostHandler({
    createClient: async () =>
      ({
        auth: {
          getUser: async () => ({ data: { user: null } }),
        },
      }) as never,
    createAdminClient: () => {
      adminCreated = true
      throw new Error("admin should not be created")
    },
  })

  const response = await handler(
    new Request("https://example.test/api/chat/product-selection", {
      method: "POST",
      body: JSON.stringify({
        conversation_id: "conversation-1",
        assistant_message_id: "assistant-clarification-1",
        clarification_id: "clarification-1",
        selected_product_id: "syoss-intense-volume-shampoo",
      }),
    }),
  )

  assert.equal(response.status, 401)
  assert.equal(adminCreated, false)
})

test("chat product selection rejects conversations owned by another user", async () => {
  const admin = createFakeProductSelectionAdminClient({
    sourceMessage: createProductLookupClarificationSourceMessage(),
    conversation: { id: "conversation-1", user_id: "other-user" },
    selectedProduct: {
      id: "syoss-intense-volume-shampoo",
      name: "Syoss Intense Volume Shampoo",
      category_key: "shampoo",
      is_active: true,
    },
  })
  let pipelineCalled = false
  const handler = createProductSelectionPostHandler({
    createClient: async () =>
      ({
        auth: {
          getUser: async () => ({ data: { user: { id: "user-1" } } }),
        },
      }) as never,
    createAdminClient: () => admin as never,
    runAgentV2ProductionPipeline: async () => {
      pipelineCalled = true
      throw new Error("pipeline should not be called")
    },
  })

  const response = await handler(
    new Request("https://example.test/api/chat/product-selection", {
      method: "POST",
      body: JSON.stringify({
        conversation_id: "conversation-1",
        assistant_message_id: "assistant-clarification-1",
        clarification_id: "clarification-1",
        selected_product_id: "syoss-intense-volume-shampoo",
      }),
    }),
  )

  assert.equal(response.status, 404)
  assert.equal(pipelineCalled, false)
  assert.equal(admin.insertedMessages.length, 0)
})

test("chat product selection checks conversation ownership before source card existence", async () => {
  const admin = createFakeProductSelectionAdminClient({
    sourceMessage: createProductLookupClarificationSourceMessage(),
    conversation: { id: "conversation-1", user_id: "other-user" },
    selectedProduct: {
      id: "syoss-intense-volume-shampoo",
      name: "Syoss Intense Volume Shampoo",
      category_key: "shampoo",
      is_active: true,
    },
  })
  const queriedTables: string[] = []
  const baseFrom = admin.from.bind(admin)
  admin.from = ((table: string) => {
    queriedTables.push(table)
    return baseFrom(table)
  }) as typeof admin.from
  let pipelineCalled = false
  const handler = createProductSelectionPostHandler({
    createClient: async () =>
      ({
        auth: {
          getUser: async () => ({ data: { user: { id: "user-1" } } }),
        },
      }) as never,
    createAdminClient: () => admin as never,
    runAgentV2ProductionPipeline: async () => {
      pipelineCalled = true
      throw new Error("pipeline should not be called")
    },
  })

  const response = await handler(
    new Request("https://example.test/api/chat/product-selection", {
      method: "POST",
      body: JSON.stringify({
        conversation_id: "conversation-1",
        assistant_message_id: "missing-or-other-user-message",
        clarification_id: "clarification-1",
        selected_product_id: "syoss-intense-volume-shampoo",
      }),
    }),
  )

  assert.equal(response.status, 404)
  assert.equal(pipelineCalled, false)
  assert.equal(queriedTables[0], "conversations")
  assert.equal(queriedTables.includes("messages"), false)
  assert.equal(admin.insertedMessages.length, 0)
})

test("chat product selection rejects stale clarification ids", async () => {
  const admin = createFakeProductSelectionAdminClient({
    sourceMessage: createProductLookupClarificationSourceMessage(),
    conversation: { id: "conversation-1", user_id: "user-1" },
    selectedProduct: {
      id: "syoss-intense-volume-shampoo",
      name: "Syoss Intense Volume Shampoo",
      category_key: "shampoo",
      is_active: true,
    },
  })
  let pipelineCalled = false
  const handler = createProductSelectionPostHandler({
    createClient: async () =>
      ({
        auth: {
          getUser: async () => ({ data: { user: { id: "user-1" } } }),
        },
      }) as never,
    createAdminClient: () => admin as never,
    runAgentV2ProductionPipeline: async () => {
      pipelineCalled = true
      throw new Error("pipeline should not be called")
    },
  })

  const response = await handler(
    new Request("https://example.test/api/chat/product-selection", {
      method: "POST",
      body: JSON.stringify({
        conversation_id: "conversation-1",
        assistant_message_id: "assistant-clarification-1",
        clarification_id: "other-clarification",
        selected_product_id: "syoss-intense-volume-shampoo",
      }),
    }),
  )

  assert.equal(response.status, 400)
  assert.equal(pipelineCalled, false)
  assert.equal(admin.insertedMessages.length, 0)
})

test("chat product selection rejects malformed JSON", async () => {
  let adminCreated = false
  const handler = createProductSelectionPostHandler({
    createClient: async () =>
      ({
        auth: {
          getUser: async () => ({ data: { user: { id: "user-1" } } }),
        },
      }) as never,
    createAdminClient: () => {
      adminCreated = true
      throw new Error("admin should not be created")
    },
  })

  const response = await handler(
    new Request("https://example.test/api/chat/product-selection", {
      method: "POST",
      body: "{",
    }),
  )

  assert.equal(response.status, 400)
  assert.equal(adminCreated, false)
})

test("chat product selection rejects inactive selected products", async () => {
  const admin = createFakeProductSelectionAdminClient({
    sourceMessage: createProductLookupClarificationSourceMessage(),
    conversation: { id: "conversation-1", user_id: "user-1" },
    selectedProduct: {
      id: "syoss-intense-volume-shampoo",
      name: "Syoss Intense Volume Shampoo",
      category_key: "shampoo",
      is_active: false,
    },
  })
  let pipelineCalled = false
  const handler = createProductSelectionPostHandler({
    createClient: async () =>
      ({
        auth: {
          getUser: async () => ({ data: { user: { id: "user-1" } } }),
        },
      }) as never,
    createAdminClient: () => admin as never,
    runAgentV2ProductionPipeline: async () => {
      pipelineCalled = true
      throw new Error("pipeline should not be called")
    },
  })

  const response = await handler(
    new Request("https://example.test/api/chat/product-selection", {
      method: "POST",
      body: JSON.stringify({
        conversation_id: "conversation-1",
        assistant_message_id: "assistant-clarification-1",
        clarification_id: "clarification-1",
        selected_product_id: "syoss-intense-volume-shampoo",
      }),
    }),
  )

  assert.equal(response.status, 400)
  assert.equal(pipelineCalled, false)
  assert.equal(admin.insertedMessages.length, 0)
})

test("chat product selection rejects non-recommended products not owned by the user", async () => {
  const admin = createFakeProductSelectionAdminClient({
    sourceMessage: createProductLookupClarificationSourceMessage(),
    conversation: { id: "conversation-1", user_id: "user-1" },
    selectedProduct: {
      id: "syoss-intense-volume-shampoo",
      name: "Syoss Intense Volume Shampoo",
      category_key: "shampoo",
      is_active: true,
      lifecycle_status: "active",
      is_chaarlie_recommended: false,
    },
  })
  let pipelineCalled = false
  const handler = createProductSelectionPostHandler({
    createClient: async () =>
      ({
        auth: {
          getUser: async () => ({ data: { user: { id: "user-1" } } }),
        },
      }) as never,
    createAdminClient: () => admin as never,
    runAgentV2ProductionPipeline: async () => {
      pipelineCalled = true
      throw new Error("pipeline should not be called")
    },
  })

  const response = await handler(
    new Request("https://example.test/api/chat/product-selection", {
      method: "POST",
      body: JSON.stringify({
        conversation_id: "conversation-1",
        assistant_message_id: "assistant-clarification-1",
        clarification_id: "clarification-1",
        selected_product_id: "syoss-intense-volume-shampoo",
      }),
    }),
  )

  assert.equal(response.status, 400)
  assert.equal(pipelineCalled, false)
  assert.equal(admin.insertedMessages.length, 0)
})

test("chat product selection links known non-recommended products from link-existing cards", async () => {
  const assistantText =
    "Danke, ich habe das bekannte Produkt zu deiner Routine hinzugefügt und bewerte es jetzt für dich."
  const admin = createFakeProductSelectionAdminClient({
    sourceMessage: {
      id: "assistant-link-existing-1",
      conversation_id: "conversation-1",
      role: "assistant",
      rag_context: {
        product_lookup_clarification: {
          id: "clarification-link-existing-1",
          kind: "link_existing_product",
          source: "chat",
          original_user_message:
            "Passt der Balea Professional Leave-In Serum Brilliant Blond Hair Sealer zu mir?",
          query: {
            brand_text: "Balea Professional",
            product_name_text: "Leave-In Serum Brilliant Blond Hair Sealer",
            category: "leave_in",
          },
          copy: {
            prompt_de:
              "Wir kennen dieses Produkt bereits. Es ist kein Chaarlie-Empfehlungsprodukt, aber wir können es für dein Profil analysieren, wenn du es zu deiner Routine hinzufügst.",
          },
          candidates: [
            {
              product_id: "balea-hair-sealer",
              name: "Leave-In Serum Brilliant Blond Hair Sealer",
              brand_name: "Balea Professional",
              category: "leave_in",
              category_label_de: "Leave-in",
              reason: "link_existing_product",
            },
          ],
          none_action: {
            label_de: "Nein, mein Produkt hinzufügen",
            product_intake_offer: {
              id: "offer-link-existing-1",
              source: "chat",
              reason: "product_lookup_not_found",
              category: "leave_in",
            },
          },
        },
      },
    },
    conversation: { id: "conversation-1", user_id: "user-1" },
    selectedProduct: {
      id: "balea-hair-sealer",
      name: "Leave-In Serum Brilliant Blond Hair Sealer",
      category_key: "leave_in",
      is_active: true,
      lifecycle_status: "active",
      is_chaarlie_recommended: false,
    },
    existingCategoryUsage: null,
  })
  let trustedContext: unknown = null
  let pipelineCalled = false
  const handler = createProductSelectionPostHandler({
    createClient: async () =>
      ({
        auth: {
          getUser: async () => ({ data: { user: { id: "user-1" } } }),
        },
      }) as never,
    createAdminClient: () => admin as never,
    randomUUID: () => "selection-request-1",
    productIntakeEnabled: () => true,
    runAgentV2ProductionPipeline: (async (params: { trustedSelectedProductContext?: unknown }) => {
      pipelineCalled = true
      trustedContext = params.trustedSelectedProductContext
      return {
        stream: createTextStream(assistantText),
        conversationId: "conversation-1",
        intent: "general_chat",
        matchedProducts: [],
        sources: [],
        retrievalSummary: { final_context_count: 0 },
        routerDecision: {
          confidence: 0.9,
          retrieval_mode: "agent_v2_responses",
          response_mode: "answer_direct",
          slot_completeness: 1,
          policy_overrides: [],
        },
        conversationStateTransition: { next_state: "selection" } as never,
        categoryDecision: undefined,
        engineTrace: undefined,
        debugTrace: {},
        visibleFailure: false,
        answerMode: "product_assessment",
      }
    }) as never,
    buildAssistantDecisionContext: (params) => ({
      sources: [],
      product_lookup_selection: params.productLookupSelection,
    }),
    buildDoneEventData: ({ intent }: { intent: string }) => ({ intent }),
    persistConversationStateTransition: async () => ({ status: "persisted", error: null }),
  })

  const response = await handler(
    new Request("https://example.test/api/chat/product-selection", {
      method: "POST",
      body: JSON.stringify({
        conversation_id: "conversation-1",
        assistant_message_id: "assistant-link-existing-1",
        clarification_id: "clarification-link-existing-1",
        selected_product_id: "balea-hair-sealer",
      }),
    }),
  )
  const responseText = await response.text()

  assert.equal(response.status, 200)
  assert.equal(pipelineCalled, true)
  assert.equal(admin.rpcCalls.length, 1)
  assert.equal(admin.rpcCalls[0]?.fn, "product_intake_replace_usage_with_matched_product")
  assert.deepEqual(admin.rpcCalls[0]?.args, {
    p_user_id: "user-1",
    p_category: "leave_in",
    p_existing_usage_id: null,
    p_product_id: "balea-hair-sealer",
    p_product_name: "Leave-In Serum Brilliant Blond Hair Sealer",
    p_frequency_range: "less_than_monthly",
    p_brand_text: "Balea Professional",
    p_intake_method: "manual",
    p_source: "chat",
    p_updated_at: admin.rpcCalls[0]?.args.p_updated_at,
  })
  assert.equal(typeof admin.rpcCalls[0]?.args.p_updated_at, "string")
  assert.match(responseText, /product_lookup_selection/)
  assert.deepEqual(trustedContext, {
    source: "product_lookup_clarification",
    original_user_message:
      "Passt der Balea Professional Leave-In Serum Brilliant Blond Hair Sealer zu mir?",
    selected_product: {
      id: "balea-hair-sealer",
      name: "Leave-In Serum Brilliant Blond Hair Sealer",
      category: "leave_in",
    },
    lookup_identity: {
      category: "leave_in",
      brand_text: "Balea Professional",
      product_name_text: "Leave-In Serum Brilliant Blond Hair Sealer",
      evidence_quote: "Balea Professional Leave-In Serum Brilliant Blond Hair Sealer",
    },
  })
})

test("chat product selection returns existing selection answer on replay", async () => {
  const existingSelection = {
    source: "product_lookup_clarification",
    clarification_id: "clarification-1",
    source_assistant_message_id: "assistant-clarification-1",
    selected_product_id: "syoss-intense-volume-shampoo",
    selected_product_name: "Syoss Intense Volume Shampoo",
  }
  const admin = createFakeProductSelectionAdminClient({
    sourceMessage: createProductLookupClarificationSourceMessage(),
    conversation: { id: "conversation-1", user_id: "user-1" },
    selectedProduct: {
      id: "syoss-intense-volume-shampoo",
      name: "Syoss Intense Volume Shampoo",
      category_key: "shampoo",
      is_active: true,
    },
    existingMessages: [
      {
        id: "existing-selection-message",
        content: "Alles klar, ich beziehe mich auf Syoss Intense Volume Shampoo.",
        rag_context: { product_lookup_selection: existingSelection },
        langfuse_trace_id: "trace-1",
      },
    ],
  })
  let pipelineCalled = false
  let persistedSelectionTransition: unknown = null
  const handler = createProductSelectionPostHandler({
    createClient: async () =>
      ({
        auth: {
          getUser: async () => ({ data: { user: { id: "user-1" } } }),
        },
      }) as never,
    createAdminClient: () => admin as never,
    runAgentV2ProductionPipeline: async () => {
      pipelineCalled = true
      throw new Error("pipeline should not be called")
    },
    persistConversationStateTransition: async (_admin, params) => {
      persistedSelectionTransition = params.transition
      return { status: "persisted", error: null }
    },
    buildDoneEventData: ({ intent }: { intent: string }) => ({ intent }),
  })

  const response = await handler(
    new Request("https://example.test/api/chat/product-selection", {
      method: "POST",
      body: JSON.stringify({
        conversation_id: "conversation-1",
        assistant_message_id: "assistant-clarification-1",
        clarification_id: "clarification-1",
        selected_product_id: "syoss-intense-volume-shampoo",
      }),
    }),
  )
  const responseText = await response.text()

  assert.equal(response.status, 200)
  assert.match(responseText, /existing-selection-message/)
  assert.match(responseText, /product_lookup_selection/)
  assert.match(responseText, /Alles klar/)
  assert.equal(pipelineCalled, false)
  assert.equal(admin.insertedMessages.length, 0)
  const activeProductContext = (
    persistedSelectionTransition as {
      next_state?: { agent_v2?: { active_product_contexts?: unknown[] } }
    }
  )?.next_state?.agent_v2?.active_product_contexts?.[0] as
    | (Record<string, unknown> & { updated_at?: unknown })
    | undefined
  assert.equal(typeof activeProductContext?.updated_at, "string")
  assert.deepEqual(
    activeProductContext
      ? { ...activeProductContext, updated_at: "<timestamp>" }
      : activeProductContext,
    {
      status: "resolved",
      product_id: "syoss-intense-volume-shampoo",
      submission_id: null,
      category: "shampoo",
      brand_text: "Syoss",
      product_name_text: "Intense Volume Shampoo",
      display_name: "Syoss Intense Volume Shampoo",
      original_user_message: "Ich nutze Syoss Intense Volume Shampoo. Passt das zu mir?",
      source: "product_lookup_selection",
      updated_at: "<timestamp>",
    },
  )
})

test("chat product selection fails closed when replay state cannot be loaded", async () => {
  const existingSelection = {
    source: "product_lookup_clarification",
    clarification_id: "clarification-1",
    source_assistant_message_id: "assistant-clarification-1",
    selected_product_id: "syoss-intense-volume-shampoo",
    selected_product_name: "Syoss Intense Volume Shampoo",
  }
  const admin = createFakeProductSelectionAdminClient({
    sourceMessage: createProductLookupClarificationSourceMessage(),
    conversation: { id: "conversation-1", user_id: "user-1" },
    selectedProduct: {
      id: "syoss-intense-volume-shampoo",
      name: "Syoss Intense Volume Shampoo",
      category_key: "shampoo",
      is_active: true,
    },
    existingMessages: [
      {
        id: "existing-selection-message",
        content: "Alles klar, ich beziehe mich auf Syoss Intense Volume Shampoo.",
        rag_context: { product_lookup_selection: existingSelection },
      },
    ],
    conversationStateError: { message: "state read failed" },
  })
  let pipelineCalled = false
  let statePersistenceCalled = false
  const handler = createProductSelectionPostHandler({
    createClient: async () =>
      ({
        auth: {
          getUser: async () => ({ data: { user: { id: "user-1" } } }),
        },
      }) as never,
    createAdminClient: () => admin as never,
    runAgentV2ProductionPipeline: async () => {
      pipelineCalled = true
      throw new Error("pipeline should not be called")
    },
    buildDoneEventData: ({ intent }: { intent: string }) => ({ intent }),
    persistConversationStateTransition: async () => {
      statePersistenceCalled = true
      return { status: "persisted", error: null }
    },
  })

  const response = await handler(
    new Request("https://example.test/api/chat/product-selection", {
      method: "POST",
      body: JSON.stringify({
        conversation_id: "conversation-1",
        assistant_message_id: "assistant-clarification-1",
        clarification_id: "clarification-1",
        selected_product_id: "syoss-intense-volume-shampoo",
      }),
    }),
  )
  const responseText = await response.text()

  assert.equal(response.status, 200)
  assert.match(responseText, /"type":"error"/)
  assert.match(responseText, /Produktauswahl konnte nicht verarbeitet werden/)
  assert.equal(pipelineCalled, false)
  assert.equal(statePersistenceCalled, false)
  assert.equal(admin.insertedMessages.length, 0)
})

test("chat product selection rejects a different candidate click after clarification was resolved", async () => {
  const existingSelection = {
    source: "product_lookup_clarification",
    clarification_id: "clarification-1",
    source_assistant_message_id: "assistant-clarification-1",
    selected_product_id: "syoss-intense-volume-shampoo",
    selected_product_name: "Syoss Intense Volume Shampoo",
  }
  const admin = createFakeProductSelectionAdminClient({
    sourceMessage: createProductLookupClarificationSourceMessage(),
    conversation: { id: "conversation-1", user_id: "user-1" },
    selectedProduct: {
      id: "syoss-intense-curls-shampoo",
      name: "Syoss Intense Curls Shampoo",
      category_key: "shampoo",
      is_active: true,
    },
    existingMessages: [
      {
        id: "existing-selection-message",
        content: "Alles klar, ich beziehe mich auf Syoss Intense Volume Shampoo.",
        rag_context: { product_lookup_selection: existingSelection },
      },
    ],
  })
  let pipelineCalled = false
  const handler = createProductSelectionPostHandler({
    createClient: async () =>
      ({
        auth: {
          getUser: async () => ({ data: { user: { id: "user-1" } } }),
        },
      }) as never,
    createAdminClient: () => admin as never,
    runAgentV2ProductionPipeline: async () => {
      pipelineCalled = true
      throw new Error("pipeline should not be called")
    },
    buildDoneEventData: ({ intent }: { intent: string }) => ({ intent }),
    persistConversationStateTransition: async () => ({ status: "persisted", error: null }),
  })

  const response = await handler(
    new Request("https://example.test/api/chat/product-selection", {
      method: "POST",
      body: JSON.stringify({
        conversation_id: "conversation-1",
        assistant_message_id: "assistant-clarification-1",
        clarification_id: "clarification-1",
        selected_product_id: "syoss-intense-curls-shampoo",
      }),
    }),
  )
  const responseText = await response.text()

  assert.equal(response.status, 200)
  assert.match(responseText, /"type":"error"/)
  assert.match(responseText, /bereits beantwortet/)
  assert.equal(pipelineCalled, false)
  assert.equal(admin.insertedMessages.length, 0)
})

test("chat product selection continues with trusted selected product context", async () => {
  const assistantText =
    "Danke, jetzt ist klar: Du meinst Syoss Intense Volume Shampoo. Ich bewerte es auf Basis deiner Haare."
  const admin = createFakeProductSelectionAdminClient({
    sourceMessage: {
      id: "assistant-clarification-1",
      conversation_id: "conversation-1",
      role: "assistant",
      rag_context: {
        product_lookup_clarification: {
          id: "clarification-1",
          kind: "variant_selection",
          source: "chat",
          original_user_message: "Ich nutze Syoss Intense Volume Shampoo. Passt das zu mir?",
          query: {
            brand_text: "Syoss",
            product_name_text: "Intense Volume Shampoo",
            category: "shampoo",
          },
          copy: { prompt_de: "Welche Variante meinst du?" },
          candidates: [
            {
              product_id: "syoss-intense-volume-shampoo",
              name: "Syoss Intense Volume Shampoo",
              category: "shampoo",
              category_label_de: "Shampoo",
              reason: "same_brand_same_category",
            },
          ],
          none_action: {
            label_de: "Nein, mein Produkt hinzufügen",
            product_intake_offer: {
              id: "offer-1",
              source: "chat",
              reason: "product_lookup_not_found",
              category: "shampoo",
            },
          },
        },
      },
    },
    conversation: { id: "conversation-1", user_id: "user-1" },
    selectedProduct: {
      id: "syoss-intense-volume-shampoo",
      name: "Syoss Intense Volume Shampoo",
      category_key: "shampoo",
      is_active: true,
    },
  })
  let trustedContext: unknown = null
  let selectionTurnMessage: string | null = null
  let persistedSelectionTransition: unknown = null
  const handler = createProductSelectionPostHandler({
    createClient: async () =>
      ({
        auth: {
          getUser: async () => ({ data: { user: { id: "user-1" } } }),
        },
      }) as never,
    createAdminClient: () => admin as never,
    randomUUID: () => "selection-request-1",
    productIntakeEnabled: () => true,
    runAgentV2ProductionPipeline: (async (params: {
      message: string
      trustedSelectedProductContext?: unknown
    }) => {
      selectionTurnMessage = params.message
      trustedContext = params.trustedSelectedProductContext
      return {
        stream: createTextStream(assistantText),
        conversationId: "conversation-1",
        intent: "general_chat",
        matchedProducts: [],
        sources: [],
        retrievalSummary: { final_context_count: 0 },
        routerDecision: {
          confidence: 0.9,
          retrieval_mode: "agent_v2_responses",
          response_mode: "answer_direct",
          slot_completeness: 1,
          policy_overrides: [],
        },
        conversationStateTransition: { next_state: "selection" } as never,
        categoryDecision: undefined,
        engineTrace: undefined,
        debugTrace: {
          agent_v2_trace: {
            tool_calls: [
              {
                call_id: "call_facts",
                name: "load_product_facts",
                arguments: { product_id: "syoss-intense-volume-shampoo" },
                output_summary: "facts_loaded=true",
              },
            ],
            validation_errors: [
              {
                validator_id: "product_assessment_grounding",
                message: "Needs product facts grounding.",
                severity: "block",
              },
            ],
            validation_warnings: [],
            repair_attempts: [
              {
                reason: "missing_guidance_or_tools",
                validation_errors: [
                  {
                    validator_id: "product_assessment_grounding",
                    message: "Needs product facts grounding.",
                    severity: "block",
                  },
                ],
              },
            ],
            failure_stage: "repair_failed",
          },
        } as never,
        visibleFailure: false,
        answerMode: "product_recommendation",
      }
    }) as never,
    buildAssistantDecisionContext: (params) => ({
      sources: [],
      product_lookup_selection: params.productLookupSelection ?? null,
      product_lookup_selection_trace: params.productLookupSelectionTrace ?? null,
    }),
    buildDoneEventData: ({ intent }: { intent: string }) => ({ intent }),
    persistConversationStateTransition: async (_admin, params) => {
      persistedSelectionTransition = params.transition
      return { status: "persisted", error: null }
    },
  })

  const response = await handler(
    new Request("https://example.test/api/chat/product-selection", {
      method: "POST",
      body: JSON.stringify({
        conversation_id: "conversation-1",
        assistant_message_id: "assistant-clarification-1",
        clarification_id: "clarification-1",
        selected_product_id: "syoss-intense-volume-shampoo",
      }),
    }),
  )
  const responseText = await response.text()

  assert.equal(response.status, 200)
  assert.match(responseText, /content_delta/)
  assert.match(responseText, /product_lookup_selection/)
  assert.match(responseText, /assistant-message-1/)
  assert.match(selectionTurnMessage ?? "", /Produktklärung/)
  assert.match(selectionTurnMessage ?? "", /Syoss Intense Volume Shampoo/)
  assert.match(selectionTurnMessage ?? "", /ersetzt die zuvor unklare Produktangabe/)
  assert.match(selectionTurnMessage ?? "", /ursprüngliche Nachricht/)
  assert.deepEqual(trustedContext, {
    source: "product_lookup_clarification",
    original_user_message: "Ich nutze Syoss Intense Volume Shampoo. Passt das zu mir?",
    selected_product: {
      id: "syoss-intense-volume-shampoo",
      name: "Syoss Intense Volume Shampoo",
      category: "shampoo",
    },
    lookup_identity: {
      category: "shampoo",
      brand_text: "Syoss",
      product_name_text: "Intense Volume Shampoo",
      evidence_quote: "Syoss Intense Volume Shampoo",
    },
  })
  assert.equal(admin.insertedMessages.length, 1)
  assert.equal(admin.insertedMessages[0]?.role, "assistant")
  assert.equal(admin.insertedMessages[0]?.content, assistantText)
  assert.deepEqual(
    (admin.insertedMessages[0]?.rag_context as { product_lookup_selection?: unknown })
      .product_lookup_selection,
    {
      source: "product_lookup_clarification",
      clarification_id: "clarification-1",
      source_assistant_message_id: "assistant-clarification-1",
      selected_product_id: "syoss-intense-volume-shampoo",
      selected_product_name: "Syoss Intense Volume Shampoo",
    },
  )
  assert.deepEqual(
    (admin.insertedMessages[0]?.rag_context as { product_lookup_selection_trace?: unknown })
      .product_lookup_selection_trace,
    {
      source: "product_lookup_clarification",
      selected_product: {
        id: "syoss-intense-volume-shampoo",
        name: "Syoss Intense Volume Shampoo",
        category: "shampoo",
      },
      lookup_identity: {
        category: "shampoo",
        brand_text: "Syoss",
        product_name_text: "Intense Volume Shampoo",
        evidence_quote: "Syoss Intense Volume Shampoo",
      },
      called_load_product_facts: true,
      tool_calls: [
        {
          name: "load_product_facts",
          arguments_summary: "product_id=syoss-intense-volume-shampoo",
          output_summary: "facts_loaded=true",
        },
      ],
      validation_error_ids: ["product_assessment_grounding"],
      repair_attempt_reasons: ["missing_guidance_or_tools"],
      failure_stage: "repair_failed",
    },
  )
  const activeProductContext = (
    persistedSelectionTransition as {
      next_state?: { agent_v2?: { active_product_contexts?: unknown[] } }
    }
  )?.next_state?.agent_v2?.active_product_contexts?.[0] as
    | (Record<string, unknown> & { updated_at?: unknown })
    | undefined
  const activeResolvedProductContext = (
    persistedSelectionTransition as {
      next_state?: { agent_v2?: { active_resolved_product_context?: unknown } }
    }
  )?.next_state?.agent_v2?.active_resolved_product_context as
    | Record<string, unknown>
    | undefined

  assert.equal(typeof activeProductContext?.updated_at, "string")
  assert.deepEqual(
    activeProductContext
      ? { ...activeProductContext, updated_at: "<timestamp>" }
      : activeProductContext,
    {
      status: "resolved",
      product_id: "syoss-intense-volume-shampoo",
      submission_id: null,
      category: "shampoo",
      brand_text: "Syoss",
      product_name_text: "Intense Volume Shampoo",
      display_name: "Syoss Intense Volume Shampoo",
      original_user_message: "Ich nutze Syoss Intense Volume Shampoo. Passt das zu mir?",
      source: "product_lookup_selection",
      updated_at: "<timestamp>",
    },
  )
  assert.deepEqual(activeResolvedProductContext, {
    source: "product_lookup_selection",
    product_id: "syoss-intense-volume-shampoo",
    name: "Syoss Intense Volume Shampoo",
    category: "shampoo",
    original_user_message: "Ich nutze Syoss Intense Volume Shampoo. Passt das zu mir?",
  })
})

test("chat product selection allows user-owned non-recommended selected products", async () => {
  const assistantText =
    "Danke, jetzt ist klar: Du meinst dein geprüftes Syoss Intense Volume Shampoo."
  const admin = createFakeProductSelectionAdminClient({
    sourceMessage: createProductLookupClarificationSourceMessage(),
    conversation: { id: "conversation-1", user_id: "user-1" },
    selectedProduct: {
      id: "syoss-intense-volume-shampoo",
      name: "Syoss Intense Volume Shampoo",
      category_key: "shampoo",
      is_active: true,
      lifecycle_status: "active",
      is_chaarlie_recommended: false,
    },
    ownedProductIds: ["syoss-intense-volume-shampoo"],
    verifiedSpecProductIds: ["syoss-intense-volume-shampoo"],
  })
  let pipelineCalled = false
  const handler = createProductSelectionPostHandler({
    createClient: async () =>
      ({
        auth: {
          getUser: async () => ({ data: { user: { id: "user-1" } } }),
        },
      }) as never,
    createAdminClient: () => admin as never,
    randomUUID: () => "selection-request-1",
    productIntakeEnabled: () => true,
    runAgentV2ProductionPipeline: (() => {
      pipelineCalled = true
      return {
        stream: createTextStream(assistantText),
        conversationId: "conversation-1",
        intent: "general_chat",
        matchedProducts: [],
        sources: [],
        retrievalSummary: { final_context_count: 0 },
        routerDecision: {
          confidence: 0.9,
          retrieval_mode: "agent_v2_responses",
          response_mode: "answer_direct",
          slot_completeness: 1,
          policy_overrides: [],
        },
        conversationStateTransition: { next_state: "selection" } as never,
        categoryDecision: undefined,
        engineTrace: undefined,
        debugTrace: {},
        visibleFailure: false,
        answerMode: "product_assessment",
      }
    }) as never,
    buildAssistantDecisionContext: (params) => ({
      sources: [],
      product_lookup_selection: params.productLookupSelection,
    }),
    buildDoneEventData: ({ intent }: { intent: string }) => ({ intent }),
    persistConversationStateTransition: async () => ({ status: "persisted", error: null }),
  })

  const response = await handler(
    new Request("https://example.test/api/chat/product-selection", {
      method: "POST",
      body: JSON.stringify({
        conversation_id: "conversation-1",
        assistant_message_id: "assistant-clarification-1",
        clarification_id: "clarification-1",
        selected_product_id: "syoss-intense-volume-shampoo",
      }),
    }),
  )
  const responseText = await response.text()

  assert.equal(response.status, 200)
  assert.equal(pipelineCalled, true)
  assert.match(responseText, /product_lookup_selection/)
})

test("chat product selection rejects user-owned non-recommended products without verified specs", async () => {
  const admin = createFakeProductSelectionAdminClient({
    sourceMessage: createProductLookupClarificationSourceMessage(),
    conversation: { id: "conversation-1", user_id: "user-1" },
    selectedProduct: {
      id: "syoss-intense-volume-shampoo",
      name: "Syoss Intense Volume Shampoo",
      category_key: "shampoo",
      is_active: true,
      lifecycle_status: "active",
      is_chaarlie_recommended: false,
    },
    ownedProductIds: ["syoss-intense-volume-shampoo"],
    verifiedSpecProductIds: [],
  })
  let pipelineCalled = false
  const handler = createProductSelectionPostHandler({
    createClient: async () =>
      ({
        auth: {
          getUser: async () => ({ data: { user: { id: "user-1" } } }),
        },
      }) as never,
    createAdminClient: () => admin as never,
    randomUUID: () => "selection-request-1",
    productIntakeEnabled: () => true,
    runAgentV2ProductionPipeline: (() => {
      pipelineCalled = true
      return {
        stream: createTextStream("should not stream"),
        conversationId: "conversation-1",
        intent: "general_chat",
        matchedProducts: [],
        sources: [],
        retrievalSummary: { final_context_count: 0 },
        routerDecision: {
          confidence: 0.9,
          retrieval_mode: "agent_v2_responses",
          response_mode: "answer_direct",
          slot_completeness: 1,
          policy_overrides: [],
        },
        conversationStateTransition: { next_state: "selection" } as never,
        categoryDecision: undefined,
        engineTrace: undefined,
        debugTrace: {},
        visibleFailure: false,
        answerMode: "product_assessment",
      }
    }) as never,
    buildAssistantDecisionContext: () => ({ sources: [] }),
    buildDoneEventData: ({ intent }: { intent: string }) => ({ intent }),
    persistConversationStateTransition: async () => ({ status: "persisted", error: null }),
  })

  const response = await handler(
    new Request("https://example.test/api/chat/product-selection", {
      method: "POST",
      body: JSON.stringify({
        conversation_id: "conversation-1",
        assistant_message_id: "assistant-clarification-1",
        clarification_id: "clarification-1",
        selected_product_id: "syoss-intense-volume-shampoo",
      }),
    }),
  )

  assert.equal(response.status, 400)
  assert.equal(pipelineCalled, false)
  assert.deepEqual(await response.json(), { error: "Dieses Produkt ist nicht mehr verfügbar." })
})

test("chat product selection suppresses recommendation cards from the selection continuation", async () => {
  const assistantText =
    "Danke, jetzt ist klar: Du meinst Syoss Intense Volume Shampoo. Ich bewerte genau dieses Produkt."
  const admin = createFakeProductSelectionAdminClient({
    sourceMessage: createProductLookupClarificationSourceMessage(),
    conversation: { id: "conversation-1", user_id: "user-1" },
    selectedProduct: {
      id: "syoss-intense-volume-shampoo",
      name: "Syoss Intense Volume Shampoo",
      category_key: "shampoo",
      is_active: true,
    },
  })
  const handler = createProductSelectionPostHandler({
    createClient: async () =>
      ({
        auth: {
          getUser: async () => ({ data: { user: { id: "user-1" } } }),
        },
      }) as never,
    createAdminClient: () => admin as never,
    randomUUID: () => "selection-request-1",
    productIntakeEnabled: () => true,
    runAgentV2ProductionPipeline: (() => ({
      stream: createTextStream(assistantText),
      conversationId: "conversation-1",
      intent: "general_chat",
      matchedProducts: [
        {
          id: "balea-volume-shampoo",
          name: "Balea Professional Ultimate Volume",
          category: "shampoo",
        },
      ],
      sources: [],
      retrievalSummary: { final_context_count: 0 },
      routerDecision: {
        confidence: 0.9,
        retrieval_mode: "agent_v2_responses",
        response_mode: "answer_direct",
        slot_completeness: 1,
        policy_overrides: [],
      },
      conversationStateTransition: { next_state: "selection" } as never,
      categoryDecision: undefined,
      engineTrace: undefined,
      debugTrace: {},
      visibleFailure: false,
      answerMode: "product_recommendation",
    })) as never,
    buildAssistantDecisionContext: (params) => ({
      sources: [],
      product_lookup_selection: params.productLookupSelection,
    }),
    buildDoneEventData: ({ intent }: { intent: string }) => ({ intent }),
    persistConversationStateTransition: async () => ({ status: "persisted", error: null }),
  })

  const response = await handler(
    new Request("https://example.test/api/chat/product-selection", {
      method: "POST",
      body: JSON.stringify({
        conversation_id: "conversation-1",
        assistant_message_id: "assistant-clarification-1",
        clarification_id: "clarification-1",
        selected_product_id: "syoss-intense-volume-shampoo",
      }),
    }),
  )
  const responseText = await response.text()

  assert.equal(response.status, 200)
  assert.doesNotMatch(responseText, /product_recommendations/)
  assert.equal(admin.insertedMessages[0]?.product_recommendations, null)
})

test("chat product selection grounds category-mismatch selections on the selected product category", async () => {
  const admin = createFakeProductSelectionAdminClient({
    sourceMessage: {
      id: "assistant-clarification-1",
      conversation_id: "conversation-1",
      role: "assistant",
      rag_context: {
        product_lookup_clarification: {
          id: "clarification-1",
          kind: "category_mismatch",
          source: "chat",
          original_user_message: "Ich nutze Syoss Intense Volume Shampoo. Passt das zu mir?",
          query: {
            brand_text: "Syoss",
            product_name_text: "Intense Volume Shampoo",
            category: "shampoo",
          },
          copy: { prompt_de: "Ich finde dieses Produkt nur als Conditioner. Meinst du dieses?" },
          candidates: [
            {
              product_id: "syoss-intense-volume-conditioner",
              name: "Syoss Intense Volume Conditioner",
              category: "conditioner",
              category_label_de: "Conditioner",
              reason: "category_mismatch",
            },
          ],
          none_action: {
            label_de: "Nein, mein Produkt hinzufügen",
            product_intake_offer: {
              id: "offer-1",
              source: "chat",
              reason: "product_lookup_not_found",
              category: "shampoo",
            },
          },
        },
      },
    },
    conversation: { id: "conversation-1", user_id: "user-1" },
    selectedProduct: {
      id: "syoss-intense-volume-conditioner",
      name: "Syoss Intense Volume Conditioner",
      category_key: "conditioner",
      is_active: true,
    },
  })
  let trustedContext: unknown = null
  const handler = createProductSelectionPostHandler({
    createClient: async () =>
      ({
        auth: {
          getUser: async () => ({ data: { user: { id: "user-1" } } }),
        },
      }) as never,
    createAdminClient: () => admin as never,
    randomUUID: () => "selection-request-1",
    productIntakeEnabled: () => true,
    runAgentV2ProductionPipeline: (async (params: { trustedSelectedProductContext?: unknown }) => {
      trustedContext = params.trustedSelectedProductContext
      return {
        stream: createTextStream("Alles klar, ich beziehe mich auf den Conditioner."),
        conversationId: "conversation-1",
        intent: "general_chat",
        matchedProducts: [],
        sources: [],
        retrievalSummary: { final_context_count: 0 },
        routerDecision: {
          confidence: 0.9,
          retrieval_mode: "agent_v2_responses",
          response_mode: "answer_direct",
          slot_completeness: 1,
          policy_overrides: [],
        },
        conversationStateTransition: { next_state: "selection" } as never,
        categoryDecision: undefined,
        engineTrace: undefined,
        debugTrace: {},
        visibleFailure: false,
        answerMode: "general_advice",
      }
    }) as never,
    buildAssistantDecisionContext: (params) => ({
      sources: [],
      product_lookup_selection: params.productLookupSelection,
    }),
    buildDoneEventData: ({ intent }: { intent: string }) => ({ intent }),
    persistConversationStateTransition: async () => ({ status: "persisted", error: null }),
  })

  const response = await handler(
    new Request("https://example.test/api/chat/product-selection", {
      method: "POST",
      body: JSON.stringify({
        conversation_id: "conversation-1",
        assistant_message_id: "assistant-clarification-1",
        clarification_id: "clarification-1",
        selected_product_id: "syoss-intense-volume-conditioner",
      }),
    }),
  )

  assert.equal(response.status, 200)
  assert.deepEqual(trustedContext, {
    source: "product_lookup_clarification",
    original_user_message: "Ich nutze Syoss Intense Volume Shampoo. Passt das zu mir?",
    selected_product: {
      id: "syoss-intense-volume-conditioner",
      name: "Syoss Intense Volume Conditioner",
      category: "conditioner",
    },
    lookup_identity: {
      category: "conditioner",
      brand_text: "Syoss",
      product_name_text: "Intense Volume Shampoo",
      evidence_quote: "Syoss Intense Volume Shampoo",
    },
  })
})

test("chat product selection duplicate-key persistence does not mutate state twice", async () => {
  const assistantText = "Alles klar, ich beziehe mich ab jetzt auf Syoss Intense Volume Shampoo."
  const admin = createFakeProductSelectionAdminClient({
    sourceMessage: createProductLookupClarificationSourceMessage(),
    conversation: { id: "conversation-1", user_id: "user-1" },
    selectedProduct: {
      id: "syoss-intense-volume-shampoo",
      name: "Syoss Intense Volume Shampoo",
      category_key: "shampoo",
      is_active: true,
    },
    existingMessages: [
      {
        id: "b1809fe7-61ed-5519-9a44-8417984caa10",
        content: "Bereits gespeichert: Syoss Intense Volume Shampoo.",
        rag_context: {
          product_lookup_selection: {
            source: "product_lookup_clarification",
            clarification_id: "clarification-1",
            source_assistant_message_id: "assistant-clarification-1",
            selected_product_id: "syoss-intense-volume-shampoo",
            selected_product_name: "Syoss Intense Volume Shampoo",
          },
        },
        product_recommendations: [
          { id: "syoss-intense-volume-shampoo", name: "Syoss Intense Volume Shampoo" },
        ],
      },
    ],
    messageInsertError: {
      code: "23505",
      message: "duplicate key value violates unique constraint",
    },
  })
  let persistedSelectionTransition: unknown = null
  const handler = createProductSelectionPostHandler({
    createClient: async () =>
      ({
        auth: {
          getUser: async () => ({ data: { user: { id: "user-1" } } }),
        },
      }) as never,
    createAdminClient: () => admin as never,
    randomUUID: () => "selection-request-1",
    productIntakeEnabled: () => true,
    runAgentV2ProductionPipeline: (() => ({
      stream: createTextStream(assistantText),
      conversationId: "conversation-1",
      intent: "general_chat",
      matchedProducts: [],
      sources: [],
      retrievalSummary: { final_context_count: 0 },
      routerDecision: {
        confidence: 0.9,
        retrieval_mode: "agent_v2_responses",
        response_mode: "answer_direct",
        slot_completeness: 1,
        policy_overrides: [],
      },
      conversationStateTransition: { next_state: "selection" } as never,
      categoryDecision: undefined,
      engineTrace: undefined,
      debugTrace: {},
      visibleFailure: false,
      answerMode: "product_recommendation",
    })) as never,
    buildAssistantDecisionContext: (params) => ({
      sources: [],
      product_lookup_selection: params.productLookupSelection,
    }),
    buildDoneEventData: ({ intent }: { intent: string }) => ({ intent }),
    persistConversationStateTransition: async (_admin, params) => {
      persistedSelectionTransition = params.transition
      return { status: "persisted", error: null }
    },
  })

  const response = await handler(
    new Request("https://example.test/api/chat/product-selection", {
      method: "POST",
      body: JSON.stringify({
        conversation_id: "conversation-1",
        assistant_message_id: "assistant-clarification-1",
        clarification_id: "clarification-1",
        selected_product_id: "syoss-intense-volume-shampoo",
      }),
    }),
  )
  const responseText = await response.text()

  assert.equal(response.status, 200)
  assert.match(responseText, /content_delta/)
  assert.match(responseText, /Bereits gespeichert/)
  assert.doesNotMatch(responseText, /product_recommendations/)
  assert.doesNotMatch(responseText, /error/)
  assert.match(responseText, /product_lookup_selection/)
  const activeProductContext = (
    persistedSelectionTransition as {
      next_state?: { agent_v2?: { active_product_contexts?: unknown[] } }
    }
  )?.next_state?.agent_v2?.active_product_contexts?.[0] as
    | (Record<string, unknown> & { updated_at?: unknown })
    | undefined
  assert.equal(typeof activeProductContext?.updated_at, "string")
  assert.deepEqual(
    activeProductContext
      ? { ...activeProductContext, updated_at: "<timestamp>" }
      : activeProductContext,
    {
      status: "resolved",
      product_id: "syoss-intense-volume-shampoo",
      submission_id: null,
      category: "shampoo",
      brand_text: "Syoss",
      product_name_text: "Intense Volume Shampoo",
      display_name: "Syoss Intense Volume Shampoo",
      original_user_message: "Ich nutze Syoss Intense Volume Shampoo. Passt das zu mir?",
      source: "product_lookup_selection",
      updated_at: "<timestamp>",
    },
  )
})

test("chat product selection streams an error when active product state persistence fails", async () => {
  const assistantText = "Alles klar, ich beziehe mich ab jetzt auf Syoss Intense Volume Shampoo."
  const admin = createFakeProductSelectionAdminClient({
    sourceMessage: createProductLookupClarificationSourceMessage(),
    conversation: { id: "conversation-1", user_id: "user-1" },
    selectedProduct: {
      id: "syoss-intense-volume-shampoo",
      name: "Syoss Intense Volume Shampoo",
      category_key: "shampoo",
      is_active: true,
    },
  })
  const handler = createProductSelectionPostHandler({
    createClient: async () =>
      ({
        auth: {
          getUser: async () => ({ data: { user: { id: "user-1" } } }),
        },
      }) as never,
    createAdminClient: () => admin as never,
    randomUUID: () => "selection-request-1",
    productIntakeEnabled: () => true,
    runAgentV2ProductionPipeline: (() => ({
      stream: createTextStream(assistantText),
      conversationId: "conversation-1",
      intent: "general_chat",
      matchedProducts: [],
      sources: [],
      retrievalSummary: { final_context_count: 0 },
      routerDecision: {
        confidence: 0.9,
        retrieval_mode: "agent_v2_responses",
        response_mode: "answer_direct",
        slot_completeness: 1,
        policy_overrides: [],
      },
      conversationStateTransition: { next_state: "selection" } as never,
      categoryDecision: undefined,
      engineTrace: undefined,
      debugTrace: {},
      visibleFailure: false,
      answerMode: "product_assessment",
    })) as never,
    buildAssistantDecisionContext: (params) => ({
      sources: [],
      product_lookup_selection: params.productLookupSelection,
    }),
    buildDoneEventData: ({ intent }: { intent: string }) => ({ intent }),
    persistConversationStateTransition: async () => ({
      status: "failed",
      error: "state unavailable",
    }),
  })

  const response = await handler(
    new Request("https://example.test/api/chat/product-selection", {
      method: "POST",
      body: JSON.stringify({
        conversation_id: "conversation-1",
        assistant_message_id: "assistant-clarification-1",
        clarification_id: "clarification-1",
        selected_product_id: "syoss-intense-volume-shampoo",
      }),
    }),
  )
  const responseText = await response.text()

  assert.equal(response.status, 200)
  assert.match(responseText, /"type":"error"/)
  assert.match(responseText, /Produktauswahl konnte nicht verarbeitet werden/)
  assert.equal(admin.insertedMessages.length, 0)
})

test("chat product selection persists resolved state before assistant message insert", async () => {
  const assistantText = "Alles klar, ich beziehe mich ab jetzt auf Syoss Intense Volume Shampoo."
  const admin = createFakeProductSelectionAdminClient({
    sourceMessage: {
      id: "assistant-clarification-1",
      conversation_id: "conversation-1",
      role: "assistant",
      rag_context: {
        product_lookup_clarification: {
          id: "clarification-1",
          kind: "variant_selection",
          source: "chat",
          original_user_message: "Ich nutze Syoss Intense Volume Shampoo. Passt das zu mir?",
          query: {
            brand_text: "Syoss",
            product_name_text: "Intense Volume Shampoo",
            category: "shampoo",
          },
          copy: { prompt_de: "Welche Variante meinst du?" },
          candidates: [
            {
              product_id: "syoss-intense-volume-shampoo",
              name: "Syoss Intense Volume Shampoo",
              category: "shampoo",
              category_label_de: "Shampoo",
              reason: "same_brand_same_category",
            },
          ],
          none_action: {
            label_de: "Nein, mein Produkt hinzufügen",
            product_intake_offer: {
              id: "offer-1",
              source: "chat",
              reason: "product_lookup_not_found",
              category: "shampoo",
            },
          },
        },
      },
    },
    conversation: { id: "conversation-1", user_id: "user-1" },
    selectedProduct: {
      id: "syoss-intense-volume-shampoo",
      name: "Syoss Intense Volume Shampoo",
      category_key: "shampoo",
      is_active: true,
    },
    messageInsertError: { message: "database unavailable" },
  })
  let persistedSelectionTransition: unknown = null
  const handler = createProductSelectionPostHandler({
    createClient: async () =>
      ({
        auth: {
          getUser: async () => ({ data: { user: { id: "user-1" } } }),
        },
      }) as never,
    createAdminClient: () => admin as never,
    randomUUID: () => "selection-request-1",
    productIntakeEnabled: () => true,
    runAgentV2ProductionPipeline: (() => ({
      stream: createTextStream(assistantText),
      conversationId: "conversation-1",
      intent: "general_chat",
      matchedProducts: [],
      sources: [],
      retrievalSummary: { final_context_count: 0 },
      routerDecision: {
        confidence: 0.9,
        retrieval_mode: "agent_v2_responses",
        response_mode: "answer_direct",
        slot_completeness: 1,
        policy_overrides: [],
      },
      conversationStateTransition: { next_state: "selection" } as never,
      categoryDecision: undefined,
      engineTrace: undefined,
      debugTrace: {},
      visibleFailure: false,
      answerMode: "product_recommendation",
    })) as never,
    buildAssistantDecisionContext: (params) => ({
      sources: [],
      product_lookup_selection: params.productLookupSelection,
    }),
    buildDoneEventData: ({ intent }: { intent: string }) => ({ intent }),
    persistConversationStateTransition: async (_admin, params) => {
      persistedSelectionTransition = params.transition
      return { status: "persisted", error: null }
    },
  })

  const response = await handler(
    new Request("https://example.test/api/chat/product-selection", {
      method: "POST",
      body: JSON.stringify({
        conversation_id: "conversation-1",
        assistant_message_id: "assistant-clarification-1",
        clarification_id: "clarification-1",
        selected_product_id: "syoss-intense-volume-shampoo",
      }),
    }),
  )
  const responseText = await response.text()

  assert.equal(response.status, 200)
  assert.match(responseText, /"type":"error"/)
  assert.match(responseText, /Produktauswahl konnte nicht verarbeitet werden/)
  const activeProductContext = (
    persistedSelectionTransition as {
      next_state?: { agent_v2?: { active_product_contexts?: unknown[] } }
    }
  )?.next_state?.agent_v2?.active_product_contexts?.[0] as
    | (Record<string, unknown> & { updated_at?: unknown })
    | undefined

  assert.equal(activeProductContext?.product_id, "syoss-intense-volume-shampoo")
  assert.equal(activeProductContext?.source, "product_lookup_selection")
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
        buildAssistantDecisionContext: (params: { productIntakeOffer?: unknown }) => ({
          product_intake_offer: params.productIntakeOffer,
        }),
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
