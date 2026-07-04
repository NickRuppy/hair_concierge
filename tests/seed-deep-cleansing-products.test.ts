import assert from "node:assert/strict"
import test from "node:test"

import { RESET_FOCUSES } from "@/lib/recommendation-engine/contracts"

test("deep-cleansing seed matrix contains creator-source deep-cleansing products", async () => {
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  delete process.env.NEXT_PUBLIC_SUPABASE_URL
  delete process.env.SUPABASE_SERVICE_ROLE_KEY

  try {
    const module = await import("../scripts/seed-deep-cleansing-products")

    assert.equal(module.DEEP_CLEANSING_SEED_PRODUCTS.length, 5)
    assert.deepEqual(
      module.DEEP_CLEANSING_SEED_PRODUCTS.map(
        (product: { brand: string; name: string }) => `${product.brand}::${product.name}`,
      ),
      [
        "NEQI::Deep Cleansing Shampoo",
        "Swiss-O-Par::Tiefenreinigung Shampoo",
        "Balea::Shampoo Tiefenreinigung",
        "ISANA::Professional Shampoo Tiefenreinigung",
        "Gliss::Tiefenreinigungs-Shampoo",
      ],
    )
    assert.deepEqual(
      module.DEEP_CLEANSING_SEED_PRODUCTS.map(
        (product: { brand: string; product_line: string | null; name: string }) => ({
          brand: product.brand,
          line: product.product_line,
          name: product.name,
        }),
      ),
      [
        {
          brand: "NEQI",
          line: "x @_the.beautiful.people",
          name: "Deep Cleansing Shampoo",
        },
        { brand: "Swiss-O-Par", line: null, name: "Tiefenreinigung Shampoo" },
        { brand: "Balea", line: "Professional", name: "Shampoo Tiefenreinigung" },
        { brand: "ISANA", line: null, name: "Professional Shampoo Tiefenreinigung" },
        { brand: "Gliss", line: "Scalp Balance", name: "Tiefenreinigungs-Shampoo" },
      ],
    )
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
    assert.equal(
      module.DEEP_CLEANSING_SEED_PRODUCTS.some((product: { brand: string }) =>
        [
          "K18",
          "OUAI",
          "OLAPLEX",
          "Redken",
          "Living Proof",
          "L'Oreal Professionnel",
          "Malibu C",
          "Moroccanoil",
          "Davines",
          "Bumble and bumble",
        ].includes(product.brand),
      ),
      false,
    )

    const resetFocuses = new Set(
      module.DEEP_CLEANSING_SEED_PRODUCTS.map(
        (product: { specs: { reset_focus: string } }) => product.specs.reset_focus,
      ),
    )
    assert.deepEqual([...resetFocuses].sort(), ["broad_spectrum_detox", "product_sebum_buildup"])

    for (const product of module.DEEP_CLEANSING_SEED_PRODUCTS) {
      assert.match(product.affiliate_link, /^https?:\/\//)
      assert.match(product.source_url, /^https?:\/\//)
      assert.ok(product.source_note.length > 20)
      assert.ok(product.mapping_reason.length > 20)
      assert.equal(product.purchase_link_status, "available")
      assert.equal(product.currency, "EUR")
      assert.ok(product.price_eur > 0, `${product.name} needs a current price`)
      assert.match(product.purchase_link_checked_at, /^2026-07-03T/)
      assert.match(product.price_checked_at, /^2026-07-03T/)
      assert.match(
        product.image_url,
        /^https:\/\/pqdkhefxsxkyeqelqegq\.supabase\.co\/storage\/v1\/object\/public\/product-images\/catalog-additions\/2026-07-03\/deep-cleansing\/.+\.webp$/,
      )
      assert.ok(product.identifiers.length > 0, `${product.name} needs identity identifiers`)

      const normalizedName = product.name.toLocaleLowerCase("de-DE")
      assert.equal(
        normalizedName.startsWith(product.brand.toLocaleLowerCase("de-DE")),
        false,
        `${product.name} should not duplicate brand ${product.brand}`,
      )
      if (product.product_line) {
        assert.equal(
          normalizedName.startsWith(product.product_line.toLocaleLowerCase("de-DE")),
          false,
          `${product.name} should not duplicate line ${product.product_line}`,
        )
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
        brand: "NEQI",
        name: "Deep Cleansing Shampoo",
        category: "Tiefenreinigungsshampoo",
        is_active: true,
      },
      {
        id: "planned-alias",
        brand: "Balea",
        name: "Shampoo Tiefenreinigung",
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

test("deep-cleansing seed payload preserves catalog metadata and chaarlie flags", async () => {
  const module = await import("../scripts/seed-deep-cleansing-products")
  const product = module.DEEP_CLEANSING_SEED_PRODUCTS.find(
    (seedProduct: { brand: string }) => seedProduct.brand === "Balea",
  )

  assert.ok(product)
  assert.deepEqual(product.legacy_affiliate_links, [
    "https://www.dm.de/balea-professional-shampoo-tiefenreinigung-p4010355426239.html",
  ])

  const payload = module.buildDeepCleansingProductPayload({
    product,
    existingCatalogRow: {
      id: "existing-product",
      brand: "Balea",
      name: "Balea Tiefenreinigung",
      category: "Tiefenreinigungsshampoo",
      is_active: true,
      tags: ["dm-altbestand"],
      suitable_thicknesses: ["fine"],
      suitable_concerns: ["healthy_scalp"],
      image_url: null,
    },
    brandId: "brand-balea",
    productLineId: "line-professional",
  })

  assert.equal(payload.brand, "Balea")
  assert.equal(payload.name, "Shampoo Tiefenreinigung")
  assert.equal(payload.brand_id, "brand-balea")
  assert.equal(payload.product_line_id, "line-professional")
  assert.equal(payload.origin, "curated")
  assert.equal(payload.is_chaarlie_recommended, true)
  assert.equal(payload.purchase_link_status, "available")
  assert.equal(payload.currency, "EUR")
  assert.ok(payload.price_eur > 0)
  assert.match(
    payload.image_url,
    /\/product-images\/catalog-additions\/2026-07-03\/deep-cleansing\//,
  )
  assert.deepEqual(payload.tags.sort(), [
    "clarifying",
    "dm-altbestand",
    "product_sebum_buildup",
    "tiefenreinigung",
  ])
  assert.deepEqual(payload.suitable_thicknesses.sort(), ["coarse", "fine", "normal"])
  assert.deepEqual(payload.suitable_concerns, ["healthy_scalp"])
  assert.equal(
    module.productImageStoragePath(product),
    "catalog-additions/2026-07-03/deep-cleansing/balea-professional-shampoo-tiefenreinigung.webp",
  )
  assert.throws(
    () =>
      module.productImageStoragePath({
        brand: "Bad",
        name: "Image",
        image_url: "https://example.com/image.png",
      }),
    /must use https:\/\/pqdkhefxsxkyeqelqegq\.supabase\.co/,
  )
})

test("deep-cleansing seed matcher finds existing rows by normalized legacy text or identity", async () => {
  const module = await import("../scripts/seed-deep-cleansing-products")
  const isana = module.DEEP_CLEANSING_SEED_PRODUCTS.find(
    (seedProduct: { brand: string }) => seedProduct.brand === "ISANA",
  )
  const gliss = module.DEEP_CLEANSING_SEED_PRODUCTS.find(
    (seedProduct: { brand: string }) => seedProduct.brand === "Gliss",
  )

  assert.ok(isana)
  assert.ok(gliss)

  assert.deepEqual(
    module
      .findMatchingDeepCleansingCatalogRows({
        product: isana,
        identity: { brandId: "brand-isana", productLineId: "line-professional" },
        rows: [
          {
            id: "old-isana",
            brand: "Isana",
            name: "Professional Shampoo Tiefenreinigung",
            category: "Tiefenreinigungsshampoo",
            is_active: false,
          },
          {
            id: "unrelated",
            brand: "ISANA",
            name: "Shampoo Repair",
            category: "Tiefenreinigungsshampoo",
            is_active: true,
          },
        ],
      })
      .map((row: { id: string }) => row.id),
    ["old-isana"],
  )
  assert.deepEqual(
    module
      .findMatchingDeepCleansingCatalogRows({
        product: gliss,
        identity: { brandId: "brand-gliss", productLineId: "line-scalp-balance" },
        rows: [
          {
            id: "canonical-gliss",
            brand: null,
            name: null,
            category: "deep_cleansing_shampoo",
            is_active: false,
            brand_id: "brand-gliss",
            product_line_id: "line-scalp-balance",
          },
          {
            id: "other-gliss-line",
            brand: null,
            name: null,
            category: "deep_cleansing_shampoo",
            is_active: false,
            brand_id: "brand-gliss",
            product_line_id: "line-oil-nutritive",
          },
        ],
      })
      .map((row: { id: string }) => row.id),
    ["canonical-gliss"],
  )
})

test("deep-cleansing seed apply requires expected project confirmation", async () => {
  const module = await import("../scripts/seed-deep-cleansing-products")

  assert.doesNotThrow(() =>
    module.assertDeepCleansingSeedApplyTarget({
      supabaseUrl: "https://pqdkhefxsxkyeqelqegq.supabase.co",
      argv: [
        "node",
        "script",
        "--apply",
        "--confirm-project=pqdkhefxsxkyeqelqegq",
        "--confirm-reviewed-images",
      ],
    }),
  )
  assert.throws(
    () =>
      module.assertDeepCleansingSeedApplyTarget({
        supabaseUrl: "https://pqdkhefxsxkyeqelqegq.supabase.co",
        argv: ["node", "script", "--apply", "--confirm-reviewed-images"],
      }),
    /without --confirm-project=pqdkhefxsxkyeqelqegq/,
  )
  assert.throws(
    () =>
      module.assertDeepCleansingSeedApplyTarget({
        supabaseUrl: "https://pqdkhefxsxkyeqelqegq.supabase.co",
        argv: ["node", "script", "--apply", "--confirm-project=pqdkhefxsxkyeqelqegq"],
      }),
    /without --confirm-reviewed-images/,
  )
  assert.throws(
    () =>
      module.assertDeepCleansingSeedApplyTarget({
        supabaseUrl: "https://wrong-project.supabase.co",
        argv: [
          "node",
          "script",
          "--apply",
          "--confirm-project=pqdkhefxsxkyeqelqegq",
          "--confirm-reviewed-images",
        ],
      }),
    /unexpected Supabase project/,
  )
})
