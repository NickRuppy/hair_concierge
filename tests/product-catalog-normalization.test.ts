import assert from "node:assert/strict"
import test from "node:test"

import { normalizeUsageFacts, productSnapshotRow } from "../scripts/product-identity/export-catalog"
import { buildApplyPlan } from "../scripts/product-identity/apply-normalization"
import {
  normalizeAlias,
  validateNormalizationAgainstSnapshot,
  validateNormalizationDocument,
} from "../scripts/product-identity/validate-normalization"

test("productSnapshotRow keeps catalog fields and excludes personal data", () => {
  const row = productSnapshotRow({
    id: "product-1",
    brand: "K18",
    name: "Leave-In Molecular Repair Hair Mask",
    category: "Leave-in",
    is_active: true,
    lifecycle_status: "active",
    image_url: "https://example.com/image.jpg",
    affiliate_link: "https://example.com/product",
    price_eur: 75,
    currency: "EUR",
    purchase_link_status: "available",
    purchase_link_checked_at: "2026-06-01T10:00:00Z",
    price_checked_at: "2026-06-01T10:00:00Z",
    user_id: "must-not-leak",
  })

  assert.deepEqual(Object.keys(row), [
    "id",
    "brand",
    "name",
    "category",
    "is_active",
    "lifecycle_status",
    "image_url",
    "affiliate_link",
    "price_eur",
    "currency",
    "purchase_link_status",
    "purchase_link_checked_at",
    "price_checked_at",
  ])
})

test("normalizeUsageFacts returns aggregate distinct category/frequency facts", () => {
  assert.deepEqual(
    normalizeUsageFacts([
      { category: "Shampoo", frequency_range: "weekly_1x", user_id: "must-not-leak" },
      { category: "Shampoo Profi", frequency_range: "1_2x" },
      { category: "Mask", frequency_range: null },
    ]),
    [
      { category: "mask", frequency: null, count: 1 },
      { category: "shampoo", frequency: "weekly_1x", count: 2 },
    ],
  )
})

test("normalizeAlias catches case, punctuation, and separator collisions", () => {
  assert.equal(normalizeAlias("K18 - Leave-In"), "k18 leave in")
  assert.equal(normalizeAlias(" k18 leave in "), "k18 leave in")
})

test("validateNormalizationDocument rejects alias conflicts and unsupported identifiers", () => {
  const result = validateNormalizationDocument(
    {
      products: [
        {
          product_id: "product-1",
          current_brand: "K18",
          current_name: "K18 Leave-In Molecular Repair Hair Mask",
          current_category: "Leave-in",
          canonical_brand: "K18",
          canonical_category_key: "leave_in",
          product_line: null,
          clean_name: "Leave-In Molecular Repair Hair Mask",
          known_titles: ["K18 Leave-In"],
          aliases: [
            {
              alias: "K18",
              resolves_to: "brand",
              canonical_brand: "K18",
              product_line: null,
            },
          ],
          identifiers: [{ type: "ean", value: "1234567890123" }],
          notes: null,
          review_status: "reviewed",
        },
        {
          product_id: "product-2",
          current_brand: "K18 Professional",
          current_name: "K18 Professional Mask",
          current_category: "Maske",
          canonical_brand: "K18 Professional",
          canonical_category_key: "mask",
          product_line: null,
          clean_name: "Mask",
          known_titles: ["K18 Leave In"],
          aliases: [
            {
              alias: "K18",
              resolves_to: "brand",
              canonical_brand: "K18 Professional",
              product_line: null,
            },
          ],
          identifiers: [{ type: "barcode", value: "" }],
          notes: null,
          review_status: "reviewed",
        },
      ],
    },
    { requireReviewed: true },
  )

  assert.equal(result.ok, false)
  assert.match(result.errors.join("\n"), /Alias conflict/)
  assert.match(result.errors.join("\n"), /identifiers\[0\]\.value must not be blank/)
})

test("validateNormalizationDocument rejects exact identifier conflicts across products", () => {
  const result = validateNormalizationDocument({
    products: [
      {
        product_id: "product-1",
        current_brand: "Brand",
        current_name: "Product One",
        current_category: "Leave-in",
        canonical_brand: "Brand",
        canonical_category_key: "leave_in",
        product_line: null,
        clean_name: "Product One",
        known_titles: ["Brand Product One"],
        aliases: [
          {
            alias: "Brand",
            resolves_to: "brand",
            canonical_brand: "Brand",
            product_line: null,
          },
        ],
        identifiers: [{ type: "ean", value: "1234567890123" }],
        notes: null,
        review_status: "reviewed",
      },
      {
        product_id: "product-2",
        current_brand: "Brand",
        current_name: "Product Two",
        current_category: "Maske",
        canonical_brand: "Brand",
        canonical_category_key: "mask",
        product_line: null,
        clean_name: "Product Two",
        known_titles: ["Brand Product Two"],
        aliases: [
          {
            alias: "Brand",
            resolves_to: "brand",
            canonical_brand: "Brand",
            product_line: null,
          },
        ],
        identifiers: [{ type: "ean", value: "1234567890123" }],
        notes: null,
        review_status: "reviewed",
      },
    ],
  })

  assert.equal(result.ok, false)
  assert.match(result.errors.join("\n"), /Identifier conflict/)
})

test("validateNormalizationDocument rejects aliases that collide with canonical brand names", () => {
  const result = validateNormalizationDocument({
    products: [
      {
        product_id: "product-1",
        current_brand: "Garnier",
        current_name: "Garnier Shampoo",
        current_category: "Shampoo",
        canonical_brand: "Garnier",
        canonical_category_key: "shampoo",
        product_line: null,
        clean_name: "Shampoo",
        known_titles: ["Garnier Shampoo"],
        aliases: [
          {
            alias: "Garnier",
            resolves_to: "brand",
            canonical_brand: "Garnier",
            product_line: null,
          },
        ],
        identifiers: [],
        notes: null,
        review_status: "reviewed",
      },
      {
        product_id: "product-2",
        current_brand: "Garnier Fructis",
        current_name: "Fructis Maske",
        current_category: "Maske",
        canonical_brand: "Garnier Fructis",
        canonical_category_key: "mask",
        product_line: null,
        clean_name: "Maske",
        known_titles: ["Fructis Maske"],
        aliases: [
          {
            alias: "Garnier",
            resolves_to: "brand",
            canonical_brand: "Garnier Fructis",
            product_line: null,
          },
        ],
        identifiers: [],
        notes: null,
        review_status: "reviewed",
      },
    ],
  })

  assert.equal(result.ok, false)
  assert.match(result.errors.join("\n"), /Alias conflict/)
})

test("validateNormalizationDocument rejects brand-line aliases without a row product line", () => {
  const result = validateNormalizationDocument({
    products: [
      {
        product_id: "product-1",
        current_brand: "K18",
        current_name: "K18 Molecular Repair Mask",
        current_category: "Maske",
        canonical_brand: "K18",
        canonical_category_key: "mask",
        product_line: null,
        clean_name: "Molecular Repair Mask",
        known_titles: ["K18 Molecular Repair Mask"],
        aliases: [
          {
            alias: "K18 Molecular Repair",
            resolves_to: "brand_line",
            canonical_brand: "K18",
            product_line: "Molecular Repair",
          },
        ],
        identifiers: [],
        notes: null,
        review_status: "reviewed",
      },
    ],
  })

  assert.equal(result.ok, false)
  assert.match(result.errors.join("\n"), /requires the row product_line/)
})

test("validateNormalizationDocument rejects duplicate product ids", () => {
  const row = {
    product_id: "product-1",
    current_brand: "Brand",
    current_name: "Product One",
    current_category: "Leave-in",
    canonical_brand: "Brand",
    canonical_category_key: "leave_in",
    product_line: null,
    clean_name: "Product One",
    known_titles: ["Brand Product One"],
    aliases: [
      {
        alias: "Brand",
        resolves_to: "brand",
        canonical_brand: "Brand",
        product_line: null,
      },
    ],
    identifiers: [],
    notes: null,
    review_status: "reviewed",
  }

  const result = validateNormalizationDocument({ products: [row, row] })

  assert.equal(result.ok, false)
  assert.match(result.errors.join("\n"), /duplicates product id product-1/)
})

test("validateNormalizationAgainstSnapshot catches stale current catalog fields", () => {
  const result = validateNormalizationAgainstSnapshot(
    {
      products: [
        {
          product_id: "product-1",
          current_brand: "Old Brand",
          current_name: "Current Name",
          current_category: "Leave-in",
        },
      ],
    },
    {
      products: [
        {
          id: "product-1",
          brand: "New Brand",
          name: "Current Name",
          category: "Leave-in",
        },
      ],
    },
  )

  assert.equal(result.ok, false)
  assert.match(result.errors.join("\n"), /current_brand is stale/)
})

test("validateNormalizationDocument enforces category keys, clean brand prefix, and review gate", () => {
  const result = validateNormalizationDocument(
    {
      products: [
        {
          product_id: "product-1",
          current_brand: "K18",
          current_name: "K18 Leave-In Molecular Repair Hair Mask",
          current_category: "Leave-in",
          canonical_brand: "K18",
          canonical_category_key: "styling",
          product_line: null,
          clean_name: "K18 Leave-In Molecular Repair Hair Mask",
          known_titles: [""],
          aliases: [],
          identifiers: [{ type: "unknown", value: "x" }],
          notes: null,
          review_status: "draft",
        },
      ],
    },
    { requireReviewed: true },
  )

  assert.equal(result.ok, false)
  assert.match(result.errors.join("\n"), /canonical_category_key must be one of/)
  assert.match(result.errors.join("\n"), /clean_name must not duplicate canonical_brand/)
  assert.match(result.errors.join("\n"), /known_titles\[0\] must not be blank/)
  assert.match(result.errors.join("\n"), /identifiers\[0\]\.type must be one of/)
  assert.match(result.errors.join("\n"), /review_status must be reviewed/)
})

test("buildApplyPlan deduplicates brands, aliases, product lines, and identifiers", () => {
  const plan = buildApplyPlan({
    products: [
      {
        product_id: "product-1",
        current_brand: "K18",
        current_name: "K18 Leave-In Molecular Repair Hair Mask",
        current_category: "Leave-in",
        canonical_brand: "K18",
        canonical_category_key: "leave_in",
        product_line: "Molecular Repair",
        clean_name: "Leave-In Molecular Repair Hair Mask",
        aliases: [
          {
            alias: "K-18",
            resolves_to: "brand",
            canonical_brand: "K18",
            product_line: null,
          },
          {
            alias: "K18 Molecular Repair",
            resolves_to: "brand_line",
            canonical_brand: "K18",
            product_line: "Molecular Repair",
          },
        ],
        known_titles: ["K18 Leave-In"],
        identifiers: [{ type: "ean", value: "1234567890123" }],
        review_status: "reviewed",
      },
      {
        product_id: "product-2",
        current_brand: "K18",
        current_name: "K18 Molecular Repair Mask",
        current_category: "Maske",
        canonical_brand: "K18",
        canonical_category_key: "mask",
        product_line: "Molecular Repair",
        clean_name: "Mask",
        aliases: [
          {
            alias: "K18",
            resolves_to: "brand",
            canonical_brand: "K18",
            product_line: null,
          },
        ],
        known_titles: ["K18 Mask"],
        identifiers: [{ type: "ean", value: "1234567890123" }],
        review_status: "reviewed",
      },
    ],
  })

  assert.deepEqual(plan.brands, [
    {
      key: "k18",
      canonical_name: "K18",
      aliases: ["K-18", "K18", "K18 Molecular Repair"],
    },
  ])
  assert.equal(plan.productLines.length, 1)
  assert.equal(plan.identifiers.length, 2)
  assert.equal(plan.productUpdates[0].brand_key, "k18")
})

test("buildApplyPlan deduplicates identifiers by database-normalized value", () => {
  const plan = buildApplyPlan({
    products: [
      {
        product_id: "product-1",
        current_brand: "Brand",
        current_name: "Product",
        current_category: "Shampoo",
        canonical_brand: "Brand",
        canonical_category_key: "shampoo",
        product_line: null,
        clean_name: "Product",
        aliases: [
          {
            alias: "Brand",
            resolves_to: "brand",
            canonical_brand: "Brand",
            product_line: null,
          },
        ],
        known_titles: ["Brand Product"],
        identifiers: [
          { type: "retailer_sku", value: " SKU 123 " },
          { type: "retailer_sku", value: "sku123" },
        ],
        review_status: "reviewed",
      },
    ],
  })

  assert.equal(plan.identifiers.length, 1)
})
