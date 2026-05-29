import assert from "node:assert/strict"
import test from "node:test"

import { RESET_FOCUSES } from "@/lib/recommendation-engine/contracts"

test("deep-cleansing seed matrix contains reviewed real products and new reset-focus values", async () => {
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  delete process.env.NEXT_PUBLIC_SUPABASE_URL
  delete process.env.SUPABASE_SERVICE_ROLE_KEY

  try {
    const module = await import("../scripts/seed-deep-cleansing-products")

    assert.equal(module.DEEP_CLEANSING_SEED_PRODUCTS.length, 10)
    assert.deepEqual(RESET_FOCUSES, [
      "product_sebum_buildup",
      "metal_mineral_hard_water",
      "broad_spectrum_detox",
    ])
    assert.equal(
      module.DEEP_CLEANSING_SEED_PRODUCTS.some(
        (product: { brand: string }) => product.brand === "Hair Concierge",
      ),
      false,
    )

    const resetFocuses = new Set(
      module.DEEP_CLEANSING_SEED_PRODUCTS.map(
        (product: { specs: { reset_focus: string } }) => product.specs.reset_focus,
      ),
    )
    assert.deepEqual([...resetFocuses].sort(), [
      "broad_spectrum_detox",
      "metal_mineral_hard_water",
      "product_sebum_buildup",
    ])

    for (const product of module.DEEP_CLEANSING_SEED_PRODUCTS) {
      assert.match(product.retailer_url, /^https?:\/\//)
      assert.match(product.source_url, /^https?:\/\//)
      assert.ok(product.source_note.length > 20)
      assert.ok(product.mapping_reason.length > 20)
      if (product.specs.color_treated_suitability === "suitable") {
        assert.match(product.source_note, /color|colour|farb|colored|chemically|colour/i)
      }
    }
  } finally {
    if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL
    else process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl
    if (originalKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY
    else process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey
  }
})

test("deep-cleansing seed helper identifies active rows outside the planned catalog", async () => {
  const module = await import("../scripts/seed-deep-cleansing-products")

  assert.deepEqual(module.STALE_DEEP_CLEANSING_DEACTIVATION_PATCH, {
    is_active: false,
    lifecycle_status: "discontinued",
  })
  assert.deepEqual(
    module.findUnexpectedActiveDeepCleansingProducts([
      {
        id: "planned",
        brand: "K18",
        name: "PEPTIDE PREP Detox Shampoo",
        category: "Tiefenreinigungsshampoo",
        is_active: true,
      },
      {
        id: "planned-alias",
        brand: "OUAI",
        name: "Detox Shampoo",
        category: "Deep Cleansing Shampoo",
        is_active: true,
      },
      {
        id: "stale",
        brand: "Legacy",
        name: "Old Reset Shampoo",
        category: "Tiefenreinigungsshampoo",
        is_active: true,
      },
      {
        id: "stale-alias",
        brand: "Legacy",
        name: "Old Reset Alias",
        category: "deep_cleansing_shampoo",
        is_active: true,
      },
      {
        id: "inactive",
        brand: "Legacy",
        name: "Inactive Reset",
        category: "Tiefenreinigungsshampoo",
        is_active: false,
      },
      {
        id: "other-category",
        brand: "Legacy",
        name: "Old Shampoo",
        category: "Shampoo",
        is_active: true,
      },
    ]),
    ["stale", "stale-alias"],
  )
})

test("deep-cleansing seed apply requires expected project confirmation", async () => {
  const module = await import("../scripts/seed-deep-cleansing-products")

  assert.doesNotThrow(() =>
    module.assertDeepCleansingSeedApplyTarget({
      supabaseUrl: "https://pqdkhefxsxkyeqelqegq.supabase.co",
      argv: ["node", "script", "--apply", "--confirm-project=pqdkhefxsxkyeqelqegq"],
    }),
  )
  assert.throws(
    () =>
      module.assertDeepCleansingSeedApplyTarget({
        supabaseUrl: "https://pqdkhefxsxkyeqelqegq.supabase.co",
        argv: ["node", "script", "--apply"],
      }),
    /without --confirm-project=pqdkhefxsxkyeqelqegq/,
  )
  assert.throws(
    () =>
      module.assertDeepCleansingSeedApplyTarget({
        supabaseUrl: "https://wrong-project.supabase.co",
        argv: ["node", "script", "--apply", "--confirm-project=pqdkhefxsxkyeqelqegq"],
      }),
    /unexpected Supabase project/,
  )
})
