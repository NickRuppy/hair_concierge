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
      imageUrl: "https://example.test/garnier-mask.png",
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
    {
      id: "syoss-intense-curls-shampoo",
      name: "Intense Curls Shampoo",
      brandId: "brand-syoss",
      categoryKey: "shampoo",
      isActive: true,
      lifecycleStatus: "active",
      isChaarlieRecommended: true,
    },
    {
      id: "syoss-intense-volume-shampoo",
      name: "Intense Volume Shampoo",
      brandId: "brand-syoss",
      categoryKey: "shampoo",
      isActive: true,
      lifecycleStatus: "active",
      isChaarlieRecommended: true,
    },
    {
      id: "syoss-oil-repair-shampoo",
      name: "Oil Repair Shampoo",
      brandId: "brand-syoss",
      categoryKey: "shampoo",
      isActive: true,
      lifecycleStatus: "active",
      isChaarlieRecommended: true,
    },
    {
      id: "syoss-intense-keratin-mask",
      name: "Intense Keratin Maske",
      brandId: "brand-syoss",
      categoryKey: "mask",
      isActive: true,
      lifecycleStatus: "active",
      isChaarlieRecommended: true,
    },
    {
      id: "olaplex-no7-oil",
      name: "No.7 Bonding Oil",
      brandId: "brand-olaplex",
      categoryKey: "oil",
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
    { id: "brand-syoss", canonical_name: "Syoss" },
    { id: "brand-olaplex", canonical_name: "Olaplex" },
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
    offerId: "test-offer",
  })

  assert.equal(result.status, "found_linkable_existing")
  assert.equal(result.product?.id, "garnier-mask")
  assert.equal(
    (result.product as { image_url?: string | null } | null)?.image_url,
    "https://example.test/garnier-mask.png",
  )
  assert.equal(result.product?.is_chaarlie_recommended, false)
  assert.deepEqual(result.candidates, [])
  assert.equal(result.intake_offer, null)
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
    offerId: "test-offer",
    eligibilityMode: "intake_dedupe",
  })

  assert.equal(result.status, "found_exact")
  assert.equal(result.product?.id, "garnier-mask")
  assert.equal(result.product?.is_chaarlie_recommended, false)
  assert.equal(result.intake_offer, null)
})

test("intake-dedupe lookup can find approved non-recommended products across duplicate brand namespace", () => {
  const result = lookupProductCandidate({
    input: {
      category: "leave_in",
      brand_text: "Balea Professional",
      product_name_text: "Leave-In Serum Brilliant Blond Hair Sealer",
    },
    catalog: {
      products: [
        {
          id: "balea-hair-sealer",
          name: "Balea Professional Brilliant Blond Hair Sealer Leave-in Serum",
          brandId: "brand-balea-professional",
          productLineId: "line-brilliant-blond",
          categoryKey: "leave_in",
          isActive: true,
          lifecycleStatus: "active",
          isChaarlieRecommended: false,
        },
      ],
      identifiers: [],
    },
    brandCatalog: {
      brands: [
        { id: "brand-balea", canonical_name: "Balea" },
      ],
      productLines: [
        { id: "line-professional", brand_id: "brand-balea", canonical_name: "Professional" },
        {
          id: "line-brilliant-blond",
          brand_id: "brand-balea-professional",
          canonical_name: "Brilliant Blond",
        },
      ],
      brandAliases: [
        {
          brand_id: "brand-balea",
          product_line_id: "line-professional",
          alias: "Balea Professional",
        },
      ],
    },
    offerId: "test-offer",
    eligibilityMode: "intake_dedupe",
  })

  assert.equal(result.status, "found_exact")
  assert.equal(result.product?.id, "balea-hair-sealer")
  assert.equal(result.product?.is_chaarlie_recommended, false)
  assert.equal(result.intake_offer, null)
})

test("user-visible lookup can link approved non-recommended products across duplicate brand namespace", () => {
  const result = lookupProductCandidate({
    input: {
      category: "leave_in",
      brand_text: "Balea Professional",
      product_name_text: "Leave-In Serum Brilliant Blond Hair Sealer",
    },
    catalog: {
      products: [
        {
          id: "balea-professional-visible-product",
          name: "Balea Professional Aqua Hyaluron Leave-in",
          brandId: "brand-balea",
          productLineId: "line-professional",
          categoryKey: "leave_in",
          isActive: true,
          lifecycleStatus: "active",
          isChaarlieRecommended: true,
        },
        {
          id: "balea-hair-sealer",
          name: "Balea Professional Brilliant Blond Hair Sealer Leave-in Serum",
          brandId: "brand-balea-professional",
          productLineId: "line-brilliant-blond",
          categoryKey: "leave_in",
          isActive: true,
          lifecycleStatus: "active",
          isChaarlieRecommended: false,
        },
      ],
      identifiers: [],
    },
    brandCatalog: {
      brands: [
        { id: "brand-balea", canonical_name: "Balea" },
      ],
      productLines: [
        { id: "line-professional", brand_id: "brand-balea", canonical_name: "Professional" },
        {
          id: "line-brilliant-blond",
          brand_id: "brand-balea-professional",
          canonical_name: "Brilliant Blond",
        },
      ],
      brandAliases: [
        {
          brand_id: "brand-balea",
          product_line_id: "line-professional",
          alias: "Balea Professional",
        },
      ],
    },
    offerId: "test-offer",
  })

  assert.equal(result.status, "found_linkable_existing")
  assert.equal(result.product?.id, "balea-hair-sealer")
  assert.equal(result.product?.is_chaarlie_recommended, false)
  assert.deepEqual(result.candidates, [])
  assert.equal(result.intake_offer, null)
})

test("user-visible lookup can link approved non-recommended products when brand text includes the full line", () => {
  const result = lookupProductCandidate({
    input: {
      category: "leave_in",
      brand_text: "Balea Professional Brilliant Blond",
      product_name_text: "hair sealer Leave-in",
    },
    catalog: {
      products: [
        {
          id: "balea-hair-sealer",
          name: "Balea Professional Brilliant Blond Hair Sealer Leave-in Serum",
          brandId: "brand-balea",
          productLineId: "line-professional-brilliant-blond",
          categoryKey: "leave_in",
          isActive: true,
          lifecycleStatus: "active",
          isChaarlieRecommended: false,
        },
      ],
      identifiers: [],
    },
    brandCatalog: {
      brands: [{ id: "brand-balea", canonical_name: "Balea" }],
      productLines: [
        {
          id: "line-professional-brilliant-blond",
          brand_id: "brand-balea",
          canonical_name: "Professional Brilliant Blond",
        },
      ],
      brandAliases: [
        {
          brand_id: "brand-balea",
          product_line_id: "line-professional-brilliant-blond",
          alias: "Balea Professional Brilliant Blond",
        },
      ],
    },
    offerId: "test-offer",
  })

  assert.equal(result.status, "found_linkable_existing")
  assert.equal(result.product?.id, "balea-hair-sealer")
  assert.deepEqual(result.candidates, [])
  assert.equal(result.intake_offer, null)
})

test("user-visible lookup can find active non-Chaarlie-recommended products owned by the user", () => {
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
    offerId: "test-offer",
    eligibilityContext: {
      ownedProductIds: new Set(["garnier-mask"]),
      hasVerifiedSpecs: true,
    },
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
    offerId: "test-offer",
  })

  assert.equal(result.status, "not_found")
  assert.equal(result.product, null)
  assert.deepEqual(result.candidates, [])
  assert.equal(result.intake_offer?.reason, "product_lookup_not_found")
})

test("lookup asks for more product identity when category is omitted and product text is generic", () => {
  const result = lookupProductCandidate({
    input: {
      brand_text: "Garnier Fructis",
      product_name_text: "Produkt",
    },
    catalog,
    brandCatalog,
    offerId: "test-offer",
  })

  assert.equal(result.status, "insufficient_identity")
  assert.deepEqual(result.missing_fields, ["productNameText"])
  assert.equal(result.intake_offer, null)
})

test("lookup offers intake when category and concrete product text are present but brand is unsplit", () => {
  const result = lookupProductCandidate({
    input: {
      category: "conditioner",
      product_name_text: "Jean & Lean Conditioner Mystery Rose",
    },
    catalog,
    brandCatalog,
    offerId: "test-offer",
  })

  assert.equal(result.status, "not_found")
  assert.equal(result.category, "conditioner")
  assert.deepEqual(result.candidates, [])
  assert.deepEqual(result.intake_offer?.extracted_identity, {
    product_name_text: "Jean & Lean Conditioner Mystery Rose",
  })
})

test("category-less lookup prefers explicit product type over oil ingredient wording", () => {
  const result = lookupProductCandidate({
    input: {
      brand_text: "Syoss",
      product_name_text: "Oil Repair Shampoo",
    },
    catalog,
    brandCatalog,
    offerId: "test-offer",
  })

  assert.equal(result.status, "found_exact")
  assert.equal(result.category, "shampoo")
  assert.equal(result.product?.id, "syoss-oil-repair-shampoo")
})

test("category-less lookup does not let oil wording override conditioner identity", () => {
  const result = lookupProductCandidate({
    input: {
      brand_text: "Garnier Fructis",
      product_name_text: "Hair Food Aloe Oil Conditioner",
    },
    catalog,
    brandCatalog,
    offerId: "test-offer",
  })

  assert.equal(result.status, "found_exact")
  assert.equal(result.category, "conditioner")
  assert.equal(result.product?.id, "garnier-conditioner")
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
    offerId: "test-offer",
  })

  assert.equal(result.status, "unsupported_category")
  assert.equal(result.category, "peeling")
  assert.equal(result.intake_offer, null)
})

test("lookup asks the user to select a variant when same-category catalog neighbors exist", () => {
  const result = lookupProductCandidate({
    input: {
      category: "shampoo",
      brand_text: "Pantene Pro-V",
      product_name_text: "Repair Care",
    },
    catalog,
    brandCatalog,
    offerId: "test-offer",
  })

  assert.equal(result.status, "needs_variant_selection")
  assert.deepEqual(
    result.candidates.map((candidate) => candidate.product.id),
    ["pantene-shampoo-a", "pantene-shampoo-b"],
  )
  assert.equal(result.intake_offer, null)
})

test("lookup treats a unique canonical product name as an exact product match", () => {
  const result = lookupProductCandidate({
    input: {
      category: "shampoo",
      brand_text: "Syoss",
      product_name_text: "Intense Volume Shampoo",
    },
    catalog,
    brandCatalog,
    offerId: "test-offer",
  })

  assert.equal(result.status, "found_exact")
  assert.equal(result.product?.id, "syoss-intense-volume-shampoo")
  assert.equal(result.intake_offer, null)
})

test("lookup asks for variant selection instead of exact match for a weak partial name", () => {
  const result = lookupProductCandidate({
    input: {
      category: "shampoo",
      brand_text: "Pantene Pro-V",
      product_name_text: "Repair",
    },
    catalog: {
      ...catalog,
      products: [catalog.products[2]],
    },
    brandCatalog,
    offerId: "test-offer",
  })

  assert.equal(result.status, "needs_variant_selection")
  assert.deepEqual(
    result.candidates.map((candidate) => candidate.product.id),
    ["pantene-shampoo-a"],
  )
  assert.equal(result.intake_offer, null)
})

test("lookup can find unique No/Nr numbered products without a category hint", () => {
  for (const productNameText of ["No.7 Bonding Oil", "No 7 Bonding Oil", "Nr. 7 Bonding Oil"]) {
    const result = lookupProductCandidate({
      input: {
        brand_text: "Olaplex",
        product_name_text: productNameText,
      },
      catalog,
      brandCatalog,
      offerId: "test-offer",
    })

    assert.equal(result.status, "found_exact")
    assert.equal(result.category, "oil")
    assert.equal(result.product?.id, "olaplex-no7-oil")
    assert.equal(result.intake_offer, null)
  }
})

test("category-less lookup asks for variant selection when identity is still ambiguous", () => {
  const result = lookupProductCandidate({
    input: {
      brand_text: "Pantene Pro-V",
      product_name_text: "Repair Care",
    },
    catalog,
    brandCatalog,
    offerId: "test-offer",
  })

  assert.equal(result.status, "needs_variant_selection")
  assert.equal(result.category, null)
  assert.deepEqual(
    result.candidates.map((candidate) => candidate.product.id),
    ["pantene-shampoo-a", "pantene-shampoo-b"],
  )
  assert.equal(result.intake_offer, null)
})

test("user-visible lookup can include current user's verified non-recommended products", () => {
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
    offerId: "test-offer",
    eligibilityContext: {
      ownedProductIds: ["garnier-mask"],
      hasVerifiedSpecs: true,
    },
  })

  assert.equal(result.status, "found_exact")
  assert.equal(result.product?.id, "garnier-mask")
  assert.equal(result.product?.is_chaarlie_recommended, false)
  assert.equal(result.intake_offer, null)
})

test("lookup still shows a single same-category candidate for variant confirmation", () => {
  const result = lookupProductCandidate({
    input: {
      category: "shampoo",
      brand_text: "Syoss",
      product_name_text: "Intense Volume Shampoo",
    },
    catalog: {
      ...catalog,
      products: [catalog.products[4]],
    },
    brandCatalog,
    offerId: "test-offer",
  })

  assert.equal(result.status, "needs_variant_selection")
  assert.deepEqual(
    result.candidates.map((candidate) => candidate.product.id),
    ["syoss-intense-curls-shampoo"],
  )
  assert.equal(result.intake_offer, null)
})

test("lookup asks for confirmation instead of intake when generic oil text has one same-brand oil", () => {
  const result = lookupProductCandidate({
    input: {
      category: "oil",
      brand_text: "OLAPLEX no5",
      product_name_text: "Haaröl",
    },
    catalog,
    brandCatalog,
    offerId: "offer-olaplex-oil",
  })

  assert.equal(result.status, "needs_variant_selection")
  assert.deepEqual(
    result.candidates.map((candidate) => candidate.product.id),
    ["olaplex-no7-oil"],
  )
  assert.equal(result.intake_offer, null)
})

test("lookup ignores weak wrong-category token overlap and offers intake", () => {
  const result = lookupProductCandidate({
    input: {
      category: "shampoo",
      brand_text: "Syoss",
      product_name_text: "Intense Volume Shampoo",
    },
    catalog: {
      ...catalog,
      products: [catalog.products[6]],
    },
    brandCatalog,
    offerId: "offer-syoss-volume",
  })

  assert.equal(result.status, "not_found")
  assert.deepEqual(result.candidates, [])
  assert.equal(result.intake_offer?.id, "offer-syoss-volume")
  assert.equal(result.intake_offer?.reason, "product_lookup_not_found")
})

test("lookup surfaces strong identity matches in another category as category mismatch", () => {
  const result = lookupProductCandidate({
    input: {
      category: "mask",
      brand_text: "Garnier Fructis",
      product_name_text: "Hair Food Aloe Conditioner",
    },
    catalog: {
      ...catalog,
      products: [catalog.products[1]],
    },
    brandCatalog,
    offerId: "test-offer",
  })

  assert.equal(result.status, "category_mismatch")
  assert.deepEqual(
    result.candidates.map((candidate) => candidate.product.id),
    ["garnier-conditioner"],
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

test("lookup treats unresolved brand plus generic category name as enough identity for intake", () => {
  const result = lookupProductCandidate({
    input: {
      category: "conditioner",
      brand_text: "Jean & Lean",
      product_name_text: "Conditioner",
    },
    catalog,
    brandCatalog,
    offerId: "offer-unknown-brand",
  })

  assert.equal(result.status, "not_found")
  assert.deepEqual(result.intake_offer, {
    id: "offer-unknown-brand",
    source: "chat",
    reason: "product_lookup_not_found",
    category: "conditioner",
    extracted_identity: {
      brand_text: "Jean & Lean",
      product_name_text: "Conditioner",
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
    offerId: "test-offer",
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
    offerId: "test-offer",
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
    offerId: "test-offer",
  })

  assert.equal(redundantBrand.status, "insufficient_identity")
  assert.deepEqual(redundantBrand.missing_fields, ["productNameText"])
  assert.equal(redundantBrand.intake_offer, null)
})
