import assert from "node:assert/strict"
import test from "node:test"

import { canonicalizeGtin } from "../src/lib/product-identity"

test("pads UPC-A (GTIN-12) to canonical 14 digits", () => {
  assert.equal(canonicalizeGtin("022796976116"), "00022796976116")
})

test("UPC-A, EAN-13, and GTIN-14 spellings of the same number share one canonical form", () => {
  // The OGX Argan Oil of Morocco shampoo barcode as three sources write it.
  assert.equal(canonicalizeGtin("022796976116"), canonicalizeGtin("0022796976116"))
  assert.equal(canonicalizeGtin("0022796976116"), canonicalizeGtin("00022796976116"))
})

test("keeps a 14-digit GTIN unchanged", () => {
  assert.equal(canonicalizeGtin("08700216939140"), "08700216939140")
})

test("pads EAN-8 to canonical 14 digits", () => {
  assert.equal(canonicalizeGtin("12345670"), "00000012345670")
})

test("tolerates the grouping whitespace printed under barcodes", () => {
  assert.equal(canonicalizeGtin("0 022796 976116"), "00022796976116")
})

test("tolerates hyphens used in retailer feeds", () => {
  assert.equal(canonicalizeGtin("0-022796-976116"), "00022796976116")
})

test("rejects values with non-digit characters", () => {
  assert.equal(canonicalizeGtin("C007813"), null)
})

test("rejects digit strings of non-GTIN lengths", () => {
  assert.equal(canonicalizeGtin("1234567890"), null)
  assert.equal(canonicalizeGtin("123456789012345"), null)
})

test("rejects the empty string", () => {
  assert.equal(canonicalizeGtin(""), null)
})
