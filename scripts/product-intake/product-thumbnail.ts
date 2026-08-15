import { createHash } from "node:crypto"

import sharp from "sharp"

export const PRODUCT_SEARCH_THUMBNAIL_VERSION = "search_thumbnail_v1" as const
export const PRODUCT_SEARCH_THUMBNAIL_SIZE = 144

export type ProductSearchThumbnail = {
  version: typeof PRODUCT_SEARCH_THUMBNAIL_VERSION
  storagePath: string
  sourceSha256: string
  outputSha256: string
  width: typeof PRODUCT_SEARCH_THUMBNAIL_SIZE
  height: typeof PRODUCT_SEARCH_THUMBNAIL_SIZE
  hasAlpha: boolean
  bytes: Buffer
}

function sha256(value: Buffer) {
  return createHash("sha256").update(value).digest("hex")
}

export async function generateProductSearchThumbnail(
  canonicalBytes: Buffer,
): Promise<ProductSearchThumbnail> {
  let sourceMetadata: sharp.Metadata

  try {
    sourceMetadata = await sharp(canonicalBytes, {
      animated: true,
      failOn: "error",
    }).metadata()
  } catch (error) {
    throw new Error("Canonical product asset must be a readable supported image", { cause: error })
  }

  if (!sourceMetadata.format || !sourceMetadata.width || !sourceMetadata.height) {
    throw new Error("Canonical product asset must be a readable supported image")
  }
  if ((sourceMetadata.pages ?? 1) > 1) {
    throw new Error("Animated images are not supported for product thumbnails")
  }

  const sourceSha256 = sha256(canonicalBytes)
  const bytes = await sharp(canonicalBytes, { failOn: "error" })
    .rotate()
    .resize(PRODUCT_SEARCH_THUMBNAIL_SIZE, PRODUCT_SEARCH_THUMBNAIL_SIZE, {
      fit: "cover",
      position: "centre",
    })
    .webp({ quality: 80, effort: 5 })
    .toBuffer()
  const outputMetadata = await sharp(bytes).metadata()

  if (
    outputMetadata.format !== "webp" ||
    outputMetadata.width !== PRODUCT_SEARCH_THUMBNAIL_SIZE ||
    outputMetadata.height !== PRODUCT_SEARCH_THUMBNAIL_SIZE
  ) {
    throw new Error("Generated product thumbnail failed format or dimension verification")
  }

  return {
    version: PRODUCT_SEARCH_THUMBNAIL_VERSION,
    storagePath: `thumbnails/search-v1/${sourceSha256}.webp`,
    sourceSha256,
    outputSha256: sha256(bytes),
    width: PRODUCT_SEARCH_THUMBNAIL_SIZE,
    height: PRODUCT_SEARCH_THUMBNAIL_SIZE,
    hasAlpha: outputMetadata.hasAlpha === true,
    bytes,
  }
}
