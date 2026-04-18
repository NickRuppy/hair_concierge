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

test("goals are passed through when valid (sorted to canonical GOALS order)", () => {
  const normalized = normalizeStoredQuizAnswers({
    structure: "curly",
    goals: ["volume", "shine", "less_frizz"],
  })

  // GOALS index: volume=0, less_frizz=2, shine=6
  assert.deepEqual(normalized.goals, ["volume", "less_frizz", "shine"])
})

test("two goal lists with the same items in different order normalize equal", () => {
  const a = normalizeStoredQuizAnswers({ goals: ["shine", "volume", "moisture"] })
  const b = normalizeStoredQuizAnswers({ goals: ["moisture", "volume", "shine"] })
  assert.deepEqual(a.goals, b.goals)
})

test("invalid goal values are filtered out", () => {
  const normalized = normalizeStoredQuizAnswers({
    goals: ["volume", "not_a_goal", "shine", 42 as unknown as string],
  })

  // volume=0, shine=6
  assert.deepEqual(normalized.goals, ["volume", "shine"])
})

test("goals are capped at 5 (first-seen wins, then sorted canonically)", () => {
  const normalized = normalizeStoredQuizAnswers({
    goals: [
      "volume",
      "shine",
      "less_frizz",
      "moisture",
      "healthy_scalp",
      "strengthen",
      "anti_breakage",
    ],
  })

  assert.equal(normalized.goals?.length, 5)
  // First 5 input items kept (strengthen + anti_breakage dropped), then re-sorted by GOALS index
  assert.deepEqual(normalized.goals, ["volume", "less_frizz", "moisture", "healthy_scalp", "shine"])
})

test("goals drop the conflicting volume/less_volume pair (keeps first occurrence)", () => {
  const normalized = normalizeStoredQuizAnswers({
    goals: ["volume", "shine", "less_volume"],
  })

  // less_volume blocked because volume seen first; output sorted: volume=0, shine=6
  assert.deepEqual(normalized.goals, ["volume", "shine"])
})

test("missing or empty goals normalize to undefined", () => {
  assert.equal(normalizeStoredQuizAnswers({}).goals, undefined)
  assert.equal(normalizeStoredQuizAnswers({ goals: [] }).goals, undefined)
  assert.equal(normalizeStoredQuizAnswers({ goals: ["nope"] }).goals, undefined)
})

test("canonicalization carries goals through in canonical GOALS order", () => {
  const canonical = canonicalizeQuizAnswers({
    structure: "wavy",
    thickness: "normal",
    fingertest: "glatt",
    pulltest: "stretches_bounces",
    scalp_type: "ausgeglichen",
    scalp_condition: "keine",
    treatment: ["natur"],
    goals: ["moisture", "less_frizz"],
  })

  // less_frizz=2, moisture=4
  assert.deepEqual(canonical.goals, ["less_frizz", "moisture"])
})
