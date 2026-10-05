/** Real two-session proof for the facts rebase (central user profile PR2, plan §8 task 4, R14):
 * a Feinschliff `reopen` INSERT (the statement `reopen` in
 * src/lib/personal-plan/persistence/stage2-refinement-supabase.ts issues, as raw SQL) racing
 * `personal_plan_rebase_on_facts_v1` on the disposable, network-less `postgres:17` proof container,
 * a fresh database built from the REAL migration chain (the `{ stage1Sources: true }` chain of the
 * PGlite harness: personal-plan foundation … 20260812143000 … 20260828104243 … user facts …
 * 20261003150000, then the user-facts lock), run with:
 * node --import ./tests/server-only-register.cjs --import tsx scripts/personal-plan/rebase-concurrency-proof.ts --run-local
 * Uses synthetic accounts. Never loads dotenv or secrets, never targets the active local stack or
 * a remote database.
 *
 * Acceptance per schedule: at most one in-progress refinement draft per (plan, base); no
 * unhandled error other than a unique violation (23505) on the losing INSERT or a deadlock
 * (40P01) that ONE retry of the rebase resolves (the lane's retry, plan §4a); afterwards the plan
 * is rebased with exactly one in-progress or complete `facts_rebase` clone on its current base.
 *
 * "Paused after its plan lock": the function's first lock is `personal_plans … FOR UPDATE`; the
 * proof takes that same lock in the rebase session's transaction first and calls the function
 * afterwards in the same transaction, which is the interleaving "the INSERT arrives after the
 * rebase locked the plan, before it inserted the clone" made deterministic.
 */
import assert from "node:assert/strict"
import { createHash, randomUUID } from "node:crypto"
import { execFile, spawn } from "node:child_process"
import { readFile } from "node:fs/promises"
import { setTimeout as delay } from "node:timers/promises"
import { promisify } from "node:util"

import {
  PERSONAL_PLAN_STAGE1_SOURCE_STUB_PREREQUISITES,
  PERSONAL_PLAN_STUB_PREREQUISITES,
  personalPlanMigrationChain,
} from "../../tests/personal-plan-pglite-migration.fixtures"
import {
  applyProofLock,
  docker,
  dockerArgs,
  literal,
  proofContainer,
  proofSql,
  psqlArgs,
} from "../mobile/proof-database"

const exec = promisify(execFile)
const database = "rebase_concurrency_proof"
const runId = randomUUID().slice(0, 8)
const owners: string[] = []

/** A variant of `createProofDatabase` (scripts/mobile/proof-database.ts, unchanged): same
 * container guards, but the personal-plan chain WITH the Stage-1 source identity, the paid
 * migration admission and the rebase function, which the mobile chain does not include. */
async function createRebaseProofDatabase() {
  const inspected = JSON.parse(
    (await exec(docker, [...dockerArgs, "inspect", proofContainer])).stdout,
  )[0]
  assert.equal(inspected.HostConfig.NetworkMode, "none", "proof container must have no network")
  assert.equal(Object.keys(inspected.HostConfig.PortBindings ?? {}).length, 0)
  assert.equal(inspected.Config.Image, "postgres:17")
  if (!inspected.State.Running) {
    await exec(docker, [...dockerArgs, "start", proofContainer])
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const ready = await exec(docker, [
        ...dockerArgs,
        "exec",
        proofContainer,
        "pg_isready",
        "-U",
        "postgres",
      ]).then(
        () => true,
        () => false,
      )
      if (ready) break
      await delay(200)
    }
  }
  const admin = proofSql("postgres")
  await admin(`DROP DATABASE IF EXISTS ${database} WITH (FORCE);`)
  await admin(`CREATE DATABASE ${database};`)
  await admin(
    `DO $$ BEGIN ${["anon", "authenticated", "service_role"]
      .map(
        (role) =>
          `IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='${role}') THEN CREATE ROLE ${role}; END IF;`,
      )
      .join(" ")} END $$;`,
  )
  let stub = PERSONAL_PLAN_STUB_PREREQUISITES
  for (const line of [
    "CREATE ROLE anon;",
    "CREATE ROLE authenticated;",
    "CREATE ROLE service_role;",
  ]) {
    assert.ok(stub.includes(line), `stub drifted: ${line}`)
    stub = stub.replace(line, "")
  }
  const sql = proofSql(database)
  await sql(stub)
  await sql(PERSONAL_PLAN_STAGE1_SOURCE_STUB_PREREQUISITES)
  const root = new URL("../../", import.meta.url)
  const chain = personalPlanMigrationChain({ stage1Sources: true })
  for (const required of [
    "supabase/migrations/20260812143000_personal_plan_legacy_quiz_source.sql",
    "supabase/migrations/20260828104243_personal_plan_paid_migration_admission.sql",
    "supabase/migrations/20261003150000_personal_plan_rebase_on_facts.sql",
  ])
    assert.ok(chain.includes(required), `chain is missing ${required}`)
  for (const file of chain) await sql(await readFile(new URL(file, root), "utf8"))
  await applyProofLock(database)
  return chain
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

type SqlFailure = Error & { sqlstate: string | null }
function failure(stderr: string): SqlFailure {
  const error = new Error(stderr.trim().slice(0, 600)) as SqlFailure
  error.sqlstate = /ERROR:\s+([0-9A-Z]{5}):/.exec(stderr)?.[1] ?? null
  return error
}

function session(label: string, settings = "") {
  const child = spawn(docker, psqlArgs(database), { stdio: ["pipe", "pipe", "pipe"] })
  let stdout = "",
    stderr = ""
  const done = new Promise<string>((resolve, reject) => {
    child.once("error", reject)
    child.once("exit", (code) => (code === 0 ? resolve(stdout.trim()) : reject(failure(stderr))))
  })
  done.catch(() => undefined)
  child.stdout.on("data", (chunk) => (stdout += chunk.toString()))
  child.stderr.on("data", (chunk) => (stderr += chunk.toString()))
  child.stdin.write(
    `\\set VERBOSITY verbose\nSET application_name=${literal(label)};SET statement_timeout='30s';${settings}\n`,
  )
  return {
    done,
    write(query: string) {
      child.stdin.write(query + "\n")
    },
    end(query = "") {
      child.stdin.end(query + "\n")
      return done
    },
    async waitFor(marker: string) {
      const deadline = Date.now() + 15000
      let failed: unknown
      done.catch((error) => (failed = error))
      while (!stdout.includes(marker)) {
        if (failed) throw failed
        if (Date.now() > deadline) throw new Error(`${label}: marker ${marker} not reached`)
        await delay(30)
      }
    },
  }
}

async function sql(query: string, label = `rebase-proof-${runId}-monitor`) {
  return session(label).end(query)
}

async function observeBlocked(label: string) {
  const deadline = Date.now() + 15000
  while (Date.now() < deadline) {
    const waiting = await sql(
      `SELECT count(*) FROM pg_stat_activity WHERE application_name=${literal(label)} AND wait_event_type='Lock' AND cardinality(pg_blocking_pids(pid))>0;`,
    )
    if (waiting === "1") return
    await delay(30)
  }
  throw new Error(`did not observe ${label} blocked on a PostgreSQL lock`)
}

const lastJson = (output: string) =>
  JSON.parse(
    output
      .split("\n")
      .filter((line) => line.startsWith("{"))
      .at(-1)!,
  )

// ---------------------------------------------------------------------------
// Fixture plan + the lane's rebase call
// ---------------------------------------------------------------------------

const hashOf = (seed: string) => createHash("sha256").update(seed).digest("hex")

type Owner = {
  userId: string
  planId: string
  initialA: string
  hashA: string
  sourceDraft: string
}

/** Profile, legacy lead, initial A, facts, and a refinement draft D on A that published R_A
 * (`complete` via the terminal RPC, or `in_progress` with a `habits` module projection). */
async function seedOwner(sourceShape: "complete" | "in_progress"): Promise<Owner> {
  const userId = randomUUID(),
    leadId = randomUUID(),
    draftId = randomUUID()
  owners.push(userId)
  const hashA = hashOf(`initial-A-${userId}`)
  await sql(
    `INSERT INTO public.profiles(id) VALUES(${literal(userId)});
     INSERT INTO public.leads(id,email,quiz_kind,status,user_id) VALUES(${literal(leadId)},${literal(`${userId}@example.test`)},'legacy','linked',${literal(userId)});`,
  )
  const initial = lastJson(
    await sql(
      `SELECT public.personal_plan_create_or_reuse_initial_need(${literal(userId)}::uuid, NULL, NULL, 1, 'v1', ${literal(hashA)}, '{"a":1}'::jsonb, '{"b":1}'::jsonb, 'legacy_quiz_lead', ${literal(leadId)}::uuid);`,
    ),
  )
  assert.equal(initial.outcome, "completed")
  const facts = lastJson(
    await sql(
      `SELECT public.user_facts_save_v1(p_user_id => ${literal(userId)}::uuid, p_domain => 'diagnostics', p_patch => '{"texture":"wavy"}'::jsonb, p_provenance => ${literal({ source: { kind: "profile_edit", id: "edit-1" }, schemaVersion: 1, at: "2026-10-03T10:00:00.000Z" })}::jsonb);`,
    ),
  )
  assert.equal(facts.status, "ok")
  await sql(
    `INSERT INTO public.personal_plan_refinement_drafts(id,user_id,personal_plan_id,base_initial_need_version_id,schema_version,answers,completed_question_ids,revision) VALUES(${[draftId, userId, initial.personalPlanId, initial.needVersionId].map(literal).join(",")},1,'{}','{}',0);`,
  )
  const published = lastJson(
    await sql(
      sourceShape === "complete"
        ? `SELECT public.personal_plan_complete_refinement_draft(${literal(userId)}::uuid, ${literal(initial.personalPlanId)}::uuid, ${literal(draftId)}::uuid, 0, 1, 'v1', ${literal(hashOf(`refined-A-${userId}`))}, '{"x":1}'::jsonb, '{"y":1}'::jsonb);`
        : `SELECT public.personal_plan_complete_stage2_module(${literal(userId)}::uuid, ${literal(initial.personalPlanId)}::uuid, ${literal(draftId)}::uuid, 'habits', 0, 1, 'v1', ${literal(hashOf(`refined-A-${userId}`))}, '{"x":1}'::jsonb, '{"y":1}'::jsonb);`,
    ),
  )
  assert.equal(published.outcome, "completed")
  return {
    userId,
    planId: initial.personalPlanId,
    initialA: initial.needVersionId,
    hashA,
    sourceDraft: draftId,
  }
}

type LaneState = {
  revision: number
  factsRevision: number
  currentInitial: string
  source: { id: string; revision: number; base: string; schemaVersion: number } | null
}

/** What the lane reloads before each attempt (the source exactly as `loadExistingFromSource`). */
async function loadState(owner: Owner): Promise<LaneState> {
  return lastJson(
    await sql(`SELECT jsonb_build_object(
      'revision', p.revision, 'factsRevision', h.facts_revision, 'currentInitial', p.current_initial_need_version_id,
      'source', (SELECT jsonb_build_object('id', d.id, 'revision', d.revision, 'base', d.base_initial_need_version_id, 'schemaVersion', d.schema_version)
                   FROM public.personal_plan_refinement_drafts d
                  WHERE d.personal_plan_id = p.id AND d.base_initial_need_version_id = p.current_initial_need_version_id
                    AND d.status IN ('in_progress','complete')
                  ORDER BY (d.status = 'in_progress') DESC, d.updated_at DESC, d.id DESC LIMIT 1))
      FROM public.personal_plans p JOIN public.hair_profiles h ON h.user_id = p.user_id WHERE p.id = ${literal(owner.planId)};`),
  )
}

type Target = { initialId: string; hash: string; label: string }

function rebaseSql(owner: Owner, state: LaneState, target: Target) {
  assert.ok(state.source, "every schedule has a source draft")
  const args: Array<[string, string]> = [
    ["p_user_id", `${literal(owner.userId)}::uuid`],
    ["p_personal_plan_id", `${literal(owner.planId)}::uuid`],
    ["p_expected_plan_revision", String(state.revision)],
    ["p_expected_facts_revision", String(state.factsRevision)],
    ["p_initial_id", `${literal(target.initialId)}::uuid`],
    ["p_schema_version", "1"],
    ["p_computation_version", "'v1'"],
    ["p_initial_input_hash", literal(target.hash)],
    ["p_initial_input_snapshot", `${literal({ facts: target.label })}::jsonb`],
    ["p_initial_output_snapshot", `${literal({ need: target.label })}::jsonb`],
    ["p_source_draft_id", `${literal(state.source.id)}::uuid`],
    ["p_expected_draft_revision", String(state.source.revision)],
    ["p_clone_answers", `'{"dryingMethod":"air_dry"}'::jsonb`],
    ["p_clone_completed_question_ids", `'{drying_method}'::text[]`],
    ["p_clone_answer_provenance", `'{"drying_method":"user"}'::jsonb`],
    [
      "p_care_habits_patch",
      `'{"towel":{"material":"mikrofaser","technique":"gentle_press"}}'::jsonb`,
    ],
    [
      "p_care_habits_provenance",
      `${literal({ source: { kind: "feinschliff_draft", id: state.source.id }, schemaVersion: 1, at: "2026-10-03T11:00:00.000Z" })}::jsonb`,
    ],
    ["p_refined_schema_version", "1"],
    ["p_refined_computation_version", "'v1'"],
    ["p_refined_input_hash", literal(hashOf(`refined-${target.label}-${owner.userId}`))],
    ["p_refined_input_snapshot", `'{"r":1}'::jsonb`],
    ["p_refined_output_snapshot", `'{"o":1}'::jsonb`],
  ]
  return `SELECT public.personal_plan_rebase_on_facts_v1(${args.map(([k, v]) => `${k} => ${v}`).join(", ")});`
}

const RETRYABLE_STATUSES = new Set([
  "plan_revision_conflict",
  "facts_revision_conflict",
  "draft_conflict",
  "initial_conflict",
])

type Attempt = string
/** The lane: one call, and exactly ONE retry after a conflict status or 40P01 / 40001. */
async function laneRebase(
  owner: Owner,
  target: Target,
  firstAttempt?: () => Promise<{ status?: string } | SqlFailure>,
): Promise<{ attempts: Attempt[]; result: Record<string, unknown> }> {
  const attempts: Attempt[] = []
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let outcome: Record<string, unknown> | SqlFailure
    if (attempt === 0 && firstAttempt) outcome = (await firstAttempt()) as never
    else {
      const state = await loadState(owner)
      outcome = await sql(rebaseSql(owner, state, target), `rebase-proof-${runId}-lane`).then(
        lastJson,
        (error: SqlFailure) => error,
      )
    }
    if (outcome instanceof Error) {
      attempts.push(`error ${outcome.sqlstate}`)
      if (outcome.sqlstate === "40P01" || outcome.sqlstate === "40001") continue
      throw outcome
    }
    attempts.push(String(outcome.status))
    if (outcome.status === "rebased") return { attempts, result: outcome }
    if (RETRYABLE_STATUSES.has(String(outcome.status))) continue
    throw new Error(`unexpected rebase outcome ${JSON.stringify(outcome)}`)
  }
  throw new Error(`rebase not resolved by one retry: ${attempts.join(" -> ")}`)
}

/** The `reopen` INSERT, column for column (stage2-refinement-supabase.ts `reopen`). */
function reopenInsertSql(owner: Owner, base: string) {
  return `INSERT INTO public.personal_plan_refinement_drafts(user_id,personal_plan_id,base_initial_need_version_id,schema_version,answers,completed_question_ids,answer_provenance,revision) VALUES(${[owner.userId, owner.planId, base].map(literal).join(",")},1,'{"dryingMethod":"air_dry"}'::jsonb,'{drying_method}'::text[],'{"drying_method":"user"}'::jsonb,0)`
}

/** `reopen`'s own read-after-insert-error: the in-progress draft on the base it tried. */
async function reopenRacedRead(owner: Owner, base: string) {
  return sql(
    `SELECT coalesce(string_agg(id::text || ':' || coalesce(origin,'-'), ','), '<none>') FROM public.personal_plan_refinement_drafts WHERE personal_plan_id=${literal(owner.planId)} AND base_initial_need_version_id=${literal(base)} AND status='in_progress';`,
  )
}

async function assertInvariants(owner: Owner, target: Target) {
  const state = lastJson(
    await sql(`SELECT jsonb_build_object(
      'maxOpenPerBase', (SELECT coalesce(max(n),0) FROM (SELECT count(*) n FROM public.personal_plan_refinement_drafts WHERE personal_plan_id=${literal(owner.planId)} AND status='in_progress' GROUP BY base_initial_need_version_id) x),
      'currentInitial', (SELECT current_initial_need_version_id FROM public.personal_plans WHERE id=${literal(owner.planId)}),
      'refinedParent', (SELECT v.parent_need_version_id FROM public.personal_plans p JOIN public.personal_plan_need_versions v ON v.id=p.current_refined_need_version_id WHERE p.id=${literal(owner.planId)}),
      'clonesOnCurrentBase', (SELECT count(*) FROM public.personal_plan_refinement_drafts d JOIN public.personal_plans p ON p.id=d.personal_plan_id WHERE p.id=${literal(owner.planId)} AND d.base_initial_need_version_id=p.current_initial_need_version_id AND d.origin='facts_rebase' AND d.status IN ('in_progress','complete')),
      'openByBase', (SELECT coalesce(jsonb_object_agg(base, n), '{}') FROM (SELECT CASE WHEN base_initial_need_version_id=${literal(target.initialId)} THEN 'current' ELSE 'other' END AS base, count(*) n FROM public.personal_plan_refinement_drafts WHERE personal_plan_id=${literal(owner.planId)} AND status='in_progress' GROUP BY 1) y));`),
  )
  assert.ok(
    state.maxOpenPerBase <= 1,
    `more than one in-progress draft per (plan, base): ${JSON.stringify(state)}`,
  )
  assert.equal(state.currentInitial, target.initialId, "plan is rebased onto the target initial")
  assert.equal(state.refinedParent, target.initialId, "refined head sits on the current initial")
  assert.equal(
    state.clonesOnCurrentBase,
    1,
    "exactly one in-progress or complete clone on the current base",
  )
  return state as { openByBase: Record<string, number> }
}

const targetB = (): Target => ({
  initialId: randomUUID(),
  hash: hashOf(`initial-B-${randomUUID()}`),
  label: "B",
})

// ---------------------------------------------------------------------------
// Schedules
// ---------------------------------------------------------------------------

async function main() {
  assert.ok(process.argv.includes("--run-local"), "Explicit --run-local is required")
  const chain = await createRebaseProofDatabase()
  console.log("PostgreSQL rebase concurrency proof:", await sql("SHOW server_version;"))
  console.log(
    `Chain: ${chain.length} real migration files incl. 20260812143000, 20260828104243, 20261003150000; lock applied`,
  )
  try {
    // S1 — INSERT first (committed), then a rebase computed from the state read BEFORE it.
    {
      const owner = await seedOwner("complete")
      const target = targetB()
      const stale = await loadState(owner)
      await sql(reopenInsertSql(owner, owner.initialA) + ";")
      const run = await laneRebase(owner, target, () =>
        sql(rebaseSql(owner, stale, target)).then(lastJson, (e: SqlFailure) => e),
      )
      assert.deepEqual(run.attempts, ["draft_conflict", "rebased"])
      const state = await assertInvariants(owner, target)
      console.log(
        `PASS S1 insert-then-rebase: insert committed; rebase ${run.attempts.join(" -> ")} (the reopened draft became the source and was staled); open drafts ${JSON.stringify(state.openByBase)}`,
      )
    }

    // S2 — rebase first (committed), then the INSERT from a reopen that read the plan before it.
    {
      const owner = await seedOwner("complete")
      const target = targetB()
      const run = await laneRebase(owner, target)
      assert.deepEqual(run.attempts, ["rebased"])
      await sql(reopenInsertSql(owner, owner.initialA) + ";")
      const state = await assertInvariants(owner, target)
      assert.equal(state.openByBase.other, 1)
      console.log(
        `PASS S2 rebase-then-insert: rebase ${run.attempts.join(" -> ")}; the late insert lands on the OLD base (no error); open drafts ${JSON.stringify(state.openByBase)} — the stray is staled by the next rebase (R01)`,
      )
    }

    // S3 — INSERT left open in a transaction while the rebase starts.
    {
      const owner = await seedOwner("complete")
      const target = targetB()
      const insert = session(`rebase-proof-${runId}-s3-insert`)
      insert.write(`BEGIN;${reopenInsertSql(owner, owner.initialA)};SELECT 'INSERTED';`)
      await insert.waitFor("INSERTED")
      const state0 = await loadState(owner)
      const label = `rebase-proof-${runId}-s3-rebase`
      const pending = sql(rebaseSql(owner, state0, target), label).then(
        lastJson,
        (e: SqlFailure) => e,
      )
      await observeBlocked(label)
      await insert.end("COMMIT;")
      const run = await laneRebase(owner, target, () => pending)
      assert.deepEqual(run.attempts, ["draft_conflict", "rebased"])
      const state = await assertInvariants(owner, target)
      console.log(
        `PASS S3 open insert while rebase starts: rebase observed BLOCKED on the plan row (FK KEY SHARE vs FOR UPDATE); insert committed; rebase ${run.attempts.join(" -> ")}; open drafts ${JSON.stringify(state.openByBase)}`,
      )
    }

    // S4 — rebase paused after its plan lock while the INSERT starts.
    {
      const owner = await seedOwner("complete")
      const target = targetB()
      const state0 = await loadState(owner)
      const rebaseSession = session(`rebase-proof-${runId}-s4-rebase`)
      rebaseSession.write(
        `BEGIN;SELECT 1 FROM public.personal_plans WHERE id=${literal(owner.planId)} FOR UPDATE;SELECT 'PLAN_LOCKED';`,
      )
      await rebaseSession.waitFor("PLAN_LOCKED")
      const label = `rebase-proof-${runId}-s4-insert`
      const insert = sql(reopenInsertSql(owner, owner.initialA) + ";", label).then(
        () => "inserted",
        (e: SqlFailure) => e,
      )
      await observeBlocked(label)
      const run = await laneRebase(owner, target, () =>
        rebaseSession
          .end(`${rebaseSql(owner, state0, target)}\nCOMMIT;`)
          .then(lastJson, (e: SqlFailure) => e),
      )
      assert.equal(await insert, "inserted")
      assert.deepEqual(run.attempts, ["rebased"])
      const state = await assertInvariants(owner, target)
      assert.equal(state.openByBase.other, 1)
      console.log(
        `PASS S4 insert while rebase holds the plan lock: insert observed BLOCKED, rebase ${run.attempts.join(" -> ")}, then the insert landed on the OLD base; open drafts ${JSON.stringify(state.openByBase)} (R01 stray)`,
      )
    }

    // S5 — A→B→A with an in-progress clone: the INSERT on A (index entry already placed, waiting
    // on the plan row) and the clone insert on A (waiting on that index entry) deadlock.
    for (const variant of ["a", "b"] as const) {
      const owner = await seedOwner("in_progress")
      const toB = targetB()
      assert.deepEqual((await laneRebase(owner, toB)).attempts, ["rebased"])
      const backToA: Target = { initialId: owner.initialA, hash: owner.hashA, label: "A" }
      const state0 = await loadState(owner)
      const rebaseSession = session(`rebase-proof-${runId}-s5${variant}-rebase`)
      rebaseSession.write(
        `BEGIN;SELECT 1 FROM public.personal_plans WHERE id=${literal(owner.planId)} FOR UPDATE;SELECT 'PLAN_LOCKED';`,
      )
      await rebaseSession.waitFor("PLAN_LOCKED")
      const label = `rebase-proof-${runId}-s5${variant}-insert`
      // Variant b: the INSERT session waits 10s before running deadlock detection, so the rebase
      // (default 1s) is the session that detects the cycle and is aborted.
      const insertSession = session(label, variant === "b" ? "SET deadlock_timeout='10s';" : "")
      const insert = insertSession.end(reopenInsertSql(owner, owner.initialA) + ";").then(
        () => "inserted",
        (e: SqlFailure) => e,
      )
      await observeBlocked(label)
      const run = await laneRebase(owner, backToA, () =>
        rebaseSession
          .end(`${rebaseSql(owner, state0, backToA)}\nCOMMIT;`)
          .then(lastJson, (e: SqlFailure) => e),
      )
      const insertOutcome = await insert
      const insertLabel =
        insertOutcome instanceof Error ? `error ${insertOutcome.sqlstate}` : insertOutcome
      assert.ok(
        run.attempts.every((a) => a === "rebased" || a === "error 40P01"),
        `rebase attempts ${run.attempts.join(" -> ")}`,
      )
      assert.ok(
        insertLabel === "inserted" ||
          insertLabel === "error 40P01" ||
          insertLabel === "error 23505",
        `insert ${insertLabel}`,
      )
      assert.ok(
        run.attempts.includes("error 40P01") || insertLabel === "error 40P01",
        "the interleaving produced the deadlock it was built for",
      )
      const state = await assertInvariants(owner, backToA)
      const raced =
        insertOutcome instanceof Error ? await reopenRacedRead(owner, owner.initialA) : "-"
      console.log(
        `PASS S5${variant} A→B→A deadlock${variant === "b" ? " (insert deadlock_timeout=10s)" : " (default timeouts)"}: rebase ${run.attempts.join(" -> ")}; insert ${insertLabel}${insertOutcome instanceof Error ? `; reopen's raced read on A finds ${raced}` : ""}; open drafts ${JSON.stringify(state.openByBase)}`,
      )
    }

    // S6 — rebase back to A commits first; a late INSERT on A loses with a unique violation.
    {
      const owner = await seedOwner("in_progress")
      assert.deepEqual((await laneRebase(owner, targetB())).attempts, ["rebased"])
      const backToA: Target = { initialId: owner.initialA, hash: owner.hashA, label: "A" }
      assert.deepEqual((await laneRebase(owner, backToA)).attempts, ["rebased"])
      const insert = await sql(reopenInsertSql(owner, owner.initialA) + ";").then(
        () => "inserted",
        (e: SqlFailure) => `error ${e.sqlstate}`,
      )
      assert.equal(insert, "error 23505")
      const raced = await reopenRacedRead(owner, owner.initialA)
      assert.match(raced, /:facts_rebase$/)
      const state = await assertInvariants(owner, backToA)
      console.log(
        `PASS S6 A→B→A rebase-then-insert: late insert ${insert} (unique violation on the losing INSERT); reopen's raced read returns the clone (${raced.split(":")[1]}); open drafts ${JSON.stringify(state.openByBase)}`,
      )
    }
    console.log(
      "PASS all schedules: at most one in-progress draft per (plan, base); every rebase resolved within one lane retry",
    )
  } finally {
    if (owners.length) {
      console.log(
        "CLEANUP: the proof database is dropped and rebuilt on every run; nothing outside it was touched",
      )
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Local proof failed")
  process.exitCode = 1
})
