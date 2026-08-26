import assert from "node:assert/strict"
import test from "node:test"

import {
  buildBaseline,
  sanitizeEvidenceRoute,
} from "../scripts/scanner-catalog-coverage/live-baseline-export"

const input = {
  products: [
    {
      id: "b",
      brand: "B",
      name: "Two",
      category_key: "shampoo",
      is_active: true,
      lifecycle_status: "active",
      origin: "curated",
      is_chaarlie_recommended: true,
    },
    {
      id: "a",
      brand: "A",
      name: "One",
      category_key: "shampoo",
      is_active: true,
      lifecycle_status: "active",
      origin: "curated",
      is_chaarlie_recommended: false,
    },
    {
      id: "x",
      brand: "X",
      name: "Old",
      category_key: "shampoo",
      is_active: true,
      lifecycle_status: "discontinued",
    },
  ],
  categories: [{ key: "shampoo", is_catalog_supported: true }],
  identifiers: [
    { product_id: "a", identifier_type: "ean", identifier_value: "4006381333931", source: "dm" },
    { product_id: "a", identifier_type: "retailer_sku", identifier_value: "secret" },
    { product_id: "b", identifier_type: "barcode", identifier_value: "4006381333930" },
  ],
  facts: {
    product_shampoo_specs: [{ product_id: "a", shampoo_bucket: "normal", created_at: "x" }],
  },
  protocols: [
    {
      product_id: "a",
      category: "shampoo",
      role: "shampoo_everyday",
      application_family: "product",
      guidance_payload: {},
    },
  ],
  dispositions: [],
  submissions: [
    {
      id: "submission-1",
      status: "researching",
      category: "shampoo",
      user_id: "must-not-export",
      researched_payload: {
        final: {
          product: { canonical_brand: "Balea", product_line: "Plex", clean_name: "Shampoo" },
          identifiers: [
            { type: "retailer_sku", value: "4006381333930", source: "retailer" },
            { type: "ean", value: "4006381333931", source: "manufacturer" },
            { type: "barcode", value: "4066447238952", source: "retailer" },
          ],
        },
      },
    },
    {
      id: "submission-2",
      status: "pending_review",
      user_id: "must-not-export",
      researched_payload: {},
    },
  ],
  exportedAt: "2026-08-26T00:00:00.000Z",
  projectRef: "pqdkhefxsxkyeqelqegq",
}

test("baseline is deterministic, supported-active-only, and reconciles barcode rows", () => {
  const first = buildBaseline(input)
  const second = buildBaseline(input)
  assert.deepEqual(first, second)
  assert.deepEqual(
    first.products.map((product) => product.product_id),
    ["a", "b"],
  )
  assert.equal(first.reconciliation.active_products, 2)
  assert.equal(first.reconciliation.barcode_linked_products, 1)
  assert.equal(first.reconciliation.barcode_rows, 2)
  assert.equal(first.products[0]?.readiness.scan_candidate, true)
})

test("baseline sanitizes facts and open submissions without user data", () => {
  const baseline = buildBaseline(input)
  const serialized = JSON.stringify(baseline)
  assert.doesNotMatch(serialized, /must-not-export|user_id|researched_payload/)
  assert.deepEqual(baseline.open_submission_identity_candidates.resolved_identity_candidates, [
    {
      submission_id: "submission-1",
      status: "researching",
      category: "shampoo",
      canonical_brand: "Balea",
      product_line: "Plex",
      clean_name: "Shampoo",
      canonical_gtin14: "04006381333931",
      canonical_gtin14s: ["04006381333931", "04066447238952"],
    },
  ])
  assert.deepEqual(baseline.products[0]?.category_primary_facts, {
    product_shampoo_specs: [{ shampoo_bucket: "normal" }],
  })
})

test("commercial evidence route preserves only the HTTPS origin and pathname", () => {
  assert.equal(
    sanitizeEvidenceRoute("https://www.dm.de/product?affiliate=secret#top"),
    "https://www.dm.de/product",
  )
  assert.equal(sanitizeEvidenceRoute("ftp://private.example/file"), null)
  assert.equal(sanitizeEvidenceRoute("not a url"), null)
})
