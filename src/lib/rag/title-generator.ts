import { getOpenAI } from "@/lib/openai/client"
import { createAdminClient } from "@/lib/supabase/admin"
import { TITLE_GENERATION_PROMPT } from "@/lib/rag/prompts"

/**
 * Generates a short German title for a conversation using GPT-4o-mini
 * and writes it to the database. Fire-and-forget — never throws.
 */
export async function generateConversationTitle(
  conversationId: string,
  userMessage: string
): Promise<void> {
  try {
    const completion = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "user", content: TITLE_GENERATION_PROMPT + userMessage },
      ],
      max_tokens: 30,
      temperature: 0.5,
    })

    const title = completion.choices[0]?.message?.content?.trim()
    if (!title) return

    const supabase = createAdminClient()
    await supabase
      .from("conversations")
      .update({ title })
      .eq("id", conversationId)
  } catch (error) {
    console.error("Title generation failed:", error)
  }
}
