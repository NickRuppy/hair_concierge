/** Real two-session proof. Hard-pinned to the disposable registration stack.
 * Run only after the owner has started/prepared that local stack:
 * node --import ./tests/server-only-register.cjs --import tsx scripts/mobile/registration-concurrency-proof.ts --run-local
 * Uses synthetic accounts and exact-owner cleanup. Never loads dotenv or secrets.
 */
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { execFile, spawn } from "node:child_process"
import { promisify } from "node:util"
import { setTimeout as delay } from "node:timers/promises"
import { completeMobileRegistration } from "../../src/lib/mobile/registration-completion"
import {
  registrationSubmissionHash,
  type RegistrationSubmission,
} from "../../src/lib/mobile/registration-contract"

const docker = "/opt/homebrew/bin/docker"
const container = "supabase_db_ios-registration-local-proof"
const context = ["--context", "colima-chaarlie"]
const baseArgs = [
  ...context,
  "exec",
  "-i",
  container,
  "psql",
  "-X",
  "-U",
  "postgres",
  "-d",
  "postgres",
  "-Atq",
  "-v",
  "ON_ERROR_STOP=1",
]
const run = promisify(execFile)
const runId = randomUUID().slice(0, 8)
const owners: string[] = []
const literal = (value: unknown): string =>
  value === null || value === undefined
    ? "NULL"
    : `'${(typeof value === "object" ? JSON.stringify(value) : String(value)).replaceAll("'", "''")}'`
const signatures: Record<string, string[]> = {
  scanner_context_read_source: ["p_user_id"],
  mobile_registration_publication_receipt: [
    "p_user_id",
    "p_request_id",
    "p_request_hash",
    "p_mode",
    "p_attempt_id",
    "p_send_generation",
    "p_email",
    "p_submission_hash",
  ],
  mobile_registration_publish: [
    "p_user_id",
    "p_request_id",
    "p_request_hash",
    "p_mode",
    "p_attempt_id",
    "p_send_generation",
    "p_email",
    "p_submission_hash",
    "p_expected_profile_revision",
    "p_expected_source_revision",
    "p_patch",
    "p_quiz_answers",
    "p_lead_id",
    "p_submission",
    "p_source_hash",
    "p_engine_version",
    "p_input_snapshot",
    "p_output_snapshot",
    "p_snapshot_source",
  ],
}
function rpcSQL(name: string, args: Record<string, unknown>) {
  assert.ok(signatures[name], "unapproved fixture RPC")
  return `SELECT public.${name}(${signatures[name].map((k) => literal(args[k])).join(",")});`
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
  await sql(
    `INSERT INTO auth.users(id,email,aud,role,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) VALUES(${literal(userId)},${literal(email)},'authenticated','authenticated',now(),'{"provider":"email","providers":["email"]}','{}',now(),now());`,
  )
  assert.equal(
    await sql(`SELECT count(*) FROM public.profiles WHERE id=${literal(userId)};`),
    "1",
    "real Auth insert trigger establishes shared profile",
  )
  return { userId, email }
}
async function intent(
  account: Awaited<ReturnType<typeof seedOwner>>,
  choice: "create" | "replace" = "create",
  thickness = "fine",
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
  const inspection = JSON.parse((await run(docker, [...context, "inspect", container])).stdout)[0]
  assert.equal(inspection.Name, "/" + container)
  const ports = inspection.NetworkSettings.Ports["5432/tcp"] as Array<{ HostPort: string }>
  assert.ok(
    ports.some((p) => p.HostPort === "56322"),
    "Refuse any database except isolated port56322",
  )
  assert.ok(!ports.some((p) => p.HostPort === "54322"))
  assert.equal(
    await sql(
      "SELECT to_regprocedure('public.mobile_registration_publish(uuid,uuid,text,text,uuid,uuid,text,text,bigint,bigint,jsonb,jsonb,uuid,jsonb,text,text,jsonb,jsonb,text)') IS NOT NULL;",
    ),
    "t",
    "parent must prepare real schema first",
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
        `DELETE FROM public.leads WHERE user_id IN (${ids});DELETE FROM public.mobile_registration_intents WHERE provider_user_id IN (${ids}) OR verified_user_id IN (${ids});DELETE FROM auth.users WHERE id IN (${ids});`,
      )
      assert.equal(await sql(`SELECT count(*) FROM public.profiles WHERE id IN (${ids});`), "0")
      console.log(
        "CLEANUP: only this run's synthetic accounts/intents/leads removed; parent provider fixtures untouched",
      )
    }
  }
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Local proof failed")
  process.exitCode = 1
})
