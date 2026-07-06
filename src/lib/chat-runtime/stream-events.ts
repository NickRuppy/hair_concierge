import type {
  ChatCategoryDecision,
  IntentType,
  MessageRagContext,
  ProductIntakeOffer,
  ProductLookupClarification,
  ProductLookupSelectionContext,
  RecommendationEngineTrace,
  ResponseMode,
  RouterDecision,
  CitationSource,
} from "@/lib/types"

export type AssistantDecisionContextInput = {
  sources: CitationSource[]
  categoryDecision?: ChatCategoryDecision
  engineTrace?: RecommendationEngineTrace | null
  responseMode?: ResponseMode
  productIntakeOffer?: ProductIntakeOffer | null
  productLookupClarification?: ProductLookupClarification | null
  productLookupSelection?: ProductLookupSelectionContext | null
}

export function buildAssistantDecisionContext(
  params: AssistantDecisionContextInput,
): MessageRagContext | null {
  const {
    sources,
    categoryDecision,
    engineTrace,
    responseMode,
    productIntakeOffer,
    productLookupClarification,
    productLookupSelection,
  } = params

  if (
    sources.length === 0 &&
    !categoryDecision &&
    !engineTrace &&
    !responseMode &&
    !productIntakeOffer &&
    !productLookupClarification &&
    !productLookupSelection
  ) {
    return null
  }

  return {
    sources,
    category_decision: categoryDecision ?? null,
    engine_trace: engineTrace ?? null,
    response_mode: responseMode ?? null,
    product_intake_offer: productIntakeOffer ?? null,
    product_lookup_clarification: productLookupClarification ?? null,
    product_lookup_selection: productLookupSelection ?? null,
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
