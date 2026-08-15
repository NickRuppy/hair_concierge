import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import test from "node:test"

import sharp from "sharp"

import {
  PRODUCT_SEARCH_THUMBNAIL_VERSION,
  generateProductSearchThumbnail,
} from "../scripts/product-intake/product-thumbnail"

const ANIMATED_GIF = Buffer.from(
  "R0lGODlhAgACAIAAAExpcf8AACH/C05FVFNDQVBFMi4wAwEAAAAh+QQFCgAAACwAAAAAAgACAAACAoxTACH5BAUKAAAALAAAAAACAAIAgExpcQAA/wICjFMAOw==",
  "base64",
)

function sha256(value: Buffer) {
  return createHash("sha256").update(value).digest("hex")
}

test("generates a versioned 144px WebP thumbnail keyed by the full canonical hash", async () => {
  const source = await sharp({
    create: {
      width: 320,
      height: 200,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      {
        input: {
          create: {
            width: 80,
            height: 160,
            channels: 4,
            background: { r: 122, g: 74, b: 163, alpha: 1 },
          },
        },
        left: 120,
        top: 20,
      },
    ])
    .png()
    .toBuffer()

  const result = await generateProductSearchThumbnail(source)
  const sourceSha256 = sha256(source)
  const metadata = await sharp(result.bytes).metadata()

  assert.equal(PRODUCT_SEARCH_THUMBNAIL_VERSION, "search_thumbnail_v1")
  assert.equal(result.version, "search_thumbnail_v1")
  assert.equal(result.sourceSha256, sourceSha256)
  assert.equal(result.outputSha256, sha256(result.bytes))
  assert.equal(result.storagePath, `thumbnails/search-v1/${sourceSha256}.webp`)
  assert.equal(result.width, 144)
  assert.equal(result.height, 144)
  assert.equal(result.hasAlpha, true)
  assert.equal(metadata.format, "webp")
  assert.equal(metadata.width, 144)
  assert.equal(metadata.height, 144)
  assert.equal(metadata.hasAlpha, true)
  assert.ok(result.bytes.length > 100)
  assert.ok(result.bytes.length < source.length)
})

test("produces a different immutable path when canonical bytes change", async () => {
  const first = await sharp({
    create: {
      width: 1200,
      height: 1200,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .jpeg()
    .toBuffer()
  const second = Buffer.from(first)
  second[second.length - 1] ^= 1

  const firstResult = await generateProductSearchThumbnail(first)
  const secondResult = await generateProductSearchThumbnail(second)

  assert.notEqual(firstResult.sourceSha256, secondResult.sourceSha256)
  assert.notEqual(firstResult.storagePath, secondResult.storagePath)
})

test("rejects unreadable and animated canonical files", async () => {
  await assert.rejects(
    generateProductSearchThumbnail(Buffer.from("not an image")),
    /readable supported image/i,
  )
  await assert.rejects(generateProductSearchThumbnail(ANIMATED_GIF), /animated images/i)
})
