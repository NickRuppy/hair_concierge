import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
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

test("reviewed catalog uses corrected canonical product identities for Phase A rows", () => {
  const document = JSON.parse(readFileSync("data/product-catalog-normalization.json", "utf-8")) as {
    products: Array<{
      product_id: string
      canonical_brand: string
      product_line: string | null
      clean_name: string
      aliases: Array<{ alias: string; resolves_to: string; product_line: string | null }>
    }>
  }
  const productsById = new Map(document.products.map((product) => [product.product_id, product]))

  const expected = [
    ["02113cc7-80c4-45a5-a56b-738ac96f4f02", "Schwarzkopf GLISS", "Aqua Revive", "Conditioner"],
    ["ffd37427-0cb6-4d6a-8b83-ea904bf2b1d7", "MONDAY", null, "Moisture Conditioner"],
    [
      "5516009a-eecb-42dd-87f6-07c560161136",
      "Garnier",
      "Fructis",
      "Hair Food Aloe Vera Feuchtigkeits-Spülung",
    ],
    ["4c3e1a63-4696-406a-be67-f2aacc678b0c", "Garnier", "Fructis", "Hair Food Macadamia"],
    ["0307c903-84f9-46b4-8f1f-a51c2b1f38ff", "Garnier", "Fructis", "Hair Food Aloe Vera"],
    ["a72d630d-547a-465f-9846-3006b38af0a2", "Garnier", "Fructis", "Hair Food Macadamia"],
    ["c6e80f39-20ba-401e-b041-6ee7c89a5996", "Balea", "Professional", "Aqua Hyaluron 3in1"],
    [
      "5dc2fae3-a0ca-4e6c-9c30-02dd192772f0",
      "Schwarzkopf GLISS",
      "Ultimate Repair",
      "Sprüh-Conditioner",
    ],
    ["55727898-2a5e-4f01-ace1-bd91521d98ab", "Balea", "Professional", "Aqua Hyaluron 3 in 1"],
    ["52264c47-f339-49db-9fb2-207d1ad3b470", "Garnier", "Fructis", "Hair Food Aloe Vera"],
    ["9e1442c9-4ab8-4819-a851-66859a98ed80", "Garnier", "Fructis", "Hair Food Papaya"],
    [
      "7a1d7fe1-3240-4d6d-9c92-96a4bcf46ea9",
      "Schwarzkopf GLISS",
      "Aqua Revive",
      "4-in-1 Bonding Haarmaske",
    ],
    [
      "d9825ad6-f549-4b02-a62a-eaa3bf917936",
      "Schwarzkopf GLISS",
      "Liquid Silk",
      "Glanz 4-in-1 Bonding Haarmaske",
    ],
    ["4e76bb70-b521-48e1-9708-4edc48b17c73", "Schwarzkopf GLISS", null, "Liquid Silk"],
    [
      "ea353b65-544d-48a8-a057-c3e733b66326",
      "Garnier",
      "Wahre Schätze",
      "1-Minute Haarkur Argan & Camelia Öl",
    ],
    ["b2e7e679-a6ba-4ba3-93d7-1fd35f6e6c75", "Garnier", "Wahre Schätze", "Avocado"],
    ["c05773dd-9656-4381-a0ab-8e9fc310c520", "L'Oréal Paris", "Elvital", "Öl Magique Jojoba"],
    [
      "21a94166-3813-4c0f-8912-508fb8f704f1",
      "L'Oréal Paris",
      "Elvital",
      "Öl Magique Midnight Serum",
    ],
    ["ead1333b-6839-464d-b272-673d39bb95a4", "Balea", "Professional", "Aqua Hyaluron"],
    ["6dc65df2-2466-43e4-bdc2-3a05803f305c", "MONDAY", null, "Volume Kraft & Fülle Shampoo"],
    ["7200bb0b-7463-433b-86c8-744f5c1431de", "Garnier", "Wahre Schätze", "Aktivkohle"],
    ["0d68d56f-7e82-41d0-a2a8-bbf8f02e0b33", "Garnier", "Wahre Schätze", "Sanfte Hafermilch"],
    ["514ffd65-e4a5-4f7f-96c5-0f194e3b3b36", "L'Oréal Professionnel", "Metal DX", "Shampoo"],
  ] as const

  for (const [id, brand, line, cleanName] of expected) {
    const product = productsById.get(id)
    assert.ok(product, `expected product ${id} to exist`)
    assert.equal(product.canonical_brand, brand)
    assert.equal(product.product_line, line)
    assert.equal(product.clean_name, cleanName)
  }

  const glisskur = productsById.get("4e76bb70-b521-48e1-9708-4edc48b17c73")
  assert.equal(glisskur?.product_line, null)
  assert.equal(glisskur?.clean_name, "Liquid Silk")

  const garnierFructis = productsById.get("52264c47-f339-49db-9fb2-207d1ad3b470")
  assert.ok(
    garnierFructis?.aliases.some(
      (alias) =>
        alias.alias === "Garnier Hair Food" &&
        alias.resolves_to === "brand_line" &&
        alias.product_line === "Fructis",
    ),
  )
})
