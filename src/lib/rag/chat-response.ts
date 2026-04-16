import type {
  ChatCategoryDecision,
  IntentType,
  MessageRagContext,
  RecommendationEngineTrace,
  ResponseMode,
  RouterDecision,
  CitationSource,
} from "@/lib/types"

export function buildAssistantRagContext(
  sources: CitationSource[],
  categoryDecision?: ChatCategoryDecision,
  engineTrace?: RecommendationEngineTrace | null,
  responseMode?: ResponseMode,
): MessageRagContext | null {
  if (sources.length === 0 && !categoryDecision && !engineTrace && !responseMode) {
    return null
  }

  return {
    sources,
    category_decision: categoryDecision ?? null,
    engine_trace: engineTrace ?? null,
    response_mode: responseMode ?? null,
  }
}

export function buildDoneEventData(params: {
  intent: IntentType
  retrievalSummary: { final_context_count: number }
  routerDecision: RouterDecision
  categoryDecision?: ChatCategoryDecision
}): Record<string, unknown> {
  const { intent, retrievalSummary, routerDecision, categoryDecision } = params

  return {
    intent,
    ...retrievalSummary,
    router_confidence: routerDecision.confidence,
    retrieval_mode: routerDecision.retrieval_mode,
    response_mode: routerDecision.response_mode,
    needs_clarification: routerDecision.response_mode === "clarify_only",
    policy_overrides: routerDecision.policy_overrides,
    category_decision: categoryDecision ?? null,
  }
}
