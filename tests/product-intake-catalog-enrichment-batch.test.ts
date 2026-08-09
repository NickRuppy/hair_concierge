import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import {
  generateCatalogEnrichmentIndex,
  previewCatalogEnrichment,
  type CatalogEnrichmentManifest,
} from "../src/lib/product-intake/catalog-enrichment"

const BATCH_ROOT = "data/catalog-enrichment/personal-plan-launch-v1"

const HEAT_PRODUCTS = {
  "balea-two-phase-200ml": false,
  "balea-ultralight-200ml": true,
  "got2b-schutzengel-200ml": true,
  "jean-len-beat-the-heat-100ml": true,
  "loreal-elvital-dream-length-defeat-the-heat-150ml": true,
  "taft-aloe-boost-hydra-protect-150ml": false,
  "taft-gliss-lovely-long-150ml": true,
} as const

const SCALP_PRODUCTS = {
  "balea-professional-aha-scalp-peeling": "scalp_exfoliant",
  "balea-professional-sensitive-scalp-serum": "scalp_comfort",
  "eucerin-dermocapillaire-urea-intensive-tonic": "scalp_comfort",
  "gliss-scalp-balance-clarifying-serum": "scalp_flake_oil_adjunct",
  "head-shoulders-derma-x-pro-scalp-leave-in": "scalp_comfort",
  "isana-professional-aha-pha-scalp-peeling": "scalp_exfoliant",
  "loreal-elvital-fiber-booster-scalp-serum": "density_claim_tonic",
  "the-ordinary-multi-peptide-hair-density-serum": "density_claim_tonic",
} as const

type ApprovedBatchManifest = {
  product_key: string
  category_key: string
  lifecycle_classification: string
  catalog_state: {
    origin: string
    is_active: boolean
    lifecycle_status: string
    is_chaarlie_recommended: boolean
  }
  commercial: { status: string }
  image: { final_sha256: string }
  product_payload: {
    final: {
      review: { manual_reviewed: boolean; reviewed_by: string }
      product: { image_url: string | null }
    }
  }
  category_payload: {
    product_heat_protectant_specs?: {
      format: string
      provides_heat_protection: boolean
    }
    product_scalp_care_specs?: { primary_role: string }
    product_application_protocols: Array<{ role: string }>
  }
  planned_operations: Array<{
    type: string
    table: string
    catalog_content?: {
      brand_id: string | null
      product_line_id: string | null
      image_url: string | null
    }
  }>
}

async function loadManifest(category: "heat" | "scalp", productKey: string) {
  return JSON.parse(
    await readFile(`${BATCH_ROOT}/${category}/${productKey}.json`, "utf8"),
  ) as ApprovedBatchManifest
}

function assertGuardedApprovedManifest(manifest: ApprovedBatchManifest) {
  const preview = previewCatalogEnrichment(manifest)
  assert.equal(preview.writes, false)
  assert.equal(preview.schema_ok, true)
  assert.equal(preview.ready_for_handoff, true)
  assert.deepEqual(preview.pending_b1_resolutions, ["brand_id", "product_line_id", "image_url"])

  assert.equal(manifest.lifecycle_classification, "new_product")
  assert.equal(manifest.catalog_state.origin, "curated")
  assert.equal(manifest.catalog_state.is_active, true)
  assert.equal(manifest.catalog_state.lifecycle_status, "active")
  assert.equal(manifest.product_payload.final.review.manual_reviewed, true)
  assert.equal(manifest.product_payload.final.review.reviewed_by, "nick")
  assert.equal(manifest.product_payload.final.product.image_url, null)
  assert.match(manifest.image.final_sha256, /^[a-f0-9]{64}$/)

  assert.equal(manifest.planned_operations[0].type, "insert_product")
  assert.equal(manifest.planned_operations[0].table, "products")
  assert.equal(manifest.planned_operations[0].catalog_content?.brand_id, null)
  assert.equal(manifest.planned_operations[0].catalog_content?.product_line_id, null)
  assert.equal(manifest.planned_operations[0].catalog_content?.image_url, null)

  const allowedTables = new Set([
    "products",
    "product_heat_protectant_specs",
    "product_scalp_care_specs",
    "product_application_protocols",
  ])
  for (const operation of manifest.planned_operations) {
    assert.equal(allowedTables.has(operation.table), true, `unexpected table ${operation.table}`)
  }
}

test("the approved Heat cohort is complete, recommendation-correct, and preview-ready", async () => {
  for (const [productKey, recommended] of Object.entries(HEAT_PRODUCTS)) {
    const manifest = await loadManifest("heat", productKey)
    assert.equal(manifest.product_key, productKey)
    assert.equal(manifest.category_key, "heat_protectant")
    assert.equal(manifest.catalog_state.is_chaarlie_recommended, recommended)
    assert.equal(manifest.commercial.status, recommended ? "available" : "unavailable")
    assert.equal(manifest.category_payload.product_heat_protectant_specs?.format, "spray")
    assert.equal(
      manifest.category_payload.product_heat_protectant_specs?.provides_heat_protection,
      true,
    )
    assertGuardedApprovedManifest(manifest)
  }
})

test("the approved Scalp cohort is complete, role-correct, and preview-ready", async () => {
  for (const [productKey, role] of Object.entries(SCALP_PRODUCTS)) {
    const manifest = await loadManifest("scalp", productKey)
    assert.equal(manifest.product_key, productKey)
    assert.equal(manifest.category_key, "scalp_care")
    assert.equal(manifest.commercial.status, "available")
    assert.equal(manifest.catalog_state.is_chaarlie_recommended, true)
    assert.equal(manifest.category_payload.product_scalp_care_specs?.primary_role, role)
    assert.equal(manifest.category_payload.product_application_protocols[0].role, role)
    assertGuardedApprovedManifest(manifest)
  }
})

test("the approved 15-product index is unique, deterministic, and fingerprint-aligned", async () => {
  const locations = [
    ...Object.keys(HEAT_PRODUCTS).map((productKey) => ["heat", productKey] as const),
    ...Object.keys(SCALP_PRODUCTS).map((productKey) => ["scalp", productKey] as const),
  ]
  const manifests = await Promise.all(
    locations.map(([category, productKey]) => loadManifest(category, productKey)),
  )
  const index = generateCatalogEnrichmentIndex(manifests as unknown as CatalogEnrichmentManifest[])

  assert.equal(index.products.length, 15)
  assert.deepEqual(
    index.products.map(({ product_key }) => product_key),
    [...index.products.map(({ product_key }) => product_key)].sort(),
  )
  for (const [position, manifest] of manifests.entries()) {
    const preview = previewCatalogEnrichment(manifest)
    assert.equal("errors" in preview, false)
    if (!("errors" in preview)) {
      const entry = index.products.find(({ product_key }) => product_key === manifest.product_key)
      assert.ok(entry, `missing index entry at manifest ${position}`)
      assert.equal(entry.content_fingerprint, preview.content_fingerprint)
    }
  }
})
