import assert from "node:assert/strict"
import test from "node:test"

import {
  CHEMICAL_TREATMENT_LABELS,
  CHEMICAL_TREATMENTS,
} from "../src/lib/vocabulary/profile-labels"

test("chemical treatment vocabulary includes the expanded canonical profile values", () => {
  assert.deepEqual(CHEMICAL_TREATMENTS, [
    "natural",
    "colored",
    "bleached",
    "permed",
    "chemically_straightened",
  ])
})

test("chemical treatment labels use the approved German wording", () => {
  assert.equal(CHEMICAL_TREATMENT_LABELS.natural, "Naturhaar")
  assert.equal(CHEMICAL_TREATMENT_LABELS.colored, "Gefärbt / getönt")
  assert.equal(CHEMICAL_TREATMENT_LABELS.bleached, "Blondiert / aufgehellt")
  assert.equal(CHEMICAL_TREATMENT_LABELS.permed, "Dauerwelle / Volumenwelle")
  assert.equal(CHEMICAL_TREATMENT_LABELS.chemically_straightened, "Chemisch geglättet")
})

test("chemical treatment vocabulary does not expose an other chemical bucket", () => {
  assert.equal("other_chemical" in CHEMICAL_TREATMENT_LABELS, false)
})
