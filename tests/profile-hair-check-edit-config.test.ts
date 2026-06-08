import assert from "node:assert/strict"
import test from "node:test"

import {
  HAIR_CHECK_EDIT_FIELDS,
  getHairCheckEditConfig,
  getHairCheckEditHref,
  isHairCheckEditField,
  resolveHairCheckReturnTo,
  toggleChemicalTreatmentValue,
  toggleConcernValue,
} from "../src/lib/profile/hair-check-edit-config"

test("Hair-Check edit fields are locked to the protected profile fields", () => {
  assert.deepEqual(HAIR_CHECK_EDIT_FIELDS, [
    "hair_texture",
    "thickness",
    "density",
    "cuticle_condition",
    "protein_moisture_balance",
    "chemical_treatment",
    "scalp",
    "concerns",
  ])
})

test("Hair-Check edit field guard accepts known fields only", () => {
  assert.equal(isHairCheckEditField("thickness"), true)
  assert.equal(isHairCheckEditField("scalp"), true)
  assert.equal(isHairCheckEditField("unknown"), false)
})

test("Hair-Check edit href includes the field and encoded return target", () => {
  assert.equal(
    getHairCheckEditHref("thickness"),
    "/profile/edit/hair-check?field=thickness&returnTo=%2Fprofile",
  )
})

test("Hair-Check return target resolver accepts local profile paths", () => {
  assert.equal(resolveHairCheckReturnTo("/profile"), "/profile")
  assert.equal(resolveHairCheckReturnTo("/profile?tab=hair"), "/profile?tab=hair")
})

test("Hair-Check return target resolver rejects unsafe targets", () => {
  for (const value of [
    "https://evil.test",
    "//evil.test",
    null,
    undefined,
    "/profile\\evil",
    "/profile tab",
    "mailto:evil@test",
  ]) {
    assert.equal(resolveHairCheckReturnTo(value), "/profile")
  }
})

test("scalp edit config exposes both renderable scalp groups", () => {
  const config = getHairCheckEditConfig("scalp")

  assert.equal(config.field, "scalp")
  assert.equal(config.mode, "scalp")
  assert.deepEqual(config.profileKeys, ["scalp_type", "scalp_condition"])
  assert.match(config.title, /Kopfhaut/i)
  assert.equal("options" in config, false)
  assert.equal(config.optionGroups.length, 2)
  assert.deepEqual(
    config.optionGroups.map((group) => group.profileKey),
    ["scalp_type", "scalp_condition"],
  )
  assert.ok(config.optionGroups[0].options.some((option) => option.value === "oily"))
  assert.ok(config.optionGroups[1].options.some((option) => option.value === "dandruff"))
})

test("thickness options are ready for QuizOptionCard rendering", () => {
  const firstOption = getHairCheckEditConfig("thickness").options[0]

  assert.equal(firstOption.value, "fine")
  assert.equal(typeof firstOption.label, "string")
  assert.equal(typeof firstOption.description, "string")
  assert.equal(firstOption.icon, "hair-fine")
})

test("chemical treatment toggle keeps natural exclusive", () => {
  assert.deepEqual(toggleChemicalTreatmentValue([], "natural"), ["natural"])
  assert.deepEqual(toggleChemicalTreatmentValue(["natural"], "colored"), ["colored"])
  assert.deepEqual(toggleChemicalTreatmentValue(["colored", "bleached"], "natural"), ["natural"])
})

test("concern toggle removes selected values and respects max selection", () => {
  assert.deepEqual(toggleConcernValue(["dryness"], "dryness"), [])
  assert.deepEqual(toggleConcernValue(["dryness", "frizz"], "tangling"), [
    "dryness",
    "frizz",
    "tangling",
  ])
  assert.deepEqual(toggleConcernValue(["dryness", "frizz", "tangling"], "breakage"), [
    "dryness",
    "frizz",
    "tangling",
  ])
})
