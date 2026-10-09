import type { Stage3AuthorityEvaluation } from "./authority/contracts"
import { deriveStage3DecisionSubjects, type Stage3ProductDraft } from "./contracts"
import type { Stage3FitComparison } from "./fit-comparison"

export type Stage3DecisionReviewBundle = {
  authorityEvaluation: Stage3AuthorityEvaluation
  fitComparison: Stage3FitComparison
}

export class Stage3BootstrapReviewContractError extends Error {
  constructor() {
    super("stage3_bootstrap_incomplete_decision_reviews")
    this.name = "Stage3BootstrapReviewContractError"
  }
}

export const STAGE3_BOOTSTRAP_REVIEW_CONTRACT_VIOLATION = "incomplete_decision_reviews" as const

/** The exact decision-ready gate; callback availability must not influence it. */
export function stage3BootstrapRequiresReviewBundles(draft: Stage3ProductDraft): boolean {
  return (
    draft.status === "active" &&
    draft.pass !== "product_capture" &&
    draft.pass !== "need_revision_review"
  )
}

/** Inventory dispositions are acknowledged separately and never receive fit authority. */
export function stage3ReviewDecisionSubjects(draft: Stage3ProductDraft) {
  return deriveStage3DecisionSubjects(draft).filter(
    (subject) => subject.subjectKind !== "inventory_disposition",
  )
}

export function hasCompleteStage3DecisionReviews(input: {
  draft: Stage3ProductDraft
  authorityEvaluations: readonly Pick<Stage3AuthorityEvaluation, "subjectKey">[]
  fitComparisons: readonly Pick<Stage3FitComparison, "subjectKey">[]
}): boolean {
  if (!stage3BootstrapRequiresReviewBundles(input.draft)) return true

  const required = stage3ReviewDecisionSubjects(input.draft).map((subject) => subject.decisionKey)
  return (
    hasExactSubjectKeys(required, input.authorityEvaluations) &&
    hasExactSubjectKeys(required, input.fitComparisons)
  )
}

export function requireCompleteStage3DecisionReviews(input: {
  draft: Stage3ProductDraft
  authorityEvaluations: readonly Pick<Stage3AuthorityEvaluation, "subjectKey">[]
  fitComparisons: readonly Pick<Stage3FitComparison, "subjectKey">[]
}) {
  if (!hasCompleteStage3DecisionReviews(input)) throw new Stage3BootstrapReviewContractError()
}

function hasExactSubjectKeys(
  required: readonly string[],
  received: readonly { subjectKey: string }[],
): boolean {
  if (required.length !== received.length) return false
  const requiredKeys = new Set(required)
  if (requiredKeys.size !== required.length) return false
  if (received.some((item) => !item || typeof item.subjectKey !== "string")) return false
  const receivedKeys = new Set(received.map((item) => item.subjectKey))
  return (
    receivedKeys.size === received.length && [...receivedKeys].every((key) => requiredKeys.has(key))
  )
}
