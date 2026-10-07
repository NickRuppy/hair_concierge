/** Real two-session proof on the REAL migration chain (clean-switch task 7B: ported from a
 * pre-prepared local stack and the removed `p_patch` signature to the disposable, network-less
 * `postgres:17` proof container, a fresh database, and the lock applied):
 * node --import ./tests/server-only-register.cjs --import tsx scripts/mobile/registration-concurrency-proof.ts --run-local
 * Uses synthetic accounts. Never loads dotenv or secrets, never targets the active local stack.
 */
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { spawn } from "node:child_process"
import { setTimeout as delay } from "node:timers/promises"
import { completeMobileRegistration } from "../../src/lib/mobile/registration-completion"
import {
  registrationSubmissionHash,
  type RegistrationSubmission,
} from "../../src/lib/mobile/registration-contract"
import { createProofDatabase, docker, literal, namedCallSql, psqlArgs } from "./proof-database"

const database = "registration_proof"
const baseArgs = psqlArgs(database)
const runId = randomUUID().slice(0, 8)
const owners: string[] = []
/** The RPCs this proof may call (named-argument notation: no signature list to drift). */
const allowedRpcs = new Set([
  "scanner_context_read_source",
  "mobile_registration_publication_receipt",
  "mobile_registration_publish",
])
function rpcSQL(name: string, args: Record<string, unknown>) {
  assert.ok(allowedRpcs.has(name), "unapproved fixture RPC")
  return namedCallSql(name, args)
}
function connection(label: string) {
  const child = spawn(docker, baseArgs, { stdio: ["pipe", "pipe", "pipe"] })
  let stdout = "",
    stderr = ""
  const done = new Promise<string>((resolve, reject) => {
    child.once("error", reject)
    child.once("exit", (code) =>
      code === 0
        ? resolve(stdout.trim())
        : reject(new Error(`Local proof SQL failed (${code}): ${stderr.slice(0, 1200)}`)),
    )
  })
  child.stdout.on("data", (chunk) => (stdout += chunk.toString()))
  child.stderr.on("data", (chunk) => (stderr += chunk.toString()))
  child.stdin.write(`SET application_name=${literal(label)};SET statement_timeout='20s';\n`)
  return {
    child,
    done,
    get output() {
      return stdout
    },
  }
}
async function sql(query: string, label = `registration-proof-${runId}-monitor`) {
  const c = connection(label)
  c.child.stdin.end(query + "\n")
  return c.done
}
function client(label: string) {
  return {
    async rpc(name: string, args: Record<string, unknown>) {
      try {
        const data = await sql(rpcSQL(name, args), label)
        return { data: data ? JSON.parse(data) : null, error: null }
      } catch (error) {
        return { data: null, error }
      }
    },
  }
}
async function hold(query: string, label: string) {
  const c = connection(label)
  c.child.stdin.write(`BEGIN;${query};SELECT 'REGISTRATION_LOCK_HELD';\n`)
  // Attach a handler immediately, including failures before the marker.
  let failure: unknown
  c.done.catch((e) => {
    failure = e
  })
  const deadline = Date.now() + 15000
  while (!c.output.includes("REGISTRATION_LOCK_HELD")) {
    if (failure) throw failure
    if (Date.now() > deadline) {
      c.child.stdin.end("ROLLBACK;\n")
      await c.done
      throw new Error("Local holder readiness timeout")
    }
    await delay(40)
  }
  return {
    async release(commit = true) {
      c.child.stdin.end(commit ? "COMMIT;\n" : "ROLLBACK;\n")
      await c.done
    },
  }
}
async function observeBlocked(labels: string[]) {
  const deadline = Date.now() + 15000
  while (Date.now() < deadline) {
    const count = Number(
      await sql(
        `SELECT count(*) FROM pg_stat_activity WHERE application_name IN (${labels.map(literal).join(",")}) AND wait_event_type='Lock' AND cardinality(pg_blocking_pids(pid))>0 AND query LIKE '%mobile_registration_publish(%';`,
      ),
    )
    if (count === labels.length) return
    await delay(40)
  }
  throw new Error(
    `Did not observe all ${labels.length} publication sessions blocked on PostgreSQL locks`,
  )
}
const answers: RegistrationSubmission["answers"] = {
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
async function seedOwner() {
  const userId = randomUUID(),
    email = `native-race-${randomUUID()}@example.test`
  owners.push(userId)
  // The stub `profiles` stands in for the Auth-trigger row (the real Auth schema is not part of
  // the migration chain).
  await sql(`INSERT INTO public.profiles(id) VALUES(${literal(userId)});`)
  return { userId, email }
}
async function intent(
  account: Awaited<ReturnType<typeof seedOwner>>,
  choice: "create" | "replace" = "create",
  thickness: "fine" | "normal" | "coarse" = "fine",
) {
  const submission: RegistrationSubmission = {
    requestId: randomUUID(),
    answers: { ...answers, thickness },
    firstName: "Synthetic Race",
    email: account.email,
    marketingOptIn: false,
  }
  const attemptId = randomUUID(),
    sendGeneration = randomUUID()
  // The provider proof is deliberately a synthetic prerequisite. This script
  // tests publication, not provider verification or intent-start supersession.
  await sql(
    `INSERT INTO public.mobile_registration_intents(id,request_id,request_hash,email,send_generation,provider_user_id,verified_user_id,verified_at) VALUES(${[attemptId, submission.requestId, registrationSubmissionHash(submission), account.email, sendGeneration, account.userId, account.userId].map(literal).join(",")},now());`,
  )
  const source = JSON.parse(
    await sql(`SELECT public.scanner_context_read_source(${literal(account.userId)});`),
  )
  return {
    attemptId,
    sendGeneration,
    submission,
    choice,
    expectedProfileRevision: source.profileRevision as string,
  }
}
async function state(userId: string) {
  return JSON.parse(
    await sql(`SELECT jsonb_build_object(
 'profiles',(SELECT count(*) FROM public.hair_profiles WHERE user_id=${literal(userId)}),
 'leads',(SELECT count(*) FROM public.leads WHERE user_id=${literal(userId)}),
 'edits',(SELECT count(*) FROM public.scanner_profile_edits WHERE user_id=${literal(userId)}),
 'contexts',(SELECT count(*) FROM public.scanner_context_versions WHERE user_id=${literal(userId)}),
 'receipts',(SELECT count(*) FROM public.mobile_registration_publication_receipts WHERE user_id=${literal(userId)}),
 'enrollments',(SELECT count(*) FROM public.mobile_registration_enrollments WHERE user_id=${literal(userId)} AND ready_at IS NOT NULL),
 'completed',(SELECT count(*) FROM public.mobile_registration_intents WHERE verified_user_id=${literal(userId)} AND completed_at IS NOT NULL AND completion_receipt IS NOT NULL),
 'paidPlans',(SELECT count(*) FROM public.personal_plans WHERE user_id=${literal(userId)}),
 'paidNeeds',(SELECT count(*) FROM public.personal_plan_need_versions WHERE user_id=${literal(userId)}),
 'thickness',(SELECT thickness FROM public.hair_profiles WHERE user_id=${literal(userId)}));`),
  )
}
function assertAtomic(s: Awaited<ReturnType<typeof state>>, publications: number) {
  assert.equal(s.profiles, 1)
  assert.equal(s.leads, publications)
  assert.equal(s.edits, 1)
  assert.equal(s.contexts, publications)
  assert.equal(s.receipts, publications)
  assert.equal(s.enrollments, 1)
  assert.equal(s.completed, publications)
  assert.equal(s.paidPlans, 0)
  assert.equal(s.paidNeeds, 0)
}
async function concurrent(
  account: Awaited<ReturnType<typeof seedOwner>>,
  inputs: Array<Awaited<ReturnType<typeof intent>>>,
  label: string,
) {
  const labels = inputs.map((_, i) => `registration-proof-${runId}-${label}-${i}`)
  const blocker = await hold(
    `SELECT pg_advisory_xact_lock(hashtextextended('mobile_registration_owner:'||${literal(account.userId)},0))`,
    `registration-proof-${runId}-${label}-holder`,
  )
  const pending = inputs.map((input, i) =>
    completeMobileRegistration(client(labels[i]) as never, account.userId, account.email, input),
  )
  const results = Promise.allSettled(pending)
  try {
    await observeBlocked(labels)
  } finally {
    await blocker.release()
  }
  return results
}
async function main() {
  assert.ok(process.argv.includes("--run-local"), "Explicit --run-local is required")
  await createProofDatabase(database, { lock: true })
  assert.equal(
    await sql(
      "SELECT count(*) > 0 FROM pg_proc WHERE proname='mobile_registration_publish' AND 'p_facts'=ANY(proargnames) AND 'p_quiz_taken_at'=ANY(proargnames);",
    ),
    "t",
    "the clean-switch registration publisher (p_facts, p_quiz_taken_at) is installed",
  )
  console.log("PostgreSQL publication proof:", await sql("SHOW server_version;"))
  try {
    const same = await seedOwner(),
      sameInput = await intent(same)
    const repeated = await concurrent(same, [sameInput, sameInput], "same")
    assert.equal(repeated[0].status, "fulfilled")
    assert.equal(repeated[1].status, "fulfilled")
    if (repeated[0].status === "fulfilled" && repeated[1].status === "fulfilled")
      assert.deepEqual(repeated[0].value, repeated[1].value)
    assertAtomic(await state(same.userId), 1)
    const replay = await completeMobileRegistration(
      client("registration-proof-replay") as never,
      same.userId,
      same.email,
      sameInput,
    )
    if (repeated[0].status === "fulfilled") assert.deepEqual(replay, repeated[0].value)
    console.log(
      "PASS same-request creates: both observed blocked, identical receipt, exactly one profile/lead/context/receipt/enrollment, response-loss replay",
    )

    const competing = await seedOwner(),
      createA = await intent(competing),
      createB = await intent(competing, "create", "coarse")
    const created = await concurrent(competing, [createA, createB], "create")
    assert.equal(created.filter((r) => r.status === "fulfilled").length, 1)
    assert.equal(
      created.filter((r) => r.status === "rejected" && r.reason.code === "profile_conflict").length,
      1,
    )
    assertAtomic(await state(competing.userId), 1)
    console.log(
      "PASS independent creates: both observed blocked, exactly one winner, no losing consent/lead/receipt/enrollment write",
    )

    const replaceA = await intent(competing, "replace", "normal"),
      replaceB = await intent(competing, "replace", "coarse")
    const replaced = await concurrent(competing, [replaceA, replaceB], "replace")
    assert.equal(replaced.filter((r) => r.status === "fulfilled").length, 1)
    assert.equal(
      replaced.filter((r) => r.status === "rejected" && r.reason.code === "profile_conflict")
        .length,
      1,
    )
    const after = await state(competing.userId)
    assertAtomic(after, 2)
    assert.equal(after.thickness, replaced[0].status === "fulfilled" ? "normal" : "coarse")
    console.log(
      "PASS independent replacements: one CAS winner, one conflict, exact winner profile, one additional publication",
    )

    const webInput = await intent(competing, "replace", "fine")
    let prepared: Record<string, unknown> | undefined
    const capture = {
      async rpc(name: string, args: Record<string, unknown>) {
        if (name === "mobile_registration_publish") {
          prepared = args
          return {
            data: { outcome: "ready", profileRevision: "0", contextRevision: randomUUID() },
            error: null,
          }
        }
        return client("registration-proof-prepare").rpc(name, args)
      },
    }
    await completeMobileRegistration(capture as never, competing.userId, competing.email, webInput)
    assert.ok(prepared)
    const web = await hold(
      `UPDATE public.hair_profiles SET additional_notes='Synthetic concurrent web write' WHERE user_id=${literal(competing.userId)}`,
      `registration-proof-${runId}-web-holder`,
    )
    const label = `registration-proof-${runId}-web-publication`
    const pending = sql(rpcSQL("mobile_registration_publish", prepared), label)
    let result: string
    try {
      await observeBlocked([label])
    } finally {
      await web.release()
    }
    result = await pending
    assert.equal(JSON.parse(result).outcome, "profile_conflict")
    assert.deepEqual(await state(competing.userId), after)
    assert.equal(
      await sql(
        `SELECT additional_notes FROM public.hair_profiles WHERE user_id=${literal(competing.userId)};`,
      ),
      "Synthetic concurrent web write",
    )
    console.log(
      "PASS concurrent web update: publisher observed waiting on row lock, then stale-revision conflict; web value preserved, zero publication side effects",
    )
    console.log(
      "PASS all publication cases: no paid plan/need writes. Provider/signup/email proof is outside this script.",
    )
  } finally {
    if (owners.length) {
      const ids = owners.map(literal).join(",")
      await sql(
        `DELETE FROM public.leads WHERE user_id IN (${ids});DELETE FROM public.mobile_registration_intents WHERE provider_user_id IN (${ids}) OR verified_user_id IN (${ids});DELETE FROM public.profiles WHERE id IN (${ids});`,
      )
      assert.equal(await sql(`SELECT count(*) FROM public.profiles WHERE id IN (${ids});`), "0")
      console.log(
        "CLEANUP: only this run's synthetic accounts/intents/leads removed (the proof database is rebuilt on every run)",
      )
    }
  }
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Local proof failed")
  process.exitCode = 1
})
