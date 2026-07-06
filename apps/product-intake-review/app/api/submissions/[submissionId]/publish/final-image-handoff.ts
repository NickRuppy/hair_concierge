import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { extname } from "node:path"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { JsonRecord, ProductIntakeResearchArtifact } from "@chaarlie/product-intake-core"

const PRODUCT_IMAGE_BUCKET = "product-images"
const PRODUCT_IMAGE_PUBLIC_URL_PREFIX =
  "https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/"
const CATEGORY_SPEC_KEYS = [
  "product_shampoo_specs",
  "product_conditioner_specs",
  "product_conditioner_rerank_specs",
  "product_mask_specs",
  "product_leave_in_specs",
  "product_leave_in_fit_specs",
  "product_leave_in_eligibility",
  "product_oil_eligibility",
  "product_dry_shampoo_specs",
  "product_deep_cleansing_shampoo_specs",
  "product_bondbuilder_specs",
] as const
const ARRAY_CATEGORY_SPEC_KEYS = new Set<(typeof CATEGORY_SPEC_KEYS)[number]>([
  "product_shampoo_specs",
  "product_conditioner_specs",
  "product_leave_in_eligibility",
  "product_oil_eligibility",
])

export type FinalImageUploadDecision =
  | {
      ok: true
      artifact: ProductIntakeResearchArtifact
      localFile: string
      assetSha256: string
      bucket: typeof PRODUCT_IMAGE_BUCKET
      storagePath: string
      publicUrl: string
      contentType: string
    }
  | {
      ok: false
      reason: string
    }

export type FinalImageUploadResult = {
  status: "already_uploaded" | "uploaded"
  bucket: typeof PRODUCT_IMAGE_BUCKET
  storagePath: string
  publicUrl: string
  assetSha256: string
}

export type PublishReviewMetadata = {
  reviewedBy: string
  reviewedAt: string
  notes?: string | null
}

export function finalImageUploadDecisionFromArtifacts(
  artifacts: ProductIntakeResearchArtifact[],
): FinalImageUploadDecision {
  const processedArtifacts = artifacts.filter((item) => item.kind === "processed_image")
  const artifact = processedArtifacts.find(isReadyProcessedImageArtifact)
  if (!artifact) {
    const latestProcessedArtifact = processedArtifacts[0]
    if (!latestProcessedArtifact) {
      return invalid("Kein verarbeitetes Bild fuer den Supabase-Handoff vorhanden.")
    }
    if (latestProcessedArtifact.status !== "pending_review") {
      return invalid(
        `Verarbeitetes Bild ist nicht review-bereit (${latestProcessedArtifact.status}).`,
      )
    }
    return invalid(
      "Verarbeitetes Bild ist nicht final freigegeben oder nicht transparent geprueft.",
    )
  }

  const payload = artifact.payload
  const localFile = stringValue(payload.final_file)
  const assetSha256 = stringValue(payload.asset_sha256)
  const bucket = stringValue(payload.storage_bucket)
  const storagePath = stringValue(payload.storage_path)
  const publicUrl =
    stringValue(payload.public_url) ??
    stringValue(payload.planned_public_url) ??
    stringValue(payload.final_public_url)

  if (!localFile) return invalid("Verarbeitetes Bild hat keine lokale final_file.")
  if (!assetSha256 || !/^[a-f0-9]{64}$/.test(assetSha256)) {
    return invalid("Verarbeitetes Bild hat keinen gueltigen asset_sha256.")
  }
  if (bucket !== PRODUCT_IMAGE_BUCKET) {
    return invalid("Verarbeitetes Bild muss in den product-images Bucket gehen.")
  }
  if (!storagePath) return invalid("Verarbeitetes Bild hat keinen storage_path.")
  if (!publicUrl?.startsWith(PRODUCT_IMAGE_PUBLIC_URL_PREFIX)) {
    return invalid("Verarbeitetes Bild hat keine Chaarlie product-images URL.")
  }
  if (publicUrl !== `${PRODUCT_IMAGE_PUBLIC_URL_PREFIX}${storagePath}`) {
    return invalid("Verarbeitetes Bild public URL passt nicht zum Storage-Pfad.")
  }

  return {
    ok: true,
    artifact,
    localFile,
    assetSha256,
    bucket,
    storagePath,
    publicUrl,
    contentType: contentTypeFor(localFile),
  }
}

function isReadyProcessedImageArtifact(artifact: ProductIntakeResearchArtifact) {
  return artifact.status === "pending_review" && isReadyProcessedImagePayload(artifact.payload)
}

function isReadyProcessedImagePayload(payload: JsonRecord) {
  return payload.final_image_ready === true && payload.transparent_background_detected === true
}

export function buildResearchedPayloadWithFinalImage(
  researchedPayload: JsonRecord,
  finalImageUrl: string,
  review: PublishReviewMetadata,
): JsonRecord & { final: JsonRecord & { product: JsonRecord } } {
  const finalPayload = recordValue(researchedPayload.final)
  const product = recordValue(finalPayload?.product)
  if (!finalPayload || !product) {
    throw new Error("Kein final.product Payload fuer finalen Bild-Handoff vorhanden.")
  }

  const nextPayload: JsonRecord & { final: JsonRecord & { product: JsonRecord } } = {
    final: {
      ...finalPayload,
      review: {
        manual_reviewed: true,
        reviewed_by: review.reviewedBy,
        reviewed_at: review.reviewedAt,
        notes: review.notes ?? "Approved from Product Intake Review Cockpit.",
      },
      product: {
        ...product,
        image_url: finalImageUrl,
      },
      identifiers: normalizeFinalIdentifiers(finalPayload.identifiers),
    },
  }
  hoistCategorySpecsFromProduct(nextPayload.final)
  ensureCategorySpecRationales(nextPayload.final)

  if (researchedPayload.draft !== undefined) {
    nextPayload.draft = researchedPayload.draft
  }

  return nextPayload
}

function hoistCategorySpecsFromProduct(finalPayload: JsonRecord & { product: JsonRecord }) {
  const categorySpecs = recordValue(finalPayload.category_specs) ?? {}
  finalPayload.category_specs = categorySpecs

  for (const key of CATEGORY_SPEC_KEYS) {
    if (finalPayload.product[key] === undefined || categorySpecs[key] !== undefined) continue
    categorySpecs[key] = cloneJsonValue(finalPayload.product[key])
    delete finalPayload.product[key]
  }

  unwrapCategorySpecRows(categorySpecs)
}

function unwrapCategorySpecRows(categorySpecs: JsonRecord) {
  for (const key of CATEGORY_SPEC_KEYS) {
    const spec = recordValue(categorySpecs[key])
    if (!spec || !Array.isArray(spec.rows)) continue
    categorySpecs[key] = ARRAY_CATEGORY_SPEC_KEYS.has(key)
      ? cloneJsonValue(spec.rows)
      : cloneJsonValue(spec.rows[0])
  }
}

function ensureCategorySpecRationales(finalPayload: JsonRecord) {
  const categorySpecs = recordValue(finalPayload.category_specs) ?? {}
  const fieldRationales = recordValue(finalPayload.field_rationales) ?? {}
  finalPayload.field_rationales = fieldRationales

  for (const key of Object.keys(categorySpecs)) {
    const parentKey = `category_specs.${key}`
    if (stringValue(fieldRationales[parentKey])) continue

    const childPrefix = `${parentKey}.`
    const childRationale = Object.entries(fieldRationales).find(
      ([rationaleKey, rationale]) => rationaleKey.startsWith(childPrefix) && stringValue(rationale),
    )?.[1]

    fieldRationales[parentKey] =
      stringValue(childRationale) ??
      `Reviewed ${key} values are ready for the category-specific product table.`
  }
}

function normalizeFinalIdentifiers(value: unknown): unknown[] {
  if (!Array.isArray(value)) return []

  return value.flatMap((item) => {
    const record = recordValue(item)
    if (!record) return []
    const rawType = stringValue(record.type) ?? stringValue(record.identifier_type)
    const type = normalizeIdentifierTypeForApproval(rawType)
    const identifierValue = stringValue(record.value) ?? stringValue(record.identifier_value)
    if (!type || !identifierValue) return []
    return [
      {
        type,
        value: identifierValue,
        ...(stringValue(record.source) ? { source: stringValue(record.source) } : {}),
      },
    ]
  })
}

function normalizeIdentifierTypeForApproval(value: string | null | undefined): string | undefined {
  if (!value) return undefined
  const type = value.trim().toLowerCase()
  if (
    type === "manufacturer_product_number" ||
    type === "manufacturer_no" ||
    type === "manufacturer_sku" ||
    type === "product_number" ||
    type === "article_number" ||
    type === "retailer_item_no" ||
    type === "retailer_item_number" ||
    type === "artikelnummer"
  ) {
    return "retailer_sku"
  }
  return type
}

export async function uploadFinalizedReviewImage(
  supabase: SupabaseClient,
  decision: Extract<FinalImageUploadDecision, { ok: true }>,
): Promise<FinalImageUploadResult> {
  const bytes = await readFile(decision.localFile)
  const actualSha256 = createHash("sha256").update(bytes).digest("hex")
  if (actualSha256 !== decision.assetSha256) {
    throw new Error("Lokales finales Bild passt nicht zum gespeicherten SHA-256.")
  }

  const bucket = supabase.storage.from(decision.bucket)
  const existing = await bucket.download(decision.storagePath)
  if (!existing.error && existing.data) {
    return {
      status: "already_uploaded",
      bucket: decision.bucket,
      storagePath: decision.storagePath,
      publicUrl: decision.publicUrl,
      assetSha256: actualSha256,
    }
  }

  const { error: uploadError } = await bucket.upload(decision.storagePath, bytes, {
    contentType: decision.contentType,
    upsert: false,
  })
  if (uploadError) {
    throw new Error(`Finales Produktbild hochladen: ${uploadError.message}`)
  }

  const verify = await bucket.download(decision.storagePath)
  if (verify.error || !verify.data) {
    throw new Error(
      `Finales Produktbild verifizieren: ${verify.error?.message ?? "nicht gefunden"}`,
    )
  }

  return {
    status: "uploaded",
    bucket: decision.bucket,
    storagePath: decision.storagePath,
    publicUrl: decision.publicUrl,
    assetSha256: actualSha256,
  }
}

function invalid(reason: string): FinalImageUploadDecision {
  return { ok: false, reason }
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null
}

function recordValue(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : null
}

function cloneJsonValue(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value)) as unknown
}

function contentTypeFor(path: string) {
  const extension = extname(path).toLowerCase()
  if (extension === ".webp") return "image/webp"
  if (extension === ".png") return "image/png"
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg"
  return "application/octet-stream"
}
