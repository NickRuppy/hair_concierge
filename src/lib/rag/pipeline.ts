import { createAdminClient } from "@/lib/supabase/admin"
import { classifyIntent } from "@/lib/rag/intent-classifier"
import { evaluateRoute } from "@/lib/rag/router"
import { buildClarificationQuestions } from "@/lib/rag/clarification"
import { retrieveContext } from "@/lib/rag/retriever"
import {
  matchProducts,
  matchShampooProducts,
  matchConditionerProducts,
  matchLeaveInProducts,
  matchOilProducts,
} from "@/lib/rag/product-matcher"
import { synthesizeResponse } from "@/lib/rag/synthesizer"
import { buildMaskConcernSearchOrder } from "@/lib/rag/mask-mapper"
import { deriveMaskDecision, rerankMaskProducts } from "@/lib/rag/mask-reranker"
import {
  buildConditionerClarificationQuestions,
  buildConditionerDecision,
  rerankConditionerProducts,
} from "@/lib/rag/conditioner-decision"
import {
  annotateShampooRecommendations,
  buildShampooClarificationQuestions,
  buildShampooDecision,
  buildShampooRetrievalFilter,
} from "@/lib/rag/shampoo-decision"
import {
  buildLeaveInClarificationQuestions,
  buildLeaveInDecision,
  rerankLeaveInProducts,
} from "@/lib/rag/leave-in-decision"
import {
  annotateOilRecommendations,
  buildOilClarificationQuestions,
  buildOilDecision,
  buildOilRetrievalFilter,
} from "@/lib/rag/oil-decision"
import { SOURCE_TYPE_LABELS } from "@/lib/vocabulary"
import { formatSourceName } from "@/lib/rag/source-names"
import { generateConversationTitle } from "@/lib/rag/title-generator"
import { emitRouterEvent } from "@/lib/rag/retrieval-telemetry"
import {
  buildPipelineTraceDraft,
  type PipelineTraceDraft,
} from "@/lib/rag/debug-trace"
import {
  buildRoutineClarificationQuestions,
  buildRoutinePlan,
  buildRoutineRetrievalSubqueries,
} from "@/lib/routines/planner"
import { attachProductsToRoutinePlan } from "@/lib/routines/product-attachments"
import {
  applyProductMemoryConstraints,
  loadUserMemoryContext,
} from "@/lib/rag/user-memory"
import type { ProductLeaveInSpecs } from "@/lib/leave-in/constants"
import type { ProductMaskSpecs } from "@/lib/mask/constants"
import type { ProductConditionerSpecs } from "@/lib/conditioner/constants"
import { PRODUCT_INTENTS } from "@/lib/rag/retrieval-constants"
import type {
  IntentType,
  Message,
  HairProfile,
  Product,
  EnrichedCitationSource,
  RouterDecision,
  MaskDecision,
  CategoryDecision,
  RoutinePlan,
} from "@/lib/types"

export interface PipelineParams {
  message: string
  conversationId?: string
  userId: string
  requestId: string
}

export interface PipelineResult {
  stream: ReadableStream<Uint8Array>
  conversationId: string
  intent: IntentType
  matchedProducts: Product[]
  sources: EnrichedCitationSource[]
  routerDecision: RouterDecision
  categoryDecision?: CategoryDecision
  /** Retrieval summary for the done event */
  retrievalSummary: {
    final_context_count: number
  }
  debugTrace: PipelineTraceDraft
}

async function measureAsync<T>(
  work: () => Promise<T>,
): Promise<{ result: T; durationMs: number }> {
  const start = performance.now()
  const result = await work()
  return {
    result,
    durationMs: Math.round(performance.now() - start),
  }
}

/**
 * Orchestrates the full RAG pipeline for a single user turn:
 *
 * Step 1: Classify the user's intent (with enriched fields).
 * Step 1b: Evaluate routing decision via deterministic policy engine.
 * Step 2: Retrieve relevant knowledge chunks via embedding + pgvector search.
 * Step 3: Load the user's hair profile and last 10 conversation messages.
 * Step 4: If the intent calls for it, match relevant products.
 * Step 5: Synthesize a streaming response with all gathered context.
 *
 * @returns The readable stream of response tokens, conversation ID, classified intent, and router decision.
 */
export async function runPipeline(
  params: PipelineParams
): Promise<PipelineResult> {
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
        : null
    ),
    measureAsync(async () =>
      await supabase
        .from("hair_profiles")
        .select("*")
        .eq("user_id", userId)
        .single()
    ),
    measureAsync(() => loadUserMemoryContext(userId, supabase)),
  ])
  const conversationHistory: Message[] = (conversationData as Message[]) ?? []
  const hairProfile: HairProfile | null = hairProfileResult.data ?? null

  // ── Step 1b: Classify intent (with conversation context) ───────────
  const { result: classification, durationMs: classificationMs } = await measureAsync(() =>
    classifyIntent(message, conversationHistory)
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
  let shampooDecision = product_category === "shampoo"
    ? buildShampooDecision(hairProfile)
    : undefined
  let conditionerDecision = product_category === "conditioner"
    ? buildConditionerDecision(hairProfile)
    : undefined
  let leaveInDecision = product_category === "leave_in"
    ? buildLeaveInDecision(hairProfile)
    : undefined
  let oilDecision = product_category === "oil"
    ? buildOilDecision(hairProfile, message)
    : undefined

  // Pre-compute concern codes for category-specific metadata filtering
  const conditionerConcern = product_category === "conditioner"
    ? conditionerDecision?.matched_concern_code
    : null

  // ── Step 2: Evaluate routing decision ───────────────────────────────
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

  // ── Create conversation if it doesn't exist yet ─────────────────────
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
        .single()
    )
    const { data: newConversation, error: convError } = conversationCreate.result
    conversationCreateMs = conversationCreate.durationMs

    if (convError || !newConversation) {
      throw new Error(`Failed to create conversation: ${convError?.message}`)
    }

    conversationId = newConversation.id
    generateConversationTitle(newConversation.id, message).catch(() => {})
  }

  // ── Clarification branch: skip retrieval & products ─────────────────
  if (routerDecision.needs_clarification) {
    const clarificationQuestions =
      shouldPlanRoutine
        ? buildRoutineClarificationQuestions(hairProfile, message)
        : product_category === "shampoo" && shampooDecision && !shampooDecision.eligible
        ? buildShampooClarificationQuestions(shampooDecision)
        : product_category === "conditioner" && conditionerDecision && !conditionerDecision.eligible
          ? buildConditionerClarificationQuestions(conditionerDecision)
        : product_category === "leave_in" && leaveInDecision && !leaveInDecision.eligible
          ? buildLeaveInClarificationQuestions(leaveInDecision)
        : product_category === "oil" && oilDecision && !oilDecision.eligible
          ? buildOilClarificationQuestions(oilDecision)
        : buildClarificationQuestions(
            classification.normalized_filters,
            product_category,
            hairProfile,
          )

    // Minimal retrieval for context (but no product matching)
    const clarificationRetrievalCount = 3
    const retrievalStart = performance.now()
    const { chunks: ragChunks, debug: retrievalDebug } = await retrieveContext(message, {
      intent,
      hairProfile,
      shampooConcern: shampooDecision?.matched_concern_code ?? null,
      count: clarificationRetrievalCount,
      subqueries: routinePlan ? buildRoutineRetrievalSubqueries(message, routinePlan) : undefined,
      userId,
    })
    const retrievalMs = Math.round(performance.now() - retrievalStart)

    const sources: EnrichedCitationSource[] = ragChunks.map((chunk, i) => ({
      index: i + 1,
      source_type: chunk.source_type,
      label: SOURCE_TYPE_LABELS[chunk.source_type] ?? chunk.source_type,
      source_name: chunk.source_name ? formatSourceName(chunk.source_name) : null,
      snippet: chunk.content.slice(0, 200) + (chunk.content.length > 200 ? "..." : ""),
      confidence: chunk.weighted_similarity,
      retrieval_path: chunk.retrieval_path,
    }))

    const synthesisResult = await synthesizeResponse({
      userMessage: message,
      conversationHistory,
      hairProfile,
      ragChunks,
      intent,
      productCategory: product_category,
      shampooDecision,
      conditionerDecision,
      leaveInDecision,
      oilDecision,
      memoryContext: memoryContext.promptContext,
      clarificationQuestions,
    })
    const categoryDecision =
      shampooDecision ?? conditionerDecision ?? leaveInDecision ?? oilDecision
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

  // ── Normal branch: full retrieval + product matching ────────────────

  // ── Step 2: Retrieve context chunks ─────────────────────────────────
  // Build metadata filter based on intent and category
  let metadataFilter =
    buildShampooRetrievalFilter(intent, product_category, shampooDecision)
    ?? buildOilRetrievalFilter(intent, product_category, oilDecision)
  if (!metadataFilter && intent === "product_recommendation") {
    if (hairProfile?.thickness) {
      metadataFilter = { thickness: hairProfile.thickness }
      // For conditioner: filter by protein/moisture concern
      if (conditionerConcern) {
        metadataFilter.concern = conditionerConcern
      }
    } else if (hairProfile) {
      console.warn(`User ${userId} has profile but missing thickness — skipping metadata filter`)
    }
  }

  // FAQ mode: smaller retrieval, skip reranker
  const retrievalCount = routerDecision.retrieval_mode === "faq" ? 3 : 5

  const retrievalStart = performance.now()
  const { chunks: ragChunks, debug: retrievalDebug } = await retrieveContext(message, {
    intent,
    hairProfile,
    metadataFilter,
    shampooConcern: shampooDecision?.matched_concern_code ?? null,
    count: retrievalCount,
    subqueries: routinePlan ? buildRoutineRetrievalSubqueries(message, routinePlan) : undefined,
    userId,
  })
  const retrievalMs = Math.round(performance.now() - retrievalStart)

  // ── Build enriched citation sources from retrieved chunks ─────────
  const sources: EnrichedCitationSource[] = ragChunks.map((chunk, i) => ({
    index: i + 1,
    source_type: chunk.source_type,
    label: SOURCE_TYPE_LABELS[chunk.source_type] ?? chunk.source_type,
    source_name: chunk.source_name ? formatSourceName(chunk.source_name) : null,
    snippet: chunk.content.slice(0, 200) + (chunk.content.length > 200 ? "..." : ""),
    confidence: chunk.weighted_similarity,
    retrieval_path: chunk.retrieval_path,
  }))

  // ── Step 4: Match products (if intent requires it) ──────────────────
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
    if (product_category === "shampoo") {
      if (!shampooDecision?.eligible || !hairProfile?.thickness) {
        matchedProducts = []
      } else if (!shampooDecision.matched_bucket) {
        matchedProducts = []
      } else {
        const shampooCandidates = await matchShampooProducts({
          query: message,
          thickness: hairProfile.thickness,
          shampooBucket: shampooDecision.matched_bucket,
          count: shampooDecision.secondary_bucket ? 2 : 3,
        })

        // Dandruff rotation: fetch 1 product from the secondary (scalp-type) bucket
        let secondaryCandidates: Awaited<ReturnType<typeof matchShampooProducts>> = []
        if (shampooDecision.secondary_bucket && shampooDecision.secondary_bucket !== shampooDecision.matched_bucket) {
          secondaryCandidates = await matchShampooProducts({
            query: message,
            thickness: hairProfile.thickness,
            shampooBucket: shampooDecision.secondary_bucket,
            count: 1,
          })
          // Tag secondary products with a role for the synthesizer
          for (const product of secondaryCandidates) {
            (product as unknown as Record<string, unknown>).shampoo_role = "daily"
          }
          // Tag primary products
          for (const product of shampooCandidates) {
            (product as unknown as Record<string, unknown>).shampoo_role = "treatment"
          }
        }

        const allCandidates = [...shampooCandidates, ...secondaryCandidates]
        shampooDecision = buildShampooDecision(hairProfile, allCandidates.length)
        matchedProducts = annotateShampooRecommendations(allCandidates, shampooDecision)
      }
    } else if (product_category === "conditioner") {
      if (!conditionerDecision?.eligible || !hairProfile?.thickness || !hairProfile?.protein_moisture_balance) {
        matchedProducts = []
      } else {
        const conditionerCandidates = await matchConditionerProducts({
          query: message,
          thickness: hairProfile.thickness,
          proteinMoistureBalance: hairProfile.protein_moisture_balance,
          count: 10,
        })
        conditionerDecision = buildConditionerDecision(hairProfile, conditionerCandidates.length)

        if (conditionerCandidates.length === 0) {
          matchedProducts = []
        } else {
          const { data: conditionerSpecs, error: conditionerSpecsError } = await supabase
            .from("product_conditioner_rerank_specs")
            .select("*")
            .in("product_id", conditionerCandidates.map((candidate) => candidate.id))

          if (conditionerSpecsError) {
            console.error("Failed to load conditioner specs for reranking:", conditionerSpecsError)
          }

          matchedProducts = rerankConditionerProducts(
            conditionerCandidates,
            (conditionerSpecs ?? []) as ProductConditionerSpecs[],
            conditionerDecision
          ).slice(0, 3)
        }
      }
    } else if (product_category === "leave_in") {
      if (
        !leaveInDecision?.eligible ||
        !hairProfile?.thickness ||
        !leaveInDecision.need_bucket ||
        !leaveInDecision.styling_context
      ) {
        matchedProducts = []
      } else {
        const leaveInCandidates = await matchLeaveInProducts({
          query: message,
          thickness: hairProfile.thickness,
          needBucket: leaveInDecision.need_bucket,
          stylingContext: leaveInDecision.styling_context,
          count: 10,
        })

        if (leaveInCandidates.length === 0) {
          leaveInDecision = buildLeaveInDecision(hairProfile, 0)
          matchedProducts = []
        } else {
          const { data: leaveInSpecs, error: leaveInSpecsError } = await supabase
            .from("product_leave_in_specs")
            .select("*")
            .in("product_id", leaveInCandidates.map((candidate) => candidate.id))

          if (leaveInSpecsError) {
            console.error("Failed to load leave-in specs for reranking:", leaveInSpecsError)
            leaveInDecision = buildLeaveInDecision(hairProfile, 0)
            matchedProducts = []
          } else {
            const rerankedLeaveIns = rerankLeaveInProducts(
              leaveInCandidates,
              (leaveInSpecs ?? []) as ProductLeaveInSpecs[],
              leaveInDecision
            )

            leaveInDecision = buildLeaveInDecision(hairProfile, rerankedLeaveIns.length)
            matchedProducts = rerankedLeaveIns.slice(0, 3)
          }
        }
      }
    } else if (product_category === "oil") {
      if (
        !oilDecision?.eligible ||
        !hairProfile?.thickness ||
        !oilDecision.matched_subtype ||
        oilDecision.no_recommendation
      ) {
        matchedProducts = []
      } else {
        const oilCandidates = await matchOilProducts({
          query: message,
          thickness: hairProfile.thickness,
          oilSubtype: oilDecision.matched_subtype,
          count: 10,
        })

        oilDecision = buildOilDecision(hairProfile, message, oilCandidates.length)
        matchedProducts = annotateOilRecommendations(
          oilCandidates.slice(0, 3),
          oilDecision
        )
      }
    } else if (product_category === "mask") {
      maskDecision = deriveMaskDecision(hairProfile)

      if (!maskDecision.needs_mask || !maskDecision.mask_type) {
        matchedProducts = []
      } else {
        const concernSearchOrder = buildMaskConcernSearchOrder(maskDecision.mask_type)
        matchedProducts = []

        for (const concernCode of concernSearchOrder) {
          const maskCandidates = await matchProducts({
            query: message,
            thickness: hairProfile?.thickness ?? undefined,
            concerns: [concernCode],
            category: "mask",
            count: 10,
          })

          if (maskCandidates.length === 0) continue

          const prioritizedCandidates = maskCandidates.filter((candidate) =>
            candidate.suitable_concerns.includes(concernCode)
          )
          if (prioritizedCandidates.length === 0) continue

          const candidatesForRerank = prioritizedCandidates

          const { data: maskSpecs, error: maskSpecsError } = await supabase
            .from("product_mask_specs")
            .select("*")
            .in("product_id", candidatesForRerank.map((candidate) => candidate.id))

          if (maskSpecsError) {
            console.error("Failed to load mask specs for reranking:", maskSpecsError)
            matchedProducts = candidatesForRerank.slice(0, 3)
            break
          }

          const rerankedMasks = rerankMaskProducts(
            candidatesForRerank,
            (maskSpecs ?? []) as ProductMaskSpecs[],
            hairProfile,
            maskDecision
          )

          if (rerankedMasks.length > 0) {
            matchedProducts = rerankedMasks
            break
          }
        }
      }
    } else {
      matchedProducts = await matchProducts({
        query: message,
        thickness: hairProfile?.thickness ?? undefined,
        concerns: [],
        count: 3,
      })
    }
  }
  const productMatchingMs = Math.round(performance.now() - productMatchingStart)

  if (matchedProducts && !shouldPlanRoutine) {
    matchedProducts = applyProductMemoryConstraints(matchedProducts, memoryContext)
  }

  // ── Step 5: Synthesize streaming response ───────────────────────────
  const synthesisResult = await synthesizeResponse({
    userMessage: message,
    conversationHistory,
    hairProfile,
    ragChunks,
    products: matchedProducts,
    intent,
    productCategory: product_category,
    maskDecision: product_category === "mask" ? maskDecision : undefined,
    shampooDecision,
    conditionerDecision,
    leaveInDecision,
    oilDecision,
    routinePlan,
    memoryContext: memoryContext.promptContext,
  })
  const categoryDecision =
    shampooDecision ?? conditionerDecision ?? leaveInDecision ?? oilDecision
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
