import assert from "node:assert/strict"
import test from "node:test"

import type { PGlite } from "@electric-sql/pglite"
import {
  commitResearchPass,
  reserveResearchModelRun,
  ResearchModelReservationError,
  type CommitResearchPassParams,
} from "@chaarlie/product-intake-core"

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
  review_cycle_id: string
  auto_rework_count: number
  reserved_model_runs: number
  cycle_deadline_at: Date | null
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
    commitCycle(pg, claimed!, { artifacts: finalArtifacts, decisionIds: [decision.rows[0]!.id] }),
    /deliberate outbox fault/,
  )
  await pg.exec(
    "RESET ROLE; DROP TRIGGER fail_admin_notification_insert ON public.product_intake_admin_notifications; SET ROLE service_role",
  )
  assert.equal((await storedJob(pg, job.id)).status, "running")
  assert.equal(
    (await pg.query("SELECT * FROM public.product_intake_research_artifacts")).rows.length,
    0,
  )
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
    (
      await commitCycle(pg, claimed!, {
        artifacts: finalArtifacts,
        decisionIds: [decision.rows[0]!.id],
      })
    ).status,
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

// The database owns these safety boundaries: mocks cannot prove transactional
// rollback, lease fencing or persisted budgets across crashes and human rework.
async function reserve(pg: PGlite, job: Job) {
  return (
    await pg.query<Job>("SELECT * FROM public.product_intake_reserve_model_run($1,$2,$3,$4)", [
      job.id,
      job.locked_by,
      job.locked_at,
      job.review_cycle_id,
    ])
  ).rows[0]!
}

// Only the transport envelope is adapted. Actual validation and persistence run
// through the repository wrapper and PostgreSQL functions, not a mock store.
function cycleRpcClient(pg: PGlite): Parameters<typeof commitResearchPass>[0] {
  return {
    rpc: async (name: string, args: Record<string, unknown>) => {
      const names =
        name === "product_intake_commit_research_pass"
          ? [
              "target_job_id",
              "expected_locked_by",
              "expected_locked_at",
              "next_status",
              "next_stage",
              "next_progress",
              "next_last_error",
              "researched_payload",
              "resolve_decision_ids",
              "review_outcome",
              "notification_payload",
              "expected_review_cycle_id",
              "research_artifacts",
              "request_auto_rework",
            ]
          : name === "product_intake_reserve_model_run"
            ? [
                "target_job_id",
                "expected_locked_by",
                "expected_locked_at",
                "expected_review_cycle_id",
              ]
            : null
      if (!names) throw new Error("Unsupported cycle proof RPC")
      try {
        const result = await pg.query(
          `SELECT * FROM public.${name}(${names.map((_, i) => `$${i + 1}`).join(",")})`,
          names.map((key) =>
            key === "research_artifacts" ? JSON.stringify(args[key]) : args[key],
          ),
        )
        return { data: result.rows[0], error: null }
      } catch (error) {
        const pgError = error as { code: string; detail?: string; message: string }
        return {
          data: null,
          error: Object.assign(new Error(pgError.message), {
            code: pgError.code,
            details: pgError.detail,
          }),
        }
      }
    },
  } as unknown as Parameters<typeof commitResearchPass>[0]
}

async function commitCycle(
  pg: PGlite,
  job: Job,
  options: {
    autoRework?: boolean
    artifacts?: unknown[]
    payload?: Record<string, unknown>
    blocked?: boolean
    decisionIds?: string[]
    inciRetry?: boolean
  } = {},
): Promise<Job> {
  const outcome = options.autoRework
    ? "continue"
    : options.blocked
      ? "needs_nick"
      : "ready_for_review"
  return (await commitResearchPass(cycleRpcClient(pg), {
    jobId: job.id,
    expectedLockedBy: job.locked_by,
    expectedLockedAt: job.locked_at!.toISOString(),
    status: options.autoRework
      ? "waiting_for_rework"
      : options.blocked
        ? "blocked"
        : "waiting_for_review",
    stage: options.autoRework ? "rework" : "preview_build",
    progress: {
      artifact_ids: ["forged"],
      artifacts_created: 999,
      ...(options.inciRetry ? { inci_retry_attempted: true } : {}),
    },
    researchedPayload: options.payload ?? { final: "reviewed" },
    resolveDecisionIds: options.decisionIds ?? [],
    reviewOutcome: outcome,
    notificationPayload: options.autoRework
      ? null
      : {
          ...notificationPayload(job.submission_id),
          outcome_label: options.blocked ? "Entscheidung nötig" : "Bereit zur Prüfung",
        },
    expectedReviewCycleId: job.review_cycle_id,
    artifacts: (options.artifacts ?? []).map((value) => {
      const artifact = value as Record<string, unknown>
      return {
        id: artifact.id,
        kind: artifact.kind,
        payload: artifact.payload,
        status: artifact.status,
        confidence: artifact.confidence,
        sourceUrls: artifact.source_urls,
        model: artifact.model,
        promptVersion: artifact.prompt_version,
      } as NonNullable<CommitResearchPassParams["artifacts"]>[number]
    }),
    autoRework: options.autoRework ?? false,
  })) as unknown as Job
}

const finalArtifacts = [
  { kind: "property_synthesis", payload: { slip: "moderate" } },
  {
    kind: "model_judgment",
    payload: { defects: [] },
    confidence: 1,
    model: "judge-model",
    prompt_version: "projected-v1",
  },
  {
    kind: "processed_image",
    payload: { image: "private/local.png" },
    source_urls: ["https://example.com/image"],
  },
]

test("completion rejects changed replay content even for legacy callers", async (t) => {
  const pg = await migratedDatabase(t)
  await queuedJob(pg)
  const [job] = await claim(pg)
  await commitPass(pg, job!)
  await assert.rejects(
    pg.query(
      "SELECT * FROM public.product_intake_commit_research_pass($1,$2,$3,'waiting_for_review','preview_build','{\"source\":\"test\"}',NULL,'{\"changed\":true}','{}','ready_for_review',$4)",
      [job!.id, job!.locked_by, job!.locked_at, notificationPayload(job!.submission_id)],
    ),
    /completion replay/,
  )
})

test("model reservations persist through reclaim and retry, cap six runs, and fence stale leases and cycles", async (t) => {
  const pg = await migratedDatabase(t)
  await queuedJob(pg)
  let [job] = await claim(pg)
  const first = await reserve(pg, job!)
  assert.equal(first.reserved_model_runs, 1)
  assert.ok(first.cycle_deadline_at)
  const remaining = first.cycle_deadline_at!.getTime() - Date.now()
  assert.ok(remaining > 44 * 60_000 && remaining <= 45 * 60_000)
  await assert.rejects(reserve(pg, { ...job!, locked_by: "lost-worker" }), /lock no longer matches/)
  await assert.rejects(
    reserve(pg, { ...job!, review_cycle_id: PRODUCT }),
    /cycle no longer matches/,
  )
  await assert.rejects(commitPass(pg, job!), /review cycle is required/)
  await pg.query(
    "UPDATE public.product_intake_research_jobs SET locked_at=now()-interval '1 hour' WHERE id=$1",
    [job!.id],
  )
  ;[job] = await claim(pg, "worker-after-crash")
  const second = await reserve(pg, job!)
  assert.equal(second.reserved_model_runs, 2)
  assert.deepEqual(second.cycle_deadline_at, first.cycle_deadline_at)
  await pg.query(
    "SELECT public.product_intake_update_research_job($1,'failed','source_research',NULL,NULL,$2,$3)",
    [job!.id, job!.locked_by, job!.locked_at],
  )
  await pg.query("SELECT public.product_intake_retry_research_job($1)", [job!.id])
  ;[job] = await claim(pg, "worker-after-retry")
  for (let count = 3; count <= 6; count++)
    assert.equal((await reserve(pg, job!)).reserved_model_runs, count)
  await assert.rejects(reserve(pg, job!), (error: unknown) => {
    const e = error as { code: string; detail: string }
    return e.code === "23514" && e.detail === "model_run_limit"
  })
  await assert.rejects(
    reserveResearchModelRun(cycleRpcClient(pg), {
      jobId: job!.id,
      expectedLockedBy: job!.locked_by!,
      expectedLockedAt: job!.locked_at!.toISOString(),
      expectedReviewCycleId: job!.review_cycle_id,
    }),
    (error: unknown) =>
      error instanceof ResearchModelReservationError &&
      error.code === "model_run_limit" &&
      error.sqlState === "23514",
  )
  assert.equal((await storedJob(pg, job!.id)).reserved_model_runs, 6)
  assert.deepEqual((await storedJob(pg, job!.id)).cycle_deadline_at, first.cycle_deadline_at)
})

test("cycle deadline denies new runs and ready handoff but allows atomic human escalation", async (t) => {
  const pg = await migratedDatabase(t)
  await queuedJob(pg)
  const [job] = await claim(pg)
  await reserve(pg, job!)
  await pg.query(
    "UPDATE public.product_intake_research_jobs SET cycle_deadline_at=now()-interval '1 second' WHERE id=$1",
    [job!.id],
  )
  await assert.rejects(
    reserve(pg, job!),
    (error: unknown) => (error as { detail: string }).detail === "cycle_deadline",
  )
  await assert.rejects(
    commitCycle(pg, job!),
    (error: unknown) =>
      error instanceof ResearchModelReservationError && error.code === "cycle_deadline",
  )
  const blocked = await commitCycle(pg, job!, { blocked: true, artifacts: finalArtifacts })
  assert.equal(blocked.status, "blocked")
  assert.equal(blocked.reserved_model_runs, 1)
  assert.equal(
    (await pg.query("SELECT * FROM public.product_intake_admin_notifications")).rows.length,
    1,
  )
})

test("two automatic reworks share one cycle, require two slots, and explicit human rework alone resets it", async (t) => {
  const pg = await migratedDatabase(t)
  await queuedJob(pg)
  let [job] = await claim(pg)
  const cycle = job!.review_cycle_id
  for (let round = 1; round <= 2; round++) {
    await reserve(pg, job!)
    await reserve(pg, job!)
    const next = await commitCycle(pg, job!, { autoRework: true, inciRetry: round === 1 })
    assert.equal(next.progress.inci_retry_attempted, true)
    assert.equal(next.auto_rework_count, round)
    assert.equal(next.review_cycle_id, cycle)
    assert.equal(next.attempt_count, 0)
    assert.equal(next.locked_by, null)
    assert.equal(next.reserved_model_runs, round * 2)
    assert.equal(
      (await pg.query("SELECT * FROM public.product_intake_admin_notifications")).rows.length,
      0,
    )
    if (round === 1) {
      await pg.query(
        "SELECT public.product_intake_update_research_job($1,'failed','rework','{\"inci_retry_attempted\":false}')",
        [job!.id],
      )
      assert.equal((await storedJob(pg, job!.id)).progress.inci_retry_attempted, true)
      await pg.query(
        "SELECT public.product_intake_retry_research_job($1,'{\"inci_retry_attempted\":false}')",
        [job!.id],
      )
      assert.equal((await storedJob(pg, job!.id)).progress.inci_retry_attempted, true)
    }
    ;[job] = await claim(pg)
  }
  await assert.rejects(commitCycle(pg, job!, { autoRework: true }), /automatic rework budget/)
  await assert.rejects(
    pg.query("SELECT public.product_intake_request_rework_job($1)", [job!.submission_id]),
    /No review-ready/,
  )
  const completed = await commitCycle(pg, job!, { artifacts: finalArtifacts })
  const fresh = (
    await pg.query<Job>("SELECT * FROM public.product_intake_request_rework_job($1)", [
      job!.submission_id,
    ])
  ).rows[0]!
  assert.notEqual(fresh.review_cycle_id, cycle)
  assert.equal(fresh.reserved_model_runs, 0)
  assert.equal(fresh.auto_rework_count, 0)
  assert.equal(fresh.cycle_deadline_at, null)
  assert.equal(fresh.progress.inci_retry_attempted, undefined)
  await assert.rejects(
    commitCycle(pg, job!, { artifacts: finalArtifacts }),
    /cycle no longer matches/,
  )
  assert.equal(
    (await pg.query("SELECT * FROM public.product_intake_research_artifacts")).rows.length,
    3,
  )
  assert.equal(completed.progress.artifacts_created, 3)

  const [newClaim] = await claim(pg)
  for (let n = 0; n < 5; n++) await reserve(pg, newClaim!)
  await assert.rejects(commitCycle(pg, newClaim!, { autoRework: true }), /automatic rework budget/)
})

test("final artifacts commit atomically, identify stored images, and exact replay creates no duplicates", async (t) => {
  const pg = await migratedDatabase(t)
  await queuedJob(pg)
  const [job] = await claim(pg)
  await reserve(pg, job!)
  await assert.rejects(
    commitCycle(pg, job!, {
      artifacts: [...finalArtifacts, { kind: "model_judgment", payload: [], confidence: 2 }],
    }),
    /invalid research artifact/,
  )
  assert.equal((await storedJob(pg, job!.id)).status, "running")
  assert.equal(
    (await pg.query("SELECT * FROM public.product_intake_research_artifacts")).rows.length,
    0,
  )
  assert.equal(
    (await pg.query("SELECT * FROM public.product_intake_admin_notifications")).rows.length,
    0,
  )
  const saved = await commitCycle(pg, job!, { artifacts: finalArtifacts })
  const rows = (
    await pg.query<{ id: string; kind: string }>(
      "SELECT id,kind FROM public.product_intake_research_artifacts",
    )
  ).rows
  assert.equal(saved.progress.artifacts_created, 3)
  assert.deepEqual(
    new Set(saved.progress.artifact_ids as string[]),
    new Set(rows.map((row) => row.id)),
  )
  assert.equal(
    saved.progress.processed_image_artifact_id,
    rows.find((row) => row.kind === "processed_image")!.id,
  )
  assert.deepEqual(
    (
      await pg.query(
        "SELECT payload,confidence::float8 AS confidence,model,prompt_version FROM public.product_intake_research_artifacts WHERE kind='model_judgment'",
      )
    ).rows[0],
    {
      payload: { defects: [] },
      confidence: 1,
      model: "judge-model",
      prompt_version: "projected-v1",
    },
  )
  assert.deepEqual(
    (
      await pg.query(
        "SELECT source_urls FROM public.product_intake_research_artifacts WHERE kind='processed_image'",
      )
    ).rows[0],
    { source_urls: ["https://example.com/image"] },
  )
  assert.deepEqual(await commitCycle(pg, job!, { artifacts: finalArtifacts }), saved)
  await assert.rejects(
    commitCycle(pg, job!, { artifacts: finalArtifacts, payload: { changed: true } }),
    /completion replay/,
  )
  await assert.rejects(commitCycle(pg, job!, { artifacts: [] }), /completion replay/)
  assert.equal(
    (await pg.query("SELECT * FROM public.product_intake_research_artifacts")).rows.length,
    3,
  )
})

test("atomic handoff persists allocated artifact IDs with payload references and rejects collisions without partial writes", async (t) => {
  const pg = await migratedDatabase(t)
  await queuedJob(pg)
  const [job] = await claim(pg)
  await reserve(pg, job!)
  const identityId = "33333333-3333-4333-8333-333333333333"
  const propertiesId = "44444444-4444-4444-8444-444444444444"
  const artifacts = [
    { id: identityId, kind: "identity_candidate", payload: { name: "Test Oil" } },
    { id: propertiesId, kind: "property_synthesis", payload: { weight: "light" } },
    finalArtifacts[2]!, // Generic callers still rely on database-generated IDs.
  ]
  const payload = { identity_artifact_id: identityId, property_artifact_id: propertiesId }
  const decision = (
    await pg.query<{ id: string }>(
      `INSERT INTO public.product_intake_review_decisions
      (submission_id, job_id, field_path, decision, reviewed_by)
     VALUES ($1, $2, 'identity.name', 'change_requested', 'nick') RETURNING id`,
      [job!.submission_id, job!.id],
    )
  ).rows[0]!
  const snapshot = async () => ({
    job: await storedJob(pg, job!.id),
    submissions: (await pg.query("SELECT * FROM public.product_submissions ORDER BY id")).rows,
    artifacts: (
      await pg.query("SELECT * FROM public.product_intake_research_artifacts ORDER BY id")
    ).rows,
    decisions: (await pg.query("SELECT * FROM public.product_intake_review_decisions ORDER BY id"))
      .rows,
    notifications: (
      await pg.query("SELECT * FROM public.product_intake_admin_notifications ORDER BY id")
    ).rows,
  })
  const before = await snapshot()
  const options = { artifacts, payload, decisionIds: [decision.id] }
  await assert.rejects(
    commitCycle(pg, { ...job!, locked_by: "expired-worker" }, options),
    /lock no longer matches/,
  )
  assert.deepEqual(await snapshot(), before)
  for (const invalidId of [null, 42, "not-a-uuid"]) {
    await assert.rejects(
      commitCycle(pg, job!, {
        ...options,
        artifacts: [artifacts[0]!, { ...artifacts[1]!, id: invalidId }],
      }),
      /invalid research artifact|invalid input syntax for type uuid/,
    )
    assert.deepEqual(await snapshot(), before, `invalid ID ${invalidId} rolls back earlier inserts`)
  }
  await assert.rejects(
    commitCycle(pg, job!, {
      ...options,
      artifacts: [artifacts[0]!, { ...artifacts[1]!, id: identityId }],
    }),
    /duplicate key value/,
  )
  assert.deepEqual(await snapshot(), before, "duplicate IDs roll back the entire handoff")

  const saved = await commitCycle(pg, job!, options)
  const stored = (
    await pg.query<{ id: string; kind: string }>(
      "SELECT id,kind FROM public.product_intake_research_artifacts ORDER BY kind",
    )
  ).rows
  assert.equal(stored.find((row) => row.kind === "identity_candidate")!.id, identityId)
  assert.equal(stored.find((row) => row.kind === "property_synthesis")!.id, propertiesId)
  const generatedId = stored.find((row) => row.kind === "processed_image")!.id
  assert.match(generatedId, /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/)
  assert.deepEqual(saved.progress.artifact_ids, [identityId, propertiesId, generatedId])
  assert.equal(saved.progress.processed_image_artifact_id, generatedId)
  assert.deepEqual(
    (
      await pg.query<{ researched_payload: unknown }>(
        "SELECT researched_payload FROM public.product_submissions WHERE id=$1",
        [job!.submission_id],
      )
    ).rows[0]!.researched_payload,
    payload,
  )
  const committed = await snapshot()
  assert.deepEqual(await commitCycle(pg, job!, options), saved)
  assert.deepEqual(
    await snapshot(),
    committed,
    "exact replay neither replaces artifacts nor emits another event",
  )
  await assert.rejects(
    commitCycle(pg, job!, {
      ...options,
      artifacts: [{ ...artifacts[0]!, id: propertiesId }, ...artifacts.slice(1)],
    }),
    /completion replay/,
  )
  assert.deepEqual(await snapshot(), committed)

  await queuedJob(pg)
  const [otherJob] = await claim(pg, "worker-b")
  const beforeCollision = await snapshot()
  await assert.rejects(
    commitCycle(pg, otherJob!, { artifacts: [finalArtifacts[0]!, artifacts[0]!] }),
    /duplicate key value/,
  )
  assert.deepEqual(
    await snapshot(),
    beforeCollision,
    "existing IDs cannot be replaced by another job",
  )
  assert.deepEqual(await storedJob(pg, otherJob!.id), otherJob)
})

test("cycle reservation privileges and closed submission rework remain service-only", async (t) => {
  const pg = await migratedDatabase(t)
  const queued = await queuedJob(pg)
  const [job] = await claim(pg)
  for (const role of ["anon", "authenticated"]) {
    await pg.exec(`SET ROLE ${role}`)
    await assert.rejects(reserve(pg, job!), /permission denied/)
    await assert.rejects(commitCycle(pg, job!), /permission denied/)
    await pg.exec("RESET ROLE; SET ROLE service_role")
  }
  await commitCycle(pg, job!)
  await pg.query("UPDATE public.product_submissions SET status='rejected' WHERE id=$1", [
    queued.submission_id,
  ])
  await assert.rejects(
    pg.query("SELECT public.product_intake_request_rework_job($1)", [queued.submission_id]),
    /not open/,
  )
  assert.equal((await storedJob(pg, job!.id)).review_cycle_id, job!.review_cycle_id)
})
