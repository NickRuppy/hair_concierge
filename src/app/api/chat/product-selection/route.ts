import { NextResponse } from "next/server"
import { createHash } from "crypto"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { isProductIntakeEnabled } from "@/lib/product-intake/config"
import {
  isProductEligibleForMode,
  productIsActive,
  productLifecycleStatus,
} from "@/lib/product-catalog/eligibility"
import { runAgentV2ProductionPipeline } from "@/lib/agent-v2/production/chat-pipeline"
import {
  buildActiveProductContextFromTrustedSelection,
  buildPrimaryResolvedProductContext,
  buildTrustedSelectedProductContext,
  mergeActiveProductContexts,
} from "@/lib/agent-v2/resolved-product-selection-adapter"
import {
  AGENT_V2_PRODUCTION_ENGINE,
  normalizeAgentV2ConversationState,
  type AgentV2ConversationStateTransition,
} from "@/lib/agent-v2/production/persisted-session-state"
import { buildAssistantDecisionContext, buildDoneEventData } from "@/lib/chat-runtime/stream-events"
import { persistConversationStateTransition } from "@/lib/chat-runtime/conversation-state-store"
import type { PipelineTraceDraft } from "@/lib/chat-runtime/debug-trace"
import { ERR_UNAUTHORIZED } from "@/lib/vocabulary"
import { hasVerifiedProductSpecs } from "@/lib/product-intake/spec-readiness"
import {
  buildResolvedProductSelection,
  getResolvedProductSelectionDisplayName,
  getResolvedProductSelectionStableKeyParts,
  productLookupSelectionResolvesSourceCard,
  toProductLookupSelectionContext,
} from "@/lib/product-intake/resolved-product-selection"
import type {
  MessageRagContext,
  ProductLookupClarification,
  ProductLookupSelectionContext,
  ProductLookupSelectionTrace,
} from "@/lib/types"
import type { AgentV2ToolCallTrace, AgentV2ValidationError } from "@/lib/agent-v2/contracts"
import type { AgentV2TrustedSelectedProductContext } from "@/lib/agent-v2/resolved-product-selection-adapter"

export const maxDuration = 60

type ProductSelectionBody = {
  conversation_id?: unknown
  assistant_message_id?: unknown
  clarification_id?: unknown
  selected_product_id?: unknown
}

type ProductSelectionRuntimeDeps = {
  createClient?: typeof createClient
  createAdminClient?: typeof createAdminClient
  runAgentV2ProductionPipeline?: typeof runAgentV2ProductionPipeline
  buildAssistantDecisionContext?: typeof buildAssistantDecisionContext
  buildDoneEventData?: typeof buildDoneEventData
  persistConversationStateTransition?: typeof persistConversationStateTransition
  productIntakeEnabled?: () => boolean
  randomUUID?: () => string
}

type ProductSelectionFilterQuery = {
  eq: (column: string, value: string) => ProductSelectionFilterQuery
  limit: (count: number) => PromiseLike<{ data: unknown[] | null; error: unknown | null }>
  maybeSingle: () => Promise<{ data: unknown | null; error: unknown | null }>
}

type ProductSelectionAdminClient = {
  from: (table: string) => {
    select: (columns: string) => ProductSelectionFilterQuery
  }
  rpc?: (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown | null; error: { message?: string | null } | null }>
}

const LINK_EXISTING_PRODUCT_FREQUENCY_PLACEHOLDER = "less_than_monthly"

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null
}

function summarizeTraceArguments(args: unknown): string | undefined {
  if (!args || typeof args !== "object" || Array.isArray(args)) return undefined
  const record = args as Record<string, unknown>
  const parts: string[] = []
  for (const key of ["product_id", "category", "brand_text", "product_name_text", "reason"]) {
    const value = record[key]
    if (typeof value === "string" && value.trim().length > 0) {
      parts.push(`${key}=${value.trim()}`)
    }
  }
  return parts.length > 0 ? parts.join("; ") : undefined
}

function compactValidationIds(errors: readonly AgentV2ValidationError[] | undefined): string[] {
  return Array.from(
    new Set(
      (errors ?? [])
        .map((error) => error.validator_id)
        .filter((validatorId): validatorId is string => typeof validatorId === "string"),
    ),
  )
}

function buildProductLookupSelectionTrace(params: {
  trustedSelectedProductContext: AgentV2TrustedSelectedProductContext
  debugTrace: PipelineTraceDraft
}): ProductLookupSelectionTrace {
  const agentTrace = params.debugTrace.agent_v2_trace ?? null
  const toolCalls = (agentTrace?.tool_calls ?? []).map((call: AgentV2ToolCallTrace) => ({
    name: call.name,
    arguments_summary: summarizeTraceArguments(call.arguments),
    output_summary: call.output_summary,
  }))

  return {
    source: "product_lookup_clarification",
    selected_product: params.trustedSelectedProductContext.selected_product,
    lookup_identity: params.trustedSelectedProductContext.lookup_identity,
    called_load_product_facts: toolCalls.some((call) => call.name === "load_product_facts"),
    tool_calls: toolCalls,
    validation_error_ids: compactValidationIds(agentTrace?.validation_errors),
    repair_attempt_reasons: Array.from(
      new Set((agentTrace?.repair_attempts ?? []).map((attempt) => attempt.reason)),
    ),
    failure_stage: agentTrace?.failure_stage ?? null,
  }
}

function readClarification(value: unknown): ProductLookupClarification | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const candidate = value as ProductLookupClarification
  if (!candidate.id || !Array.isArray(candidate.candidates)) return null
  return candidate
}

function findExistingSelectionMessage(
  rows: unknown,
  sourceCard: {
    clarificationId: string
    sourceAssistantMessageId: string
    selectedProductId?: string | null
  },
): {
  id?: string | null
  content?: string | null
  rag_context?: MessageRagContext | null
  product_recommendations?: unknown[] | null
  langfuse_trace_id?: string | null
  langfuse_trace_url?: string | null
} | null {
  if (!Array.isArray(rows)) return null

  return (
    rows.find((row) => {
      if (!row || typeof row !== "object" || Array.isArray(row)) return false
      const record = row as { rag_context?: MessageRagContext | null }
      const existing = record.rag_context?.product_lookup_selection
      return productLookupSelectionResolvesSourceCard(existing, sourceCard)
    }) ?? null
  )
}

function isDuplicateKeyError(
  error: { code?: string | null; message?: string | null } | null | undefined,
) {
  if (!error) return false
  return error.code === "23505" || /duplicate key|unique constraint/i.test(error.message ?? "")
}

function createStableUuidFromParts(parts: readonly string[]): string {
  const hash = createHash("sha256").update(parts.join("\u001f")).digest()
  hash[6] = (hash[6] & 0x0f) | 0x50
  hash[8] = (hash[8] & 0x3f) | 0x80
  const hex = hash.subarray(0, 16).toString("hex")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function streamAssistantContinuation(params: {
  conversationId: string
  contentStream: ReadableStream<Uint8Array>
  assistantMessageId?: string | null
  getAssistantMessageId?: () => string | null
  langfuseTraceId?: string | null
  langfuseTraceUrl?: string | null
  doneData: unknown
  productRecommendations?: unknown[] | null
  productLookupSelection?: ProductLookupSelectionContext | null
  onFullContent?: (content: string) => Promise<void>
}) {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({ type: "conversation_id", data: params.conversationId })}\n\n`,
        ),
      )
      if (params.langfuseTraceId) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: "langfuse_trace",
              data: { trace_id: params.langfuseTraceId },
            })}\n\n`,
          ),
        )
      }

      const reader = params.contentStream.getReader()
      const decoder = new TextDecoder()
      let fullContent = ""

      try {
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          const text = decoder.decode(value, { stream: true })
          fullContent += text
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "content_delta", data: text })}\n\n`),
          )
        }
        fullContent += decoder.decode()
        await params.onFullContent?.(fullContent)
        if (params.productRecommendations?.length) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "product_recommendations",
                data: params.productRecommendations,
              })}\n\n`,
            ),
          )
        }
        if (params.productLookupSelection) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "product_lookup_selection",
                data: params.productLookupSelection,
              })}\n\n`,
            ),
          )
        }
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: "assistant_message",
              data: {
                id: params.getAssistantMessageId
                  ? params.getAssistantMessageId()
                  : (params.assistantMessageId ?? null),
                langfuse_trace_id: params.langfuseTraceId ?? null,
                langfuse_trace_url: params.langfuseTraceUrl ?? null,
              },
            })}\n\n`,
          ),
        )
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "done", data: params.doneData })}\n\n`),
        )
      } catch {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: "error",
              data: { message: "Produktauswahl konnte nicht verarbeitet werden." },
            })}\n\n`,
          ),
        )
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}

function createTextStream(content: string): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(content))
      controller.close()
    },
  })
}

async function readTextStream(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let fullContent = ""

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    fullContent += decoder.decode(value, { stream: true })
  }

  return fullContent + decoder.decode()
}

function streamProductSelectionError(message = "Produktauswahl konnte nicht verarbeitet werden.") {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({
            type: "error",
            data: { message },
          })}\n\n`,
        ),
      )
      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}

async function isSelectedProductVisibleToUser(params: {
  admin: ProductSelectionAdminClient
  userId: string
  product: {
    id?: string | null
    category?: string | null
    category_key?: string | null
    is_active?: boolean | null
    lifecycle_status?: string | null
    is_chaarlie_recommended?: boolean | null
  }
}): Promise<boolean> {
  if (isProductEligibleForMode(params.product, "general_recommendation")) return true
  if (!params.product.id) return false

  const { data, error } = await params.admin
    .from("user_product_usage")
    .select("id")
    .eq("user_id", params.userId)
    .eq("product_id", params.product.id)
    .eq("match_status", "matched")
    .maybeSingle()

  if (error) {
    console.error("Failed to verify selected product ownership:", error)
    return false
  }

  if (!data) return false

  const hasVerifiedSpecs = await hasVerifiedProductSpecs({
    client: params.admin,
    productId: params.product.id,
    categoryKey: params.product.category_key ?? params.product.category,
  })

  return isProductEligibleForMode(params.product, "owned_assessment", {
    isUserOwned: true,
    hasVerifiedSpecs,
  })
}

function isLinkableExistingProduct(product: {
  id?: string | null
  is_active?: boolean | null
  lifecycle_status?: string | null
}): boolean {
  return Boolean(product.id) && productIsActive(product) && productLifecycleStatus(product) === "active"
}

async function linkExistingProductForUser(params: {
  admin: ProductSelectionAdminClient
  userId: string
  product: {
    id?: string | null
    name?: string | null
    category?: string | null
    category_key?: string | null
  }
  selectedCandidate: ProductLookupClarification["candidates"][number]
}) {
  if (!params.admin.rpc || !params.product.id) return false
  const category = params.product.category_key ?? params.product.category ?? params.selectedCandidate.category
  if (!category) return false

  const { data: existingUsage, error: existingUsageError } = await params.admin
    .from("user_product_usage")
    .select("id, frequency_range")
    .eq("user_id", params.userId)
    .eq("category", category)
    .maybeSingle()

  if (existingUsageError) {
    console.error("Failed to load existing usage before linking product:", existingUsageError)
    return false
  }

  const existingUsageRecord =
    existingUsage && typeof existingUsage === "object" && !Array.isArray(existingUsage)
      ? (existingUsage as { id?: unknown; frequency_range?: unknown })
      : null
  const existingUsageId =
    typeof existingUsageRecord?.id === "string" ? existingUsageRecord.id : null
  const existingFrequencyRange =
    typeof existingUsageRecord?.frequency_range === "string"
      ? existingUsageRecord.frequency_range
      : LINK_EXISTING_PRODUCT_FREQUENCY_PLACEHOLDER

  const { error } = await params.admin.rpc("product_intake_replace_usage_with_matched_product", {
    p_user_id: params.userId,
    p_category: category,
    p_existing_usage_id: existingUsageId,
    p_product_id: params.product.id,
    p_product_name: params.product.name ?? params.selectedCandidate.name,
    p_frequency_range: existingFrequencyRange,
    p_brand_text: params.selectedCandidate.brand_name ?? null,
    p_intake_method: "manual",
    p_source: "chat",
    p_updated_at: new Date().toISOString(),
  })

  if (error) {
    console.error("Failed to link existing product from product selection:", error)
    return false
  }

  return true
}

async function loadCurrentAgentV2State(params: {
  admin: ReturnType<typeof createAdminClient>
  conversationId: string
  userId: string
}) {
  const { data, error } = await params.admin
    .from("conversation_states")
    .select("state")
    .eq("conversation_id", params.conversationId)
    .eq("user_id", params.userId)
    .maybeSingle()

  if (error) {
    console.error("Failed to load product selection conversation state:", error)
    return null
  }

  return normalizeAgentV2ConversationState(data?.state)
}

function resolveStoredSelection(params: {
  clarification: ProductLookupClarification
  selectionContext: ProductLookupSelectionContext | null | undefined
  sourceAssistantMessageId: string
}): ReturnType<typeof buildResolvedProductSelection> | null {
  const selectedProductId = params.selectionContext?.selected_product_id
  if (!selectedProductId) return null
  const selectedCandidate = params.clarification.candidates.find(
    (candidate) => candidate.product_id === selectedProductId,
  )
  if (!selectedCandidate) return null

  return buildResolvedProductSelection({
    clarification: params.clarification,
    selectedCandidate,
    selectedProduct: {
      id: selectedProductId,
      name: params.selectionContext?.selected_product_name ?? selectedCandidate.name,
      category_key: selectedCandidate.category,
    },
    sourceAssistantMessageId: params.sourceAssistantMessageId,
  })
}

async function persistResolvedSelectionState(params: {
  admin: ReturnType<typeof createAdminClient>
  persistConversationStateTransition: typeof persistConversationStateTransition
  conversationId: string
  userId: string
  resolvedSelection: ReturnType<typeof buildResolvedProductSelection>
}): Promise<boolean> {
  const previousState = await loadCurrentAgentV2State({
    admin: params.admin,
    conversationId: params.conversationId,
    userId: params.userId,
  })
  if (!previousState) return false
  const trustedContext = buildTrustedSelectedProductContext(params.resolvedSelection)
  const activeContext = buildActiveProductContextFromTrustedSelection(trustedContext)
  if (!activeContext) return false
  const activeProductContexts = mergeActiveProductContexts({
    previous: previousState.agent_v2.active_product_contexts,
    next: [activeContext],
    latestMessageNamesActionableProduct: true,
  })
  const nextState = {
    ...previousState,
    agent_v2: {
      ...previousState.agent_v2,
      active_product_contexts: activeProductContexts,
      active_resolved_product_context: buildPrimaryResolvedProductContext(activeProductContexts),
    },
  }
  const transition: AgentV2ConversationStateTransition = {
    previous_state: previousState,
    next_state: nextState,
    reason: "product_lookup_selection_resolved",
    changed_fields: [
      "agent_v2.active_product_contexts",
      "agent_v2.active_resolved_product_context",
    ],
    classifier_override: null,
    updated_by_engine: AGENT_V2_PRODUCTION_ENGINE,
  }
  const result = await params.persistConversationStateTransition(params.admin, {
    conversationId: params.conversationId,
    userId: params.userId,
    transition,
  })

  return result.status !== "failed"
}

function buildSelectionResolvedTransition(params: {
  transition: unknown
  resolvedSelection: ReturnType<typeof buildResolvedProductSelection>
}): AgentV2ConversationStateTransition {
  const trustedContext = buildTrustedSelectedProductContext(params.resolvedSelection)
  const activeContext = buildActiveProductContextFromTrustedSelection(trustedContext)
  const transition =
    params.transition && typeof params.transition === "object"
      ? (params.transition as Partial<AgentV2ConversationStateTransition>)
      : {}

  const nextState = normalizeAgentV2ConversationState(transition.next_state)
  const activeProductContexts = mergeActiveProductContexts({
    previous: nextState.agent_v2.active_product_contexts,
    next: activeContext ? [activeContext] : [],
    latestMessageNamesActionableProduct: true,
  })
  const changedFields = [
    ...(Array.isArray(transition.changed_fields) ? transition.changed_fields : []),
    "agent_v2.active_product_contexts",
    "agent_v2.active_resolved_product_context",
  ]

  return {
    previous_state: normalizeAgentV2ConversationState(transition.previous_state),
    next_state: {
      ...nextState,
      agent_v2: {
        ...nextState.agent_v2,
        active_product_contexts: activeProductContexts,
        active_resolved_product_context: buildPrimaryResolvedProductContext(activeProductContexts),
      },
    },
    reason:
      typeof transition.reason === "string"
        ? transition.reason
        : "product_lookup_selection_resolved",
    changed_fields: [...new Set(changedFields)],
    classifier_override: null,
    updated_by_engine: AGENT_V2_PRODUCTION_ENGINE,
  }
}

export function createProductSelectionPostHandler(overrides: ProductSelectionRuntimeDeps = {}) {
  const deps = {
    createClient,
    createAdminClient,
    runAgentV2ProductionPipeline,
    buildAssistantDecisionContext,
    buildDoneEventData,
    persistConversationStateTransition,
    productIntakeEnabled: isProductIntakeEnabled,
    randomUUID: () => crypto.randomUUID(),
    ...overrides,
  }

  return async function productSelectionPostHandler(request: Request) {
    const supabase = await deps.createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: ERR_UNAUTHORIZED }, { status: 401 })
    }

    let body: ProductSelectionBody
    try {
      body = (await request.json()) as ProductSelectionBody
    } catch {
      return NextResponse.json({ error: "Produktauswahl ist unvollständig." }, { status: 400 })
    }
    const conversationId = readString(body.conversation_id)
    const sourceAssistantMessageId = readString(body.assistant_message_id)
    const clarificationId = readString(body.clarification_id)
    const selectedProductId = readString(body.selected_product_id)

    if (!conversationId || !sourceAssistantMessageId || !clarificationId || !selectedProductId) {
      return NextResponse.json({ error: "Produktauswahl ist unvollständig." }, { status: 400 })
    }

    const admin = deps.createAdminClient()
    const { data: conversation, error: conversationError } = await admin
      .from("conversations")
      .select("id, user_id")
      .eq("id", conversationId)
      .single()

    if (conversationError || !conversation || conversation.user_id !== user.id) {
      return NextResponse.json({ error: "Unterhaltung nicht gefunden." }, { status: 404 })
    }

    const { data: sourceMessage, error: sourceMessageError } = await admin
      .from("messages")
      .select("id, conversation_id, role, rag_context")
      .eq("id", sourceAssistantMessageId)
      .eq("conversation_id", conversationId)
      .single()

    if (sourceMessageError || !sourceMessage) {
      return NextResponse.json({ error: "Auswahlkarte nicht gefunden." }, { status: 404 })
    }

    if (sourceMessage.role !== "assistant" || sourceMessage.conversation_id !== conversationId) {
      return NextResponse.json(
        { error: "Auswahlkarte passt nicht zur Unterhaltung." },
        { status: 400 },
      )
    }

    const ragContext = sourceMessage.rag_context as MessageRagContext | null
    const clarification = readClarification(ragContext?.product_lookup_clarification)
    if (!clarification || clarification.id !== clarificationId) {
      return NextResponse.json({ error: "Produktauswahl ist nicht mehr gültig." }, { status: 400 })
    }

    const selectedCandidate = clarification.candidates.find(
      (candidate) => candidate.product_id === selectedProductId,
    )
    if (!selectedCandidate) {
      return NextResponse.json(
        { error: "Dieses Produkt gehört nicht zu dieser Auswahl." },
        { status: 400 },
      )
    }

    const { data: selectedProduct, error: productError } = await admin
      .from("products")
      .select(
        "id, name, category, category_key, is_active, lifecycle_status, is_chaarlie_recommended",
      )
      .eq("id", selectedProductId)
      .single()

    const productSelectionAdmin = admin as unknown as ProductSelectionAdminClient
    const productIsVisible =
      !productError &&
      selectedProduct &&
      (await isSelectedProductVisibleToUser({
        admin: productSelectionAdmin,
        userId: user.id,
        product: selectedProduct,
      }))
    const productWasLinked =
      !productIsVisible &&
      !productError &&
      selectedProduct &&
      clarification.kind === "link_existing_product" &&
      isLinkableExistingProduct(selectedProduct) &&
      (await linkExistingProductForUser({
        admin: productSelectionAdmin,
        userId: user.id,
        product: selectedProduct,
        selectedCandidate,
      }))

    if (productError || !selectedProduct || (!productIsVisible && !productWasLinked)) {
      return NextResponse.json(
        { error: "Dieses Produkt ist nicht mehr verfügbar." },
        { status: 400 },
      )
    }

    const resolvedSelection = buildResolvedProductSelection({
      clarification,
      selectedCandidate,
      selectedProduct,
      sourceAssistantMessageId,
    })
    const selectedProductName = getResolvedProductSelectionDisplayName(resolvedSelection)
    const selectionContext = toProductLookupSelectionContext(resolvedSelection)

    const { data: existingMessages } = await admin
      .from("messages")
      .select(
        "id, content, rag_context, product_recommendations, langfuse_trace_id, langfuse_trace_url",
      )
      .eq("conversation_id", conversationId)
      .eq("role", "assistant")
      .order("created_at", { ascending: false })
      .limit(50)

    const existingSelectionMessage = findExistingSelectionMessage(existingMessages, {
      clarificationId,
      sourceAssistantMessageId,
      selectedProductId,
    })
    const conflictingSelectionMessage = existingSelectionMessage
      ? null
      : findExistingSelectionMessage(existingMessages, {
          clarificationId,
          sourceAssistantMessageId,
        })
    if (conflictingSelectionMessage) {
      return streamProductSelectionError(
        "Diese Produktauswahl wurde bereits beantwortet. Bitte starte die Auswahl neu, wenn du ein anderes Produkt meinst.",
      )
    }
    const existingSelection =
      existingSelectionMessage?.rag_context?.product_lookup_selection ?? selectionContext
    if (existingSelectionMessage) {
      const storedResolvedSelection =
        resolveStoredSelection({
          clarification,
          selectionContext: existingSelection,
          sourceAssistantMessageId,
        }) ?? resolvedSelection
      const statePersisted = await persistResolvedSelectionState({
        admin,
        persistConversationStateTransition: deps.persistConversationStateTransition,
        conversationId,
        userId: user.id,
        resolvedSelection: storedResolvedSelection,
      })
      if (!statePersisted) {
        return streamProductSelectionError()
      }

      return streamAssistantContinuation({
        conversationId,
        contentStream: createTextStream(existingSelectionMessage.content ?? ""),
        assistantMessageId: existingSelectionMessage.id ?? null,
        productRecommendations: null,
        productLookupSelection: existingSelection,
        langfuseTraceId: existingSelectionMessage.langfuse_trace_id ?? null,
        langfuseTraceUrl: existingSelectionMessage.langfuse_trace_url ?? null,
        doneData: deps.buildDoneEventData({
          intent: "general_chat",
          retrievalSummary: { final_context_count: 0 },
          routerDecision: {
            confidence: 1,
            retrieval_mode: "agent_v2_responses",
            response_mode: "answer_direct",
            slot_completeness: 1,
            policy_overrides: [],
          },
        }),
      })
    }
    const assistantSelectionMessageId = createStableUuidFromParts(
      getResolvedProductSelectionStableKeyParts({
        conversationId,
        clarificationId,
        sourceAssistantMessageId,
        selectedProductId,
      }),
    )

    const selectionTurnMessage = `Der Nutzer hat in der Produktklärung "${selectedProductName}" ausgewählt. Diese Auswahl ersetzt die zuvor unklare Produktangabe. Beantworte die offene Frage jetzt ausschließlich für "${selectedProductName}". Nutze die ursprüngliche Nachricht nur, um die Frageabsicht zu verstehen, nicht als Produktidentität.`
    const trustedSelectedProductContext = buildTrustedSelectedProductContext(resolvedSelection)

    const pipelineResult = await deps.runAgentV2ProductionPipeline({
      message: selectionTurnMessage,
      conversationId,
      userId: user.id,
      requestId: deps.randomUUID(),
      productIntakeEnabled: deps.productIntakeEnabled(),
      trustedSelectedProductContext,
    })

    const fullContent = await readTextStream(pipelineResult.stream)
    const assistantRagContext = deps.buildAssistantDecisionContext({
      sources: pipelineResult.sources,
      categoryDecision: pipelineResult.categoryDecision,
      engineTrace: pipelineResult.engineTrace ?? null,
      responseMode: pipelineResult.routerDecision.response_mode,
      productLookupSelection: selectionContext,
      productLookupSelectionTrace: buildProductLookupSelectionTrace({
        trustedSelectedProductContext,
        debugTrace: pipelineResult.debugTrace,
      }),
    })
    const productRecommendations = null
    const resolvedSelectionTransition = buildSelectionResolvedTransition({
      transition: pipelineResult.conversationStateTransition,
      resolvedSelection,
    })
    const statePersistenceResult = await deps.persistConversationStateTransition(admin, {
      conversationId,
      userId: user.id,
      transition: resolvedSelectionTransition,
    })
    if (statePersistenceResult.status === "failed") {
      return streamProductSelectionError()
    }

    const { data: assistantMessage, error: assistantMessageError } = await admin
      .from("messages")
      .insert({
        id: assistantSelectionMessageId,
        conversation_id: conversationId,
        role: "assistant",
        content: fullContent,
        rag_context: assistantRagContext,
        product_recommendations: productRecommendations,
      })
      .select("id")
      .single()

    if (isDuplicateKeyError(assistantMessageError)) {
      const { data: duplicateMessage } = await admin
        .from("messages")
        .select(
          "id, content, rag_context, product_recommendations, langfuse_trace_id, langfuse_trace_url",
        )
        .eq("id", assistantSelectionMessageId)
        .single()
      const duplicateSelection =
        duplicateMessage?.rag_context?.product_lookup_selection ?? selectionContext
      const storedResolvedSelection =
        resolveStoredSelection({
          clarification,
          selectionContext: duplicateSelection,
          sourceAssistantMessageId,
        }) ?? resolvedSelection
      const statePersisted = await persistResolvedSelectionState({
        admin,
        persistConversationStateTransition: deps.persistConversationStateTransition,
        conversationId,
        userId: user.id,
        resolvedSelection: storedResolvedSelection,
      })
      if (!statePersisted) {
        return streamProductSelectionError()
      }

      return streamAssistantContinuation({
        conversationId,
        contentStream: createTextStream(duplicateMessage?.content ?? ""),
        assistantMessageId: duplicateMessage?.id ?? assistantSelectionMessageId,
        productRecommendations: null,
        productLookupSelection: duplicateSelection,
        langfuseTraceId: duplicateMessage?.langfuse_trace_id ?? null,
        langfuseTraceUrl: duplicateMessage?.langfuse_trace_url ?? null,
        doneData: deps.buildDoneEventData({
          intent: "general_chat",
          retrievalSummary: { final_context_count: 0 },
          routerDecision: {
            confidence: 1,
            retrieval_mode: "agent_v2_responses",
            response_mode: "answer_direct",
            slot_completeness: 1,
            policy_overrides: [],
          },
        }),
      })
    }
    if (assistantMessageError || !assistantMessage?.id) {
      console.error(
        `Failed to persist product selection assistant message: ${
          assistantMessageError?.message ?? "missing assistant message id"
        }`,
      )
      return streamProductSelectionError()
    }

    await admin
      .from("conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversationId)

    return streamAssistantContinuation({
      conversationId,
      contentStream: createTextStream(fullContent),
      assistantMessageId: assistantMessage.id,
      productRecommendations,
      productLookupSelection: selectionContext,
      doneData: deps.buildDoneEventData({
        intent: pipelineResult.intent,
        retrievalSummary: pipelineResult.retrievalSummary,
        routerDecision: pipelineResult.routerDecision,
        categoryDecision: pipelineResult.categoryDecision,
      }),
    })
  }
}

export const POST = createProductSelectionPostHandler()
