import assert from "node:assert/strict"
import test from "node:test"

import {
  parseProductIntakeResearchedPayload,
  validateProductIntakeApprovalPayload,
  type ProductIntakeReviewCategoryKey,
} from "../src/lib/product-intake/category-validators"
import { dryRunProductIntakeReadyForReview } from "../src/lib/product-intake/review-workflow"

const PRODUCT_ID_PLACEHOLDER = "__PRODUCT_ID__"

function reviewedPayload(
  categoryKey: ProductIntakeReviewCategoryKey | "peeling",
  categorySpecs: Record<string, unknown>,
) {
  const fieldRationales = Object.fromEntries(
    [
      "product.canonical_brand",
      "product.clean_name",
      "product.category_key",
      "product.affiliate_link",
      "product.image_url",
      "product.price_eur",
      "product.purchase_link_status",
      ...Object.keys(categorySpecs).map((key) => `category_specs.${key}`),
    ].map((key) => [key, `Reviewed evidence supports ${key}.`]),
  )

  return {
    draft: {
      notes: "kept as JSON draft context",
    },
    final: {
      product: {
        canonical_brand: "Garnier",
        product_line: null,
        clean_name: "Hair Food Aloe Maske",
        category_key: categoryKey,
        affiliate_link: "https://example.test/affiliate",
        image_url: "https://example.test/image.jpg",
        price_eur: 7.95,
        currency: "EUR",
        purchase_link_status: "available",
        purchase_link_checked_at: "2026-06-17T09:00:00.000Z",
        price_checked_at: "2026-06-17T09:00:00.000Z",
      },
      identifiers: [{ type: "barcode", value: "4000000000000" }],
      category_specs: categorySpecs,
      sources: [
        {
          url: "https://example.test/product",
          title: "Product page",
          evidence: "Brand page lists the product and relevant specs.",
        },
      ],
      field_rationales: fieldRationales,
      review: {
        manual_reviewed: true,
        reviewed_by: "reviewer@example.test",
        reviewed_at: "2026-06-17T10:00:00.000Z",
      },
    },
  }
}

function validCategorySpecs(categoryKey: ProductIntakeReviewCategoryKey): Record<string, unknown> {
  switch (categoryKey) {
    case "shampoo":
      return {
        product_shampoo_specs: [
          {
            thickness: "fine",
            shampoo_bucket: "normal",
            scalp_route: "balanced",
            cleansing_intensity: "regular",
          },
          {
            thickness: "normal",
            shampoo_bucket: "trocken",
            scalp_route: "dry",
            cleansing_intensity: "gentle",
          },
        ],
      }
    case "conditioner":
      return {
        product_conditioner_specs: [
          { thickness: "fine", protein_moisture_balance: "snaps" },
          { thickness: "normal", protein_moisture_balance: "stretches_bounces" },
        ],
        product_conditioner_rerank_specs: {
          weight: "light",
          repair_level: "medium",
          balance_direction: null,
          ingredient_flags: ["humectants"],
        },
      }
    case "mask":
      return {
        product_mask_specs: {
          weight: "medium",
          concentration: "high",
          balance_direction: "moisture",
          ingredient_flags: ["humectants", "oils"],
        },
      }
    case "leave_in":
      return {
        product_leave_in_specs: {
          format: "spray",
          weight: "light",
          roles: ["styling_prep"],
          provides_heat_protection: true,
          heat_protection_max_c: 220,
          heat_activation_required: false,
          care_benefits: ["moisture", "anti_frizz"],
          ingredient_flags: ["polymers"],
          application_stage: ["pre_heat"],
        },
        product_leave_in_fit_specs: {
          weight: "light",
          conditioner_relationship: "booster_only",
          care_benefits: ["heat_protect", "detangle_smooth"],
        },
        product_leave_in_eligibility: [
          { thickness: "fine", need_bucket: "heat_protect", styling_context: "heat_style" },
          { thickness: "normal", need_bucket: "moisture_anti_frizz", styling_context: "air_dry" },
        ],
      }
    case "oil":
      return {
        product_oil_eligibility: [
          {
            thickness: "fine",
            oil_subtype: "trocken-oel",
            oil_purpose: "light_finish",
            ingredient_flags: ["silicones"],
          },
          {
            thickness: "coarse",
            oil_subtype: "natuerliches-oel",
            oil_purpose: null,
            ingredient_flags: ["oils"],
          },
        ],
      }
    case "dry_shampoo":
      return {
        product_dry_shampoo_specs: {
          primary_effect: "classic_refresh",
          hair_color_fit: "universal",
          scalp_sensitivity_fit: "sensitive_ok",
          format: "aerosol_spray",
        },
      }
    case "deep_cleansing_shampoo":
      return {
        product_deep_cleansing_shampoo_specs: {
          scalp_type_focus: "oily",
          reset_intensity: "medium",
          reset_focus: "product_sebum_buildup",
          color_treated_suitability: "suitable",
        },
      }
    case "bondbuilder":
      return {
        product_bondbuilder_specs: {
          bond_repair_intensity: "intensive",
          application_mode: "post_wash_leave_in",
          bond_repair_axis: "peptide_chain",
          treatment_mode: "leave_in",
          product_format: "leave_in_mask",
          usage_protocol: "k18_leave_in",
        },
      }
  }
}

test("unsupported category fails approval validation", () => {
  const result = validateProductIntakeApprovalPayload(
    reviewedPayload("peeling", { product_peeling_specs: { scalp_type_focus: "oily" } }),
  )

  assert.equal(result.ok, false)
  assert.ok(result.missingFields.includes("final.product.category_key"))
})

test("missing base product fields fail approval validation", () => {
  const payload = reviewedPayload("mask", validCategorySpecs("mask"))
  delete (payload.final.product as Record<string, unknown>).clean_name

  const result = validateProductIntakeApprovalPayload(payload)

  assert.equal(result.ok, false)
  assert.ok(result.missingFields.includes("final.product.clean_name"))
})

test("missing source evidence fails approval validation", () => {
  const payload = reviewedPayload("mask", validCategorySpecs("mask"))
  payload.final.sources = []

  const result = validateProductIntakeApprovalPayload(payload)

  assert.equal(result.ok, false)
  assert.ok(result.missingFields.includes("final.sources"))
})

test("unsupported identifier types fail before approval writes", () => {
  const payload = reviewedPayload("mask", validCategorySpecs("mask"))
  payload.final.identifiers = [{ type: "upc", value: "123456789012" }]

  const result = validateProductIntakeApprovalPayload(payload)

  assert.equal(result.ok, false)
  assert.ok(result.missingFields.includes("final.identifiers.0.type"))
})

test("identifiers are optional when reviewed source evidence is complete", () => {
  const payload = reviewedPayload("mask", validCategorySpecs("mask"))
  payload.final.identifiers = []

  const result = validateProductIntakeApprovalPayload(payload)

  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.deepEqual(result.normalizedPayload.final.identifiers, [])
})

test("barcode-like identifiers are canonicalized before approval writes", () => {
  const payload = reviewedPayload("mask", validCategorySpecs("mask"))
  payload.final.identifiers = [{ type: "EAN", value: "40000-123 45678" }]

  const result = validateProductIntakeApprovalPayload(payload)

  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.deepEqual(result.normalizedPayload.final.identifiers, [
    { type: "ean", value: "4000012345678" },
  ])
})

test("field rationales must cover product and category spec conclusions", () => {
  const payload = reviewedPayload("mask", validCategorySpecs("mask"))
  delete payload.final.field_rationales["category_specs.product_mask_specs"]

  const result = validateProductIntakeApprovalPayload(payload)

  assert.equal(result.ok, false)
  assert.ok(
    result.missingFields.includes("final.field_rationales.category_specs.product_mask_specs"),
  )
})

test("manual review flag is required before approval", () => {
  const payload = reviewedPayload("mask", validCategorySpecs("mask"))
  payload.final.review.manual_reviewed = false

  const result = validateProductIntakeApprovalPayload(payload)

  assert.equal(result.ok, false)
  assert.ok(result.missingFields.includes("final.review.manual_reviewed"))
})

test("researched payload parser keeps draft and final JSON payloads", () => {
  const payload = reviewedPayload("mask", validCategorySpecs("mask"))

  const parsed = parseProductIntakeResearchedPayload(payload)
  const validated = validateProductIntakeApprovalPayload(payload)

  assert.ok(parsed.ok)
  assert.deepEqual(parsed.payload.draft, payload.draft)
  assert.ok(validated.ok)
  assert.deepEqual(validated.normalizedPayload.draft, payload.draft)
})

test("each supported category emits expected target table operation shapes", () => {
  const expectedTablesByCategory: Record<ProductIntakeReviewCategoryKey, string[]> = {
    shampoo: ["product_shampoo_specs"],
    conditioner: ["product_conditioner_specs", "product_conditioner_rerank_specs"],
    mask: ["product_mask_specs"],
    leave_in: [
      "product_leave_in_specs",
      "product_leave_in_fit_specs",
      "product_leave_in_eligibility",
    ],
    oil: ["product_oil_eligibility"],
    dry_shampoo: ["product_dry_shampoo_specs"],
    deep_cleansing_shampoo: ["product_deep_cleansing_shampoo_specs"],
    bondbuilder: ["product_bondbuilder_specs"],
  }

  for (const [categoryKey, expectedTables] of Object.entries(expectedTablesByCategory) as Array<
    [ProductIntakeReviewCategoryKey, string[]]
  >) {
    const result = validateProductIntakeApprovalPayload(
      reviewedPayload(categoryKey, validCategorySpecs(categoryKey)),
    )

    assert.equal(result.ok, true, categoryKey)
    assert.deepEqual(
      result.targetSpecOperations.map((operation) => operation.table),
      expectedTables,
    )
    for (const operation of result.targetSpecOperations) {
      assert.equal(operation.type, "upsert")
      assert.ok(operation.rows.length > 0)
      assert.ok(operation.rows.every((row) => row.product_id === PRODUCT_ID_PLACEHOLDER))
    }
  }
})

test("shampoo rows are emitted without Cartesian guessing", () => {
  const result = validateProductIntakeApprovalPayload(
    reviewedPayload("shampoo", validCategorySpecs("shampoo")),
  )

  assert.equal(result.ok, true)
  assert.deepEqual(result.targetSpecOperations[0]?.rows, [
    {
      product_id: PRODUCT_ID_PLACEHOLDER,
      thickness: "fine",
      shampoo_bucket: "normal",
      scalp_route: "balanced",
      cleansing_intensity: "regular",
    },
    {
      product_id: PRODUCT_ID_PLACEHOLDER,
      thickness: "normal",
      shampoo_bucket: "trocken",
      scalp_route: "dry",
      cleansing_intensity: "gentle",
    },
  ])
})

test("bondbuilder product relationships are optional and do not block approval", () => {
  const specs = {
    ...validCategorySpecs("bondbuilder"),
    product_relationships: [],
  }

  const result = validateProductIntakeApprovalPayload(reviewedPayload("bondbuilder", specs))

  assert.equal(result.ok, true)
  assert.deepEqual(
    result.targetSpecOperations.map((operation) => operation.table),
    ["product_bondbuilder_specs"],
  )
})

test("incomplete multi-row category specs fail", () => {
  const cases = [
    reviewedPayload("shampoo", { product_shampoo_specs: [{ thickness: "fine" }] }),
    reviewedPayload("oil", { product_oil_eligibility: [{ thickness: "fine" }] }),
    reviewedPayload("leave_in", {
      ...validCategorySpecs("leave_in"),
      product_leave_in_eligibility: [{ thickness: "fine", need_bucket: "heat_protect" }],
    }),
  ]

  for (const payload of cases) {
    const result = validateProductIntakeApprovalPayload(payload)
    assert.equal(result.ok, false)
    assert.ok(result.missingFields.some((field) => field.startsWith("final.category_specs.")))
  }
})

test("ready-for-review dry run only passes when approval validator passes", () => {
  const valid = dryRunProductIntakeReadyForReview({
    id: "submission-1",
    category: "dry_shampoo",
    researched_payload: reviewedPayload("dry_shampoo", validCategorySpecs("dry_shampoo")),
  })

  assert.equal(valid.ok, true)
  assert.equal(valid.status, "ready_for_review")

  const invalid = dryRunProductIntakeReadyForReview({
    id: "submission-2",
    category: "dry_shampoo",
    researched_payload: reviewedPayload("dry_shampoo", {}),
  })

  assert.equal(invalid.ok, false)
  assert.equal(invalid.status, "needs_more_info")
})
