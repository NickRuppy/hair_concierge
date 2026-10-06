import {
  dryRunProductIntakeReadyForReview,
  type ProductIntakeReadyForReviewDryRunInput,
} from "@/lib/product-intake/review-workflow"
import { normalizeCategoryKey } from "@/lib/product-intake/category-research-router"

export type ResearchReadinessSubmissionContext = Pick<
  ProductIntakeReadyForReviewDryRunInput,
  "id" | "user_id" | "source" | "status"
>

/** Approval-owned fields, never a substitute for researched sources or rationales. */
export const RESEARCH_READINESS_HUMAN_GATE_FIELDS = [
  // The review block can be absent until Nick makes the final approval decision.
  "final.review",
  // Only Nick's approval may attest that manual review took place.
  "final.review.manual_reviewed",
  // The review/approval flow supplies the human reviewer's identity.
  "final.review.reviewed_by",
  // The review/approval flow supplies the time of that decision.
  "final.review.reviewed_at",
  // Review notes belong to the human decision, not model-authored research.
  "final.review.notes",
  // Image finalization/upload supplies the approved product-images storage URL.
  "final.product.image_url",
  // approve-package copies the approved image asset digest into the product.
  "final.product.canonical_image_sha256",
  // approve-package copies the approved search thumbnail's public storage URL.
  "final.product.thumbnail_image_url",
] as const

export type ResearchReadinessSelfCheck = {
  ok: boolean
  researchGaps: string[]
  humanGateFields: string[]
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function isHumanGate(path: string): boolean {
  return RESEARCH_READINESS_HUMAN_GATE_FIELDS.some(
    (field) => path === field || path.startsWith(`${field}.`),
  )
}

export function checkResearchReadiness(
  researchedPayload: unknown,
  category: string | null | undefined,
  submission?: ResearchReadinessSubmissionContext,
): ResearchReadinessSelfCheck {
  const payload = record(researchedPayload)
  const final = record(payload?.final)
  const product = record(final?.product)
  const categoryKey = normalizeCategoryKey(category)
  if (!categoryKey) {
    return { ok: false, researchGaps: ["final.product.category_key"], humanGateFields: [] }
  }
  const validate = (researched_payload: unknown) =>
    dryRunProductIntakeReadyForReview({
      id: submission?.id ?? "research-readiness",
      user_id: submission?.user_id,
      source: submission?.source,
      status: submission?.status,
      category: categoryKey,
      researched_payload,
    })
  const original = validate(researchedPayload)
  const humanGateFields = original.missingFields.filter(isHumanGate)

  // Satisfy only approval-owned fields on a copy. Otherwise the schema's review
  // failure would prevent the SAME publish validator from examining category
  // specs/protocols. These placeholders are never persisted or used to approve.
  const researchPayload =
    payload && final
      ? {
          ...payload,
          final: {
            ...final,
            review: { manual_reviewed: true },
            ...(product
              ? {
                  product: {
                    ...product,
                    image_url: null,
                    canonical_image_sha256: null,
                    thumbnail_image_url: null,
                  },
                }
              : {}),
          },
        }
      : researchedPayload
  const researchValidation = validate(researchPayload)
  const researchGaps = Array.from(
    new Set([
      ...original.missingFields.filter((path) => !isHumanGate(path)),
      // Placeholders may still trip approval-owned rules; those never count as research gaps.
      ...researchValidation.missingFields.filter((path) => !isHumanGate(path)),
    ]),
  )
  return { ok: researchGaps.length === 0, researchGaps, humanGateFields }
}
