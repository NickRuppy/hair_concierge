import assert from "node:assert/strict"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

const migrationsDir = join(process.cwd(), "supabase/migrations")
const migrationPath = join(
  migrationsDir,
  readdirSync(migrationsDir).find((name) => name.endsWith("_partner_access.sql")) ??
    "missing_partner_access.sql",
)
const migration = readFileSync(migrationPath, "utf8").replace(/\s+/g, " ")

test("partner access migration creates private invitation and correction state", () => {
  assert.match(migration, /CREATE TABLE public\.partner_access_invitations/)
  assert.match(migration, /normalized_email text NOT NULL/)
  assert.match(migration, /token_version integer NOT NULL DEFAULT 1/)
  assert.match(migration, /claim_attempt_id uuid/)
  assert.match(migration, /claim_attempt_expires_at timestamptz/)
  assert.match(migration, /CREATE TABLE public\.partner_access_email_changes/)
  assert.match(migration, /token_version integer NOT NULL CHECK \(token_version > 0\)/)
  assert.match(migration, /token_hash text NOT NULL UNIQUE/)
  assert.match(
    migration,
    /ALTER TABLE public\.partner_access_invitations ENABLE ROW LEVEL SECURITY/,
  )
  assert.match(
    migration,
    /REVOKE ALL ON TABLE public\.partner_access_invitations FROM PUBLIC, anon, authenticated/,
  )
})

test("partner access migration extends grants and preserves one active grant per invitation", () => {
  assert.match(migration, /DROP CONSTRAINT IF EXISTS manual_access_grants_reason_check/)
  assert.match(migration, /reason IN \('friend', 'tester', 'admin', 'support', 'partner'\)/)
  assert.match(migration, /partner_access_invitation_id uuid/)
  assert.match(
    migration,
    /CREATE UNIQUE INDEX partner_access_one_active_grant_per_invitation[\s\S]*WHERE revoked_at IS NULL/,
  )
  assert.match(migration, /ADD COLUMN partner_access_invitation_id uuid/)
  assert.match(migration, /partner_access_one_current_claimed_user/)
  assert.match(migration, /test_kind = 'partner' AND field_test_campaign_id IS NULL/)
})

test("partner mutation functions are service-only and explicit about privilege", () => {
  for (const functionName of [
    "create_partner_access_invitations",
    "reserve_partner_access_claim",
    "release_partner_access_claim",
    "complete_partner_access_claim",
    "activate_partner_access",
    "revoke_partner_access",
    "reactivate_partner_access",
    "rotate_partner_access_invitation",
  ]) {
    assert.match(migration, new RegExp(`CREATE OR REPLACE FUNCTION public\\.${functionName}\\(`))
  }
  assert.match(
    migration,
    /REVOKE ALL ON FUNCTION public\.create_partner_access_invitations\(jsonb, uuid\) FROM PUBLIC, anon, authenticated/,
  )
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.create_partner_access_invitations/)
})

test("partner routing is additive and cannot rename the established owner source", () => {
  assert.doesNotMatch(migration, /RENAME TO personal_plan_get_own_routing_source_pre_partner/)
  assert.match(
    migration,
    /CREATE OR REPLACE FUNCTION private\.personal_plan_get_own_partner_routing_source\(\)/,
  )
  assert.match(
    migration,
    /CREATE OR REPLACE FUNCTION public\.personal_plan_get_own_partner_routing_source\(\)/,
  )
})
