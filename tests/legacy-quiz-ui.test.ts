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

test("legacy quiz multi-select screens do not enforce the retired concern or goal caps in UI", () => {
  assert.doesNotMatch(quizQuestionSource, /question\.maxSelections/)
  assert.doesNotMatch(quizConcernsSource, /Bis zu \{question\.maxSelections\}/)
  assert.doesNotMatch(quizConcernsSource, /localSelection\.length >= question\.maxSelections/)
  assert.doesNotMatch(quizGoalsSource, /MAX_GOALS/)
  assert.doesNotMatch(quizGoalsSource, /selectedGoals\.length >=/)
})

test("legacy concerns reuse the Personal Plan concern options while retaining free text", () => {
  assert.match(quizConcernsSource, /getConcernOptions\(hairTexture \?\? undefined\)/)
  assert.match(quizConcernsSource, /Was beschäftigt dich gerade\?/)
  assert.match(quizConcernsSource, /label="Etwas anderes"/)
  assert.match(quizConcernsSource, /maxLength=\{50\}/)
  assert.doesNotMatch(quizConcernsSource, /Notiz entfernen/)
  assert.doesNotMatch(quizConcernsSource, /question\.options\.map/)
  assert.doesNotMatch(quizConcernsSource, /Nichts davon/)
})
