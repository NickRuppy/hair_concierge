import { cleanProductDisplayName } from "@/lib/product-identity"
import {
  buildBrandResolutionCatalog,
  resolveBrandFromText,
} from "@/lib/product-identity/brand-resolution"
import { PRODUCT_INTAKE_BUCKET } from "@/lib/product-intake/image-validation"
import { matchProductIntake } from "@/lib/product-intake/product-matching"
import { createSupabaseProductIntakeRepository } from "@/lib/product-intake/repository"
import type { ProductIntakeSubmissionRow } from "@/lib/product-intake/repository-types"
import type { ProductIntakeIdentifierInput } from "@/lib/product-intake/product-matching"

import { createSupabaseClientFromEnv, flag, flagInt, hashUserId, parseArgs, printJson } from "./cli"

type ReviewRow = ProductIntakeSubmissionRow & {
  reviewed_at?: string | null
  reviewed_by?: string | null
  review_notes?: string | null
  user_facing_resolution_reason?: string | null
  user_facing_next_step?: string | null
  user_facing_missing_fields?: unknown
  notification_sent_at?: string | null
  cleanup_after?: string | null
  photos_deleted_at?: string | null
}

function firstResearchedIdentifier(payload: unknown): ProductIntakeIdentifierInput | null {
  if (!payload || typeof payload !== "object") return null
  const final = (payload as { final?: unknown }).final
  if (!final || typeof final !== "object") return null
  const identifiers = (final as { identifiers?: unknown }).identifiers
  if (!Array.isArray(identifiers)) return null

  for (const identifier of identifiers) {
    if (!identifier || typeof identifier !== "object") continue
    const record = identifier as { type?: unknown; value?: unknown; source?: unknown }
    if (typeof record.value !== "string" || record.value.trim().length === 0) continue
    return {
      ...(typeof record.type === "string" ? { type: record.type } : {}),
      value: record.value,
      ...(typeof record.source === "string" ? { source: record.source } : {}),
    }
  }

  return null
}

async function signedUrl(path: string | null): Promise<string | null> {
  if (!path) return null
  const supabase = createSupabaseClientFromEnv()
  const { data, error } = await supabase.storage
    .from(PRODUCT_INTAKE_BUCKET)
    .createSignedUrl(path, 60 * 60)

  if (error) {
    return `ERROR: ${error.message}`
  }

  return data.signedUrl
}

async function loadSubmission(id: string): Promise<ReviewRow | null> {
  const supabase = createSupabaseClientFromEnv()
  const { data, error } = await supabase
    .from("product_submissions")
    .select("*")
    .eq("id", id)
    .single()

  if (error) {
    if (error.code === "PGRST116") return null
    throw new Error(`load product submission ${id}: ${error.message}`)
  }

  return data as ReviewRow
}

async function loadBatch(status: string, limit: number): Promise<ReviewRow[]> {
  const supabase = createSupabaseClientFromEnv()
  const { data, error } = await supabase
    .from("product_submissions")
    .select("*")
    .eq("status", status)
    .order("created_at", { ascending: true })
    .limit(limit)

  if (error) {
    throw new Error(`load review batch: ${error.message}`)
  }

  return (data ?? []) as ReviewRow[]
}

async function matchCandidates(row: ReviewRow) {
  const repository = createSupabaseProductIntakeRepository()
  const [catalog, brandCatalogInput] = await Promise.all([
    repository.loadCatalog(),
    repository.loadBrandResolutionCatalog(),
  ])
  const brandCatalog = buildBrandResolutionCatalog(brandCatalogInput)
  const brandResolution = row.brand_text ? resolveBrandFromText(row.brand_text, brandCatalog) : null
  const brand = brandResolution?.brand ?? null
  const productLine = brandResolution?.productLine ?? null
  const cleanProductName = row.product_name_text
    ? cleanProductDisplayName(row.product_name_text, {
        brand: brand?.canonicalName ?? brand?.canonical_name ?? brand?.name ?? null,
        productLine:
          productLine?.canonicalName ?? productLine?.canonical_name ?? productLine?.name ?? null,
      })
    : ""

  const result = matchProductIntake(
    {
      selectedCategoryKey: row.category,
      brandId: brand?.id ?? brand?.key ?? null,
      productLineId: productLine?.id ?? productLine?.key ?? null,
      cleanProductName,
      productName: row.product_name_text ?? null,
      identifier: firstResearchedIdentifier(row.researched_payload),
    },
    catalog,
  )

  return result.candidates.map((candidate) => ({
    product_id: candidate.productId,
    name: candidate.product.name,
    category: candidate.product.category_key ?? candidate.product.categoryKey ?? "",
    confidence: candidate.confidence,
    reason: candidate.reason,
  }))
}

async function printSingleReview(id: string) {
  const row = await loadSubmission(id)
  if (!row) {
    throw new Error(`Submission not found: ${id}`)
  }

  const [frontUrl, barcodeUrl, candidates] = await Promise.all([
    signedUrl(row.front_image_path),
    signedUrl(row.barcode_image_path),
    matchCandidates(row),
  ])

  printJson({
    submission: {
      id: row.id,
      created_at: row.created_at,
      updated_at: row.updated_at,
      user: hashUserId(row.user_id),
      source: row.source,
      source_conversation_id: row.source_conversation_id,
      intake_method: row.intake_method,
      category: row.category,
      brand_text: row.brand_text,
      product_name_text: row.product_name_text,
      frequency_range: row.frequency_range,
      status: row.status,
      reviewed_at: row.reviewed_at ?? null,
      reviewed_by: row.reviewed_by ?? null,
      review_notes: row.review_notes ?? null,
      approved_product_id: row.approved_product_id,
      notification_sent_at: row.notification_sent_at ?? null,
    },
    images: {
      front_image_path: row.front_image_path,
      front_image_signed_url: frontUrl,
      barcode_image_path: row.barcode_image_path,
      barcode_image_signed_url: barcodeUrl,
      front_image_validation_status: row.front_image_validation_status,
      front_image_validation_metadata: row.front_image_validation_metadata,
      barcode_image_validation_status: row.barcode_image_validation_status,
      barcode_image_validation_metadata: row.barcode_image_validation_metadata,
    },
    existing_match_candidates: candidates,
    researched_payload: row.researched_payload,
    intake_history: row.intake_history,
    user_resolution: {
      reason: row.user_facing_resolution_reason ?? null,
      next_step: row.user_facing_next_step ?? null,
      missing_fields: row.user_facing_missing_fields ?? [],
    },
  })
}

async function printBatchReview(status: string, limit: number) {
  const rows = await loadBatch(status, limit)
  if (rows.length === 0) {
    console.log(`No product intake submissions with status ${status}.`)
    return
  }

  console.table(
    rows.map((row) => ({
      id: row.id,
      created_at: row.created_at,
      user: hashUserId(row.user_id),
      source: row.source,
      category: row.category,
      brand: row.brand_text ?? "",
      name: row.product_name_text ?? "",
      front_image: row.front_image_path ? "yes" : "",
      barcode_image: row.barcode_image_path ? "yes" : "",
      researched: Object.keys(row.researched_payload ?? {}).length > 0 ? "yes" : "",
      source_conversation_id: row.source_conversation_id ?? "",
    })),
  )
}

async function main() {
  const args = parseArgs()
  const explicitStatus = flag(args, "status")
  const limit = flagInt(args, "limit", 20)
  const submissionId = args.positional[0] ?? flag(args, "submission-id")

  if (submissionId) {
    await printSingleReview(submissionId)
    return
  }

  await printBatchReview(explicitStatus ?? "pending_review", limit)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
