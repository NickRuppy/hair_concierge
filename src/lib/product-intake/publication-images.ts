import { createHash } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import sharp from "sharp"
import type {
  ProductIntakeReviewAsset,
  ProductIntakeReviewAssetInput,
  ProductIntakeReviewAssetKind,
  ReviewBinding,
} from "@chaarlie/product-intake-core"
import { ProductIntakeReviewError } from "@chaarlie/product-intake-core"

const PUBLIC_PREFIX =
  "https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/"
export const imageSha256 = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex")
export function reviewPublicImage(finalHash: string, thumbnailHash: string) {
  if (![finalHash, thumbnailHash].every((hash) => /^[a-f0-9]{64}$/.test(hash)))
    throw new ProductIntakeReviewError("review_image_invalid")
  return {
    canonical_url: `${PUBLIC_PREFIX}product-intake/review/${finalHash}.webp`,
    canonical_sha256: finalHash,
    thumbnail_url: `${PUBLIC_PREFIX}thumbnails/search-v1/${finalHash}.webp`,
    thumbnail_sha256: thumbnailHash,
  }
}
export async function validateFinalImageBytes(bytes: Buffer, thumbnail = false) {
  const meta = await sharp(bytes).metadata()
  const dimension = thumbnail ? 144 : 1200
  if (
    meta.format !== "webp" ||
    meta.width !== dimension ||
    meta.height !== dimension ||
    !bytes.length ||
    (thumbnail && bytes.length > 200_000)
  )
    throw new ProductIntakeReviewError("review_image_dimensions_invalid")
}

/** Concurrent writes may win, but no existing object is ever overwritten or trusted by URL. */
export async function ensureImmutableImage(
  client: Pick<SupabaseClient, "storage">,
  bucketName: string,
  key: string,
  bytes: Buffer,
  mediaType: string,
) {
  const bucket = client.storage.from(bucketName)
  const upload = await bucket.upload(key, bytes, {
    upsert: false,
    contentType: mediaType,
    cacheControl: "31536000",
  })
  if (upload.error) {
    const error = upload.error as { status?: number; statusCode?: string }
    if (Number(error.status ?? error.statusCode) !== 409)
      throw new ProductIntakeReviewError("review_image_upload_failed", 502)
  }
  const verified = await bucket.download(key)
  if (verified.error || !verified.data)
    throw new ProductIntakeReviewError("review_image_verify_failed", 502)
  const actual = Buffer.from(await verified.data.arrayBuffer())
  if (actual.length !== bytes.length || imageSha256(actual) !== imageSha256(bytes))
    throw new ProductIntakeReviewError("review_image_bytes_conflict")
}

export async function uploadLegacyReviewImage(
  client: Pick<SupabaseClient, "storage">,
  binding: ReviewBinding,
  kind: ProductIntakeReviewAssetKind,
  bytes: Buffer,
): Promise<ProductIntakeReviewAssetInput> {
  const meta = await sharp(bytes).metadata()
  const media =
    meta.format === "jpeg"
      ? "image/jpeg"
      : meta.format === "png"
        ? "image/png"
        : meta.format === "webp"
          ? "image/webp"
          : null
  if (!media) throw new ProductIntakeReviewError("review_image_invalid")
  const hash = imageSha256(bytes)
  const key = `${binding.submission_id}/${binding.payload_revision}/${hash}`
  await ensureImmutableImage(client, "product-intake-review", key, bytes, media)
  return { kind, sha256: hash, storage_key: key, media_type: media, byte_length: bytes.length }
}

async function readReviewImage(
  client: Pick<SupabaseClient, "storage">,
  binding: ReviewBinding,
  asset: ProductIntakeReviewAsset,
  kind: "final" | "search_thumbnail",
) {
  if (
    asset.kind !== kind ||
    asset.submission_id !== binding.submission_id ||
    asset.payload_revision !== binding.payload_revision ||
    asset.job_id !== binding.job_id ||
    asset.storage_key !== `${binding.submission_id}/${binding.payload_revision}/${asset.sha256}` ||
    !/^[a-f0-9]{64}$/.test(asset.sha256)
  )
    throw new ProductIntakeReviewError("review_image_binding_invalid")
  const result = await client.storage.from("product-intake-review").download(asset.storage_key)
  if (result.error || !result.data) throw new ProductIntakeReviewError("review_image_missing", 502)
  const bytes = Buffer.from(await result.data.arrayBuffer())
  if (
    bytes.length !== asset.byte_length ||
    imageSha256(bytes) !== asset.sha256 ||
    asset.media_type !== "image/webp"
  )
    throw new ProductIntakeReviewError("review_image_bytes_conflict")
  await validateFinalImageBytes(bytes, kind === "search_thumbnail")
  return bytes
}
export async function copyReviewImagesToPublic(
  client: Pick<SupabaseClient, "storage">,
  binding: ReviewBinding,
  final: ProductIntakeReviewAsset,
  thumbnail: ProductIntakeReviewAsset,
) {
  // Read and validate both before making either public.
  const finalBytes = await readReviewImage(client, binding, final, "final")
  const thumbnailBytes = await readReviewImage(client, binding, thumbnail, "search_thumbnail")
  const image = reviewPublicImage(final.sha256, thumbnail.sha256)
  await ensureImmutableImage(
    client,
    "product-images",
    image.canonical_url.slice(PUBLIC_PREFIX.length),
    finalBytes,
    "image/webp",
  )
  await ensureImmutableImage(
    client,
    "product-images",
    image.thumbnail_url.slice(PUBLIC_PREFIX.length),
    thumbnailBytes,
    "image/webp",
  )
  return image
}
