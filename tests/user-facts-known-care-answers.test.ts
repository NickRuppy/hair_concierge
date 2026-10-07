import assert from "node:assert/strict"
import test from "node:test"

import { knownCareAnswers } from "../src/lib/user-facts/known-care-answers"

test("user answers are known whatever their value, assumed answers never are", () => {
  const known = knownCareAnswers({
    careHabits: {
      towel: { material: "tshirt", technique: "gentle_press" },
      nightProtection: [],
      wetWashFrequency: "weekly_2x",
      currentProductCategories: ["shampoo"],
    },
    fields: {
      towel: "user",
      nightProtection: "user",
      wetWashFrequency: "assumed",
      currentProductCategories: "user",
    },
  })
  assert.deepEqual(known.answers, {
    towel: { material: "tshirt", technique: "gentle_press" },
    nightProtection: [],
    currentProductCategories: ["shampoo"],
  })
  assert.deepEqual([...known.questionIds].sort(), [
    "current_product_categories",
    "night_protection",
    "towel_handling",
  ])
})

test("historical answers count only when they are complete, real answers", () => {
  // Shape of the 22 not-yet-migrated legacy members (prod, 2026-10-06).
  const known = knownCareAnswers({
    careHabits: {
      towel: { material: "frottee", technique: "rough_rubbing" },
      dryingRoutes: ["ordinary_blow_dry", "air_dry"],
      additionalHeatTools: [],
      nightProtection: ["silk_satin_bonnet"],
      heatEvents: { "heat:ordinary_blow_dry": { frequency: "weekly_3_4x" } },
      // backfill rule 2 synthesises this from uses_heat_protection — a partial list.
      currentProductCategories: ["heat_protectant"],
      brushesCombs: ["paddle"],
    },
    fields: {
      towel: "unknown_historical",
      dryingRoutes: "unknown_historical",
      additionalHeatTools: "unknown_historical",
      nightProtection: "unknown_historical",
      heatEvents: "unknown_historical",
      currentProductCategories: "unknown_historical",
      brushesCombs: "unknown_historical",
    },
  })
  assert.deepEqual(known.answers, {
    towel: { material: "frottee", technique: "rough_rubbing" },
    // canonical Stage-2 order, not the stored order
    dryingRoutes: ["air_dry", "ordinary_blow_dry"],
    nightProtection: ["silk_satin_bonnet"],
    heatEvents: { "heat:ordinary_blow_dry": { frequency: "weekly_3_4x" } },
  })
  assert.deepEqual([...known.questionIds].sort(), [
    "drying_routes",
    "heat:ordinary_blow_dry",
    "night_protection",
    "towel_handling",
  ])
})

test("a stored field without provenance is not adopted as her answer", () => {
  const known = knownCareAnswers({
    careHabits: { heatEvents: {}, dryingRoutes: ["air_dry"] },
    fields: { dryingRoutes: "user" },
  })
  assert.deepEqual(known.answers, { dryingRoutes: ["air_dry"] })
  assert.deepEqual(known.questionIds, ["drying_routes"])
})

test("no care facts → nothing known", () => {
  assert.deepEqual(knownCareAnswers({ careHabits: null, fields: undefined }), {
    answers: {},
    questionIds: [],
  })
})
