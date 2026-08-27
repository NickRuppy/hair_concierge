import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"

import { QUIZ_RESULT_CTA } from "../src/lib/quiz/result-cta"

test("the result CTA sends the reader into routine setup", () => {
  assert.equal(QUIZ_RESULT_CTA.lead, "Als Nächstes: dein persönlicher Plan")
  assert.equal(QUIZ_RESULT_CTA.label, "MEINE ROUTINE STARTEN")
  assert.equal(QUIZ_RESULT_CTA.subline, "Mit passenden Produkten, Reihenfolge und Anwendung.")
})

test("the retired three-step unlock CTA is gone, not merely unreachable", () => {
  const source = readFileSync(new URL("../src/lib/quiz/result-cta.ts", import.meta.url), "utf8")

  assert.doesNotMatch(source, /PLAN FREISCHALTEN/)
  assert.doesNotMatch(source, /Noch 3 kurze Schritte/)
  assert.doesNotMatch(source, /Profil speichern/)
  // No branch is left to pick between: there is exactly one CTA.
  assert.doesNotMatch(source, /canGoStraightToRoutine/)
})
