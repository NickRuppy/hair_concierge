import assert from "node:assert/strict"
import test from "node:test"

import {
  resolveVisibleDiagnosticConcerns,
  resolveVisibleDiagnosticGoals,
} from "../src/lib/quiz/diagnostic-input"

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
