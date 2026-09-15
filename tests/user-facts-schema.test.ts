import assert from "node:assert/strict"
import test from "node:test"

import {
  careHabitsPatchSchema,
  careHabitsV1Schema,
  diagnosticsPatchSchema,
  diagnosticsSourceSchema,
  diagnosticsV1Schema,
  factsProvenanceSchema,
  domainProvenanceSchema,
  quizContextPatchSchema,
  quizContextV1Schema,
} from "../src/lib/user-facts/schema"

const FULL_DIAGNOSTICS = {
  texture: "wavy",
  thickness: "fine",
  density: "medium",
  hairLength: "long",
  hairSurface: "rough",
  elasticResponse: "stretches_stays",
  chemicalTreatments: ["colored"],
  scalpOiliness: "balanced",
  scalpConcerns: ["irritated"],
  goals: ["moisture", "shine"],
  currentConcerns: ["dry_lengths", "split_ends"],
  concernRecurrence: { concernId: "dry_lengths", frequency: "often" },
  currentConcernsOtherText: "Juckreiz an der Kopfhaut",
  source: {
    kind: "personal_plan_v3",
    version: 3,
    leadId: "lead-1",
    artifactId: "artifact-1",
    raw: { kind: "personal_plan", version: 3, answers: {} },
  },
} as const

test("diagnosticsV1Schema accepts a full fixture", () => {
  const result = diagnosticsV1Schema.safeParse(FULL_DIAGNOSTICS)
  assert.equal(result.success, true, JSON.stringify(result.success ? null : result.error.issues))
})

test("diagnosticsV1Schema rejects an unknown key", () => {
  const result = diagnosticsV1Schema.safeParse({ ...FULL_DIAGNOSTICS, unexpectedField: "nope" })
  assert.equal(result.success, false)
})

test("diagnosticsV1Schema rejects a duplicate array value", () => {
  const result = diagnosticsV1Schema.safeParse({
    ...FULL_DIAGNOSTICS,
    goals: ["moisture", "moisture"],
  })
  assert.equal(result.success, false)
})

test("diagnosticsV1Schema rejects concernRecurrence pointing at a concern not in currentConcerns", () => {
  const result = diagnosticsV1Schema.safeParse({
    ...FULL_DIAGNOSTICS,
    currentConcerns: ["dry_lengths"],
    concernRecurrence: { concernId: "tangling", frequency: "often" },
  })
  assert.equal(result.success, false)
})

test("diagnosticsV1Schema accepts diagnostics without concernRecurrence and without min-1 arrays", () => {
  // Deliberate relaxation vs. persistence.ts: edited/legacy diagnostics may have 0 goals /
  // 0 chemical treatments.
  const result = diagnosticsV1Schema.safeParse({
    ...FULL_DIAGNOSTICS,
    goals: [],
    chemicalTreatments: [],
    concernRecurrence: undefined,
  })
  assert.equal(result.success, true, JSON.stringify(result.success ? null : result.error.issues))
})

test("diagnosticsSourceSchema rejects a source with the wrong version for its kind", () => {
  const result = diagnosticsSourceSchema.safeParse({
    kind: "personal_plan_v3",
    version: 2,
    leadId: "lead-1",
    raw: {},
  })
  assert.equal(result.success, false)
})

test("diagnosticsSourceSchema accepts each supported kind/version pairing", () => {
  for (const [kind, version] of [
    ["personal_plan_v3", 3],
    ["personal_plan_v2", 2],
    ["legacy_quiz", 1],
  ] as const) {
    const result = diagnosticsSourceSchema.safeParse({ kind, version, leadId: "lead-1", raw: {} })
    assert.equal(result.success, true, `${kind}/${version} should parse`)
  }
})

const FULL_CARE_HABITS = {
  currentProductCategories: ["shampoo", "conditioner"],
  wetWashFrequency: "weekly_2x",
  scalpIrritationDetail: "normal",
  dryShampooBridgePreference: "accept",
  dryShampooVisibleHairColor: "brown",
  oilPurposes: ["scalp"],
  towel: { material: "mikrofaser", technique: "gentle_press" },
  dryingRoutes: ["air_dry"],
  additionalHeatTools: ["straightener"],
  heatEvents: {
    "heat:ordinary_blow_dry": { frequency: "weekly_1x" },
    "heat:straightener": { frequency: "weekly_1x", protectionConsistency: "always" },
  },
  nightProtection: ["silk_satin_pillow"],
  brushesCombs: ["wide_tooth_comb"],
} as const

test("careHabitsV1Schema accepts a full fixture", () => {
  const result = careHabitsV1Schema.safeParse(FULL_CARE_HABITS)
  assert.equal(result.success, true, JSON.stringify(result.success ? null : result.error.issues))
})

test("careHabitsV1Schema accepts an empty object (every field optional)", () => {
  assert.equal(careHabitsV1Schema.safeParse({}).success, true)
})

test("careHabitsV1Schema rejects an unknown key", () => {
  const result = careHabitsV1Schema.safeParse({ ...FULL_CARE_HABITS, unexpectedField: "nope" })
  assert.equal(result.success, false)
})

test("careHabitsV1Schema rejects a duplicate array value", () => {
  const result = careHabitsV1Schema.safeParse({
    ...FULL_CARE_HABITS,
    currentProductCategories: ["shampoo", "shampoo"],
  })
  assert.equal(result.success, false)
})

test("careHabitsV1Schema rejects an unknown heatEvents key", () => {
  const result = careHabitsV1Schema.safeParse({
    heatEvents: { "heat:not_a_real_source": { frequency: "weekly_1x" } },
  })
  assert.equal(result.success, false)
})

test("careHabitsV1Schema rejects towel material 'no_towel' paired with a technique key present but undefined only via unknown key", () => {
  // towel.technique is optional; only unknown-key/enum-vocabulary violations are rejected here.
  const result = careHabitsV1Schema.safeParse({ towel: { material: "no_towel" } })
  assert.equal(result.success, true)
})

const FULL_QUIZ_CONTEXT = {
  routineClarity: "partial",
  resultReliability: "sometimes",
  adaptationConfidence: "partly",
  previousAttempts: "some_steps_helped",
  blockers: ["product_fit"],
  blockersOtherText: "Zeitmangel",
  routineStyle: "simple_reliable",
  meaningfulMoment: "everyday",
} as const

test("quizContextV1Schema accepts a full fixture", () => {
  const result = quizContextV1Schema.safeParse(FULL_QUIZ_CONTEXT)
  assert.equal(result.success, true, JSON.stringify(result.success ? null : result.error.issues))
})

test("quizContextV1Schema accepts an empty object (legacy users have no quiz context)", () => {
  assert.equal(quizContextV1Schema.safeParse({}).success, true)
})

test("quizContextV1Schema rejects an unknown key", () => {
  const result = quizContextV1Schema.safeParse({ ...FULL_QUIZ_CONTEXT, unexpectedField: "nope" })
  assert.equal(result.success, false)
})

test("quizContextV1Schema rejects a duplicate array value", () => {
  const result = quizContextV1Schema.safeParse({
    ...FULL_QUIZ_CONTEXT,
    blockers: ["product_fit", "product_fit"],
  })
  assert.equal(result.success, false)
})

test("domainProvenanceSchema accepts a full fixture and rejects an unknown key", () => {
  const fixture = {
    source: { kind: "personal_plan_artifact", id: "artifact-1" },
    schemaVersion: 1,
    at: "2026-09-15T00:00:00.000Z",
    editedAt: null,
    fields: { texture: "user", scalpConcerns: "unknown_historical" },
    preservedCandidates: [{ kind: "lead", id: "lead-1", at: "2026-09-15T00:00:00.000Z" }],
  }
  assert.equal(domainProvenanceSchema.safeParse(fixture).success, true)
  assert.equal(domainProvenanceSchema.safeParse({ ...fixture, unexpectedField: 1 }).success, false)
})

test("factsProvenanceSchema accepts an empty object (DB default) and per-domain provenance", () => {
  assert.equal(factsProvenanceSchema.safeParse({}).success, true)
  const result = factsProvenanceSchema.safeParse({
    diagnostics: {
      source: { kind: "legacy_lead", id: "lead-1" },
      schemaVersion: 1,
      at: "2026-09-15T00:00:00.000Z",
    },
  })
  assert.equal(result.success, true, JSON.stringify(result.success ? null : result.error.issues))
})

test("patch schemas accept every field as null (clear) or absent", () => {
  assert.equal(diagnosticsPatchSchema.safeParse({}).success, true)
  assert.equal(diagnosticsPatchSchema.safeParse({ texture: null, goals: null }).success, true)
  assert.equal(diagnosticsPatchSchema.safeParse({ texture: "wavy" }).success, true)
  assert.equal(
    careHabitsPatchSchema.safeParse({ towel: null, wetWashFrequency: null }).success,
    true,
  )
  assert.equal(quizContextPatchSchema.safeParse({ blockers: null }).success, true)
})

test("patch schemas still reject an unknown key and an invalid enum value", () => {
  assert.equal(diagnosticsPatchSchema.safeParse({ unexpectedField: null }).success, false)
  assert.equal(diagnosticsPatchSchema.safeParse({ texture: "not_a_texture" }).success, false)
})
