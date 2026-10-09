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
  shoppingPreferencesPatchSchema,
  shoppingPreferencesV1Schema,
  USER_FACTS_DOMAINS,
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

test("diagnosticsV1Schema accepts a partial fixture with only source present (controller ruling 2026-09-15)", () => {
  // Stored diagnostics may be partial: completeness is checked at the Stage-1 boundary, not
  // here. Only `source` remains required.
  const result = diagnosticsV1Schema.safeParse({ source: FULL_DIAGNOSTICS.source })
  assert.equal(result.success, true, JSON.stringify(result.success ? null : result.error.issues))
})

test("diagnosticsV1Schema still rejects a fixture missing source", () => {
  const { source: _source, ...withoutSource } = FULL_DIAGNOSTICS
  const result = diagnosticsV1Schema.safeParse(withoutSource)
  assert.equal(result.success, false, "source remains the one required field")
})

test("diagnosticsV1Schema skips the concernRecurrence/currentConcerns refinement when either is absent", () => {
  // Ruling: the concernRecurrence subset-of-currentConcerns check only applies when BOTH are
  // present, now that currentConcerns itself is optional.
  const withoutCurrentConcerns = { ...FULL_DIAGNOSTICS } as Record<string, unknown>
  delete withoutCurrentConcerns.currentConcerns
  const result = diagnosticsV1Schema.safeParse(withoutCurrentConcerns)
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

test("diagnosticsSourceSchema accepts a legacy_columns source with or without leadId (backfill-only kind)", () => {
  assert.equal(
    diagnosticsSourceSchema.safeParse({
      kind: "legacy_columns",
      version: 1,
      leadId: "lead-1",
      raw: { hair_texture: "wavy" },
    }).success,
    true,
  )
  assert.equal(
    diagnosticsSourceSchema.safeParse({
      kind: "legacy_columns",
      version: 1,
      raw: { hair_texture: "wavy" },
    }).success,
    true,
    "leadId is optional for legacy_columns",
  )
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

test("careHabitsV1Schema accepts towel material 'no_towel' with technique omitted", () => {
  // towel.technique is optional at the schema level; production callers omit it for
  // material "no_towel" (see translateTowel in the care-habit backfill), but this schema
  // does not itself enforce that pairing.
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

test("diagnosticsPatchSchema never allows source to be cleared with null, but every other field may be", () => {
  assert.equal(
    diagnosticsPatchSchema.safeParse({ source: null }).success,
    false,
    "source is provenance-critical and must not be nullable in a patch",
  )
  assert.equal(
    diagnosticsPatchSchema.safeParse({ source: FULL_DIAGNOSTICS.source }).success,
    true,
    "source may be replaced by a full valid source envelope",
  )
  assert.equal(
    diagnosticsPatchSchema.safeParse({}).success,
    true,
    "source may be omitted (unchanged)",
  )
  assert.equal(
    diagnosticsPatchSchema.safeParse({ texture: null }).success,
    true,
    "other fields stay clearable",
  )
})

test("shopping_preferences is the fourth fact domain", () => {
  assert.deepEqual(
    [...USER_FACTS_DOMAINS],
    ["diagnostics", "care_habits", "quiz_context", "shopping_preferences"],
  )
})

test("shoppingPreferencesV1Schema: a capped budget needs limitEur 5 or 15 and allowExceptions", () => {
  for (const limitEur of [5, 15]) {
    for (const allowExceptions of [true, false]) {
      const budget = { kind: "capped", limitEur, allowExceptions }
      assert.equal(shoppingPreferencesV1Schema.safeParse({ budget }).success, true)
    }
  }
  for (const budget of [
    { kind: "capped", allowExceptions: true },
    { kind: "capped", limitEur: 15 },
    { kind: "capped", limitEur: 10, allowExceptions: true },
    { kind: "capped", limitEur: "15", allowExceptions: true },
    { kind: "capped", limitEur: 15, allowExceptions: "ja" },
    { kind: "capped", limitEur: 15, allowExceptions: true, note: "x" },
    { kind: "cheap" },
    {},
  ]) {
    assert.equal(
      shoppingPreferencesV1Schema.safeParse({ budget }).success,
      false,
      JSON.stringify(budget),
    )
  }
})

test("shoppingPreferencesV1Schema: uncapped carries no extra keys; an absent budget is valid and stays absent", () => {
  assert.equal(
    shoppingPreferencesV1Schema.safeParse({ budget: { kind: "uncapped" } }).success,
    true,
  )
  assert.equal(
    shoppingPreferencesV1Schema.safeParse({ budget: { kind: "uncapped", limitEur: 15 } }).success,
    false,
  )
  assert.equal(
    shoppingPreferencesV1Schema.safeParse({ budget: { kind: "uncapped", allowExceptions: false } })
      .success,
    false,
  )
  const empty = shoppingPreferencesV1Schema.parse({})
  assert.deepEqual(empty, {})
  assert.equal("budget" in empty, false, "absent = not collected, never defaulted to uncapped")
  assert.equal(shoppingPreferencesV1Schema.safeParse({ budget: null }).success, false)
  assert.equal(
    shoppingPreferencesV1Schema.safeParse({ marketSegment: "professional" }).success,
    false,
  )
})

test("shoppingPreferencesPatchSchema: budget may be omitted or cleared with null; unknown keys are rejected", () => {
  assert.equal(shoppingPreferencesPatchSchema.safeParse({}).success, true)
  assert.equal(shoppingPreferencesPatchSchema.safeParse({ budget: null }).success, true)
  assert.equal(
    shoppingPreferencesPatchSchema.safeParse({
      budget: { kind: "capped", limitEur: 5, allowExceptions: false },
    }).success,
    true,
  )
  assert.equal(
    shoppingPreferencesPatchSchema.safeParse({ budget: { kind: "capped", limitEur: 5 } }).success,
    false,
  )
  assert.equal(shoppingPreferencesPatchSchema.safeParse({ other: null }).success, false)
})

test("domainProvenanceSchema accepts the shopping provenance kinds; factsProvenanceSchema carries the domain", () => {
  for (const kind of ["shopping_preferences_editor", "consultation_staff"]) {
    const provenance = {
      source: { kind, id: kind === "consultation_staff" ? "enrollment-1" : undefined },
      schemaVersion: 1,
      at: "2026-10-09T10:00:00.000Z",
      fields: { budget: "user" },
    }
    assert.equal(domainProvenanceSchema.safeParse(provenance).success, true, kind)
    assert.deepEqual(
      factsProvenanceSchema.parse({ shopping_preferences: provenance }).shopping_preferences?.source
        .kind,
      kind,
    )
  }
  assert.equal(
    domainProvenanceSchema.safeParse({
      source: { kind: "market_ops" },
      schemaVersion: 1,
      at: "2026-10-09T10:00:00.000Z",
    }).success,
    false,
  )
})
