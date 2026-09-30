import assert from "node:assert/strict"
import test from "node:test"

import {
  linkExactPlanBereitSourceToProfile,
  loadPlanBereitInitialReadiness,
  loadPlanBereitReadiness,
  resolvePlanBereitFunnelPackage,
  updateMissingPlanBereitSourceFact,
  needsFreshMigrationQuiz,
  classifyPlanBereitSourceFacts,
  isValidPlanBereitFactPatch,
} from "../src/app/plan-bereit/readiness"
import { projectLegacyLeadToFacts } from "../src/lib/user-facts/project-legacy-lead"
import { diagnosticsV1Schema } from "../src/lib/user-facts/schema"
import { deriveDiagnosticsColumns } from "../src/lib/user-facts/derive-legacy-columns"
import { projectArtifactToFacts } from "../src/lib/user-facts/project-artifact"
import { COMPLETE_V3_PLAN_ENVELOPE } from "./personal-plan/fixtures"
import { simulateUserFactsSave } from "./user-facts-save-rpc.fixtures"

test("email return recovery asks only absent or invalid Stage-1 facts", () => {
  const source = classifyPlanBereitSourceFacts({
    id: "old",
    quiz_kind: "legacy",
    quiz_answers: {
      ...COMPLETE_LEGACY_ANSWERS,
      density: "unknown",
      hair_length: undefined,
      concerns: ["retired"],
    },
  })
  assert.equal(source.status, "missing_source_facts")
  if (source.status === "missing_source_facts")
    assert.deepEqual(
      source.missingFacts.map((f) => f.field),
      ["density", "hair_length"],
    )
  assert.equal(
    needsFreshMigrationQuiz({
      status: "missing_source_facts",
      missingFacts: [{ field: "density" }, { field: "hair_length" }],
      funnelPackageKey: "customerio_scan_return_v1",
    }),
    false,
  )
})

test("Personal Plan missing facts remain distinct from missing artifacts and context answers", () => {
  const source = classifyPlanBereitSourceFacts({
    id: "pp",
    quiz_kind: "personal_plan",
    quiz_answers: {
      kind: "personal_plan",
      version: 3,
      answers: {
        texture: "wavy",
        thickness: "fine",
        density: "low",
        hairLength: "medium",
        hairSurface: "rough",
        elasticResponse: "snaps",
        scalpOiliness: "dry",
        goals: ["moisture"],
        chemicalTreatments: ["colored"],
      },
    },
  })
  assert.equal(
    source.status,
    "ready",
    "missing unrelated Personal Plan context is not a missing hair fact",
  )
})

test("missing-fact patch rejects wrong enums, duplicates and contradictory treatments", () => {
  assert.equal(isValidPlanBereitFactPatch("density", "high"), true)
  assert.equal(isValidPlanBereitFactPatch("density", "unknown"), false)
  assert.equal(isValidPlanBereitFactPatch("treatment", ["natur", "gefaerbt"]), false)
  assert.equal(isValidPlanBereitFactPatch("treatment", ["gefaerbt", "gefaerbt"]), false)
  assert.equal(isValidPlanBereitFactPatch("goals", []), false)
  assert.equal(isValidPlanBereitFactPatch("goals", ["shine", "moisture"]), true)
})

test("migration quiz recovery retains the existing hair-length repair and rejects authorization failures", () => {
  assert.equal(needsFreshMigrationQuiz({ status: "invalid_source" }), true)
  assert.equal(
    needsFreshMigrationQuiz({
      status: "missing_source_facts",
      missingFacts: [{ field: "hair_length" }, { field: "density" }],
    }),
    true,
  )
  assert.equal(
    needsFreshMigrationQuiz({
      status: "missing_source_facts",
      missingFacts: [{ field: "hair_length" }],
    }),
    false,
  )
  for (const status of ["ready", "forbidden", "transient_error", "checking"]) {
    assert.equal(needsFreshMigrationQuiz({ status }), false)
  }
})

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

/**
 * F28 (task 5a): readiness only needs to know a diagnostics domain EXISTS
 * (non-null, at least one write) — the field-by-field legacy-column comparison
 * this fixture used to stand in for (`profileMatchesProjected`) is gone along
 * with the direct `hair_profiles` writes it existed to validate. Its exact
 * content is irrelevant to every "ready" fixture below.
 */
const COMPLETE_PROFILE = {
  user_id: "user-1",
  diagnostics: { texture: "wavy", thickness: "fine" },
  facts_revision: 1,
}

/** A `hair_profiles` row that exists but has never had diagnostics facts written. */
const UNPROJECTED_PROFILE = {
  user_id: "user-1",
  diagnostics: null,
  facts_revision: 0,
}

type Row = Record<string, unknown>

class FakeQuery {
  private filters: Array<{ column: string; value: unknown }> = []
  private updateValues: Row | null = null

  constructor(
    private readonly db: FakeSupabase,
    private readonly table: string,
  ) {}

  select() {
    return this
  }

  eq(column: string, value: unknown) {
    this.filters.push({ column, value })
    this.db.queries.push({ table: this.table, op: "eq", column, value })
    return this
  }

  is(column: string, value: unknown) {
    this.filters.push({ column, value })
    this.db.queries.push({ table: this.table, op: "is", column, value })
    return this
  }

  order() {
    this.db.queries.push({ table: this.table, op: "order" })
    return this
  }

  limit() {
    this.db.queries.push({ table: this.table, op: "limit" })
    return this
  }

  update(values: Row) {
    this.updateValues = values
    this.db.updates.push({ table: this.table, values, filters: this.filters })
    return this
  }

  insert(values: Row) {
    this.db.tables[this.table] = [...(this.db.tables[this.table] ?? []), values]
    this.db.inserts.push({ table: this.table, values })
    return Promise.resolve({ error: null })
  }

  upsert(values: Row, options: { onConflict: string }) {
    const rows = this.db.tables[this.table] ?? []
    const existing = rows.find((row) => row[options.onConflict] === values[options.onConflict])
    if (existing) {
      Object.assign(existing, values)
    } else {
      this.db.tables[this.table] = [...rows, values]
    }
    this.db.upserts.push({ table: this.table, values, onConflict: options.onConflict })
    return Promise.resolve({ error: null })
  }

  single() {
    return this.maybeSingle()
  }

  then<TResult1 = { data: Row[]; error: null }, TResult2 = never>(
    onfulfilled?:
      | ((value: { data: Row[]; error: null }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    const matching = this.matchingRows()
    // A plain `.update(...).eq(...)` awaited directly (no `.select().maybeSingle()`
    // chained) must still apply — real Supabase never requires a re-select to
    // persist an update.
    if (this.updateValues) {
      for (const row of matching) Object.assign(row, this.updateValues)
    }
    return Promise.resolve({ data: matching, error: null }).then(onfulfilled, onrejected)
  }

  private matchingRows() {
    const rows = this.db.tables[this.table] ?? []
    return rows.filter((row) => this.filters.every(({ column, value }) => row[column] === value))
  }

  async maybeSingle() {
    const matching = this.matchingRows()

    if (this.updateValues) {
      const row = matching[0] ?? null
      if (!row) return { data: null, error: null }
      Object.assign(row, this.updateValues)
      return { data: row, error: null }
    }

    return { data: matching[0] ?? null, error: null }
  }
}

class FakeSupabase {
  readonly queries: Array<{ table: string; op: string; column?: string; value?: unknown }> = []
  readonly updates: Array<{
    table: string
    values: Row
    filters: Array<{ column: string; value: unknown }>
  }> = []
  readonly inserts: Array<{ table: string; values: Row }> = []
  readonly upserts: Array<{ table: string; values: Row; onConflict: string }> = []
  readonly rpcs: Array<{ fn: string; args: Row }> = []

  constructor(
    readonly tables: Record<string, Row[]>,
    private readonly rpcResults: Record<
      string,
      { data: unknown; error: { message: string } | null }
    > = {},
  ) {}

  from(table: string) {
    return new FakeQuery(this, table)
  }

  rpc(fn: string, args: Row) {
    this.rpcs.push({ fn, args })
    if (fn === "user_facts_save_v1") {
      return Promise.resolve({ data: this.simulateUserFactsSave(args), error: null })
    }
    return Promise.resolve(this.rpcResults[fn] ?? { data: null, error: null })
  }

  /**
   * `user_facts_save_v1` stand-in (`simulateUserFactsSave`): CAS, create_only
   * preserve, field-level merge with null-clears and the provenance merge, so
   * the "latest own quiz wins" writes can be asserted on the stored document.
   * It never derives the legacy columns — that derivation has its own parity
   * test (`tests/user-facts-derive-parity.test.ts`) against the real RPC.
   */
  private simulateUserFactsSave(args: Row) {
    return simulateUserFactsSave((this.tables.hair_profiles ??= []), args)
  }
}

test("legacy readiness is ready only when the exact lead is already projected into hair_profiles", async () => {
  const db = new FakeSupabase({
    leads: [
      {
        id: "lead-legacy",
        email: "lea@example.test",
        quiz_kind: "legacy",
        quiz_answers: COMPLETE_LEGACY_ANSWERS,
        user_id: "user-1",
        updated_at: "2026-08-12T08:00:00.000Z",
      },
    ],
    hair_profiles: [COMPLETE_PROFILE],
  })

  const readiness = await loadPlanBereitReadiness(db as never, {
    userId: "user-1",
    email: "lea@example.test",
    leadId: "lead-legacy",
    expectedQuizSourceKind: "legacy",
  })

  assert.equal(readiness.status, "ready")
  assert.equal(readiness.leadId, "lead-legacy")
  assert.equal(
    db.queries.some((query) => query.table === "leads" && query.op === "order"),
    false,
    "exact readiness must not use latest-lead fallback ordering",
  )
})

test("legacy readiness stays checking when the persisted profile has no diagnostics facts yet", async () => {
  const db = new FakeSupabase({
    leads: [
      {
        id: "lead-legacy",
        email: "lea@example.test",
        quiz_kind: "legacy",
        quiz_answers: COMPLETE_LEGACY_ANSWERS,
        user_id: "user-1",
        status: "anything-goes",
        updated_at: "2026-08-12T08:00:00.000Z",
      },
    ],
    hair_profiles: [UNPROJECTED_PROFILE],
  })

  const readiness = await loadPlanBereitReadiness(db as never, {
    userId: "user-1",
    email: "lea@example.test",
    leadId: "lead-legacy",
    expectedQuizSourceKind: "legacy",
  })

  assert.equal(readiness.status, "source_pending")
  assert.equal(db.updates.length, 0)
  assert.equal(db.upserts.length, 0)
  assert.equal(
    db.rpcs.some((call) => call.fn === "user_facts_save_v1"),
    false,
    "a read must never write",
  )
  assert.equal(
    db.queries.some((query) => query.table === "hair_profiles" && query.column === "user_id"),
    true,
  )
})

// --- F28 + decision wave 1 ("latest own quiz wins") ----------------------------
//
// F28 only checks that `hair_profiles.diagnostics` is non-null and
// `facts_revision > 0` for the owning candidate — not that its content matches
// what THIS candidate would have projected. What a link WRITES follows Nick's
// 2026-09-30 rule: an own quiz newer than the profile's last facts change
// replaces the diagnostics (upsert); an older one is preserved (create_only).

/** A stored diagnostics document an earlier, different source wrote at `at`. */
function earlierArtifactProfile(at: string, revision = 3): Row {
  const { diagnostics, quizContext } = projectArtifactToFacts({
    envelope: COMPLETE_V3_PLAN_ENVELOPE,
    artifactId: "artifact-earlier",
    leadId: "lead-earlier",
  })
  return {
    user_id: "user-1",
    diagnostics: { ...diagnostics, texture: "straight", goals: ["shine"] },
    quiz_context: quizContext,
    facts_revision: revision,
    facts_provenance: {
      diagnostics: {
        source: { kind: "personal_plan_artifact", id: "artifact-earlier" },
        schemaVersion: 1,
        at,
      },
    },
  }
}

function legacyLead(createdAt: string): Row {
  return {
    id: "lead-legacy",
    email: "lea@example.test",
    quiz_kind: "legacy",
    quiz_answers: COMPLETE_LEGACY_ANSWERS,
    user_id: null,
    created_at: createdAt,
    updated_at: "2026-09-14T08:00:00.000Z",
  }
}

test("F28: linking an OLDER legacy lead preserves the existing profile and reports ready, never sticking on checking", async () => {
  const db = new FakeSupabase({
    leads: [legacyLead("2026-09-01T08:00:00.000Z")],
    hair_profiles: [earlierArtifactProfile("2026-09-10T08:00:00.000Z")],
  })
  const before = structuredClone(db.tables.hair_profiles[0].diagnostics)

  const pending = await loadPlanBereitReadiness(db as never, {
    userId: "user-1",
    email: "lea@example.test",
    leadId: "lead-legacy",
    expectedQuizSourceKind: "legacy",
  })
  assert.equal(pending.status, "source_pending", "not yet linked to this lead/user pair")

  const linked = await linkExactPlanBereitSourceToProfile(db as never, {
    userId: "user-1",
    email: "lea@example.test",
    leadId: "lead-legacy",
    expectedQuizSourceKind: "legacy",
  })

  assert.equal(linked.status, "ready", "checking must not stick once diagnostics facts exist")
  const factsCall = db.rpcs.find((call) => call.fn === "user_facts_save_v1")
  assert.ok(factsCall, "expected a user_facts_save_v1 call")
  assert.equal(factsCall!.args.p_mode, "create_only")
  assert.equal(factsCall!.args.p_domain, "diagnostics")
  assert.deepEqual(
    db.tables.hair_profiles[0].diagnostics,
    before,
    "an older quiz must never overwrite the existing domain",
  )
  const provenance = (db.tables.hair_profiles[0].facts_provenance as Row).diagnostics as Row
  assert.deepEqual(
    (provenance.preservedCandidates as Row[]).map((entry) => [entry.kind, entry.id]),
    [["lead", "lead-legacy"]],
  )
})

test("latest quiz wins: linking a NEWER own legacy lead replaces the existing profile, goals included", async () => {
  const db = new FakeSupabase({
    leads: [legacyLead("2026-09-12T08:00:00.000Z")],
    hair_profiles: [earlierArtifactProfile("2026-09-10T08:00:00.000Z")],
  })

  const linked = await linkExactPlanBereitSourceToProfile(db as never, {
    userId: "user-1",
    email: "lea@example.test",
    leadId: "lead-legacy",
    expectedQuizSourceKind: "legacy",
  })

  assert.equal(linked.status, "ready")
  const factsCalls = db.rpcs.filter((call) => call.fn === "user_facts_save_v1")
  // F4: the winning lead replaces BOTH domains — the earlier artifact's quiz_context is cleared.
  assert.deepEqual(
    factsCalls.map((call) => [call.args.p_domain, call.args.p_mode, call.args.p_expected_revision]),
    [
      ["diagnostics", "upsert", 3],
      ["quiz_context", "upsert", 4],
    ],
  )
  assert.deepEqual(db.tables.hair_profiles[0].quiz_context, {})
  const patch = factsCalls[0].args.p_patch as Row
  // Fields the legacy quiz does not carry are cleared, never carried over.
  assert.equal(patch.concernRecurrence, null)
  assert.deepEqual(
    db.tables.hair_profiles[0].diagnostics,
    projectLegacyLeadToFacts({
      leadId: "lead-legacy",
      quizAnswers: COMPLETE_LEGACY_ANSWERS as never,
      takenAt: "2026-09-12T08:00:00.000Z",
    }).diagnostics,
  )
  assert.deepEqual((db.tables.hair_profiles[0].diagnostics as Row).goals, ["moisture"])
})

test("latest quiz wins: a hand-edited profile loses to a quiz retaken after the edit", async () => {
  const profile = earlierArtifactProfile("2026-09-01T08:00:00.000Z")
  ;((profile.facts_provenance as Row).diagnostics as Row).editedAt = "2026-09-10T08:00:00.000Z"
  const db = new FakeSupabase({
    leads: [legacyLead("2026-09-11T08:00:00.000Z")],
    hair_profiles: [profile],
  })

  await linkExactPlanBereitSourceToProfile(db as never, {
    userId: "user-1",
    email: "lea@example.test",
    leadId: "lead-legacy",
    expectedQuizSourceKind: "legacy",
  })

  const factsCall = db.rpcs.find((call) => call.fn === "user_facts_save_v1")
  assert.equal(factsCall!.args.p_mode, "upsert")
  assert.equal((db.tables.hair_profiles[0].diagnostics as Row).texture, "wavy")
})

test("F28: linking an OLDER artifact preserves the existing artifact-sourced profile and reports ready", async () => {
  const db = new FakeSupabase(
    {
      leads: [
        {
          id: "lead-pp",
          email: "lea@example.test",
          quiz_kind: "personal_plan",
          user_id: null,
          updated_at: "2026-09-14T08:00:00.000Z",
        },
      ],
      personal_plan_prepared_artifacts: [
        {
          id: "artifact-1",
          lead_id: "lead-pp",
          // Already linked: the fake's canned `link_personal_plan_artifact_to_user`
          // result (below) doesn't mutate the table the way the real RPC does, so
          // ownership is set up-front rather than simulating that side effect.
          user_id: "user-1",
          status: "attached",
          canonical_profile: COMPLETE_LEGACY_ANSWERS,
          quiz_answers: COMPLETE_V3_PLAN_ENVELOPE,
          created_at: "2026-09-01T08:00:00.000Z",
        },
      ],
      hair_profiles: [earlierArtifactProfile("2026-09-10T08:00:00.000Z", 2)],
    },
    {
      link_personal_plan_artifact_to_user: {
        data: [{ artifact_id: "artifact-1", canonical_profile: COMPLETE_LEGACY_ANSWERS }],
        error: null,
      },
    },
  )
  const before = structuredClone(db.tables.hair_profiles[0].diagnostics)

  const linked = await linkExactPlanBereitSourceToProfile(db as never, {
    userId: "user-1",
    email: "lea@example.test",
    leadId: "lead-pp",
    expectedQuizSourceKind: "personal_plan",
  })

  assert.equal(linked.status, "ready")
  const factsCalls = db.rpcs.filter((call) => call.fn === "user_facts_save_v1")
  assert.equal(factsCalls.length, 2, "diagnostics + quiz_context")
  assert.equal(factsCalls[0].args.p_domain, "diagnostics")
  assert.equal(factsCalls[0].args.p_mode, "create_only")
  assert.equal(factsCalls[1].args.p_domain, "quiz_context")
  assert.equal(factsCalls[1].args.p_mode, "create_only")
  assert.deepEqual(
    db.tables.hair_profiles[0].diagnostics,
    before,
    "the existing domain must be preserved, not overwritten",
  )
})

test("latest quiz wins: linking a NEWER artifact replaces diagnostics and quiz_context", async () => {
  const db = new FakeSupabase(
    {
      leads: [
        {
          id: "lead-pp",
          email: "lea@example.test",
          quiz_kind: "personal_plan",
          user_id: null,
          updated_at: "2026-09-14T08:00:00.000Z",
        },
      ],
      personal_plan_prepared_artifacts: [
        {
          id: "artifact-1",
          lead_id: "lead-pp",
          user_id: "user-1",
          status: "attached",
          canonical_profile: COMPLETE_LEGACY_ANSWERS,
          quiz_answers: COMPLETE_V3_PLAN_ENVELOPE,
          created_at: "2026-09-12T08:00:00.000Z",
        },
      ],
      hair_profiles: [earlierArtifactProfile("2026-09-10T08:00:00.000Z", 2)],
    },
    {
      link_personal_plan_artifact_to_user: {
        data: [{ artifact_id: "artifact-1", canonical_profile: COMPLETE_LEGACY_ANSWERS }],
        error: null,
      },
    },
  )

  const linked = await linkExactPlanBereitSourceToProfile(db as never, {
    userId: "user-1",
    email: "lea@example.test",
    leadId: "lead-pp",
    expectedQuizSourceKind: "personal_plan",
  })

  assert.equal(linked.status, "ready")
  assert.deepEqual(
    db.rpcs
      .filter((call) => call.fn === "user_facts_save_v1")
      .map((call) => [call.args.p_domain, call.args.p_mode, call.args.p_expected_revision]),
    [
      ["diagnostics", "upsert", 2],
      ["quiz_context", "upsert", 3],
    ],
  )
  assert.deepEqual(
    db.tables.hair_profiles[0].diagnostics,
    projectArtifactToFacts({
      envelope: COMPLETE_V3_PLAN_ENVELOPE,
      artifactId: "artifact-1",
      leadId: "lead-pp",
      takenAt: "2026-09-12T08:00:00.000Z",
    }).diagnostics,
  )
})

test("F28: linking a user with no existing profile at all creates diagnostics facts and reports ready", async () => {
  const db = new FakeSupabase({
    leads: [legacyLead("2026-09-12T08:00:00.000Z")],
    hair_profiles: [],
  })

  const linked = await linkExactPlanBereitSourceToProfile(db as never, {
    userId: "user-1",
    email: "lea@example.test",
    leadId: "lead-legacy",
    expectedQuizSourceKind: "legacy",
  })

  assert.equal(linked.status, "ready")
  const factsCall = db.rpcs.find((call) => call.fn === "user_facts_save_v1")
  assert.ok(factsCall)
  // No real quiz on file yet: this quiz writes, CAS-pinned to the missing row's revision 0.
  assert.equal(factsCall!.args.p_mode, "upsert")
  assert.equal(factsCall!.args.p_expected_revision, 0)
  assert.ok(db.tables.hair_profiles[0].diagnostics)
  assert.equal(db.tables.hair_profiles[0].facts_revision, 1)
})

test("legacy initial readiness skips posting when already semantically projected", async () => {
  const db = new FakeSupabase({
    leads: [
      {
        id: "lead-legacy",
        email: "lea@example.test",
        quiz_kind: "legacy",
        quiz_answers: COMPLETE_LEGACY_ANSWERS,
        user_id: "user-1",
        status: "not-a-readiness-predicate",
        updated_at: "2026-08-12T08:00:00.000Z",
      },
    ],
    hair_profiles: [COMPLETE_PROFILE],
  })

  const readiness = await loadPlanBereitInitialReadiness(db as never, {
    userId: "user-1",
    email: "lea@example.test",
    leadId: "lead-legacy",
    expectedQuizSourceKind: "legacy",
  })

  assert.equal(readiness.status, "ready")
  assert.equal(readiness.initialAction, "none")
  assert.equal(db.updates.length, 0)
  assert.equal(db.upserts.length, 0)
})

test("legacy initial readiness keeps the authoritative POST when diagnostics facts don't exist yet", async () => {
  const db = new FakeSupabase({
    leads: [
      {
        id: "lead-legacy",
        email: "lea@example.test",
        quiz_kind: "legacy",
        quiz_answers: COMPLETE_LEGACY_ANSWERS,
        user_id: "user-1",
        updated_at: "2026-08-12T08:00:00.000Z",
      },
    ],
    hair_profiles: [UNPROJECTED_PROFILE],
  })

  const readiness = await loadPlanBereitInitialReadiness(db as never, {
    userId: "user-1",
    email: "lea@example.test",
    leadId: "lead-legacy",
    expectedQuizSourceKind: "legacy",
  })

  assert.equal(readiness.status, "checking")
  assert.equal(readiness.initialAction, "link")
  assert.equal(db.updates.length, 0)
  assert.equal(db.upserts.length, 0)
})

test("legacy readiness accepts the exact active regular-quiz field-test enrollment as linkable", async () => {
  const db = new FakeSupabase({
    leads: [
      {
        id: "lead-legacy-field-test",
        email: "participant@example.test",
        quiz_kind: "legacy",
        quiz_answers: COMPLETE_LEGACY_ANSWERS,
        user_id: null,
        updated_at: "2026-08-13T08:00:00.000Z",
      },
    ],
    personal_plan_test_enrollments: [],
    regular_quiz_test_enrollments: [
      {
        id: "regular-enrollment-1",
        user_id: "guest-1",
        lead_id: "lead-legacy-field-test",
        status: "active",
        expires_at: "2099-08-20T12:00:00.000Z",
        revoked_at: null,
        manual_access_grant_id: "grant-1",
        manual_access_grants: {
          id: "grant-1",
          user_id: "guest-1",
          reason: "tester",
          expires_at: "2099-08-20T12:00:00.000Z",
          revoked_at: null,
        },
      },
    ],
  })

  const readiness = await loadPlanBereitInitialReadiness(db as never, {
    userId: "guest-1",
    email: "field-test@guest.chaarlie.invalid",
    leadId: "lead-legacy-field-test",
    expectedQuizSourceKind: "legacy",
  })

  assert.equal(readiness.status, "checking")
  assert.equal(readiness.initialAction, "link")
  assert.equal(readiness.quizSourceKind, "legacy")
  assert.equal(
    db.queries.some(
      (query) =>
        query.table === "regular_quiz_test_enrollments" &&
        query.column === "lead_id" &&
        query.value === "lead-legacy-field-test",
    ),
    true,
  )
})

test("legacy readiness asks only the canonical hair-length question when that exact fact is missing", async () => {
  const db = new FakeSupabase({
    leads: [
      {
        id: "lead-legacy",
        email: "lea@example.test",
        quiz_kind: "legacy",
        quiz_answers: { ...COMPLETE_LEGACY_ANSWERS, hair_length: undefined },
        user_id: "user-1",
        updated_at: "2026-08-12T08:00:00.000Z",
      },
    ],
  })

  const readiness = await loadPlanBereitReadiness(db as never, {
    userId: "user-1",
    email: "lea@example.test",
    leadId: "lead-legacy",
    expectedQuizSourceKind: "legacy",
  })

  assert.equal(readiness.status, "missing_source_facts")
  assert.deepEqual(
    readiness.missingFacts.map((fact) => fact.field),
    ["hair_length"],
  )
  assert.equal(readiness.missingFacts[0].question, "Wie lang sind deine Haare aktuell?")
  assert.deepEqual(
    readiness.missingFacts[0].options.map((option) => [option.value, option.label]),
    [
      ["very_short", "Sehr kurz"],
      ["short", "Kurz"],
      ["medium", "Mittellang"],
      ["long", "Lang"],
      ["very_long", "Sehr lang"],
    ],
  )
  assert.equal(readiness.sourceVersion, "2026-08-12T08:00:00.000Z")
})

test("missing hair length persists against the exact owner-scoped lead with source-version protection", async () => {
  const db = new FakeSupabase({
    leads: [
      {
        id: "lead-legacy",
        email: "lea@example.test",
        quiz_kind: "legacy",
        quiz_answers: { ...COMPLETE_LEGACY_ANSWERS, hair_length: undefined },
        user_id: "user-1",
        updated_at: "2026-08-12T08:00:00.000Z",
      },
    ],
    hair_profiles: [],
  })

  const readiness = await updateMissingPlanBereitSourceFact(db as never, {
    userId: "user-1",
    email: "lea@example.test",
    leadId: "lead-legacy",
    sourceVersion: "2026-08-12T08:00:00.000Z",
    field: "hair_length",
    value: "long",
  })

  assert.equal(readiness.status, "ready")
  assert.equal(
    db.tables.leads[0].quiz_answers && (db.tables.leads[0].quiz_answers as Row).hair_length,
    "long",
  )
  assert.equal(db.updates.length, 1)
  assert.deepEqual(
    db.updates[0].filters.map((filter) => [filter.column, filter.value]),
    [
      ["id", "lead-legacy"],
      ["quiz_kind", "legacy"],
      ["updated_at", "2026-08-12T08:00:00.000Z"],
      ["user_id", "user-1"],
    ],
  )

  // F28/task 5a: the direct `hair_profiles` upsert is gone.
  assert.equal(db.upserts.length, 0)
  // Fix round 2, I(P1): the recovery re-projects the WHOLE corrected legacy lead. A bare
  // `{ hairLength }` upsert would create a diagnostics document with no `source` when the
  // profile has none yet (the normal case here — readiness was `missing_source_facts`
  // BEFORE any link), which F28 would then report `ready` and `loadUserFacts` would throw
  // on. `raw` therefore equals the corrected built legacy source (F26).
  const factsCall = db.rpcs.find((call) => call.fn === "user_facts_save_v1")
  assert.ok(factsCall, "expected a user_facts_save_v1 call")
  assert.equal(factsCall!.args.p_user_id, "user-1")
  assert.equal(factsCall!.args.p_domain, "diagnostics")
  assert.equal(factsCall!.args.p_mode, "upsert")
  const patch = factsCall!.args.p_patch as Row
  assert.equal((patch.source as Row | undefined)?.kind, "legacy_quiz")
  assert.equal((patch.source as Row | undefined)?.leadId, "lead-legacy")
  assert.equal(patch.hairLength, "long")
  const provenance = factsCall!.args.p_provenance as Row
  assert.deepEqual(provenance.source, { kind: "legacy_lead", id: "lead-legacy" })
  assert.equal(provenance.editedAt, undefined)
  assert.equal(provenance.preservedCandidates, undefined)

  // (c) readiness only reports `ready` because the written document is a COMPLETE,
  // schema-valid diagnostics document — not an accidental source-less shell.
  assert.equal(diagnosticsV1Schema.safeParse(patch).success, true)
  const reprojected = projectLegacyLeadToFacts({
    leadId: "lead-legacy",
    quizAnswers: { ...COMPLETE_LEGACY_ANSWERS, hair_length: "long" } as never,
  }).diagnostics
  for (const field of [
    "texture",
    "thickness",
    "density",
    "hairLength",
    "hairSurface",
    "elasticResponse",
    "scalpOiliness",
  ] as const) {
    assert.notEqual(reprojected[field], undefined, `${field} must be projected, not missing`)
  }
  assert.deepEqual(patch, reprojected)
})

test("missing hair length still corrects the fact when a diagnostics document already exists (I3)", async () => {
  const db = new FakeSupabase({
    leads: [
      {
        id: "lead-legacy",
        email: "lea@example.test",
        quiz_kind: "legacy",
        quiz_answers: { ...COMPLETE_LEGACY_ANSWERS, hair_length: undefined },
        user_id: "user-1",
        updated_at: "2026-08-12T08:00:00.000Z",
      },
    ],
    hair_profiles: [{ user_id: "user-1", diagnostics: { texture: "straight" }, facts_revision: 2 }],
  })

  const readiness = await updateMissingPlanBereitSourceFact(db as never, {
    userId: "user-1",
    email: "lea@example.test",
    leadId: "lead-legacy",
    sourceVersion: "2026-08-12T08:00:00.000Z",
    field: "hair_length",
    value: "long",
  })

  assert.equal(readiness.status, "ready")
  const factsCall = db.rpcs.find((call) => call.fn === "user_facts_save_v1")
  assert.ok(factsCall, "the upsert must still land against an existing diagnostics document")
  assert.equal(factsCall!.args.p_mode, "upsert")
  // Fix round 2: the corrected lead is the authority, so the SAME full projection is
  // written whether or not a diagnostics document already exists.
  const patch = factsCall!.args.p_patch as Row
  assert.equal((patch.source as Row | undefined)?.kind, "legacy_quiz")
  assert.equal(patch.hairLength, "long")
  assert.deepEqual(
    patch,
    projectLegacyLeadToFacts({
      leadId: "lead-legacy",
      quizAnswers: { ...COMPLETE_LEGACY_ANSWERS, hair_length: "long" } as never,
    }).diagnostics,
  )
  // The pre-existing `texture` is replaced by the corrected lead's own value.
  assert.equal((db.tables.hair_profiles[0].diagnostics as Row).texture, "wavy")
})

test("the recovery form's real hair length replaces an assumed default and clears the assumed marker", async () => {
  const oldAnswers = { ...COMPLETE_LEGACY_ANSWERS, hair_length: undefined }
  const linkedWithDefault = {
    ...projectLegacyLeadToFacts({ leadId: "lead-legacy", quizAnswers: oldAnswers as never })
      .diagnostics,
    hairLength: "long",
  }
  const db = new FakeSupabase({
    leads: [
      {
        id: "lead-legacy",
        email: "lea@example.test",
        quiz_kind: "legacy",
        quiz_answers: oldAnswers,
        user_id: "user-1",
        updated_at: "2026-08-12T08:00:00.000Z",
      },
    ],
    // What an account link of this old lead wrote (decision wave 1, item B).
    hair_profiles: [
      {
        user_id: "user-1",
        diagnostics: linkedWithDefault,
        facts_revision: 1,
        facts_provenance: {
          diagnostics: {
            source: { kind: "legacy_lead", id: "lead-legacy" },
            schemaVersion: 1,
            at: "2026-08-12T09:00:00.000Z",
            fields: { texture: "user", hairLength: "assumed" },
          },
        },
      },
    ],
  })

  const readiness = await updateMissingPlanBereitSourceFact(db as never, {
    userId: "user-1",
    email: "lea@example.test",
    leadId: "lead-legacy",
    sourceVersion: "2026-08-12T08:00:00.000Z",
    field: "hair_length",
    value: "short",
  })

  assert.equal(readiness.status, "ready")
  assert.equal((db.tables.hair_profiles[0].diagnostics as Row).hairLength, "short")
  const fields = ((db.tables.hair_profiles[0].facts_provenance as Row).diagnostics as Row)
    .fields as Row
  assert.equal(fields.hairLength, "user", "no stale assumed marker survives the real answer")
  assert.equal(
    Object.values(fields).includes("assumed"),
    false,
    "the corrected lead is complete, so nothing is assumed any more",
  )
})

test("foreign exact leads are forbidden and never patched from the recovery form", async () => {
  const db = new FakeSupabase({
    leads: [
      {
        id: "lead-foreign",
        email: "other@example.test",
        quiz_kind: "legacy",
        quiz_answers: { ...COMPLETE_LEGACY_ANSWERS, hair_length: undefined },
        user_id: "other-user",
        updated_at: "2026-08-12T08:00:00.000Z",
      },
    ],
  })

  const readiness = await updateMissingPlanBereitSourceFact(db as never, {
    userId: "user-1",
    email: "lea@example.test",
    leadId: "lead-foreign",
    sourceVersion: "2026-08-12T08:00:00.000Z",
    field: "hair_length",
    value: "long",
  })

  assert.equal(readiness.status, "forbidden")
  assert.equal(db.updates.length, 0)
  assert.equal(
    db.rpcs.some((call) => call.fn === "user_facts_save_v1"),
    false,
  )
})

test("Personal Plan readiness keeps the attached artifact and projected profile requirement", async () => {
  const db = new FakeSupabase({
    leads: [
      {
        id: "lead-pp",
        email: "lea@example.test",
        quiz_kind: "personal_plan",
        user_id: "user-1",
        updated_at: "2026-08-12T08:00:00.000Z",
      },
    ],
    personal_plan_prepared_artifacts: [
      {
        id: "artifact-1",
        lead_id: "lead-pp",
        user_id: "user-1",
        status: "attached",
        canonical_profile: COMPLETE_LEGACY_ANSWERS,
      },
    ],
    hair_profiles: [COMPLETE_PROFILE],
  })

  const readiness = await loadPlanBereitReadiness(db as never, {
    userId: "user-1",
    email: "lea@example.test",
    leadId: "lead-pp",
    expectedQuizSourceKind: "personal_plan",
  })

  assert.equal(readiness.status, "ready")
})

test("Personal Plan readiness is not ready when the attached artifact is not yet linked", async () => {
  const db = new FakeSupabase({
    leads: [
      {
        id: "lead-pp",
        email: "lea@example.test",
        quiz_kind: "personal_plan",
        user_id: "user-1",
        updated_at: "2026-08-12T08:00:00.000Z",
      },
    ],
    personal_plan_prepared_artifacts: [
      {
        id: "artifact-1",
        lead_id: "lead-pp",
        user_id: null,
        status: "attached",
        canonical_profile: COMPLETE_LEGACY_ANSWERS,
      },
    ],
    hair_profiles: [COMPLETE_PROFILE],
  })

  const readiness = await loadPlanBereitInitialReadiness(db as never, {
    userId: "user-1",
    email: "lea@example.test",
    leadId: "lead-pp",
    expectedQuizSourceKind: "personal_plan",
  })

  assert.equal(readiness.status, "checking")
  assert.equal(readiness.initialAction, "link")
  assert.equal(
    db.queries.some(
      (query) => query.table === "personal_plan_prepared_artifacts" && query.column === "user_id",
    ),
    false,
    "attached artifact readiness must not hide unlinked artifacts behind a user_id filter",
  )
})

test("Personal Plan initial readiness links when an attached artifact belongs to another user", async () => {
  const db = new FakeSupabase({
    leads: [
      {
        id: "lead-pp",
        email: "lea@example.test",
        quiz_kind: "personal_plan",
        user_id: "user-1",
        updated_at: "2026-08-12T08:00:00.000Z",
      },
    ],
    personal_plan_prepared_artifacts: [
      {
        id: "artifact-1",
        lead_id: "lead-pp",
        user_id: "other-user",
        status: "attached",
        canonical_profile: COMPLETE_LEGACY_ANSWERS,
      },
    ],
    hair_profiles: [COMPLETE_PROFILE],
  })

  const readiness = await loadPlanBereitInitialReadiness(db as never, {
    userId: "user-1",
    email: "lea@example.test",
    leadId: "lead-pp",
    expectedQuizSourceKind: "personal_plan",
  })

  assert.equal(readiness.status, "checking")
  assert.equal(readiness.initialAction, "link")
  assert.equal(db.updates.length, 0)
  assert.equal(db.upserts.length, 0)
  assert.equal(db.rpcs.length, 0)
})

test("Personal Plan POST keeps the authoritative artifact owner race rejection", async () => {
  const db = new FakeSupabase(
    {
      leads: [
        {
          id: "lead-pp",
          email: "lea@example.test",
          quiz_kind: "personal_plan",
          user_id: "user-1",
          updated_at: "2026-08-12T08:00:00.000Z",
        },
      ],
      personal_plan_prepared_artifacts: [
        {
          id: "artifact-1",
          lead_id: "lead-pp",
          user_id: "other-user",
          status: "attached",
          canonical_profile: COMPLETE_LEGACY_ANSWERS,
        },
      ],
      hair_profiles: [COMPLETE_PROFILE],
    },
    {
      link_personal_plan_artifact_to_user: {
        data: null,
        error: { message: "personal-plan artifact belongs to another user" },
      },
    },
  )

  await assert.rejects(
    () =>
      linkExactPlanBereitSourceToProfile(db as never, {
        userId: "user-1",
        email: "lea@example.test",
        leadId: "lead-pp",
        expectedQuizSourceKind: "personal_plan",
      }),
    /personal plan artifact link failed: personal-plan artifact belongs to another user/,
  )
  assert.deepEqual(db.rpcs, [
    {
      fn: "link_personal_plan_artifact_to_user",
      args: { p_lead_id: "lead-pp", p_user_id: "user-1" },
    },
  ])
  assert.equal(db.upserts.length, 0)
})

// --- scanner-first provisioning (scan_v1) -----------------------------------

/** A package lookup that answered: `null` is an organic buyer, not a broken lookup. */
function resolvedPackage(packageKey: string | null) {
  return { kind: "resolved", packageKey } as const
}

/** A package lookup that could not answer at all (query error, thrown or returned). */
const unavailablePackage = { kind: "unavailable" } as const

function scanFunnelDb() {
  return new FakeSupabase({
    leads: [
      {
        id: "lead-scan",
        email: "lea@example.test",
        quiz_kind: "legacy",
        quiz_answers: COMPLETE_LEGACY_ANSWERS,
        user_id: null,
        updated_at: "2026-09-12T08:00:00.000Z",
      },
    ],
    hair_profiles: [],
  })
}

function scanLinkInput() {
  return {
    userId: "user-1",
    email: "lea@example.test",
    leadId: "lead-scan",
    expectedQuizSourceKind: "legacy" as const,
  }
}

test("email return saves only a currently missing fact, retaining other answers and version CAS", async () => {
  const db = scanFunnelDb()
  db.tables.leads[0].user_id = "user-1"
  db.tables.leads[0].quiz_answers = {
    ...COMPLETE_LEGACY_ANSWERS,
    density: undefined,
    hair_length: undefined,
  }
  const deps = {
    resolveFunnelPackage: async () => resolvedPackage("customerio_scan_return_v1"),
    provisionStage1Plan: async () => ({ status: "completed" }),
  }
  const input = {
    ...scanLinkInput(),
    funnelSessionId: "return-session",
    sourceVersion: "2026-09-12T08:00:00.000Z",
  }
  const result = await updateMissingPlanBereitSourceFact(
    db as never,
    { ...input, field: "density", value: "high" },
    deps,
  )
  assert.equal(result.status, "missing_source_facts")
  if (result.status === "missing_source_facts")
    assert.deepEqual(
      result.missingFacts.map((f) => f.field),
      ["hair_length"],
    )
  assert.equal((db.tables.leads[0].quiz_answers as Row).density, "high")
  assert.equal((db.tables.leads[0].quiz_answers as Row).structure, "wavy")
  assert.equal(db.upserts.length, 0, "a partial recovery must not project incomplete profile")
  assert.equal(
    db.updates[0].filters.some((f) => f.column === "updated_at" && f.value === input.sourceVersion),
    true,
  )
  await updateMissingPlanBereitSourceFact(
    db as never,
    { ...input, field: "structure", value: "curly" },
    deps,
  )
  assert.equal(
    (db.tables.leads[0].quiz_answers as Row).structure,
    "wavy",
    "existing fact cannot be overwritten through recovery",
  )
})

test("legacy German-valued recovery preserves source answers and projects canonical profile values", async () => {
  const cases = [
    { field: "fingertest", value: "rau", profileField: "cuticle_condition", profileValue: "rough" },
    { field: "scalp_type", value: "trocken", profileField: "scalp_type", profileValue: "dry" },
    {
      field: "treatment",
      value: ["gefaerbt"],
      profileField: "chemical_treatment",
      profileValue: ["colored"],
    },
  ] as const
  for (const { field, value, profileField, profileValue } of cases) {
    const db = scanFunnelDb()
    db.tables.leads[0].user_id = "user-1"
    db.tables.leads[0].quiz_answers = { ...COMPLETE_LEGACY_ANSWERS, [field]: undefined }
    const result = await updateMissingPlanBereitSourceFact(
      db as never,
      {
        ...scanLinkInput(),
        funnelSessionId: "return-session",
        sourceVersion: "2026-09-12T08:00:00.000Z",
        field,
        value: typeof value === "string" ? value : [...value],
      },
      {
        resolveFunnelPackage: async () => resolvedPackage("customerio_scan_return_v1"),
        provisionStage1Plan: async () => ({ status: "completed" }),
      },
    )
    assert.equal(result.status, "ready", field)
    assert.deepEqual((db.tables.leads[0].quiz_answers as Row)[field], value, field)
    // Merge adaptation (single write path): the corrected lead is re-projected through
    // `user_facts_save_v1` as an unconditional upsert, and the legacy column is what the
    // RPC derives from the stored diagnostics (the fake RPC stores, it does not derive —
    // derivation parity is `user-facts-derive-parity.test.ts`).
    const factsCalls = db.rpcs.filter((call) => call.fn === "user_facts_save_v1")
    assert.equal(factsCalls.length, 1, field)
    assert.equal(factsCalls[0].args.p_mode, "upsert", field)
    const stored = diagnosticsV1Schema.parse(db.tables.hair_profiles[0].diagnostics)
    assert.deepEqual(
      deriveDiagnosticsColumns(stored)[
        profileField as keyof ReturnType<typeof deriveDiagnosticsColumns>
      ],
      profileValue,
      field,
    )
  }
})

test("stale missing-fact writes do not replace a newer quiz", async () => {
  const db = scanFunnelDb()
  db.tables.leads[0].user_id = "user-1"
  db.tables.leads[0].quiz_answers = { ...COMPLETE_LEGACY_ANSWERS, density: undefined }
  const result = await updateMissingPlanBereitSourceFact(
    db as never,
    {
      ...scanLinkInput(),
      funnelSessionId: "return-session",
      field: "density",
      value: "high",
      sourceVersion: "stale",
    },
    {
      resolveFunnelPackage: async () => resolvedPackage("customerio_scan_return_v1"),
      provisionStage1Plan: async () => ({ status: "completed" }),
    },
  )
  assert.equal(result.status, "source_pending")
  assert.equal((db.tables.leads[0].quiz_answers as Row).density, undefined)
  assert.equal(db.upserts.length, 0)
})

test("email package recovery needs the exact supplied lead session", async () => {
  const db = scanFunnelDb()
  db.tables.leads[0].user_id = "user-1"
  db.tables.leads[0].quiz_answers = { ...COMPLETE_LEGACY_ANSWERS, density: undefined }
  const calls: Array<string | null | undefined> = []
  const deps = {
    resolveFunnelPackage: async (_lead: string, session?: string | null) => {
      calls.push(session)
      return resolvedPackage("customerio_scan_return_v1")
    },
    provisionStage1Plan: async () => ({ status: "completed" }),
  }
  assert.equal(
    (await loadPlanBereitReadiness(db as never, scanLinkInput(), deps)).status,
    "invalid_source",
  )
  const recovery = await loadPlanBereitReadiness(
    db as never,
    { ...scanLinkInput(), funnelSessionId: "exact-return" },
    deps,
  )
  assert.equal(recovery.status, "missing_source_facts")
  assert.deepEqual(calls, [undefined, "exact-return"])
})

test("Personal Plan email returns provision only with facts, attached artifact and exact session", async () => {
  const db = new FakeSupabase({
    leads: [
      {
        id: "lead-pp",
        email: "lea@example.test",
        user_id: "user-1",
        quiz_kind: "personal_plan",
        quiz_answers: {
          kind: "personal_plan",
          version: 3,
          answers: {
            texture: "wavy",
            thickness: "fine",
            density: "low",
            hairLength: "medium",
            hairSurface: "rough",
            elasticResponse: "snaps",
            scalpOiliness: "dry",
            goals: ["moisture"],
            chemicalTreatments: ["colored"],
          },
        },
      },
    ],
    personal_plan_prepared_artifacts: [],
    hair_profiles: [COMPLETE_PROFILE],
  })
  let provisioned = 0
  const deps = {
    resolveFunnelPackage: async () => resolvedPackage("customerio_scan_return_v1"),
    provisionStage1Plan: async () => {
      provisioned++
      return { status: "completed" }
    },
  }
  const input = {
    userId: "user-1",
    email: "lea@example.test",
    leadId: "lead-pp",
    expectedQuizSourceKind: "personal_plan" as const,
    funnelSessionId: "return-session",
  }
  assert.equal((await loadPlanBereitReadiness(db as never, input, deps)).status, "source_pending")
  assert.equal(provisioned, 0)
  db.tables.personal_plan_prepared_artifacts.push({
    id: "artifact",
    lead_id: "lead-pp",
    user_id: "user-1",
    status: "attached",
    quiz_answers: db.tables.leads[0].quiz_answers,
    canonical_profile: COMPLETE_LEGACY_ANSWERS,
  })
  assert.equal((await loadPlanBereitReadiness(db as never, input, deps)).status, "ready")
  assert.equal(provisioned, 1)
})

test("exact email return repairs a missing Personal Plan artifact only after the post-access POST", async () => {
  // Merge adaptation: a complete v3 envelope — the real repair RPC only ever attaches one
  // that passes `personalPlanDurableAnswersSchema`, and the account-link facts writer
  // projects the attached artifact's envelope (it no longer stores `canonical_profile`).
  const answers = {
    kind: "personal_plan",
    version: 3,
    answers: {
      texture: "wavy",
      thickness: "fine",
      density: "low",
      hairLength: "medium",
      hairSurface: "rough",
      elasticResponse: "snaps",
      scalpOiliness: "dry",
      scalpConcerns: [],
      goals: ["moisture"],
      chemicalTreatments: ["colored"],
      currentConcerns: ["dry_lengths"],
      routineClarity: "partial",
      resultReliability: "sometimes",
      adaptationConfidence: "partly",
      previousAttempts: "some_steps_helped",
      blockers: ["consistency"],
      routineStyle: "simple_reliable",
      meaningfulMoment: "everyday",
    },
  }
  const db = new FakeSupabase(
    {
      leads: [
        {
          id: "lead-pp-return",
          email: "lea@example.test",
          quiz_kind: "personal_plan",
          quiz_answers: answers,
          user_id: null,
          updated_at: "2026-09-12T08:00:00.000Z",
        },
      ],
      personal_plan_prepared_artifacts: [],
      hair_profiles: [],
    },
    {
      link_personal_plan_artifact_to_user: {
        data: [{ canonical_profile: COMPLETE_LEGACY_ANSWERS }],
        error: null,
      },
    },
  )
  const repairCalls: Array<{ leadId: string; userId: string; quizAnswers: unknown }> = []
  const deps = {
    resolveFunnelPackage: async () => resolvedPackage("customerio_scan_return_v1"),
    provisionStage1Plan: async () => ({ status: "completed" }),
    repairPersonalPlanArtifact: async (input: {
      leadId: string
      userId: string
      quizAnswers: unknown
    }) => {
      repairCalls.push(input)
      db.tables.personal_plan_prepared_artifacts.push({
        id: "repaired-artifact",
        lead_id: input.leadId,
        user_id: input.userId,
        status: "attached",
        quiz_answers: input.quizAnswers,
        canonical_profile: COMPLETE_LEGACY_ANSWERS,
      })
      return { status: "repaired" as const, artifactId: "repaired-artifact" }
    },
  }
  const input = {
    userId: "user-1",
    email: "lea@example.test",
    leadId: "lead-pp-return",
    expectedQuizSourceKind: "personal_plan" as const,
    funnelSessionId: "exact-return",
  }

  const initial = await loadPlanBereitInitialReadiness(db as never, input, deps)
  assert.equal(initial.status, "source_pending")
  assert.equal(initial.initialAction, "link")
  assert.equal(repairCalls.length, 0)
  assert.equal(db.updates.length, 0)

  const linked = await linkExactPlanBereitSourceToProfile(db as never, input, deps)
  assert.equal(linked.status, "ready")
  assert.deepEqual(repairCalls, [
    { leadId: input.leadId, userId: input.userId, quizAnswers: answers },
  ])
  assert.equal(db.tables.leads[0].user_id, input.userId)
  assert.equal(db.tables.personal_plan_prepared_artifacts.length, 1)
  // The facts come from the REPAIRED artifact's own envelope.
  const stored = diagnosticsV1Schema.parse(db.tables.hair_profiles[0].diagnostics)
  assert.equal(stored.source.kind, "personal_plan_v3")
  assert.equal("artifactId" in stored.source ? stored.source.artifactId : null, "repaired-artifact")
  assert.equal(stored.hairLength, "medium")
})

test("email return will not use a stale Personal Plan artifact as scanner-ready source", async () => {
  const oldAnswers = {
    kind: "personal_plan",
    version: 3,
    answers: {
      texture: "wavy",
      thickness: "fine",
      density: "low",
      hairLength: null,
      hairSurface: "rough",
      elasticResponse: "snaps",
      scalpOiliness: "dry",
      goals: ["moisture"],
      chemicalTreatments: ["colored"],
    },
  }
  const newAnswers = {
    ...oldAnswers,
    answers: { ...oldAnswers.answers, hairLength: "medium" },
  }
  const db = new FakeSupabase({
    leads: [
      {
        id: "lead-pp-stale",
        email: "lea@example.test",
        quiz_kind: "personal_plan",
        quiz_answers: newAnswers,
        user_id: "user-1",
        updated_at: "2026-09-12T08:00:00.000Z",
      },
    ],
    personal_plan_prepared_artifacts: [
      {
        id: "artifact-old",
        lead_id: "lead-pp-stale",
        user_id: "user-1",
        status: "attached",
        quiz_answers: oldAnswers,
        canonical_profile: COMPLETE_LEGACY_ANSWERS,
      },
    ],
    hair_profiles: [COMPLETE_PROFILE],
  })
  const input = {
    userId: "user-1",
    email: "lea@example.test",
    leadId: "lead-pp-stale",
    expectedQuizSourceKind: "personal_plan" as const,
    funnelSessionId: "exact-return",
  }
  const deps = {
    resolveFunnelPackage: async () => resolvedPackage("customerio_scan_return_v1"),
    provisionStage1Plan: async () => ({ status: "completed" }),
    repairPersonalPlanArtifact: async () => ({ status: "conflict" as const }),
  }
  const initial = await loadPlanBereitInitialReadiness(db as never, input, deps)
  assert.equal(initial.status, "source_pending")
  assert.equal(initial.initialAction, "link")
  const blocked = await linkExactPlanBereitSourceToProfile(db as never, input, deps)
  assert.equal(blocked.status, "invalid_source")
  assert.equal(db.rpcs.length, 0, "stale artifact must not enter the ordinary linker")
})

test("a scan_v1 buyer gets the initial need snapshot provisioned inside the link poll", async () => {
  const db = scanFunnelDb()
  const packageLookups: string[] = []
  const provisioned: string[] = []

  await linkExactPlanBereitSourceToProfile(db as never, scanLinkInput(), {
    resolveFunnelPackage: async (leadId: string) => {
      packageLookups.push(leadId)
      return resolvedPackage("scan_v1")
    },
    provisionStage1Plan: async (_supabase, userId) => {
      provisioned.push(userId)
      return { status: "completed" }
    },
  })

  // One resolution per readiness pass, and the link performs two: the link itself
  // and the readiness read it returns. Both see the same lead.
  assert.deepEqual(packageLookups, ["lead-scan", "lead-scan"])
  assert.deepEqual(provisioned, ["user-1"])
  // Stage 1 resolves the entitlement through the enrollment, which needs the lead link
  // to exist first — so the link update must already have happened by then.
  assert.deepEqual(
    db.updates.map((update) => [update.table, update.values]),
    [["leads", { user_id: "user-1", status: "linked" }]],
  )
  assert.equal(
    db.updates[0].filters.some((filter) => filter.column === "user_id" && filter.value === null),
    true,
    "the link cannot steal a lead claimed after the readiness read",
  )
})

test("scanner provisioning repeats safely once the lead is already linked", async () => {
  const db = scanFunnelDb()
  db.tables.leads[0].user_id = "user-1"
  const provisioned: string[] = []

  await linkExactPlanBereitSourceToProfile(db as never, scanLinkInput(), {
    resolveFunnelPackage: async () => resolvedPackage("scan_v1"),
    provisionStage1Plan: async (_supabase, userId) => {
      provisioned.push(userId)
      return { status: "completed" }
    },
  })

  // The read-back performs the idempotent loadOrCreate once for this request.
  // The lead link itself is only written while it is still missing.
  assert.deepEqual(provisioned, ["user-1"])
  assert.equal(db.updates.length, 0)
})

test("organic legacy buyers keep the pre-scanner link behaviour", async () => {
  for (const packageKey of [null, "organic", "personal_plan_v1"]) {
    const db = scanFunnelDb()
    let provisionCalls = 0

    await linkExactPlanBereitSourceToProfile(db as never, scanLinkInput(), {
      resolveFunnelPackage: async () => resolvedPackage(packageKey),
      provisionStage1Plan: async () => {
        provisionCalls += 1
        return { status: "completed" }
      },
    })

    assert.equal(provisionCalls, 0, `package ${packageKey}`)
    assert.equal(
      db.rpcs.filter((call) => call.fn === "user_facts_save_v1").length,
      1,
      `package ${packageKey} still writes diagnostics facts`,
    )
    assert.equal(db.updates.length, 1, `package ${packageKey} still links the lead`)
  }
})

test("a personal-plan lead never triggers scanner provisioning", async () => {
  const db = new FakeSupabase(
    {
      leads: [
        {
          id: "lead-pp",
          email: "lea@example.test",
          quiz_kind: "personal_plan",
          user_id: null,
          updated_at: "2026-09-12T08:00:00.000Z",
        },
      ],
      personal_plan_prepared_artifacts: [
        { id: "artifact-1", lead_id: "lead-pp", user_id: null, status: "attached" },
      ],
    },
    {
      link_personal_plan_artifact_to_user: { data: null, error: null },
    },
  )
  let provisionCalls = 0
  let packageLookups = 0

  await linkExactPlanBereitSourceToProfile(
    db as never,
    {
      userId: "user-1",
      email: "lea@example.test",
      leadId: "lead-pp",
      expectedQuizSourceKind: "personal_plan",
    },
    {
      resolveFunnelPackage: async () => {
        packageLookups += 1
        return resolvedPackage("scan_v1")
      },
      provisionStage1Plan: async () => {
        provisionCalls += 1
        return { status: "completed" }
      },
    },
  )

  assert.equal(packageLookups, 0)
  assert.equal(provisionCalls, 0)
})

test("failed scanner provisioning reports transient_error instead of an empty camera", async () => {
  for (const status of ["temporarily_unavailable", "activation_pending", "invalid_source"]) {
    const readiness = await linkExactPlanBereitSourceToProfile(
      scanFunnelDb() as never,
      scanLinkInput(),
      {
        resolveFunnelPackage: async () => resolvedPackage("scan_v1"),
        provisionStage1Plan: async () => ({ status }),
      },
    )
    assert.equal(readiness.status, "transient_error", status)
    assert.equal(readiness.leadId, "lead-scan", status)
  }
})

test("a lead with no funnel session at all is an organic buyer, not a blocked one", async () => {
  // A *missing* `funnel_sessions` row is a resolved answer: organic. It must keep the
  // pre-scanner behaviour — no provisioning, plan destination — instead of blocking a
  // paid buyer. Only a lookup that could not answer at all is treated as an error.
  const db = scanFunnelDb()
  let provisionCalls = 0

  const readiness = await linkExactPlanBereitSourceToProfile(db as never, scanLinkInput(), {
    resolveFunnelPackage: async () => resolvedPackage(null),
    provisionStage1Plan: async () => {
      provisionCalls += 1
      return { status: "completed" }
    },
  })

  assert.equal(provisionCalls, 0)
  assert.equal(db.rpcs.filter((call) => call.fn === "user_facts_save_v1").length, 1)
  // Organic and non-scan_v1, so no provisioning — but the link itself still writes
  // diagnostics facts and links the lead, so the tail readiness read reaches `ready`.
  assert.equal(readiness.status, "ready", "the linked profile is visible on the read-back")
  assert.equal(readiness.funnelPackageKey, null, "organic, and said so explicitly")
})

test("a missing funnel session still reaches ready — organic, with no package", async () => {
  const readiness = await loadPlanBereitInitialReadiness(
    linkedScanFunnelDb() as never,
    scanLinkInput(),
    {
      resolveFunnelPackage: async () => resolvedPackage(null),
      provisionStage1Plan: async () => ({ status: "completed" }),
    },
  )

  assert.equal(readiness.status, "ready")
  assert.equal(readiness.funnelPackageKey, null)
})

test("a package lookup that cannot answer never reports ready, on either status path", async () => {
  // The blocker this replaces: a swallowed DB error read as "organic" sent a paid
  // scanner buyer to /plan-start with no need snapshot. Both the GET path (read) and
  // the POST path (link) have to refuse instead.
  for (const unavailableLookup of [
    async () => unavailablePackage,
    async () => {
      throw new Error("funnel_sessions lookup exploded")
    },
  ]) {
    let provisionCalls = 0
    const deps = {
      resolveFunnelPackage: unavailableLookup,
      provisionStage1Plan: async () => {
        provisionCalls += 1
        return { status: "completed" }
      },
    }

    const read = await loadPlanBereitInitialReadiness(
      linkedScanFunnelDb() as never,
      scanLinkInput(),
      deps,
    )
    assert.equal(read.status, "transient_error", "GET path")
    assert.equal(read.leadId, "lead-scan")
    assert.equal(read.funnelPackageKey, null, "an unavailable lookup never claims a package")

    const linked = await linkExactPlanBereitSourceToProfile(
      scanFunnelDb() as never,
      scanLinkInput(),
      deps,
    )
    assert.equal(linked.status, "transient_error", "POST path")
    assert.equal(linked.leadId, "lead-scan")

    assert.equal(provisionCalls, 0, "nothing is provisioned on a package we could not read")
  }
})

test("the resolved package travels with every readiness outcome", async () => {
  for (const packageKey of ["scan_v1", "default_organic", null]) {
    const readiness = await loadPlanBereitInitialReadiness(
      linkedScanFunnelDb() as never,
      scanLinkInput(),
      {
        resolveFunnelPackage: async () => resolvedPackage(packageKey),
        provisionStage1Plan: async () => ({ status: "completed" }),
      },
    )

    assert.equal(readiness.status, "ready", `package ${packageKey}`)
    assert.equal(readiness.funnelPackageKey, packageKey, `package ${packageKey}`)
  }

  // A waiting outcome carries it too: the client renders the arrival copy long
  // before it ever reaches `ready`.
  const waiting = await loadPlanBereitInitialReadiness(scanFunnelDb() as never, scanLinkInput(), {
    resolveFunnelPackage: async () => resolvedPackage("scan_v1"),
    provisionStage1Plan: async () => ({ status: "completed" }),
  })
  assert.equal(waiting.status, "checking")
  assert.equal(waiting.funnelPackageKey, "scan_v1")
})

test("the production package resolver separates a missing row from a broken lookup", async () => {
  assert.deepEqual(
    await resolvePlanBereitFunnelPackage("lead-scan", async () => ({
      kind: "resolved",
      context: null,
    })),
    { kind: "resolved", packageKey: null },
    "no funnel session — organic",
  )
  assert.deepEqual(
    await resolvePlanBereitFunnelPackage("lead-scan", async () => ({
      kind: "resolved",
      context: { packageKey: "scan_v1" } as never,
    })),
    { kind: "resolved", packageKey: "scan_v1" },
  )
  assert.deepEqual(
    await resolvePlanBereitFunnelPackage("lead-scan", async () => ({ kind: "unavailable" })),
    { kind: "unavailable" },
    "a returned query error",
  )
  assert.deepEqual(
    await resolvePlanBereitFunnelPackage("lead-scan", async () => {
      throw new Error("network down")
    }),
    { kind: "unavailable" },
    "a thrown query error",
  )
})

// --- scanner-first provisioning on the read paths (C1 / I1) ------------------

function linkedScanFunnelDb() {
  const db = scanFunnelDb()
  db.tables.leads[0].user_id = "user-1"
  db.tables.hair_profiles.push({ ...COMPLETE_PROFILE })
  return db
}

test("a scan_v1 buyer whose profile is already linked is provisioned before ready is reported", async () => {
  // C1: checkout activation already writes hair_profiles and leads.user_id, so the very
  // first /plan-bereit render takes the alreadyProjected path and never POSTs. Without
  // provisioning here the buyer would reach "Scanner öffnen" with no need version.
  const db = linkedScanFunnelDb()
  const events: string[] = []

  const readiness = await loadPlanBereitInitialReadiness(db as never, scanLinkInput(), {
    resolveFunnelPackage: async (leadId: string) => {
      events.push(`lookup:${leadId}`)
      return resolvedPackage("scan_v1")
    },
    provisionStage1Plan: async (_supabase, userId) => {
      events.push(`provision:${userId}`)
      return { status: "completed" }
    },
  })

  assert.deepEqual(events, ["lookup:lead-scan", "provision:user-1"])
  assert.equal(readiness.status, "ready")
  assert.equal(readiness.initialAction, "none")
})

test("a scan_v1 buyer never sees ready while provisioning fails, and a plain retry re-runs it", async () => {
  // I1: the retry button re-issues the GET, so the GET itself has to provision —
  // a POST-only provisioning step would hand the buyer an empty scanner on retry.
  const db = linkedScanFunnelDb()
  let attempts = 0
  const deps = {
    resolveFunnelPackage: async () => resolvedPackage("scan_v1"),
    provisionStage1Plan: async () => {
      attempts += 1
      return { status: attempts === 1 ? "temporarily_unavailable" : "completed" }
    },
  }

  const failed = await loadPlanBereitInitialReadiness(db as never, scanLinkInput(), deps)
  assert.equal(failed.status, "transient_error")
  assert.equal(failed.leadId, "lead-scan")

  const retried = await loadPlanBereitInitialReadiness(db as never, scanLinkInput(), deps)
  assert.equal(attempts, 2, "the retry re-runs provisioning rather than reporting ready blindly")
  assert.equal(retried.status, "ready")
})

test("an organic lead reaches ready without any provisioning call", async () => {
  const db = linkedScanFunnelDb()
  let provisionCalls = 0

  const readiness = await loadPlanBereitInitialReadiness(db as never, scanLinkInput(), {
    resolveFunnelPackage: async () => resolvedPackage("default_organic"),
    provisionStage1Plan: async () => {
      provisionCalls += 1
      return { status: "completed" }
    },
  })

  assert.equal(provisionCalls, 0)
  assert.equal(readiness.status, "ready")
})

test("a personal_plan source is never even looked up on the read path", async () => {
  const db = new FakeSupabase({
    leads: [
      {
        id: "lead-pp",
        email: "lea@example.test",
        quiz_kind: "personal_plan",
        user_id: "user-1",
        updated_at: "2026-09-12T08:00:00.000Z",
      },
    ],
    personal_plan_prepared_artifacts: [
      {
        id: "artifact-1",
        lead_id: "lead-pp",
        user_id: "user-1",
        status: "attached",
        canonical_profile: COMPLETE_LEGACY_ANSWERS,
      },
    ],
    hair_profiles: [{ ...COMPLETE_PROFILE }],
  })
  let packageLookups = 0

  const readiness = await loadPlanBereitInitialReadiness(
    db as never,
    {
      userId: "user-1",
      email: "lea@example.test",
      leadId: "lead-pp",
      expectedQuizSourceKind: "personal_plan",
    },
    {
      resolveFunnelPackage: async () => {
        packageLookups += 1
        return resolvedPackage("scan_v1")
      },
      provisionStage1Plan: async () => ({ status: "completed" }),
    },
  )

  assert.equal(packageLookups, 0)
  assert.equal(readiness.status, "ready")
})
