import {
  DEFAULT_CHAT_COMPLETION_MODEL,
  DEFAULT_CHAT_COMPLETION_TEMPERATURE,
  streamChatCompletion,
} from "@/lib/openai/chat"
import {
  buildLangfusePromptConfig,
  getManagedTextPromptTemplate,
  LANGFUSE_PROMPTS,
} from "@/lib/langfuse/prompts"
import { getLangfuseEnvironment } from "@/lib/openai/client"
import { SYSTEM_PROMPT } from "@/lib/rag/prompts"
import {
  CONDITIONER_REPAIR_LEVEL_LABELS,
  CONDITIONER_WEIGHT_LABELS,
} from "@/lib/conditioner/constants"
import {
  LEAVE_IN_CONDITIONER_RELATIONSHIP_LABELS,
  LEAVE_IN_NEED_BUCKET_LABELS,
  LEAVE_IN_STYLING_CONTEXT_LABELS,
  LEAVE_IN_WEIGHT_LABELS,
} from "@/lib/leave-in/constants"
import {
  OIL_NO_RECOMMENDATION_LABELS,
  OIL_SUBTYPE_LABELS,
  OIL_USE_MODE_LABELS,
} from "@/lib/oil/constants"
import { SHAMPOO_BUCKET_LABELS } from "@/lib/shampoo/constants"
import {
  SOURCE_TYPE_LABELS,
  CONCERN_LABELS,
  GOAL_LABELS,
  DESIRED_VOLUME_LABELS,
  STYLING_TOOL_LABELS,
  WASH_FREQUENCY_LABELS,
  HEAT_STYLING_LABELS,
  CUTICLE_CONDITION_LABELS,
  HAIR_DENSITY_LABELS,
  HAIR_TEXTURE_LABELS,
  HAIR_THICKNESS_LABELS,
  SCALP_TYPE_LABELS,
  SCALP_CONDITION_LABELS,
  CHEMICAL_TREATMENT_LABELS,
  MECHANICAL_STRESS_FACTOR_LABELS,
  TOWEL_MATERIAL_LABELS,
  TOWEL_TECHNIQUE_LABELS,
  DRYING_METHOD_LABELS,
  BRUSH_TYPE_LABELS,
  NIGHT_PROTECTION_LABELS,
} from "@/lib/vocabulary"
import type {
  Message,
  HairProfile,
  IntentType,
  Product,
  ContentChunk,
  ProductCategory,
  MaskDecision,
  ShampooDecision,
  ConditionerDecision,
  LeaveInDecision,
  OilDecision,
  RoutinePlan,
  ChatPromptMessageSnapshot,
  ChatPromptSnapshot,
} from "@/lib/types"
import type { CategoryDecision as RecommendationEngineCategoryDecision } from "@/lib/recommendation-engine/types"
import type OpenAI from "openai"

export interface SynthesizeParams {
  userMessage: string
  conversationHistory: Message[]
  hairProfile: HairProfile | null
  ragChunks: ContentChunk[]
  products?: Product[]
  intent: IntentType
  productCategory?: ProductCategory
  maskDecision?: MaskDecision
  shampooDecision?: ShampooDecision
  conditionerDecision?: ConditionerDecision
  leaveInDecision?: LeaveInDecision
  oilDecision?: OilDecision
  categoryDecision?: RecommendationEngineCategoryDecision | null
  routinePlan?: RoutinePlan
  memoryContext?: string | null
  /** Slot-aware clarification questions from the router (replaces consultationMode) */
  clarificationQuestions?: string[]
  /** Follow-up questions for recommend_and_refine mode (products ARE shown alongside) */
  followupQuestions?: string[]
}

export interface SynthesisResult {
  stream: ReadableStream<Uint8Array>
  debug: {
    prompt: ChatPromptSnapshot
    prompt_build_ms: number
    stream_setup_ms: number
  }
}

function appendMemoryContext(profileText: string, memoryContext?: string | null): string {
  if (!memoryContext) return profileText
  return `${profileText}\n\nErinnerungen aus frueheren Gespraechen:\n${memoryContext}`
}

function appendFollowupQuestions(profileText: string, followupQuestions?: string[]): string {
  if (!followupQuestions || followupQuestions.length === 0) return profileText
  let result = profileText
  result +=
    "\n\n(HINWEIS: Gib eine erste Produktempfehlung basierend auf dem vorhandenen Kontext. Stelle dabei auch diese Rueckfragen, um die Empfehlung im naechsten Schritt zu verfeinern:"
  for (const q of followupQuestions) {
    result += `\n- ${q}`
  }
  result +=
    "\nFormuliere die Empfehlung als vorsichtige erste Einschaetzung, nicht als finale Antwort.)"
  return result
}

/**
 * Formats the user's hair profile into a human-readable German summary
 * for injection into the system prompt.
 */
function formatUserProfile(
  profile: HairProfile | null,
  clarificationQuestions?: string[],
  memoryContext?: string | null,
  followupQuestions?: string[],
): string {
  if (!profile) {
    return appendMemoryContext(
      "Kein Haarprofil vorhanden. Frage den Nutzer nach seinen Haardetails, wenn relevant.",
      memoryContext,
    )
  }

  const parts: string[] = []

  if (profile.hair_texture) {
    parts.push(`Haartyp: ${profile.hair_texture}`)
  }
  if (profile.thickness) {
    parts.push(`Haardicke: ${profile.thickness}`)
  }
  if (profile.density) {
    parts.push(`Haardichte: ${HAIR_DENSITY_LABELS[profile.density] ?? profile.density}`)
  }
  if (profile.concerns.length > 0) {
    parts.push(
      `Probleme/Bedenken: ${profile.concerns.map((c) => CONCERN_LABELS[c] ?? c).join(", ")}`,
    )
  }
  if (profile.goals.length > 0) {
    parts.push(`Ziele: ${profile.goals.map((g) => GOAL_LABELS[g] ?? g).join(", ")}`)
  }
  if ((profile.goals?.length ?? 0) === 0 && profile.desired_volume) {
    parts.push(
      `Gewuenschtes Volumen: ${DESIRED_VOLUME_LABELS[profile.desired_volume] ?? profile.desired_volume}`,
    )
  }
  if (profile.wash_frequency) {
    parts.push(
      `Waschfrequenz: ${WASH_FREQUENCY_LABELS[profile.wash_frequency] ?? profile.wash_frequency}`,
    )
  }
  if (profile.heat_styling) {
    parts.push(`Hitzestyling: ${HEAT_STYLING_LABELS[profile.heat_styling] ?? profile.heat_styling}`)
  }
  if (profile.styling_tools.length > 0) {
    parts.push(
      `Styling-Tools: ${profile.styling_tools.map((t) => STYLING_TOOL_LABELS[t] ?? t).join(", ")}`,
    )
  }
  if ((profile.post_wash_actions ?? []).length > 0) {
    parts.push(`Nach dem Waschen: ${(profile.post_wash_actions ?? []).join(", ")}`)
  }
  if ((profile.current_routine_products ?? []).length > 0) {
    parts.push(`Aktuelle Routine-Produkte: ${(profile.current_routine_products ?? []).join(", ")}`)
  }
  if (profile.cuticle_condition) {
    parts.push(
      `Kutikula-Zustand: ${CUTICLE_CONDITION_LABELS[profile.cuticle_condition] ?? profile.cuticle_condition}`,
    )
  }
  if (profile.protein_moisture_balance) {
    parts.push(`Protein-Feuchtigkeits-Balance: ${profile.protein_moisture_balance}`)
  }
  if (profile.scalp_type) {
    parts.push(`Kopfhaut-Typ: ${SCALP_TYPE_LABELS[profile.scalp_type] ?? profile.scalp_type}`)
  }
  if (profile.scalp_condition && profile.scalp_condition !== "none") {
    parts.push(
      `Kopfhaut-Beschwerden: ${SCALP_CONDITION_LABELS[profile.scalp_condition] ?? profile.scalp_condition}`,
    )
  }
  if (profile.chemical_treatment?.length > 0) {
    parts.push(
      `Chemische Behandlung: ${profile.chemical_treatment.map((t) => CHEMICAL_TREATMENT_LABELS[t] ?? t).join(", ")}`,
    )
  }
  if (profile.mechanical_stress_factors?.length > 0) {
    parts.push(
      `Mechanische Belastung: ${profile.mechanical_stress_factors.map((f) => MECHANICAL_STRESS_FACTOR_LABELS[f] ?? f).join(", ")}`,
    )
  }
  if (profile.towel_material) {
    parts.push(
      `Handtuch: ${TOWEL_MATERIAL_LABELS[profile.towel_material] ?? profile.towel_material}`,
    )
  }
  if (profile.towel_technique) {
    parts.push(
      `Trocknungstechnik: ${TOWEL_TECHNIQUE_LABELS[profile.towel_technique] ?? profile.towel_technique}`,
    )
  }
  if (profile.drying_method?.length > 0) {
    parts.push(
      `Trocknungsmethode: ${profile.drying_method.map((d) => DRYING_METHOD_LABELS[d] ?? d).join(", ")}`,
    )
  }
  if (profile.brush_type) {
    parts.push(`Bürste: ${BRUSH_TYPE_LABELS[profile.brush_type] ?? profile.brush_type}`)
  }
  if (profile.night_protection?.length > 0) {
    parts.push(
      `Nachtschutz: ${profile.night_protection.map((n) => NIGHT_PROTECTION_LABELS[n] ?? n).join(", ")}`,
    )
  }
  if (profile.uses_heat_protection) {
    parts.push("Verwendet Hitzeschutz: Ja")
  }
  if ((profile.current_routine_products ?? []).length === 0 && profile.products_used) {
    parts.push(`Aktuelle Produkte: ${profile.products_used}`)
  }
  if (profile.additional_notes) {
    parts.push(`Zusaetzliche Infos: ${profile.additional_notes}`)
  }

  let result =
    parts.length > 0
      ? parts.join("\n")
      : "Haarprofil angelegt, aber noch keine Details eingetragen."

  const effectiveMemory = memoryContext === undefined ? profile.conversation_memory : memoryContext
  if (effectiveMemory) {
    result = appendMemoryContext(result, effectiveMemory)
  }

  if (clarificationQuestions && clarificationQuestions.length > 0) {
    result +=
      "\n\n(HINWEIS: Stelle zuerst gezielte Rueckfragen, um die Situation zu verstehen. Nenne dabei KEINE konkreten Produktnamen — auch nicht die Produkte aus der Datenbank unten. Produktempfehlungen kommen erst, wenn du genug Kontext hast."
    result +=
      "\n\nStelle insbesondere diese Fragen (in deinem eigenen Stil, nicht woertlich kopieren):"
    for (const q of clarificationQuestions) {
      result += `\n- ${q}`
    }
    result += ")"
  }

  return appendFollowupQuestions(result, followupQuestions)
}

function formatShampooProfile(
  profile: HairProfile | null,
  clarificationQuestions?: string[],
  memoryContext?: string | null,
  followupQuestions?: string[],
): string {
  if (!profile) {
    return appendMemoryContext(
      "Kein Shampoo-Profil vorhanden. Frage nur nach Haardicke, Kopfhaut-Typ und Kopfhaut-Beschwerden.",
      memoryContext,
    )
  }

  const parts: string[] = []

  if (profile.thickness) {
    parts.push(`Haardicke: ${HAIR_THICKNESS_LABELS[profile.thickness] ?? profile.thickness}`)
  }
  if (profile.scalp_type) {
    parts.push(`Kopfhaut-Typ: ${SCALP_TYPE_LABELS[profile.scalp_type] ?? profile.scalp_type}`)
  }
  if (profile.scalp_condition) {
    const scalpConditionLabel =
      profile.scalp_condition === "none"
        ? "keine"
        : (SCALP_CONDITION_LABELS[profile.scalp_condition] ?? profile.scalp_condition)
    parts.push(`Kopfhaut-Beschwerden: ${scalpConditionLabel}`)
  }

  let result =
    parts.length > 0
      ? parts.join("\n")
      : "Shampoo-Profil angelegt, aber die drei Pflichtfelder fehlen noch."

  const effectiveMemory = memoryContext === undefined ? profile.conversation_memory : memoryContext
  if (effectiveMemory) {
    result = appendMemoryContext(result, effectiveMemory)
  }

  if (clarificationQuestions && clarificationQuestions.length > 0) {
    result +=
      "\n\n(HINWEIS: Shampoo-Klaerungsrunde. Stelle AUSSCHLIESSLICH Rueckfragen zu den fehlenden Shampoo-Feldern."
    result +=
      "\nNenne KEINE Produkte und stelle KEINE weiteren Fragen zu Routine, Zielen, Haarstruktur, Waschfrequenz oder anderen Produkten."
    if (clarificationQuestions.length === 1) {
      result += "\nStelle genau diese eine Rueckfrage:"
    } else {
      result += "\nStelle genau diese Rueckfragen:"
    }
    for (const q of clarificationQuestions) {
      result += `\n- ${q}`
    }
    result += ")"
  }

  return appendFollowupQuestions(result, followupQuestions)
}

/**
 * Formats the retrieved RAG chunks into a context string for the system prompt.
 * Includes a German source type label for each chunk.
 */
function formatRagContext(chunks: ContentChunk[]): string {
  if (chunks.length === 0) {
    return "Keine zusaetzlichen Informationen aus der Wissensbasis verfuegbar."
  }

  return chunks
    .map((chunk, i) => {
      const label = SOURCE_TYPE_LABELS[chunk.source_type] ?? chunk.source_type
      const source = chunk.source_name ? ` (${label} – ${chunk.source_name})` : ` (${label})`
      return `[${i + 1}]${source}:\n${chunk.content}`
    })
    .join("\n\n")
}

/** Category-specific product section headers */
const PRODUCT_SECTION_HEADERS: Record<string, string> = {
  shampoo: "Passende Shampoos aus unserer Datenbank",
  conditioner: "Passende Conditioner aus unserer Datenbank",
  mask: "Passende Masken aus unserer Datenbank",
  leave_in: "Passende Leave-ins aus unserer Datenbank",
  oil: "Passende Oele aus unserer Datenbank",
  bondbuilder: "Passende Bondbuilder aus unserer Datenbank",
  deep_cleansing_shampoo: "Passende Tiefenreinigungs-Shampoos aus unserer Datenbank",
  dry_shampoo: "Passende Trockenshampoos aus unserer Datenbank",
  peeling: "Passende Peelings aus unserer Datenbank",
}

const SUPPORT_CATEGORY_NOT_RECOMMENDED_LABELS: Partial<
  Record<Exclude<ProductCategory, null>, string>
> = {
  bondbuilder: "kein Bondbuilder",
  deep_cleansing_shampoo: "kein Tiefenreinigungs-Shampoo",
  dry_shampoo: "kein Trockenshampoo",
  peeling: "kein Peeling",
}

const MASK_STRENGTH_LABELS: Record<string, string> = {
  "1": "leicht",
  "2": "mittel",
  "3": "stark",
}

const MASK_TYPE_LABELS: Record<string, string> = {
  protein: "Protein",
  moisture: "Feuchtigkeit",
  performance: "Performance",
}

const CONDITIONER_BALANCE_LABELS = {
  moisture: "Feuchtigkeit",
  balanced: "ausgewogene Pflege",
  protein: "Protein",
} as const

const ROUTINE_ACTION_LABELS = {
  keep: "beibehalten",
  adjust: "anpassen",
  add: "erganzen",
  upgrade: "gezielt aufwerten",
  avoid: "gerade eher weniger geeignet",
} as const

const ENGINE_ACTION_LABELS = {
  add: "neu einfuehren",
  replace: "ersetzen",
  increase_frequency: "haeufiger nutzen",
  decrease_frequency: "seltener nutzen",
  keep: "beibehalten",
  remove: "entfernen",
  behavior_change_only: "vor allem ueber Verhalten loesen",
} as const

const ENGINE_BALANCE_LABELS = {
  moisture: "Feuchtigkeit",
  balanced: "ausgewogene Pflege",
  protein: "Protein",
} as const

const ENGINE_WEIGHT_LABELS = {
  light: "leicht",
  medium: "mittel",
  rich: "reichhaltig",
} as const

const ENGINE_REPAIR_LABELS = {
  low: "niedrig",
  medium: "mittel",
  high: "hoch",
} as const

const BOND_REPAIR_LABELS = {
  maintenance: "maintenance",
  intensive: "intensiv",
} as const

const BOND_APPLICATION_LABELS = {
  pre_shampoo: "vor dem Waschen",
  post_wash_leave_in: "nach der Waesche / Leave-in",
} as const

const PEELING_TYPE_LABELS = {
  acid_serum: "saeurebasiertes Peeling",
  physical_scrub: "mechanisches Peeling",
} as const

function formatEngineInventoryLine(
  decision: RecommendationEngineCategoryDecision,
  parts: string[],
): void {
  if (!decision.currentInventory) return

  const inventory = [
    decision.currentInventory.productName,
    decision.currentInventory.frequencyBand,
  ].filter(Boolean)

  if (inventory.length > 0) {
    parts.push(`- Aktuelle Routine: ${inventory.join(" | ")}`)
  }
}

function formatEngineCategoryDecision(
  categoryDecision?: RecommendationEngineCategoryDecision | null,
): string {
  if (!categoryDecision) return ""

  const parts = ["\n\nEngine-Entscheidung:"]
  parts.push(`- Kategorie: ${categoryDecision.category}`)
  parts.push(`- Relevant: ${categoryDecision.relevant ? "ja" : "nein"}`)

  if (categoryDecision.action) {
    parts.push(`- Aktion: ${ENGINE_ACTION_LABELS[categoryDecision.action]}`)
  }

  formatEngineInventoryLine(categoryDecision, parts)

  if (categoryDecision.planReasonCodes.length > 0) {
    parts.push(`- Grundsignale: ${categoryDecision.planReasonCodes.join(", ")}`)
  }

  if (categoryDecision.notes.length > 0) {
    parts.push(`- Hinweise: ${categoryDecision.notes.join(", ")}`)
  }

  switch (categoryDecision.category) {
    case "shampoo":
      if (categoryDecision.targetProfile?.shampooBucket) {
        parts.push(
          `- Haupt-Bucket: ${SHAMPOO_BUCKET_LABELS[categoryDecision.targetProfile.shampooBucket] ?? categoryDecision.targetProfile.shampooBucket}`,
        )
      }
      if (categoryDecision.targetProfile?.secondaryBucket) {
        parts.push(
          `- Sekundaer-Bucket: ${SHAMPOO_BUCKET_LABELS[categoryDecision.targetProfile.secondaryBucket] ?? categoryDecision.targetProfile.secondaryBucket}`,
        )
      }
      if (categoryDecision.targetProfile?.scalpRoute) {
        parts.push(`- Kopfhaut-Route: ${categoryDecision.targetProfile.scalpRoute}`)
      }
      break
    case "conditioner":
      if (categoryDecision.targetProfile?.balance) {
        parts.push(
          `- Pflegefokus: ${ENGINE_BALANCE_LABELS[categoryDecision.targetProfile.balance]}`,
        )
      }
      if (categoryDecision.targetProfile?.repairLevel) {
        parts.push(
          `- Repair-Level: ${ENGINE_REPAIR_LABELS[categoryDecision.targetProfile.repairLevel]}`,
        )
      }
      if (categoryDecision.targetProfile?.weight) {
        parts.push(`- Gewicht: ${ENGINE_WEIGHT_LABELS[categoryDecision.targetProfile.weight]}`)
      }
      break
    case "mask":
      if (categoryDecision.targetProfile?.balance) {
        parts.push(
          `- Pflegefokus: ${ENGINE_BALANCE_LABELS[categoryDecision.targetProfile.balance]}`,
        )
      }
      if (categoryDecision.targetProfile?.repairLevel) {
        parts.push(
          `- Repair-Level: ${ENGINE_REPAIR_LABELS[categoryDecision.targetProfile.repairLevel]}`,
        )
      }
      if (categoryDecision.targetProfile?.weight) {
        parts.push(`- Gewicht: ${ENGINE_WEIGHT_LABELS[categoryDecision.targetProfile.weight]}`)
      }
      parts.push(`- Masken-Staerke: ${categoryDecision.targetProfile?.needStrength ?? 0}`)
      break
    case "leave_in":
      if (categoryDecision.targetProfile?.needBucket) {
        parts.push(`- Pflegefokus: ${categoryDecision.targetProfile.needBucket}`)
      }
      if (categoryDecision.targetProfile?.stylingContext) {
        parts.push(`- Styling-Kontext: ${categoryDecision.targetProfile.stylingContext}`)
      }
      if (categoryDecision.targetProfile?.conditionerRelationship) {
        parts.push(`- Conditioner-Rolle: ${categoryDecision.targetProfile.conditionerRelationship}`)
      }
      if (categoryDecision.targetProfile?.weight) {
        parts.push(`- Gewicht: ${ENGINE_WEIGHT_LABELS[categoryDecision.targetProfile.weight]}`)
      }
      break
    case "oil":
      if (categoryDecision.targetProfile?.purpose) {
        parts.push(`- Oel-Zweck: ${OIL_USE_MODE_LABELS[categoryDecision.targetProfile.purpose]}`)
      }
      if (categoryDecision.targetProfile?.matcherSubtype) {
        parts.push(
          `- Oel-Typ: ${OIL_SUBTYPE_LABELS[categoryDecision.targetProfile.matcherSubtype]}`,
        )
      }
      parts.push(`- Klaerung noetig: ${categoryDecision.clarificationNeeded ? "ja" : "nein"}`)
      if (categoryDecision.noRecommendationReason) {
        parts.push(
          `- Kein Oel empfohlen: ${OIL_NO_RECOMMENDATION_LABELS[categoryDecision.noRecommendationReason]}`,
        )
      }
      break
    case "bondbuilder":
      if (categoryDecision.targetProfile?.bondRepairIntensity) {
        parts.push(
          `- Bond-Intensitaet: ${BOND_REPAIR_LABELS[categoryDecision.targetProfile.bondRepairIntensity]}`,
        )
      }
      if (categoryDecision.targetProfile?.applicationMode) {
        parts.push(
          `- Einsatzmodus: ${BOND_APPLICATION_LABELS[categoryDecision.targetProfile.applicationMode]}`,
        )
      }
      break
    case "deep_cleansing_shampoo":
      if (categoryDecision.targetProfile?.scalpTypeFocus) {
        parts.push(`- Kopfhaut-Fokus: ${categoryDecision.targetProfile.scalpTypeFocus}`)
      }
      parts.push(`- Reset-Bedarf: ${categoryDecision.targetProfile?.resetNeedLevel ?? "none"}`)
      break
    case "dry_shampoo":
      if (categoryDecision.targetProfile?.scalpTypeFocus) {
        parts.push(`- Kopfhaut-Fokus: ${categoryDecision.targetProfile.scalpTypeFocus}`)
      }
      break
    case "peeling":
      if (categoryDecision.targetProfile?.scalpTypeFocus) {
        parts.push(`- Kopfhaut-Fokus: ${categoryDecision.targetProfile.scalpTypeFocus}`)
      }
      if (categoryDecision.targetProfile?.peelingType) {
        parts.push(
          `- Peeling-Typ: ${PEELING_TYPE_LABELS[categoryDecision.targetProfile.peelingType]}`,
        )
      }
      break
  }

  return parts.join("\n")
}

function formatRoutinePlan(routinePlan?: RoutinePlan): string {
  if (!routinePlan) return ""

  const parts = ["\n\nRoutine-Plan:"]

  if (routinePlan.primary_focuses.length > 0) {
    parts.push(
      `- Hauptfokus: ${routinePlan.primary_focuses.map((focus) => focus.label).join(", ")}`,
    )
  }

  if (routinePlan.active_topics.length > 0) {
    parts.push(
      `- Aktive Themen: ${routinePlan.active_topics
        .map((topic) => `${topic.label} (${topic.reason})`)
        .join(" | ")}`,
    )
  }

  if (routinePlan.compare_cwc_owc) {
    parts.push(
      "- Vergleichsmodus: Erklaere CWC und OWC erst kurz gegeneinander und entscheide dich dann fuer die passendere Variante fuer dieses Profil.",
    )
  }

  const hasWashProtectionTechnique = routinePlan.sections
    .flatMap((section) => section.slots)
    .some((slot) => slot.topic_ids.includes("cwc") || slot.topic_ids.includes("owc"))

  parts.push(
    hasWashProtectionTechnique
      ? "- Niveau: Hohe Ebene fuer alle Slots; nur bei CWC/OWC sind kompakte nummerierte Wash-Day-Schritte erlaubt."
      : "- Niveau: Hohe Ebene, keine Detail-Anwendungsschritte.",
  )

  for (const section of routinePlan.sections) {
    parts.push(`\n${section.title}: ${section.summary}`)

    for (const slot of section.slots) {
      const summary = [`- ${slot.label}: ${ROUTINE_ACTION_LABELS[slot.action]}`]
      if (slot.cadence) {
        summary.push(`(${slot.cadence})`)
      }
      if (slot.category) {
        summary.push(`[Kategorie: ${slot.category}]`)
      }
      parts.push(summary.join(" "))

      if (slot.rationale.length > 0) {
        parts.push(`  Warum: ${slot.rationale.join(" | ")}`)
      }
      if (slot.caveats.length > 0) {
        parts.push(`  Caveat: ${slot.caveats.join(" | ")}`)
      }
      if ((slot.attached_products ?? []).length > 0) {
        parts.push(
          `  Angehaengte Produkte: ${(slot.attached_products ?? [])
            .map((product) => {
              const name = product.brand ? `${product.name} von ${product.brand}` : product.name
              const reasons = product.recommendation_meta?.top_reasons?.slice(0, 2).join(" | ")
              return reasons ? `${name} (${reasons})` : name
            })
            .join(" ; ")}`,
        )
      }
    }
  }

  parts.push(
    "\nWICHTIG: Folge dieser Struktur. Erklaere pro Slot erst die Routine-Logik und den Fit zum Profil. Nenne bereits angehaengte Produkte erst danach und nur direkt beim passenden Slot.",
  )

  return parts.join("\n")
}

/**
 * Formats matched products into a context block for the system prompt.
 */
function formatProducts(
  products: Product[],
  productCategory?: ProductCategory,
  categoryDecision?: RecommendationEngineCategoryDecision | null,
  clarificationQuestions?: string[],
): string {
  const categoryDecisionBlock = formatEngineCategoryDecision(categoryDecision)
  const supportCategoryNoRecommendationLabel =
    productCategory && categoryDecision?.category === productCategory && !categoryDecision.relevant
      ? SUPPORT_CATEGORY_NOT_RECOMMENDED_LABELS[productCategory]
      : null

  if (products.length === 0) {
    if (clarificationQuestions && clarificationQuestions.length > 0) {
      return `${categoryDecisionBlock}\n\nWICHTIG: Stelle nur die fehlenden Rueckfragen, nenne keine Produkte und behandle das nicht als Katalog-No-Match.`
    }

    if (
      productCategory === "mask" &&
      categoryDecision?.category === "mask" &&
      !categoryDecision.relevant
    ) {
      return `${categoryDecisionBlock}\n\nWICHTIG: Sage klar, dass aktuell keine Maske noetig ist. Nenne in diesem Fall KEINE konkreten Maskenprodukte.`
    }

    if (
      productCategory === "oil" &&
      categoryDecision?.category === "oil" &&
      categoryDecision.noRecommendationReason
    ) {
      return `${categoryDecisionBlock}\n\nWICHTIG: Sage klar, dass aktuell kein Oel empfohlen wird. Begruende das nur mit dem Engine-Entscheidungsblock. Nenne KEINE konkreten Oele und improvisiere keinen Therapie-Oel-Ersatz.`
    }

    if (supportCategoryNoRecommendationLabel) {
      return `${categoryDecisionBlock}\n\nWICHTIG: Sage klar, dass aktuell ${supportCategoryNoRecommendationLabel} empfohlen ist. Begruende das nur mit dem Engine-Entscheidungsblock. Nenne in diesem Fall KEINE konkreten Produkte und behandle das nicht als Katalog-No-Match.`
    }

    return `${categoryDecisionBlock}\n\nKeine passenden Produkte in der Datenbank gefunden. Nenne KEINE konkreten Produktnamen — sage dem Nutzer ehrlich, dass du gerade kein passendes Produkt parat hast, und bitte um genauere Angaben.`
  }

  const productList = products
    .map((p) => {
      const parts = [`- **${p.name}**`]
      if (p.brand) parts[0] += ` von ${p.brand}`
      if (p.short_description) parts.push(`  ${p.short_description}`)
      else if (p.description) parts.push(`  ${p.description}`)
      if (p.price_eur != null) parts.push(`  Preis: ${p.price_eur.toFixed(2)} EUR`)
      if ((p.tags ?? []).length > 0) parts.push(`  Tags: ${(p.tags ?? []).join(", ")}`)
      if (p.recommendation_meta) {
        const meta = p.recommendation_meta
        parts.push(`  Score: ${meta.score.toFixed(1)}`)

        if (meta.category === "mask") {
          const strengthLabel =
            MASK_STRENGTH_LABELS[String(meta.need_strength)] ?? String(meta.need_strength)
          const maskTypeLabel = MASK_TYPE_LABELS[meta.mask_type] ?? meta.mask_type
          parts.push(`  Staerke: ${strengthLabel}`)
          parts.push(`  Typ: ${maskTypeLabel}`)
        }

        if (meta.category === "shampoo") {
          const shampooRole = (p as unknown as Record<string, unknown>).shampoo_role as
            | string
            | undefined
          if (shampooRole === "treatment") {
            parts.push("  Rolle: Behandlungs-Shampoo (Anti-Schuppen)")
          } else if (shampooRole === "daily") {
            parts.push("  Rolle: Basis-Shampoo (Rotationstage)")
          }
          parts.push(
            `  Match-Profil: ${[
              meta.matched_profile.thickness,
              meta.matched_profile.scalp_type,
              meta.matched_profile.scalp_condition,
            ]
              .filter(Boolean)
              .join(" | ")}`,
          )
          if (meta.matched_bucket) {
            parts.push(
              `  Shampoo-Bucket: ${SHAMPOO_BUCKET_LABELS[meta.matched_bucket] ?? meta.matched_bucket}`,
            )
          }
          if (meta.matched_concern_code) {
            parts.push(`  Kopfhaut-Fokus: ${meta.matched_concern_code}`)
          }
        }

        if (meta.category === "conditioner") {
          parts.push(
            `  Match-Profil: ${[
              meta.matched_profile.thickness
                ? (HAIR_THICKNESS_LABELS[meta.matched_profile.thickness] ??
                  meta.matched_profile.thickness)
                : null,
              meta.matched_profile.density
                ? (HAIR_DENSITY_LABELS[meta.matched_profile.density] ??
                  meta.matched_profile.density)
                : null,
            ]
              .filter(Boolean)
              .join(" | ")}`,
          )
          if (meta.matched_balance_need) {
            parts.push(`  Pflegefokus: ${CONDITIONER_BALANCE_LABELS[meta.matched_balance_need]}`)
          }
          if (meta.matched_weight) {
            parts.push(`  Gewicht: ${CONDITIONER_WEIGHT_LABELS[meta.matched_weight]}`)
          }
          if (meta.matched_repair_level) {
            parts.push(
              `  Repair-Level: ${CONDITIONER_REPAIR_LEVEL_LABELS[meta.matched_repair_level]}`,
            )
          }
        }

        if (meta.category === "leave_in") {
          parts.push(
            `  Match-Profil: ${[
              meta.matched_profile.hair_texture
                ? (HAIR_TEXTURE_LABELS[meta.matched_profile.hair_texture] ??
                  meta.matched_profile.hair_texture)
                : null,
              meta.matched_profile.thickness
                ? (HAIR_THICKNESS_LABELS[meta.matched_profile.thickness] ??
                  meta.matched_profile.thickness)
                : null,
              meta.matched_profile.density
                ? (HAIR_DENSITY_LABELS[meta.matched_profile.density] ??
                  meta.matched_profile.density)
                : null,
            ]
              .filter(Boolean)
              .join(" | ")}`,
          )
          if (meta.need_bucket) {
            parts.push(`  Pflegefokus: ${LEAVE_IN_NEED_BUCKET_LABELS[meta.need_bucket]}`)
          }
          if (meta.styling_context) {
            parts.push(
              `  Styling-Kontext: ${LEAVE_IN_STYLING_CONTEXT_LABELS[meta.styling_context]}`,
            )
          }
          if (meta.conditioner_relationship) {
            parts.push(
              `  Conditioner-Rolle: ${LEAVE_IN_CONDITIONER_RELATIONSHIP_LABELS[meta.conditioner_relationship]}`,
            )
          }
          if (meta.matched_weight) {
            parts.push(`  Gewicht: ${LEAVE_IN_WEIGHT_LABELS[meta.matched_weight]}`)
          }
        }

        if (meta.category === "oil") {
          parts.push(
            `  Match-Profil: ${[
              meta.matched_profile.thickness
                ? (HAIR_THICKNESS_LABELS[meta.matched_profile.thickness] ??
                  meta.matched_profile.thickness)
                : null,
            ]
              .filter(Boolean)
              .join(" | ")}`,
          )
          if (meta.matched_subtype) {
            parts.push(`  Oel-Typ: ${OIL_SUBTYPE_LABELS[meta.matched_subtype]}`)
          }
          if (meta.use_mode) {
            parts.push(`  Anwendung: ${OIL_USE_MODE_LABELS[meta.use_mode]}`)
          }
          if (meta.adjunct_scalp_support) {
            parts.push("  Kopfhaut-Hinweis: nur als unterstuetzende Zusatzpflege")
          }
        }

        if (meta.top_reasons.length > 0) {
          parts.push(`  Warum passend: ${meta.top_reasons.join(" | ")}`)
        }
        if (meta.tradeoffs.length > 0) {
          parts.push(`  Trade-offs: ${meta.tradeoffs.join(" | ")}`)
        }
        if (meta.usage_hint) {
          parts.push(`  Anwendung: ${meta.usage_hint}`)
        }
      }
      return parts.join("\n")
    })
    .join("\n")

  const header =
    (productCategory && PRODUCT_SECTION_HEADERS[productCategory]) ??
    "Passende Produkte aus unserer Datenbank"

  return `${categoryDecisionBlock}\n\n${header}:\n${productList}\n\nWICHTIG: Verwende die EXAKTEN Produktnamen (wie oben geschrieben) wenn du sie erwaehst — die Namen werden in der App als klickbare Links dargestellt.`
}

/** Category-specific reasoning instructions injected into the system prompt */
const CATEGORY_REASONING_PROMPTS: Record<string, string> = {
  shampoo: `

## Shampoo-Empfehlungen:
Wenn du Shampoo-Empfehlungen gibst:
1. Nutze fuer die Shampoo-Begruendung NUR diese Signale: Haardicke, Kopfhaut-Typ, Kopfhaut-Beschwerden, den abgeleiteten Shampoo-Bucket und den Shampoo-Entscheidungsblock.
2. Wenn im Shampoo-Entscheidungsblock Profilfelder fehlen, frage EXAKT nur nach diesen fehlenden Shampoo-Feldern und nenne keine Produkte.
3. Wenn der Shampoo-Entscheidungsblock sagt, dass es keinen exakten Katalog-Match gibt, sage das klar und nenne keine ausweichenden Shampoo-Produkte aus anderen Kopfhaut-Buckets.
4. Wenn Kopfhaut-Beschwerden vorliegen, erklaere klar, dass dieser aktuelle Zustand den Shampoo-Bucket voruebergehend priorisiert. Wenn keine Beschwerden vorliegen, richte den Bucket am Kopfhaut-Typ aus.
5. Erklaere ZUERST, welche Shampoo-Eigenschaften ideal fuer dieses Nutzerprofil sind. Empfehle DANN konkrete Produkte und erklaere WARUM jedes Produkt zu genau diesem Profil passt.
6. Begruende Shampoo-Fit NICHT mit Haarstruktur, Zielen, chemischer Behandlung, Waschfrequenz oder anderen Randprofilen.
7. Wenn die Kopfhaut-Beschwerden "trockene Schuppen" sind, sage kurz, dass wir hier den trockenen Shampoo-Bucket nutzen. Ergaenze: "Wenn die Schueppchen nach 4-6 Wochen nicht besser werden, empfehlen wir einen Dermatologen aufzusuchen."
8. Erwaehne Haarmuster wie glatt, wellig, lockig oder coily NICHT als Shampoo-Fit-Signal, auch wenn diese Infos im Nutzerprofil stehen.
9. Wenn ZWEI Shampoo-Buckets empfohlen werden (Behandlung + Basis), erklaere die Rotation: Anti-Schuppen-Shampoo 2-3x pro Woche, an den anderen Waschtagen das Basis-Shampoo. Betone, dass Seborrhoische Dermatitis chronisch ist und das Anti-Schuppen-Shampoo langfristig als Erhaltung (1-2x/Woche) noetig bleiben kann.`,
  conditioner: `

## Conditioner-Empfehlungen:
Wenn du Conditioner-Empfehlungen gibst:
1. Nutze fuer die Conditioner-Begruendung NUR den Conditioner-Entscheidungsblock und die Produkt-Metadaten.
2. Wenn im Conditioner-Entscheidungsblock Profilfelder fehlen, frage NUR nach diesen fehlenden Conditioner-Feldern und nenne keine Produkte.
3. Wenn der Conditioner-Entscheidungsblock sagt, dass es keinen exakten Katalog-Match gibt, sage das klar und nenne keine ausweichenden Conditioner-Produkte aus anderen Protein-/Feuchtigkeits-Buckets.
4. Erklaere ZUERST, was das Haar laut Zugtest gerade braucht: Protein, Feuchtigkeit oder ausgewogene Pflege.
5. Beziehe DANN das erwartete Gewicht und den Reparaturbedarf ein. Erklaere, ob der Conditioner eher leicht, mittel oder reichhaltig sein sollte und wie viel Repair-Level sinnvoll ist.
6. Empfehle DANN konkrete Produkte und erklaere WARUM jedes Produkt sowohl zum Pflegefokus als auch zu Gewicht und Repair-Level passt.`,
  leave_in: `

## Leave-in-Empfehlungen:
Wenn du Leave-in-Empfehlungen gibst:
1. Nutze fuer Leave-in-Begruendungen NUR den Leave-in-Entscheidungsblock und die Produkt-Metadaten.
2. Wenn im Leave-in-Entscheidungsblock Profilfelder fehlen, frage NUR nach diesen fehlenden Leave-in-Feldern und nenne keine Produkte.
3. Wenn der Leave-in-Entscheidungsblock sagt, dass es keinen exakten Katalog-Match gibt, sage das klar und nenne keine ausweichenden Leave-ins aus anderen Buckets.
4. Erklaere zuerst, was das Leave-in leisten soll: Pflegefokus, Styling-Kontext und erwartetes Gewicht.
5. Unterscheide IMMER sauber zwischen "Conditioner-Ersatz moeglich" und "nur zusaetzlicher Booster". Sage bei Booster-Profilen niemals, dass das Leave-in den Conditioner ersetzt.
6. Empfehle dann konkrete Produkte und erklaere WARUM jedes Produkt genau zu Pflegefokus, Styling-Kontext und Conditioner-Rolle passt.`,
  oil: `

## Oel-Empfehlungen:
Wenn du Oel-Empfehlungen gibst:
1. Nutze fuer Oel-Begruendungen NUR den Oel-Entscheidungsblock und die Produkt-Metadaten.
2. Wenn im Oel-Entscheidungsblock Profilfelder fehlen, frage NUR nach Haardicke und Oel-Zweck. Nenne keine Produkte.
3. Wenn der Oel-Entscheidungsblock sagt, dass aktuell kein Oel empfohlen wird, sage das klar und nenne keine ausweichenden Oele oder DIY-Mischungen.
4. Wenn der Oel-Entscheidungsblock sagt, dass es keinen exakten Katalog-Match gibt, sage das klar und nenne keine Oele aus anderen Oel-Typen oder anderen Haardicken.
5. Erklaere zuerst, welche Art Oel hier gemeint ist: Hair Oiling vor dem Waschen, Styling-Finish oder leichtes Trocken-Oel.
6. Begruende den Fit danach nur ueber Oel-Typ, Haardicke und die Anwendungslogik aus den Metadaten.
7. Wenn Kopfhautthemen mitlaufen, ordne natuerliche Oele nur als unterstuetzende Zusatzpflege ein. Stelle sie NICHT als primaeren Behandlungsweg fuer Schuppen, gereizte Kopfhaut oder Haarwachstum dar.
8. Wenn der Nutzer gezielt ein Therapie-Oel oder eine spezifische Oelmischung sucht und diese nicht im Katalog ist, sage das ehrlich statt einen Ersatz zu erfinden.`,
  routine: `

## Routine-Antworten:
Wenn ein Routine-Plan vorhanden ist:
1. Nutze den Routine-Plan als primaeren Rahmen der Antwort.
2. Bleibe bewusst auf hoher Ebene: Kombinationen, Frequenz, Rollen der Schritte und das Warum dahinter. Ausnahme: Bei aktiven CWC/OWC-Slots darfst du die kompakten nummerierten Wash-Day-Schritte aus dem Routine-Plan uebernehmen.
3. Erklaere die Slots gemaess ihrer Aktion: keep = bestaetigen, adjust = Frequenz/Fokus anpassen, add = neu einfuehren, upgrade = gleicher Slot aber gezielterer Fokus, avoid = fuer jetzt eher nicht priorisieren.
4. Starte mit den Bausteinen, die schon gut sitzen oder nur leicht angepasst werden sollten. Erklaere danach, was fehlt oder gezielter werden darf.
5. Begruende pro relevantem Slot erst kurz den Fit zum Profil, also ueber Haarmuster, Ziele, Probleme oder Routinekontext, bevor du ein Produkt nennst.
6. Wenn Produkte angehaengt sind, nenne nur diese Produkte und ordne sie direkt dem gerade erklaerten Slot im selben Absatz oder Bullet zu.
7. Wenn keine Produkte angehaengt sind, bleibe bei Kategorien und Routine-Logik statt konkrete Produkte zu improvisieren.
8. Erfinde keine zusaetzlichen Kategorien, Schritte oder Produkttypen ausserhalb des Routine-Plans.
9. Detaillierte Anwendungstechniken gehoeren NICHT in diese Antwort, ausser die kompakten nummerierten CWC/OWC-Schritte stehen bereits im Routine-Plan.
10. Bei Kopfhautthemen bleibe konservativ und nicht-medizinisch.
11. Wenn Bond Builder relevant ist: Olaplex No. 0+3, K18 Molecular Repair Leave-in und Epres gehoeren zu den wenigen Produkten mit nachgewiesener Bond-Technologie. Viele Produkte mit "Bond" im Namen pflegen nur die Oberflaeche, reparieren aber nicht die innere Haarstruktur. Das sind Technologie-Beispiele, keine Produktempfehlungen.
12. Nenne bei Bond Builder den Unterschied zwischen Laengs- und Querverbindungen nur, wenn der Routine-Plan das vorgibt. Erfinde keine eigene K18-vs-Olaplex-Logik.
13. Wenn Tiefenreinigung aktiv ist, unterscheide sauber zwischen Kopfhaut-Tiefenreinigung, Haar-Reset und Hard Reset. Erklaere nur die Slots, die im Routine-Plan wirklich aktiv sind.
14. Stelle Tiefenreinigung nie als universellen Pflichtschritt, taegliche Empfehlung oder "Detox fuer alle" dar. Sie ist immer bedarfsgetrieben.
15. Wenn Tiefenreinigung fuer die Laengen aktiv ist, erwaehne die Anschluss-Pflege klar: danach Conditioner oder Maske.
16. Bei Schuppen, deutlichem Juckreiz oder gereizter Kopfhaut bleibe extra konservativ und rahme Tiefenreinigung nicht als primaeren Loesungsweg; erfinde keine medizinischen Aussagen.
17. Nenne keine DIY-Scrubs, Zucker-/Salz-Mischungen oder vereinfachte Heuristiken wie "klar = tiefenreinigend", "mehr Tenside = besser" oder "Sulfate = automatisch richtig".
18. Wenn trockene Kopfhaut als Gegenpol erwaehnt wird, ordne Hair Oiling hoechstens als sanfte Zusatzpflege ein - nie als eigentlichen Reinigungsweg.
19. Wenn der Routine-Plan Vergleichsmodus fuer CWC/OWC signalisiert, erklaere erst kurz den Unterschied beider Methoden, waehle dann die passendere Option fuer dieses Profil und fuehre nur mit dieser Variante weiter.
20. Wenn Buersten & Tools relevant sind, bleibe bei Funktionslogik und Sicherheitsregeln: Slip beim Entwirren, von unten nach oben arbeiten, sanfter Druck auf der Kopfhaut und keine improvisierten Marken- oder Tool-Empfehlungen.`,
  mask: `

## Masken-Empfehlungen:
Wenn du Masken-Empfehlungen gibst:
1. Behandle Masken als Zusatzpflege, nicht als Conditioner-Ersatz.
2. Betone Anwendung auf Laengen/Spitzen (nicht Kopfhaut).
3. Erklaere klar die Reihenfolge: Shampoo -> Maske -> Conditioner.
4. Nutze den "Masken-Entscheidung", "Staerke", "Typ" und "Anwendung"-Kontext aktiv.
5. Wenn die Masken-Entscheidung sagt, dass aktuell keine Maske noetig ist, sage das klar und nenne keine Maskenprodukte.
6. Sage niemals, dass Masken Schaeden "vorbeugen" oder "verhindern". Masken pflegen und erhalten den aktuellen Zustand — sie schuetzen nicht praeventiv vor zukuenftigen Schaeden.`,
}

/**
 * Builds the complete system prompt by replacing placeholders with actual data.
 */
export function buildSystemPrompt(
  hairProfile: HairProfile | null,
  ragChunks: ContentChunk[],
  products?: Product[],
  productCategory?: ProductCategory,
  maskDecision?: MaskDecision,
  shampooDecision?: ShampooDecision,
  conditionerDecision?: ConditionerDecision,
  leaveInDecision?: LeaveInDecision,
  oilDecision?: OilDecision,
  routinePlan?: RoutinePlan,
  memoryContext?: string | null,
  clarificationQuestions?: string[],
  basePromptTemplate = SYSTEM_PROMPT,
  followupQuestions?: string[],
  categoryDecision?: RecommendationEngineCategoryDecision | null,
): string {
  let prompt = basePromptTemplate

  // Inject category-specific reasoning instructions
  if (productCategory && CATEGORY_REASONING_PROMPTS[productCategory]) {
    prompt += CATEGORY_REASONING_PROMPTS[productCategory]
  }

  const userProfileContext =
    productCategory === "shampoo"
      ? formatShampooProfile(hairProfile, clarificationQuestions, memoryContext, followupQuestions)
      : formatUserProfile(hairProfile, clarificationQuestions, memoryContext, followupQuestions)

  prompt = prompt.replace("{{USER_PROFILE}}", userProfileContext)

  let ragContext = formatRagContext(ragChunks)
  if (routinePlan) {
    ragContext += formatRoutinePlan(routinePlan)
  }
  if (
    (products ||
      categoryDecision ||
      maskDecision ||
      shampooDecision ||
      conditionerDecision ||
      leaveInDecision ||
      oilDecision) &&
    !(productCategory === "routine" && routinePlan)
  ) {
    ragContext += formatProducts(
      products ?? [],
      productCategory,
      categoryDecision,
      clarificationQuestions,
    )
  }
  prompt = prompt.replace("{{RAG_CONTEXT}}", ragContext)

  return prompt
}

/**
 * Synthesizes a streaming response by assembling the full prompt (system prompt
 * with replaced placeholders, conversation history, and user message) and calling
 * the streaming chat completion API.
 *
 * @param params - All inputs needed to build the prompt and generate a response
 * @returns A ReadableStream of text deltas from the model
 */
export async function synthesizeResponse(params: SynthesizeParams): Promise<SynthesisResult> {
  const {
    userMessage,
    conversationHistory,
    hairProfile,
    ragChunks,
    products,
    productCategory,
    maskDecision,
    shampooDecision,
    conditionerDecision,
    leaveInDecision,
    oilDecision,
    categoryDecision,
    routinePlan,
    memoryContext,
    clarificationQuestions,
    followupQuestions,
  } = params

  const promptBuildStart = performance.now()
  const managedPrompt = await getManagedTextPromptTemplate(LANGFUSE_PROMPTS.chatSystem)
  const systemPrompt = buildSystemPrompt(
    hairProfile,
    ragChunks,
    products,
    productCategory,
    maskDecision,
    shampooDecision,
    conditionerDecision,
    leaveInDecision,
    oilDecision,
    routinePlan,
    memoryContext,
    clarificationQuestions,
    managedPrompt.template,
    followupQuestions,
    categoryDecision,
  )

  // Build the messages array for the API call
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
  ]

  // Add the last 10 messages from conversation history for context
  const recentHistory = conversationHistory.slice(-10)
  for (const msg of recentHistory) {
    if (msg.role === "user" || msg.role === "assistant") {
      messages.push({
        role: msg.role,
        content: msg.content ?? "",
      })
    }
  }

  // Add the current user message
  messages.push({ role: "user", content: userMessage })

  const promptMessages: ChatPromptMessageSnapshot[] = messages
    .filter(
      (
        msg,
      ): msg is OpenAI.Chat.Completions.ChatCompletionMessageParam & {
        role: "system" | "user" | "assistant"
        content: string
      } =>
        (msg.role === "system" || msg.role === "user" || msg.role === "assistant") &&
        typeof msg.content === "string",
    )
    .map((msg) => ({
      role: msg.role,
      content: msg.content,
    }))

  const promptBuildMs = Math.round(performance.now() - promptBuildStart)
  const streamSetupStart = performance.now()
  const stream = await streamChatCompletion({
    messages,
    model: DEFAULT_CHAT_COMPLETION_MODEL,
    temperature: DEFAULT_CHAT_COMPLETION_TEMPERATURE,
    langfuseConfig: {
      generationName: "chat-response-generation",
      generationMetadata: {
        environment: getLangfuseEnvironment(),
        prompt_label: managedPrompt.ref.label,
        prompt_is_fallback: String(managedPrompt.ref.is_fallback),
      },
      langfusePrompt: buildLangfusePromptConfig(managedPrompt.ref),
    },
  })
  const streamSetupMs = Math.round(performance.now() - streamSetupStart)

  return {
    stream,
    debug: {
      prompt: {
        model: DEFAULT_CHAT_COMPLETION_MODEL,
        temperature: DEFAULT_CHAT_COMPLETION_TEMPERATURE,
        prompt_ref: managedPrompt.ref,
        system_prompt: systemPrompt,
        messages: promptMessages,
      },
      prompt_build_ms: promptBuildMs,
      stream_setup_ms: streamSetupMs,
    },
  }
}
