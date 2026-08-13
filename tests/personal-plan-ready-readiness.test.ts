import assert from "node:assert/strict"
import test from "node:test"

import {
  loadPlanBereitReadiness,
  updateMissingPlanBereitSourceFact,
} from "../src/app/plan-bereit/readiness"

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

  async maybeSingle() {
    const rows = this.db.tables[this.table] ?? []
    const matching = rows.filter((row) =>
      this.filters.every(({ column, value }) => row[column] === value),
    )

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

  constructor(readonly tables: Record<string, Row[]>) {}

  from(table: string) {
    return new FakeQuery(this, table)
  }
}

test("legacy readiness is ready from the exact lead snapshot without hair_profiles as authority", async () => {
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
    hair_profiles: [{ user_id: "user-1" }],
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

test("legacy readiness accepts the exact active regular-quiz field-test enrollment", async () => {
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

  const readiness = await loadPlanBereitReadiness(db as never, {
    userId: "guest-1",
    email: "field-test@guest.chaarlie.invalid",
    leadId: "lead-legacy-field-test",
    expectedQuizSourceKind: "legacy",
  })

  assert.equal(readiness.status, "ready")
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
  assert.equal(db.upserts.length, 1)
  assert.equal(db.upserts[0].table, "hair_profiles")
  assert.equal(db.upserts[0].onConflict, "user_id")
  assert.equal(db.upserts[0].values.user_id, "user-1")
  assert.equal(db.upserts[0].values.hair_length, "long")
  assert.equal("goals" in db.upserts[0].values, false)
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
})

test("Personal Plan readiness keeps the attached artifact requirement", async () => {
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
      { id: "artifact-1", lead_id: "lead-pp", user_id: "user-1", status: "attached" },
    ],
    hair_profiles: [],
  })

  const readiness = await loadPlanBereitReadiness(db as never, {
    userId: "user-1",
    email: "lea@example.test",
    leadId: "lead-pp",
    expectedQuizSourceKind: "personal_plan",
  })

  assert.equal(readiness.status, "ready")
})
