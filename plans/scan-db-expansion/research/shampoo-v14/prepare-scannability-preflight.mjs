import { createHash } from "node:crypto"
import { readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"

const root = resolve(import.meta.dirname, "../../../../")
const receiptPath = resolve(import.meta.dirname, "approved-manifest-sync-receipt.json")
const finalizedRoot = resolve(
  root,
  "ops/product-intake-research/2026-09-04/shampoo-scannable-14/finalized",
)
const scopedManifestPath = resolve(
  root,
  "plans/scan-db-expansion/research/shampoo-manifest-scannable-14.json",
)
const supplementPath = resolve(import.meta.dirname, "scannable-14-supplement.json")
const imageReceiptPath = resolve(import.meta.dirname, "approved-image-finalization-receipt.json")

// Exact time at which Nick's in-thread approval was recorded into the local package.
const reviewedAt = "2026-09-04T06:52:43.000Z"
const researchCheckedAt = "2026-09-02T12:00:00.000Z"

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"))
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex")
}

function itemKey(brand, name) {
  const slug = `${brand} ${name}`
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return slug.length > 60 ? slug.slice(0, 60).replace(/-+$/, "") : slug
}

function sourceType(url) {
  const hostname = new URL(url).hostname
  return hostname === "www.schwarzkopf.de" || hostname === "www.nivea.de" ? "brand" : "retailer"
}

const receipt = readJson(receiptPath)
const existingSupplement = readJson(supplementPath)
const existingImageReceipt = readJson(imageReceiptPath)
const existingFinalizedImages = new Map(
  existingImageReceipt.products.map((product) => [product.product_id, product]),
)
const operatorProfileId =
  process.env.SHAMPOO_SCANNABLE_OPERATOR_PROFILE_ID ?? existingSupplement.operator_profile_id
const reviewedHead =
  process.env.SHAMPOO_SCANNABLE_REVIEWED_HEAD ?? existingSupplement.reviewed_head
if (
  !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    operatorProfileId,
  )
) {
  throw new Error(
    "A valid operator profile ID is required in the existing supplement or SHAMPOO_SCANNABLE_OPERATOR_PROFILE_ID",
  )
}
if (!/^[a-f0-9]{40}$/.test(reviewedHead)) {
  throw new Error(
    "A valid sealed reviewed head is required in the existing supplement or SHAMPOO_SCANNABLE_REVIEWED_HEAD",
  )
}
const manifests = new Map()
const products = []
const supplementProducts = {}
const finalizedImages = []

for (const selected of receipt.products) {
  const manifestPath = resolve(root, selected.manifest)
  if (!manifests.has(manifestPath)) manifests.set(manifestPath, readJson(manifestPath))
  const manifest = manifests.get(manifestPath)
  const entry = manifest.products[selected.manifest_index]
  const identifiers = entry?.final?.identifiers ?? []
  if (!identifiers.some((identifier) => identifier.value === selected.gtin)) {
    throw new Error(`Manifest selection mismatch for ${selected.product_id}`)
  }
  products.push(entry)

  const packageDir = resolve(finalizedRoot, selected.product_id)
  const decisionPath = resolve(packageDir, "image-finalization.json")
  const decision = readJson(decisionPath)
  if (decision.status !== "approved_asset" || decision.quality_gate?.status !== "pass") {
    throw new Error(`Image is not finalization-ready for ${selected.product_id}`)
  }
  const normalizedDecision = {
    ...decision,
    source_page_url: selected.candidate_image_source_url,
    source_image_url: selected.candidate_image_url,
    source_type: sourceType(selected.candidate_image_source_url),
    quality_confidence: "high",
    user_approved: true,
    reviewed_by: "nick",
    reviewed_at: reviewedAt,
    notes:
      "Nick approved this exact product image in the 14-product contact sheet on 2026-09-04. Local quality gate passed. Not uploaded to Supabase Storage.",
  }
  const finalFile = resolve(packageDir, normalizedDecision.final_file)
  const thumbnailFile = resolve(packageDir, normalizedDecision.thumbnail_final_file)
  if (sha256(finalFile) !== normalizedDecision.asset_sha256) {
    throw new Error(`Final image checksum mismatch for ${selected.product_id}`)
  }
  if (sha256(thumbnailFile) !== normalizedDecision.thumbnail_asset_sha256) {
    throw new Error(`Thumbnail checksum mismatch for ${selected.product_id}`)
  }

  const previousImage = existingFinalizedImages.get(selected.product_id)
  const uploaded =
    previousImage?.uploaded === true &&
    previousImage.asset_sha256 === normalizedDecision.asset_sha256 &&
    previousImage.thumbnail_asset_sha256 === normalizedDecision.thumbnail_asset_sha256 &&
    previousImage.storage_path === normalizedDecision.storage_path &&
    previousImage.thumbnail_storage_path === normalizedDecision.thumbnail_storage_path
  normalizedDecision.notes = uploaded
    ? "Nick approved this exact product image in the 14-product contact sheet on 2026-09-04. Local quality gate passed. Canonical and thumbnail assets were checksum-verified after upload to Supabase Storage."
    : "Nick approved this exact product image in the 14-product contact sheet on 2026-09-04. Local quality gate passed. Not uploaded to Supabase Storage."
  writeJson(decisionPath, normalizedDecision)

  const product = entry.final.product
  const key = itemKey(product.brand, product.name)
  const existingProductSupplement = existingSupplement.products?.[key]
  supplementProducts[key] = {
    image_url: normalizedDecision.public_url,
    affiliate_link: selected.candidate_image_source_url,
    purchase_link_status: "available",
    checked_at: existingProductSupplement?.checked_at ?? researchCheckedAt,
    ...(product.price_eur == null ? {} : { price_eur: product.price_eur }),
  }
  finalizedImages.push({
    product_id: selected.product_id,
    item_key: key,
    gtin: selected.gtin,
    source_page_url: normalizedDecision.source_page_url,
    source_image_url: normalizedDecision.source_image_url,
    source_type: normalizedDecision.source_type,
    storage_path: normalizedDecision.storage_path,
    public_url: normalizedDecision.public_url,
    final_file: normalizedDecision.final_file,
    asset_sha256: normalizedDecision.asset_sha256,
    thumbnail_storage_path: normalizedDecision.thumbnail_storage_path,
    thumbnail_final_file: normalizedDecision.thumbnail_final_file,
    thumbnail_asset_sha256: normalizedDecision.thumbnail_asset_sha256,
    quality_gate: normalizedDecision.quality_gate.status,
    user_approved: normalizedDecision.user_approved,
    reviewed_by: normalizedDecision.reviewed_by,
    reviewed_at: normalizedDecision.reviewed_at,
    uploaded,
  })
}

writeJson(scopedManifestPath, {
  batch_id: "scan-db-expansion-shampoo-scannable-14-2026-09-04",
  generated_at: reviewedAt,
  products,
  existing_product_updates: [],
})

writeJson(supplementPath, {
  batch_id: "scan-db-expansion-shampoo-scannable-14-2026-09-04",
  operator_profile_id: operatorProfileId,
  reviewed_head: reviewedHead,
  products: supplementProducts,
})

writeJson(imageReceiptPath, {
  schema_version: "shampoo-approved-image-finalization-v1",
  scope: "14 approved shampoos only",
  approved_at: reviewedAt,
  reviewed_by: "nick",
  uploaded: finalizedImages.every((image) => image.uploaded),
  products: finalizedImages,
})

process.stdout.write(
  `Prepared ${products.length} scoped products and ${finalizedImages.length} approved image packages.\n`,
)
