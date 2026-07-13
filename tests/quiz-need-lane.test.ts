import assert from "node:assert/strict"
import test from "node:test"

import { resolveQuizNeed } from "../src/lib/quiz/need-lane"
import type { QuizAnswers } from "../src/lib/quiz/types"

const BASE: QuizAnswers = {
  structure: "wavy",
  thickness: "normal",
  density: "medium",
  fingertest: "glatt",
  pulltest: "stretches_bounces",
  scalp_type: "ausgeglichen",
  has_scalp_issue: false,
  concerns: [],
  treatment: ["natur"],
  goals: [],
}

const cases: Array<{ name: string; answers: Partial<QuizAnswers>; lane: string }> = [
  { name: "colored hair alone", answers: { treatment: ["gefaerbt"] }, lane: "base" },
  {
    name: "bleach plus dryness",
    answers: { treatment: ["blondiert"], concerns: ["dryness"] },
    lane: "bond_repair",
  },
  {
    name: "moderate treatment plus corroborated dry ends",
    answers: {
      treatment: ["gefaerbt"],
      concerns: ["split_ends"],
      fingertest: "rau",
    },
    lane: "bond_repair",
  },
  {
    name: "moderate treatment plus uncorroborated dryness",
    answers: { treatment: ["gefaerbt"], concerns: ["dryness"] },
    lane: "surface_support",
  },
  {
    name: "natural corroborated structural damage",
    answers: {
      concerns: ["hair_damage"],
      fingertest: "rau",
      pulltest: "snaps",
    },
    lane: "bond_repair",
  },
  {
    name: "stretch test alone",
    answers: { pulltest: "stretches_stays" },
    lane: "base",
  },
  {
    name: "stretch test plus repair intent",
    answers: { pulltest: "stretches_stays", goals: ["strengthen"] },
    lane: "protein",
  },
  {
    name: "snap test plus dryness",
    answers: { pulltest: "snaps", concerns: ["dryness"] },
    lane: "deep_moisture",
  },
  {
    name: "balanced test plus dryness",
    answers: { concerns: ["dryness"] },
    lane: "surface_support",
  },
  {
    name: "curl definition",
    answers: { goals: ["curl_definition"] },
    lane: "surface_support",
  },
  {
    name: "split ends",
    answers: { concerns: ["split_ends"] },
    lane: "ends_protection",
  },
  {
    name: "shine goal",
    answers: { goals: ["shine"] },
    lane: "ends_protection",
  },
  {
    name: "scalp condition without a length concern",
    answers: { scalp_condition: "schuppen", has_scalp_issue: true },
    lane: "scalp_focus",
  },
  {
    name: "oily scalp alone",
    answers: { scalp_type: "fettig" },
    lane: "base",
  },
]

for (const fixture of cases) {
  test(`need lane: ${fixture.name}`, () => {
    assert.equal(resolveQuizNeed({ ...BASE, ...fixture.answers }).lane, fixture.lane)
  })
}

test("bond repair wins when overlapping mask and surface signals are present", () => {
  const resolution = resolveQuizNeed({
    ...BASE,
    treatment: ["blondiert"],
    concerns: ["dryness", "hair_damage"],
    fingertest: "rau",
    pulltest: "stretches_stays",
    goals: ["moisture", "strengthen"],
  })

  assert.equal(resolution.lane, "bond_repair")
})
