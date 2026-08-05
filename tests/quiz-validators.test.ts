import assert from "node:assert/strict"
import test from "node:test"

import { quizAnswersSchema } from "../src/lib/quiz/validators"

function createBaseAnswers() {
  return {
    structure: "wavy",
    thickness: "normal",
    density: "medium",
    hair_length: "medium",
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

test("quiz schema requires density as the third physical hair attribute", () => {
  const answers = createBaseAnswers()
  delete (answers as Partial<typeof answers>).density

  assert.throws(() => quizAnswersSchema.parse(answers))
})

test("quiz schema requires hair length as the fourth physical hair attribute", () => {
  const answers = createBaseAnswers()
  delete (answers as Partial<typeof answers>).hair_length

  assert.throws(() => quizAnswersSchema.parse(answers))
})

test("quiz schema accepts free-text-only concern notes", () => {
  const parsed = quizAnswersSchema.parse({
    ...createBaseAnswers(),
    concerns_other_text: "statische Haare",
  })

  assert.equal(parsed.concerns_other_text, "statische Haare")
})

test("quiz schema accepts all nine shared concerns and rejects duplicates or unknowns", () => {
  const concerns = [
    "dry_lengths",
    "frizz_flyaways",
    "low_shine",
    "lost_shape",
    "low_volume_or_weighed_down",
    "hair_damage",
    "breakage",
    "split_ends",
    "tangling",
  ]
  assert.deepEqual(quizAnswersSchema.parse({ ...createBaseAnswers(), concerns }).concerns, concerns)
  assert.throws(() =>
    quizAnswersSchema.parse({ ...createBaseAnswers(), concerns: [...concerns, "hair_damage"] }),
  )
  assert.throws(() =>
    quizAnswersSchema.parse({ ...createBaseAnswers(), concerns: ["unknown_concern"] }),
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

test("quiz schema accepts multiple non-natural chemical treatment values", () => {
  const parsed = quizAnswersSchema.parse({
    ...createBaseAnswers(),
    treatment: ["dauerwelle", "chemisch_geglaettet"],
  })

  assert.deepEqual(parsed.treatment, ["dauerwelle", "chemisch_geglaettet"])
})

test("quiz schema rejects natur combined with a chemical shape treatment", () => {
  assert.throws(() =>
    quizAnswersSchema.parse({
      ...createBaseAnswers(),
      treatment: ["natur", "chemisch_geglaettet"],
    }),
  )
})

test("quiz schema accepts 50-character concern notes and rejects longer text", () => {
  const accepted = quizAnswersSchema.safeParse({
    ...createBaseAnswers(),
    concerns_other_text: "x".repeat(50),
  })
  const parsed = quizAnswersSchema.safeParse({
    ...createBaseAnswers(),
    concerns_other_text: "x".repeat(51),
  })

  assert.equal(accepted.success, true)
  assert.equal(parsed.success, false)
})

test("quiz schema accepts all eight shared goals and historical stored goal values", () => {
  const parsed = quizAnswersSchema.parse({
    ...createBaseAnswers(),
    goals: [
      "moisture",
      "frizz_surface",
      "shine",
      "shape_definition",
      "volume_balance",
      "strength_ends",
      "scalp_balance",
      "manageability_styling",
    ],
  })

  assert.equal(parsed.goals?.length, 8)
  assert.deepEqual(
    quizAnswersSchema.parse({
      ...createBaseAnswers(),
      goals: ["healthier_hair", "color_protection"],
    }).goals,
    ["healthier_hair", "color_protection"],
  )
  assert.throws(() =>
    quizAnswersSchema.parse({ ...createBaseAnswers(), goals: ["moisture", "moisture"] }),
  )
})

test("quiz schema rejects unknown goal values", () => {
  assert.throws(() =>
    quizAnswersSchema.parse({
      ...createBaseAnswers(),
      goals: ["volume", "unknown_goal"],
    }),
  )
})

test("quiz schema rejects volume + less_volume together", () => {
  assert.throws(() =>
    quizAnswersSchema.parse({
      ...createBaseAnswers(),
      goals: ["volume", "less_volume"],
    }),
  )
})

test("quiz schema rejects duplicate goals", () => {
  assert.throws(() =>
    quizAnswersSchema.parse({
      ...createBaseAnswers(),
      goals: ["volume", "volume"],
    }),
  )
})
