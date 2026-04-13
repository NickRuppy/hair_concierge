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
import { loadUserMemoryContext } from "@/lib/rag/user-memory"
import {
  buildInitialDecisions,
  buildCategoryClarificationQuestions,
  buildCategoryRetrievalFilter,
  getPrimaryCategoryDecision,
} from "@/lib/rag/category-engine"
import { deriveMaskDecision } from "@/lib/rag/category-engine/mask-wrapper"
import { retrieve, buildSources } from "@/lib/rag/retrieval/retrieval-service"
import { composeResponse } from "@/lib/rag/response/response-composer"
import { selectProducts } from "@/lib/rag/selection/product-selection-service"
import type { PipelineParams, PipelineResult, CategoryDecisions } from "@/lib/rag/contracts"
import type {
  Message,
  HairProfile,
  MaskDecision,
  RoutinePlan,
  Product,
  CategoryDecision,
} from "@/lib/types"

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

function summarizeCategoryDecision(
  decision: CategoryDecision | undefined,
): Record<string, unknown> | null {
  if (!decision) return null

  const summary: Record<string, unknown> = {
    category: decision.category,
    eligible: decision.eligible,
    missing_profile_fields: decision.missing_profile_fields,
    no_catalog_match: decision.no_catalog_match,
  }

  if (decision.category === "shampoo") {
    summary.matched_bucket = decision.matched_bucket
    summary.matched_concern_code = decision.matched_concern_code
  }

  if (decision.category === "conditioner") {
    summary.matched_balance_need = decision.matched_balance_need
    summary.matched_weight = decision.matched_weight
    summary.matched_repair_level = decision.matched_repair_level
  }

  if (decision.category === "leave_in") {
    summary.need_bucket = decision.need_bucket
    summary.styling_context = decision.styling_context
    summary.conditioner_relationship = decision.conditioner_relationship
    summary.matched_weight = decision.matched_weight
  }

  if (decision.category === "oil") {
    summary.matched_subtype = decision.matched_subtype
    summary.use_mode = decision.use_mode
    summary.no_recommendation = decision.no_recommendation
    summary.no_recommendation_reason = decision.no_recommendation_reason
  }

  return summary
}

// ── Main orchestrator ────────────────────────────────────────────────────────

/**
 * Orchestrates the full RAG pipeline for a single user turn.
 *
 * This is a drop-in replacement for `runPipeline()` in pipeline.ts,
 * delegating to the extracted boundary modules:
 *  - category-engine (decisions, clarification, retrieval filters)
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
    memoryContext,
    historyLoadMs,
    hairProfileLoadMs,
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
        measureAsync(() => loadUserMemoryContext(userId, supabase)),
      ])

      return {
        conversationData,
        hairProfileResult,
        memoryContext,
        historyLoadMs,
        hairProfileLoadMs,
        memoryLoadMs,
      }
    },
    {
      output: (result) => ({
        historyCount: (result.conversationData as Message[] | null)?.length ?? 0,
        hasHairProfile: Boolean(result.hairProfileResult.data),
        hasMemoryContext: Boolean(result.memoryContext.promptContext),
      }),
    },
  )
  const conversationHistory: Message[] = (conversationData as Message[]) ?? []
  const hairProfile: HairProfile | null = hairProfileResult.data ?? null

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
    const routinePlanning = await measureAsync(async () => {
      const bondBuilderUsage = await supabase
        .from("user_product_usage")
        .select("id")
        .eq("user_id", userId)
        .eq("category", "bondbuilder")
        .limit(1)
      const usesBondBuilder = (bondBuilderUsage.data?.length ?? 0) > 0
      return buildRoutinePlan(hairProfile, message, { usesBondBuilder })
    })
    routinePlan = routinePlanning.result
    routinePlanningMs = routinePlanning.durationMs
  }

  // ── Category decisions ─────────────────────────────────────────────
  let decisions: CategoryDecisions = buildInitialDecisions(product_category, hairProfile, message)

  // ── Step 2: Evaluate routing decision ──────────────────────────────
  const routerStart = performance.now()
  const routerDecision = await observeAsyncStage(
    "router-decision-stage",
    {
      intent,
      product_category,
      message,
    },
    async () => evaluateRoute(classification, conversationHistory, hairProfile, message),
    {
      output: (result) => ({
        classifier_retrieval_mode: classification.retrieval_mode,
        classifier_needs_clarification: classification.needs_clarification,
        final_retrieval_mode: result.retrieval_mode,
        final_needs_clarification: result.needs_clarification,
        confidence: result.confidence,
        slot_completeness: result.slot_completeness,
        clarification_reason: result.clarification_reason ?? null,
        policy_overrides: result.policy_overrides,
        category_requirements: summarizeCategoryDecision(getPrimaryCategoryDecision(decisions)),
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
    needs_clarification: routerDecision.needs_clarification,
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
      needs_clarification: routerDecision.needs_clarification,
      policy_overrides: routerDecision.policy_overrides,
      stage_latency_ms: 0,
    })
  }

  if (routerDecision.needs_clarification) {
    emitRouterEvent({
      event: "router_clarification_triggered",
      conversation_id: conversationId,
      intent,
      retrieval_mode: routerDecision.retrieval_mode,
      router_confidence: routerDecision.confidence,
      needs_clarification: true,
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
  if (routerDecision.needs_clarification) {
    const routineClarificationQuestions = shouldPlanRoutine
      ? buildRoutineClarificationQuestions(hairProfile, message)
      : undefined

    const clarificationQuestions = buildCategoryClarificationQuestions(
      product_category,
      decisions,
      shouldPlanRoutine,
      routineClarificationQuestions,
      classification,
      hairProfile,
    )

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
          shampooConcern: decisions.shampoo?.matched_concern_code ?? null,
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
          shampooDecision: decisions.shampoo,
          conditionerDecision: decisions.conditioner,
          leaveInDecision: decisions.leaveIn,
          oilDecision: decisions.oil,
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
    const categoryDecision = getPrimaryCategoryDecision(decisions)
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
      category_decision: categoryDecision,
      matched_products: [],
      classification_prompt_ref: classificationPromptRef,
      prompt: synthesisResult.debug.prompt,
      latencies_ms: {
        classification_ms: classificationMs,
        hair_profile_load_ms: hairProfileLoadMs,
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
      categoryDecision,
      retrievalSummary: {
        final_context_count: ragChunks.length,
      },
      debugTrace,
    }
  }

  // ── Normal branch: full retrieval + product matching ───────────────

  // ── Step 2: Retrieve context chunks ────────────────────────────────
  // Build metadata filter based on intent and category
  const metadataFilter = buildCategoryRetrievalFilter(
    intent,
    product_category,
    decisions,
    hairProfile,
  )

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
        shampooConcern: decisions.shampoo?.matched_concern_code ?? null,
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
  let maskDecision: MaskDecision | undefined
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
    if (product_category === "mask") {
      // Mask uses deriveMaskDecision directly (not in buildInitialDecisions)
      maskDecision = deriveMaskDecision(hairProfile)
      decisions = { ...decisions, mask: maskDecision }
    }

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
          decisions,
          memoryContext,
          shouldPlanRoutine: false,
        }),
      {
        asType: "chain",
        output: (result) => ({
          matched_product_count: result.products.length,
        }),
      },
    )
    matchedProducts = selectionResult.products

    // Merge updated decisions back
    if (selectionResult.updatedDecisions.shampoo) {
      decisions = { ...decisions, shampoo: selectionResult.updatedDecisions.shampoo }
    }
    if (selectionResult.updatedDecisions.conditioner) {
      decisions = { ...decisions, conditioner: selectionResult.updatedDecisions.conditioner }
    }
    if (selectionResult.updatedDecisions.leaveIn) {
      decisions = { ...decisions, leaveIn: selectionResult.updatedDecisions.leaveIn }
    }
    if (selectionResult.updatedDecisions.oil) {
      decisions = { ...decisions, oil: selectionResult.updatedDecisions.oil }
    }
    if (selectionResult.updatedDecisions.mask) {
      maskDecision = selectionResult.updatedDecisions.mask
    }
  }
  const productMatchingMs = Math.round(performance.now() - productMatchingStart)

  // Note: memory constraints for non-routine are already applied inside selectProducts()

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
        maskDecision: product_category === "mask" ? maskDecision : undefined,
        shampooDecision: decisions.shampoo,
        conditionerDecision: decisions.conditioner,
        leaveInDecision: decisions.leaveIn,
        oilDecision: decisions.oil,
        routinePlan,
        memoryContext: memoryContext.promptContext,
      }),
    {
      asType: "chain",
      output: (result) => ({
        model: result.debug.prompt.model,
        prompt_ref: result.debug.prompt.prompt_ref,
      }),
    },
  )
  const categoryDecision = getPrimaryCategoryDecision(decisions)
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
    category_decision: categoryDecision,
    matched_products: matchedProducts ?? [],
    classification_prompt_ref: classificationPromptRef,
    prompt: synthesisResult.debug.prompt,
    latencies_ms: {
      classification_ms: classificationMs,
      hair_profile_load_ms: hairProfileLoadMs,
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
    categoryDecision,
    retrievalSummary: {
      final_context_count: ragChunks.length,
    },
    debugTrace,
  }
}
