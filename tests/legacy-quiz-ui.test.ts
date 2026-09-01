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
const quizProgressSource = readFileSync(
  new URL("../src/components/quiz/quiz-progress-bar.tsx", import.meta.url),
  "utf8",
)
const organicLandingSource = readFileSync(
  new URL("../src/funnels/landing/organic-refresh.tsx", import.meta.url),
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

test("legacy quiz shell uses the Personal Plan motion classes for screen transitions", () => {
  assert.match(quizShellSource, /personal-plan-screen-enter/)
  assert.match(quizShellSource, /personal-plan-screen-exit/)
  assert.match(quizShellSource, /data-personal-plan-transition-direction/)
  assert.match(quizShellSource, /data-personal-plan-transition-layer="outgoing"/)
})

test("legacy lead capture keeps local recovery state across its animated substeps", () => {
  assert.match(quizShellSource, /ref=\{activeLayerRef\}/)
  assert.doesNotMatch(quizShellSource, /key=\{step\}/)
  assert.doesNotMatch(quizShellSource, /key=\{`\$\{step\}:\$\{leadCaptureSubStep\}`\}/)
  assert.match(quizShellSource, /if \(step === 9\) return/)
})

test("legacy progress animates from the previous question without remounting at its target width", () => {
  assert.match(quizShellSource, /QuizProgressTransitionProvider/)
  assert.match(quizProgressSource, /requestAnimationFrame/)
  assert.match(quizProgressSource, /transition-\[width\] duration-500 ease-out/)
})

test("organic landing profile card uses a real canonical hair portrait", () => {
  assert.match(organicLandingSource, /profile-summary\/wavy-medium\.webp/)
  assert.match(organicLandingSource, /Beispielprofil mit welligem Haar/)
})
