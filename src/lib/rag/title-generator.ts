import { getObservedOpenAI } from "@/lib/openai/client"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  buildLangfusePromptConfig,
  getManagedTextPrompt,
  LANGFUSE_PROMPTS,
} from "@/lib/langfuse/prompts"

/**
 * Generates a short German title for a conversation using GPT-4o-mini
 * and writes it to the database. Fire-and-forget — never throws.
 */
export async function generateConversationTitle(
  conversationId: string,
  userMessage: string,
): Promise<void> {
  try {
    const managedPrompt = await getManagedTextPrompt(LANGFUSE_PROMPTS.titleGenerator, {
      MESSAGE: userMessage,
    })

    const completion = await getObservedOpenAI({
      generationName: "conversation-title",
      generationMetadata: {
        conversation_id: conversationId,
        prompt_label: managedPrompt.ref.label,
      },
      langfusePrompt: buildLangfusePromptConfig(managedPrompt.ref),
    }).chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: managedPrompt.text }],
      max_tokens: 30,
      temperature: 0.5,
    })

    const title = completion.choices[0]?.message?.content?.trim()
    if (!title) return

    const supabase = createAdminClient()
    await supabase.from("conversations").update({ title }).eq("id", conversationId)
  } catch (error) {
    console.error("Title generation failed:", error)
  }
}
