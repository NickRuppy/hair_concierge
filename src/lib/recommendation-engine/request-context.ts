import { inferOilNoRecommendationReason, inferOilPurposeFromMessage } from "@/lib/oil/purpose"
import type {
  EngineCategoryId,
  RecommendationRequestContext,
} from "@/lib/recommendation-engine/types"

export function emptyRecommendationRequestContext(): RecommendationRequestContext {
  return {
    requestedCategory: null,
    maskIntensityRequest: null,
    oilPurpose: null,
    oilNoRecommendationReason: null,
  }
}

function inferMaskIntensityRequestFromMessage(message: string): "intensive" | null {
  const normalized = message
    .toLocaleLowerCase("de-DE")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")

  if (
    /\bintensiv\w*\b|\btiefenpflege\b|\breparatur(?:maske|kur)?\b|\brepair(?:\s+mask)?\b/.test(
      normalized,
    )
  ) {
    return "intensive"
  }

  return null
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
    maskIntensityRequest:
      requestedCategory === "mask" || requestedCategory === "routine"
        ? inferMaskIntensityRequestFromMessage(message)
        : null,
    oilPurpose,
    oilNoRecommendationReason:
      requestedCategory === "oil" || requestedCategory === "routine"
        ? inferOilNoRecommendationReason(oilPurpose, message)
        : null,
  }
}
