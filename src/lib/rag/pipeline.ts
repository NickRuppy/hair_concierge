import { createAdminClient } from "@/lib/supabase/admin"
import { analyzeImage } from "@/lib/openai/vision"
import { classifyIntent } from "@/lib/rag/intent-classifier"
import { evaluateRoute } from "@/lib/rag/router"
import { buildClarificationQuestions } from "@/lib/rag/clarification"
import { retrieveContext } from "@/lib/rag/retriever"
import { matchProducts, matchShampooProducts, matchConditionerProducts } from "@/lib/rag/product-matcher"
import { synthesizeResponse } from "@/lib/rag/synthesizer"
import { mapProteinMoistureToConcernCode } from "@/lib/rag/conditioner-mapper"
import {
  annotateShampooRecommendations,
  buildShampooClarificationQuestions,
  buildShampooDecision,
  buildShampooRetrievalFilter,
} from "@/lib/rag/shampoo-decision"
import { mapProfileToLeaveInConcernCodes } from "@/lib/rag/leave-in-mapper"
import { rerankLeaveInProducts } from "@/lib/rag/leave-in-reranker"
import { buildMaskConcernSearchOrder } from "@/lib/rag/mask-mapper"
import { deriveMaskDecision, rerankMaskProducts } from "@/lib/rag/mask-reranker"
import { SOURCE_TYPE_LABELS } from "@/lib/vocabulary"
import { formatSourceName } from "@/lib/rag/source-names"
import { generateConversationTitle } from "@/lib/rag/title-generator"
import { emitRouterEvent } from "@/lib/rag/retrieval-telemetry"
import type { ProductLeaveInSpecs } from "@/lib/leave-in/constants"
import type { ProductMaskSpecs } from "@/lib/mask/constants"
import { PRODUCT_INTENTS } from "@/lib/rag/retrieval-constants"
import type {
  IntentType,
  Message,
  HairProfile,
  Product,
  EnrichedCitationSource,
  RouterDecision,
  MaskDecision,
  ShampooDecision,
} from "@/lib/types"

export interface PipelineParams {
  message: string
  conversationId?: string
  userId: string
  imageUrl?: string
}

export interface PipelineResult {
  stream: ReadableStream<Uint8Array>
  conversationId: string
  intent: IntentType
  matchedProducts: Product[]
  sources: EnrichedCitationSource[]
  routerDecision: RouterDecision
  categoryDecision?: ShampooDecision
  /** Retrieval summary for the done event */
  retrievalSummary: {
    final_context_count: number
  }
}

/**
 * Orchestrates the full RAG pipeline for a single user turn:
 *
 * Step 0: If an image is attached, analyze it with the vision model.
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
  const { message, userId, imageUrl } = params
  let { conversationId } = params

  const supabase = createAdminClient()

  // ── Step 0: Image analysis (if applicable) ──────────────────────────
  let imageAnalysis: string | undefined
  if (imageUrl) {
    try {
      imageAnalysis = await analyzeImage(imageUrl, message)
    } catch (error) {
      console.error("Image analysis failed:", error)
      imageAnalysis = "Bildanalyse fehlgeschlagen. Bitte beschreibe dein Haar stattdessen."
    }
  }

  // ── Step 1: Classify intent + load hair profile (parallel) ─────────
  const [classification, hairProfileResult] = await Promise.all([
    classifyIntent(message, !!imageUrl),
    supabase
      .from("hair_profiles")
      .select("*")
      .eq("user_id", userId)
      .single(),
  ])
  const { intent, product_category } = classification
  const hairProfile: HairProfile | null = hairProfileResult.data ?? null
  let shampooDecision = product_category === "shampoo"
    ? buildShampooDecision(hairProfile)
    : undefined

  // Pre-compute concern codes for category-specific metadata filtering
  const conditionerConcern = product_category === "conditioner"
    ? mapProteinMoistureToConcernCode(hairProfile?.protein_moisture_balance)
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
  const routerDecision = evaluateRoute(classification, conversationHistory, hairProfile)

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
      imageAnalysis,
      intent,
      productCategory: product_category,
      shampooDecision,
      clarificationQuestions,
    })

    return {
      stream,
      conversationId: conversationId!,
      intent,
      matchedProducts: [],
      sources,
      routerDecision,
      categoryDecision: shampooDecision,
      retrievalSummary: {
        final_context_count: ragChunks.length,
      },
    }
  }

  // ── Normal branch: full retrieval + product matching ────────────────

  // ── Step 2: Retrieve context chunks ─────────────────────────────────
  // Build metadata filter based on intent and category
  let metadataFilter = buildShampooRetrievalFilter(intent, product_category, shampooDecision)
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
  let matchedProducts = undefined
  let maskDecision: MaskDecision | undefined
  if (PRODUCT_INTENTS.includes(intent)) {
    if (product_category === "shampoo") {
      if (!shampooDecision?.eligible || !hairProfile?.thickness || !hairProfile?.scalp_type || !hairProfile?.scalp_condition) {
        matchedProducts = []
      } else {
        const shampooCandidates = await matchShampooProducts({
          query: message,
          thickness: hairProfile.thickness,
          scalpType: hairProfile.scalp_type,
          scalpCondition: hairProfile.scalp_condition,
          count: 3,
        })
        shampooDecision = buildShampooDecision(hairProfile, shampooCandidates.length)
        matchedProducts = annotateShampooRecommendations(shampooCandidates, shampooDecision)
      }
    } else if (product_category === "conditioner") {
      if (!hairProfile?.thickness || !hairProfile?.protein_moisture_balance) {
        matchedProducts = []
      } else {
        matchedProducts = await matchConditionerProducts({
          query: message,
          thickness: hairProfile.thickness,
          proteinMoistureBalance: hairProfile.protein_moisture_balance,
          count: 3,
        })
      }
    } else if (product_category === "leave_in") {
      const leaveInCandidates = await matchProducts({
        query: message,
        thickness: hairProfile?.thickness ?? undefined,
        concerns: mapProfileToLeaveInConcernCodes(hairProfile),
        category: "leave_in",
        count: 10,
      })

      if (leaveInCandidates.length === 0) {
        matchedProducts = []
      } else {
        const { data: leaveInSpecs, error: leaveInSpecsError } = await supabase
          .from("product_leave_in_specs")
          .select("*")
          .in("product_id", leaveInCandidates.map((candidate) => candidate.id))

        if (leaveInSpecsError) {
          console.error("Failed to load leave-in specs for reranking:", leaveInSpecsError)
          matchedProducts = leaveInCandidates
        } else {
          matchedProducts = rerankLeaveInProducts(
            leaveInCandidates,
            (leaveInSpecs ?? []) as ProductLeaveInSpecs[],
            hairProfile
          ).slice(0, 3)
        }
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

  // ── Step 5: Synthesize streaming response ───────────────────────────
  const stream = await synthesizeResponse({
    userMessage: message,
    conversationHistory,
    hairProfile,
    ragChunks,
    imageAnalysis,
    products: matchedProducts,
    intent,
    productCategory: product_category,
    maskDecision: product_category === "mask" ? maskDecision : undefined,
    shampooDecision,
  })

  return {
    stream,
    conversationId: conversationId!,
    intent,
    matchedProducts: matchedProducts ?? [],
    sources,
    routerDecision,
    categoryDecision: shampooDecision,
    retrievalSummary: {
      final_context_count: ragChunks.length,
    },
  }
}
