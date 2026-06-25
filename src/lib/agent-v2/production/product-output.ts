import type { SelectProductsToolResult } from "@/lib/agent/tools/select-products"
import type { AgentV2CareCategory, AgentV2TerminalAnswer } from "@/lib/agent-v2/contracts"
import { collectSurfacedProductIds } from "@/lib/agent-v2/production/session-state"
import {
  buildRecommendationEngineTrace,
  getRuntimeCategoryDecision,
} from "@/lib/recommendation-engine"
import type {
  ChatCategoryDecision,
  ClassificationResult,
  IntentType,
  Product,
  ProductCategory,
  RecommendationEngineTrace,
  ResponseMode,
  RouterDecision,
} from "@/lib/types"

export function deriveMatchedProducts(params: {
  answer: AgentV2TerminalAnswer
  selectedProductResults: SelectProductsToolResult[]
}): Product[] {
  const surfacedProductIds = collectSurfacedProductIds(params.answer)
  const productsById = new Map<string, Product>()

  for (const result of params.selectedProductResults) {
    for (const product of result.products) {
      productsById.set(product.id, product)
    }
  }

  const surfacedProducts = surfacedProductIds.flatMap((productId) => {
    const product = productsById.get(productId)
    return product ? [product] : []
  })

  if (surfacedProductIds.length > 0) return surfacedProducts
  if (params.answer.answer_mode !== "product_recommendation") return []

  return params.selectedProductResults.at(-1)?.products ?? []
}

export function deriveSelectedProductsResultForAnswer(params: {
  answer: AgentV2TerminalAnswer
  selectedProductResults: SelectProductsToolResult[]
}): SelectProductsToolResult | null {
  const surfacedProductIds = new Set(collectSurfacedProductIds(params.answer))

  if (surfacedProductIds.size > 0) {
    return (
      params.selectedProductResults.find((result) =>
        result.products.some((product) => surfacedProductIds.has(product.id)),
      ) ??
      params.selectedProductResults.find((result) =>
        result.projection.products.some((product) => surfacedProductIds.has(product.product_id)),
      ) ??
      null
    )
  }

  if (params.answer.answer_mode !== "product_recommendation") return null
  return params.selectedProductResults.at(-1) ?? null
}

export function deriveEngineArtifacts(selectedProductsResult: SelectProductsToolResult | null): {
  categoryDecision: ChatCategoryDecision | undefined
  engineTrace: RecommendationEngineTrace | undefined
} {
  if (!selectedProductsResult) {
    return {
      categoryDecision: undefined,
      engineTrace: undefined,
    }
  }

  const productCategory = selectedProductsResult.projection.category as ProductCategory
  return {
    categoryDecision: getRuntimeCategoryDecision(
      selectedProductsResult.runtime,
      productCategory,
    ) as ChatCategoryDecision | undefined,
    engineTrace: buildRecommendationEngineTrace({
      runtime: selectedProductsResult.runtime,
    }),
  }
}

export function deriveIntent(answer: AgentV2TerminalAnswer): IntentType {
  if (answer.answer_mode === "social" || answer.answer_mode === "domain_boundary") {
    return "general_chat"
  }
  if (answer.answer_mode === "product_recommendation") return "product_recommendation"
  if (
    answer.answer_mode === "routine" ||
    answer.request_interpretation.primary_intent.startsWith("routine_")
  ) {
    return "routine_help"
  }
  if (answer.answer_mode === "general_advice" || answer.answer_mode === "safety_boundary") {
    return "hair_care_advice"
  }
  return "general_chat"
}

export function deriveProductCategory(answer: AgentV2TerminalAnswer): ProductCategory {
  if (answer.answer_mode === "social" || answer.answer_mode === "domain_boundary") return null
  if (answer.answer_mode === "routine") return "routine"
  return toProductCategory(answer.request_interpretation.care_category)
}

export function toProductCategory(
  category: AgentV2CareCategory | string | null | undefined,
): ProductCategory {
  return category === "shampoo" ||
    category === "conditioner" ||
    category === "mask" ||
    category === "oil" ||
    category === "leave_in" ||
    category === "bondbuilder" ||
    category === "deep_cleansing_shampoo" ||
    category === "dry_shampoo" ||
    category === "peeling"
    ? category
    : null
}

export function buildAgentV2RouterDecision(params: {
  answer: AgentV2TerminalAnswer
  visibleFailure: boolean
}): RouterDecision {
  const responseMode = deriveResponseMode(params.answer, params.visibleFailure)
  const policyOverrides = ["agent_v2", "care_balance"]

  if (params.visibleFailure) {
    policyOverrides.push("visible_failure")
  }

  if (params.answer.answer_mode === "product_recommendation") {
    policyOverrides.push("product_policy:recommend")
  }

  const missingProfileOverride = deriveMissingProfileOverride(params.answer)
  if (missingProfileOverride) {
    policyOverrides.push(missingProfileOverride)
  }

  return {
    retrieval_mode: "agent_v2_responses",
    response_mode: responseMode,
    clarification_reason:
      responseMode === "clarify_only" && params.answer.missing_information[0]
        ? params.answer.missing_information[0].key
        : responseMode === "clarify_only" && params.visibleFailure
          ? "agent_v2_visible_failure"
          : undefined,
    slot_completeness: responseMode === "clarify_only" ? 0.5 : 1,
    confidence: params.visibleFailure ? 0 : params.answer.confidence,
    policy_overrides: policyOverrides,
  }
}

function deriveMissingProfileOverride(answer: AgentV2TerminalAnswer): string | null {
  if (answer.answer_mode !== "clarification") return null
  if (!answer.missing_information.some((item) => item.blocking)) return null

  const category = answer.request_interpretation.care_category
  if (
    category === "shampoo" ||
    category === "conditioner" ||
    category === "leave_in" ||
    category === "oil" ||
    category === "mask"
  ) {
    return `missing_${category}_profile`
  }

  return null
}

export function buildAgentV2Classification(params: {
  answer: AgentV2TerminalAnswer
  intent: IntentType
  productCategory: ProductCategory
  routerDecision: RouterDecision
}): ClassificationResult {
  return {
    intent: params.intent,
    product_category: params.productCategory,
    complexity:
      params.answer.extracted_constraints.raw_constraints.length > 1
        ? "multi_constraint"
        : "simple",
    needs_clarification: params.routerDecision.response_mode === "clarify_only",
    retrieval_mode: params.routerDecision.retrieval_mode,
    normalized_filters: {
      engine: "agent_v2_care_balance",
      answer_mode: params.answer.answer_mode,
      primary_intent: params.answer.request_interpretation.primary_intent,
      product_request_kind: params.answer.request_interpretation.product_request_kind,
      care_category: params.answer.request_interpretation.care_category,
    },
    router_confidence: params.routerDecision.confidence,
  }
}

function deriveResponseMode(answer: AgentV2TerminalAnswer, visibleFailure: boolean): ResponseMode {
  return visibleFailure || answer.answer_mode === "clarification" ? "clarify_only" : "answer_direct"
}
