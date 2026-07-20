import assert from "node:assert/strict"
import test from "node:test"

import {
  derivePortraitConfig,
  type PortraitConfig,
  type PortraitDensity,
  type PortraitHairPattern,
  type PortraitLength,
} from "../src/lib/quiz/portrait-config"
import type { QuizAnswers } from "../src/lib/quiz/types"

const lengths: PortraitLength[] = ["very_short", "short", "medium", "long", "very_long"]
const patterns: PortraitHairPattern[] = ["straight", "wavy", "curly", "coily"]
const densities: PortraitDensity[] = ["low", "medium", "high"]

function required(overrides: Partial<QuizAnswers> = {}): QuizAnswers {
  return {
    structure: "wavy",
    density: "medium",
    hair_length: "medium",
    treatment: ["natur"],
    ...overrides,
  }
}

function assertPersonalized(
  config: PortraitConfig,
): asserts config is Extract<PortraitConfig, { kind: "personalized" }> {
  assert.equal(config.kind, "personalized")
}

test("derivePortraitConfig covers every required length, structure, and density axis", () => {
  for (const hair_length of lengths) {
    for (const structure of patterns) {
      for (const density of densities) {
        const config = derivePortraitConfig(required({ density, hair_length, structure }))

        assertPersonalized(config)
        assert.equal(config.length, hair_length)
        assert.equal(config.naturalRootPattern, structure)
        assert.equal(config.treatedLengthPattern, structure)
        assert.equal(config.density, density)
        assert.equal(config.treatmentState, "none")
        assert.equal(config.markerPreset, hair_length)
      }
    }
  }
})

test("shape-changing treatments alter treated lengths while natural roots stay natural", () => {
  const perm = derivePortraitConfig(required({ structure: "straight", treatment: ["dauerwelle"] }))
  const straightened = derivePortraitConfig(
    required({ structure: "curly", treatment: ["chemisch_geglaettet"] }),
  )

  assertPersonalized(perm)
  assert.equal(perm.naturalRootPattern, "straight")
  assert.equal(perm.treatedLengthPattern, "curly")
  assert.equal(perm.treatmentState, "perm")

  assertPersonalized(straightened)
  assert.equal(straightened.naturalRootPattern, "curly")
  assert.equal(straightened.treatedLengthPattern, "straight")
  assert.equal(straightened.treatmentState, "straightened")
})

test("contradictory perm and straightening use the natural fallback instead of generic", () => {
  const config = derivePortraitConfig(
    required({ structure: "coily", treatment: ["dauerwelle", "chemisch_geglaettet"] }),
  )

  assertPersonalized(config)
  assert.equal(config.naturalRootPattern, "coily")
  assert.equal(config.treatedLengthPattern, "coily")
  assert.equal(config.treatmentState, "natural_fallback")
})

test("colour and bleach treatments are visually ignored", () => {
  const base = derivePortraitConfig(required({ treatment: ["natur"] }))
  const colour = derivePortraitConfig(required({ treatment: ["gefaerbt"] }))
  const bleach = derivePortraitConfig(required({ treatment: ["blondiert"] }))
  const both = derivePortraitConfig(required({ treatment: ["gefaerbt", "blondiert"] }))

  assert.deepEqual(colour, base)
  assert.deepEqual(bleach, base)
  assert.deepEqual(both, base)
})

test("missing or invalid required portrait axes return the explicit generic config", () => {
  const cases: Array<[string, QuizAnswers]> = [
    ["missing length", required({ hair_length: undefined })],
    ["invalid length", required({ hair_length: "shoulder" as QuizAnswers["hair_length"] })],
    ["missing structure", required({ structure: undefined })],
    ["invalid structure", required({ structure: "zigzag" })],
    ["missing density", required({ density: undefined })],
    ["invalid density", required({ density: "extra" })],
    ["missing treatment axis", required({ treatment: undefined })],
    ["empty treatment axis", required({ treatment: [] })],
    ["invalid treatment axis", required({ treatment: ["keratin"] })],
  ]

  for (const [label, answers] of cases) {
    assert.deepEqual(
      derivePortraitConfig(answers),
      { kind: "generic", markerPreset: "generic" },
      label,
    )
  }
})

test("ignored quiz inputs leave the portrait config equal", () => {
  const base = derivePortraitConfig(required())
  const withIgnoredSignals = derivePortraitConfig(
    required({
      concerns: ["dryness", "frizz"],
      fingertest: "rau",
      goals: ["shine", "less_frizz"],
      has_scalp_issue: true,
      pulltest: "snaps",
      scalp_condition: "gereizt",
      scalp_type: "trocken",
      thickness: "coarse",
    }),
  )

  assert.deepEqual(withIgnoredSignals, base)
})
