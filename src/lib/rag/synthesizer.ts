import { streamChatCompletion } from "@/lib/openai/chat"
import { SYSTEM_PROMPT } from "@/lib/rag/prompts"
import {
  SOURCE_TYPE_LABELS,
  CONCERN_LABELS,
  GOAL_LABELS,
  DESIRED_VOLUME_LABELS,
  STYLING_TOOL_LABELS,
  WASH_FREQUENCY_LABELS,
  HEAT_STYLING_LABELS,
  CUTICLE_CONDITION_LABELS,
  HAIR_THICKNESS_LABELS,
  SCALP_TYPE_LABELS,
  SCALP_CONDITION_LABELS,
  CHEMICAL_TREATMENT_LABELS,
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
} from "@/lib/types"
import type OpenAI from "openai"

export interface SynthesizeParams {
  userMessage: string
  conversationHistory: Message[]
  hairProfile: HairProfile | null
  ragChunks: ContentChunk[]
  imageAnalysis?: string
  products?: Product[]
  intent: IntentType
  productCategory?: ProductCategory
  maskDecision?: MaskDecision
  shampooDecision?: ShampooDecision
  /** Slot-aware clarification questions from the router (replaces consultationMode) */
  clarificationQuestions?: string[]
}

/**
 * Formats the user's hair profile into a human-readable German summary
 * for injection into the system prompt.
 */
function formatUserProfile(
  profile: HairProfile | null,
  clarificationQuestions?: string[],
): string {
  if (!profile) {
    return "Kein Haarprofil vorhanden. Frage den Nutzer nach seinen Haardetails, wenn relevant."
  }

  const parts: string[] = []

  if (profile.hair_texture) {
    parts.push(`Haartyp: ${profile.hair_texture}`)
  }
  if (profile.thickness) {
    parts.push(`Haardicke: ${profile.thickness}`)
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
  if (profile.routine_preference) {
    parts.push(`Routine-Detailgrad: ${profile.routine_preference}`)
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
  if (profile.products_used) {
    parts.push(`Aktuelle Produkte: ${profile.products_used}`)
  }
  if (profile.additional_notes) {
    parts.push(`Zusaetzliche Infos: ${profile.additional_notes}`)
  }

  let result = parts.length > 0
    ? parts.join("\n")
    : "Haarprofil angelegt, aber noch keine Details eingetragen."

  if (profile.conversation_memory) {
    result += `\n\nErinnerungen aus frueheren Gespraechen:\n${profile.conversation_memory}`
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
): string {
  if (!profile) {
    return "Kein Shampoo-Profil vorhanden. Frage nur nach Haardicke, Kopfhaut-Typ und Kopfhaut-Beschwerden."
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
  if (shampooDecision.matched_concern_code) {
    parts.push(`- Wissensbasis-Fokus: ${shampooDecision.matched_concern_code}`)
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

/**
 * Formats matched products into a context block for the system prompt.
 */
function formatProducts(
  products: Product[],
  productCategory?: ProductCategory,
  maskDecision?: MaskDecision,
  shampooDecision?: ShampooDecision
): string {
  const maskDecisionBlock = productCategory === "mask"
    ? formatMaskDecision(maskDecision)
    : ""
  const shampooDecisionBlock = productCategory === "shampoo"
    ? formatShampooDecision(shampooDecision)
    : ""
  const categoryDecisionBlock = shampooDecisionBlock || maskDecisionBlock

  if (products.length === 0) {
    if (productCategory === "mask" && maskDecision && !maskDecision.needs_mask) {
      return `${maskDecisionBlock}\n\nWICHTIG: Sage klar, dass aktuell keine Maske noetig ist. Nenne in diesem Fall KEINE konkreten Maskenprodukte.`
    }

    if (productCategory === "shampoo" && shampooDecision && !shampooDecision.eligible) {
      return `${categoryDecisionBlock}\n\nWICHTIG: Frage nur nach den fehlenden Shampoo-Profilfeldern. Nenne keine Produkte und behandle das NICHT als Katalog-No-Match.`
    }

    if (productCategory === "shampoo" && shampooDecision?.no_catalog_match) {
      return `${categoryDecisionBlock}\n\nWICHTIG: Sage klar, dass aktuell kein Shampoo in der Datenbank exakt zu Haardicke, Kopfhaut-Typ und Kopfhaut-Beschwerden passt. Weiche NICHT auf andere Kopfhaut-Buckets aus und nenne KEINE konkreten Shampoo-Produkte.`
    }

    return `${categoryDecisionBlock}\n\nKeine passenden Produkte in der Datenbank gefunden. Nenne KEINE konkreten Produktnamen — sage dem Nutzer ehrlich, dass du gerade kein passendes Produkt parat hast, und bitte um genauere Angaben.`
  }

  const productList = products
    .map((p) => {
      const parts = [`- **${p.name}**`]
      if (p.brand) parts[0] += ` von ${p.brand}`
      if (p.short_description) parts.push(`  ${p.short_description}`)
      else if (p.description) parts.push(`  ${p.description}`)
      if (p.price_eur) parts.push(`  Preis: ${p.price_eur.toFixed(2)} EUR`)
      if ((p.tags ?? []).length > 0) parts.push(`  Tags: ${(p.tags ?? []).join(", ")}`)
      if (p.recommendation_meta) {
        const meta = p.recommendation_meta
        parts.push(`  Score: ${meta.score.toFixed(1)}`)

        if (meta.category === "leave_in" && meta.mode_match.length > 0) {
          parts.push(`  Mode-Fit: ${meta.mode_match.join(", ")}`)
        }

        if (meta.category === "mask") {
          const strengthLabel = MASK_STRENGTH_LABELS[String(meta.need_strength)] ?? String(meta.need_strength)
          const maskTypeLabel = MASK_TYPE_LABELS[meta.mask_type] ?? meta.mask_type
          parts.push(`  Staerke: ${strengthLabel}`)
          parts.push(`  Typ: ${maskTypeLabel}`)
        }

        if (meta.category === "shampoo") {
          parts.push(
            `  Match-Profil: ${[
              meta.matched_profile.thickness,
              meta.matched_profile.scalp_type,
              meta.matched_profile.scalp_condition,
            ].filter(Boolean).join(" | ")}`
          )
          if (meta.matched_concern_code) {
            parts.push(`  Kopfhaut-Fokus: ${meta.matched_concern_code}`)
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
1. Nutze fuer die Shampoo-Begruendung NUR diese Signale: Haardicke, Kopfhaut-Typ, Kopfhaut-Beschwerden und den Shampoo-Entscheidungsblock.
2. Wenn im Shampoo-Entscheidungsblock Profilfelder fehlen, frage EXAKT nur nach diesen fehlenden Shampoo-Feldern und nenne keine Produkte.
3. Wenn der Shampoo-Entscheidungsblock sagt, dass es keinen exakten Katalog-Match gibt, sage das klar und nenne keine ausweichenden Shampoo-Produkte aus anderen Kopfhaut-Buckets.
4. Erklaere ZUERST, welche Shampoo-Eigenschaften ideal fuer dieses Nutzerprofil sind. Empfehle DANN konkrete Produkte und erklaere WARUM jedes Produkt zu genau diesem Profil passt.
5. Begruende Shampoo-Fit NICHT mit Haarstruktur, Zielen, chemischer Behandlung, Waschfrequenz oder anderen Randprofilen.
6. Erwaehne Haarmuster wie glatt, wellig, lockig oder coily NICHT als Shampoo-Fit-Signal, auch wenn diese Infos im Nutzerprofil stehen.`,
  conditioner: `

## Conditioner-Empfehlungen:
Wenn du Conditioner-Empfehlungen gibst:
1. Erklaere ZUERST den Protein-Feuchtigkeits-Status des Nutzers basierend auf dem Zugtest-Ergebnis im Profil. Beschreibe, was das Haar gerade braucht (Protein, Feuchtigkeit, oder ausgewogene Pflege) in 1-2 Saetzen.
2. Empfehle DANN konkrete Produkte und erklaere WARUM jedes Produkt zu diesem Bedarf und der Haardicke passt.`,
  leave_in: `

## Leave-in-Empfehlungen:
Wenn du Leave-in-Empfehlungen gibst:
1. Nutze den "Mode-Fit", "Warum passend" und "Trade-offs" Kontext der Produkte aktiv.
2. Bevorzuge bei Hitzestyling Leave-ins mit Pflege + Hitzeschutz gegenueber reinen Hitzeschutz-Produkten.
3. Erklaere kurz den Anwendungszeitpunkt (z.B. handtuchtrocken vor Styling), basierend auf "Anwendung".`,
  mask: `

## Masken-Empfehlungen:
Wenn du Masken-Empfehlungen gibst:
1. Behandle Masken als Zusatzpflege, nicht als Conditioner-Ersatz.
2. Betone Anwendung auf Laengen/Spitzen (nicht Kopfhaut).
3. Erklaere klar die Reihenfolge: Shampoo -> Maske -> Conditioner.
4. Nutze den "Masken-Entscheidung", "Staerke", "Typ" und "Anwendung"-Kontext aktiv.
5. Wenn die Masken-Entscheidung sagt, dass aktuell keine Maske noetig ist, sage das klar und nenne keine Maskenprodukte.`,
}

/**
 * Builds the complete system prompt by replacing placeholders with actual data.
 */
function buildSystemPrompt(
  hairProfile: HairProfile | null,
  ragChunks: ContentChunk[],
  imageAnalysis?: string,
  products?: Product[],
  productCategory?: ProductCategory,
  maskDecision?: MaskDecision,
  shampooDecision?: ShampooDecision,
  clarificationQuestions?: string[],
): string {
  let prompt = SYSTEM_PROMPT

  // Inject category-specific reasoning instructions
  if (productCategory && CATEGORY_REASONING_PROMPTS[productCategory]) {
    prompt += CATEGORY_REASONING_PROMPTS[productCategory]
  }

  const userProfileContext = productCategory === "shampoo"
    ? formatShampooProfile(hairProfile, clarificationQuestions)
    : formatUserProfile(hairProfile, clarificationQuestions)

  prompt = prompt.replace("{{USER_PROFILE}}", userProfileContext)

  let ragContext = formatRagContext(ragChunks)
  if (products || maskDecision || shampooDecision) {
    ragContext += formatProducts(products ?? [], productCategory, maskDecision, shampooDecision)
  }
  prompt = prompt.replace("{{RAG_CONTEXT}}", ragContext)

  prompt = prompt.replace(
    "{{IMAGE_ANALYSIS}}",
    imageAnalysis
      ? `Analyse des hochgeladenen Bildes:\n${imageAnalysis}`
      : "Kein Bild hochgeladen."
  )

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
): Promise<ReadableStream<Uint8Array>> {
  const {
    userMessage,
    conversationHistory,
    hairProfile,
    ragChunks,
    imageAnalysis,
    products,
    productCategory,
    maskDecision,
    shampooDecision,
    clarificationQuestions,
  } = params

  const systemPrompt = buildSystemPrompt(
    hairProfile,
    ragChunks,
    imageAnalysis,
    products,
    productCategory,
    maskDecision,
    shampooDecision,
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

  return streamChatCompletion({ messages })
}
