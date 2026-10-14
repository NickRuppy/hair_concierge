import assert from "node:assert/strict"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

const migrationsDir = join(process.cwd(), "supabase/migrations")
const migrationPath = join(
  migrationsDir,
  readdirSync(migrationsDir).find((name) =>
    name.endsWith("_personal_plan_moderator_email_bound_access.sql"),
  ) ?? "missing_personal_plan_moderator_email_bound_access.sql",
)
const migration = readFileSync(migrationPath, "utf8").replace(/\s+/g, " ")

test("moderator migration adds email-bound roster state without changing guest defaults", () => {
  assert.match(
    migration,
    /ADD COLUMN IF NOT EXISTS identity_mode text NOT NULL DEFAULT 'guest' CHECK \(identity_mode IN \('guest', 'email_bound'\)\)/,
  )
  assert.match(migration, /access_duration_hours = 2160/)
  assert.match(migration, /flow_kind = 'personal_plan'/)
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.personal_plan_test_members/)
  assert.match(migration, /normalized_email text NOT NULL/)
  assert.match(
    migration,
    /status text NOT NULL DEFAULT 'pending' CHECK \(status IN \('pending', 'ready', 'activated', 'revoked'\)\)/,
  )
  assert.match(migration, /reset_receipt_ref text/)
  assert.match(migration, /UNIQUE \(campaign_id, user_id\)/)
  assert.match(migration, /UNIQUE \(campaign_id, normalized_email\)/)
  assert.match(
    migration,
    /ALTER TABLE public\.personal_plan_test_members ENABLE ROW LEVEL SECURITY/,
  )
  assert.match(
    migration,
    /REVOKE ALL ON TABLE public\.personal_plan_test_members FROM PUBLIC, anon, authenticated/,
  )
})

test("moderator migration exposes service-only atomic roster and activation RPCs", () => {
  assert.match(
    migration,
    /CREATE OR REPLACE FUNCTION public\.create_personal_plan_moderator_test_campaign\(/,
  )
  assert.match(migration, /p_roster jsonb/)
  assert.match(migration, /jsonb_array_elements\(p_roster\)/)
  assert.match(
    migration,
    /CREATE OR REPLACE FUNCTION private\.activate_personal_plan_moderator_test\(/,
  )
  assert.match(migration, /p_confirmed_email text/)
  assert.match(migration, /member\.reset_receipt_ref IS NULL/)
  assert.match(migration, /campaign\.identity_mode <> 'email_bound'/)
  assert.match(migration, /auth\.users AS auth_user/)
  assert.match(migration, /FOR UPDATE OF enrollment, grant_row/)
  assert.match(migration, /moderator user already has active test access/)
  assert.match(migration, /lead\.email = v_email/)
  assert.match(
    migration,
    /INSERT INTO public\.manual_access_grants \(user_id, reason, expires_at\)/,
  )
  assert.match(migration, /UPDATE public\.personal_plan_test_members AS member_row/)
  assert.match(migration, /status = 'activated'/)
  assert.match(
    migration,
    /CREATE OR REPLACE FUNCTION public\.activate_personal_plan_moderator_test\(/,
  )
  assert.match(
    migration,
    /CREATE OR REPLACE FUNCTION public\.save_personal_plan_moderator_lead_with_artifact\(/,
  )
  assert.match(migration, /completion_event_eligible = false/)
  assert.match(migration, /send_completion_event = false/)
  assert.match(migration, /session\.user_id = p_user_id/)
  assert.match(migration, /artifact\.user_id IS DISTINCT FROM p_user_id/)
  assert.match(migration, /UPDATE public\.leads AS lead[\s\S]*user_id = p_user_id/)
  assert.match(
    migration,
    /UPDATE public\.personal_plan_prepared_artifacts AS artifact_row[\s\S]*user_id = p_user_id/,
  )
  assert.match(
    migration,
    /REVOKE ALL ON FUNCTION public\.activate_personal_plan_moderator_test\([\s\S]*FROM PUBLIC, anon, authenticated/,
  )
  assert.match(
    migration,
    /GRANT EXECUTE ON FUNCTION public\.activate_personal_plan_moderator_test\([\s\S]*TO service_role/,
  )
})

test("moderator migration fences existing guest RPCs away from email-bound campaigns", () => {
  assert.match(
    migration,
    /ALTER FUNCTION private\.activate_personal_plan_field_test\(uuid, uuid, uuid, uuid, text\) RENAME TO activate_personal_plan_field_test_guest_v1/,
  )
  assert.match(migration, /CREATE OR REPLACE FUNCTION private\.activate_personal_plan_field_test\(/)
  assert.match(migration, /campaign\.identity_mode <> 'guest'/)
  assert.match(migration, /private\.activate_personal_plan_field_test_guest_v1\(/)
  assert.doesNotMatch(migration, /FROM public\.activate_personal_plan_field_test\(/)
  assert.match(
    migration,
    /CREATE OR REPLACE FUNCTION public\.bind_personal_plan_field_test_funnel\(/,
  )
  assert.match(migration, /campaign\.identity_mode <> 'guest'/)
})
