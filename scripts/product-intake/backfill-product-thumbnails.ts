import sharp from "sharp"
import type { SupabaseClient } from "@supabase/supabase-js"

import { createSupabaseClientFromEnv, flag, flagBool, parseArgs, printJson } from "./cli"
import { generateProductSearchThumbnail } from "./product-thumbnail"

const PROJECT_ID = "pqdkhefxsxkyeqelqegq"
const BUCKET = "product-images"
const PUBLIC_PREFIX = `https://${PROJECT_ID}.supabase.co/storage/v1/object/public/${BUCKET}/`

export type ProductThumbnailBackfillRow = {
  id: string
  name: string
  image_url: string | null
  thumbnail_image_url: string | null
}

type BackfillDeps = {
  fetchCanonical(url: string): Promise<Buffer>
  downloadThumbnail(path: string): Promise<Buffer | null>
  uploadThumbnail(path: string, bytes: Buffer): Promise<void>
  updatePointer(productId: string, expectedImageUrl: string, thumbnailUrl: string): Promise<boolean>
}

export type ProductThumbnailBackfillItem = {
  product_id: string
  product_name: string
  canonical_url: string | null
  expected_thumbnail_url: string | null
  status: "planned_create" | "planned_reuse" | "created" | "reused" | "not_applicable" | "refused"
  reason: string | null
  source_sha256: string | null
  thumbnail_sha256: string | null
  thumbnail_bytes: number | null
}

export async function backfillProductThumbnails(params: {
  apply: boolean
  rows: ProductThumbnailBackfillRow[]
  deps: BackfillDeps
}) {
  const items: ProductThumbnailBackfillItem[] = []

  for (const row of params.rows) {
    const base = {
      product_id: row.id,
      product_name: row.name,
      canonical_url: row.image_url,
    }
    if (!row.image_url) {
      items.push({
        ...base,
        expected_thumbnail_url: null,
        status: "not_applicable",
        reason: "missing_canonical_image",
        source_sha256: null,
        thumbnail_sha256: null,
        thumbnail_bytes: null,
      })
      continue
    }
    if (!row.image_url.startsWith(PUBLIC_PREFIX)) {
      items.push({
        ...base,
        expected_thumbnail_url: null,
        status: "refused",
        reason: "unsupported_canonical_url",
        source_sha256: null,
        thumbnail_sha256: null,
        thumbnail_bytes: null,
      })
      continue
    }

    try {
      const canonicalBytes = await params.deps.fetchCanonical(row.image_url)
      const thumbnail = await generateProductSearchThumbnail(canonicalBytes)
      const expectedThumbnailUrl = `${PUBLIC_PREFIX}${thumbnail.storagePath}`
      const existing = await params.deps.downloadThumbnail(thumbnail.storagePath)
      if (existing) await assertValidStoredThumbnail(existing, thumbnail.hasAlpha)

      if (!params.apply) {
        items.push({
          ...base,
          expected_thumbnail_url: expectedThumbnailUrl,
          status: existing ? "planned_reuse" : "planned_create",
          reason: null,
          source_sha256: thumbnail.sourceSha256,
          thumbnail_sha256: thumbnail.outputSha256,
          thumbnail_bytes: thumbnail.bytes.length,
        })
        continue
      }

      if (!existing) {
        await params.deps.uploadThumbnail(thumbnail.storagePath, thumbnail.bytes)
      }
      if (row.thumbnail_image_url === expectedThumbnailUrl) {
        items.push({
          ...base,
          expected_thumbnail_url: expectedThumbnailUrl,
          status: "reused",
          reason: null,
          source_sha256: thumbnail.sourceSha256,
          thumbnail_sha256: thumbnail.outputSha256,
          thumbnail_bytes: thumbnail.bytes.length,
        })
        continue
      }
      const updated = await params.deps.updatePointer(row.id, row.image_url, expectedThumbnailUrl)
      if (!updated) {
        items.push({
          ...base,
          expected_thumbnail_url: expectedThumbnailUrl,
          status: "refused",
          reason: "canonical_source_changed",
          source_sha256: thumbnail.sourceSha256,
          thumbnail_sha256: thumbnail.outputSha256,
          thumbnail_bytes: thumbnail.bytes.length,
        })
        continue
      }

      items.push({
        ...base,
        expected_thumbnail_url: expectedThumbnailUrl,
        status: existing ? "reused" : "created",
        reason: null,
        source_sha256: thumbnail.sourceSha256,
        thumbnail_sha256: thumbnail.outputSha256,
        thumbnail_bytes: thumbnail.bytes.length,
      })
    } catch (error) {
      items.push({
        ...base,
        expected_thumbnail_url: null,
        status: "refused",
        reason: error instanceof Error ? error.message : "unknown_error",
        source_sha256: null,
        thumbnail_sha256: null,
        thumbnail_bytes: null,
      })
    }
  }

  return {
    mode: params.apply ? ("apply" as const) : ("dry_run" as const),
    total: items.length,
    counts: Object.fromEntries(
      [...new Set(items.map((item) => item.status))].map((status) => [
        status,
        items.filter((item) => item.status === status).length,
      ]),
    ),
    items,
  }
}

async function assertValidStoredThumbnail(bytes: Buffer, expectedAlpha?: boolean) {
  const metadata = await sharp(bytes).metadata()
  if (
    metadata.format !== "webp" ||
    metadata.width !== 144 ||
    metadata.height !== 144 ||
    bytes.length === 0 ||
    bytes.length > 200_000 ||
    (expectedAlpha !== undefined && metadata.hasAlpha !== expectedAlpha)
  ) {
    throw new Error("existing_thumbnail_contract_mismatch")
  }
}

async function retryFetch(url: string, attempts = 3): Promise<Buffer> {
  let lastError: unknown
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url)
      if (!response.ok) throw new Error(`canonical_download_http_${response.status}`)
      return Buffer.from(await response.arrayBuffer())
    } catch (error) {
      lastError = error
    }
  }
  throw lastError instanceof Error ? lastError : new Error("canonical_download_failed")
}

async function listAllProducts(client: SupabaseClient): Promise<ProductThumbnailBackfillRow[]> {
  const rows: ProductThumbnailBackfillRow[] = []
  const pageSize = 500
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await client
      .from("products")
      .select("id,name,image_url,thumbnail_image_url")
      .order("id", { ascending: true })
      .range(offset, offset + pageSize - 1)
    if (error) throw new Error(`list products: ${error.message}`)
    const page = (data ?? []) as ProductThumbnailBackfillRow[]
    rows.push(...page)
    if (page.length < pageSize) return rows
  }
}

function supabaseDeps(client: SupabaseClient): BackfillDeps {
  const bucket = client.storage.from(BUCKET)
  return {
    fetchCanonical: retryFetch,
    async downloadThumbnail(path) {
      const result = await bucket.download(path)
      if (result.error || !result.data) return null
      return Buffer.from(await result.data.arrayBuffer())
    },
    async uploadThumbnail(path, bytes) {
      const expectedMetadata = await sharp(bytes).metadata()
      const { error } = await bucket.upload(path, bytes, {
        contentType: "image/webp",
        cacheControl: "31536000",
        upsert: false,
      })
      if (error) throw new Error(`thumbnail_upload_failed:${error.message}`)
      const verify = await bucket.download(path)
      if (verify.error || !verify.data) throw new Error("thumbnail_upload_verification_failed")
      await assertValidStoredThumbnail(
        Buffer.from(await verify.data.arrayBuffer()),
        expectedMetadata.hasAlpha === true,
      )
    },
    async updatePointer(productId, expectedImageUrl, thumbnailUrl) {
      const { data, error } = await client
        .from("products")
        .update({ thumbnail_image_url: thumbnailUrl })
        .eq("id", productId)
        .eq("image_url", expectedImageUrl)
        .select("id")
        .maybeSingle()
      if (error) throw new Error(`thumbnail_pointer_update_failed:${error.message}`)
      return Boolean(data)
    },
  }
}

async function main() {
  const args = parseArgs()
  const apply = flagBool(args, "apply")
  if (apply && flag(args, "confirm-project") !== PROJECT_ID) {
    throw new Error(`Apply requires --confirm-project=${PROJECT_ID}`)
  }
  const client = createSupabaseClientFromEnv()
  const rows = await listAllProducts(client)
  const result = await backfillProductThumbnails({ apply, rows, deps: supabaseDeps(client) })
  printJson(result)
  if (result.items.some((item) => item.status === "refused")) process.exitCode = 1
}

if (process.argv[1]?.endsWith("backfill-product-thumbnails.ts")) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
