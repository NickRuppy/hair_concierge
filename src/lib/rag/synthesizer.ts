import { streamChatCompletion } from "@/lib/openai/chat"
import { SYSTEM_PROMPT } from "@/lib/rag/prompts"
import { SOURCE_TYPE_LABELS } from "@/lib/vocabulary"
import type { Message, HairProfile, IntentType, Product, ContentChunk } from "@/lib/types"
import type OpenAI from "openai"

export interface SynthesizeParams {
  userMessage: string
  conversationHistory: Message[]
  hairProfile: HairProfile | null
  ragChunks: ContentChunk[]
  imageAnalysis?: string
  products?: Product[]
  intent: IntentType
  consultationMode?: boolean
}

/**
 * Formats the user's hair profile into a human-readable German summary
 * for injection into the system prompt.
 */
function formatUserProfile(profile: HairProfile | null, consultationMode?: boolean): string {
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

  if (consultationMode) {
    result += "\n\n(HINWEIS: Dies ist der Beginn des Gespraechs. Stelle zuerst 2-3 gezielte Rueckfragen, um die Situation zu verstehen. Nenne dabei KEINE konkreten Produktnamen — auch nicht die Produkte aus der Datenbank unten. Produktempfehlungen kommen erst, wenn du genug Kontext hast.)"
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

/**
 * Formats matched products into a context block for the system prompt.
 */
function formatProducts(products: Product[]): string {
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
      if (p.tags.length > 0) parts.push(`  Tags: ${p.tags.join(", ")}`)
      return parts.join("\n")
    })
    .join("\n")

  return `\n\nPassende Produkte aus unserer Datenbank:\n${productList}\n\nWICHTIG: Verwende die EXAKTEN Produktnamen (wie oben geschrieben) wenn du sie erwaehst — die Namen werden in der App als klickbare Links dargestellt.`
}

/**
 * Builds the complete system prompt by replacing placeholders with actual data.
 */
function buildSystemPrompt(
  hairProfile: HairProfile | null,
  ragChunks: ContentChunk[],
  imageAnalysis?: string,
  products?: Product[],
  consultationMode?: boolean
): string {
  let prompt = SYSTEM_PROMPT

  prompt = prompt.replace("{{USER_PROFILE}}", formatUserProfile(hairProfile, consultationMode))

  let ragContext = formatRagContext(ragChunks)
  if (products) {
    ragContext += formatProducts(products)
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
    consultationMode,
  } = params

  const systemPrompt = buildSystemPrompt(
    hairProfile,
    ragChunks,
    imageAnalysis,
    products,
    consultationMode
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
