import assert from "node:assert/strict"
import test from "node:test"

import { resolveProfileDensityFromQuizAnswers } from "../src/lib/quiz/link-to-profile"

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
