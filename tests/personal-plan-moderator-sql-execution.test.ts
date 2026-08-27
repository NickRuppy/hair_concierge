import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { PGlite } from "@electric-sql/pglite"

const migrationPath =
  "supabase/migrations/20260827100624_personal_plan_moderator_email_bound_access.sql"
const artifactMigrationPath =
  "supabase/migrations/20260728130000_add_personal_plan_prepared_artifacts.sql"
const customerioOutboxMigrationPath =
  "supabase/migrations/20260801100000_customerio_profile_sync_outbox.sql"
const fieldTestMigrationPath =
  "supabase/migrations/20260810120016_personal_plan_field_test_access.sql"

const ids = {
  campaign: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  guestCampaign: "abababab-abab-4bab-8bab-abababababab",
  duplicateUser: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  user: "11111111-1111-4111-8111-111111111111",
  otherUser: "22222222-2222-4222-8222-222222222222",
  funnel: "33333333-3333-4333-8333-333333333333",
  lead: "44444444-4444-4444-8444-444444444444",
  artifact: "55555555-5555-4555-8555-555555555555",
  guestFunnel: "66666666-6666-4666-8666-666666666666",
  guestLead: "77777777-7777-4777-8777-777777777777",
  guestUser: "88888888-8888-4888-8888-888888888888",
}

test("moderator campaign creation is atomic and rolls back duplicate roster inserts", async (t) => {
  const pg = await migratedDatabase(t)

  await assert.rejects(
    pg.query(
      `
        SELECT * FROM public.create_personal_plan_moderator_test_campaign(
          'Duplicate moderator roster',
          repeat('a', 64),
          $1::jsonb,
          '2026-08-27T00:00:00Z',
          '2026-09-26T00:00:00Z'
        )
      `,
      [
        JSON.stringify([
          {
            user_id: ids.duplicateUser,
            email: "same@example.test",
            reset_receipt_ref: "receipt-1",
          },
          {
            user_id: ids.duplicateUser,
            email: "same@example.test",
            reset_receipt_ref: "receipt-2",
          },
        ]),
      ],
    ),
    /duplicate key value violates unique constraint/,
  )

  const campaignRows = await pg.query<{ count: string }>(
    "SELECT count(*)::text AS count FROM public.personal_plan_test_campaigns WHERE token_hash = repeat('a', 64)",
  )
  assert.equal(campaignRows.rows[0].count, "0")
  const memberRows = await pg.query<{ count: string }>(
    "SELECT count(*)::text AS count FROM public.personal_plan_test_members WHERE user_id = $1",
    [ids.duplicateUser],
  )
  assert.equal(memberRows.rows[0].count, "0")

  await pg.query(
    "INSERT INTO auth.users (id, email, email_confirmed_at) VALUES ($1, 'moderator@example.test', '2026-08-01T00:00:00Z')",
    [ids.user],
  )
  const created = await pg.query<{
    campaign_id: string
    max_activations: number
    access_duration_hours: number
    member_count: number
  }>(
    `
      SELECT * FROM public.create_personal_plan_moderator_test_campaign(
        'Valid moderator roster',
        repeat('b', 64),
        $1::jsonb,
        '2026-08-27T00:00:00Z',
        '2026-09-26T00:00:00Z'
      )
    `,
    [
      JSON.stringify([
        { user_id: ids.user, email: "moderator@example.test", reset_receipt_ref: "receipt-1" },
      ]),
    ],
  )
  assert.equal(created.rows[0].max_activations, 1)
  assert.equal(created.rows[0].access_duration_hours, 2160)
  assert.equal(created.rows[0].member_count, 1)

  const createdMembers = await pg.query<{
    normalized_email: string
    status: string
    reset_receipt_ref: string
  }>(
    `
      SELECT normalized_email, status, reset_receipt_ref
        FROM public.personal_plan_test_members
       WHERE campaign_id = $1
    `,
    [created.rows[0].campaign_id],
  )
  assert.deepEqual(createdMembers.rows, [
    {
      normalized_email: "moderator@example.test",
      reset_receipt_ref: "receipt-1",
      status: "pending",
    },
  ])
})

test("moderator save and activation are replay-safe with stable expiry", async (t) => {
  const pg = await migratedDatabase(t)
  await seedModeratorFixtures(pg)

  const save = await pg.query<{ lead_id: string; reused: boolean; artifact_id: string }>(
    `
      SELECT * FROM public.save_personal_plan_moderator_lead_with_artifact(
        $1, $2, 'MODERATOR@EXAMPLE.TEST', $3, false,
        '{"answers":["fresh"]}'::jsonb, $4, repeat('b', 64), repeat('c', 64)
      )
    `,
    [ids.campaign, ids.user, ids.funnel, ids.artifact],
  )
  const leadId = save.rows[0].lead_id
  assert.ok(leadId)
  assert.equal(save.rows[0].reused, false)
  assert.equal(save.rows[0].artifact_id, ids.artifact)

  const lead = await pg.query<{
    email: string
    marketing_consent: boolean
    quiz_answers: { answers: string[] }
    quiz_kind: string
    status: string
    user_id: string
  }>(
    "SELECT email, marketing_consent, quiz_answers, quiz_kind, status, user_id FROM public.leads WHERE id = $1",
    [leadId],
  )
  assert.deepEqual(lead.rows[0], {
    email: "moderator@example.test",
    marketing_consent: false,
    quiz_answers: { answers: ["fresh"] },
    quiz_kind: "personal_plan",
    status: "linked",
    user_id: ids.user,
  })

  const artifact = await pg.query<{ status: string; lead_id: string; user_id: string }>(
    "SELECT status, lead_id, user_id FROM public.personal_plan_prepared_artifacts WHERE id = $1",
    [ids.artifact],
  )
  assert.deepEqual(artifact.rows[0], {
    lead_id: leadId,
    status: "attached",
    user_id: ids.user,
  })

  const outbox = await pg.query<{
    completion_event_eligible: boolean
    send_completion_event: boolean
    status: string
  }>(
    "SELECT completion_event_eligible, send_completion_event, status FROM public.customerio_profile_sync_outbox WHERE lead_id = $1",
    [leadId],
  )
  assert.deepEqual(outbox.rows[0], {
    completion_event_eligible: false,
    send_completion_event: false,
    status: "pending",
  })

  const first = await activateModerator(pg, "moderator-activation-1", leadId)
  assert.equal(first.reused, false)
  assert.ok(first.enrollment_id)
  assert.ok(first.manual_access_grant_id)
  assert.equal(first.prepared_artifact_id, ids.artifact)

  const replay = await activateModerator(pg, "moderator-activation-1-replay", leadId)
  assert.equal(replay.reused, true)
  assert.equal(replay.enrollment_id, first.enrollment_id)
  assert.equal(replay.manual_access_grant_id, first.manual_access_grant_id)
  assert.equal(
    new Date(replay.activated_at).toISOString(),
    new Date(first.activated_at).toISOString(),
  )
  assert.equal(new Date(replay.expires_at).toISOString(), new Date(first.expires_at).toISOString())

  const member = await pg.query<{ status: string; enrollment_id: string }>(
    "SELECT status, enrollment_id FROM public.personal_plan_test_members WHERE campaign_id = $1 AND user_id = $2",
    [ids.campaign, ids.user],
  )
  assert.deepEqual(member.rows[0], { status: "activated", enrollment_id: first.enrollment_id })

  const grants = await pg.query<{ count: string }>(
    "SELECT count(*)::text AS count FROM public.manual_access_grants WHERE user_id = $1 AND reason = 'tester'",
    [ids.user],
  )
  assert.equal(grants.rows[0].count, "1")
})

test("guest RPCs reject moderator campaigns while guest wrapper remains non-recursive", async (t) => {
  const pg = await migratedDatabase(t)
  await seedModeratorFixtures(pg)
  await seedGuestFixtures(pg)

  await assert.rejects(
    pg.query("SELECT * FROM public.bind_personal_plan_field_test_funnel($1, $2, $3)", [
      ids.campaign,
      ids.funnel,
      ids.lead,
    ]),
    /field-test campaign is unavailable/,
  )

  await assert.rejects(
    pg.query(
      "SELECT * FROM private.activate_personal_plan_field_test($1, $2, $3, $4, 'guest-on-moderator')",
      [ids.campaign, ids.funnel, ids.lead, ids.user],
    ),
    /field-test campaign is unavailable/,
  )

  const guestActivation = await pg.query<{ reused: boolean; enrollment_id: string }>(
    "SELECT * FROM public.activate_personal_plan_field_test($1, $2, $3, $4, 'guest-ok')",
    [ids.guestCampaign, ids.guestFunnel, ids.guestLead, ids.guestUser],
  )
  assert.equal(guestActivation.rows[0].reused, false)
  assert.ok(guestActivation.rows[0].enrollment_id)

  const guestEvents = await pg.query<{ event_name: string; properties: Record<string, unknown> }>(
    "SELECT event_name, properties FROM public.funnel_events WHERE event_id = 'guest-ok'",
  )
  assert.equal(guestEvents.rows[0].event_name, "field_test_activated")
  assert.equal(guestEvents.rows[0].properties.campaign_id, ids.guestCampaign)
  assert.equal(guestEvents.rows[0].properties.test_kind, "field_test")
  assert.equal(guestEvents.rows[0].properties.identity_mode, undefined)
})

async function migratedDatabase(t: { after: (fn: () => Promise<void>) => void }) {
  const pg = new PGlite()
  t.after(async () => {
    await pg.close()
  })
  await pg.exec(predecessorSchemaSql)
  await pg.exec(
    await extractedFunctionDefinition(
      "supabase/migrations/20260811120000_regular_quiz_field_test_access.sql",
      "CREATE OR REPLACE FUNCTION public.revoke_personal_plan_field_test_campaign(",
    ),
  )
  await pg.exec(await readFile(customerioOutboxMigrationPath, "utf8"))
  await pg.exec(
    await extractedFunctionDefinition(
      artifactMigrationPath,
      "CREATE OR REPLACE FUNCTION public.save_personal_plan_lead_with_artifact(",
    ),
  )
  await pg.exec(
    await extractedFunctionDefinition(
      fieldTestMigrationPath,
      "CREATE OR REPLACE FUNCTION private.activate_personal_plan_field_test(",
    ),
  )
  await pg.exec(
    await extractedFunctionDefinition(
      fieldTestMigrationPath,
      "CREATE OR REPLACE FUNCTION public.activate_personal_plan_field_test(",
    ),
  )
  const migration = await readFile(migrationPath, "utf8")
  await pg.exec(migration)
  return pg
}

async function extractedFunctionDefinition(path: string, marker: string) {
  const source = await readFile(path, "utf8")
  const start = source.indexOf(marker)
  assert.notEqual(start, -1, `missing function marker ${marker}`)
  const end = source.indexOf("\n$$;", start)
  assert.notEqual(end, -1, `missing function terminator for ${marker}`)
  return source.slice(start, end + "\n$$;".length)
}

async function activateModerator(pg: PGlite, eventId: string, leadId: string) {
  const result = await pg.query<{
    enrollment_id: string
    manual_access_grant_id: string
    prepared_artifact_id: string
    activated_at: Date | string
    expires_at: Date | string
    reused: boolean
  }>(
    `
      SELECT * FROM public.activate_personal_plan_moderator_test(
        $1, $2, $3, $4, 'moderator@example.test', $5
      )
    `,
    [ids.campaign, ids.funnel, leadId, ids.user, eventId],
  )
  return result.rows[0]
}

async function seedModeratorFixtures(pg: PGlite) {
  await pg.query(
    "INSERT INTO auth.users (id, email, email_confirmed_at) VALUES ($1, 'moderator@example.test', '2026-08-01T00:00:00Z')",
    [ids.user],
  )
  await pg.query("INSERT INTO public.profiles (id, email) VALUES ($1, 'moderator@example.test')", [
    ids.user,
  ])
  await pg.query(
    `
      INSERT INTO public.personal_plan_test_campaigns
        (id, name, token_hash, starts_at, expires_at, max_activations, access_duration_hours, flow_kind, identity_mode)
      VALUES
        ($1, 'Moderator campaign', repeat('d', 64), '2026-08-27T00:00:00Z', '2026-09-26T00:00:00Z', 1, 2160, 'personal_plan', 'email_bound')
    `,
    [ids.campaign],
  )
  await pg.query(
    `
      INSERT INTO public.personal_plan_test_members
        (campaign_id, user_id, normalized_email, status, reset_receipt_ref)
      VALUES
        ($1, $2, 'moderator@example.test', 'ready', 'reset-receipt-1')
    `,
    [ids.campaign, ids.user],
  )
  await pg.query(
    `
      INSERT INTO public.funnel_sessions
        (id, visitor_id, package_key, channel, user_id, test_kind, field_test_campaign_id)
      VALUES
        ($1, public.test_gen_random_uuid(), 'meta_personal_plan_v1', 'test', $2, 'field_test', $3)
    `,
    [ids.funnel, ids.user, ids.campaign],
  )
  await pg.query(
    `
      INSERT INTO public.personal_plan_prepared_artifacts
        (id, answer_hash, claim_token_hash, quiz_answers, canonical_profile, fallback_metadata, priorities, diagnostic_scores, public_offer_model, locked_plan, status, user_id, expires_at)
      VALUES
        ($1, repeat('c', 64), repeat('b', 64), '{"answers":["fresh"]}'::jsonb, '{}'::jsonb, '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, 'prepared', $2, '2026-09-01T00:00:00Z')
    `,
    [ids.artifact, ids.user],
  )
}

async function seedGuestFixtures(pg: PGlite) {
  await pg.query(
    `
      INSERT INTO auth.users (id, email, email_confirmed_at)
      VALUES ($1, 'guest@example.test', '2026-08-01T00:00:00Z')
    `,
    [ids.guestUser],
  )
  await pg.query("INSERT INTO public.profiles (id, email) VALUES ($1, 'guest@example.test')", [
    ids.guestUser,
  ])
  await pg.query(
    `
      INSERT INTO public.personal_plan_test_campaigns
        (id, name, token_hash, starts_at, expires_at, max_activations, access_duration_hours, flow_kind, identity_mode)
      VALUES
        ($1, 'Guest campaign', repeat('e', 64), '2026-08-27T00:00:00Z', '2026-09-26T00:00:00Z', 10, 168, 'personal_plan', 'guest')
    `,
    [ids.guestCampaign],
  )
  await pg.query(
    `
      INSERT INTO public.leads (id, email, marketing_consent, quiz_answers, quiz_kind, status)
      VALUES ($1, 'guest@example.test', false, '{"answers":["guest"]}'::jsonb, 'personal_plan', 'captured')
    `,
    [ids.guestLead],
  )
  await pg.query(
    `
      INSERT INTO public.funnel_sessions
        (id, visitor_id, package_key, channel, lead_id, test_kind, field_test_campaign_id)
      VALUES
        ($1, public.test_gen_random_uuid(), 'meta_personal_plan_v1', 'test', $2, 'field_test', $3)
    `,
    [ids.guestFunnel, ids.guestLead, ids.guestCampaign],
  )
  await pg.query(
    `
      INSERT INTO public.personal_plan_prepared_artifacts
        (id, answer_hash, claim_token_hash, quiz_answers, canonical_profile, fallback_metadata, priorities, diagnostic_scores, public_offer_model, locked_plan, status, lead_id, expires_at, attached_at)
      VALUES
        (public.test_gen_random_uuid(), repeat('f', 64), repeat('1', 64), '{"answers":["guest"]}'::jsonb, '{}'::jsonb, '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, 'attached', $1, '2026-09-01T00:00:00Z', '2026-08-27T00:00:00Z')
    `,
    [ids.guestLead],
  )
}

const predecessorSchemaSql = `
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS private;
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;

CREATE SEQUENCE public.test_uuid_sequence;
CREATE OR REPLACE FUNCTION public.test_gen_random_uuid()
RETURNS uuid
LANGUAGE sql
AS $$
  SELECT ('00000000-0000-4000-8000-' || lpad(nextval('public.test_uuid_sequence')::text, 12, '0'))::uuid;
$$;

CREATE TABLE auth.users (
  id uuid PRIMARY KEY,
  email text NOT NULL,
  email_confirmed_at timestamptz
);

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text
);

CREATE TABLE public.personal_plan_test_campaigns (
  id uuid PRIMARY KEY DEFAULT public.test_gen_random_uuid(),
  name text NOT NULL CHECK (btrim(name) <> ''),
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  starts_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  max_activations integer NOT NULL CHECK (max_activations > 0),
  access_duration_hours integer NOT NULL CHECK (access_duration_hours > 0),
  flow_kind text NOT NULL DEFAULT 'personal_plan' CHECK (flow_kind IN ('personal_plan', 'regular_quiz')),
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  revoked_at timestamptz,
  CONSTRAINT personal_plan_test_campaigns_time_order CHECK (expires_at > starts_at),
  CONSTRAINT personal_plan_test_campaigns_revocation_status CHECK (
    (status = 'active' AND revoked_at IS NULL)
    OR (status = 'revoked' AND revoked_at IS NOT NULL)
  )
);

CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT public.test_gen_random_uuid(),
  name text NOT NULL DEFAULT '',
  email text NOT NULL,
  marketing_consent boolean,
  quiz_answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  quiz_kind text NOT NULL DEFAULT 'personal_plan',
  status text NOT NULL DEFAULT 'captured',
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now()
);

CREATE TABLE public.funnel_sessions (
  id uuid PRIMARY KEY,
  visitor_id uuid NOT NULL,
  package_key text NOT NULL,
  channel text NOT NULL,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  test_kind text,
  field_test_campaign_id uuid REFERENCES public.personal_plan_test_campaigns(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now()
);

CREATE TABLE public.manual_access_grants (
  id uuid PRIMARY KEY DEFAULT public.test_gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  email text,
  reason text NOT NULL CHECK (reason IN ('friend', 'tester', 'admin', 'support')),
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now()
);

CREATE TABLE public.personal_plan_prepared_artifacts (
  id uuid PRIMARY KEY DEFAULT public.test_gen_random_uuid(),
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
  lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  superseded_by uuid,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  expires_at timestamptz NOT NULL,
  attached_at timestamptz,
  user_attached_at timestamptz,
  CONSTRAINT personal_plan_prepared_artifact_attachment_check CHECK (
    (status = 'prepared' AND lead_id IS NULL AND attached_at IS NULL AND superseded_by IS NULL)
    OR (status = 'attached' AND lead_id IS NOT NULL AND attached_at IS NOT NULL AND superseded_by IS NULL)
    OR (status = 'superseded' AND lead_id IS NOT NULL AND attached_at IS NOT NULL AND superseded_by IS NOT NULL)
  )
);

CREATE TABLE public.personal_plan_test_enrollments (
  id uuid PRIMARY KEY DEFAULT public.test_gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.personal_plan_test_campaigns(id) ON DELETE RESTRICT,
  funnel_session_id uuid NOT NULL REFERENCES public.funnel_sessions(id) ON DELETE RESTRICT,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  manual_access_grant_id uuid NOT NULL REFERENCES public.manual_access_grants(id) ON DELETE RESTRICT,
  prepared_artifact_id uuid NOT NULL REFERENCES public.personal_plan_prepared_artifacts(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  activated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  UNIQUE (campaign_id, lead_id)
);

CREATE TABLE public.funnel_events (
  event_id text PRIMARY KEY,
  funnel_session_id uuid NOT NULL REFERENCES public.funnel_sessions(id) ON DELETE CASCADE,
  package_key text NOT NULL,
  event_name text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  properties jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now()
);
`

test("repreparing a moderator quiz must not leave the previous result without account context", async (t) => {
  const pg = await migratedDatabase(t)
  await seedModeratorFixtures(pg)
  const save = async (artifactId: string, claim: string) =>
    pg.query<{ lead_id: string }>(
      `SELECT * FROM public.save_personal_plan_moderator_lead_with_artifact(
      $1, $2, 'moderator@example.test', $3, false,
      '{"answers":["fresh"]}'::jsonb, $4, $5, repeat('c', 64))`,
      [ids.campaign, ids.user, ids.funnel, artifactId, claim],
    )
  const first = await save(ids.artifact, "b".repeat(64))
  const nextArtifact = "99999999-9999-4999-8999-999999999999"
  await pg.query(
    `INSERT INTO public.personal_plan_prepared_artifacts
    (id, answer_hash, claim_token_hash, quiz_answers, canonical_profile, fallback_metadata, priorities, diagnostic_scores, public_offer_model, locked_plan, status, user_id, expires_at)
    SELECT $1, answer_hash, repeat('e',64), quiz_answers, canonical_profile, fallback_metadata, priorities, diagnostic_scores, public_offer_model, locked_plan, 'prepared', user_id, expires_at
    FROM public.personal_plan_prepared_artifacts WHERE id=$2`,
    [nextArtifact, ids.artifact],
  )
  await save(nextArtifact, "e".repeat(64))
  const oldLead = await pg.query<{ moderator_campaign_id: string }>(
    "SELECT moderator_campaign_id FROM public.leads WHERE id=$1",
    [first.rows[0].lead_id],
  )
  assert.equal(
    oldLead.rows[0].moderator_campaign_id,
    ids.campaign,
    "previous result must retain its account-only classification after the funnel moves",
  )
})

test("campaign revocation includes moderator membership and rolls back all rows on failure", async (t) => {
  const pg = await migratedDatabase(t)
  await seedModeratorFixtures(pg)
  const saved = await pg.query<{ lead_id: string }>(
    `SELECT * FROM public.save_personal_plan_moderator_lead_with_artifact(
    $1, $2, 'moderator@example.test', $3, false, '{"answers":["fresh"]}'::jsonb, $4, repeat('b',64), repeat('c',64))`,
    [ids.campaign, ids.user, ids.funnel, ids.artifact],
  )
  await activateModerator(pg, "before-revoke", saved.rows[0].lead_id)
  await pg.exec(`CREATE FUNCTION public.reject_test_member_revoke() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic revoke failure'; END; $$;
    CREATE TRIGGER reject_member_revoke BEFORE UPDATE ON public.personal_plan_test_members FOR EACH ROW EXECUTE FUNCTION public.reject_test_member_revoke();`)
  await assert.rejects(
    pg.query("SELECT public.revoke_personal_plan_field_test_campaign($1)", [ids.campaign]),
    /synthetic revoke failure/,
  )
  assert.equal(
    (
      await pg.query<{ status: string }>(
        "SELECT status FROM public.personal_plan_test_campaigns WHERE id=$1",
        [ids.campaign],
      )
    ).rows[0].status,
    "active",
  )
  assert.equal(
    (
      await pg.query<{ status: string }>(
        "SELECT status FROM public.personal_plan_test_enrollments WHERE campaign_id=$1",
        [ids.campaign],
      )
    ).rows[0].status,
    "active",
  )
  assert.equal(
    (
      await pg.query<{ revoked_at: string | null }>(
        "SELECT revoked_at FROM public.manual_access_grants WHERE user_id=$1",
        [ids.user],
      )
    ).rows[0].revoked_at,
    null,
  )
  await pg.exec("DROP TRIGGER reject_member_revoke ON public.personal_plan_test_members")
  assert.equal(
    (
      await pg.query<{ revoked: boolean }>(
        "SELECT public.revoke_personal_plan_field_test_campaign($1) AS revoked",
        [ids.campaign],
      )
    ).rows[0].revoked,
    true,
  )
  const chain = await pg.query<{
    member_status: string
    enrollment_status: string
    same_time: boolean
  }>(
    `SELECT m.status AS member_status, e.status AS enrollment_status, (m.revoked_at=e.revoked_at AND e.revoked_at=g.revoked_at) AS same_time
    FROM public.personal_plan_test_members m JOIN public.personal_plan_test_enrollments e ON e.id=m.enrollment_id JOIN public.manual_access_grants g ON g.id=e.manual_access_grant_id WHERE m.campaign_id=$1`,
    [ids.campaign],
  )
  assert.deepEqual(chain.rows[0], {
    member_status: "revoked",
    enrollment_status: "revoked",
    same_time: true,
  })
  assert.equal(
    (
      await pg.query<{ revoked: boolean }>(
        "SELECT public.revoke_personal_plan_field_test_campaign($1) AS revoked",
        [ids.campaign],
      )
    ).rows[0].revoked,
    false,
  )
})
