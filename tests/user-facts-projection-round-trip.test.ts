import assert from "node:assert/strict"
import test from "node:test"

import { computeNeedPlan } from "../src/lib/personal-plan/compute-stage1"
import {
  buildLegacyQuizStage1Source,
  parseSupportedStage1Source,
} from "../src/lib/personal-plan/input"
import {
  hashPersonalPlanNeedVersionInput,
  type JsonValue,
} from "../src/lib/personal-plan/persistence/index"
import { PERSONAL_PLAN_STAGE1_COMPUTATION_VERSION } from "../src/lib/personal-plan/persistence/stage1-service"
import { canonicalizePersonalPlanAnswers } from "../src/lib/personal-plan-quiz/persistence"
import type { QuizAnswers } from "../src/lib/quiz/types"
import { projectArtifactToFacts } from "../src/lib/user-facts/project-artifact"
import { projectLegacyLeadToFacts } from "../src/lib/user-facts/project-legacy-lead"
import {
  UnsupportedUserFactsSourceError,
  UserFactsIncompleteError,
  type DiagnosticsV1,
  type QuizContextV1,
} from "../src/lib/user-facts/schema"
import { toStage1Source } from "../src/lib/user-facts/stage1-source"

/** Hashes a raw Stage-1 source exactly the way `stage1-service.ts:166-170` does, so the test's
 * expected values come from today's production hashing path rather than from the code under
 * test. */
function hashViaProductionPath(rawEnvelope: unknown): string {
  const computed = computeNeedPlan({
    rawEnvelope,
    artifactId: "hash-check-artifact",
    projection: "initial_quiz",
    computationVersion: PERSONAL_PLAN_STAGE1_COMPUTATION_VERSION,
    createdAt: "2026-01-01T00:00:00.000Z",
  })
  assert.equal(computed.status, "ready", `expected a ready snapshot, got ${computed.status}`)
  if (computed.status !== "ready") throw new Error("unreachable")
  return hashPersonalPlanNeedVersionInput({
    schemaVersion: computed.snapshot.schemaVersion,
    computationVersion: computed.snapshot.computationVersion,
    inputSnapshot: computed.snapshot.sourceQuiz as unknown as JsonValue,
  })
}

// ---------------------------------------------------------------------------
// 1. v3 round-trip + hash identity
// ---------------------------------------------------------------------------

const V3_WITH_RECURRENCE = {
  kind: "personal_plan",
  version: 3,
  answers: {
    texture: "curly",
    thickness: "coarse",
    density: "high",
    goals: ["moisture", "shine"],
    routineClarity: "clear",
    resultReliability: "mostly",
    adaptationConfidence: "yes",
    currentConcerns: ["dry_lengths", "split_ends"],
    concernRecurrence: { concernId: "dry_lengths", frequency: "often" },
    hairLength: "long",
    hairSurface: "rough",
    elasticResponse: "stretches_stays",
    chemicalTreatments: ["colored", "permed"],
    scalpOiliness: "dry",
    scalpConcerns: ["dry_dandruff"],
    previousAttempts: "some_steps_helped",
    blockers: ["consistency", "product_fit"],
    routineStyle: "simple_reliable",
    meaningfulMoment: "everyday",
    currentConcernsOtherText: "Sehr empfindliche Kopfhaut",
  },
} as const

const V3_WITH_EMPTY_ARRAYS = {
  kind: "personal_plan",
  version: 3,
  answers: {
    texture: "straight",
    thickness: "fine",
    density: "low",
    goals: ["volume_balance"],
    routineClarity: "none",
    resultReliability: "rarely",
    adaptationConfidence: "no",
    currentConcerns: [],
    hairLength: "very_short",
    hairSurface: "smooth",
    elasticResponse: "snaps",
    chemicalTreatments: ["natural"],
    scalpOiliness: "oily",
    scalpConcerns: [],
    previousAttempts: "nothing_reliably_worked",
    blockers: ["time_and_cost"],
    routineStyle: "flexible_versatile",
    meaningfulMoment: "work",
  },
} as const

for (const [label, envelope] of [
  ["with concernRecurrence + otherText", V3_WITH_RECURRENCE],
  ["with empty scalpConcerns/currentConcerns", V3_WITH_EMPTY_ARRAYS],
] as const) {
  test(`v3 round-trip (${label}): unedited re-emission deep-equals the source envelope and hashes identically`, () => {
    const facts = projectArtifactToFacts({ envelope, artifactId: "artifact-v3", leadId: "lead-v3" })
    const reemitted = toStage1Source({
      diagnostics: facts.diagnostics,
      quizContext: facts.quizContext,
      editedAt: null,
    })

    assert.deepEqual(reemitted, envelope)
    assert.equal(hashViaProductionPath(reemitted), hashViaProductionPath(envelope))
  })
}

// ---------------------------------------------------------------------------
// 2. v3 native reconstruction: lossless when canonical, canonicalising when not
// ---------------------------------------------------------------------------

const CANONICAL_V3_ANSWERS = {
  texture: "wavy",
  thickness: "normal",
  density: "medium",
  goals: ["moisture", "shine"],
  routineClarity: "partial",
  resultReliability: "sometimes",
  adaptationConfidence: "partly",
  currentConcerns: ["dry_lengths", "split_ends"],
  hairLength: "medium",
  hairSurface: "slightly_uneven",
  elasticResponse: "stretches_bounces",
  chemicalTreatments: ["colored", "permed"],
  scalpOiliness: "balanced",
  scalpConcerns: ["dry_dandruff", "irritated"],
  previousAttempts: "mostly_works",
  blockers: ["consistency", "product_fit"],
  routineStyle: "intentional_caring",
  meaningfulMoment: "social",
} as const

const CANONICAL_V3_ENVELOPE = {
  kind: "personal_plan",
  version: 3,
  answers: CANONICAL_V3_ANSWERS,
} as const

const OUT_OF_ORDER_V3_ANSWERS = {
  ...CANONICAL_V3_ANSWERS,
  goals: ["shine", "moisture"],
  currentConcerns: ["split_ends", "dry_lengths"],
  chemicalTreatments: ["permed", "colored"],
  scalpConcerns: ["irritated", "dry_dandruff"],
  blockers: ["product_fit", "consistency"],
} as const

const OUT_OF_ORDER_V3_ENVELOPE = {
  kind: "personal_plan",
  version: 3,
  answers: OUT_OF_ORDER_V3_ANSWERS,
} as const

test("v3 native reconstruction is lossless when the stored envelope is already canonical", () => {
  const facts = projectArtifactToFacts({
    envelope: CANONICAL_V3_ENVELOPE,
    artifactId: "artifact-canonical",
    leadId: "lead-canonical",
  })
  const edited = toStage1Source({
    diagnostics: facts.diagnostics,
    quizContext: facts.quizContext,
    editedAt: "2026-01-01T00:00:00.000Z",
  })

  assert.deepEqual(edited, CANONICAL_V3_ENVELOPE)
  assert.equal(parseSupportedStage1Source(edited).ok, true)
})

test("v3 raw re-emission preserves out-of-canonical-order arrays; native edit canonicalises them", () => {
  const facts = projectArtifactToFacts({
    envelope: OUT_OF_ORDER_V3_ENVELOPE,
    artifactId: "artifact-out-of-order",
    leadId: "lead-out-of-order",
  })

  // Rule 1: unedited re-emission preserves the original (non-canonical) order exactly.
  const raw = toStage1Source({
    diagnostics: facts.diagnostics,
    quizContext: facts.quizContext,
    editedAt: null,
  })
  assert.deepEqual(raw, OUT_OF_ORDER_V3_ENVELOPE)

  // Rule 2: a native edit canonicalises — expected value comes from calling the production
  // canonicaliser directly, not from the code under test.
  const edited = toStage1Source({
    diagnostics: facts.diagnostics,
    quizContext: facts.quizContext,
    editedAt: "2026-01-02T00:00:00.000Z",
  })
  const expectedCanonical = canonicalizePersonalPlanAnswers({
    ...OUT_OF_ORDER_V3_ANSWERS,
    goals: [...OUT_OF_ORDER_V3_ANSWERS.goals],
    currentConcerns: [...OUT_OF_ORDER_V3_ANSWERS.currentConcerns],
    chemicalTreatments: [...OUT_OF_ORDER_V3_ANSWERS.chemicalTreatments],
    scalpConcerns: [...OUT_OF_ORDER_V3_ANSWERS.scalpConcerns],
    blockers: [...OUT_OF_ORDER_V3_ANSWERS.blockers],
  })

  assert.deepEqual(edited, expectedCanonical)
  assert.notDeepEqual(edited, OUT_OF_ORDER_V3_ENVELOPE)
  assert.equal(parseSupportedStage1Source(edited).ok, true)
})

// ---------------------------------------------------------------------------
// 3. v2 round-trip: legacy concern decoding, raw re-emission, omitted-vs-empty arrays
// ---------------------------------------------------------------------------

const V2_WITH_DISCARDED_CONCERN = {
  kind: "personal_plan",
  version: 2,
  answers: {
    texture: "coily",
    thickness: "coarse",
    density: "high",
    goals: ["scalp_balance"],
    routineClarity: "trial_and_error",
    resultReliability: "mostly",
    adaptationConfidence: "yes",
    currentConcerns: ["scalp_imbalance", "breakage_or_split_ends"],
    hairLength: "very_long",
    hairSurface: "rough",
    elasticResponse: "stretches_bounces",
    chemicalTreatments: ["natural"],
    scalpOiliness: "oily",
    scalpConcerns: ["oily_dandruff"],
    previousAttempts: "little_targeted_trial",
    blockers: ["routine_too_complex"],
    routineStyle: "precise_goal_oriented",
    meaningfulMoment: "special_occasions",
  },
} as const

test("v2 round-trip: scalp_imbalance drops from native currentConcerns but survives in raw re-emission", () => {
  const facts = projectArtifactToFacts({
    envelope: V2_WITH_DISCARDED_CONCERN,
    artifactId: "artifact-v2",
    leadId: "lead-v2",
  })

  assert.deepEqual(facts.diagnostics.currentConcerns, ["split_ends"])

  const raw = toStage1Source({
    diagnostics: facts.diagnostics,
    quizContext: facts.quizContext,
    editedAt: null,
  })
  assert.deepEqual(raw, V2_WITH_DISCARDED_CONCERN)
  assert.equal(
    (raw as typeof V2_WITH_DISCARDED_CONCERN).answers.currentConcerns.includes("scalp_imbalance"),
    true,
  )
  assert.equal(hashViaProductionPath(raw), hashViaProductionPath(V2_WITH_DISCARDED_CONCERN))
})

const V2_BASE_ANSWERS = {
  texture: "straight",
  thickness: "fine",
  density: "low",
  goals: ["shine"],
  routineClarity: "clear",
  resultReliability: "mostly",
  adaptationConfidence: "yes",
  hairLength: "short",
  hairSurface: "smooth",
  elasticResponse: "stretches_bounces",
  chemicalTreatments: ["natural"],
  scalpOiliness: "balanced",
  scalpConcerns: [],
  previousAttempts: "mostly_works",
  blockers: ["consistency"],
  routineStyle: "simple_reliable",
  meaningfulMoment: "everyday",
} as const

test("v2 round-trip: raw re-emission keeps omitted-vs-empty currentConcerns distinct", () => {
  const omittedEnvelope = {
    kind: "personal_plan" as const,
    version: 2 as const,
    answers: { ...V2_BASE_ANSWERS },
  }
  const emptyEnvelope = {
    kind: "personal_plan" as const,
    version: 2 as const,
    answers: { ...V2_BASE_ANSWERS, currentConcerns: [] as string[] },
  }

  const omittedFacts = projectArtifactToFacts({
    envelope: omittedEnvelope,
    artifactId: "artifact-v2-omitted",
    leadId: "lead-v2-omitted",
  })
  const emptyFacts = projectArtifactToFacts({
    envelope: emptyEnvelope,
    artifactId: "artifact-v2-empty",
    leadId: "lead-v2-empty",
  })

  const rawOmitted = toStage1Source({
    diagnostics: omittedFacts.diagnostics,
    quizContext: omittedFacts.quizContext,
    editedAt: null,
  }) as { answers: Record<string, unknown> }
  const rawEmpty = toStage1Source({
    diagnostics: emptyFacts.diagnostics,
    quizContext: emptyFacts.quizContext,
    editedAt: null,
  }) as { answers: Record<string, unknown> }

  assert.equal(Object.prototype.hasOwnProperty.call(rawOmitted.answers, "currentConcerns"), false)
  assert.equal(Object.prototype.hasOwnProperty.call(rawEmpty.answers, "currentConcerns"), true)
  assert.deepEqual(rawEmpty.answers.currentConcerns, [])

  // Both projections still decode to the same native (empty) currentConcerns.
  assert.deepEqual(omittedFacts.diagnostics.currentConcerns, [])
  assert.deepEqual(emptyFacts.diagnostics.currentConcerns, [])
})

// ---------------------------------------------------------------------------
// 4. legacy lead round-trip
// ---------------------------------------------------------------------------

const LEGACY_ANSWERS: QuizAnswers = {
  structure: "curly",
  thickness: "coarse",
  density: "high",
  hair_length: "medium",
  fingertest: "rau",
  pulltest: "snaps",
  scalp_type: "trocken",
  has_scalp_issue: true,
  scalp_condition: "trockene_schuppen",
  concerns: ["dry_lengths", "tangling"],
  goals: ["moisture", "shape_definition"],
  treatment: ["natur", "gefaerbt"],
}

test("legacy round-trip: unedited re-emission deep-equals buildLegacyQuizStage1Source's own output and hashes identically", () => {
  // Expected value comes from calling the existing production builder directly (not the code
  // under test).
  const expected = buildLegacyQuizStage1Source({ leadId: "lead-legacy", answers: LEGACY_ANSWERS })

  const facts = projectLegacyLeadToFacts({ leadId: "lead-legacy", quizAnswers: LEGACY_ANSWERS })
  assert.deepEqual(facts.diagnostics.source.raw, expected)
  assert.deepEqual(facts.diagnostics.goals, expected.answers.goals)
  assert.deepEqual(facts.diagnostics.currentConcerns, expected.answers.currentConcerns)
  assert.deepEqual(facts.diagnostics.chemicalTreatments, expected.answers.chemicalTreatments)

  const raw = toStage1Source({ diagnostics: facts.diagnostics, editedAt: null })
  assert.deepEqual(raw, expected)
  assert.equal(hashViaProductionPath(raw), hashViaProductionPath(expected))
})

test("legacy round-trip: an edit with one changed field emits a legacy_quiz shape that still parses", () => {
  const facts = projectLegacyLeadToFacts({
    leadId: "lead-legacy-edit",
    quizAnswers: LEGACY_ANSWERS,
  })
  const editedDiagnostics = { ...facts.diagnostics, texture: "straight" as const }

  const edited = toStage1Source({
    diagnostics: editedDiagnostics,
    editedAt: "2026-01-03T00:00:00.000Z",
  }) as {
    kind: string
    answers: { texture: string }
  }

  assert.equal(edited.kind, "legacy_quiz")
  assert.equal(edited.answers.texture, "straight")
  assert.equal(parseSupportedStage1Source(edited).ok, true)
})

// ---------------------------------------------------------------------------
// 5. v2 edited: promotes to a v3 envelope with mapped concerns
// ---------------------------------------------------------------------------

test("v2 edited: emission is a v3 envelope carrying the mapped native concerns, and it parses", () => {
  const facts = projectArtifactToFacts({
    envelope: V2_WITH_DISCARDED_CONCERN,
    artifactId: "artifact-v2-edit",
    leadId: "lead-v2-edit",
  })

  const edited = toStage1Source({
    diagnostics: facts.diagnostics,
    quizContext: facts.quizContext,
    editedAt: "2026-01-04T00:00:00.000Z",
  }) as { kind: string; version: number; answers: { currentConcerns: string[] } }

  assert.equal(edited.kind, "personal_plan")
  assert.equal(edited.version, 3)
  assert.deepEqual(edited.answers.currentConcerns, ["split_ends"])
  assert.equal(edited.answers.currentConcerns.includes("scalp_imbalance" as never), false)
  assert.equal(parseSupportedStage1Source(edited).ok, true)
})

// ---------------------------------------------------------------------------
// 6. Rejections: unsupported envelope version, incomplete legacy diagnostics
// ---------------------------------------------------------------------------

test("projectArtifactToFacts throws a typed error for an unsupported envelope version", () => {
  assert.throws(
    () =>
      projectArtifactToFacts({
        envelope: { kind: "personal_plan", version: 4, answers: {} },
        artifactId: "artifact-v4",
        leadId: "lead-v4",
      }),
    UnsupportedUserFactsSourceError,
  )
})

test("projectLegacyLeadToFacts returns partial diagnostics for a legacy lead missing a scalar field (I2 ruling, task 5a fix round 1)", () => {
  const { structure: _structure, ...incompleteAnswers } = LEGACY_ANSWERS

  const facts = projectLegacyLeadToFacts({
    leadId: "lead-incomplete",
    quizAnswers: incompleteAnswers,
  })

  assert.equal(facts.diagnostics.texture, undefined)
  assert.equal(facts.diagnostics.source.kind, "legacy_quiz")
})

test("projectLegacyLeadToFacts throws only when quizAnswers is not a usable record", () => {
  assert.throws(
    () => projectLegacyLeadToFacts({ leadId: "lead-bad", quizAnswers: null as never }),
    UnsupportedUserFactsSourceError,
  )
})

// ---------------------------------------------------------------------------
// 7. legacy_columns source (controller ruling 2026-09-15): never Stage-1-computable
// ---------------------------------------------------------------------------

const LEGACY_COLUMNS_DIAGNOSTICS = {
  texture: "wavy" as const,
  thickness: "fine" as const,
  source: {
    kind: "legacy_columns" as const,
    version: 1 as const,
    raw: { hair_texture: "wavy", thickness: "fine" },
  },
}

test("toStage1Source throws UnsupportedUserFactsSourceError for a legacy_columns source (unedited)", () => {
  assert.throws(
    () => toStage1Source({ diagnostics: LEGACY_COLUMNS_DIAGNOSTICS, editedAt: null }),
    UnsupportedUserFactsSourceError,
  )
})

test("toStage1Source throws UnsupportedUserFactsSourceError for a legacy_columns source (edited)", () => {
  assert.throws(
    () =>
      toStage1Source({
        diagnostics: LEGACY_COLUMNS_DIAGNOSTICS,
        editedAt: "2026-01-05T00:00:00.000Z",
      }),
    UnsupportedUserFactsSourceError,
  )
})

// ---------------------------------------------------------------------------
// 8. Incomplete diagnostics on an EDITED emission (task 4 fix round 1): completeness is
// enforced exactly at this boundary, for both the v3-promotion and legacy-quiz branches. The
// unedited (raw re-emission) path needs no completeness at all.
// ---------------------------------------------------------------------------

const COMPLETE_V3_QUIZ_CONTEXT: QuizContextV1 = {
  routineClarity: "partial",
  resultReliability: "sometimes",
  adaptationConfidence: "partly",
  previousAttempts: "some_steps_helped",
  blockers: ["product_fit"],
  routineStyle: "simple_reliable",
  meaningfulMoment: "everyday",
}

// A v3-sourced, otherwise-complete diagnostics record missing `texture` — legal to STORE
// (ruling 2026-09-15), but not enough for an edited native emission.
const V3_DIAGNOSTICS_MISSING_TEXTURE: DiagnosticsV1 = {
  thickness: "fine",
  density: "medium",
  hairLength: "long",
  hairSurface: "rough",
  elasticResponse: "stretches_stays",
  chemicalTreatments: ["colored"],
  scalpOiliness: "balanced",
  scalpConcerns: ["irritated"],
  goals: ["moisture"],
  currentConcerns: ["dry_lengths"],
  source: {
    kind: "personal_plan_v3",
    version: 3,
    leadId: "lead-incomplete-v3",
    artifactId: "artifact-incomplete-v3",
    raw: { kind: "personal_plan", version: 3, answers: {} },
  },
}

test("toStage1Source throws UserFactsIncompleteError for an edited v3-sourced record missing texture", () => {
  assert.throws(
    () =>
      toStage1Source({
        diagnostics: V3_DIAGNOSTICS_MISSING_TEXTURE,
        quizContext: COMPLETE_V3_QUIZ_CONTEXT,
        editedAt: "2026-09-16T00:00:00.000Z",
      }),
    (error: unknown) => {
      assert.ok(error instanceof UserFactsIncompleteError)
      assert.deepEqual(error.missingFields, ["texture"])
      return true
    },
  )
})

// A legacy-sourced, otherwise-complete diagnostics record missing `scalpConcerns`. No
// quizContext is passed, so (once past the completeness gate in a complete case) this would
// take the legacy-quiz branch, not the v3-promotion branch.
const LEGACY_DIAGNOSTICS_MISSING_SCALP_CONCERNS: DiagnosticsV1 = {
  texture: "wavy",
  thickness: "fine",
  density: "medium",
  hairLength: "long",
  hairSurface: "rough",
  elasticResponse: "stretches_stays",
  chemicalTreatments: ["colored"],
  scalpOiliness: "balanced",
  goals: ["moisture"],
  currentConcerns: ["dry_lengths"],
  source: {
    kind: "legacy_quiz",
    version: 1,
    leadId: "lead-incomplete-legacy",
    raw: {
      kind: "legacy_quiz",
      version: 1,
      leadId: "lead-incomplete-legacy",
      answers: {},
    },
  },
}

test("toStage1Source throws UserFactsIncompleteError for an edited legacy record missing scalpConcerns", () => {
  assert.throws(
    () =>
      toStage1Source({
        diagnostics: LEGACY_DIAGNOSTICS_MISSING_SCALP_CONCERNS,
        editedAt: "2026-09-16T00:00:00.000Z",
      }),
    (error: unknown) => {
      assert.ok(error instanceof UserFactsIncompleteError)
      assert.deepEqual(error.missingFields, ["scalpConcerns"])
      return true
    },
  )
})

test("toStage1Source unedited path still returns raw for the same partial (missing texture) diagnostics", () => {
  const raw = toStage1Source({ diagnostics: V3_DIAGNOSTICS_MISSING_TEXTURE, editedAt: null })
  assert.deepEqual(raw, V3_DIAGNOSTICS_MISSING_TEXTURE.source.raw)
})

test("toStage1Source unedited path still returns raw for the same partial (missing scalpConcerns) legacy diagnostics", () => {
  const raw = toStage1Source({
    diagnostics: LEGACY_DIAGNOSTICS_MISSING_SCALP_CONCERNS,
    editedAt: undefined,
  })
  assert.deepEqual(raw, LEGACY_DIAGNOSTICS_MISSING_SCALP_CONCERNS.source.raw)
})
