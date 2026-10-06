import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { PGlite } from "@electric-sql/pglite"

const ROOT = new URL("../", import.meta.url)
const MIGRATIONS = [
  "20260612130000_product_intake_submissions.sql",
  "20260630120000_product_intake_research_jobs.sql",
  "20260630130000_product_intake_research_artifacts_decisions.sql",
  "20260701090000_product_intake_rework_resets_attempts.sql",
  "20260701100000_product_intake_auto_enqueue.sql",
  "20261006112322_product_intake_job_attempt_hygiene.sql",
  "20261006112337_product_intake_worker_heartbeats.sql",
  "20261006141653_product_intake_job_engine_binding.sql",
] as const
const USER = "11111111-1111-4111-8111-111111111111"
const PRODUCT = "22222222-2222-4222-8222-222222222222"

// Only prerequisites are stubbed; submission constraints, queue functions and
// triggers come from the real migrations.
const PREREQUISITES = `
  CREATE ROLE anon;
  CREATE ROLE authenticated;
  CREATE ROLE service_role BYPASSRLS;
  CREATE SCHEMA auth;
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULL::uuid $$;
  CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT 'service_role'::text $$;
  CREATE SCHEMA storage;
  CREATE TABLE storage.buckets (
    id text PRIMARY KEY, name text, public boolean,
    file_size_limit bigint, allowed_mime_types text[]
  );
  CREATE TABLE storage.objects (id uuid PRIMARY KEY, bucket_id text);
  CREATE TABLE public.profiles (id uuid PRIMARY KEY, is_admin boolean DEFAULT false);
  CREATE TABLE public.product_categories (key text PRIMARY KEY, is_intake_supported boolean);
  CREATE TABLE public.products (id uuid PRIMARY KEY, category_key text);
  CREATE TABLE public.conversations (id uuid PRIMARY KEY, user_id uuid, UNIQUE (id, user_id));
  CREATE TABLE public.user_product_usage (
    id uuid PRIMARY KEY, user_id uuid, category text,
    frequency_range text, product_name text, UNIQUE (user_id, category)
  );
  CREATE FUNCTION public.update_updated_at_column() RETURNS trigger LANGUAGE plpgsql AS $$
  BEGIN NEW.updated_at = now(); RETURN NEW; END;
  $$;
  INSERT INTO public.profiles (id) VALUES ('${USER}');
  INSERT INTO public.product_categories VALUES ('conditioner', true);
  INSERT INTO public.products VALUES ('${PRODUCT}', 'conditioner');
`

type Job = {
  id: string
  submission_id: string
  status: string
  stage: string
  attempt_count: number
  locked_by: string | null
  locked_at: Date | null
  completed_at: Date | null
  last_error: string | null
  engine_key: string | null
  engine_version: string | null
  progress: Record<string, unknown>
}

async function migratedDatabase(t: { after: (fn: () => Promise<void>) => void }) {
  const pg = new PGlite()
  t.after(() => pg.close())
  await pg.exec(PREREQUISITES)
  for (const migration of MIGRATIONS) {
    await pg.exec(await readFile(new URL(`supabase/migrations/${migration}`, ROOT), "utf8"))
  }
  // Reapplying the replacement migration must remain safe.
  await pg.exec(await readFile(new URL(`supabase/migrations/${MIGRATIONS.at(-1)}`, ROOT), "utf8"))
  await pg.exec("SET ROLE service_role")
  return pg
}

async function queuedJob(pg: PGlite): Promise<Job> {
  const { rows } = await pg.query<{ id: string }>(
    `INSERT INTO public.product_submissions
       (user_id, source, intake_method, category, frequency_range)
     VALUES ($1, 'chat', 'manual', 'conditioner', 'weekly_1x') RETURNING id`,
    [USER],
  )
  // The real auto-enqueue trigger creates the job.
  const jobs = await pg.query<Job>(
    "SELECT * FROM public.product_intake_research_jobs WHERE submission_id = $1",
    [rows[0]!.id],
  )
  assert.equal(jobs.rows.length, 1)
  return jobs.rows[0]!
}

async function claim(pg: PGlite, worker = "worker-a", limit = 1) {
  const { rows } = await pg.query<Job>(
    "SELECT * FROM public.product_intake_claim_research_jobs($1, $2)",
    [worker, limit],
  )
  return rows
}

async function storedJob(pg: PGlite, id: string) {
  const { rows } = await pg.query<Job>(
    "SELECT * FROM public.product_intake_research_jobs WHERE id = $1",
    [id],
  )
  return rows[0]!
}

test("claim fails exhausted queued, rework and stale-running jobs instead of hiding them", async (t) => {
  const pg = await migratedDatabase(t)
  for (const status of ["queued", "waiting_for_rework", "running"]) {
    const job = await queuedJob(pg)
    await pg.query(
      `UPDATE public.product_intake_research_jobs
       SET status = $2, attempt_count = max_attempts,
           locked_by = 'old-worker', locked_at = now() - interval '1 hour'
       WHERE id = $1`,
      [job.id, status],
    )
    assert.deepEqual(await claim(pg), [])
    const failed = await storedJob(pg, job.id)
    assert.equal(failed.status, "failed", status)
    assert.equal(failed.last_error, "attempts_exhausted: source_research")
    assert.ok(failed.completed_at)
    assert.equal(failed.locked_by, null)
    assert.equal(failed.locked_at, null)
    await claim(pg)
    assert.deepEqual(await storedJob(pg, job.id), failed, "cleanup is idempotent")
  }
})

test("claim preserves an active lease at the attempt cap and a future normal job", async (t) => {
  const pg = await migratedDatabase(t)
  const active = await queuedJob(pg)
  await pg.query(
    `UPDATE public.product_intake_research_jobs
     SET status = 'running', attempt_count = max_attempts,
         locked_by = 'active-worker', locked_at = now() WHERE id = $1`,
    [active.id],
  )
  const future = await queuedJob(pg)
  await pg.query(
    "UPDATE public.product_intake_research_jobs SET next_run_at = now() + interval '1 hour' WHERE id = $1",
    [future.id],
  )
  const before = await storedJob(pg, active.id)
  assert.deepEqual(await claim(pg), [])
  assert.deepEqual(await storedJob(pg, active.id), before)
  assert.equal((await storedJob(pg, future.id)).attempt_count, 0)
})

test("claim excludes every closed submission even if its job is queued or stale-running", async (t) => {
  const pg = await migratedDatabase(t)
  for (const status of ["approved", "rejected", "cancelled_by_user", "matched_existing"]) {
    for (const jobStatus of ["queued", "waiting_for_rework", "running"]) {
      const job = await queuedJob(pg)
      await pg.query(
        "UPDATE public.product_submissions SET status = $2, approved_product_id = $3 WHERE id = $1",
        [
          job.submission_id,
          status,
          ["approved", "matched_existing"].includes(status) ? PRODUCT : null,
        ],
      )
      await pg.query(
        `UPDATE public.product_intake_research_jobs SET status = $2,
           locked_by = 'old-worker', locked_at = now() - interval '1 hour' WHERE id = $1`,
        [job.id, jobStatus],
      )
      assert.deepEqual(await claim(pg), [], `${status}: ${jobStatus}`)
      assert.equal((await storedJob(pg, job.id)).attempt_count, 0)
    }
  }
})

test("claim assigns a normal job once and still claims work after exhausted jobs", async (t) => {
  const pg = await migratedDatabase(t)
  const exhausted = await queuedJob(pg)
  await pg.query(
    "UPDATE public.product_intake_research_jobs SET attempt_count = max_attempts, priority = 10 WHERE id = $1",
    [exhausted.id],
  )
  const job = await queuedJob(pg)
  const claimed = await claim(pg)
  assert.equal(claimed.length, 1)
  assert.equal(claimed[0]!.id, job.id)
  assert.equal(claimed[0]!.status, "running")
  assert.equal(claimed[0]!.attempt_count, 1)
  assert.equal(claimed[0]!.locked_by, "worker-a")
  assert.ok(claimed[0]!.locked_at)
  assert.deepEqual(await claim(pg, "worker-b"), [])
  assert.equal((await storedJob(pg, exhausted.id)).status, "failed")
})

test("concurrently requested claims return a job to only one worker", async (t) => {
  const pg = await migratedDatabase(t)
  const job = await queuedJob(pg)
  // PGlite serializes queries on its single connection. This guards duplicate
  // claims from concurrent callers, not PostgreSQL's inter-session lock scheduling.
  const claims = await Promise.all([claim(pg, "worker-a"), claim(pg, "worker-b")])
  assert.deepEqual(
    claims.flat().map((row) => row.id),
    [job.id],
  )
  assert.equal((await storedJob(pg, job.id)).attempt_count, 1)
})

test("stage changes reset attempts, while same-stage requeues preserve the cap", async (t) => {
  const pg = await migratedDatabase(t)
  const job = await queuedJob(pg)
  await pg.query(
    "UPDATE public.product_intake_research_jobs SET attempt_count = max_attempts WHERE id = $1",
    [job.id],
  )
  const sameStage = await pg.query<Job>(
    "SELECT * FROM public.product_intake_update_research_job($1, 'queued', 'source_research')",
    [job.id],
  )
  assert.equal(sameStage.rows[0]!.attempt_count, 3)
  const imageStage = await pg.query<Job>(
    "SELECT * FROM public.product_intake_update_research_job($1, 'queued', 'image_judging')",
    [job.id],
  )
  assert.equal(imageStage.rows[0]!.attempt_count, 0)
  const [claimed] = await claim(pg)
  assert.equal(claimed!.attempt_count, 1)
  const previewStage = await pg.query<Job>(
    `SELECT * FROM public.product_intake_update_research_job(
      $1, 'waiting_for_review', 'preview_build', NULL, NULL, $2, $3)`,
    [job.id, claimed!.locked_by, claimed!.locked_at],
  )
  assert.equal(previewStage.rows[0]!.attempt_count, 0)
  assert.equal(previewStage.rows[0]!.locked_by, null)
})

test("a stale worker cannot reset attempts or change the stage after lease loss", async (t) => {
  const pg = await migratedDatabase(t)
  const job = await queuedJob(pg)
  const [claimed] = await claim(pg)
  await assert.rejects(
    pg.query(
      `SELECT * FROM public.product_intake_update_research_job(
        $1, 'queued', 'image_judging', NULL, NULL, 'other-worker', $2)`,
      [job.id, claimed!.locked_at],
    ),
    /lock no longer matches/,
  )
  assert.deepEqual(await storedJob(pg, job.id), claimed)
})

test("explicit rework continues to reset the attempt budget", async (t) => {
  const pg = await migratedDatabase(t)
  const job = await queuedJob(pg)
  await pg.query(
    "UPDATE public.product_intake_research_jobs SET status = 'failed', attempt_count = max_attempts WHERE id = $1",
    [job.id],
  )
  const { rows } = await pg.query<Job>(
    "SELECT * FROM public.product_intake_request_rework_job($1)",
    [job.submission_id],
  )
  assert.equal(rows[0]!.stage, "rework")
  assert.equal(rows[0]!.attempt_count, 0)
  assert.equal((await claim(pg))[0]!.attempt_count, 1)
})

test("retrying an exhausted failed job restores its attempt budget and makes it claimable", async (t) => {
  const pg = await migratedDatabase(t)
  const job = await queuedJob(pg)
  await pg.query(
    "UPDATE public.product_intake_research_jobs SET status = 'failed', attempt_count = max_attempts WHERE id = $1",
    [job.id],
  )

  const { rows } = await pg.query<Job>(
    "SELECT * FROM public.product_intake_retry_research_job($1)",
    [job.id],
  )
  assert.equal(rows[0]!.status, "queued")
  assert.equal(rows[0]!.attempt_count, 0)

  const [claimed] = await claim(pg)
  assert.equal(claimed!.id, job.id)
  assert.equal(claimed!.attempt_count, 1)
})

test("worker heartbeat upserts liveness without resetting started_at", async (t) => {
  const pg = await migratedDatabase(t)
  const job = await queuedJob(pg)
  await pg.query("SELECT public.product_intake_record_worker_heartbeat($1, $2, $3, $4, $5)", [
    "worker-a",
    "host-a",
    123,
    "release-a",
    job.id,
  ])
  await pg.exec(
    "UPDATE public.product_intake_worker_heartbeats SET started_at = '2026-01-01', last_seen_at = '2026-01-01'",
  )
  await pg.query("SELECT public.product_intake_record_worker_heartbeat($1, $2, $3, $4, $5)", [
    "worker-a",
    "host-b",
    456,
    null,
    null,
  ])
  const { rows } = await pg.query<{
    host: string
    pid: number
    release_sha: string | null
    current_job_id: string | null
    started_at: Date
    last_seen_at: Date
  }>("SELECT * FROM public.product_intake_worker_heartbeats")
  assert.equal(rows.length, 1)
  assert.equal(rows[0]!.host, "host-b")
  assert.equal(rows[0]!.pid, 456)
  assert.equal(rows[0]!.release_sha, null)
  assert.equal(rows[0]!.current_job_id, null)
  assert.equal(rows[0]!.started_at.toISOString(), "2026-01-01T00:00:00.000Z")
  assert.ok(rows[0]!.last_seen_at > rows[0]!.started_at)
})

test("lease renewal changes only the running owner's lease and fences subsequent writes", async (t) => {
  const pg = await migratedDatabase(t)
  const job = await queuedJob(pg)
  await claim(pg)
  await pg.query(
    "UPDATE public.product_intake_research_jobs SET locked_at = '2026-01-01' WHERE id = $1",
    [job.id],
  )
  const before = await storedJob(pg, job.id)
  const renew = async (owner: string, id = job.id) =>
    (
      await pg.query<{ lease: Date | null }>(
        "SELECT public.product_intake_renew_research_job_lease($1, $2) AS lease",
        [id, owner],
      )
    ).rows[0]!.lease
  assert.equal(await renew("worker-b"), null)
  assert.deepEqual(await storedJob(pg, job.id), before)
  const renewed = await renew("worker-a")
  assert.ok(renewed && renewed > before.locked_at!)
  await assert.rejects(
    pg.query(
      "SELECT public.product_intake_update_research_job($1, 'running', 'source_research', NULL, NULL, 'worker-a', $2)",
      [job.id, before.locked_at],
    ),
    /lock no longer matches/,
  )
  await pg.query(
    "SELECT public.product_intake_update_research_job($1, 'waiting_for_review', 'preview_build', NULL, NULL, 'worker-a', $2)",
    [job.id, renewed],
  )
  assert.equal(await renew("worker-a"), null)
  assert.equal(await renew("worker-a", "99999999-9999-4999-8999-999999999999"), null)
})

test("liveness table and RPCs are restricted to service_role with RLS and no policies", async (t) => {
  const pg = await migratedDatabase(t)
  const { rows } = await pg.query<{ relrowsecurity: boolean }>(
    "SELECT relrowsecurity FROM pg_class WHERE oid = 'public.product_intake_worker_heartbeats'::regclass",
  )
  assert.equal(rows[0]!.relrowsecurity, true)
  assert.deepEqual(
    (
      await pg.query(
        "SELECT * FROM pg_policies WHERE tablename = 'product_intake_worker_heartbeats'",
      )
    ).rows,
    [],
  )
  for (const role of ["anon", "authenticated"]) {
    await pg.exec(`RESET ROLE; SET ROLE ${role}`)
    await assert.rejects(
      pg.query("SELECT * FROM public.product_intake_worker_heartbeats"),
      /permission denied/,
    )
    await assert.rejects(
      pg.query("SELECT public.product_intake_record_worker_heartbeat('x', 'host', 1, NULL, NULL)"),
      /permission denied/,
    )
    await assert.rejects(
      pg.query("SELECT public.product_intake_renew_research_job_lease(NULL, 'x')"),
      /permission denied/,
    )
  }
})

test("engine binding is nullable, immutable across rework, and upgrades only with recorded boolean approval", async (t) => {
  const pg = await migratedDatabase(t)
  const job = await queuedJob(pg)
  const initial = await pg.query(
    "SELECT engine_key, engine_version FROM public.product_intake_research_jobs WHERE id = $1",
    [job.id],
  )
  assert.deepEqual(initial.rows, [{ engine_key: null, engine_version: null }])
  const [claimed] = await claim(pg)
  const bind = async (key: string, version: string, lease = claimed!) =>
    (
      await pg.query<Job>(
        "SELECT * FROM public.product_intake_bind_research_job_engine($1, $2, $3, $4, $5)",
        [job.id, key, version, lease.locked_by, lease.locked_at],
      )
    ).rows[0]!

  const first = await bind("conditioner-standard", "v1.6/conditioner-production-adapter-v1")
  assert.equal(first.engine_key, "conditioner-standard")
  assert.equal(first.engine_version, "v1.6/conditioner-production-adapter-v1")
  assert.equal(first.locked_by, claimed!.locked_by)
  assert.deepEqual(first.locked_at, claimed!.locked_at)
  assert.deepEqual(await bind(first.engine_key!, first.engine_version!), first)
  await assert.rejects(
    bind("conditioner-standard", "v1.7/conditioner-production-adapter-v1"),
    /engine_version_mismatch: v1.6\/conditioner-production-adapter-v1 != v1.7\/conditioner-production-adapter-v1/,
  )
  await assert.rejects(bind("leave-in-standard", first.engine_version!), /engine_key_mismatch:/)
  assert.deepEqual(await storedJob(pg, job.id), first)

  await pg.query(
    "SELECT * FROM public.product_intake_update_research_job($1, 'blocked', 'rework')",
    [job.id],
  )
  await pg.query("SELECT * FROM public.product_intake_request_rework_job($1, $2)", [
    job.submission_id,
    { engine_upgrade: "true" },
  ])
  const [reclaimed] = await claim(pg)
  assert.equal(reclaimed!.engine_version, first.engine_version)
  await assert.rejects(
    bind("conditioner-standard", "v1.7/conditioner-production-adapter-v1", reclaimed!),
    /engine_version_mismatch:/,
  )
  await pg.query("UPDATE public.product_intake_research_jobs SET progress = $2 WHERE id = $1", [
    job.id,
    { engine_upgrade: true, note: "explicit rework" },
  ])
  const upgraded = await bind(
    "conditioner-standard",
    "v1.7/conditioner-production-adapter-v1",
    reclaimed!,
  )
  assert.equal(upgraded.engine_version, "v1.7/conditioner-production-adapter-v1")
  assert.equal(upgraded.progress.engine_upgrade, false)
  assert.equal(upgraded.progress.note, "explicit rework")
  assert.deepEqual(upgraded.progress.engine_upgrade_receipt, {
    previous_key: "conditioner-standard",
    previous_version: "v1.6/conditioner-production-adapter-v1",
    key: "conditioner-standard",
    version: "v1.7/conditioner-production-adapter-v1",
  })
  await assert.rejects(
    bind("conditioner-standard", "v1.8/conditioner-production-adapter-v1", reclaimed!),
    /engine_version_mismatch:/,
  )
})

test("engine binding rejects invalid tuples, stale leases, closed jobs, and unprivileged callers", async (t) => {
  const pg = await migratedDatabase(t)
  const job = await queuedJob(pg)
  const [claimed] = await claim(pg)
  const bind = (
    key: string | null,
    version: string | null,
    owner: string | null,
    lease: Date | null,
  ) =>
    pg.query("SELECT * FROM public.product_intake_bind_research_job_engine($1, $2, $3, $4, $5)", [
      job.id,
      key,
      version,
      owner,
      lease,
    ])
  for (const [key, version] of [
    [null, "v1"],
    ["engine", null],
    [" ", "v1"],
    ["engine", " "],
  ]) {
    await assert.rejects(
      bind(key!, version!, claimed!.locked_by, claimed!.locked_at),
      /engine binding requires a non-empty key and version/,
    )
  }
  for (const [owner, lease] of [
    ["worker-b", claimed!.locked_at],
    [null, claimed!.locked_at],
    [claimed!.locked_by, null],
    [claimed!.locked_by, new Date("2026-01-01")],
  ] as const) {
    await assert.rejects(bind("engine", "v1", owner, lease), /lock no longer matches/)
  }
  assert.equal((await storedJob(pg, job.id)).engine_key, null)
  await pg.query(
    "SELECT * FROM public.product_intake_update_research_job($1, 'blocked', 'rework')",
    [job.id],
  )
  await assert.rejects(
    bind("engine", "v1", claimed!.locked_by, claimed!.locked_at),
    /lock no longer matches/,
  )
  for (const role of ["anon", "authenticated"]) {
    await pg.exec(`RESET ROLE; SET ROLE ${role}`)
    await assert.rejects(
      bind("engine", "v1", claimed!.locked_by, claimed!.locked_at),
      /permission denied/,
    )
  }
})
