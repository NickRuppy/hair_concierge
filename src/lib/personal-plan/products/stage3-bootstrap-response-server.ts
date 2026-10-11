import "server-only"

import { stage3FitComparisonForTransport } from "./fit-comparison"
import type {
  Stage3BootstrapBudgetEnvelope,
  Stage3BootstrapResponse,
  Stage3DraftResponse,
} from "./gateway"
import {
  Stage3BootstrapReviewContractError,
  requireCompleteStage3DecisionReviews,
  stage3BootstrapIsDecisionReady,
  stage3BootstrapRequiresReviewBundles,
  type Stage3DecisionReviewBundle,
} from "./stage3-bootstrap-review-contract"

export async function composeStage3BootstrapResponse(input: {
  loaded: Stage3DraftResponse
  reviewDecisionBundles?: (input: { draftId: string }) => Promise<Stage3DecisionReviewBundle[]>
  /** Budget gate (flag on). Omitted or resolving to null: unchanged behaviour and bytes. */
  shoppingBudgetEnvelope?: (input: {
    draft: Stage3DraftResponse["draft"]
  }) => Promise<Stage3BootstrapBudgetEnvelope | null>
}): Promise<Stage3BootstrapResponse> {
  const { loaded } = input
  // Only a decision-ready draft carries budget state: capture and need-revision passes never do.
  const budget =
    stage3BootstrapIsDecisionReady(loaded.draft) && input.shoppingBudgetEnvelope
      ? await input.shoppingBudgetEnvelope({ draft: loaded.draft })
      : null
  if (budget?.status === "budget_required") {
    return { ...loaded, authorityEvaluations: [], fitComparisons: [], budget }
  }
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
    ...(budget ? { budget } : {}),
  }
}
