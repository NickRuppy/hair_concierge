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

const COMPLETE_PROFILE = {
  user_id: "user-1",
  hair_texture: "wavy",
  thickness: "fine",
  hair_length: "medium",
  density: "low",
  cuticle_condition: "rough",
  protein_moisture_balance: "snaps",
  scalp_type: "dry",
  scalp_condition: null,
  concerns: ["frizz"],
  chemical_treatment: ["colored"],
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
    return Promise.resolve({ data: this.matchingRows(), error: null }).then(onfulfilled, onrejected)
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
    return Promise.resolve(this.rpcResults[fn] ?? { data: null, error: null })
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

test("legacy readiness is not a no-op when the persisted profile misses a projected fact", async () => {
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
    hair_profiles: [{ ...COMPLETE_PROFILE, hair_length: null }],
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
    db.queries.some((query) => query.table === "hair_profiles" && query.column === "user_id"),
    true,
  )
})

test("legacy readiness compares every projected profile field and ignores goals plus unrelated fields", async () => {
  const fieldMutations: Array<[keyof typeof COMPLETE_PROFILE, unknown]> = [
    ["hair_texture", "curly"],
    ["thickness", "coarse"],
    ["hair_length", "long"],
    ["density", "medium"],
    ["cuticle_condition", "smooth"],
    ["protein_moisture_balance", "stretches"],
    ["scalp_type", "balanced"],
    ["scalp_condition", "dandruff"],
    ["concerns", []],
    ["chemical_treatment", []],
  ]

  for (const [field, value] of fieldMutations) {
    const db = new FakeSupabase({
      leads: [
        {
          id: `lead-${field}`,
          email: "lea@example.test",
          quiz_kind: "legacy",
          quiz_answers: COMPLETE_LEGACY_ANSWERS,
          user_id: "user-1",
          updated_at: "2026-08-12T08:00:00.000Z",
        },
      ],
      hair_profiles: [
        { ...COMPLETE_PROFILE, goals: ["ignored"], unrelated_note: "ignored", [field]: value },
      ],
    })

    const readiness = await loadPlanBereitInitialReadiness(db as never, {
      userId: "user-1",
      email: "lea@example.test",
      leadId: `lead-${field}`,
      expectedQuizSourceKind: "legacy",
    })

    assert.equal(readiness.status, "checking", `${String(field)} mismatch should require link`)
    assert.equal(readiness.initialAction, "link", `${String(field)} mismatch should post once`)
    assert.equal(db.updates.length, 0)
    assert.equal(db.upserts.length, 0)
    assert.equal(db.rpcs.length, 0)
  }

  const matching = new FakeSupabase({
    leads: [
      {
        id: "lead-extra-fields",
        email: "lea@example.test",
        quiz_kind: "legacy",
        quiz_answers: COMPLETE_LEGACY_ANSWERS,
        user_id: "user-1",
        updated_at: "2026-08-12T08:00:00.000Z",
      },
    ],
    hair_profiles: [{ ...COMPLETE_PROFILE, goals: ["ignored"], unrelated_note: "ignored" }],
  })

  const readiness = await loadPlanBereitInitialReadiness(matching as never, {
    userId: "user-1",
    email: "lea@example.test",
    leadId: "lead-extra-fields",
    expectedQuizSourceKind: "legacy",
  })

  assert.equal(readiness.status, "ready")
  assert.equal(readiness.initialAction, "none")
})

test("legacy readiness treats missing projected fields and array order drift as unequal", async () => {
  const missingThicknessProfile = { ...COMPLETE_PROFILE }
  delete (missingThicknessProfile as Partial<typeof COMPLETE_PROFILE>).thickness

  const cases: Array<{ name: string; answers: Row; profile: Row }> = [
    {
      name: "missing scalar",
      answers: COMPLETE_LEGACY_ANSWERS,
      profile: missingThicknessProfile,
    },
    {
      name: "array order",
      answers: { ...COMPLETE_LEGACY_ANSWERS, treatment: ["gefaerbt", "blondiert"] },
      profile: { ...COMPLETE_PROFILE, chemical_treatment: ["bleached", "colored"] },
    },
  ]

  for (const fixture of cases) {
    const db = new FakeSupabase({
      leads: [
        {
          id: `lead-${fixture.name}`,
          email: "lea@example.test",
          quiz_kind: "legacy",
          quiz_answers: fixture.answers,
          user_id: "user-1",
          updated_at: "2026-08-12T08:00:00.000Z",
        },
      ],
      hair_profiles: [fixture.profile],
    })

    const readiness = await loadPlanBereitInitialReadiness(db as never, {
      userId: "user-1",
      email: "lea@example.test",
      leadId: `lead-${fixture.name}`,
      expectedQuizSourceKind: "legacy",
    })

    assert.equal(readiness.status, "checking", fixture.name)
    assert.equal(readiness.initialAction, "link", fixture.name)
  }
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

test("legacy initial readiness keeps the authoritative POST for an unprojected owner lead", async () => {
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
    hair_profiles: [{ ...COMPLETE_PROFILE, density: "medium" }],
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
  assert.deepEqual(provisioned, ["user-1"])
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
    assert.equal(db.upserts.length, 1, `package ${packageKey} still projects the profile`)
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
  assert.equal(db.upserts.length, 1)
  assert.equal(readiness.status, "source_pending", "unchanged pre-scanner link outcome")
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
