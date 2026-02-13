import { createAdminClient } from "@/lib/supabase/admin"
import { analyzeImage } from "@/lib/openai/vision"
import { classifyIntent } from "@/lib/rag/intent-classifier"
import { retrieveContext } from "@/lib/rag/retriever"
import { matchProducts } from "@/lib/rag/product-matcher"
import { synthesizeResponse, SOURCE_TYPE_LABELS } from "@/lib/rag/synthesizer"
import { formatSourceName } from "@/lib/rag/source-names"
import type { IntentType, Message, HairProfile, Product, CitationSource } from "@/lib/types"

export interface PipelineParams {
  message: string
  conversationId?: string
  userId: string
  imageUrl?: string
}

export interface PipelineResult {
  stream: ReadableStream<Uint8Array>
  conversationId: string
  intent: IntentType
  matchedProducts: Product[]
  sources: CitationSource[]
}

/** Intents that should trigger product matching */
const PRODUCT_INTENTS: IntentType[] = [
  "product_recommendation",
  "routine_help",
  "hair_care_advice",
]

/**
 * Returns true when the message is a short/vague opener that should trigger
 * consultation-first behaviour — i.e. Tom asks clarifying questions before
 * recommending products.
 */
function shouldSkipProductMatching(
  message: string,
  conversationHistory: Message[],
  hasImage: boolean
): boolean {
  const userTurns = conversationHistory.filter(m => m.role === "user").length
  // First message: skip if short/vague
  if (userTurns === 0) {
    if (hasImage) return false
    const wordCount = message.trim().split(/\s+/).length
    return message.length < 100 && wordCount < 15
  }
  // Second exchange (1 user turn so far): still too early for products
  if (userTurns < 2) return true
  return false
}

/**
 * Orchestrates the full RAG pipeline for a single user turn:
 *
 * Step 0: If an image is attached, analyze it with the vision model.
 * Step 1: Classify the user's intent.
 * Step 2: Retrieve relevant knowledge chunks via embedding + pgvector search.
 * Step 3: Load the user's hair profile and last 10 conversation messages.
 * Step 4: If the intent calls for it, match relevant products.
 * Step 5: Synthesize a streaming response with all gathered context.
 *
 * @returns The readable stream of response tokens, conversation ID, and classified intent.
 */
export async function runPipeline(
  params: PipelineParams
): Promise<PipelineResult> {
  const { message, userId, imageUrl } = params
  let { conversationId } = params

  const supabase = createAdminClient()

  // ── Step 0: Image analysis (if applicable) ──────────────────────────
  let imageAnalysis: string | undefined
  if (imageUrl) {
    try {
      imageAnalysis = await analyzeImage(imageUrl, message)
    } catch (error) {
      console.error("Image analysis failed:", error)
      imageAnalysis = "Bildanalyse fehlgeschlagen. Bitte beschreibe dein Haar stattdessen."
    }
  }

  // ── Step 1: Classify intent + load hair profile (parallel) ─────────
  const [intent, hairProfileResult] = await Promise.all([
    classifyIntent(message, !!imageUrl),
    supabase
      .from("hair_profiles")
      .select("*")
      .eq("user_id", userId)
      .single(),
  ])
  const hairProfile: HairProfile | null = hairProfileResult.data ?? null

  // ── Step 2: Retrieve context chunks ─────────────────────────────────
  // Only apply hair-texture metadata filter for product_recommendation intent.
  // Other intents (hair_care_advice, routine_help) need book/transcript chunks
  // which don't carry hair_texture metadata — filtering would return 0 results.
  let metadataFilter: Record<string, string> | undefined
  if (intent === "product_recommendation") {
    if (hairProfile?.hair_texture) {
      metadataFilter = { hair_texture: hairProfile.hair_texture }
    } else if (hairProfile) {
      console.warn(`User ${userId} has profile but missing hair_texture — skipping metadata filter`)
    }
  }
  const ragChunks = await retrieveContext(message, {
    intent,
    hairProfile,
    metadataFilter,
    count: 5,
  })

  // ── Build citation sources from retrieved chunks ──────────────────
  const sources: CitationSource[] = ragChunks.map((chunk, i) => ({
    index: i + 1,
    source_type: chunk.source_type,
    label: SOURCE_TYPE_LABELS[chunk.source_type] ?? chunk.source_type,
    source_name: chunk.source_name ? formatSourceName(chunk.source_name) : null,
    snippet: chunk.content.slice(0, 200) + (chunk.content.length > 200 ? "..." : ""),
  }))

  // ── Step 3: Load conversation history ─────────────────────────────
  const { data: conversationData } = conversationId
    ? await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .limit(10)
    : { data: null }

  const conversationHistory: Message[] = (conversationData as Message[]) ?? []

  // ── Create conversation if it doesn't exist yet ─────────────────────
  if (!conversationId) {
    const { data: newConversation, error: convError } = await supabase
      .from("conversations")
      .insert({
        user_id: userId,
        title: null, // Title will be generated asynchronously
        is_active: true,
      })
      .select("id")
      .single()

    if (convError || !newConversation) {
      throw new Error(`Failed to create conversation: ${convError?.message}`)
    }

    conversationId = newConversation.id
  }

  // ── Step 4: Match products (if intent requires it) ──────────────────
  const skipProducts = shouldSkipProductMatching(message, conversationHistory, !!imageUrl)
  let matchedProducts = undefined
  if (PRODUCT_INTENTS.includes(intent) && !skipProducts) {
    matchedProducts = await matchProducts(
      message,
      hairProfile?.hair_type ?? undefined,
      hairProfile?.concerns ?? undefined,
      5
    )
  }

  // ── Step 5: Synthesize streaming response ───────────────────────────
  const stream = await synthesizeResponse({
    userMessage: message,
    conversationHistory,
    hairProfile,
    ragChunks,
    imageAnalysis,
    products: matchedProducts,
    intent,
    consultationMode: PRODUCT_INTENTS.includes(intent) && skipProducts,
  })

  return {
    stream,
    conversationId: conversationId!,
    intent,
    matchedProducts: matchedProducts ?? [],
    sources,
  }
}
