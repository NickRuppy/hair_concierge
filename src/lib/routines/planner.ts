import {
  PROFILE_CONCERN_LABELS,
  GOAL_LABELS,
  HAIR_TEXTURE_LABELS,
  SCALP_CONDITION_LABELS,
  SCALP_TYPE_LABELS,
  PRODUCT_FREQUENCY_LABELS,
  isProductFrequencyAtLeast,
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
import {
  applyHairLengthRoutineCopy,
  applyHairLengthRoutinePolicy,
  hasHeatExposureNeed,
} from "@/lib/routines/hair-length-policy"
import { hasDirectMechanicalStressSignals } from "@/lib/profile/signal-derivations"
import {
  buildRecommendationEngineRuntimeFromPersistence,
  buildRecommendationRequestContext,
} from "@/lib/recommendation-engine"
import { buildRoutineItemsFromInventoryCategories } from "@/lib/recommendation-engine/adapters/from-persistence"
import { suppressLengthOnlyCare } from "@/lib/recommendation-engine/hair-length"
import type {
  HairProfile,
  RoutineContext,
  RoutineDecisionContext,
  RoutineLayer,
  RoutineLayerProjection,
  RoutineFocus,
  RoutinePlan,
  RoutinePlanSection,
  RoutinePriorityLever,
  RoutineProductCategory,
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
  brush_tools: "Bürsten & Tools",
  lockenrefresh: "Lockenrefresh",
  night_protection: "Nachtschutz",
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

const NIGHT_PROTECTION_TERMS = [
  "nachtschutz",
  "schlafen",
  "schlaffrisur",
  "seidenkissen",
  "satinkissen",
  "seidenhaube",
  "bonnet",
  "pineapple",
  "hairhomie",
  "hair homie",
  "laengenschutz",
  "längenschutz",
  "spitzenschutz",
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

type BuildRoutinePlanOptions = {
  usesBondBuilder?: boolean
  forceRequestedCategory?: RoutineProductCategory | null
}

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

function hasBetweenWashDays(shampooFrequency: HairProfile["shampoo_frequency"]): boolean {
  return shampooFrequency !== null && shampooFrequency !== "daily_1x"
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

function hasFrequentWashNeed(shampooFrequency: HairProfile["shampoo_frequency"]): boolean {
  return isProductFrequencyAtLeast(shampooFrequency, "weekly_3_4x")
}

function hasMechanicalStressNeed(profile: HairProfile | null): boolean {
  return hasDirectMechanicalStressSignals(profile?.towel_technique, profile?.brush_type)
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
  if (hasFrequentWashNeed(context.shampoo_frequency)) count++
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
  const lacksLengthEndsZone = suppressLengthOnlyCare(profile?.hair_length ?? null)

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

  if (lacksLengthEndsZone && !context.has_dryness_damage_signals && !context.has_damage_signals) {
    return { topicId: null, compareMode }
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
  if (includesAny(normalizedMessage, NIGHT_PROTECTION_TERMS)) topics.push("night_protection")
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
    Boolean(profile?.shampoo_frequency) ||
    Boolean(profile?.scalp_type) ||
    (profile?.current_routine_products?.length ?? 0) > 0
  const inventoryComplete =
    (profile?.current_routine_products?.length ?? 0) > 0 || Boolean(profile?.products_used?.trim())

  return {
    hair_texture: profile?.hair_texture ?? null,
    thickness: profile?.thickness ?? null,
    density: profile?.density ?? null,
    shampoo_frequency: profile?.shampoo_frequency ?? null,
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
    has_between_wash_days: hasBetweenWashDays(profile?.shampoo_frequency ?? null),
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

function hasExplicitNoNightProtection(profile: HairProfile | null): boolean {
  return Array.isArray(profile?.night_protection) && profile.night_protection.length === 0
}

function hasSelectedNightProtection(profile: HairProfile | null): boolean {
  return Array.isArray(profile?.night_protection) && profile.night_protection.length > 0
}

function hasNightProtectionConcernOrGoalFit(context: RoutineContext): boolean {
  return (
    context.concerns.includes("breakage") ||
    context.concerns.includes("split_ends") ||
    context.concerns.includes("hair_damage") ||
    context.concerns.includes("tangling") ||
    context.concerns.includes("frizz") ||
    context.goals.includes("less_frizz") ||
    context.goals.includes("curl_definition") ||
    context.goals.includes("healthier_hair") ||
    context.goals.includes("anti_breakage") ||
    context.goals.includes("strengthen") ||
    context.goals.includes("less_split_ends")
  )
}

function hasLongHairNightProtectionFit(profile: HairProfile | null): boolean {
  return profile?.hair_length === "long" || profile?.hair_length === "very_long"
}

function shouldAddNightProtectionSlot(
  profile: HairProfile | null,
  context: RoutineContext,
): boolean {
  if (!hasExplicitNoNightProtection(profile)) return false

  return (
    context.explicit_topic_ids.includes("night_protection") ||
    hasNightProtectionConcernOrGoalFit(context) ||
    hasLongHairNightProtectionFit(profile)
  )
}

function shouldAdjustNightProtectionSlot(
  profile: HairProfile | null,
  context: RoutineContext,
): boolean {
  if (!hasSelectedNightProtection(profile)) return false

  return (
    context.explicit_topic_ids.includes("night_protection") ||
    (hasLongHairNightProtectionFit(profile) && hasNightProtectionConcernOrGoalFit(context))
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
        ? "Kopfhaut- und Rückstands-Signale sprechen für einen gezielten Reset."
        : context.has_scalp_clarify_signals
          ? "Kopfhaut- und Sebum-Signale sprechen für eine gezielte Kopfhaut-Tiefenreinigung."
          : "Rückstände, Produktüberlagerung oder Mineralien sprechen für einen gezielten Reset."
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
          ? "Kopfhaut-Signale sprechen für ein unterstützendes Pre-Wash-Oiling."
          : "Trockenheits- und Schadenssignale sprechen für ein vorsichtiges Pre-Wash-Oiling.",
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
        : "Schadens- oder Chemie-Signale sprechen für Repair-Support.",
      45,
      true,
    )

    if (!explicitOnly && !seen.has("tiefenreinigung")) {
      push(
        "tiefenreinigung",
        "Bond Builder brauchen Zugang zur inneren Haarstruktur — Rückstände von Silikonen oder Stylingprodukten können die Aufnahme blockieren.",
        30,
        true,
      )
    }
  }

  const lacksLengthEndsZone = suppressLengthOnlyCare(profile?.hair_length ?? null)
  if (
    explicit.has("brush_tools") ||
    (!lacksLengthEndsZone && hasBrushToolsNeed(profile, normalizedMessage))
  ) {
    push(
      "brush_tools",
      explicit.has("brush_tools")
        ? "Bürsten oder Tools wurden direkt angefragt."
        : "Mechanische Belastung oder Entwirr-Signale sprechen für gezielte Tool- und Anwendungshinweise.",
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
        : "Zwischenwaschtage bei Wellen oder Locken brauchen häufig eine Refresh-Option.",
      50,
      true,
    )
  }

  if (
    explicit.has("night_protection") ||
    shouldAddNightProtectionSlot(profile, context) ||
    shouldAdjustNightProtectionSlot(profile, context)
  ) {
    push(
      "night_protection",
      explicit.has("night_protection")
        ? "Nachtschutz wurde direkt angefragt."
        : hasSelectedNightProtection(profile)
          ? "Bestehender Nachtschutz trifft auf Reibungs-, Frizz- oder Längen-Signale."
          : "Kein ausgewählter Nachtschutz trifft auf Reibungs-, Frizz- oder Längen-Signale.",
      65,
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
      reason = "Das Profil spricht eher für eine schonende Conditioner-Schutzwäsche."
    } else {
      reason = "Das Profil spricht eher für eine Öl-Vorwäsche mit anschließender Schutzpflege."
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
      "Was soll deine Routine gerade vor allem leisten - weniger Frizz, mehr Feuchtigkeit, Definition, Reparatur oder eher etwas für die Kopfhaut?",
    )
  }

  if (!context.cadence_complete) {
    questions.push("Wie oft wäschst du deine Haare aktuell?")
  }

  if (!context.inventory_complete) {
    questions.push(
      "Welche Schritte sind aktuell schon fest in deiner Routine - Shampoo, Conditioner, Leave-in, Maske oder Öl?",
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
    const washLabel = profile?.shampoo_frequency
      ? (PRODUCT_FREQUENCY_LABELS[profile.shampoo_frequency] ?? profile.shampoo_frequency)
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

function hasRoutineCategorySlot(
  sections: Map<RoutinePlanSection["phase"], RoutineSlotAdvice[]>,
  category: RoutineProductCategory,
): boolean {
  return [...sections.values()].some((slots) => slots.some((slot) => slot.category === category))
}

function buildForcedRequestedCategorySlot(
  category: RoutineProductCategory,
  profile: HairProfile | null,
): RoutineSlotAdvice | null {
  switch (category) {
    case "leave_in":
      return {
        id: "maintenance-leave-in",
        kind: "product_slot",
        phase: "maintenance",
        label: "Leave-in / Finish",
        action: "add",
        category: "leave_in",
        cadence: "nach dem Waschen, sparsam dosiert",
        rationale: [
          "Leave-in wird aufgenommen, weil du diesen Schritt ausdrücklich in der Routine haben möchtest.",
          "Das ist nicht automatisch der wichtigste Hebel, kann aber als leichter Zusatz für Längen und Spitzen sinnvoll sein.",
        ],
        caveats:
          profile?.thickness === "fine"
            ? ["Bei feinem Haar sparsam dosieren und nicht an den Ansatz geben."]
            : [
                "Sparsam in Längen und Spitzen verwenden, damit die Routine nicht unnötig schwer wird.",
              ],
        topic_ids: [],
        product_linkable: true,
        product_query: "Ich suche ein Leave-in für meine Routine nach dem Waschen.",
        attachment_priority: 10,
      }
    case "mask":
      return {
        id: "occasional-mask",
        kind: "product_slot",
        phase: "occasional",
        label: "Maske / Kur",
        action: "add",
        category: "mask",
        cadence: "gelegentlich nach Bedarf",
        rationale: [
          "Maske wird aufgenommen, weil du diesen Schritt ausdrücklich in der Routine haben möchtest.",
          "Sie bleibt ein Zusatz und ersetzt Conditioner nicht automatisch.",
        ],
        caveats: [
          "Nicht als Pflichtschritt verstehen; bei feinem oder schnell beschwertem Haar selten und leicht halten.",
        ],
        topic_ids: [],
        product_linkable: true,
        product_query: "Ich suche eine Maske für meine Routine.",
        attachment_priority: 30,
      }
    case "oil":
      return {
        id: "occasional-oil",
        kind: "product_slot",
        phase: "occasional",
        label: "Hair Oiling",
        action: "add",
        category: "oil",
        cadence: "vor einzelnen Wäschen oder sehr sparsam in Spitzen",
        rationale: [
          "Öl wird aufgenommen, weil du diesen Schritt ausdrücklich in der Routine haben möchtest.",
          "Es ist eher Finish oder Pre-Wash-Schutz, nicht die Hauptpflege für trockene Längen.",
        ],
        caveats: [
          "Sehr sparsam einsetzen; bei beschwertem oder wachsigem Haar nicht weiter schichten.",
        ],
        topic_ids: ["hair_oiling"],
        product_linkable: true,
        product_query: "Ich möchte Hair Oiling vor dem Waschen machen.",
        attachment_priority: 40,
      }
    case "bondbuilder":
      return {
        id: "occasional-bond-builder",
        kind: "product_slot",
        phase: "occasional",
        label: "Bond Builder / Repair-Support",
        action: "add",
        category: "bondbuilder",
        cadence: "nach Produktprotokoll",
        rationale: [
          "Bondbuilder wird aufgenommen, weil du diesen Schritt ausdrücklich in der Routine haben möchtest.",
          "Er ist nur dann fachlich stark, wenn echte Strukturstress-Signale vorliegen.",
        ],
        caveats: [
          "Nicht als Feuchtigkeitsmaske oder Basis-Conditioner behandeln; genaue Anwendung braucht Produktdaten.",
        ],
        topic_ids: ["bond_builder"],
        product_linkable: true,
        product_query: "Ich suche einen Bondbuilder für meine Routine.",
        attachment_priority: 50,
      }
    case "deep_cleansing_shampoo":
      return {
        id: "occasional-deep-cleansing-shampoo",
        kind: "product_slot",
        phase: "occasional",
        label: "Tiefenreinigungsshampoo / Haar-Reset",
        action: "add",
        category: "deep_cleansing_shampoo",
        cadence: "bei deutlichem Build-up nach Bedarf",
        rationale: [
          "Tiefenreinigung wird aufgenommen, weil du diesen Schritt ausdrücklich in der Routine haben möchtest.",
          "Sie ist ein gelegentlicher Reset für Rückstände, kein normales Shampoo für jede Wäsche.",
        ],
        caveats: [
          "Danach Conditioner oder passende Längenpflege einplanen; nicht bei brennender oder gereizter Kopfhaut eskalieren.",
        ],
        topic_ids: ["tiefenreinigung"],
        product_linkable: true,
        product_query: "Ich suche ein Tiefenreinigungsshampoo für meine Routine.",
        attachment_priority: 96,
      }
    case "peeling":
      return {
        id: "occasional-peeling",
        kind: "product_slot",
        phase: "occasional",
        label: "Kopfhautpeeling",
        action: "add",
        category: "peeling",
        cadence: "punktuell bei belegtem Ansatz",
        rationale: [
          "Kopfhautpeeling wird aufgenommen, weil du diesen Schritt ausdrücklich in der Routine haben möchtest.",
          "Es ist ein gelegentlicher Kopfhaut-Schritt für kosmetische Rückstände, keine Behandlung für Schmerzen, Entzündung oder Haarausfall.",
        ],
        caveats: [
          "Nicht bei Brennen, Wunden, starken Schuppen, Entzündung oder ungewöhnlichem Haarverlust eskalieren.",
        ],
        topic_ids: ["tiefenreinigung"],
        product_linkable: true,
        product_query: "Ich suche ein Kopfhautpeeling für meine Routine.",
        attachment_priority: 95,
      }
    case "dry_shampoo":
      return {
        id: "maintenance-dry-shampoo",
        kind: "product_slot",
        phase: "maintenance",
        label: "Trockenshampoo",
        action: "add",
        category: "dry_shampoo",
        cadence: "als kurze Frische-Hilfe zwischen Wäschen",
        rationale: [
          "Trockenshampoo wird aufgenommen, weil du diesen Schritt ausdrücklich in der Routine haben möchtest.",
          "Es ist eine optische Überbrückung am Ansatz und kein Ersatz für Waschen.",
        ],
        caveats: ["Bei Juckreiz, Brennen, Schuppen oder viel Schichtung nicht weiter eskalieren."],
        topic_ids: [],
        product_linkable: true,
        product_query: "Ich suche ein Trockenshampoo für meine Routine.",
        attachment_priority: 45,
      }
    default:
      return null
  }
}

function buildMaskCadence(maskStrength: number): string {
  if (maskStrength >= 3) return "etwa jede 2. Wäsche"
  if (maskStrength === 2) return "alle 2-3 Wäschen"
  return "alle 4-5 Wäschen"
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
      "CWC ist hier eine Wash-Day-Variante, kein Pflichtschritt für jede Wäsche.",
      "1. Conditioner auf trockene Längen und Spitzen geben.",
      "2. Shampoo nur an der Kopfhaut verwenden.",
      "3. Den entstehenden Schaum sanft durch die Längen gleiten lassen.",
      "4. Zum Schluss erneut Conditioner auftragen und ausspülen.",
    ],
    caveats: [
      "Wenn die Haare schnell belegt wirken, nicht als Standard für jede Wäsche etablieren.",
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
    "Hier geht es primär um Talg, Kopfhaut-Rückstände und schnell belegte Ansätze - nicht um einen Voll-Reset für die Längen.",
    context.has_sensitive_scalp_signals
      ? "Bei sensibler Kopfhaut lieber sanft und gezielt reinigen statt die Intensität hochzuziehen."
      : "Wenn der Ansatz schnell nachfettet oder Dry-Shampoo-Reste sitzen, kann punktuell auch ein sanftes Scalp-Exfoliant vor der Wäsche sinnvoll sein.",
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
        "Bond Builder brauchen saubere Haarstruktur - Rückstände können die Aufnahme blockieren.",
        "Vor Bond Builder ist ein Haar-Reset oft sinnvoller als noch mehr Produkt auf überlagerte Längen zu schichten.",
        "Danach immer Conditioner oder Maske einplanen, damit die Längen nicht stumpf bleiben.",
      ]
    : educational
      ? [
          "Tiefenreinigung ist ein gezielter Reset für Rückstände auf Haar und Kopfhaut, kein Pflichtschritt für jede Routine.",
          "Für die Längen wird sie vor allem dann spannend, wenn Produkte, Mineralien oder Poolwasser die Haare schwer oder stumpf machen.",
          "Danach immer Conditioner oder Maske einplanen, damit die Längen wieder geschmeidig werden.",
        ]
      : [
          "Hier geht es vor allem um Rückstände auf Längen und Spitzen - etwa durch Leave-ins, Öle, Styling, Mineralien oder Poolwasser.",
          "Ein Haar-Reset schafft wieder eine saubere Basis, wenn sich die Haare wachsig, belegt oder überpflegt anfühlen.",
          "Danach immer Conditioner oder Maske einplanen, damit die Längen nicht stumpf bleiben.",
        ]

  rationale.push(
    "Auf sauberem Haar greifen Pflege oder farbauffrischende Produkte oft gleichmäßiger - das ist ein Bonus, kein Pflichtargument.",
  )

  const caveats = context.has_sensitive_scalp_signals
    ? [
        "Die Kopfhaut wirkt eher sensibel - deshalb gezielt reinigen und die Intensität nicht unnötig hochziehen.",
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
  const caveats = ["Nur für echte Überlagerung - nicht als Standard für jede Wäsche etablieren."]

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
    cadence: "selten und nur bei deutlicher Überlagerung",
    rationale: [
      "Das ist die Eskalationsstufe für wirklich belegte, wachsig wirkende oder deutlich überpflegte Haare.",
      "Wenn viele Produkte rotieren oder kaum noch etwas sauber einzieht, kann punktuell ein stärkerer Reset sinnvoll sein.",
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
    label: "OWC Öl-Schutz",
    action: oilAction,
    category: "oil",
    cadence: "als Wash-Day-Variante bei Bedarf",
    rationale: [
      "Für OWC braucht es ein sparsam dosiertes Öl nur für Längen und Spitzen vor dem Waschen.",
      oilPresent
        ? "Wenn schon ein Öl in der Routine ist, hier eher Dosierung und Einsatz prüfen als direkt mehr Produkt zu stapeln."
        : "Wenn noch kein Öl da ist, reicht für OWC ein leichtes Pre-Wash-Öl statt eines schweren Finish-Öls.",
    ],
    caveats: [
      "Bei schnell fettender Kopfhaut oder Build-up nicht als Standard etablieren.",
      "Bei feinem, dichtem Haar nur sehr sparsam dosieren.",
      "Wenn die Haare schnell belegt wirken, eher bei CWC bleiben oder OWC nur punktuell testen.",
    ],
    topic_ids: ["owc"],
    product_linkable: oilAction === "add" && !(explicitOwcRequest && cautiousDueToWeight),
    product_query: "Ich suche ein natürliches Öl für OWC vor dem Waschen.",
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
      "Das Profil hat ein höheres Beschwerungsrisiko — lieber mit minimaler Menge starten.",
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
      "OWC ist hier eine Wash-Day-Variante für mehr Schutz, nicht automatisch die Basis jeder Wäsche.",
      "1. Öl mit Praying Hands oder Scrunching sparsam in trockene Längen und Spitzen geben.",
      "2. Shampoo zuerst direkt am trockenen Ansatz verteilen.",
      "3. Dann Wasser dazugeben und den Schaum sanft durch die Längen ziehen.",
      "4. Zum Schluss Conditioner auftragen und ausspülen.",
    ],
    caveats,
    topic_ids: ["owc"],
    product_linkable: false,
    product_query: null,
    attachment_priority: 91,
  }
}

function buildNightProtectionSlot(
  profile: HairProfile | null,
  context: RoutineContext,
  action: Extract<RoutineSlotAction, "add" | "adjust">,
): RoutineSlotAdvice {
  const longHair = hasLongHairNightProtectionFit(profile)
  const curlOrWave =
    context.hair_texture === "wavy" ||
    context.hair_texture === "curly" ||
    context.hair_texture === "coily"
  const example = longHair
    ? "Längen-/Spitzenschutz (z. B. HairHOMIE), lockeres Zusammennehmen oder eine sehr weiche Fixierung"
    : curlOrWave
      ? "Satin-/Seidenkissenbezug, Bonnet oder Pineapple"
      : "Satin-/Seidenkissenbezug, Bonnet oder lockerer Zopf"

  const isAdjust = action === "adjust"

  return {
    id: "maintenance-night-protection",
    kind: "instruction",
    phase: "maintenance",
    label: isAdjust ? "Nachtschutz prüfen/anpassen" : "Nachtschutz",
    action,
    category: null,
    cadence: "nachts",
    rationale: isAdjust
      ? [
          "Du hast bereits Nachtschutz ausgewählt; deshalb geht es hier ums Prüfen, nicht ums automatisch mehr Machen.",
          `Wenn Verknoten, Frizz oder Bruch über Nacht trotzdem bleiben, prüfe, ob eine andere Option oder eine zusätzlich lockere Option besser passt: ${example}.`,
        ]
      : [
          "Du hast aktuell keinen Nachtschutz ausgewählt; das ist ein kleiner, aber sinnvoller Reibungshebel.",
          longHair
            ? "Bei langen Haaren ist ein Längen-/Spitzenschutz (z. B. HairHOMIE) oder lockeres Fixieren oft praktischer als nur offen schlafen."
            : curlOrWave
              ? "Bei Wellen oder Locken kann ein Bonnet, Pineapple oder Satin-/Seidenkissenbezug helfen, die Form über Nacht ruhiger zu halten."
              : "Ein Satin-/Seidenkissenbezug ist die niedrigste Einstiegshürde, wenn du keine Haube oder Fixierung magst.",
        ],
    caveats: isAdjust
      ? [
          "Das ist kein Repair-Schritt und kein Muss; bitte nicht standardmäßig stapeln, wenn dein jetziger Schutz funktioniert.",
          "Alles sollte locker sitzen und nicht am Haaransatz ziehen.",
        ]
      : [
          "Das ist kein Repair-Schritt und kein Muss; es reduziert vor allem Reibung, Verknoten und Morgen-Frizz.",
          "Alles sollte locker sitzen und nicht am Haaransatz ziehen.",
        ],
    topic_ids: ["night_protection"],
    product_linkable: false,
    product_query: null,
    attachment_priority: 45,
  }
}

function buildRoutineSlots(
  profile: HairProfile | null,
  context: RoutineContext,
  message: string,
  activations: RoutineTopicActivation[],
  decisionContext: RoutineDecisionContext,
  options: {
    usesBondBuilder: boolean
    forceRequestedCategory: RoutineProductCategory | null
  },
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
  const pushRoutineSlot = (slot: RoutineSlotAdvice) => {
    const guardedSlot = applyHairLengthRoutinePolicy(slot, {
      hairLength: profile?.hair_length ?? null,
      context,
      activeTopicIds,
    })
    if (guardedSlot) pushSlot(sections, guardedSlot)
  }

  pushRoutineSlot({
    id: "base-shampoo",
    kind: "product_slot",
    phase: "base_wash",
    label: "Shampoo",
    action: shampooPresent ? "keep" : "add",
    category: "shampoo",
    cadence: profile?.shampoo_frequency
      ? `${PRODUCT_FREQUENCY_LABELS[profile.shampoo_frequency] ?? profile.shampoo_frequency}`
      : "an deinen Waschtagen",
    rationale: [
      "Shampoo bleibt der feste Startpunkt für die Kopfhaut und die Waschfrequenz.",
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
    product_query: "Ich suche ein Shampoo für meine regulären Waschtage.",
    attachment_priority: 50,
  })

  const conditionerReasons = ["Conditioner bleibt der feste Pflegeanker nach jeder Wäsche."]
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

  pushRoutineSlot({
    id: "base-conditioner",
    kind: "product_slot",
    phase: "base_wash",
    label: "Conditioner",
    action: conditionerAction,
    category: "conditioner",
    cadence: "nach jeder Wäsche",
    rationale: conditionerReasons,
    caveats: [],
    topic_ids: activations[0] ? [activations[0].id] : [],
    product_linkable:
      (conditionerAction === "add" || conditionerAction === "upgrade") &&
      conditionerDecision.relevant,
    product_query: "Ich suche einen Conditioner für meine Basisroutine.",
    attachment_priority: 20,
  })

  if (shouldAddNightProtectionSlot(profile, context)) {
    pushRoutineSlot(buildNightProtectionSlot(profile, context, "add"))
  } else if (shouldAdjustNightProtectionSlot(profile, context)) {
    pushRoutineSlot(buildNightProtectionSlot(profile, context, "adjust"))
  }

  const explicitWashProtectionWithoutNeed =
    activeWashProtectionTopic !== null &&
    (context.explicit_topic_ids.includes("cwc") || context.explicit_topic_ids.includes("owc")) &&
    !context.has_wash_protection_need

  if (activeWashProtectionTopic === "cwc") {
    if (explicitWashProtectionWithoutNeed) {
      pushRoutineSlot({
        id: "base-cwc-technique",
        kind: "instruction",
        phase: "base_wash",
        label: "CWC als Wash-Day-Schutz",
        action: "add",
        category: null,
        cadence: null,
        rationale: [
          "CWC ist ein optionaler Wash-Day-Baustein für gezielte Pflege und kein Pflichtschritt.",
        ],
        caveats: [
          "Dein Profil zeigt aktuell keine starken Trockenheits- oder Schadenssignale — CWC ist hier eher optional, aber wir erklären gerne wie es funktioniert.",
        ],
        topic_ids: ["cwc"],
        product_linkable: false,
        product_query: null,
        attachment_priority: 92,
      })
    } else {
      pushRoutineSlot(buildCwcTechniqueSlot())
    }
  }

  if (activeWashProtectionTopic === "owc") {
    if (explicitWashProtectionWithoutNeed) {
      pushRoutineSlot({
        id: "base-owc-technique",
        kind: "instruction",
        phase: "base_wash",
        label: "OWC als Wash-Day-Schutz",
        action: "add",
        category: null,
        cadence: null,
        rationale: [
          "OWC ist ein optionaler Wash-Day-Baustein für gezielte Pflege und kein Pflichtschritt.",
        ],
        caveats: [
          "Dein Profil zeigt aktuell keine starken Trockenheits- oder Schadenssignale — OWC ist hier eher optional, aber wir erklären gerne wie es funktioniert.",
        ],
        topic_ids: ["owc"],
        product_linkable: false,
        product_query: null,
        attachment_priority: 92,
      })
    } else {
      pushRoutineSlot(buildOwcOilSlot(context, explicitOwcRequest, oilPresent))
      pushRoutineSlot(buildOwcTechniqueSlot(profile, context))
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
    context.concerns.includes("tangling") ||
    (hasHeatExposureNeed(context) && !context.uses_heat_protection)

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
        `Der Finish-Schritt soll vor allem für ${LEAVE_IN_STYLING_CONTEXT_LABELS[leaveInDecision.targetProfile.stylingContext]} passen.`,
      )
    }
    if (hasHeatExposureNeed(context) && !context.uses_heat_protection) {
      leaveInReasons.push(
        "Bei Hitze durch Föhn, Diffusor oder Styling-Tools sollte der Schritt Hitzeschutz abdecken.",
      )
    }

    pushRoutineSlot({
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
      product_query: "Ich suche ein Leave-in für meine Routine nach dem Waschen.",
      attachment_priority: 10,
    })
  }

  if (activeTopicIds.has("lockenrefresh")) {
    const stylingKind = detectStylingProductKind(profile?.products_used ?? null)
    const productEcho = stylingKind
      ? `Verwende dein ${stylingKind} vom letzten Waschtag — nicht mit neuen Produkten experimentieren.`
      : "Verwende dasselbe Styling-Produkt vom letzten Waschtag — nicht mit neuen Produkten experimentieren."

    const refreshRationale = [
      "Lockenrefresh ist eine abgekürzte Version des letzten Steps der Locken-Routine — nur leicht anfeuchten, Produkt auffrischen, trocknen lassen.",
      productEcho,
      "Regelmäßiges Auffrischen trainiert langfristig die Lockenstruktur.",
    ]

    const refreshCaveats: string[] = []

    if (hasRefreshDrynessNeed(profile)) {
      refreshRationale.splice(
        2,
        0,
        "Bei Bedarf vorher etwas Leave-In in trockene Längen einarbeiten (siehe Leave-In-Slot).",
      )
      if (profile?.thickness === "fine") {
        refreshCaveats.push(
          "Bei feinem Haar reicht oft schon ein minimaler Tropfen Leave-In, damit die Locken nicht beschwert werden.",
        )
      }
    }

    pushRoutineSlot({
      id: "maintenance-refresh",
      kind: "instruction",
      phase: "maintenance",
      label: "Lockenrefresh",
      action: leaveInPresent ? "adjust" : "add",
      category: null,
      cadence: "an Tagen zwischen den Wäschen, ca. 10 Min.",
      rationale: refreshRationale,
      caveats: refreshCaveats,
      topic_ids: ["lockenrefresh"],
      product_linkable: false,
      product_query: null,
      attachment_priority: 90,
    })
  }

  if (activeTopicIds.has("brush_tools")) {
    pushRoutineSlot(buildBrushToolsSlot(profile, context, normalizeText(message)))
  }

  if (maskDecision.relevant || maskPresent) {
    pushRoutineSlot({
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
              : "Die Maske wird über Bedarf und Verträglichkeit gesteuert.",
          ]
        : ["Aktuell sprechen die Profilsignale nicht für eine feste Masken-Rolle in der Routine."],
      caveats: [],
      topic_ids: activeTopicIds.has("bond_builder") ? ["bond_builder"] : [],
      product_linkable:
        !maskPresent && maskDecision.relevant && Boolean(maskDecision.targetProfile?.balance),
      product_query: "Ich suche eine Maske für meine Routine.",
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
      pushRoutineSlot(buildScalpClarifySlot(context, shampooPresent))
    }

    if (context.has_hair_reset_signals || bondBuilderDriven || educationalClarify) {
      pushRoutineSlot(
        buildHairResetSlot({
          context,
          shampooPresent,
          bondBuilderDriven,
          educational: educationalClarify,
        }),
      )
    }

    if (context.has_hard_reset_signals) {
      pushRoutineSlot(buildHardResetSlot(context))
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
      "Hair Oiling bleibt ein optionaler Pre-Wash-Baustein und keine Pflicht für jede Routine.",
      hasScalpHairOilingFit(context)
        ? "Es kann trockene, nicht entzündliche Kopfhaut sanft unterstützen und gleichzeitig Längen und Spitzen vor der Wäsche schützen."
        : "Es ist vor allem dann sinnvoll, wenn Trockenheit oder Oberflächenschäden ein Thema sind.",
    ]
    if (oilActive) {
      oilRationale.push(
        "Wichtig beim Auswaschen: Shampoo zuerst auf trockenes Haar auftragen, dann erst mit Wasser ausspülen.",
      )
    }

    const oilCaveats: string[] = []
    if (context.scalp_condition === "irritated") {
      oilCaveats.push(
        "Bei stark gereizter Kopfhaut eher sanft bleiben und die Routine nicht überladen.",
      )
    }
    if (oilActive) {
      oilCaveats.push(
        "Ätherische Öle (z.B. Rosmarin, Teebaum) nie pur auftragen — immer mit einem Basisöl verdünnen.",
      )
    }

    pushRoutineSlot({
      id: "occasional-oil",
      kind: "product_slot",
      phase: "occasional",
      label: "Hair Oiling",
      action: oilAction,
      category: "oil",
      cadence: "vor einzelnen Wäschen nach Bedarf",
      rationale: oilRationale,
      caveats: oilCaveats,
      topic_ids: ["hair_oiling"],
      product_linkable: activeTopicIds.has("hair_oiling") && !oilPresent,
      product_query: "Ich möchte Hair Oiling vor dem Waschen machen.",
      attachment_priority: 40,
    })
  }

  if (activeTopicIds.has("bond_builder")) {
    const explicitWithoutSignals =
      context.explicit_topic_ids.includes("bond_builder") && !context.has_bond_builder_signals

    if (explicitWithoutSignals) {
      pushRoutineSlot({
        id: "occasional-bond-builder",
        kind: "instruction",
        phase: "occasional",
        label: "Bond Builder / Repair-Support",
        action: options.usesBondBuilder ? "adjust" : "add",
        category: null,
        cadence: null,
        rationale: [
          "Bond Builder ist ein optionaler Baustein für gezielte Reparatur auf molekularer Ebene.",
        ],
        caveats: [
          "Dein Profil zeigt aktuell keine starken Schadenssignale — Bond Builder ist hier eher optional, aber wir erklären gerne wie es funktioniert.",
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
              "Die Kombination aus K18 und Olaplex kann die Reparatur deutlich verstärken — K18 für Längsverbindungen, Olaplex für Querverbindungen.",
            ]
          : hasChemical
            ? [
                "Bond Builder kann hier gezielt unterstützen.",
                "Bei chemischer Belastung kann Olaplex (Querverbindungen) besonders sinnvoll sein.",
              ]
            : [
                "Bond Builder kann hier gezielt unterstützen.",
                "Bei allgemeiner Schädigung ohne Chemie ist K18 (Längsverbindungen) oft der bessere Einstieg.",
              ]

      const bondCaveats: string[] = [
        "Zu häufige Anwendung kann das Haar steif und spröde machen — Pausen einhalten.",
      ]

      if (profile?.protein_moisture_balance === "snaps") {
        bondCaveats.push(
          "Die Haare reißen aktuell leicht — ein professionelles Beratungsgespräch kann hier zusätzlich helfen.",
        )
      } else if (profile?.protein_moisture_balance === "stretches_stays") {
        bondCaveats.push(
          "Bond Builder und Protein können parallel laufen, solange die Haare noch überdehnt sind.",
        )
      } else if (profile?.protein_moisture_balance === "stretches_bounces") {
        bondCaveats.push(
          "Die Haare sind aktuell stabil — Protein-Behandlungen dazu sind nicht mehr nötig, Feuchtigkeit reicht.",
        )
      }

      pushRoutineSlot({
        id: "occasional-bond-builder",
        kind: "instruction",
        phase: "occasional",
        label: "Bond Builder / Repair-Support",
        action: options.usesBondBuilder ? "adjust" : "add",
        category: null,
        cadence: "4 Anwendungen am Stück, dann 4 Wäschen Pause, danach nach Bedarf",
        rationale: bondRationale,
        caveats: bondCaveats,
        topic_ids: ["bond_builder"],
        product_linkable: false,
        product_query: null,
        attachment_priority: 96,
      })
    }
  }

  const forcedCategory = options.forceRequestedCategory
  if (forcedCategory && !hasRoutineCategorySlot(sections, forcedCategory)) {
    const forcedSlot = buildForcedRequestedCategorySlot(forcedCategory, profile)
    if (forcedSlot) {
      pushSlot(sections, applyHairLengthRoutineCopy(forcedSlot, profile?.hair_length ?? null))
    }
  }

  return sections
}

function getRoutineSlots(plan: Pick<RoutinePlan, "sections">): RoutineSlotAdvice[] {
  return plan.sections.flatMap((section) => section.slots)
}

function findRoutineSlot(
  plan: Pick<RoutinePlan, "sections">,
  slotId: string,
): RoutineSlotAdvice | undefined {
  return getRoutineSlots(plan).find((slot) => slot.id === slotId)
}

function isActionableRoutineSlot(slot: RoutineSlotAdvice): boolean {
  return slot.action === "add" || slot.action === "adjust" || slot.action === "upgrade"
}

function createPriorityLever(params: {
  id: RoutinePriorityLever["id"]
  source: RoutinePriorityLever["source"]
  slot: RoutineSlotAdvice
  reason: string
  score: number
  supportingSlots?: RoutineSlotAdvice[]
}): RoutinePriorityLever {
  const supportingSlotIds = (params.supportingSlots ?? [])
    .map((slot) => slot.id)
    .filter((slotId, index, ids) => slotId !== params.slot.id && ids.indexOf(slotId) === index)

  return {
    id: params.id,
    source: params.source,
    slot_id: params.slot.id,
    label: params.slot.label,
    reason: params.reason,
    score: params.score,
    topic_ids: params.slot.topic_ids,
    supporting_slot_ids: supportingSlotIds,
  }
}

function hasSevereActiveDamageSignals(
  profile: HairProfile | null,
  context: RoutineContext,
): boolean {
  const concerns = new Set(context.concerns)

  if (context.protein_moisture_balance === "snaps") return true
  if (
    concerns.has("breakage") &&
    (concerns.has("hair_damage") ||
      concerns.has("split_ends") ||
      context.cuticle_condition === "rough" ||
      context.chemical_treatment.includes("bleached"))
  ) {
    return true
  }

  return countDamageSignals(profile) >= 3
}

function hasStrongResetBlockageSignals(context: RoutineContext): boolean {
  if (!context.has_hair_reset_signals) return false

  const routineText = normalizeText(context.products_used ?? "")
  const heavyRoutineProductCount = context.current_routine_products.filter((entry) =>
    HEAVY_ROUTINE_PRODUCTS.has(entry),
  ).length
  const hasBlockingLanguage =
    includesAny(routineText, UNDERPERFORMING_ROUTINE_TERMS) ||
    includesAny(routineText, HAIR_RESET_TERMS)
  const hasExplicitResetWithLoad =
    context.explicit_topic_ids.includes("tiefenreinigung") &&
    (heavyRoutineProductCount >= 2 ||
      includesAny(routineText, HARD_WATER_TERMS) ||
      includesAny(routineText, SWIMMING_TERMS) ||
      includesAny(routineText, CO_WASH_TERMS) ||
      includesAny(routineText, HEAVY_STYLING_TERMS))

  return context.has_hard_reset_signals || hasBlockingLanguage || hasExplicitResetWithLoad
}

function findFirstSlot(
  plan: Pick<RoutinePlan, "sections">,
  slotIds: string[],
): RoutineSlotAdvice | undefined {
  for (const slotId of slotIds) {
    const slot = findRoutineSlot(plan, slotId)
    if (slot) return slot
  }
  return undefined
}

export function selectRoutinePriorityLever(
  profile: HairProfile | null,
  context: RoutineContext,
  plan: Pick<RoutinePlan, "sections" | "primary_focuses">,
): RoutinePriorityLever | null {
  const resetSlot = findFirstSlot(plan, ["occasional-hair-reset", "occasional-hard-reset"])
  if (hasStrongResetBlockageSignals(context) && resetSlot) {
    const hardResetSlot = findRoutineSlot(plan, "occasional-hard-reset")

    return createPriorityLever({
      id: "reset-blockage",
      source: "care_risk",
      slot: resetSlot,
      reason:
        "Rückstände, Mineralien oder Überlagerung können verhindern, dass Pflege sauber greift.",
      score: 100,
      supportingSlots: hardResetSlot ? [hardResetSlot] : [],
    })
  }

  if (hasSevereActiveDamageSignals(profile, context)) {
    const orderedCareSlots = [
      findRoutineSlot(plan, "base-conditioner"),
      findRoutineSlot(plan, "maintenance-leave-in"),
      findRoutineSlot(plan, "occasional-mask"),
      findRoutineSlot(plan, "occasional-bond-builder"),
      context.has_hair_reset_signals ? resetSlot : undefined,
    ].filter(
      (slot): slot is RoutineSlotAdvice => slot !== undefined && isActionableRoutineSlot(slot),
    )
    const selectedSlot = orderedCareSlots[0]

    if (selectedSlot) {
      return createPriorityLever({
        id: "care-product-first",
        source: "care_risk",
        slot: selectedSlot,
        reason:
          "Bei aktivem Bruch oder strukturellem Schaden kommt die Pflegebasis vor zusätzlichen Extras.",
        score: 90,
        supportingSlots: orderedCareSlots.slice(1),
      })
    }
  }

  const mechanicalSlot = findRoutineSlot(plan, "maintenance-brush-tools")
  const mechanicalDominant =
    mechanicalSlot &&
    (context.explicit_topic_ids.includes("brush_tools") ||
      (!context.has_damage_signals &&
        !context.has_dryness_damage_signals &&
        context.goals.length === 0))
  if (mechanicalDominant) {
    return createPriorityLever({
      id: "mechanical-guardrail",
      source: "care_risk",
      slot: mechanicalSlot,
      reason:
        "Mechanische Belastung ist hier das stärkste erkennbare Signal und sollte als Guardrail zuerst sitzen.",
      score: 80,
    })
  }

  const hasOngoingExposure =
    hasFrequentUnprotectedHeat(profile) ||
    context.chemical_treatment.some((treatment) => treatment !== "natural")
  if (hasOngoingExposure) {
    const exposureSlot = findFirstSlot(plan, [
      "maintenance-leave-in",
      "base-conditioner",
      "occasional-bond-builder",
      "occasional-mask",
    ])
    if (exposureSlot && isActionableRoutineSlot(exposureSlot)) {
      return createPriorityLever({
        id: "exposure-protection",
        source: "care_risk",
        slot: exposureSlot,
        reason:
          "Hitze oder chemische Belastung spricht für Schutz und Pflege, ohne aktive Schäden zu überstimmen.",
        score: 70,
      })
    }
  }

  const scalpSlot = findRoutineSlot(plan, "occasional-scalp-clarify")
  if (scalpSlot && isActionableRoutineSlot(scalpSlot)) {
    return createPriorityLever({
      id: "scalp-safety",
      source: "care_risk",
      slot: scalpSlot,
      reason: "Kopfhaut-Signale verändern, wie sicher und gezielt die Routine reinigen sollte.",
      score: 60,
    })
  }

  const hasDrynessFrizzCluster = ["dryness", "frizz", "tangling"].some((concern) =>
    context.concerns.includes(concern as HairProfile["concerns"][number]),
  )
  if (hasDrynessFrizzCluster) {
    const drySlot = findFirstSlot(plan, [
      "maintenance-leave-in",
      "occasional-mask",
      "base-owc-oil",
      "occasional-oil",
    ])
    if (drySlot && isActionableRoutineSlot(drySlot)) {
      return createPriorityLever({
        id: "dryness-frizz-control",
        source: "inferred_need",
        slot: drySlot,
        reason:
          "Trockenheit, Frizz oder Verhaken brauchen zuerst einen leichten Pflege- oder Finish-Hebel.",
        score: 50,
      })
    }
  }

  if (context.goals.length > 0) {
    const goalSlot = findFirstSlot(plan, [
      "maintenance-leave-in",
      "maintenance-refresh",
      "occasional-mask",
      "base-cwc-technique",
      "base-owc-technique",
      "occasional-oil",
    ])
    if (goalSlot && isActionableRoutineSlot(goalSlot)) {
      return createPriorityLever({
        id: "stated-goal",
        source: "stated_goal",
        slot: goalSlot,
        reason: "Ohne stärkeren Risiko-Hebel führt das ausdrückliche Ziel die Routine.",
        score: 40,
      })
    }
  }

  const inferredSlot = getRoutineSlots(plan).find(
    (slot) =>
      slot.id !== "base-shampoo" && slot.id !== "base-conditioner" && isActionableRoutineSlot(slot),
  )
  if (!inferredSlot) return null

  return createPriorityLever({
    id: "inferred-need",
    source: "inferred_need",
    slot: inferredSlot,
    reason: "Der sichtbarste zusätzliche Routine-Baustein ergibt sich aus den Profilsignalen.",
    score: 10,
  })
}

function sortProjectionSlots(plan: RoutinePlan, slots: RoutineSlotAdvice[]): RoutineSlotAdvice[] {
  return [...slots].sort((a, b) => {
    if (a.id === plan.priority_lever?.slot_id) return -1
    if (b.id === plan.priority_lever?.slot_id) return 1
    return a.attachment_priority - b.attachment_priority
  })
}

function isGoalDirectedSlot(plan: RoutinePlan, slot: RoutineSlotAdvice): boolean {
  const goalCodes = new Set(
    plan.primary_focuses.filter((focus) => focus.kind === "goal").map((focus) => focus.code),
  )
  if (goalCodes.size === 0) return false

  if (slot.id === "maintenance-refresh" && goalCodes.has("curl_definition")) return true
  if (
    slot.topic_ids.includes("night_protection") &&
    [
      "less_frizz",
      "curl_definition",
      "healthier_hair",
      "anti_breakage",
      "strengthen",
      "less_split_ends",
    ].some((goal) => goalCodes.has(goal))
  ) {
    return true
  }
  if (
    slot.category === "leave_in" &&
    ["less_frizz", "curl_definition", "moisture", "shine"].some((goal) => goalCodes.has(goal))
  ) {
    return true
  }
  if (
    slot.category === "mask" &&
    ["moisture", "healthier_hair", "less_split_ends"].some((goal) => goalCodes.has(goal))
  ) {
    return true
  }
  if (slot.category === "oil" && ["moisture", "shine"].some((goal) => goalCodes.has(goal))) {
    return true
  }

  return (
    (slot.topic_ids.includes("cwc") || slot.topic_ids.includes("owc")) &&
    ["moisture", "healthier_hair"].some((goal) => goalCodes.has(goal))
  )
}

function isProblemDirectedSlot(plan: RoutinePlan, slot: RoutineSlotAdvice): boolean {
  const concernCodes = new Set(
    plan.primary_focuses.filter((focus) => focus.kind === "concern").map((focus) => focus.code),
  )

  if (
    slot.topic_ids.some((topicId) =>
      ["tiefenreinigung", "bond_builder", "brush_tools"].includes(topicId),
    )
  ) {
    return true
  }

  if (
    slot.topic_ids.includes("night_protection") &&
    ["breakage", "split_ends", "hair_damage", "tangling", "frizz"].some((concern) =>
      concernCodes.has(concern),
    )
  ) {
    return true
  }

  if (
    slot.category === "leave_in" &&
    ["frizz", "dryness", "tangling", "breakage", "hair_damage"].some((concern) =>
      concernCodes.has(concern),
    )
  ) {
    return true
  }

  if (
    (slot.category === "mask" || slot.category === "oil") &&
    ["dryness", "breakage", "hair_damage", "split_ends"].some((concern) =>
      concernCodes.has(concern),
    )
  ) {
    return true
  }

  return false
}

function topicForDeepDiveCategory(category: RoutineProductCategory | null): RoutineTopicId | null {
  switch (category) {
    case "bondbuilder":
      return "bond_builder"
    case "deep_cleansing_shampoo":
    case "peeling":
      return "tiefenreinigung"
    case "oil":
      return "hair_oiling"
    default:
      return null
  }
}

export function projectRoutinePlanForLayer(
  plan: RoutinePlan,
  layer: RoutineLayer,
  options: {
    requestedCategory?: RoutineProductCategory | null
    requestedTopicId?: RoutineTopicId | null
    preferRequestedCategory?: boolean
  } = {},
): RoutineLayerProjection {
  const slots = getRoutineSlots(plan)
  const nonBaseActionableSlots = slots.filter(
    (slot) =>
      slot.id !== "base-shampoo" && slot.id !== "base-conditioner" && isActionableRoutineSlot(slot),
  )
  let visibleSlots: RoutineSlotAdvice[]
  const requestedCategorySlot =
    options.requestedCategory === null || options.requestedCategory === undefined
      ? undefined
      : slots.find((slot) => slot.category === options.requestedCategory)

  if (layer === "basics") {
    visibleSlots = [
      findRoutineSlot(plan, "base-shampoo"),
      findRoutineSlot(plan, "base-conditioner"),
      options.preferRequestedCategory && requestedCategorySlot
        ? requestedCategorySlot
        : plan.priority_lever
          ? findRoutineSlot(plan, plan.priority_lever.slot_id)
          : undefined,
    ].filter((slot, index, selected): slot is RoutineSlotAdvice => {
      return (
        Boolean(slot) && selected.findIndex((candidate) => candidate?.id === slot?.id) === index
      )
    })
  } else if (layer === "goals") {
    const goalSlots = nonBaseActionableSlots.filter((slot) => isGoalDirectedSlot(plan, slot))
    visibleSlots = sortProjectionSlots(
      plan,
      goalSlots.length > 0 ? goalSlots : nonBaseActionableSlots,
    ).slice(0, 3)
  } else if (layer === "problems") {
    const problemSlots = nonBaseActionableSlots.filter((slot) => isProblemDirectedSlot(plan, slot))
    visibleSlots = sortProjectionSlots(
      plan,
      problemSlots.length > 0 ? problemSlots : nonBaseActionableSlots,
    ).slice(0, 3)
  } else {
    const requestedCategory = options.requestedCategory ?? null
    const requestedTopicId = options.requestedTopicId ?? topicForDeepDiveCategory(requestedCategory)
    const topicSlot =
      requestedTopicId === null
        ? undefined
        : nonBaseActionableSlots.find((slot) => slot.topic_ids.includes(requestedTopicId))
    const prioritySlot = plan.priority_lever
      ? findRoutineSlot(plan, plan.priority_lever.slot_id)
      : undefined

    visibleSlots = [
      requestedCategorySlot ?? topicSlot ?? prioritySlot ?? nonBaseActionableSlots[0],
    ].filter((slot): slot is RoutineSlotAdvice => Boolean(slot))
  }

  return {
    layer,
    visible_slot_ids: visibleSlots.map((slot) => slot.id),
    priority_lever: plan.priority_lever ?? null,
    requested_category: options.requestedCategory ?? null,
    requested_topic_id:
      options.requestedTopicId ?? topicForDeepDiveCategory(options.requestedCategory ?? null),
  }
}

export function buildRoutinePlan(
  profile: HairProfile | null,
  message: string,
  options: BuildRoutinePlanOptions = {},
): RoutinePlan {
  const context = deriveRoutineContext(profile, message)
  const activeTopics = activateRoutineTopics(profile, message, context)
  const compareMode = isCwcOwcComparisonRequest(message)
  const decisionContext = buildRoutineDecisionContext(profile, message)
  const sectionSlots = buildRoutineSlots(profile, context, message, activeTopics, decisionContext, {
    usesBondBuilder: options.usesBondBuilder ?? false,
    forceRequestedCategory: options.forceRequestedCategory ?? null,
  })

  const phases: RoutinePlanSection["phase"][] = ["base_wash", "maintenance", "occasional"]
  const sections: RoutinePlanSection[] = phases
    .map((phase) => ({
      phase,
      title:
        phase === "base_wash"
          ? "Basisroutine"
          : phase === "maintenance"
            ? "Pflege zwischen den Wäschen"
            : "Gelegentliche Extras",
      summary: buildSectionSummary(phase, profile),
      slots: sectionSlots.get(phase) ?? [],
    }))
    .filter((section) => section.phase === "base_wash" || section.slots.length > 0)

  const planWithoutPriority: Omit<RoutinePlan, "priority_lever" | "layer_projections"> = {
    base_topic_id: getBaseRoutineTopicId(profile),
    primary_focuses: context.primary_focuses,
    active_topics: activeTopics,
    compare_cwc_owc: compareMode,
    sections,
    decision_context: decisionContext,
  }
  const planWithPriority: RoutinePlan = {
    ...planWithoutPriority,
    priority_lever: selectRoutinePriorityLever(profile, context, planWithoutPriority),
  }
  const requestedProjectionOptions = {
    requestedCategory: options.forceRequestedCategory ?? null,
    preferRequestedCategory: Boolean(options.forceRequestedCategory),
  }
  const hasNightProtectionSlot = sections.some((section) =>
    section.slots.some((slot) => slot.id === "maintenance-night-protection"),
  )
  const requestedDeepDiveOptions =
    context.explicit_topic_ids.includes("night_protection") && hasNightProtectionSlot
      ? { requestedTopicId: "night_protection" as const }
      : {}
  const layerProjections = {
    basics: projectRoutinePlanForLayer(planWithPriority, "basics", requestedProjectionOptions),
    goals: projectRoutinePlanForLayer(planWithPriority, "goals"),
    problems: projectRoutinePlanForLayer(planWithPriority, "problems"),
    deep_dive: projectRoutinePlanForLayer(planWithPriority, "deep_dive", requestedDeepDiveOptions),
  }

  return {
    ...planWithPriority,
    layer_projections: layerProjections,
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
