import type { ClassificationResult, RouterDecision, IntentType, Message, HairProfile, RetrievalMode } from "@/lib/types"
import {
  ROUTER_CONFIDENCE_THRESHOLD,
  ROUTER_MIN_SLOTS_PRODUCT,
  ROUTER_MAX_CLARIFICATION_ROUNDS,
  ROUTER_SLOT_KEYS,
  PRODUCT_INTENTS,
} from "@/lib/rag/retrieval-constants"

/** Intents that require rich context to answer well */
const CONTEXT_SENSITIVE_INTENTS: IntentType[] = [
  "product_recommendation",
  "routine_help",
  "hair_care_advice",
  "diagnosis",
]

/**
 * Counts how many prior assistant turns were clarification rounds
 * (i.e., the assistant asked questions instead of giving a substantive answer).
 * Heuristic: a clarification turn ends with a question mark and has no product recommendations.
 */
function countClarificationRounds(conversationHistory: Message[]): number {
  let count = 0
  for (const msg of conversationHistory) {
    if (msg.role !== "assistant" || !msg.content) continue
    const questionMarks = (msg.content.match(/\?/g) || []).length
    const hasProducts = msg.product_recommendations && msg.product_recommendations.length > 0
    if (questionMarks >= 2 && !hasProducts) {
      count++
    }
  }
  return count
}

/**
 * Computes slot completeness for a classification's normalized_filters.
 * Returns { score: 0–1, rawCount: filled slots including profile bonuses }.
 */
function computeSlotCompleteness(
  filters: Record<string, string | string[] | null>,
  productCategory: string | null,
  hairProfile: HairProfile | null,
): { score: number; rawCount: number } {
  let filledCount = 0

  for (const key of ROUTER_SLOT_KEYS) {
    const val = filters[key]
    if (val !== null && val !== undefined) {
      if (Array.isArray(val) ? val.length > 0 : (typeof val === "string" && val.trim() !== "")) {
        filledCount++
      }
    }
  }

  // Category-specific bonus: count profile data as partial slot fills
  if (productCategory === "shampoo" && hairProfile?.scalp_type) {
    filledCount += 0.5
  }
  if (productCategory === "conditioner" && hairProfile?.protein_moisture_balance) {
    filledCount += 0.5
  }

  return {
    score: Math.min(1, filledCount / ROUTER_SLOT_KEYS.length),
    rawCount: filledCount,
  }
}

/**
 * Deterministic router policy engine.
 * Evaluates classification + context to produce a routing decision.
 * Applied in priority order; first matching rule wins.
 */
export function evaluateRoute(
  classification: ClassificationResult,
  conversationHistory: Message[],
  hairProfile: HairProfile | null,
): RouterDecision {
  try {
    const { intent, product_category, complexity, router_confidence, normalized_filters, needs_clarification } = classification
    const overrides: string[] = []
    let retrieval_mode: RetrievalMode = classification.retrieval_mode
    let shouldClarify = needs_clarification
    let clarification_reason: string | undefined

    const { score: slotScore, rawCount: filledSlotCount } = computeSlotCompleteness(
      normalized_filters,
      product_category,
      hairProfile,
    )

    // ── Rule 1: Image override ─────────────────────────────────────────
    if (intent === "photo_analysis") {
      return {
        retrieval_mode: "hybrid",
        needs_clarification: false,
        slot_completeness: slotScore,
        confidence: router_confidence,
        policy_overrides: [],
      }
    }

    // ── Rule 2: FAQ shortcut ───────────────────────────────────────────
    if (
      complexity === "simple" &&
      router_confidence >= 0.9 &&
      !PRODUCT_INTENTS.includes(intent)
    ) {
      retrieval_mode = "faq"
      overrides.push("faq_shortcut")
    }

    // ── Rule 3: Category-specific defaults (only for product intents) ──
    if (
      PRODUCT_INTENTS.includes(intent) &&
      (product_category === "shampoo" ||
        product_category === "conditioner" ||
        product_category === "mask" ||
        product_category === "leave_in")
    ) {
      retrieval_mode = "product_sql_plus_hybrid"
      overrides.push("category_product_mode")
    }

    // ── Rule 3b: Shampoo profile prerequisites are mandatory ─────────────
    if (
      PRODUCT_INTENTS.includes(intent) &&
      product_category === "shampoo" &&
      (!hairProfile?.thickness || !hairProfile?.scalp_type || !hairProfile?.scalp_condition)
    ) {
      shouldClarify = true
      if (!clarification_reason) {
        clarification_reason = "missing_shampoo_profile"
      } else {
        clarification_reason += "+missing_shampoo_profile"
      }
      overrides.push("missing_shampoo_profile")
    }

    // ── Rule 3c: Conditioner profile prerequisites are mandatory ────────
    if (
      PRODUCT_INTENTS.includes(intent) &&
      product_category === "conditioner" &&
      (!hairProfile?.thickness || !hairProfile?.protein_moisture_balance)
    ) {
      shouldClarify = true
      if (!clarification_reason) {
        clarification_reason = "missing_conditioner_profile"
      } else {
        clarification_reason += "+missing_conditioner_profile"
      }
      overrides.push("missing_conditioner_profile")
    }

    // ── Rule 4: Low confidence → clarification ─────────────────────────
    if (
      router_confidence < ROUTER_CONFIDENCE_THRESHOLD &&
      CONTEXT_SENSITIVE_INTENTS.includes(intent)
    ) {
      shouldClarify = true
      clarification_reason = "low_confidence"
      overrides.push("low_confidence")
    }

    // ── Rule 5: Missing slots → clarification ──────────────────────────
    if (
      CONTEXT_SENSITIVE_INTENTS.includes(intent) &&
      filledSlotCount < ROUTER_MIN_SLOTS_PRODUCT
    ) {
      shouldClarify = true
      if (!clarification_reason) {
        clarification_reason = "missing_slots"
      } else {
        clarification_reason += "+missing_slots"
      }
      overrides.push("missing_slots")
    }

    // ── Rule 6: Clarification cap ──────────────────────────────────────
    const priorClarificationRounds = countClarificationRounds(conversationHistory)
    const hasMandatoryProfileGap =
      overrides.includes("missing_shampoo_profile") ||
      overrides.includes("missing_conditioner_profile")
    if (shouldClarify && !hasMandatoryProfileGap && priorClarificationRounds >= ROUTER_MAX_CLARIFICATION_ROUNDS) {
      shouldClarify = false
      clarification_reason = undefined
      overrides.push("clarification_cap_reached")
    }

    // ── Rule 7: Fallback ───────────────────────────────────────────────
    // If no rule set a specific mode, default to hybrid
    if (!overrides.some(o => o === "faq_shortcut" || o === "category_product_mode")) {
      retrieval_mode = "hybrid"
    }

    return {
      retrieval_mode,
      needs_clarification: shouldClarify,
      clarification_reason,
      slot_completeness: slotScore,
      confidence: router_confidence,
      policy_overrides: overrides,
    }
  } catch (error) {
    // ── Rule 8: Router failure fallback ────────────────────────────────
    console.error("Router evaluation failed, using fallback:", error)
    return {
      retrieval_mode: "hybrid",
      needs_clarification: false,
      slot_completeness: 0,
      confidence: classification.router_confidence,
      policy_overrides: ["router_error_fallback"],
    }
  }
}
