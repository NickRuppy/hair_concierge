import { guidanceCatalog } from "@/lib/agent/guidance/catalog"
import type { GuidanceLoadResult } from "@/lib/agent/contracts"
import {
  isGuidanceId,
  isSelectableProductCategory,
  type GuidanceId,
  type GuidanceKind,
  type SelectableProductCategory,
} from "@/lib/agent/contracts"
import type { UserContextProjection } from "@/lib/agent/tools/get-user-context"
import type {
  BuildOrFixRoutineProjection,
  RoutineObjective,
} from "@/lib/agent/tools/build-or-fix-routine"
import type { SelectedProductsProjection } from "@/lib/agent/tools/select-products"
import type { ConversationState, RoutineLayer } from "@/lib/types"

export const AGENT_USER_JOBS = [
  "product_pick",
  "compare_or_decide",
  "routine_structure",
  "troubleshoot",
  "usage",
  "unsupported_or_unclear",
] as const

export type AgentUserJob = (typeof AGENT_USER_JOBS)[number]

export const AGENT_CONCERNS = [
  "oily_roots",
  "dry_lengths",
  "dandruff_or_flakes",
  "irritation",
  "frizz",
] as const

export type AgentConcern = (typeof AGENT_CONCERNS)[number]

export type AgentRouteToolName = "select_products" | "build_or_fix_routine"

export const ACTIVE_PROFILE_SIGNAL_FIELDS = [
  "hair_texture",
  "thickness",
  "density",
  "scalp_type",
  "scalp_condition",
  "concerns",
  "goals",
  "chemical_treatment",
  "desired_volume",
  "heat_styling",
  "styling_tools",
] as const

export type ActiveProfileSignalField = (typeof ACTIVE_PROFILE_SIGNAL_FIELDS)[number]

export const ACTIVE_SIGNAL_SELECTION_EFFECTS = [
  "override",
  "qualifier",
  "redirect",
  "augment",
  "caution",
] as const

export type ActiveSignalSelectionEffect = (typeof ACTIVE_SIGNAL_SELECTION_EFFECTS)[number]

export interface AgentActiveProfileSignal {
  field: ActiveProfileSignalField
  value: string
  source: "message"
  selection_effect: ActiveSignalSelectionEffect
  evidence: string
}

export interface AgentRouteClassification {
  user_job: AgentUserJob
  product_category: SelectableProductCategory | null
  requested_overlay_ids: GuidanceId[]
  requested_topic_ids: GuidanceId[]
  requested_routine_id: GuidanceId | null
  concerns: AgentConcern[]
  active_profile_signals?: AgentActiveProfileSignal[]
  confidence: number
  evidence: string[]
  ambiguity: string | null
}

export interface AgentRoutePacket {
  user_job: AgentUserJob
  product_category: SelectableProductCategory | null
  requested_overlay_ids: GuidanceId[]
  requested_topic_ids: GuidanceId[]
  requested_routine_id: GuidanceId | null
  concerns: AgentConcern[]
  active_profile_signals: AgentActiveProfileSignal[]
  confidence: number
  evidence: string[]
  ambiguity: string | null
  required_playbook_id: GuidanceId | null
  guidance_ids: GuidanceId[]
  tool_plan: AgentRouteToolName[]
  routine_objective: RoutineObjective | null
  routine_layer?: RoutineLayer | null
  routine_requested_category?: SelectableProductCategory | null
  validation_warnings: string[]
}

export interface AgentRuntimePacket {
  route: AgentRoutePacket
  user_context: unknown
  guidance: GuidanceLoadResult
  selected_products: SelectedProductsProjection | null
  routine_plan: BuildOrFixRoutineProjection | null
  validation_warnings: string[]
  final_instructions: string[]
}

export function isAgentUserJob(value: string): value is AgentUserJob {
  return (AGENT_USER_JOBS as readonly string[]).includes(value)
}

export function isAgentConcern(value: string): value is AgentConcern {
  return (AGENT_CONCERNS as readonly string[]).includes(value)
}

export function isActiveProfileSignalField(value: string): value is ActiveProfileSignalField {
  return (ACTIVE_PROFILE_SIGNAL_FIELDS as readonly string[]).includes(value)
}

export function isActiveSignalSelectionEffect(value: string): value is ActiveSignalSelectionEffect {
  return (ACTIVE_SIGNAL_SELECTION_EFFECTS as readonly string[]).includes(value)
}

export function getRequiredPlaybookForUserJob(userJob: AgentUserJob): GuidanceId | null {
  switch (userJob) {
    case "product_pick":
      return "playbook:recommend_products"
    case "compare_or_decide":
      return "playbook:compare_or_decide"
    case "routine_structure":
      return "playbook:build_or_fix_routine"
    case "troubleshoot":
      return "playbook:troubleshoot_hair_issue"
    case "usage":
      return "playbook:usage_and_application"
    case "unsupported_or_unclear":
      return null
  }
}

function uniqueGuidanceIds(ids: GuidanceId[]): GuidanceId[] {
  const seen = new Set<GuidanceId>()
  const result: GuidanceId[] = []

  for (const id of ids) {
    if (seen.has(id)) continue
    seen.add(id)
    result.push(id)
  }

  return result
}

function isGuidanceKind(id: GuidanceId, kind: GuidanceKind): boolean {
  return guidanceCatalog[id]?.kind === kind
}

function validateGuidanceIds(params: {
  ids: readonly string[]
  kind: GuidanceKind
  label: string
  warnings: string[]
}): GuidanceId[] {
  const valid: GuidanceId[] = []

  for (const rawId of params.ids) {
    if (!isGuidanceId(rawId)) {
      params.warnings.push(`Unknown ${params.label} id: ${rawId}`)
      continue
    }

    if (!isGuidanceKind(rawId, params.kind)) {
      params.warnings.push(`Ignored ${params.label} id with wrong kind: ${rawId}`)
      continue
    }

    valid.push(rawId)
  }

  return uniqueGuidanceIds(valid)
}

function salvageMisplacedGuidanceIds(params: {
  ids: readonly string[]
  kind: GuidanceKind
}): GuidanceId[] {
  return uniqueGuidanceIds(
    params.ids.filter(
      (id): id is GuidanceId => isGuidanceId(id) && isGuidanceKind(id, params.kind),
    ),
  )
}

function keepUnknownOrKindMatchedIds(params: {
  ids: readonly string[]
  kind: GuidanceKind
}): string[] {
  return params.ids.filter((id) => !isGuidanceId(id) || isGuidanceKind(id, params.kind))
}

function validateProductCategory(
  value: SelectableProductCategory | null,
  warnings: string[],
): SelectableProductCategory | null {
  if (value === null) return null

  if (!isSelectableProductCategory(value)) {
    warnings.push(`Unknown product category: ${String(value)}`)
    return null
  }

  return value
}

function validateConcerns(concerns: readonly string[], warnings: string[]): AgentConcern[] {
  const valid: AgentConcern[] = []

  for (const concern of concerns) {
    if (isAgentConcern(concern)) {
      valid.push(concern)
    } else {
      warnings.push(`Unknown concern: ${concern}`)
    }
  }

  return [...new Set(valid)]
}

function normalizeRouteMessage(message: string): string {
  return message
    .toLocaleLowerCase("de-DE")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

function addActiveSignal(signals: AgentActiveProfileSignal[], signal: AgentActiveProfileSignal) {
  const existingIndex = signals.findIndex(
    (entry) => entry.field === signal.field && entry.value === signal.value,
  )

  if (existingIndex === -1) {
    signals.push(signal)
    return
  }

  const priority: Record<ActiveSignalSelectionEffect, number> = {
    qualifier: 1,
    augment: 2,
    redirect: 3,
    override: 4,
    caution: 5,
  }

  if (priority[signal.selection_effect] > priority[signals[existingIndex].selection_effect]) {
    signals[existingIndex] = signal
  }
}

function deriveActiveProfileSignalsFromMessage(message: string): AgentActiveProfileSignal[] {
  const normalized = normalizeRouteMessage(message)
  const signals: AgentActiveProfileSignal[] = []
  const addSignal = (
    field: ActiveProfileSignalField,
    value: string,
    selectionEffect: ActiveSignalSelectionEffect,
    evidence: string,
  ) => {
    addActiveSignal(signals, {
      field,
      value,
      source: "message",
      selection_effect: selectionEffect,
      evidence,
    })
  }

  const describesFineHair =
    /\bfein\w*(?:[\s,]+[\w-]+){0,4}[\s,]+haar\w*\b/.test(normalized) ||
    /\bhaar\w*\s+(?:ist|sind|wirkt|fuhlt\w*|fuehlt\w*)\s+fein\w*\b/.test(normalized)

  if (describesFineHair) {
    addSignal("thickness", "fine", "override", "feines Haar")
  }

  if (/\b(?:mitteldick\w*|mittelstark\w*)\s+haar\b/.test(normalized)) {
    addSignal("thickness", "normal", "override", "mitteldickes Haar")
  }

  if (
    /\b(?:ansatz|kopfhaut)\b.{0,40}\b(?:fett\w*|nachfett\w*|olig\w*)\b/.test(normalized) ||
    /\b(?:fett\w*|nachfett\w*|olig\w*)\b.{0,40}\b(?:ansatz|kopfhaut)\b/.test(normalized) ||
    /\boily\s+roots?\b/.test(normalized)
  ) {
    addSignal("scalp_type", "oily", "override", "fettender Ansatz")
  }

  if (
    /\b(?:laengen|langen|spitzen|enden)\b.{0,40}\b(?:trocken\w*|strohig\w*|ausgetrocknet\w*)\b/.test(
      normalized,
    ) ||
    /\b(?:trocken\w*|strohig\w*|ausgetrocknet\w*)\b.{0,40}\b(?:laengen|langen|spitzen|enden)\b/.test(
      normalized,
    ) ||
    /\bdry\s+(?:lengths|ends)\b/.test(normalized)
  ) {
    addSignal("concerns", "dryness", "redirect", "trockene Laengen")
  }

  if (/\b(?:frizz|frizzy|kraus|fliegende\s+haare)\b/.test(normalized)) {
    addSignal("concerns", "frizz", "redirect", "Frizz")
  }

  if (/\b(?:glanz|glanzend\w*|glaenzend\w*|gloss|shine)\b/.test(normalized)) {
    addSignal("goals", "shine", "redirect", "Glanz")
  }

  if (
    /\b(?:coloriert\w*|gefarbt\w*|gefaerbt\w*)\b.{0,50}\b(?:haar\w*|haaren|laeng\w*|lang\w*)\b/.test(
      normalized,
    ) ||
    /\b(?:haar\w*|haaren|laeng\w*|lang\w*)\b.{0,50}\b(?:coloriert\w*|gefarbt\w*|gefaerbt\w*)\b/.test(
      normalized,
    )
  ) {
    addSignal("chemical_treatment", "colored", "qualifier", "coloriertes Haar")
  }

  if (/\bblondier\w*\b/.test(normalized)) {
    addSignal("chemical_treatment", "bleached", "qualifier", "blondiertes Haar")
  }

  if (/\b(?:fohn\w*|foehn\w*|föhn\w*|blow\s*dry\w*)\b/.test(normalized)) {
    addSignal("styling_tools", "blow_dryer", "override", "foehnen")
  }

  if (/\bdiffusor\w*\b|\bdiffuser\w*\b/.test(normalized)) {
    addSignal("styling_tools", "diffuser", "override", "Diffusor")
  }

  if (/\b(?:glatt\w*|glaett\w*|glatteisen|glaetteisen|flat\s*iron)\b/.test(normalized)) {
    addSignal("styling_tools", "flat_iron", "override", "glaetten")
  }

  if (/\b(?:lockenstab|curling\s*iron)\b/.test(normalized)) {
    addSignal("styling_tools", "curling_iron", "override", "Lockenstab")
  }

  if (/\b(?:hot\s*brush|hot\s*air\s*brush|warmluftburste|warmluftbuerste)\b/.test(normalized)) {
    addSignal("styling_tools", "hot_air_brush", "override", "Hot Brush")
  }

  if (
    /\b(?:thermo[-\s]*lockenwickler|thermolockenwickler|thermal\s*rollers?|heizwickler|warme[-\s]+lockenwickler)\b/.test(
      normalized,
    )
  ) {
    addSignal("styling_tools", "thermal_rollers", "override", "Thermo-Lockenwickler")
  }

  if (/\b\d{2,3}\s*(?:grad|°\s*c|celsius)\b/.test(normalized)) {
    addSignal("styling_tools", "flat_iron", "override", "exakte Hitzeschutz-Temperatur")
  }

  if (
    /\b(?:empfindlich\w*|sensibel\w*)\s+kopfhaut\b/.test(normalized) ||
    /\bkopfhaut\b.{0,40}\b(?:empfindlich\w*|sensibel\w*)\b/.test(normalized)
  ) {
    addSignal("scalp_condition", "irritated", "override", "empfindliche Kopfhaut")
  }

  if (/\b(?:schuppen|schuppchen|flakes|flocken)\b/.test(normalized)) {
    addSignal("scalp_condition", "dandruff", "caution", "Schuppen")
  }

  if (
    /\b(?:juckreiz|juckt|juckende|gereizt|irritiert|brennt|brennen|rotung|roetung)\b/.test(
      normalized,
    )
  ) {
    addSignal("scalp_condition", "irritated", "caution", "gereizte Kopfhaut")
  }

  return signals
}

function deriveConcernsFromActiveSignals(
  activeSignals: readonly AgentActiveProfileSignal[],
): AgentConcern[] {
  const concerns: AgentConcern[] = []
  const addConcern = (concern: AgentConcern) => {
    if (!concerns.includes(concern)) concerns.push(concern)
  }

  for (const signal of activeSignals) {
    if (signal.field === "scalp_type" && signal.value === "oily") {
      addConcern("oily_roots")
    }
    if (signal.field === "concerns" && signal.value === "dryness") {
      addConcern("dry_lengths")
    }
    if (signal.field === "concerns" && signal.value === "frizz") {
      addConcern("frizz")
    }
    if (signal.field === "scalp_condition" && signal.value === "dandruff") {
      addConcern("dandruff_or_flakes")
    }
    if (
      signal.field === "scalp_condition" &&
      signal.value === "irritated" &&
      signal.selection_effect === "caution"
    ) {
      addConcern("irritation")
    }
  }

  return concerns
}

function validateActiveProfileSignals(
  signals: readonly AgentActiveProfileSignal[] | undefined,
  warnings: string[],
): AgentActiveProfileSignal[] {
  const valid: AgentActiveProfileSignal[] = []

  for (const signal of signals ?? []) {
    if (!isActiveProfileSignalField(signal.field)) {
      warnings.push(`Unknown active profile signal field: ${String(signal.field)}`)
      continue
    }

    if (!isActiveSignalSelectionEffect(signal.selection_effect)) {
      warnings.push(`Unknown active profile signal effect: ${String(signal.selection_effect)}`)
      continue
    }

    if (signal.source !== "message") {
      warnings.push(
        `Ignored active profile signal with unsupported source: ${String(signal.source)}`,
      )
      continue
    }

    if (typeof signal.value !== "string" || signal.value.trim().length === 0) {
      warnings.push(`Ignored active profile signal without value: ${signal.field}`)
      continue
    }

    valid.push({
      field: signal.field,
      value: signal.value.trim(),
      source: "message",
      selection_effect: signal.selection_effect,
      evidence: typeof signal.evidence === "string" ? signal.evidence.slice(0, 120) : "",
    })
  }

  return valid
}

function isClassifierActiveSignalGroundedInMessage(
  signal: AgentActiveProfileSignal,
  message: string,
  messageSignals: readonly AgentActiveProfileSignal[],
): boolean {
  if (
    messageSignals.some((entry) => entry.field === signal.field && entry.value === signal.value)
  ) {
    return true
  }

  const evidence = normalizeRouteMessage(signal.evidence).trim()
  if (evidence.length < 3) {
    return false
  }

  return normalizeRouteMessage(message).includes(evidence)
}

function mergeActiveProfileSignals(
  message: string,
  messageSignals: readonly AgentActiveProfileSignal[],
  classifierSignals: readonly AgentActiveProfileSignal[],
): AgentActiveProfileSignal[] {
  const result: AgentActiveProfileSignal[] = []

  for (const signal of messageSignals) {
    addActiveSignal(result, signal)
  }

  for (const signal of classifierSignals) {
    if (!isClassifierActiveSignalGroundedInMessage(signal, message, messageSignals)) {
      continue
    }

    addActiveSignal(result, signal)
  }

  return result
}

function inferDirectProductCategoryFromMessage(
  message: string,
  userJob: AgentUserJob,
): SelectableProductCategory | null {
  if (userJob !== "product_pick" && userJob !== "compare_or_decide" && userJob !== "troubleshoot") {
    return null
  }

  const normalized = normalizeRouteMessage(message)

  const mentionsMask =
    /\b(?:haar)?masken?\b/.test(normalized) ||
    /\b(?:haar)?kuren?\b/.test(normalized) ||
    /\b(?:protein|feuchtigkeits)masken?\b/.test(normalized)
  const mentionsOil = /\b(?:haar)?(?:oel\w*|ol(?:e|s|ig\w*)?)\b|\boils?\b/.test(normalized)
  const mentionsDryShampoo =
    /\btrockenshampoo\w*\b|\btrocken[-\s]*shampoo\w*\b|\bdry[-\s]*shampoo\w*\b/.test(normalized)
  const normalizedWithoutDryShampooTerms = normalized.replace(
    /\btrockenshampoo\w*\b|\btrocken[-\s]*shampoo\w*\b|\bdry[-\s]*shampoo\w*\b/g,
    " ",
  )
  const mentionsGenericShampoo = /\bshampoos?\b/.test(normalizedWithoutDryShampooTerms)
  const mentionsOtherCategory =
    mentionsOil ||
    mentionsGenericShampoo ||
    /\bleave[-\s]?in\b|\bleavein\b|\bconditioner\b|\bsp(?:u|ue)lung\w*\b|\bbond\s*builder\w*\b|\bbondbuilder\w*\b|\bbond\s*repair\b|\bk18\b|\bkr18\b|\bolaplex\b|\bepres\b/.test(
      normalizedWithoutDryShampooTerms,
    )

  const dryShampooBetweenWash =
    /\btag\s*2\b|\bday\s*2\b|\bzweiter\s+tag\b|\bbetween[-\s]?wash\b|\bzwischen\s+(?:den\s+)?(?:waeschen|waschen)\b/.test(
      normalized,
    )
  const dryShampooCannotWashToday =
    /\b(?:kann|schaffe|geht)\b.{0,50}\b(?:heute|jetzt|gerade)\b.{0,50}\b(?:nicht\s+)?wasch\w*\b|\bkeine\s+zeit\b.{0,50}\bwasch\w*\b/.test(
      normalized,
    )
  const dryShampooEmergency =
    /\bnotfall\w*\b|\bemergency\b|\blast[-\s]?minute\b|\bkurzfristig\w*\b|\breise\w*\b|\bunterwegs\b/.test(
      normalized,
    )
  const dryShampooSameDay = /\b(?:heute|jetzt|gerade)\b/.test(normalized)
  const hasDryShampooBridgeContext =
    mentionsDryShampoo || dryShampooBetweenWash || dryShampooCannotWashToday || dryShampooEmergency
  const dryShampooRootRefreshPhrase =
    /\bauffrisch\w*\b.{0,50}\bansatz\b|\bansatz\b.{0,50}\bauffrisch\w*\b/.test(normalized) ||
    /\brefresh\w*\b.{0,50}\bansatz\b|\bansatz\b.{0,50}\brefresh\w*\b/.test(normalized)
  const dryShampooRootRefresh =
    (hasDryShampooBridgeContext || dryShampooSameDay) && dryShampooRootRefreshPhrase
  const dryShampooGreasyRoot =
    hasDryShampooBridgeContext &&
    /\bansatz\b.{0,50}\b(?:fett\w*|nachfett\w*)\b|\b(?:fett\w*|nachfett\w*)\b.{0,50}\bansatz\b/.test(
      normalized,
    )
  const dryShampooColorCast =
    /\bweiss(?:er|e|en)?\s+schleier\b|\bwhite\s*cast\b|\bgrau(?:er|e|en)?\s+schleier\b/.test(
      normalized,
    )
  const dryShampooFormatRequest =
    (hasDryShampooBridgeContext || (dryShampooSameDay && dryShampooRootRefreshPhrase)) &&
    /\bkein(?:e|en)?\s+(?:spray|aerosol)\b|\bohne\s+(?:spray|aerosol)\b|\bschaum\b|\bfoam\b|\bliquid\b|\bfluessig\w*\b|\bflussig\w*\b/.test(
      normalized,
    ) &&
    /\bansatz\b|\bauffrisch\w*\b/.test(normalized)
  const dryShampooVolumeBridge =
    /\bvolumen\b|\bgrip\b|\bgriff\b|\btextur\w*\b|\bansatzvolumen\b/.test(normalized) &&
    hasDryShampooBridgeContext &&
    (/\bansatz\b/.test(normalized) || dryShampooBetweenWash)

  if (
    !mentionsOtherCategory &&
    (mentionsDryShampoo ||
      dryShampooBetweenWash ||
      dryShampooCannotWashToday ||
      dryShampooRootRefresh ||
      dryShampooGreasyRoot ||
      dryShampooColorCast ||
      dryShampooFormatRequest ||
      dryShampooVolumeBridge)
  ) {
    return "dry_shampoo"
  }

  if (mentionsMask && !mentionsOtherCategory) {
    return "mask"
  }

  if (/\bleave[-\s]?in\b|\bleavein\b/.test(normalized)) {
    if (userJob === "product_pick" || userJob === "troubleshoot") {
      return "leave_in"
    }

    const asksForLeaveInComparison = /\b(?:vergleich|vergleiche|vergleichen|vs|versus)\b/.test(
      normalized,
    )
    const asksForConditionerReplacement =
      /\b(?:ersetzen|ersetzt|statt|anstelle)\b/.test(normalized) &&
      /\b(?:spulung|spuelung|conditioner)\b/.test(normalized)

    return asksForLeaveInComparison || asksForConditionerReplacement ? "leave_in" : null
  }

  const mentionsConditioner = /\bconditioners?\b|\bsp(?:u|ue)lung\w*\b/.test(normalized)
  if (mentionsConditioner) {
    const directConditionerAskPatterns = [
      /\bwelch\w*\s+(?:andere?s?\s+|passende?s?\s+)?(?:conditioners?|sp(?:u|ue)lung\w*)\b/,
      /\bpassende?n?\s+(?:conditioners?|sp(?:u|ue)lung\w*)\b/,
      /\b(?:conditioners?|sp(?:u|ue)lung\w*)\s+(?:empfehlen|empfehlung|empfiehl)/,
      /\bempfiehl\w*\s+(?:mir\s+)?(?:ein\w*\s+)?(?:conditioners?|sp(?:u|ue)lung\w*)\b/,
      /\b(?:conditioners?|sp(?:u|ue)lung\w*)\s+soll(?:te)?\s+ich\s+(?:nehmen|kaufen|waehlen|nutzen|verwenden)\b/,
      /\b(?:vergleich|vergleiche|vergleichen)\b.*\b(?:conditioners?|sp(?:u|ue)lung\w*)\b/,
      /\b(?:conditioners?|sp(?:u|ue)lung\w*)\b.*\b(?:vergleich|vergleiche|vergleichen)\b/,
    ]

    if (directConditionerAskPatterns.some((pattern) => pattern.test(normalized))) {
      return "conditioner"
    }
  }

  if (mentionsOil) {
    const directOilAskPatterns = [
      /\bwelch\w*\s+(?:andere?s?\s+|passende?s?\s+)?(?:(?:haar)?(?:ol|oel)\w*|oils?)\b/,
      /\bpassende?n?\s+(?:(?:haar)?(?:ol|oel)\w*|oils?)\b/,
      /\b(?:(?:haar)?(?:ol|oel)\w*|oils?)\s+(?:empfehlen|empfehlung|empfiehl)/,
      /\bempfiehl\w*\s+(?:mir\s+)?(?:ein\w*\s+)?(?:(?:haar)?(?:ol|oel)\w*|oils?)\b/,
      /\b(?:(?:haar)?(?:ol|oel)\w*|oils?)\s+soll(?:te)?\s+ich\s+(?:nehmen|kaufen|waehlen|nutzen|verwenden)\b/,
      /\b(?:vergleich|vergleiche|vergleichen)\b.*\b(?:(?:haar)?(?:ol|oel)\w*|oils?)\b/,
      /\b(?:(?:haar)?(?:ol|oel)\w*|oils?)\b.*\b(?:vergleich|vergleiche|vergleichen)\b/,
    ]

    if (directOilAskPatterns.some((pattern) => pattern.test(normalized))) {
      return "oil"
    }
  }

  if (
    !/\bshampoos?\b/.test(normalized) &&
    /\bbond\s*builder\w*\b|\bbondbuilder\w*\b|\bbond\s*repair\b|\bk18\b|\bkr18\b|\bolaplex\b|\bepres\b/.test(
      normalized,
    )
  ) {
    return "bondbuilder"
  }

  if (
    /\b(?:tiefenreinigungsshampoos?|tiefenreinigung|deep\s*cleansing|clarifying)\b/.test(normalized)
  ) {
    return "deep_cleansing_shampoo"
  }

  if (!/\bshampoos?\b/.test(normalized)) {
    return null
  }

  const directShampooAskPatterns = [
    /\bwelch\w*\s+(?:andere?s?\s+|passende?s?\s+)?shampoos?\b/,
    /\bwelch\w*(?:\s+[\w-]+){0,3}\s+shampoos?\b/,
    /\bpassende?n?\s+shampoos?\b/,
    /\bshampoos?\s+(?:empfehlen|empfehlung|empfiehl)/,
    /\bempfiehl\w*\s+(?:mir\s+)?(?:ein\s+|eine\s+)?shampoos?\b/,
    /\bshampoos?\s+soll(?:te)?\s+ich\s+(?:nehmen|kaufen|waehlen|nutzen|verwenden)\b/,
    /\b(?:vergleich|vergleiche|vergleichen)\b.*\bshampoos?\b/,
    /\bshampoos?\b.*\b(?:vergleich|vergleiche|vergleichen)\b/,
    /\b(?:anderes|andere|anderen)\s+shampoos?\s+passt\b/,
  ]

  return directShampooAskPatterns.some((pattern) => pattern.test(normalized)) ? "shampoo" : null
}

function normalizeUserJobFromMessage(message: string, userJob: AgentUserJob): AgentUserJob {
  if (userJob !== "compare_or_decide") {
    return userJob
  }

  const normalized = normalizeRouteMessage(message)
  const asksForChange =
    /\b(?:was\s+soll\s+ich\s+(?:andern|tun|machen)|was\s+kann\s+ich\s+(?:andern|tun|machen)|woran\s+liegt|warum|was\s+lau?ft\s+falsch|soll\s+ich\s+wechseln)\b/.test(
      normalized,
    )
  const describesProblem =
    /\b(?:macht|werden|wird|fuhlt|fuehlt|sieht|wirkt|ist)\b.*\b(?:platt|beschwert|trocken|strohig|fettig|belegt|klebrig|frizzig|juckt|brennt|schuppen)\b/.test(
      normalized,
    )

  return asksForChange && describesProblem ? "troubleshoot" : userJob
}

function isTroubleshootQuestionWithoutImmediateProductPick(
  message: string,
  userJob: AgentUserJob,
  productCategory: SelectableProductCategory | null,
): boolean {
  if (userJob !== "troubleshoot" || productCategory !== "conditioner") return false

  const normalized = normalizeRouteMessage(message)
  const asksForReplacementAdvice = /\bsoll\s+ich\s+wechseln\b/.test(normalized)
  const explicitPick =
    /\b(?:welch\w*|empfiehl\w*|empfehl\w*|nehmen|kaufen|alternative)\b/.test(normalized) &&
    /\b(?:conditioner|sp(?:u|ue)lung)\b/.test(normalized)
  const describesTrouble =
    /\b(?:platt|beschwert|schwer|belegt|fettig)\b/.test(normalized) &&
    /\b(?:macht|wirkt|fuhlt|fuehlt|ist|werden|wird)\b/.test(normalized)

  return describesTrouble && asksForReplacementAdvice && !explicitPick
}

function isDryShampooTroubleshootWithoutImmediateProductPick(
  message: string,
  userJob: AgentUserJob,
  productCategory: SelectableProductCategory | null,
): boolean {
  if (userJob !== "troubleshoot" || productCategory !== "dry_shampoo") return false

  const normalized = normalizeRouteMessage(message)
  const explicitPick =
    /\b(?:welch\w*|empfiehl\w*|empfehl\w*|nehmen|kaufen|passt|alternative)\b/.test(normalized)
  if (explicitPick) return false

  return (
    /\btrockenshampoo\w*\b|\btrocken[-\s]*shampoo\w*\b|\bdry[-\s]*shampoo\w*\b/.test(normalized) &&
    /\b(?:hat\s+nicht\s+geholfen|hilft\s+nicht|funktioniert\s+nicht|problem|trotzdem|macht|fuhlt|fuehlt|sieht|wirkt|belegt|klebrig|fettig)\b/.test(
      normalized,
    )
  )
}

function isMaskTypeOrConceptQuestionWithoutImmediateProductPick(
  message: string,
  userJob: AgentUserJob,
  productCategory: SelectableProductCategory | null,
): boolean {
  if (userJob !== "compare_or_decide" || productCategory !== "mask") return false

  const normalized = normalizeRouteMessage(message)
  const explicitProductPick =
    /\b(?:welch\w*\s+produkt\w*|empfiehl\w*|empfehl\w*|kaufen|passt\s+am\s+besten|produkt\w*\s+passt)\b/.test(
      normalized,
    )
  if (explicitProductPick) return false

  const asksSplitEndBoundary =
    /\bspliss\b.{0,60}\b(?:reparier\w*|kaschier\w*|weg|dauerhaft|hilft)\b/.test(normalized) ||
    /\b(?:reparier\w*|kaschier\w*|weg|dauerhaft|hilft)\b.{0,60}\bspliss\b/.test(normalized)
  const mentionsProtein = /\bprotein\w*\b/.test(normalized)
  const mentionsMoisture = /\bfeuchtigkeit\w*\b/.test(normalized)
  const mentionsMaskContext = /\b\w*masken?\b/.test(normalized) || /\b\w*kuren?\b/.test(normalized)
  const asksMaskTypeChoice = mentionsProtein && mentionsMoisture && mentionsMaskContext

  return asksSplitEndBoundary || asksMaskTypeChoice
}

function isLeaveInNeedQuestionWithoutImmediateProductPick(
  message: string,
  userJob: AgentUserJob,
  productCategory: SelectableProductCategory | null,
): boolean {
  if (userJob !== "compare_or_decide" || productCategory !== "leave_in") return false

  const normalized = normalizeRouteMessage(message)
  const asksForLeaveInComparison = /\b(?:vergleich|vergleiche|vergleichen|vs|versus)\b/.test(
    normalized,
  )
  const asksForConditionerReplacement =
    /\b(?:ersetzen|ersetzt|statt|anstelle)\b/.test(normalized) &&
    /\b(?:sp(?:u|ue)lung|conditioner)\b/.test(normalized)
  const asksIfNeeded = /\bbrauche\s+ich\b.{0,40}\bleave[-\s]?in\b/.test(normalized)

  return asksIfNeeded && !asksForLeaveInComparison && !asksForConditionerReplacement
}

function isOilConceptQuestionWithoutImmediateProductPick(
  message: string,
  userJob: AgentUserJob,
  productCategory: SelectableProductCategory | null,
): boolean {
  if (userJob !== "compare_or_decide" || productCategory !== "oil") return false

  const normalized = normalizeRouteMessage(message)
  const asksConcreteProductPick =
    /\b(?:welch\w*|empfiehl\w*|empfehl\w*|nehmen|kaufen|produkt\w*)\b/.test(normalized)
  if (asksConcreteProductPick) return false

  const asksIfOilMakesSense =
    /\b(?:sinnvoll|ueberhaupt|uberhaupt|brauche\s+ich|soll\s+ich|hilft)\b/.test(normalized)
  const hasScalpOrRootCaution =
    /\b(?:ansatz|kopfhaut)\b/.test(normalized) &&
    /\b(?:fett\w*|olig\w*|oily|schupp\w*|juck\w*|reiz\w*)\b/.test(normalized)
  const comparesOilUseModes =
    /\b(?:vergleich|vergleiche|vergleichen|oder|vs|versus)\b/.test(normalized) &&
    /\b(?:pre[-\s]?wash|vor\s+der\s+wasche|hair\s*oiling|finish|styling)\b/.test(normalized)

  return (asksIfOilMakesSense && hasScalpOrRootCaution) || comparesOilUseModes
}

function messageLooksDefinitionSeeking(message: string): boolean {
  return /definition|locke|locken|curl|curls|welle|wellen|wave|waves|clump|frizz/i.test(message)
}

function deriveRoutineGuidanceId(params: {
  message: string
  userJob: AgentUserJob
  requestedRoutineId: GuidanceId | null
  userContext: UserContextProjection
  warnings: string[]
}): GuidanceId | null {
  if (params.userJob !== "routine_structure") {
    return null
  }

  if (params.requestedRoutineId) {
    return params.requestedRoutineId
  }

  const texture = params.userContext.profile?.hair_texture

  if (texture === "curly" || texture === "coily") {
    return "routine:curl_definition"
  }

  if (texture === "straight") {
    return "routine:straight_low_definition"
  }

  if (texture === "wavy") {
    return messageLooksDefinitionSeeking(params.message)
      ? "routine:curl_definition"
      : "routine:straight_low_definition"
  }

  params.warnings.push("No routine guidance id selected because hair texture is missing.")
  return null
}

function deriveToolPlan(params: {
  message: string
  userJob: AgentUserJob
  productCategory: SelectableProductCategory | null
  warnings: string[]
}): AgentRouteToolName[] {
  switch (params.userJob) {
    case "product_pick":
      if (!params.productCategory) {
        params.warnings.push(`No product tool run for ${params.userJob}: product category missing.`)
        return []
      }

      return ["select_products"]
    case "compare_or_decide":
    case "troubleshoot":
      if (!params.productCategory) {
        return []
      }

      if (
        isTroubleshootQuestionWithoutImmediateProductPick(
          params.message,
          params.userJob,
          params.productCategory,
        )
      ) {
        return []
      }

      if (
        isDryShampooTroubleshootWithoutImmediateProductPick(
          params.message,
          params.userJob,
          params.productCategory,
        )
      ) {
        return []
      }

      if (
        isMaskTypeOrConceptQuestionWithoutImmediateProductPick(
          params.message,
          params.userJob,
          params.productCategory,
        )
      ) {
        return []
      }

      if (
        isLeaveInNeedQuestionWithoutImmediateProductPick(
          params.message,
          params.userJob,
          params.productCategory,
        )
      ) {
        return []
      }

      if (
        isOilConceptQuestionWithoutImmediateProductPick(
          params.message,
          params.userJob,
          params.productCategory,
        )
      ) {
        return []
      }

      return ["select_products"]
    case "routine_structure":
      return ["build_or_fix_routine"]
    case "usage":
    case "unsupported_or_unclear":
      return []
  }
}

function inferRoutineObjective(message: string): RoutineObjective {
  return /fix|repar|optimier|verbesser|vereinfach|umstell|korrigier|nicht funktioniert/i.test(
    message,
  )
    ? "fix_routine"
    : "build_routine"
}

function hasProfileDeviationNotice(selectedProducts: SelectedProductsProjection | null): boolean {
  return (
    selectedProducts?.profile_basis.some((basis) => basis.startsWith("Profil-Hinweis:")) ?? false
  )
}

function buildFinalInstructions(
  route: AgentRoutePacket,
  selectedProducts: SelectedProductsProjection | null,
): string[] {
  const instructions = [
    "Antworte auf Deutsch.",
    "Nutze nur die geladenen Guidance- und Tool-Daten.",
    "Erfinde keine Produkte, Routineschritte oder Pflichtregeln.",
  ]

  if (route.user_job === "usage") {
    instructions.push("Bleibe bei Anwendung, Dosierung, Reihenfolge und Technik.")
  }

  if (route.user_job === "routine_structure") {
    instructions.push(
      "Beantworte nur die aktuelle Routine-Ebene aus routine_plan.steps; keine weiteren Routine-Bloecke ergaenzen.",
    )
    instructions.push(
      "Nenne keine konkreten Produktkarten oder Produktlisten, solange selected_products leer ist.",
    )

    if (route.routine_layer === "basics") {
      instructions.push(
        "Fuer basics kurz Shampoo und Conditioner erklaeren und nur den hoechsten Zusatzhebel nennen.",
      )
      instructions.push(
        "Schliesse basics mit einer kurzen natuerlichen Frage, ob der Nutzer als Naechstes eher sehen moechte, was ihn seinem Ziel naeherbringt, oder was gegen seine Probleme hilft. Vermeide interne Begriffe wie Ziel-Hebel oder Problem-Hebel.",
      )
    } else if (route.routine_layer === "goals") {
      instructions.push("Fuer goals nur die zielbezogenen Routine-Hebel erklaeren.")
      instructions.push(
        "Schliesse goals mit einer kurzen natuerlichen Frage, ob der Nutzer noch konkrete Probleme angehen oder einen Baustein im Detail ansehen moechte.",
      )
    } else if (route.routine_layer === "problems") {
      instructions.push("Fuer problems nur die problembezogenen Routine-Hebel erklaeren.")
      instructions.push(
        "Schliesse problems mit einer kurzen natuerlichen Frage, ob der Nutzer noch seine Ziele optimieren oder einen Baustein im Detail ansehen moechte.",
      )
    } else if (route.routine_layer === "deep_dive") {
      instructions.push("Fuer deep_dive fokussiert genau den angefragten Baustein erklaeren.")
    }
  }

  if (route.user_job === "unsupported_or_unclear") {
    instructions.push(
      "Stelle hoechstens eine gezielte Rueckfrage oder gib sichere Kategorie-Hilfe.",
    )
  }

  if (route.concerns.includes("dry_lengths") && route.product_category === "shampoo") {
    instructions.push("Bei trockenen Laengen Shampoo nicht als Hauptloesung framen.")
  }

  if (route.concerns.includes("frizz") && route.product_category === "shampoo") {
    instructions.push("Bei Frizz Shampoo nicht automatisch als Hauptloesung framen.")
  }

  if (hasProfileDeviationNotice(selectedProducts)) {
    instructions.push(
      "Erwaehne den Profil-Hinweis aus selected_products.profile_basis im ersten Antwortsatz und behandle ihn als aktuelle Angabe nur fuer diesen Turn.",
    )
  }

  return instructions
}

export function buildAgentRoutePacket(params: {
  message: string
  userContext: UserContextProjection
  classification: AgentRouteClassification
}): AgentRoutePacket {
  const warnings: string[] = []
  const classifiedUserJob = isAgentUserJob(params.classification.user_job)
    ? params.classification.user_job
    : "unsupported_or_unclear"
  const userJob = normalizeUserJobFromMessage(params.message, classifiedUserJob)
  const validatedProductCategory = validateProductCategory(
    params.classification.product_category,
    warnings,
  )
  const productCategory =
    validatedProductCategory ??
    (params.classification.product_category === null
      ? inferDirectProductCategoryFromMessage(params.message, userJob)
      : null)
  const requiredPlaybookId = getRequiredPlaybookForUserJob(userJob)
  const contextOverlays = validateGuidanceIds({
    ids: params.userContext.suggested_overlays,
    kind: "overlay",
    label: "context overlay",
    warnings,
  })
  const requestedOverlays = validateGuidanceIds({
    ids: keepUnknownOrKindMatchedIds({
      ids: params.classification.requested_overlay_ids,
      kind: "overlay",
    }),
    kind: "overlay",
    label: "requested overlay",
    warnings,
  })
  const requestedTopics = validateGuidanceIds({
    ids: [
      ...params.classification.requested_topic_ids,
      ...salvageMisplacedGuidanceIds({
        ids: params.classification.requested_overlay_ids,
        kind: "topic",
      }),
    ],
    kind: "topic",
    label: "requested topic",
    warnings,
  })
  const [requestedRoutineId = null] = validateGuidanceIds({
    ids: params.classification.requested_routine_id
      ? [params.classification.requested_routine_id]
      : [],
    kind: "routine",
    label: "requested routine",
    warnings,
  })
  const routineGuidanceId = deriveRoutineGuidanceId({
    message: params.message,
    userJob,
    requestedRoutineId,
    userContext: params.userContext,
    warnings,
  })
  validateConcerns(params.classification.concerns, warnings)
  const activeProfileSignals = mergeActiveProfileSignals(
    params.message,
    deriveActiveProfileSignalsFromMessage(params.message),
    validateActiveProfileSignals(params.classification.active_profile_signals, warnings),
  )
  const concerns = deriveConcernsFromActiveSignals(activeProfileSignals)
  const toolPlan = deriveToolPlan({
    message: params.message,
    userJob,
    productCategory,
    warnings,
  })
  const guidanceIds = uniqueGuidanceIds(
    [
      requiredPlaybookId,
      ...contextOverlays,
      ...requestedOverlays,
      ...requestedTopics,
      routineGuidanceId,
    ].filter((id): id is GuidanceId => Boolean(id)),
  )

  return {
    user_job: userJob,
    product_category: productCategory,
    requested_overlay_ids: requestedOverlays,
    requested_topic_ids: requestedTopics,
    requested_routine_id: routineGuidanceId,
    concerns,
    active_profile_signals: activeProfileSignals,
    confidence: Math.max(0, Math.min(1, params.classification.confidence)),
    evidence: params.classification.evidence.filter(Boolean).slice(0, 4),
    ambiguity: params.classification.ambiguity,
    required_playbook_id: requiredPlaybookId,
    guidance_ids: guidanceIds,
    tool_plan: toolPlan,
    routine_objective:
      userJob === "routine_structure" ? inferRoutineObjective(params.message) : null,
    routine_layer: userJob === "routine_structure" ? "basics" : null,
    routine_requested_category: null,
    validation_warnings: warnings,
  }
}

export function buildAgentRuntimePacket(params: {
  message?: string
  route: AgentRoutePacket
  userContext: unknown
  conversationState?: ConversationState | null
  guidance: GuidanceLoadResult
  selectedProducts?: SelectedProductsProjection | null
  routinePlan?: BuildOrFixRoutineProjection | null
}): AgentRuntimePacket {
  return {
    route: params.route,
    user_context: params.userContext,
    guidance: params.guidance,
    selected_products: params.selectedProducts ?? null,
    routine_plan: params.routinePlan ?? null,
    validation_warnings: params.route.validation_warnings,
    final_instructions: buildFinalInstructions(params.route, params.selectedProducts ?? null),
  }
}
