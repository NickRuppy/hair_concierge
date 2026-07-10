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
  conversationState?: Record<string, unknown> | null
  conversationStateError?: { message: string } | null
  existingMessages?: Array<Record<string, unknown>>
  messageInsertError?: { code?: string; message: string } | null
}) {
  const insertedMessages: Array<Record<string, unknown>> = []
  const conversationUpdates: Array<Record<string, unknown>> = []
  const client = {
    insertedMessages,
    conversationUpdates,
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
            return { data: isOwned ? { id: "usage-1", product_id: productId } : null, error: null }
          }
          return { data: null, error: null }
        },
        async maybeSingle() {
          if (table === "user_product_usage") {
            const productId = this.filters.find((filter) => filter.column === "product_id")?.value
            const isOwned =
              typeof productId === "string" && params.ownedProductIds?.includes(productId)
            return { data: isOwned ? { id: "usage-1", product_id: productId } : null, error: null }
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
    message_context: {
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
        buildAssistantMessageContext: (params: { productIntakeOffer?: unknown }) => {
          decisionContextProductIntakeOffer = params.productIntakeOffer
          return { product_intake_offer: params.productIntakeOffer }
        },
        buildDoneEventData: ({ intent }: { intent: string }) => ({ intent }),
        extractConversationMemory: (...args: unknown[]) => {
          memoryExtractionCalls.push(args)
          return Promise.resolve()
        },
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
  assert.doesNotMatch(responseText, /"type":"sources"/)
  assert.doesNotMatch(responseText, /"type":"retrieval_debug"/)
  assert.match(responseText, new RegExp(modelAnswer))
  assert.equal(messageRows[1]?.content, modelAnswer)
  assert.deepEqual(decisionContextProductIntakeOffer, productIntakeOffer)
  assert.deepEqual(
    (messageRows[1]?.message_context as { product_intake_offer?: unknown } | undefined)
      ?.product_intake_offer,
    productIntakeOffer,
  )
  assert.deepEqual(messageRows[1]?.rag_context, messageRows[1]?.message_context)
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
        buildAssistantMessageContext: (params: { productLookupClarification?: unknown }) => {
          decisionContextProductLookupClarification = params.productLookupClarification
          return { product_lookup_clarification: params.productLookupClarification }
        },
        buildDoneEventData: ({ intent }: { intent: string }) => ({ intent }),
        extractConversationMemory: async () => {},
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
    (messageRows[1]?.message_context as { product_lookup_clarification?: unknown } | undefined)
      ?.product_lookup_clarification,
    productLookupClarification,
  )
})

test("chat route preserves product lookup clarification from visible repair fallback", async () => {
  const modelAnswer =
    "Ich finde zu Syoss Intense Volume Shampoo mehrere mögliche Varianten und möchte nichts Falsches bewerten."
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
        buildAssistantMessageContext: (params: { productLookupClarification?: unknown }) => {
          decisionContextProductLookupClarification = params.productLookupClarification
          return { product_lookup_clarification: params.productLookupClarification }
        },
        buildDoneEventData: ({ intent }: { intent: string }) => ({ intent }),
        extractConversationMemory: async () => {},
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
    (messageRows[1]?.message_context as { product_lookup_clarification?: unknown } | undefined)
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
        buildAssistantMessageContext: (params: { productIntakeOffer?: unknown }) => {
          decisionContextProductIntakeOffer = params.productIntakeOffer
          return { product_intake_offer: params.productIntakeOffer }
        },
        buildDoneEventData: ({ intent }: { intent: string }) => ({ intent }),
        extractConversationMemory: async () => {},
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
    (messageRows[1]?.message_context as { product_intake_offer?: unknown } | undefined)
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
      message_context: {
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
        message_context: { product_lookup_selection: existingSelection },
        langfuse_trace_id: "trace-1",
      },
    ],
  })
  let pipelineCalled = false
  const persistedSelectionTransitions: unknown[] = []
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
      persistedSelectionTransitions.push(params.transition)
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
    persistedSelectionTransitions.at(-1) as {
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
        message_context: { product_lookup_selection: existingSelection },
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
        message_context: { product_lookup_selection: existingSelection },
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
      message_context: {
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
  const persistedSelectionTransitions: unknown[] = []
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
      }
    }) as never,
    buildAssistantMessageContext: (params) => ({
      product_lookup_selection: params.productLookupSelection,
    }),
    buildDoneEventData: ({ intent }: { intent: string }) => ({ intent }),
    persistConversationStateTransition: async (_admin, params) => {
      persistedSelectionTransitions.push(params.transition)
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
    (admin.insertedMessages[0]?.message_context as { product_lookup_selection?: unknown })
      .product_lookup_selection,
    {
      source: "product_lookup_clarification",
      clarification_id: "clarification-1",
      source_assistant_message_id: "assistant-clarification-1",
      selected_product_id: "syoss-intense-volume-shampoo",
      selected_product_name: "Syoss Intense Volume Shampoo",
    },
  )
  assert.deepEqual(persistedSelectionTransitions[0], { next_state: "selection" })
  const selectionResolvedTransition = persistedSelectionTransitions.at(-1) as {
    reason?: string
    next_state?: {
      agent_v2?: { active_resolved_product_context?: { product_id?: string } | null }
    }
  }
  assert.equal(selectionResolvedTransition?.reason, "product_lookup_selection_resolved")
  assert.equal(
    selectionResolvedTransition?.next_state?.agent_v2?.active_resolved_product_context?.product_id,
    "syoss-intense-volume-shampoo",
  )
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
    buildAssistantMessageContext: (params) => ({
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
    buildAssistantMessageContext: () => null,
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
    buildAssistantMessageContext: (params) => ({
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
      message_context: {
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
    buildAssistantMessageContext: (params) => ({
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
        message_context: {
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
  const persistedSelectionTransitions: unknown[] = []
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
    buildAssistantMessageContext: (params) => ({
      product_lookup_selection: params.productLookupSelection,
    }),
    buildDoneEventData: ({ intent }: { intent: string }) => ({ intent }),
    persistConversationStateTransition: async (_admin, params) => {
      persistedSelectionTransitions.push(params.transition)
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
    persistedSelectionTransitions.at(-1) as {
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
    buildAssistantMessageContext: (params) => ({
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
      message_context: {
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
  const persistedSelectionTransitions: unknown[] = []
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
    buildAssistantMessageContext: (params) => ({
      product_lookup_selection: params.productLookupSelection,
    }),
    buildDoneEventData: ({ intent }: { intent: string }) => ({ intent }),
    persistConversationStateTransition: async (_admin, params) => {
      persistedSelectionTransitions.push(params.transition)
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
  assert.deepEqual(persistedSelectionTransitions[0], { next_state: "selection" })
  assert.equal(
    (persistedSelectionTransitions.at(-1) as { reason?: string } | undefined)?.reason,
    "product_lookup_selection_resolved",
  )
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
        buildAssistantMessageContext: (params: { productIntakeOffer?: unknown }) => ({
          product_intake_offer: params.productIntakeOffer,
        }),
        buildDoneEventData: ({ intent }: { intent: string }) => ({ intent }),
        extractConversationMemory: (...args: unknown[]) => {
          memoryExtractionCalls.push(args)
          return Promise.resolve()
        },
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
