import assert from "node:assert/strict"
import test from "node:test"

import { hydrateHairProfileForConsumers } from "../src/lib/hair-profile/derived"
import { UNSELECTED_SHAMPOO_PRODUCT_NAME } from "../src/lib/product-usage/shampoo-fallback"
import type { HairProfile } from "../src/lib/types"

function makeProfile(overrides: Partial<HairProfile> = {}): HairProfile {
  return {
    id: "hp_test",
    user_id: "user_test",
    hair_texture: null,
    thickness: null,
    density: null,
    concerns: [],
    products_used: null,
    shampoo_frequency: null,
    heat_styling: null,
    styling_tools: null,
    goals: [],
    cuticle_condition: null,
    protein_moisture_balance: null,
    scalp_type: null,
    scalp_condition: null,
    chemical_treatment: [],
    desired_volume: null,
    routine_preference: null,
    current_routine_products: null,
    towel_material: null,
    towel_technique: null,
    drying_method: null,
    brush_type: null,
    night_protection: null,
    uses_heat_protection: false,
    additional_notes: null,
    conversation_memory: null,
    created_at: "2026-04-17T00:00:00.000Z",
    updated_at: "2026-04-17T00:00:00.000Z",
    ...overrides,
  }
}

test("hydrates derived routine categories and products_used from user_product_usage rows", () => {
  const hydrated = hydrateHairProfileForConsumers(makeProfile(), [
    {
      category: "conditioner",
      product_name: "Soft Conditioner",
      frequency_range: "weekly_2x",
    },
    {
      category: "leave_in",
      product_name: "Curl Cream",
      frequency_range: "less_than_monthly",
    },
  ])

  assert.deepEqual(hydrated?.current_routine_products, ["conditioner", "leave_in"])
  assert.match(hydrated?.products_used ?? "", /Conditioner: Soft Conditioner/)
  assert.match(hydrated?.products_used ?? "", /Leave-in: Curl Cream/)
})

test("hydrates wash cadence from shampoo product usage", () => {
  const hydrated = hydrateHairProfileForConsumers(makeProfile({ shampoo_frequency: null }), [
    {
      category: "shampoo",
      product_name: "Daily Shampoo",
      frequency_range: "weekly_3_4x",
    },
  ])

  assert.equal(hydrated?.shampoo_frequency, "weekly_3_4x")
  assert.deepEqual(hydrated?.current_routine_products, ["shampoo"])
})

test("uses the highest shampoo cadence when duplicate shampoo rows exist", () => {
  const hydrated = hydrateHairProfileForConsumers(makeProfile({ shampoo_frequency: null }), [
    {
      category: "shampoo",
      product_name: "Occasional Shampoo",
      frequency_range: "weekly_1x",
    },
    {
      category: "shampoo",
      product_name: "Main Shampoo",
      frequency_range: "weekly_5_6x",
    },
  ])

  assert.equal(hydrated?.shampoo_frequency, "weekly_5_6x")
})

test("uses unselected shampoo fallback for cadence without selected routine product display", () => {
  const hydrated = hydrateHairProfileForConsumers(
    makeProfile({
      shampoo_frequency: null,
      current_routine_products: ["shampoo"],
      products_used: "Shampoo: Legacy",
    }),
    [
      {
        category: "shampoo",
        product_name: UNSELECTED_SHAMPOO_PRODUCT_NAME,
        frequency_range: "less_than_monthly",
      },
    ],
  )

  assert.equal(hydrated?.shampoo_frequency, "less_than_monthly")
  assert.equal(hydrated?.current_routine_products, null)
  assert.equal(hydrated?.products_used, null)
})

test("keeps real unnamed less-than-monthly shampoo visible", () => {
  const hydrated = hydrateHairProfileForConsumers(makeProfile({ shampoo_frequency: null }), [
    {
      category: "shampoo",
      product_name: null,
      frequency_range: "less_than_monthly",
    },
  ])

  assert.equal(hydrated?.shampoo_frequency, "less_than_monthly")
  assert.deepEqual(hydrated?.current_routine_products, ["shampoo"])
  assert.equal(hydrated?.products_used, "Shampoo")
})

test("does not infer shampoo frequency from deprecated profile shampoo_frequency", () => {
  const hydrated = hydrateHairProfileForConsumers(
    makeProfile({ shampoo_frequency: "daily_1x" as never }),
    [],
  )

  assert.equal(hydrated?.shampoo_frequency, null)
})
