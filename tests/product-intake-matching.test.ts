import assert from "node:assert/strict"
import test from "node:test"

import {
  matchProductIntake,
  type ProductIntakeCatalog,
} from "../src/lib/product-intake/product-matching"

const catalog: ProductIntakeCatalog = {
  products: [
    {
      id: "olaplex-leave-in",
      name: "No. 5 Leave-In Conditioner",
      brandId: "brand-olaplex",
      productLineId: "line-no-5",
      categoryKey: "leave_in",
      isActive: true,
      isChaarlieRecommended: true,
    },
    {
      id: "garnier-mask",
      name: "Hair Food Aloe Maske",
      brandId: "brand-garnier",
      productLineId: "line-fructis",
      categoryKey: "mask",
      isActive: true,
      isChaarlieRecommended: false,
    },
    {
      id: "garnier-conditioner",
      name: "Hair Food Aloe Conditioner",
      brandId: "brand-garnier",
      productLineId: "line-fructis",
      categoryKey: "conditioner",
      isActive: true,
      isChaarlieRecommended: true,
    },
    {
      id: "pantene-shampoo-a",
      name: "Repair & Care Shampoo",
      brandId: "brand-pantene",
      productLineId: "line-pro-v",
      categoryKey: "shampoo",
      isActive: true,
      isChaarlieRecommended: true,
    },
    {
      id: "pantene-shampoo-b",
      name: "Repair Care Shampoo",
      brandId: "brand-pantene",
      productLineId: "line-pro-v",
      categoryKey: "shampoo",
      isActive: true,
      isChaarlieRecommended: true,
    },
    {
      id: "inactive-match",
      name: "Inactive Shampoo",
      brandId: "brand-pantene",
      productLineId: "line-pro-v",
      categoryKey: "shampoo",
      isActive: false,
      isChaarlieRecommended: true,
    },
  ],
  identifiers: [
    {
      productId: "olaplex-leave-in",
      identifierType: "ean",
      identifierValue: "4000012345678",
    },
    {
      productId: "garnier-mask",
      identifierType: "gtin",
      identifierValue: "4000099999999",
    },
    {
      productId: "inactive-match",
      identifierType: "ean",
      identifierValue: "4000011111111",
    },
  ],
}

test("GTIN/EAN plus selected canonical category returns exact matched product when one active row exists", () => {
  const result = matchProductIntake(
    {
      selectedCategoryKey: "leave_in",
      identifier: { type: "ean", value: "40000 12345678" },
    },
    catalog,
  )

  assert.equal(result.status, "matched")
  assert.equal(result.matchedProduct?.id, "olaplex-leave-in")
  assert.equal(result.reason, "identifier_category_exact")
})

test("GTIN/EAN without category or with a different category returns review candidates only", () => {
  const missingCategory = matchProductIntake(
    { identifier: { type: "ean", value: "4000012345678" } },
    catalog,
  )
  assert.equal(missingCategory.status, "pending_review")
  assert.equal(missingCategory.matchedProduct, null)
  assert.deepEqual(
    missingCategory.candidates.map((candidate) => candidate.product.id),
    ["olaplex-leave-in"],
  )
  assert.equal(missingCategory.reason, "identifier_requires_category_review")

  const categoryMismatch = matchProductIntake(
    {
      selectedCategoryKey: "shampoo",
      identifier: { type: "ean", value: "4000012345678" },
    },
    catalog,
  )
  assert.equal(categoryMismatch.status, "pending_review")
  assert.equal(categoryMismatch.matchedProduct, null)
  assert.equal(categoryMismatch.candidates[0]?.product.id, "olaplex-leave-in")
  assert.equal(categoryMismatch.reason, "identifier_category_mismatch_review")
})

test("identifier path ignores inactive products", () => {
  const result = matchProductIntake(
    {
      selectedCategoryKey: "shampoo",
      identifier: { type: "ean", value: "4000011111111" },
      brandId: "brand-pantene",
      cleanProductName: "Inactive Shampoo",
    },
    catalog,
  )

  assert.notEqual(result.status, "matched")
  assert.equal(result.matchedProduct, null)
  assert.equal(
    result.candidates.some((candidate) => candidate.product.id === "inactive-match"),
    false,
  )
})

test("GTIN/EAN with mixed-category exact evidence stays review-only", () => {
  const mixedCategoryCatalog: ProductIntakeCatalog = {
    products: [
      ...catalog.products,
      {
        id: "olaplex-conditioner",
        name: "No. 5 Leave-In Conditioner",
        brandId: "brand-olaplex",
        productLineId: "line-no-5",
        categoryKey: "conditioner",
        isActive: true,
        isChaarlieRecommended: true,
      },
    ],
    identifiers: [
      ...(catalog.identifiers ?? []),
      {
        productId: "olaplex-conditioner",
        identifierType: "gtin",
        identifierValue: "4000012345678",
      },
    ],
  }

  const result = matchProductIntake(
    {
      selectedCategoryKey: "leave_in",
      identifier: { type: "barcode", value: "40000-12345678" },
    },
    mixedCategoryCatalog,
  )

  assert.equal(result.status, "pending_review")
  assert.equal(result.matchedProduct, null)
  assert.deepEqual(
    result.candidates.map((candidate) => candidate.product.id),
    ["olaplex-leave-in", "olaplex-conditioner"],
  )
  assert.equal(result.reason, "identifier_category_mismatch_review")
})

test("ambiguous GTIN/EAN review candidates include cross-category exact evidence", () => {
  const ambiguousCatalog: ProductIntakeCatalog = {
    products: [
      ...catalog.products,
      {
        id: "olaplex-leave-in-duplicate",
        name: "No. 5 Leave-In Conditioner Duplicate",
        brandId: "brand-olaplex",
        productLineId: "line-no-5",
        categoryKey: "leave_in",
        isActive: true,
        isChaarlieRecommended: true,
      },
      {
        id: "olaplex-conditioner",
        name: "No. 5 Leave-In Conditioner",
        brandId: "brand-olaplex",
        productLineId: "line-no-5",
        categoryKey: "conditioner",
        isActive: true,
        isChaarlieRecommended: true,
      },
    ],
    identifiers: [
      ...(catalog.identifiers ?? []),
      {
        productId: "olaplex-leave-in-duplicate",
        identifierType: "gtin",
        identifierValue: "4000012345678",
      },
      {
        productId: "olaplex-conditioner",
        identifierType: "barcode",
        identifierValue: "4000012345678",
      },
    ],
  }

  const result = matchProductIntake(
    {
      selectedCategoryKey: "leave_in",
      identifier: { type: "ean", value: "4000012345678" },
    },
    ambiguousCatalog,
  )

  assert.equal(result.status, "pending_review")
  assert.equal(result.matchedProduct, null)
  assert.deepEqual(
    result.candidates.map((candidate) => [candidate.product.id, candidate.reason]),
    [
      ["olaplex-leave-in", "identifier_ambiguous_review"],
      ["olaplex-leave-in-duplicate", "identifier_ambiguous_review"],
      ["olaplex-conditioner", "identifier_category_mismatch_review"],
    ],
  )
})

test("retailer identifiers do not collapse punctuation into false exact matches", () => {
  const retailerCatalog: ProductIntakeCatalog = {
    products: [
      {
        id: "retailer-product",
        name: "Retailer Shampoo",
        brandId: "brand-retailer",
        productLineId: null,
        categoryKey: "shampoo",
        isActive: true,
        isChaarlieRecommended: true,
      },
    ],
    identifiers: [
      {
        productId: "retailer-product",
        identifierType: "retailer_sku",
        identifierValue: "SKU-12",
      },
      {
        productId: "retailer-product",
        identifierType: "retailer_url",
        identifierValue: "https://shop.example/products/a-b",
      },
    ],
  }

  const skuResult = matchProductIntake(
    {
      selectedCategoryKey: "shampoo",
      identifier: { type: "retailer_sku", value: "SKU12" },
    },
    retailerCatalog,
  )

  assert.equal(skuResult.status, "needs_more_info")
  assert.equal(skuResult.matchedProduct, null)
  assert.equal(skuResult.candidates.length, 0)

  const urlResult = matchProductIntake(
    {
      selectedCategoryKey: "shampoo",
      identifier: { type: "retailer_url", value: "https://shop.example/products/ab" },
    },
    retailerCatalog,
  )

  assert.equal(urlResult.status, "needs_more_info")
  assert.equal(urlResult.matchedProduct, null)
  assert.equal(urlResult.candidates.length, 0)
})

test("retailer identifiers preserve diacritics for exact matching", () => {
  const retailerCatalog: ProductIntakeCatalog = {
    products: [
      {
        id: "retailer-product",
        name: "Retailer Shampoo",
        brandId: "brand-retailer",
        productLineId: null,
        categoryKey: "shampoo",
        isActive: true,
        isChaarlieRecommended: true,
      },
    ],
    identifiers: [
      {
        productId: "retailer-product",
        identifierType: "retailer_sku",
        identifierValue: "Ä-12",
        source: "dm",
      },
    ],
  }

  const result = matchProductIntake(
    {
      selectedCategoryKey: "shampoo",
      identifier: { type: "retailer_sku", value: "A-12", source: "dm" },
    },
    retailerCatalog,
  )

  assert.equal(result.status, "needs_more_info")
  assert.equal(result.matchedProduct, null)
  assert.equal(result.candidates.length, 0)
})

test("brand plus line plus clean name plus canonical category exact match returns matched", () => {
  const result = matchProductIntake(
    {
      selectedCategoryKey: "leave_in",
      brandId: "brand-olaplex",
      productLineId: "line-no-5",
      cleanProductName: "No 5 Leave In Conditioner",
    },
    catalog,
  )

  assert.equal(result.status, "matched")
  assert.equal(result.matchedProduct?.id, "olaplex-leave-in")
  assert.equal(result.reason, "brand_line_name_category_exact")
})

test("brand plus name fallback does not auto-link a different product line", () => {
  const result = matchProductIntake(
    {
      selectedCategoryKey: "leave_in",
      brandId: "brand-olaplex",
      productLineId: "line-no-6",
      cleanProductName: "No 5 Leave In Conditioner",
    },
    catalog,
  )

  assert.equal(result.status, "pending_review")
  assert.equal(result.matchedProduct, null)
  assert.notEqual(result.reason, "brand_name_category_exact")
})

test("brand plus line plus name with mixed-category exact evidence stays review-only", () => {
  const mixedCategoryCatalog: ProductIntakeCatalog = {
    products: [
      ...catalog.products,
      {
        id: "olaplex-conditioner",
        name: "No. 5 Leave-In Conditioner",
        brandId: "brand-olaplex",
        productLineId: "line-no-5",
        categoryKey: "conditioner",
        isActive: true,
        isChaarlieRecommended: true,
      },
    ],
    identifiers: catalog.identifiers,
  }

  const result = matchProductIntake(
    {
      selectedCategoryKey: "leave_in",
      brandId: "brand-olaplex",
      productLineId: "line-no-5",
      cleanProductName: "No 5 Leave In Conditioner",
    },
    mixedCategoryCatalog,
  )

  assert.equal(result.status, "pending_review")
  assert.equal(result.matchedProduct, null)
  assert.deepEqual(
    result.candidates.map((candidate) => candidate.product.id),
    ["olaplex-leave-in", "olaplex-conditioner"],
  )
  assert.equal(result.reason, "text_category_mismatch_review")
})

test("ambiguous brand plus line plus name candidates include cross-category exact evidence", () => {
  const ambiguousCatalog: ProductIntakeCatalog = {
    products: [
      ...catalog.products,
      {
        id: "olaplex-leave-in-duplicate",
        name: "No. 5 Leave-In Conditioner",
        brandId: "brand-olaplex",
        productLineId: "line-no-5",
        categoryKey: "leave_in",
        isActive: true,
        isChaarlieRecommended: true,
      },
      {
        id: "olaplex-conditioner",
        name: "No. 5 Leave-In Conditioner",
        brandId: "brand-olaplex",
        productLineId: "line-no-5",
        categoryKey: "conditioner",
        isActive: true,
        isChaarlieRecommended: true,
      },
    ],
    identifiers: catalog.identifiers,
  }

  const result = matchProductIntake(
    {
      selectedCategoryKey: "leave_in",
      brandId: "brand-olaplex",
      productLineId: "line-no-5",
      cleanProductName: "No 5 Leave In Conditioner",
    },
    ambiguousCatalog,
  )

  assert.equal(result.status, "pending_review")
  assert.equal(result.matchedProduct, null)
  assert.deepEqual(
    result.candidates.map((candidate) => [candidate.product.id, candidate.reason]),
    [
      ["olaplex-leave-in", "fuzzy_candidates_review"],
      ["olaplex-leave-in-duplicate", "fuzzy_candidates_review"],
      ["olaplex-conditioner", "text_category_mismatch_review"],
    ],
  )
})

test("existing non-recommended active product can match", () => {
  const result = matchProductIntake(
    {
      selectedCategoryKey: "mask",
      brandId: "brand-garnier",
      productLineId: "line-fructis",
      cleanProductName: "Hair Food Aloe Maske",
    },
    catalog,
  )

  assert.equal(result.status, "matched")
  assert.equal(result.matchedProduct?.id, "garnier-mask")
})

test("brand plus clean name and category can match when no line exists", () => {
  const result = matchProductIntake(
    {
      selectedCategoryKey: "conditioner",
      brandId: "brand-garnier",
      cleanProductName: "Hair Food Aloe Conditioner",
    },
    catalog,
  )

  assert.equal(result.status, "matched")
  assert.equal(result.matchedProduct?.id, "garnier-conditioner")
  assert.equal(result.reason, "brand_name_category_exact")
})

test("brand plus name with mixed-category exact evidence stays review-only", () => {
  const mixedCategoryCatalog: ProductIntakeCatalog = {
    products: [
      ...catalog.products,
      {
        id: "garnier-leave-in",
        name: "Hair Food Aloe Conditioner",
        brandId: "brand-garnier",
        productLineId: "line-fructis",
        categoryKey: "leave_in",
        isActive: true,
        isChaarlieRecommended: true,
      },
    ],
    identifiers: catalog.identifiers,
  }

  const result = matchProductIntake(
    {
      selectedCategoryKey: "conditioner",
      brandId: "brand-garnier",
      cleanProductName: "Hair Food Aloe Conditioner",
    },
    mixedCategoryCatalog,
  )

  assert.equal(result.status, "pending_review")
  assert.equal(result.matchedProduct, null)
  assert.deepEqual(
    result.candidates.map((candidate) => candidate.product.id),
    ["garnier-conditioner", "garnier-leave-in"],
  )
  assert.equal(result.reason, "text_category_mismatch_review")
})

test("ambiguous brand plus name candidates include cross-category exact evidence", () => {
  const ambiguousCatalog: ProductIntakeCatalog = {
    products: [
      ...catalog.products,
      {
        id: "garnier-conditioner-duplicate",
        name: "Hair Food Aloe Conditioner",
        brandId: "brand-garnier",
        productLineId: null,
        categoryKey: "conditioner",
        isActive: true,
        isChaarlieRecommended: true,
      },
      {
        id: "garnier-leave-in",
        name: "Hair Food Aloe Conditioner",
        brandId: "brand-garnier",
        productLineId: null,
        categoryKey: "leave_in",
        isActive: true,
        isChaarlieRecommended: true,
      },
    ],
    identifiers: catalog.identifiers,
  }

  const result = matchProductIntake(
    {
      selectedCategoryKey: "conditioner",
      brandId: "brand-garnier",
      cleanProductName: "Hair Food Aloe Conditioner",
    },
    ambiguousCatalog,
  )

  assert.equal(result.status, "pending_review")
  assert.equal(result.matchedProduct, null)
  assert.deepEqual(
    result.candidates.map((candidate) => [candidate.product.id, candidate.reason]),
    [
      ["garnier-conditioner", "fuzzy_candidates_review"],
      ["garnier-conditioner-duplicate", "fuzzy_candidates_review"],
      ["garnier-leave-in", "text_category_mismatch_review"],
    ],
  )
})

test("multiple close candidates return ambiguous review without auto-linking", () => {
  const result = matchProductIntake(
    {
      selectedCategoryKey: "shampoo",
      brandId: "brand-pantene",
      productLineId: "line-pro-v",
      cleanProductName: "Repair Shampoo",
    },
    catalog,
  )

  assert.equal(result.status, "pending_review")
  assert.equal(result.matchedProduct, null)
  assert.deepEqual(
    result.candidates.map((candidate) => candidate.product.id),
    ["pantene-shampoo-a", "pantene-shampoo-b"],
  )
  assert.equal(result.reason, "fuzzy_candidates_review")
})

test("cross-category fuzzy candidates remain visible for review", () => {
  const result = matchProductIntake(
    {
      selectedCategoryKey: "conditioner",
      brandId: "brand-pantene",
      productLineId: "line-pro-v",
      cleanProductName: "Repair Shampoo",
    },
    catalog,
  )

  assert.equal(result.status, "pending_review")
  assert.equal(result.matchedProduct, null)
  assert.deepEqual(
    result.candidates.map((candidate) => [candidate.product.id, candidate.reason]),
    [
      ["pantene-shampoo-a", "text_category_mismatch_review"],
      ["pantene-shampoo-b", "text_category_mismatch_review"],
    ],
  )
})

test("retailer SKU matching requires matching source before auto-linking", () => {
  const retailerCatalog: ProductIntakeCatalog = {
    products: [
      {
        id: "retailer-shampoo",
        name: "Retailer Shampoo",
        brandId: "brand-retailer",
        productLineId: null,
        categoryKey: "shampoo",
        isActive: true,
        isChaarlieRecommended: true,
      },
    ],
    identifiers: [
      {
        productId: "retailer-shampoo",
        identifierType: "retailer_sku",
        identifierValue: "SKU-12",
        source: "dm",
      },
    ],
  }

  const differentSource = matchProductIntake(
    {
      selectedCategoryKey: "shampoo",
      identifier: { type: "retailer_sku", value: "SKU-12", source: "rossmann" },
    },
    retailerCatalog,
  )
  assert.equal(differentSource.status, "pending_review")
  assert.equal(differentSource.matchedProduct, null)
  assert.equal(differentSource.candidates[0]?.product.id, "retailer-shampoo")
  assert.equal(differentSource.candidates[0]?.reason, "identifier_source_mismatch_review")
  assert.equal(differentSource.reason, "identifier_source_mismatch_review")

  const missingSource = matchProductIntake(
    {
      selectedCategoryKey: "shampoo",
      identifier: { type: "retailer_sku", value: "SKU-12" },
    },
    retailerCatalog,
  )
  assert.equal(missingSource.status, "pending_review")
  assert.equal(missingSource.matchedProduct, null)
  assert.equal(missingSource.candidates[0]?.product.id, "retailer-shampoo")
  assert.equal(missingSource.candidates[0]?.reason, "identifier_source_mismatch_review")
  assert.equal(missingSource.reason, "identifier_source_mismatch_review")

  const missingTypeAndSource = matchProductIntake(
    {
      selectedCategoryKey: "shampoo",
      identifier: { value: "SKU-12" },
    },
    retailerCatalog,
  )
  assert.equal(missingTypeAndSource.status, "pending_review")
  assert.equal(missingTypeAndSource.matchedProduct, null)
  assert.equal(missingTypeAndSource.candidates[0]?.product.id, "retailer-shampoo")
  assert.equal(missingTypeAndSource.candidates[0]?.reason, "identifier_source_mismatch_review")
  assert.equal(missingTypeAndSource.reason, "identifier_source_mismatch_review")

  const sameSource = matchProductIntake(
    {
      selectedCategoryKey: "shampoo",
      identifier: { type: "retailer_sku", value: "SKU-12", source: "dm" },
    },
    retailerCatalog,
  )
  assert.equal(sameSource.status, "matched")
  assert.equal(sameSource.matchedProduct?.id, "retailer-shampoo")
})

test("missing category cannot match for usage from brand and name alone", () => {
  const result = matchProductIntake(
    {
      brandId: "brand-olaplex",
      productLineId: "line-no-5",
      cleanProductName: "No 5 Leave In Conditioner",
    },
    catalog,
  )

  assert.equal(result.status, "needs_more_info")
  assert.equal(result.matchedProduct, null)
  assert.equal(result.reason, "category_required")
})

test("category mismatch does not auto-link text matches", () => {
  const result = matchProductIntake(
    {
      selectedCategoryKey: "shampoo",
      brandId: "brand-olaplex",
      productLineId: "line-no-5",
      cleanProductName: "No 5 Leave In Conditioner",
    },
    catalog,
  )

  assert.equal(result.status, "pending_review")
  assert.equal(result.matchedProduct, null)
  assert.equal(result.candidates[0]?.product.id, "olaplex-leave-in")
  assert.equal(result.reason, "text_category_mismatch_review")
})
