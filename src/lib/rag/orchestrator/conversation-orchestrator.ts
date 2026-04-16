import { createAdminClient } from "@/lib/supabase/admin"
import { startObservation } from "@langfuse/tracing"
import { context as otelContext, trace as otelTrace } from "@opentelemetry/api"
import { classifyIntent } from "@/lib/rag/intent-classifier"
import { evaluateRoute } from "@/lib/rag/router"
import { emitRouterEvent } from "@/lib/rag/retrieval-telemetry"
import { generateConversationTitle } from "@/lib/rag/title-generator"
import { PRODUCT_INTENTS } from "@/lib/rag/retrieval-constants"
import { buildPipelineTraceDraft } from "@/lib/rag/debug-trace"
import {
  buildRoutineClarificationQuestions,
  buildRoutinePlan,
  buildRoutineRetrievalSubqueries,
  deriveRoutineContext,
} from "@/lib/routines/planner"
import { attachProductsToRoutinePlan } from "@/lib/routines/product-attachments"
import { hydrateHairProfileForConsumers } from "@/lib/hair-profile/derived"
import { loadUserMemoryContext } from "@/lib/rag/user-memory"
import {
  buildEngineClarificationQuestions,
  buildEngineRetrievalFilter,
  buildRecommendationEngineRuntimeForChat,
  buildRecommendationEngineTrace,
  getRuntimeCategoryDecision,
  getShampooConcernForRetrieval,
  loadRoutineItemsForEngine,
  summarizeEngineCategoryDecision,
} from "@/lib/recommendation-engine"
import { retrieve, buildSources } from "@/lib/rag/retrieval/retrieval-service"
import { composeResponse } from "@/lib/rag/response/response-composer"
import { selectProducts } from "@/lib/rag/selection/product-selection-service"
import type { PipelineParams, PipelineResult } from "@/lib/rag/contracts"
import type { Message, HairProfile, RoutinePlan, Product } from "@/lib/types"

// ── Helpers ──────────────────────────────────────────────────────────────────

async function measureAsync<T>(work: () => Promise<T>): Promise<{ result: T; durationMs: number }> {
  const start = performance.now()
  const result = await work()
  return {
    result,
    durationMs: Math.round(performance.now() - start),
  }
}

async function observeAsyncStage<T>(
  name: string,
  input: unknown,
  work: () => Promise<T>,
  options?: {
    asType?: "span" | "chain" | "retriever"
    output?: (result: T) => unknown
    metadata?: Record<string, unknown>
  },
): Promise<T> {
  const attributes = {
    input,
    metadata: options?.metadata,
  }
  const observation =
    options?.asType === "chain"
      ? startObservation(name, attributes, { asType: "chain" })
      : options?.asType === "retriever"
        ? startObservation(name, attributes, { asType: "retriever" })
        : startObservation(name, attributes)

  try {
    const observationContext = otelTrace.setSpan(otelContext.active(), observation.otelSpan)
    const result = await otelContext.with(observationContext, work)

    if (options?.output) {
      observation.update({
        output: options.output(result),
      })
    }

    return result
  } catch (error) {
    observation.update({
      output: {
        failed: true,
      },
      metadata: {
        ...(options?.metadata ?? {}),
        error: error instanceof Error ? error.message : "unknown_stage_error",
      },
    })
    throw error
  } finally {
    observation.end()
  }
}

// ── Main orchestrator ────────────────────────────────────────────────────────

/**
 * Orchestrates the full RAG pipeline for a single user turn.
 *
 * This is a drop-in replacement for `runPipeline()` in pipeline.ts,
 * delegating to the extracted boundary modules:
 *  - recommendation-engine runtime + chat helpers (decisions, clarification, retrieval filters)
 *  - retrieval-service (context retrieval, source building)
 *  - response-composer (synthesis)
 *  - product-selection-service (product matching)
 */
export async function orchestrateTurn(params: PipelineParams): Promise<PipelineResult> {
  const { message, userId, requestId } = params
  let { conversationId } = params
  const startedAt = new Date().toISOString()

  const supabase = createAdminClient()

  // ── Step 1: Load conversation history + hair profile + memory ─────
  const {
    conversationData,
    hairProfileResult,
    routineItems,
    memoryContext,
    historyLoadMs,
    hairProfileLoadMs,
    routineItemsLoadMs,
    memoryLoadMs,
  } = await observeAsyncStage(
    "load-chat-context",
    {
      conversationId,
      userId,
    },
    async () => {
      const [
        { result: conversationData, durationMs: historyLoadMs },
        { result: hairProfileResult, durationMs: hairProfileLoadMs },
        { result: routineItems, durationMs: routineItemsLoadMs },
        { result: memoryContext, durationMs: memoryLoadMs },
      ] = await Promise.all([
        measureAsync(async () =>
          conversationId
            ? await supabase
                .from("messages")
                .select("*")
                .eq("conversation_id", conversationId)
                .order("created_at", { ascending: true })
                .limit(10)
                .then(({ data }) => data)
            : null,
        ),
        measureAsync(
          async () =>
            await supabase.from("hair_profiles").select("*").eq("user_id", userId).single(),
        ),
        measureAsync(() => loadRoutineItemsForEngine(userId)),
        measureAsync(() => loadUserMemoryContext(userId, supabase)),
      ])

      return {
        conversationData,
        hairProfileResult,
        routineItems,
        memoryContext,
        historyLoadMs,
        hairProfileLoadMs,
        routineItemsLoadMs,
        memoryLoadMs,
      }
    },
    {
      output: (result) => ({
        historyCount: (result.conversationData as Message[] | null)?.length ?? 0,
        hasHairProfile: Boolean(result.hairProfileResult.data),
        routineItemCount: result.routineItems.length,
        hasMemoryContext: Boolean(result.memoryContext.promptContext),
      }),
    },
  )
  const conversationHistory: Message[] = (conversationData as Message[]) ?? []
  const hairProfile: HairProfile | null = hydrateHairProfileForConsumers(
    (hairProfileResult.data as HairProfile | null) ?? null,
    routineItems,
  )

  // ── Step 1b: Classify intent (with conversation context) ───────────
  const { result: classificationOutput, durationMs: classificationMs } = await measureAsync(() =>
    observeAsyncStage(
      "intent-classification-stage",
      {
        message,
        conversationHistoryCount: conversationHistory.length,
      },
      () => classifyIntent(message, conversationHistory),
      {
        output: ({ result, promptRef }) => ({
          intent: result.intent,
          product_category: result.product_category,
          needs_clarification: result.needs_clarification,
          prompt: promptRef,
        }),
      },
    ),
  )
  const classification = classificationOutput.result
  const classificationPromptRef = classificationOutput.promptRef
  const { intent, product_category } = classification
  const hasExplicitRoutineFollowup =
    intent === "followup" &&
    deriveRoutineContext(hairProfile, message).explicit_topic_ids.length > 0
  const shouldPlanRoutine =
    intent === "routine_help" || product_category === "routine" || hasExplicitRoutineFollowup
  let routinePlan: RoutinePlan | undefined
  let routinePlanningMs = 0
  if (shouldPlanRoutine) {
    const routinePlanning = await measureAsync(async () =>
      buildRoutinePlan(hairProfile, message, {
        usesBondBuilder: routineItems.some((item) => item.category === "bondbuilder"),
      }),
    )
    routinePlan = routinePlanning.result
    routinePlanningMs = routinePlanning.durationMs
  }

  const recommendationRuntime = buildRecommendationEngineRuntimeForChat({
    hairProfile,
    routineItems,
    productCategory: product_category,
    shouldPlanRoutine,
    message,
  })
  const categoryDecision = getRuntimeCategoryDecision(recommendationRuntime, product_category)
  const engineTrace = buildRecommendationEngineTrace({
    runtime: recommendationRuntime,
  })

  // ── Step 2: Evaluate routing decision ──────────────────────────────
  const routerStart = performance.now()
  const routerDecision = await observeAsyncStage(
    "router-decision-stage",
    {
      intent,
      product_category,
      message,
    },
    async () =>
      evaluateRoute(classification, conversationHistory, hairProfile, routineItems, message),
    {
      output: (result) => ({
        classifier_retrieval_mode: classification.retrieval_mode,
        classifier_needs_clarification: classification.needs_clarification,
        final_retrieval_mode: result.retrieval_mode,
        final_response_mode: result.response_mode,
        confidence: result.confidence,
        slot_completeness: result.slot_completeness,
        clarification_reason: result.clarification_reason ?? null,
        policy_overrides: result.policy_overrides,
        category_requirements: summarizeEngineCategoryDecision(categoryDecision),
      }),
    },
  )
  const routerMs = Math.round(performance.now() - routerStart)

  emitRouterEvent({
    event: "router_classified",
    conversation_id: conversationId,
    intent,
    retrieval_mode: routerDecision.retrieval_mode,
    router_confidence: routerDecision.confidence,
    response_mode: routerDecision.response_mode,
    slot_completeness: routerDecision.slot_completeness,
    policy_overrides: routerDecision.policy_overrides,
    stage_latency_ms: routerMs,
  })

  // Emit override events if policy diverged from LLM suggestion
  if (routerDecision.policy_overrides.length > 0) {
    emitRouterEvent({
      event: "router_policy_override_applied",
      conversation_id: conversationId,
      intent,
      retrieval_mode: routerDecision.retrieval_mode,
      router_confidence: routerDecision.confidence,
      response_mode: routerDecision.response_mode,
      policy_overrides: routerDecision.policy_overrides,
      stage_latency_ms: 0,
    })
  }

  if (routerDecision.response_mode === "clarify_only") {
    emitRouterEvent({
      event: "router_clarification_triggered",
      conversation_id: conversationId,
      intent,
      retrieval_mode: routerDecision.retrieval_mode,
      router_confidence: routerDecision.confidence,
      response_mode: "clarify_only",
      slot_completeness: routerDecision.slot_completeness,
      stage_latency_ms: 0,
    })
  }

  // ── Create conversation if it doesn't exist yet ────────────────────
  let conversationCreateMs = 0
  if (!conversationId) {
    const conversationCreate = await measureAsync(async () =>
      supabase
        .from("conversations")
        .insert({
          user_id: userId,
          title: null, // Title will be generated asynchronously
          is_active: true,
        })
        .select("id")
        .single(),
    )
    const { data: newConversation, error: convError } = conversationCreate.result
    conversationCreateMs = conversationCreate.durationMs

    if (convError || !newConversation) {
      throw new Error(`Failed to create conversation: ${convError?.message}`)
    }

    conversationId = newConversation.id
    generateConversationTitle(newConversation.id, message, {
      userId,
      requestId,
    }).catch(() => {})
  }

  // ── Clarification branch: skip retrieval & products ────────────────
  if (routerDecision.response_mode === "clarify_only") {
    const routineClarificationQuestions = shouldPlanRoutine
      ? buildRoutineClarificationQuestions(hairProfile, message)
      : undefined

    const clarificationQuestions = buildEngineClarificationQuestions({
      productCategory: product_category,
      runtime: recommendationRuntime,
      shouldPlanRoutine,
      routineClarificationQuestions,
      classification,
      hairProfile,
    })

    // Minimal retrieval for context (but no product matching)
    const clarificationRetrievalCount = 3
    const retrievalStart = performance.now()
    const { chunks: ragChunks, debug: retrievalDebug } = await observeAsyncStage(
      "clarification-retrieval-stage",
      {
        intent,
        retrievalCount: clarificationRetrievalCount,
      },
      () =>
        retrieve(message, {
          intent,
          hairProfile,
          shampooConcern: getShampooConcernForRetrieval(recommendationRuntime, product_category),
          count: clarificationRetrievalCount,
          subqueries: routinePlan
            ? buildRoutineRetrievalSubqueries(message, routinePlan)
            : undefined,
          userId,
        }),
      {
        asType: "retriever",
        output: ({ chunks, debug }) => ({
          final_context_count: chunks.length,
          candidate_count_before_rerank: debug.candidate_count_before_rerank,
          fallback_used: debug.fallback_used,
        }),
      },
    )
    const retrievalMs = Math.round(performance.now() - retrievalStart)

    const sources = buildSources(ragChunks)

    const synthesisResult = await observeAsyncStage(
      "clarification-synthesis-stage",
      {
        intent,
        product_category,
        clarificationQuestionCount: clarificationQuestions.length,
      },
      () =>
        composeResponse({
          userMessage: message,
          conversationHistory,
          hairProfile,
          ragChunks,
          intent,
          productCategory: product_category,
          categoryDecision,
          memoryContext: memoryContext.promptContext,
          clarificationQuestions,
        }),
      {
        asType: "chain",
        output: (result) => ({
          model: result.debug.prompt.model,
          prompt_ref: result.debug.prompt.prompt_ref,
        }),
      },
    )
    const debugTrace = buildPipelineTraceDraft({
      request_id: requestId,
      started_at: startedAt,
      user_message: message,
      conversation_id: conversationId ?? null,
      intent,
      product_category,
      conversation_history_count: conversationHistory.length,
      classification,
      router_decision: routerDecision,
      clarification_questions: clarificationQuestions,
      hair_profile_snapshot: hairProfile,
      memory_context: memoryContext.promptContext,
      retrieval_debug: retrievalDebug,
      retrieval_count: clarificationRetrievalCount,
      retrieved_chunks: ragChunks,
      should_plan_routine: shouldPlanRoutine,
      routine_plan: routinePlan,
      category_decision: categoryDecision ?? undefined,
      engine_trace: engineTrace,
      matched_products: [],
      classification_prompt_ref: classificationPromptRef,
      prompt: synthesisResult.debug.prompt,
      latencies_ms: {
        classification_ms: classificationMs,
        hair_profile_load_ms: hairProfileLoadMs,
        routine_inventory_load_ms: routineItemsLoadMs,
        memory_load_ms: memoryLoadMs,
        routine_planning_ms: routinePlanningMs,
        history_load_ms: historyLoadMs,
        router_ms: routerMs,
        conversation_create_ms: conversationCreateMs,
        retrieval_ms: retrievalMs,
        product_matching_ms: 0,
        prompt_build_ms: synthesisResult.debug.prompt_build_ms,
        stream_setup_ms: synthesisResult.debug.stream_setup_ms,
      },
    })

    return {
      stream: synthesisResult.stream,
      conversationId: conversationId!,
      intent,
      matchedProducts: [],
      sources,
      routerDecision,
      categoryDecision: categoryDecision ?? undefined,
      engineTrace,
      retrievalSummary: {
        final_context_count: ragChunks.length,
      },
      debugTrace,
    }
  }

  // ── Normal branch: full retrieval + product matching ───────────────

  // ── Step 2: Retrieve context chunks ────────────────────────────────
  // Build metadata filter based on intent and category
  const metadataFilter = buildEngineRetrievalFilter({
    intent,
    productCategory: product_category,
    runtime: recommendationRuntime,
    hairProfile,
  })

  // FAQ mode: smaller retrieval, skip reranker
  const retrievalCount = routerDecision.retrieval_mode === "faq" ? 3 : 5

  const retrievalStart = performance.now()
  const { chunks: ragChunks, debug: retrievalDebug } = await observeAsyncStage(
    "chat-retrieval-stage",
    {
      intent,
      product_category,
      retrievalCount,
      metadataFilter,
    },
    () =>
      retrieve(message, {
        intent,
        hairProfile,
        metadataFilter,
        shampooConcern: getShampooConcernForRetrieval(recommendationRuntime, product_category),
        count: retrievalCount,
        subqueries: routinePlan ? buildRoutineRetrievalSubqueries(message, routinePlan) : undefined,
        userId,
      }),
    {
      asType: "retriever",
      output: ({ chunks, debug }) => ({
        final_context_count: chunks.length,
        candidate_count_before_rerank: debug.candidate_count_before_rerank,
        fallback_used: debug.fallback_used,
      }),
    },
  )
  const retrievalMs = Math.round(performance.now() - retrievalStart)

  // ── Build enriched citation sources from retrieved chunks ──────────
  const sources = buildSources(ragChunks)

  // ── Step 4: Match products (if intent requires it) ─────────────────
  let matchedProducts: Product[] | undefined = undefined
  const productMatchingStart = performance.now()
  if (shouldPlanRoutine && routinePlan) {
    const routineResult = await observeAsyncStage(
      "routine-product-selection-stage",
      {
        focusCount: routinePlan.primary_focuses.length,
      },
      () =>
        attachProductsToRoutinePlan({
          plan: routinePlan!,
          hairProfile,
          memoryContext,
          supabase,
        }),
      {
        asType: "chain",
        output: (result) => ({
          matched_product_count: result.matchedProducts.length,
        }),
      },
    )
    routinePlan = routineResult.plan
    matchedProducts = routineResult.matchedProducts
  } else if (PRODUCT_INTENTS.includes(intent)) {
    const selectionResult = await observeAsyncStage(
      "product-selection-stage",
      {
        product_category,
        intent,
      },
      () =>
        selectProducts({
          category: product_category,
          message,
          hairProfile,
          memoryContext,
          shouldPlanRoutine: false,
          routineItems,
        }),
      {
        asType: "chain",
        output: (result) => ({
          matched_product_count: result.products.length,
        }),
      },
    )
    matchedProducts = selectionResult.products
  }
  const productMatchingMs = Math.round(performance.now() - productMatchingStart)

  // Note: memory constraints for non-routine are already applied inside selectProducts()

  // ── Follow-up questions for recommend_and_refine mode ──────────────
  let followupQuestions: string[] | undefined
  if (
    routerDecision.response_mode === "recommend_and_refine" &&
    matchedProducts &&
    matchedProducts.length > 0
  ) {
    const routineClarificationQuestions = shouldPlanRoutine
      ? buildRoutineClarificationQuestions(hairProfile, message)
      : undefined
    followupQuestions = buildEngineClarificationQuestions({
      productCategory: product_category,
      runtime: recommendationRuntime,
      shouldPlanRoutine,
      routineClarificationQuestions,
      classification,
      hairProfile,
    })
  }

  // ── Step 5: Synthesize streaming response ──────────────────────────
  const synthesisResult = await observeAsyncStage(
    "chat-synthesis-stage",
    {
      intent,
      product_category,
      matched_product_count: matchedProducts?.length ?? 0,
    },
    () =>
      composeResponse({
        userMessage: message,
        conversationHistory,
        hairProfile,
        ragChunks,
        products: matchedProducts,
        intent,
        productCategory: product_category,
        categoryDecision,
        routinePlan,
        memoryContext: memoryContext.promptContext,
        followupQuestions,
      }),
    {
      asType: "chain",
      output: (result) => ({
        model: result.debug.prompt.model,
        prompt_ref: result.debug.prompt.prompt_ref,
      }),
    },
  )
  const debugTrace = buildPipelineTraceDraft({
    request_id: requestId,
    started_at: startedAt,
    user_message: message,
    conversation_id: conversationId ?? null,
    intent,
    product_category,
    conversation_history_count: conversationHistory.length,
    classification,
    router_decision: routerDecision,
    hair_profile_snapshot: hairProfile,
    memory_context: memoryContext.promptContext,
    retrieval_debug: retrievalDebug,
    retrieval_count: retrievalCount,
    retrieved_chunks: ragChunks,
    should_plan_routine: shouldPlanRoutine,
    routine_plan: routinePlan,
    category_decision: categoryDecision ?? undefined,
    engine_trace: engineTrace,
    matched_products: matchedProducts ?? [],
    classification_prompt_ref: classificationPromptRef,
    prompt: synthesisResult.debug.prompt,
    latencies_ms: {
      classification_ms: classificationMs,
      hair_profile_load_ms: hairProfileLoadMs,
      routine_inventory_load_ms: routineItemsLoadMs,
      memory_load_ms: memoryLoadMs,
      routine_planning_ms: routinePlanningMs,
      history_load_ms: historyLoadMs,
      router_ms: routerMs,
      conversation_create_ms: conversationCreateMs,
      retrieval_ms: retrievalMs,
      product_matching_ms: productMatchingMs,
      prompt_build_ms: synthesisResult.debug.prompt_build_ms,
      stream_setup_ms: synthesisResult.debug.stream_setup_ms,
    },
  })

  return {
    stream: synthesisResult.stream,
    conversationId: conversationId!,
    intent,
    matchedProducts: matchedProducts ?? [],
    sources,
    routerDecision,
    categoryDecision: categoryDecision ?? undefined,
    engineTrace,
    retrievalSummary: {
      final_context_count: ragChunks.length,
    },
    debugTrace,
  }
}
