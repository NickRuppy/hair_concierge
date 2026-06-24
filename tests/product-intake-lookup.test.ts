import assert from "node:assert/strict"
import test from "node:test"

import {
  lookupProductCandidate,
  type ProductLookupCatalog,
} from "../src/lib/product-intake/product-lookup"
import type { BrandResolutionCatalogInput } from "../src/lib/product-identity/brand-resolution"

const catalog: ProductLookupCatalog = {
  products: [
    {
      id: "garnier-mask",
      name: "Hair Food Aloe Maske",
      brandId: "brand-garnier",
      productLineId: "line-fructis",
      categoryKey: "mask",
      isActive: true,
      lifecycleStatus: "active",
      isChaarlieRecommended: false,
    },
    {
      id: "garnier-conditioner",
      name: "Hair Food Aloe Conditioner",
      brandId: "brand-garnier",
      productLineId: "line-fructis",
      categoryKey: "conditioner",
      isActive: true,
      lifecycleStatus: "active",
      isChaarlieRecommended: true,
    },
    {
      id: "pantene-shampoo-a",
      name: "Repair & Care Shampoo",
      brandId: "brand-pantene",
      productLineId: "line-pro-v",
      categoryKey: "shampoo",
      isActive: true,
      lifecycleStatus: "active",
      isChaarlieRecommended: true,
    },
    {
      id: "pantene-shampoo-b",
      name: "Repair Care Shampoo",
      brandId: "brand-pantene",
      productLineId: "line-pro-v",
      categoryKey: "shampoo",
      isActive: true,
      lifecycleStatus: "active",
      isChaarlieRecommended: true,
    },
  ],
  identifiers: [],
}

const brandCatalog: BrandResolutionCatalogInput = {
  brands: [
    { id: "brand-garnier", canonical_name: "Garnier" },
    { id: "brand-pantene", canonical_name: "Pantene" },
  ],
  productLines: [
    { id: "line-fructis", brand_id: "brand-garnier", canonical_name: "Fructis" },
    { id: "line-pro-v", brand_id: "brand-pantene", canonical_name: "Pro-V" },
  ],
  brandAliases: [
    {
      brand_id: "brand-garnier",
      product_line_id: "line-fructis",
      alias: "Garnier Fructis",
    },
    {
      brand_id: "brand-pantene",
      product_line_id: "line-pro-v",
      alias: "Pantene Pro-V",
    },
  ],
}

test("user-visible lookup does not return exact hits for non-Chaarlie-recommended products", () => {
  const result = lookupProductCandidate({
    input: {
      category: "mask",
      brand_text: "Garnier Fructis",
      product_name_text: "Hair Food Aloe Maske",
    },
    catalog: {
      ...catalog,
      products: [catalog.products[0]],
    },
    brandCatalog,
  })

  assert.equal(result.status, "not_found")
  assert.equal(result.product, null)
  assert.deepEqual(result.candidates, [])
  assert.equal(result.intake_offer?.reason, "product_lookup_not_found")
})

test("intake-dedupe lookup can find active non-Chaarlie-recommended products", () => {
  const result = lookupProductCandidate({
    input: {
      category: "mask",
      brand_text: "Garnier Fructis",
      product_name_text: "Hair Food Aloe Maske",
    },
    catalog: {
      ...catalog,
      products: [catalog.products[0]],
    },
    brandCatalog,
    eligibilityMode: "intake_dedupe",
  })

  assert.equal(result.status, "found_exact")
  assert.equal(result.product?.id, "garnier-mask")
  assert.equal(result.product?.is_chaarlie_recommended, false)
  assert.equal(result.intake_offer, null)
})

test("user-visible lookup does not return exact hits for non-active-lifecycle products", () => {
  const result = lookupProductCandidate({
    input: {
      category: "shampoo",
      brand_text: "Pantene Pro-V",
      product_name_text: "Repair & Care Shampoo",
    },
    catalog: {
      ...catalog,
      products: [
        {
          ...catalog.products[2],
          lifecycleStatus: "discontinued",
        },
      ],
    },
    brandCatalog,
  })

  assert.equal(result.status, "not_found")
  assert.equal(result.product, null)
  assert.deepEqual(result.candidates, [])
  assert.equal(result.intake_offer?.reason, "product_lookup_not_found")
})

test("lookup needs category before it can make a conclusive product decision", () => {
  const result = lookupProductCandidate({
    input: {
      brand_text: "Garnier Fructis",
      product_name_text: "Hair Food Aloe Maske",
    },
    catalog,
    brandCatalog,
  })

  assert.equal(result.status, "insufficient_identity")
  assert.deepEqual(result.missing_fields, ["category"])
  assert.equal(result.intake_offer, null)
})

test("lookup rejects unsupported categories without offering intake", () => {
  const result = lookupProductCandidate({
    input: {
      category: "peeling",
      brand_text: "Some Brand",
      product_name_text: "Scalp Peeling",
    },
    catalog,
    brandCatalog,
  })

  assert.equal(result.status, "unsupported_category")
  assert.equal(result.category, "peeling")
  assert.equal(result.intake_offer, null)
})

test("lookup returns ambiguous when matching evidence points to multiple products", () => {
  const result = lookupProductCandidate({
    input: {
      category: "shampoo",
      brand_text: "Pantene Pro-V",
      product_name_text: "Repair Care",
    },
    catalog,
    brandCatalog,
  })

  assert.equal(result.status, "ambiguous")
  assert.deepEqual(
    result.candidates.map((candidate) => candidate.product.id),
    ["pantene-shampoo-a", "pantene-shampoo-b"],
  )
  assert.equal(result.intake_offer, null)
})

test("lookup offers product intake only for a precise supported product not found in catalog", () => {
  const result = lookupProductCandidate({
    input: {
      category: "shampoo",
      brand_text: "Pantene Pro-V",
      product_name_text: "Volume Pur Shampoo",
    },
    catalog,
    brandCatalog,
    offerId: "offer-1",
  })

  assert.equal(result.status, "not_found")
  assert.deepEqual(result.intake_offer, {
    id: "offer-1",
    source: "chat",
    reason: "product_lookup_not_found",
    category: "shampoo",
    extracted_identity: {
      brand_text: "Pantene Pro-V",
      product_name_text: "Volume Pur Shampoo",
    },
  })
})

test("lookup asks for more identity before offering intake for generic brand category mentions", () => {
  const pantene = lookupProductCandidate({
    input: {
      category: "shampoo",
      brand_text: "Pantene Pro-V",
      product_name_text: "Shampoo",
    },
    catalog,
    brandCatalog,
  })

  assert.equal(pantene.status, "insufficient_identity")
  assert.deepEqual(pantene.missing_fields, ["productNameText"])
  assert.equal(pantene.intake_offer, null)

  const garnier = lookupProductCandidate({
    input: {
      category: "mask",
      brand_text: "Garnier",
      product_name_text: "Maske",
    },
    catalog,
    brandCatalog,
  })

  assert.equal(garnier.status, "insufficient_identity")
  assert.deepEqual(garnier.missing_fields, ["productNameText"])
  assert.equal(garnier.intake_offer, null)

  const redundantBrand = lookupProductCandidate({
    input: {
      category: "shampoo",
      brand_text: "Pantene Pro-V",
      product_name_text: "Pantene Pro-V Shampoo",
    },
    catalog,
    brandCatalog,
  })

  assert.equal(redundantBrand.status, "insufficient_identity")
  assert.deepEqual(redundantBrand.missing_fields, ["productNameText"])
  assert.equal(redundantBrand.intake_offer, null)
})
