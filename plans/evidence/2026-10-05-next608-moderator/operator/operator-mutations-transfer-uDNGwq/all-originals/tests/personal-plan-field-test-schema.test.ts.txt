import assert from "node:assert/strict"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

const migrationsDir = join(process.cwd(), "supabase/migrations")
const migrationPath = join(
  migrationsDir,
  readdirSync(migrationsDir).find((name) =>
    name.endsWith("_personal_plan_field_test_access.sql"),
  ) ?? "missing_personal_plan_field_test_access.sql",
)

const migration = readFileSync(migrationPath, "utf8").replace(/\s+/g, " ")

test("field-test schema is service-only and stores campaign credentials only as hashes", () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.personal_plan_test_campaigns/)
  assert.match(
    migration,
    /token_hash text NOT NULL UNIQUE CHECK \(token_hash ~ '\^\[0-9a-f\]\{64\}\$'\)/,
  )
  assert.match(
    migration,
    /status text NOT NULL DEFAULT 'active' CHECK \(status IN \('active', 'revoked'\)\)/,
  )
  assert.match(migration, /max_activations integer NOT NULL CHECK \(max_activations > 0\)/)
  assert.match(
    migration,
    /access_duration_hours integer NOT NULL CHECK \(access_duration_hours > 0\)/,
  )
  assert.match(migration, /expires_at > starts_at/)
  assert.match(
    migration,
    /ALTER TABLE public\.personal_plan_test_campaigns ENABLE ROW LEVEL SECURITY/,
  )
  assert.match(
    migration,
    /REVOKE ALL ON TABLE public\.personal_plan_test_campaigns FROM PUBLIC, anon, authenticated/,
  )
  assert.match(
    migration,
    /GRANT (?:SELECT, INSERT, UPDATE, DELETE|ALL) ON TABLE public\.personal_plan_test_campaigns TO service_role/,
  )
})

test("field-test enrollments bind the exact campaign, funnel, lead, guest, grant, and artifact", () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.personal_plan_test_enrollments/)
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
  assert.match(
    migration,
    /prepared_artifact_id uuid NOT NULL REFERENCES public\.personal_plan_prepared_artifacts\(id\) ON DELETE RESTRICT/,
  )
  assert.match(migration, /UNIQUE \(campaign_id, lead_id\)/)
  assert.match(
    migration,
    /status text NOT NULL DEFAULT 'active' CHECK \(status IN \('active', 'revoked'\)\)/,
  )
  assert.match(migration, /expires_at > activated_at/)
  assert.match(
    migration,
    /ALTER TABLE public\.personal_plan_test_enrollments ENABLE ROW LEVEL SECURITY/,
  )
  assert.match(
    migration,
    /REVOKE ALL ON TABLE public\.personal_plan_test_enrollments FROM PUBLIC, anon, authenticated/,
  )
  assert.match(
    migration,
    /GRANT (?:SELECT, INSERT, UPDATE, DELETE|ALL) ON TABLE public\.personal_plan_test_enrollments TO service_role/,
  )
  assert.match(
    migration,
    /REVOKE INSERT, UPDATE, DELETE ON TABLE public\.manual_access_grants FROM PUBLIC, anon, authenticated/,
  )
})

test("activation is a locked, private, service-role-only transaction with exact field-test correlations", () => {
  assert.match(migration, /CREATE SCHEMA IF NOT EXISTS private/)
  assert.match(migration, /CREATE OR REPLACE FUNCTION private\.activate_personal_plan_field_test\(/)
  assert.match(migration, /LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''/)
  assert.match(
    migration,
    /FROM public\.personal_plan_test_campaigns AS campaign_row[\s\S]*FOR UPDATE/,
  )
  assert.match(migration, /campaign\.status <> 'active'/)
  assert.match(migration, /campaign\.starts_at > activation_time/)
  assert.match(migration, /campaign\.expires_at <= activation_time/)
  assert.match(migration, /public\.personal_plan_test_enrollments AS enrollment/)
  assert.match(migration, /pg_catalog\.count\(\*\).*campaign\.max_activations/)
  assert.doesNotMatch(
    migration,
    /pg_catalog\.count\(\*\)[\s\S]{0,300}enrollment\.status = 'active'/,
  )
  assert.match(migration, /public\.funnel_sessions AS session/)
  assert.match(migration, /session\.package_key = 'meta_personal_plan_v1'/)
  assert.match(migration, /session\.lead_id = p_lead_id/)
  assert.match(migration, /session\.test_kind = 'field_test'/)
  assert.match(migration, /session\.field_test_campaign_id = p_campaign_id/)
  assert.match(migration, /public\.leads AS lead/)
  assert.match(migration, /lead\.quiz_kind = 'personal_plan'/)
  assert.match(migration, /lead\.user_id IS NULL OR lead\.user_id = p_user_id/)
  assert.match(migration, /UPDATE public\.leads AS lead[\s\S]*user_id = p_user_id/)
  assert.match(migration, /existing_enrollment\.expires_at <= activation_time/)
  assert.match(migration, /access_grant\.revoked_at IS NOT NULL/)
  assert.match(migration, /public\.personal_plan_prepared_artifacts AS artifact/)
  assert.match(migration, /artifact_row\.status = 'attached'/)
  assert.match(migration, /artifact\.user_id IS NOT NULL AND artifact\.user_id <> p_user_id/)
  assert.match(migration, /INSERT INTO public\.manual_access_grants/)
  assert.match(migration, /'tester'/)
  assert.match(migration, /INSERT INTO public\.personal_plan_test_enrollments/)
  assert.match(migration, /ON CONFLICT \(campaign_id, lead_id\) DO NOTHING/)
  assert.match(migration, /INSERT INTO public\.funnel_events/)
  assert.match(migration, /'field_test_activated'/)
  assert.match(
    migration,
    /REVOKE ALL ON FUNCTION private\.activate_personal_plan_field_test\([\s\S]*FROM PUBLIC, anon, authenticated/,
  )
  assert.match(
    migration,
    /GRANT EXECUTE ON FUNCTION private\.activate_personal_plan_field_test\([\s\S]*TO service_role/,
  )
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.activate_personal_plan_field_test\(/)
  assert.match(migration, /FROM private\.activate_personal_plan_field_test\(/)
  assert.match(
    migration,
    /REVOKE ALL ON FUNCTION public\.activate_personal_plan_field_test\([\s\S]*FROM PUBLIC, anon, authenticated/,
  )
  assert.match(
    migration,
    /GRANT EXECUTE ON FUNCTION public\.activate_personal_plan_field_test\([\s\S]*TO service_role/,
  )
  assert.match(
    migration,
    /CREATE OR REPLACE FUNCTION public\.bind_personal_plan_field_test_funnel\(/,
  )
  assert.match(migration, /FROM public\.funnel_sessions AS session/)
  assert.match(migration, /session\.package_key = 'meta_personal_plan_v1'/)
  assert.match(
    migration,
    /UPDATE public\.funnel_sessions AS session[\s\S]*test_kind = 'field_test'/,
  )
  assert.match(
    migration,
    /REVOKE ALL ON FUNCTION public\.bind_personal_plan_field_test_funnel\([\s\S]*FROM PUBLIC, anon, authenticated/,
  )
  assert.match(
    migration,
    /GRANT EXECUTE ON FUNCTION public\.bind_personal_plan_field_test_funnel\([\s\S]*TO service_role/,
  )
})

test("campaign revocation atomically ends enrollments and their tester grants", () => {
  assert.match(
    migration,
    /CREATE OR REPLACE FUNCTION public\.revoke_personal_plan_field_test_campaign/,
  )
  assert.match(migration, /UPDATE public\.personal_plan_test_campaigns AS campaign/)
  assert.match(migration, /UPDATE public\.manual_access_grants AS grant_row/)
  assert.match(migration, /UPDATE public\.personal_plan_test_enrollments AS enrollment/)
  assert.match(
    migration,
    /REVOKE ALL ON FUNCTION public\.revoke_personal_plan_field_test_campaign\(uuid\)[\s\S]*FROM PUBLIC, anon, authenticated/,
  )
  assert.match(
    migration,
    /GRANT EXECUTE ON FUNCTION public\.revoke_personal_plan_field_test_campaign\(uuid\)[\s\S]*TO service_role/,
  )
})
