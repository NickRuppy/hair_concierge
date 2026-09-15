import assert from "node:assert/strict"
import test from "node:test"

import {
  linkExactPlanBereitSourceToProfile,
  loadPlanBereitInitialReadiness,
  loadPlanBereitReadiness,
  resolvePlanBereitFunnelPackage,
  updateMissingPlanBereitSourceFact,
  needsFreshMigrationQuiz,
} from "../src/app/plan-bereit/readiness"
import { COMPLETE_V3_PLAN_ENVELOPE } from "./personal-plan/fixtures"

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

function isRow(value: unknown): value is Row {
  return typeof value === "object" && value !== null && !Array.isArray(value)
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
   * A deliberately minimal stand-in for the real `user_facts_save_v1` RPC
   * (task 3's SQL function): just enough of the create_only/preserve and
   * revision-bump contract for these readiness tests to exercise F28 without a
   * real Postgres. It never derives the legacy columns — that derivation has
   * its own parity test (`tests/user-facts-derive-parity.test.ts`) against the
   * real RPC — so `hair_profiles` rows here only ever carry `diagnostics` /
   * `quiz_context` / `facts_revision`, which is all F28 reads.
   */
  private simulateUserFactsSave(args: Row) {
    const rows = (this.tables.hair_profiles ??= [])
    let profile = rows.find((row) => row.user_id === args.p_user_id)
    if (!profile) {
      profile = { user_id: args.p_user_id, facts_revision: 0 }
      rows.push(profile)
    }
    const revision = (profile.facts_revision as number | undefined) ?? 0
    const domain = args.p_domain as string
    const existingDomain = profile[domain]

    if (args.p_mode === "create_only" && existingDomain != null) {
      return { status: "preserved", revision, changed: false, diagnosticsHash: null }
    }

    const patch = isRow(args.p_patch) ? args.p_patch : {}
    profile[domain] = { ...(isRow(existingDomain) ? existingDomain : {}), ...patch }
    profile.facts_revision = revision + 1
    return { status: "ok", revision: revision + 1, changed: true, diagnosticsHash: null }
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

// --- F28: diagnostics-presence readiness, independent of write outcome ------
//
// Replaces the old field-by-field `profileMatchesProjected` comparison tests:
// F28 only checks that `hair_profiles.diagnostics` is non-null and
// `facts_revision > 0` for the owning candidate — not that its content matches
// what THIS candidate would have projected. That means a profile a totally
// different, earlier source wrote is "ready" too, and `create_only` never
// overwrites it (the SQL layer's own parity/adversarial tests cover the
// derivation and preserve rules in full; this file only has to prove readiness
// reads the presence predicate correctly and that linking never clobbers it).

test("F28: linking preserves an existing differing legacy profile and reports ready, never sticking on checking", async () => {
  const db = new FakeSupabase({
    leads: [
      {
        id: "lead-legacy",
        email: "lea@example.test",
        quiz_kind: "legacy",
        quiz_answers: COMPLETE_LEGACY_ANSWERS,
        user_id: null,
        updated_at: "2026-09-14T08:00:00.000Z",
      },
    ],
    // Written by an entirely different, earlier source; its content has
    // nothing to do with this lead's answers. F28 doesn't compare content, and
    // creation order (before/after this candidate) makes no difference either
    // — the predicate has no notion of "which came first".
    hair_profiles: [{ user_id: "user-1", diagnostics: { texture: "straight" }, facts_revision: 3 }],
  })

  const before = await loadPlanBereitReadiness(db as never, {
    userId: "user-1",
    email: "lea@example.test",
    leadId: "lead-legacy",
    expectedQuizSourceKind: "legacy",
  })
  assert.equal(before.status, "source_pending", "not yet linked to this lead/user pair")

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
    { texture: "straight" },
    "the existing domain must be preserved, not overwritten",
  )
})

test("F28: linking preserves an existing differing artifact-sourced profile and reports ready", async () => {
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
        },
      ],
      hair_profiles: [
        { user_id: "user-1", diagnostics: { texture: "straight" }, facts_revision: 2 },
      ],
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
  const factsCalls = db.rpcs.filter((call) => call.fn === "user_facts_save_v1")
  assert.equal(factsCalls.length, 2, "diagnostics + quiz_context")
  assert.equal(factsCalls[0].args.p_domain, "diagnostics")
  assert.equal(factsCalls[0].args.p_mode, "create_only")
  assert.equal(factsCalls[1].args.p_domain, "quiz_context")
  assert.deepEqual(
    db.tables.hair_profiles[0].diagnostics,
    { texture: "straight" },
    "the existing domain must be preserved, not overwritten",
  )
})

test("F28: linking a user with no existing profile at all creates diagnostics facts and reports ready", async () => {
  const db = new FakeSupabase({
    leads: [
      {
        id: "lead-legacy",
        email: "lea@example.test",
        quiz_kind: "legacy",
        quiz_answers: COMPLETE_LEGACY_ANSWERS,
        user_id: null,
        updated_at: "2026-09-14T08:00:00.000Z",
      },
    ],
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
  assert.equal(factsCall!.args.p_mode, "create_only")
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
      ["user_id", "user-1"],
      ["quiz_kind", "legacy"],
      ["updated_at", "2026-08-12T08:00:00.000Z"],
    ],
  )

  // F28/task 5a: the direct `hair_profiles` upsert is gone.
  assert.equal(db.upserts.length, 0)
  // I3 (fix round 1): this is a correction to a single already-established fact,
  // not a fresh account-link projection — `saveUserFacts` gets `mode: "upsert"`
  // with a single-field `{ hairLength }` patch (so it lands even when a
  // diagnostics document already exists), not the full create_only projection.
  const factsCall = db.rpcs.find((call) => call.fn === "user_facts_save_v1")
  assert.ok(factsCall, "expected a user_facts_save_v1 call")
  assert.equal(factsCall!.args.p_user_id, "user-1")
  assert.equal(factsCall!.args.p_domain, "diagnostics")
  assert.equal(factsCall!.args.p_mode, "upsert")
  assert.deepEqual(factsCall!.args.p_patch, { hairLength: "long" })
  const provenance = factsCall!.args.p_provenance as Row
  assert.deepEqual(provenance.source, { kind: "legacy_lead", id: "lead-legacy" })
  assert.equal(provenance.editedAt, undefined)
  assert.equal(provenance.preservedCandidates, undefined)
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
  assert.deepEqual(factsCall!.args.p_patch, { hairLength: "long" })
  // The pre-existing `texture` field survives the field-level merge; only
  // `hairLength` was patched in.
  assert.deepEqual(db.tables.hair_profiles[0].diagnostics, {
    texture: "straight",
    hairLength: "long",
  })
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
  // Two provisioning calls, not one: by the time the link's own tail `loadPlanBereitReadiness`
  // read runs, the lead is already linked and diagnostics facts already written (F28), so that
  // read ALSO reaches `ready` and provisions again — `provisionStage1Plan` is documented
  // idempotent precisely so every `ready`-reaching pass may re-run it safely.
  assert.deepEqual(provisioned, ["user-1", "user-1"])
  // Stage 1 resolves the entitlement through the enrollment, which needs the lead link
  // to exist first — so the link update must already have happened by then.
  assert.deepEqual(
    db.updates.map((update) => [update.table, update.values]),
    [["leads", { user_id: "user-1", status: "linked" }]],
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

  // Every pass re-runs the idempotent loadOrCreate (it reuses an existing plan): once
  // right after the link, once more in the readiness read that reports `ready`.
  // The lead link itself is only written while it is still missing.
  assert.deepEqual(provisioned, ["user-1", "user-1"])
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
  // diagnostics facts and links the lead, so the tail readiness read reaches `ready`
  // exactly like the pre-scanner flow always did once its own write landed.
  assert.equal(readiness.status, "ready", "unchanged pre-scanner link outcome")
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
