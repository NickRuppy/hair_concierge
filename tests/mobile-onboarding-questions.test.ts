import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { mobileEditQuestions } from "../src/lib/mobile/profile-edit-contract"
import type { QuizAnswers } from "../src/lib/quiz/types"

test("offline onboarding metadata follows canonical empty-answer quiz without personal data", () => {
  const payload = JSON.parse(
    readFileSync("ios/Chaarlie/Resources/onboarding-questions-v1.json", "utf8"),
  )
  assert.deepEqual(Object.keys(payload).sort(), ["questions", "version"])
  assert.equal(payload.version, 1)
  assert.deepEqual(payload.questions, mobileEditQuestions({} as QuizAnswers))
  assert.deepEqual(
    payload.questions.map((q: { id: string }) => q.id),
    [
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
    ],
  )
  for (const id of ["goals", "concerns"]) {
    const q = payload.questions.find((q: { id: string }) => q.id === id)
    assert.deepEqual(Object.keys(q.optionsByTexture).sort(), ["coily", "curly", "straight", "wavy"])
  }
})
