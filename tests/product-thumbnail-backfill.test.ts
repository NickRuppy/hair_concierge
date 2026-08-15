import assert from "node:assert/strict"
import test from "node:test"

import sharp from "sharp"

import { backfillProductThumbnails } from "../scripts/product-intake/backfill-product-thumbnails"
import { generateProductSearchThumbnail } from "../scripts/product-intake/product-thumbnail"

const PREFIX = "https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/"

async function canonicalImage() {
  return sharp({
    create: {
      width: 1200,
      height: 1200,
      channels: 3,
      background: { r: 243, g: 239, b: 232 },
    },
  })
    .composite([
      {
        input: Buffer.from(
          '<svg width="300" height="900"><rect width="300" height="900" rx="80" fill="#68458f"/></svg>',
        ),
        left: 450,
        top: 150,
      },
    ])
    .webp()
    .toBuffer()
}

test("dry-run accounts for image and no-image rows without writes", async () => {
  const source = await canonicalImage()
  let writes = 0
  const result = await backfillProductThumbnails({
    apply: false,
    rows: [
      {
        id: "with-image",
        name: "With image",
        image_url: `${PREFIX}catalog/with.webp`,
        thumbnail_image_url: null,
      },
      { id: "without-image", name: "Without image", image_url: null, thumbnail_image_url: null },
    ],
    deps: {
      fetchCanonical: async () => source,
      downloadThumbnail: async () => null,
      uploadThumbnail: async () => {
        writes += 1
      },
      updatePointer: async () => {
        writes += 1
        return true
      },
    },
  })

  assert.equal(writes, 0)
  assert.deepEqual(
    result.items.map((item) => [item.product_id, item.status]),
    [
      ["with-image", "planned_create"],
      ["without-image", "not_applicable"],
    ],
  )
})

test("apply creates a missing object and compare-and-set pointer", async () => {
  const source = await canonicalImage()
  const calls: string[] = []
  const result = await backfillProductThumbnails({
    apply: true,
    rows: [
      {
        id: "product-1",
        name: "Product",
        image_url: `${PREFIX}catalog/product.webp`,
        thumbnail_image_url: null,
      },
    ],
    deps: {
      fetchCanonical: async () => source,
      downloadThumbnail: async (path) => {
        calls.push(`download:${path}`)
        return null
      },
      uploadThumbnail: async (path, bytes) => {
        calls.push(`upload:${path}:${bytes.length}`)
      },
      updatePointer: async (id, imageUrl, thumbnailUrl) => {
        calls.push(`update:${id}:${imageUrl}:${thumbnailUrl}`)
        return true
      },
    },
  })

  assert.equal(result.items[0]?.status, "created")
  assert.equal(
    calls.some((call) => call.startsWith("upload:thumbnails/search-v1/")),
    true,
  )
  assert.equal(
    calls.some((call) => call.startsWith("update:product-1:")),
    true,
  )
})

test("apply reuses a valid stored thumbnail and refuses a source-change race", async () => {
  const source = await canonicalImage()
  const probe = await backfillProductThumbnails({
    apply: false,
    rows: [
      {
        id: "product-1",
        name: "Product",
        image_url: `${PREFIX}catalog/product.webp`,
        thumbnail_image_url: null,
      },
    ],
    deps: {
      fetchCanonical: async () => source,
      downloadThumbnail: async () => null,
      uploadThumbnail: async () => {},
      updatePointer: async () => true,
    },
  })
  const expectedUrl = probe.items[0]?.expected_thumbnail_url
  assert.ok(expectedUrl)

  const result = await backfillProductThumbnails({
    apply: true,
    rows: [
      {
        id: "product-1",
        name: "Product",
        image_url: `${PREFIX}catalog/product.webp`,
        thumbnail_image_url: null,
      },
    ],
    deps: {
      fetchCanonical: async () => source,
      downloadThumbnail: async () =>
        sharp({
          create: {
            width: 144,
            height: 144,
            channels: 3,
            background: { r: 255, g: 255, b: 255 },
          },
        })
          .webp()
          .toBuffer(),
      uploadThumbnail: async () => assert.fail("must not overwrite existing thumbnail"),
      updatePointer: async () => false,
    },
  })

  assert.equal(result.items[0]?.status, "refused")
  assert.equal(result.items[0]?.reason, "canonical_source_changed")
})

test("refuses canonical URLs outside the owned product-images bucket", async () => {
  const result = await backfillProductThumbnails({
    apply: false,
    rows: [
      {
        id: "external",
        name: "External",
        image_url: "https://example.test/image.webp",
        thumbnail_image_url: null,
      },
    ],
    deps: {
      fetchCanonical: async () => assert.fail("must not fetch external image"),
      downloadThumbnail: async () => null,
      uploadThumbnail: async () => {},
      updatePointer: async () => true,
    },
  })

  assert.equal(result.items[0]?.status, "refused")
  assert.equal(result.items[0]?.reason, "unsupported_canonical_url")
})

test("a full rerun reuses the matching object and performs zero writes", async () => {
  const canonical = await canonicalImage()
  const generated = await generateProductSearchThumbnail(canonical)
  let uploads = 0
  let updates = 0
  const result = await backfillProductThumbnails({
    apply: true,
    rows: [
      {
        id: "product-1",
        name: "Conditioner",
        image_url: `${PREFIX}canonical.webp`,
        thumbnail_image_url: `${PREFIX}${generated.storagePath}`,
      },
    ],
    deps: {
      fetchCanonical: async () => canonical,
      downloadThumbnail: async () => generated.bytes,
      uploadThumbnail: async () => {
        uploads += 1
      },
      updatePointer: async () => {
        updates += 1
        return true
      },
    },
  })

  assert.equal(result.items[0]?.status, "reused")
  assert.equal(uploads, 0)
  assert.equal(updates, 0)
})
