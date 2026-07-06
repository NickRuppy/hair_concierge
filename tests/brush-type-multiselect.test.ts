import assert from "node:assert/strict"
import test from "node:test"

import {
  getBrushMechanicalStressContribution,
  normalizeBrushTypeValues,
} from "../src/lib/profile/brush-type"
import { buildDamageAssessment } from "../src/lib/recommendation-engine/assessments/damage"
import { normalizeRecommendationInput } from "../src/lib/recommendation-engine/normalize"
import { hairProfileFullSchema } from "../src/lib/validators"

const baseProfileInput = {
  hair_texture: null,
  thickness: null,
}

test("hair profile schema treats brush type as nullable selected-value array", () => {
  assert.equal(
    hairProfileFullSchema.parse({ ...baseProfileInput, brush_type: null }).brush_type,
    null,
  )
  assert.deepEqual(
    hairProfileFullSchema.parse({ ...baseProfileInput, brush_type: [] }).brush_type,
    [],
  )
  assert.deepEqual(
    hairProfileFullSchema.parse({ ...baseProfileInput, brush_type: ["paddle", "round"] })
      .brush_type,
    ["paddle", "round"],
  )
  assert.deepEqual(
    hairProfileFullSchema.parse({ ...baseProfileInput, brush_type: ["paddle", "paddle"] })
      .brush_type,
    ["paddle"],
  )
  assert.throws(
    () => hairProfileFullSchema.parse({ ...baseProfileInput, brush_type: ["none_regular"] }),
    /Invalid input/,
  )
  assert.throws(
    () => hairProfileFullSchema.parse({ ...baseProfileInput, brush_type: ["paddle", "unknown"] }),
    /Invalid input/,
  )
})

test("brush mechanical stress keeps scored drivers and caps score", () => {
  const contribution = getBrushMechanicalStressContribution(["paddle", "round", "boar_bristle"])

  assert.equal(contribution.score, 2)
  assert.deepEqual(contribution.drivers, ["high_stress_brush"])
})

test("low-tension detangling tools do not add mechanical stress", () => {
  assert.deepEqual(
    getBrushMechanicalStressContribution(["wide_tooth_comb", "detangling", "fingers"]),
    {
      score: 0,
      drivers: [],
    },
  )
  assert.deepEqual(getBrushMechanicalStressContribution([]), {
    score: 0,
    drivers: [],
  })
})

test("boar bristle does not add mechanical damage score or damage drivers", () => {
  assert.deepEqual(getBrushMechanicalStressContribution(["boar_bristle"]), {
    score: 0,
    drivers: [],
  })
})

test("damage assessment keeps boar bristle out of active damage drivers", () => {
  const profile = normalizeRecommendationInput({
    profile: {
      ...baseProfileInput,
      brush_type: ["paddle", "round", "boar_bristle"],
      chemical_treatment: [],
      concerns: [],
      cuticle_condition: "smooth",
      density: null,
      drying_method: null,
      goals: [],
      hair_length: null,
      heat_styling: "never",
      night_protection: null,
      protein_moisture_balance: "stretches_bounces",
      scalp_condition: null,
      scalp_type: null,
      shampoo_frequency: null,
      styling_tools: null,
      towel_material: null,
      towel_technique: "gentle_press",
      uses_heat_protection: false,
    },
    routineInventory: [],
  })
  const damage = buildDamageAssessment(profile)

  assert.equal(damage.mechanicalLevel, "moderate")
  assert.deepEqual(
    damage.activeDamageDrivers.filter((driver) => driver.includes("brush")),
    ["high_stress_brush"],
  )
})

test("duplicate brush values are ignored during normalization and scoring", () => {
  assert.deepEqual(normalizeBrushTypeValues(["paddle", "paddle", "round"]), ["paddle", "round"])
  assert.deepEqual(getBrushMechanicalStressContribution(["paddle", "paddle"]), {
    score: 1,
    drivers: ["high_stress_brush"],
  })
})

test("brush type normalization maps legacy none and drops unknown values", () => {
  assert.deepEqual(normalizeBrushTypeValues("none_regular"), [])
  assert.deepEqual(normalizeBrushTypeValues(["paddle", "unknown"]), ["paddle"])
  assert.equal(normalizeBrushTypeValues("unknown"), null)
})
