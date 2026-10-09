import assert from "node:assert/strict"
import test from "node:test"

import {
  buildPlanProfile,
  hashSupportedPersonalPlanQuizEnvelope,
  parseSupportedPersonalPlanQuizEnvelope,
} from "../../src/lib/personal-plan/input"
import { COMPLETE_V3_PLAN_ENVELOPE } from "./fixtures"

test("INITIAL-01: a valid V3 paid quiz becomes a quiz-faithful initial profile", () => {
  const parsed = parseSupportedPersonalPlanQuizEnvelope(COMPLETE_V3_PLAN_ENVELOPE)
  assert.equal(parsed.ok, true)
  if (!parsed.ok) return

  const profile = buildPlanProfile(parsed.envelope, {
    artifactId: "11111111-1111-4111-8111-111111111111",
    projection: "initial_quiz",
  })

  assert.equal(profile.source.quizVersion, 3)
  assert.equal(profile.hair.texture, "wavy")
  assert.equal(profile.hair.thickness, "fine")
  assert.deepEqual(profile.concerns, ["dry_lengths", "split_ends"])
  assert.deepEqual(profile.scalp.concerns, [])
  assert.equal(profile.routine.shampooFrequency.state, "unknown")
  assert.equal(profile.routine.heatToolUse.state, "unknown")
})

test("INITIAL-12: V2 concerns normalize once without inventing breakage", () => {
  const legacy = {
    ...COMPLETE_V3_PLAN_ENVELOPE,
    version: 2,
    answers: {
      ...COMPLETE_V3_PLAN_ENVELOPE.answers,
      currentConcerns: ["dry_dull_lengths", "breakage_or_split_ends", "scalp_imbalance"],
      concernRecurrence: undefined,
    },
  }

  const parsed = parseSupportedPersonalPlanQuizEnvelope(legacy)
  assert.equal(parsed.ok, true)
  if (!parsed.ok) return

  const profile = buildPlanProfile(parsed.envelope, {
    artifactId: "22222222-2222-4222-8222-222222222222",
    projection: "initial_quiz",
  })

  assert.deepEqual(profile.concerns, ["dry_lengths", "split_ends"])
  assert.equal(profile.concerns.includes("breakage"), false)
  assert.deepEqual(profile.concernRecurrence, {
    state: "unknown",
    reason: "concern_recurrence",
  })
})

test("malformed mandatory quiz facts return a typed incomplete input", () => {
  const parsed = parseSupportedPersonalPlanQuizEnvelope({
    ...COMPLETE_V3_PLAN_ENVELOPE,
    answers: { ...COMPLETE_V3_PLAN_ENVELOPE.answers, thickness: undefined },
  })

  assert.deepEqual(parsed, {
    ok: false,
    error: { code: "invalid_quiz_envelope", quizVersion: 3 },
  })
})

for (const field of ["thickness", "elasticResponse"] as const) {
  test(`mask-missing-${field}: required Mask target input fails closed at the shared parser`, () => {
    const parsed = parseSupportedPersonalPlanQuizEnvelope({
      ...COMPLETE_V3_PLAN_ENVELOPE,
      answers: { ...COMPLETE_V3_PLAN_ENVELOPE.answers, [field]: undefined },
    })
    assert.deepEqual(parsed, {
      ok: false,
      error: { code: "invalid_quiz_envelope", quizVersion: 3 },
    })
  })
}

test("supported envelope hashing is stable across object key order", () => {
  const reordered = {
    version: COMPLETE_V3_PLAN_ENVELOPE.version,
    answers: COMPLETE_V3_PLAN_ENVELOPE.answers,
    kind: COMPLETE_V3_PLAN_ENVELOPE.kind,
  }
  assert.equal(
    hashSupportedPersonalPlanQuizEnvelope(COMPLETE_V3_PLAN_ENVELOPE),
    hashSupportedPersonalPlanQuizEnvelope(reordered),
  )
})
