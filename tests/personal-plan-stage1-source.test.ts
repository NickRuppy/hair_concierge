import assert from "node:assert/strict"
import test from "node:test"

import {
  buildLegacyQuizStage1Source,
  parseSupportedStage1Source,
} from "../src/lib/personal-plan/input"

test("legacy quiz sources retain their exact lead provenance and canonicalize unordered answers", () => {
  const source = buildLegacyQuizStage1Source({
    leadId: "lead-1",
    answers: {
      structure: "wavy",
      thickness: "fine",
      density: "low",
      hair_length: "long",
      fingertest: "rau",
      pulltest: "snaps",
      scalp_type: "trocken",
      treatment: ["blondiert", "gefaerbt"],
      concerns: ["frizz", "hair_damage"],
      goals: ["shine", "moisture"],
    },
  })

  assert.deepEqual(source, {
    kind: "legacy_quiz",
    version: 1,
    leadId: "lead-1",
    answers: {
      texture: "wavy",
      thickness: "fine",
      density: "low",
      hairLength: "long",
      hairSurface: "rough",
      elasticResponse: "snaps",
      scalpOiliness: "dry",
      scalpConcerns: [],
      chemicalTreatments: ["colored", "lightened"],
      currentConcerns: ["frizz_flyaways", "hair_damage"],
      goals: ["moisture", "shine"],
    },
  })
})

test("legacy Stage-1 parsing rejects unsupported values instead of trusting TypeScript casts", () => {
  const source = buildLegacyQuizStage1Source({
    leadId: "lead-1",
    answers: {
      structure: "unsupported" as never,
      thickness: "fine",
      density: "low",
      hair_length: "long",
      fingertest: "rau",
      pulltest: "snaps",
      scalp_type: "trocken",
      treatment: ["natur"],
      goals: ["moisture"],
    },
  })

  assert.deepEqual(parseSupportedStage1Source(source), {
    ok: false,
    error: { code: "invalid_quiz_envelope", quizVersion: 1 },
  })
})
