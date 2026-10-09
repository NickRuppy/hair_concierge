import assert from "node:assert/strict"
import test from "node:test"

import { QUIZ_RESULT_CTA } from "../src/lib/quiz/result-cta"

test("the result CTA sends the reader into routine setup", () => {
  assert.equal(QUIZ_RESULT_CTA.lead, "Als Nächstes: dein persönlicher Plan")
  assert.equal(QUIZ_RESULT_CTA.label, "MEINE ROUTINE STARTEN")
  assert.equal(QUIZ_RESULT_CTA.subline, "Mit passenden Produkten, Reihenfolge und Anwendung.")
})
