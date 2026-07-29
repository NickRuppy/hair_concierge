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

test("personal-plan canonical diagnostics project every required onboarding field", () => {
  assert.deepEqual(
    linkToProfile.buildProfileDataFromPersonalPlanCanonicalProfile({
      structure: "curly",
      thickness: "fine",
      density: "high",
      hair_length: "long",
      fingertest: "leicht_uneben",
      pulltest: "stretches_stays",
      scalp_type: "trocken",
      has_scalp_issue: true,
      scalp_condition: "gereizt",
      concerns: ["dryness", "frizz"],
      treatment: ["gefaerbt"],
      goals: ["less_frizz", "moisture"],
    }),
    {
      hair_texture: "curly",
      thickness: "fine",
      density: "high",
      hair_length: "long",
      cuticle_condition: "slightly_rough",
      protein_moisture_balance: "stretches_stays",
      scalp_type: "dry",
      scalp_condition: "irritated",
      concerns: ["dryness", "frizz"],
      chemical_treatment: ["colored"],
      goals: ["less_frizz", "moisture"],
    },
  )
})

test("personal-plan projection rejects incomplete canonical diagnostics", () => {
  assert.throws(
    () =>
      linkToProfile.buildProfileDataFromPersonalPlanCanonicalProfile({
        structure: "straight",
        thickness: "normal",
      }),
    /incomplete canonical diagnostics/,
  )
})
