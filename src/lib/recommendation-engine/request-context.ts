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
    dryShampooBridgeNeedReasonCodes: [],
    dryShampooCautionReasonCodes: [],
    dryShampooPrimaryEffectRequest: null,
    dryShampooHairColorFitRequest: null,
    dryShampooRequiresSensitiveFit: false,
    dryShampooPreferredFormat: null,
    dryShampooAvoidAerosol: false,
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
    add("metal_mineral_hard_water_or_hard_water_context", "environment")
    focus = "metal_mineral_hard_water"
  }

  if (
    /\bstyling\s*reste\b|\bproduktreste\b|\bproduktablager\w*\b|\bablager\w*\b|\bbuild[-\s]?up\b|\bbuildup\b/.test(
      normalized,
    )
  ) {
    add("general_product_buildup_context", "symptom")
    if (!focus) focus = "product_sebum_buildup"
  }

  if (
    focus === "metal_mineral_hard_water" &&
    (terms.has("explicit_reset_request") || terms.has("general_product_buildup_context"))
  ) {
    focus = "broad_spectrum_detox"
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

function inferDryShampooSignalsFromMessage(message: string): {
  bridgeNeedReasonCodes: string[]
  cautionReasonCodes: string[]
  primaryEffectRequest: RecommendationRequestContext["dryShampooPrimaryEffectRequest"]
  hairColorFitRequest: RecommendationRequestContext["dryShampooHairColorFitRequest"]
  requiresSensitiveFit: boolean
  preferredFormat: RecommendationRequestContext["dryShampooPreferredFormat"]
  avoidAerosol: boolean
} {
  const normalized = normalizeMessage(message)
  const bridge = new Set<string>()
  const caution = new Set<string>()

  const mentionsDryShampoo =
    /\btrockenshampoo\w*\b|\btrocken[-\s]*shampoo\w*\b|\bdry[-\s]*shampoo\w*\b/.test(normalized)
  const cannotWashToday =
    /\b(?:kann|schaffe|geht)\b.{0,50}\b(?:heute|jetzt|gerade)\b.{0,50}\b(?:nicht\s+)?wasch\w*\b|\bkeine\s+zeit\b.{0,50}\bwasch\w*\b/.test(
      normalized,
    )
  const explicitBetweenWash =
    /\bbetween[-\s]?wash\b|\bzwischen\s+(?:den\s+)?waeschen\b|\bzwischen\s+(?:den\s+)?waschen\b|\btag\s*2\b|\bday\s*2\b|\bzweiter\s+tag\b/.test(
      normalized,
    )
  const emergency =
    /\bnotfall\w*\b|\bemergency\b|\blast[-\s]?minute\b|\bkurzfristig\w*\b|\breise\w*\b|\bunterwegs\b/.test(
      normalized,
    )
  const sameDay = /\b(?:heute|jetzt|gerade)\b/.test(normalized)
  const postWorkout = /\bsport\b|\bworkout\b|\btraining\b|\bgeschwitzt\w*\b/.test(normalized)
  const rootRefresh =
    /\bauffrisch\w*\b|\brefresh\w*\b/.test(normalized) && /\bansatz\b/.test(normalized)
  const greasyRoot = /\bansatz\b.{0,40}\bfettig\w*\b|\bfettig\w*\b.{0,40}\bansatz\b/.test(
    normalized,
  )
  const hasDryShampooBridgeContext =
    mentionsDryShampoo || explicitBetweenWash || cannotWashToday || emergency || postWorkout
  const betweenWash =
    explicitBetweenWash ||
    cannotWashToday ||
    (rootRefresh && (hasDryShampooBridgeContext || sameDay)) ||
    (greasyRoot && hasDryShampooBridgeContext)
  const volumeTexture =
    /\bvolumen\b|\bgrip\b|\bgriff\b|\btextur\w*\b|\bstand\b.{0,30}\bansatz\b|\bansatzvolumen\b/.test(
      normalized,
    )
  const colorCast =
    /\bweiss(?:er|e|en)?\s+schleier\b|\bwhite\s*cast\b|\bgrau(?:er|e|en)?\s+schleier\b|\brueckstaend\w*\b|\bruckstaend\w*\b/.test(
      normalized,
    )
  const routineNeedQuestion =
    /\b(?:routine|aufnehmen|einbauen|brauche\s+ich|sollte\s+ich|soll\s+ich)\b/.test(normalized)
  const directDryShampooProductAsk =
    mentionsDryShampoo &&
    !routineNeedQuestion &&
    /\b(?:welch\w*|empfiehl\w*|empfehl\w*|passt|nehmen|kaufen)\b/.test(normalized)

  if (directDryShampooProductAsk) bridge.add("dry_shampoo_explicit_bridge_request")
  if (betweenWash || cannotWashToday) bridge.add("dry_shampoo_between_wash_bridge_needed")
  if (cannotWashToday || emergency) bridge.add("dry_shampoo_emergency_refresh")
  if (postWorkout) bridge.add("dry_shampoo_post_workout_refresh")
  if (volumeTexture) bridge.add("dry_shampoo_volume_texture_request")
  if (colorCast) bridge.add("dry_shampoo_color_cast_concern")

  if (
    /\bjuck\w*\b|\bjuckreiz\b|\bschuppen\b|\bschupp\w*\b|\bgereizt\w*\b|\birrit\w*\b|\bbrenn\w*\b|\bschmerz\w*\b|\bwund\w*\b|\bpickel\w*\b|\bbeulen\w*\b|\bakne\b|\bhaarausfall\b|\bshedding\b/.test(
      normalized,
    )
  ) {
    caution.add("dry_shampoo_scalp_issue_hard_no")
  }

  if (
    /\bbelegt\w*\b|\bwachsig\w*\b|\bklebrig\w*\b|\bproduktig\w*\b|\bbuildup\b|\bbuild[-\s]?up\b|\bablager\w*\b/.test(
      normalized,
    )
  ) {
    caution.add("dry_shampoo_buildup_hard_no")
  }

  const frequentDryShampooUse =
    /\b(?:jeden|fast\s+jeden|taeglich|taglich)\s+tag\b.{0,60}\btrockenshampoo\b|\btrockenshampoo\b.{0,60}\b(?:jeden|fast\s+jeden|taeglich|taglich)\s+tag\b/.test(
      normalized,
    ) ||
    (mentionsDryShampoo &&
      (/\b(?:3|4|drei|vier)\s*(?:-|bis)?\s*(?:4|vier)?\s*x\b.{0,30}\b(?:pro\s+)?woche\b/.test(
        normalized,
      ) ||
        /\bmehrmals\b.{0,20}\b(?:pro\s+)?woche\b/.test(normalized) ||
        /\b(?:alle\s+paar|alle\s+2|alle\s+zwei)\s+tage\b/.test(normalized) ||
        /\b(?:3|4|drei|vier)\s*mal\b.{0,30}\b(?:pro\s+)?woche\b/.test(normalized)))

  if (frequentDryShampooUse) {
    caution.add("dry_shampoo_frequent_use_reset_needed")
  }

  const normalizedWithoutDryShampooTerms = normalized.replace(
    /\btrockenshampoo\w*\b|\btrocken[-\s]*shampoo\w*\b|\bdry[-\s]*shampoo\w*\b/g,
    " ",
  )
  const breakageDominant =
    /\bbruch\w*\b|\bbruechig\w*\b|\bbruchig\w*\b|\bsproede\w*\b|\bsprode\w*\b|\bbrech(?:e|en|t)?\w*\b|\bbricht\b/.test(
      normalizedWithoutDryShampooTerms,
    )
  const dryBrittleCombo =
    /\btrocken(?:e|er|es|en|em)?\b.{0,60}\b(?:bruch\w*|bruechig\w*|bruchig\w*|sproede\w*|sprode\w*|brech\w*|bricht)\b|\b(?:bruch\w*|bruechig\w*|bruchig\w*|sproede\w*|sprode\w*|brech\w*|bricht)\b.{0,60}\btrocken(?:e|er|es|en|em)?\b/.test(
      normalizedWithoutDryShampooTerms,
    )

  if (breakageDominant || dryBrittleCombo) {
    caution.add("dry_shampoo_dry_breakage_hard_no")
  }

  const avoidAerosol =
    /\bkein(?:e|en)?\s+(?:spray|aerosol)\b|\bohne\s+(?:spray|aerosol)\b|\bnicht\s+sprueh\w*\b|\bnicht\s+spruh\w*\b|\baerosol\b.{0,30}\b(?:meiden|vermeiden)\b/.test(
      normalized,
    )

  if (avoidAerosol) {
    caution.add("dry_shampoo_avoid_aerosol_format_request")
  }

  if (
    /\basthma\b|\batem\w*\b|\blunge\w*\b|\binhalier\w*\b|\bduftstoff\w*\b|\ballerg\w*\b/.test(
      normalized,
    )
  ) {
    caution.add("dry_shampoo_respiratory_aerosol_caution")
  }

  if (/\bkind\b|\bkleinkind\b|\bbaby\b/.test(normalized)) {
    caution.add("dry_shampoo_child_context_hard_no")
  }

  let hairColorFitRequest: RecommendationRequestContext["dryShampooHairColorFitRequest"] = null
  if (/\bblond\w*\b|\bhell\w*\b/.test(normalized)) hairColorFitRequest = "blonde_light"
  if (/\bbraun\w*\b|\bbruenett\w*\b|\bbrunett\w*\b/.test(normalized)) hairColorFitRequest = "brown"
  if (/\bdunkel\w*\b|\bschwarz\w*\b/.test(normalized)) hairColorFitRequest = "dark"
  if (!hairColorFitRequest && colorCast) hairColorFitRequest = "universal"

  const sensitive = /\bsensibel\w*\b|\bempfindlich\w*\b|\bsensitive\b/.test(normalized)
  const preferredFormat = avoidAerosol
    ? "foam_or_liquid"
    : /\bpuder\b|\bpowder\b/.test(normalized)
      ? "powder"
      : /\bschaum\b|\bfoam\b|\bliquid\b|\bfluessig\w*\b|\bflussig\w*\b/.test(normalized)
        ? "foam_or_liquid"
        : null

  return {
    bridgeNeedReasonCodes: Array.from(bridge),
    cautionReasonCodes: Array.from(caution),
    primaryEffectRequest: volumeTexture
      ? "volume_texture"
      : sensitive
        ? "sensitive_refresh"
        : mentionsDryShampoo || betweenWash || cannotWashToday || emergency || postWorkout
          ? "classic_refresh"
          : null,
    hairColorFitRequest,
    requiresSensitiveFit: sensitive,
    preferredFormat,
    avoidAerosol,
  }
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
  const dryShampooSignals = inferDryShampooSignalsFromMessage(message)

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
    dryShampooBridgeNeedReasonCodes: dryShampooSignals.bridgeNeedReasonCodes,
    dryShampooCautionReasonCodes: dryShampooSignals.cautionReasonCodes,
    dryShampooPrimaryEffectRequest: dryShampooSignals.primaryEffectRequest,
    dryShampooHairColorFitRequest: dryShampooSignals.hairColorFitRequest,
    dryShampooRequiresSensitiveFit: dryShampooSignals.requiresSensitiveFit,
    dryShampooPreferredFormat: dryShampooSignals.preferredFormat,
    dryShampooAvoidAerosol: dryShampooSignals.avoidAerosol,
  }
}
