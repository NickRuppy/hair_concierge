import assert from "node:assert/strict"
import test from "node:test"

import {
  classifyCandidate,
  classifyProductReadiness,
  fingerprint,
  selectActiveSupportedProducts,
} from "../scripts/scanner-catalog-coverage/readiness-export"

test("readiness classification is deterministic and only admits complete non-unknown candidates", () => {
  const ready = classifyCandidate({
    product_id: "a",
    category: "shampoo",
    has_barcode: false,
    has_disposition: false,
    image_url_present: true,
    product_facts_present: true,
    required_protocols_complete: true,
    verdicts: [{ profile: "normal", role: "shampoo_everyday", verdict: "ideal" }],
  })
  assert.equal(ready.status, "ready_for_ean_research")
  assert.deepEqual(ready.blockers, [])
  const blocked = classifyCandidate({
    product_id: "b",
    category: "shampoo",
    has_barcode: false,
    has_disposition: true,
    image_url_present: false,
    product_facts_present: false,
    required_protocols_complete: false,
    verdicts: [
      { profile: "normal", role: "shampoo_everyday", verdict: "unknown" },
      { profile: "fine", role: "shampoo_everyday", verdict: "error" },
    ],
  })
  assert.equal(blocked.status, "blocked")
  assert.deepEqual(blocked.blockers, [
    "has_disposition",
    "missing_presentation_image",
    "missing_product_facts",
    "missing_required_protocol",
    "verdict_unknown",
    "verdict_error",
  ])
})

test("a secondary applicable role with an unknown verdict blocks the product", () => {
  const result = classifyCandidate({
    product_id: "multi-role",
    category: "leave_in",
    has_barcode: false,
    has_disposition: false,
    image_url_present: true,
    product_facts_present: true,
    required_protocols_complete: true,
    verdicts: [
      { profile: "normal", role: "post_wash_leave_in", verdict: "ideal" },
      { profile: "normal", role: "pre_heat_application", verdict: "unknown" },
    ],
  })
  assert.equal(result.status, "blocked")
  assert.deepEqual(result.blockers, ["verdict_unknown"])
})

test("linked products remain inside the strict full-catalog readiness audit", () => {
  const selected = selectActiveSupportedProducts(
    [
      {
        id: "linked",
        category_key: "shampoo",
        is_active: true,
        lifecycle_status: "active",
      },
      {
        id: "unlinked",
        category_key: "conditioner",
        is_active: true,
        lifecycle_status: "active",
      },
      {
        id: "inactive",
        category_key: "mask",
        is_active: false,
        lifecycle_status: "inactive",
      },
    ],
    [
      { product_id: "linked", identifier_type: "ean", identifier_value: "4066447238952" },
      { product_id: "unlinked", identifier_type: "ean", identifier_value: "not-a-gtin" },
    ],
  )
  assert.deepEqual(
    selected.map(({ row, has_barcode }) => ({ id: row.id, has_barcode })),
    [
      { id: "linked", has_barcode: true },
      { id: "unlinked", has_barcode: false },
    ],
  )

  const linkedReady = classifyProductReadiness({
    product_id: "linked",
    category: "shampoo",
    has_barcode: true,
    has_disposition: false,
    image_url_present: true,
    product_facts_present: true,
    required_protocols_complete: true,
    verdicts: [{ profile: "normal", role: "shampoo_everyday", verdict: "ideal" }],
  })
  assert.equal(linkedReady.status, "scan_result_ready")

  const linkedBlocked = classifyProductReadiness({
    product_id: "linked-blocked",
    category: "shampoo",
    has_barcode: true,
    has_disposition: false,
    image_url_present: true,
    product_facts_present: true,
    required_protocols_complete: false,
    verdicts: [{ profile: "normal", role: "shampoo_everyday", verdict: "ideal" }],
  })
  assert.equal(linkedBlocked.status, "blocked")
  assert.deepEqual(linkedBlocked.blockers, ["missing_required_protocol"])
})

test("fingerprint excludes export time and sorts object keys", () => {
  const one = fingerprint({
    schema_version: 2,
    source: {
      project_ref: "x",
      read_only: true,
      identifier_canonicalization: "runtime_canonicalize_gtin14",
    },
    reconciliation: {
      active_supported_without_barcode: 0,
      ready_for_ean_research: 0,
      blocked: 0,
      by_category: { shampoo: { candidates: 0, ready_for_ean_research: 0, blocked: 0 } },
    },
    full_catalog_reconciliation: {
      active_supported: 0,
      barcode_linked: 0,
      scan_result_ready: 0,
      ready_for_ean_research: 0,
      blocked: 0,
      by_category: {},
    },
    candidates: [],
    products: [],
  })
  const two = fingerprint({
    candidates: [],
    products: [],
    full_catalog_reconciliation: {
      by_category: {},
      blocked: 0,
      ready_for_ean_research: 0,
      scan_result_ready: 0,
      barcode_linked: 0,
      active_supported: 0,
    },
    reconciliation: {
      by_category: { shampoo: { blocked: 0, ready_for_ean_research: 0, candidates: 0 } },
      blocked: 0,
      ready_for_ean_research: 0,
      active_supported_without_barcode: 0,
    },
    source: {
      identifier_canonicalization: "runtime_canonicalize_gtin14",
      read_only: true,
      project_ref: "x",
    },
    schema_version: 2,
  })
  assert.equal(one, two)
})
