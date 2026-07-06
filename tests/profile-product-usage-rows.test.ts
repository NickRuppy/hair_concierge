import assert from "node:assert/strict"
import test from "node:test"

import {
  createProductRows,
  getProductCompletionLabel,
  type UserProductUsageRow,
} from "../src/lib/profile/product-usage-rows"

test("profile product rows prefer verified catalog identity over raw intake text", () => {
  const rows = createProductRows([
    {
      id: "usage-1",
      category: "conditioner",
      brand_text: "Raw Brand",
      product_name: "Raw Conditioner",
      frequency_range: "weekly_2x",
      product_id: "product-1",
      product_submission_id: null,
      match_status: "matched",
      product: {
        id: "product-1",
        name: "Verified Conditioner",
        brand: "Legacy Brand",
        is_chaarlie_recommended: false,
        brand_identity: {
          id: "brand-1",
          canonical_name: "Verified Brand",
        },
        product_line: {
          id: "line-1",
          canonical_name: "Repair Line",
        },
      },
    },
  ] satisfies UserProductUsageRow[])

  assert.equal(rows[0]?.productName, "Verified Brand Repair Line Verified Conditioner")
  assert.equal(rows[0]?.reviewStatusLabel, null)
  assert.equal(rows[0]?.isComplete, true)
})

test("profile product rows keep pending products visible without treating them as verified", () => {
  const rows = createProductRows([
    {
      id: "usage-2",
      category: "shampoo",
      brand_text: "Unknown Brand",
      product_name: "Mystery Shampoo",
      frequency_range: "weekly_1x",
      product_id: null,
      product_submission_id: "submission-1",
      match_status: "pending_review",
      product: null,
    },
  ] satisfies UserProductUsageRow[])

  assert.equal(rows[0]?.productName, "Unknown Brand Mystery Shampoo")
  assert.equal(rows[0]?.reviewStatusLabel, "In Prüfung")
  assert.equal(rows[0]?.isComplete, false)
  assert.equal(getProductCompletionLabel(rows, true), "0/1 verifiziert")
})

test("profile product rows do not duplicate catalog brand or line already present in the product name", () => {
  const rows = createProductRows([
    {
      id: "usage-3",
      category: "shampoo",
      brand_text: "Raw Brand",
      product_name: "Raw Shampoo",
      frequency_range: "weekly_3_4x",
      product_id: "product-3",
      product_submission_id: null,
      match_status: "matched",
      product: {
        id: "product-3",
        name: "OGX Renewing Argan Oil of Morocco Shampoo",
        brand: "OGX",
        is_chaarlie_recommended: false,
        brand_identity: {
          id: "brand-ogx",
          canonical_name: "OGX",
        },
        product_line: {
          id: "line-ogx-renewing",
          canonical_name: "Renewing Argan Oil of Morocco",
        },
      },
    },
  ] satisfies UserProductUsageRow[])

  assert.equal(rows[0]?.productName, "OGX Renewing Argan Oil of Morocco Shampoo")
})

test("profile product rows do not duplicate raw brand already present in pending product text", () => {
  const rows = createProductRows([
    {
      id: "usage-4",
      category: "oil",
      brand_text: "Neqi",
      product_name: "Neqi Smooth Strength Rosemary Oil",
      frequency_range: "weekly_2x",
      product_id: null,
      product_submission_id: "submission-4",
      match_status: "pending_review",
      product: null,
    },
  ] satisfies UserProductUsageRow[])

  assert.equal(rows[0]?.productName, "Neqi Smooth Strength Rosemary Oil")
})
