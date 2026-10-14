import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import { randomBytes } from "node:crypto"
import { PGlite } from "@electric-sql/pglite"
import { repairReturningPersonalPlanArtifact } from "../src/lib/personal-plan-quiz/return-artifact-repair"

const lead = "11111111-1111-4111-8111-111111111111"
const user = "22222222-2222-4222-8222-222222222222"
const other = "33333333-3333-4333-8333-333333333333"
const envelope = {
  kind: "personal_plan",
  version: 3,
  answers: {
    texture: "curly",
    thickness: "fine",
    density: "low",
    goals: ["moisture"],
    routineClarity: "trial_and_error",
    resultReliability: "rarely",
    adaptationConfidence: "no",
    currentConcerns: ["dry_lengths"],
    hairLength: "long",
    hairSurface: "rough",
    elasticResponse: "stretches_bounces",
    chemicalTreatments: ["lightened"],
    scalpOiliness: "balanced",
    scalpConcerns: [],
    previousAttempts: "some_steps_helped",
    blockers: ["product_fit"],
    routineStyle: "simple_reliable",
    meaningfulMoment: "everyday",
  },
}
const input = (quizAnswers: unknown = envelope) => ({ leadId: lead, userId: user, quizAnswers })

test("repair builds server artifact and preserves exact v2/v3 envelope without migration", async () => {
  for (const version of [2, 3]) {
    const snapshot = { ...envelope, version }
    const result = await repairReturningPersonalPlanArtifact(input(snapshot), {
      rpc: async (name, args) => {
        assert.equal(name, "repair_return_personal_plan_artifact")
        assert.deepEqual(args.p_expected_quiz_answers, snapshot)
        assert.equal((args.p_canonical_profile as any).hair_length, "long")
        assert.match(args.p_answer_hash as string, /^[a-f0-9]{64}$/)
        return { data: [{ status: "repaired", artifact_id: other }], error: null }
      },
    })
    assert.deepEqual(result, { status: "repaired", artifactId: other })
  }
})

test("repair refuses missing context and ambiguous historical concerns without a write", async () => {
  const { routineStyle: _, ...partial } = envelope.answers
  for (const answers of [
    partial,
    { ...envelope.answers, currentConcerns: ["breakage_or_split_ends"] },
  ]) {
    assert.deepEqual(
      await repairReturningPersonalPlanArtifact(input({ ...envelope, answers }), {
        rpc: async () => {
          assert.fail("invalid reconstruction must not write")
        },
      }),
      { status: "cannot_reconstruct" },
    )
  }
})

test("repair preserves conflict, forbidden, and unavailable outcomes", async () => {
  for (const status of ["conflict", "forbidden"]) {
    assert.deepEqual(
      await repairReturningPersonalPlanArtifact(input(), {
        rpc: async () => ({ data: [{ status }], error: null }),
      }),
      { status },
    )
  }
  assert.deepEqual(
    await repairReturningPersonalPlanArtifact(input(), {
      rpc: async () => ({ data: null, error: { code: "23505" } }),
    }),
    { status: "conflict" },
  )
  assert.deepEqual(
    await repairReturningPersonalPlanArtifact(input(), {
      rpc: async () => {
        throw new Error("offline")
      },
    }),
    { status: "unavailable" },
  )
})

const migration = readFileSync(
  "supabase/migrations/20260918182402_repair_return_personal_plan_artifact.sql",
  "utf8",
)
const baseMigration = readFileSync(
  "supabase/migrations/20260728130000_add_personal_plan_prepared_artifacts.sql",
  "utf8",
)

test("SQL repair is service-only, CAS guarded, immutable, and idempotent", async (t) => {
  const db = new PGlite()
  t.after(() => db.close())
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE TABLE public.leads(id uuid PRIMARY KEY, user_id uuid, quiz_kind text, quiz_answers jsonb);
    CREATE TABLE public.personal_plan_need_versions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, prepared_artifact_source_id uuid);
    INSERT INTO auth.users VALUES ('${user}'),('${other}');
    GRANT SELECT, UPDATE ON public.leads TO service_role;
    GRANT SELECT, INSERT ON public.personal_plan_need_versions TO service_role;
  `)
  // Real prepared-artifact DDL, indexes, constraints and permissions.
  await db.exec(baseMigration)
  await db.exec(migration)
  for (const key of [
    "texture",
    "thickness",
    "density",
    "hairLength",
    "hairSurface",
    "elasticResponse",
    "scalpOiliness",
    "goals",
    "chemicalTreatments",
  ] as const) {
    const valid = await db.query<{ valid: boolean }>(
      "SELECT public.personal_plan_return_fact_valid($1,$2::jsonb) valid",
      [key, JSON.stringify(envelope.answers[key])],
    )
    assert.equal(valid.rows[0].valid, true, key)
    for (const value of [null, {}, [], "unsupported"]) {
      const invalid = await db.query<{ valid: boolean }>(
        "SELECT public.personal_plan_return_fact_valid($1,$2::jsonb) valid",
        [key, JSON.stringify(value)],
      )
      assert.equal(invalid.rows[0].valid, false, `${key}: ${JSON.stringify(value)}`)
    }
  }
  for (const [key, value] of [
    ["goals", ["moisture", "moisture"]],
    ["chemicalTreatments", ["natural", "colored"]],
    ["routineStyle", "simple_reliable"],
  ] as const) {
    const invalid = await db.query<{ valid: boolean }>(
      "SELECT public.personal_plan_return_fact_valid($1,$2::jsonb) valid",
      [key, JSON.stringify(value)],
    )
    assert.equal(invalid.rows[0].valid, false)
  }
  await db.query("INSERT INTO public.leads VALUES($1,$2,'personal_plan',$3)", [
    lead,
    user,
    envelope,
  ])
  let args: Record<string, unknown> = {}
  await repairReturningPersonalPlanArtifact(input(), {
    rpc: async (_name, payload) => {
      args = payload
      return { data: null, error: null }
    },
  })
  const call = (overrides: Record<string, unknown> = {}) => {
    const payload = { ...args, p_claim_token_hash: randomBytes(32).toString("hex"), ...overrides }
    return db.query<{ status: string; artifact_id: string }>(
      `SELECT * FROM public.repair_return_personal_plan_artifact(${Object.keys(payload)
        .map((key, i) => `${key} => $${i + 1}`)
        .join(",")})`,
      Object.values(payload),
    )
  }
  for (const role of ["anon", "authenticated"]) {
    await db.exec(`SET ROLE ${role}`)
    await assert.rejects(call(), /permission denied/)
    await db.exec("RESET ROLE")
  }
  await db.exec("SET ROLE service_role")
  assert.equal((await call({ p_user_id: other })).rows[0].status, "forbidden")
  assert.equal((await call({ p_expected_quiz_answers: {} })).rows[0].status, "conflict")
  const first = (await call()).rows[0]
  assert.equal(first.status, "repaired")
  const replay = (await call()).rows[0]
  assert.deepEqual(replay, { status: "already_present", artifact_id: first.artifact_id })
  assert.equal((await call({ p_answer_hash: "f".repeat(64) })).rows[0].status, "conflict")
  await db.exec("RESET ROLE")
  await db.query("UPDATE public.personal_plan_prepared_artifacts SET user_id=$1", [other])
  assert.equal((await call()).rows[0].status, "conflict")
  await db.query("UPDATE public.personal_plan_prepared_artifacts SET user_id=$1", [user])
  await db.query("UPDATE public.leads SET quiz_answers=$1", [{ ...envelope, version: 2 }])
  assert.equal((await call()).rows[0].status, "conflict")
  const rows = await db.query<{ n: number }>(
    "SELECT count(*)::integer AS n FROM public.personal_plan_prepared_artifacts",
  )
  assert.equal(rows.rows[0].n, 1)

  await db.query("UPDATE public.leads SET quiz_answers=$1", [envelope])
  // A complete valid fact is immutable even if the lead was edited elsewhere.
  await db.query("UPDATE public.personal_plan_prepared_artifacts SET quiz_answers=$1", [
    { ...envelope, answers: { ...envelope.answers, hairLength: "short" } },
  ])
  assert.equal((await call()).rows[0].status, "conflict")
  await db.query("UPDATE public.personal_plan_prepared_artifacts SET quiz_answers=$1", [
    { ...envelope, answers: { ...envelope.answers, routineStyle: "intentional_caring" } },
  ])
  assert.equal((await call()).rows[0].status, "conflict")
  const { hairLength: _length, ...missingAnswers } = envelope.answers
  const predecessor = { ...envelope, answers: { ...missingAnswers, texture: "invalid-old-value" } }
  await db.query(
    "UPDATE public.personal_plan_prepared_artifacts SET quiz_answers=$1, answer_hash=$2",
    [predecessor, "c".repeat(64)],
  )
  await db.query(
    "INSERT INTO personal_plan_need_versions(user_id,prepared_artifact_source_id) VALUES($1,$2)",
    [user, first.artifact_id],
  )
  assert.equal((await call()).rows[0].status, "conflict")
  await db.exec("DELETE FROM personal_plan_need_versions")
  // Historical artifact may be unclaimed; exact lead ownership still required.
  await db.exec(
    "UPDATE personal_plan_prepared_artifacts SET user_id=NULL, attached_at=now()-interval '2 days'",
  )
  await db.exec("SET ROLE service_role")
  const repaired = (await call()).rows[0]
  assert.equal(repaired.status, "repaired")
  assert.notEqual(repaired.artifact_id, first.artifact_id)
  assert.deepEqual((await call()).rows[0], {
    status: "already_present",
    artifact_id: repaired.artifact_id,
  })
  await db.exec("RESET ROLE")
  const history = await db.query<{
    quiz_answers: unknown
    superseded_by: string
    retained_for_return_repair: boolean
    status: string
  }>(
    "SELECT quiz_answers,superseded_by,retained_for_return_repair,status FROM personal_plan_prepared_artifacts WHERE id=$1",
    [first.artifact_id],
  )
  assert.deepEqual(history.rows[0], {
    quiz_answers: predecessor,
    superseded_by: repaired.artifact_id,
    retained_for_return_repair: true,
    status: "superseded",
  })
  await db.exec("SELECT public.purge_expired_personal_plan_artifacts(100)")
  assert.equal(
    (
      await db.query<{ n: number }>(
        "SELECT count(*)::integer n FROM personal_plan_prepared_artifacts",
      )
    ).rows[0].n,
    2,
  )
  await assert.rejects(
    db.query(
      "INSERT INTO personal_plan_need_versions(user_id,prepared_artifact_source_id) VALUES($1,$2)",
      [user, first.artifact_id],
    ),
    /not an attached owner source/,
  )
  await db.query(
    "INSERT INTO personal_plan_need_versions(user_id,prepared_artifact_source_id) VALUES($1,$2)",
    [user, repaired.artifact_id],
  )
})
