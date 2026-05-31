import assert from "node:assert/strict"
import test from "node:test"
import { quizQuestions, QUIZ_TOTAL_QUESTIONS } from "../src/lib/quiz/questions"

test("quiz motivation copy matches the visible question count", () => {
  const firstQuestion = quizQuestions.find((question) => question.questionNumber === 1)
  const fifthQuestion = quizQuestions.find((question) => question.questionNumber === 5)
  const problemsQuestion = quizQuestions.find((question) => question.questionNumber === 8)

  assert.equal(firstQuestion?.motivation, `Super — noch ${QUIZ_TOTAL_QUESTIONS - 1} kurze Fragen.`)
  assert.equal(fifthQuestion?.motivation, `Gut gemacht — noch ${QUIZ_TOTAL_QUESTIONS - 5} Fragen.`)
  assert.equal(problemsQuestion?.motivation, "Fast geschafft — eine Frage noch.")
})
