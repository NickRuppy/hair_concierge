import { existsSync } from "node:fs"
import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"

import type { SupabaseClient } from "@supabase/supabase-js"
import { PRODUCT_INTAKE_BUCKET } from "@/lib/product-intake/image-validation"
import { dryRunProductIntakeReadyForReview } from "@/lib/product-intake/review-workflow"
import type { ProductIntakeReviewCategoryKey } from "@/lib/product-intake/category-validators"

import { createSupabaseClientFromEnv, flagBool, flagInt, parseArgs, printJson } from "./cli"
import { loadQueueRows } from "./queue"
import type { ProductIntakeQueueRow } from "./queue-reporting"

export const RESEARCH_PACKAGE_ROOT = "ops/product-intake-research"
export const REQUIRED_RESEARCH_PACKAGE_FILES = [
  "submission.json",
  "research.md",
  "payload.json",
  "validation.json",
  "approval.md",
] as const
export const IMAGE_FINALIZATION_FILE = "image-finalization.json"

export type ResearchPackageStatus = "draft"

export type ProductIntakeResearchPackageMetadata = {
  submission_id: string
  created_at: string
  source: string
  category: string
  brand_text: string | null
  product_name_text: string | null
  package_status: ResearchPackageStatus
}

export type ProductIntakeResearchPackageImageMetadata = {
  front_image_signed_url: string | null
  barcode_image_signed_url: string | null
  signed_url_expires_at: string | null
}

export type PreparedResearchPackage = {
  submissionId: string
  packagePath: string
}

export type PrepareResearchPackagesResult = {
  created: PreparedResearchPackage[]
  skipped: PreparedResearchPackage[]
}

type LoadRows = (params: {
  supabase: SupabaseClient
  statusFilter: string | null
  categoryFilter: string | null
  sourceFilter: string | null
  includeClosed: boolean
  minAgeDays: number | null
  maxAgeDays: number | null
  resultLimit: number | null
  now: Date
}) => Promise<ProductIntakeQueueRow[]>

export function buildResearchPackagePath(params: {
  rootDir: string
  now: Date
  submissionId: string
}): string {
  return join(params.rootDir, RESEARCH_PACKAGE_ROOT, isoDate(params.now), params.submissionId)
}

export async function prepareResearchPackages(params: {
  rootDir: string
  now: Date
  rows: ProductIntakeQueueRow[]
  overwrite?: boolean
  imageMetadataBySubmissionId?: Record<string, ProductIntakeResearchPackageImageMetadata>
}): Promise<PrepareResearchPackagesResult> {
  const created: PreparedResearchPackage[] = []
  const skipped: PreparedResearchPackage[] = []

  for (const row of params.rows) {
    const packagePath = buildResearchPackagePath({
      rootDir: params.rootDir,
      now: params.now,
      submissionId: row.id,
    })
    const packageRef = { submissionId: row.id, packagePath }

    if (existsSync(packagePath) && !params.overwrite) {
      skipped.push(packageRef)
      continue
    }

    await mkdir(packagePath, { recursive: true })
    const payload = buildDraftPayload(row)
    const validation = dryRunProductIntakeReadyForReview({
      id: row.id,
      category: row.category as ProductIntakeReviewCategoryKey,
      researched_payload: payload,
    })

    await Promise.all([
      writeJson(join(packagePath, "submission.json"), {
        ...row,
        package_metadata: buildPackageMetadata(row, params.now),
        image_review:
          params.imageMetadataBySubmissionId?.[row.id] ??
          emptyImageMetadata(row.front_image_path, row.barcode_image_path),
      }),
      writeFile(join(packagePath, "research.md"), buildResearchMarkdown(row), "utf8"),
      writeJson(join(packagePath, "payload.json"), payload),
      writeJson(join(packagePath, "validation.json"), validation),
      writeJson(join(packagePath, IMAGE_FINALIZATION_FILE), buildImageFinalizationDraft(row)),
      writeFile(join(packagePath, "approval.md"), buildApprovalMarkdown(row, packagePath), "utf8"),
    ])
    created.push(packageRef)
  }

  return { created, skipped }
}

export async function prepareResearchPackagesFromQueue(params: {
  supabase: SupabaseClient
  rootDir: string
  now: Date
  limit?: number
  overwrite?: boolean
  loadRows?: LoadRows
}): Promise<PrepareResearchPackagesResult> {
  const rows = await (params.loadRows ?? loadQueueRows)({
    supabase: params.supabase,
    statusFilter: "pending_review",
    categoryFilter: null,
    sourceFilter: null,
    includeClosed: false,
    minAgeDays: null,
    maxAgeDays: null,
    resultLimit: params.limit ?? 5,
    now: params.now,
  })
  const imageMetadataBySubmissionId = await buildImageMetadataBySubmissionId({
    supabase: params.supabase,
    rows,
    now: params.now,
  })

  return prepareResearchPackages({
    rootDir: params.rootDir,
    now: params.now,
    rows,
    overwrite: params.overwrite,
    imageMetadataBySubmissionId,
  })
}

export async function validateResearchPackage(packagePath: string): Promise<{
  ok: boolean
  missingFiles: string[]
}> {
  const missingFiles: string[] = []
  for (const fileName of REQUIRED_RESEARCH_PACKAGE_FILES) {
    if (!existsSync(join(packagePath, fileName))) {
      missingFiles.push(fileName)
    }
  }

  return { ok: missingFiles.length === 0, missingFiles }
}

async function main() {
  const args = parseArgs()
  const supabase = createSupabaseClientFromEnv()
  const limit = flagInt(args, "limit", 5)
  const overwrite = flagBool(args, "overwrite")
  const result = await prepareResearchPackagesFromQueue({
    supabase,
    rootDir: process.cwd(),
    now: new Date(),
    limit,
    overwrite,
  })

  printJson(result)
}

function buildPackageMetadata(
  row: ProductIntakeQueueRow,
  now: Date,
): ProductIntakeResearchPackageMetadata {
  return {
    submission_id: row.id,
    created_at: now.toISOString(),
    source: row.source,
    category: row.category,
    brand_text: row.brand_text,
    product_name_text: row.product_name_text,
    package_status: "draft",
  }
}

function buildDraftPayload(row: ProductIntakeQueueRow) {
  return {
    draft: {
      product: {
        canonical_brand: row.brand_text,
        clean_name: row.product_name_text,
        category_key: row.category,
      },
      raw_submission: {
        id: row.id,
        source: row.source,
        category: row.category,
        front_image_path: row.front_image_path,
        barcode_image_path: row.barcode_image_path,
      },
      sources: [],
      field_rationales: {},
    },
  }
}

function buildImageFinalizationDraft(row: ProductIntakeQueueRow) {
  return {
    status: "pending",
    instructions:
      "Replace this with approved_asset metadata after final product-image processing, or no_image_approved_for_now if Nick explicitly approves no image.",
    expected_final_asset:
      "Reviewed exact product image, background removed, QA checked, normalized to Chaarlie product-image standard, and ready for the public product-images bucket.",
    source_inputs: {
      submitted_front_image_path: row.front_image_path,
      submitted_barcode_image_path: row.barcode_image_path,
    },
    approved_asset_template: {
      status: "approved_asset",
      storage_bucket: "product-images",
      storage_path: "product-intake/YYYY-MM-DD/<submission-id>/<file>-<sha12>.webp",
      public_url:
        "https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/product-intake/YYYY-MM-DD/<submission-id>/<file>-<sha12>.webp",
      source_page_url: "",
      source_image_url: "",
      source_type: "brand",
      quality_confidence: "high",
      processing_method: "local",
      final_file: "images/final/<file>.webp",
      asset_sha256: "",
      user_approved: true,
      reviewed_by: "nick",
      reviewed_at: "",
      notes: "",
    },
  }
}

async function buildImageMetadataBySubmissionId(params: {
  supabase: SupabaseClient
  rows: ProductIntakeQueueRow[]
  now: Date
}): Promise<Record<string, ProductIntakeResearchPackageImageMetadata>> {
  const expiresAt = new Date(params.now.getTime() + 60 * 60 * 1000).toISOString()
  const entries = await Promise.all(
    params.rows.map(async (row) => [
      row.id,
      {
        front_image_signed_url: await signedImageUrl(params.supabase, row.front_image_path),
        barcode_image_signed_url: await signedImageUrl(params.supabase, row.barcode_image_path),
        signed_url_expires_at: row.front_image_path || row.barcode_image_path ? expiresAt : null,
      },
    ]),
  )

  return Object.fromEntries(entries)
}

async function signedImageUrl(
  supabase: SupabaseClient,
  path: string | null,
): Promise<string | null> {
  if (!path) return null
  const { data, error } = await supabase.storage
    .from(PRODUCT_INTAKE_BUCKET)
    .createSignedUrl(path, 60 * 60)

  if (error) return `ERROR: ${error.message}`
  return data.signedUrl
}

function emptyImageMetadata(
  _frontImagePath: string | null,
  _barcodeImagePath: string | null,
): ProductIntakeResearchPackageImageMetadata {
  return {
    front_image_signed_url: null,
    barcode_image_signed_url: null,
    signed_url_expires_at: null,
  }
}

function buildResearchMarkdown(row: ProductIntakeQueueRow): string {
  return [
    `# Product Intake Research: ${row.id}`,
    "",
    `- Status: ${row.status}`,
    `- Source: ${row.source}`,
    `- Category: ${row.category}`,
    `- Brand text: ${row.brand_text ?? ""}`,
    `- Product name text: ${row.product_name_text ?? ""}`,
    `- Front image path: ${row.front_image_path ?? ""}`,
    `- Barcode image path: ${row.barcode_image_path ?? ""}`,
    "",
    "## Research Notes",
    "",
    "- Identity:",
    "- Category fit:",
    "- Specs:",
    "- Sources:",
    "- Warnings:",
    "",
  ].join("\n")
}

function buildApprovalMarkdown(row: ProductIntakeQueueRow, packagePath: string): string {
  return [
    `# Approval Checklist: ${row.id}`,
    "",
    "## Identity",
    "",
    `- Brand: ${row.brand_text ?? ""}`,
    `- Name: ${row.product_name_text ?? ""}`,
    `- Category: ${row.category}`,
    "",
    "## Required Review",
    "",
    "- [ ] Confirm product identity.",
    "- [ ] Confirm category-specific specs.",
    "- [ ] Add source evidence to payload.json.",
    "- [ ] Finalize product image in image-finalization.json.",
    "- [ ] Confirm final.product.image_url is a Chaarlie-hosted product-images URL, not a raw retailer/brand source URL.",
    "- [ ] Confirm validation.json before approval.",
    "- [ ] Confirm no unresolved warnings remain.",
    "",
    "## Commands",
    "",
    "```bash",
    `npm run products:intake:review -- --submission-id ${row.id}`,
    `npm run products:intake:research -- --submission-id ${row.id} --payload-file ${join(packagePath, "payload.json")}`,
    `npm run products:intake:approve-package -- --package ${packagePath} --reviewed-by nick`,
    "```",
    "",
  ].join("\n")
}

async function writeJson(path: string, value: unknown) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8")
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

if (process.argv[1]?.endsWith("prepare-research.ts")) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
