import type {
  IntentType,
  MessageRagContext,
  RouterDecision,
  CategoryDecision,
  CitationSource,
} from "@/lib/types"

export function buildAssistantRagContext(
  sources: CitationSource[],
  categoryDecision?: CategoryDecision
): MessageRagContext | null {
  if (sources.length === 0 && !categoryDecision) {
    return null
  }

  return {
    sources,
    category_decision: categoryDecision ?? null,
  }
}

export function buildDoneEventData(params: {
  intent: IntentType
  retrievalSummary: { final_context_count: number }
  routerDecision: RouterDecision
  categoryDecision?: CategoryDecision
}): Record<string, unknown> {
  const { intent, retrievalSummary, routerDecision, categoryDecision } = params

  return {
    intent,
    ...retrievalSummary,
    router_confidence: routerDecision.confidence,
    retrieval_mode: routerDecision.retrieval_mode,
    needs_clarification: routerDecision.needs_clarification,
    policy_overrides: routerDecision.policy_overrides,
    category_decision: categoryDecision ?? null,
  }
}
