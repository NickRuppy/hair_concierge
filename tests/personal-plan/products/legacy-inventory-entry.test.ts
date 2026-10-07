import assert from "node:assert/strict"
import test from "node:test"

import { mapLegacyInventoryPrefill } from "../../../src/lib/personal-plan/products/legacy-inventory-entry"

test("separates verified exact inventory from frequency-repair and name hints", () => {
  const result = mapLegacyInventoryPrefill({
    usageRows: [
      {
        id: "exact",
        category: "conditioner",
        productName: "Exact conditioner",
        frequencyRange: "weekly_2x",
        catalogMatch: {
          productId: "catalog-1",
          displayName: "Exact conditioner",
          category: "conditioner",
          eligible: true,
        },
      },
      {
        id: "needs-frequency",
        category: "oil",
        productName: "Exact oil",
        frequencyRange: "old_range",
        catalogMatch: {
          productId: "catalog-2",
          displayName: "Exact oil",
          category: "oil",
          eligible: true,
        },
      },
      {
        id: "retired",
        category: "mask",
        productName: "Old mask",
        frequencyRange: "weekly_1x",
        catalogMatch: {
          productId: "catalog-3",
          displayName: "Old mask",
          category: "mask",
          eligible: false,
        },
      },
      {
        id: "name-only",
        category: "leave_in",
        productName: "Known only by name",
        frequencyRange: null,
      },
    ],
  })

  assert.deepEqual(result.exactInventory, [
    {
      usageId: "exact",
      productId: "catalog-1",
      displayName: "Exact conditioner",
      category: "conditioner",
      frequencyRange: "weekly_2x",
    },
  ])
  assert.deepEqual(result.productHints, [
    {
      kind: "catalog_frequency_required",
      usageId: "needs-frequency",
      productId: "catalog-2",
      displayName: "Exact oil",
      category: "oil",
    },
    { kind: "search_name", usageId: "retired", category: "mask", productName: "Old mask" },
    {
      kind: "search_name",
      usageId: "name-only",
      category: "leave_in",
      productName: "Known only by name",
    },
  ])
})

test("never trusts a mismatched catalog category and has a stable source fingerprint", () => {
  const input = {
    usageRows: [
      {
        id: "wrong-category",
        category: "shampoo",
        productName: "Product",
        frequencyRange: "weekly_1x",
        catalogMatch: {
          productId: "catalog-4",
          displayName: "Product",
          category: "conditioner",
          eligible: true,
        },
      },
    ],
  } as const

  const first = mapLegacyInventoryPrefill(input)
  const second = mapLegacyInventoryPrefill(input)
  assert.deepEqual(first.exactInventory, [])
  assert.deepEqual(first.productHints, [
    { kind: "search_name", usageId: "wrong-category", category: "shampoo", productName: "Product" },
  ])
  assert.equal(first.sourceFingerprint, second.sourceFingerprint)
  assert.match(first.sourceFingerprint, /^legacy-prefill-v1:sha256:[a-f0-9]{64}$/)
})

test("fingerprints equivalent input independently of property and row order", () => {
  const first = mapLegacyInventoryPrefill({
    usageRows: [
      { id: "a", category: "shampoo", productName: "A", frequencyRange: "weekly_2x" },
      { id: "b", category: "mask", productName: "B", frequencyRange: "weekly_1x" },
    ],
  })
  const second = mapLegacyInventoryPrefill({
    usageRows: [
      { frequencyRange: "weekly_1x", productName: "B", category: "mask", id: "b" },
      { frequencyRange: "weekly_2x", productName: "A", category: "shampoo", id: "a" },
    ],
  })

  assert.equal(first.sourceFingerprint, second.sourceFingerprint)
  assert.match(first.sourceFingerprint, /^legacy-prefill-v1:sha256:[a-f0-9]{64}$/)
})

test("conflicting duplicate frequencies become a repair hint instead of an arbitrary exact seed", () => {
  const result = mapLegacyInventoryPrefill({
    usageRows: [
      {
        id: "first",
        category: "conditioner",
        productName: "Same product",
        frequencyRange: "weekly_1x",
        catalogMatch: {
          productId: "catalog-1",
          displayName: "Same product",
          category: "conditioner",
          eligible: true,
        },
      },
      {
        id: "second",
        category: "conditioner",
        productName: "Same product",
        frequencyRange: "weekly_3_4x",
        catalogMatch: {
          productId: "catalog-1",
          displayName: "Same product",
          category: "conditioner",
          eligible: true,
        },
      },
    ],
  })

  assert.deepEqual(result.exactInventory, [])
  assert.deepEqual(result.productHints, [
    {
      kind: "catalog_frequency_required",
      usageId: "first",
      productId: "catalog-1",
      displayName: "Same product",
      category: "conditioner",
    },
  ])
})

test("ignores unselected shampoo fallbacks and unsupported categories while retaining audit source IDs", () => {
  const result = mapLegacyInventoryPrefill({
    usageRows: [
      { id: "shampoo", category: "shampoo", productName: "Clean", frequencyRange: "weekly_3_4x" },
      {
        id: "fallback",
        category: "shampoo",
        productName: "__system_no_shampoo_selected__",
        frequencyRange: "less_than_monthly",
      },
      {
        id: "unknown",
        category: "something_else",
        productName: "Ignored",
        frequencyRange: "weekly_1x",
      },
    ],
  })

  assert.deepEqual(result.exactInventory, [])
  assert.deepEqual(result.productHints, [
    { kind: "search_name", usageId: "shampoo", category: "shampoo", productName: "Clean" },
  ])
  assert.deepEqual(result.sourceIds, ["fallback", "shampoo", "unknown"])
})
