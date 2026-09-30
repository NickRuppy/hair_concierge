import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import test from "node:test"

import { saveMobileProfileEdit } from "../src/lib/mobile/profile-edit-service"
import {
  mobileEditProfilePatch,
  type ProfileEditRequest,
} from "../src/lib/mobile/profile-edit-contract"
import { publishProfileEdit } from "../src/lib/scan/profile-edit"
import { loadSharedScannerContext } from "../src/lib/scan/scanner-context-supabase"
import { quizSupersedesFacts } from "../src/lib/user-facts/account-link"
import { deriveDiagnosticsColumns } from "../src/lib/user-facts/derive-legacy-columns"
import { projectLegacyLeadToFacts } from "../src/lib/user-facts/project-legacy-lead"
import { parseUserFactsRow } from "../src/lib/user-facts/read"
import type { QuizAnswers } from "../src/lib/quiz/types"
import {
  DIAGNOSTICS_COLUMNS,
  mobileFactsDatabase,
  pgliteRpcClient,
  readClock,
  readRow,
} from "./mobile-profile-facts-pglite.fixtures"
import {
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
    const client = pgliteRpcClient(pg)
    const before = await readClock(pg, OWNER)
    if (cleanSwitch) await edit(client, answers)
    // Today's mobile call, verbatim: the column patch through the web-shaped publisher.
    else
      await publishProfileEdit(client as never, OWNER, {
        expectedProfileRevision: await editable(client),
        requestId: randomUUID(),
        patch: mobileEditProfilePatch(answers),
        quizAnswers: answers,
      })
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

test("the web path is unchanged: a column patch written directly, facts untouched, +1/+1", async (t) => {
  const pg = await mobileFactsDatabase(t)
  await seedQuizProfile(pg)
  const client = pgliteRpcClient(pg)
  const before = await readClock(pg, OWNER)
  const rowBefore = (await readRow(pg, OWNER))!
  const saved = await publishProfileEdit(client as never, OWNER, {
    expectedProfileRevision: await editable(client),
    requestId: randomUUID(),
    patch: { thickness: "coarse" },
  })
  assert.equal(saved.profile.thickness, "coarse")
  const after = await readClock(pg, OWNER)
  assert.equal(after.profile - before.profile, BigInt(1))
  assert.equal(after.revision - before.revision, BigInt(1))
  const row = (await readRow(pg, OWNER))!
  assert.equal(row.facts_revision, rowBefore.facts_revision)
  assert.deepEqual(row.diagnostics, rowBefore.diagnostics)
})

test("malformed facts or a column patch next to facts roll back, nothing written", async (t) => {
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
    { ...base, p_patch: { thickness: "coarse" }, p_facts: facts },
    { ...base, p_patch: {}, p_facts: { care_habits: facts.diagnostics } },
    { ...base, p_patch: {}, p_facts: { ...facts, quiz_context: facts.diagnostics } },
    { ...base, p_patch: {}, p_facts: { diagnostics: { patch: {} } } },
    { ...base, p_patch: {}, p_facts: { diagnostics: { ...facts.diagnostics, extra: 1 } } },
    { ...base, p_patch: {}, p_facts: { diagnostics: { patch: {}, provenance: "x" } } },
  ]) {
    const result = await client.rpc("scanner_profile_edit_publish", args)
    assert.ok(result.error, JSON.stringify(args.p_facts))
  }
  assert.deepEqual(await readRow(pg, OWNER), row)
  // A door rejection (invalid provenance -> invalid_input) is raised, not dropped.
  const rejected = await client.rpc("scanner_profile_edit_publish", {
    ...base,
    p_patch: {},
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
      "select has_function_privilege($1,'public.scanner_profile_edit_publish(uuid,uuid,text,bigint,bigint,jsonb,jsonb,text,text,jsonb,jsonb,text,jsonb)','EXECUTE') ok",
      [role],
    )
    assert.equal(rows[0]!.ok, allowed, role)
  }
})
