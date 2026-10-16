import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { PGlite } from "@electric-sql/pglite"

import { loadAdminAlertTestDatabaseSql } from "../scripts/product-intake/admin-alert-test-database"

const MIGRATION = new URL(
  "../supabase/migrations/20261016104506_product_intake_review_evidence.sql",
  import.meta.url,
)
const USER = "11111111-1111-4111-8111-111111111111"
const SHA = createHash("sha256").update("actual fixture image bytes").digest("hex")
type Job = {
  id: string
  submission_id: string
  locked_by: string
  locked_at: Date
  review_cycle_id: string
  progress: Record<string, unknown>
}
type Submission = {
  id: string
  researched_payload: unknown
  payload_revision: number
  payload_sha256: string
}

async function database(t: { after: (fn: () => Promise<void>) => void }, migrate = true) {
  const pg = new PGlite()
  t.after(() => pg.close())
  await pg.exec(await loadAdminAlertTestDatabaseSql())
  if (migrate) await applyMigration(pg)
  return pg
}
async function applyMigration(pg: PGlite) {
  await pg.exec(`RESET ROLE; ${await readFile(MIGRATION, "utf8")} SET ROLE service_role;`)
}
async function insertSubmission(pg: PGlite, payload: unknown = {}): Promise<string> {
  const result = await pg.query<{ id: string }>(
    `INSERT INTO public.product_submissions(user_id,source,intake_method,category,frequency_range,researched_payload)
     VALUES($1,'chat','manual','conditioner','weekly_1x',$2) RETURNING id`,
    [USER, payload],
  )
  return result.rows[0]!.id
}
async function submission(pg: PGlite, id: string) {
  return (await pg.query<Submission>("SELECT * FROM public.product_submissions WHERE id=$1", [id]))
    .rows[0]!
}
async function runningJob(pg: PGlite) {
  await insertSubmission(pg)
  return (
    await pg.query<Job>(
      "SELECT * FROM public.product_intake_claim_research_jobs('evidence-worker',1)",
    )
  ).rows[0]!
}
function asset(job: Job, revision = 2, kind = "final") {
  return {
    kind,
    sha256: SHA,
    storage_key: `${job.submission_id}/${revision}/${SHA}`,
    media_type: "image/png",
    byte_length: 26,
  }
}
function notification(job: Job) {
  return {
    product_name: "Test",
    category_label: "Conditioner",
    outcome_label: "Bereit zur Prüfung",
    question_1: "",
    question_2: "",
    question_3: "",
    review_url: `https://chaarlie.de/admin/produkt-intake/${job.submission_id}`,
    is_test: false,
  }
}
async function complete(
  pg: PGlite,
  job: Job,
  options: {
    assets?: unknown[]
    expected?: number | null
    payload?: unknown
    legacy?: boolean
  } = {},
) {
  const params: unknown[] = [
    job.id,
    job.locked_by,
    job.locked_at,
    "waiting_for_review",
    "preview_build",
    {},
    null,
    options.payload === undefined ? { identity: "test" } : options.payload,
    [],
    "ready_for_review",
    notification(job),
    job.review_cycle_id,
    [{ kind: "model_judgment", payload: { defects: [] } }],
    false,
  ]
  if (!options.legacy)
    params.push(options.expected === undefined ? 1 : options.expected, options.assets ?? [])
  return (
    await pg.query<Job>(
      `SELECT * FROM public.product_intake_commit_research_pass(${params.map((_, i) => `$${i + 1}`).join(",")})`,
      params,
    )
  ).rows[0]!
}
async function counts(pg: PGlite) {
  return (
    await pg.query(`SELECT (SELECT count(*)::int FROM public.product_intake_review_assets) assets,
    (SELECT count(*)::int FROM public.product_intake_research_artifacts) artifacts,
    (SELECT count(*)::int FROM public.product_intake_admin_notifications) notifications`)
  ).rows[0]
}

test("payload revision covers legacy writes, preserves status-only tokens and rejects forgery", async (t) => {
  const pg = await database(t)
  const id = await insertSubmission(pg, { a: 1 })
  const initial = await submission(pg, id)
  assert.equal(initial.payload_revision, 1)
  assert.equal(initial.payload_sha256, createHash("sha256").update('{"a": 1}').digest("hex"))
  await pg.query("UPDATE public.product_submissions SET status='researching' WHERE id=$1", [id])
  assert.equal((await submission(pg, id)).payload_revision, 1)
  await pg.query(
    "UPDATE public.product_submissions SET researched_payload=researched_payload WHERE id=$1",
    [id],
  )
  const rewritten = await submission(pg, id)
  assert.equal(rewritten.payload_revision, 2)
  assert.equal(rewritten.payload_sha256, initial.payload_sha256)
  for (const assignment of [
    "payload_revision=99",
    "payload_sha256=repeat('a',64)",
    "researched_payload='{}',payload_revision=99",
  ]) {
    await assert.rejects(
      pg.query(`UPDATE public.product_submissions SET ${assignment} WHERE id=$1`, [id]),
      /server-controlled/,
    )
  }
  assert.equal((await submission(pg, id)).payload_revision, 2)
  const stamped = await pg.query<Submission>(
    `INSERT INTO public.product_submissions(user_id,source,intake_method,category,frequency_range,payload_revision,payload_sha256)
    VALUES($1,'chat','manual','conditioner','weekly_1x',99,'forged') RETURNING *`,
    [USER],
  )
  assert.equal(stamped.rows[0]!.payload_revision, 1)
  assert.equal(stamped.rows[0]!.payload_sha256, createHash("sha256").update("{}").digest("hex"))
})

test("migration backfills every legacy payload while keeping historical approvals unbound", async (t) => {
  const pg = await database(t, false)
  // The current baseline is NOT NULL; exercise the documented legacy SQL-null
  // hash representation in a fixture with that constraint relaxed before upgrade.
  await pg.exec(
    "RESET ROLE; ALTER TABLE public.product_submissions ALTER COLUMN researched_payload DROP NOT NULL; SET ROLE service_role;",
  )
  const objectId = await insertSubmission(pg, { a: 1 })
  const sqlNullId = await insertSubmission(pg, null)
  const jsonNullId = await insertSubmission(pg)
  await pg.query(
    "UPDATE public.product_submissions SET researched_payload='null'::jsonb WHERE id=$1",
    [jsonNullId],
  )
  await pg.query(
    "INSERT INTO public.product_intake_review_decisions(submission_id,field_path,decision,reviewed_by) VALUES($1,'final.product','approved','test')",
    [objectId],
  )
  await applyMigration(pg)
  for (const [id, canonical] of [
    [objectId, '{"a": 1}'],
    [sqlNullId, "null"],
    [jsonNullId, "null"],
  ]) {
    const row = await submission(pg, id!)
    assert.equal(row.payload_revision, 1)
    assert.equal(row.payload_sha256, createHash("sha256").update(canonical!).digest("hex"))
  }
  const decisions = await pg.query(
    "SELECT payload_revision,payload_sha256,approved_asset_sha256 FROM public.product_intake_review_decisions",
  )
  assert.deepEqual(decisions.rows, [
    { payload_revision: null, payload_sha256: null, approved_asset_sha256: null },
  ])
})

test("fenced research commit records exact revision assets atomically and replay is idempotent", async (t) => {
  const pg = await database(t)
  const job = await runningJob(pg)
  const manifest = [asset(job), asset(job, 2, "raw")]
  const committed = await complete(pg, job, { assets: manifest })
  const saved = await submission(pg, job.submission_id)
  assert.equal(saved.payload_revision, 2)
  assert.equal(committed.progress.payload_revision, 2)
  assert.equal(committed.progress.payload_sha256, saved.payload_sha256)
  const rows = await pg.query(
    "SELECT submission_id,payload_revision,job_id,kind,sha256,storage_key FROM public.product_intake_review_assets ORDER BY kind",
  )
  assert.deepEqual(
    rows.rows,
    manifest.map(({ kind, sha256, storage_key }) => ({
      submission_id: job.submission_id,
      payload_revision: 2,
      job_id: job.id,
      kind,
      sha256,
      storage_key,
    })),
  )
  assert.deepEqual(await counts(pg), { assets: 2, artifacts: 1, notifications: 1 })
  const replay = await complete(pg, job, { assets: manifest })
  assert.deepEqual(replay.progress, committed.progress)
  assert.equal((await submission(pg, job.submission_id)).payload_revision, 2)
  assert.deepEqual(await counts(pg), { assets: 2, artifacts: 1, notifications: 1 })
  await assert.rejects(
    complete(pg, job, { assets: [{ ...manifest[0], byte_length: 99 }, manifest[1]] }),
    /replay/,
  )
  await assert.rejects(complete(pg, job, { assets: manifest, expected: 2 }), /replay/)
})

test("image-only pass retains payload but advances revision and never rebinds old assets", async (t) => {
  const pg = await database(t)
  const job = await runningJob(pg)
  await complete(pg, job, { assets: [asset(job)] })
  await pg.query("SELECT * FROM public.product_intake_request_rework_job($1)", [job.submission_id])
  const next = (
    await pg.query<Job>("SELECT * FROM public.product_intake_claim_research_jobs('image-worker',1)")
  ).rows[0]!
  const committed = await complete(pg, next, {
    expected: 2,
    payload: null,
    assets: [asset(next, 3, "neutral")],
  })
  assert.equal(committed.progress.payload_revision, 3)
  const saved = await submission(pg, job.submission_id)
  assert.deepEqual(saved.researched_payload, { identity: "test" })
  assert.equal(saved.payload_revision, 3)
  const rows = await pg.query(
    "SELECT payload_revision,kind FROM public.product_intake_review_assets ORDER BY payload_revision",
  )
  assert.deepEqual(rows.rows, [
    { payload_revision: 2, kind: "final" },
    { payload_revision: 3, kind: "neutral" },
  ])
})

test("stale expected revision rolls back payload, manifest, artifacts, job and outbox", async (t) => {
  const pg = await database(t)
  const job = await runningJob(pg)
  await pg.query("UPDATE public.product_submissions SET researched_payload='{}' WHERE id=$1", [
    job.submission_id,
  ])
  const before = await submission(pg, job.submission_id)
  await assert.rejects(
    complete(pg, job, { assets: [asset(job)] }),
    /payload revision no longer matches/,
  )
  assert.deepEqual(await submission(pg, job.submission_id), before)
  assert.deepEqual(await counts(pg), { assets: 0, artifacts: 0, notifications: 0 })
  assert.equal(
    (
      await pg.query<{ status: string }>(
        "SELECT status FROM public.product_intake_research_jobs WHERE id=$1",
        [job.id],
      )
    ).rows[0]!.status,
    "running",
  )
})

test("manifest rejects foreign paths, malformed metadata, duplicate kinds and absent expected revision", async (t) => {
  const pg = await database(t)
  const job = await runningJob(pg)
  const good = asset(job)
  const invalid = [
    { ...good, storage_key: `${USER}/2/${SHA}` },
    { ...good, storage_key: `${job.submission_id}/1/${SHA}` },
    { ...good, storage_key: `${job.submission_id}/2/../${SHA}` },
    { ...good, kind: "public_image" },
    { ...good, sha256: SHA.toUpperCase() },
    { ...good, byte_length: 0 },
    { ...good, byte_length: 1.5 },
    { ...good, byte_length: "26" },
    { ...good, media_type: "text/html" },
    { ...good, job_id: job.id },
    { ...good, sha256: null },
  ]
  for (const bad of invalid) {
    await assert.rejects(complete(pg, job, { assets: [bad] }), /review asset/)
    assert.equal((await submission(pg, job.submission_id)).payload_revision, 1)
    assert.deepEqual(await counts(pg), { assets: 0, artifacts: 0, notifications: 0 })
  }
  await assert.rejects(complete(pg, job, { assets: [good, good] }), /review asset/)
  await assert.rejects(
    complete(pg, job, { assets: [good], expected: null }),
    /expected payload revision/,
  )
})

test("legacy 14-argument completion remains compatible without producing asset bindings", async (t) => {
  const pg = await database(t)
  const job = await runningJob(pg)
  const first = await complete(pg, job, { legacy: true })
  assert.equal(first.progress.payload_revision, 2)
  await complete(pg, job, { legacy: true })
  // PostgREST callers address arguments by name; trailing defaults must preserve
  // those calls as well as the positional SQL identity above.
  await pg.query(
    `SELECT * FROM public.product_intake_commit_research_pass(
    target_job_id=>$1,expected_locked_by=>$2,expected_locked_at=>$3,
    next_status=>'waiting_for_review',next_stage=>'preview_build',next_progress=>'{}',next_last_error=>NULL,
    researched_payload=>'{"identity":"test"}',resolve_decision_ids=>'{}',review_outcome=>'ready_for_review',
    notification_payload=>$4,expected_review_cycle_id=>$5,
    research_artifacts=>'[{"kind":"model_judgment","payload":{"defects":[]}}]',request_auto_rework=>false)`,
    [job.id, job.locked_by, job.locked_at, notification(job), job.review_cycle_id],
  )
  assert.equal((await submission(pg, job.submission_id)).payload_revision, 2)
  assert.deepEqual(await counts(pg), { assets: 0, artifacts: 1, notifications: 1 })
  const identities = await pg.query(
    "SELECT pronargs FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='product_intake_commit_research_pass'",
  )
  assert.deepEqual(identities.rows, [{ pronargs: 16 }])
})

test("private evidence is service-only, immutable and survives removal of its historical job", async (t) => {
  const pg = await database(t)
  const job = await runningJob(pg)
  await complete(pg, job, { assets: [asset(job)] })
  const privileges =
    await pg.query(`SELECT role,has_table_privilege(role,'public.product_intake_review_assets','SELECT') can_read,
    has_table_privilege(role,'public.product_intake_review_assets','INSERT') can_insert,
    has_table_privilege(role,'public.product_intake_review_assets','UPDATE') can_update,
    has_table_privilege(role,'public.product_intake_review_assets','DELETE') can_delete
    FROM unnest(ARRAY['anon','authenticated','service_role']) role`)
  assert.deepEqual(privileges.rows, [
    { role: "anon", can_read: false, can_insert: false, can_update: false, can_delete: false },
    {
      role: "authenticated",
      can_read: false,
      can_insert: false,
      can_update: false,
      can_delete: false,
    },
    {
      role: "service_role",
      can_read: true,
      can_insert: true,
      can_update: false,
      can_delete: false,
    },
  ])
  await assert.rejects(
    pg.exec("UPDATE public.product_intake_review_assets SET byte_length=3"),
    /permission denied/,
  )
  await assert.rejects(
    pg.exec("DELETE FROM public.product_intake_review_assets"),
    /permission denied/,
  )
  // Even a privileged maintenance writer cannot mutate the bytes receipt.
  await pg.exec("RESET ROLE")
  await assert.rejects(
    pg.exec("UPDATE public.product_intake_review_assets SET byte_length=3"),
    /immutable/,
  )
  const bucket = await pg.query(
    "SELECT public FROM storage.buckets WHERE id='product-intake-review'",
  )
  assert.deepEqual(bucket.rows, [{ public: false }])
  await pg.query("DELETE FROM public.product_intake_research_jobs WHERE id=$1", [job.id])
  const historical = await pg.query(
    "SELECT job_id,sha256,payload_revision FROM public.product_intake_review_assets",
  )
  assert.deepEqual(historical.rows, [{ job_id: null, sha256: SHA, payload_revision: 2 }])
})

test("direct manifest inserts cannot bind a foreign job, stale revision or arbitrary storage key", async (t) => {
  const pg = await database(t)
  const job = await runningJob(pg)
  const foreign = await insertSubmission(pg)
  const insert = (submissionId: string, revision: number, jobId: string | null, key: string) =>
    pg.query(
      `INSERT INTO public.product_intake_review_assets(submission_id,payload_revision,job_id,kind,sha256,storage_key,media_type,byte_length)
     VALUES($1,$2,$3,'final',$4,$5,'image/png',26)`,
      [submissionId, revision, jobId, SHA, key],
    )
  await assert.rejects(insert(foreign, 1, job.id, `${foreign}/1/${SHA}`), /owning running job/)
  await assert.rejects(
    insert(job.submission_id, 2, job.id, `${job.submission_id}/2/${SHA}`),
    /current submission revision/,
  )
  await assert.rejects(
    insert(job.submission_id, 1, null, `${job.submission_id}/1/${SHA}`),
    /owning running job/,
  )
  await assert.rejects(
    insert(job.submission_id, 1, job.id, `https://example.com/${SHA}`),
    /check constraint/,
  )
  assert.deepEqual(await counts(pg), { assets: 0, artifacts: 0, notifications: 0 })
})

test("private bucket stays inaccessible even if another policy broadly permits authenticated storage", async (t) => {
  const pg = await database(t)
  await pg.exec(`RESET ROLE;
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    GRANT USAGE ON SCHEMA storage TO anon,authenticated;
    GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO anon,authenticated;
    CREATE POLICY unrelated_broad_storage_policy ON storage.objects FOR ALL TO anon,authenticated USING(true) WITH CHECK(true);
    INSERT INTO storage.objects(id,bucket_id) VALUES(gen_random_uuid(),'product-intake-review'),(gen_random_uuid(),'other-bucket');`)
  for (const role of ["anon", "authenticated"]) {
    await pg.exec(`SET ROLE ${role}`)
    assert.deepEqual((await pg.query("SELECT bucket_id FROM storage.objects")).rows, [
      { bucket_id: "other-bucket" },
    ])
    await assert.rejects(
      pg.exec(
        "INSERT INTO storage.objects(id,bucket_id) VALUES(gen_random_uuid(),'product-intake-review')",
      ),
      /row-level security/,
    )
    await pg.exec("RESET ROLE")
    const functions = await pg.query<{ allowed: boolean }>(
      `SELECT has_function_privilege($1,oid,'EXECUTE') allowed FROM pg_proc
      WHERE pronamespace='public'::regnamespace AND proname IN ('product_intake_guard_payload_revision','product_intake_advance_payload_revision','product_intake_guard_review_asset','product_intake_commit_research_pass')`,
      [role],
    )
    assert.equal(functions.rows.length, 4)
    assert.ok(functions.rows.every((row) => !row.allowed))
  }
})
