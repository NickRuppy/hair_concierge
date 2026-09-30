import assert from "node:assert/strict"
import test from "node:test"
import {
  mobileEditQuestions,
  mobileEditProfilePatch,
  profileEditRequestSchema,
} from "../src/lib/mobile/profile-edit-contract"
const answers = {
  structure: "wavy",
  thickness: "fine",
  density: "medium",
  hair_length: "long" as const,
  fingertest: "rau",
  pulltest: "stretches_bounces",
  scalp_type: "ausgeglichen",
  has_scalp_issue: false,
  treatment: ["natur"],
  concerns: ["dryness" as const],
  goals: ["less_volume" as const],
  concerns_other_text: "Meine Spitzen",
}
const request = {
  expectedProfileRevision: "2",
  requestId: "11111111-1111-4111-8111-111111111111",
  answers,
}
test("edit contract rejects partial answers, forged identity, invalid revision, duplicate/conflicting choices", () => {
  assert.equal(profileEditRequestSchema.safeParse(request).success, true)
  for (const body of [
    { ...request, userId: "other" },
    { ...request, requestId: "not-uuid" },
    { ...request, expectedProfileRevision: "-2" },
    { ...request, answers: { ...answers, goals: undefined } },
    { ...request, answers: { ...answers, hair_length: undefined } },
    { ...request, answers: { ...answers, treatment: ["natur", "blondiert"] } },
    { ...request, answers: { ...answers, goals: ["volume", "less_volume"] } },
    { ...request, answers: { ...answers, has_scalp_issue: true } },
  ])
    assert.equal(profileEditRequestSchema.safeParse(body).success, false, JSON.stringify(body))
})
test("all ten regular groups preserve saved legacy selections without collapsing their meaning", () => {
  const questions = mobileEditQuestions(answers) as {
    id: string
    options: { value: string; label: string }[]
    conditionOptions?: unknown[]
  }[]
  assert.deepEqual(
    questions.map((q) => q.id),
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
  assert.ok(
    questions
      .find((q) => q.id === "goals")!
      .options.some((o) => o.value === "less_volume" && o.label.includes("Volumen")),
  )
  assert.ok(questions.find((q) => q.id === "concerns")!.options.some((o) => o.value === "dryness"))
  assert.equal(questions[7].conditionOptions!.length, 3)
  assert.equal(new Set(questions[9].options.map((o) => o.value)).size, questions[9].options.length)
})
test("native diagnostic patch projects shared enums while leaving unrelated lifestyle data out", () => {
  assert.deepEqual(mobileEditProfilePatch(answers), {
    hair_texture: "wavy",
    thickness: "fine",
    density: "medium",
    hair_length: "long",
    cuticle_condition: "rough",
    protein_moisture_balance: "stretches_bounces",
    scalp_type: "balanced",
    scalp_condition: null,
    chemical_treatment: ["natural"],
    concerns: ["dryness"],
    goals: ["less_volume"],
    desired_volume: "less",
  })
})

test("regular quiz allows all current diagnostic goals and preserves exact shared fixture metadata", async () => {
  const { readFile } = await import("node:fs/promises")
  const fixture = JSON.parse(
    await readFile(new URL("./fixtures/mobile/profile-edit-v1.json", import.meta.url), "utf8"),
  )
  assert.deepEqual(mobileEditQuestions(fixture.answers), fixture.questions)
  assert.equal(
    profileEditRequestSchema.safeParse({
      ...request,
      answers: {
        ...answers,
        goals: [
          "moisture",
          "frizz_surface",
          "shine",
          "strength_ends",
          "scalp_balance",
          "manageability_styling",
          "shape_definition",
          "volume_balance",
        ],
      },
    }).success,
    true,
  )
  const questions = mobileEditQuestions(answers)
  assert.notEqual(
    questions[9].optionsByTexture!.straight.find((o) => o.value === "shape_definition")!.label,
    questions[9].optionsByTexture!.curly.find((o) => o.value === "shape_definition")!.label,
  )
})
