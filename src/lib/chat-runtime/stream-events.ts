import type {
  ChatCategoryDecision,
  IntentType,
  MessageContext,
  ProductIntakeOffer,
  ProductLookupClarification,
  ProductLookupSelectionContext,
  RecommendationEngineTrace,
  ResponseMode,
  RouterDecision,
} from "@/lib/types"

export type AssistantMessageContextInput = {
  categoryDecision?: ChatCategoryDecision
  engineTrace?: RecommendationEngineTrace | null
  responseMode?: ResponseMode
  productIntakeOffer?: ProductIntakeOffer | null
  productLookupClarification?: ProductLookupClarification | null
  productLookupSelection?: ProductLookupSelectionContext | null
}

export function buildAssistantMessageContext(
  params: AssistantMessageContextInput,
): MessageContext | null {
  const {
    categoryDecision,
    engineTrace,
    responseMode,
    productIntakeOffer,
    productLookupClarification,
    productLookupSelection,
  } = params

  if (
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
  routerDecision: RouterDecision
  categoryDecision?: ChatCategoryDecision
}): Record<string, unknown> {
  const { intent, routerDecision, categoryDecision } = params

  return {
    intent,
    router_confidence: routerDecision.confidence,
    response_mode: routerDecision.response_mode,
    needs_clarification: routerDecision.response_mode === "clarify_only",
    policy_overrides: routerDecision.policy_overrides,
    category_decision: categoryDecision ?? null,
  }
}
