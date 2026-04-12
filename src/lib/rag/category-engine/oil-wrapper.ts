/**
 * Oil category wrapper.
 * Groups decision building, clarification, retrieval filter, and annotation.
 */
export {
  buildOilDecision,
  buildOilClarificationQuestions,
  buildOilRetrievalFilter,
  annotateOilRecommendations,
  getOilNoRecommendationMessage,
} from "@/lib/rag/oil-decision"
