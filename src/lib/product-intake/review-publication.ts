import { isDeepStrictEqual } from "node:util"
import { createHash } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  loadReviewAuthorityPreflight,
  ProductIntakeReviewError,
  reviewRpc,
  type ReviewBinding,
  type ReviewActionRequest,
  type ReviewPublishRequest,
  type ReviewAuthorityPreflight,
  type ReviewPublicationReceipt,
  type ReviewNotificationStatus,
} from "@chaarlie/product-intake-core"
import type { ProductSubmission } from "@/lib/types"
import {
  dryRunProductIntakeReadyForReview,
  validateBondbuilderOwnerSubmissionApproval,
} from "./review-workflow"
import {
  sendProductIntakeReviewNotification,
  type ProductSubmissionForNotification,
} from "./notifications"
import { copyReviewImagesToPublic, reviewPublicImage } from "./publication-images"
import type { ProductIntakeFinalReviewedPayload } from "./category-validators"

export type { ReviewActionRequest, ReviewPublishRequest, ReviewBinding, ReviewPublicationReceipt }
export { ProductIntakeReviewError }

type StoredSubmission = ProductSubmission & ReviewBinding
const bindingKeys = [
  "submission_id",
  "job_id",
  "review_cycle_id",
  "payload_revision",
  "payload_sha256",
] as const
const receiptKeys = [
  ...bindingKeys,
  "id",
  "request_id",
  "product_id",
  "brand_id",
  "product_line_id",
  "persisted_payload_revision",
  "persisted_payload_sha256",
  "data_decision_id",
  "image_decision_id",
  "approved_asset_sha256",
  "reviewed_by",
  "created_at",
  "notification_status",
  "notification_message_id",
  "notification_error_code",
] as const
function publicReceipt(receipt: ReviewPublicationReceipt): ReviewPublicationReceipt {
  return Object.fromEntries(
    receiptKeys.map((key) => [key, receipt[key]]),
  ) as ReviewPublicationReceipt
}
export type ReviewPublicationPreflight = Omit<
  ReviewAuthorityPreflight,
  "final_asset" | "thumbnail_asset"
> & {
  proposed_final: ProductIntakeFinalReviewedPayload | null
  validation_blockers: string[]
  can_approve_no_image: boolean
}
function assertBinding(actual: ReviewBinding, expected: ReviewBinding) {
  if (bindingKeys.some((key) => actual[key] !== expected[key]))
    throw new ProductIntakeReviewError("review_stale")
}
async function storedSubmission(
  client: SupabaseClient,
  submissionId: string,
): Promise<StoredSubmission> {
  const { data, error } = await client
    .from("product_submissions")
    .select("*")
    .eq("id", submissionId)
    .single()
  if (error || !data) throw new ProductIntakeReviewError("review_submission_missing", 404)
  return data as StoredSubmission
}
function validateStored(submission: ProductSubmission) {
  const owner = validateBondbuilderOwnerSubmissionApproval(submission)
  const validation = owner.ok
    ? owner.validation
    : dryRunProductIntakeReadyForReview({
        id: submission.id,
        category: submission.category,
        researched_payload: submission.researched_payload,
        user_id: submission.user_id,
        source: submission.source,
        status: submission.status,
      })
  return { validation, owner }
}
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}
async function prepare(client: SupabaseClient, submissionId: string) {
  const authority = await loadReviewAuthorityPreflight(client, submissionId)
  const submission = await storedSubmission(client, submissionId)
  const { validation, owner } = validateStored(submission)
  const blockers = [...authority.blockers]
  if (
    submission.payload_revision !== authority.payload_revision ||
    submission.payload_sha256 !== authority.payload_sha256
  )
    blockers.push("review_stale")
  if (!validation.ok && !authority.publication) blockers.push("review_payload_invalid")
  const final = validation.ok ? structuredClone(validation.normalizedPayload.final) : null
  if (final && !authority.publication) {
    const omitImages = (value: unknown) => {
      const copy = structuredClone(record(value))
      const product = record(copy.product)
      for (const key of ["image_url", "canonical_image_sha256", "thumbnail_image_url"])
        delete product[key]
      copy.product = product
      return copy
    }
    if (
      !isDeepStrictEqual(omitImages(final), omitImages(record(submission.researched_payload).final))
    )
      blockers.push("review_payload_normalization_required")
    if (authority.no_image) {
      final.product.image_url = null
      final.product.canonical_image_sha256 = null
      final.product.thumbnail_image_url = null
    } else if (authority.final_asset && authority.thumbnail_asset) {
      const image = reviewPublicImage(
        authority.final_asset.sha256,
        authority.thumbnail_asset.sha256,
      )
      final.product.image_url = image.canonical_url
      final.product.canonical_image_sha256 = image.canonical_sha256
      final.product.thumbnail_image_url = image.thumbnail_url
      // Image artifacts are worker evidence, not arbitrary local paths or model claims.
      if (!authority.legacy_package) {
        const { data, error } = await client
          .from("product_intake_research_artifacts")
          .select("payload")
          .eq("submission_id", submissionId)
          .eq("job_id", authority.job_id!)
          .eq("kind", "processed_image")
          .eq("model", "local-image-finalizer")
          .eq("prompt_version", "product_intake_image_finalization_v1")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
        if (error) throw new ProductIntakeReviewError("review_image_evidence_unavailable", 502)
        const evidence = record(data?.payload)
        if (
          evidence.asset_sha256 !== authority.final_asset.sha256 ||
          evidence.thumbnail_asset_sha256 !== authority.thumbnail_asset.sha256 ||
          record(evidence.quality_gate).status !== "pass"
        )
          blockers.push("review_image_finalizer_invalid")
      } else {
        const evidence = record(
          record(record(submission.researched_payload).draft).review_image_finalization,
        )
        if (
          evidence.asset_sha256 !== authority.final_asset.sha256 ||
          evidence.thumbnail_asset_sha256 !== authority.thumbnail_asset.sha256 ||
          record(evidence.quality_gate).status !== "pass"
        )
          blockers.push("review_image_finalizer_invalid")
      }
    } else blockers.push("review_image_missing")
  }
  return { authority, submission, validation, owner, final, blockers: [...new Set(blockers)] }
}
export async function loadReviewPublicationPreflight(
  client: SupabaseClient,
  submissionId: string,
): Promise<ReviewPublicationPreflight> {
  const state = await prepare(client, submissionId)
  const { final_asset: _final, thumbnail_asset: _thumbnail, ...authority } = state.authority
  return {
    ...authority,
    publication: authority.publication ? publicReceipt(authority.publication) : null,
    ok: state.blockers.length === 0,
    blockers: state.blockers,
    proposed_final: state.final,
    validation_blockers: state.validation.ok ? [] : state.validation.missingFields,
    can_approve_no_image:
      !state.authority.final_asset &&
      ["image_url", "canonical_image_sha256", "thumbnail_image_url"].every(
        (key) =>
          record(record(record(state.submission.researched_payload).final).product)[key] === null,
      ),
  }
}

export type ReviewActionResult = {
  decision: { id: string; action: string; notification_status: ReviewNotificationStatus }
  job: { id: string; status: string; stage: string } | null
}
type DurableNotification = {
  id: string
  submission_id: string
  notification_status: ReviewNotificationStatus
  notification_snapshot: ProductSubmissionForNotification
}
export async function retryReviewNotification(
  client: SupabaseClient,
  target: { publicationId?: string; decisionId?: string },
): Promise<{ notification_status: ReviewNotificationStatus }> {
  if (Boolean(target.publicationId) === Boolean(target.decisionId))
    throw new ProductIntakeReviewError("review_notification_target_invalid", 400)
  const table = target.publicationId
    ? "product_intake_publication_receipts"
    : "product_intake_review_decisions"
  const id = target.publicationId ?? target.decisionId!
  const { data, error } = await client
    .from(table)
    .select("id,submission_id,notification_status,notification_snapshot")
    .eq("id", id)
    .single()
  if (error || !data) throw new ProductIntakeReviewError("review_notification_missing", 404)
  const row = data as DurableNotification
  if (row.notification_status === "sent" || row.notification_status === "not_required")
    return { notification_status: row.notification_status }
  const snapshot = row.notification_snapshot
  if (!snapshot || snapshot.id !== row.submission_id)
    throw new ProductIntakeReviewError("review_notification_snapshot_invalid")
  // Account deletion after publication must suppress the retained snapshot's owner.
  const current = await storedSubmission(client, row.submission_id)
  if (current.user_id && current.user_id !== snapshot.user_id)
    throw new ProductIntakeReviewError("review_notification_owner_changed")
  let status: ReviewNotificationStatus = "failed"
  let messageId: string | null = null
  let errorCode: string | null = null
  try {
    if (
      current.status !== snapshot.status ||
      current.approved_product_id !== snapshot.approved_product_id
    ) {
      errorCode = "notification_requires_reconciliation"
    } else {
      const sent = await sendProductIntakeReviewNotification(
        client,
        { ...snapshot, user_id: current.user_id },
        { eventId: id },
      )
      if (sent.sent) {
        status = "sent"
        messageId = sent.messageId
      } else if (sent.reason === "already_sent") status = "sent"
      else if (sent.reason === "owner_deleted") status = "not_required"
      else errorCode = "review_notification_not_ready"
    }
  } catch {
    errorCode = "review_notification_delivery_failed"
  }
  const completed = await reviewRpc<{
    publication?: ReviewPublicationReceipt
    decision?: { notification_status: ReviewNotificationStatus }
  }>(client, "product_intake_finish_review_notification", {
    p_request: {
      ...(target.publicationId ? { publication_id: id } : { decision_id: id }),
      status,
      message_id: messageId,
      error_code: errorCode,
    },
  })
  return { notification_status: (completed.publication ?? completed.decision)!.notification_status }
}
export async function executeReviewAction(
  client: SupabaseClient,
  request: ReviewActionRequest,
): Promise<ReviewActionResult> {
  if (request.action === "approve_data") {
    const submission = await storedSubmission(client, request.submission_id)
    if (!validateStored(submission).validation.ok)
      throw new ProductIntakeReviewError("review_payload_invalid")
  }
  const result = await reviewRpc<{
    decision: { id: string; notification_status: ReviewNotificationStatus }
    job?: { id: string; status: string; stage: string } | null
  }>(client, "product_intake_record_review_decision", { p_request: request })
  let status = result.decision.notification_status ?? "not_required"
  if (["request_info", "reject", "link_existing"].includes(request.action)) {
    try {
      status = (await retryReviewNotification(client, { decisionId: result.decision.id }))
        .notification_status
    } catch {
      status = "failed"
    }
  }
  return {
    decision: { id: result.decision.id, action: request.action, notification_status: status },
    job: result.job
      ? { id: result.job.id, status: result.job.status, stage: result.job.stage }
      : null,
  }
}
export async function publishReviewedProduct(
  client: SupabaseClient,
  request: ReviewPublishRequest,
): Promise<{ publication: ReviewPublicationReceipt }> {
  if (request.confirm !== true)
    throw new ProductIntakeReviewError("review_confirmation_required", 400)
  // Reconcile the durable request before preflight, uploads, or another catalog call.
  const lookup = await client
    .from("product_intake_publication_receipts")
    .select("*")
    .eq("request_id", request.request_id)
    .maybeSingle()
  if (lookup.error) throw new ProductIntakeReviewError("review_receipt_unavailable", 502)
  if (lookup.data) {
    const receipt = lookup.data as ReviewPublicationReceipt
    assertBinding(receipt, request)
    if (
      receipt.reviewed_by !== request.reviewed_by ||
      receipt.data_decision_id !== request.data_decision_id ||
      receipt.image_decision_id !== request.image_decision_id
    )
      throw new ProductIntakeReviewError("review_request_conflict")
    return { publication: publicReceipt(receipt) }
  }
  const state = await prepare(client, request.submission_id)
  assertBinding(state.authority, request)
  if (state.authority.publication) throw new ProductIntakeReviewError("review_already_published")
  if (
    state.blockers.length ||
    !state.validation.ok ||
    !state.final ||
    state.authority.data_decision_id !== request.data_decision_id ||
    state.authority.image_decision_id !== request.image_decision_id
  )
    throw new ProductIntakeReviewError("review_preflight_failed")
  const publicImage = state.authority.no_image
    ? null
    : await copyReviewImagesToPublic(
        client,
        state.authority,
        state.authority.final_asset!,
        state.authority.thumbnail_asset!,
      )
  const result = await reviewRpc<{ publication: ReviewPublicationReceipt }>(
    client,
    "product_intake_publish_reviewed_submission",
    {
      p_request: {
        ...request,
        final_payload: state.final,
        spec_operations: state.validation.targetSpecOperations,
        public_image: publicImage,
        owner_default: state.owner.ok,
      },
    },
  )
  const receipt = publicReceipt(result.publication)
  try {
    receipt.notification_status = (
      await retryReviewNotification(client, { publicationId: receipt.id })
    ).notification_status
  } catch {
    receipt.notification_status = "failed"
  }
  return { publication: receipt }
}

/** A CLI retry of exactly the same reviewed command must reuse its durable request. */
export function stableReviewRequestId(value: unknown): string {
  function canonical(input: unknown): unknown {
    if (Array.isArray(input)) return input.map(canonical)
    if (input && typeof input === "object")
      return Object.fromEntries(
        Object.entries(input)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, item]) => [key, canonical(item)]),
      )
    return input
  }
  const bytes = createHash("sha256")
    .update(JSON.stringify(canonical(value)))
    .digest()
  bytes[6] = (bytes[6] & 15) | 80
  bytes[8] = (bytes[8] & 63) | 128
  const hex = bytes.subarray(0, 16).toString("hex")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
export function reviewBinding(preflight: ReviewBinding): ReviewBinding {
  return Object.fromEntries(bindingKeys.map((key) => [key, preflight[key]])) as ReviewBinding
}
