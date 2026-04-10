import {
  DEFAULT_CHAT_COMPLETION_MODEL,
  DEFAULT_CHAT_COMPLETION_TEMPERATURE,
  streamChatCompletion,
} from "@/lib/openai/chat"
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
  PROTEIN_MOISTURE_LABELS,
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
  routinePlan?: RoutinePlan
  memoryContext?: string | null
  /** Slot-aware clarification questions from the router (replaces consultationMode) */
  clarificationQuestions?: string[]
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

/**
 * Formats the user's hair profile into a human-readable German summary
 * for injection into the system prompt.
 */
function formatUserProfile(
  profile: HairProfile | null,
  clarificationQuestions?: string[],
  memoryContext?: string | null,
): string {
  if (!profile) {
    return appendMemoryContext(
      "Kein Haarprofil vorhanden. Frage den Nutzer nach seinen Haardetails, wenn relevant.",
      memoryContext
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
    parts.push(`Probleme/Bedenken: ${profile.concerns.map((c) => CONCERN_LABELS[c] ?? c).join(", ")}`)
  }
  if (profile.goals.length > 0) {
    parts.push(`Ziele: ${profile.goals.map((g) => GOAL_LABELS[g] ?? g).join(", ")}`)
  }
  if (profile.desired_volume) {
    parts.push(`Gewuenschtes Volumen: ${DESIRED_VOLUME_LABELS[profile.desired_volume] ?? profile.desired_volume}`)
  }
  if (profile.wash_frequency) {
    parts.push(`Waschfrequenz: ${WASH_FREQUENCY_LABELS[profile.wash_frequency] ?? profile.wash_frequency}`)
  }
  if (profile.heat_styling) {
    parts.push(`Hitzestyling: ${HEAT_STYLING_LABELS[profile.heat_styling] ?? profile.heat_styling}`)
  }
  if (profile.styling_tools.length > 0) {
    parts.push(`Styling-Tools: ${profile.styling_tools.map((t) => STYLING_TOOL_LABELS[t] ?? t).join(", ")}`)
  }
  if ((profile.post_wash_actions ?? []).length > 0) {
    parts.push(`Nach dem Waschen: ${(profile.post_wash_actions ?? []).join(", ")}`)
  }
  if ((profile.current_routine_products ?? []).length > 0) {
    parts.push(`Aktuelle Routine-Produkte: ${(profile.current_routine_products ?? []).join(", ")}`)
  }
  if (profile.cuticle_condition) {
    parts.push(`Kutikula-Zustand: ${CUTICLE_CONDITION_LABELS[profile.cuticle_condition] ?? profile.cuticle_condition}`)
  }
  if (profile.protein_moisture_balance) {
    parts.push(`Protein-Feuchtigkeits-Balance: ${profile.protein_moisture_balance}`)
  }
  if (profile.scalp_type) {
    parts.push(`Kopfhaut-Typ: ${SCALP_TYPE_LABELS[profile.scalp_type] ?? profile.scalp_type}`)
  }
  if (profile.scalp_condition && profile.scalp_condition !== "none") {
    parts.push(`Kopfhaut-Beschwerden: ${SCALP_CONDITION_LABELS[profile.scalp_condition] ?? profile.scalp_condition}`)
  }
  if (profile.chemical_treatment?.length > 0) {
    parts.push(`Chemische Behandlung: ${profile.chemical_treatment.map((t) => CHEMICAL_TREATMENT_LABELS[t] ?? t).join(", ")}`)
  }
  if (profile.mechanical_stress_factors?.length > 0) {
    parts.push(`Mechanische Belastung: ${profile.mechanical_stress_factors.map((f) => MECHANICAL_STRESS_FACTOR_LABELS[f] ?? f).join(", ")}`)
  }
  if (profile.towel_material) {
    parts.push(`Handtuch: ${TOWEL_MATERIAL_LABELS[profile.towel_material] ?? profile.towel_material}`)
  }
  if (profile.towel_technique) {
    parts.push(`Trocknungstechnik: ${TOWEL_TECHNIQUE_LABELS[profile.towel_technique] ?? profile.towel_technique}`)
  }
  if (profile.drying_method?.length > 0) {
    parts.push(`Trocknungsmethode: ${profile.drying_method.map((d) => DRYING_METHOD_LABELS[d] ?? d).join(", ")}`)
  }
  if (profile.brush_type) {
    parts.push(`Bürste: ${BRUSH_TYPE_LABELS[profile.brush_type] ?? profile.brush_type}`)
  }
  if (profile.night_protection?.length > 0) {
    parts.push(`Nachtschutz: ${profile.night_protection.map((n) => NIGHT_PROTECTION_LABELS[n] ?? n).join(", ")}`)
  }
  if (profile.uses_heat_protection) {
    parts.push("Verwendet Hitzeschutz: Ja")
  }
  if (profile.products_used) {
    parts.push(`Aktuelle Produkte: ${profile.products_used}`)
  }
  if (profile.additional_notes) {
    parts.push(`Zusaetzliche Infos: ${profile.additional_notes}`)
  }

  let result = parts.length > 0
    ? parts.join("\n")
    : "Haarprofil angelegt, aber noch keine Details eingetragen."

  const effectiveMemory =
    memoryContext === undefined ? profile.conversation_memory : memoryContext
  if (effectiveMemory) {
    result = appendMemoryContext(result, effectiveMemory)
  }

  if (clarificationQuestions && clarificationQuestions.length > 0) {
    result += "\n\n(HINWEIS: Stelle zuerst gezielte Rueckfragen, um die Situation zu verstehen. Nenne dabei KEINE konkreten Produktnamen — auch nicht die Produkte aus der Datenbank unten. Produktempfehlungen kommen erst, wenn du genug Kontext hast."
    result += "\n\nStelle insbesondere diese Fragen (in deinem eigenen Stil, nicht woertlich kopieren):"
    for (const q of clarificationQuestions) {
      result += `\n- ${q}`
    }
    result += ")"
  }

  return result
}

function formatShampooProfile(
  profile: HairProfile | null,
  clarificationQuestions?: string[],
  memoryContext?: string | null,
): string {
  if (!profile) {
    return appendMemoryContext(
      "Kein Shampoo-Profil vorhanden. Frage nur nach Haardicke, Kopfhaut-Typ und Kopfhaut-Beschwerden.",
      memoryContext
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

  let result = parts.length > 0
    ? parts.join("\n")
    : "Shampoo-Profil angelegt, aber die drei Pflichtfelder fehlen noch."

  const effectiveMemory =
    memoryContext === undefined ? profile.conversation_memory : memoryContext
  if (effectiveMemory) {
    result = appendMemoryContext(result, effectiveMemory)
  }

  if (clarificationQuestions && clarificationQuestions.length > 0) {
    result += "\n\n(HINWEIS: Shampoo-Klaerungsrunde. Stelle AUSSCHLIESSLICH Rueckfragen zu den fehlenden Shampoo-Feldern."
    result += "\nNenne KEINE Produkte und stelle KEINE weiteren Fragen zu Routine, Zielen, Haarstruktur, Waschfrequenz oder anderen Produkten."
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

  return result
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
      const source = chunk.source_name
        ? ` (${label} – ${chunk.source_name})`
        : ` (${label})`
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

const MASK_SIGNAL_LABELS: Record<string, string> = {
  chemical_treatment: "chemische Behandlung",
  heat_styling: "regelmaessiges Hitzestyling",
  protein_moisture_balance: "Protein-/Feuchtigkeits-Balance",
  mechanical_stress: "mechanische Belastung",
}

function formatMaskDecision(maskDecision?: MaskDecision): string {
  if (!maskDecision) return ""

  const parts = ["\n\nMasken-Entscheidung:"]
  parts.push(`- Maske noetig: ${maskDecision.needs_mask ? "ja" : "nein"}`)

  if (maskDecision.needs_mask) {
    if (maskDecision.need_strength > 0) {
      const strengthLabel = MASK_STRENGTH_LABELS[String(maskDecision.need_strength)] ?? String(maskDecision.need_strength)
      parts.push(`- Staerke: ${strengthLabel}`)
    }
    if (maskDecision.mask_type) {
      const maskTypeLabel = MASK_TYPE_LABELS[maskDecision.mask_type] ?? maskDecision.mask_type
      parts.push(`- Maskentyp: ${maskTypeLabel}`)
    }
  } else {
    parts.push("- Hinweis: Basierend auf deinem Profil brauchst du aktuell keine Maske.")
  }

  if (maskDecision.active_signals.length > 0) {
    parts.push(
      `- Aktive Signale: ${maskDecision.active_signals
        .map((signal) => MASK_SIGNAL_LABELS[signal] ?? signal)
        .join(", ")}`
    )
  }

  return parts.join("\n")
}

const SHAMPOO_FIELD_LABELS: Record<string, string> = {
  thickness: "Haardicke",
  scalp_type: "Kopfhaut-Typ",
  scalp_condition: "Kopfhaut-Beschwerden",
}

function formatShampooDecision(shampooDecision?: ShampooDecision): string {
  if (!shampooDecision) return ""

  const parts = ["\n\nShampoo-Entscheidung:"]
  parts.push(`- Profil ausreichend: ${shampooDecision.eligible ? "ja" : "nein"}`)

  if (shampooDecision.matched_profile.thickness) {
    parts.push(`- Haardicke: ${HAIR_THICKNESS_LABELS[shampooDecision.matched_profile.thickness] ?? shampooDecision.matched_profile.thickness}`)
  }
  if (shampooDecision.matched_profile.scalp_type) {
    parts.push(`- Kopfhaut-Typ: ${SCALP_TYPE_LABELS[shampooDecision.matched_profile.scalp_type] ?? shampooDecision.matched_profile.scalp_type}`)
  }
  if (shampooDecision.matched_profile.scalp_condition) {
    parts.push(`- Kopfhaut-Beschwerden: ${SCALP_CONDITION_LABELS[shampooDecision.matched_profile.scalp_condition] ?? shampooDecision.matched_profile.scalp_condition}`)
  }
  if (shampooDecision.matched_bucket) {
    parts.push(`- Shampoo-Bucket: ${SHAMPOO_BUCKET_LABELS[shampooDecision.matched_bucket] ?? shampooDecision.matched_bucket}`)
  }
  if (shampooDecision.matched_concern_code) {
    parts.push(`- Wissensbasis-Fokus: ${shampooDecision.matched_concern_code}`)
  }
  if (shampooDecision.secondary_bucket) {
    parts.push(`- Basis-Shampoo-Bucket (Rotation): ${SHAMPOO_BUCKET_LABELS[shampooDecision.secondary_bucket] ?? shampooDecision.secondary_bucket}`)
  }
  if (shampooDecision.matched_profile.scalp_condition === "dry_flakes") {
    parts.push(
      "- Hinweis: Trockene Schuppen ordnen wir dem trockenen Shampoo-Bucket zu. Wenn die Schueppchen nach 4-6 Wochen nicht besser werden, empfehlen wir einen Dermatologen aufzusuchen."
    )
  }

  if (!shampooDecision.eligible) {
    parts.push(
      `- Fehlende Felder: ${shampooDecision.missing_profile_fields
        .map((field) => SHAMPOO_FIELD_LABELS[field] ?? field)
        .join(", ")}`
    )
  } else if (shampooDecision.no_catalog_match) {
    parts.push("- Katalogstatus: kein exakter Shampoo-Match fuer dieses Profil vorhanden")
  } else {
    parts.push(`- Exakte Shampoo-Kandidaten: ${shampooDecision.candidate_count}`)
  }

  return parts.join("\n")
}

const CONDITIONER_FIELD_LABELS: Record<string, string> = {
  thickness: "Haardicke",
  protein_moisture_balance: "Zugtest",
}

const CONDITIONER_BALANCE_LABELS = {
  moisture: "Feuchtigkeit",
  balanced: "ausgewogene Pflege",
  protein: "Protein",
} as const

const LEAVE_IN_FIELD_LABELS: Record<string, string> = {
  hair_texture: "Haarmuster",
  thickness: "Haardicke",
  density: "Haardichte",
  care_signal: "Pflegefokus",
  styling_signal: "Styling-Kontext",
}

const OIL_FIELD_LABELS: Record<string, string> = {
  thickness: "Haardicke",
  oil_purpose: "Oel-Zweck",
}

const ROUTINE_ACTION_LABELS = {
  keep: "beibehalten",
  adjust: "anpassen",
  add: "erganzen",
  upgrade: "gezielt aufwerten",
  avoid: "gerade eher weniger geeignet",
} as const

function formatConditionerDecision(conditionerDecision?: ConditionerDecision): string {
  if (!conditionerDecision) return ""

  const parts = ["\n\nConditioner-Entscheidung:"]
  parts.push(`- Profil ausreichend: ${conditionerDecision.eligible ? "ja" : "nein"}`)

  if (conditionerDecision.matched_profile.thickness) {
    parts.push(`- Haardicke: ${HAIR_THICKNESS_LABELS[conditionerDecision.matched_profile.thickness] ?? conditionerDecision.matched_profile.thickness}`)
  }
  if (conditionerDecision.matched_profile.density) {
    parts.push(`- Haardichte: ${HAIR_DENSITY_LABELS[conditionerDecision.matched_profile.density] ?? conditionerDecision.matched_profile.density}`)
  }
  if (conditionerDecision.matched_profile.protein_moisture_balance) {
    parts.push(`- Zugtest: ${PROTEIN_MOISTURE_LABELS[conditionerDecision.matched_profile.protein_moisture_balance] ?? conditionerDecision.matched_profile.protein_moisture_balance}`)
  }
  if (conditionerDecision.matched_balance_need) {
    parts.push(`- Pflegefokus: ${CONDITIONER_BALANCE_LABELS[conditionerDecision.matched_balance_need]}`)
  }
  if (conditionerDecision.matched_weight) {
    parts.push(`- Erwartetes Gewicht: ${CONDITIONER_WEIGHT_LABELS[conditionerDecision.matched_weight]}`)
  }
  if (conditionerDecision.matched_repair_level) {
    parts.push(`- Repair-Level: ${CONDITIONER_REPAIR_LEVEL_LABELS[conditionerDecision.matched_repair_level]}`)
  }
  if (conditionerDecision.matched_concern_code) {
    parts.push(`- Wissensbasis-Fokus: ${conditionerDecision.matched_concern_code}`)
  }

  if (!conditionerDecision.eligible) {
    parts.push(
      `- Fehlende Felder: ${conditionerDecision.missing_profile_fields
        .map((field) => CONDITIONER_FIELD_LABELS[field] ?? field)
        .join(", ")}`
    )
  } else if (conditionerDecision.no_catalog_match) {
    parts.push("- Katalogstatus: kein exakter Conditioner-Match fuer dieses Profil vorhanden")
  } else {
    parts.push(`- Exakte Conditioner-Kandidaten: ${conditionerDecision.candidate_count}`)
  }

  if (!conditionerDecision.used_density) {
    parts.push("- Hinweis: Die Haardichte fehlt noch, deshalb bleibt das Produktgewicht vorerst ein Soft-Signal.")
  }

  return parts.join("\n")
}

function formatLeaveInDecision(leaveInDecision?: LeaveInDecision): string {
  if (!leaveInDecision) return ""

  const parts = ["\n\nLeave-in-Entscheidung:"]
  parts.push(`- Profil ausreichend: ${leaveInDecision.eligible ? "ja" : "nein"}`)

  if (leaveInDecision.matched_profile.hair_texture) {
    parts.push(`- Haarmuster: ${HAIR_TEXTURE_LABELS[leaveInDecision.matched_profile.hair_texture] ?? leaveInDecision.matched_profile.hair_texture}`)
  }
  if (leaveInDecision.matched_profile.thickness) {
    parts.push(`- Haardicke: ${HAIR_THICKNESS_LABELS[leaveInDecision.matched_profile.thickness] ?? leaveInDecision.matched_profile.thickness}`)
  }
  if (leaveInDecision.matched_profile.density) {
    parts.push(`- Haardichte: ${HAIR_DENSITY_LABELS[leaveInDecision.matched_profile.density] ?? leaveInDecision.matched_profile.density}`)
  }
  if (leaveInDecision.need_bucket) {
    parts.push(`- Pflegefokus: ${LEAVE_IN_NEED_BUCKET_LABELS[leaveInDecision.need_bucket]}`)
  }
  if (leaveInDecision.styling_context) {
    parts.push(`- Styling-Kontext: ${LEAVE_IN_STYLING_CONTEXT_LABELS[leaveInDecision.styling_context]}`)
  }
  if (leaveInDecision.conditioner_relationship) {
    parts.push(`- Conditioner-Rolle: ${LEAVE_IN_CONDITIONER_RELATIONSHIP_LABELS[leaveInDecision.conditioner_relationship]}`)
  }
  if (leaveInDecision.matched_weight) {
    parts.push(`- Erwartetes Gewicht: ${LEAVE_IN_WEIGHT_LABELS[leaveInDecision.matched_weight]}`)
  }

  if (!leaveInDecision.eligible) {
    parts.push(
      `- Fehlende Felder: ${leaveInDecision.missing_profile_fields
        .map((field) => LEAVE_IN_FIELD_LABELS[field] ?? field)
        .join(", ")}`
    )
  } else if (leaveInDecision.no_catalog_match) {
    parts.push("- Katalogstatus: kein exakter Leave-in-Match fuer dieses Profil vorhanden")
  } else {
    parts.push(`- Exakte Leave-in-Kandidaten: ${leaveInDecision.candidate_count}`)
  }

  return parts.join("\n")
}

function formatOilDecision(oilDecision?: OilDecision): string {
  if (!oilDecision) return ""

  const parts = ["\n\nOel-Entscheidung:"]
  parts.push(`- Profil ausreichend: ${oilDecision.eligible ? "ja" : "nein"}`)

  if (oilDecision.matched_profile.thickness) {
    parts.push(`- Haardicke: ${HAIR_THICKNESS_LABELS[oilDecision.matched_profile.thickness] ?? oilDecision.matched_profile.thickness}`)
  }
  if (oilDecision.matched_subtype) {
    parts.push(`- Oel-Typ: ${OIL_SUBTYPE_LABELS[oilDecision.matched_subtype]}`)
  }
  if (oilDecision.use_mode) {
    parts.push(`- Anwendung: ${OIL_USE_MODE_LABELS[oilDecision.use_mode]}`)
  }
  if (oilDecision.adjunct_scalp_support) {
    parts.push("- Kopfhaut-Hinweis: Oel nur als unterstuetzende Zusatzpflege einordnen, nicht als primaeren Behandlungsweg.")
  }

  if (!oilDecision.eligible) {
    parts.push(
      `- Fehlende Felder: ${oilDecision.missing_profile_fields
        .map((field) => OIL_FIELD_LABELS[field] ?? field)
        .join(", ")}`
    )
  } else if (oilDecision.no_recommendation && oilDecision.no_recommendation_reason) {
    parts.push(`- Kein Oel empfohlen: ${OIL_NO_RECOMMENDATION_LABELS[oilDecision.no_recommendation_reason]}`)
  } else if (oilDecision.no_catalog_match) {
    parts.push("- Katalogstatus: kein exakter Oel-Match fuer Haardicke und Oel-Typ vorhanden")
  } else {
    parts.push(`- Exakte Oel-Kandidaten: ${oilDecision.candidate_count}`)
  }

  return parts.join("\n")
}

function formatRoutinePlan(routinePlan?: RoutinePlan): string {
  if (!routinePlan) return ""

  const parts = ["\n\nRoutine-Plan:"]

  if (routinePlan.primary_focuses.length > 0) {
    parts.push(`- Hauptfokus: ${routinePlan.primary_focuses.map((focus) => focus.label).join(", ")}`)
  }

  if (routinePlan.active_topics.length > 0) {
    parts.push(
      `- Aktive Themen: ${routinePlan.active_topics
        .map((topic) => `${topic.label} (${topic.reason})`)
        .join(" | ")}`
    )
  }

  if (routinePlan.compare_cwc_owc) {
    parts.push("- Vergleichsmodus: Erklaere CWC und OWC erst kurz gegeneinander und entscheide dich dann fuer die passendere Variante fuer dieses Profil.")
  }

  const hasWashProtectionTechnique = routinePlan.sections
    .flatMap((section) => section.slots)
    .some((slot) => slot.topic_ids.includes("cwc") || slot.topic_ids.includes("owc"))

  parts.push(
    hasWashProtectionTechnique
      ? "- Niveau: Hohe Ebene fuer alle Slots; nur bei CWC/OWC sind kompakte nummerierte Wash-Day-Schritte erlaubt."
      : "- Niveau: Hohe Ebene, keine Detail-Anwendungsschritte."
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
              const name = product.brand
                ? `${product.name} von ${product.brand}`
                : product.name
              const reasons = product.recommendation_meta?.top_reasons?.slice(0, 2).join(" | ")
              return reasons ? `${name} (${reasons})` : name
            })
            .join(" ; ")}`
        )
      }
    }
  }

  parts.push(
    "\nWICHTIG: Folge dieser Struktur. Erklaere pro Slot erst die Routine-Logik und den Fit zum Profil. Nenne bereits angehaengte Produkte erst danach und nur direkt beim passenden Slot."
  )

  return parts.join("\n")
}

/**
 * Formats matched products into a context block for the system prompt.
 */
function formatProducts(
  products: Product[],
  productCategory?: ProductCategory,
  maskDecision?: MaskDecision,
  shampooDecision?: ShampooDecision,
  conditionerDecision?: ConditionerDecision,
  leaveInDecision?: LeaveInDecision,
  oilDecision?: OilDecision,
): string {
  const maskDecisionBlock = productCategory === "mask"
    ? formatMaskDecision(maskDecision)
    : ""
  const shampooDecisionBlock = productCategory === "shampoo"
    ? formatShampooDecision(shampooDecision)
    : ""
  const conditionerDecisionBlock = productCategory === "conditioner"
    ? formatConditionerDecision(conditionerDecision)
    : ""
  const leaveInDecisionBlock = productCategory === "leave_in"
    ? formatLeaveInDecision(leaveInDecision)
    : ""
  const oilDecisionBlock = productCategory === "oil"
    ? formatOilDecision(oilDecision)
    : ""
  const categoryDecisionBlock =
    shampooDecisionBlock ||
    conditionerDecisionBlock ||
    leaveInDecisionBlock ||
    oilDecisionBlock ||
    maskDecisionBlock

  if (products.length === 0) {
    if (productCategory === "mask" && maskDecision && !maskDecision.needs_mask) {
      return `${maskDecisionBlock}\n\nWICHTIG: Sage klar, dass aktuell keine Maske noetig ist. Nenne in diesem Fall KEINE konkreten Maskenprodukte.`
    }

    if (productCategory === "shampoo" && shampooDecision && !shampooDecision.eligible) {
      return `${categoryDecisionBlock}\n\nWICHTIG: Frage nur nach den fehlenden Shampoo-Profilfeldern. Nenne keine Produkte und behandle das NICHT als Katalog-No-Match.`
    }

    if (productCategory === "shampoo" && shampooDecision?.no_catalog_match) {
      return `${categoryDecisionBlock}\n\nWICHTIG: Sage klar, dass aktuell kein Shampoo in der Datenbank exakt zu Haardicke und dem abgeleiteten Shampoo-Bucket passt. Weiche NICHT auf andere Kopfhaut-Buckets aus und nenne KEINE konkreten Shampoo-Produkte.`
    }

    if (productCategory === "conditioner" && conditionerDecision && !conditionerDecision.eligible) {
      return `${categoryDecisionBlock}\n\nWICHTIG: Frage nur nach den fehlenden Conditioner-Profilfeldern. Nenne keine Produkte und behandle das NICHT als Katalog-No-Match.`
    }

    if (productCategory === "conditioner" && conditionerDecision?.no_catalog_match) {
      return `${categoryDecisionBlock}\n\nWICHTIG: Sage klar, dass aktuell kein Conditioner in der Datenbank exakt zu Haardicke und Zugtest-Ergebnis passt. Weiche NICHT auf andere Protein-/Feuchtigkeits-Buckets aus und nenne KEINE konkreten Conditioner-Produkte.`
    }

    if (productCategory === "leave_in" && leaveInDecision && !leaveInDecision.eligible) {
      return `${categoryDecisionBlock}\n\nWICHTIG: Frage nur nach den fehlenden Leave-in-Profilfeldern. Nenne keine Produkte und behandle das NICHT als Katalog-No-Match.`
    }

    if (productCategory === "leave_in" && leaveInDecision?.no_catalog_match) {
      return `${categoryDecisionBlock}\n\nWICHTIG: Sage klar, dass aktuell kein Leave-in in der Datenbank exakt zu Haardicke, Haardichte, Pflegefokus und Styling-Kontext passt. Weiche NICHT auf andere Leave-in-Buckets aus und nenne KEINE konkreten Leave-ins.`
    }

    if (productCategory === "oil" && oilDecision && !oilDecision.eligible) {
      return `${categoryDecisionBlock}\n\nWICHTIG: Frage nur nach den fehlenden Oel-Feldern. Klaere ausschliesslich Haardicke und Oel-Zweck. Nenne keine Produkte und behandle das NICHT als Katalog-No-Match.`
    }

    if (productCategory === "oil" && oilDecision?.no_recommendation && oilDecision.no_recommendation_reason) {
      return `${categoryDecisionBlock}\n\nWICHTIG: Sage klar, dass aktuell kein Oel empfohlen wird. Begruende das nur mit dem Oel-Entscheidungsblock. Nenne KEINE konkreten Oele und improvisiere keinen Therapie-Oel-Ersatz.`
    }

    if (productCategory === "oil" && oilDecision?.no_catalog_match) {
      return `${categoryDecisionBlock}\n\nWICHTIG: Sage klar, dass aktuell kein Oel in der Datenbank exakt zu Haardicke und Oel-Typ passt. Weiche NICHT auf andere Oel-Typen oder andere Haardicken aus und nenne KEINE konkreten Oele.`
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
          const strengthLabel = MASK_STRENGTH_LABELS[String(meta.need_strength)] ?? String(meta.need_strength)
          const maskTypeLabel = MASK_TYPE_LABELS[meta.mask_type] ?? meta.mask_type
          parts.push(`  Staerke: ${strengthLabel}`)
          parts.push(`  Typ: ${maskTypeLabel}`)
        }

        if (meta.category === "shampoo") {
          const shampooRole = (p as unknown as Record<string, unknown>).shampoo_role as string | undefined
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
            ].filter(Boolean).join(" | ")}`
          )
          if (meta.matched_bucket) {
            parts.push(`  Shampoo-Bucket: ${SHAMPOO_BUCKET_LABELS[meta.matched_bucket] ?? meta.matched_bucket}`)
          }
          if (meta.matched_concern_code) {
            parts.push(`  Kopfhaut-Fokus: ${meta.matched_concern_code}`)
          }
        }

        if (meta.category === "conditioner") {
          parts.push(
            `  Match-Profil: ${[
              meta.matched_profile.thickness
                ? HAIR_THICKNESS_LABELS[meta.matched_profile.thickness] ?? meta.matched_profile.thickness
                : null,
              meta.matched_profile.density
                ? HAIR_DENSITY_LABELS[meta.matched_profile.density] ?? meta.matched_profile.density
                : null,
            ].filter(Boolean).join(" | ")}`
          )
          if (meta.matched_balance_need) {
            parts.push(`  Pflegefokus: ${CONDITIONER_BALANCE_LABELS[meta.matched_balance_need]}`)
          }
          if (meta.matched_weight) {
            parts.push(`  Gewicht: ${CONDITIONER_WEIGHT_LABELS[meta.matched_weight]}`)
          }
          if (meta.matched_repair_level) {
            parts.push(`  Repair-Level: ${CONDITIONER_REPAIR_LEVEL_LABELS[meta.matched_repair_level]}`)
          }
        }

        if (meta.category === "leave_in") {
          parts.push(
            `  Match-Profil: ${[
              meta.matched_profile.hair_texture
                ? HAIR_TEXTURE_LABELS[meta.matched_profile.hair_texture] ?? meta.matched_profile.hair_texture
                : null,
              meta.matched_profile.thickness
                ? HAIR_THICKNESS_LABELS[meta.matched_profile.thickness] ?? meta.matched_profile.thickness
                : null,
              meta.matched_profile.density
                ? HAIR_DENSITY_LABELS[meta.matched_profile.density] ?? meta.matched_profile.density
                : null,
            ].filter(Boolean).join(" | ")}`
          )
          if (meta.need_bucket) {
            parts.push(`  Pflegefokus: ${LEAVE_IN_NEED_BUCKET_LABELS[meta.need_bucket]}`)
          }
          if (meta.styling_context) {
            parts.push(`  Styling-Kontext: ${LEAVE_IN_STYLING_CONTEXT_LABELS[meta.styling_context]}`)
          }
          if (meta.conditioner_relationship) {
            parts.push(`  Conditioner-Rolle: ${LEAVE_IN_CONDITIONER_RELATIONSHIP_LABELS[meta.conditioner_relationship]}`)
          }
          if (meta.matched_weight) {
            parts.push(`  Gewicht: ${LEAVE_IN_WEIGHT_LABELS[meta.matched_weight]}`)
          }
        }

        if (meta.category === "oil") {
          parts.push(
            `  Match-Profil: ${[
              meta.matched_profile.thickness
                ? HAIR_THICKNESS_LABELS[meta.matched_profile.thickness] ?? meta.matched_profile.thickness
                : null,
            ].filter(Boolean).join(" | ")}`
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

  const header = (productCategory && PRODUCT_SECTION_HEADERS[productCategory])
    ?? "Passende Produkte aus unserer Datenbank"

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
13. Wenn der Routine-Plan Vergleichsmodus fuer CWC/OWC signalisiert, erklaere erst kurz den Unterschied beider Methoden, waehle dann die passendere Option fuer dieses Profil und fuehre nur mit dieser Variante weiter.`,
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
): string {
  let prompt = SYSTEM_PROMPT

  // Inject category-specific reasoning instructions
  if (productCategory && CATEGORY_REASONING_PROMPTS[productCategory]) {
    prompt += CATEGORY_REASONING_PROMPTS[productCategory]
  }

  const userProfileContext = productCategory === "shampoo"
    ? formatShampooProfile(hairProfile, clarificationQuestions, memoryContext)
    : formatUserProfile(hairProfile, clarificationQuestions, memoryContext)

  prompt = prompt.replace("{{USER_PROFILE}}", userProfileContext)

  let ragContext = formatRagContext(ragChunks)
  if (routinePlan) {
    ragContext += formatRoutinePlan(routinePlan)
  }
  if (
    (products || maskDecision || shampooDecision || conditionerDecision || leaveInDecision || oilDecision) &&
    !(productCategory === "routine" && routinePlan)
  ) {
    ragContext += formatProducts(
      products ?? [],
      productCategory,
      maskDecision,
      shampooDecision,
      conditionerDecision,
      leaveInDecision,
      oilDecision,
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
export async function synthesizeResponse(
  params: SynthesizeParams
): Promise<SynthesisResult> {
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
    routinePlan,
    memoryContext,
    clarificationQuestions,
  } = params

  const promptBuildStart = performance.now()
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
  })
  const streamSetupMs = Math.round(performance.now() - streamSetupStart)

  return {
    stream,
    debug: {
      prompt: {
        model: DEFAULT_CHAT_COMPLETION_MODEL,
        temperature: DEFAULT_CHAT_COMPLETION_TEMPERATURE,
        system_prompt: systemPrompt,
        messages: promptMessages,
      },
      prompt_build_ms: promptBuildMs,
      stream_setup_ms: streamSetupMs,
    },
  }
}
