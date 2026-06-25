import { NextResponse } from "next/server"
import { createHash } from "crypto"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { isProductIntakeEnabled } from "@/lib/product-intake/config"
import { isProductEligibleForMode } from "@/lib/product-catalog/eligibility"
import { runAgentV2ProductionPipeline } from "@/lib/agent-v2/production/chat-pipeline"
import { buildAssistantDecisionContext, buildDoneEventData } from "@/lib/chat-runtime/stream-events"
import { persistConversationStateTransition } from "@/lib/chat-runtime/conversation-state-store"
import { ERR_UNAUTHORIZED } from "@/lib/vocabulary"
import type {
  MessageRagContext,
  ProductLookupClarification,
  ProductLookupSelectionContext,
} from "@/lib/types"

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

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null
}

function readClarification(value: unknown): ProductLookupClarification | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const candidate = value as ProductLookupClarification
  if (!candidate.id || !Array.isArray(candidate.candidates)) return null
  return candidate
}

function findExistingSelectionMessage(
  rows: unknown,
  selection: ProductLookupSelectionContext,
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
      return (
        existing?.source === "product_lookup_clarification" &&
        existing.clarification_id === selection.clarification_id &&
        existing.source_assistant_message_id === selection.source_assistant_message_id
      )
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

    if (
      productError ||
      !selectedProduct ||
      !isProductEligibleForMode(selectedProduct, "intake_dedupe")
    ) {
      return NextResponse.json(
        { error: "Dieses Produkt ist nicht mehr verfügbar." },
        { status: 400 },
      )
    }

    const selectedProductName =
      typeof selectedProduct.name === "string" && selectedProduct.name.trim()
        ? selectedProduct.name
        : selectedCandidate.name
    const selectedProductCategory =
      readString(selectedProduct.category_key) ??
      readString(selectedProduct.category) ??
      readString(selectedCandidate.category)
    const selectionContext: ProductLookupSelectionContext = {
      source: "product_lookup_clarification",
      clarification_id: clarificationId,
      source_assistant_message_id: sourceAssistantMessageId,
      selected_product_id: selectedProductId,
      selected_product_name: selectedProductName,
    }

    const { data: existingMessages } = await admin
      .from("messages")
      .select(
        "id, content, rag_context, product_recommendations, langfuse_trace_id, langfuse_trace_url",
      )
      .eq("conversation_id", conversationId)
      .eq("role", "assistant")
      .order("created_at", { ascending: false })
      .limit(50)

    const existingSelectionMessage = findExistingSelectionMessage(
      existingMessages,
      selectionContext,
    )
    const existingSelection =
      existingSelectionMessage?.rag_context?.product_lookup_selection ?? selectionContext
    if (existingSelectionMessage) {
      return streamAssistantContinuation({
        conversationId,
        contentStream: createTextStream(existingSelectionMessage.content ?? ""),
        assistantMessageId: existingSelectionMessage.id ?? null,
        productRecommendations: existingSelectionMessage.product_recommendations ?? null,
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
    const assistantSelectionMessageId = createStableUuidFromParts([
      "product_lookup_selection",
      conversationId,
      sourceAssistantMessageId,
      clarificationId,
    ])

    const originalUserMessage =
      clarification.original_user_message?.trim() ||
      `Ich meine ${selectedProductName}. Kannst du dieses Produkt bewerten?`
    const selectionTurnMessage = `Der Nutzer hat in der Produktklärung "${selectedProductName}" ausgewählt. Diese Auswahl ersetzt die zuvor unklare Produktangabe. Beantworte die offene Frage jetzt ausschließlich für "${selectedProductName}". Nutze die ursprüngliche Nachricht nur, um die Frageabsicht zu verstehen, nicht als Produktidentität.`

    const pipelineResult = await deps.runAgentV2ProductionPipeline({
      message: selectionTurnMessage,
      conversationId,
      userId: user.id,
      requestId: deps.randomUUID(),
      productIntakeEnabled: deps.productIntakeEnabled(),
      trustedSelectedProductContext: {
        source: "product_lookup_clarification",
        original_user_message: originalUserMessage,
        selected_product: {
          id: selectedProductId,
          name: selectedProductName,
          category: selectedProductCategory,
        },
        lookup_identity: {
          category: selectedProductCategory,
          brand_text: clarification.query.brand_text,
          product_name_text: clarification.query.product_name_text,
          evidence_quote:
            clarification.query.brand_text || clarification.query.product_name_text
              ? [clarification.query.brand_text, clarification.query.product_name_text]
                  .filter(Boolean)
                  .join(" ")
              : selectedProductName,
        },
      },
    })

    const fullContent = await readTextStream(pipelineResult.stream)
    const assistantRagContext = deps.buildAssistantDecisionContext({
      sources: pipelineResult.sources,
      categoryDecision: pipelineResult.categoryDecision,
      engineTrace: pipelineResult.engineTrace ?? null,
      responseMode: pipelineResult.routerDecision.response_mode,
      productLookupSelection: selectionContext,
    })
    const productRecommendations =
      pipelineResult.matchedProducts.length > 0 ? pipelineResult.matchedProducts : null
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

      return streamAssistantContinuation({
        conversationId,
        contentStream: createTextStream(duplicateMessage?.content ?? ""),
        assistantMessageId: duplicateMessage?.id ?? assistantSelectionMessageId,
        productRecommendations: duplicateMessage?.product_recommendations ?? null,
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

    await deps.persistConversationStateTransition(admin, {
      conversationId,
      userId: user.id,
      transition: pipelineResult.conversationStateTransition,
    })

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
