import { getObservedOpenAI } from "@/lib/openai/client"
import { sanitizeLangfuseText } from "@/lib/langfuse/masking"
import { runDetachedBackgroundTrace } from "@/lib/langfuse/background-trace"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  buildLangfusePromptConfig,
  getManagedTextPrompt,
  LANGFUSE_PROMPTS,
} from "@/lib/langfuse/prompts"

type ConversationTitleTraceContext = {
  userId?: string | null
  requestId?: string | null
}

/**
 * Generates a short German title for a conversation using GPT-4o-mini
 * and writes it to the database. Fire-and-forget — never throws.
 */
export async function generateConversationTitle(
  conversationId: string,
  userMessage: string,
  traceContext?: ConversationTitleTraceContext,
): Promise<void> {
  try {
    await runDetachedBackgroundTrace(
      {
        name: "conversation-title",
        conversationId,
        userId: traceContext?.userId,
        requestId: traceContext?.requestId,
        input: {
          conversationId,
          userMessagePreview: sanitizeLangfuseText(userMessage)?.slice(0, 300),
        },
        metadata: {
          feature: "conversation-title",
        },
      },
      async (observation) => {
        const managedPrompt = await getManagedTextPrompt(LANGFUSE_PROMPTS.titleGenerator, {
          MESSAGE: userMessage,
        })

        const completion = await getObservedOpenAI({
          generationName: "conversation-title-llm",
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
        if (!title) {
          observation.update({
            output: {
              skipped: true,
              reason: "empty_title",
              prompt: managedPrompt.ref,
            },
          })
          return
        }

        const supabase = createAdminClient()
        await supabase.from("conversations").update({ title }).eq("id", conversationId)

        observation.update({
          output: {
            skipped: false,
            title,
            prompt: managedPrompt.ref,
          },
        })
      },
    )
  } catch (error) {
    console.error("Title generation failed:", error)
  }
}
