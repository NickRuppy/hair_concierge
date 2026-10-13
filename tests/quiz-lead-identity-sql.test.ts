// PUB-3, security audit 2026-10-09, minimal fix ruled by Nick 2026-10-12.
import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import test from "node:test"
import { PGlite } from "@electric-sql/pglite"

const migration = "supabase/migrations/20261012153530_quiz_lead_identity_policy.sql"
async function database() {
  const db = new PGlite()
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth; CREATE TABLE auth.users (id uuid DEFAULT gen_random_uuid(), email text);
    CREATE TABLE public.profiles (id uuid DEFAULT gen_random_uuid(), email text);
    CREATE TABLE public.leads (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text, email text, marketing_consent boolean, quiz_answers jsonb, quiz_kind text, status text, created_at timestamptz DEFAULT now());
    CREATE TABLE public.personal_plan_prepared_artifacts (id uuid PRIMARY KEY, claim_token_hash text, answer_hash text, quiz_answers jsonb, status text, expires_at timestamptz, lead_id uuid, superseded_by uuid, attached_at timestamptz, created_at timestamptz DEFAULT now());`)
  const original = readFileSync(
    "supabase/migrations/20260728130000_add_personal_plan_prepared_artifacts.sql",
    "utf8",
  )
  await db.exec(
    original.slice(
      original.indexOf("CREATE OR REPLACE FUNCTION public.save_personal_plan_lead_with_artifact("),
      original.indexOf("CREATE OR REPLACE FUNCTION public.link_personal_plan_artifact_to_user("),
    ),
  )
  await db.exec(
    readFileSync("supabase/migrations/20260801100000_customerio_profile_sync_outbox.sql", "utf8"),
  )
  if (existsSync(migration)) await db.exec(readFileSync(migration, "utf8"))
  return db
}

test("PUB-3 admin lookup recognizes normalized auth/profile/any-kind historic lead emails", async () => {
  const db = await database()
  try {
    const fn = await db.query<{ fn: string | null }>(
      "SELECT to_regprocedure('public.is_known_quiz_lead_email(text)')::text AS fn",
    )
    assert.ok(fn.rows[0].fn, "known-email lookup must exist")
    for (const table of ["auth.users", "public.profiles", "public.leads"]) {
      await db.exec(
        table === "public.leads"
          ? "INSERT INTO public.leads (email, quiz_kind, created_at) VALUES ('  Known@Example.com ', 'personal_plan', now() - interval '1 year')"
          : `INSERT INTO ${table} (email) VALUES ('  Known@Example.com ');`,
      )
      assert.equal(
        (
          await db.query<{ known: boolean }>(
            "SELECT public.is_known_quiz_lead_email(' KNOWN@example.com ') AS known",
          )
        ).rows[0].known,
        true,
      )
      await db.exec(`DELETE FROM ${table}`)
    }
    assert.equal(
      (
        await db.query<{ known: boolean }>(
          "SELECT public.is_known_quiz_lead_email('new@example.com') AS known",
        )
      ).rows[0].known,
      false,
    )
    for (const role of ["anon", "authenticated"]) {
      assert.equal(
        (
          await db.query<{ allowed: boolean }>(
            `SELECT has_function_privilege('${role}', 'public.is_known_quiz_lead_email(text)', 'EXECUTE') AS allowed`,
          )
        ).rows[0].allowed,
        false,
      )
    }
    assert.equal(
      (
        await db.query<{ allowed: boolean }>(
          "SELECT has_function_privilege('service_role', 'public.is_known_quiz_lead_email(text)', 'EXECUTE') AS allowed",
        )
      ).rows[0].allowed,
      true,
    )
  } finally {
    await db.close()
  }
})

for (const mode of ["new", "known", "authenticated", "dedupe", "artifact-replay"] as const) {
  test(`PUB-3 personal-plan ${mode}: save persists identity policy and protects existing consent`, async () => {
    const db = await database()
    try {
      const answers = JSON.stringify({ kind: "personal_plan", version: 3, answers: {} })
      const artifactId = "11111111-1111-4111-8111-111111111111"
      await db.query(
        "INSERT INTO personal_plan_prepared_artifacts (id,claim_token_hash,answer_hash,quiz_answers,status,expires_at) VALUES ($1,'token','hash',$2,'prepared',now()+interval '1 day')",
        [artifactId, answers],
      )
      if (mode === "dedupe" || mode === "artifact-replay" || mode === "authenticated") {
        await db.query(
          "INSERT INTO leads (id,email,marketing_consent,quiz_answers,quiz_kind) VALUES ('22222222-2222-4222-8222-222222222222','known@example.com',false,$1,'personal_plan')",
          [answers],
        )
        if (mode === "artifact-replay")
          await db.exec(
            "UPDATE personal_plan_prepared_artifacts SET status='attached', lead_id='22222222-2222-4222-8222-222222222222'",
          )
      }
      const allowed = mode === "new" || mode === "authenticated"
      const extra = existsSync(migration) ? ", $3, $4" : ""
      const result = await db.query<{ lead_id: string }>(
        `SELECT * FROM save_personal_plan_lead_with_artifact('known@example.com',true,$1,$2,'token','hash'${extra})`,
        existsSync(migration)
          ? [answers, artifactId, allowed, mode === "authenticated"]
          : [answers, artifactId],
      )
      const saved = await db.query<{ marketing_consent: boolean }>(
        "SELECT marketing_consent FROM leads WHERE id=$1",
        [result.rows[0].lead_id],
      )
      assert.equal(saved.rows[0].marketing_consent, mode !== "dedupe" && mode !== "artifact-replay")
      const policy = await db.query<Record<string, unknown>>(
        "SELECT * FROM customerio_profile_sync_outbox WHERE lead_id=$1",
        [result.rows[0].lead_id],
      )
      assert.equal(policy.rows[0].identity_traits_allowed, allowed)
    } finally {
      await db.close()
    }
  })
}
