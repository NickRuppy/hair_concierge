import assert from "node:assert/strict"
import test from "node:test"

import {
  classifyCandidate,
  fingerprint,
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

test("fingerprint excludes export time and sorts object keys", () => {
  const one = fingerprint({
    schema_version: 1,
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
    candidates: [],
  })
  const two = fingerprint({
    candidates: [],
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
    schema_version: 1,
  })
  assert.equal(one, two)
})
