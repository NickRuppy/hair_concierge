import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  SCALP_IMAGE_CORRECTION,
  SCALP_IMAGE_CORRECTION_FINGERPRINT,
  SCALP_IMAGE_CORRECTION_MIGRATION,
  applyScalpImageCorrection,
  parseScalpImageCorrectionArgs,
  preflightScalpImageCorrection,
  sha256CorrectionBytes,
  verifyScalpImageCorrection,
} from "../src/lib/product-intake/catalog-enrichment/scalp-image-correction"

const reviewedHead = "a".repeat(40)

function fixture(state: "old" | "new" = "old") {
  const product = {
    id: SCALP_IMAGE_CORRECTION.product_id,
    name: "Multi-Peptide Serum for Hair Density",
    category_key: "scalp_care",
    image_url:
      state === "old"
        ? SCALP_IMAGE_CORRECTION.old_asset.public_url
        : SCALP_IMAGE_CORRECTION.new_asset.public_url,
  }
  const image = {
    product_id: SCALP_IMAGE_CORRECTION.product_id,
    storage_bucket: "product-images",
    storage_path:
      state === "old"
        ? SCALP_IMAGE_CORRECTION.old_asset.storage_path
        : SCALP_IMAGE_CORRECTION.new_asset.storage_path,
    public_url:
      state === "old"
        ? SCALP_IMAGE_CORRECTION.old_asset.public_url
        : SCALP_IMAGE_CORRECTION.new_asset.public_url,
    asset_sha256:
      state === "old"
        ? SCALP_IMAGE_CORRECTION.old_asset.sha256
        : SCALP_IMAGE_CORRECTION.new_asset.sha256,
    source_page_url: SCALP_IMAGE_CORRECTION.new_asset.source_page_url,
    source_image_url: SCALP_IMAGE_CORRECTION.new_asset.source_image_url,
    source_type: "brand",
    quality_confidence: "high",
    processing_method: SCALP_IMAGE_CORRECTION.new_asset.processing_method,
    manifest_batch_id: SCALP_IMAGE_CORRECTION.correction_id,
    user_approved: true,
  }
  const tables: Record<string, Record<string, unknown>[]> = {
    products: [product],
    product_image_assets: [image],
    catalog_enrichment_applied_items: [
      {
        batch_id: SCALP_IMAGE_CORRECTION.source_apply_batch_id,
        product_key: SCALP_IMAGE_CORRECTION.product_key,
        product_id: SCALP_IMAGE_CORRECTION.product_id,
        batch_fingerprint: SCALP_IMAGE_CORRECTION.source_batch_fingerprint,
        content_fingerprint: SCALP_IMAGE_CORRECTION.source_content_fingerprint,
        reviewed_by: "nick",
      },
    ],
    catalog_enrichment_image_corrections:
      state === "new"
        ? [
            {
              correction_id: SCALP_IMAGE_CORRECTION.correction_id,
              product_id: SCALP_IMAGE_CORRECTION.product_id,
              correction_fingerprint: SCALP_IMAGE_CORRECTION_FINGERPRINT,
              old_asset_sha256: SCALP_IMAGE_CORRECTION.old_asset.sha256,
              new_asset_sha256: SCALP_IMAGE_CORRECTION.new_asset.sha256,
              reviewed_by: "nick",
            },
          ]
        : [],
  }
  const objects = new Map<string, Uint8Array>()
  const oldBytes = new Uint8Array(readFileSync(SCALP_IMAGE_CORRECTION.old_asset.local_asset_path))
  const newBytes = new Uint8Array(readFileSync(SCALP_IMAGE_CORRECTION.new_asset.local_asset_path))
  objects.set(SCALP_IMAGE_CORRECTION.old_asset.storage_path, oldBytes)
  if (state === "new") objects.set(SCALP_IMAGE_CORRECTION.new_asset.storage_path, newBytes)
  const read = {
    list: async (table: string, offset: number, limit: number) =>
      (tables[table] ?? []).slice(offset, offset + limit),
    object: async (_bucket: string, path: string) => objects.get(path) ?? null,
    hasTables: async () => [],
    migrationState: async () => "applied" as const,
  }
  return { tables, objects, oldBytes, newBytes, read }
}

test("correction is pinned to the approved product and immutable asset hashes", () => {
  assert.equal(SCALP_IMAGE_CORRECTION.product_id, "58aa2f19-b23a-4e09-ab0f-68c359371c9e")
  assert.equal(
    SCALP_IMAGE_CORRECTION.old_asset.sha256,
    "6bb9be89b327984d4fe8f95c8009896bfec386f04dbf544a208e78268079dd5c",
  )
  assert.equal(
    sha256CorrectionBytes(
      new Uint8Array(readFileSync(SCALP_IMAGE_CORRECTION.new_asset.local_asset_path)),
    ),
    SCALP_IMAGE_CORRECTION.new_asset.sha256,
  )
  assert.match(SCALP_IMAGE_CORRECTION_FINGERPRINT, /^[a-f0-9]{64}$/)
})

test("apply arguments are dry-run by default and require every write confirmation", () => {
  assert.deepEqual(parseScalpImageCorrectionArgs([]), { apply: false, confirm: false })
  assert.deepEqual(
    parseScalpImageCorrectionArgs([
      "--reviewed-by",
      "nick",
      "--reviewed-head",
      reviewedHead,
      "--expect-migration",
      "absent",
    ]),
    {
      apply: false,
      confirm: false,
      reviewed_by: "nick",
      reviewed_head: reviewedHead,
      expect_migration: "absent",
    },
  )
  assert.throws(
    () =>
      parseScalpImageCorrectionArgs([
        "--apply",
        "--reviewed-by=nick",
        `--reviewed-head=${reviewedHead}`,
        "--expect-migration=applied",
      ]),
    /--confirm/,
  )
})

test("preflight accepts only the exact old state and release envelope", async () => {
  const f = fixture()
  const result = await preflightScalpImageCorrection({
    read: f.read,
    release: {
      reviewedHead,
      projectId: "pqdkhefxsxkyeqelqegq",
      expectMigration: "applied",
    },
    gitState: async () => ({ head: reviewedHead, clean: true }),
  })
  assert.equal(result.ok, true, result.blockers.join("; "))

  f.tables.products[0].image_url = "https://unexpected.test/image.webp"
  const drifted = await preflightScalpImageCorrection({
    read: f.read,
    release: {
      reviewedHead,
      projectId: "pqdkhefxsxkyeqelqegq",
      expectMigration: "applied",
    },
    gitState: async () => ({ head: reviewedHead, clean: true }),
  })
  assert.equal(drifted.ok, false)
  assert.match(drifted.blockers.join("; "), /old image URL/)

  f.tables.products[0].image_url = SCALP_IMAGE_CORRECTION.old_asset.public_url
  f.tables.catalog_enrichment_applied_items[0].content_fingerprint = "b".repeat(64)
  const divergentReceipt = await preflightScalpImageCorrection({
    read: f.read,
    release: {
      reviewedHead,
      projectId: "pqdkhefxsxkyeqelqegq",
      expectMigration: "applied",
    },
    gitState: async () => ({ head: reviewedHead, clean: true }),
  })
  assert.equal(divergentReceipt.ok, false)
  assert.match(divergentReceipt.blockers.join("; "), /launch receipt is divergent/)
})

test("apply uploads absent bytes, verifies them, and reports an orphan on RPC failure", async () => {
  const f = fixture()
  let uploadCount = 0
  const preflight = await preflightScalpImageCorrection({
    read: f.read,
    release: {
      reviewedHead,
      projectId: "pqdkhefxsxkyeqelqegq",
      expectMigration: "applied",
    },
    gitState: async () => ({ head: reviewedHead, clean: true }),
  })
  await assert.rejects(
    () =>
      applyScalpImageCorrection({
        args: parseScalpImageCorrectionArgs([
          "--apply",
          "--confirm",
          "--reviewed-by=nick",
          `--reviewed-head=${reviewedHead}`,
          "--expect-migration=applied",
        ]),
        preflight,
        preflightInput: {
          read: f.read,
          release: {
            reviewedHead,
            projectId: "pqdkhefxsxkyeqelqegq",
            expectMigration: "applied",
          },
          gitState: async () => ({ head: reviewedHead, clean: true }),
        },
        image: { bytes: f.newBytes },
        write: {
          upload: async (_bucket, path, bytes) => {
            uploadCount += 1
            f.objects.set(path, bytes)
          },
          object: f.read.object,
          rpc: async () => {
            throw new Error("database refused")
          },
        },
      }),
    new RegExp(`orphan.*${SCALP_IMAGE_CORRECTION.new_asset.storage_path}`, "i"),
  )
  assert.equal(uploadCount, 1)
})

test("verifier proves new rows and both immutable remote objects", async () => {
  const f = fixture("new")
  const result = await verifyScalpImageCorrection(f.read)
  assert.deepEqual(result, { ok: true, blockers: [] })

  f.tables.catalog_enrichment_image_corrections[0].correction_fingerprint = "b".repeat(64)
  const divergent = await verifyScalpImageCorrection(f.read)
  assert.equal(divergent.ok, false)
  assert.match(divergent.blockers.join("; "), /fingerprint/)
})

test("apply preflight accepts an exact already-applied retry and rejects divergent replay", async () => {
  const f = fixture("new")
  const exact = await preflightScalpImageCorrection({
    read: f.read,
    release: {
      reviewedHead,
      projectId: "pqdkhefxsxkyeqelqegq",
      expectMigration: "applied",
    },
    gitState: async () => ({ head: reviewedHead, clean: true }),
    mode: "apply",
  })
  assert.equal(exact.ok, true, exact.blockers.join("; "))
  assert.equal(exact.state, "already_applied")

  f.tables.product_image_assets[0].asset_sha256 = "b".repeat(64)
  const divergent = await preflightScalpImageCorrection({
    read: f.read,
    release: {
      reviewedHead,
      projectId: "pqdkhefxsxkyeqelqegq",
      expectMigration: "applied",
    },
    gitState: async () => ({ head: reviewedHead, clean: true }),
    mode: "apply",
  })
  assert.equal(divergent.ok, false)
  assert.match(divergent.blockers.join("; "), /new image provenance/)
})

test("migration name is pinned for linked release checks", () => {
  assert.match(
    SCALP_IMAGE_CORRECTION_MIGRATION,
    /^\d{14}_catalog_enrichment_scalp_image_correction_v1$/,
  )
  const migration = readFileSync(
    `supabase/migrations/${SCALP_IMAGE_CORRECTION_MIGRATION}.sql`,
    "utf8",
  )
  assert.match(migration, new RegExp(SCALP_IMAGE_CORRECTION_FINGERPRINT))
  assert.match(
    migration,
    /apply_catalog_enrichment_scalp_image_correction_v1\(\s*p_expected_correction_fingerprint text,\s*p_reviewed_by text/,
  )
})

test("operator CLI failures exit non-zero instead of reporting a false success", () => {
  const result = spawnSync(
    process.execPath,
    [
      "--import",
      "./tests/server-only-register.cjs",
      "--import",
      "tsx",
      "scripts/product-intake/catalog-enrichment/scalp-image-correction-preflight.ts",
    ],
    { encoding: "utf8" },
  )
  assert.equal(result.status, 1)
  assert.match(result.stderr, /requires --reviewed-head/)
})
