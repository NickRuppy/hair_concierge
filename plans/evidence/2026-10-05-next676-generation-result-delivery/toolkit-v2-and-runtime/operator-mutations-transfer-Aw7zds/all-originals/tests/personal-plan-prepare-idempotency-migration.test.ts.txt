import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { PGlite } from "@electric-sql/pglite"

const migrationPath = "supabase/migrations/20260901170000_personal_plan_prepare_idempotency.sql"
const rateLimitRetentionPath =
  "supabase/migrations/20260901170100_rate_limits_retention_schedule.sql"

const ids = {
  preparation: "11111111-1111-4111-8111-111111111111",
  otherPreparation: "22222222-2222-4222-8222-222222222222",
  user: "33333333-3333-4333-8333-333333333333",
  otherUser: "44444444-4444-4444-8444-444444444444",
  lead: "55555555-5555-4555-8555-555555555555",
}

const hash = (character: string) => character.repeat(64)

async function database(t: { after: (fn: () => Promise<void>) => void }) {
  const pg = new PGlite()
  t.after(() => pg.close())
  await pg.exec(`
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE ROLE service_role;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users (id uuid PRIMARY KEY);
    CREATE TABLE public.leads (id uuid PRIMARY KEY);
    CREATE TABLE public.personal_plan_prepared_artifacts (
      id uuid PRIMARY KEY,
      answer_hash text NOT NULL CHECK (answer_hash ~ '^[0-9a-f]{64}$'),
      claim_token_hash text NOT NULL UNIQUE CHECK (claim_token_hash ~ '^[0-9a-f]{64}$'),
      quiz_answers jsonb NOT NULL,
      canonical_profile jsonb NOT NULL,
      fallback_metadata jsonb NOT NULL,
      priorities jsonb NOT NULL,
      diagnostic_scores jsonb NOT NULL,
      public_offer_model jsonb NOT NULL,
      locked_plan jsonb NOT NULL,
      status text NOT NULL DEFAULT 'prepared' CHECK (status IN ('prepared', 'attached', 'superseded')),
      lead_id uuid REFERENCES public.leads(id),
      user_id uuid REFERENCES auth.users(id),
      superseded_by uuid,
      created_at timestamptz NOT NULL DEFAULT now(),
      expires_at timestamptz NOT NULL,
      attached_at timestamptz,
      user_attached_at timestamptz
    );
  `)
  await pg.exec(await readFile(migrationPath, "utf8"))
  return pg
}

const artifact = {
  p_id: ids.preparation,
  p_answer_hash: hash("a"),
  p_claim_token_hash: hash("b"),
  p_quiz_answers: { answers: { texture: "wavy" } },
  p_canonical_profile: { texture: "wavy" },
  p_fallback_metadata: {},
  p_priorities: [],
  p_diagnostic_scores: {},
  p_public_offer_model: {},
  p_locked_plan: {},
  p_user_id: null as string | null,
  p_expires_at: "2099-01-01T00:00:00.000Z",
}

async function prepare(
  pg: PGlite,
  values: Partial<typeof artifact> = {},
): Promise<{ artifact_id: string; artifact_expires_at: string; replayed: boolean }> {
  const input = { ...artifact, ...values }
  const result = await pg.query<{
    artifact_id: string
    artifact_expires_at: string
    replayed: boolean
  }>(
    `SELECT * FROM public.prepare_personal_plan_artifact(
      $1::uuid, $2::text, $3::text, $4::jsonb, $5::jsonb, $6::jsonb,
      $7::jsonb, $8::jsonb, $9::jsonb, $10::jsonb, $11::uuid, $12::timestamptz
    )`,
    [
      input.p_id,
      input.p_answer_hash,
      input.p_claim_token_hash,
      JSON.stringify(input.p_quiz_answers),
      JSON.stringify(input.p_canonical_profile),
      JSON.stringify(input.p_fallback_metadata),
      JSON.stringify(input.p_priorities),
      JSON.stringify(input.p_diagnostic_scores),
      JSON.stringify(input.p_public_offer_model),
      JSON.stringify(input.p_locked_plan),
      input.p_user_id,
      input.p_expires_at,
    ],
  )
  assert.equal(result.rows.length, 1)
  return result.rows[0]
}

test("preparation RPC inserts once and returns the exact replay receipt", async (t) => {
  const pg = await database(t)
  const first = await prepare(pg)
  const replay = await prepare(pg)

  assert.deepEqual(
    { ...first, artifact_expires_at: new Date(first.artifact_expires_at).toISOString() },
    {
      artifact_id: ids.preparation,
      artifact_expires_at: artifact.p_expires_at,
      replayed: false,
    },
  )
  assert.deepEqual(
    { ...replay, artifact_expires_at: new Date(replay.artifact_expires_at).toISOString() },
    {
      artifact_id: ids.preparation,
      artifact_expires_at: artifact.p_expires_at,
      replayed: true,
    },
  )
  const count = await pg.query<{ count: string }>(
    "SELECT count(*)::text AS count FROM public.personal_plan_prepared_artifacts",
  )
  assert.equal(count.rows[0].count, "1")
})

test("preparation RPC fails closed for mismatched replay authority", async (t) => {
  const pg = await database(t)
  await pg.query("INSERT INTO auth.users (id) VALUES ($1), ($2)", [ids.user, ids.otherUser])
  await prepare(pg, { p_user_id: ids.user })

  await assert.rejects(prepare(pg, { p_answer_hash: hash("c"), p_user_id: ids.user }))
  await assert.rejects(prepare(pg, { p_claim_token_hash: hash("d"), p_user_id: ids.user }))
  await assert.rejects(prepare(pg, { p_user_id: ids.otherUser }))
  await assert.rejects(
    prepare(pg, {
      p_id: ids.otherPreparation,
      p_claim_token_hash: artifact.p_claim_token_hash,
      p_user_id: ids.user,
    }),
  )
})

test("preparation RPC replays attached success but rejects an expired unclaimed artifact", async (t) => {
  const pg = await database(t)
  await prepare(pg)
  await pg.query("INSERT INTO public.leads (id) VALUES ($1)", [ids.lead])
  await pg.query(
    `UPDATE public.personal_plan_prepared_artifacts
        SET status = 'attached', lead_id = $2, attached_at = now(), expires_at = '2020-01-01T00:00:00Z'
      WHERE id = $1`,
    [ids.preparation, ids.lead],
  )
  assert.equal((await prepare(pg)).replayed, true)

  await pg.query(
    `UPDATE public.personal_plan_prepared_artifacts
        SET status = 'prepared', lead_id = NULL, attached_at = NULL
      WHERE id = $1`,
    [ids.preparation],
  )
  await assert.rejects(prepare(pg))
})

test("preparation RPC rejects a new artifact whose requested expiry is not in the future", async (t) => {
  const pg = await database(t)
  await assert.rejects(prepare(pg, { p_expires_at: "2020-01-01T00:00:00.000Z" }))
})

test("preparation RPC stays service-only and expired limiter windows are cleaned every five minutes", async () => {
  const migration = await readFile(migrationPath, "utf8")
  const retention = await readFile(rateLimitRetentionPath, "utf8")

  assert.match(
    migration,
    /REVOKE ALL ON FUNCTION public\.prepare_personal_plan_artifact[\s\S]+FROM PUBLIC, anon, authenticated/,
  )
  assert.match(
    migration,
    /GRANT EXECUTE ON FUNCTION public\.prepare_personal_plan_artifact[\s\S]+TO service_role/,
  )
  assert.match(retention, /cron\.unschedule\('cleanup_expired_rate_limits'\)/)
  assert.match(retention, /'\*\/5 \* \* \* \*'/)
  assert.match(retention, /SELECT public\.cleanup_expired_rate_limits\(\)/)
})
