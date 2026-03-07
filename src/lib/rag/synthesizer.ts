import { streamChatCompletion } from "@/lib/openai/chat"
import { SYSTEM_PROMPT } from "@/lib/rag/prompts"
import { SOURCE_TYPE_LABELS } from "@/lib/vocabulary"
import type { Message, HairProfile, IntentType, Product, ContentChunk, ProductCategory } from "@/lib/types"
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
    parts.push(`Probleme/Bedenken: ${profile.concerns.join(", ")}`)
  }
  if (profile.goals.length > 0) {
    parts.push(`Ziele: ${profile.goals.join(", ")}`)
  }
  if (profile.wash_frequency) {
    parts.push(`Waschfrequenz: ${profile.wash_frequency}`)
  }
  if (profile.heat_styling) {
    parts.push(`Hitzestyling: ${profile.heat_styling}`)
  }
  if (profile.styling_tools.length > 0) {
    parts.push(`Styling-Tools: ${profile.styling_tools.join(", ")}`)
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
    parts.push(`Kutikula-Zustand: ${profile.cuticle_condition}`)
  }
  if (profile.protein_moisture_balance) {
    parts.push(`Protein-Feuchtigkeits-Balance: ${profile.protein_moisture_balance}`)
  }
  if (profile.scalp_type) {
    parts.push(`Kopfhaut-Typ: ${profile.scalp_type}`)
  }
  if (profile.scalp_condition && profile.scalp_condition !== "keine") {
    parts.push(`Kopfhaut-Beschwerden: ${profile.scalp_condition}`)
  }
  if (profile.chemical_treatment?.length > 0) {
    parts.push(`Chemische Behandlung: ${profile.chemical_treatment.join(", ")}`)
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

const NEED_LEVEL_LABELS: Record<string, string> = {
  low: "niedrig",
  medium: "mittel",
  high: "hoch",
}

/**
 * Formats matched products into a context block for the system prompt.
 */
function formatProducts(products: Product[], productCategory?: ProductCategory): string {
  if (products.length === 0) {
    return "\n\nKeine passenden Produkte in der Datenbank gefunden. Nenne KEINE konkreten Produktnamen — sage dem Nutzer ehrlich, dass du gerade kein passendes Produkt parat hast, und bitte um genauere Angaben."
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
          const needLabel = NEED_LEVEL_LABELS[meta.need_level] ?? meta.need_level
          parts.push(`  Bedarf: ${needLabel}`)
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

  return `\n\n${header}:\n${productList}\n\nWICHTIG: Verwende die EXAKTEN Produktnamen (wie oben geschrieben) wenn du sie erwaehst — die Namen werden in der App als klickbare Links dargestellt.`
}

/** Category-specific reasoning instructions injected into the system prompt */
const CATEGORY_REASONING_PROMPTS: Record<string, string> = {
  shampoo: `

## Shampoo-Empfehlungen:
Wenn du Shampoo-Empfehlungen gibst:
1. Erklaere ZUERST, welche Shampoo-Eigenschaften ideal fuer dieses Nutzerprofil sind (z.B. Kopfhauttyp, Haardicke). Beschreibe die ideale Shampoo-Art in 1-2 Saetzen.
2. Empfehle DANN konkrete Produkte und erklaere WARUM jedes Produkt zu diesem Profil passt. Nenne Preis-Leistungs-Optionen und Premium-Alternativen, wenn verfuegbar.`,
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
4. Nutze den "Bedarf"- und "Anwendung"-Kontext fuer Frequenz und Dosierung.`,
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
  clarificationQuestions?: string[],
): string {
  let prompt = SYSTEM_PROMPT

  // Inject category-specific reasoning instructions
  if (productCategory && CATEGORY_REASONING_PROMPTS[productCategory]) {
    prompt += CATEGORY_REASONING_PROMPTS[productCategory]
  }

  prompt = prompt.replace("{{USER_PROFILE}}", formatUserProfile(hairProfile, clarificationQuestions))

  let ragContext = formatRagContext(ragChunks)
  if (products) {
    ragContext += formatProducts(products, productCategory)
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
    clarificationQuestions,
  } = params

  const systemPrompt = buildSystemPrompt(
    hairProfile,
    ragChunks,
    imageAnalysis,
    products,
    productCategory,
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
