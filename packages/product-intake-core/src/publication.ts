import type { SupabaseClient } from "@supabase/supabase-js"
import type { ProductIntakeReviewAsset } from "./jobs"

export type ReviewBinding = {
  submission_id: string
  job_id: string | null
  review_cycle_id: string | null
  payload_revision: number
  payload_sha256: string
}
export type ReviewActionRequest = ReviewBinding & {
  request_id: string
  reviewed_by: string
  action:
    | "approve_data"
    | "approve_image"
    | "reject_image"
    | "approve_raw"
    | "answer"
    | "rework"
    | "request_info"
    | "reject"
    | "link_existing"
  field_path?: string
  reviewer_value?: Record<string, unknown> | null
  comment?: string | null
  approved_asset_sha256?: string | null
}
export type ReviewPublishRequest = ReviewBinding & {
  request_id: string
  reviewed_by: string
  data_decision_id: string
  image_decision_id: string
  confirm: true
}
export type ReviewNotificationStatus = "pending" | "sent" | "failed" | "not_required"
export type ReviewPublicationReceipt = ReviewBinding & {
  id: string
  request_id: string
  product_id: string
  brand_id: string
  product_line_id: string | null
  persisted_payload_revision: number
  persisted_payload_sha256: string
  data_decision_id: string
  image_decision_id: string
  approved_asset_sha256: string | null
  reviewed_by: string
  created_at: string
  notification_status: ReviewNotificationStatus
  notification_message_id: string | null
  notification_error_code: string | null
}
export type ReviewAuthorityPreflight = ReviewBinding & {
  ok: boolean
  blockers: string[]
  data_decision_id: string | null
  image_decision_id: string | null
  approved_asset_sha256: string | null
  final_asset: ProductIntakeReviewAsset | null
  thumbnail_asset: ProductIntakeReviewAsset | null
  no_image: boolean
  publication: ReviewPublicationReceipt | null
  legacy_package: boolean
}
export class ProductIntakeReviewError extends Error {
  constructor(
    public readonly code: string,
    public readonly status = 409,
  ) {
    super(code)
    this.name = "ProductIntakeReviewError"
  }
}

/** Only stable operator codes cross the service boundary, never database detail. */
export async function reviewRpc<T>(
  client: Pick<SupabaseClient, "rpc">,
  name: string,
  args: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await client.rpc(name, args)
  if (error) {
    const known = error.message?.match(
      /\b(review_[a-z_]+|publication_[a-z_]+|legacy_[a-z_]+|notification_[a-z_]+)\b/,
    )
    throw new ProductIntakeReviewError(known?.[1] ?? "review_operation_failed", known ? 409 : 500)
  }
  if (!data) throw new ProductIntakeReviewError("review_response_missing", 500)
  return data as T
}

export function loadReviewAuthorityPreflight(
  client: Pick<SupabaseClient, "rpc">,
  submissionId: string,
) {
  return reviewRpc<ReviewAuthorityPreflight>(client, "product_intake_review_preflight", {
    p_submission_id: submissionId,
  })
}
