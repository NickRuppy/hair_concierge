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
import type { ConversationStatePersistenceTrace } from "@/lib/types"
import type { PipelineTraceDraft } from "@/lib/rag/debug-trace"

export const maxDuration = 60

async function defaultPersistConversationTurnTrace(params: {
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

async function loadChatRuntimeDeps() {
  const [
    { createAdminClient },
    { runAgentV2ProductionPipeline },
    { buildAssistantDecisionContext, buildAssistantRagContext, buildDoneEventData },
    { extractConversationMemory },
    {
      buildRetrievalDebugEventData,
      finalizeChatTurnTrace,
      summarizeEngineTraceForLangfuse,
      summarizeProductsForLangfuse,
    },
    { summarizeAgentV2TraceForLangfuse },
    { persistConversationStateTransition },
    { chatMessageSchema },
    { generateConversationTitle },
  ] = await Promise.all([
    import("@/lib/supabase/admin"),
    import("@/lib/agent-v2/production/chat-pipeline"),
    import("@/lib/rag/chat-response"),
    import("@/lib/rag/memory-extractor"),
    import("@/lib/rag/debug-trace"),
    import("@/lib/agent-v2/production/langfuse-observability"),
    import("@/lib/rag/conversation-state-store"),
    import("@/lib/validators"),
    import("@/lib/rag/title-generator"),
  ])

  return {
    createAdminClient,
    runAgentV2ProductionPipeline,
    buildAssistantDecisionContext,
    buildAssistantRagContext,
    buildDoneEventData,
    extractConversationMemory,
    buildRetrievalDebugEventData,
    finalizeChatTurnTrace,
    summarizeEngineTraceForLangfuse,
    summarizeProductsForLangfuse,
    summarizeAgentV2TraceForLangfuse,
    persistConversationStateTransition,
    chatMessageSchema,
    generateConversationTitle,
  }
}

type ChatRuntimeDeps = Awaited<ReturnType<typeof loadChatRuntimeDeps>>

function scrubVisibleFailureTraceDraft(trace: PipelineTraceDraft): PipelineTraceDraft {
  return {
    ...trace,
    product_category: null,
    classification: {
      ...trace.classification,
      product_category: null,
    },
    router_decision: {
      ...trace.router_decision,
      policy_overrides: trace.router_decision.policy_overrides.filter(
        (override) =>
          !override.startsWith("product_policy:") &&
          !/^missing_(?:shampoo|conditioner|leave_in|mask|oil)_profile$/.test(override),
      ),
    },
    decision_context: {
      ...trace.decision_context,
      category_decision: null,
      engine_trace: null,
      matched_products: [],
    },
    response_composition: {
      ...trace.response_composition,
      attachment_mode: "text_only",
    },
  }
}

export interface ChatPostHandlerDeps {
  createClient?: typeof createClient
  checkRateLimit?: typeof checkRateLimit
  chatRateLimit?: typeof CHAT_RATE_LIMIT
  ensureLangfuseTracing?: typeof ensureLangfuseTracing
  flushLangfuseClient?: typeof flushLangfuseClient
  getLangfuseClient?: typeof getLangfuseClient
  getLangfuseRelease?: typeof getLangfuseRelease
  resolveLangfuseTraceId?: typeof resolveLangfuseTraceId
  startObservation?: typeof startObservation
  propagateAttributes?: typeof propagateAttributes
  otelContext?: typeof otelContext
  otelTrace?: typeof otelTrace
  loadRuntimeDeps?: () => Promise<ChatRuntimeDeps>
  persistConversationTurnTrace?: typeof defaultPersistConversationTurnTrace
  randomUUID?: () => string
  now?: () => number
}

export function createChatPostHandler(overrides: ChatPostHandlerDeps = {}) {
  const deps = {
    createClient,
    checkRateLimit,
    chatRateLimit: CHAT_RATE_LIMIT,
    ensureLangfuseTracing,
    flushLangfuseClient,
    getLangfuseClient,
    getLangfuseRelease,
    resolveLangfuseTraceId,
    startObservation,
    propagateAttributes,
    otelContext,
    otelTrace,
    loadRuntimeDeps: loadChatRuntimeDeps,
    persistConversationTurnTrace: defaultPersistConversationTurnTrace,
    randomUUID: () => crypto.randomUUID(),
    now: () => performance.now(),
    ...overrides,
  }

  return async function chatPostHandler(request: Request) {
    const supabase = await deps.createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: ERR_UNAUTHORIZED }, { status: 401 })
    }

    const rateCheck = await deps.checkRateLimit(user.id, deps.chatRateLimit)
    if (!rateCheck.allowed) {
      const status = rateCheck.error === "service_unavailable" ? 503 : 429
      return NextResponse.json(
        { error: "Zu viele Nachrichten. Bitte warte einen Moment." },
        { status },
      )
    }

    const {
      createAdminClient,
      runAgentV2ProductionPipeline,
      buildAssistantDecisionContext,
      buildAssistantRagContext,
      buildDoneEventData,
      extractConversationMemory,
      buildRetrievalDebugEventData,
      finalizeChatTurnTrace,
      summarizeEngineTraceForLangfuse,
      summarizeProductsForLangfuse,
      summarizeAgentV2TraceForLangfuse,
      persistConversationStateTransition,
      chatMessageSchema,
      generateConversationTitle,
    } = await deps.loadRuntimeDeps()

    const body = await request.json()
    const parsed = chatMessageSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Ungültige Nachricht", details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const { message, conversation_id } = parsed.data
    const requestId = deps.randomUUID()
    const requestStart = deps.now()
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

      if (!shouldGenerateConversationTitle) {
        const { data: existingConversation, error: ownershipError } = await admin
          .from("conversations")
          .select("id")
          .eq("id", activeConversationId)
          .eq("user_id", user.id)
          .single()

        if (ownershipError || !existingConversation) {
          return NextResponse.json({ error: "Unterhaltung nicht gefunden" }, { status: 404 })
        }
      }

      deps.ensureLangfuseTracing()

      chatObservation = deps.startObservation(
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
      const parentContext = deps.otelTrace.setSpan(
        deps.otelContext.active(),
        activeChatObservation.otelSpan,
      )
      const langfuseTraceId = deps.resolveLangfuseTraceId(activeChatObservation)
      const traceUrlPromise = langfuseTraceId
        ? (deps
            .getLangfuseClient()
            ?.getTraceUrl(langfuseTraceId)
            .catch(() => null) ?? null)
        : null

      if (!langfuseTraceId && deps.getLangfuseClient()) {
        console.warn("Langfuse trace id unavailable for chat turn", {
          requestId,
          conversationId: activeConversationId,
        })
      }

      if (shouldGenerateConversationTitle) {
        deps.otelContext.with(parentContext, () => {
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
        conversationStateTransition,
        categoryDecision,
        engineTrace,
        debugTrace,
        visibleFailure,
      } = await deps.otelContext.with(parentContext, async () =>
        deps.propagateAttributes(
          {
            userId: user.id,
            sessionId: activeConversationId,
            version: deps.getLangfuseRelease(),
            traceName: "production-chat-turn",
            tags: ["production-chat"],
            metadata: {
              conversation_id: activeConversationId,
              request_id: requestId,
              route: "/api/chat",
            },
          },
          async () =>
            runAgentV2ProductionPipeline({
              message,
              conversationId: activeConversationId,
              userId: user.id,
              requestId,
            }),
        ),
      )
      const isVisibleFailure = visibleFailure === true
      const routeDebugTrace = isVisibleFailure
        ? scrubVisibleFailureTraceDraft(debugTrace)
        : debugTrace
      const routeRouterDecision = isVisibleFailure
        ? routeDebugTrace.router_decision
        : routerDecision
      const routeCategoryDecision = isVisibleFailure ? undefined : categoryDecision
      const routeEngineTrace = isVisibleFailure ? null : engineTrace

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
                data: buildRetrievalDebugEventData(routeDebugTrace),
              })}\n\n`,
            ),
          )

          const reader = stream.getReader()
          let fullContent = ""
          const streamReadStart = deps.now()

          try {
            await deps.otelContext.with(parentContext, async () => {
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
                !isVisibleFailure &&
                routerDecision.response_mode !== "clarify_only" &&
                matchedProducts.length > 0
                  ? matchedProducts.slice(0, 3)
                  : []
              const langfuseTraceUrl = traceUrlPromise ? await traceUrlPromise : null
              const buildAssistantContext =
                buildAssistantDecisionContext ?? buildAssistantRagContext

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
                  rag_context: buildAssistantContext(
                    sources,
                    routeCategoryDecision,
                    routeEngineTrace,
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

              let conversationStatePersistence: ConversationStatePersistenceTrace = {
                status: "skipped",
                error: isVisibleFailure
                  ? "visible_failure_no_state_mutation"
                  : assistantMessageError
                    ? "assistant_message_not_persisted"
                    : "assistant_message_id_missing",
              }

              if (isVisibleFailure) {
                conversationStatePersistence = {
                  status: "skipped",
                  error: "visible_failure_no_state_mutation",
                }
              } else if (!assistantMessageError && assistantMessageRow?.id) {
                try {
                  conversationStatePersistence = await persistConversationStateTransition(admin, {
                    conversationId: activeConversationId,
                    userId: user.id,
                    transition: conversationStateTransition,
                  })
                } catch (error) {
                  console.error("Failed to persist conversation state:", error)
                  conversationStatePersistence = {
                    status: "failed",
                    error:
                      error instanceof Error
                        ? error.message
                        : "Unknown conversation state persistence error",
                  }
                }
              } else {
                console.error(
                  "Skipped conversation state persistence because assistant message was not saved.",
                )
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

              if (!isVisibleFailure) {
                extractConversationMemory(activeConversationId, user.id, {
                  requestId,
                }).catch(() => {})
              }

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

              const completedTrace = finalizeChatTurnTrace(routeDebugTrace, {
                assistant_content: fullContent,
                sources,
                product_count: productsToSend.length,
                status: isVisibleFailure ? "failed" : "completed",
                stream_read_ms: Math.round(deps.now() - streamReadStart),
                total_ms: Math.round(deps.now() - requestStart),
                conversation_state_persistence: conversationStatePersistence,
              })
              const toolLoopSummary = completedTrace.agentic_tool_loop
                ? {
                    model_step_count: completedTrace.agentic_tool_loop.model_steps.length,
                    tool_call_count: completedTrace.agentic_tool_loop.tool_calls.length,
                    repair_count: completedTrace.agentic_tool_loop.repair_attempts.length,
                    visible_failure: completedTrace.agentic_tool_loop.visible_failure,
                    failure_stage: completedTrace.agentic_tool_loop.failure_stage,
                    loaded_guidance_ids: completedTrace.agentic_tool_loop.loaded_guidance_ids,
                  }
                : null
              const agentV2Summary = completedTrace.agent_v2_trace
                ? summarizeAgentV2TraceForLangfuse(completedTrace.agent_v2_trace)
                : null

              deps
                .persistConversationTurnTrace({
                  conversation_id: activeConversationId,
                  user_id: user.id,
                  user_message_id: userMessageRow?.id ?? null,
                  assistant_message_id: assistantMessageRow?.id ?? null,
                  langfuse_trace_id: langfuseTraceId,
                  langfuse_trace_url: langfuseTraceUrl,
                  status: isVisibleFailure ? "failed" : "completed",
                  trace: completedTrace,
                })
                .catch(() => {})

              activeChatObservation.update({
                output: {
                  status: isVisibleFailure ? "failed" : "completed",
                  product_count: productsToSend.length,
                  assistant_preview: sanitizeLangfuseText(fullContent)?.slice(0, 500),
                  response_composition: completedTrace.response_composition,
                  engine_summary: summarizeEngineTraceForLangfuse(
                    completedTrace.decision_context.engine_trace,
                  ),
                  selected_products: summarizeProductsForLangfuse(
                    completedTrace.decision_context.matched_products,
                  ),
                  agent_v2_summary: agentV2Summary,
                  ...(toolLoopSummary ? { agentic_tool_loop_summary: toolLoopSummary } : {}),
                },
              })

              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: "done",
                    data: buildDoneEventData({
                      intent,
                      retrievalSummary,
                      routerDecision: routeRouterDecision,
                      categoryDecision: routeCategoryDecision,
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
            const errorMessage =
              error instanceof Error ? error.message : "Unbekannter Stream-Fehler"
            const failedTrace = finalizeChatTurnTrace(routeDebugTrace, {
              assistant_content: fullContent,
              sources,
              product_count: 0,
              status: "failed",
              error: errorMessage,
              stream_read_ms: Math.round(deps.now() - streamReadStart),
              total_ms: Math.round(deps.now() - requestStart),
            })
            const failedToolLoopSummary = failedTrace.agentic_tool_loop
              ? {
                  model_step_count: failedTrace.agentic_tool_loop.model_steps.length,
                  tool_call_count: failedTrace.agentic_tool_loop.tool_calls.length,
                  repair_count: failedTrace.agentic_tool_loop.repair_attempts.length,
                  visible_failure: failedTrace.agentic_tool_loop.visible_failure,
                  failure_stage: failedTrace.agentic_tool_loop.failure_stage,
                  loaded_guidance_ids: failedTrace.agentic_tool_loop.loaded_guidance_ids,
                }
              : null
            const failedAgentV2Summary = failedTrace.agent_v2_trace
              ? summarizeAgentV2TraceForLangfuse(failedTrace.agent_v2_trace)
              : null

            deps
              .persistConversationTurnTrace({
                conversation_id: activeConversationId,
                user_id: user.id,
                user_message_id: userMessageRow?.id ?? null,
                assistant_message_id: null,
                langfuse_trace_id: langfuseTraceId,
                langfuse_trace_url: langfuseTraceUrl,
                status: "failed",
                trace: failedTrace,
              })
              .catch(() => {})

            activeChatObservation.update({
              output: {
                status: "failed",
                assistant_preview: sanitizeLangfuseText(fullContent)?.slice(0, 500),
                response_composition: failedTrace.response_composition,
                engine_summary: summarizeEngineTraceForLangfuse(
                  failedTrace.decision_context.engine_trace,
                ),
                selected_products: summarizeProductsForLangfuse(
                  failedTrace.decision_context.matched_products,
                ),
                agent_v2_summary: failedAgentV2Summary,
                ...(failedToolLoopSummary
                  ? { agentic_tool_loop_summary: failedToolLoopSummary }
                  : {}),
              },
              metadata: {
                error: errorMessage,
              },
            })
          }

          activeChatObservation.end()
          deps.flushLangfuseClient().catch(() => {})
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
        deps.flushLangfuseClient().catch(() => {})
      }
      return NextResponse.json({ error: fehler("Verarbeitung") }, { status: 500 })
    }
  }
}

export const POST = createChatPostHandler()

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
