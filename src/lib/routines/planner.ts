import {
  PROFILE_CONCERN_LABELS,
  GOAL_LABELS,
  HAIR_TEXTURE_LABELS,
  SCALP_CONDITION_LABELS,
  SCALP_TYPE_LABELS,
  WASH_FREQUENCY_LABELS,
} from "@/lib/vocabulary"
import { CONDITIONER_REPAIR_LEVEL_LABELS } from "@/lib/conditioner/constants"
import {
  LEAVE_IN_NEED_BUCKET_LABELS,
  LEAVE_IN_STYLING_CONTEXT_LABELS,
} from "@/lib/leave-in/constants"
import {
  buildBrushToolsSlot,
  hasBrushToolsNeed,
  hasExplicitBrushToolsRequest,
} from "@/lib/routines/brush-tools"
import { CURLY_TEXTURES } from "@/lib/routines/constants"
import { hasDirectMechanicalStressSignals } from "@/lib/profile/signal-derivations"
import {
  buildRecommendationEngineRuntimeFromPersistence,
  buildRecommendationRequestContext,
} from "@/lib/recommendation-engine"
import { buildRoutineItemsFromInventoryCategories } from "@/lib/recommendation-engine/adapters/from-persistence"
import type {
  HairProfile,
  RoutineContext,
  RoutineDecisionContext,
  RoutineFocus,
  RoutinePlan,
  RoutinePlanSection,
  RoutineSlotAction,
  RoutineSlotAdvice,
  RoutineTopicActivation,
  RoutineTopicId,
} from "@/lib/types"

const ROUTINE_TOPIC_LABELS: Record<RoutineTopicId, string> = {
  routine_glatt: "Routine Glatt",
  routine_locken: "Routine Locken",
  locken_wellen: "Locken & Wellen",
  tiefenreinigung: "Tiefenreinigung",
  hair_oiling: "Hair Oiling",
  bond_builder: "Bond Builder",
  brush_tools: "Buersten & Tools",
  lockenrefresh: "Lockenrefresh",
  cwc: "CWC",
  owc: "OWC",
}

const MASK_TYPE_LABELS = {
  protein: "Protein",
  moisture: "Feuchtigkeit",
  performance: "Performance",
} as const

const CLARIFY_TERMS = [
  "tiefenreinigung",
  "clarify",
  "clarifying",
  "build up",
  "buildup",
  "ablagerung",
  "rueckstand",
  "ruckstand",
  "reset",
  "detox",
  "hartes wasser",
  "hard water",
]

const SCALP_TERMS = ["kopfhaut", "ansatz", "ansaetze", "scalp"]

const SCALP_CLARIFY_TERMS = [
  "nachfetten",
  "fettig",
  "oelig",
  "oily roots",
  "talg",
  "dry shampoo",
  "trockenshampoo",
]

const HARD_WATER_TERMS = [
  "hartes wasser",
  "hard water",
  "kalk",
  "mineralablagerung",
  "mineral build up",
  "mineral buildup",
]

const SWIMMING_TERMS = ["chlor", "chlorwasser", "pool", "schwimmen", "schwimmbad", "swimming"]

const CO_WASH_TERMS = [
  "co-wash",
  "cowash",
  "co wash",
  "nur conditioner",
  "nur spuelung",
  "nur spulung",
]

const HAIR_RESET_TERMS = [
  "wachsig",
  "waxy",
  "ueberpflegt",
  "uberpflegt",
  "coated",
  "belegt",
  "produktrotation",
  "product rotation",
  "zu viele produkte",
  "nichts zieht mehr ein",
  "ueberlagert",
  "uberlagert",
]

const HARD_RESET_TERMS = [
  "hard reset",
  "wachsig",
  "waxy",
  "ueberpflegt",
  "uberpflegt",
  "nichts zieht mehr ein",
  "zu viele produkte",
]

const SENSITIVE_SCALP_TERMS = ["juck", "itch", "schuppen", "seborr", "seb derm"]

const OILING_TERMS = [
  "hair oiling",
  "hairoiling",
  "scalp oiling",
  "oiling",
  "vor dem waschen",
  "pre wash",
  "pre-wash",
  "oel vor dem waschen",
  "oiling routine",
]

const BOND_BUILDER_TERMS = ["bond builder", "bond repair", "olaplex", "k18", "bonding"]

const REFRESH_TERMS = [
  "lockenrefresh",
  "locken refresh",
  "refresh",
  "auffrischen",
  "between wash",
  "tag danach",
  "naechster tag",
]

const CWC_TERMS = ["cwc", "cwc methode", "conditioner wash conditioner"]

const OWC_TERMS = ["owc", "owc methode", "oel waschen conditioner", "oil wash conditioner"]

const CWC_OWC_COMPARISON_TERMS = [
  "cwc oder owc",
  "owc oder cwc",
  "cwc vs owc",
  "owc vs cwc",
  "cwc und owc",
  "owc und cwc",
  "unterschied cwc owc",
  "unterschied zwischen cwc und owc",
]

const HEAVY_STYLING_TERMS = [
  "trockenshampoo",
  "dry shampoo",
  "gel",
  "mousse",
  "schaum",
  "serum",
  "silikon",
  "silicone",
  "haarspray",
  "stylingcreme",
  "styling cream",
  "wachs",
  "wax",
  "pomade",
]

const UNDERPERFORMING_ROUTINE_TERMS = [
  "bringt nichts",
  "wirkt nicht",
  "funktioniert nicht",
  "keine wirkung",
  "build up",
  "buildup",
  "beschwert",
  "klatschig",
  "ueberlagert",
  "uberlagert",
]

const WASH_LESS_TERMS = [
  "weniger waschen",
  "seltener waschen",
  "wash less",
  "laenger frisch",
  "langer frisch",
]

const HEAVY_ROUTINE_PRODUCTS = new Set(["mask", "oil", "leave_in"])

const STYLING_KIND_MAP: [RegExp, string][] = [
  [/lockencreme|curl\s*cream/i, "Lockencreme"],
  [/mousse|schaum/i, "Mousse"],
  [/gel\b/i, "Gel"],
  [/creme|cream/i, "Stylingcreme"],
]

function detectStylingProductKind(productsUsed: string | null): string | null {
  if (!productsUsed) return null
  const text = normalizeText(productsUsed)
  for (const [pattern, label] of STYLING_KIND_MAP) {
    if (pattern.test(text)) return label
  }
  return null
}

function hasRefreshDrynessNeed(profile: HairProfile | null): boolean {
  const concerns = profile?.concerns ?? []
  const goals = profile?.goals ?? []
  return (
    concerns.includes("dryness") ||
    concerns.includes("hair_damage") ||
    concerns.includes("breakage") ||
    concerns.includes("tangling") ||
    goals.includes("healthier_hair") ||
    profile?.cuticle_condition === "rough" ||
    (profile?.chemical_treatment ?? []).some((t) => t !== "natural")
  )
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
}

function includesAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(normalizeText(term)))
}

function getBaseRoutineTopicId(profile: HairProfile | null): RoutineTopicId | null {
  switch (profile?.hair_texture) {
    case "straight":
      return "routine_glatt"
    case "wavy":
      return "locken_wellen"
    case "curly":
    case "coily":
      return "routine_locken"
    default:
      return null
  }
}

function hasBetweenWashDays(washFrequency: HairProfile["wash_frequency"]): boolean {
  return washFrequency !== null && washFrequency !== "daily"
}

function getCombinedRoutineText(profile: HairProfile | null, normalizedMessage: string): string {
  const productText = normalizeText(profile?.products_used ?? "")
  return `${normalizedMessage} ${productText}`.trim()
}

function countHeavyRoutineProducts(profile: HairProfile | null): number {
  return (profile?.current_routine_products ?? []).filter((entry) =>
    HEAVY_ROUTINE_PRODUCTS.has(entry),
  ).length
}

function hasHairOilingUsage(profile: HairProfile | null, combinedText: string): boolean {
  return (
    (profile?.current_routine_products ?? []).includes("oil") ||
    includesAny(combinedText, OILING_TERMS)
  )
}

function hasSensitiveScalpSignals(profile: HairProfile | null, combinedText: string): boolean {
  return (
    profile?.scalp_condition === "irritated" ||
    profile?.scalp_condition === "dry_flakes" ||
    profile?.scalp_condition === "dandruff" ||
    includesAny(combinedText, SENSITIVE_SCALP_TERMS)
  )
}

function hasScalpClarifySignals(profile: HairProfile | null, normalizedMessage: string): boolean {
  const combinedText = getCombinedRoutineText(profile, normalizedMessage)
  const explicitScalpClarify =
    includesAny(normalizedMessage, CLARIFY_TERMS) && includesAny(combinedText, SCALP_TERMS)

  return (
    explicitScalpClarify ||
    profile?.scalp_type === "oily" ||
    (profile?.concerns ?? []).includes("oily_scalp") ||
    includesAny(combinedText, SCALP_CLARIFY_TERMS)
  )
}

function hasHairResetSignals(profile: HairProfile | null, normalizedMessage: string): boolean {
  const heavyProductCount = countHeavyRoutineProducts(profile)
  const combinedText = getCombinedRoutineText(profile, normalizedMessage)
  const explicitHairReset =
    includesAny(normalizedMessage, CLARIFY_TERMS) && !includesAny(combinedText, SCALP_TERMS)
  const hasHardWaterExposure = includesAny(combinedText, HARD_WATER_TERMS)
  const hasSwimmingExposure = includesAny(combinedText, SWIMMING_TERMS)
  const hasCoWashBurden = includesAny(combinedText, CO_WASH_TERMS)
  const hasHairOiling = hasHairOilingUsage(profile, combinedText)
  const hasHeavyStyling = includesAny(combinedText, HEAVY_STYLING_TERMS)
  const hasOverloadLanguage =
    includesAny(combinedText, UNDERPERFORMING_ROUTINE_TERMS) ||
    includesAny(combinedText, HAIR_RESET_TERMS)
  const hasLowWashBurden =
    includesAny(combinedText, WASH_LESS_TERMS) &&
    (heavyProductCount >= 2 || hasHeavyStyling || hasHairOiling)
  const hasVolumeSupportedReset =
    (profile?.goals ?? []).includes("volume") &&
    (heavyProductCount >= 1 ||
      hasHeavyStyling ||
      hasOverloadLanguage ||
      hasHardWaterExposure ||
      hasSwimmingExposure ||
      hasCoWashBurden)

  return (
    explicitHairReset ||
    hasHardWaterExposure ||
    hasSwimmingExposure ||
    hasCoWashBurden ||
    hasOverloadLanguage ||
    heavyProductCount >= 2 ||
    hasHairOiling ||
    hasHeavyStyling ||
    hasLowWashBurden ||
    hasVolumeSupportedReset
  )
}

function hasHardResetSignals(profile: HairProfile | null, normalizedMessage: string): boolean {
  const heavyProductCount = countHeavyRoutineProducts(profile)
  const combinedText = getCombinedRoutineText(profile, normalizedMessage)
  const hasHardWaterExposure = includesAny(combinedText, HARD_WATER_TERMS)
  const hasSwimmingExposure = includesAny(combinedText, SWIMMING_TERMS)
  const hasCoWashBurden = includesAny(combinedText, CO_WASH_TERMS)
  const hasHairOiling = hasHairOilingUsage(profile, combinedText)
  const hasHeavyStyling = includesAny(combinedText, HEAVY_STYLING_TERMS)
  const hasHardResetLanguage =
    includesAny(combinedText, HARD_RESET_TERMS) || includesAny(combinedText, HAIR_RESET_TERMS)
  const overloadCount = [
    heavyProductCount >= 2,
    hasHairOiling,
    hasHeavyStyling,
    hasHardWaterExposure,
    hasSwimmingExposure,
    hasCoWashBurden,
  ].filter(Boolean).length

  return (
    hasHardResetLanguage ||
    heavyProductCount >= 3 ||
    (heavyProductCount >= 2 && hasHeavyStyling) ||
    overloadCount >= 3
  )
}

function hasDrynessDamageSignals(profile: HairProfile | null): boolean {
  const concerns = new Set(profile?.concerns ?? [])
  const goals = new Set(profile?.goals ?? [])
  const treatments = new Set(profile?.chemical_treatment ?? [])

  return (
    concerns.has("dryness") ||
    concerns.has("hair_damage") ||
    concerns.has("split_ends") ||
    concerns.has("breakage") ||
    concerns.has("frizz") ||
    goals.has("moisture") ||
    goals.has("less_frizz") ||
    goals.has("healthier_hair") ||
    goals.has("less_split_ends") ||
    profile?.cuticle_condition === "slightly_rough" ||
    profile?.cuticle_condition === "rough" ||
    treatments.has("colored") ||
    treatments.has("bleached")
  )
}

function hasFrequentUnprotectedHeat(profile: HairProfile | null): boolean {
  return (
    (profile?.heat_styling === "daily" || profile?.heat_styling === "several_weekly") &&
    !(profile?.uses_heat_protection ?? false)
  )
}

function hasDamageSignals(profile: HairProfile | null): boolean {
  const concerns = new Set(profile?.concerns ?? [])
  const treatments = new Set(profile?.chemical_treatment ?? [])

  return (
    profile?.protein_moisture_balance === "snaps" ||
    concerns.has("breakage") ||
    concerns.has("hair_damage") ||
    concerns.has("split_ends") ||
    profile?.cuticle_condition === "rough" ||
    treatments.has("colored") ||
    treatments.has("bleached") ||
    hasFrequentUnprotectedHeat(profile)
  )
}

function hasBondBuilderSignals(profile: HairProfile | null): boolean {
  if (!hasDamageSignals(profile)) return false

  const concerns = new Set(profile?.concerns ?? [])
  const treatments = new Set(profile?.chemical_treatment ?? [])
  const hasColoredOnly =
    treatments.has("colored") &&
    !treatments.has("bleached") &&
    !concerns.has("breakage") &&
    !concerns.has("hair_damage") &&
    !concerns.has("split_ends") &&
    profile?.cuticle_condition !== "rough" &&
    !hasFrequentUnprotectedHeat(profile)

  return !hasColoredOnly
}

function countDamageSignals(profile: HairProfile | null): number {
  const concerns = new Set(profile?.concerns ?? [])
  const treatments = new Set(profile?.chemical_treatment ?? [])
  let count = 0

  if (profile?.protein_moisture_balance === "snaps") count++
  if (treatments.has("bleached")) count++
  if (treatments.has("colored")) count++
  if (profile?.cuticle_condition === "rough") count++
  if (concerns.has("breakage")) count++
  if (concerns.has("hair_damage")) count++
  if (concerns.has("split_ends")) count++
  if (hasFrequentUnprotectedHeat(profile)) count++

  return count
}

function deriveBondBuilderSeverity(profile: HairProfile | null): "moderate" | "severe" {
  const treatments = new Set(profile?.chemical_treatment ?? [])

  if (profile?.protein_moisture_balance === "snaps") return "severe"
  if (treatments.has("bleached") && countDamageSignals(profile) >= 2) return "severe"
  if (countDamageSignals(profile) >= 3) return "severe"

  return "moderate"
}

function hasOilWeightRisk(profile: HairProfile | null): boolean {
  return profile?.thickness === "fine" && profile?.density === "high"
}

function hasFrequentWashNeed(washFrequency: HairProfile["wash_frequency"]): boolean {
  return washFrequency === "daily" || washFrequency === "every_2_3_days"
}

function hasMechanicalStressNeed(profile: HairProfile | null): boolean {
  return hasDirectMechanicalStressSignals(
    profile?.towel_technique,
    profile?.brush_type,
    profile?.night_protection,
  )
}

function hasWashProtectionNeed(profile: HairProfile | null): boolean {
  return hasDrynessDamageSignals(profile) || hasMechanicalStressNeed(profile)
}

function hasStrongDrynessDamageCluster(profile: HairProfile | null): boolean {
  const concerns = new Set(profile?.concerns ?? [])

  return (
    concerns.has("dryness") ||
    concerns.has("breakage") ||
    concerns.has("hair_damage") ||
    concerns.has("split_ends")
  )
}

function countOwcSupportSignals(profile: HairProfile | null, context: RoutineContext): number {
  const treatments = new Set(profile?.chemical_treatment ?? [])
  let count = 0

  if (treatments.has("colored") || treatments.has("bleached")) count++
  if (profile?.cuticle_condition === "rough" || profile?.cuticle_condition === "slightly_rough") {
    count++
  }
  if (hasStrongDrynessDamageCluster(profile)) count++
  if (hasFrequentWashNeed(context.wash_frequency)) count++
  if (hasMechanicalStressNeed(profile)) count++

  return count
}

function hasOwcProactiveBlock(context: RoutineContext): boolean {
  return context.has_oil_weight_risk || context.scalp_type === "oily" || context.has_buildup_signals
}

function hasOwcFit(profile: HairProfile | null, context: RoutineContext): boolean {
  if (!context.has_wash_protection_need) return false

  switch (profile?.hair_texture) {
    case "wavy":
      return countOwcSupportSignals(profile, context) >= 2 && !hasOwcProactiveBlock(context)
    case "curly":
    case "coily":
      return !hasOwcProactiveBlock(context)
    default:
      return false
  }
}

function isCwcOwcComparisonRequest(message: string): boolean {
  const normalizedMessage = normalizeText(message)
  return (
    (includesAny(normalizedMessage, CWC_TERMS) && includesAny(normalizedMessage, OWC_TERMS)) ||
    includesAny(normalizedMessage, CWC_OWC_COMPARISON_TERMS)
  )
}

function selectWashProtectionTopic(
  profile: HairProfile | null,
  context: RoutineContext,
  message: string,
): { topicId: "cwc" | "owc" | null; compareMode: boolean } {
  const compareMode = isCwcOwcComparisonRequest(message)
  const explicitCwc = context.explicit_topic_ids.includes("cwc")
  const explicitOwc = context.explicit_topic_ids.includes("owc")

  if (compareMode) {
    const topicId = hasOwcFit(profile, context)
      ? "owc"
      : context.has_wash_protection_need
        ? "cwc"
        : null

    return { topicId, compareMode }
  }

  if (explicitOwc) {
    return { topicId: "owc", compareMode }
  }

  if (explicitCwc) {
    return { topicId: "cwc", compareMode }
  }

  if (!context.has_wash_protection_need) {
    return { topicId: null, compareMode }
  }

  switch (profile?.hair_texture) {
    case "straight":
      return { topicId: "cwc", compareMode }
    case "wavy":
      return { topicId: hasOwcFit(profile, context) ? "owc" : "cwc", compareMode }
    case "curly":
    case "coily":
      return { topicId: hasOwcFit(profile, context) ? "owc" : null, compareMode }
    default:
      return { topicId: null, compareMode }
  }
}

function buildPrimaryFocuses(
  profile: HairProfile | null,
  explicitTopicIds: RoutineTopicId[],
): RoutineFocus[] {
  const focuses: RoutineFocus[] = []
  const seen = new Set<string>()

  const pushFocus = (focus: RoutineFocus) => {
    const key = `${focus.kind}:${focus.code}`
    if (seen.has(key)) return
    seen.add(key)
    focuses.push(focus)
  }

  for (const topicId of explicitTopicIds) {
    pushFocus({
      kind: "topic",
      code: topicId,
      label: ROUTINE_TOPIC_LABELS[topicId],
    })
  }

  for (const concern of profile?.concerns ?? []) {
    pushFocus({
      kind: "concern",
      code: concern,
      label: PROFILE_CONCERN_LABELS[concern] ?? concern,
    })
  }

  for (const goal of profile?.goals ?? []) {
    pushFocus({
      kind: "goal",
      code: goal,
      label: GOAL_LABELS[goal] ?? goal,
    })
  }

  if (profile?.scalp_condition) {
    pushFocus({
      kind: "scalp",
      code: profile.scalp_condition,
      label: SCALP_CONDITION_LABELS[profile.scalp_condition] ?? profile.scalp_condition,
    })
  } else if (profile?.scalp_type && profile.scalp_type !== "balanced") {
    pushFocus({
      kind: "scalp",
      code: profile.scalp_type,
      label: SCALP_TYPE_LABELS[profile.scalp_type] ?? profile.scalp_type,
    })
  }

  if (profile?.hair_texture) {
    pushFocus({
      kind: "pattern",
      code: profile.hair_texture,
      label: HAIR_TEXTURE_LABELS[profile.hair_texture] ?? profile.hair_texture,
    })
  }

  return focuses
}

function getExplicitTopicIds(message: string): RoutineTopicId[] {
  const normalizedMessage = normalizeText(message)
  const topics: RoutineTopicId[] = []

  if (includesAny(normalizedMessage, CLARIFY_TERMS)) topics.push("tiefenreinigung")
  if (includesAny(normalizedMessage, OILING_TERMS)) topics.push("hair_oiling")
  if (includesAny(normalizedMessage, BOND_BUILDER_TERMS)) topics.push("bond_builder")
  if (hasExplicitBrushToolsRequest(normalizedMessage)) topics.push("brush_tools")
  if (includesAny(normalizedMessage, REFRESH_TERMS)) topics.push("lockenrefresh")
  if (includesAny(normalizedMessage, CWC_TERMS)) topics.push("cwc")
  if (includesAny(normalizedMessage, OWC_TERMS)) topics.push("owc")

  return topics
}

export function deriveRoutineContext(profile: HairProfile | null, message: string): RoutineContext {
  const normalizedMessage = normalizeText(message)
  const combinedText = getCombinedRoutineText(profile, normalizedMessage)
  const hasScalpClarify = hasScalpClarifySignals(profile, normalizedMessage)
  const hasHairReset = hasHairResetSignals(profile, normalizedMessage)
  const hasSensitiveScalp = hasSensitiveScalpSignals(profile, combinedText)
  const explicitTopicIds = getExplicitTopicIds(message)
  const primaryFocuses = buildPrimaryFocuses(profile, explicitTopicIds)
  const organizerComplete =
    explicitTopicIds.length > 0 ||
    (profile?.concerns?.length ?? 0) > 0 ||
    (profile?.goals?.length ?? 0) > 0 ||
    Boolean(profile?.hair_texture)
  const cadenceComplete =
    Boolean(profile?.wash_frequency) ||
    Boolean(profile?.scalp_type) ||
    (profile?.current_routine_products?.length ?? 0) > 0
  const inventoryComplete =
    (profile?.current_routine_products?.length ?? 0) > 0 || Boolean(profile?.products_used?.trim())

  return {
    hair_texture: profile?.hair_texture ?? null,
    thickness: profile?.thickness ?? null,
    density: profile?.density ?? null,
    wash_frequency: profile?.wash_frequency ?? null,
    heat_styling: profile?.heat_styling ?? null,
    styling_tools: profile?.styling_tools ?? null,
    drying_method: profile?.drying_method ?? null,
    scalp_type: profile?.scalp_type ?? null,
    scalp_condition: profile?.scalp_condition ?? null,
    cuticle_condition: profile?.cuticle_condition ?? null,
    protein_moisture_balance: profile?.protein_moisture_balance ?? null,
    concerns: profile?.concerns ?? [],
    goals: profile?.goals ?? [],
    chemical_treatment: profile?.chemical_treatment ?? [],
    current_routine_products: profile?.current_routine_products ?? [],
    products_used: profile?.products_used ?? null,
    explicit_topic_ids: explicitTopicIds,
    primary_focuses: primaryFocuses,
    organizer_complete: organizerComplete,
    cadence_complete: cadenceComplete,
    inventory_complete: inventoryComplete,
    has_between_wash_days: hasBetweenWashDays(profile?.wash_frequency ?? null),
    has_buildup_signals: hasScalpClarify || hasHairReset,
    has_scalp_clarify_signals: hasScalpClarify,
    has_hair_reset_signals: hasHairReset,
    has_hard_reset_signals: hasHardResetSignals(profile, normalizedMessage) && !hasSensitiveScalp,
    has_sensitive_scalp_signals: hasSensitiveScalp,
    has_dryness_damage_signals: hasDrynessDamageSignals(profile),
    has_damage_signals: hasDamageSignals(profile),
    has_bond_builder_signals: hasBondBuilderSignals(profile),
    has_oil_weight_risk: hasOilWeightRisk(profile),
    has_wash_protection_need: hasWashProtectionNeed(profile),
    uses_heat_protection: profile?.uses_heat_protection ?? false,
  }
}

function createTopicActivation(
  id: RoutineTopicId,
  reason: string,
  priority: number,
  instructionOnly: boolean,
): RoutineTopicActivation {
  return {
    id,
    label: ROUTINE_TOPIC_LABELS[id],
    reason,
    priority,
    instruction_only: instructionOnly,
  }
}

function hasProactiveHairOilingFit(context: RoutineContext): boolean {
  return (
    context.concerns.includes("dryness") ||
    context.concerns.includes("breakage") ||
    context.concerns.includes("hair_damage") ||
    context.concerns.includes("split_ends") ||
    context.goals.includes("moisture") ||
    context.cuticle_condition === "slightly_rough" ||
    context.cuticle_condition === "rough" ||
    context.chemical_treatment.includes("colored") ||
    context.chemical_treatment.includes("bleached")
  )
}

function hasScalpHairOilingFit(context: RoutineContext): boolean {
  return (
    context.scalp_type === "dry" &&
    context.scalp_condition !== "dry_flakes" &&
    context.scalp_condition !== "dandruff" &&
    context.scalp_condition !== "irritated"
  )
}

export function activateRoutineTopics(
  profile: HairProfile | null,
  message: string,
  context: RoutineContext = deriveRoutineContext(profile, message),
): RoutineTopicActivation[] {
  const normalizedMessage = normalizeText(message)
  const activations: RoutineTopicActivation[] = []
  const seen = new Set<RoutineTopicId>()

  const push = (id: RoutineTopicId, reason: string, priority: number, instructionOnly: boolean) => {
    if (seen.has(id)) return
    seen.add(id)
    activations.push(createTopicActivation(id, reason, priority, instructionOnly))
  }

  const baseTopicId = getBaseRoutineTopicId(profile)
  if (baseTopicId) {
    push(baseTopicId, "Das Haarmuster legt die Grundstruktur der Routine fest.", 10, false)
  }

  const explicit = new Set(context.explicit_topic_ids)
  const washProtectionSelection = selectWashProtectionTopic(profile, context, message)

  if (explicit.has("tiefenreinigung") || context.has_buildup_signals) {
    const clarifyReason = explicit.has("tiefenreinigung")
      ? "Die Frage zielt direkt auf Build-up oder Tiefenreinigung."
      : context.has_scalp_clarify_signals && context.has_hair_reset_signals
        ? "Kopfhaut- und Rueckstands-Signale sprechen fuer einen gezielten Reset."
        : context.has_scalp_clarify_signals
          ? "Kopfhaut- und Sebum-Signale sprechen fuer eine gezielte Kopfhaut-Tiefenreinigung."
          : "Rueckstaende, Produktueberlagerung oder Mineralien sprechen fuer einen gezielten Reset."
    push("tiefenreinigung", clarifyReason, 30, true)
  }

  if (
    explicit.has("hair_oiling") ||
    hasScalpHairOilingFit(context) ||
    (hasProactiveHairOilingFit(context) && !context.has_oil_weight_risk)
  ) {
    const scalpDriven = hasScalpHairOilingFit(context)
    push(
      "hair_oiling",
      explicit.has("hair_oiling")
        ? "Hair Oiling wurde direkt angefragt."
        : scalpDriven
          ? "Kopfhaut-Signale sprechen fuer ein unterstuetzendes Pre-Wash-Oiling."
          : "Trockenheits- und Schadenssignale sprechen fuer ein vorsichtiges Pre-Wash-Oiling.",
      40,
      false,
    )
  }

  if (explicit.has("bond_builder") || context.has_bond_builder_signals) {
    const explicitOnly = explicit.has("bond_builder") && !context.has_bond_builder_signals

    push(
      "bond_builder",
      explicit.has("bond_builder")
        ? "Bond Builder wurde direkt angefragt."
        : "Schadens- oder Chemie-Signale sprechen fuer Repair-Support.",
      45,
      true,
    )

    if (!explicitOnly && !seen.has("tiefenreinigung")) {
      push(
        "tiefenreinigung",
        "Bond Builder brauchen Zugang zur inneren Haarstruktur — Rueckstaende von Silikonen oder Stylingprodukten koennen die Aufnahme blockieren.",
        30,
        true,
      )
    }
  }

  if (explicit.has("brush_tools") || hasBrushToolsNeed(profile, normalizedMessage, context)) {
    push(
      "brush_tools",
      explicit.has("brush_tools")
        ? "Buersten oder Tools wurden direkt angefragt."
        : "Mechanische Belastung oder Entwirr-Signale sprechen fuer gezielte Tool- und Anwendungshinweise.",
      55,
      true,
    )
  }

  if (
    explicit.has("lockenrefresh") ||
    (context.has_between_wash_days &&
      context.hair_texture !== null &&
      CURLY_TEXTURES.has(context.hair_texture))
  ) {
    push(
      "lockenrefresh",
      explicit.has("lockenrefresh")
        ? "Lockenrefresh wurde direkt angefragt."
        : "Zwischenwaschtage bei Wellen oder Locken brauchen haeufig eine Refresh-Option.",
      50,
      true,
    )
  }

  if (washProtectionSelection.topicId) {
    const topicId = washProtectionSelection.topicId
    const explicitRequest =
      (topicId === "cwc" && explicit.has("cwc")) || (topicId === "owc" && explicit.has("owc"))

    let reason: string
    if (washProtectionSelection.compareMode) {
      reason = `CWC und OWC wurden direkt verglichen; ${ROUTINE_TOPIC_LABELS[topicId]} passt hier voraussichtlich besser.`
    } else if (explicitRequest) {
      reason = `${ROUTINE_TOPIC_LABELS[topicId]} wurde direkt angefragt.`
    } else if (topicId === "cwc") {
      reason = "Das Profil spricht eher fuer eine schonende Conditioner-Schutzwaesche."
    } else {
      reason = "Das Profil spricht eher fuer eine Oel-Vorwaesche mit anschliessender Schutzpflege."
    }

    push(topicId, reason, 60, true)
  }

  return activations.sort((a, b) => a.priority - b.priority)
}

export function buildRoutineClarificationQuestions(
  profile: HairProfile | null,
  message: string,
): string[] {
  const context = deriveRoutineContext(profile, message)
  const questions: string[] = []

  if (!context.organizer_complete) {
    questions.push(
      "Was soll deine Routine gerade vor allem leisten - weniger Frizz, mehr Feuchtigkeit, Definition, Reparatur oder eher etwas fuer die Kopfhaut?",
    )
  }

  if (!context.cadence_complete) {
    questions.push("Wie oft waeschst du deine Haare aktuell?")
  }

  if (!context.inventory_complete) {
    questions.push(
      "Welche Schritte sind aktuell schon fest in deiner Routine - Shampoo, Conditioner, Leave-in, Maske oder Oel?",
    )
  }

  if (!profile?.hair_texture) {
    questions.push("Ist dein Haar eher glatt, wellig, lockig oder kraus?")
  }

  return questions.slice(0, 3)
}

function hasCurrentProduct(
  profile: HairProfile | null,
  product: NonNullable<HairProfile["current_routine_products"]>[number],
): boolean {
  return (profile?.current_routine_products ?? []).includes(product)
}

function buildSectionSummary(
  phase: RoutinePlanSection["phase"],
  profile: HairProfile | null,
): string {
  if (phase === "base_wash") {
    const washLabel = profile?.wash_frequency
      ? (WASH_FREQUENCY_LABELS[profile.wash_frequency] ?? profile.wash_frequency)
      : "an deinen Waschtagen"
    return `Die Basisroutine orientiert sich an ${washLabel.toLowerCase()}.`
  }

  if (phase === "maintenance") {
    return "Diese Punkte halten die Routine zwischen den Waschtagen oder direkt danach stimmig."
  }

  return "Das sind optionale oder gelegentliche Bausteine, die nur bei Bedarf dazukommen."
}

function pushSlot(
  sections: Map<RoutinePlanSection["phase"], RoutineSlotAdvice[]>,
  slot: RoutineSlotAdvice,
): void {
  sections.set(slot.phase, [...(sections.get(slot.phase) ?? []), slot])
}

function buildMaskCadence(maskStrength: number): string {
  if (maskStrength >= 3) return "etwa jede 2. Waesche"
  if (maskStrength === 2) return "alle 2-3 Waeschen"
  return "alle 4-5 Waeschen"
}

function getRoutineLeaveInNeedLabel(
  need:
    | NonNullable<
        ReturnType<
          typeof buildRecommendationEngineRuntimeFromPersistence
        >["categories"]["leaveIn"]["targetProfile"]
      >["needBucket"]
    | null,
): string | null {
  switch (need) {
    case "heat_protect":
      return LEAVE_IN_NEED_BUCKET_LABELS.heat_protect
    case "curl_definition":
      return LEAVE_IN_NEED_BUCKET_LABELS.curl_definition
    case "repair":
      return LEAVE_IN_NEED_BUCKET_LABELS.repair
    case "detangle_smooth":
      return "Feuchtigkeit & Anti-Frizz"
    default:
      return null
  }
}

function getRoutineMaskTypeLabel(
  balance:
    | NonNullable<
        ReturnType<
          typeof buildRecommendationEngineRuntimeFromPersistence
        >["categories"]["mask"]["targetProfile"]
      >["balance"]
    | null,
): string | null {
  switch (balance) {
    case "protein":
      return MASK_TYPE_LABELS.protein
    case "moisture":
      return MASK_TYPE_LABELS.moisture
    case "balanced":
      return MASK_TYPE_LABELS.performance
    default:
      return null
  }
}

function buildRoutineDecisionContext(
  profile: HairProfile | null,
  message: string,
): RoutineDecisionContext {
  const runtime = buildRecommendationEngineRuntimeFromPersistence(
    profile,
    buildRoutineItemsFromInventoryCategories(profile?.current_routine_products),
    buildRecommendationRequestContext({
      requestedCategory: "routine",
      message,
    }),
  )

  return {
    shampoo: runtime.categories.shampoo,
    conditioner: runtime.categories.conditioner,
    leave_in: runtime.categories.leaveIn,
    mask: runtime.categories.mask,
  }
}

function buildCwcTechniqueSlot(): RoutineSlotAdvice {
  return {
    id: "base-cwc-technique",
    kind: "instruction",
    phase: "base_wash",
    label: "CWC als Wash-Day-Schutz",
    action: "add",
    category: null,
    cadence: "als Wash-Day-Variante bei Bedarf",
    rationale: [
      "CWC ist hier eine Wash-Day-Variante, kein Pflichtschritt fuer jede Waesche.",
      "1. Conditioner auf trockene Laengen und Spitzen geben.",
      "2. Shampoo nur an der Kopfhaut verwenden.",
      "3. Den entstehenden Schaum sanft durch die Laengen gleiten lassen.",
      "4. Zum Schluss erneut Conditioner auftragen und ausspuelen.",
    ],
    caveats: [
      "Wenn die Haare schnell belegt wirken, nicht als Standard fuer jede Waesche etablieren.",
    ],
    topic_ids: ["cwc"],
    product_linkable: false,
    product_query: null,
    attachment_priority: 92,
  }
}

function buildScalpClarifySlot(
  context: RoutineContext,
  shampooPresent: boolean,
): RoutineSlotAdvice {
  const rationale = [
    "Hier geht es primaer um Talg, Kopfhaut-Rueckstaende und schnell belegte Ansaetze - nicht um einen Voll-Reset fuer die Laengen.",
    context.has_sensitive_scalp_signals
      ? "Bei sensibler Kopfhaut lieber sanft und gezielt reinigen statt die Intensitaet hochzuziehen."
      : "Wenn der Ansatz schnell nachfettet oder Dry-Shampoo-Reste sitzen, kann punktuell auch ein sanftes Scalp-Exfoliant vor der Waesche sinnvoll sein.",
  ]

  const caveats = context.has_sensitive_scalp_signals
    ? [
        "Bei juckender, schuppiger oder gereizter Kopfhaut eher konservativ bleiben und bevorzugt ein gezieltes Kopfhaut-Shampoo priorisieren.",
      ]
    : []

  return {
    id: "occasional-scalp-clarify",
    kind: "instruction",
    phase: "occasional",
    label: "Kopfhaut-Tiefenreinigung",
    action: shampooPresent ? "adjust" : "add",
    category: null,
    cadence:
      context.scalp_type === "oily"
        ? "alle 1-2 Wochen nach Bedarf"
        : "punktuell bei belegtem Ansatz",
    rationale,
    caveats,
    topic_ids: ["tiefenreinigung"],
    product_linkable: false,
    product_query: null,
    attachment_priority: 95,
  }
}

function buildHairResetSlot(params: {
  context: RoutineContext
  shampooPresent: boolean
  bondBuilderDriven: boolean
  educational: boolean
}): RoutineSlotAdvice {
  const { context, shampooPresent, bondBuilderDriven, educational } = params

  const rationale = bondBuilderDriven
    ? [
        "Bond Builder brauchen saubere Haarstruktur - Rueckstaende koennen die Aufnahme blockieren.",
        "Vor Bond Builder ist ein Haar-Reset oft sinnvoller als noch mehr Produkt auf ueberlagerte Laengen zu schichten.",
        "Danach immer Conditioner oder Maske einplanen, damit die Laengen nicht stumpf bleiben.",
      ]
    : educational
      ? [
          "Tiefenreinigung ist ein gezielter Reset fuer Rueckstaende auf Haar und Kopfhaut, kein Pflichtschritt fuer jede Routine.",
          "Fuer die Laengen wird sie vor allem dann spannend, wenn Produkte, Mineralien oder Poolwasser die Haare schwer oder stumpf machen.",
          "Danach immer Conditioner oder Maske einplanen, damit die Laengen wieder geschmeidig werden.",
        ]
      : [
          "Hier geht es vor allem um Rueckstaende auf Laengen und Spitzen - etwa durch Leave-ins, Oele, Styling, Mineralien oder Poolwasser.",
          "Ein Haar-Reset schafft wieder eine saubere Basis, wenn sich die Haare wachsig, belegt oder ueberpflegt anfuehlen.",
          "Danach immer Conditioner oder Maske einplanen, damit die Laengen nicht stumpf bleiben.",
        ]

  rationale.push(
    "Auf sauberem Haar greifen Pflege oder farbauffrischende Produkte oft gleichmaessiger - das ist ein Bonus, kein Pflichtargument.",
  )

  const caveats = context.has_sensitive_scalp_signals
    ? [
        "Die Kopfhaut wirkt eher sensibel - deshalb gezielt reinigen und die Intensitaet nicht unnoetig hochziehen.",
      ]
    : []

  return {
    id: "occasional-hair-reset",
    kind: "instruction",
    phase: "occasional",
    label: "Haar-Reset / Tiefenreinigung",
    action: shampooPresent ? "adjust" : "add",
    category: null,
    cadence: educational
      ? "bei deutlichem Build-up nach Bedarf"
      : "alle 2-3 Wochen oder bei Build-up",
    rationale,
    caveats,
    topic_ids: ["tiefenreinigung"],
    product_linkable: false,
    product_query: null,
    attachment_priority: 96,
  }
}

function buildHardResetSlot(context: RoutineContext): RoutineSlotAdvice {
  const caveats = [
    "Nur fuer echte Ueberlagerung - nicht als Standard fuer jede Waesche etablieren.",
  ]

  if (context.has_sensitive_scalp_signals) {
    caveats.push(
      "Bei schuppiger, trockener oder gereizter Kopfhaut lieber beim normalen Haar-Reset bleiben.",
    )
  }

  return {
    id: "occasional-hard-reset",
    kind: "instruction",
    phase: "occasional",
    label: "Hard Reset",
    action: "add",
    category: null,
    cadence: "selten und nur bei deutlicher Ueberlagerung",
    rationale: [
      "Das ist die Eskalationsstufe fuer wirklich belegte, wachsig wirkende oder deutlich ueberpflegte Haare.",
      "Wenn viele Produkte rotieren oder kaum noch etwas sauber einzieht, kann punktuell ein staerkerer Reset sinnvoll sein.",
      "Danach immer Conditioner oder Maske einplanen, damit die Haare nicht quietschig oder stumpf bleiben.",
    ],
    caveats,
    topic_ids: ["tiefenreinigung"],
    product_linkable: false,
    product_query: null,
    attachment_priority: 97,
  }
}

function buildOwcOilSlot(
  context: RoutineContext,
  explicitOwcRequest: boolean,
  oilPresent: boolean,
): RoutineSlotAdvice {
  const oilAction: RoutineSlotAction = oilPresent ? "adjust" : "add"
  const cautiousDueToWeight = context.has_oil_weight_risk

  return {
    id: "base-owc-oil",
    kind: "product_slot",
    phase: "base_wash",
    label: "OWC Oel-Schutz",
    action: oilAction,
    category: "oil",
    cadence: "als Wash-Day-Variante bei Bedarf",
    rationale: [
      "Fuer OWC braucht es ein sparsam dosiertes Oel nur fuer Laengen und Spitzen vor dem Waschen.",
      oilPresent
        ? "Wenn schon ein Oel in der Routine ist, hier eher Dosierung und Einsatz pruefen als direkt mehr Produkt zu stapeln."
        : "Wenn noch kein Oel da ist, reicht fuer OWC ein leichtes Pre-Wash-Oel statt eines schweren Finish-Oels.",
    ],
    caveats: [
      "Bei schnell fettender Kopfhaut oder Build-up nicht als Standard etablieren.",
      "Bei feinem, dichtem Haar nur sehr sparsam dosieren.",
      "Wenn die Haare schnell belegt wirken, eher bei CWC bleiben oder OWC nur punktuell testen.",
    ],
    topic_ids: ["owc"],
    product_linkable: oilAction === "add" && !(explicitOwcRequest && cautiousDueToWeight),
    product_query: "Ich suche ein natuerliches Oel fuer OWC vor dem Waschen.",
    attachment_priority: 15,
  }
}

function buildOwcTechniqueSlot(
  profile: HairProfile | null,
  context: RoutineContext,
): RoutineSlotAdvice {
  const caveats = [
    "Bei schnell fettender Kopfhaut oder Build-up nicht als Standard etablieren.",
    "Bei feinem, dichtem Haar nur sehr sparsam dosieren.",
    "Wenn die Haare schnell belegt wirken, eher bei CWC bleiben oder OWC nur punktuell testen.",
  ]

  if (profile?.hair_texture === "straight") {
    caveats.unshift(
      "OWC ist bei glattem Haar meist nicht die erste Wahl und eher ein gezielter Test als ein Default.",
    )
  }

  if (context.has_oil_weight_risk) {
    caveats.push(
      "Das Profil hat ein hoeheres Beschwerungsrisiko — lieber mit minimaler Menge starten.",
    )
  }

  return {
    id: "base-owc-technique",
    kind: "instruction",
    phase: "base_wash",
    label: "OWC als Wash-Day-Schutz",
    action: "add",
    category: null,
    cadence: "als Wash-Day-Variante bei Bedarf",
    rationale: [
      "OWC ist hier eine Wash-Day-Variante fuer mehr Schutz, nicht automatisch die Basis jeder Waesche.",
      "1. Oel mit Praying Hands oder Scrunching sparsam in trockene Laengen und Spitzen geben.",
      "2. Shampoo zuerst direkt am trockenen Ansatz verteilen.",
      "3. Dann Wasser dazugeben und den Schaum sanft durch die Laengen ziehen.",
      "4. Zum Schluss Conditioner auftragen und ausspuelen.",
    ],
    caveats,
    topic_ids: ["owc"],
    product_linkable: false,
    product_query: null,
    attachment_priority: 91,
  }
}

function buildRoutineSlots(
  profile: HairProfile | null,
  context: RoutineContext,
  message: string,
  activations: RoutineTopicActivation[],
  decisionContext: RoutineDecisionContext,
  options: { usesBondBuilder: boolean },
): Map<RoutinePlanSection["phase"], RoutineSlotAdvice[]> {
  const sections = new Map<RoutinePlanSection["phase"], RoutineSlotAdvice[]>()
  const activeTopicIds = new Set(activations.map((entry) => entry.id))
  const activeWashProtectionTopic = activeTopicIds.has("owc")
    ? "owc"
    : activeTopicIds.has("cwc")
      ? "cwc"
      : null
  const explicitOwcRequest = context.explicit_topic_ids.includes("owc")
  const shampooPresent = hasCurrentProduct(profile, "shampoo")
  const conditionerPresent = hasCurrentProduct(profile, "conditioner")
  const leaveInPresent = hasCurrentProduct(profile, "leave_in")
  const maskPresent = hasCurrentProduct(profile, "mask")
  const oilPresent = hasCurrentProduct(profile, "oil")
  const {
    shampoo: shampooDecision,
    conditioner: conditionerDecision,
    leave_in: leaveInDecision,
    mask: maskDecision,
  } = decisionContext

  pushSlot(sections, {
    id: "base-shampoo",
    kind: "product_slot",
    phase: "base_wash",
    label: "Shampoo",
    action: shampooPresent ? "keep" : "add",
    category: "shampoo",
    cadence: profile?.wash_frequency
      ? `${WASH_FREQUENCY_LABELS[profile.wash_frequency] ?? profile.wash_frequency}`
      : "an deinen Waschtagen",
    rationale: [
      "Shampoo bleibt der feste Startpunkt fuer die Kopfhaut und die Waschfrequenz.",
      profile?.scalp_type
        ? `Die Kopfhaut ist hier ein echtes Steuersignal (${SCALP_TYPE_LABELS[profile.scalp_type] ?? profile.scalp_type}).`
        : "Die Kopfhaut-Situation entscheidet, wie mild oder reset-lastig gereinigt werden sollte.",
    ],
    caveats: [],
    topic_ids: activations[0] ? [activations[0].id] : [],
    product_linkable:
      !shampooPresent &&
      shampooDecision.relevant &&
      Boolean(shampooDecision.targetProfile?.shampooBucket),
    product_query: "Ich suche ein Shampoo fuer meine regulaeren Waschtage.",
    attachment_priority: 50,
  })

  const conditionerReasons = ["Conditioner bleibt der feste Pflegeanker nach jeder Waesche."]
  if (conditionerDecision.targetProfile?.balance) {
    conditionerReasons.push(
      `Der Conditioner sollte vor allem ${
        conditionerDecision.targetProfile.balance === "balanced"
          ? "ausgewogen pflegen"
          : conditionerDecision.targetProfile.balance === "moisture"
            ? "mehr Feuchtigkeit liefern"
            : "mehr Struktur und Repair geben"
      }.`,
    )
  }
  if (conditionerDecision.targetProfile?.repairLevel) {
    conditionerReasons.push(
      `Der Repair-Fokus liegt eher bei ${CONDITIONER_REPAIR_LEVEL_LABELS[conditionerDecision.targetProfile.repairLevel]}.`,
    )
  }

  const conditionerAction: RoutineSlotAction = conditionerPresent
    ? conditionerDecision.targetProfile?.balance &&
      conditionerDecision.targetProfile.balance !== "balanced"
      ? "upgrade"
      : conditionerDecision.targetProfile?.repairLevel === "high"
        ? "upgrade"
        : "keep"
    : "add"

  pushSlot(sections, {
    id: "base-conditioner",
    kind: "product_slot",
    phase: "base_wash",
    label: "Conditioner",
    action: conditionerAction,
    category: "conditioner",
    cadence: "nach jeder Waesche",
    rationale: conditionerReasons,
    caveats: [],
    topic_ids: activations[0] ? [activations[0].id] : [],
    product_linkable:
      (conditionerAction === "add" || conditionerAction === "upgrade") &&
      conditionerDecision.relevant,
    product_query: "Ich suche einen Conditioner fuer meine Basisroutine.",
    attachment_priority: 20,
  })

  const explicitWashProtectionWithoutNeed =
    activeWashProtectionTopic !== null &&
    (context.explicit_topic_ids.includes("cwc") || context.explicit_topic_ids.includes("owc")) &&
    !context.has_wash_protection_need

  if (activeWashProtectionTopic === "cwc") {
    if (explicitWashProtectionWithoutNeed) {
      pushSlot(sections, {
        id: "base-cwc-technique",
        kind: "instruction",
        phase: "base_wash",
        label: "CWC als Wash-Day-Schutz",
        action: "add",
        category: null,
        cadence: null,
        rationale: [
          "CWC ist ein optionaler Wash-Day-Baustein fuer gezielte Pflege und kein Pflichtschritt.",
        ],
        caveats: [
          "Dein Profil zeigt aktuell keine starken Trockenheits- oder Schadenssignale — CWC ist hier eher optional, aber wir erklaeren gerne wie es funktioniert.",
        ],
        topic_ids: ["cwc"],
        product_linkable: false,
        product_query: null,
        attachment_priority: 92,
      })
    } else {
      pushSlot(sections, buildCwcTechniqueSlot())
    }
  }

  if (activeWashProtectionTopic === "owc") {
    if (explicitWashProtectionWithoutNeed) {
      pushSlot(sections, {
        id: "base-owc-technique",
        kind: "instruction",
        phase: "base_wash",
        label: "OWC als Wash-Day-Schutz",
        action: "add",
        category: null,
        cadence: null,
        rationale: [
          "OWC ist ein optionaler Wash-Day-Baustein fuer gezielte Pflege und kein Pflichtschritt.",
        ],
        caveats: [
          "Dein Profil zeigt aktuell keine starken Trockenheits- oder Schadenssignale — OWC ist hier eher optional, aber wir erklaeren gerne wie es funktioniert.",
        ],
        topic_ids: ["owc"],
        product_linkable: false,
        product_query: null,
        attachment_priority: 92,
      })
    } else {
      pushSlot(sections, buildOwcOilSlot(context, explicitOwcRequest, oilPresent))
      pushSlot(sections, buildOwcTechniqueSlot(profile, context))
    }
  }

  const shouldUseLeaveIn =
    Boolean(leaveInDecision.targetProfile?.needBucket) ||
    activeTopicIds.has("lockenrefresh") ||
    context.goals.includes("less_frizz") ||
    context.goals.includes("moisture") ||
    context.goals.includes("curl_definition") ||
    context.concerns.includes("frizz") ||
    context.concerns.includes("dryness") ||
    context.concerns.includes("tangling")

  if (shouldUseLeaveIn || leaveInPresent) {
    const leaveInAction: RoutineSlotAction =
      !shouldUseLeaveIn && leaveInPresent ? "avoid" : leaveInPresent ? "adjust" : "add"

    const leaveInReasons = [
      "Ein Leave-in oder Finish-Schritt macht die Routine nach dem Waschen runder.",
    ]
    if (leaveInDecision.targetProfile?.needBucket) {
      leaveInReasons.push(
        `Der Schwerpunkt liegt eher auf ${getRoutineLeaveInNeedLabel(leaveInDecision.targetProfile.needBucket) ?? leaveInDecision.targetProfile.needBucket}.`,
      )
    }
    if (leaveInDecision.targetProfile?.stylingContext) {
      leaveInReasons.push(
        `Der Finish-Schritt soll vor allem fuer ${LEAVE_IN_STYLING_CONTEXT_LABELS[leaveInDecision.targetProfile.stylingContext]} passen.`,
      )
    }

    pushSlot(sections, {
      id: "maintenance-leave-in",
      kind: "product_slot",
      phase: "maintenance",
      label: "Leave-in / Finish",
      action: leaveInAction,
      category: "leave_in",
      cadence: "nach dem Waschen, sparsam dosiert",
      rationale: leaveInReasons,
      caveats: [],
      topic_ids: activeTopicIds.has("lockenrefresh")
        ? ["lockenrefresh"]
        : activations[0]
          ? [activations[0].id]
          : [],
      product_linkable: leaveInAction === "add" && leaveInDecision.relevant,
      product_query: "Ich suche ein Leave-in fuer meine Routine nach dem Waschen.",
      attachment_priority: 10,
    })
  }

  if (activeTopicIds.has("lockenrefresh")) {
    const stylingKind = detectStylingProductKind(profile?.products_used ?? null)
    const productEcho = stylingKind
      ? `Verwende dein ${stylingKind} vom letzten Waschtag — nicht mit neuen Produkten experimentieren.`
      : "Verwende dasselbe Styling-Produkt vom letzten Waschtag — nicht mit neuen Produkten experimentieren."

    const refreshRationale = [
      "Lockenrefresh ist eine abgekuerzte Version des letzten Steps der Locken-Routine — nur leicht anfeuchten, Produkt auffrischen, trocknen lassen.",
      productEcho,
      "Regelmaessiges Auffrischen trainiert langfristig die Lockenstruktur.",
    ]

    const refreshCaveats: string[] = []

    if (hasRefreshDrynessNeed(profile)) {
      refreshRationale.splice(
        2,
        0,
        "Bei Bedarf vorher etwas Leave-In in trockene Laengen einarbeiten (siehe Leave-In-Slot).",
      )
      if (profile?.thickness === "fine") {
        refreshCaveats.push(
          "Bei feinem Haar reicht oft schon ein minimaler Tropfen Leave-In, damit die Locken nicht beschwert werden.",
        )
      }
    }

    pushSlot(sections, {
      id: "maintenance-refresh",
      kind: "instruction",
      phase: "maintenance",
      label: "Lockenrefresh",
      action: leaveInPresent ? "adjust" : "add",
      category: null,
      cadence: "an Tagen zwischen den Waeschen, ca. 10 Min.",
      rationale: refreshRationale,
      caveats: refreshCaveats,
      topic_ids: ["lockenrefresh"],
      product_linkable: false,
      product_query: null,
      attachment_priority: 90,
    })
  }

  if (activeTopicIds.has("brush_tools")) {
    pushSlot(sections, buildBrushToolsSlot(profile, context, normalizeText(message)))
  }

  if (maskDecision.relevant || maskPresent) {
    pushSlot(sections, {
      id: "occasional-mask",
      kind: "product_slot",
      phase: "occasional",
      label: "Maske / Kur",
      action: !maskDecision.relevant ? "avoid" : maskPresent ? "adjust" : "add",
      category: "mask",
      cadence: maskDecision.relevant
        ? buildMaskCadence(maskDecision.targetProfile?.needStrength ?? 0)
        : "vorerst nicht fest einplanen",
      rationale: maskDecision.relevant
        ? [
            "Eine Maske bleibt Zusatzpflege und wird nur bei echtem Bedarf fest eingeplant.",
            getRoutineMaskTypeLabel(maskDecision.targetProfile?.balance ?? null)
              ? `Der Fokus liegt eher auf ${getRoutineMaskTypeLabel(maskDecision.targetProfile?.balance ?? null)}.`
              : "Die Maske wird ueber Bedarf und Vertraeglichkeit gesteuert.",
          ]
        : ["Aktuell sprechen die Profilsignale nicht fuer eine feste Masken-Rolle in der Routine."],
      caveats: [],
      topic_ids: activeTopicIds.has("bond_builder") ? ["bond_builder"] : [],
      product_linkable:
        !maskPresent && maskDecision.relevant && Boolean(maskDecision.targetProfile?.balance),
      product_query: "Ich suche eine Maske fuer meine Routine.",
      attachment_priority: 30,
    })
  }

  if (activeTopicIds.has("tiefenreinigung")) {
    const bondBuilderDriven = activeTopicIds.has("bond_builder")
    const educationalClarify =
      context.explicit_topic_ids.includes("tiefenreinigung") &&
      !context.has_scalp_clarify_signals &&
      !context.has_hair_reset_signals &&
      !bondBuilderDriven

    if (context.has_scalp_clarify_signals) {
      pushSlot(sections, buildScalpClarifySlot(context, shampooPresent))
    }

    if (context.has_hair_reset_signals || bondBuilderDriven || educationalClarify) {
      pushSlot(
        sections,
        buildHairResetSlot({
          context,
          shampooPresent,
          bondBuilderDriven,
          educational: educationalClarify,
        }),
      )
    }

    if (context.has_hard_reset_signals) {
      pushSlot(sections, buildHardResetSlot(context))
    }
  }

  if ((activeTopicIds.has("hair_oiling") || oilPresent) && activeWashProtectionTopic !== "owc") {
    const oilAction: RoutineSlotAction = !activeTopicIds.has("hair_oiling")
      ? "avoid"
      : oilPresent
        ? "adjust"
        : "add"
    const oilActive = oilAction === "add" || oilAction === "adjust"

    const oilRationale = [
      "Hair Oiling bleibt ein optionaler Pre-Wash-Baustein und keine Pflicht fuer jede Routine.",
      hasScalpHairOilingFit(context)
        ? "Es kann trockene, nicht entzuendliche Kopfhaut sanft unterstuetzen und gleichzeitig Laengen und Spitzen vor der Waesche schuetzen."
        : "Es ist vor allem dann sinnvoll, wenn Trockenheit oder Oberflaechenschaeden ein Thema sind.",
    ]
    if (oilActive) {
      oilRationale.push(
        "Wichtig beim Auswaschen: Shampoo zuerst auf trockenes Haar auftragen, dann erst mit Wasser ausspuelen.",
      )
    }

    const oilCaveats: string[] = []
    if (context.scalp_condition === "irritated") {
      oilCaveats.push(
        "Bei stark gereizter Kopfhaut eher sanft bleiben und die Routine nicht ueberladen.",
      )
    }
    if (oilActive) {
      oilCaveats.push(
        "Aetherische Oele (z.B. Rosmarin, Teebaum) nie pur auftragen — immer mit einem Basisoel verduennen.",
      )
    }

    pushSlot(sections, {
      id: "occasional-oil",
      kind: "product_slot",
      phase: "occasional",
      label: "Hair Oiling",
      action: oilAction,
      category: "oil",
      cadence: "vor einzelnen Waeschen nach Bedarf",
      rationale: oilRationale,
      caveats: oilCaveats,
      topic_ids: ["hair_oiling"],
      product_linkable: activeTopicIds.has("hair_oiling") && !oilPresent,
      product_query: "Ich moechte Hair Oiling vor dem Waschen machen.",
      attachment_priority: 40,
    })
  }

  if (activeTopicIds.has("bond_builder")) {
    const explicitWithoutSignals =
      context.explicit_topic_ids.includes("bond_builder") && !context.has_bond_builder_signals

    if (explicitWithoutSignals) {
      pushSlot(sections, {
        id: "occasional-bond-builder",
        kind: "instruction",
        phase: "occasional",
        label: "Bond Builder / Repair-Support",
        action: options.usesBondBuilder ? "adjust" : "add",
        category: null,
        cadence: null,
        rationale: [
          "Bond Builder ist ein optionaler Baustein fuer gezielte Reparatur auf molekularer Ebene.",
        ],
        caveats: [
          "Dein Profil zeigt aktuell keine starken Schadenssignale — Bond Builder ist hier eher optional, aber wir erklaeren gerne wie es funktioniert.",
        ],
        topic_ids: ["bond_builder"],
        product_linkable: false,
        product_query: null,
        attachment_priority: 96,
      })
    } else {
      const severity = deriveBondBuilderSeverity(profile)
      const treatments = new Set(profile?.chemical_treatment ?? [])
      const hasChemical = treatments.has("bleached") || treatments.has("colored")

      const bondRationale: string[] =
        severity === "severe"
          ? [
              "Die Kombination aus K18 und Olaplex kann die Reparatur deutlich verstaerken — K18 fuer Laengsverbindungen, Olaplex fuer Querverbindungen.",
            ]
          : hasChemical
            ? [
                "Bond Builder kann hier gezielt unterstuetzen.",
                "Bei chemischer Belastung kann Olaplex (Querverbindungen) besonders sinnvoll sein.",
              ]
            : [
                "Bond Builder kann hier gezielt unterstuetzen.",
                "Bei allgemeiner Schaedigung ohne Chemie ist K18 (Laengsverbindungen) oft der bessere Einstieg.",
              ]

      const bondCaveats: string[] = [
        "Zu haeufige Anwendung kann das Haar steif und sproede machen — Pausen einhalten.",
      ]

      if (profile?.protein_moisture_balance === "snaps") {
        bondCaveats.push(
          "Die Haare reissen aktuell leicht — ein professionelles Beratungsgespraech kann hier zusaetzlich helfen.",
        )
      } else if (profile?.protein_moisture_balance === "stretches_stays") {
        bondCaveats.push(
          "Bond Builder und Protein koennen parallel laufen, solange die Haare noch ueberdehnt sind.",
        )
      } else if (profile?.protein_moisture_balance === "stretches_bounces") {
        bondCaveats.push(
          "Die Haare sind aktuell stabil — Protein-Behandlungen dazu sind nicht mehr noetig, Feuchtigkeit reicht.",
        )
      }

      pushSlot(sections, {
        id: "occasional-bond-builder",
        kind: "instruction",
        phase: "occasional",
        label: "Bond Builder / Repair-Support",
        action: options.usesBondBuilder ? "adjust" : "add",
        category: null,
        cadence: "4 Anwendungen am Stueck, dann 4 Waeschen Pause, danach nach Bedarf",
        rationale: bondRationale,
        caveats: bondCaveats,
        topic_ids: ["bond_builder"],
        product_linkable: false,
        product_query: null,
        attachment_priority: 96,
      })
    }
  }

  return sections
}

export function buildRoutinePlan(
  profile: HairProfile | null,
  message: string,
  options: { usesBondBuilder?: boolean } = {},
): RoutinePlan {
  const context = deriveRoutineContext(profile, message)
  const activeTopics = activateRoutineTopics(profile, message, context)
  const compareMode = isCwcOwcComparisonRequest(message)
  const decisionContext = buildRoutineDecisionContext(profile, message)
  const sectionSlots = buildRoutineSlots(profile, context, message, activeTopics, decisionContext, {
    usesBondBuilder: options.usesBondBuilder ?? false,
  })

  const phases: RoutinePlanSection["phase"][] = ["base_wash", "maintenance", "occasional"]
  const sections: RoutinePlanSection[] = phases
    .map((phase) => ({
      phase,
      title:
        phase === "base_wash"
          ? "Basisroutine"
          : phase === "maintenance"
            ? "Pflege zwischen den Waeschen"
            : "Gelegentliche Extras",
      summary: buildSectionSummary(phase, profile),
      slots: sectionSlots.get(phase) ?? [],
    }))
    .filter((section) => section.phase === "base_wash" || section.slots.length > 0)

  return {
    base_topic_id: getBaseRoutineTopicId(profile),
    primary_focuses: context.primary_focuses,
    active_topics: activeTopics,
    compare_cwc_owc: compareMode,
    sections,
    decision_context: decisionContext,
  }
}

export function buildRoutineRetrievalSubqueries(message: string, plan: RoutinePlan): string[] {
  const focusSummary = plan.primary_focuses
    .filter((focus) => !(focus.kind === "topic" && (focus.code === "cwc" || focus.code === "owc")))
    .slice(0, 2)
    .map((focus) => focus.label)
    .join(" ")

  const queries = new Set<string>([message])

  if (plan.compare_cwc_owc) {
    queries.add("CWC")
    queries.add("OWC")
  }

  for (const topic of plan.active_topics) {
    const query = focusSummary ? `${topic.label} ${focusSummary}` : topic.label
    queries.add(query)
  }

  for (const section of plan.sections) {
    for (const slot of section.slots) {
      if (!slot.product_query) continue
      queries.add(slot.product_query)
    }
  }

  return [...queries].slice(0, 7)
}

export function getRoutineAutofillSlots(plan: RoutinePlan): RoutineSlotAdvice[] {
  return plan.sections
    .flatMap((section) => section.slots)
    .filter((slot) => slot.product_linkable && (slot.action === "add" || slot.action === "upgrade"))
    .sort((a, b) => a.attachment_priority - b.attachment_priority)
}

export { detectStylingProductKind, ROUTINE_TOPIC_LABELS }
