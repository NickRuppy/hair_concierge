import { loadGuidance } from "@/lib/agent/guidance/load-guidance"
import type { GuidanceId, GuidanceItem } from "@/lib/agent/contracts"
import type { UserContextProjection } from "@/lib/agent/tools/get-user-context"
import type { ConversationState } from "@/lib/types"

export const ADVISOR_GUIDANCE_INTENTS = [
  "category_explanation",
  "usage",
  "compare_or_decide",
  "problem_context",
  "routine_context",
] as const

export type AdvisorGuidanceIntent = (typeof ADVISOR_GUIDANCE_INTENTS)[number]

export const ADVISOR_GUIDANCE_CATEGORIES = [
  "shampoo",
  "conditioner",
  "leave_in",
  "mask",
  "oil",
  "bond_builder",
  "bondbuilder",
  "deep_cleansing",
  "deep_cleansing_shampoo",
  "dry_shampoo",
  "peeling",
  "cwc_owc",
  "general_haircare",
  "night_protection",
] as const

export type AdvisorGuidanceCategory = (typeof ADVISOR_GUIDANCE_CATEGORIES)[number]

export const ADVISOR_PROFILE_FOCUS = [
  "fine_hair",
  "oily_scalp",
  "dry_lengths",
  "minimal_routine",
  "curly_hair",
  "coily_hair",
  "heat_styling",
  "mechanical_stress",
  "buildup_risk",
  "damage_repair",
  "sensitive_scalp",
  "dandruff_scalp",
  "low_density_weight_sensitive",
  "frizz_control",
  "tangling_detangling",
  "protein_moisture_balance",
  "chemical_or_color_treated",
  "hair_loss_or_thinning_guardrail",
] as const

export type AdvisorProfileFocus = (typeof ADVISOR_PROFILE_FOCUS)[number]

export interface LoadAdvisorGuidanceInput {
  intent: AdvisorGuidanceIntent | null
  category: AdvisorGuidanceCategory | null
  categories: AdvisorGuidanceCategory[]
  profileFocus: AdvisorProfileFocus[]
  message: string
  userContext: UserContextProjection
  conversationState?: ConversationState | null
}

export interface AdvisorGuidanceCategorySection {
  category: AdvisorGuidanceCategory
  guidance_id: GuidanceId
  key_points: string[]
}

export interface AdvisorGuidanceProjection {
  loaded_guidance_ids: GuidanceId[]
  direct_answer_frame: string
  key_advice_points: string[]
  profile_interpretation: string[]
  category_implications: string[]
  category_sections: AdvisorGuidanceCategorySection[]
  avoid: string[]
  proactive_next_step_options: string[]
}

const CATEGORY_GUIDANCE_ID: Record<AdvisorGuidanceCategory, GuidanceId> = {
  shampoo: "topic:shampoo",
  conditioner: "topic:conditioner",
  leave_in: "topic:leave_in",
  mask: "topic:mask",
  oil: "topic:hair_oiling",
  bond_builder: "topic:bond_builder",
  bondbuilder: "topic:bond_builder",
  deep_cleansing: "topic:deep_cleansing",
  deep_cleansing_shampoo: "topic:deep_cleansing",
  dry_shampoo: "topic:dry_shampoo",
  peeling: "topic:peeling",
  cwc_owc: "topic:cwc_owc",
  general_haircare: "topic:general_haircare",
  night_protection: "topic:night_protection",
}

const INTENT_PLAYBOOK_ID: Record<AdvisorGuidanceIntent, GuidanceId | null> = {
  category_explanation: null,
  usage: "playbook:usage_and_application",
  compare_or_decide: "playbook:compare_or_decide",
  problem_context: "playbook:troubleshoot_hair_issue",
  routine_context: "playbook:build_or_fix_routine",
}

const PROFILE_FOCUS_OVERLAY_ID: Record<AdvisorProfileFocus, GuidanceId> = {
  fine_hair: "overlay:fine_hair",
  oily_scalp: "overlay:oily_scalp",
  dry_lengths: "overlay:dry_lengths",
  minimal_routine: "overlay:minimal_routine",
  curly_hair: "overlay:curly_hair",
  coily_hair: "overlay:coily_hair",
  heat_styling: "overlay:heat_styling",
  mechanical_stress: "overlay:mechanical_stress",
  buildup_risk: "overlay:buildup_risk",
  damage_repair: "overlay:damage_repair",
  sensitive_scalp: "overlay:sensitive_scalp",
  dandruff_scalp: "overlay:dandruff_scalp",
  low_density_weight_sensitive: "overlay:low_density_weight_sensitive",
  frizz_control: "overlay:frizz_control",
  tangling_detangling: "overlay:tangling_detangling",
  protein_moisture_balance: "overlay:protein_moisture_balance",
  chemical_or_color_treated: "overlay:chemical_or_color_treated",
  hair_loss_or_thinning_guardrail: "overlay:hair_loss_or_thinning_guardrail",
}

const MAX_OVERLAYS = 4
const MAX_KEY_POINTS = 8
const MAX_PROFILE_POINTS = 6
const MAX_AVOID_POINTS = 5
const MAX_GUIDANCE_CATEGORIES = 3
const MAX_CATEGORY_SECTION_POINTS = 4

const OVERLAY_PRIORITY: Partial<Record<GuidanceId, number>> = {
  "overlay:hair_loss_or_thinning_guardrail": 100,
  "overlay:dandruff_scalp": 95,
  "overlay:sensitive_scalp": 90,
  "overlay:oily_scalp": 80,
  "overlay:dry_lengths": 75,
  "overlay:frizz_control": 74,
  "overlay:fine_hair": 73,
  "overlay:tangling_detangling": 72,
  "overlay:low_density_weight_sensitive": 69,
  "overlay:curly_hair": 65,
  "overlay:coily_hair": 65,
  "overlay:heat_styling": 60,
  "overlay:mechanical_stress": 58,
  "overlay:buildup_risk": 56,
  "overlay:chemical_or_color_treated": 54,
  "overlay:damage_repair": 52,
  "overlay:protein_moisture_balance": 50,
  "overlay:minimal_routine": 45,
}

export function normalizeAdvisorGuidanceIntent(value: unknown): AdvisorGuidanceIntent {
  return ADVISOR_GUIDANCE_INTENTS.includes(value as AdvisorGuidanceIntent)
    ? (value as AdvisorGuidanceIntent)
    : "category_explanation"
}

export function normalizeAdvisorGuidanceCategory(value: unknown): AdvisorGuidanceCategory | null {
  return ADVISOR_GUIDANCE_CATEGORIES.includes(value as AdvisorGuidanceCategory)
    ? (value as AdvisorGuidanceCategory)
    : null
}

export function normalizeAdvisorGuidanceCategories(value: unknown): AdvisorGuidanceCategory[] {
  if (!Array.isArray(value)) return []

  return unique(
    value
      .map((item) => normalizeAdvisorGuidanceCategory(item))
      .flatMap((item): AdvisorGuidanceCategory[] => {
        if (item === null) return []
        if (item === "bondbuilder") return ["bond_builder"]
        if (item === "deep_cleansing_shampoo") return ["deep_cleansing"]
        return [item]
      }),
  ).slice(0, MAX_GUIDANCE_CATEGORIES)
}

export function normalizeAdvisorProfileFocus(value: unknown): AdvisorProfileFocus[] {
  if (!Array.isArray(value)) return []

  return unique(
    value.filter((item): item is AdvisorProfileFocus =>
      ADVISOR_PROFILE_FOCUS.includes(item as AdvisorProfileFocus),
    ),
  )
}

export async function loadAdvisorGuidance(
  input: LoadAdvisorGuidanceInput,
): Promise<AdvisorGuidanceProjection> {
  const guidanceIds = resolveAdvisorGuidanceIds(input)
  const result = await loadGuidance(guidanceIds)

  return normalizeAdvisorGuidanceProjection({
    intent: input.intent ?? "category_explanation",
    category: input.category,
    items: result.items,
  })
}

export function resolveAdvisorGuidanceIds(input: LoadAdvisorGuidanceInput): GuidanceId[] {
  const ids: GuidanceId[] = []
  const intent = input.intent ?? "category_explanation"
  const playbookId = INTENT_PLAYBOOK_ID[intent]
  if (playbookId) ids.push(playbookId)

  const resolvedCategories = resolveAdvisorCategories(input)
  if (intent === "compare_or_decide" && resolvedCategories.length >= 2) {
    ids.push("playbook:category_comparison")
  }

  for (const category of resolvedCategories) {
    ids.push(CATEGORY_GUIDANCE_ID[category])
  }

  if (input.conversationState?.active_topic === "routine") {
    ids.push("playbook:build_or_fix_routine")
  }

  const profileOverlayIds = rankOverlayIds(
    unique([
      ...deriveCurrentTurnSafetyOverlayIds(input.message),
      ...deriveProfileOverlayIds(input.userContext),
      ...input.userContext.suggested_overlays.filter((id): id is GuidanceId =>
        isCompatibleOverlayId(id, input.userContext, input.message),
      ),
      ...input.profileFocus
        .filter((focus) => isProfileFocusCompatible(focus, input.userContext, input.message))
        .map((focus) => PROFILE_FOCUS_OVERLAY_ID[focus]),
    ]),
  ).slice(0, MAX_OVERLAYS)

  ids.push(...profileOverlayIds)

  if (ids.length === 0) {
    ids.push("topic:general_haircare")
  }

  return unique(ids)
}

function resolveAdvisorCategories(input: LoadAdvisorGuidanceInput): AdvisorGuidanceCategory[] {
  return unique([
    ...inferMentionedCategories(input.message),
    ...(input.category ? normalizeAdvisorGuidanceCategories([input.category]) : []),
    ...normalizeAdvisorGuidanceCategories(input.categories),
  ]).slice(0, MAX_GUIDANCE_CATEGORIES)
}

function inferMentionedCategories(message: string): AdvisorGuidanceCategory[] {
  const normalized = normalizeText(message)
  const categories: AdvisorGuidanceCategory[] = []

  if (/\b(?:dry shampoo|trockenshampoo)\b/.test(normalized)) categories.push("dry_shampoo")
  if (
    /\b(?:peeling|kopfhautpeeling|scalp scrub|scalp exfoliat|kopfhaut scrub|scrub)\b/.test(
      normalized,
    )
  ) {
    categories.push("peeling")
  }
  if (
    /\b(?:tiefenreinigung|tiefenreinigungsshampoo|deep cleansing|deep cleansing shampoo|clarifying|reset|reinigungsshampoo)\b/.test(
      normalized,
    )
  ) {
    categories.push("deep_cleansing")
  }
  if (isGenericShampooMention(normalized)) categories.push("shampoo")
  if (/\b(?:conditioner|spuelung|spulung)\b/.test(normalized)) categories.push("conditioner")
  if (/\b(?:leave[-_ ]?in|leavein)\b/.test(normalized)) categories.push("leave_in")
  if (/\b(?:maske|kur|haarkur)\b/.test(normalized)) categories.push("mask")
  if (/\b(?:oel|ol|oil|haarol|haaroel)\b/.test(normalized)) categories.push("oil")
  if (/\b(?:bondbuilder|bond builder|k18|olaplex|epres)\b/.test(normalized)) {
    categories.push("bond_builder")
  }

  return unique(categories).slice(0, MAX_GUIDANCE_CATEGORIES)
}

function isGenericShampooMention(normalized: string): boolean {
  if (/\b(?:waschgel|normales shampoo|regular shampoo|klassisches shampoo)\b/.test(normalized)) {
    return true
  }

  if (!/\bshampoo\b/.test(normalized)) return false

  return !/\b(?:dry shampoo|deep cleansing shampoo|clarifying shampoo|trockenshampoo|tiefenreinigungsshampoo|reinigungsshampoo)\b/.test(
    normalized,
  )
}

function isCompatibleOverlayId(
  id: string,
  userContext: UserContextProjection,
  message: string,
): boolean {
  const focus = ADVISOR_PROFILE_FOCUS.find(
    (candidate) => PROFILE_FOCUS_OVERLAY_ID[candidate] === id,
  )
  return focus ? isProfileFocusCompatible(focus, userContext, message) : false
}

function deriveProfileOverlayIds(userContext: UserContextProjection): GuidanceId[] {
  const profile = userContext.profile
  const ids: GuidanceId[] = []

  if (profile?.thickness === "fine") ids.push("overlay:fine_hair")
  if (profile?.concerns.includes("oily_scalp")) ids.push("overlay:oily_scalp")
  if (profile?.concerns.includes("dryness") || profile?.concerns.includes("frizz")) {
    ids.push("overlay:dry_lengths")
  }
  if (profile?.density === "low") ids.push("overlay:low_density_weight_sensitive")
  if (profile?.concerns.includes("frizz") || profile?.goals.includes("less_frizz")) {
    ids.push("overlay:frizz_control")
  }
  if (profile?.concerns.includes("tangling")) ids.push("overlay:tangling_detangling")
  if (profile?.protein_moisture_balance) ids.push("overlay:protein_moisture_balance")
  if (hasChemicalOrColorTreatment(profile) || profile?.goals.includes("color_protection")) {
    ids.push("overlay:chemical_or_color_treated")
  }
  if (profile?.concerns.includes("hair_loss") || profile?.concerns.includes("thinning")) {
    ids.push("overlay:hair_loss_or_thinning_guardrail")
  }
  if (profile?.hair_texture === "curly") ids.push("overlay:curly_hair")
  if (profile?.hair_texture === "coily") ids.push("overlay:coily_hair")
  if (hasActiveHeatStyling(profile)) {
    ids.push("overlay:heat_styling")
  }
  if (
    hasChemicalOrColorTreatment(profile) ||
    profile?.concerns.includes("hair_damage") ||
    profile?.concerns.includes("breakage") ||
    profile?.concerns.includes("split_ends")
  ) {
    ids.push("overlay:damage_repair")
  }
  if (hasMechanicalStress(userContext)) ids.push("overlay:mechanical_stress")
  if (profile?.scalp_condition === "dry_flakes" || profile?.scalp_condition === "irritated") {
    ids.push("overlay:sensitive_scalp")
  }
  if (profile?.scalp_condition === "dandruff") ids.push("overlay:dandruff_scalp")

  return ids
}

function deriveCurrentTurnSafetyOverlayIds(message: string): GuidanceId[] {
  const ids: GuidanceId[] = []

  if (hasHairLossOrThinningSignal(message)) {
    ids.push("overlay:hair_loss_or_thinning_guardrail")
  }
  if (hasDandruffSignal(message)) {
    ids.push("overlay:dandruff_scalp")
  }
  if (hasSensitiveScalpSignal(message)) {
    ids.push("overlay:sensitive_scalp")
  }

  return ids
}

function isProfileFocusCompatible(
  focus: AdvisorProfileFocus,
  userContext: UserContextProjection,
  message: string,
): boolean {
  const profile = userContext.profile
  if (!profile) return true

  switch (focus) {
    case "fine_hair":
      return profile.thickness === "fine"
    case "oily_scalp":
      return profile.concerns.includes("oily_scalp") || profile.scalp_type === "oily"
    case "dry_lengths":
      return profile.concerns.includes("dryness") || profile.concerns.includes("frizz")
    case "low_density_weight_sensitive":
      return profile.density === "low"
    case "frizz_control":
      return profile.concerns.includes("frizz") || profile.goals.includes("less_frizz")
    case "tangling_detangling":
      return profile.concerns.includes("tangling")
    case "protein_moisture_balance":
      return Boolean(profile.protein_moisture_balance)
    case "chemical_or_color_treated":
      return hasChemicalOrColorTreatment(profile) || profile.goals.includes("color_protection")
    case "hair_loss_or_thinning_guardrail":
      return (
        profile.concerns.includes("hair_loss") ||
        profile.concerns.includes("thinning") ||
        hasHairLossOrThinningSignal(message)
      )
    case "curly_hair":
      return profile.hair_texture === "curly"
    case "coily_hair":
      return profile.hair_texture === "coily"
    case "heat_styling":
      return hasActiveHeatStyling(profile)
    case "damage_repair":
      return (
        hasChemicalOrColorTreatment(profile) ||
        profile.concerns.includes("hair_damage") ||
        profile.concerns.includes("breakage") ||
        profile.concerns.includes("split_ends")
      )
    case "sensitive_scalp":
      return (
        profile.scalp_condition === "dry_flakes" ||
        profile.scalp_condition === "irritated" ||
        hasSensitiveScalpSignal(message)
      )
    case "dandruff_scalp":
      return profile.scalp_condition === "dandruff" || hasDandruffSignal(message)
    case "minimal_routine":
      return profile.routine_preference === "minimal" || hasDerivedSignal(userContext, "minimal")
    case "mechanical_stress":
      return hasMechanicalStress(userContext)
    case "buildup_risk":
      return (
        profile.concerns.includes("oily_scalp") ||
        profile.scalp_type === "oily" ||
        (profile.current_routine_products ?? []).includes("oil") ||
        /(?:\boel\b|\boil\b|kokosoel|build[-\s]?up|ablager|produktreste)/i.test(
          profile.products_used ?? "",
        ) ||
        hasDerivedSignal(userContext, "buildup") ||
        hasDerivedSignal(userContext, "build-up")
      )
  }
}

function rankOverlayIds(ids: GuidanceId[]): GuidanceId[] {
  return ids
    .map((id, index) => ({ id, index }))
    .sort((left, right) => {
      const priorityDelta = (OVERLAY_PRIORITY[right.id] ?? 0) - (OVERLAY_PRIORITY[left.id] ?? 0)
      return priorityDelta === 0 ? left.index - right.index : priorityDelta
    })
    .map((item) => item.id)
}

function hasActiveHeatStyling(profile: UserContextProjection["profile"]): boolean {
  return Boolean(profile?.heat_styling && profile.heat_styling !== "never")
}

function hasChemicalOrColorTreatment(profile: UserContextProjection["profile"]): boolean {
  return Boolean((profile?.chemical_treatment ?? []).some((treatment) => treatment !== "natural"))
}

function hasMechanicalStress(userContext: UserContextProjection): boolean {
  const profile = userContext.profile
  return (
    hasActiveHeatStyling(profile) ||
    Boolean(profile?.styling_tools?.length) ||
    Boolean(profile?.brush_type) ||
    Boolean(profile?.drying_method && profile.drying_method !== "air_dry") ||
    hasDerivedSignal(userContext, "mechanical") ||
    hasDerivedSignal(userContext, "friction") ||
    hasDerivedSignal(userContext, "reibung") ||
    hasDerivedSignal(userContext, "foehn") ||
    hasDerivedSignal(userContext, "föhn") ||
    hasDerivedSignal(userContext, "buerste") ||
    hasDerivedSignal(userContext, "bürste")
  )
}

function hasHairLossOrThinningSignal(message: string): boolean {
  const normalized = normalizeText(message)
  return (
    /\b(?:haarausfall|haarverlust|ausfall|ausfallen|duenner|dunner|licht|scheitel|kahl|kahle|alopez|alopecia|thinning|shedding|hair loss|bald|patchy|postpartum|traction)\b/.test(
      normalized,
    ) ||
    /\b(?:haare?|haarstraehnen|haarsträhnen)\b.{0,40}\b(?:fall(?:en|t)?|gehen)\b.{0,20}\baus\b/.test(
      normalized,
    ) ||
    /\bfall(?:en|t)?\b.{0,40}\b(?:haare?|haarstraehnen|haarsträhnen)\b.{0,20}\baus\b/.test(
      normalized,
    )
  )
}

function hasSensitiveScalpSignal(message: string): boolean {
  const normalized = normalizeText(message)
  return /\b(?:juck|juckt|juckende|brenn|brennt|reiz|irrit|empfindlich|wunde|schmerz|entzund|entzuend)\b/.test(
    normalized,
  )
}

function hasDandruffSignal(message: string): boolean {
  const normalized = normalizeText(message)
  return /\b(?:schuppen|dandruff|flakes|flocken)\b/.test(normalized)
}

function hasDerivedSignal(userContext: UserContextProjection, needle: string): boolean {
  const normalizedNeedle = normalizeText(needle)
  return userContext.derived_signals.some((signal) =>
    normalizeText(signal).includes(normalizedNeedle),
  )
}

function normalizeAdvisorGuidanceProjection(params: {
  intent: AdvisorGuidanceIntent
  category: AdvisorGuidanceCategory | null
  items: GuidanceItem[]
}): AdvisorGuidanceProjection {
  const topicItems = params.items.filter((item) => item.kind === "topic" || item.kind === "routine")
  const playbookItems = params.items.filter((item) => item.kind === "playbook")
  const overlayItems = params.items.filter((item) => item.kind === "overlay")
  const allNonOverlayItems = [...topicItems, ...playbookItems]
  const categorySections = topicItems
    .map((item) => {
      const category = mapGuidanceIdToAdvisorCategory(item.id)
      if (!category) return null
      return {
        category,
        guidance_id: item.id,
        key_points: compactCategorySectionLines(item, MAX_CATEGORY_SECTION_POINTS),
      }
    })
    .filter((item): item is AdvisorGuidanceCategorySection => item !== null)
  const hasMultipleCategorySections = categorySections.length > 1

  return {
    loaded_guidance_ids: params.items.map((item) => item.id),
    direct_answer_frame: buildDirectAnswerFrame(params.intent, params.category),
    key_advice_points: compactLines(
      hasMultipleCategorySections
        ? prioritizeCategoryComparisonPlaybook(playbookItems)
        : allNonOverlayItems,
      MAX_KEY_POINTS,
    ),
    profile_interpretation: compactLines(overlayItems, MAX_PROFILE_POINTS),
    category_implications: hasMultipleCategorySections
      ? []
      : compactLines(topicItems, MAX_KEY_POINTS),
    category_sections: categorySections,
    avoid: compactAvoidLines(params.items, MAX_AVOID_POINTS),
    proactive_next_step_options: buildProactiveNextSteps(params.intent),
  }
}

function mapGuidanceIdToAdvisorCategory(id: GuidanceId): AdvisorGuidanceCategory | null {
  for (const category of ADVISOR_GUIDANCE_CATEGORIES) {
    if (category === "bondbuilder") continue
    if (category === "deep_cleansing_shampoo") continue
    if (CATEGORY_GUIDANCE_ID[category] === id) return category
  }
  return null
}

function compactCategorySectionLines(item: GuidanceItem, limit: number): string[] {
  const sectionLines = extractSectionLines(item.content, [
    "Category Role",
    "Best Fit",
    "Weak Fit",
    "Decision Axes",
    "Profile Interplay",
    "Compare Against Other Categories",
    "Answer Guidance",
    "Guardrails",
  ])

  if (sectionLines.length > 0) return unique(sectionLines).slice(0, limit)
  return compactLines([item], limit)
}

function buildDirectAnswerFrame(
  intent: AdvisorGuidanceIntent,
  category: AdvisorGuidanceCategory | null,
): string {
  const categoryLabel = category ? category.replace(/_/g, " ") : "the topic"

  if (intent === "usage") {
    return `Explain when and how ${categoryLabel} fits into the routine before offering products.`
  }

  if (intent === "compare_or_decide") {
    return `Compare the practical roles first, then give a soft recommendation when the guidance supports it.`
  }

  if (intent === "problem_context") {
    return `Start with the likely cosmetic mechanism, then suggest the safest next care lever.`
  }

  if (intent === "routine_context") {
    return `Explain the current routine layer first and keep optional steps clearly optional.`
  }

  return `Answer whether ${categoryLabel} is useful or necessary, then explain the profile-aware reason and one next step.`
}

function buildProactiveNextSteps(intent: AdvisorGuidanceIntent): string[] {
  if (intent === "usage") {
    return [
      "Offer to show where the step fits in the user's routine.",
      "Offer concrete product picks only if the user wants recommendations next.",
    ]
  }

  if (intent === "compare_or_decide") {
    return ["Offer to turn the decision into a simple next-step routine or product shortlist."]
  }

  if (intent === "routine_context") {
    return ["Offer to continue with goal-oriented or problem-oriented next-layer advice."]
  }

  return [
    "Offer one natural next step: product picks, usage, or routine placement.",
    "Keep it as an offer, not a blocking question.",
  ]
}

function compactLines(items: GuidanceItem[], limit: number): string[] {
  return unique(
    items.flatMap((item) =>
      normalizeGuidanceLines(item.content).filter((line) => !/^avoid:?$/i.test(line)),
    ),
  ).slice(0, limit)
}

function prioritizeCategoryComparisonPlaybook(items: GuidanceItem[]): GuidanceItem[] {
  return [
    ...items.filter((item) => item.id === "playbook:category_comparison"),
    ...items.filter((item) => item.id !== "playbook:category_comparison"),
  ]
}

function compactAvoidLines(items: GuidanceItem[], limit: number): string[] {
  const sectionLines = items.flatMap((item) =>
    unique([
      ...extractSectionLines(item.content, ["Guardrails"]),
      ...extractSectionLines(item.content, ["Avoid"]),
    ]).slice(0, item.kind === "topic" ? 1 : 2),
  )
  const fallbackLines = items.flatMap((item) =>
    normalizeGuidanceLines(item.content).filter((line) =>
      /\b(do not|don't|never|avoid)\b/i.test(line),
    ),
  )

  return unique([...sectionLines, ...fallbackLines]).slice(0, limit)
}

function extractSectionLines(content: string, sectionNames: string[]): string[] {
  const lines = content.split(/\r?\n/)
  const sectionNamesLower = sectionNames.map((name) => name.toLowerCase())
  const result: string[] = []
  let inSection = false

  for (const rawLine of lines) {
    const normalized = normalizeGuidanceLine(rawLine)
    if (!normalized) continue

    const isHeading = rawLine.trim().endsWith(":") || /^#{1,6}\s+/.test(rawLine)
    const headingText = normalized.replace(/:$/, "").toLowerCase()
    if (isHeading && sectionNamesLower.includes(headingText)) {
      inSection = true
      continue
    }

    if (inSection && isHeading) break
    if (inSection) result.push(normalized)
  }

  return result
}

function normalizeGuidanceLines(content: string): string[] {
  return content
    .split(/\r?\n/)
    .map(normalizeGuidanceLine)
    .filter((line) => line.length > 0)
}

function normalizeGuidanceLine(line: string): string {
  return line
    .trim()
    .replace(/^#{1,6}\s+/, "")
    .replace(/^-+\s*/, "")
    .replace(/^\d+\.\s*/, "")
    .trim()
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values))
}
