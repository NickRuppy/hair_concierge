import { inferOilNoRecommendationReason, inferOilPurposeFromMessage } from "@/lib/oil/purpose"
import type {
  EngineCategoryId,
  RecommendationRequestContext,
} from "@/lib/recommendation-engine/types"
import type { OilPurpose } from "@/lib/oil/constants"

export function emptyRecommendationRequestContext(): RecommendationRequestContext {
  return {
    requestedCategory: null,
    oilPurpose: null,
    storedRoutineOilPurpose: null,
    oilNoRecommendationReason: null,
  }
}

export function buildRecommendationRequestContext(params: {
  requestedCategory: EngineCategoryId | null
  message: string
  storedRoutineOilPurpose?: OilPurpose | null
}): RecommendationRequestContext {
  const { requestedCategory, message, storedRoutineOilPurpose = null } = params
  const oilPurpose =
    requestedCategory === "oil" || requestedCategory === "routine"
      ? inferOilPurposeFromMessage(message)
      : null

  return {
    requestedCategory,
    oilPurpose,
    storedRoutineOilPurpose,
    oilNoRecommendationReason:
      requestedCategory === "oil" || requestedCategory === "routine"
        ? inferOilNoRecommendationReason(oilPurpose, message)
        : null,
  }
}
