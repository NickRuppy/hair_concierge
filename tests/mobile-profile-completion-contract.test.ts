import assert from "node:assert/strict"
import test from "node:test"
import {
  missingProfileQuestions,
  mergeMissingProfileAnswers,
} from "../src/lib/mobile/profile-completion-contract"
const profile = {
  hair_texture: "wavy",
  thickness: "fine",
  density: "medium",
  hair_length: "long",
  cuticle_condition: "rough",
  protein_moisture_balance: "stretches_bounces",
  scalp_type: "balanced",
  scalp_condition: null,
  chemical_treatment: ["natural"],
  concerns: [],
  goals: ["less_volume"],
  desired_volume: false,
}
test("M1/M2 missing questions derive raw absence; complete profile asks nothing", () => {
  assert.deepEqual(missingProfileQuestions(null), [
    "structure",
    "thickness",
    "density",
    "hair_length",
    "fingertest",
    "pulltest",
    "treatment",
    "scalp_type",
    "concerns",
    "goals",
  ])
  assert.deepEqual(missingProfileQuestions(profile), [])
})
test("M3/M4/M6 length-only preserves explicit scalp none and empty concerns", () => {
  assert.deepEqual(missingProfileQuestions({ ...profile, hair_length: null }), ["hair_length"])
  const merged = mergeMissingProfileAnswers(
    { ...profile, hair_length: null },
    {
      hair_length: "short",
      thickness: "coarse",
      concerns: ["dryness"],
      has_scalp_issue: true,
      scalp_condition: "gereizt",
    },
  )
  assert.deepEqual(merged.patch, { hair_length: "short" })
  assert.equal(merged.answers.thickness, "fine")
  assert.deepEqual(merged.answers.concerns, [])
  assert.equal(merged.answers.has_scalp_issue, false)
})
test("M5/M7/M8/M10 absent scalp, empty required selections and invalid raw values stay missing", () => {
  assert.deepEqual(missingProfileQuestions({ ...profile, scalp_type: null }), ["scalp_type"])
  assert.deepEqual(missingProfileQuestions({ ...profile, chemical_treatment: [], goals: [] }), [
    "treatment",
    "goals",
  ])
  assert.deepEqual(missingProfileQuestions({ ...profile, thickness: "garbage" }), ["thickness"])
})
test("M9/M11 partial completion cannot change existing fields and must provide all missing answers", () => {
  assert.throws(() => mergeMissingProfileAnswers({ ...profile, hair_length: null }, {}))
  const merged = mergeMissingProfileAnswers(
    { ...profile, scalp_type: null },
    { scalp_type: "trocken", has_scalp_issue: false },
  )
  assert.deepEqual(merged.patch, { scalp_type: "dry", scalp_condition: null })
  assert.throws(() =>
    mergeMissingProfileAnswers(
      { ...profile, scalp_type: null },
      { scalp_type: "trocken", has_scalp_issue: true },
    ),
  )
  assert.deepEqual(mergeMissingProfileAnswers(profile, { thickness: "coarse" }).patch, {})
})
