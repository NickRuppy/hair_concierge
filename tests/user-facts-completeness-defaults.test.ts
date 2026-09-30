import assert from "node:assert/strict"
import test from "node:test"

import { parseSupportedStage1Source } from "../src/lib/personal-plan/input"
import { applyCompletenessDefaults } from "../src/lib/user-facts/completeness-defaults"
import { projectLegacyLeadToFacts } from "../src/lib/user-facts/project-legacy-lead"
import { toStage1Source } from "../src/lib/user-facts/stage1-source"
import type { DiagnosticsV1 } from "../src/lib/user-facts/schema"

/**
 * Decision wave 1, item B (Nick, 2026-09-30): the only two completeness defaults.
 * A projection with no density gets `density: "medium"`, one with no hair length gets
 * `hairLength: "long"`; each default is reported so the caller can mark it
 * `fields.<name> = "assumed"` in the domain provenance. `source.raw` is never touched.
 */

const LEGACY_SOURCE = {
  kind: "legacy_columns" as const,
  version: 1 as const,
  raw: { hair_texture: "wavy", density: null, hair_length: null },
}

test("no density and no hair length: both defaults are set and both reported as assumed", () => {
  const input: DiagnosticsV1 = { texture: "wavy", source: LEGACY_SOURCE }
  const { diagnostics, assumedFields } = applyCompletenessDefaults(input)

  assert.equal(diagnostics.density, "medium")
  assert.equal(diagnostics.hairLength, "long")
  assert.deepEqual(assumedFields, ["density", "hairLength"])
  // Everything else is untouched, and the input object itself is not mutated.
  assert.equal(diagnostics.texture, "wavy")
  assert.equal(input.density, undefined)
  assert.equal(input.hairLength, undefined)
})

test("values the projection carries are never replaced and never reported", () => {
  const input: DiagnosticsV1 = {
    density: "high",
    hairLength: "short",
    source: LEGACY_SOURCE,
  }
  const { diagnostics, assumedFields } = applyCompletenessDefaults(input)

  assert.equal(diagnostics.density, "high")
  assert.equal(diagnostics.hairLength, "short")
  assert.deepEqual(assumedFields, [])
})

test("only the missing one is defaulted", () => {
  const onlyLength = applyCompletenessDefaults({ density: "low", source: LEGACY_SOURCE })
  assert.equal(onlyLength.diagnostics.density, "low")
  assert.equal(onlyLength.diagnostics.hairLength, "long")
  assert.deepEqual(onlyLength.assumedFields, ["hairLength"])

  const onlyDensity = applyCompletenessDefaults({ hairLength: "medium", source: LEGACY_SOURCE })
  assert.equal(onlyDensity.diagnostics.density, "medium")
  assert.equal(onlyDensity.diagnostics.hairLength, "medium")
  assert.deepEqual(onlyDensity.assumedFields, ["density"])
})

test("no other field is ever defaulted (Nick: explicitly none)", () => {
  const { diagnostics } = applyCompletenessDefaults({ source: LEGACY_SOURCE })
  assert.deepEqual(Object.keys(diagnostics).sort(), ["density", "hairLength", "source"])
})

test("source.raw is never modified — same object, same content", () => {
  const input: DiagnosticsV1 = { source: LEGACY_SOURCE }
  const before = structuredClone(LEGACY_SOURCE.raw)
  const { diagnostics } = applyCompletenessDefaults(input)

  assert.equal(diagnostics.source.raw, LEGACY_SOURCE.raw, "raw is carried by reference")
  assert.deepEqual(LEGACY_SOURCE.raw, before, "raw content is unchanged")
})

test("Stage-1 safety: a lead missing hair length still re-emits a raw source that fails Stage-1 parsing", () => {
  const { diagnostics: projected } = projectLegacyLeadToFacts({
    leadId: "lead-old",
    quizAnswers: {
      structure: "wavy",
      thickness: "fine",
      density: "low",
      fingertest: "rau",
      pulltest: "snaps",
      scalp_type: "trocken",
      has_scalp_issue: false,
      treatment: ["gefaerbt"],
      concerns: ["frizz"],
      goals: ["moisture"],
    } as never,
  })
  const rawBefore = toStage1Source({ diagnostics: projected })
  assert.equal(parseSupportedStage1Source(rawBefore).ok, false, "baseline: not Stage-1-computable")

  const { diagnostics, assumedFields } = applyCompletenessDefaults(projected)
  assert.equal(diagnostics.hairLength, "long")
  assert.deepEqual(assumedFields, ["hairLength"])

  // Unedited facts re-emit `raw` untouched, so the guessed length never reaches a plan.
  const rawAfter = toStage1Source({ diagnostics })
  assert.deepEqual(rawAfter, rawBefore)
  assert.equal((rawAfter as { answers: { hairLength?: string } }).answers.hairLength, undefined)
  assert.equal(parseSupportedStage1Source(rawAfter).ok, false, "no silent plan on a guessed length")
})
