import assert from "node:assert/strict"
import test from "node:test"

import {
  createProfileAnswersPost,
  saveProfileAnswers,
  type ProfileAnswersSaveDeps,
} from "../src/lib/hair-profile/edit-route"
import { profileAnswersSchema } from "../src/lib/hair-profile/profile-answers"
import { publishProfileEdit } from "../src/lib/scan/profile-edit"
import { prepareScannerContext } from "../src/lib/scan/scanner-context"
import {
  loadSharedScannerContext,
  readScannerProfileSource,
} from "../src/lib/scan/scanner-context-supabase"
import { writeAccountLinkFacts } from "../src/lib/user-facts/account-link"
import { deriveDiagnosticsColumns } from "../src/lib/user-facts/derive-legacy-columns"
import { projectLegacyLeadToFacts } from "../src/lib/user-facts/project-legacy-lead"
import { readProfileDiagnostics } from "../src/lib/user-facts/profile-diagnostics"
import { parseUserFactsRow } from "../src/lib/user-facts/read"
import { saveUserFacts as saveUserFactsRpc } from "../src/lib/user-facts/save"
import type { QuizAnswers } from "../src/lib/quiz/types"
import {
  DIAGNOSTICS_COLUMNS,
  mobileFactsDatabase,
  pgliteAdminClient,
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
 * Clean-switch task 5 on the REAL schema (PGlite): the web editors' save
 * (`POST /api/profile/answers` → `saveProfileAnswers`) writes facts only through
 * `user_facts_save_v1` — via `scanner_profile_edit_publish`'s facts path for a complete profile,
 * straight through the door otherwise — and the door derives every column.
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

async function seedQuizProfile(pg: PersonalPlanTestDb) {
  await insertProfile(pg, OWNER)
  await pg.query(
    "insert into public.leads(id,user_id,quiz_kind,quiz_answers,status,created_at) values($1,$2,'legacy',$3,'linked',$4)",
    [LEAD, OWNER, JSON.stringify(ANSWERS), QUIZ_TIME],
  )
  const { diagnostics } = projectLegacyLeadToFacts({
    leadId: LEAD,
    quizAnswers: ANSWERS,
    takenAt: QUIZ_TIME,
  })
  const result = await saveUserFacts(pg, {
    userId: OWNER,
    domain: "diagnostics",
    patch: diagnostics,
    provenance: { source: { kind: "legacy_lead", id: LEAD }, schemaVersion: 1, at: QUIZ_TIME },
  })
  assert.equal(result.status, "ok")
}

function deps(pg: PersonalPlanTestDb, client: ReturnType<typeof pgliteRpcClient>) {
  const value: ProfileAnswersSaveDeps = {
    createAdminClient: () => client as never,
    readScannerProfileSource,
    prepareScannerContext,
    publishProfileEdit,
    saveUserFacts: saveUserFactsRpc,
    loadProfileRow: async () => readRow(pg, OWNER),
    randomUUID: () => crypto.randomUUID(),
    now: () => new Date().toISOString(),
  }
  return value
}

function derived(row: Record<string, unknown>) {
  return Object.fromEntries(DIAGNOSTICS_COLUMNS.map((column) => [column, row[column]]))
}

test("a complete profile: the web edit is published through the facts path (+1/+1, one facts revision)", async (t) => {
  const pg = await mobileFactsDatabase(t)
  await seedQuizProfile(pg)
  const client = pgliteRpcClient(pg)
  const clockBefore = await readClock(pg, OWNER)
  const revisionBefore = (await readRow(pg, OWNER))!.facts_revision as number

  const result = await saveProfileAnswers(
    deps(pg, client),
    OWNER,
    profileAnswersSchema.parse({ goals: ["shine", "manageability_styling"] }),
  )
  assert.equal(result.kind, "published")

  const clockAfter = await readClock(pg, OWNER)
  assert.equal(clockAfter.revision - clockBefore.revision, BigInt(1))
  assert.equal(clockAfter.profile - clockBefore.profile, BigInt(1))
  const row = (await readRow(pg, OWNER))!
  assert.equal(row.facts_revision, revisionBefore + 1)
  const facts = parseUserFactsRow(OWNER, row)
  assert.deepEqual(facts.diagnostics?.goals, ["shine", "manageability_styling"])
  assert.equal(facts.diagnostics?.source.kind, "legacy_quiz", "the quiz source is kept")
  assert.deepEqual(facts.provenance.diagnostics?.source, { kind: "profile_editor" })
  assert.ok(facts.provenance.diagnostics?.editedAt)
  assert.deepEqual(facts.provenance.diagnostics?.fields, { goals: "user" })
  assert.deepEqual(derived(row), deriveDiagnosticsColumns(facts.diagnostics!))
  assert.deepEqual(row.goals, ["shine", "less_frizz"])

  const loaded = await loadSharedScannerContext(client as never, OWNER)
  assert.equal(loaded?.contextRevision, (result as { contextRevision: string }).contextRevision)
})

test("a web edit that changes nothing is not an edit: no editedAt, provenance unchanged", async (t) => {
  const pg = await mobileFactsDatabase(t)
  await seedQuizProfile(pg)
  const client = pgliteRpcClient(pg)
  const rowBefore = (await readRow(pg, OWNER))!
  const clockBefore = await readClock(pg, OWNER)
  const before = parseUserFactsRow(OWNER, rowBefore)

  const result = await saveProfileAnswers(
    deps(pg, client),
    OWNER,
    profileAnswersSchema.parse({ goals: ["moisture"] }),
  )
  assert.equal(result.kind, "saved")
  const rowAfter = (await readRow(pg, OWNER))!
  const after = parseUserFactsRow(OWNER, rowAfter)
  assert.deepEqual(after.diagnostics, before.diagnostics)
  assert.deepEqual(after.provenance, before.provenance)
  assert.equal(after.provenance.diagnostics?.editedAt, undefined)
  // Fix round 2 (1): nothing is written and nothing is published.
  assert.deepEqual(rowAfter, rowBefore)
  assert.deepEqual(await readClock(pg, OWNER), clockBefore)
})

test("fix round 2 (1) adversarial: an unchanged save on a row WITHOUT a facts document writes nothing", async (t) => {
  const pg = await mobileFactsDatabase(t)
  await insertProfile(pg, OWNER)
  await pg.query(
    `insert into public.hair_profiles(user_id, hair_texture, thickness, density, hair_length,
       cuticle_condition, protein_moisture_balance, scalp_type, scalp_condition,
       chemical_treatment, concerns, goals, desired_volume)
     values($1,'curly','coarse','high','medium','slightly_rough','snaps','oily',null,
       array['colored'],array['frizz'],array['less_volume','healthier_hair'],'less')`,
    [OWNER],
  )
  const client = pgliteRpcClient(pg)
  const rowBefore = (await readRow(pg, OWNER))!
  const clockBefore = await readClock(pg, OWNER)
  const converted = readProfileDiagnostics(rowBefore)!

  // What the Ziele editor would show preselected, saved as is.
  const result = await saveProfileAnswers(
    deps(pg, client),
    OWNER,
    profileAnswersSchema.parse({ goals: converted.goals, texture: converted.texture }),
  )
  assert.equal(result.kind, "saved")
  const rowAfter = (await readRow(pg, OWNER))!
  assert.deepEqual(rowAfter, rowBefore, "no column, no document, no provenance, no revision")
  assert.equal(rowAfter.diagnostics, null)
  assert.equal(rowAfter.facts_revision, rowBefore.facts_revision)
  assert.deepEqual(await readClock(pg, OWNER), clockBefore)
})

test("a user without a profile row: the door creates it with exactly what she entered", async (t) => {
  const pg = await mobileFactsDatabase(t)
  await insertProfile(pg, OWNER)
  const client = pgliteRpcClient(pg)

  const result = await saveProfileAnswers(
    deps(pg, client),
    OWNER,
    profileAnswersSchema.parse({ goals: ["moisture", "shine"] }),
  )
  assert.equal(result.kind, "saved")
  const row = (await readRow(pg, OWNER))!
  assert.equal(row.facts_revision, 1)
  assert.deepEqual(row.goals, ["moisture", "shine"])
  assert.equal(row.hair_texture, null)
  const facts = parseUserFactsRow(OWNER, row)
  assert.deepEqual(facts.diagnostics?.goals, ["moisture", "shine"])
  assert.equal(facts.diagnostics?.density, undefined, "no completeness default from an edit")
})

test("adversarial: a row with legacy columns but NULL diagnostics keeps every column the edit did not name", async (t) => {
  const pg = await mobileFactsDatabase(t)
  await insertProfile(pg, OWNER)
  await pg.query(
    `insert into public.hair_profiles(user_id, hair_texture, thickness, density, hair_length,
       cuticle_condition, protein_moisture_balance, scalp_type, scalp_condition,
       chemical_treatment, concerns, goals, desired_volume)
     values($1,'curly','coarse','high','medium','slightly_rough','snaps','oily',null,
       array['colored'],array['frizz'],array['less_volume','healthier_hair'],'less')`,
    [OWNER],
  )
  const client = pgliteRpcClient(pg)
  await saveProfileAnswers(deps(pg, client), OWNER, profileAnswersSchema.parse({ texture: "wavy" }))

  const row = (await readRow(pg, OWNER))!
  assert.equal(row.hair_texture, "wavy")
  assert.equal(row.thickness, "coarse")
  assert.equal(row.cuticle_condition, "slightly_rough")
  assert.deepEqual([...(row.goals as string[])].sort(), ["anti_breakage", "less_volume"])
  assert.equal(row.desired_volume, "less")
  assert.deepEqual(row.concerns, ["frizz"])
  const facts = parseUserFactsRow(OWNER, row)
  assert.equal(facts.diagnostics?.source.kind, "legacy_quiz")
  assert.deepEqual(facts.provenance.diagnostics?.fields, { texture: "user" })
  assert.deepEqual(derived(row), deriveDiagnosticsColumns(facts.diagnostics!))
})

test("stale revision: a concurrent facts write between read and save is a profile_conflict", async (t) => {
  const pg = await mobileFactsDatabase(t)
  await insertProfile(pg, OWNER)
  const client = pgliteRpcClient(pg)
  const base = deps(pg, client)
  await assert.rejects(
    saveProfileAnswers(
      {
        ...base,
        // Another writer lands right after this save read the row.
        readScannerProfileSource: async (admin, userId) => {
          const read = await readScannerProfileSource(admin, userId)
          await saveUserFacts(pg, {
            userId: OWNER,
            domain: "diagnostics",
            patch: {
              goals: ["shine"],
              source: { kind: "legacy_quiz", version: 1, leadId: "x", raw: null },
            },
            provenance: { source: { kind: "profile_editor" }, schemaVersion: 1, at: QUIZ_TIME },
          })
          return read
        },
      },
      OWNER,
      profileAnswersSchema.parse({ goals: ["moisture"] }),
    ),
    { code: "profile_conflict" },
  )
  const facts = parseUserFactsRow(OWNER, (await readRow(pg, OWNER))!)
  assert.deepEqual(facts.diagnostics?.goals, ["shine"], "the other writer's save survives")
})

// ---------------------------------------------------------------------------
// Fix round 2 (7)
// ---------------------------------------------------------------------------

test("fix round 2 (7): after a WEB edit the account link keeps it against an OLDER quiz and yields to a NEWER one", async (t) => {
  const pg = await mobileFactsDatabase(t)
  await seedQuizProfile(pg)
  const result = await saveProfileAnswers(
    deps(pg, pgliteRpcClient(pg)),
    OWNER,
    profileAnswersSchema.parse({ thickness: "coarse" }),
  )
  assert.equal(result.kind, "published")
  const edited = (await readRow(pg, OWNER))!
  const editedAt = parseUserFactsRow(OWNER, edited).provenance.diagnostics!.editedAt!
  assert.ok(editedAt)
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
  assert.deepEqual(derived(replaced), deriveDiagnosticsColumns(facts.diagnostics!))
})

/** A facts write by another writer (the account link, another tab). */
async function concurrentWrite(pg: PersonalPlanTestDb) {
  const row = (await readRow(pg, OWNER))!
  const saved = await saveUserFacts(pg, {
    userId: OWNER,
    domain: "diagnostics",
    patch: { goals: ["shine"] },
    provenance: { source: { kind: "profile_editor" }, schemaVersion: 1, at: QUIZ_TIME },
    expectedRevision: row.facts_revision as number,
  })
  assert.equal(saved.status, "ok")
}

function webRoute(value: ProfileAnswersSaveDeps) {
  return createProfileAnswersPost({
    getUserId: async () => OWNER,
    save: (userId, answers) => saveProfileAnswers(value, userId, answers),
  })
}

const post = (body: unknown) =>
  new Request("http://localhost/api/profile/answers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

test("fix round 2 (7) adversarial: publish lane, a write between the route's read and the publisher's read is a 409", async (t) => {
  const pg = await mobileFactsDatabase(t)
  await seedQuizProfile(pg)
  const client = pgliteRpcClient(pg)
  const base = deps(pg, client)
  const response = await webRoute({
    ...base,
    readScannerProfileSource: async (admin, userId) => {
      const read = await readScannerProfileSource(admin, userId)
      await concurrentWrite(pg)
      return read
    },
  })(post({ thickness: "coarse" }))
  assert.equal(response.status, 409)
  assert.deepEqual(await response.json(), { error: "profile_conflict" })
  const row = (await readRow(pg, OWNER))!
  assert.equal(row.thickness, "fine", "the web edit is not written")
  assert.deepEqual(
    parseUserFactsRow(OWNER, row).diagnostics?.goals,
    ["shine"],
    "the other write survives",
  )
})

test("fix round 2 (7) adversarial: publish lane, a write right before the SQL publication is a 409 (the function's CAS)", async (t) => {
  const pg = await mobileFactsDatabase(t)
  await seedQuizProfile(pg)
  const client = pgliteRpcClient(pg)
  const racing = {
    ...client,
    async rpc(name: string, args: Record<string, unknown>) {
      if (name === "scanner_profile_edit_publish") await concurrentWrite(pg)
      return client.rpc(name, args)
    },
  }
  const clock = await readClock(pg, OWNER)
  const response = await webRoute(deps(pg, racing as typeof client))(post({ thickness: "coarse" }))
  assert.equal(response.status, 409)
  assert.deepEqual(await response.json(), { error: "profile_conflict" })
  const row = (await readRow(pg, OWNER))!
  assert.equal(row.thickness, "fine", "the web edit is not written")
  assert.deepEqual(
    parseUserFactsRow(OWNER, row).diagnostics?.goals,
    ["shine"],
    "the other write survives",
  )
  assert.notDeepEqual(await readClock(pg, OWNER), clock, "only the other writer moved the clock")
  assert.ok(
    client.calls.some((call) => call.name === "scanner_profile_edit_publish"),
    "the conflict came from the SQL publication",
  )
  assert.equal(
    (await pg.query("select * from scanner_profile_edit_receipts")).rows.length,
    0,
    "no publication receipt",
  )
})
