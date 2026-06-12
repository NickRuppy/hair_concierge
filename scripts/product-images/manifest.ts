import { createHash } from "node:crypto"
import { existsSync, readFileSync } from "node:fs"
import { basename, extname, isAbsolute, relative, resolve, sep } from "node:path"

export const PRODUCT_IMAGE_BUCKET = "product-images"
export const DEFAULT_PRODUCT_IMAGE_BATCH_ID = "pilot-2026-06-10"
export const DEFAULT_PRODUCT_IMAGE_EXPECTED_COUNT = 20
export const PRODUCT_IMAGE_BATCH_ID = DEFAULT_PRODUCT_IMAGE_BATCH_ID
export const SUPABASE_PROJECT_ID = "pqdkhefxsxkyeqelqegq"

export const MANIFEST_HEADER = [
  "product_id",
  "brand",
  "name",
  "category",
  "source_page_url",
  "source_image_url",
  "source_type",
  "quality_confidence",
  "processing_method",
  "final_file",
  "asset_sha256",
  "user_approved",
  "notes",
] as const

export type ProductImageSourceType =
  | "brand"
  | "retailer"
  | "marketplace"
  | "search_result"
  | "unknown"
export type ProductImageQualityConfidence = "high" | "medium"
export type ProductImageProcessingMethod = "local" | "third_party" | "manual"

export interface ProductImageManifestRow {
  product_id: string
  brand: string
  name: string
  category: string
  source_page_url: string
  source_image_url: string
  source_type: ProductImageSourceType
  quality_confidence: ProductImageQualityConfidence
  processing_method: ProductImageProcessingMethod
  final_file: string
  asset_sha256: string
  user_approved: "yes"
  notes: string
}

export interface ProductImagePublishPayload {
  productId: string
  localFilePath: string
  storageBucket: string
  storagePath: string
  publicUrl: string
  auditRow: {
    product_id: string
    storage_bucket: string
    storage_path: string
    public_url: string
    source_page_url: string
    source_image_url: string | null
    source_type: ProductImageSourceType
    quality_confidence: ProductImageQualityConfidence
    processing_method: ProductImageProcessingMethod
    asset_sha256: string
    manifest_batch_id: string
    user_approved: boolean
    notes: string | null
  }
}

interface BuildPublishPayloadOptions {
  expectedCount?: number
  batchId?: string
}

function parseCsvLine(line: string): string[] {
  const values: string[] = []
  let current = ""
  let quoted = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    const next = line[index + 1]

    if (char === '"' && quoted && next === '"') {
      current += '"'
      index += 1
      continue
    }
    if (char === '"') {
      quoted = !quoted
      continue
    }
    if (char === "," && !quoted) {
      values.push(current)
      current = ""
      continue
    }
    current += char
  }

  values.push(current)
  return values.map((value) => value.trim())
}

export function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex")
}

export function readProductImageManifest(path: string): ProductImageManifestRow[] {
  const lines = readFileSync(path, "utf8")
    .replace(/\r/g, "")
    .split("\n")
    .filter((line) => line.trim().length > 0)
  const header = parseCsvLine(lines[0] ?? "")

  if (header.join(",") !== MANIFEST_HEADER.join(",")) {
    throw new Error(`Unexpected manifest header in ${path}: ${header.join(",")}`)
  }

  return lines.slice(1).map((line, index) => {
    const values = parseCsvLine(line)
    const row = Object.fromEntries(
      MANIFEST_HEADER.map((key, column) => [key, values[column] ?? ""]),
    )
    return validateManifestRow(row, index + 2)
  })
}

export function validateManifestRow(
  row: Record<string, string>,
  lineNumber: number,
): ProductImageManifestRow {
  const required = [
    "product_id",
    "source_page_url",
    "source_type",
    "quality_confidence",
    "processing_method",
    "final_file",
    "asset_sha256",
    "user_approved",
  ]

  for (const key of required) {
    if (!row[key]?.trim()) throw new Error(`Line ${lineNumber}: ${key} is required`)
  }

  if (!["brand", "retailer", "marketplace", "search_result", "unknown"].includes(row.source_type)) {
    throw new Error(`Line ${lineNumber}: invalid source_type ${row.source_type}`)
  }
  if (row.quality_confidence === "low") {
    throw new Error(`Line ${lineNumber}: low confidence images cannot be published`)
  }
  if (!["high", "medium"].includes(row.quality_confidence)) {
    throw new Error(`Line ${lineNumber}: invalid quality_confidence ${row.quality_confidence}`)
  }
  if (!["local", "third_party", "manual"].includes(row.processing_method)) {
    throw new Error(`Line ${lineNumber}: invalid processing_method ${row.processing_method}`)
  }
  if (!/^[a-f0-9]{64}$/.test(row.asset_sha256)) {
    throw new Error(`Line ${lineNumber}: asset_sha256 must be a lowercase SHA-256 hex digest`)
  }
  if (row.user_approved !== "yes") {
    throw new Error(`Line ${lineNumber}: user_approved must be yes before publishing`)
  }
  if (
    (row.source_type === "unknown" || row.source_type === "search_result") &&
    !row.notes?.trim()
  ) {
    throw new Error(`Line ${lineNumber}: notes are required for ${row.source_type} sources`)
  }

  const ext = extname(row.final_file).toLowerCase()
  if (![".webp", ".png", ".jpg", ".jpeg"].includes(ext)) {
    throw new Error(`Line ${lineNumber}: final_file must be webp, png, jpg, or jpeg`)
  }

  return row as unknown as ProductImageManifestRow
}

export function buildStoragePath(
  row: ProductImageManifestRow,
  batchId = DEFAULT_PRODUCT_IMAGE_BATCH_ID,
): string {
  const ext = extname(row.final_file).toLowerCase() || ".webp"
  const fileBase = basename(row.final_file, ext).replace(/[^a-zA-Z0-9_-]+/g, "-")
  const version = row.asset_sha256.slice(0, 12)
  return `${batchId}/${row.product_id}/${fileBase}-${version}${ext}`
}

export function buildPublicUrl(storagePath: string): string {
  return `https://${SUPABASE_PROJECT_ID}.supabase.co/storage/v1/object/public/${PRODUCT_IMAGE_BUCKET}/${storagePath}`
}

export function validateManifestBatch(rows: ProductImageManifestRow[], expectedCount = 20): void {
  if (rows.length !== expectedCount) {
    throw new Error(
      `Manifest must contain exactly ${expectedCount} approved products, found ${rows.length}`,
    )
  }

  const seen = new Set<string>()
  for (const row of rows) {
    if (seen.has(row.product_id)) {
      throw new Error(`Manifest contains duplicate product_id ${row.product_id}`)
    }
    seen.add(row.product_id)
  }
}

function resolveFinalFilePath(batchDir: string, finalFile: string): string {
  const batchRoot = resolve(batchDir)
  const localFilePath = resolve(batchRoot, finalFile)
  const relativePath = relative(batchRoot, localFilePath)

  if (
    relativePath === "" ||
    relativePath === ".." ||
    relativePath.startsWith(`..${sep}`) ||
    isAbsolute(relativePath)
  ) {
    throw new Error(`final_file must stay inside the batch directory: ${finalFile}`)
  }

  return localFilePath
}

export function buildPublishPayloads(
  rows: ProductImageManifestRow[],
  batchDir: string,
  options: BuildPublishPayloadOptions = {},
): ProductImagePublishPayload[] {
  const batchId = options.batchId ?? DEFAULT_PRODUCT_IMAGE_BATCH_ID
  validateManifestBatch(rows, options.expectedCount ?? DEFAULT_PRODUCT_IMAGE_EXPECTED_COUNT)

  return rows.map((row) => {
    const localFilePath = resolveFinalFilePath(batchDir, row.final_file)

    if (!existsSync(localFilePath)) {
      throw new Error(`Missing final image file: ${localFilePath}`)
    }

    const actualSha = sha256File(localFilePath)
    if (actualSha !== row.asset_sha256) {
      throw new Error(
        `SHA mismatch for ${localFilePath}: manifest=${row.asset_sha256} actual=${actualSha}`,
      )
    }

    const storagePath = buildStoragePath(row, batchId)
    const publicUrl = buildPublicUrl(storagePath)

    return {
      productId: row.product_id,
      localFilePath,
      storageBucket: PRODUCT_IMAGE_BUCKET,
      storagePath,
      publicUrl,
      auditRow: {
        product_id: row.product_id,
        storage_bucket: PRODUCT_IMAGE_BUCKET,
        storage_path: storagePath,
        public_url: publicUrl,
        source_page_url: row.source_page_url,
        source_image_url: row.source_image_url.trim() || null,
        source_type: row.source_type,
        quality_confidence: row.quality_confidence,
        processing_method: row.processing_method,
        asset_sha256: row.asset_sha256,
        manifest_batch_id: batchId,
        user_approved: true,
        notes: row.notes.trim() || null,
      },
    }
  })
}
