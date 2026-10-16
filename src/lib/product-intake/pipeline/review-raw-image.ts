import { createHash } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  ProductIntakeResearchJob,
  ProductIntakeReviewAsset,
  ProductIntakeSubmissionDetail,
} from "@chaarlie/product-intake-core"

import { PRODUCT_INTAKE_REVIEW_BUCKET } from "../review-assets"
import { normalizeRecord, stringValue } from "./shared"

type ReviewRawReadClient = Pick<SupabaseClient, "from" | "storage">

const sha256 = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex")
const validHash = (value: string | null): value is string =>
  Boolean(value && /^[a-f0-9]{64}$/.test(value))
const validRevision = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value > 0

type ApprovedRawProgress = {
  assetId: string
  sha256: string
  payloadRevision: number
  decisionId: string
}

function approvedRawProgress(job: ProductIntakeResearchJob): ApprovedRawProgress | null {
  const progress = normalizeRecord(job.progress)
  if (!progress) return null
  const nextStep = stringValue(progress.next_step)
  const source = stringValue(progress.source)
  const hasAnyRawPin =
    progress.approved_raw_asset_id !== undefined ||
    progress.approved_raw_asset_sha256 !== undefined ||
    progress.approved_raw_payload_revision !== undefined
  const isApprovedRawStep =
    source === "admin_review" && nextStep === "process_image_for_final_review"
  if (!hasAnyRawPin && !isApprovedRawStep) return null

  const assetId = stringValue(progress.approved_raw_asset_id)
  const assetSha256 = stringValue(progress.approved_raw_asset_sha256)
  const payloadRevision = progress.approved_raw_payload_revision
  const decisionId = stringValue(progress.review_decision_id)
  if (
    nextStep !== "process_image_for_final_review" ||
    source !== "admin_review" ||
    !assetId ||
    !validHash(assetSha256) ||
    !validRevision(payloadRevision) ||
    !decisionId
  )
    throw new Error("approved_raw_image_pin_invalid")
  return { assetId, sha256: assetSha256, payloadRevision, decisionId }
}

function exactRawApproval(params: {
  detail: ProductIntakeSubmissionDetail
  job: ProductIntakeResearchJob
  pin: ApprovedRawProgress
}) {
  const latest = params.detail.decisions.find(
    (decision) => decision.field_path === "raw.image" && decision.review_action === "approve_raw",
  )
  if (
    !latest ||
    latest.id !== params.pin.decisionId ||
    latest.submission_id !== params.detail.id ||
    latest.job_id !== params.job.id ||
    latest.decision !== "image_approved" ||
    latest.payload_revision !== params.pin.payloadRevision ||
    latest.approved_asset_sha256 !== params.pin.sha256
  )
    throw new Error("approved_raw_image_decision_invalid")
}

function exactAsset(params: {
  asset: ProductIntakeReviewAsset
  detail: ProductIntakeSubmissionDetail
  job: ProductIntakeResearchJob
  pin: ApprovedRawProgress
}) {
  const { asset, detail, job, pin } = params
  if (
    asset.id !== pin.assetId ||
    asset.kind !== "raw" ||
    asset.submission_id !== detail.id ||
    asset.job_id !== job.id ||
    asset.payload_revision !== pin.payloadRevision ||
    asset.sha256 !== pin.sha256 ||
    asset.storage_key !== `${detail.id}/${pin.payloadRevision}/${pin.sha256}` ||
    !validRevision(asset.byte_length) ||
    typeof asset.media_type !== "string" ||
    !["image/jpeg", "image/png", "image/webp", "image/avif"].includes(asset.media_type)
  )
    throw new Error("approved_raw_image_manifest_invalid")
}

/**
 * Returns only the immutable private bytes a human approved. A reviewed remote URL is
 * provenance, never an executable source after `approve_raw` starts its fresh cycle.
 */
export async function loadApprovedRawImageForProcessing(params: {
  supabase: ReviewRawReadClient
  job: ProductIntakeResearchJob
  detail: ProductIntakeSubmissionDetail | null
}): Promise<{ bytes: Buffer; asset: ProductIntakeReviewAsset } | null> {
  const pin = approvedRawProgress(params.job)
  if (!pin) return null
  const detail = params.detail
  if (
    !detail ||
    detail.id !== params.job.submission_id ||
    detail.payload_revision !== pin.payloadRevision
  )
    throw new Error("approved_raw_image_revision_invalid")
  exactRawApproval({ detail, job: params.job, pin })

  const { data, error } = await params.supabase
    .from("product_intake_review_assets")
    .select(
      "id,submission_id,payload_revision,job_id,kind,sha256,storage_key,media_type,byte_length,created_at",
    )
    .eq("id", pin.assetId)
    .maybeSingle()
  if (error || !data) throw error ?? new Error("approved_raw_image_manifest_missing")
  const asset = data as ProductIntakeReviewAsset
  exactAsset({ asset, detail, job: params.job, pin })

  const download = await params.supabase.storage
    .from(PRODUCT_INTAKE_REVIEW_BUCKET)
    .download(asset.storage_key)
  if (download.error || !download.data)
    throw download.error ?? new Error("approved_raw_image_bytes_missing")
  const bytes = Buffer.from(await download.data.arrayBuffer())
  if (bytes.length !== asset.byte_length || sha256(bytes) !== asset.sha256)
    throw new Error("approved_raw_image_bytes_conflict")
  return { bytes, asset }
}
