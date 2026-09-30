import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import test from "node:test"

import { saveMobileProfileEdit } from "../src/lib/mobile/profile-edit-service"
import { computeNeedPlan } from "../src/lib/personal-plan/compute-stage1"
import { hashPersonalPlanNeedVersionInput } from "../src/lib/personal-plan/persistence"
import { PERSONAL_PLAN_STAGE1_COMPUTATION_VERSION } from "../src/lib/personal-plan/persistence/stage1-service"
import { editableScannerQuizAnswers } from "../src/lib/scan/scanner-context"
import type { ScannerSourceRead } from "../src/lib/scan/scanner-context"
import type { ProfileEditRequest } from "../src/lib/mobile/profile-edit-contract"
import { loadSharedScannerContext } from "../src/lib/scan/scanner-context-supabase"
import { quizSupersedesFacts, writeAccountLinkFacts } from "../src/lib/user-facts/account-link"
import { deriveDiagnosticsColumns } from "../src/lib/user-facts/derive-legacy-columns"
import {
  mergeDiagnosticsPatch,
  profileAfterDiagnosticsWrite,
} from "../src/lib/user-facts/hand-edit"
import { projectArtifactToFacts } from "../src/lib/user-facts/project-artifact"
import { projectLegacyLeadToFacts } from "../src/lib/user-facts/project-legacy-lead"
import { parseUserFactsRow } from "../src/lib/user-facts/read"
import type { QuizAnswers } from "../src/lib/quiz/types"
import {
  DIAGNOSTICS_COLUMNS,
  mobileFactsDatabase,
  pgliteAdminClient,
  pgliteRpcClient,
  readClock,
  readRow,
} from "./mobile-profile-facts-pglite.fixtures"
import { legacyMobileEditProfilePatch } from "./mobile-legacy-profile-patch.oracle"
import { COMPLETE_V3_PLAN_ENVELOPE } from "./personal-plan/fixtures"
import {
  createInitialNeed,
  id,
  insertProfile,
  saveUserFacts,
  type PersonalPlanTestDb,
} from "./personal-plan-pglite-migration.fixtures"

/**
 * Clean-switch task 3 on the REAL schema (PGlite): `scanner_profile_edit_publish`'s mobile path
 * saves through `user_facts_save_v1` in the same transaction. Exact scanner-clock deltas are
 * asserted against the triggers production has.
 */

const OWNER = id(1, 1)
const LEAD = id(2, 2)
const QUIZ_TIME = "2026-09-01T08:00:00.000Z"

const ANSWERS: QuizAnswers = {
  structure: "wavy",
  thickness: "fine",
  density: "medium",
  hair_length: "long",
  fingertest: "rau",
  pulltest: "stretches_bounces",
  scalp_type: "ausgeglichen",
  has_scalp_issue: false,
  treatment: ["natur"],
  concerns: ["dryness"],
  goals: ["moisture"],
}

async function insertLead(pg: PersonalPlanTestDb, answers: QuizAnswers) {
  await pg.query(
    "insert into public.leads(id,user_id,quiz_kind,quiz_answers,status,created_at) values($1,$2,'legacy',$3,'linked',$4)",
    [LEAD, OWNER, JSON.stringify(answers), QUIZ_TIME],
  )
}

/** A linked web quiz: the lead plus the account link's facts write. */
async function seedQuizProfile(pg: PersonalPlanTestDb, answers: QuizAnswers = ANSWERS) {
  await insertProfile(pg, OWNER)
  await insertLead(pg, answers)
  const { diagnostics } = projectLegacyLeadToFacts({
    leadId: LEAD,
    quizAnswers: answers,
    takenAt: QUIZ_TIME,
  })
  const result = await saveUserFacts(pg, {
    userId: OWNER,
    domain: "diagnostics",
    patch: diagnostics,
    provenance: {
      source: { kind: "legacy_lead", id: LEAD },
      schemaVersion: 1,
      at: QUIZ_TIME,
      fields: { texture: "user" },
    },
  })
  assert.equal(result.status, "ok")
}

async function editable(client: ReturnType<typeof pgliteRpcClient>) {
  const read = (await client.rpc("scanner_context_read_source", { p_user_id: OWNER })).data as {
    profileRevision: string
  }
  return read.profileRevision
}

async function edit(
  client: ReturnType<typeof pgliteRpcClient>,
  answers: QuizAnswers,
  overrides: { expectedProfileRevision?: string; requestId?: string } = {},
) {
  return saveMobileProfileEdit(client as never, OWNER, {
    expectedProfileRevision: overrides.expectedProfileRevision ?? (await editable(client)),
    requestId: overrides.requestId ?? randomUUID(),
    answers: answers as ProfileEditRequest["answers"],
  })
}

function derivedColumns(row: Record<string, unknown>) {
  return Object.fromEntries(DIAGNOSTICS_COLUMNS.map((column) => [column, row[column]]))
}

test("mobile edit saves through the door: +1/+1 on the clock, one facts revision, columns derived, replay byte-equal", async (t) => {
  const pg = await mobileFactsDatabase(t)
  await seedQuizProfile(pg)
  const client = pgliteRpcClient(pg)
  const expected = await editable(client)
  const clockBefore = await readClock(pg, OWNER)
  const rowBefore = (await readRow(pg, OWNER))!

  const requestId = randomUUID()
  const answers = { ...ANSWERS, thickness: "coarse", goals: ["shine" as const] }
  const saved = await edit(client, answers, { requestId, expectedProfileRevision: expected })

  const clockAfter = await readClock(pg, OWNER)
  assert.equal(clockAfter.revision - clockBefore.revision, BigInt(1))
  assert.equal(clockAfter.profile - clockBefore.profile, BigInt(1))
  assert.equal(saved.profileRevision, clockAfter.profile.toString())

  const row = (await readRow(pg, OWNER))!
  assert.equal(row.facts_revision, (rowBefore.facts_revision as number) + 1)
  const facts = parseUserFactsRow(OWNER, row)
  assert.equal(facts.diagnostics?.thickness, "coarse")
  assert.deepEqual(facts.diagnostics?.goals, ["shine"])
  assert.equal(facts.diagnostics?.source.kind, "legacy_quiz", "the quiz source is kept")
  assert.deepEqual(facts.provenance.diagnostics?.source, { kind: "profile_editor" })
  assert.ok(facts.provenance.diagnostics?.editedAt)
  assert.deepEqual(facts.provenance.diagnostics?.fields, {
    texture: "user",
    thickness: "user",
    goals: "user",
  })
  // Every derived column is a function of the stored document (the door wrote them).
  assert.deepEqual(derivedColumns(row), deriveDiagnosticsColumns(facts.diagnostics!))
  assert.equal(row.thickness, "coarse")
  assert.deepEqual(row.goals, ["shine"])

  // Replay: the stored receipt, nothing written.
  const replay = await edit(client, answers, { requestId, expectedProfileRevision: expected })
  assert.deepEqual(replay, saved)
  assert.deepEqual(await readClock(pg, OWNER), clockAfter)
  assert.equal((await readRow(pg, OWNER))!.facts_revision, row.facts_revision)

  // The TS-prepared publication is what a later read computes from the stored row.
  const loaded = await loadSharedScannerContext(client as never, OWNER)
  assert.equal(loaded?.contextRevision, saved.contextRevision)
})

test("an unchanged mobile edit still moves the clock +1/+1 and writes a new facts revision", async (t) => {
  const pg = await mobileFactsDatabase(t)
  await seedQuizProfile(pg)
  const client = pgliteRpcClient(pg)
  const before = await readClock(pg, OWNER)
  const revisionBefore = (await readRow(pg, OWNER))!.facts_revision as number
  await edit(client, ANSWERS)
  const after = await readClock(pg, OWNER)
  assert.equal(after.revision - before.revision, BigInt(1))
  assert.equal(after.profile - before.profile, BigInt(1))
  const row = (await readRow(pg, OWNER))!
  assert.equal(row.facts_revision, revisionBefore + 1)
  assert.equal(parseUserFactsRow(OWNER, row).provenance.diagnostics?.fields?.texture, "user")
})

test("old vs new revision deltas are identical for the same edit (+1/+1)", async (t) => {
  const answers = { ...ANSWERS, thickness: "coarse" }
  const deltas: Array<[bigint, bigint]> = []
  for (const cleanSwitch of [false, true]) {
    const pg = await mobileFactsDatabase(t, { cleanSwitch })
    await seedQuizProfile(pg)
    const real = pgliteRpcClient(pg)
    // The pre-switch function takes the old column patch instead of facts.
    const client = cleanSwitch
      ? real
      : {
          calls: real.calls,
          rpc(name: string, args: Record<string, unknown>) {
            if (name !== "scanner_profile_edit_publish") return real.rpc(name, args)
            // eslint-disable-next-line @typescript-eslint/no-unused-vars -- dropped for the old signature
            const { p_facts, ...rest } = args
            return real.rpc(name, {
              ...rest,
              p_patch: legacyMobileEditProfilePatch(args.p_quiz_answers as QuizAnswers),
            })
          },
        }
    const before = await readClock(pg, OWNER)
    await edit(client, answers)
    const after = await readClock(pg, OWNER)
    deltas.push([after.revision - before.revision, after.profile - before.profile])
  }
  assert.deepEqual(deltas, [
    [BigInt(1), BigInt(1)],
    [BigInt(1), BigInt(1)],
  ])
})

test("a stale expected revision is a 409 conflict and writes nothing", async (t) => {
  const pg = await mobileFactsDatabase(t)
  await seedQuizProfile(pg)
  const client = pgliteRpcClient(pg)
  const stale = await editable(client)
  await edit(client, { ...ANSWERS, thickness: "normal" })
  const clock = await readClock(pg, OWNER)
  const row = await readRow(pg, OWNER)
  await assert.rejects(edit(client, ANSWERS, { expectedProfileRevision: stale }), {
    code: "profile_conflict",
    status: 409,
  })
  assert.deepEqual(await readClock(pg, OWNER), clock)
  assert.deepEqual(await readRow(pg, OWNER), row)
})

test("a door-level revision conflict surfaces as profile_conflict with nothing written", async (t) => {
  const pg = await mobileFactsDatabase(t)
  await seedQuizProfile(pg)
  const client = pgliteRpcClient(pg)
  // Simulate a concurrent facts writer between the function's row read and its door call: a
  // wrapper door that always reports a conflict. (Unreachable under the row lock in practice.)
  await pg.exec(`
    ALTER FUNCTION public.user_facts_save_v1(uuid,text,jsonb,jsonb,integer,text,uuid,bigint,uuid)
      RENAME TO user_facts_save_v1_real;
    CREATE FUNCTION public.user_facts_save_v1(p_user_id uuid, p_domain text, p_patch jsonb,
      p_provenance jsonb, p_expected_revision integer DEFAULT NULL, p_mode text DEFAULT 'upsert',
      p_source_draft_id uuid DEFAULT NULL, p_expected_draft_revision bigint DEFAULT NULL,
      p_expected_initial_version_id uuid DEFAULT NULL) RETURNS jsonb LANGUAGE sql AS
      $$ SELECT jsonb_build_object('status','revision_conflict','revision',99) $$;`)
  const clock = await readClock(pg, OWNER)
  const row = await readRow(pg, OWNER)
  await assert.rejects(edit(client, { ...ANSWERS, thickness: "coarse" }), {
    code: "profile_conflict",
  })
  assert.deepEqual(await readClock(pg, OWNER), clock)
  assert.deepEqual(await readRow(pg, OWNER), row)
  assert.equal((await pg.query("select * from scanner_profile_edit_receipts")).rows.length, 0)
})

test("the edit is a hand edit: kept against an older quiz linked later, replaced by a newer one", async (t) => {
  const pg = await mobileFactsDatabase(t)
  await seedQuizProfile(pg)
  await edit(pgliteRpcClient(pg), { ...ANSWERS, thickness: "coarse" })
  const facts = parseUserFactsRow(OWNER, (await readRow(pg, OWNER))!)
  const editedAt = facts.provenance.diagnostics!.editedAt!
  assert.equal(quizSupersedesFacts(facts, QUIZ_TIME), false)
  assert.equal(
    quizSupersedesFacts(facts, new Date(Date.parse(editedAt) - 1000).toISOString()),
    false,
  )
  assert.equal(
    quizSupersedesFacts(facts, new Date(Date.parse(editedAt) + 1000).toISOString()),
    true,
  )
})

test("fix round 1 (G): after an iOS edit the web account link keeps it against an OLDER lead and yields to a NEWER one", async (t) => {
  const pg = await mobileFactsDatabase(t)
  await seedQuizProfile(pg)
  await edit(pgliteRpcClient(pg), { ...ANSWERS, thickness: "coarse" })
  const edited = (await readRow(pg, OWNER))!
  const editedAt = parseUserFactsRow(OWNER, edited).provenance.diagnostics!.editedAt!
  const admin = pgliteAdminClient(pg) as never
  const otherQuiz: QuizAnswers = { ...ANSWERS, thickness: "normal", goals: ["shine"] }

  const older = await writeAccountLinkFacts(admin, {
    userId: OWNER,
    quiz: {
      kind: "lead",
      leadId: id(3, 3),
      quizAnswers: otherQuiz,
      createdAt: new Date(Date.parse(editedAt) - 1000).toISOString(),
    },
  })
  assert.equal(older, "preserved")
  const kept = (await readRow(pg, OWNER))!
  assert.equal(kept.facts_revision, edited.facts_revision)
  assert.deepEqual(kept.diagnostics, edited.diagnostics)
  assert.equal(kept.thickness, "coarse")

  const newer = await writeAccountLinkFacts(admin, {
    userId: OWNER,
    quiz: {
      kind: "lead",
      leadId: id(4, 4),
      quizAnswers: otherQuiz,
      createdAt: new Date(Date.parse(editedAt) + 1000).toISOString(),
    },
  })
  assert.equal(newer, "replaced")
  const replaced = (await readRow(pg, OWNER))!
  const facts = parseUserFactsRow(OWNER, replaced)
  assert.equal(replaced.thickness, "normal")
  assert.deepEqual(facts.diagnostics?.goals, ["shine"])
  assert.equal(facts.diagnostics?.source.leadId, id(4, 4))
  assert.deepEqual(facts.provenance.diagnostics?.source, { kind: "legacy_lead", id: id(4, 4) })
  assert.equal(facts.provenance.diagnostics?.editedAt, undefined, "the edit is superseded")
  assert.deepEqual(derivedColumns(replaced), deriveDiagnosticsColumns(facts.diagnostics!))
})

test("fix round 1 (G) adversarial: a replay whose first attempt rolled back runs fresh, exactly once", async (t) => {
  const pg = await mobileFactsDatabase(t)
  await seedQuizProfile(pg)
  const client = pgliteRpcClient(pg)
  const expected = await editable(client)
  const clock = await readClock(pg, OWNER)
  const row = (await readRow(pg, OWNER))!
  // First attempt: the door fails mid-publication -> everything rolls back, no receipt.
  await pg.exec(`
    ALTER FUNCTION public.user_facts_save_v1(uuid,text,jsonb,jsonb,integer,text,uuid,bigint,uuid)
      RENAME TO user_facts_save_v1_real;
    CREATE FUNCTION public.user_facts_save_v1(p_user_id uuid, p_domain text, p_patch jsonb,
      p_provenance jsonb, p_expected_revision integer DEFAULT NULL, p_mode text DEFAULT 'upsert',
      p_source_draft_id uuid DEFAULT NULL, p_expected_draft_revision bigint DEFAULT NULL,
      p_expected_initial_version_id uuid DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql AS
      $$ BEGIN RAISE EXCEPTION 'transient'; END $$;`)
  const requestId = randomUUID()
  const answers = { ...ANSWERS, thickness: "coarse" }
  await assert.rejects(edit(client, answers, { requestId, expectedProfileRevision: expected }), {
    code: "temporarily_unavailable",
  })
  assert.deepEqual(await readClock(pg, OWNER), clock)
  assert.deepEqual(await readRow(pg, OWNER), row)
  assert.equal((await pg.query("select * from scanner_profile_edit_receipts")).rows.length, 0)
  await pg.exec(`
    DROP FUNCTION public.user_facts_save_v1(uuid,text,jsonb,jsonb,integer,text,uuid,bigint,uuid);
    ALTER FUNCTION public.user_facts_save_v1_real(uuid,text,jsonb,jsonb,integer,text,uuid,bigint,uuid)
      RENAME TO user_facts_save_v1;`)

  // The replay (same request id, same revision) is a fresh publish, applied once.
  const saved = await edit(client, answers, { requestId, expectedProfileRevision: expected })
  const after = await readClock(pg, OWNER)
  assert.equal(after.revision - clock.revision, BigInt(1))
  assert.equal(after.profile - clock.profile, BigInt(1))
  assert.equal((await readRow(pg, OWNER))!.facts_revision, (row.facts_revision as number) + 1)
  assert.deepEqual(
    await edit(client, answers, { requestId, expectedProfileRevision: expected }),
    saved,
  )
  assert.deepEqual(await readClock(pg, OWNER), after)
})

test("adversarial: an edit on a profile with NULL diagnostics creates a complete, readable document", async (t) => {
  const pg = await mobileFactsDatabase(t)
  await insertProfile(pg, OWNER)
  await insertLead(pg, ANSWERS)
  // A row written by a legacy direct writer (no facts), as before the backfill.
  await pg.query(
    `insert into public.hair_profiles(user_id,hair_texture,thickness,density,hair_length,cuticle_condition,
       protein_moisture_balance,scalp_type,scalp_condition,chemical_treatment,concerns,goals,towel_material)
     values($1,'wavy','fine','medium','long','rough','stretches_bounces','balanced',null,
       ARRAY['natural'],ARRAY['dryness'],ARRAY['moisture'],'mikrofaser')`,
    [OWNER],
  )
  const client = pgliteRpcClient(pg)
  const before = await readClock(pg, OWNER)
  await edit(client, { ...ANSWERS, hair_length: "short" })
  const after = await readClock(pg, OWNER)
  assert.equal(after.profile - before.profile, BigInt(1))
  const row = (await readRow(pg, OWNER))!
  const facts = parseUserFactsRow(OWNER, row)
  assert.equal(facts.diagnostics?.source.kind, "legacy_quiz")
  assert.equal(facts.diagnostics?.source.leadId, "profile")
  assert.equal(row.hair_length, "short")
  assert.equal(row.hair_texture, "wavy", "no column lost to a partial document")
  assert.equal(row.towel_material, "mikrofaser", "non-fact columns untouched")
  assert.deepEqual(derivedColumns(row), deriveDiagnosticsColumns(facts.diagnostics!))
  assert.ok(await loadSharedScannerContext(client as never, OWNER))
})

test("adversarial: an edit on a backfilled legacy_columns profile", async (t) => {
  const pg = await mobileFactsDatabase(t)
  await insertProfile(pg, OWNER)
  await insertLead(pg, ANSWERS)
  const lead = projectLegacyLeadToFacts({ leadId: LEAD, quizAnswers: ANSWERS }).diagnostics
  await saveUserFacts(pg, {
    userId: OWNER,
    domain: "diagnostics",
    patch: { ...lead, source: { kind: "legacy_columns", version: 1, raw: {} } },
    provenance: {
      source: { kind: "legacy_columns" },
      schemaVersion: 1,
      at: "2026-09-20T00:00:00.000Z",
      fields: { texture: "unknown_historical", thickness: "unknown_historical" },
    },
  })
  const client = pgliteRpcClient(pg)
  await edit(client, { ...ANSWERS, thickness: "normal" })
  const facts = parseUserFactsRow(OWNER, (await readRow(pg, OWNER))!)
  assert.equal(facts.diagnostics?.source.kind, "legacy_quiz")
  assert.deepEqual(facts.provenance.diagnostics?.fields, {
    texture: "unknown_historical",
    thickness: "user",
  })
  assert.equal(quizSupersedesFacts(facts, QUIZ_TIME), false)
})

test("a publish without facts is refused: there is no column-patch path left (fix round 1, A)", async (t) => {
  const pg = await mobileFactsDatabase(t)
  await seedQuizProfile(pg)
  const client = pgliteRpcClient(pg)
  const read = (await client.rpc("scanner_context_read_source", { p_user_id: OWNER })).data as {
    profileRevision: string
    sourceRevision: string
  }
  const clock = await readClock(pg, OWNER)
  const row = await readRow(pg, OWNER)
  const result = await client.rpc("scanner_profile_edit_publish", {
    p_user_id: OWNER,
    p_request_id: randomUUID(),
    p_request_hash: "a".repeat(64),
    p_expected_profile_revision: read.profileRevision,
    p_expected_source_revision: read.sourceRevision,
    p_patch: { thickness: "coarse" },
    p_quiz_answers: ANSWERS,
    p_source_hash: "b".repeat(64),
    p_engine_version: "engine",
    p_input_snapshot: { source: {}, userRefinementAnswers: {}, userRefinementQuestionIds: [] },
    p_output_snapshot: { computationVersion: "engine" },
    p_snapshot_source: "initial",
  })
  assert.ok(result.error, "no p_patch parameter, and p_facts is required")
  assert.deepEqual(await readClock(pg, OWNER), clock)
  assert.deepEqual(await readRow(pg, OWNER), row)
  const { rows } = await pg.query<{ args: string }>(
    "select pg_get_function_identity_arguments('public.scanner_profile_edit_publish'::regproc) args",
  )
  assert.doesNotMatch(rows[0]!.args, /p_patch/)
})

test("malformed or missing facts roll back, nothing written", async (t) => {
  const pg = await mobileFactsDatabase(t)
  await seedQuizProfile(pg)
  const client = pgliteRpcClient(pg)
  const read = (await client.rpc("scanner_context_read_source", { p_user_id: OWNER })).data as {
    profileRevision: string
    sourceRevision: string
  }
  const row = await readRow(pg, OWNER)
  const base = {
    p_user_id: OWNER,
    p_request_id: randomUUID(),
    p_request_hash: "a".repeat(64),
    p_expected_profile_revision: read.profileRevision,
    p_expected_source_revision: read.sourceRevision,
    p_quiz_answers: ANSWERS,
    p_source_hash: "b".repeat(64),
    p_engine_version: "engine",
    p_input_snapshot: { source: {}, userRefinementAnswers: {}, userRefinementQuestionIds: [] },
    p_output_snapshot: { computationVersion: "engine" },
    p_snapshot_source: "initial",
  }
  const facts = {
    diagnostics: {
      patch: { thickness: "coarse" },
      provenance: { source: { kind: "profile_editor" }, schemaVersion: 1, at: QUIZ_TIME },
    },
  }
  for (const args of [
    { ...base, p_facts: null },
    { ...base, p_facts: { care_habits: facts.diagnostics } },
    { ...base, p_facts: { ...facts, quiz_context: facts.diagnostics } },
    { ...base, p_facts: { diagnostics: { patch: {} } } },
    { ...base, p_facts: { diagnostics: { ...facts.diagnostics, extra: 1 } } },
    { ...base, p_facts: { diagnostics: { patch: {}, provenance: "x" } } },
  ]) {
    const result = await client.rpc("scanner_profile_edit_publish", args)
    assert.ok(result.error, JSON.stringify(args.p_facts))
  }
  assert.deepEqual(await readRow(pg, OWNER), row)
  // A door rejection (invalid provenance -> invalid_input) is raised, not dropped.
  const rejected = await client.rpc("scanner_profile_edit_publish", {
    ...base,
    p_facts: { diagnostics: { patch: { thickness: "coarse" }, provenance: [] } },
  })
  assert.match(
    String((rejected.error as Error)?.message),
    /invalid_profile_facts|profile_facts_rejected/,
  )
  assert.deepEqual(await readRow(pg, OWNER), row)
})

test("the helper and the new publisher are service-only", async (t) => {
  const pg = await mobileFactsDatabase(t)
  for (const role of ["anon", "authenticated", "service_role"]) {
    const { rows } = await pg.query<{ ok: boolean }>(
      "select has_function_privilege($1,'public.mobile_profile_facts_save_v1(uuid,jsonb,boolean)','EXECUTE') ok",
      [role],
    )
    assert.equal(rows[0]!.ok, false, role)
  }
  for (const [role, allowed] of [
    ["anon", false],
    ["authenticated", false],
    ["service_role", true],
  ] as const) {
    const { rows } = await pg.query<{ ok: boolean }>(
      "select has_function_privilege($1,'public.scanner_profile_edit_publish(uuid,uuid,text,bigint,bigint,jsonb,jsonb,text,text,jsonb,jsonb,text)','EXECUTE') ok",
      [role],
    )
    assert.equal(rows[0]!.ok, allowed, role)
  }
})

// ---------------------------------------------------------------------------
// Fix round 3, item 5: a paid buyer on the real door — publish and the next read agree, and the
// TS oracle of the door's row (`profileAfterDiagnosticsWrite`) is what the door leaves.
// ---------------------------------------------------------------------------

async function scannerRead(client: ReturnType<typeof pgliteRpcClient>): Promise<ScannerSourceRead> {
  return (await client.rpc("scanner_context_read_source", { p_user_id: OWNER }))
    .data as ScannerSourceRead
}

test("a paid buyer's iOS edit on the real door: context stable on re-read, the door leaves the oracle's row", async (t) => {
  const pg = await mobileFactsDatabase(t)
  await insertProfile(pg, OWNER)
  // Her paid initial need version from the complete v3 envelope (recurrence on dry_lengths).
  const envelope = structuredClone(COMPLETE_V3_PLAN_ENVELOPE)
  const computed = computeNeedPlan({
    rawEnvelope: envelope,
    artifactId: "initial",
    projection: "initial_quiz",
    computationVersion: PERSONAL_PLAN_STAGE1_COMPUTATION_VERSION,
    createdAt: "1970-01-01T00:00:00.000Z",
  })
  assert.equal(computed.status, "ready")
  const inputHash = hashPersonalPlanNeedVersionInput({
    schemaVersion: 1,
    computationVersion: PERSONAL_PLAN_STAGE1_COMPUTATION_VERSION,
    inputSnapshot: envelope as never,
  })
  const { rows: needRows } = await pg.query<{ result: { outcome: string } }>(
    `SELECT public.personal_plan_create_or_reuse_initial_need(
       $1::uuid, NULL, NULL, 1, $2, $3, $4::jsonb, $5::jsonb) AS result`,
    [
      OWNER,
      PERSONAL_PLAN_STAGE1_COMPUTATION_VERSION,
      inputHash,
      JSON.stringify(envelope),
      JSON.stringify((computed as { snapshot: unknown }).snapshot),
    ],
  )
  assert.equal(needRows[0]!.result.outcome, "completed")
  // Her facts from that envelope: an assumed hair length and a preserved candidate.
  const { diagnostics } = projectArtifactToFacts({
    envelope,
    artifactId: id(5, 5),
    leadId: id(6, 6),
    takenAt: QUIZ_TIME,
  })
  const saved0 = await saveUserFacts(pg, {
    userId: OWNER,
    domain: "diagnostics",
    patch: diagnostics,
    provenance: {
      source: { kind: "personal_plan_artifact", id: id(5, 5) },
      schemaVersion: 1,
      at: QUIZ_TIME,
      fields: { hairLength: "assumed" },
    },
  })
  assert.equal(saved0.status, "ok")
  // An older quiz linked later loses: recorded as a preserved candidate (create_only).
  const preserved = await saveUserFacts(pg, {
    userId: OWNER,
    domain: "diagnostics",
    patch: diagnostics,
    provenance: {
      source: { kind: "legacy_lead", id: id(8, 8) },
      schemaVersion: 1,
      at: QUIZ_TIME,
      preservedCandidates: [{ kind: "lead", id: id(8, 8), at: QUIZ_TIME }],
    },
    mode: "create_only",
  })
  assert.equal(preserved.status, "preserved")

  const client = pgliteRpcClient(pg)
  const read = await scannerRead(client)
  assert.ok(read.initial, "the paid need version is the current one")
  const rowBefore = read.profile!
  assert.equal(
    parseUserFactsRow(OWNER, rowBefore).provenance.diagnostics?.preservedCandidates?.length,
    1,
  )
  const before = await loadSharedScannerContext(client as never, OWNER)
  assert.equal(
    (before?.prepared.source.answers as Record<string, any>).concernRecurrence?.concernId,
    "dry_lengths",
  )

  // iOS: drop the concern carrying the recurrence, change the scalp type.
  const prefill = editableScannerQuizAnswers(read)
  delete prefill.primary_concern
  assert.deepEqual([...(prefill.concerns ?? [])].sort(), ["dry_lengths", "split_ends"])
  const saved = await edit(client, { ...prefill, concerns: ["split_ends"], scalp_type: "fettig" })

  const loaded = await loadSharedScannerContext(client as never, OWNER)
  assert.equal(loaded?.contextRevision, saved.contextRevision, "the next read republishes nothing")
  assert.equal(
    (loaded?.prepared.source.answers as Record<string, any>).concernRecurrence,
    undefined,
  )

  const publish = client.calls
    .filter((call) => call.name === "scanner_profile_edit_publish")
    .at(-1)!
  const write = (
    publish.args.p_facts as {
      diagnostics: Parameters<typeof profileAfterDiagnosticsWrite>[1]["diagnostics"]
    }
  ).diagnostics
  const expected = profileAfterDiagnosticsWrite(rowBefore, {
    diagnostics: write,
    columns: deriveDiagnosticsColumns(
      mergeDiagnosticsPatch(parseUserFactsRow(OWNER, rowBefore).diagnostics, write.patch),
    ),
  })
  const rowAfter = (await scannerRead(client)).profile!
  assert.deepEqual(rowAfter.diagnostics, expected.diagnostics)
  assert.deepEqual(
    (rowAfter.facts_provenance as Record<string, unknown>).diagnostics,
    (expected.facts_provenance as Record<string, unknown>).diagnostics,
  )
  assert.deepEqual(derivedColumns(rowAfter), derivedColumns(expected))
  // The facts kept what the edit did not name.
  const facts = parseUserFactsRow(OWNER, rowAfter)
  assert.equal(facts.provenance.diagnostics?.fields?.hairLength, "assumed")
  assert.equal(facts.provenance.diagnostics?.preservedCandidates?.length, 1)
  assert.equal(facts.diagnostics?.scalpOiliness, "oily")
  assert.equal(facts.diagnostics?.concernRecurrence, undefined)
})
