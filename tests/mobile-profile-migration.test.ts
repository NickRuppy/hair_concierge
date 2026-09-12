import assert from "node:assert/strict"
import test from "node:test"
import { readFile } from "node:fs/promises"
import { PGlite } from "@electric-sql/pglite"

const owner = "11111111-1111-4111-8111-111111111111"
const foreign = "22222222-2222-4222-8222-222222222222"
const migration = new URL(
  "../supabase/migrations/20260912103726_mobile_scanner_context.sql",
  import.meta.url,
)
async function fixture() {
  const db = new PGlite()
  // Source tables are a deliberately narrow shape fixture. Parent integration
  // applies the complete real migration chain and exercises real auth.
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create table profiles(id uuid primary key);
    create table hair_profiles(user_id uuid primary key references profiles on delete cascade, thickness text, updated_at timestamptz);
    create table leads(id uuid primary key, user_id uuid references profiles on delete cascade, quiz_kind text, quiz_answers jsonb);
    create table personal_plans(id uuid primary key, user_id uuid unique references profiles on delete cascade, revision bigint default 0, current_initial_need_version_id uuid, current_refined_need_version_id uuid);
    create table personal_plan_need_versions(id uuid primary key, user_id uuid references profiles on delete cascade, personal_plan_id uuid, kind text, input_snapshot jsonb, output_snapshot jsonb);
    create table personal_plan_refinement_drafts(id uuid primary key, user_id uuid references profiles on delete cascade, personal_plan_id uuid, answers jsonb);
    insert into profiles values ('${owner}'), ('${foreign}');`)
  await db.exec(await readFile(migration, "utf8"))
  return db
}
async function read(db: PGlite) {
  const result = await db.query<{ source: { sourceRevision: string; profileRevision: string } }>(
    "select scanner_context_read_source($1) source",
    [owner],
  )
  return result.rows[0].source
}
async function publish(db: PGlite, revision: string) {
  const result = await db.query<{ result: { outcome: string; contextRevision?: string } }>(
    "select scanner_context_publish($1,$2,$3,$4,$5,$6,$7) result",
    [
      owner,
      revision,
      "a".repeat(64),
      "engine-v1",
      { source: {} },
      { schemaVersion: 1, snapshotKind: "initial_need", computationVersion: "engine-v1" },
      "initial",
    ],
  )
  return result.rows[0].result
}
test("source revisions reject stale/ABA profile writes; context publication is idempotent and paid state unchanged", async () => {
  const db = await fixture()
  try {
    await db.exec(
      `insert into hair_profiles values ('${owner}','fine',now()); insert into personal_plans(id,user_id) values ('${foreign}','${owner}');`,
    )
    const before = await read(db)
    const paidBefore = await db.query("select * from personal_plans")
    const first = await publish(db, before.sourceRevision)
    assert.equal(first.outcome, "ready")
    assert.deepEqual(await publish(db, before.sourceRevision), first)
    await db.exec(
      `update hair_profiles set thickness='coarse' where user_id='${owner}'; update hair_profiles set thickness='fine' where user_id='${owner}';`,
    )
    assert.equal((await publish(db, before.sourceRevision)).outcome, "stale_source")
    const after = await read(db)
    assert.equal(BigInt(after.profileRevision), BigInt(before.profileRevision) + BigInt(2))
    assert.equal((await publish(db, after.sourceRevision)).outcome, "ready")
    assert.deepEqual(await db.query("select * from personal_plans"), paidBefore)
    await assert.rejects(
      db.exec("update scanner_context_versions set source_hash=repeat('b',64)"),
      /immutable/,
    )
    const beforeLead = await read(db)
    await db.exec(`insert into leads values ('${owner}','${owner}','legacy','{}');`)
    assert.equal((await publish(db, beforeLead.sourceRevision)).outcome, "stale_source")
    const beforePlan = await read(db)
    await db.exec(`update personal_plans set revision=revision+1 where user_id='${owner}'`)
    assert.equal((await publish(db, beforePlan.sourceRevision)).outcome, "stale_source")
    // Failed profile/source transaction must not leave a clock increment.
    const beforeRollback = await read(db)
    await db.exec(
      `begin; update hair_profiles set thickness='coarse' where user_id='${owner}'; rollback;`,
    )
    assert.deepEqual(await read(db), beforeRollback)
  } finally {
    await db.close()
  }
})
test("owner SELECT only; anon, authenticated and foreign writes cannot invoke privileged RPCs", async () => {
  const db = await fixture()
  try {
    await publish(db, (await read(db)).sourceRevision)
    await db.exec(`set role authenticated; set request.jwt.claim.sub='${owner}';`)
    assert.equal((await db.query("select * from scanner_context_versions")).rows.length, 1)
    await assert.rejects(
      db.query("select scanner_context_read_source($1)", [owner]),
      /permission denied/,
    )
    await assert.rejects(db.exec("delete from scanner_context_heads"), /permission denied/)
    await db.exec(`set request.jwt.claim.sub='${foreign}'`)
    assert.equal((await db.query("select * from scanner_context_versions")).rows.length, 0)
    await db.exec("set role anon")
    await assert.rejects(db.exec("select * from scanner_context_versions"), /permission denied/)
  } finally {
    await db.close()
  }
})
