import { z } from "zod"
import { getOpenAI } from "@/lib/openai/client"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  buildMemoryPromptContext,
  getUserMemoryEnabled,
  insertExtractedMemories,
  listUserMemoryEntries,
  type ExtractedMemoryCandidate,
} from "@/lib/rag/user-memory"
import type { UserMemoryKind } from "@/lib/types"

const MIN_USER_MESSAGES = 3

const extractedMemorySchema = z.object({
  kind: z.enum([
    "preference",
    "routine",
    "product_experience",
    "hair_history",
    "progress",
    "sensitivity",
    "medical_context",
    "legacy_summary",
    "other",
  ]),
  memory_key: z.string().nullable().optional(),
  content: z.string(),
  evidence: z.string().nullable().optional(),
  confidence: z.number().min(0).max(1).nullable().optional(),
  product_names: z.array(z.string()).nullable().optional(),
  sentiment: z.enum(["positive", "negative", "neutral"]).nullable().optional(),
})

const extractionResponseSchema = z.object({
  memories: z.array(extractedMemorySchema).default([]),
})

export const MEMORY_EXTRACTION_JSON_PROMPT = `Du bist ein Analyse-Assistent fuer Hair Concierge. Extrahiere dauerhafte, haarspezifische Erinnerungen aus einem Gespraech.

Antworte NUR als JSON:
{"memories":[{"kind":"preference|routine|product_experience|hair_history|progress|sensitivity|medical_context|other","memory_key":"stabiler_key","content":"deutscher Satz","evidence":"kurzes Nutzerzitat","confidence":0.0,"product_names":["..."],"sentiment":"positive|negative|neutral"}]}

Regeln:
- Speichere nur Fakten, die der NUTZER explizit sagt oder bestaetigt.
- Speichere keine Empfehlungen, Erklaerungen oder Annahmen des Assistenten.
- Speichere nur hair-care-relevante Fakten: Vorlieben, Routine, Produkterfahrungen, Haarhistorie, Fortschritt, Reaktionen, Sensitivitaeten.
- Medizinisch angrenzende Fakten wie Haarausfall, Kopfhautbeschwerden, Schwangerschaft, Medikamente oder Allergien nur speichern, wenn der Nutzer sie explizit als relevant nennt.
- Keine Smalltalk-Fakten, keine allgemeinen Lebensdetails ohne Haarpflegebezug.
- Bei Produkterfahrungen setze product_names und sentiment. Negative sentiment bedeutet: Produkt nicht wieder priorisieren.
- memory_key muss stabil sein, z.B. "product:olaplex_no_3", "preference:duft", "routine:wash_frequency". Bei neuem Widerspruch denselben memory_key verwenden, damit die neueste Aussage gewinnt.
- Wenn nichts Neues speicherwuerdig ist: {"memories":[]}.`

export function parseMemoryExtractionResult(content: string): ExtractedMemoryCandidate[] {
  try {
    const parsed = extractionResponseSchema.safeParse(JSON.parse(content))
    if (!parsed.success) return []

    return parsed.data.memories.map((memory) => ({
      kind: memory.kind as UserMemoryKind,
      memory_key: memory.memory_key,
      content: memory.content,
      evidence: memory.evidence,
      confidence: memory.confidence,
      product_names: memory.product_names,
      sentiment: memory.sentiment,
    }))
  } catch {
    return []
  }
}

async function markConversationExtracted(
  conversationId: string,
  messageCount: number,
  supabase: ReturnType<typeof createAdminClient>
) {
  await supabase
    .from("conversations")
    .update({ memory_extracted_at_count: messageCount })
    .eq("id", conversationId)
}

/**
 * Extracts durable user-controlled memory from a conversation.
 * Fire-and-forget: logs errors but never throws into the chat response path.
 */
export async function extractConversationMemory(
  conversationId: string,
  userId: string
): Promise<void> {
  try {
    const supabase = createAdminClient()

    const { data: messages } = await supabase
      .from("messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })

    if (!messages) return

    const userMessageCount = messages.filter((message) => message.role === "user").length
    if (userMessageCount < MIN_USER_MESSAGES) return

    const { data: conversation } = await supabase
      .from("conversations")
      .select("memory_extracted_at_count")
      .eq("id", conversationId)
      .single()

    if (!conversation) return
    if ((conversation.memory_extracted_at_count ?? 0) >= messages.length) return

    const memoryEnabled = await getUserMemoryEnabled(userId, supabase)
    if (!memoryEnabled) {
      await markConversationExtracted(conversationId, messages.length, supabase)
      return
    }

    const existingMemory = buildMemoryPromptContext(
      await listUserMemoryEntries(userId, supabase)
    )

    const transcript = messages
      .map((message) => `${message.role === "user" ? "Nutzer" : "Assistent"}: ${message.content ?? ""}`)
      .join("\n")

    const prompt = [
      MEMORY_EXTRACTION_JSON_PROMPT,
      existingMemory ? `\nBestehende aktive Erinnerungen:\n${existingMemory}` : "",
      `\nGespraech:\n${transcript}`,
    ].join("\n")

    const completion = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 800,
      temperature: 0.1,
      response_format: { type: "json_object" },
    })

    const content = completion.choices[0]?.message?.content
    const memories = content ? parseMemoryExtractionResult(content) : []

    if (memories.length > 0) {
      await insertExtractedMemories(userId, conversationId, memories, supabase)
    }

    await markConversationExtracted(conversationId, messages.length, supabase)
  } catch (error) {
    console.error("Memory extraction failed:", error)
  }
}
