import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import {
  getQuizQuestionNumber,
  getRemainingQuizQuestions,
  quizQuestions,
  QUIZ_TOTAL_QUESTIONS,
} from "../src/lib/quiz/questions"

test("quiz motivation copy matches the visible question count", () => {
  const firstQuestion = quizQuestions.find((question) => question.questionNumber === 1)
  const elasticityQuestion = quizQuestions.find((question) => question.questionNumber === 6)
  const problemsQuestion = quizQuestions.find((question) => question.questionNumber === 9)

  assert.equal(firstQuestion?.motivation, `Super — noch ${QUIZ_TOTAL_QUESTIONS - 1} kurze Fragen.`)
  assert.equal(
    elasticityQuestion?.motivation,
    `Gut gemacht — noch ${QUIZ_TOTAL_QUESTIONS - 6} Fragen.`,
  )
  assert.equal(problemsQuestion?.motivation, "Fast geschafft — eine Frage noch.")
})

test("quiz question sequence drives special step counters", () => {
  assert.equal(QUIZ_TOTAL_QUESTIONS, 10)
  assert.equal(getQuizQuestionNumber(6), 8)
  assert.equal(getRemainingQuizQuestions(6), 2)
  assert.equal(getQuizQuestionNumber(12), 10)
  assert.equal(getRemainingQuizQuestions(12), 0)
})

test("goal cards expose selection state without repeated status pills", async () => {
  const source = await readFile("src/components/quiz/quiz-goals.tsx", "utf8")

  assert.match(source, /aria-pressed=\{isSelected\}/)
  assert.doesNotMatch(source, />Ziel</)
  assert.doesNotMatch(source, />Ausgewählt</)
})
