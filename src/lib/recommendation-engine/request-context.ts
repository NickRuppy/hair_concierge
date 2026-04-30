import { inferOilNoRecommendationReason, inferOilPurposeFromMessage } from "@/lib/oil/purpose"
import type {
  EngineCategoryId,
  RecommendationRequestContext,
} from "@/lib/recommendation-engine/types"

export function emptyRecommendationRequestContext(): RecommendationRequestContext {
  return {
    requestedCategory: null,
    maskIntensityRequest: null,
    leaveInHeatProtectionRequest: null,
    leaveInWeightRequest: null,
    leaveInConditionerRelationshipRequest: null,
    leaveInRequestedFormats: [],
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

function inferLeaveInWeightRequestFromMessage(message: string): "light" | null {
  const normalized = normalizeMessage(message)

  if (
    /\bbeschwer\w*\b|\bnicht\s+beschwer\w*\b|\bohne\s+zu\s+beschwer\w*\b|\bleicht(?:e|er|es|en)?\b|\bschwerelos\w*\b|\bweightless\b/.test(
      normalized,
    )
  ) {
    return "light"
  }

  return null
}

function inferLeaveInConditionerRelationshipRequestFromMessage(
  message: string,
): "replacement_capable" | "booster_only" | null {
  const normalized = normalizeMessage(message)

  if (
    /\bersetz\w*\b|\bstatt\s+(?:spuelung|conditioner)\b|\bohne\s+(?:spuelung|conditioner)\b/.test(
      normalized,
    )
  ) {
    return "replacement_capable"
  }

  if (/\bextra(?:pflege)?\b|\bbooster\b|\bzusaetzlich\w*\b|\berganz\w*\b/.test(normalized)) {
    return "booster_only"
  }

  return null
}

function inferLeaveInRequestedFormatsFromMessage(
  message: string,
): RecommendationRequestContext["leaveInRequestedFormats"] {
  const normalized = normalizeMessage(message)
  const formats: RecommendationRequestContext["leaveInRequestedFormats"] = []
  const add = (format: RecommendationRequestContext["leaveInRequestedFormats"][number]) => {
    if (!formats.includes(format)) formats.push(format)
  }

  if (/\bspray\w*\b|\bsprueh\w*\b|\bspruh\w*\b/.test(normalized)) add("spray")
  if (/\bcreme\w*\b|\bcream\w*\b/.test(normalized)) add("cream")
  if (/\blotion\w*\b/.test(normalized)) add("lotion")
  if (/\bmilk\b|\bmilch\w*\b/.test(normalized)) add("milk")
  if (/\bserum\w*\b/.test(normalized)) add("serum")

  return formats
}

function normalizeMessage(message: string): string {
  return message
    .toLocaleLowerCase("de-DE")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

function inferLeaveInHeatProtectionRequestFromMessage(message: string): "high" | null {
  const normalized = normalizeMessage(message)

  if (
    /\bhitzeschutz\w*\b|\bhitze\s*schutz\w*\b|\bwaermeschutz\w*\b|\bthermoschutz\w*\b|\bheat[-\s]?protect\w*\b|\bpre[-\s]?heat\b|\bbis\s+\d{2,3}\s*(?:grad|°|c)\b/.test(
      normalized,
    )
  ) {
    return "high"
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
    leaveInHeatProtectionRequest:
      requestedCategory === "leave_in" || requestedCategory === "routine"
        ? inferLeaveInHeatProtectionRequestFromMessage(message)
        : null,
    leaveInWeightRequest:
      requestedCategory === "leave_in" || requestedCategory === "routine"
        ? inferLeaveInWeightRequestFromMessage(message)
        : null,
    leaveInConditionerRelationshipRequest:
      requestedCategory === "leave_in" || requestedCategory === "routine"
        ? inferLeaveInConditionerRelationshipRequestFromMessage(message)
        : null,
    leaveInRequestedFormats:
      requestedCategory === "leave_in" || requestedCategory === "routine"
        ? inferLeaveInRequestedFormatsFromMessage(message)
        : [],
    oilPurpose,
    oilNoRecommendationReason:
      requestedCategory === "oil" || requestedCategory === "routine"
        ? inferOilNoRecommendationReason(oilPurpose, message)
        : null,
  }
}
