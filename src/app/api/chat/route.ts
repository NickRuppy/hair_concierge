import { createClient } from "@/lib/supabase/server"
import { checkRateLimit, CHAT_RATE_LIMIT } from "@/lib/rate-limit"
import { propagateAttributes, startObservation } from "@langfuse/tracing"
import { context as otelContext, trace as otelTrace } from "@opentelemetry/api"
import {
  ensureLangfuseTracing,
  flushLangfuseClient,
  getLangfuseClient,
  getLangfuseRelease,
  resolveLangfuseTraceId,
} from "@/lib/openai/client"
import { sanitizeLangfuseText } from "@/lib/langfuse/masking"
import { ERR_UNAUTHORIZED, fehler } from "@/lib/vocabulary"
import { NextResponse } from "next/server"

export const maxDuration = 60

async function persistConversationTurnTrace(params: {
  conversation_id: string | null
  user_id: string
  user_message_id: string | null
  assistant_message_id: string | null
  langfuse_trace_id: string | null
  langfuse_trace_url: string | null
  status: "completed" | "failed"
  trace: unknown
}) {
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin")
    const admin = createAdminClient()
    const { error } = await admin.from("conversation_turn_traces").insert(params)
    if (error) {
      console.error("Failed to persist conversation turn trace:", error)
    }
  } catch (error) {
    console.error("Failed to persist conversation turn trace:", error)
  }
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: ERR_UNAUTHORIZED }, { status: 401 })
  }

  const rateCheck = await checkRateLimit(user.id, CHAT_RATE_LIMIT)
  if (!rateCheck.allowed) {
    const status = rateCheck.error === "service_unavailable" ? 503 : 429
    return NextResponse.json(
      { error: "Zu viele Nachrichten. Bitte warte einen Moment." },
      { status },
    )
  }

  const [
    { createAdminClient },
    { runPipeline },
    { buildAssistantRagContext, buildDoneEventData },
    { extractConversationMemory },
    { buildRetrievalDebugEventData, finalizeChatTurnTrace },
    { chatMessageSchema },
    { generateConversationTitle },
  ] = await Promise.all([
    import("@/lib/supabase/admin"),
    import("@/lib/rag/pipeline"),
    import("@/lib/rag/chat-response"),
    import("@/lib/rag/memory-extractor"),
    import("@/lib/rag/debug-trace"),
    import("@/lib/validators"),
    import("@/lib/rag/title-generator"),
  ])

  const body = await request.json()
  const parsed = chatMessageSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ungültige Nachricht", details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const { message, conversation_id } = parsed.data
  const requestId = crypto.randomUUID()
  const requestStart = performance.now()
  let chatObservation: ReturnType<typeof startObservation> | null = null

  try {
    const admin = createAdminClient()
    let conversationId = conversation_id ?? null
    let shouldGenerateConversationTitle = false

    if (!conversationId) {
      const { data: createdConversation, error: conversationError } = await admin
        .from("conversations")
        .insert({
          user_id: user.id,
          title: null,
          is_active: true,
        })
        .select("id")
        .single()

      if (conversationError || !createdConversation) {
        throw new Error(`Failed to create conversation: ${conversationError?.message}`)
      }

      conversationId = createdConversation.id
      shouldGenerateConversationTitle = true
    }
    const activeConversationId = conversationId
    if (!activeConversationId) {
      throw new Error("Conversation id missing after creation")
    }

    ensureLangfuseTracing()

    chatObservation = startObservation(
      "production-chat-turn",
      {
        input: {
          user_message: sanitizeLangfuseText(message),
          conversation_id: activeConversationId,
        },
        metadata: {
          feature: "production_chat",
          request_id: requestId,
        },
      },
      { asType: "chain" },
    )
    const activeChatObservation = chatObservation
    const parentContext = otelTrace.setSpan(otelContext.active(), activeChatObservation.otelSpan)
    const langfuseTraceId = resolveLangfuseTraceId(activeChatObservation)
    const traceUrlPromise = langfuseTraceId
      ? (getLangfuseClient()
          ?.getTraceUrl(langfuseTraceId)
          .catch(() => null) ?? null)
      : null

    if (!langfuseTraceId && getLangfuseClient()) {
      console.warn("Langfuse trace id unavailable for chat turn", {
        requestId,
        conversationId: activeConversationId,
      })
    }

    if (shouldGenerateConversationTitle) {
      otelContext.with(parentContext, () => {
        generateConversationTitle(activeConversationId, message, {
          userId: user.id,
          requestId,
        }).catch(() => {})
      })
    }

    const {
      stream,
      intent,
      matchedProducts,
      sources,
      retrievalSummary,
      routerDecision,
      categoryDecision,
      engineTrace,
      debugTrace,
    } = await otelContext.with(parentContext, async () =>
      propagateAttributes(
        {
          userId: user.id,
          sessionId: activeConversationId,
          version: getLangfuseRelease(),
          traceName: "production-chat-turn",
          tags: ["production-chat"],
          metadata: {
            conversation_id: activeConversationId,
            request_id: requestId,
            route: "/api/chat",
          },
        },
        async () =>
          runPipeline({
            message,
            conversationId: activeConversationId,
            userId: user.id,
            requestId,
          }),
      ),
    )

    // Save user message
    const { data: userMessageRow, error: userMessageError } = await admin
      .from("messages")
      .insert({
        conversation_id: activeConversationId,
        role: "user",
        content: message,
        langfuse_trace_id: langfuseTraceId,
      })
      .select("id")
      .single()

    if (userMessageError) {
      console.error("Failed to save user message:", userMessageError)
    }

    // Create SSE response
    const encoder = new TextEncoder()
    const sseStream = new ReadableStream({
      async start(controller) {
        // Send conversation ID first
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "conversation_id", data: activeConversationId })}\n\n`,
          ),
        )

        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: "langfuse_trace",
              data: { trace_id: langfuseTraceId },
            })}\n\n`,
          ),
        )

        // Send router confidence event
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: "confidence",
              data: {
                confidence: routerDecision.confidence,
                retrieval_mode: routerDecision.retrieval_mode,
              },
            })}\n\n`,
          ),
        )

        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: "retrieval_debug",
              data: buildRetrievalDebugEventData(debugTrace),
            })}\n\n`,
          ),
        )

        const reader = stream.getReader()
        let fullContent = ""
        const streamReadStart = performance.now()

        try {
          await otelContext.with(parentContext, async () => {
            while (true) {
              const { done, value } = await reader.read()
              if (done) break

              const text = new TextDecoder().decode(value)
              fullContent += text

              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: "content_delta", data: text })}\n\n`,
                ),
              )
            }

            const productsToSend =
              routerDecision.response_mode !== "clarify_only" && matchedProducts.length > 0
                ? matchedProducts.slice(0, 3)
                : []
            const langfuseTraceUrl = traceUrlPromise ? await traceUrlPromise : null

            if (productsToSend.length > 0) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: "product_recommendations", data: productsToSend })}\n\n`,
                ),
              )
            }

            if (sources.length > 0) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: "sources", data: sources })}\n\n`),
              )
            }

            const { data: assistantMessageRow, error: assistantMessageError } = await admin
              .from("messages")
              .insert({
                conversation_id: activeConversationId,
                role: "assistant",
                content: fullContent,
                rag_context: buildAssistantRagContext(
                  sources,
                  categoryDecision,
                  engineTrace,
                  routerDecision.response_mode,
                ),
                product_recommendations: productsToSend.length > 0 ? productsToSend : null,
                langfuse_trace_id: langfuseTraceId,
                langfuse_trace_url: langfuseTraceUrl,
              })
              .select("id")
              .single()

            if (assistantMessageError) {
              console.error("Failed to save assistant message:", assistantMessageError)
            }

            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "assistant_message",
                  data: {
                    id: assistantMessageRow?.id ?? null,
                    langfuse_trace_id: langfuseTraceId,
                    langfuse_trace_url: langfuseTraceUrl,
                  },
                })}\n\n`,
              ),
            )

            await admin
              .from("conversations")
              .update({
                updated_at: new Date().toISOString(),
              })
              .eq("id", activeConversationId)

            extractConversationMemory(activeConversationId, user.id, {
              requestId,
            }).catch(() => {})

            await admin
              .from("profiles")
              .update({
                message_count_this_month:
                  (await admin
                    .from("profiles")
                    .select("message_count_this_month")
                    .eq("id", user.id)
                    .single()
                    .then((r) => r.data?.message_count_this_month || 0)) + 1,
              })
              .eq("id", user.id)

            const completedTrace = finalizeChatTurnTrace(debugTrace, {
              assistant_content: fullContent,
              sources,
              product_count: productsToSend.length,
              status: "completed",
              stream_read_ms: Math.round(performance.now() - streamReadStart),
              total_ms: Math.round(performance.now() - requestStart),
            })

            persistConversationTurnTrace({
              conversation_id: activeConversationId,
              user_id: user.id,
              user_message_id: userMessageRow?.id ?? null,
              assistant_message_id: assistantMessageRow?.id ?? null,
              langfuse_trace_id: langfuseTraceId,
              langfuse_trace_url: langfuseTraceUrl,
              status: "completed",
              trace: completedTrace,
            }).catch(() => {})

            activeChatObservation.update({
              output: {
                status: "completed",
                product_count: productsToSend.length,
                assistant_preview: sanitizeLangfuseText(fullContent)?.slice(0, 500),
              },
            })

            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "done",
                  data: buildDoneEventData({
                    intent,
                    retrievalSummary,
                    routerDecision,
                    categoryDecision,
                  }),
                })}\n\n`,
              ),
            )
          })
        } catch (error) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "error", data: { message: "Stream-Fehler aufgetreten" } })}\n\n`,
            ),
          )

          const langfuseTraceUrl = traceUrlPromise ? await traceUrlPromise : null
          const errorMessage = error instanceof Error ? error.message : "Unbekannter Stream-Fehler"
          const failedTrace = finalizeChatTurnTrace(debugTrace, {
            assistant_content: fullContent,
            sources,
            product_count: 0,
            status: "failed",
            error: errorMessage,
            stream_read_ms: Math.round(performance.now() - streamReadStart),
            total_ms: Math.round(performance.now() - requestStart),
          })

          persistConversationTurnTrace({
            conversation_id: activeConversationId,
            user_id: user.id,
            user_message_id: userMessageRow?.id ?? null,
            assistant_message_id: null,
            langfuse_trace_id: langfuseTraceId,
            langfuse_trace_url: langfuseTraceUrl,
            status: "failed",
            trace: failedTrace,
          }).catch(() => {})

          activeChatObservation.update({
            output: {
              status: "failed",
              assistant_preview: sanitizeLangfuseText(fullContent)?.slice(0, 500),
            },
            metadata: {
              error: errorMessage,
            },
          })
        }

        activeChatObservation.end()
        flushLangfuseClient().catch(() => {})
        controller.close()
      },
    })

    return new Response(sseStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    })
  } catch (error) {
    console.error("Chat pipeline error:", error)
    if (chatObservation) {
      chatObservation.update({
        output: {
          status: "failed",
        },
        metadata: {
          error: error instanceof Error ? error.message : "chat_pipeline_error",
        },
      })
      chatObservation.end()
    }
    return NextResponse.json({ error: fehler("Verarbeitung") }, { status: 500 })
  }
}

// List conversations
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: ERR_UNAUTHORIZED }, { status: 401 })
  }

  const { data: conversations, error } = await supabase
    .from("conversations")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(20)

  if (error) {
    return NextResponse.json({ error: fehler("Laden") }, { status: 500 })
  }

  return NextResponse.json({ conversations })
}
