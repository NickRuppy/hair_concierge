import assert from "node:assert/strict"
import test from "node:test"

import {
  canonicalizeQuizAnswers,
  normalizeStoredQuizAnswers,
  toggleTreatmentSelection,
} from "../src/lib/quiz/normalization"

test("natur stays exclusive in treatment selection", () => {
  assert.deepEqual(toggleTreatmentSelection([], "natur"), ["natur"])
  assert.deepEqual(
    toggleTreatmentSelection(["natur"], "gefaerbt"),
    ["gefaerbt"]
  )
  assert.deepEqual(
    toggleTreatmentSelection(["gefaerbt", "blondiert"], "natur"),
    ["natur"]
  )
})

test("colored and bleached can be combined", () => {
  const withColor = toggleTreatmentSelection([], "gefaerbt")
  const withBleach = toggleTreatmentSelection(withColor, "blondiert")

  assert.deepEqual(withBleach, ["gefaerbt", "blondiert"])
})

test("legacy pulltest values are normalized", () => {
  const normalized = normalizeStoredQuizAnswers({
    structure: "curly",
    thickness: "normal",
    fingertest: "leicht_uneben",
    pulltest: "ueberdehnt",
    scalp_type: "trocken",
    scalp_condition: "gereizt",
    treatment: ["gefaerbt"],
  })

  assert.equal(normalized.pulltest, "stretches_stays")
})

test("legacy scalp values still map to type and condition", () => {
  const normalized = normalizeStoredQuizAnswers({
    structure: "wavy",
    thickness: "fine",
    fingertest: "glatt",
    pulltest: "snaps",
    scalp: "fettig_schuppen",
    treatment: ["natur"],
  })

  assert.equal(normalized.scalp_type, "fettig")
  assert.equal(normalized.scalp_condition, "schuppen")
})

test("canonicalization drops invalid natur conflicts", () => {
  const canonical = canonicalizeQuizAnswers({
    structure: "straight",
    thickness: "fine",
    fingertest: "glatt",
    pulltest: "stretches_bounces",
    scalp_type: "ausgeglichen",
    scalp_condition: "keine",
    treatment: ["natur", "blondiert", "gefaerbt"],
  })

  assert.deepEqual(canonical.treatment, ["gefaerbt", "blondiert"])
})
