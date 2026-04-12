import { createAdminClient } from "@/lib/supabase/admin"
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
import type { Message, HairProfile, MaskDecision, RoutinePlan, Product } from "@/lib/types"

// ── Helpers ──────────────────────────────────────────────────────────────────

async function measureAsync<T>(work: () => Promise<T>): Promise<{ result: T; durationMs: number }> {
  const start = performance.now()
  const result = await work()
  return {
    result,
    durationMs: Math.round(performance.now() - start),
  }
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
      async () => await supabase.from("hair_profiles").select("*").eq("user_id", userId).single(),
    ),
    measureAsync(() => loadUserMemoryContext(userId, supabase)),
  ])
  const conversationHistory: Message[] = (conversationData as Message[]) ?? []
  const hairProfile: HairProfile | null = hairProfileResult.data ?? null

  // ── Step 1b: Classify intent (with conversation context) ───────────
  const { result: classification, durationMs: classificationMs } = await measureAsync(() =>
    classifyIntent(message, conversationHistory),
  )
  const { intent, product_category } = classification
  const shouldPlanRoutine = intent === "routine_help" || product_category === "routine"
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
  const routerDecision = evaluateRoute(classification, conversationHistory, hairProfile, message)
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
    generateConversationTitle(newConversation.id, message).catch(() => {})
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
    const { chunks: ragChunks, debug: retrievalDebug } = await retrieve(message, {
      intent,
      hairProfile,
      shampooConcern: decisions.shampoo?.matched_concern_code ?? null,
      count: clarificationRetrievalCount,
      subqueries: routinePlan ? buildRoutineRetrievalSubqueries(message, routinePlan) : undefined,
      userId,
    })
    const retrievalMs = Math.round(performance.now() - retrievalStart)

    const sources = buildSources(ragChunks)

    const synthesisResult = await composeResponse({
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
    })
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
  const { chunks: ragChunks, debug: retrievalDebug } = await retrieve(message, {
    intent,
    hairProfile,
    metadataFilter,
    shampooConcern: decisions.shampoo?.matched_concern_code ?? null,
    count: retrievalCount,
    subqueries: routinePlan ? buildRoutineRetrievalSubqueries(message, routinePlan) : undefined,
    userId,
  })
  const retrievalMs = Math.round(performance.now() - retrievalStart)

  // ── Build enriched citation sources from retrieved chunks ──────────
  const sources = buildSources(ragChunks)

  // ── Step 4: Match products (if intent requires it) ─────────────────
  let matchedProducts: Product[] | undefined = undefined
  let maskDecision: MaskDecision | undefined
  const productMatchingStart = performance.now()
  if (shouldPlanRoutine && routinePlan) {
    const routineResult = await attachProductsToRoutinePlan({
      plan: routinePlan,
      hairProfile,
      memoryContext,
      supabase,
    })
    routinePlan = routineResult.plan
    matchedProducts = routineResult.matchedProducts
  } else if (PRODUCT_INTENTS.includes(intent)) {
    if (product_category === "mask") {
      // Mask uses deriveMaskDecision directly (not in buildInitialDecisions)
      maskDecision = deriveMaskDecision(hairProfile)
      decisions = { ...decisions, mask: maskDecision }
    }

    const selectionResult = await selectProducts({
      category: product_category,
      message,
      hairProfile,
      decisions,
      memoryContext,
      shouldPlanRoutine: false,
    })
    matchedProducts = selectionResult.products as Product[]

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
  const synthesisResult = await composeResponse({
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
  })
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
