import assert from "node:assert/strict"
import test from "node:test"

import {
  resolveVisibleDiagnosticConcerns,
  resolveVisibleDiagnosticGoals,
} from "../src/lib/quiz/diagnostic-input"
import { adaptLegacyQuizAnswersForAssessment } from "../src/lib/personal-plan-quiz/offer-adapter"
import type { QuizAnswers } from "../src/lib/quiz/types"

test("resumable legacy concerns map onto the current visible cards", () => {
  assert.deepEqual(resolveVisibleDiagnosticConcerns(["frizz", "dryness", "breakage"]), [
    "dry_lengths",
    "frizz_flyaways",
    "breakage",
  ])
})

test("resumable legacy goals map deterministically onto the eight current families", () => {
  assert.deepEqual(
    resolveVisibleDiagnosticGoals([
      "less_frizz",
      "color_protection",
      "healthy_scalp",
      "curl_definition",
      "less_volume",
      "anti_breakage",
    ]),
    [
      "frizz_surface",
      "shine",
      "shape_definition",
      "volume_balance",
      "strength_ends",
      "scalp_balance",
    ],
  )
})

test("historical goal aliases reach the same assessment families as the visible quiz", () => {
  const historicalGoals = ["healthier_hair", "color_protection", "strengthen"]
  const visibleGoals = resolveVisibleDiagnosticGoals(historicalGoals)
  const assessment = adaptLegacyQuizAnswersForAssessment({ goals: historicalGoals } as QuizAnswers)

  assert.deepEqual(visibleGoals, ["shine", "strength_ends"])
  assert.deepEqual(assessment.goals, visibleGoals)
})
