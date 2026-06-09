import assert from "node:assert/strict"
import test from "node:test"

import { buildProductUsagePayloads } from "../src/lib/onboarding/product-usage-save"
import { UNSELECTED_SHAMPOO_PRODUCT_NAME } from "../src/lib/product-usage/shampoo-fallback"

test("adds shampoo after selected conditioner when shampoo is not selected", () => {
  assert.deepEqual(
    buildProductUsagePayloads({
      selectedCategories: ["conditioner"],
      drilldowns: {
        conditioner: {
          productName: "Conditioner",
          frequency: "weekly_2x",
        },
      },
    }),
    [
      {
        category: "conditioner",
        product_name: "Conditioner",
        frequency_range: "weekly_2x",
      },
      {
        category: "shampoo",
        product_name: UNSELECTED_SHAMPOO_PRODUCT_NAME,
        frequency_range: "less_than_monthly",
      },
    ],
  )
})

test("preserves selected shampoo product details without duplicating shampoo", () => {
  assert.deepEqual(
    buildProductUsagePayloads({
      selectedCategories: ["shampoo"],
      drilldowns: {
        shampoo: {
          productName: "Shampoo",
          frequency: "weekly_3_4x",
        },
      },
    }),
    [
      {
        category: "shampoo",
        product_name: "Shampoo",
        frequency_range: "weekly_3_4x",
      },
    ],
  )
})

test("preserves selected order when shampoo is already selected with conditioner", () => {
  assert.deepEqual(
    buildProductUsagePayloads({
      selectedCategories: ["conditioner", "shampoo"],
      drilldowns: {
        conditioner: {
          productName: "Conditioner",
          frequency: "weekly_1x",
        },
        shampoo: {
          productName: "Shampoo",
          frequency: "weekly_2x",
        },
      },
    }),
    [
      {
        category: "conditioner",
        product_name: "Conditioner",
        frequency_range: "weekly_1x",
      },
      {
        category: "shampoo",
        product_name: "Shampoo",
        frequency_range: "weekly_2x",
      },
    ],
  )
})

test("deduplicates repeated selected categories", () => {
  assert.deepEqual(
    buildProductUsagePayloads({
      selectedCategories: ["conditioner", "conditioner"],
      drilldowns: {
        conditioner: {
          productName: "Conditioner",
          frequency: "weekly_2x",
        },
      },
    }),
    [
      {
        category: "conditioner",
        product_name: "Conditioner",
        frequency_range: "weekly_2x",
      },
      {
        category: "shampoo",
        product_name: UNSELECTED_SHAMPOO_PRODUCT_NAME,
        frequency_range: "less_than_monthly",
      },
    ],
  )
})
