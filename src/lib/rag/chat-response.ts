import type {
  IntentType,
  MessageRagContext,
  RouterDecision,
  ShampooDecision,
  CitationSource,
} from "@/lib/types"

export function buildAssistantRagContext(
  sources: CitationSource[],
  categoryDecision?: ShampooDecision
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
  categoryDecision?: ShampooDecision
}): Record<string, unknown> {
  const { intent, retrievalSummary, routerDecision, categoryDecision } = params

  return {
    intent,
    ...retrievalSummary,
    router_confidence: routerDecision.confidence,
    retrieval_mode: routerDecision.retrieval_mode,
    policy_overrides: routerDecision.policy_overrides,
    category_decision: categoryDecision ?? null,
  }
}
