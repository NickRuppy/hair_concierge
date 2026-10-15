import assert from "node:assert/strict"
import test from "node:test"

import type { PGlite } from "@electric-sql/pglite"

import { createAdminAlertTestDatabase } from "../scripts/product-intake/admin-alert-test-database"

const USER = "11111111-1111-4111-8111-111111111111"
const PRODUCT = "22222222-2222-4222-8222-222222222222"

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
  const pg = await createAdminAlertTestDatabase()
  t.after(() => pg.close())
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

function notificationPayload(submissionId: string) {
  return {
    product_name: "Test Conditioner",
    category_label: "Conditioner",
    outcome_label: "Bereit zur Prüfung",
    question_1: "",
    question_2: "",
    question_3: "",
    review_url: `https://chaarlie.de/admin/produkt-intake/${submissionId}`,
    is_test: false,
  }
}

async function commitPass(
  pg: PGlite,
  job: Job,
  outcome: "continue" | "ready_for_review" | "needs_nick" = "ready_for_review",
  decisionIds: string[] = [],
) {
  const status = outcome === "continue" ? "queued" : "waiting_for_review"
  const stage = outcome === "continue" ? "image_judging" : "preview_build"
  return pg.query<Job>(
    "SELECT * FROM public.product_intake_commit_research_pass($1, $2, $3, $4, $5, $6, NULL, $7, $8, $9, $10)",
    [
      job.id,
      job.locked_by,
      job.locked_at,
      status,
      stage,
      { source: "test" },
      { identity: "test" },
      decisionIds,
      outcome,
      outcome === "continue" ? null : notificationPayload(job.submission_id),
    ],
  )
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

test("research completion atomically writes a review outcome once and preserves uncaptured decisions", async (t) => {
  const pg = await migratedDatabase(t)
  const job = await queuedJob(pg)
  const [claimed] = await claim(pg)
  const decisions = await pg.query<{ id: string }>(
    `INSERT INTO public.product_intake_review_decisions
      (submission_id, job_id, field_path, decision, reviewed_by)
     VALUES ($1, $2, 'identity.name', 'change_requested', 'nick'),
            ($1, $2, 'properties.slip', 'change_requested', 'nick') RETURNING id`,
    [job.submission_id, job.id],
  )
  await pg.query("UPDATE public.product_intake_research_jobs SET progress = $2 WHERE id = $1", [
    job.id,
    { stale_readiness: true, stale_rework: true },
  ])
  const completed = (await commitPass(pg, claimed!, "ready_for_review", [decisions.rows[0]!.id]))
    .rows[0]!
  assert.equal(completed.status, "waiting_for_review")
  assert.equal(completed.locked_at, null)
  assert.equal(completed.progress.review_outcome, "ready_for_review")
  assert.equal(
    (await pg.query("SELECT * FROM public.product_intake_admin_notifications")).rows.length,
    1,
  )
  const resolved = await pg.query<{ id: string; resolved_at: Date | null }>(
    "SELECT id, resolved_at FROM public.product_intake_review_decisions WHERE id = ANY($1)",
    [decisions.rows.map((decision) => decision.id)],
  )
  const resolvedById = new Map(resolved.rows.map((decision) => [decision.id, decision.resolved_at]))
  assert.ok(resolvedById.get(decisions.rows[0]!.id))
  assert.equal(resolvedById.get(decisions.rows[1]!.id), null)
  assert.equal(completed.progress.stale_readiness, undefined)
  assert.equal(completed.progress.stale_rework, undefined)
  assert.equal(
    (
      await pg.query<{ status: string }>(
        "SELECT status FROM public.product_submissions WHERE id = $1",
        [job.submission_id],
      )
    ).rows[0]!.status,
    "ready_for_review",
  )

  await pg.exec("SET TIMEZONE TO 'Europe/Berlin'")
  const replay = (await commitPass(pg, claimed!, "ready_for_review", [decisions.rows[0]!.id]))
    .rows[0]!
  assert.deepEqual(replay, completed)
  assert.equal(
    (await pg.query("SELECT * FROM public.product_intake_admin_notifications")).rows.length,
    1,
  )
})

test("completion rejects invalid snapshots or stale owners without partial writes and continue creates no event", async (t) => {
  const pg = await migratedDatabase(t)
  const job = await queuedJob(pg)
  const [claimed] = await claim(pg)
  for (const invalidSnapshot of [
    { ...notificationPayload(job.submission_id), is_test: true },
    { ...notificationPayload(job.submission_id), product_name: "x".repeat(181) },
    { ...notificationPayload(job.submission_id), question_1: "x".repeat(181) },
    { ...notificationPayload(job.submission_id), outcome_label: "Entscheidung nötig" },
  ]) {
    await assert.rejects(
      pg.query(
        "SELECT * FROM public.product_intake_commit_research_pass($1, $2, $3, 'waiting_for_review', 'preview_build', '{}'::jsonb, NULL, '{}'::jsonb, '{}', 'ready_for_review', $4)",
        [job.id, claimed!.locked_by, claimed!.locked_at, invalidSnapshot],
      ),
      /invalid admin notification payload/,
    )
  }
  assert.equal((await storedJob(pg, job.id)).status, "running")
  assert.equal(
    (await pg.query("SELECT * FROM public.product_intake_admin_notifications")).rows.length,
    0,
  )
  await assert.rejects(
    commitPass(pg, { ...claimed!, locked_by: "wrong-worker" }),
    /lock no longer matches/,
  )
  const continued = (await commitPass(pg, claimed!, "continue")).rows[0]!
  assert.equal(continued.status, "queued")
  assert.equal(
    (await pg.query("SELECT * FROM public.product_intake_admin_notifications")).rows.length,
    0,
  )
  const [reclaimed] = await claim(pg, "worker-b")
  await assert.rejects(commitPass(pg, claimed!, "continue"), /lock no longer matches/)
  assert.equal(reclaimed!.status, "running")
})

test("completion rolls back preview, decisions, and job handoff if the outbox insert fails", async (t) => {
  const pg = await migratedDatabase(t)
  const job = await queuedJob(pg)
  const [claimed] = await claim(pg)
  const decision = await pg.query<{ id: string }>(
    `INSERT INTO public.product_intake_review_decisions
      (submission_id, job_id, field_path, decision, reviewed_by)
     VALUES ($1, $2, 'identity.name', 'change_requested', 'nick') RETURNING id`,
    [job.submission_id, job.id],
  )
  await pg.exec(`
    RESET ROLE;
    CREATE FUNCTION public.fail_admin_notification_insert() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'deliberate outbox fault'; END;
    $$;
    CREATE TRIGGER fail_admin_notification_insert
      BEFORE INSERT ON public.product_intake_admin_notifications
      FOR EACH ROW EXECUTE FUNCTION public.fail_admin_notification_insert();
    SET ROLE service_role;
  `)
  await assert.rejects(
    commitPass(pg, claimed!, "ready_for_review", [decision.rows[0]!.id]),
    /deliberate outbox fault/,
  )
  await pg.exec(
    "RESET ROLE; DROP TRIGGER fail_admin_notification_insert ON public.product_intake_admin_notifications; SET ROLE service_role",
  )
  assert.equal((await storedJob(pg, job.id)).status, "running")
  assert.equal(
    (
      await pg.query<{ status: string }>(
        "SELECT status FROM public.product_submissions WHERE id = $1",
        [job.submission_id],
      )
    ).rows[0]!.status,
    "pending_review",
  )
  assert.equal(
    (
      await pg.query<{ resolved_at: Date | null }>(
        "SELECT resolved_at FROM public.product_intake_review_decisions WHERE id = $1",
        [decision.rows[0]!.id],
      )
    ).rows[0]!.resolved_at,
    null,
  )
  assert.equal(
    (await pg.query("SELECT * FROM public.product_intake_admin_notifications")).rows.length,
    0,
  )
  assert.equal(
    (await commitPass(pg, claimed!, "ready_for_review", [decision.rows[0]!.id])).rows[0]!.status,
    "waiting_for_review",
  )
})

test("admin notifications hold uncertain delivery, preserve fences and bound definite retries", async (t) => {
  const pg = await migratedDatabase(t)
  const job = await queuedJob(pg)
  const [claimed] = await claim(pg)
  await commitPass(pg, claimed!)
  const first = (
    await pg.query<{ id: string; lease_token: string; attempts: number }>(
      "SELECT * FROM public.product_intake_claim_admin_notification()",
    )
  ).rows[0]!
  assert.equal(first.attempts, 1)
  assert.equal(
    (
      await pg.query<{ product_intake_settle_admin_notification: boolean }>(
        "SELECT public.product_intake_settle_admin_notification($1, $2, 'definite_transient', NULL, NULL, 'provider_http_429')",
        [first.id, first.lease_token],
      )
    ).rows[0]!.product_intake_settle_admin_notification,
    true,
  )
  assert.deepEqual(
    (await pg.query("SELECT * FROM public.product_intake_claim_admin_notification()")).rows,
    [],
  )
  await pg.query(
    "UPDATE public.product_intake_admin_notifications SET next_attempt_at = now() - interval '1 second' WHERE id = $1",
    [first.id],
  )
  const second = (
    await pg.query<{ lease_token: string; attempts: number }>(
      "SELECT * FROM public.product_intake_claim_admin_notification()",
    )
  ).rows[0]!
  assert.equal(second.attempts, 2)
  assert.equal(
    (
      await pg.query<{ product_intake_settle_admin_notification: boolean }>(
        "SELECT public.product_intake_settle_admin_notification($1, $2, 'sent', 'd', 'q')",
        [first.id, first.lease_token],
      )
    ).rows[0]!.product_intake_settle_admin_notification,
    false,
  )
  await pg.query<{ product_intake_settle_admin_notification: boolean }>(
    "SELECT public.product_intake_settle_admin_notification($1, $2, 'ambiguous', NULL, NULL, 'timeout')",
    [first.id, second.lease_token],
  )
  const afterAmbiguous = await pg.query<{ status: string; attempts: number }>(
    "SELECT status, attempts FROM public.product_intake_admin_notifications WHERE id = $1",
    [first.id],
  )
  assert.deepEqual(afterAmbiguous.rows[0], { status: "needs_reconciliation", attempts: 2 })
  assert.deepEqual(
    (await pg.query("SELECT * FROM public.product_intake_claim_admin_notification()")).rows,
    [],
  )

  // A crash can lose a successful provider receipt on the very first attempt.
  // An expired lease must be quarantined without resending or blocking later work.
  const laterJob = await queuedJob(pg)
  const [laterClaim] = await claim(pg)
  await commitPass(pg, laterClaim!)
  const expiredToken = "33333333-3333-4333-8333-333333333333"
  await pg.query(
    `UPDATE public.product_intake_admin_notifications
     SET status = 'sending', attempts = 1,
         lease_token = $2, locked_at = now() - interval '6 minutes',
         created_at = now() - interval '1 day'
     WHERE id = $1`,
    [first.id, expiredToken],
  )
  const laterNotification = (
    await pg.query<{ id: string; job_id: string; lease_token: string; attempts: number }>(
      "SELECT * FROM public.product_intake_claim_admin_notification()",
    )
  ).rows[0]!
  assert.equal(laterNotification.job_id, laterJob.id)
  assert.equal(laterNotification.attempts, 1)
  assert.deepEqual(
    (
      await pg.query(
        "SELECT status, attempts, error, lease_token, locked_at FROM public.product_intake_admin_notifications WHERE id = $1",
        [first.id],
      )
    ).rows[0],
    {
      status: "needs_reconciliation",
      attempts: 1,
      error: "delivery_lease_expired",
      lease_token: null,
      locked_at: null,
    },
  )
  assert.equal(
    (
      await pg.query<{ product_intake_settle_admin_notification: boolean }>(
        "SELECT public.product_intake_settle_admin_notification($1, $2, 'sent', 'late-receipt', 'q')",
        [first.id, expiredToken],
      )
    ).rows[0]!.product_intake_settle_admin_notification,
    false,
  )

  // Definite rejections still retry, but the fifth attempt is terminal.
  let pending = laterNotification
  for (let attempt = 1; attempt <= 5; attempt++) {
    assert.equal(pending.attempts, attempt)
    await pg.query(
      "SELECT public.product_intake_settle_admin_notification($1, $2, 'definite_transient', NULL, NULL, 'provider_http_429')",
      [pending.id, pending.lease_token],
    )
    if (attempt < 5) {
      await pg.query(
        "UPDATE public.product_intake_admin_notifications SET next_attempt_at = now() - interval '1 second' WHERE id = $1",
        [pending.id],
      )
      pending = (
        await pg.query<typeof laterNotification>(
          "SELECT * FROM public.product_intake_claim_admin_notification()",
        )
      ).rows[0]!
    }
  }
  assert.deepEqual(
    (
      await pg.query(
        "SELECT status, attempts FROM public.product_intake_admin_notifications WHERE id = $1",
        [laterNotification.id],
      )
    ).rows[0],
    { status: "failed", attempts: 5 },
  )
  assert.deepEqual(
    (await pg.query("SELECT * FROM public.product_intake_claim_admin_notification()")).rows,
    [],
  )
})

test("admin notification storage and RPCs are inaccessible to anon and authenticated roles", async (t) => {
  const pg = await migratedDatabase(t)
  for (const role of ["anon", "authenticated"]) {
    await pg.exec(`RESET ROLE; SET ROLE ${role}`)
    await assert.rejects(
      pg.query("SELECT * FROM public.product_intake_admin_notifications"),
      /permission denied/,
    )
    await assert.rejects(
      pg.query("SELECT * FROM public.product_intake_claim_admin_notification()"),
      /permission denied/,
    )
    await assert.rejects(
      pg.query<{ product_intake_settle_admin_notification: boolean }>(
        "SELECT public.product_intake_settle_admin_notification(NULL, NULL, 'sent')",
      ),
      /permission denied/,
    )
  }
})
