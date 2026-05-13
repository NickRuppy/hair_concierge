import type { GuidanceId } from "@/lib/agent/contracts"
import type {
  AgentActiveProfileSignal,
  ActiveProfileSignalField,
} from "@/lib/agent/orchestrator/route-packet"
import type {
  HairProfile,
  HairTexture,
  HairThickness,
  HairDensity,
  ProfileConcern,
  RoutineProduct,
  ScalpCondition,
  ScalpType,
} from "@/lib/types"

export interface CurrentTurnRoutineInventory {
  value: RoutineProduct[]
  evidence: string
  conflicts_with_saved: boolean
  saved_value: RoutineProduct[]
}

export interface CurrentTurnActiveConcern {
  field: ActiveProfileSignalField
  value: string
  evidence: string
  selection_effect: "override" | "augment" | "caution"
}

export interface CurrentTurnContextOverlay {
  routine_products: CurrentTurnRoutineInventory | null
  active_concerns: CurrentTurnActiveConcern[]
  safety_overlay_ids: GuidanceId[]
  has_explicit_reset_signal: boolean
}

export interface CurrentTurnConflictContext {
  routine_products: CurrentTurnRoutineInventory
}

const ROUTINE_PRODUCTS: RoutineProduct[] = [
  "shampoo",
  "conditioner",
  "leave_in",
  "oil",
  "mask",
  "heat_protectant",
  "serum",
  "scrub",
]

const ROUTINE_PRODUCT_PATTERNS: Array<{ value: RoutineProduct; pattern: RegExp; label: string }> = [
  { value: "shampoo", pattern: /\b(?:shampoo|schampoo)\b/, label: "Shampoo" },
  {
    value: "conditioner",
    pattern: /\b(?:conditioner|spuelung|spulung|haarspuelung|haarspulung)\b/,
    label: "Conditioner",
  },
  { value: "leave_in", pattern: /\b(?:leave[- ]?in|leavein)\b/, label: "Leave-in" },
  { value: "oil", pattern: /\b(?:oel|ol|haarol|haaroel|oil)\b/, label: "Oel" },
  { value: "mask", pattern: /\b(?:maske|haarkur|kur|hair mask)\b/, label: "Maske" },
  {
    value: "heat_protectant",
    pattern: /\b(?:hitzeschutz|heat protect(?:ant|ion)?)\b/,
    label: "Hitzeschutz",
  },
  { value: "serum", pattern: /\bserum\b/, label: "Serum" },
  { value: "scrub", pattern: /\b(?:scrub|kopfhautpeeling|peeling)\b/, label: "Scrub" },
]

export function extractCurrentTurnContextOverlay(params: {
  message: string
  recentMessages?: Array<{ role: "user" | "assistant"; content: string }>
  savedProfile: Pick<HairProfile, "current_routine_products"> | null | undefined
}): CurrentTurnContextOverlay {
  const routineProducts = extractRoutineProducts(params.message, params.savedProfile)
  const activeConcerns = mergeCurrentTurnConcerns(
    extractActiveConcerns(params.message),
    extractRecentAnaphoricConcerns(params.message, params.recentMessages ?? []),
  )
  const safetyOverlayIds = extractSafetyOverlayIds(activeConcerns)

  return {
    routine_products: routineProducts,
    active_concerns: activeConcerns,
    safety_overlay_ids: safetyOverlayIds,
    has_explicit_reset_signal: hasExplicitResetSignal(params.message),
  }
}

function mergeCurrentTurnConcerns(
  primary: CurrentTurnActiveConcern[],
  carried: CurrentTurnActiveConcern[],
): CurrentTurnActiveConcern[] {
  const merged = [...primary]
  for (const signal of carried) {
    if (
      !merged.some(
        (candidate) => candidate.field === signal.field && candidate.value === signal.value,
      )
    ) {
      merged.push(signal)
    }
  }
  return merged
}

function extractRecentAnaphoricConcerns(
  message: string,
  recentMessages: Array<{ role: "user" | "assistant"; content: string }>,
): CurrentTurnActiveConcern[] {
  if (!hasAnaphoricRoutineFollowup(message)) return []

  const carried: CurrentTurnActiveConcern[] = []
  for (const recent of [...recentMessages].reverse()) {
    if (recent.role !== "user") continue
    const scalpSignals = extractActiveConcerns(recent.content).filter(isScalpSafetySignal)
    for (const signal of scalpSignals) {
      if (
        !carried.some(
          (candidate) => candidate.field === signal.field && candidate.value === signal.value,
        )
      ) {
        carried.push({
          ...signal,
          evidence: signal.evidence,
          selection_effect:
            signal.selection_effect === "override" ? "caution" : signal.selection_effect,
        })
      }
    }
    if (carried.some((signal) => signal.field === "scalp_condition")) break
  }

  return carried
}

function hasAnaphoricRoutineFollowup(message: string): boolean {
  const normalized = normalizeMessage(message)
  return /\b(?:bis dahin|solange|in der routine|was kann ich machen|was soll ich machen|und jetzt|ok und)\b/.test(
    normalized,
  )
}

function isScalpSafetySignal(signal: CurrentTurnActiveConcern): boolean {
  return (
    signal.field === "scalp_condition" ||
    (signal.field === "scalp_type" && signal.value === "oily") ||
    (signal.field === "concerns" && (signal.value === "dandruff" || signal.value === "oily_scalp"))
  )
}

export function projectHairProfileForCurrentTurn(
  hairProfile: HairProfile | null,
  overlay: CurrentTurnContextOverlay,
): HairProfile | null {
  if (!hairProfile) return hairProfile

  let next: HairProfile | null = null
  const ensureNext = () => {
    next ??= {
      ...hairProfile,
      concerns: Array.isArray(hairProfile.concerns) ? [...hairProfile.concerns] : [],
      chemical_treatment: Array.isArray(hairProfile.chemical_treatment)
        ? [...hairProfile.chemical_treatment]
        : [],
      styling_tools: hairProfile.styling_tools ? [...hairProfile.styling_tools] : null,
      night_protection: hairProfile.night_protection ? [...hairProfile.night_protection] : null,
      current_routine_products: hairProfile.current_routine_products
        ? [...hairProfile.current_routine_products]
        : null,
    }
    return next
  }

  if (overlay.routine_products) {
    const profile = ensureNext()
    profile.current_routine_products = overlay.routine_products.value
    profile.products_used = overlay.routine_products.value.map(formatRoutineProduct).join(", ")
  }

  for (const signal of overlay.active_concerns) {
    const profile = ensureNext()

    if (signal.field === "hair_texture" && isHairTexture(signal.value)) {
      profile.hair_texture = signal.value
    } else if (signal.field === "thickness" && isHairThickness(signal.value)) {
      profile.thickness = signal.value
    } else if (signal.field === "density" && isHairDensity(signal.value)) {
      profile.density = signal.value
    } else if (signal.field === "scalp_type" && isScalpType(signal.value)) {
      profile.scalp_type = signal.value
    } else if (signal.field === "scalp_condition" && isScalpCondition(signal.value)) {
      profile.scalp_condition = signal.value
    } else if (signal.field === "concerns" && isProfileConcern(signal.value)) {
      const concerns = new Set(profile.concerns)
      concerns.add(signal.value)
      profile.concerns = [...concerns]
    }
  }

  return next ?? hairProfile
}

export function getCurrentTurnConflictContext(
  overlay: CurrentTurnContextOverlay,
): CurrentTurnConflictContext | null {
  if (overlay.routine_products?.conflicts_with_saved) {
    return { routine_products: overlay.routine_products }
  }

  return null
}

export function buildCurrentTurnActiveProfileSignals(
  overlay: CurrentTurnContextOverlay,
): AgentActiveProfileSignal[] {
  return overlay.active_concerns.map((signal) => ({
    field: signal.field,
    value: signal.value,
    source: "message",
    selection_effect: signal.selection_effect,
    evidence: signal.evidence,
  }))
}

function extractRoutineProducts(
  message: string,
  savedProfile: Pick<HairProfile, "current_routine_products"> | null | undefined,
): CurrentTurnRoutineInventory | null {
  const normalized = normalizeMessage(message)
  const inventorySegment = getRoutineInventorySegment(normalized)
  if (!inventorySegment) return null

  const values = ROUTINE_PRODUCT_PATTERNS.filter(({ pattern }) =>
    pattern.test(inventorySegment),
  ).map(({ value }) => value)
  const uniqueValues = ROUTINE_PRODUCTS.filter((product) => values.includes(product))
  if (uniqueValues.length === 0) return null
  if (uniqueValues.length === 1 && !/\bnur\b/.test(inventorySegment)) return null

  const savedValue = savedProfile?.current_routine_products ?? []
  return {
    value: uniqueValues,
    evidence: extractEvidence(message, uniqueValues),
    conflicts_with_saved: savedValue.length > 0 && !sameRoutineProducts(uniqueValues, savedValue),
    saved_value: savedValue,
  }
}

function getRoutineInventorySegment(normalized: string): string | null {
  const explicitOnlyMatch = /(?:^|[.!?]\s*)(?:aktuell\s+)?nur\s+[^.!?]{0,100}/.exec(normalized)
  if (explicitOnlyMatch && segmentHasRoutineProduct(explicitOnlyMatch[0])) {
    return explicitOnlyMatch[0]
  }

  const routineMatch =
    /\b(?:meine\s+)?(?:aktuelle\s+)?routine\b[^.!?]{0,140}/.exec(normalized) ??
    /\bmeine\s+routine\s+(?:besteht|ist)\s+(?:aus|nur)\s+[^.!?]{0,140}/.exec(normalized)
  if (routineMatch && segmentHasRoutineProduct(routineMatch[0])) {
    return routineMatch[0]
  }

  const usageMatch =
    /\b(?:ich\s+)?(?:nutze|benutze|verwende)\s+(?:aktuell\s+)?(?:nur\s+)?[^.!?]{0,120}/.exec(
      normalized,
    )
  if (usageMatch && segmentHasRoutineProduct(usageMatch[0])) {
    return usageMatch[0]
  }

  const haveMatch = /\b(?:ich\s+)?habe\s+(?:aktuell\s+)?(?:nur\s+)?[^.!?]{0,120}/.exec(normalized)
  if (haveMatch && startsWithRoutineInventoryAfterHave(haveMatch[0])) {
    return haveMatch[0]
  }

  return null
}

function segmentHasRoutineProduct(segment: string): boolean {
  return ROUTINE_PRODUCT_PATTERNS.some(({ pattern }) => pattern.test(segment))
}

function startsWithRoutineInventoryAfterHave(segment: string): boolean {
  const afterHave = segment.replace(/^\b(?:ich\s+)?habe\s+(?:aktuell\s+)?/, "")
  return /^(?:nur\s+)?(?:shampoo|schampoo|conditioner|spuelung|spulung|haarspuelung|haarspulung|leave[- ]?in|leavein|maske|haarkur|kur|oel|ol|haarol|haaroel|oil|hitzeschutz|serum|scrub|peeling)\b/.test(
    afterHave,
  )
}

function extractActiveConcerns(message: string): CurrentTurnActiveConcern[] {
  const normalized = normalizeMessage(message)
  const signals: CurrentTurnActiveConcern[] = []
  const add = (
    field: ActiveProfileSignalField,
    value: string,
    selectionEffect: CurrentTurnActiveConcern["selection_effect"],
    evidence: string,
  ) => {
    if (!signals.some((signal) => signal.field === field && signal.value === value)) {
      signals.push({ field, value, selection_effect: selectionEffect, evidence })
    }
  }

  if (/\blockig\w*\s+haar|\bhaar\w*.{0,25}\blockig\b|\bcurl(?:y|s)?\b/.test(normalized)) {
    add("hair_texture", "curly", "override", "lockiges Haar")
  }
  if (/\bfein\w*.{0,25}\bhaar|\bhaar\w*.{0,25}\bfein\b/.test(normalized)) {
    add("thickness", "fine", "override", "feines Haar")
  }
  if (
    /\b(?:wenig\w*|gering\w*|niedrig\w*)\s+(?:haar)?dichte\b/.test(normalized) ||
    /\bwenig\s+haare\b/.test(normalized)
  ) {
    add("density", "low", "override", "wenig Dichte")
  }
  if (/\bschnell\s+beschwert\b|\bbeschwert\s+schnell\b/.test(normalized)) {
    add("density", "low", "caution", "schnell beschwert")
  }
  if (/\bfrizz\b|\bkraus\b|\bfliegende\s+haare\b/.test(normalized)) {
    add("concerns", "frizz", "augment", "Frizz")
  }
  if (
    /\b(?:trockene?|strohige?)\s+(?:spitzen|laengen|langen)\b/.test(normalized) ||
    /\b(?:spitzen|laengen|langen)\b.{0,35}\b(?:trocken|strohig)\b/.test(normalized)
  ) {
    add("concerns", "dryness", "augment", "trockene Laengen/Spitzen")
  }
  if (
    /\bverknotete?\s+spitzen\b/.test(normalized) ||
    /\b(?:knoten|verknot\w*|verhak\w*)\b/.test(normalized)
  ) {
    add("concerns", "tangling", "augment", "verknotete Spitzen")
  }
  if (
    /\bfettig\w*\s+kopfhaut\b|\bkopfhaut\b.{0,35}\bfettig\b|\bfettender\s+ansatz\b/.test(normalized)
  ) {
    add("scalp_type", "oily", "override", "fettige Kopfhaut")
    add("concerns", "oily_scalp", "augment", "fettige Kopfhaut")
  }
  if (
    /\bjuck\w*\s+kopfhaut\b|\bkopfhaut\b.{0,35}\b(?:juckt|juckend|gereizt|brennt|brennen)\b|\bgereizt\w*\b|\bbrennt\b/.test(
      normalized,
    )
  ) {
    add("scalp_condition", "irritated", "caution", "juckende Kopfhaut")
  }
  if (
    /\b(?:trockene?|kleine?)\s+(?:schuppchen|schueppchen)\b|\b(?:schuppchen|schueppchen)\b.{0,30}\btrocken\b/.test(
      normalized,
    )
  ) {
    add("scalp_condition", "dry_flakes", "caution", "trockene kleine Schueppchen")
    add("concerns", "dandruff", "caution", "trockene kleine Schueppchen")
  }
  if (/\bschuppen\b|\bschuppchen\b|\bschueppchen\b|\bflakes\b/.test(normalized)) {
    if (
      !signals.some((signal) => signal.field === "scalp_condition" && signal.value === "dry_flakes")
    ) {
      add("scalp_condition", "dandruff", "caution", "Schuppen")
    }
    add("concerns", "dandruff", "caution", "Schuppen")
  }
  if (
    /\bhaarausfall\b|\bhaar\w*\s+fall\w*\s+aus\b|\bmir\s+fallen\s+haare\s+aus\b/.test(normalized)
  ) {
    add("concerns", "hair_loss", "caution", "Haarausfall")
  }

  return signals
}

function extractSafetyOverlayIds(signals: CurrentTurnActiveConcern[]): GuidanceId[] {
  const ids: GuidanceId[] = []
  const add = (id: GuidanceId) => {
    if (!ids.includes(id)) ids.push(id)
  }

  for (const signal of signals) {
    if (signal.field === "concerns" && signal.value === "hair_loss") {
      add("overlay:hair_loss_or_thinning_guardrail" as GuidanceId)
    }
    if (signal.field === "scalp_condition" && signal.value === "irritated") {
      add("overlay:sensitive_scalp" as GuidanceId)
    }
    if (signal.field === "scalp_condition" && signal.value === "dandruff") {
      add("overlay:dandruff_scalp" as GuidanceId)
    }
    if (signal.field === "scalp_condition" && signal.value === "dry_flakes") {
      add("overlay:dandruff_scalp" as GuidanceId)
      add("overlay:sensitive_scalp" as GuidanceId)
    }
  }

  return ids
}

function hasExplicitResetSignal(message: string): boolean {
  const normalized = normalizeMessage(message)
  return /\b(?:reset|tiefenreinigung|deep cleansing|clarifying|build\s?up|buildup|rueckstand\w*|ruckstand\w*|belegt|wachsig|ueberpflegt|uberpflegt)\b/.test(
    normalized,
  )
}

function normalizeMessage(value: string): string {
  return value
    .toLocaleLowerCase("de-DE")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function extractEvidence(message: string, products: RoutineProduct[]): string {
  const normalized = normalizeMessage(message)
  const startsAt = /\bnur\b/.exec(normalized)?.index ?? 0
  const rough = message.slice(startsAt, startsAt + 120).trim()
  if (rough) return rough

  return products.map(formatRoutineProduct).join(" und ")
}

function sameRoutineProducts(a: RoutineProduct[], b: RoutineProduct[]): boolean {
  if (a.length !== b.length) return false
  const aSet = new Set(a)
  return b.every((value) => aSet.has(value))
}

function formatRoutineProduct(value: RoutineProduct): string {
  return ROUTINE_PRODUCT_PATTERNS.find((entry) => entry.value === value)?.label ?? value
}

function isHairTexture(value: string): value is HairTexture {
  return value === "straight" || value === "wavy" || value === "curly" || value === "coily"
}

function isHairThickness(value: string): value is HairThickness {
  return value === "fine" || value === "normal" || value === "coarse"
}

function isHairDensity(value: string): value is HairDensity {
  return value === "low" || value === "medium" || value === "high"
}

function isScalpType(value: string): value is ScalpType {
  return value === "oily" || value === "balanced" || value === "dry"
}

function isScalpCondition(value: string): value is ScalpCondition {
  return value === "dandruff" || value === "dry_flakes" || value === "irritated"
}

function isProfileConcern(value: string): value is ProfileConcern {
  return (
    value === "hair_loss" ||
    value === "dandruff" ||
    value === "dryness" ||
    value === "oily_scalp" ||
    value === "hair_damage" ||
    value === "split_ends" ||
    value === "breakage" ||
    value === "frizz" ||
    value === "tangling" ||
    value === "thinning"
  )
}
