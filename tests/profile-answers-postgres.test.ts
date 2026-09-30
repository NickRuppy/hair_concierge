import assert from "node:assert/strict"
import test from "node:test"

import { saveProfileAnswers, type ProfileAnswersSaveDeps } from "../src/lib/hair-profile/edit-route"
import { profileAnswersSchema } from "../src/lib/hair-profile/profile-answers"
import { publishProfileEdit } from "../src/lib/scan/profile-edit"
import { prepareScannerContext } from "../src/lib/scan/scanner-context"
import {
  loadSharedScannerContext,
  readScannerProfileSource,
} from "../src/lib/scan/scanner-context-supabase"
import { deriveDiagnosticsColumns } from "../src/lib/user-facts/derive-legacy-columns"
import { projectLegacyLeadToFacts } from "../src/lib/user-facts/project-legacy-lead"
import { parseUserFactsRow } from "../src/lib/user-facts/read"
import { saveUserFacts as saveUserFactsRpc } from "../src/lib/user-facts/save"
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
  const before = parseUserFactsRow(OWNER, (await readRow(pg, OWNER))!)

  await saveProfileAnswers(
    deps(pg, client),
    OWNER,
    profileAnswersSchema.parse({ goals: ["moisture"] }),
  )
  const after = parseUserFactsRow(OWNER, (await readRow(pg, OWNER))!)
  assert.deepEqual(after.diagnostics, before.diagnostics)
  assert.deepEqual(after.provenance, before.provenance)
  assert.equal(after.provenance.diagnostics?.editedAt, undefined)
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
