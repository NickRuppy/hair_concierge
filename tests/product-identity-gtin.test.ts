import assert from "node:assert/strict"
import test from "node:test"

import {
  canonicalizeGtin,
  gtinQueryVariants,
  hasValidGs1CheckDigit,
} from "../src/lib/product-identity"

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

test("validates the GS1 mod-10 check digit across GTIN lengths", () => {
  assert.equal(hasValidGs1CheckDigit("12345670"), true)
  assert.equal(hasValidGs1CheckDigit("022796976116"), true)
  assert.equal(hasValidGs1CheckDigit("4006381333931"), true)
  assert.equal(hasValidGs1CheckDigit("08700216939140"), true)
  assert.equal(hasValidGs1CheckDigit("4006381333930"), false)
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

test("rejects GTIN-shaped digit strings with invalid GS1 check digits", () => {
  assert.equal(canonicalizeGtin("4006381333930"), null)
  assert.equal(canonicalizeGtin("12345671"), null)
})

test("rejects the empty string", () => {
  assert.equal(canonicalizeGtin(""), null)
})

test("gtinQueryVariants: canonical plus every legacy spelling the padding permits", () => {
  assert.deepEqual(gtinQueryVariants("0022796976116"), [
    "0022796976116",
    "00022796976116",
    "022796976116",
  ])
})

test("gtinQueryVariants: EAN-8 expands to 8/12/13/14 digit spellings", () => {
  assert.deepEqual(gtinQueryVariants("12345670"), [
    "12345670",
    "00000012345670",
    "0000012345670",
    "000012345670",
  ])
})

test("gtinQueryVariants: no shorter spelling is offered when leading digits are non-zero", () => {
  assert.deepEqual(gtinQueryVariants("4006381333931"), ["4006381333931", "04006381333931"])
})

test("gtinQueryVariants: non-GTIN input returns just the input", () => {
  assert.deepEqual(gtinQueryVariants("not-a-barcode"), ["not-a-barcode"])
})
