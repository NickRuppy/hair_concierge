import {
  validateProductIntakeApprovalPayload,
  type ProductIntakeApprovalValidationResult,
  type ProductIntakeReviewCategoryKey,
} from "@/lib/product-intake/category-validators"

export type ProductIntakeReadyForReviewDryRunInput = {
  id: string
  category: ProductIntakeReviewCategoryKey
  researched_payload: unknown
}

export type ProductIntakeReadyForReviewDryRunResult =
  | (ProductIntakeApprovalValidationResult & {
      ok: true
      submissionId: string
      status: "ready_for_review"
    })
  | (ProductIntakeApprovalValidationResult & {
      ok: false
      submissionId: string
      status: "needs_more_info"
    })

export function dryRunProductIntakeReadyForReview(
  submission: ProductIntakeReadyForReviewDryRunInput,
): ProductIntakeReadyForReviewDryRunResult {
  const validation = validateProductIntakeApprovalPayload(submission.researched_payload)

  if (!validation.ok) {
    return {
      ...validation,
      submissionId: submission.id,
      status: "needs_more_info",
    }
  }

  if (validation.normalizedPayload.final.product.category_key !== submission.category) {
    return {
      ok: false,
      missingFields: ["final.product.category_key"],
      normalizedPayload: null,
      targetSpecOperations: [],
      submissionId: submission.id,
      status: "needs_more_info",
    }
  }

  return {
    ...validation,
    submissionId: submission.id,
    status: "ready_for_review",
  }
}
