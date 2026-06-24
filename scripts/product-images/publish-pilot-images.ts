import { config as loadEnv } from "dotenv"
import { readFileSync } from "node:fs"
import { extname, join } from "node:path"
import { createClient } from "@supabase/supabase-js"

import {
  DEFAULT_PRODUCT_IMAGE_BATCH_ID,
  DEFAULT_PRODUCT_IMAGE_EXPECTED_COUNT,
  PRODUCT_IMAGE_BUCKET,
  buildPublishPayloads,
  readProductImageManifest,
} from "./manifest"

loadEnv({ path: ".env.local" })

const dry = process.argv.includes("--dry-run")
const batchDir =
  process.argv.find((arg) => arg.startsWith("--batch-dir="))?.slice("--batch-dir=".length) ??
  "data/product-images/pilot-2026-06-10"
const manifestPath =
  process.argv.find((arg) => arg.startsWith("--manifest="))?.slice("--manifest=".length) ??
  join(batchDir, "manifest.csv")
const batchId =
  process.argv.find((arg) => arg.startsWith("--batch-id="))?.slice("--batch-id=".length) ??
  DEFAULT_PRODUCT_IMAGE_BATCH_ID
const expectedCount = Number(
  process.argv
    .find((arg) => arg.startsWith("--expected-count="))
    ?.slice("--expected-count=".length) ?? DEFAULT_PRODUCT_IMAGE_EXPECTED_COUNT,
)

if (!Number.isInteger(expectedCount) || expectedCount <= 0) {
  throw new Error(`--expected-count must be a positive integer, got ${expectedCount}`)
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

function contentTypeFor(path: string): string {
  switch (extname(path).toLowerCase()) {
    case ".webp":
      return "image/webp"
    case ".png":
      return "image/png"
    case ".jpg":
    case ".jpeg":
      return "image/jpeg"
    default:
      throw new Error(`Unsupported image extension: ${path}`)
  }
}

function storageFolder(path: string): string {
  return path.split("/").slice(0, -1).join("/")
}

function storageFileName(path: string): string {
  return path.split("/").at(-1) ?? path
}

async function storageObjectExists(path: string): Promise<boolean> {
  const { data, error } = await supabase.storage
    .from(PRODUCT_IMAGE_BUCKET)
    .list(storageFolder(path), {
      search: storageFileName(path),
    })

  if (error) {
    throw new Error(`Storage lookup failed for ${path}: ${error.message}`)
  }

  return (data ?? []).some((object) => object.name === storageFileName(path))
}

async function preflightStorageBucket(): Promise<void> {
  const { data, error } = await supabase.storage.listBuckets()

  if (error) {
    throw new Error(`Storage bucket preflight failed: ${error.message}`)
  }

  if (
    !(data ?? []).some(
      (bucket) => bucket.name === PRODUCT_IMAGE_BUCKET || bucket.id === PRODUCT_IMAGE_BUCKET,
    )
  ) {
    throw new Error(`Storage bucket preflight failed: missing bucket ${PRODUCT_IMAGE_BUCKET}`)
  }
}

async function preflightDatabase(payloads: ReturnType<typeof buildPublishPayloads>): Promise<void> {
  const productIds = [...new Set(payloads.map((payload) => payload.productId))]
  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("id")
    .in("id", productIds)

  if (productsError) {
    throw new Error(`Product preflight failed: ${productsError.message}`)
  }

  const foundProductIds = new Set((products ?? []).map((product) => product.id as string))
  const missingProductIds = productIds.filter((productId) => !foundProductIds.has(productId))
  if (missingProductIds.length > 0) {
    throw new Error(`Product preflight failed: missing products ${missingProductIds.join(", ")}`)
  }

  const { error: auditTableError } = await supabase
    .from("product_image_assets")
    .select("id")
    .limit(1)

  if (auditTableError) {
    throw new Error(`Product image audit table preflight failed: ${auditTableError.message}`)
  }
}

async function main(): Promise<void> {
  const rows = readProductImageManifest(manifestPath)
  const payloads = buildPublishPayloads(rows, batchDir, { batchId, expectedCount })

  console.log(
    `Validated ${payloads.length} approved image payloads from ${manifestPath} for batch ${batchId}.`,
  )
  await preflightStorageBucket()
  console.log("Storage bucket preflight passed.")
  await preflightDatabase(payloads)
  console.log("Database preflight passed.")

  for (const payload of payloads) {
    const alreadyUploaded = await storageObjectExists(payload.storagePath)
    let uploadedThisRun = false

    if (dry) {
      console.log(
        `DRY product=${payload.productId} upload=${payload.storagePath} exists=${alreadyUploaded} url=${payload.publicUrl}`,
      )
      continue
    }

    if (!alreadyUploaded) {
      const file = readFileSync(payload.localFilePath)
      const { error: uploadError } = await supabase.storage
        .from(PRODUCT_IMAGE_BUCKET)
        .upload(payload.storagePath, file, {
          contentType: contentTypeFor(payload.localFilePath),
          cacheControl: "31536000",
          upsert: false,
        })

      if (uploadError) {
        throw new Error(`Upload failed for ${payload.storagePath}: ${uploadError.message}`)
      }
      uploadedThisRun = true
    }

    try {
      const { error: publishError } = await supabase.rpc("publish_product_image_asset", {
        p_product_id: payload.auditRow.product_id,
        p_storage_bucket: payload.auditRow.storage_bucket,
        p_storage_path: payload.auditRow.storage_path,
        p_public_url: payload.auditRow.public_url,
        p_source_page_url: payload.auditRow.source_page_url,
        p_source_image_url: payload.auditRow.source_image_url,
        p_source_type: payload.auditRow.source_type,
        p_quality_confidence: payload.auditRow.quality_confidence,
        p_processing_method: payload.auditRow.processing_method,
        p_asset_sha256: payload.auditRow.asset_sha256,
        p_manifest_batch_id: payload.auditRow.manifest_batch_id,
        p_user_approved: payload.auditRow.user_approved,
        p_notes: payload.auditRow.notes,
      })
      if (publishError) throw publishError
    } catch (error) {
      if (uploadedThisRun) {
        const { error: cleanupError } = await supabase.storage
          .from(PRODUCT_IMAGE_BUCKET)
          .remove([payload.storagePath])
        if (cleanupError) {
          console.error(`Cleanup failed for ${payload.storagePath}: ${cleanupError.message}`)
        }
      }
      throw error
    }

    console.log(`OK product=${payload.productId} url=${payload.publicUrl}`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
