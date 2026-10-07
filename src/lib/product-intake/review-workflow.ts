import {
  validateProductIntakeApprovalPayload,
  validateBondbuilderOwnerIntakePayload,
  type ProductIntakeApprovalValidationResult,
  type ProductIntakeReviewCategoryKey,
} from "@/lib/product-intake/category-validators"
import { z } from "zod"

export { validateBondbuilderOwnerIntakePayload } from "@/lib/product-intake/category-validators"

export type ProductIntakeReadyForReviewDryRunInput = {
  id: string
  category: ProductIntakeReviewCategoryKey
  researched_payload: unknown
  user_id?: string | null
  source?: string | null
  status?: string | null
}

export type ProductIntakeReadyForReviewDryRunResult =
  | (ProductIntakeApprovalValidationResult & {
      ok: true
      submissionId: string
      status: "ready_for_review"
      catalog_intake_ready?: true
      global_recommendation_ready?: false
      protocolHold?: "exact_product_protocol_unavailable"
    })
  | (ProductIntakeApprovalValidationResult & {
      ok: false
      submissionId: string
      status: "needs_more_info"
    })

export function dryRunProductIntakeReadyForReview(
  submission: ProductIntakeReadyForReviewDryRunInput,
): ProductIntakeReadyForReviewDryRunResult {
  const normal = validateProductIntakeApprovalPayload(submission.researched_payload)
  const ownerEligible = ownerSubmissionContextValid(submission, false)
  const validation =
    !normal.ok && ownerEligible
      ? validateBondbuilderOwnerIntakePayload(submission.researched_payload)
      : normal

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
    ...(!normal.ok && ownerEligible
      ? {
          catalog_intake_ready: true as const,
          global_recommendation_ready: false as const,
          protocolHold: "exact_product_protocol_unavailable" as const,
        }
      : {}),
  }
}

const OWNER_BONDBUILDER_SOURCES = new Set(["chat", "onboarding", "personal_plan"])
const OWNER_OPEN_RESEARCH_STATUSES = new Set([
  "pending_review",
  "researching",
  "ready_for_review",
  "needs_more_info",
])

function ownerSubmissionContextValid(
  submission: {
    user_id?: string | null
    source?: string | null
    category: string | null
    status?: string | null
  },
  forApproval: boolean,
) {
  return (
    z.string().uuid().safeParse(submission.user_id).success &&
    OWNER_BONDBUILDER_SOURCES.has(submission.source ?? "") &&
    submission.category === "bondbuilder" &&
    (forApproval
      ? submission.status === "ready_for_review"
      : OWNER_OPEN_RESEARCH_STATUSES.has(submission.status ?? ""))
  )
}

/**
 * Narrow admission for a real user's low/default Bondbuilder submission. This
 * is deliberately derived from stored submission context, never a model mode.
 * It permits a held executable protocol but never confers global readiness.
 */
export function validateBondbuilderOwnerSubmissionApproval(submission: {
  id: string
  user_id: string | null
  source: string | null
  category: string | null
  status: string | null
  researched_payload: unknown
}):
  | {
      ok: true
      ownerUserId: string
      catalog_intake_ready: true
      global_recommendation_ready: false
      protocolHold: "exact_product_protocol_unavailable"
      validation: Extract<ProductIntakeApprovalValidationResult, { ok: true }>
    }
  | { ok: false; reason: string } {
  if (!ownerSubmissionContextValid(submission, true))
    return {
      ok: false,
      reason:
        "Bondbuilder owner path requires a real owner, supported source and ready-for-review Bondbuilder submission",
    }
  const validation = validateBondbuilderOwnerIntakePayload(submission.researched_payload)
  if (!validation.ok)
    return { ok: false, reason: "Bondbuilder owner path requires a valid final payload" }
  return {
    ok: true,
    ownerUserId: submission.user_id!,
    catalog_intake_ready: true,
    global_recommendation_ready: false,
    protocolHold: "exact_product_protocol_unavailable",
    validation,
  }
}
