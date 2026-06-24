import { createHash } from "node:crypto"
import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import assert from "node:assert/strict"
import test from "node:test"

import {
  buildPublishPayloads,
  buildStoragePath,
  validateManifestBatch,
  validateManifestRow,
} from "../scripts/product-images/manifest"

const fakeHash = createHash("sha256").update("fake").digest("hex")

test("buildStoragePath includes a content hash version", () => {
  const path = buildStoragePath({
    product_id: "11111111-1111-1111-1111-111111111111",
    brand: "Brand",
    name: "Name",
    category: "Shampoo",
    source_page_url: "https://example.com/product",
    source_image_url: "https://example.com/product.jpg",
    source_type: "brand",
    quality_confidence: "high",
    processing_method: "local",
    final_file: "final/brand-name.webp",
    asset_sha256: fakeHash,
    user_approved: "yes",
    notes: "",
  })

  assert.equal(
    path,
    `pilot-2026-06-10/11111111-1111-1111-1111-111111111111/brand-name-${fakeHash.slice(0, 12)}.webp`,
  )
})

test("buildStoragePath accepts an explicit batch id", () => {
  const path = buildStoragePath(
    {
      product_id: "11111111-1111-1111-1111-111111111111",
      brand: "Brand",
      name: "Name",
      category: "Shampoo",
      source_page_url: "https://example.com/product",
      source_image_url: "https://example.com/product.jpg",
      source_type: "brand",
      quality_confidence: "high",
      processing_method: "local",
      final_file: "final/brand-name.webp",
      asset_sha256: fakeHash,
      user_approved: "yes",
      notes: "",
    },
    "catalog-2026-06-11",
  )

  assert.equal(
    path,
    `catalog-2026-06-11/11111111-1111-1111-1111-111111111111/brand-name-${fakeHash.slice(0, 12)}.webp`,
  )
})

test("manifest rows require user approval before publish", () => {
  assert.throws(
    () =>
      validateManifestRow(
        {
          product_id: "p1",
          source_page_url: "https://example.com",
          source_image_url: "",
          source_type: "brand",
          quality_confidence: "high",
          processing_method: "local",
          final_file: "final/p1.webp",
          asset_sha256: fakeHash,
          user_approved: "no",
          brand: "",
          name: "",
          category: "",
          notes: "",
        },
        2,
      ),
    /user_approved must be yes/,
  )
})

test("unknown source rows require notes without throwing TypeError", () => {
  assert.throws(
    () =>
      validateManifestRow(
        {
          product_id: "p1",
          source_page_url: "https://example.com",
          source_image_url: "",
          source_type: "unknown",
          quality_confidence: "medium",
          processing_method: "manual",
          final_file: "final/p1.webp",
          asset_sha256: fakeHash,
          user_approved: "yes",
          brand: "",
          name: "",
          category: "",
        },
        3,
      ),
    /notes are required/,
  )
})

test("buildPublishPayloads verifies file hash and maps audit payload", () => {
  const dir = mkdtempSync(join(tmpdir(), "product-images-"))
  writeFileSync(join(dir, "p1.webp"), "fake")

  const payloads = buildPublishPayloads(
    [
      {
        product_id: "22222222-2222-2222-2222-222222222222",
        brand: "Brand",
        name: "Name",
        category: "Maske",
        source_page_url: "https://example.com/product",
        source_image_url: "",
        source_type: "retailer",
        quality_confidence: "medium",
        processing_method: "third_party",
        final_file: "p1.webp",
        asset_sha256: fakeHash,
        user_approved: "yes",
        notes: "exact SKU match",
      },
    ],
    dir,
    { batchId: "catalog-2026-06-11", expectedCount: 1 },
  )

  assert.equal(payloads[0].storageBucket, "product-images")
  assert.equal(payloads[0].auditRow.manifest_batch_id, "catalog-2026-06-11")
  assert.match(payloads[0].storagePath, /^catalog-2026-06-11\//)
  assert.equal(payloads[0].auditRow.user_approved, true)
  assert.equal(payloads[0].auditRow.source_image_url, null)
  assert.match(payloads[0].publicUrl, /storage\/v1\/object\/public\/product-images/)
})

test("pilot manifest requires exactly 20 products", () => {
  assert.throws(() => validateManifestBatch([], 20), /exactly 20 approved products/)
})

test("pilot manifest rejects duplicate product ids", () => {
  const row = {
    product_id: "33333333-3333-3333-3333-333333333333",
    brand: "Brand",
    name: "Name",
    category: "Maske",
    source_page_url: "https://example.com/product",
    source_image_url: "",
    source_type: "brand" as const,
    quality_confidence: "high" as const,
    processing_method: "local" as const,
    final_file: "p1.webp",
    asset_sha256: fakeHash,
    user_approved: "yes" as const,
    notes: "",
  }

  assert.throws(() => validateManifestBatch([row, row], 2), /duplicate product_id/)
})

test("buildPublishPayloads rejects files outside the batch directory", () => {
  const dir = mkdtempSync(join(tmpdir(), "product-images-"))

  assert.throws(
    () =>
      buildPublishPayloads(
        [
          {
            product_id: "44444444-4444-4444-4444-444444444444",
            brand: "Brand",
            name: "Name",
            category: "Maske",
            source_page_url: "https://example.com/product",
            source_image_url: "",
            source_type: "brand",
            quality_confidence: "high",
            processing_method: "local",
            final_file: "../outside.webp",
            asset_sha256: fakeHash,
            user_approved: "yes",
            notes: "",
          },
        ],
        dir,
        { expectedCount: 1 },
      ),
    /inside the batch directory/,
  )
})
