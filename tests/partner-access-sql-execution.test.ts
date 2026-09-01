import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { PGlite } from "@electric-sql/pglite"

const migrationPath = "supabase/migrations/20260901120000_partner_access.sql"
const ids = {
  creator: "10000000-0000-4000-8000-000000000001",
  funnel: "20000000-0000-4000-8000-000000000002",
  attempt: "40000000-0000-4000-8000-000000000004",
  otherAttempt: "50000000-0000-4000-8000-000000000005",
}

test("partner invitation batches are atomic and normalize creator identity", async (t) => {
  const pg = await migratedDatabase(t)

  await assert.rejects(
    pg.query(
      `SELECT * FROM public.create_partner_access_invitations(
        '[{"name":"Lea","email":"same@example.test"},{"name":"Mia","email":"SAME@example.test"}]'::jsonb
      )`,
    ),
    /duplicate partner invitation email/,
  )
  assert.equal(
    (
      await pg.query<{ count: string }>(
        "SELECT count(*)::text AS count FROM public.partner_access_invitations",
      )
    ).rows[0].count,
    "0",
  )

  const created = await pg.query<{ display_name: string; normalized_email: string }>(
    `SELECT * FROM public.create_partner_access_invitations(
      '[{"name":" Lea ","email":" LEA@Example.Test "}]'::jsonb
    )`,
  )
  assert.equal(created.rows[0].display_name, "Lea")
  assert.equal(created.rows[0].normalized_email, "lea@example.test")
})

test("claim reservation is exclusive, replayable, and recoverable after abandonment", async (t) => {
  const pg = await migratedDatabase(t)
  const invitationId = await createInvitation(pg)

  const first = await reserve(pg, invitationId, ids.attempt)
  assert.equal(first.reused, false)
  const replay = await reserve(pg, invitationId, ids.attempt)
  assert.equal(replay.reused, true)
  await assert.rejects(reserve(pg, invitationId, ids.otherAttempt), /claim in progress/)

  await pg.query(
    "UPDATE public.partner_access_invitations SET claim_attempt_expires_at = pg_catalog.now() - interval '1 second' WHERE id = $1",
    [invitationId],
  )
  const recovered = await reserve(pg, invitationId, ids.otherAttempt)
  assert.equal(recovered.reused, false)
})

test("an existing-account handoff can release its reservation immediately", async (t) => {
  const pg = await migratedDatabase(t)
  const invitationId = await createInvitation(pg)
  await reserve(pg, invitationId, ids.attempt)

  const released = await pg.query<{ released: boolean }>(
    "SELECT * FROM public.release_partner_access_claim($1, 1, $2)",
    [invitationId, ids.attempt],
  )
  assert.equal(released.rows[0].released, true)
  assert.equal((await reserve(pg, invitationId, ids.otherAttempt)).reused, false)
})

test("email correction is throttled and invalidated by invitation rotation", async (t) => {
  const pg = await migratedDatabase(t)
  const invitationId = await createInvitation(pg)
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString()

  await pg.query(
    "SELECT * FROM public.issue_partner_access_email_change($1, 1, 'new@example.test', $2, $3)",
    [invitationId, "a".repeat(64), expiresAt],
  )
  await assert.rejects(
    pg.query(
      "SELECT * FROM public.issue_partner_access_email_change($1, 1, 'other@example.test', $2, $3)",
      [invitationId, "b".repeat(64), expiresAt],
    ),
    /too many partner email changes/,
  )

  await pg.query("SELECT * FROM public.rotate_partner_access_invitation($1)", [invitationId])
  await assert.rejects(
    pg.query("SELECT * FROM public.consume_partner_access_email_change($1)", ["a".repeat(64)]),
    /partner email change unavailable/,
  )
})

test("activation is replay-safe, indefinite, revocable, and preserves independent paid access", async (t) => {
  const pg = await migratedDatabase(t)
  const invitationId = await createInvitation(pg)
  await pg.query("INSERT INTO public.profiles (id, email) VALUES ($1, 'lea@example.test')", [
    ids.creator,
  ])
  await pg.query(
    "INSERT INTO public.funnel_sessions (id, package_key) VALUES ($1, 'default_organic')",
    [ids.funnel],
  )
  await assert.rejects(
    pg.query("SELECT * FROM public.complete_partner_access_claim($1, 1, $2, $3, $4)", [
      invitationId,
      ids.attempt,
      ids.creator,
      ids.funnel,
    ]),
    /partner invitation claim is not reserved/,
  )
  await reserve(pg, invitationId, ids.attempt)
  const claim = await pg.query<{ reused: boolean }>(
    "SELECT * FROM public.complete_partner_access_claim($1, 1, $2, $3, $4)",
    [invitationId, ids.attempt, ids.creator, ids.funnel],
  )
  assert.equal(claim.rows[0].reused, false)

  const savedLead = await pg.query<{ lead_id: string; reused: boolean }>(
    `SELECT * FROM public.save_partner_access_lead(
      $1, $2, $3, 'lea@example.test', 'Lea', true, '{"texture":"wavy"}'::jsonb
    )`,
    [invitationId, ids.creator, ids.funnel],
  )
  assert.equal(savedLead.rows[0].reused, false)

  const first = await activate(pg, invitationId, savedLead.rows[0].lead_id)
  assert.equal(first.reused, false)
  const replay = await activate(pg, invitationId, savedLead.rows[0].lead_id)
  assert.deepEqual(replay, { ...first, reused: true })

  const grant = await pg.query<{
    reason: string
    email: string | null
    expires_at: string | null
    revoked_at: string | null
  }>(
    "SELECT reason, email, expires_at, revoked_at FROM public.manual_access_grants WHERE id = $1",
    [first.manual_access_grant_id],
  )
  assert.deepEqual(grant.rows[0], {
    reason: "partner",
    email: null,
    expires_at: null,
    revoked_at: null,
  })

  await pg.query(
    "INSERT INTO public.manual_access_grants (user_id, reason, expires_at) VALUES ($1, 'friend', NULL)",
    [ids.creator],
  )
  const revoked = await pg.query<{ changed: boolean }>(
    "SELECT * FROM public.revoke_partner_access($1)",
    [invitationId],
  )
  assert.equal(revoked.rows[0].changed, true)
  const accessAfterRevoke = await pg.query<{ reason: string; revoked: boolean }>(
    "SELECT reason, revoked_at IS NOT NULL AS revoked FROM public.manual_access_grants WHERE user_id = $1 ORDER BY reason",
    [ids.creator],
  )
  assert.deepEqual(accessAfterRevoke.rows, [
    { reason: "friend", revoked: false },
    { reason: "partner", revoked: true },
  ])

  const reactivated = await pg.query<{ manual_access_grant_id: string; changed: boolean }>(
    "SELECT * FROM public.reactivate_partner_access($1)",
    [invitationId],
  )
  assert.equal(reactivated.rows[0].changed, true)
  assert.notEqual(reactivated.rows[0].manual_access_grant_id, first.manual_access_grant_id)
  const reactivatedGrant = await pg.query<{ email: string | null }>(
    "SELECT email FROM public.manual_access_grants WHERE id = $1",
    [reactivated.rows[0].manual_access_grant_id],
  )
  assert.equal(reactivatedGrant.rows[0].email, null)
  const partnerHistory = await pg.query<{ count: string }>(
    "SELECT count(*)::text AS count FROM public.manual_access_grants WHERE partner_access_invitation_id = $1",
    [invitationId],
  )
  assert.equal(partnerHistory.rows[0].count, "2")
})

async function migratedDatabase(t: { after: (fn: () => Promise<void>) => void }) {
  const pg = new PGlite()
  t.after(async () => pg.close())
  await pg.exec(predecessorSchema)
  await pg.exec(await readFile(migrationPath, "utf8"))
  return pg
}

async function createInvitation(pg: PGlite) {
  const result = await pg.query<{ invitation_id: string }>(
    `SELECT * FROM public.create_partner_access_invitations(
      '[{"name":"Lea","email":"lea@example.test"}]'::jsonb
    )`,
  )
  return result.rows[0].invitation_id
}

async function reserve(pg: PGlite, invitationId: string, attemptId: string) {
  const result = await pg.query<{ reused: boolean }>(
    "SELECT * FROM public.reserve_partner_access_claim($1, 1, $2, 600)",
    [invitationId, attemptId],
  )
  return result.rows[0]
}

async function activate(pg: PGlite, invitationId: string, leadId: string) {
  const result = await pg.query<{
    invitation_id: string
    manual_access_grant_id: string
    activated_at: string
    reused: boolean
  }>("SELECT * FROM public.activate_partner_access($1, $2, $3, $4)", [
    invitationId,
    ids.creator,
    ids.funnel,
    leadId,
  ])
  return result.rows[0]
}

const predecessorSchema = `
CREATE SCHEMA private;
CREATE SCHEMA auth;
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = pg_catalog.now(); RETURN NEW; END;
$$;

CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULL::uuid; $$;

CREATE OR REPLACE FUNCTION private.personal_plan_get_own_routing_source()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER AS $$ SELECT NULL::jsonb; $$;

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  email text
);

CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '',
  email text NOT NULL,
  user_id uuid REFERENCES public.profiles(id),
  marketing_consent boolean NOT NULL DEFAULT false,
  quiz_answers jsonb,
  quiz_kind text NOT NULL DEFAULT 'legacy'
    CONSTRAINT leads_quiz_kind_check CHECK (quiz_kind IN ('legacy', 'personal_plan')),
  status text NOT NULL DEFAULT 'captured'
    CONSTRAINT leads_status_check CHECK (status IN ('captured', 'analyzed', 'linked')),
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now()
);

CREATE TABLE public.funnel_sessions (
  id uuid PRIMARY KEY,
  package_key text NOT NULL,
  user_id uuid REFERENCES public.profiles(id),
  lead_id uuid REFERENCES public.leads(id),
  test_kind text,
  field_test_campaign_id uuid,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now()
);

ALTER TABLE public.funnel_sessions
  ADD CONSTRAINT funnel_sessions_field_test_context_check CHECK (
    (test_kind IS NULL AND field_test_campaign_id IS NULL)
    OR (test_kind = 'field_test' AND field_test_campaign_id IS NOT NULL)
  );

CREATE TABLE public.manual_access_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  email text CONSTRAINT manual_access_grants_email_lowercase CHECK (email IS NULL OR email = lower(email)),
  reason text NOT NULL CONSTRAINT manual_access_grants_reason_check
    CHECK (reason IN ('friend', 'tester', 'admin', 'support')),
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now()
);

ALTER TABLE public.manual_access_grants
  ADD CONSTRAINT manual_access_grants_identity_check CHECK (user_id IS NOT NULL OR email IS NOT NULL);

CREATE TABLE public.personal_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  current_initial_need_version_id uuid,
  current_refined_need_version_id uuid,
  pending_routine_proposal_id uuid,
  active_routine_version_id uuid
);
`
