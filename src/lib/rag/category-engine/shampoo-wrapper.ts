/**
 * Shampoo category wrapper.
 * Groups decision building, clarification, retrieval filter, and annotation.
 * All functions delegate to existing shampoo-decision.ts — no new logic.
 */
export {
  buildShampooDecision,
  buildShampooClarificationQuestions,
  buildShampooRetrievalFilter,
  annotateShampooRecommendations,
  isShampooProfileEligible,
  getShampooProfileCompleteness,
  getMissingShampooProfileFields,
} from "@/lib/rag/shampoo-decision"
