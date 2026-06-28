import assert from "node:assert/strict"
import test from "node:test"

import {
  PRODUCT_DRAFTS,
  assertApplyTarget,
  buildProductPayload,
  expectedPublicImageUrl,
  isBrandSourceUrl,
} from "../scripts/catalog-additions/prepare-2026-06-27-products"

const EXPECTED_CONFIRM = "--confirm-project=pqdkhefxsxkyeqelqegq"

function withSupabaseUrl(url: string, callback: () => void) {
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  process.env.NEXT_PUBLIC_SUPABASE_URL = url
  try {
    callback()
  } finally {
    if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL
    else process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl
  }
}

test("catalog additions apply guard requires the live project and confirmation flag", () => {
  withSupabaseUrl("https://pqdkhefxsxkyeqelqegq.supabase.co", () => {
    assert.doesNotThrow(() => assertApplyTarget(["node", "script", "--apply", EXPECTED_CONFIRM]))
    assert.throws(
      () => assertApplyTarget(["node", "script", "--apply"]),
      /Refusing to apply without --confirm-project=pqdkhefxsxkyeqelqegq/,
    )
  })

  withSupabaseUrl("https://wrong-project.supabase.co", () => {
    assert.throws(
      () => assertApplyTarget(["node", "script", "--apply", EXPECTED_CONFIRM]),
      /Refusing to apply catalog additions to wrong-project\.supabase\.co/,
    )
  })
})

test("catalog additions keep the approved four-product scope", () => {
  assert.deepEqual(
    PRODUCT_DRAFTS.map((draft) => draft.name),
    [
      "Ultimate Repair Spülung",
      "Intense Curls Haarmaske",
      "Haarmaske Aktivkohle",
      "Leave-In Moisturizing Mist",
    ],
  )

  assert.equal(
    PRODUCT_DRAFTS.some((draft) => draft.name.includes("Aloe Vera")),
    false,
  )
  assert.equal(
    PRODUCT_DRAFTS.some((draft) => draft.name.includes("Head & Shoulders")),
    false,
  )
  assert.equal(
    PRODUCT_DRAFTS.some((draft) => draft.name.includes("OGX")),
    false,
  )
})

test("catalog additions preserve identity decisions", () => {
  const byName = new Map(PRODUCT_DRAFTS.map((draft) => [draft.name, draft]))

  assert.equal(byName.get("Ultimate Repair Spülung")?.productLine, null)
  assert.equal(byName.get("Intense Curls Haarmaske")?.productLine, null)
  assert.equal(byName.get("Haarmaske Aktivkohle")?.identityBrand, "Garnier")
  assert.equal(byName.get("Haarmaske Aktivkohle")?.productLine, "Wahre Schätze")
  assert.equal(byName.get("Leave-In Moisturizing Mist")?.identityBrand, "Neqi")
  assert.equal(
    byName.get("Leave-In Moisturizing Mist")?.productLine,
    "NEQI x @_the.beautiful.people",
  )
})

test("catalog additions write canonical parent brand into product payloads", () => {
  const garnier = PRODUCT_DRAFTS.find((draft) => draft.productLine === "Wahre Schätze")
  assert.ok(garnier)

  const payload = buildProductPayload({
    draft: garnier,
    sortOrder: 42,
    generatedAt: "2026-06-28T00:00:00.000Z",
    identity: {
      brand_id: "brand-garnier",
      product_line_id: "line-wahre-schaetze",
      missing_brand: null,
      missing_product_line: null,
    },
  })

  assert.equal(payload.brand, "Garnier")
  assert.equal(payload.product_line_id, "line-wahre-schaetze")
})

test("catalog additions keep product names free of duplicated brand and line labels", () => {
  for (const draft of PRODUCT_DRAFTS) {
    const normalizedName = draft.name.toLocaleLowerCase("de-DE")
    const normalizedBrand = draft.identityBrand.toLocaleLowerCase("de-DE")
    const normalizedLine = draft.productLine?.toLocaleLowerCase("de-DE") ?? null

    assert.equal(
      normalizedName.startsWith(`${normalizedBrand} `),
      false,
      `${draft.name} should not repeat brand ${draft.identityBrand}`,
    )
    if (normalizedLine) {
      assert.equal(
        normalizedName.startsWith(`${normalizedLine} `),
        false,
        `${draft.name} should not repeat line ${draft.productLine}`,
      )
    }
  }
})

test("catalog additions propose complete commercial and spec payload inputs", () => {
  for (const draft of PRODUCT_DRAFTS) {
    assert.match(draft.affiliate_link, /^https:\/\//)
    assert.ok(draft.price_eur > 0, `${draft.name} needs a positive price`)
    assert.equal(draft.currency, "EUR")
    assert.ok(draft.tags.length > 0, `${draft.name} needs tags`)
    assert.ok(draft.suitable_thicknesses.length > 0, `${draft.name} needs thickness fit`)
    assert.ok(draft.suitable_concerns.length > 0, `${draft.name} needs concerns`)
    assert.ok(draft.description.length > 40, `${draft.name} needs a description`)
    assert.equal(draft.short_description, null, `${draft.name} should not revive short_description`)
    assert.equal(draft.tom_take, null, `${draft.name} should not revive tom_take`)

    const { publicUrl, storagePath } = expectedPublicImageUrl(draft)
    assert.match(
      publicUrl,
      /^https:\/\/pqdkhefxsxkyeqelqegq\.supabase\.co\/storage\/v1\/object\/public\/product-images\/catalog-additions\/2026-06-27\//,
    )
    assert.match(storagePath, /\.webp$/)
  }
})

test("catalog image source classification checks parsed hostnames", () => {
  assert.equal(isBrandSourceUrl("https://neqi-hair.com/products/leave-in"), true)
  assert.equal(isBrandSourceUrl("https://www.syoss.net/care/mask.html"), true)
  assert.equal(isBrandSourceUrl("https://shop.garnier.de/wahre-schaetze"), true)
  assert.equal(isBrandSourceUrl("https://example.com/?next=https://neqi-hair.com"), false)
  assert.equal(isBrandSourceUrl("https://neqi-hair.com.example.com/product.jpg"), false)
})
