import assert from "node:assert/strict"
import test from "node:test"

import {
  buildGuidedStoryTrackerProof,
  type GuidedStoryTrackerScenarioId,
} from "../src/lib/quiz/guided-story-tracker"
import { buildQuizGuidedStoryPreview } from "../src/lib/quiz/guided-story-preview"
import type { QuizAnswers } from "../src/lib/quiz/types"

const baseAnswers: QuizAnswers = {
  structure: "straight",
  thickness: "normal",
  density: "medium",
  scalp_type: "ausgeglichen",
  has_scalp_issue: false,
  concerns: [],
  treatment: ["natur"],
  goals: [],
}

function scenarioFor(answers: QuizAnswers): GuidedStoryTrackerScenarioId {
  return buildGuidedStoryTrackerProof(buildQuizGuidedStoryPreview(answers)).scenario.id
}

test("maps shampoo and conditioner only to the Basiswäsche tracker scenario", () => {
  const proof = buildGuidedStoryTrackerProof(buildQuizGuidedStoryPreview(baseAnswers))

  assert.equal(proof.scenario.id, "foundation")
  assert.equal(proof.scenario.title, "Basiswäsche")
  assert.deepEqual(
    proof.products.map((product) => product.category),
    ["Shampoo", "Conditioner"],
  )
  assert.match(proof.disclaimer, /vergleichbare Beispielroutine/)
  assert.match(proof.disclaimer, /kein echter Tagebuchverlauf/)
  assert.match(proof.disclaimer, /manuell eingetragenen Haarwäsche/)
})

test("keeps scalp-specific shampoo variants inside the Basiswäsche scenario", () => {
  const proof = buildGuidedStoryTrackerProof(
    buildQuizGuidedStoryPreview({
      ...baseAnswers,
      scalp_condition: "gereizt",
      scalp_type: "trocken",
      has_scalp_issue: true,
      thickness: "fine",
    }),
  )

  assert.equal(proof.scenario.id, "foundation")
  assert.match(proof.products[0]?.name ?? "", /Balea Ultra Sensitive/)
})

test("maps bondbuilder, protein mask, and moisture mask routines to Intensive Pflege", () => {
  const cases: Array<{ name: string; answers: QuizAnswers; expectedProduct: RegExp }> = [
    {
      name: "bondbuilder",
      answers: {
        ...baseAnswers,
        structure: "wavy",
        fingertest: "rau",
        pulltest: "snaps",
        concerns: ["breakage", "dryness", "frizz"],
        treatment: ["blondiert"],
        goals: ["anti_breakage", "moisture", "less_frizz"],
      },
      expectedProduct: /OLAPLEX No\.3PLUS/,
    },
    {
      name: "protein mask",
      answers: {
        ...baseAnswers,
        pulltest: "stretches_stays",
        concerns: ["breakage"],
        goals: ["strengthen"],
      },
      expectedProduct: /Neqi Peptide Power/,
    },
    {
      name: "moisture mask",
      answers: {
        ...baseAnswers,
        pulltest: "snaps",
        concerns: ["dryness"],
        goals: ["moisture"],
      },
      expectedProduct: /Guhl 30 sec\. Feuchtigkeit/,
    },
  ]

  for (const item of cases) {
    const proof = buildGuidedStoryTrackerProof(buildQuizGuidedStoryPreview(item.answers))
    assert.equal(proof.scenario.id, "treatment", item.name)
    assert.match(
      proof.products.map((product) => product.name).join(" "),
      item.expectedProduct,
      item.name,
    )
  }
})

test("maps leave-in, curl leave-in, and oil routines to Finish & Struktur", () => {
  assert.equal(
    scenarioFor({
      ...baseAnswers,
      fingertest: "rau",
      concerns: ["frizz"],
      goals: ["less_frizz"],
    }),
    "finish",
  )

  const curlProof = buildGuidedStoryTrackerProof(
    buildQuizGuidedStoryPreview({
      ...baseAnswers,
      structure: "wavy",
      fingertest: "rau",
      concerns: ["frizz"],
      goals: ["curl_definition"],
    }),
  )
  assert.equal(curlProof.scenario.id, "finish")
  assert.match(curlProof.products.map((product) => product.category).join(" "), /Locken-Leave-in/)

  assert.equal(
    scenarioFor({
      ...baseAnswers,
      concerns: ["split_ends"],
      goals: ["less_split_ends"],
    }),
    "finish",
  )
})

test("derives a conservative positive rhythm band from the known quiz washing cadence", () => {
  const highCadenceProof = buildGuidedStoryTrackerProof(
    buildQuizGuidedStoryPreview({
      ...baseAnswers,
      scalp_type: "fettig",
      thickness: "fine",
    }),
  )

  assert.equal(highCadenceProof.rhythm.washes, 3)
  assert.equal(highCadenceProof.rhythm.minWashes, 3)
  assert.equal(highCadenceProof.rhythm.maxWashes, 4)
  assert.equal(highCadenceProof.rhythm.status, "in_range")
  assert.match(highCadenceProof.rhythm.encouragement, /Startbereich aus deinen Quiz-Antworten/)
})

test("falls back to a basis proof without inventing product history", () => {
  const proof = buildGuidedStoryTrackerProof({
    needs: buildQuizGuidedStoryPreview(baseAnswers).needs,
    products: [],
  })

  assert.equal(proof.scenario.id, "foundation")
  assert.deepEqual(
    proof.products.map((product) => product.name),
    ["Shampoo-Beispiel", "Conditioner-Beispiel"],
  )
  assert.match(proof.disclaimer, /keine automatische Auswertung deiner Nutzung/)
})
