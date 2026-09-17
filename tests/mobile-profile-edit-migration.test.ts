import assert from "node:assert/strict"
import test from "node:test"
import { readFile } from "node:fs/promises"
import { PGlite } from "@electric-sql/pglite"

const owner = "11111111-1111-4111-8111-111111111111"
const foreign = "22222222-2222-4222-8222-222222222222"
const migration = new URL(
  "../supabase/migrations/20260916175235_hosted_mobile_scanner_context.sql",
  import.meta.url,
)
async function fixture() {
  const db = new PGlite()
  // Source tables are a deliberately narrow shape fixture. Parent integration
  // applies the complete real migration chain and exercises real auth.
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create table profiles(id uuid primary key);
    create table hair_profiles(user_id uuid primary key references profiles on delete cascade, thickness text, styling_methods text[], updated_at timestamptz);
    create table leads(id uuid primary key, user_id uuid references profiles on delete cascade, quiz_kind text, quiz_answers jsonb);
    create table personal_plans(id uuid primary key, user_id uuid unique references profiles on delete cascade, revision bigint default 0, current_initial_need_version_id uuid, current_refined_need_version_id uuid);
    create table personal_plan_need_versions(id uuid primary key, user_id uuid references profiles on delete cascade, personal_plan_id uuid, kind text, input_snapshot jsonb, output_snapshot jsonb);
    create table personal_plan_refinement_drafts(id uuid primary key, user_id uuid references profiles on delete cascade, personal_plan_id uuid, answers jsonb);
    insert into profiles values ('${owner}'), ('${foreign}');`)
  await db.exec(await readFile(migration, "utf8"))
  await db.exec(
    await readFile(
      new URL(
        "../supabase/migrations/20260916175239_hosted_mobile_profile_edit.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  )
  return db
}
async function read(db: PGlite) {
  const result = await db.query<{ source: { sourceRevision: string; profileRevision: string } }>(
    "select scanner_context_read_source($1) source",
    [owner],
  )
  return result.rows[0].source
}
const requestId = "33333333-3333-4333-8333-333333333333"
async function edit(
  db: PGlite,
  revisions: Awaited<ReturnType<typeof read>>,
  overrides: Record<string, unknown> = {},
) {
  const args = {
    user: owner,
    requestId,
    hash: "b".repeat(64),
    profileRevision: revisions.profileRevision,
    sourceRevision: revisions.sourceRevision,
    patch: { thickness: "coarse" },
    quiz: { thickness: "coarse" },
    sourceHash: "c".repeat(64),
    engine: "engine-v1",
    input: {
      source: { kind: "legacy_quiz" },
      userRefinementAnswers: {},
      userRefinementQuestionIds: [],
    },
    output: { computationVersion: "engine-v1" },
    kind: "initial",
    ...overrides,
  }
  return (
    await db.query<{ result: Record<string, any> }>(
      "select scanner_profile_edit_publish($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) result",
      Object.values(args),
    )
  ).rows[0].result
}
async function seed(db: PGlite) {
  await db.exec(
    `insert into hair_profiles values ('${owner}','fine',ARRAY['air_dry'],now());insert into personal_plans(id,user_id) values ('${foreign}','${owner}');`,
  )
}
test("atomic edit preserves nonquiz fields/paid state; receipt survives later writes, mismatched retries conflict", async () => {
  const db = await fixture()
  try {
    await seed(db)
    const before = await read(db),
      paid = await db.query("select * from personal_plans")
    const saved = await edit(db, before)
    assert.equal(saved.outcome, "ready")
    assert.equal(saved.profile.thickness, "coarse")
    assert.deepEqual(saved.profile.styling_methods, ["air_dry"])
    assert.equal(BigInt(saved.profileRevision), BigInt(before.profileRevision) + BigInt(1))
    assert.deepEqual(await edit(db, before), saved)
    assert.equal((await edit(db, before, { hash: "d".repeat(64) })).outcome, "profile_conflict")
    await db.exec(`update hair_profiles set thickness='fine' where user_id='${owner}'`)
    assert.deepEqual(await edit(db, before), saved)
    assert.deepEqual(await db.query("select * from personal_plans"), paid)
    const next = (
      await db.query<{ source: any }>("select scanner_context_read_source($1) source", [owner])
    ).rows[0].source
    assert.deepEqual(next.edit.quizAnswers, { thickness: "coarse" })
    assert.equal(next.edit.profileRevision, saved.profileRevision)
    assert.equal((await db.query("select * from scanner_profile_edit_receipts")).rows.length, 1)
  } finally {
    await db.close()
  }
})
test("stale/ABA profile and unrelated source changes reject edits before mutation; validation failure rolls back profile/context/clock", async () => {
  const db = await fixture()
  try {
    await seed(db)
    const before = await read(db)
    await db.exec(
      `update hair_profiles set thickness='coarse' where user_id='${owner}';update hair_profiles set thickness='fine' where user_id='${owner}'`,
    )
    assert.equal((await edit(db, before)).outcome, "profile_conflict")
    const next = await read(db)
    await db.exec(`update personal_plans set revision=revision+1 where user_id='${owner}'`)
    assert.equal((await edit(db, next)).outcome, "profile_conflict")
    const current = await read(db)
    await assert.rejects(
      edit(db, current, { output: { computationVersion: "bad" } }),
      /invalid_scanner_context/,
    )
    assert.deepEqual(await read(db), current)
    assert.equal(
      (await db.query<{ thickness: string }>("select thickness from hair_profiles")).rows[0]
        .thickness,
      "fine",
    )
    for (const table of [
      "scanner_profile_edits",
      "scanner_profile_edit_receipts",
      "scanner_context_versions",
      "scanner_context_heads",
    ])
      assert.equal((await db.query(`select * from ${table}`)).rows.length, 0)
    await assert.rejects(
      edit(db, current, { patch: { user_id: foreign } }),
      /invalid_profile_edit_patch/,
    )
  } finally {
    await db.close()
  }
})
test("new paid versions bind current profile revision and no-op edits advance it", async () => {
  const db = await fixture()
  try {
    await seed(db)
    const before = await read(db)
    const saved = await edit(db, before, { patch: { thickness: "fine" } })
    assert.equal(BigInt(saved.profileRevision), BigInt(before.profileRevision) + BigInt(1))
    await db.exec(
      `insert into personal_plan_need_versions(id,user_id,personal_plan_id,kind) values ('${owner}','${owner}','${foreign}','initial')`,
    )
    const source = (
      await db.query<{ source: any }>("select scanner_context_read_source($1) source", [owner])
    ).rows[0].source
    assert.equal(source.paidBindings[owner], saved.profileRevision)
  } finally {
    await db.close()
  }
})
test("edit RPCs and private provenance are service only; authenticated owner context reads retain RLS", async () => {
  const db = await fixture()
  try {
    await seed(db)
    const revisions = await read(db)
    await edit(db, revisions)
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`set role ${role};set request.jwt.claim.sub='${owner}'`)
      await assert.rejects(edit(db, revisions), /permission denied/)
      await assert.rejects(
        db.query("select scanner_profile_edit_receipt($1,$2,$3)", [
          owner,
          requestId,
          "b".repeat(64),
        ]),
        /permission denied/,
      )
      for (const table of [
        "scanner_profile_edits",
        "scanner_profile_edit_receipts",
        "scanner_paid_source_bindings",
      ])
        await assert.rejects(db.query(`select * from ${table}`), /permission denied/)
      await db.exec("reset role")
    }
    await db.exec(`set role authenticated;set request.jwt.claim.sub='${owner}'`)
    assert.equal((await db.query("select * from scanner_context_versions")).rows.length, 1)
    await db.exec(`set request.jwt.claim.sub='${foreign}'`)
    assert.equal((await db.query("select * from scanner_context_versions")).rows.length, 0)
  } finally {
    await db.close()
  }
})
