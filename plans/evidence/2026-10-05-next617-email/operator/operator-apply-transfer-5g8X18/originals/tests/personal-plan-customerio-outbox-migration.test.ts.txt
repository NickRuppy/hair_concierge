import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const migrationPath = "supabase/migrations/20260801100000_customerio_profile_sync_outbox.sql"

test("Customer.io profile outbox migration keeps payload in source tables and private delivery state", () => {
  const migration = readFileSync(migrationPath, "utf8")

  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.customerio_profile_sync_outbox/i)
  assert.match(migration, /lead_id uuid PRIMARY KEY[\s\S]+REFERENCES public\.leads \(id\)/i)
  assert.match(migration, /profile_revision integer NOT NULL DEFAULT 1/i)
  assert.match(migration, /completion_event_eligible boolean NOT NULL DEFAULT false/i)
  assert.match(migration, /send_completion_event boolean NOT NULL DEFAULT false/i)
  assert.match(migration, /completion_event_delivered_at timestamptz/i)
  assert.doesNotMatch(migration, /quiz_answers jsonb|plan_expires_at/i)
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/i)
  assert.match(migration, /REVOKE ALL[\s\S]+PUBLIC, anon, authenticated/i)
  assert.match(migration, /GRANT ALL[\s\S]+service_role/i)
})

test("Customer.io profile outbox makes only newly inserted consented leads event eligible", () => {
  const migration = readFileSync(migrationPath, "utf8")

  assert.match(migration, /AFTER INSERT OR UPDATE OF email, marketing_consent, quiz_answers/i)
  assert.match(migration, /NEW\.quiz_kind IS DISTINCT FROM 'personal_plan'/i)
  assert.match(migration, /IF TG_OP = 'INSERT'/i)
  assert.match(
    migration,
    /completion_event_eligible,[\s\S]+true,[\s\S]+NEW\.marketing_consent IS TRUE/i,
  )
  assert.match(
    migration,
    /The lead predates this outbox\. Historical rows are always profile-only/i,
  )
  assert.match(migration, /INSERT INTO public\.customerio_profile_sync_outbox \(lead_id\)/i)
  assert.match(migration, /profile_revision = profile_revision \+ 1/i)
})

test("profile-only backfill request cannot create or downgrade event eligibility", () => {
  const migration = readFileSync(migrationPath, "utf8")

  assert.match(migration, /request_customerio_profile_sync/i)
  assert.match(migration, /request_customerio_profile_sync\(\s*p_lead_id uuid\s*\)/i)
  const requestFunction = migration.match(
    /CREATE OR REPLACE FUNCTION public\.request_customerio_profile_sync[\s\S]+?\$\$;/i,
  )?.[0]
  assert.ok(requestFunction)
  assert.doesNotMatch(requestFunction, /completion_event_eligible\s*=|send_completion_event\s*=/i)
  assert.match(requestFunction, /profile_revision = existing\.profile_revision \+ 1/i)
})
