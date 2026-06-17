import assert from "node:assert/strict"
import test from "node:test"

import {
  isGloballyRecommendableProduct,
  rankProductsForDeterministicMatch,
  sortMatchedProducts,
  type MatchedProduct,
} from "../src/lib/product-matching/matcher"
import type { Product } from "../src/lib/types"

function createProduct(id: string, overrides: Partial<Product> = {}): Product {
  return {
    id,
    name: `Produkt ${id}`,
    brand: "Testmarke",
    description: null,
    short_description: null,
    category: "Maske",
    affiliate_link: null,
    image_url: null,
    price_eur: 19.9,
    currency: "EUR",
    tags: [],
    suitable_thicknesses: ["fine", "normal", "coarse"],
    suitable_concerns: ["protein", "feuchtigkeit"],
    is_active: true,
    sort_order: 0,
    created_at: "2026-05-03T00:00:00.000Z",
    updated_at: "2026-05-03T00:00:00.000Z",
    ...overrides,
  }
}

test("deterministic product ranking keeps legacy suitability arrays as ranking signals only", () => {
  const exactLegacySignal = createProduct("exact", {
    suitable_thicknesses: ["fine"],
    suitable_concerns: ["protein"],
  })
  const missingLegacySignal = createProduct("spec-fit", {
    suitable_thicknesses: [],
    suitable_concerns: [],
    sort_order: 1,
  })

  const ranked = rankProductsForDeterministicMatch([missingLegacySignal, exactLegacySignal], {
    thickness: "fine",
    concerns: ["protein"],
    count: 2,
  })

  assert.deepEqual(
    ranked.map((product) => product.id),
    ["exact", "spec-fit"],
  )
  assert.equal(ranked[0].combined_score, 1)
  assert.equal(ranked[1].combined_score, 0)
})

test("deterministic matcher sort lets structured scores win before catalog tie-breakers", () => {
  const cheapButWeak: MatchedProduct = {
    ...createProduct("cheap", { price_eur: 5, sort_order: 0 }),
    similarity: 0,
    combined_score: 0,
  }
  const pricierFit: MatchedProduct = {
    ...createProduct("fit", { price_eur: 25, sort_order: 10 }),
    similarity: 0,
    combined_score: 1,
  }

  assert.deepEqual(
    [cheapButWeak, pricierFit].sort(sortMatchedProducts).map((product) => product.id),
    ["fit", "cheap"],
  )
})

test("global product matchers exclude non-recommended and inactive lifecycle products", () => {
  assert.equal(
    isGloballyRecommendableProduct(
      createProduct("user-submitted", { is_chaarlie_recommended: false }),
    ),
    false,
  )
  assert.equal(
    isGloballyRecommendableProduct(
      createProduct("discontinued", { lifecycle_status: "discontinued" }),
    ),
    false,
  )
  assert.equal(isGloballyRecommendableProduct(createProduct("curated")), true)
})
