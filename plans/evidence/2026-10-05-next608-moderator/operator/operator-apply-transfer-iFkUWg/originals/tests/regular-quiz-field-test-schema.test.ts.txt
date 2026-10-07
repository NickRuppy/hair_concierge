import assert from "node:assert/strict"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

const migrationsDir = join(process.cwd(), "supabase/migrations")
const migrationPath = join(
  migrationsDir,
  readdirSync(migrationsDir).find((name) => name.endsWith("_regular_quiz_field_test_access.sql")) ??
    "missing_regular_quiz_field_test_access.sql",
)
const migration = readFileSync(migrationPath, "utf8").replace(/\s+/g, " ")

test("regular quiz campaigns are flow-scoped without changing Personal Plan defaults", () => {
  assert.match(
    migration,
    /ADD COLUMN IF NOT EXISTS flow_kind text NOT NULL DEFAULT 'personal_plan' CHECK \(flow_kind IN \('personal_plan', 'regular_quiz'\)\)/,
  )
  assert.match(migration, /prevent_field_test_campaign_flow_kind_change/)
})

test("regular quiz enrollments are service-only and do not require a Personal Plan artifact", () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.regular_quiz_test_enrollments/)
  assert.match(
    migration,
    /campaign_id uuid NOT NULL REFERENCES public\.personal_plan_test_campaigns\(id\) ON DELETE RESTRICT/,
  )
  assert.match(
    migration,
    /funnel_session_id uuid NOT NULL REFERENCES public\.funnel_sessions\(id\) ON DELETE RESTRICT/,
  )
  assert.match(migration, /lead_id uuid NOT NULL REFERENCES public\.leads\(id\) ON DELETE RESTRICT/)
  assert.match(migration, /user_id uuid NOT NULL REFERENCES auth\.users\(id\) ON DELETE RESTRICT/)
  assert.match(
    migration,
    /manual_access_grant_id uuid NOT NULL REFERENCES public\.manual_access_grants\(id\) ON DELETE RESTRICT/,
  )
  assert.match(migration, /UNIQUE \(campaign_id, lead_id\)/)
  assert.doesNotMatch(
    migration.match(
      /CREATE TABLE IF NOT EXISTS public\.regular_quiz_test_enrollments[\s\S]*?\);/,
    )?.[0] ?? "",
    /prepared_artifact_id/,
  )
  assert.match(
    migration,
    /ALTER TABLE public\.regular_quiz_test_enrollments ENABLE ROW LEVEL SECURITY/,
  )
  assert.match(
    migration,
    /REVOKE ALL ON TABLE public\.regular_quiz_test_enrollments FROM PUBLIC, anon, authenticated/,
  )
  assert.match(
    migration,
    /GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public\.regular_quiz_test_enrollments TO service_role/,
  )
})

test("regular quiz RPCs are service-only and enforce exact legacy/default-organic correlations", () => {
  assert.match(
    migration,
    /CREATE OR REPLACE FUNCTION public\.bind_regular_quiz_field_test_funnel\(/,
  )
  assert.match(migration, /campaign\.flow_kind <> 'regular_quiz'/)
  assert.match(migration, /session\.package_key = 'default_organic'/)
  assert.match(migration, /lead\.quiz_kind = 'legacy'/)
  assert.match(migration, /CREATE OR REPLACE FUNCTION private\.activate_regular_quiz_field_test\(/)
  assert.match(
    migration,
    /FROM public\.regular_quiz_test_enrollments AS enrollment[\s\S]*FOR UPDATE/,
  )
  assert.match(migration, /pg_catalog\.count\(\*\).*campaign\.max_activations/)
  assert.match(migration, /UPDATE public\.leads AS lead[\s\S]*user_id = p_user_id/)
  assert.match(
    migration,
    /UPDATE public\.funnel_sessions AS session[\s\S]*user_id = COALESCE\(session\.user_id, p_user_id\)/,
  )
  assert.match(migration, /'field_test_activated'/)
  assert.match(
    migration,
    /INSERT INTO public\.manual_access_grants \(user_id, reason, expires_at\)[\s\S]*VALUES \(p_user_id, 'tester', enrollment_expiry\)/,
  )
  const newGrantPath =
    migration.match(
      /enrollment_expiry :=[\s\S]*?INSERT INTO public\.manual_access_grants \(user_id, reason, expires_at\)/,
    )?.[0] ?? ""
  assert.doesNotMatch(newGrantPath, /FROM public\.manual_access_grants/)
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.activate_regular_quiz_field_test\(/)
  assert.match(
    migration,
    /REVOKE ALL ON FUNCTION public\.bind_regular_quiz_field_test_funnel\([\s\S]*FROM PUBLIC, anon, authenticated/,
  )
  assert.match(
    migration,
    /GRANT EXECUTE ON FUNCTION public\.bind_regular_quiz_field_test_funnel\([\s\S]*TO service_role/,
  )
  assert.match(
    migration,
    /REVOKE ALL ON FUNCTION public\.activate_regular_quiz_field_test\([\s\S]*FROM PUBLIC, anon, authenticated/,
  )
  assert.match(
    migration,
    /GRANT EXECUTE ON FUNCTION public\.activate_regular_quiz_field_test\([\s\S]*TO service_role/,
  )
})

test("campaign revocation branches by flow and revokes regular grants and enrollments", () => {
  assert.match(migration, /campaign_state\.flow_kind = 'personal_plan'/)
  assert.match(migration, /campaign_state\.flow_kind = 'regular_quiz'/)
  assert.match(migration, /FROM public\.regular_quiz_test_enrollments AS enrollment/)
  assert.match(migration, /UPDATE public\.regular_quiz_test_enrollments AS enrollment/)
})
