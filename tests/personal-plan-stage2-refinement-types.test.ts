import assert from "node:assert/strict"
import test from "node:test"

import {
  ADDITIONAL_HEAT_TOOLS,
  DETANGLING_STYLING_CONTEXTS,
  DRY_SHAMPOO_BRIDGE_PREFERENCES,
  DRY_SHAMPOO_VISIBLE_HAIR_COLORS,
  DRYING_ROUTES,
  OIL_PURPOSES,
  SCALP_IRRITATION_DETAILS,
  STAGE2_HEAT_EVENT_SOURCES,
  STAGE2_PRODUCT_CATEGORIES,
  WET_WASH_FREQUENCIES,
} from "../src/lib/personal-plan/refinement/types"

test("Stage 2 accepts exactly the approved current-product categories", () => {
  assert.deepEqual(STAGE2_PRODUCT_CATEGORIES, [
    "shampoo",
    "conditioner",
    "leave_in",
    "heat_protectant",
    "oil",
    "mask",
    "scalp_care",
    "dry_shampoo",
    "bondbuilder",
    "deep_cleansing_shampoo",
  ])
})

test("Stage 2 vocabulary arrays preserve the approved stable order", () => {
  assert.deepEqual(OIL_PURPOSES, ["prewash_lengths", "damp_leave_on", "dry_finish", "scalp"])
  assert.deepEqual(DRYING_ROUTES, ["air_dry", "ordinary_blow_dry", "diffuser_or_airflow_shaping"])
  assert.deepEqual(ADDITIONAL_HEAT_TOOLS, [
    "dryer_brush",
    "hot_air_styler",
    "straightener",
    "curling_or_wave_iron",
    "thermal_rollers",
  ])
  assert.deepEqual(STAGE2_HEAT_EVENT_SOURCES, [
    "ordinary_blow_dry",
    "diffuser_airflow_shaping",
    "dryer_brush",
    "hot_air_styler",
    "straightener",
    "curling_or_wave_iron",
    "thermal_rollers",
  ])
  assert.deepEqual(DETANGLING_STYLING_CONTEXTS, [
    "wet_or_damp_with_slip",
    "wet_or_damp_without_slip",
    "dry",
    "during_blowdry_or_styling",
    "fingers_only",
  ])
  assert.deepEqual(SCALP_IRRITATION_DETAILS, [
    "mild_sensitive_or_itchy",
    "burning_painful_or_inflamed",
  ])
  assert.deepEqual(DRY_SHAMPOO_BRIDGE_PREFERENCES, ["accept", "decline"])
  assert.deepEqual(DRY_SHAMPOO_VISIBLE_HAIR_COLORS, ["light_blonde", "brown", "dark"])
  assert.deepEqual(WET_WASH_FREQUENCIES, [
    "less_than_monthly",
    "monthly_1x",
    "biweekly_1x",
    "weekly_1x",
    "weekly_2x",
    "weekly_3_4x",
    "weekly_5_6x",
    "daily_1x",
    "does_not_wash",
  ])
})
