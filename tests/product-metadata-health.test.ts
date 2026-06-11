import assert from "node:assert/strict"
import test from "node:test"

import {
  auditProductMetadata,
  hasStalePrice,
  hasSuspiciousNameMarker,
  numericPrice,
  type ExpectedPriceCheck,
  type ProductMetadataAuditInput,
} from "../src/lib/product-metadata/health"

function buildProduct(
  overrides: Partial<ProductMetadataAuditInput> = {},
): ProductMetadataAuditInput {
  return {
    id: "product-1",
    name: "Olaplex No. 5 Leave-In Conditioner",
    brand: "Olaplex",
    category: "Leave-in",
    affiliate_link: "https://olaplex.de/products/original-olaplex-n-5leave-in-conditioner",
    image_url: "https://example.com/product.jpg",
    price_eur: 34,
    purchase_link_status: "available",
    is_active: true,
    ...overrides,
  }
}

test("hasSuspiciousNameMarker flags catalog footnote markers", () => {
  assert.equal(hasSuspiciousNameMarker("Guhl Panthenol*"), true)
  assert.equal(hasSuspiciousNameMarker("Olaplex No. 5 Leave-In Conditioner"), false)
})

test("numericPrice handles number, comma decimal, and empty values", () => {
  assert.equal(numericPrice(4.99), 4.99)
  assert.equal(numericPrice("4,99"), 4.99)
  assert.equal(numericPrice(""), null)
})

test("auditProductMetadata reports known metadata issues", () => {
  const findings = auditProductMetadata(
    buildProduct({
      name: "Guhl Panthenol*",
      affiliate_link: "https://www.geizhals.de/guhl-panthenol",
      image_url: "",
      price_eur: null,
      purchase_link_status: "unavailable",
    }),
  )

  assert.deepEqual(
    findings.map((finding) => finding.type),
    ["suspicious_name_marker", "denylisted_host", "missing_price", "missing_image", "unavailable"],
  )
})

test("hasStalePrice flags watched price deltas above the expected maximum", () => {
  const olaplexCheck: ExpectedPriceCheck = {
    id: "4827c174-92e9-4121-ab70-843d5c037ad0",
    expected_price_eur: 34,
    max_delta_eur: 0.05,
    source_url: "https://olaplex.de/products/original-olaplex-n-5leave-in-conditioner",
  }

  assert.equal(hasStalePrice(19.65, olaplexCheck), true)
})
