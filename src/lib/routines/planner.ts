import {
  CONCERN_LABELS,
  GOAL_LABELS,
  HAIR_TEXTURE_LABELS,
  SCALP_CONDITION_LABELS,
  SCALP_TYPE_LABELS,
  WASH_FREQUENCY_LABELS,
} from "@/lib/vocabulary"
import { CONDITIONER_REPAIR_LEVEL_LABELS } from "@/lib/conditioner/constants"
import { LEAVE_IN_NEED_BUCKET_LABELS, LEAVE_IN_STYLING_CONTEXT_LABELS } from "@/lib/leave-in/constants"
import { buildConditionerDecision } from "@/lib/rag/conditioner-decision"
import { buildLeaveInDecision } from "@/lib/rag/leave-in-decision"
import { deriveMaskDecision } from "@/lib/rag/mask-reranker"
import { buildShampooDecision } from "@/lib/rag/shampoo-decision"
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
  lockenrefresh: "Lockenrefresh",
  cwc_owc: "CWC/OWC",
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

const BOND_BUILDER_TERMS = [
  "bond builder",
  "bond repair",
  "olaplex",
  "k18",
  "bonding",
]

const REFRESH_TERMS = [
  "lockenrefresh",
  "locken refresh",
  "refresh",
  "auffrischen",
  "between wash",
  "tag danach",
  "naechster tag",
]

const CWC_OWC_TERMS = [
  "cwc",
  "owc",
  "owc methode",
  "cwc methode",
  "conditioner wash conditioner",
  "oel waschen conditioner",
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

const CURLY_TEXTURES = new Set(["wavy", "curly", "coily"])
const HEAVY_ROUTINE_PRODUCTS = new Set(["mask", "oil", "leave_in"])

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

function hasBuildupSignals(profile: HairProfile | null, normalizedMessage: string): boolean {
  const heavyProductCount = (profile?.current_routine_products ?? []).filter((entry) =>
    HEAVY_ROUTINE_PRODUCTS.has(entry)
  ).length
  const productText = normalizeText(profile?.products_used ?? "")
  const combinedText = `${normalizedMessage} ${productText}`.trim()
  const usesHairOiling = (profile?.current_routine_products ?? []).includes("oil") || includesAny(combinedText, OILING_TERMS)

  return (
    includesAny(normalizedMessage, CLARIFY_TERMS) ||
    profile?.scalp_type === "oily" ||
    (profile?.concerns ?? []).includes("oily_scalp") ||
    (profile?.goals ?? []).includes("volume") ||
    heavyProductCount >= 2 ||
    usesHairOiling ||
    includesAny(combinedText, HEAVY_STYLING_TERMS) ||
    includesAny(combinedText, UNDERPERFORMING_ROUTINE_TERMS) ||
    includesAny(combinedText, WASH_LESS_TERMS)
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

function hasDamageSignals(profile: HairProfile | null): boolean {
  const concerns = new Set(profile?.concerns ?? [])
  const treatments = new Set(profile?.chemical_treatment ?? [])

  return (
    concerns.has("hair_damage") ||
    concerns.has("split_ends") ||
    profile?.cuticle_condition === "rough" ||
    treatments.has("colored") ||
    treatments.has("bleached")
  )
}

function hasOilWeightRisk(profile: HairProfile | null): boolean {
  return (
    (profile?.thickness === "fine" && profile?.density === "high")
  )
}

function hasStrongTechniqueFit(profile: HairProfile | null): boolean {
  const treatments = new Set(profile?.chemical_treatment ?? [])

  return (
    hasDrynessDamageSignals(profile) &&
    (
      profile?.cuticle_condition === "rough" ||
      profile?.cuticle_condition === "slightly_rough" ||
      treatments.has("colored") ||
      treatments.has("bleached") ||
      profile?.thickness === "normal" ||
      profile?.thickness === "coarse"
    )
  )
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
      label: CONCERN_LABELS[concern] ?? concern,
    })
  }

  for (const goal of profile?.goals ?? []) {
    pushFocus({
      kind: "goal",
      code: goal,
      label: GOAL_LABELS[goal] ?? goal,
    })
  }

  if (profile?.scalp_condition && profile.scalp_condition !== "none") {
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
  if (includesAny(normalizedMessage, REFRESH_TERMS)) topics.push("lockenrefresh")
  if (includesAny(normalizedMessage, CWC_OWC_TERMS)) topics.push("cwc_owc")

  return topics
}

export function deriveRoutineContext(
  profile: HairProfile | null,
  message: string,
): RoutineContext {
  const normalizedMessage = normalizeText(message)
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
    (profile?.current_routine_products?.length ?? 0) > 0 ||
    Boolean(profile?.products_used?.trim())

  return {
    hair_texture: profile?.hair_texture ?? null,
    thickness: profile?.thickness ?? null,
    density: profile?.density ?? null,
    wash_frequency: profile?.wash_frequency ?? null,
    heat_styling: profile?.heat_styling ?? null,
    scalp_type: profile?.scalp_type ?? null,
    scalp_condition: profile?.scalp_condition ?? null,
    cuticle_condition: profile?.cuticle_condition ?? null,
    protein_moisture_balance: profile?.protein_moisture_balance ?? null,
    concerns: profile?.concerns ?? [],
    goals: profile?.goals ?? [],
    chemical_treatment: profile?.chemical_treatment ?? [],
    post_wash_actions: profile?.post_wash_actions ?? [],
    mechanical_stress_factors: profile?.mechanical_stress_factors ?? [],
    current_routine_products: profile?.current_routine_products ?? [],
    products_used: profile?.products_used ?? null,
    explicit_topic_ids: explicitTopicIds,
    primary_focuses: primaryFocuses,
    organizer_complete: organizerComplete,
    cadence_complete: cadenceComplete,
    inventory_complete: inventoryComplete,
    has_between_wash_days: hasBetweenWashDays(profile?.wash_frequency ?? null),
    has_buildup_signals: hasBuildupSignals(profile, normalizedMessage),
    has_dryness_damage_signals: hasDrynessDamageSignals(profile),
    has_damage_signals: hasDamageSignals(profile),
    has_oil_weight_risk: hasOilWeightRisk(profile),
    has_strong_technique_fit: hasStrongTechniqueFit(profile),
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
    context.scalp_type === "dry" ||
    context.scalp_condition === "dry_flakes" ||
    context.scalp_condition === "dandruff"
  )
}

export function activateRoutineTopics(
  profile: HairProfile | null,
  message: string,
  context: RoutineContext = deriveRoutineContext(profile, message),
): RoutineTopicActivation[] {
  const activations: RoutineTopicActivation[] = []
  const seen = new Set<RoutineTopicId>()

  const push = (
    id: RoutineTopicId,
    reason: string,
    priority: number,
    instructionOnly: boolean,
  ) => {
    if (seen.has(id)) return
    seen.add(id)
    activations.push(createTopicActivation(id, reason, priority, instructionOnly))
  }

  const baseTopicId = getBaseRoutineTopicId(profile)
  if (baseTopicId) {
    push(
      baseTopicId,
      "Das Haarmuster legt die Grundstruktur der Routine fest.",
      10,
      false,
    )
  }

  const explicit = new Set(context.explicit_topic_ids)

  if (
    explicit.has("tiefenreinigung") ||
    context.has_buildup_signals
  ) {
    push(
      "tiefenreinigung",
      explicit.has("tiefenreinigung")
        ? "Die Frage zielt direkt auf Build-up oder Tiefenreinigung."
        : "Kopfhaut- oder Build-up-Signale sprechen fuer einen gelegentlichen Reset.",
      30,
      true,
    )
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

  if (explicit.has("bond_builder") || context.has_damage_signals) {
    push(
      "bond_builder",
      explicit.has("bond_builder")
        ? "Bond Builder wurde direkt angefragt."
        : "Schadens- oder Chemie-Signale sprechen fuer Repair-Support.",
      45,
      true,
    )
  }

  if (
    explicit.has("lockenrefresh") ||
    (
      context.has_between_wash_days &&
      context.hair_texture !== null &&
      CURLY_TEXTURES.has(context.hair_texture)
    )
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

  if (explicit.has("cwc_owc") || context.has_strong_technique_fit) {
    push(
      "cwc_owc",
      explicit.has("cwc_owc")
        ? "CWC/OWC wurde direkt angefragt."
        : "Trockenheits- und Schadenssignale sprechen fuer eine optionale Technik-Variante.",
      60,
      true,
    )
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
      "Was soll deine Routine gerade vor allem leisten - weniger Frizz, mehr Feuchtigkeit, Definition, Reparatur oder eher etwas fuer die Kopfhaut?"
    )
  }

  if (!context.cadence_complete) {
    questions.push("Wie oft waeschst du deine Haare aktuell?")
  }

  if (!context.inventory_complete) {
    questions.push(
      "Welche Schritte sind aktuell schon fest in deiner Routine - Shampoo, Conditioner, Leave-in, Maske oder Oel?"
    )
  }

  if (!profile?.hair_texture) {
    questions.push("Ist dein Haar eher glatt, wellig, lockig oder kraus?")
  }

  return questions.slice(0, 3)
}

function hasCurrentProduct(profile: HairProfile | null, product: HairProfile["current_routine_products"][number]): boolean {
  return (profile?.current_routine_products ?? []).includes(product)
}

function buildSectionSummary(phase: RoutinePlanSection["phase"], profile: HairProfile | null): string {
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

function pushSlot(sections: Map<RoutinePlanSection["phase"], RoutineSlotAdvice[]>, slot: RoutineSlotAdvice): void {
  sections.set(slot.phase, [...(sections.get(slot.phase) ?? []), slot])
}

function buildMaskCadence(maskStrength: number): string {
  if (maskStrength >= 3) return "etwa jede 2. Waesche"
  if (maskStrength === 2) return "alle 2-3 Waeschen"
  return "alle 4-5 Waeschen"
}

function buildRoutineDecisionContext(profile: HairProfile | null): RoutineDecisionContext {
  return {
    shampoo: buildShampooDecision(profile),
    conditioner: buildConditionerDecision(profile),
    leave_in: buildLeaveInDecision(profile),
    mask: deriveMaskDecision(profile),
  }
}

function buildRoutineSlots(
  profile: HairProfile | null,
  context: RoutineContext,
  activations: RoutineTopicActivation[],
  decisionContext: RoutineDecisionContext,
): Map<RoutinePlanSection["phase"], RoutineSlotAdvice[]> {
  const sections = new Map<RoutinePlanSection["phase"], RoutineSlotAdvice[]>()
  const activeTopicIds = new Set(activations.map((entry) => entry.id))
  const shampooPresent = hasCurrentProduct(profile, "shampoo")
  const conditionerPresent = hasCurrentProduct(profile, "conditioner")
  const leaveInPresent = hasCurrentProduct(profile, "leave_in")
  const maskPresent = hasCurrentProduct(profile, "mask")
  const oilPresent = hasCurrentProduct(profile, "oil")
  const { shampoo: shampooDecision, conditioner: conditionerDecision, leave_in: leaveInDecision, mask: maskDecision } = decisionContext

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
    product_linkable: !shampooPresent && shampooDecision.eligible && Boolean(shampooDecision.matched_bucket),
    product_query: "Ich suche ein Shampoo fuer meine regulaeren Waschtage.",
    attachment_priority: 50,
  })

  const conditionerReasons = ["Conditioner bleibt der feste Pflegeanker nach jeder Waesche."]
  if (conditionerDecision.matched_balance_need) {
    conditionerReasons.push(
      `Der Conditioner sollte vor allem ${conditionerDecision.matched_balance_need === "balanced"
        ? "ausgewogen pflegen"
        : conditionerDecision.matched_balance_need === "moisture"
          ? "mehr Feuchtigkeit liefern"
          : "mehr Struktur und Repair geben"}.`
    )
  }
  if (conditionerDecision.matched_repair_level) {
    conditionerReasons.push(
      `Der Repair-Fokus liegt eher bei ${CONDITIONER_REPAIR_LEVEL_LABELS[conditionerDecision.matched_repair_level]}.`
    )
  }

  const conditionerAction: RoutineSlotAction =
    conditionerPresent
      ? (
        conditionerDecision.matched_balance_need && conditionerDecision.matched_balance_need !== "balanced"
          ? "upgrade"
          : conditionerDecision.matched_repair_level === "high"
            ? "upgrade"
            : "keep"
      )
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
      conditionerDecision.eligible,
    product_query: "Ich suche einen Conditioner fuer meine Basisroutine.",
    attachment_priority: 20,
  })

  const shouldUseLeaveIn =
    Boolean(leaveInDecision.need_bucket) ||
    activeTopicIds.has("lockenrefresh") ||
    context.goals.includes("less_frizz") ||
    context.goals.includes("moisture") ||
    context.goals.includes("curl_definition") ||
    context.concerns.includes("frizz") ||
    context.concerns.includes("dryness")

  if (shouldUseLeaveIn || leaveInPresent) {
    const leaveInAction: RoutineSlotAction =
      !shouldUseLeaveIn && leaveInPresent
        ? "avoid"
        : leaveInPresent
          ? "adjust"
          : "add"

    const leaveInReasons = ["Ein Leave-in oder Finish-Schritt macht die Routine nach dem Waschen runder."]
    if (leaveInDecision.need_bucket) {
      leaveInReasons.push(
        `Der Schwerpunkt liegt eher auf ${LEAVE_IN_NEED_BUCKET_LABELS[leaveInDecision.need_bucket]}.`
      )
    }
    if (leaveInDecision.styling_context) {
      leaveInReasons.push(
        `Der Finish-Schritt soll vor allem fuer ${LEAVE_IN_STYLING_CONTEXT_LABELS[leaveInDecision.styling_context]} passen.`
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
        : (activations[0] ? [activations[0].id] : []),
      product_linkable:
        leaveInAction === "add" &&
        leaveInDecision.eligible,
      product_query: "Ich suche ein Leave-in fuer meine Routine nach dem Waschen.",
      attachment_priority: 10,
    })
  }

  if (activeTopicIds.has("lockenrefresh")) {
    pushSlot(sections, {
      id: "maintenance-refresh",
      kind: "instruction",
      phase: "maintenance",
      label: "Lockenrefresh",
      action: leaveInPresent ? "adjust" : "add",
      category: null,
      cadence: "an Tagen zwischen den Waeschen",
      rationale: [
        "Wellen und Locken profitieren oft von einem leichten Refresh statt einer kompletten Neuwaesche.",
        "Der Punkt bleibt bewusst auf Routine-Ebene und geht noch nicht in Anwendungstechnik.",
      ],
      caveats: [],
      topic_ids: ["lockenrefresh"],
      product_linkable: false,
      product_query: null,
      attachment_priority: 90,
    })
  }

  if (maskDecision.needs_mask || maskPresent) {
    pushSlot(sections, {
      id: "occasional-mask",
      kind: "product_slot",
      phase: "occasional",
      label: "Maske / Kur",
      action: !maskDecision.needs_mask
        ? "avoid"
        : maskPresent
          ? "adjust"
          : "add",
      category: "mask",
      cadence: maskDecision.needs_mask ? buildMaskCadence(maskDecision.need_strength) : "vorerst nicht fest einplanen",
      rationale: maskDecision.needs_mask
        ? [
          "Eine Maske bleibt Zusatzpflege und wird nur bei echtem Bedarf fest eingeplant.",
          maskDecision.mask_type
            ? `Der Fokus liegt eher auf ${MASK_TYPE_LABELS[maskDecision.mask_type] ?? maskDecision.mask_type}.`
            : "Die Maske wird ueber Bedarf und Vertraeglichkeit gesteuert.",
        ]
        : [
          "Aktuell sprechen die Profilsignale nicht fuer eine feste Masken-Rolle in der Routine.",
        ],
      caveats: [],
      topic_ids: activeTopicIds.has("bond_builder")
        ? ["bond_builder"]
        : [],
      product_linkable: !maskPresent && maskDecision.needs_mask && Boolean(maskDecision.mask_type),
      product_query: "Ich suche eine Maske fuer meine Routine.",
      attachment_priority: 30,
    })
  }

  if (activeTopicIds.has("tiefenreinigung")) {
    pushSlot(sections, {
      id: "occasional-clarify",
      kind: "instruction",
      phase: "occasional",
      label: "Tiefenreinigung / Reset",
      action: shampooPresent ? "adjust" : "add",
      category: null,
      cadence: context.scalp_type === "oily" ? "alle 1-2 Wochen nach Bedarf" : "alle 2-3 Wochen oder bei Build-up",
      rationale: [
        "Tiefenreinigung ist ein gezielter Reset und kein Pflichtschritt fuer jede Waesche.",
        "Sie wird vor allem dann relevant, wenn Kopfhaut, Build-up oder Produktueberlagerung die Routine schwerer machen.",
      ],
      caveats: (
        context.scalp_condition === "irritated" ||
        context.scalp_condition === "dry_flakes"
      )
        ? ["Bei gereizter oder trockener Kopfhaut vorsichtig bleiben und nicht ueberziehen."]
        : [],
      topic_ids: ["tiefenreinigung"],
      product_linkable: false,
      product_query: null,
      attachment_priority: 95,
    })
  }

  if (activeTopicIds.has("hair_oiling") || oilPresent) {
    const oilAction: RoutineSlotAction = !activeTopicIds.has("hair_oiling")
      ? "avoid"
      : oilPresent
        ? "adjust"
        : "add"
    const oilActive = oilAction === "add" || oilAction === "adjust"

    const oilRationale = [
      "Hair Oiling bleibt ein optionaler Pre-Wash-Baustein und keine Pflicht fuer jede Routine.",
      hasScalpHairOilingFit(context)
        ? "Es kann sowohl die Kopfhautbalance unterstuetzen als auch Laengen und Spitzen vor der Waesche schuetzen."
        : "Es ist vor allem dann sinnvoll, wenn Trockenheit oder Oberflaechenschaeden ein Thema sind.",
    ]
    if (oilActive) {
      oilRationale.push(
        "Wichtig beim Auswaschen: Shampoo zuerst auf trockenes Haar auftragen, dann erst mit Wasser ausspuelen."
      )
    }

    const oilCaveats: string[] = []
    if (context.scalp_condition === "irritated") {
      oilCaveats.push("Bei stark gereizter Kopfhaut eher sanft bleiben und die Routine nicht ueberladen.")
    }
    if (oilActive) {
      oilCaveats.push("Aetherische Oele (z.B. Rosmarin, Teebaum) nie pur auftragen — immer mit einem Basisoel verduennen.")
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
    pushSlot(sections, {
      id: "occasional-bond-builder",
      kind: "instruction",
      phase: "occasional",
      label: "Bond Builder / Repair-Support",
      action: maskPresent ? "adjust" : "add",
      category: null,
      cadence: "kurweise oder in stressigeren Phasen",
      rationale: [
        "Bond Builder wird nur dann relevant, wenn echte Schadens- oder Chemie-Signale mitlaufen.",
        "Der Punkt bleibt in v1 bewusst instruktional und nicht produktzentriert.",
      ],
      caveats: [],
      topic_ids: ["bond_builder"],
      product_linkable: false,
      product_query: null,
      attachment_priority: 96,
    })
  }

  if (activeTopicIds.has("cwc_owc")) {
    pushSlot(sections, {
      id: "occasional-cwc-owc",
      kind: "instruction",
      phase: "occasional",
      label: "CWC / OWC als Technik-Option",
      action: "add",
      category: null,
      cadence: "als Option statt dauerhaftem Pflichtschritt",
      rationale: [
        "CWC/OWC bleibt eine Technik-Variante fuer bestimmte Trockenheits- oder Schadenslagen.",
        "Die Routine soll dadurch flexibler werden, nicht komplizierter.",
      ],
      caveats: [],
      topic_ids: ["cwc_owc"],
      product_linkable: false,
      product_query: null,
      attachment_priority: 97,
    })
  }

  return sections
}

export function buildRoutinePlan(
  profile: HairProfile | null,
  message: string,
): RoutinePlan {
  const context = deriveRoutineContext(profile, message)
  const activeTopics = activateRoutineTopics(profile, message, context)
  const decisionContext = buildRoutineDecisionContext(profile)
  const sectionSlots = buildRoutineSlots(profile, context, activeTopics, decisionContext)

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
    sections,
    decision_context: decisionContext,
  }
}

export function buildRoutineRetrievalSubqueries(
  message: string,
  plan: RoutinePlan,
): string[] {
  const focusSummary = plan.primary_focuses
    .slice(0, 2)
    .map((focus) => focus.label)
    .join(" ")

  const queries = new Set<string>([message])

  for (const topic of plan.active_topics) {
    const query = focusSummary
      ? `${topic.label} ${focusSummary}`
      : topic.label
    queries.add(query)
  }

  for (const section of plan.sections) {
    for (const slot of section.slots) {
      if (!slot.product_query) continue
      queries.add(slot.product_query)
    }
  }

  return [...queries].slice(0, 6)
}

export function getRoutineAutofillSlots(plan: RoutinePlan): RoutineSlotAdvice[] {
  return plan.sections
    .flatMap((section) => section.slots)
    .filter((slot) =>
      slot.product_linkable &&
      (slot.action === "add" || slot.action === "upgrade")
    )
    .sort((a, b) => a.attachment_priority - b.attachment_priority)
}

export { ROUTINE_TOPIC_LABELS }
