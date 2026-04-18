import assert from "node:assert/strict"
import test from "node:test"

import {
  getAllowedProductConcernCodes,
  getProductConcernCodesForProfileSignals,
  isProductConcernAllowedForCategory,
} from "../src/lib/product-specs/concern-taxonomy"

test("catalog concern taxonomy keeps profile-only signals out of product tagging", () => {
  assert.equal(isProductConcernAllowedForCategory("Leave-in", "hair_loss"), false)
  assert.equal(isProductConcernAllowedForCategory("Leave-in", "thinning"), false)
  assert.equal(isProductConcernAllowedForCategory("Leave-in", "colored"), false)
})

test("catalog concern taxonomy is category-scoped", () => {
  const leaveInConcerns = getAllowedProductConcernCodes("Leave-in")
  const shampooConcerns = getAllowedProductConcernCodes("Shampoo")

  assert.equal(leaveInConcerns.includes("tangling"), true)
  assert.equal(leaveInConcerns.includes("breakage"), true)
  assert.equal(shampooConcerns.includes("dryness"), true)
  assert.equal(shampooConcerns.includes("tangling"), false)
  assert.equal(isProductConcernAllowedForCategory("Shampoo", "tangling"), false)
  assert.equal(isProductConcernAllowedForCategory("Shampoo", "dryness"), true)
  assert.equal(isProductConcernAllowedForCategory("Leave-in", "tangling"), true)
})

test("mask taxonomy keeps engine-native performance tags alongside user-facing concerns", () => {
  const maskConcerns = getAllowedProductConcernCodes("Maske")

  assert.equal(maskConcerns.includes("performance"), true)
  assert.equal(maskConcerns.includes("breakage"), true)
})

test("profile concerns only map to exact category-supported product codes", () => {
  assert.deepEqual(
    getProductConcernCodesForProfileSignals("Leave-in", [
      "breakage",
      "tangling",
      "hair_loss",
      "colored",
    ]),
    ["breakage", "tangling"],
  )

  assert.deepEqual(
    getProductConcernCodesForProfileSignals("Bondbuilder", ["tangling", "breakage", "split_ends"]),
    ["breakage", "split_ends"],
  )
})
