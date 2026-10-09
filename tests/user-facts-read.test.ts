import assert from "node:assert/strict"
import test from "node:test"

import {
  UserFactsReadError,
  loadUserFacts,
  toRefinementAnswers,
  toStage1Source,
  toStage1SourceFromFacts,
  type UserFacts,
} from "../src/lib/user-facts/read"
import {
  UserFactsIncompleteError,
  type CareHabitsV1,
  type DiagnosticsV1,
  type QuizContextV1,
} from "../src/lib/user-facts/schema"

type ReadResult = { data: Record<string, unknown> | null; error: { message: string } | null }

class FakeSupabase {
  readonly calls: { table?: string; select?: string; eq?: [string, unknown] } = {}

  constructor(private readonly result: ReadResult) {}

  from(table: string) {
    this.calls.table = table
    return {
      select: (columns: string) => {
        this.calls.select = columns
        return {
          eq: (column: string, value: unknown) => {
            this.calls.eq = [column, value]
            return {
              maybeSingle: async () => this.result,
            }
          },
        }
      },
    }
  }
}

const FULL_DIAGNOSTICS: DiagnosticsV1 = {
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
}

const FULL_CARE_HABITS: CareHabitsV1 = {
  currentProductCategories: ["shampoo", "conditioner"],
  wetWashFrequency: "weekly_2x",
  towel: { material: "mikrofaser", technique: "gentle_press" },
  dryingRoutes: ["air_dry"],
  nightProtection: ["silk_satin_pillow"],
  brushesCombs: ["wide_tooth_comb"],
}

const FULL_QUIZ_CONTEXT: QuizContextV1 = {
  routineClarity: "partial",
  resultReliability: "sometimes",
  adaptationConfidence: "partly",
  previousAttempts: "some_steps_helped",
  blockers: ["product_fit"],
  blockersOtherText: "Zeitmangel",
  routineStyle: "simple_reliable",
  meaningfulMoment: "everyday",
}

const VALID_DIAGNOSTICS_PROVENANCE = {
  source: { kind: "personal_plan_artifact" as const, id: "artifact-1" },
  schemaVersion: 1,
  at: "2026-09-15T10:00:00.000Z",
}

const FULL_ROW = {
  user_id: "user-1",
  diagnostics: FULL_DIAGNOSTICS,
  care_habits: FULL_CARE_HABITS,
  quiz_context: FULL_QUIZ_CONTEXT,
  shopping_preferences: { budget: { kind: "capped", limitEur: 15, allowExceptions: true } },
  facts_provenance: { diagnostics: VALID_DIAGNOSTICS_PROVENANCE },
  facts_revision: 4,
  density: "low",
  hair_length: null,
}

test("loadUserFacts returns null when there is no hair_profiles row", async () => {
  const db = new FakeSupabase({ data: null, error: null })
  const result = await loadUserFacts(db as never, "user-1")
  assert.equal(result, null)
  assert.equal(db.calls.table, "hair_profiles")
  assert.deepEqual(db.calls.eq, ["user_id", "user-1"])
})

test("loadUserFacts parses a full row into typed facts with revision", async () => {
  const db = new FakeSupabase({ data: FULL_ROW, error: null })
  const result = await loadUserFacts(db as never, "user-1")

  assert.deepEqual(result, {
    userId: "user-1",
    diagnostics: FULL_DIAGNOSTICS,
    careHabits: FULL_CARE_HABITS,
    quizContext: FULL_QUIZ_CONTEXT,
    shoppingPreferences: { budget: { kind: "capped", limitEur: 15, allowExceptions: true } },
    provenance: { diagnostics: VALID_DIAGNOSTICS_PROVENANCE },
    revision: 4,
    // F2: the two legacy columns the completeness defaults fall back to.
    legacyColumns: { density: "low", hair_length: null },
  })
})

test("loadUserFacts throws UserFactsReadError naming the domain and user for corrupt diagnostics JSON", async () => {
  const db = new FakeSupabase({
    data: { ...FULL_ROW, diagnostics: { ...FULL_DIAGNOSTICS, texture: "silky" } },
    error: null,
  })

  try {
    await loadUserFacts(db as never, "user-1")
    assert.fail("expected loadUserFacts to throw")
  } catch (error) {
    assert.ok(error instanceof UserFactsReadError)
    assert.match((error as Error).message, /diagnostics/)
    assert.match((error as Error).message, /user-1/)
  }
})

test("loadUserFacts: shopping_preferences is read; a null column is null (never uncapped); a corrupt one is loud", async () => {
  const selected = new FakeSupabase({ data: FULL_ROW, error: null })
  await loadUserFacts(selected as never, "user-1")
  assert.match(String(selected.calls.select), /\bshopping_preferences\b/)

  const absent = await loadUserFacts(
    new FakeSupabase({ data: { ...FULL_ROW, shopping_preferences: null }, error: null }) as never,
    "user-1",
  )
  assert.equal(absent?.shoppingPreferences, null)

  const notCollected = await loadUserFacts(
    new FakeSupabase({ data: { ...FULL_ROW, shopping_preferences: {} }, error: null }) as never,
    "user-1",
  )
  assert.deepEqual(notCollected?.shoppingPreferences, {})
  assert.equal(notCollected?.shoppingPreferences?.budget, undefined)

  await assert.rejects(
    loadUserFacts(
      new FakeSupabase({
        data: { ...FULL_ROW, shopping_preferences: { budget: { kind: "capped", limitEur: 7 } } },
        error: null,
      }) as never,
      "user-1",
    ),
    (error: Error) =>
      error instanceof UserFactsReadError && /shopping_preferences/.test(error.message),
  )
})

test("toRefinementAnswers drops brushesCombs and omits absent keys", () => {
  const careHabits = {
    wetWashFrequency: "weekly_2x" as const,
    towel: { material: "mikrofaser" as const },
    brushesCombs: ["wide_tooth_comb" as const],
  }
  const result = toRefinementAnswers({ careHabits })
  assert.deepEqual(result, {
    wetWashFrequency: "weekly_2x",
    towel: { material: "mikrofaser" },
  })
  assert.equal(Object.prototype.hasOwnProperty.call(result, "brushesCombs"), false)
})

test("toRefinementAnswers returns an empty object when careHabits is null", () => {
  assert.deepEqual(toRefinementAnswers({ careHabits: null }), {})
})

test("toStage1SourceFromFacts: unedited returns diagnostics.source.raw, edited delegates to toStage1Source, null diagnostics -> null", () => {
  const factsUnedited: UserFacts = {
    userId: "user-1",
    diagnostics: FULL_DIAGNOSTICS,
    careHabits: null,
    quizContext: FULL_QUIZ_CONTEXT,
    shoppingPreferences: null,
    provenance: {},
    revision: 1,
  }
  assert.deepEqual(toStage1SourceFromFacts(factsUnedited), FULL_DIAGNOSTICS.source.raw)

  const factsEdited: UserFacts = {
    ...factsUnedited,
    provenance: {
      diagnostics: { ...VALID_DIAGNOSTICS_PROVENANCE, editedAt: "2026-09-15T12:00:00.000Z" },
    },
  }
  const expected = toStage1Source({
    diagnostics: FULL_DIAGNOSTICS,
    quizContext: FULL_QUIZ_CONTEXT,
    editedAt: "2026-09-15T12:00:00.000Z",
  })
  assert.deepEqual(toStage1SourceFromFacts(factsEdited), expected)
  assert.notDeepEqual(toStage1SourceFromFacts(factsEdited), FULL_DIAGNOSTICS.source.raw)

  assert.equal(toStage1SourceFromFacts({ ...factsUnedited, diagnostics: null }), null)
})

// Fix round 1 (F), plan §3: a completeness default never feeds a plan calculation. An EDITED
// emission (native envelope) counts a field whose provenance is `assumed` as missing.
test("fix round 1 (F): an edited emission treats an assumed default as missing, never as an answer", () => {
  const edited = (
    fields: Record<string, "user" | "assumed" | "unknown_historical">,
  ): UserFacts => ({
    userId: "user-1",
    diagnostics: FULL_DIAGNOSTICS,
    careHabits: null,
    quizContext: FULL_QUIZ_CONTEXT,
    shoppingPreferences: null,
    provenance: {
      diagnostics: {
        ...VALID_DIAGNOSTICS_PROVENANCE,
        editedAt: "2026-09-15T12:00:00.000Z",
        fields,
      },
    },
    revision: 1,
  })

  assert.throws(
    () => toStage1SourceFromFacts(edited({ hairLength: "assumed", density: "assumed" })),
    (error: unknown) =>
      error instanceof UserFactsIncompleteError &&
      JSON.stringify([...error.missingFields].sort()) === JSON.stringify(["density", "hairLength"]),
  )
  assert.throws(
    () =>
      toStage1Source({
        diagnostics: FULL_DIAGNOSTICS,
        quizContext: null,
        editedAt: "2026-09-15T12:00:00.000Z",
        fields: { hairLength: "assumed" },
      }),
    UserFactsIncompleteError,
    "the legacy-lead branch too",
  )
  // Real answers (and historical imports) still emit.
  assert.ok(toStage1SourceFromFacts(edited({ hairLength: "user", density: "unknown_historical" })))
  // An UNEDITED record re-emits `source.raw`, which never carries a default.
  const unedited = edited({ hairLength: "assumed" })
  delete unedited.provenance.diagnostics!.editedAt
  assert.deepEqual(toStage1SourceFromFacts(unedited), FULL_DIAGNOSTICS.source.raw)
})
