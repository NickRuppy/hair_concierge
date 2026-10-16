import "server-only"
import { createHash } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import sharp from "sharp"
import { z } from "zod"
import {
  PRODUCT_INTAKE_REVIEW_ASSET_KINDS,
  type ProductIntakeReviewAsset,
  type ProductIntakeReviewAssetInput,
  type ProductIntakeReviewAssetKind,
} from "@chaarlie/product-intake-core"

export const PRODUCT_INTAKE_REVIEW_BUCKET = "product-intake-review"
export const REVIEW_IMAGE_URL_SECONDS = 300
type StorageClient = Pick<SupabaseClient, "storage">
const uuid = z.string().uuid()
const sha256 = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex")
const revisionIsValid = (value: number) => Number.isSafeInteger(value) && value > 0

function assetKey(submissionId: string, revision: number, hash: string) {
  if (
    !uuid.safeParse(submissionId).success ||
    !revisionIsValid(revision) ||
    !/^[a-f0-9]{64}$/.test(hash)
  )
    throw new Error("invalid_review_asset_identity")
  return `${submissionId}/${revision}/${hash}`
}

async function imageMediaType(bytes: Buffer) {
  const metadata = await sharp(bytes).metadata()
  if (metadata.format === "jpeg") return "image/jpeg"
  if (metadata.format === "png") return "image/png"
  if (metadata.format === "webp") return "image/webp"
  if (metadata.format === "heif" && bytes.subarray(8, 64).includes(Buffer.from("avif")))
    return "image/avif"
  throw new Error("unsupported_review_image")
}

/** Upload prepared server-owned bytes; never trust model paths or hash claims. */
export async function uploadProductReviewAsset(params: {
  client: StorageClient
  submissionId: string
  payloadRevision: number
  kind: ProductIntakeReviewAssetKind
  bytes: Buffer
}): Promise<ProductIntakeReviewAssetInput> {
  if (!PRODUCT_INTAKE_REVIEW_ASSET_KINDS.includes(params.kind))
    throw new Error("invalid_review_asset_kind")
  const hash = sha256(params.bytes)
  const key = assetKey(params.submissionId, params.payloadRevision, hash)
  const mediaType = await imageMediaType(params.bytes)
  const bucket = params.client.storage.from(PRODUCT_INTAKE_REVIEW_BUCKET)
  const { error } = await bucket.upload(key, params.bytes, {
    upsert: false,
    contentType: mediaType,
  })
  if (error) {
    const duplicate = error as { status?: number; statusCode?: string }
    if (duplicate.status !== 409 && duplicate.statusCode !== "409") throw error
    const existing = await bucket.download(key)
    if (existing.error || !existing.data) throw existing.error ?? new Error("review_asset_missing")
    const stored = Buffer.from(await existing.data.arrayBuffer())
    if (stored.length !== params.bytes.length || sha256(stored) !== hash)
      throw new Error("review_asset_bytes_conflict")
  }
  return {
    kind: params.kind,
    sha256: hash,
    storage_key: key,
    media_type: mediaType,
    byte_length: params.bytes.length,
  }
}

/** Call only after requireAdmin and a committed-manifest read for the current revision. */
export async function signProductReviewAsset(params: {
  client: StorageClient
  asset: ProductIntakeReviewAsset
  submissionId: string
  payloadRevision: number
}): Promise<string> {
  const { asset } = params
  if (
    asset.submission_id !== params.submissionId ||
    asset.payload_revision !== params.payloadRevision ||
    !uuid.safeParse(asset.id).success ||
    !PRODUCT_INTAKE_REVIEW_ASSET_KINDS.includes(asset.kind) ||
    asset.storage_key !== assetKey(params.submissionId, params.payloadRevision, asset.sha256)
  )
    throw new Error("stale_or_invalid_review_asset")
  const { data, error } = await params.client.storage
    .from(PRODUCT_INTAKE_REVIEW_BUCKET)
    .createSignedUrl(asset.storage_key, REVIEW_IMAGE_URL_SECONDS)
  if (error || !data?.signedUrl) throw error ?? new Error("review_asset_signing_failed")
  return data.signedUrl
}
