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
} from "@/lib/types"

export interface PipelineParams {
  message: string
  conversationId?: string
  userId: string
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
  const { message, userId } = params
  let { conversationId } = params

  const supabase = createAdminClient()

  // ── Step 1: Classify intent + load hair profile (parallel) ─────────
  const [classification, hairProfileResult, memoryContext] = await Promise.all([
    classifyIntent(message),
    supabase
      .from("hair_profiles")
      .select("*")
      .eq("user_id", userId)
      .single(),
    loadUserMemoryContext(userId, supabase),
  ])
  const { intent, product_category } = classification
  const hairProfile: HairProfile | null = hairProfileResult.data ?? null
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

  // ── Step 3: Load conversation history ─────────────────────────────
  const { data: conversationData } = conversationId
    ? await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .limit(10)
    : { data: null }

  const conversationHistory: Message[] = (conversationData as Message[]) ?? []

  // ── Step 1b: Evaluate routing decision ─────────────────────────────
  const routerStart = Date.now()
  const routerDecision = evaluateRoute(classification, conversationHistory, hairProfile, message)

  emitRouterEvent({
    event: "router_classified",
    conversation_id: conversationId,
    intent,
    retrieval_mode: routerDecision.retrieval_mode,
    router_confidence: routerDecision.confidence,
    needs_clarification: routerDecision.needs_clarification,
    slot_completeness: routerDecision.slot_completeness,
    policy_overrides: routerDecision.policy_overrides,
    stage_latency_ms: Date.now() - routerStart,
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
  if (!conversationId) {
    const { data: newConversation, error: convError } = await supabase
      .from("conversations")
      .insert({
        user_id: userId,
        title: null, // Title will be generated asynchronously
        is_active: true,
      })
      .select("id")
      .single()

    if (convError || !newConversation) {
      throw new Error(`Failed to create conversation: ${convError?.message}`)
    }

    conversationId = newConversation.id
    generateConversationTitle(newConversation.id, message).catch(() => {})
  }

  // ── Clarification branch: skip retrieval & products ─────────────────
  if (routerDecision.needs_clarification) {
    const clarificationQuestions =
      product_category === "shampoo" && shampooDecision && !shampooDecision.eligible
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
    const ragChunks = await retrieveContext(message, {
      intent,
      hairProfile,
      shampooConcern: shampooDecision?.matched_concern_code ?? null,
      count: 3,
      userId,
    })

    const sources: EnrichedCitationSource[] = ragChunks.map((chunk, i) => ({
      index: i + 1,
      source_type: chunk.source_type,
      label: SOURCE_TYPE_LABELS[chunk.source_type] ?? chunk.source_type,
      source_name: chunk.source_name ? formatSourceName(chunk.source_name) : null,
      snippet: chunk.content.slice(0, 200) + (chunk.content.length > 200 ? "..." : ""),
      confidence: chunk.weighted_similarity,
      retrieval_path: chunk.retrieval_path,
    }))

    const stream = await synthesizeResponse({
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

    return {
      stream,
      conversationId: conversationId!,
      intent,
      matchedProducts: [],
      sources,
      routerDecision,
      categoryDecision: shampooDecision ?? conditionerDecision ?? leaveInDecision ?? oilDecision,
      retrievalSummary: {
        final_context_count: ragChunks.length,
      },
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

  const ragChunks = await retrieveContext(message, {
    intent,
    hairProfile,
    metadataFilter,
    shampooConcern: shampooDecision?.matched_concern_code ?? null,
    count: retrievalCount,
    userId,
  })

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
  if (PRODUCT_INTENTS.includes(intent)) {
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

          matchedProducts = applyProductMemoryConstraints(
            rerankConditionerProducts(
              conditionerCandidates,
              (conditionerSpecs ?? []) as ProductConditionerSpecs[],
              conditionerDecision
            ),
            memoryContext
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
            const rerankedLeaveIns = applyProductMemoryConstraints(
              rerankLeaveInProducts(
                leaveInCandidates,
                (leaveInSpecs ?? []) as ProductLeaveInSpecs[],
                leaveInDecision
              ),
              memoryContext
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
          applyProductMemoryConstraints(oilCandidates, memoryContext).slice(0, 3),
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

  if (matchedProducts) {
    matchedProducts = applyProductMemoryConstraints(matchedProducts, memoryContext)
  }

  // ── Step 5: Synthesize streaming response ───────────────────────────
  const stream = await synthesizeResponse({
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
    memoryContext: memoryContext.promptContext,
  })

  return {
    stream,
    conversationId: conversationId!,
    intent,
    matchedProducts: matchedProducts ?? [],
    sources,
    routerDecision,
    categoryDecision: shampooDecision ?? conditionerDecision ?? leaveInDecision ?? oilDecision,
    retrievalSummary: {
      final_context_count: ragChunks.length,
    },
  }
}
