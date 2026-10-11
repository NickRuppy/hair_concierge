import assert from "node:assert/strict"
import test from "node:test"

import { quizSupersedesFacts, writeAccountLinkFacts } from "../src/lib/user-facts/account-link"
import { projectArtifactToFacts } from "../src/lib/user-facts/project-artifact"
import { projectLegacyLeadToFacts } from "../src/lib/user-facts/project-legacy-lead"
import { loadUserFacts } from "../src/lib/user-facts/read"
import { diagnosticsV1Schema, type DiagnosticsV1 } from "../src/lib/user-facts/schema"
import { COMPLETE_V3_PLAN_ENVELOPE } from "./personal-plan/fixtures"
import { pgliteAdminClient, readRow } from "./mobile-profile-facts-pglite.fixtures"
import {
  id,
  insertProfile,
  migratedPersonalPlanDatabase,
  saveUserFacts,
} from "./personal-plan-pglite-migration.fixtures"
import { simulateUserFactsSave } from "./user-facts-save-rpc.fixtures"

/**
 * Decision wave 1 (Nick, 2026-09-30): "latest own quiz wins" + completeness defaults, at the
 * shared account-link writer both `linkQuizToProfile` and `/plan-bereit` call.
 */

type Row = Record<string, unknown>

const USER_ID = "30000000-0000-4000-8000-000000000001"

function fakeAdmin(rows: Row[], options: { beforeSave?: (call: number, args: Row) => void } = {}) {
  const saves: Row[] = []
  const admin = {
    from(table: string) {
      assert.equal(table, "hair_profiles")
      let userId: unknown
      const query = {
        select: () => query,
        eq: (_column: string, value: unknown) => {
          userId = value
          return query
        },
        maybeSingle: async () => ({
          data: rows.find((row) => row.user_id === userId) ?? null,
          error: null,
        }),
      }
      return query
    },
    async rpc(fn: string, args: Row) {
      assert.equal(fn, "user_facts_save_v1")
      options.beforeSave?.(saves.length, args)
      saves.push(args)
      return { data: simulateUserFactsSave(rows, args), error: null }
    },
  }
  return { admin: admin as never, saves }
}

const COMPLETE_LEGACY_ANSWERS = {
  structure: "wavy",
  thickness: "fine",
  density: "low",
  hair_length: "medium",
  fingertest: "rau",
  pulltest: "snaps",
  scalp_type: "trocken",
  has_scalp_issue: false,
  treatment: ["gefaerbt"],
  concerns: ["frizz"],
  goals: ["moisture"],
}

/** A stored profile whose diagnostics came from an earlier artifact link at `at`. */
function artifactProfile(input: { at: string; editedAt?: string | null; revision?: number }) {
  const { diagnostics, quizContext } = projectArtifactToFacts({
    envelope: COMPLETE_V3_PLAN_ENVELOPE,
    artifactId: "artifact-old",
    leadId: "lead-old",
  })
  const stored: DiagnosticsV1 = {
    ...diagnostics,
    // Something the new legacy quiz below does not carry, so a replacement must drop it.
    concernRecurrence: undefined,
    currentConcernsOtherText: "alte Notiz",
  }
  delete stored.concernRecurrence
  return {
    user_id: USER_ID,
    diagnostics: stored,
    quiz_context: quizContext,
    facts_revision: input.revision ?? 4,
    facts_provenance: {
      diagnostics: {
        source: { kind: "personal_plan_artifact", id: "artifact-old" },
        schemaVersion: 1,
        at: input.at,
        ...(input.editedAt !== undefined ? { editedAt: input.editedAt } : {}),
        fields: { texture: "user", goals: "user" },
      },
    },
  } as Row
}

const LEGACY_LEAD_QUIZ = (createdAt: string) => ({
  kind: "lead" as const,
  leadId: "lead-new",
  quizAnswers: COMPLETE_LEGACY_ANSWERS as never,
  createdAt,
})

// --- the decision itself ------------------------------------------------------------

test("quizSupersedesFacts: no facts, no diagnostics and a legacy_columns document all let the quiz write", () => {
  assert.equal(quizSupersedesFacts(null, "2020-01-01T00:00:00.000Z"), true)
  assert.equal(
    quizSupersedesFacts({ diagnostics: null, provenance: {} }, "2020-01-01T00:00:00.000Z"),
    true,
  )
  const legacyColumns = {
    diagnostics: {
      texture: "coily",
      source: { kind: "legacy_columns", version: 1, raw: {} },
    } as DiagnosticsV1,
    provenance: {
      diagnostics: {
        source: { kind: "legacy_columns" as const },
        schemaVersion: 1,
        at: "2026-09-20T00:00:00.000Z",
      },
    },
  }
  // No quiz behind it and no hand edit: the backfill run time is no bar, any quiz wins.
  assert.equal(quizSupersedesFacts(legacyColumns, "2025-01-01T00:00:00.000Z"), true)
  assert.equal(quizSupersedesFacts(legacyColumns, null), true)
})

test("F3: a hand edit counts on a legacy_columns profile too", () => {
  const legacyColumns = (editedAt: string) => ({
    diagnostics: {
      texture: "coily",
      source: { kind: "legacy_columns", version: 1, raw: {} },
    } as DiagnosticsV1,
    provenance: {
      diagnostics: {
        source: { kind: "legacy_columns" as const },
        schemaVersion: 1,
        at: "2026-09-20T00:00:00.000Z",
        editedAt,
      },
    },
  })
  const edited = legacyColumns("2026-09-22T00:00:00.000Z")
  assert.equal(quizSupersedesFacts(edited, "2026-09-21T00:00:00.000Z"), false, "edit is newer")
  assert.equal(quizSupersedesFacts(edited, "2026-09-22T00:00:00.000Z"), false, "same instant")
  assert.equal(quizSupersedesFacts(edited, "2026-09-23T00:00:00.000Z"), true, "retook the quiz")
  assert.equal(quizSupersedesFacts(edited, null), false, "unknown quiz time never beats an edit")
})

test("F1: newer means when the quiz was TAKEN — the stored source.takenAt, not the link time", () => {
  const facts = (takenAt: string | undefined, at: string, editedAt?: string) => ({
    diagnostics: {
      texture: "wavy",
      source: {
        kind: "legacy_quiz",
        version: 1,
        leadId: "l",
        raw: {},
        ...(takenAt ? { takenAt } : {}),
      },
    } as DiagnosticsV1,
    provenance: {
      diagnostics: {
        source: { kind: "legacy_lead" as const, id: "l" },
        schemaVersion: 1,
        at,
        ...(editedAt ? { editedAt } : {}),
      },
    },
  })
  // Quiz taken Tuesday, linked Thursday.
  const tuesday = "2026-09-22T09:00:00.000Z"
  const thursday = "2026-09-24T09:00:00.000Z"
  const linked = facts(tuesday, thursday)
  assert.equal(quizSupersedesFacts(linked, "2026-09-23T09:00:00.000Z"), true, "taken Wednesday")
  assert.equal(quizSupersedesFacts(linked, "2026-09-21T09:00:00.000Z"), false, "taken Monday")
  assert.equal(quizSupersedesFacts(linked, tuesday), false, "the same quiz is not newer")
  // A hand edit still moves the bar past the stored quiz time.
  const edited = facts(tuesday, thursday, "2026-09-25T09:00:00.000Z")
  assert.equal(quizSupersedesFacts(edited, "2026-09-23T09:00:00.000Z"), false)
  assert.equal(quizSupersedesFacts(edited, "2026-09-26T09:00:00.000Z"), true)
  // No stored takenAt (facts written before F1): the provenance time is the fallback.
  const legacy = facts(undefined, thursday)
  assert.equal(quizSupersedesFacts(legacy, "2026-09-23T09:00:00.000Z"), false)
  assert.equal(quizSupersedesFacts(legacy, "2026-09-25T09:00:00.000Z"), true)
})

test("quizSupersedesFacts compares the quiz time against the later of at and editedAt", () => {
  const facts = (at: string, editedAt?: string | null) => ({
    diagnostics: {
      texture: "wavy",
      source: { kind: "legacy_quiz", version: 1, leadId: "l", raw: {} },
    } as DiagnosticsV1,
    provenance: {
      diagnostics: {
        source: { kind: "legacy_lead" as const, id: "l" },
        schemaVersion: 1,
        at,
        editedAt,
      },
    },
  })
  const at = "2026-09-10T00:00:00.000Z"
  assert.equal(quizSupersedesFacts(facts(at), "2026-09-11T00:00:00.000Z"), true, "newer wins")
  assert.equal(quizSupersedesFacts(facts(at), "2026-09-09T00:00:00.000Z"), false, "older loses")
  assert.equal(quizSupersedesFacts(facts(at), at), false, "same instant is not newer")
  // A later hand edit moves the bar.
  const edited = facts(at, "2026-09-20T00:00:00.000Z")
  assert.equal(quizSupersedesFacts(edited, "2026-09-15T00:00:00.000Z"), false)
  assert.equal(quizSupersedesFacts(edited, "2026-09-21T00:00:00.000Z"), true)
  // An unknown quiz time never overwrites real facts.
  assert.equal(quizSupersedesFacts(facts(at), null), false)
  assert.equal(quizSupersedesFacts(facts(at), "not a date"), false)
})

// --- item A: the writes ---------------------------------------------------------------

test("an own newer quiz REPLACES an existing real-source profile: upsert, nulls for dropped fields, new goals and source", async () => {
  const rows = [artifactProfile({ at: "2026-09-10T00:00:00.000Z" })]
  const { admin, saves } = fakeAdmin(rows)

  const outcome = await writeAccountLinkFacts(admin, {
    userId: USER_ID,
    quiz: LEGACY_LEAD_QUIZ("2026-09-12T00:00:00.000Z"),
  })

  assert.equal(outcome, "replaced")
  // F4: diagnostics, then the previous artifact's quiz_context is cleared.
  assert.deepEqual(
    saves.map((entry) => entry.p_domain),
    ["diagnostics", "quiz_context"],
  )
  const call = saves[0]!
  assert.equal(call.p_domain, "diagnostics")
  assert.equal(call.p_mode, "upsert")
  assert.equal(call.p_expected_revision, 4, "pinned to the revision it loaded")
  const patch = call.p_patch as Row
  assert.equal(patch.currentConcernsOtherText, null, "a field the new quiz lacks is cleared")
  assert.equal(patch.concernRecurrence, null)
  assert.equal((call.p_provenance as Row).preservedCandidates, undefined)

  const expected = projectLegacyLeadToFacts({
    leadId: "lead-new",
    quizAnswers: COMPLETE_LEGACY_ANSWERS as never,
    takenAt: "2026-09-12T00:00:00.000Z",
  }).diagnostics
  const facts = await loadUserFacts(admin, USER_ID)
  assert.ok(facts?.diagnostics)
  assert.deepEqual(facts.diagnostics, expected, "the stored document IS the new projection")
  assert.deepEqual(facts.diagnostics.goals, ["moisture"], "goals come from the new quiz")
  assert.equal(facts.diagnostics.source.kind, "legacy_quiz")
  assert.deepEqual(facts.provenance.diagnostics?.source, { kind: "legacy_lead", id: "lead-new" })
  // The per-field map is rebuilt for the new document: every carried field is `user`.
  assert.equal(facts.provenance.diagnostics?.fields?.currentConcernsOtherText, undefined)
  assert.equal(facts.provenance.diagnostics?.fields?.texture, "user")
  assert.equal(facts.provenance.diagnostics?.fields?.hairLength, "user")
  assert.equal(facts.revision, 6)
})

test("F4: a winning legacy lead clears the previous artifact's quiz_context — no old answer survives", async () => {
  const rows = [artifactProfile({ at: "2026-09-10T00:00:00.000Z" })]
  assert.ok(Object.keys(rows[0]!.quiz_context as Row).length > 0, "baseline: answers stored")
  const { admin, saves } = fakeAdmin(rows)

  await writeAccountLinkFacts(admin, {
    userId: USER_ID,
    quiz: LEGACY_LEAD_QUIZ("2026-09-12T00:00:00.000Z"),
  })

  const clear = saves[1]!
  assert.equal(clear.p_domain, "quiz_context")
  assert.equal(clear.p_mode, "upsert")
  assert.equal(clear.p_expected_revision, 5, "pinned to the diagnostics write's revision")
  const patch = clear.p_patch as Row
  assert.deepEqual(Object.keys(patch).sort(), [
    "adaptationConfidence",
    "blockers",
    "blockersOtherText",
    "meaningfulMoment",
    "previousAttempts",
    "resultReliability",
    "routineClarity",
    "routineStyle",
  ])
  assert.equal(
    Object.values(patch).every((value) => value === null),
    true,
    "every field is cleared",
  )
  const facts = await loadUserFacts(admin, USER_ID)
  assert.deepEqual(facts?.quizContext, {})
  assert.deepEqual(facts?.provenance.quiz_context?.source, { kind: "legacy_lead", id: "lead-new" })
})

test("F4: a winning legacy lead on a profile without quiz_context writes diagnostics only", async () => {
  const rows = [artifactProfile({ at: "2026-09-10T00:00:00.000Z" })]
  rows[0]!.quiz_context = null
  const { admin, saves } = fakeAdmin(rows)

  await writeAccountLinkFacts(admin, {
    userId: USER_ID,
    quiz: LEGACY_LEAD_QUIZ("2026-09-12T00:00:00.000Z"),
  })
  assert.deepEqual(
    saves.map((entry) => entry.p_domain),
    ["diagnostics"],
  )
})

test("fix round 1 (D): an already-cleared {} quiz_context counts as absent — no second clearing write", async () => {
  const rows = [artifactProfile({ at: "2026-09-10T00:00:00.000Z" })]
  rows[0]!.quiz_context = {}
  const { admin, saves } = fakeAdmin(rows)

  await writeAccountLinkFacts(admin, {
    userId: USER_ID,
    quiz: LEGACY_LEAD_QUIZ("2026-09-12T00:00:00.000Z"),
  })
  assert.deepEqual(
    saves.map((entry) => entry.p_domain),
    ["diagnostics"],
  )
  assert.deepEqual(rows[0]!.quiz_context, {})
})

test("F4: an OLDER legacy lead leaves quiz_context alone", async () => {
  const rows = [artifactProfile({ at: "2026-09-10T00:00:00.000Z" })]
  const before = structuredClone(rows[0]!.quiz_context)
  const { admin, saves } = fakeAdmin(rows)

  await writeAccountLinkFacts(admin, {
    userId: USER_ID,
    quiz: LEGACY_LEAD_QUIZ("2026-09-01T00:00:00.000Z"),
  })
  assert.deepEqual(
    saves.map((entry) => [entry.p_domain, entry.p_mode]),
    [["diagnostics", "create_only"]],
  )
  assert.deepEqual(rows[0]!.quiz_context, before)
})

test("an own newer ARTIFACT also replaces quiz_context, pinned to the diagnostics write's revision", async () => {
  const rows = [artifactProfile({ at: "2026-09-10T00:00:00.000Z" })]
  ;(rows[0]!.quiz_context as Row).blockersOtherText = "alter Text"
  const { admin, saves } = fakeAdmin(rows)

  const outcome = await writeAccountLinkFacts(admin, {
    userId: USER_ID,
    quiz: {
      kind: "artifact",
      artifactId: "artifact-new",
      leadId: "lead-new",
      envelope: COMPLETE_V3_PLAN_ENVELOPE,
      createdAt: "2026-09-12T00:00:00.000Z",
    },
  })

  assert.equal(outcome, "replaced")
  assert.deepEqual(
    saves.map((call) => [call.p_domain, call.p_mode, call.p_expected_revision]),
    [
      ["diagnostics", "upsert", 4],
      ["quiz_context", "upsert", 5],
    ],
  )
  const facts = await loadUserFacts(admin, USER_ID)
  assert.equal(facts?.quizContext?.blockersOtherText, undefined, "old quiz_context field cleared")
  assert.deepEqual(facts?.provenance.quiz_context?.source, {
    kind: "personal_plan_artifact",
    id: "artifact-new",
  })
  assert.equal(
    facts?.diagnostics?.source.kind === "personal_plan_v3"
      ? facts.diagnostics.source.artifactId
      : null,
    "artifact-new",
  )
})

test("an OLDER quiz never overwrites: create_only, the candidate is recorded and the facts stay unchanged", async () => {
  const rows = [artifactProfile({ at: "2026-09-10T00:00:00.000Z" })]
  const before = structuredClone(rows[0]!.diagnostics)
  const { admin, saves } = fakeAdmin(rows)

  const outcome = await writeAccountLinkFacts(admin, {
    userId: USER_ID,
    quiz: LEGACY_LEAD_QUIZ("2026-09-01T00:00:00.000Z"),
  })

  assert.equal(outcome, "preserved")
  assert.equal(saves[0]!.p_mode, "create_only")
  const facts = await loadUserFacts(admin, USER_ID)
  assert.deepEqual(facts?.diagnostics, before)
  assert.equal(facts?.revision, 4, "a preserve bumps nothing")
  assert.deepEqual(
    facts?.provenance.diagnostics?.preservedCandidates?.map((entry) => [entry.kind, entry.id]),
    [["lead", "lead-new"]],
  )
})

test("a hand-edited profile keeps the edit against an older quiz, and loses it to a newer one", async () => {
  const at = "2026-09-10T00:00:00.000Z"
  const editedAt = "2026-09-20T00:00:00.000Z"

  const older = fakeAdmin([artifactProfile({ at, editedAt })])
  assert.equal(
    await writeAccountLinkFacts(older.admin, {
      userId: USER_ID,
      quiz: LEGACY_LEAD_QUIZ("2026-09-15T00:00:00.000Z"),
    }),
    "preserved",
    "a quiz newer than `at` but older than the edit does not win",
  )

  const newer = fakeAdmin([artifactProfile({ at, editedAt })])
  assert.equal(
    await writeAccountLinkFacts(newer.admin, {
      userId: USER_ID,
      quiz: LEGACY_LEAD_QUIZ("2026-09-21T00:00:00.000Z"),
    }),
    "replaced",
    "edited by hand, then retook the quiz: the quiz wins",
  )
  const facts = await loadUserFacts(newer.admin, USER_ID)
  assert.equal(facts?.diagnostics?.source.kind, "legacy_quiz")
  assert.equal(facts?.provenance.diagnostics?.editedAt, undefined, "the edit marker is gone")
})

test("a legacy_columns profile is replaced by a quiz regardless of timestamps (goals included)", async () => {
  const rows: Row[] = [
    {
      user_id: USER_ID,
      diagnostics: {
        texture: "coily",
        goals: ["shine"],
        density: "medium",
        source: { kind: "legacy_columns", version: 1, raw: { hair_texture: "coily" } },
      },
      facts_revision: 1,
      facts_provenance: {
        diagnostics: {
          source: { kind: "legacy_columns" },
          schemaVersion: 1,
          at: "2026-09-25T00:00:00.000Z",
          fields: {
            texture: "unknown_historical",
            goals: "unknown_historical",
            density: "assumed",
          },
        },
      },
    },
  ]
  const { admin, saves } = fakeAdmin(rows)

  const outcome = await writeAccountLinkFacts(admin, {
    userId: USER_ID,
    quiz: LEGACY_LEAD_QUIZ("2025-01-01T00:00:00.000Z"),
  })

  assert.equal(outcome, "replaced")
  assert.equal(saves[0]!.p_mode, "upsert")
  const facts = await loadUserFacts(admin, USER_ID)
  assert.equal(facts?.diagnostics?.texture, "wavy")
  assert.deepEqual(facts?.diagnostics?.goals, ["moisture"])
  assert.equal(facts?.diagnostics?.density, "low")
  // No stale backfill markers survive the replacement.
  assert.equal(facts?.provenance.diagnostics?.fields?.texture, "user")
  assert.equal(facts?.provenance.diagnostics?.fields?.goals, "user")
  assert.equal(facts?.provenance.diagnostics?.fields?.density, "user")
})

test("a revision_conflict reloads once, re-decides and then succeeds", async () => {
  const rows = [artifactProfile({ at: "2026-09-10T00:00:00.000Z" })]
  const { admin, saves } = fakeAdmin(rows, {
    beforeSave: (call) => {
      // A concurrent unrelated write (e.g. a care_habits save) lands between load and save.
      if (call === 0) rows[0]!.facts_revision = 7
    },
  })

  const outcome = await writeAccountLinkFacts(admin, {
    userId: USER_ID,
    quiz: LEGACY_LEAD_QUIZ("2026-09-12T00:00:00.000Z"),
  })

  assert.equal(outcome, "replaced")
  assert.deepEqual(
    saves.map((call) => [call.p_domain, call.p_expected_revision]),
    [
      ["diagnostics", 4],
      ["diagnostics", 7],
      // F4: then the previous artifact's quiz_context is cleared.
      ["quiz_context", 8],
    ],
  )
  assert.equal((await loadUserFacts(admin, USER_ID))?.revision, 9)
})

test("a second revision_conflict throws instead of looping", async () => {
  const rows = [artifactProfile({ at: "2026-09-10T00:00:00.000Z" })]
  const { admin } = fakeAdmin(rows, {
    beforeSave: () => {
      rows[0]!.facts_revision = (rows[0]!.facts_revision as number) + 1
    },
  })

  await assert.rejects(
    () =>
      writeAccountLinkFacts(admin, {
        userId: USER_ID,
        quiz: LEGACY_LEAD_QUIZ("2026-09-12T00:00:00.000Z"),
      }),
    /second revision_conflict/,
  )
})

test("a first link on an empty profile writes with upsert pinned to revision 0", async () => {
  const rows: Row[] = []
  const { admin, saves } = fakeAdmin(rows)

  assert.equal(
    await writeAccountLinkFacts(admin, {
      userId: USER_ID,
      quiz: LEGACY_LEAD_QUIZ("2026-09-12T00:00:00.000Z"),
    }),
    "replaced",
  )
  assert.equal(saves[0]!.p_mode, "upsert")
  assert.equal(saves[0]!.p_expected_revision, 0)
  assert.equal(diagnosticsV1Schema.safeParse(rows[0]!.diagnostics).success, true)
})

// --- fix round 6 (I2): an interrupted link resumes -------------------------------------

test("I2: B's diagnostics landed, B's context clear failed — the retry clears A's context and leaves diagnostics alone", async () => {
  const rows = [artifactProfile({ at: "2026-09-10T00:00:00.000Z" })]
  let failContext = true
  const { admin, saves } = fakeAdmin(rows, {
    beforeSave: (_call, args) => {
      if (args.p_domain === "quiz_context" && failContext) {
        failContext = false
        throw new Error("network down")
      }
    },
  })
  const quizB = LEGACY_LEAD_QUIZ("2026-09-12T00:00:00.000Z")

  await assert.rejects(
    () => writeAccountLinkFacts(admin, { userId: USER_ID, quiz: quizB }),
    /network down/,
  )
  // The half-published state: B's diagnostics next to A's quiz_context.
  assert.equal((rows[0]!.diagnostics as DiagnosticsV1).source.leadId, "lead-new")
  assert.ok(Object.keys(rows[0]!.quiz_context as Row).length > 0)
  const diagnosticsBefore = structuredClone(rows[0]!.diagnostics)
  const diagnosticsProvenanceBefore = structuredClone(
    (rows[0]!.facts_provenance as Row).diagnostics,
  )
  const before = saves.length

  assert.equal(await writeAccountLinkFacts(admin, { userId: USER_ID, quiz: quizB }), "replaced")
  assert.deepEqual(
    saves.slice(before).map((call) => [call.p_domain, call.p_mode, call.p_expected_revision]),
    [["quiz_context", "upsert", 5]],
    "one context write, pinned to the stored revision; no diagnostics write",
  )
  assert.deepEqual(rows[0]!.quiz_context, {})
  assert.deepEqual(rows[0]!.diagnostics, diagnosticsBefore)
  assert.deepEqual((rows[0]!.facts_provenance as Row).diagnostics, diagnosticsProvenanceBefore)
  assert.deepEqual((rows[0]!.facts_provenance as Row).quiz_context, {
    source: { kind: "legacy_lead", id: "lead-new" },
    schemaVersion: 1,
    at: ((rows[0]!.facts_provenance as Row).quiz_context as Row).at,
  })

  // Idempotent: a third link of B is a pure preserve with zero writes.
  const settled = saves.length
  assert.equal(await writeAccountLinkFacts(admin, { userId: USER_ID, quiz: quizB }), "preserved")
  assert.equal(saves.length, settled)
})

test("I2: an interrupted ARTIFACT link resumes by writing its own quiz context", async () => {
  const rows = [artifactProfile({ at: "2026-09-10T00:00:00.000Z" })]
  ;(rows[0]!.quiz_context as Row).blockersOtherText = "alter Text"
  let failContext = true
  const { admin, saves } = fakeAdmin(rows, {
    beforeSave: (_call, args) => {
      if (args.p_domain === "quiz_context" && failContext) {
        failContext = false
        throw new Error("network down")
      }
    },
  })
  const quizB = {
    kind: "artifact" as const,
    artifactId: "artifact-new",
    leadId: "lead-new",
    envelope: COMPLETE_V3_PLAN_ENVELOPE,
    createdAt: "2026-09-12T00:00:00.000Z",
  }
  await assert.rejects(() => writeAccountLinkFacts(admin, { userId: USER_ID, quiz: quizB }))
  const before = saves.length

  assert.equal(await writeAccountLinkFacts(admin, { userId: USER_ID, quiz: quizB }), "replaced")
  assert.deepEqual(
    saves.slice(before).map((call) => call.p_domain),
    ["quiz_context"],
  )
  const expected = projectArtifactToFacts({
    envelope: COMPLETE_V3_PLAN_ENVELOPE,
    artifactId: "artifact-new",
    leadId: "lead-new",
  }).quizContext
  assert.deepEqual(rows[0]!.quiz_context, expected)
  assert.equal(await writeAccountLinkFacts(admin, { userId: USER_ID, quiz: quizB }), "preserved")
  assert.equal(saves.length, before + 1, "the settled re-link writes nothing")
})

test("I2: a plain re-link of an unchanged source is a pure preserve with zero writes", async () => {
  const rows: Row[] = []
  const { admin, saves } = fakeAdmin(rows)
  assert.equal(
    await writeAccountLinkFacts(admin, { userId: USER_ID, quiz: tuesdayLeadQuiz() }),
    "replaced",
  )
  const settled = saves.length
  const snapshot = structuredClone(rows[0])

  assert.equal(
    await writeAccountLinkFacts(admin, { userId: USER_ID, quiz: tuesdayLeadQuiz() }),
    "preserved",
  )
  assert.equal(saves.length, settled)
  assert.deepEqual(rows[0], snapshot)
})

/** The same JSON value with every object's keys in reverse order (what a jsonb round trip may do). */
function reverseKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reverseKeys)
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Row)
        .reverse()
        .map(([key, entry]) => [key, reverseKeys(entry)]),
    )
  }
  return value
}

test("fix round 7 (C): same lead id + same takenAt but CHANGED answers is no resume — the ordinary path records the candidate", async () => {
  const rows: Row[] = []
  const { admin, saves } = fakeAdmin(rows)
  assert.equal(
    await writeAccountLinkFacts(admin, { userId: USER_ID, quiz: tuesdayLeadQuiz() }),
    "replaced",
  )
  const diagnosticsBefore = structuredClone(rows[0]!.diagnostics)
  const settled = saves.length

  // A partner-access save rewrote the lead's answers under the same id; created_at stayed.
  const changed = {
    ...tuesdayLeadQuiz(),
    quizAnswers: { ...COMPLETE_LEGACY_ANSWERS, thickness: "coarse" } as never,
  }
  assert.equal(await writeAccountLinkFacts(admin, { userId: USER_ID, quiz: changed }), "preserved")
  assert.deepEqual(
    saves.slice(settled).map((call) => [call.p_domain, call.p_mode]),
    [["diagnostics", "create_only"]],
    "not newer (same takenAt): the ordinary loser path, never the resume shortcut",
  )
  assert.deepEqual(
    ((saves[settled]!.p_provenance as Row).preservedCandidates as Row[]).map((entry) => [
      entry.kind,
      entry.id,
    ]),
    [["lead", "lead-b"]],
  )
  const facts = await loadUserFacts(admin, USER_ID)
  assert.deepEqual(
    facts?.provenance.diagnostics?.preservedCandidates?.map((entry) => [entry.kind, entry.id]),
    [["lead", "lead-b"]],
    "the changed quiz is recorded as a preserved candidate",
  )
  assert.deepEqual(rows[0]!.diagnostics, diagnosticsBefore, "the stored facts stay unchanged")
})

test("fix round 7 (C): unchanged answers whose stored raw has reordered keys still resume — zero writes", async () => {
  const rows: Row[] = []
  const { admin, saves } = fakeAdmin(rows)
  assert.equal(
    await writeAccountLinkFacts(admin, { userId: USER_ID, quiz: tuesdayLeadQuiz() }),
    "replaced",
  )
  const stored = rows[0]!.diagnostics as DiagnosticsV1
  const reordered = reverseKeys(stored.source.raw)
  assert.notEqual(
    JSON.stringify(reordered),
    JSON.stringify(stored.source.raw),
    "precondition: the key order really differs",
  )
  rows[0]!.diagnostics = { ...stored, source: { ...stored.source, raw: reordered } }
  const snapshot = structuredClone(rows[0])
  const settled = saves.length

  assert.equal(
    await writeAccountLinkFacts(admin, { userId: USER_ID, quiz: tuesdayLeadQuiz() }),
    "preserved",
  )
  assert.equal(saves.length, settled, "a settled re-link of the same quiz writes nothing")
  assert.deepEqual(rows[0], snapshot)
})

// --- F1: the quiz's own timestamp is stored and decides ---------------------------------

const MONDAY = "2026-09-21T09:00:00.000Z"
const TUESDAY = "2026-09-22T09:00:00.000Z"

function mondayArtifactQuiz() {
  return {
    kind: "artifact" as const,
    artifactId: "artifact-a",
    leadId: "lead-a",
    envelope: COMPLETE_V3_PLAN_ENVELOPE,
    createdAt: MONDAY,
  }
}

function tuesdayLeadQuiz() {
  return {
    kind: "lead" as const,
    leadId: "lead-b",
    quizAnswers: COMPLETE_LEGACY_ANSWERS as never,
    createdAt: TUESDAY,
  }
}

test("F1: quiz A taken Monday, quiz B taken Tuesday — B linked first, A linked later: B stays", async () => {
  const rows: Row[] = []
  const { admin } = fakeAdmin(rows)

  assert.equal(
    await writeAccountLinkFacts(admin, { userId: USER_ID, quiz: tuesdayLeadQuiz() }),
    "replaced",
  )
  assert.equal(
    await writeAccountLinkFacts(admin, { userId: USER_ID, quiz: mondayArtifactQuiz() }),
    "preserved",
    "A was taken before B, however late it is linked",
  )
  const facts = await loadUserFacts(admin, USER_ID)
  assert.equal(facts?.diagnostics?.source.kind, "legacy_quiz")
  assert.equal(facts?.diagnostics?.source.leadId, "lead-b")
  assert.deepEqual(
    facts?.provenance.diagnostics?.preservedCandidates?.map((entry) => [entry.kind, entry.id]),
    [["artifact", "artifact-a"]],
  )
})

test("round 2: a LOSING older artifact writes nothing to quiz_context — B's lead facts stand alone", async () => {
  const rows: Row[] = []
  const { admin, saves } = fakeAdmin(rows)

  await writeAccountLinkFacts(admin, { userId: USER_ID, quiz: tuesdayLeadQuiz() })
  assert.equal(rows[0]!.quiz_context ?? null, null, "baseline: a lead brings no quiz_context")
  const before = saves.length

  assert.equal(
    await writeAccountLinkFacts(admin, { userId: USER_ID, quiz: mondayArtifactQuiz() }),
    "preserved",
  )
  assert.deepEqual(
    saves.slice(before).map((entry) => [entry.p_domain, entry.p_mode]),
    [["diagnostics", "create_only"]],
    "the loser only records itself as a preserved candidate on diagnostics",
  )
  assert.equal(rows[0]!.quiz_context ?? null, null, "A's answers never land next to B's facts")
  assert.equal(((rows[0]!.facts_provenance as Row).quiz_context ?? null) as unknown, null)
})

test("round 2: a LOSING older artifact leaves a quiz_context B cleared to {} untouched", async () => {
  const rows = [artifactProfile({ at: "2026-09-10T00:00:00.000Z" })]
  const { admin } = fakeAdmin(rows)
  // B (Tuesday lead) wins over the old artifact profile and clears its quiz_context (F4).
  await writeAccountLinkFacts(admin, { userId: USER_ID, quiz: tuesdayLeadQuiz() })
  assert.deepEqual(rows[0]!.quiz_context, {})
  const provenanceBefore = structuredClone((rows[0]!.facts_provenance as Row).quiz_context)

  assert.equal(
    await writeAccountLinkFacts(admin, { userId: USER_ID, quiz: mondayArtifactQuiz() }),
    "preserved",
  )
  assert.deepEqual(rows[0]!.quiz_context, {})
  assert.deepEqual((rows[0]!.facts_provenance as Row).quiz_context, provenanceBefore)
})

test("F1: quiz A (Monday) linked first, quiz B (Tuesday) linked after A's link time: B wins", async () => {
  const rows: Row[] = []
  const { admin } = fakeAdmin(rows)

  await writeAccountLinkFacts(admin, { userId: USER_ID, quiz: mondayArtifactQuiz() })
  // A's link happened "now" (after Tuesday) — the link time must not make B look older.
  assert.equal(
    await writeAccountLinkFacts(admin, { userId: USER_ID, quiz: tuesdayLeadQuiz() }),
    "replaced",
  )
  const facts = await loadUserFacts(admin, USER_ID)
  assert.equal(facts?.diagnostics?.source.leadId, "lead-b")
})

test("F1: the quiz time is stored as diagnostics.source.takenAt (ISO), never inside raw", async () => {
  const rows: Row[] = []
  const { admin, saves } = fakeAdmin(rows)

  await writeAccountLinkFacts(admin, {
    userId: USER_ID,
    // Postgres' own timestamptz rendering, as supabase-js returns it.
    quiz: { ...tuesdayLeadQuiz(), createdAt: "2026-09-22 09:00:00.123456+00" },
  })

  const source = (saves[0]!.p_patch as Row).source as Row
  assert.equal(source.takenAt, "2026-09-22T09:00:00.123Z")
  assert.equal("takenAt" in (source.raw as Row), false)
  assert.equal(diagnosticsV1Schema.safeParse(rows[0]!.diagnostics).success, true)

  // An unreadable quiz time is simply not stored.
  const other: Row[] = []
  const second = fakeAdmin(other)
  await writeAccountLinkFacts(second.admin, {
    userId: USER_ID,
    quiz: { ...tuesdayLeadQuiz(), createdAt: null },
  })
  assert.equal("takenAt" in ((second.saves[0]!.p_patch as Row).source as Row), false)
})

// --- F3: hand edits count; create_only is a pure preserve ------------------------------

test("F3: a hand-edited legacy_columns profile is NOT overwritten by a quiz taken before the edit", async () => {
  const rows: Row[] = [
    {
      user_id: USER_ID,
      diagnostics: {
        texture: "coily",
        source: { kind: "legacy_columns", version: 1, raw: { hair_texture: "coily" } },
      },
      facts_revision: 2,
      facts_provenance: {
        diagnostics: {
          source: { kind: "legacy_columns" },
          schemaVersion: 1,
          at: "2026-09-25T00:00:00.000Z",
          editedAt: "2026-09-26T00:00:00.000Z",
        },
      },
    },
  ]
  const before = structuredClone(rows[0]!.diagnostics)
  const { admin, saves } = fakeAdmin(rows)

  const outcome = await writeAccountLinkFacts(admin, {
    userId: USER_ID,
    quiz: LEGACY_LEAD_QUIZ("2026-09-20T00:00:00.000Z"),
  })

  assert.equal(outcome, "preserved")
  assert.equal(saves[0]!.p_mode, "create_only")
  const facts = await loadUserFacts(admin, USER_ID)
  assert.deepEqual(facts?.diagnostics, before, "create_only preserves a legacy_columns document")
  assert.equal(facts?.revision, 2)
  assert.deepEqual(
    facts?.provenance.diagnostics?.preservedCandidates?.map((entry) => [entry.kind, entry.id]),
    [["lead", "lead-new"]],
  )
})

// --- item B: completeness defaults on account link ------------------------------------

test("an old lead without density or hair length links with both defaults marked assumed, raw untouched", async () => {
  const { density: _density, hair_length: _length, ...oldAnswers } = COMPLETE_LEGACY_ANSWERS
  void _density
  void _length
  const rows: Row[] = []
  const { admin, saves } = fakeAdmin(rows)

  await writeAccountLinkFacts(admin, {
    userId: USER_ID,
    quiz: {
      kind: "lead",
      leadId: "lead-old",
      quizAnswers: oldAnswers as never,
      createdAt: "2024-05-01T00:00:00.000Z",
    },
  })

  const patch = saves[0]!.p_patch as Row
  assert.equal(patch.density, "medium")
  assert.equal(patch.hairLength, "long")
  const provenanceFields = (saves[0]!.p_provenance as Row).fields as Row
  assert.equal(provenanceFields.density, "assumed")
  assert.equal(provenanceFields.hairLength, "assumed")
  assert.equal(provenanceFields.texture, "user")

  const raw = (patch.source as Row).raw as { answers: Row }
  assert.equal(raw.answers.density, undefined, "source.raw is the untouched built legacy source")
  assert.equal(raw.answers.hairLength, undefined)
})

// --- F2: a default only fills a hole --------------------------------------------------------

test("F2: a winning quiz without density keeps the profile's real density (and its provenance)", async () => {
  const { density: _density, hair_length: _length, ...answers } = COMPLETE_LEGACY_ANSWERS
  void _density
  void _length
  const rows = [artifactProfile({ at: "2026-09-10T00:00:00.000Z" })]
  const stored = rows[0]!.diagnostics as Row
  stored.density = "high"
  stored.hairLength = "very_long"
  ;((rows[0]!.facts_provenance as Row).diagnostics as Row).fields = {
    density: "user",
    hairLength: "assumed",
  }
  const { admin, saves } = fakeAdmin(rows)

  const outcome = await writeAccountLinkFacts(admin, {
    userId: USER_ID,
    quiz: {
      kind: "lead",
      leadId: "lead-new",
      quizAnswers: answers as never,
      createdAt: "2026-09-12T00:00:00.000Z",
    },
  })

  assert.equal(outcome, "replaced")
  const patch = saves[0]!.p_patch as Row
  assert.equal(patch.density, "high", "the real value survives the replacement")
  assert.equal(patch.hairLength, "long", "an assumed value is no real value: default again")
  const facts = await loadUserFacts(admin, USER_ID)
  assert.equal(facts?.provenance.diagnostics?.fields?.density, "user")
  assert.equal(facts?.provenance.diagnostics?.fields?.hairLength, "assumed")
})

test("F2: with no facts document yet, the legacy column value fills the hole, not the default", async () => {
  const { hair_length: _length, ...answers } = COMPLETE_LEGACY_ANSWERS
  void _length
  const rows: Row[] = [
    {
      user_id: USER_ID,
      diagnostics: null,
      facts_revision: 0,
      facts_provenance: {},
      density: "high",
      hair_length: "short",
    },
  ]
  const { admin, saves } = fakeAdmin(rows)

  await writeAccountLinkFacts(admin, {
    userId: USER_ID,
    quiz: {
      kind: "lead",
      leadId: "lead-new",
      quizAnswers: answers as never,
      createdAt: "2026-09-12T00:00:00.000Z",
    },
  })

  const patch = saves[0]!.p_patch as Row
  assert.equal(patch.hairLength, "short")
  assert.equal(patch.density, "low", "the quiz's own density always wins over the column")
  const fields = (saves[0]!.p_provenance as Row).fields as Row
  assert.equal(fields.hairLength, "unknown_historical")
  assert.equal(fields.density, "user")
})

for (const [label, before, after] of [
  [
    "the main problem",
    { concerns: ["tangling", "dry_lengths"], primary_concern: "tangling" },
    { concerns: ["tangling", "dry_lengths"], primary_concern: "dry_lengths" },
  ],
  [
    "the „Etwas anderes“ note",
    { concerns_other_text: "old note" },
    { concerns_other_text: "new note" },
  ],
] as const) {
  test(`fix round 8 (C): same lead id + time, only ${label} changed (not part of raw) is no resume — the candidate is recorded`, async () => {
    const rows: Row[] = []
    const { admin, saves } = fakeAdmin(rows)
    const quiz = (answers: object) => ({
      ...tuesdayLeadQuiz(),
      quizAnswers: { ...COMPLETE_LEGACY_ANSWERS, ...answers } as never,
    })
    assert.equal(
      await writeAccountLinkFacts(admin, { userId: USER_ID, quiz: quiz(before) }),
      "replaced",
    )
    const diagnosticsBefore = structuredClone(rows[0]!.diagnostics)
    const settled = saves.length

    assert.equal(
      await writeAccountLinkFacts(admin, { userId: USER_ID, quiz: quiz(after) }),
      "preserved",
    )
    assert.deepEqual(
      saves.slice(settled).map((call) => [call.p_domain, call.p_mode]),
      [["diagnostics", "create_only"]],
      "changed quiz answers outside raw: the ordinary loser path, never the resume shortcut",
    )
    assert.deepEqual(rows[0]!.diagnostics, diagnosticsBefore, "the stored facts stay unchanged")

    // The unchanged quiz linked again is still a pure resume: zero writes.
    const again = saves.length
    assert.equal(
      await writeAccountLinkFacts(admin, { userId: USER_ID, quiz: quiz(before) }),
      "preserved",
    )
    assert.equal(saves.length, again, "unchanged quiz: zero writes")
  })
}

for (const [label, before, after] of [
  [
    "the main problem",
    { concerns: ["tangling", "dry_lengths"], primary_concern: "tangling" },
    { concerns: ["tangling", "dry_lengths"], primary_concern: "dry_lengths" },
  ],
  [
    "the „Etwas anderes“ note",
    { concerns_other_text: "old note" },
    { concerns_other_text: "new note" },
  ],
] as const) {
  test(`fix round 9 (C): after an unrelated hand edit, the same lead with only ${label} changed is still no resume`, async () => {
    const rows: Row[] = []
    const { admin, saves } = fakeAdmin(rows)
    const quiz = (answers: object) => ({
      ...tuesdayLeadQuiz(),
      quizAnswers: { ...COMPLETE_LEGACY_ANSWERS, ...answers } as never,
    })
    assert.equal(
      await writeAccountLinkFacts(admin, { userId: USER_ID, quiz: quiz(before) }),
      "replaced",
    )
    // A hand edit of an unrelated field (density), newer than the quiz.
    const row = rows[0]!
    row.diagnostics = { ...(row.diagnostics as Row), density: "high" }
    const provenance = row.facts_provenance as Row
    provenance.diagnostics = {
      ...(provenance.diagnostics as Row),
      editedAt: "2099-01-01T00:00:00.000Z",
    }
    const diagnosticsBefore = structuredClone(row.diagnostics)
    const settled = saves.length

    assert.equal(
      await writeAccountLinkFacts(admin, { userId: USER_ID, quiz: quiz(after) }),
      "preserved",
    )
    assert.deepEqual(
      saves.slice(settled).map((call) => [call.p_domain, call.p_mode]),
      [["diagnostics", "create_only"]],
      "changed quiz answers are recorded as a candidate even after a hand edit",
    )
    assert.deepEqual(rows[0]!.diagnostics, diagnosticsBefore, "the hand-edited facts stay")

    // The unchanged quiz is still a pure resume after the hand edit: zero writes.
    const again = saves.length
    assert.equal(
      await writeAccountLinkFacts(admin, { userId: USER_ID, quiz: quiz(before) }),
      "preserved",
    )
    assert.equal(saves.length, again, "unchanged quiz after a hand edit: zero writes")
  })
}

// --- fix round 11: a legacy lead's explicit volume direction -----------------------------

/** Curly, coarse, high density: the hair-type resolver says „weniger Volumen“. */
const CURLY_VOLUME_ANSWERS = {
  ...COMPLETE_LEGACY_ANSWERS,
  structure: "curly",
  thickness: "coarse",
  density: "high",
  goals: ["volume", "moisture"],
}

test("fix round 11 (rule 1) on PGlite: the live link of a legacy lead with an explicit volume goal on curly hair derives the goals column volume", async (t) => {
  const pg = await migratedPersonalPlanDatabase(t)
  const user = id(7, 1)
  await insertProfile(pg, user)
  const outcome = await writeAccountLinkFacts(pgliteAdminClient(pg) as never, {
    userId: user,
    quiz: {
      kind: "lead",
      leadId: id(7, 2),
      quizAnswers: CURLY_VOLUME_ANSWERS as never,
      createdAt: "2026-09-01T00:00:00.000Z",
    },
  })
  assert.equal(outcome, "replaced")
  const row = (await readRow(pg, user))!
  assert.deepEqual(
    [...(row.goals as string[])].sort(),
    ["moisture", "volume"],
    "her explicit pick, not the hair-type less_volume",
  )
  assert.equal(row.desired_volume, "more")
  assert.equal((row.diagnostics as DiagnosticsV1).volumeDirection, "more")
})

test("on PGlite: a quiz relink never touches the member's shopping_preferences or its provenance", async (t) => {
  const pg = await migratedPersonalPlanDatabase(t)
  const user = id(7, 3)
  await insertProfile(pg, user)
  const shoppingProvenance = {
    source: { kind: "shopping_preferences_editor" },
    schemaVersion: 1,
    at: "2026-09-20T10:00:00.000Z",
    fields: { budget: "user" },
  }
  const saved = await saveUserFacts(pg, {
    userId: user,
    domain: "shopping_preferences",
    patch: { budget: { kind: "capped", limitEur: 5, allowExceptions: true } },
    provenance: shoppingProvenance,
  })
  assert.equal(saved.status, "ok")

  const outcome = await writeAccountLinkFacts(pgliteAdminClient(pg) as never, {
    userId: user,
    quiz: {
      kind: "lead",
      leadId: id(7, 4),
      quizAnswers: CURLY_VOLUME_ANSWERS as never,
      createdAt: "2026-09-25T00:00:00.000Z",
    },
  })
  assert.equal(outcome, "replaced")
  const row = (await readRow(pg, user))!
  assert.deepEqual(row.shopping_preferences, {
    budget: { kind: "capped", limitEur: 5, allowExceptions: true },
  })
  assert.deepEqual(
    (row.facts_provenance as Record<string, unknown>).shopping_preferences,
    shoppingProvenance,
  )
  assert.ok((row.diagnostics as DiagnosticsV1) !== null, "the relink did write diagnostics")
})

test("fix round 11: same lead id + same takenAt but a CHANGED volume direction is no resume (raw carries only volume_balance)", async () => {
  const rows: Row[] = []
  const { admin, saves } = fakeAdmin(rows)
  const quiz = {
    kind: "lead" as const,
    leadId: "lead-dir",
    quizAnswers: CURLY_VOLUME_ANSWERS as never,
    createdAt: TUESDAY,
  }
  assert.equal(await writeAccountLinkFacts(admin, { userId: USER_ID, quiz }), "replaced")
  const settled = saves.length
  // Unchanged: a pure resume, zero writes.
  assert.equal(await writeAccountLinkFacts(admin, { userId: USER_ID, quiz }), "preserved")
  assert.equal(saves.length, settled, "an unchanged re-link writes nothing")

  const changed = {
    ...quiz,
    quizAnswers: { ...CURLY_VOLUME_ANSWERS, goals: ["less_volume", "moisture"] } as never,
  }
  const before = (rows[0]!.diagnostics as DiagnosticsV1).source.raw
  assert.deepEqual(
    projectLegacyLeadToFacts({ leadId: "lead-dir", quizAnswers: changed.quizAnswers }).diagnostics
      .source.raw,
    before,
    "precondition: the raw Stage-1 source is identical",
  )
  assert.equal(await writeAccountLinkFacts(admin, { userId: USER_ID, quiz: changed }), "preserved")
  assert.deepEqual(
    saves.slice(settled).map((call) => [call.p_domain, call.p_mode]),
    [["diagnostics", "create_only"]],
    "the ordinary loser path records the changed quiz, never the resume shortcut",
  )
  assert.equal((rows[0]!.diagnostics as DiagnosticsV1).volumeDirection, "more", "facts unchanged")
})

test("fix round 11: a stored source WITHOUT a recorded volume direction is no resume for the same lead's explicit pick (no wildcard)", async () => {
  // Pins the documented behaviour: a missing `statedOutsideRaw.volumeDirection` is not a
  // wildcard. No stored production source has this shape (facts were first written by the code
  // that records the direction); if one ever did, the link takes the ordinary path.
  const rows: Row[] = []
  const { admin, saves } = fakeAdmin(rows)
  const quiz = {
    ...tuesdayLeadQuiz(),
    quizAnswers: { ...COMPLETE_LEGACY_ANSWERS, goals: ["volume"] } as never,
  }
  assert.equal(await writeAccountLinkFacts(admin, { userId: USER_ID, quiz }), "replaced")
  const stored = rows[0]!.diagnostics as DiagnosticsV1
  assert.equal(stored.volumeDirection, "more", "the explicit pick is kept as the direction")
  assert.equal(
    (stored.source as { statedOutsideRaw?: { volumeDirection?: string } }).statedOutsideRaw
      ?.volumeDirection,
    "more",
    "and recorded on the source",
  )

  // Simulate a source stored before the direction was recorded.
  const legacyShaped = structuredClone(stored) as DiagnosticsV1 & {
    source: { statedOutsideRaw?: Record<string, unknown> }
  }
  delete legacyShaped.source.statedOutsideRaw!.volumeDirection
  rows[0]!.diagnostics = legacyShaped
  const settled = saves.length

  assert.equal(await writeAccountLinkFacts(admin, { userId: USER_ID, quiz }), "preserved")
  assert.deepEqual(
    saves.slice(settled).map((call) => [call.p_domain, call.p_mode]),
    [["diagnostics", "create_only"]],
    "ordinary path: the quiz is recorded as a candidate, never silently treated as the same",
  )
})
