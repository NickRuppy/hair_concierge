import { getOpenAI } from "@/lib/openai/client"
import { INTENT_CLASSIFICATION_PROMPT } from "@/lib/rag/prompts"
import type { IntentType, ClassificationResult, ProductCategory, RetrievalMode, Message } from "@/lib/types"

const VALID_INTENTS: IntentType[] = [
  "product_recommendation",
  "hair_care_advice",
  "diagnosis",
  "routine_help",
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

const VALID_COMPLEXITIES = ["simple", "multi_constraint", "multi_hop"] as const
const VALID_RETRIEVAL_MODES: RetrievalMode[] = ["faq", "hybrid", "hybrid_plus_graph", "product_sql_plus_hybrid"]

const DEFAULT_CLASSIFICATION: ClassificationResult = {
  intent: "general_chat",
  product_category: null,
  complexity: "simple",
  needs_clarification: false,
  retrieval_mode: "hybrid",
  normalized_filters: {},
  router_confidence: 0.5,
}

/** Max prior messages to include for follow-up context */
const HISTORY_CONTEXT_LIMIT = 3

/**
 * Builds a condensed conversation summary for the classifier.
 * Keeps only the last few user/assistant turns so GPT-4o can
 * resolve ambiguous follow-ups like "und öwc testen?".
 */
function buildHistoryContext(history: Message[]): string {
  const recent = history
    .filter((m) => m.role !== "system" && m.content)
    .slice(-HISTORY_CONTEXT_LIMIT)

  if (recent.length === 0) return ""

  const lines = recent.map(
    (m) => `${m.role === "user" ? "Nutzer" : "Assistent"}: ${m.content!.slice(0, 200)}`,
  )

  return (
    "Bisheriger Gespraechsverlauf (fuer Kontext bei Folgefragen):\n" +
    lines.join("\n") +
    "\n\nAktuelle Nachricht:\n"
  )
}

/**
 * Classifies the intent of a user message using GPT-4o.
 * Returns intent, product category, complexity, confidence, filters, and clarification suggestion.
 *
 * @param message - The user's message text
 * @param conversationHistory - Prior messages for follow-up context (optional)
 * @returns The full classification result
 */
export async function classifyIntent(
  message: string,
  conversationHistory: Message[] = [],
): Promise<ClassificationResult> {
  try {
    const historyPrefix = buildHistoryContext(conversationHistory)

    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: INTENT_CLASSIFICATION_PROMPT,
        },
        {
          role: "user",
          content: historyPrefix + message,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0,
      max_tokens: 250,
    })

    const raw = response.choices[0]?.message?.content?.trim() ?? ""
    const parsed = JSON.parse(raw) as Record<string, unknown>

    const intent = VALID_INTENTS.find((v) => v === parsed.intent) ?? "general_chat"
    const category = VALID_CATEGORIES.find((v) => v === parsed.category) ?? null
    const complexity = VALID_COMPLEXITIES.find((v) => v === parsed.complexity) ?? "simple"

    // Parse confidence: clamp to 0–1
    let confidence = 0.5
    if (typeof parsed.confidence === "number" && isFinite(parsed.confidence)) {
      confidence = Math.max(0, Math.min(1, parsed.confidence))
    }

    // Parse filters: extract known slot keys, ignore unknown
    const rawFilters = (typeof parsed.filters === "object" && parsed.filters !== null)
      ? parsed.filters as Record<string, unknown>
      : {}
    const normalized_filters: Record<string, string | string[] | null> = {}
    for (const key of ["problem", "duration", "products_tried", "routine", "special_circumstances"]) {
      const val = rawFilters[key]
      if (typeof val === "string" && val.trim()) {
        normalized_filters[key] = val.trim()
      } else if (Array.isArray(val)) {
        normalized_filters[key] = val.filter((v): v is string => typeof v === "string")
      } else {
        normalized_filters[key] = null
      }
    }

    const needs_clarification = typeof parsed.needs_clarification === "boolean"
      ? parsed.needs_clarification
      : false

    // Retrieval mode suggestion from LLM (router policy may override)
    const retrieval_mode = VALID_RETRIEVAL_MODES.find((v) => v === parsed.retrieval_mode) ?? "hybrid"

    return {
      intent,
      product_category: category,
      complexity,
      needs_clarification,
      retrieval_mode,
      normalized_filters,
      router_confidence: confidence,
    }
  } catch (error) {
    console.error("Intent classification failed, defaulting to general_chat:", error)
    return { ...DEFAULT_CLASSIFICATION }
  }
}
