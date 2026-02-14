import { getOpenAI } from "@/lib/openai/client"
import { createAdminClient } from "@/lib/supabase/admin"
import { MEMORY_EXTRACTION_PROMPT } from "@/lib/rag/prompts"

const MEMORY_HARD_CAP = 2000
const MIN_USER_MESSAGES = 3

/**
 * Extracts durable facts from a conversation and merges them into the
 * user's hair profile memory. Fire-and-forget — never throws.
 */
export async function extractConversationMemory(
  conversationId: string,
  userId: string
): Promise<void> {
  try {
    const supabase = createAdminClient()

    // Load all messages for this conversation
    const { data: messages } = await supabase
      .from("messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })

    if (!messages) return

    // Count user messages — skip extraction for short conversations
    const userMessageCount = messages.filter((m) => m.role === "user").length
    if (userMessageCount < MIN_USER_MESSAGES) return

    // Check if already extracted at this message count
    const { data: conversation } = await supabase
      .from("conversations")
      .select("memory_extracted_at_count")
      .eq("id", conversationId)
      .single()

    if (!conversation) return
    if (conversation.memory_extracted_at_count >= messages.length) return

    // Load current memory from hair profile
    const { data: profile } = await supabase
      .from("hair_profiles")
      .select("conversation_memory")
      .eq("user_id", userId)
      .single()

    if (!profile) return

    const existingMemory = profile.conversation_memory || ""

    // Build conversation transcript for the LLM
    const transcript = messages
      .map((m) => `${m.role === "user" ? "Nutzer" : "Tom"}: ${m.content ?? ""}`)
      .join("\n")

    const prompt = existingMemory
      ? `${MEMORY_EXTRACTION_PROMPT}\n\nBestehendes Gedaechtnis:\n${existingMemory}\n\nGespraech:\n${transcript}`
      : `${MEMORY_EXTRACTION_PROMPT}\n\nGespraech:\n${transcript}`

    const completion = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 800,
      temperature: 0.3,
    })

    const result = completion.choices[0]?.message?.content?.trim()
    if (!result || result === "KEINE_NEUEN_FAKTEN") {
      // Still update the extraction count to avoid re-processing
      await supabase
        .from("conversations")
        .update({ memory_extracted_at_count: messages.length })
        .eq("id", conversationId)
      return
    }

    // Merge: if there's existing memory, combine; otherwise use new result
    let updatedMemory = existingMemory
      ? `${existingMemory}\n${result}`
      : result

    // Hard cap at 2000 chars
    if (updatedMemory.length > MEMORY_HARD_CAP) {
      updatedMemory = updatedMemory.slice(0, MEMORY_HARD_CAP)
      // Trim to last complete bullet point
      const lastNewline = updatedMemory.lastIndexOf("\n")
      if (lastNewline > 0) {
        updatedMemory = updatedMemory.slice(0, lastNewline)
      }
    }

    // Write updated memory to hair profile
    await supabase
      .from("hair_profiles")
      .update({ conversation_memory: updatedMemory })
      .eq("user_id", userId)

    // Mark extraction count
    await supabase
      .from("conversations")
      .update({ memory_extracted_at_count: messages.length })
      .eq("id", conversationId)
  } catch (error) {
    console.error("Memory extraction failed:", error)
  }
}
