import type {
  ClassificationResult,
  RouterDecision,
  IntentType,
  Message,
  HairProfile,
  RetrievalMode,
  ResponseMode,
} from "@/lib/types"
import { buildLeaveInDecision } from "@/lib/rag/leave-in-decision"
import { buildOilDecision } from "@/lib/rag/oil-decision"
import { deriveRoutineContext } from "@/lib/routines/planner"
import { getShampooProfileCompleteness, isShampooProfileEligible } from "@/lib/rag/shampoo-decision"
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
 * Counts how many prior assistant turns used a given response mode.
 * Reads from the persisted rag_context.response_mode metadata.
 */
function countResponseModeRounds(conversationHistory: Message[], mode: ResponseMode): number {
  let count = 0
  for (const msg of conversationHistory) {
    if (msg.role !== "assistant") continue
    if (msg.rag_context?.response_mode === mode) {
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
  intent: IntentType,
  filters: Record<string, string | string[] | null>,
  productCategory: string | null,
  hairProfile: HairProfile | null,
  userMessage = "",
): { score: number; rawCount: number } {
  if (intent === "routine_help" || productCategory === "routine") {
    const routineContext = deriveRoutineContext(hairProfile, userMessage)
    const rawCount =
      Number(routineContext.organizer_complete) +
      Number(routineContext.cadence_complete) +
      Number(routineContext.inventory_complete)

    return {
      score: rawCount / 3,
      rawCount,
    }
  }

  if (productCategory === "shampoo") {
    const { filledCount, score } = getShampooProfileCompleteness(hairProfile)

    return {
      score,
      rawCount: filledCount,
    }
  }

  if (productCategory === "leave_in") {
    const decision = buildLeaveInDecision(hairProfile)
    const filledCount = 5 - decision.missing_profile_fields.length

    return {
      score: filledCount / 5,
      rawCount: filledCount,
    }
  }

  if (productCategory === "oil") {
    const decision = buildOilDecision(hairProfile, userMessage)
    const filledCount = 2 - decision.missing_profile_fields.length

    return {
      score: filledCount / 2,
      rawCount: filledCount,
    }
  }

  let filledCount = 0

  for (const key of ROUTER_SLOT_KEYS) {
    const val = filters[key]
    if (val !== null && val !== undefined) {
      if (Array.isArray(val) ? val.length > 0 : typeof val === "string" && val.trim() !== "") {
        filledCount++
      }
    }
  }

  // Category-specific bonus: count profile data as partial slot fills
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
  userMessage = "",
): RouterDecision {
  try {
    const { intent, product_category, complexity, router_confidence, normalized_filters } =
      classification
    const overrides: string[] = []
    let retrieval_mode: RetrievalMode = classification.retrieval_mode
    // Do NOT seed from classifier's needs_clarification — router decides independently
    let responseMode: ResponseMode = "answer_direct"
    let clarification_reason: string | undefined

    const { score: slotScore, rawCount: filledSlotCount } = computeSlotCompleteness(
      intent,
      normalized_filters,
      product_category,
      hairProfile,
      userMessage,
    )
    const leaveInDecision =
      product_category === "leave_in" ? buildLeaveInDecision(hairProfile) : null
    const oilDecision =
      product_category === "oil" ? buildOilDecision(hairProfile, userMessage) : null

    // ── Rule 2: FAQ shortcut ───────────────────────────────────────────
    if (complexity === "simple" && router_confidence >= 0.9 && !PRODUCT_INTENTS.includes(intent)) {
      retrieval_mode = "faq"
      overrides.push("faq_shortcut")
    }

    // ── Rule 3: Category-specific defaults (only for product intents) ──
    if (
      PRODUCT_INTENTS.includes(intent) &&
      (product_category === "shampoo" ||
        product_category === "conditioner" ||
        product_category === "mask" ||
        product_category === "leave_in" ||
        product_category === "oil")
    ) {
      retrieval_mode = "product_sql_plus_hybrid"
      overrides.push("category_product_mode")
    }

    // ── Rules 3b-3e: Mandatory profile gates → clarify_only ─────────────
    const shampooProfileEligible = isShampooProfileEligible(hairProfile)
    if (
      PRODUCT_INTENTS.includes(intent) &&
      product_category === "shampoo" &&
      !shampooProfileEligible
    ) {
      responseMode = "clarify_only"
      clarification_reason = clarification_reason
        ? clarification_reason + "+missing_shampoo_profile"
        : "missing_shampoo_profile"
      overrides.push("missing_shampoo_profile")
    }

    if (
      PRODUCT_INTENTS.includes(intent) &&
      product_category === "conditioner" &&
      (!hairProfile?.thickness || !hairProfile?.protein_moisture_balance)
    ) {
      responseMode = "clarify_only"
      clarification_reason = clarification_reason
        ? clarification_reason + "+missing_conditioner_profile"
        : "missing_conditioner_profile"
      overrides.push("missing_conditioner_profile")
    }

    if (
      PRODUCT_INTENTS.includes(intent) &&
      product_category === "leave_in" &&
      leaveInDecision &&
      !leaveInDecision.eligible
    ) {
      responseMode = "clarify_only"
      clarification_reason = clarification_reason
        ? clarification_reason + "+missing_leave_in_profile"
        : "missing_leave_in_profile"
      overrides.push("missing_leave_in_profile")
    }

    if (
      PRODUCT_INTENTS.includes(intent) &&
      product_category === "oil" &&
      oilDecision &&
      !oilDecision.eligible
    ) {
      responseMode = "clarify_only"
      clarification_reason = clarification_reason
        ? clarification_reason + "+missing_oil_profile"
        : "missing_oil_profile"
      overrides.push("missing_oil_profile")
    }

    // ── Rule 4: Low confidence → recommend_and_refine ────────────────────
    if (
      responseMode !== "clarify_only" &&
      router_confidence < ROUTER_CONFIDENCE_THRESHOLD &&
      CONTEXT_SENSITIVE_INTENTS.includes(intent)
    ) {
      responseMode = "recommend_and_refine"
      overrides.push("low_confidence")
    }

    // ── Rule 4b: Missing routine frame → clarify_only ─────────────────
    if ((intent === "routine_help" || product_category === "routine") && filledSlotCount < 3) {
      responseMode = "clarify_only"
      clarification_reason = "missing_routine_frame"
      overrides.push("missing_routine_frame")
    }

    // ── Rule 5: Missing slots → recommend_and_refine ──────────────────
    // Category-aware: known category needs 1 slot, null category needs 2
    const slotThreshold =
      intent === "diagnosis"
        ? 1
        : product_category
          ? ROUTER_MIN_SLOTS_PRODUCT
          : Math.max(ROUTER_MIN_SLOTS_PRODUCT, 2)
    if (
      responseMode !== "clarify_only" &&
      CONTEXT_SENSITIVE_INTENTS.includes(intent) &&
      !(intent === "routine_help" || product_category === "routine") &&
      filledSlotCount < slotThreshold
    ) {
      responseMode = "recommend_and_refine"
      overrides.push("missing_slots")
    }

    // ── Rule 6: Follow-up cap ─────────────────────────────────────────
    const hasMandatoryProfileGap =
      overrides.includes("missing_shampoo_profile") ||
      overrides.includes("missing_conditioner_profile") ||
      overrides.includes("missing_leave_in_profile") ||
      overrides.includes("missing_oil_profile")
    const priorFollowupRounds =
      countResponseModeRounds(conversationHistory, "recommend_and_refine") +
      countResponseModeRounds(conversationHistory, "clarify_only")
    if (!hasMandatoryProfileGap && priorFollowupRounds >= ROUTER_MAX_CLARIFICATION_ROUNDS) {
      if (responseMode !== "answer_direct") {
        responseMode = "answer_direct"
        clarification_reason = undefined
        overrides.push("clarification_cap_reached")
      }
    }

    // ── Rule 7: Fallback ───────────────────────────────────────────────
    // If no rule set a specific mode, default to hybrid
    if (!overrides.some((o) => o === "faq_shortcut" || o === "category_product_mode")) {
      retrieval_mode = "hybrid"
    }

    return {
      retrieval_mode,
      response_mode: responseMode,
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
      response_mode: "answer_direct",
      slot_completeness: 0,
      confidence: classification.router_confidence,
      policy_overrides: ["router_error_fallback"],
    }
  }
}
