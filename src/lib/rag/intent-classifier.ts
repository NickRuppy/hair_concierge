import { getOpenAI } from "@/lib/openai/client"
import { INTENT_CLASSIFICATION_PROMPT } from "@/lib/rag/prompts"
import type { IntentType } from "@/lib/types"

const VALID_INTENTS: IntentType[] = [
  "product_recommendation",
  "hair_care_advice",
  "diagnosis",
  "routine_help",
  "photo_analysis",
  "ingredient_question",
  "general_chat",
  "followup",
]

/**
 * Classifies the intent of a user message using GPT-4o.
 *
 * @param message - The user's message text
 * @param hasImage - Whether the message includes an uploaded image
 * @returns The classified intent type
 */
export async function classifyIntent(
  message: string,
  hasImage: boolean
): Promise<IntentType> {
  // If an image is present, override to photo_analysis
  if (hasImage) {
    return "photo_analysis"
  }

  try {
    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: `${INTENT_CLASSIFICATION_PROMPT}${message}`,
        },
      ],
      temperature: 0,
      max_tokens: 30,
    })

    const raw = response.choices[0]?.message?.content?.trim().toLowerCase() ?? ""

    // Validate the returned intent is one of our known types
    const intent = VALID_INTENTS.find((valid) => raw === valid)
    return intent ?? "general_chat"
  } catch (error) {
    console.error("Intent classification failed, defaulting to general_chat:", error)
    return "general_chat"
  }
}
