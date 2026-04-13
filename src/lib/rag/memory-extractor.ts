import { z } from "zod"
import { startObservation } from "@langfuse/tracing"
import { context as otelContext, trace as otelTrace } from "@opentelemetry/api"
import { getObservedOpenAI } from "@/lib/openai/client"
import {
  buildLangfusePromptConfig,
  getManagedTextPrompt,
  LANGFUSE_PROMPTS,
} from "@/lib/langfuse/prompts"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  buildMemoryPromptContext,
  getUserMemoryEnabled,
  insertExtractedMemories,
  listUserMemoryEntries,
  type ExtractedMemoryCandidate,
} from "@/lib/rag/user-memory"
import type { UserMemoryKind } from "@/lib/types"

export { MEMORY_EXTRACTION_JSON_PROMPT } from "@/lib/rag/prompts"

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
  supabase: ReturnType<typeof createAdminClient>,
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
  userId: string,
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

    const observation = startObservation("memory-extraction", {
      input: {
        conversationId,
        userId,
        messageCount: messages.length,
      },
      metadata: {
        feature: "user-memory",
      },
    })
    const observationContext = otelTrace.setSpan(otelContext.active(), observation.otelSpan)

    try {
      await otelContext.with(observationContext, async () => {
        const existingMemory = buildMemoryPromptContext(await listUserMemoryEntries(userId, supabase))

        const transcript = messages
          .map(
            (message) =>
              `${message.role === "user" ? "Nutzer" : "Assistent"}: ${message.content ?? ""}`,
          )
          .join("\n")

        const managedPrompt = await getManagedTextPrompt(LANGFUSE_PROMPTS.memoryExtraction, {
          EXISTING_MEMORY_SECTION: existingMemory
            ? `Bestehende aktive Erinnerungen:\n${existingMemory}`
            : "Keine bestehenden aktiven Erinnerungen.",
          TRANSCRIPT: transcript,
        })

        const completion = await getObservedOpenAI({
          generationName: "memory-extraction-json",
          generationMetadata: {
            conversation_id: conversationId,
            prompt_label: managedPrompt.ref.label,
          },
          langfusePrompt: buildLangfusePromptConfig(managedPrompt.ref),
        }).chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: managedPrompt.text }],
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
        observation.update({
          output: {
            skipped: false,
            memoryCount: memories.length,
            prompt: managedPrompt.ref,
          },
        })
      })
    } catch (error) {
      console.error("Memory extraction failed:", error)
      observation.update({
        output: {
          failed: true,
        },
        metadata: {
          error: error instanceof Error ? error.message : "memory_extraction_failed",
        },
      })
    } finally {
      observation.end()
    }
  } catch (error) {
    console.error("Memory extraction failed:", error)
  }
}
