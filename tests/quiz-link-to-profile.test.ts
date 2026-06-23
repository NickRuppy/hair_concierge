import assert from "node:assert/strict"
import test from "node:test"

import * as linkToProfile from "../src/lib/quiz/link-to-profile"

const { resolveProfileDensityFromQuizAnswers } = linkToProfile

test("linking uses the explicit quiz density when present", () => {
  assert.equal(resolveProfileDensityFromQuizAnswers({ density: "high" }), "high")
})

test("linking backfills otherwise complete legacy quiz answers to medium density", () => {
  assert.equal(
    resolveProfileDensityFromQuizAnswers({
      structure: "wavy",
      thickness: "normal",
      fingertest: "leicht_uneben",
      pulltest: "stretches_stays",
      scalp_type: "trocken",
      has_scalp_issue: false,
      concerns: [],
      treatment: ["gefaerbt"],
    }),
    "medium",
  )
})

test("linking does not invent density for sparse or partial answers", () => {
  assert.equal(
    resolveProfileDensityFromQuizAnswers({
      structure: "wavy",
      thickness: "normal",
    }),
    undefined,
  )
})

test("profile update data includes quiz hair length when present", () => {
  assert.equal(
    linkToProfile.buildProfileDataFromQuizAnswers({
      structure: "wavy",
      thickness: "normal",
      density: "medium",
      hair_length: "long",
    }).hair_length,
    "long",
  )
})

test("profile update data maps expanded quiz treatment values to canonical profile values", () => {
  assert.deepEqual(
    linkToProfile.buildProfileDataFromQuizAnswers({
      treatment: ["dauerwelle", "chemisch_geglaettet"],
    }).chemical_treatment,
    ["permed", "chemically_straightened"],
  )
})
