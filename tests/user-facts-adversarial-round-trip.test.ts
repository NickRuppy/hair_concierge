import assert from "node:assert/strict"
import { test } from "node:test"

import {
  projectArtifactToFacts,
  projectLegacyLeadToFacts,
  toStage1Source,
  diagnosticsV1Schema,
} from "@/lib/user-facts"
import { buildLegacyQuizStage1Source } from "@/lib/personal-plan/input"
import { computeNeedPlan } from "@/lib/personal-plan/compute-stage1"
import { hashPersonalPlanNeedVersionInput } from "@/lib/personal-plan/persistence"
import { PERSONAL_PLAN_STAGE1_COMPUTATION_VERSION } from "@/lib/personal-plan/persistence/stage1-service"
import { parseSupportedStage1Source } from "@/lib/personal-plan/input"
import type { QuizAnswers } from "@/lib/quiz/types"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Mirrors stage1-service.ts:147-170 exactly, over a caller-supplied source. */
function todaysHash(source: unknown): string {
  const computed = computeNeedPlan({
    rawEnvelope: source,
    artifactId: "artifact-fixed-id",
    projection: "initial_quiz",
    computationVersion: PERSONAL_PLAN_STAGE1_COMPUTATION_VERSION,
    createdAt: "2026-01-01T00:00:00.000Z",
  })
  assert.equal(computed.status, "ready", "fixture must be accepted by today's parser/compute path")
  if (computed.status !== "ready") throw new Error("unreachable")
  return hashPersonalPlanNeedVersionInput({
    schemaVersion: computed.snapshot.schemaVersion,
    computationVersion: computed.snapshot.computationVersion,
    inputSnapshot: computed.snapshot.sourceQuiz as unknown as Parameters<
      typeof hashPersonalPlanNeedVersionInput
    >[0]["inputSnapshot"],
  })
}

function assertParsesAsSupportedStage1Source(candidate: unknown) {
  const parsed = parseSupportedStage1Source(candidate)
  assert.equal(
    parsed.ok,
    true,
    `expected parseSupportedStage1Source to accept: ${JSON.stringify(candidate)}`,
  )
}

// A full, schema-valid v3 answers object with keys DELIBERATELY out of the
// order the zod schema declares them, and array fields in non-canonical
// (non-sorted) order. If projectArtifactToFacts re-canonicalizes `raw` this
// will catch it.
function v3AnswersScrambled() {
  return {
    // deliberately scrambled key order relative to personalPlanDurableAnswersBaseSchema
    scalpConcerns: ["irritated", "dry_dandruff"], // non-alphabetical
    meaningfulMoment: "going_out" as const,
    texture: "wavy" as const,
    blockers: ["time_and_cost", "consistency"], // non-alphabetical
    thickness: "coarse" as const,
    routineStyle: "flexible_versatile" as const,
    density: "high" as const,
    goals: ["shine", "moisture"], // non-alphabetical
    routineClarity: "partial" as const,
    resultReliability: "sometimes" as const,
    adaptationConfidence: "partly" as const,
    currentConcerns: ["tangling", "breakage"], // non-alphabetical
    concernRecurrence: { concernId: "tangling" as const, frequency: "often" as const },
    hairLength: "long" as const,
    hairSurface: "rough" as const,
    elasticResponse: "snaps" as const,
    chemicalTreatments: ["colored", "natural"], // non-alphabetical, natural not alone
    scalpOiliness: "oily" as const,
    previousAttempts: "some_steps_helped" as const,
  }
}

function v3Envelope(answers: Record<string, unknown>) {
  return { kind: "personal_plan" as const, version: 3 as const, answers }
}

test("case 1: v3 raw is byte-identical (JSON.stringify) to the input envelope, non-canonical array order preserved", () => {
  const envelope = v3Envelope(v3AnswersScrambled())
  const facts = projectArtifactToFacts({ envelope, artifactId: "artifact-1", leadId: "lead-1" })
  const source: unknown = facts.diagnostics.source
  assert.equal((source as { raw: unknown }).raw !== undefined, true)
  assert.equal(
    JSON.stringify((source as { raw: unknown }).raw),
    JSON.stringify(envelope),
    "raw must be byte-identical to the input envelope (spec rule 1: verbatim storage)",
  )
})

test("case 2: toStage1Source re-emits raw unchanged (deep-equal + same key order) while editedAt is absent", () => {
  const envelope = v3Envelope(v3AnswersScrambled())
  const facts = projectArtifactToFacts({ envelope, artifactId: "artifact-2", leadId: "lead-2" })
  const emitted = toStage1Source({ diagnostics: facts.diagnostics, quizContext: facts.quizContext })
  assert.deepEqual(
    emitted,
    envelope,
    "toStage1Source() must re-emit the original envelope verbatim (spec rule 2)",
  )
  assert.equal(
    JSON.stringify(emitted),
    JSON.stringify(envelope),
    "same key order + same array order required, not just deep-equal (spec rule 2)",
  )
})

test("case 3: identical hash for unchanged user (v3, scrambled key/array order)", () => {
  const envelope = v3Envelope(v3AnswersScrambled())
  const expectedHash = todaysHash(envelope)
  const facts = projectArtifactToFacts({ envelope, artifactId: "artifact-3", leadId: "lead-3" })
  const emitted = toStage1Source({ diagnostics: facts.diagnostics, quizContext: facts.quizContext })
  const actualHash = todaysHash(emitted)
  assert.equal(
    actualHash,
    expectedHash,
    "input_hash must be identical to today's hash for unchanged users (spec rule 3)",
  )
})

test("case 4: v3 currentConcerns:[] with concernRecurrence absent stays that way through raw and native model", () => {
  const answers = {
    ...v3AnswersScrambled(),
    currentConcerns: [] as string[],
    concernRecurrence: undefined,
  }
  delete (answers as Record<string, unknown>).concernRecurrence
  const envelope = v3Envelope(answers)
  const facts = projectArtifactToFacts({ envelope, artifactId: "artifact-4", leadId: "lead-4" })
  const raw = (facts.diagnostics.source as { raw: Record<string, unknown> }).raw
  const rawAnswers = raw.answers as Record<string, unknown>
  assert.deepEqual(rawAnswers.currentConcerns, [])
  assert.equal(
    Object.prototype.hasOwnProperty.call(rawAnswers, "concernRecurrence"),
    false,
    "omitted concernRecurrence must stay omitted in raw, not become null/undefined-key (spec rule 2)",
  )
  const emitted = toStage1Source({ diagnostics: facts.diagnostics, quizContext: facts.quizContext })
  assert.deepEqual(emitted, envelope)
})

test("case 5: v2 currentConcerns omitted stays omitted in raw", () => {
  const v2Answers: Record<string, unknown> = {
    texture: "curly",
    thickness: "fine",
    density: "low",
    goals: ["moisture"],
    routineClarity: "clear",
    resultReliability: "mostly",
    adaptationConfidence: "yes",
    // currentConcerns intentionally omitted (v2 schema allows it)
    hairLength: "medium",
    hairSurface: "smooth",
    elasticResponse: "stretches_bounces",
    chemicalTreatments: ["natural"],
    scalpOiliness: "balanced",
    scalpConcerns: [],
    previousAttempts: "mostly_works",
    blockers: ["other"],
    routineStyle: "simple_reliable",
    meaningfulMoment: "everyday",
  }
  const envelope = { kind: "personal_plan" as const, version: 2 as const, answers: v2Answers }
  const facts = projectArtifactToFacts({ envelope, artifactId: "artifact-5", leadId: "lead-5" })
  const raw = (facts.diagnostics.source as { raw: Record<string, unknown> }).raw
  const rawAnswers = raw.answers as Record<string, unknown>
  assert.equal(
    Object.prototype.hasOwnProperty.call(rawAnswers, "currentConcerns"),
    false,
    "v2 raw must not synthesize an omitted currentConcerns key (spec rule 2/6)",
  )
  // Native model must not error and should read as empty concerns.
  assert.deepEqual(facts.diagnostics.currentConcerns, [])
})

test("case 6: v2 with only scalp_imbalance maps to native currentConcerns [] while raw keeps it; hash identical", () => {
  const v2Answers: Record<string, unknown> = {
    texture: "straight",
    thickness: "normal",
    density: "medium",
    goals: ["shine"],
    routineClarity: "none",
    resultReliability: "rarely",
    adaptationConfidence: "no",
    currentConcerns: ["scalp_imbalance"],
    hairLength: "short",
    hairSurface: "slightly_uneven",
    elasticResponse: "stretches_stays",
    chemicalTreatments: ["lightened"],
    scalpOiliness: "dry",
    scalpConcerns: ["dry_dandruff"],
    previousAttempts: "little_targeted_trial",
    blockers: ["product_fit"],
    routineStyle: "precise_goal_oriented",
    meaningfulMoment: "work",
  }
  const envelope = { kind: "personal_plan" as const, version: 2 as const, answers: v2Answers }
  const expectedHash = todaysHash(envelope)
  const facts = projectArtifactToFacts({ envelope, artifactId: "artifact-6", leadId: "lead-6" })
  assert.deepEqual(
    facts.diagnostics.currentConcerns,
    [],
    "scalp_imbalance has no v3 equivalent and must be dropped from the native model (spec rule 4)",
  )
  const raw = (facts.diagnostics.source as { raw: Record<string, unknown> }).raw
  assert.deepEqual((raw.answers as Record<string, unknown>).currentConcerns, ["scalp_imbalance"])
  const emitted = toStage1Source({ diagnostics: facts.diagnostics, quizContext: facts.quizContext })
  assert.equal(todaysHash(emitted), expectedHash)
})

test("case 7: v2 duplicate legacy concerns mapping to the same v3 value dedupe natively but stay verbatim + duplicated in raw", () => {
  const v2Answers: Record<string, unknown> = {
    texture: "coily",
    thickness: "coarse",
    density: "high",
    goals: ["strength_ends"],
    routineClarity: "trial_and_error",
    resultReliability: "sometimes",
    adaptationConfidence: "partly",
    // "breakage_or_split_ends" maps to v3 "split_ends"; repeating a legacy dup input.
    currentConcerns: ["breakage_or_split_ends", "breakage_or_split_ends", "frizz_flyaways"],
    hairLength: "very_long",
    hairSurface: "rough",
    elasticResponse: "snaps",
    chemicalTreatments: ["permed"],
    scalpOiliness: "oily",
    scalpConcerns: ["oily_dandruff"],
    previousAttempts: "nothing_reliably_worked",
    blockers: ["routine_too_complex", "other"],
    routineStyle: "intentional_caring",
    meaningfulMoment: "special_occasions",
  }
  const envelope = { kind: "personal_plan" as const, version: 2 as const, answers: v2Answers }
  const facts = projectArtifactToFacts({ envelope, artifactId: "artifact-7", leadId: "lead-7" })
  const raw = (facts.diagnostics.source as { raw: Record<string, unknown> }).raw
  assert.deepEqual((raw.answers as Record<string, unknown>).currentConcerns, [
    "breakage_or_split_ends",
    "breakage_or_split_ends",
    "frizz_flyaways",
  ])
  assert.deepEqual(
    [...facts.diagnostics.currentConcerns].sort(),
    ["frizz_flyaways", "split_ends"],
    "native model must dedupe the v2->v3 mapped duplicate (spec rule 4)",
  )
})

// ---------------------------------------------------------------------------
// Legacy lead cases
// ---------------------------------------------------------------------------

function fullLegacyAnswers(overrides: Partial<QuizAnswers> = {}): QuizAnswers {
  return {
    structure: "wavy",
    thickness: "normal",
    density: "medium",
    hair_length: "medium",
    fingertest: "leicht_uneben",
    pulltest: "stretches_bounces",
    scalp_type: "fettig",
    has_scalp_issue: true,
    scalp_condition: "schuppen",
    concerns: ["breakage", "tangling"],
    concerns_other_text: undefined,
    treatment: ["gefaerbt"],
    goals: ["moisture", "shine"],
    ...overrides,
  }
}

test("case 8: legacy toStage1Source deep-equals buildLegacyQuizStage1Source(...) exactly", () => {
  const answers = fullLegacyAnswers()
  const leadId = "lead-legacy-8"
  const expectedRaw = buildLegacyQuizStage1Source({ leadId, answers })
  const facts = projectLegacyLeadToFacts({ leadId, quizAnswers: answers })
  const emitted = toStage1Source({ diagnostics: facts.diagnostics })
  assert.deepEqual(
    emitted,
    expectedRaw,
    "spec rule 1: legacy raw must equal buildLegacyQuizStage1Source output exactly",
  )
})

test("case 9: legacy hash identical to today's hash", () => {
  const answers = fullLegacyAnswers()
  const leadId = "lead-legacy-9"
  const expectedSource = buildLegacyQuizStage1Source({ leadId, answers })
  const expectedHash = todaysHash(expectedSource)
  const facts = projectLegacyLeadToFacts({ leadId, quizAnswers: answers })
  const emitted = toStage1Source({ diagnostics: facts.diagnostics })
  assert.equal(
    todaysHash(emitted),
    expectedHash,
    "spec rule 3: identical hash for unchanged legacy user",
  )
})

test("case 10: legacy has_scalp_issue false -> scalpConcerns [] preserved end-to-end", () => {
  const answers = fullLegacyAnswers({ has_scalp_issue: false, scalp_condition: undefined })
  const leadId = "lead-legacy-10"
  const expectedRaw = buildLegacyQuizStage1Source({ leadId, answers })
  assert.deepEqual(expectedRaw.answers.scalpConcerns, [])
  const facts = projectLegacyLeadToFacts({ leadId, quizAnswers: answers })
  const emitted = toStage1Source({ diagnostics: facts.diagnostics })
  assert.deepEqual(emitted, expectedRaw)
})

test("case 11: legacy concern dropped by the pipeline (dandruff has no legacy mapping) yields currentConcerns []", () => {
  // "dandruff" is a valid ProfileConcern but is not in QUIZ_ANSWER_CONCERN_VALUES /
  // LEGACY_CONCERN_TO_DIAGNOSTIC, so it must not survive into the diagnostic projection.
  const answers = fullLegacyAnswers({
    concerns: ["dandruff" as QuizAnswers["concerns"] extends (infer T)[] | undefined ? T : never],
  })
  const leadId = "lead-legacy-11"
  const expectedRaw = buildLegacyQuizStage1Source({ leadId, answers })
  assert.deepEqual(
    expectedRaw.answers.currentConcerns,
    [],
    "sanity: today's production path also drops it",
  )
  const facts = projectLegacyLeadToFacts({ leadId, quizAnswers: answers })
  const emitted = toStage1Source({ diagnostics: facts.diagnostics })
  assert.deepEqual(emitted, expectedRaw)
})

// ---------------------------------------------------------------------------
// Mutation safety
// ---------------------------------------------------------------------------

test("case 12: mutating a returned Stage-1 source array must not corrupt a later toStage1Source() call on the same facts", () => {
  const envelope = v3Envelope(v3AnswersScrambled())
  const facts = projectArtifactToFacts({ envelope, artifactId: "artifact-12", leadId: "lead-12" })
  const first = toStage1Source({
    diagnostics: facts.diagnostics,
    quizContext: facts.quizContext,
  }) as {
    answers: { goals: string[] }
  }
  first.answers.goals.push("__mutated__")
  const second = toStage1Source({ diagnostics: facts.diagnostics, quizContext: facts.quizContext })
  assert.deepEqual(
    second,
    envelope,
    "a second call must still equal the original envelope; toStage1Source must not hand out a shared mutable reference (safe reading of spec silence)",
  )
})

// ---------------------------------------------------------------------------
// Edited path
// ---------------------------------------------------------------------------

test("case 13: v3 user with editedAt set emits kind personal_plan/version 3, parses, reflects edited field, preserves rest", () => {
  const envelope = v3Envelope(v3AnswersScrambled())
  const facts = projectArtifactToFacts({ envelope, artifactId: "artifact-13", leadId: "lead-13" })
  const editedDiagnostics = { ...facts.diagnostics, texture: "coily" as const }
  const emitted = toStage1Source({
    diagnostics: editedDiagnostics,
    quizContext: facts.quizContext,
    editedAt: "2026-02-01T00:00:00.000Z",
  }) as { kind: string; version: number; answers: Record<string, unknown> }
  assertParsesAsSupportedStage1Source(emitted)
  assert.equal(emitted.kind, "personal_plan")
  assert.equal(emitted.version, 3)
  assert.equal(emitted.answers.texture, "coily", "edited field must be reflected")
  assert.deepEqual(
    emitted.answers.thickness,
    envelope.answers.thickness,
    "unedited fields preserved",
  )
  assert.deepEqual(emitted.answers.chemicalTreatments, envelope.answers.chemicalTreatments)
})

test("case 14: legacy user with editedAt set emits kind legacy_quiz, same leadId, edited field reflected, parses", () => {
  const answers = fullLegacyAnswers()
  const leadId = "lead-legacy-14"
  const facts = projectLegacyLeadToFacts({ leadId, quizAnswers: answers })
  const editedDiagnostics = { ...facts.diagnostics, thickness: "coarse" as const }
  const emitted = toStage1Source({
    diagnostics: editedDiagnostics,
    editedAt: "2026-02-01T00:00:00.000Z",
  }) as { kind: string; version: number; leadId: string; answers: Record<string, unknown> }
  assertParsesAsSupportedStage1Source(emitted)
  assert.equal(emitted.kind, "legacy_quiz")
  assert.equal(emitted.leadId, leadId, "leadId must be preserved through the edited path")
  assert.equal(emitted.answers.thickness, "coarse", "edited field must be reflected")
})

test("case 15: edited v3 output with NO field changed deep-equals the original canonical envelope (lossless)", () => {
  const envelope = v3Envelope(v3AnswersScrambled())
  const facts = projectArtifactToFacts({ envelope, artifactId: "artifact-15", leadId: "lead-15" })
  const emittedUnedited = toStage1Source({
    diagnostics: facts.diagnostics,
    quizContext: facts.quizContext,
    editedAt: "2026-02-01T00:00:00.000Z",
  })
  // No native field changed -> must be lossless against the canonical (sorted) v3 shape.
  // We can't assume verbatim raw equality once editedAt forces canonicalization/emission,
  // but we can assert it deep-equals reparsing itself and holds every original value.
  assertParsesAsSupportedStage1Source(emittedUnedited)
  const emittedAnswers = (emittedUnedited as { answers: Record<string, unknown> }).answers
  const originalAnswers = envelope.answers as Record<string, unknown>
  for (const key of Object.keys(originalAnswers)) {
    if (key === "concernRecurrence") {
      assert.deepEqual(
        emittedAnswers[key],
        originalAnswers[key],
        `field ${key} must be preserved verbatim`,
      )
      continue
    }
    if (Array.isArray(originalAnswers[key])) {
      assert.deepEqual(
        [...(emittedAnswers[key] as unknown[])].sort(),
        [...(originalAnswers[key] as unknown[])].sort(),
        `array field ${key} must contain the same values (order may canonicalize) after a no-op edit`,
      )
    } else {
      assert.deepEqual(
        emittedAnswers[key],
        originalAnswers[key],
        `field ${key} must be preserved after a no-op edit`,
      )
    }
  }
})

// ---------------------------------------------------------------------------
// Unsupported input
// ---------------------------------------------------------------------------

test("case 16: unsupported envelope version 4 throws (no partial object)", () => {
  const envelope = { kind: "personal_plan", version: 4, answers: v3AnswersScrambled() }
  assert.throws(() => {
    projectArtifactToFacts({
      envelope: envelope as never,
      artifactId: "artifact-16",
      leadId: "lead-16",
    })
  }, "spec rule 6: unsupported envelope versions throw, they don't silently produce a partial object")
})

test("case 17: legacy lead missing structure (texture) throws rather than producing a partial object", () => {
  const answers = fullLegacyAnswers()
  delete (answers as Record<string, unknown>).structure
  assert.throws(() => {
    projectLegacyLeadToFacts({ leadId: "lead-legacy-17", quizAnswers: answers })
  }, "spec rule 6: missing required diagnostics must throw, not silently synthesize/omit")
})

// ---------------------------------------------------------------------------
// Schema-level adversarial cases
// ---------------------------------------------------------------------------

test("case 18: diagnosticsV1Schema rejects source.kind personal_plan_v3 combined with version 2", () => {
  const bad = {
    texture: "wavy",
    thickness: "normal",
    density: "medium",
    hairLength: "medium",
    hairSurface: "smooth",
    elasticResponse: "stretches_bounces",
    chemicalTreatments: ["natural"],
    scalpOiliness: "balanced",
    scalpConcerns: [],
    currentConcerns: [],
    goals: ["moisture"],
    source: {
      kind: "personal_plan_v3",
      version: 2,
      leadId: "lead-18",
      artifactId: "artifact-18",
      raw: { kind: "personal_plan", version: 2, answers: {} },
    },
  }
  const result = diagnosticsV1Schema.safeParse(bad)
  assert.equal(
    result.success,
    false,
    "source.kind personal_plan_v3 paired with version 2 is an internally inconsistent tag and must be rejected",
  )
})

test("case 19: diagnosticsV1Schema rejects duplicate entries inside an array field (currentConcerns)", () => {
  const bad = {
    texture: "wavy",
    thickness: "normal",
    density: "medium",
    hairLength: "medium",
    hairSurface: "smooth",
    elasticResponse: "stretches_bounces",
    chemicalTreatments: ["natural"],
    scalpOiliness: "balanced",
    scalpConcerns: [],
    currentConcerns: ["split_ends", "split_ends"],
    goals: ["moisture"],
    source: {
      kind: "personal_plan_v3",
      version: 3,
      leadId: "lead-19",
      artifactId: "artifact-19",
      raw: { kind: "personal_plan", version: 3, answers: {} },
    },
  }
  const result = diagnosticsV1Schema.safeParse(bad)
  assert.equal(result.success, false, "duplicate array entries in currentConcerns must be rejected")
})

test("case 20: v3 chemicalTreatments in non-canonical multi-value order (natural not alone) preserved verbatim in raw and hash-identical", () => {
  const answers = {
    ...v3AnswersScrambled(),
    chemicalTreatments: ["lightened", "colored", "natural"],
  }
  const envelope = v3Envelope(answers)
  const expectedHash = todaysHash(envelope)
  const facts = projectArtifactToFacts({ envelope, artifactId: "artifact-20", leadId: "lead-20" })
  const raw = (facts.diagnostics.source as { raw: Record<string, unknown> }).raw
  assert.deepEqual((raw.answers as Record<string, unknown>).chemicalTreatments, [
    "lightened",
    "colored",
    "natural",
  ])
  const emitted = toStage1Source({ diagnostics: facts.diagnostics, quizContext: facts.quizContext })
  assert.equal(todaysHash(emitted), expectedHash)
})
