import "server-only"

import { stage3FitComparisonForTransport } from "./fit-comparison"
import type { Stage3BootstrapResponse, Stage3DraftResponse } from "./gateway"
import {
  Stage3BootstrapReviewContractError,
  requireCompleteStage3DecisionReviews,
  stage3BootstrapRequiresReviewBundles,
  type Stage3DecisionReviewBundle,
} from "./stage3-bootstrap-review-contract"

export async function composeStage3BootstrapResponse(input: {
  loaded: Stage3DraftResponse
  reviewDecisionBundles?: (input: { draftId: string }) => Promise<Stage3DecisionReviewBundle[]>
}): Promise<Stage3BootstrapResponse> {
  const { loaded } = input
  const requiresReviewBundles = stage3BootstrapRequiresReviewBundles(loaded.draft)
  if (requiresReviewBundles && !input.reviewDecisionBundles) {
    throw new Stage3BootstrapReviewContractError()
  }
  const reviewBundles = requiresReviewBundles
    ? await input.reviewDecisionBundles!({ draftId: loaded.draft.draftId })
    : []
  const authorityEvaluations = reviewBundles.map((bundle) => bundle.authorityEvaluation)
  const fitComparisons = reviewBundles.map((bundle) =>
    stage3FitComparisonForTransport(bundle.fitComparison),
  )
  requireCompleteStage3DecisionReviews({
    draft: loaded.draft,
    authorityEvaluations,
    fitComparisons,
  })

  return {
    ...loaded,
    authorityEvaluations,
    fitComparisons,
  }
}
