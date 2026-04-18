import assert from "node:assert/strict"
import test from "node:test"

import {
  canonicalizeQuizAnswers,
  normalizeStoredQuizAnswers,
  toggleConcernSelection,
  toggleTreatmentSelection,
} from "../src/lib/quiz/normalization"

test("natur stays exclusive in treatment selection", () => {
  assert.deepEqual(toggleTreatmentSelection([], "natur"), ["natur"])
  assert.deepEqual(toggleTreatmentSelection(["natur"], "gefaerbt"), ["gefaerbt"])
  assert.deepEqual(toggleTreatmentSelection(["gefaerbt", "blondiert"], "natur"), ["natur"])
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
  assert.equal(normalized.has_scalp_issue, true)
  assert.equal(normalized.scalp_condition, "schuppen")
})

test("legacy no-issue scalp answers normalize to a negative scalp gate", () => {
  const normalized = normalizeStoredQuizAnswers({
    structure: "straight",
    thickness: "normal",
    fingertest: "glatt",
    pulltest: "stretches_bounces",
    scalp_type: "ausgeglichen",
    scalp_condition: "keine",
    treatment: ["natur"],
  })

  assert.equal(normalized.scalp_type, "ausgeglichen")
  assert.equal(normalized.has_scalp_issue, false)
  assert.equal(normalized.scalp_condition, undefined)
})

test("stored answers without the new concern or scalp gate fields backfill clean defaults", () => {
  const normalized = normalizeStoredQuizAnswers({
    structure: "straight",
    thickness: "normal",
    fingertest: "glatt",
    pulltest: "stretches_bounces",
    scalp_type: "ausgeglichen",
    treatment: ["natur"],
  })

  assert.equal(normalized.has_scalp_issue, false)
  assert.deepEqual(normalized.concerns, [])
})

test("free-text concern notes are trimmed and empty strings are removed", () => {
  const normalized = normalizeStoredQuizAnswers({
    concerns: [],
    concerns_other_text: "  statische Haare  ",
  })

  assert.equal(normalized.concerns_other_text, "statische Haare")
})

test("blank free-text concern notes normalize to undefined", () => {
  const normalized = normalizeStoredQuizAnswers({
    concerns: [],
    concerns_other_text: "   ",
  })

  assert.equal(normalized.concerns_other_text, undefined)
})

test("none stays exclusive and concern selection caps at three entries", () => {
  let selected = toggleConcernSelection([], "hair_damage")
  selected = toggleConcernSelection(selected, "split_ends")
  selected = toggleConcernSelection(selected, "breakage")
  selected = toggleConcernSelection(selected, "dryness")

  assert.deepEqual(selected, ["hair_damage", "split_ends", "breakage"])
  assert.deepEqual(toggleConcernSelection(selected, "none"), [])
})

test("canonicalization drops invalid natur conflicts", () => {
  const canonical = canonicalizeQuizAnswers({
    structure: "straight",
    thickness: "fine",
    fingertest: "glatt",
    pulltest: "stretches_bounces",
    scalp_type: "ausgeglichen",
    has_scalp_issue: false,
    scalp_condition: "gereizt",
    concerns: ["frizz", "breakage", "dryness"],
    treatment: ["natur", "blondiert", "gefaerbt"],
  })

  assert.equal(canonical.has_scalp_issue, false)
  assert.equal(canonical.scalp_condition, undefined)
  assert.deepEqual(canonical.concerns, ["breakage", "dryness", "frizz"])
  assert.equal(canonical.concerns_other_text, undefined)
  assert.deepEqual(canonical.treatment, ["gefaerbt", "blondiert"])
})
