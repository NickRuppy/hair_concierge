import "server-only"

import type { Stage3AuthorityEvaluation } from "./authority/contracts"
import { stage3FitComparisonForTransport, type Stage3FitComparison } from "./fit-comparison"
import type { Stage3BootstrapResponse, Stage3DraftResponse } from "./gateway"

type ReviewBundle = {
  authorityEvaluation: Stage3AuthorityEvaluation
  fitComparison: Stage3FitComparison
}

export async function composeStage3BootstrapResponse(input: {
  loaded: Stage3DraftResponse
  evaluateDecisions?: (input: { draftId: string }) => Promise<Stage3AuthorityEvaluation[]>
  reviewDecisionBundles?: (input: { draftId: string }) => Promise<ReviewBundle[]>
}): Promise<Stage3BootstrapResponse> {
  const { loaded } = input
  const usesReviewBundles =
    loaded.draft.status === "active" &&
    loaded.draft.pass !== "product_capture" &&
    loaded.draft.pass !== "need_revision_review" &&
    Boolean(input.reviewDecisionBundles)
  const reviewBundles =
    !usesReviewBundles || !input.reviewDecisionBundles
      ? []
      : await input.reviewDecisionBundles({ draftId: loaded.draft.draftId })
  const authorityEvaluations = usesReviewBundles
    ? reviewBundles.map((bundle) => bundle.authorityEvaluation)
    : loaded.draft.status !== "active" ||
        loaded.draft.pass === "product_capture" ||
        loaded.draft.pass === "need_revision_review" ||
        !input.evaluateDecisions
      ? []
      : await input.evaluateDecisions({ draftId: loaded.draft.draftId })

  return {
    ...loaded,
    authorityEvaluations,
    fitComparisons: reviewBundles.map((bundle) =>
      stage3FitComparisonForTransport(bundle.fitComparison),
    ),
  }
}
