import assert from "node:assert/strict"
import test from "node:test"

import {
  getChemicalTreatmentDamageDrivers,
  getChemicalTreatmentDamageWeight,
  hasActiveChemicalTreatment,
  hasBleachTreatment,
  hasColorOrBleachTreatment,
  hasShapeChangingTreatment,
} from "../src/lib/profile/chemical-treatment"

test("active chemical treatment helper includes shape-changing treatments but excludes natural", () => {
  assert.equal(hasActiveChemicalTreatment(["permed"]), true)
  assert.equal(hasActiveChemicalTreatment(["chemically_straightened"]), true)
  assert.equal(hasActiveChemicalTreatment(["natural"]), false)
  assert.equal(hasActiveChemicalTreatment([]), false)
})

test("color and bleach helpers stay separate from shape-changing treatments", () => {
  assert.equal(hasColorOrBleachTreatment(["permed", "chemically_straightened"]), false)
  assert.equal(hasColorOrBleachTreatment(["colored"]), true)
  assert.equal(hasColorOrBleachTreatment(["bleached"]), true)
  assert.equal(hasBleachTreatment(["bleached"]), true)
  assert.equal(hasBleachTreatment(["colored", "permed"]), false)
})

test("shape-changing helper identifies perm and chemical straightening", () => {
  assert.equal(hasShapeChangingTreatment(["permed"]), true)
  assert.equal(hasShapeChangingTreatment(["chemically_straightened"]), true)
  assert.equal(hasShapeChangingTreatment(["colored", "bleached"]), false)
})

test("chemical treatment damage weight uses capped stress tiers", () => {
  assert.equal(getChemicalTreatmentDamageWeight(["natural"]), 0)
  assert.equal(getChemicalTreatmentDamageWeight(["colored"]), 2)
  assert.equal(getChemicalTreatmentDamageWeight(["permed"]), 2)
  assert.equal(getChemicalTreatmentDamageWeight(["chemically_straightened"]), 3)
  assert.equal(getChemicalTreatmentDamageWeight(["colored", "permed"]), 3)
  assert.equal(getChemicalTreatmentDamageWeight(["permed", "chemically_straightened"]), 3)
  assert.equal(getChemicalTreatmentDamageWeight(["bleached", "chemically_straightened"]), 4)
})

test("chemical treatment drivers accumulate independently from capped weight", () => {
  assert.deepEqual(
    getChemicalTreatmentDamageDrivers(["bleached", "colored", "permed", "chemically_straightened"]),
    ["bleached_hair", "colored_hair", "permed_hair", "chemically_straightened_hair"],
  )
})
