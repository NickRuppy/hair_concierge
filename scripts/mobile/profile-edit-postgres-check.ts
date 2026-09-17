/** Disposable, network-isolated PostgreSQL proof. Never targets the active local stack. */
import assert from "node:assert/strict"
import { execFile, spawn } from "node:child_process"
import { promisify } from "node:util"
import { readFile } from "node:fs/promises"
import http from "node:http"
import { GET as editGET, POST as editPOST } from "../../src/app/api/mobile/v1/profile/edit/route"
import { publishProfileEdit, readScannerProfileSource } from "../../src/lib/scan/profile-edit"
import { prepareScannerContext, scannerSourceHash } from "../../src/lib/scan/scanner-context"
import {
  loadMobileProfileEdit,
  saveMobileProfileEdit,
} from "../../src/lib/mobile/profile-edit-service"
import { loadMobileProfile } from "../../src/lib/mobile/profile-service"
import { profileEditRequestSchema } from "../../src/lib/mobile/profile-edit-contract"
import { computeNeedPlan } from "../../src/lib/personal-plan/compute-stage1"
import { hashPersonalPlanNeedVersionInput } from "../../src/lib/personal-plan/persistence"
import { adaptPersonalPlanAnswersForOffer } from "../../src/lib/personal-plan-quiz/offer-adapter"
import { buildProfileDataFromQuizAnswers } from "../../src/lib/quiz/link-to-profile"
import { COMPLETE_V3_PLAN_ENVELOPE } from "../../tests/personal-plan/fixtures"
const exec = promisify(execFile)
const docker = "/opt/homebrew/bin/docker"
const dockerArgs = ["--host", "unix:///Users/nick/.colima/chaarlie/docker.sock"]
const container = "chaarlie-hosted-profile-proof"
const database = "profile_edit_proof"
const owner = "11111111-1111-4111-8111-111111111111"
const foreign = "22222222-2222-4222-8222-222222222222"
const literal = (value: unknown) =>
  value === null
    ? "NULL"
    : `'${(typeof value === "object" ? JSON.stringify(value) : String(value)).replaceAll("'", "''")}'`
const psqlArgs = [
  ...dockerArgs,
  "exec",
  "-i",
  container,
  "psql",
  "-U",
  "postgres",
  "-d",
  database,
  "-Atq",
  "-v",
  "ON_ERROR_STOP=1",
]
async function sql(query: string) {
  const child = spawn(docker, psqlArgs, { stdio: ["pipe", "pipe", "pipe"] })
  let out = "",
    err = ""
  child.stdout.on("data", (chunk) => (out += chunk))
  child.stderr.on("data", (chunk) => (err += chunk))
  child.stdin.end(query)
  await new Promise<void>((resolve, reject) => {
    child.on("error", reject)
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(err))))
  })
  return out.trim()
}
const calls: string[] = []
const rpcSignatures: Record<string, string[]> = {
  scanner_context_read_source: ["p_user_id"],
  scanner_context_publish: [
    "p_user_id",
    "p_expected_source_revision",
    "p_source_hash",
    "p_engine_version",
    "p_input_snapshot",
    "p_output_snapshot",
    "p_snapshot_source",
  ],
  scanner_profile_edit_receipt: ["p_user_id", "p_request_id", "p_request_hash"],
  scanner_profile_edit_publish: [
    "p_user_id",
    "p_request_id",
    "p_request_hash",
    "p_expected_profile_revision",
    "p_expected_source_revision",
    "p_patch",
    "p_quiz_answers",
    "p_source_hash",
    "p_engine_version",
    "p_input_snapshot",
    "p_output_snapshot",
    "p_snapshot_source",
  ],
}
const client = {
  async rpc(name: string, args: Record<string, unknown>) {
    calls.push(name)
    assert.ok(rpcSignatures[name])
    try {
      const raw = await sql(
        `SELECT public.${name}(${rpcSignatures[name].map((key) => literal(args[key])).join(",")});`,
      )
      return { data: raw ? JSON.parse(raw) : null, error: null }
    } catch (error) {
      return { data: null, error }
    }
  },
}
function heldTransaction(update: string) {
  const child = spawn(docker, psqlArgs, { stdio: ["pipe", "pipe", "pipe"] })
  let out = "",
    err = ""
  let resolveReady: () => void, rejectReady: (error: Error) => void
  const ready = new Promise<void>((resolve, reject) => {
    resolveReady = resolve
    rejectReady = reject
  })
  const done = new Promise<void>((resolve, reject) => {
    child.on("error", reject)
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(err))))
  })
  child.stdout.on("data", (chunk) => {
    out += chunk
    if (out.includes("PROFILE_PROOF_LOCKED")) resolveReady()
  })
  child.stderr.on("data", (chunk) => {
    err += chunk
    rejectReady(new Error(err))
  })
  child.stdin.write(`BEGIN;${update};SELECT 'PROFILE_PROOF_LOCKED';\n`)
  return {
    ready,
    async release() {
      child.stdin.end("COMMIT;\n")
      await done
    },
  }
}
async function main() {
  const inspected = JSON.parse(
    (await exec(docker, [...dockerArgs, "inspect", container])).stdout,
  )[0]
  assert.equal(inspected.HostConfig.NetworkMode, "none")
  assert.equal(Object.keys(inspected.HostConfig.PortBindings ?? {}).length, 0)
  assert.equal(inspected.Config.Image, "postgres:17")
  await exec(docker, [...dockerArgs, "exec", container, "createdb", "-U", "postgres", database])
  await sql(`DO $$ BEGIN IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF; IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF; IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role BYPASSRLS; END IF; END $$;CREATE SCHEMA auth;CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 CREATE TABLE profiles(id uuid PRIMARY KEY);
 CREATE TABLE hair_profiles(user_id uuid PRIMARY KEY REFERENCES profiles ON DELETE CASCADE,hair_texture text,thickness text,density text,hair_length text,cuticle_condition text,protein_moisture_balance text,scalp_type text,scalp_condition text,chemical_treatment text[],concerns text[],goals text[],desired_volume text,additional_notes text,updated_at timestamptz);
 CREATE TABLE leads(id uuid PRIMARY KEY,user_id uuid REFERENCES profiles ON DELETE CASCADE,quiz_kind text,quiz_answers jsonb);
 CREATE TABLE personal_plans(id uuid PRIMARY KEY,user_id uuid UNIQUE REFERENCES profiles ON DELETE CASCADE,revision bigint DEFAULT 0,current_initial_need_version_id uuid,current_refined_need_version_id uuid);
 CREATE TABLE personal_plan_need_versions(id uuid PRIMARY KEY,user_id uuid REFERENCES profiles ON DELETE CASCADE,personal_plan_id uuid,kind text,input_snapshot jsonb,output_snapshot jsonb,schema_version integer,computation_version text,input_hash text,parent_need_version_id uuid);
 CREATE TABLE personal_plan_refinement_drafts(id uuid PRIMARY KEY,user_id uuid REFERENCES profiles ON DELETE CASCADE,personal_plan_id uuid,answers jsonb);
 INSERT INTO profiles VALUES (${literal(owner)}),(${literal(foreign)});`)
  for (const name of [
    "20260916175235_hosted_mobile_scanner_context.sql",
    "20260916175239_hosted_mobile_profile_edit.sql",
  ])
    await sql(await readFile(new URL("../../supabase/migrations/" + name, import.meta.url), "utf8"))
  const fixture = JSON.parse(
    await readFile(
      new URL("../../tests/fixtures/mobile/profile-edit-v1.json", import.meta.url),
      "utf8",
    ),
  )
  await sql(
    `INSERT INTO hair_profiles VALUES (${literal(owner)},'wavy','fine','medium','long','rough','stretches_bounces','balanced',NULL,ARRAY['natural'],ARRAY['dryness'],ARRAY['less_volume'],'less','Do not lose lifestyle notes',now());INSERT INTO leads VALUES (${literal(owner)},${literal(owner)},'legacy',${literal(fixture.answers)});INSERT INTO personal_plans(id,user_id) VALUES (${literal(foreign)},${literal(owner)});`,
  )
  // Upgrade regression: an existing PR533 context lacks the newly persisted
  // explicit-question provenance. It must remain immutable and readable while
  // the new input schema publishes a distinct context at the same source clock.
  const oldSource = await readScannerProfileSource(client as never, owner)
  const oldPrepared = prepareScannerContext(oldSource)!
  const oldInput = {
    source: oldPrepared.source,
    userRefinementAnswers: oldPrepared.userRefinementAnswers,
    assumedQuestionIds: oldPrepared.assumedQuestionIds,
  }
  const oldPublished = await client.rpc("scanner_context_publish", {
    p_user_id: owner,
    p_expected_source_revision: oldSource.sourceRevision,
    p_source_hash: scannerSourceHash({
      ...oldInput,
      routine: oldPrepared.snapshot.profile.routine,
      engine: oldPrepared.snapshot.computationVersion,
    }),
    p_engine_version: oldPrepared.snapshot.computationVersion,
    p_input_snapshot: oldInput,
    p_output_snapshot: oldPrepared.snapshot,
    p_snapshot_source: oldPrepared.snapshotSource,
  })
  assert.equal(oldPublished.data?.outcome, "ready")
  const upgraded = await loadMobileProfile(client as never, owner)
  assert.equal(upgraded.status, "ready")
  if (upgraded.status === "ready")
    assert.notEqual(upgraded.contextRevision, oldPublished.data.contextRevision)
  const upgradeRepeat = await loadMobileProfile(client as never, owner)
  assert.equal(upgradeRepeat.status, "ready")
  if (upgraded.status === "ready" && upgradeRepeat.status === "ready")
    assert.equal(upgradeRepeat.contextRevision, upgraded.contextRevision)
  assert.equal(
    (await readScannerProfileSource(client as never, owner)).sourceRevision,
    oldSource.sourceRevision,
  )
  assert.deepEqual(
    JSON.parse(
      await sql(
        `SELECT input_snapshot FROM scanner_context_versions WHERE id=${literal(oldPublished.data.contextRevision)}`,
      ),
    ),
    oldInput,
  )
  const first = await loadMobileProfileEdit(client as never, owner)
  assert.equal(first.answers.thickness, "fine")
  assert.equal(first.questions.length, 10)
  const paidBefore = await sql("SELECT to_jsonb(p) FROM personal_plans p;")
  const input = profileEditRequestSchema.parse({
    expectedProfileRevision: first.profileRevision,
    requestId: "33333333-3333-4333-8333-333333333333",
    answers: {
      ...first.answers,
      thickness: "coarse",
      goals: ["manageability_styling"],
      concerns: ["low_shine"],
    },
  })
  const saved = await saveMobileProfileEdit(client as never, owner, input)
  assert.ok(saved.answers.some((row) => row.id === "thickness" && row.values[0] === "Dick"))
  assert.deepEqual(await saveMobileProfileEdit(client as never, owner, input), saved)
  const reloaded = await loadMobileProfileEdit(client as never, owner)
  assert.deepEqual(reloaded.answers.goals, ["manageability_styling"])
  assert.deepEqual(reloaded.answers.concerns, ["low_shine"])
  assert.equal(reloaded.answers.concerns_other_text, "Meine Spitzen")
  const profile = await loadMobileProfile(client as never, owner)
  assert.equal(profile.status, "ready")
  if (profile.status === "ready") {
    assert.equal(profile.context.snapshot.profile.hair.thickness, "coarse")
    assert.ok(
      profile.answers.some((row) => row.id === "goals" && row.values[0].includes("Styling")),
    )
  }
  assert.equal(
    await sql("SELECT additional_notes FROM hair_profiles;"),
    "Do not lose lifestyle notes",
  )
  assert.equal(await sql("SELECT to_jsonb(p) FROM personal_plans p;"), paidBefore)
  // A real second transaction owns the profile row and source clock. Native
  // source read waits for its commit, then rejects its original profile revision.
  const lock = heldTransaction(
    `UPDATE hair_profiles SET thickness='normal' WHERE user_id=${literal(owner)}`,
  )
  await lock.ready
  let finished = false
  const concurrent = publishProfileEdit(client as never, owner, {
    expectedProfileRevision: reloaded.profileRevision,
    requestId: "44444444-4444-4444-8444-444444444444",
    patch: { thickness: "fine" },
  }).then(
    () => {
      finished = true
      throw new Error("stale write accepted")
    },
    (error) => {
      finished = true
      assert.equal(error.code, "profile_conflict")
    },
  )
  let waited = false
  for (let attempt = 0; attempt < 30; attempt++) {
    if (
      Number(
        await sql(
          "SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock'",
        ),
      ) > 0
    ) {
      waited = true
      break
    }
    await new Promise((resolve) => setTimeout(resolve, 30))
  }
  assert.equal(waited, true, "actual PostgreSQL lock wait observed")
  assert.equal(finished, false)
  await lock.release()
  await concurrent
  assert.equal(await sql("SELECT thickness FROM hair_profiles;"), "normal")
  const revision = (await readScannerProfileSource(client as never, owner)).profileRevision
  const contenders = await Promise.allSettled(
    ["55555555-5555-4555-8555-555555555555", "66666666-6666-4666-8666-666666666666"].map(
      (requestId, index) =>
        publishProfileEdit(client as never, owner, {
          expectedProfileRevision: revision,
          requestId,
          patch: { thickness: index ? "fine" : "coarse" },
        }),
    ),
  )
  assert.equal(contenders.filter((item) => item.status === "fulfilled").length, 1)
  assert.equal(
    contenders.filter(
      (item) => item.status === "rejected" && item.reason.code === "profile_conflict",
    ).length,
    1,
  )
  assert.equal(await sql("SELECT to_jsonb(p) FROM personal_plans p;"), paidBefore)
  // Exercise the actual route + Supabase SDK against a loopback-only provider
  // transport fixture; domain writes still reach this real PostgreSQL instance.
  const provider = http.createServer(async (request, response) => {
    response.setHeader("content-type", "application/json")
    if (request.url === "/auth/v1/user") {
      const token = request.headers.authorization
      if (token !== "Bearer owner-fixture" && token !== "Bearer foreign-fixture") {
        response.writeHead(401)
        response.end(JSON.stringify({ msg: "Invalid JWT" }))
        return
      }
      response.end(
        JSON.stringify({
          id: token === "Bearer owner-fixture" ? owner : foreign,
          is_anonymous: false,
          aud: "authenticated",
        }),
      )
      return
    }
    const name = request.url?.replace("/rest/v1/rpc/", "") ?? ""
    const chunks: Buffer[] = []
    for await (const chunk of request) chunks.push(Buffer.from(chunk))
    if (name === "check_rate_limit") {
      response.end("true")
      return
    }
    const result = await client.rpc(name, JSON.parse(Buffer.concat(chunks).toString()))
    if (result.error) {
      response.writeHead(500)
      response.end(JSON.stringify({ message: "fixture database error" }))
      return
    }
    response.end(JSON.stringify(result.data))
  })
  await new Promise<void>((resolve) => provider.listen(0, "127.0.0.1", resolve))
  try {
    const address = provider.address()
    assert.ok(address && typeof address === "object")
    process.env.NEXT_PUBLIC_SUPABASE_URL = `http://127.0.0.1:${address.port}`
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "fixture-anon"
    process.env.SUPABASE_SERVICE_ROLE_KEY = "fixture-service"
    process.env.MOBILE_API_ENABLED = "true"
    process.env.MOBILE_AUTH_MODE = "local"
    process.env.MOBILE_AUTH_CALLBACK_URL = "chaarlie-local://auth"
    const get = () =>
      new Request("http://localhost/api/mobile/v1/profile/edit", {
        headers: { authorization: "Bearer owner-fixture" },
      })
    const post = (body: unknown, token = "owner-fixture") =>
      new Request("http://localhost/api/mobile/v1/profile/edit", {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify(body),
      })
    const getResponse = await editGET(get())
    assert.equal(getResponse.status, 200)
    assert.equal(getResponse.headers.get("cache-control"), "no-store")
    const editable = await getResponse.json()
    const body = {
      expectedProfileRevision: editable.profileRevision,
      requestId: "77777777-7777-4777-8777-777777777777",
      answers: { ...editable.answers, thickness: "normal" },
    }
    assert.equal((await editPOST(post({ ...body, userId: foreign }))).status, 400)
    assert.equal(
      (await editPOST(post({ ...body, answers: { ...body.answers, scalp_type: "invented" } })))
        .status,
      400,
    )
    assert.equal((await editPOST(post(body, "bad-token"))).status, 401)
    assert.equal(
      (
        await editGET(
          new Request("http://localhost/api/mobile/v1/profile/edit?platform=ios", {
            headers: { cookie: "fixture" },
          }),
        )
      ).status,
      401,
    )
    const response = await editPOST(post(body))
    assert.equal(response.status, 200)
    const value = await response.json()
    assert.ok(value.contextRevision)
    assert.equal(
      value.answers.find((row: { id: string }) => row.id === "thickness").values[0],
      "Mittel",
    )
    assert.deepEqual(await (await editPOST(post(body))).json(), value)
    assert.equal(
      (await editPOST(post({ ...body, requestId: "88888888-8888-4888-8888-888888888888" }))).status,
      409,
    )
    assert.equal(
      (
        await editGET(
          new Request("http://localhost/api/mobile/v1/profile/edit", {
            headers: { authorization: "Bearer foreign-fixture" },
          }),
        )
      ).status,
      403,
    )
    process.env.MOBILE_API_ENABLED = "false"
    assert.equal((await editGET(get())).status, 404)
  } finally {
    provider.closeAllConnections()
    await new Promise<void>((resolve, reject) =>
      provider.close((error) => (error ? reject(error) : resolve())),
    )
  }
  // Paid-source edit must round-trip the exact immutable context, independent
  // of the old paid pointer, without changing either paid row.
  const paidOwner = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
  const paidPlan = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
  const paidNeed = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
  const envelope = COMPLETE_V3_PLAN_ENVELOPE
  const computed = computeNeedPlan({
    rawEnvelope: envelope,
    artifactId: paidNeed,
    projection: "initial_quiz",
    computationVersion: "stage1-v1",
    createdAt: "1970-01-01T00:00:00.000Z",
  })
  assert.equal(computed.status, "ready")
  if (computed.status !== "ready") throw new Error("paid proof fixture")
  const paidRaw = adaptPersonalPlanAnswersForOffer(envelope.answers).answers
  const paidProfile = {
    ...buildProfileDataFromQuizAnswers(paidRaw),
    goals: paidRaw.goals,
    user_id: paidOwner,
  }
  const paidHash = hashPersonalPlanNeedVersionInput({
    schemaVersion: 1,
    computationVersion: "stage1-v1",
    inputSnapshot: envelope,
  })
  await sql(`INSERT INTO profiles VALUES (${literal(paidOwner)});
    INSERT INTO hair_profiles SELECT * FROM jsonb_populate_record(NULL::hair_profiles,${literal(paidProfile)});
    INSERT INTO personal_plans(id,user_id,current_initial_need_version_id) VALUES (${literal(paidPlan)},${literal(paidOwner)},${literal(paidNeed)});
    INSERT INTO personal_plan_need_versions(id,user_id,personal_plan_id,kind,input_snapshot,output_snapshot,schema_version,computation_version,input_hash) VALUES (${literal(paidNeed)},${literal(paidOwner)},${literal(paidPlan)},'initial',${literal(envelope)},${literal(computed.snapshot)},1,'stage1-v1',${literal(paidHash)});`)
  const paidRows = () =>
    sql(
      `SELECT jsonb_build_object('plan',(SELECT to_jsonb(p) FROM personal_plans p WHERE id=${literal(paidPlan)}),'need',(SELECT to_jsonb(n) FROM personal_plan_need_versions n WHERE id=${literal(paidNeed)}));`,
    )
  const paidOriginal = await paidRows()
  const paidEdit = await loadMobileProfileEdit(client as never, paidOwner)
  const paidSaved = await saveMobileProfileEdit(
    client as never,
    paidOwner,
    profileEditRequestSchema.parse({
      expectedProfileRevision: paidEdit.profileRevision,
      requestId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      answers: { ...paidEdit.answers, thickness: "coarse" },
    }),
  )
  const paidReload = await loadMobileProfile(client as never, paidOwner)
  assert.equal(paidReload.status, "ready")
  if (paidReload.status === "ready") {
    assert.equal(paidReload.contextRevision, paidSaved.contextRevision)
    assert.equal(paidReload.context.snapshot.profile.hair.thickness, "coarse")
  }
  assert.equal(await paidRows(), paidOriginal)
  console.log(
    "PASS: real PostgreSQL old-context upgrade/repeat, free+paid atomic edit/reload, exact response-loss retry, nonquiz/paid preservation, observed two-session web lock conflict, simultaneous native save single winner. " +
      calls.length +
      " actual RPC calls; actual mobile GET/POST + SDK transport auth, strict body, cross-owner/flag gating, success/replay/conflict.",
  )
}
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
