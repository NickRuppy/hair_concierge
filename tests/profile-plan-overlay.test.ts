import assert from "node:assert/strict"
import test from "node:test"

import { PROFILE_FIELD_CONFIG } from "../src/lib/profile/section-config"
import type { HairProfile } from "../src/lib/types"

function getField(key: string) {
  const field = PROFILE_FIELD_CONFIG.find((entry) => entry.key === key)
  assert.ok(field, `expected field config for key "${key}"`)
  return field
}

const towelMaterialField = getField("towel_material")
const stylingToolsField = getField("styling_tools")
const nightProtectionField = getField("night_protection")
const dryingMethodField = getField("drying_method")

test("towel material falls back to plan answer", () => {
  const value = towelMaterialField.getValue(null, { towel: { material: "frottee" } })
  assert.equal(value, "Frottee-Handtuch")
})

test("legacy value wins over plan answer", () => {
  const value = towelMaterialField.getValue({ towel_material: "mikrofaser" } as HairProfile, {
    towel: { material: "frottee" },
  })
  assert.equal(value, "Mikrofaser-Handtuch")
})

test("empty additionalHeatTools reads as answered none", () => {
  assert.equal(stylingToolsField.getValue(null, { additionalHeatTools: [] }), "Keine Hitzetools")
})

test("empty nightProtection reads as answered none", () => {
  assert.equal(nightProtectionField.getValue(null, { nightProtection: [] }), "Nichts davon")
})

test("drying routes join labels", () => {
  assert.equal(dryingMethodField.getValue(null, { dryingRoutes: ["air_dry"] }), "Lufttrocknen")
})

test("unanswered plan leaves value null", () => {
  assert.equal(towelMaterialField.getValue(null, null), null)
  assert.equal(towelMaterialField.getValue(null, {}), null)
  assert.equal(stylingToolsField.getValue(null, {}), null)
  assert.equal(nightProtectionField.getValue(null, {}), null)
  assert.equal(dryingMethodField.getValue(null, {}), null)
})

test("towel technique falls back to plan answer", () => {
  const towelTechniqueField = getField("towel_technique")
  assert.equal(
    towelTechniqueField.getValue(null, {
      towel: { material: "frottee", technique: "gentle_press" },
    }),
    "Sanft ausdrücken / scrunchen",
  )
})

test("plan additional heat tools map to Alltag/Styling labels", () => {
  assert.deepEqual(stylingToolsField.getValue(null, { additionalHeatTools: ["straightener"] }), [
    "Glätteisen",
  ])
})

test("plan night protection maps to existing labels", () => {
  assert.deepEqual(nightProtectionField.getValue(null, { nightProtection: ["pineapple"] }), [
    "Pineapple",
  ])
})
