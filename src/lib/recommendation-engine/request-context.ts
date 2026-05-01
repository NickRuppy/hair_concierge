import { inferOilNoRecommendationReason, inferOilPurposeFromMessage } from "@/lib/oil/purpose"
import type {
  EngineCategoryId,
  RecommendationRequestContext,
  ResetFocus,
  ResetTriggerSource,
} from "@/lib/recommendation-engine/types"

export function emptyRecommendationRequestContext(): RecommendationRequestContext {
  return {
    requestedCategory: null,
    resetTriggerTerms: [],
    resetTriggerSources: [],
    resetFocusRequest: null,
    colorSafeRequest: false,
    scalpTreatmentIntent: false,
    maskIntensityRequest: null,
    leaveInHeatProtectionRequest: null,
    leaveInSeparateHeatProtectantMentioned: false,
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

function inferResetSignalsFromMessage(message: string): {
  terms: string[]
  sources: ResetTriggerSource[]
  focus: ResetFocus | null
  colorSafeRequest: boolean
  scalpTreatmentIntent: boolean
} {
  const normalized = normalizeMessage(message)
  const terms = new Set<string>()
  const sources = new Set<ResetTriggerSource>()
  let focus: ResetFocus | null = null

  const add = (term: string, source: ResetTriggerSource) => {
    terms.add(term)
    sources.add(source)
  }

  if (
    /\btiefenreinig\w*\b|\breinigungsshampoo\b|\bclarify(?:ing)?\b|\bclarifying\s+shampoo\b|\bdetox\s+shampoo\b|\breset\b|\baufbau(?:-|\s*)reset\b|\bbuildup\b|\bbuild[-\s]?up\b/.test(
      normalized,
    )
  ) {
    add("explicit_reset_request", "explicit_request")
  }

  if (
    /\bbelegt\w*\b|\bwachsig\w*\b|\bbeschwert\w*\b|\bstumpf\w*\b|\bstraehnig\w*\b|\bsträhnig\w*\b|\bklebrig\w*\b|\bproduktig\w*\b|\bfettig\s+nach\s+dem\s+waschen\b|\bpflege\s+wirkt\s+nicht\b|\bprodukte?\s+(?:wirken|funktionieren)\s+nicht\b/.test(
      normalized,
    )
  ) {
    add("coated_heavy_or_waxy_hair", "symptom")
  }

  if (
    /\bkalk\w*\b|\bharte[msn]?\s+wasser\b|\bhartes\s+wasser\b|\bhard\s+water\b|\bchlor\w*\b|\bschwimm\w*\b|\bpool\b|\bmineral\w*\b|\bmetall\w*\b|\bmetal\w*\b/.test(
      normalized,
    )
  ) {
    add("mineral_chlorine_or_hard_water_context", "environment")
    focus = "mineral_chlorine"
  }

  if (
    /\bstyling\s*reste\b|\bproduktreste\b|\bproduktablager\w*\b|\bablager\w*\b|\bbuild[-\s]?up\b|\bbuildup\b/.test(
      normalized,
    )
  ) {
    add("general_product_buildup_context", "symptom")
    if (!focus) focus = "general_buildup"
  }

  if (
    focus === "mineral_chlorine" &&
    (terms.has("explicit_reset_request") || terms.has("general_product_buildup_context"))
  ) {
    focus = "broad_spectrum"
  }

  return {
    terms: Array.from(terms),
    sources: Array.from(sources),
    focus,
    colorSafeRequest:
      /\bfarbschon\w*\b|\bcolor[-\s]?safe\b|\bcolor[-\s]?treated\b|\bgefärbt\w*\b|\bgefarbt\w*\b/.test(
        normalized,
      ),
    scalpTreatmentIntent:
      /\bschuppen\b|\bjuck\w*\b|\bjuckreiz\b|\bgereizt\w*\b|\birritation\b|\bekzem\b|\bseb(?:orrhoisch\w*)?\b|\bhaarausfall\b|\bhair\s*loss\b/.test(
        normalized,
      ),
  }
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

function inferLeaveInSeparateHeatProtectantMentionedFromMessage(message: string): boolean {
  const normalized = normalizeMessage(message)

  if (
    !/\bhitzeschutz\w*\b|\bhitze\s*schutz\w*\b|\bwaermeschutz\w*\b|\bthermoschutz\w*\b|\bheat[-\s]?protect\w*\b/.test(
      normalized,
    )
  ) {
    return false
  }

  return (
    /\b(?:habe|hab|nutze|benutze|verwende|nehm(?:e)?)\b.{0,80}\b(?:schon|bereits|separat\w*|eigen\w*|extra)\b.{0,80}\b(?:hitzeschutz\w*|hitze\s*schutz\w*|waermeschutz\w*|thermoschutz\w*|heat[-\s]?protect\w*)\b/.test(
      normalized,
    ) ||
    /\b(?:schon|bereits|separat\w*|eigen\w*|extra)\b.{0,80}\b(?:hitzeschutz\w*|hitze\s*schutz\w*|waermeschutz\w*|thermoschutz\w*|heat[-\s]?protect\w*)\b/.test(
      normalized,
    ) ||
    /\b(?:hitzeschutz\w*|hitze\s*schutz\w*|waermeschutz\w*|thermoschutz\w*|heat[-\s]?protect\w*)\b.{0,80}\b(?:schon|bereits|separat\w*|eigen\w*|extra)\b/.test(
      normalized,
    )
  )
}

export function buildRecommendationRequestContext(params: {
  requestedCategory: EngineCategoryId | null
  message: string
}): RecommendationRequestContext {
  const { requestedCategory, message } = params
  const supportsLeaveInRequests =
    requestedCategory === "leave_in" || requestedCategory === "routine"
  const leaveInSeparateHeatProtectantMentioned = supportsLeaveInRequests
    ? inferLeaveInSeparateHeatProtectantMentionedFromMessage(message)
    : false
  const oilPurpose =
    requestedCategory === "oil" || requestedCategory === "routine"
      ? inferOilPurposeFromMessage(message)
      : null
  const resetSignals =
    requestedCategory === "deep_cleansing_shampoo" || requestedCategory === "routine"
      ? inferResetSignalsFromMessage(message)
      : inferResetSignalsFromMessage(message)

  return {
    requestedCategory,
    resetTriggerTerms: resetSignals.terms,
    resetTriggerSources: resetSignals.sources,
    resetFocusRequest: resetSignals.focus,
    colorSafeRequest: resetSignals.colorSafeRequest,
    scalpTreatmentIntent: resetSignals.scalpTreatmentIntent,
    maskIntensityRequest:
      requestedCategory === "mask" || requestedCategory === "routine"
        ? inferMaskIntensityRequestFromMessage(message)
        : null,
    leaveInHeatProtectionRequest:
      supportsLeaveInRequests && !leaveInSeparateHeatProtectantMentioned
        ? inferLeaveInHeatProtectionRequestFromMessage(message)
        : null,
    leaveInSeparateHeatProtectantMentioned,
    leaveInWeightRequest: supportsLeaveInRequests
      ? inferLeaveInWeightRequestFromMessage(message)
      : null,
    leaveInConditionerRelationshipRequest: supportsLeaveInRequests
      ? inferLeaveInConditionerRelationshipRequestFromMessage(message)
      : null,
    leaveInRequestedFormats: supportsLeaveInRequests
      ? inferLeaveInRequestedFormatsFromMessage(message)
      : [],
    oilPurpose,
    oilNoRecommendationReason:
      requestedCategory === "oil" || requestedCategory === "routine"
        ? inferOilNoRecommendationReason(oilPurpose, message)
        : null,
  }
}
