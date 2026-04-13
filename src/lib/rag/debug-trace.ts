import type { RetrieveContextDebug, RetrievedChunk } from "@/lib/rag/retriever"
import type {
  CategoryDecision,
  ChatMatchedProductTrace,
  ChatPromptSnapshot,
  ChatRetrievedChunkTrace,
  ChatTraceLatencyBreakdown,
  ChatTurnTrace,
  CitationSource,
  ClassificationResult,
  HairProfile,
  LangfusePromptReference,
  Product,
  ProductCategory,
  RoutinePlan,
  RouterDecision,
} from "@/lib/types"

const CHAT_TURN_TRACE_VERSION = 1
const CONTENT_PREVIEW_LIMIT = 240

export interface PipelineTraceDraft {
  request_id: string
  started_at: string
  user_message: string
  conversation_id: string | null
  intent: ChatTurnTrace["intent"]
  product_category: ProductCategory
  conversation_history_count: number
  classification: ClassificationResult
  router_decision: RouterDecision
  clarification_questions: string[]
  hair_profile_snapshot: HairProfile | null
  memory_context: string | null
  retrieval: ChatTurnTrace["retrieval"]
  decision_context: {
    should_plan_routine: boolean
    routine_plan: RoutinePlan | null
    category_decision: CategoryDecision | null
    matched_products: ChatMatchedProductTrace[]
  }
  prompt_refs: {
    classification: LangfusePromptReference
    synthesis: LangfusePromptReference
  }
  prompt: ChatPromptSnapshot
  latencies_ms: ChatTraceLatencyBreakdown
}

function toContentPreview(content: string): string {
  return content.length > CONTENT_PREVIEW_LIMIT
    ? `${content.slice(0, CONTENT_PREVIEW_LIMIT)}...`
    : content
}

export function buildRetrievedChunkTrace(chunks: RetrievedChunk[]): ChatRetrievedChunkTrace[] {
  return chunks.map((chunk) => ({
    chunk_id: chunk.id,
    source_type: chunk.source_type,
    source_name: chunk.source_name,
    retrieval_path: chunk.retrieval_path,
    weighted_similarity: chunk.weighted_similarity,
    similarity: chunk.similarity,
    dense_score: chunk.dense_score,
    lexical_score: chunk.lexical_score,
    fused_score: chunk.fused_score,
    content_preview: toContentPreview(chunk.content),
  }))
}

export function buildMatchedProductTrace(products: Product[]): ChatMatchedProductTrace[] {
  return products.map((product) => ({
    id: product.id,
    name: product.name,
    brand: product.brand,
    category: product.category,
    score: product.recommendation_meta?.score ?? null,
    top_reasons: product.recommendation_meta?.top_reasons ?? [],
  }))
}

export function buildPipelineTraceDraft(params: {
  request_id: string
  started_at: string
  user_message: string
  conversation_id: string | null
  intent: ChatTurnTrace["intent"]
  product_category: ProductCategory
  conversation_history_count: number
  classification: ClassificationResult
  router_decision: RouterDecision
  clarification_questions?: string[]
  hair_profile_snapshot: HairProfile | null
  memory_context: string | null
  retrieval_debug: RetrieveContextDebug
  retrieval_count: number
  retrieved_chunks: RetrievedChunk[]
  should_plan_routine: boolean
  routine_plan?: RoutinePlan
  category_decision?: CategoryDecision
  matched_products?: Product[]
  classification_prompt_ref: LangfusePromptReference
  prompt: ChatPromptSnapshot
  latencies_ms: ChatTraceLatencyBreakdown
}): PipelineTraceDraft {
  const {
    request_id,
    started_at,
    user_message,
    conversation_id,
    intent,
    product_category,
    conversation_history_count,
    classification,
    router_decision,
    clarification_questions,
    hair_profile_snapshot,
    memory_context,
    retrieval_debug,
    retrieval_count,
    retrieved_chunks,
    should_plan_routine,
    routine_plan,
    category_decision,
    matched_products,
    classification_prompt_ref,
    prompt,
    latencies_ms,
  } = params

  return {
    request_id,
    started_at,
    user_message,
    conversation_id,
    intent,
    product_category,
    conversation_history_count,
    classification,
    router_decision,
    clarification_questions: clarification_questions ?? [],
    hair_profile_snapshot,
    memory_context,
    retrieval: {
      requested_count: retrieval_count,
      source_types: retrieval_debug.source_types,
      metadata_filter: retrieval_debug.metadata_filter,
      subqueries: retrieval_debug.subqueries,
      candidate_count_before_rerank: retrieval_debug.candidate_count_before_rerank,
      reranked_count: retrieval_debug.reranked_count,
      fallback_used: retrieval_debug.fallback_used,
      final_context_count: retrieved_chunks.length,
      chunks: buildRetrievedChunkTrace(retrieved_chunks),
    },
    decision_context: {
      should_plan_routine,
      routine_plan: routine_plan ?? null,
      category_decision: category_decision ?? null,
      matched_products: buildMatchedProductTrace(matched_products ?? []),
    },
    prompt_refs: {
      classification: classification_prompt_ref,
      synthesis: prompt.prompt_ref,
    },
    prompt,
    latencies_ms,
  }
}

export function finalizeChatTurnTrace(
  draft: PipelineTraceDraft,
  params: {
    assistant_content: string
    sources: CitationSource[]
    product_count: number
    status: ChatTurnTrace["status"]
    error?: string | null
    completed_at?: string
    stream_read_ms?: number
    total_ms?: number
  },
): ChatTurnTrace {
  const {
    assistant_content,
    sources,
    product_count,
    status,
    error,
    completed_at,
    stream_read_ms,
    total_ms,
  } = params

  return {
    trace_version: CHAT_TURN_TRACE_VERSION,
    request_id: draft.request_id,
    started_at: draft.started_at,
    completed_at: completed_at ?? new Date().toISOString(),
    status,
    user_message: draft.user_message,
    conversation_id: draft.conversation_id,
    intent: draft.intent,
    product_category: draft.product_category,
    conversation_history_count: draft.conversation_history_count,
    classification: draft.classification,
    router_decision: draft.router_decision,
    clarification_questions: draft.clarification_questions,
    hair_profile_snapshot: draft.hair_profile_snapshot,
    memory_context: draft.memory_context,
    retrieval: draft.retrieval,
    decision_context: draft.decision_context,
    prompt_refs: draft.prompt_refs,
    prompt: draft.prompt,
    response: {
      assistant_content,
      sources,
      product_count,
    },
    latencies_ms: {
      ...draft.latencies_ms,
      ...(stream_read_ms !== undefined ? { stream_read_ms } : {}),
      ...(total_ms !== undefined ? { total_ms } : {}),
    },
    error: error ?? null,
  }
}

export function buildRetrievalDebugEventData(draft: PipelineTraceDraft): Record<string, unknown> {
  return {
    request_id: draft.request_id,
    intent: draft.intent,
    product_category: draft.product_category,
    retrieval_mode: draft.router_decision.retrieval_mode,
    needs_clarification: draft.router_decision.needs_clarification,
    clarification_questions: draft.clarification_questions,
    policy_overrides: draft.router_decision.policy_overrides,
    subqueries: draft.retrieval.subqueries,
    metadata_filter: draft.retrieval.metadata_filter,
    final_context_count: draft.retrieval.final_context_count,
    matched_products: draft.decision_context.matched_products.map((product) => ({
      id: product.id,
      name: product.name,
      score: product.score,
    })),
  }
}
