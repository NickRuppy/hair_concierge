import assert from "node:assert/strict"
import test from "node:test"

import { productSchema } from "../src/lib/validators"

function buildBaseProduct(overrides: Record<string, unknown>) {
  return {
    name: "Test Product",
    brand: "Brand",
    description: null,
    category: null,
    affiliate_link: null,
    image_url: null,
    price_eur: null,
    tags: [],
    suitable_thicknesses: [],
    suitable_concerns: [],
    is_active: true,
    sort_order: 0,
    ...overrides,
  }
}

test("product schema accepts bondbuilder support specs", () => {
  const parsed = productSchema.safeParse(
    buildBaseProduct({
      category: "Bondbuilder",
      bondbuilder_specs: {
        bond_repair_intensity: "intensive",
        application_mode: "post_wash_leave_in",
      },
    }),
  )

  assert.equal(parsed.success, true)
})

test("product schema accepts canonical leave-in fit specs", () => {
  const parsed = productSchema.safeParse(
    buildBaseProduct({
      category: "Leave-in",
      leave_in_specs: {
        weight: "light",
        conditioner_relationship: "replacement_capable",
        care_benefits: ["heat_protect", "repair"],
      },
    }),
  )

  assert.equal(parsed.success, true)
})

test("product schema accepts engine-native mask specs", () => {
  const parsed = productSchema.safeParse(
    buildBaseProduct({
      category: "Maske",
      mask_specs: {
        weight: "medium",
        concentration: "high",
        balance_direction: "moisture",
      },
    }),
  )

  assert.equal(parsed.success, true)
})

test("product schema requires deep-cleansing specs for deep-cleansing products", () => {
  const parsed = productSchema.safeParse(
    buildBaseProduct({
      category: "Tiefenreinigungsshampoo",
    }),
  )

  assert.equal(parsed.success, false)
  if (parsed.success) {
    throw new Error("Expected deep-cleansing spec validation to fail")
  }
  assert.ok(parsed.error.flatten().fieldErrors.deep_cleansing_shampoo_specs)
})

test("product schema restricts dry shampoo scalp focus to oily or balanced", () => {
  const parsed = productSchema.safeParse(
    buildBaseProduct({
      category: "Trockenshampoo",
      dry_shampoo_specs: {
        scalp_type_focus: "dry",
      },
    }),
  )

  assert.equal(parsed.success, false)
  if (parsed.success) {
    throw new Error("Expected dry shampoo spec validation to fail")
  }
  assert.ok(parsed.error.flatten().fieldErrors.dry_shampoo_specs)
})

test("product schema accepts peeling specs with canonical peeling type", () => {
  const parsed = productSchema.safeParse(
    buildBaseProduct({
      category: "Peeling",
      peeling_specs: {
        scalp_type_focus: "balanced",
        peeling_type: "acid_serum",
      },
    }),
  )

  assert.equal(parsed.success, true)
})

test("product schema rejects profile-only concerns on products", () => {
  const parsed = productSchema.safeParse(
    buildBaseProduct({
      category: "Leave-in",
      suitable_concerns: ["hair_loss"],
      leave_in_specs: {
        weight: "light",
        conditioner_relationship: "replacement_capable",
        care_benefits: ["repair"],
      },
    }),
  )

  assert.equal(parsed.success, false)
})

test("product schema allows tangling on leave-in but not on shampoo", () => {
  const leaveInParsed = productSchema.safeParse(
    buildBaseProduct({
      category: "Leave-in",
      suitable_concerns: ["tangling"],
      leave_in_specs: {
        weight: "light",
        conditioner_relationship: "replacement_capable",
        care_benefits: ["repair"],
      },
    }),
  )

  assert.equal(leaveInParsed.success, true)

  const shampooParsed = productSchema.safeParse(
    buildBaseProduct({
      category: "Shampoo",
      suitable_concerns: ["tangling"],
    }),
  )

  assert.equal(shampooParsed.success, false)
})

test("product schema allows dryness on shampoo", () => {
  const parsed = productSchema.safeParse(
    buildBaseProduct({
      category: "Shampoo",
      suitable_concerns: ["dryness"],
    }),
  )

  assert.equal(parsed.success, true)
})
