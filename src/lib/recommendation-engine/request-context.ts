import { inferOilNoRecommendationReason, inferOilPurposeFromMessage } from "@/lib/oil/purpose"
import type {
  EngineCategoryId,
  RecommendationRequestContext,
} from "@/lib/recommendation-engine/types"

export function emptyRecommendationRequestContext(): RecommendationRequestContext {
  return {
    requestedCategory: null,
    oilPurpose: null,
    oilNoRecommendationReason: null,
  }
}

export function buildRecommendationRequestContext(params: {
  requestedCategory: EngineCategoryId | null
  message: string
}): RecommendationRequestContext {
  const { requestedCategory, message } = params
  const oilPurpose =
    requestedCategory === "oil" || requestedCategory === "routine"
      ? inferOilPurposeFromMessage(message)
      : null

  return {
    requestedCategory,
    oilPurpose,
    oilNoRecommendationReason:
      requestedCategory === "oil" || requestedCategory === "routine"
        ? inferOilNoRecommendationReason(oilPurpose, message)
        : null,
  }
}
