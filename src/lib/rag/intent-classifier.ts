import { getOpenAI } from "@/lib/openai/client"
import { INTENT_CLASSIFICATION_PROMPT } from "@/lib/rag/prompts"
import type { IntentType, ClassificationResult, ProductCategory } from "@/lib/types"

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

const VALID_CATEGORIES: ProductCategory[] = [
  "shampoo",
  "conditioner",
  "mask",
  "oil",
  "leave_in",
  "routine",
]

/**
 * Classifies the intent of a user message using GPT-4o.
 * Returns both the intent type and an optional product category.
 *
 * @param message - The user's message text
 * @param hasImage - Whether the message includes an uploaded image
 * @returns The classified intent and product category
 */
export async function classifyIntent(
  message: string,
  hasImage: boolean
): Promise<ClassificationResult> {
  // If an image is present, override to photo_analysis
  if (hasImage) {
    return { intent: "photo_analysis", product_category: null }
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
      response_format: { type: "json_object" },
      temperature: 0,
      max_tokens: 80,
    })

    const raw = response.choices[0]?.message?.content?.trim() ?? ""

    const parsed = JSON.parse(raw) as { intent?: string; category?: string | null }

    const intent = VALID_INTENTS.find((v) => v === parsed.intent) ?? "general_chat"
    const category = VALID_CATEGORIES.find((v) => v === parsed.category) ?? null

    return { intent, product_category: category }
  } catch (error) {
    console.error("Intent classification failed, defaulting to general_chat:", error)
    return { intent: "general_chat", product_category: null }
  }
}
