import assert from "node:assert/strict"
import test from "node:test"

import { quizAnswersSchema } from "../src/lib/quiz/validators"

function createBaseAnswers() {
  return {
    structure: "wavy",
    thickness: "normal",
    fingertest: "leicht_uneben",
    pulltest: "stretches_stays",
    scalp_type: "trocken",
    has_scalp_issue: false,
    concerns: [],
    treatment: ["gefaerbt"],
  }
}

test("quiz schema accepts an empty concern array with a negative scalp gate", () => {
  const parsed = quizAnswersSchema.parse(createBaseAnswers())

  assert.deepEqual(parsed.concerns, [])
  assert.equal(parsed.has_scalp_issue, false)
  assert.equal(parsed.scalp_condition, undefined)
})

test("quiz schema rejects more than three concerns", () => {
  assert.throws(() =>
    quizAnswersSchema.parse({
      ...createBaseAnswers(),
      concerns: ["hair_damage", "split_ends", "breakage", "dryness"],
    }),
  )
})

test("quiz schema requires a scalp condition when the user reports an active issue", () => {
  assert.throws(() =>
    quizAnswersSchema.parse({
      ...createBaseAnswers(),
      has_scalp_issue: true,
    }),
  )
})

test("quiz schema rejects a scalp condition when the scalp gate is negative", () => {
  assert.throws(() =>
    quizAnswersSchema.parse({
      ...createBaseAnswers(),
      scalp_condition: "gereizt",
    }),
  )
})

test("quiz schema does not use colored as a concern code", () => {
  assert.throws(() =>
    quizAnswersSchema.parse({
      ...createBaseAnswers(),
      concerns: ["colored"],
    }),
  )
})
