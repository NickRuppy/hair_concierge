import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const quizQuestionSource = readFileSync(
  new URL("../src/components/quiz/quiz-question.tsx", import.meta.url),
  "utf8",
)
const quizConcernsSource = readFileSync(
  new URL("../src/components/quiz/quiz-concerns-question.tsx", import.meta.url),
  "utf8",
)
const quizGoalsSource = readFileSync(
  new URL("../src/components/quiz/quiz-goals.tsx", import.meta.url),
  "utf8",
)
const quizShellSource = readFileSync(new URL("../src/app/quiz/quiz-shell.tsx", import.meta.url), {
  encoding: "utf8",
})

test("legacy quiz multi-select screens do not enforce the retired concern or goal caps in UI", () => {
  assert.doesNotMatch(quizQuestionSource, /question\.maxSelections/)
  assert.doesNotMatch(quizConcernsSource, /Bis zu \{question\.maxSelections\}/)
  assert.doesNotMatch(quizConcernsSource, /localSelection\.length >= question\.maxSelections/)
  assert.doesNotMatch(quizGoalsSource, /MAX_GOALS/)
  assert.doesNotMatch(quizGoalsSource, /selectedGoals\.length >=/)
})

test("legacy quiz shell uses the Personal Plan motion classes for screen transitions", () => {
  assert.match(quizShellSource, /personal-plan-screen-enter/)
  assert.match(quizShellSource, /data-personal-plan-transition-direction/)
})

test("legacy lead capture keeps local recovery state across its animated substeps", () => {
  assert.match(quizShellSource, /key=\{step\}/)
  assert.doesNotMatch(quizShellSource, /key=\{`\$\{step\}:\$\{leadCaptureSubStep\}`\}/)
  assert.match(quizShellSource, /if \(step === 9\) return/)
})
