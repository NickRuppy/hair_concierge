import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { PGlite } from "@electric-sql/pglite"

const migrationPath = "supabase/migrations/20260901120000_partner_access.sql"
const freshStartMigrationPath = "supabase/migrations/20260913120000_partner_access_fresh_start.sql"
const ids = {
  creator: "10000000-0000-4000-8000-000000000001",
  funnel: "20000000-0000-4000-8000-000000000002",
  legacyFunnel: "20000000-0000-4000-8000-000000000003",
  attempt: "40000000-0000-4000-8000-000000000004",
  otherAttempt: "50000000-0000-4000-8000-000000000005",
  needVersion: "60000000-0000-4000-8000-000000000006",
  routineVersion: "70000000-0000-4000-8000-000000000007",
  proposal: "80000000-0000-4000-8000-000000000008",
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

test("claiming a partner invitation grants free access and restarts an existing account", async (t) => {
  const pg = await migratedDatabase(t)
  const invitationId = await createInvitation(pg)
  await seedAccount(pg)
  const seeded = await seedUsedAccountState(pg)

  await reserve(pg, invitationId, ids.attempt)
  const claim = await completeClaim(pg, invitationId)
  assert.deepEqual(
    { reused: claim.reused, fresh_start: claim.fresh_start },
    { reused: false, fresh_start: true },
  )

  const invitation = await pg.query<{
    fresh_start_stamped: boolean
    grant_matches: boolean
  }>(
    `SELECT invitation.fresh_start_at IS NOT NULL AS fresh_start_stamped,
            invitation.current_manual_access_grant_id = grant_row.id AS grant_matches
       FROM public.partner_access_invitations AS invitation
       JOIN public.manual_access_grants AS grant_row
         ON grant_row.partner_access_invitation_id = invitation.id
      WHERE invitation.id = $1`,
    [invitationId],
  )
  assert.deepEqual(invitation.rows, [{ fresh_start_stamped: true, grant_matches: true }])
  assert.equal(await activePartnerGrants(pg, invitationId), "1")

  const profile = await pg.query<{
    onboarding_completed: boolean
    onboarding_step: string
    has_seen_completion_popup: boolean
  }>(
    "SELECT onboarding_completed, onboarding_step, has_seen_completion_popup FROM public.profiles WHERE id = $1",
    [ids.creator],
  )
  assert.deepEqual(profile.rows[0], {
    onboarding_completed: false,
    onboarding_step: "welcome",
    has_seen_completion_popup: false,
  })
  assert.equal(await scalarCount(pg, "public.hair_profiles WHERE user_id = $1", [ids.creator]), "0")

  const plan = await readPlan(pg)
  assert.deepEqual(plan, {
    enrollment_purchase_source_id: invitationId,
    current_initial_need_version_id: null,
    current_refined_need_version_id: null,
    active_routine_version_id: null,
    pending_routine_proposal_id: null,
    unrefined_direct_accept: false,
    last_evaluated_source_fingerprint: null,
    last_rejected_auto_fingerprint: null,
    legacy_prefill_v1: null,
    revision: "5",
  })

  assert.deepEqual(await readResetState(pg, seeded), {
    refinementDraftStatus: "stale",
    productDraftStatus: "stale",
    proposalStatus: "superseded",
    lifecycleMarks: "0",
    personalPlanEnrollmentStatus: "revoked",
    personalPlanEnrollmentRevoked: true,
    regularQuizEnrollmentStatus: "revoked",
    regularQuizEnrollmentRevoked: true,
    testerGrantsRevoked: "2",
    quizDraftStatus: "expired",
    resultReturnRevoked: true,
    ownedProducts: "0",
    archivedProducts: "1",
    nudgeDismissedUntilCleared: true,
  })
})

test("a paying account can claim partner access without a fresh start", async (t) => {
  const pg = await migratedDatabase(t)
  const invitationId = await createInvitation(pg)
  await seedAccount(pg)
  const seeded = await seedUsedAccountState(pg)

  await reserve(pg, invitationId, ids.attempt)
  const claim = await completeClaim(pg, invitationId, false)
  assert.deepEqual(
    { reused: claim.reused, fresh_start: claim.fresh_start },
    { reused: false, fresh_start: false },
  )

  assert.equal(await activePartnerGrants(pg, invitationId), "1")
  assert.equal(
    (
      await pg.query<{ stamped: boolean }>(
        "SELECT fresh_start_at IS NOT NULL AS stamped FROM public.partner_access_invitations WHERE id = $1",
        [invitationId],
      )
    ).rows[0].stamped,
    false,
  )
  assert.equal(await scalarCount(pg, "public.hair_profiles WHERE user_id = $1", [ids.creator]), "1")
  const plan = await readPlan(pg)
  assert.deepEqual(plan, {
    enrollment_purchase_source_id: seeded.enrollmentSourceId,
    current_initial_need_version_id: ids.needVersion,
    current_refined_need_version_id: ids.needVersion,
    active_routine_version_id: ids.routineVersion,
    pending_routine_proposal_id: ids.proposal,
    unrefined_direct_accept: true,
    last_evaluated_source_fingerprint: "fingerprint-evaluated",
    last_rejected_auto_fingerprint: "fingerprint-rejected",
    legacy_prefill_v1: { prefill: true },
    revision: "4",
  })
  assert.deepEqual(await readResetState(pg, seeded), {
    refinementDraftStatus: "in_progress",
    productDraftStatus: "active",
    proposalStatus: "pending",
    lifecycleMarks: "1",
    personalPlanEnrollmentStatus: "active",
    personalPlanEnrollmentRevoked: false,
    regularQuizEnrollmentStatus: "active",
    regularQuizEnrollmentRevoked: false,
    testerGrantsRevoked: "0",
    quizDraftStatus: "active",
    resultReturnRevoked: false,
    ownedProducts: "1",
    archivedProducts: "0",
    nudgeDismissedUntilCleared: false,
  })
})

test("omitting p_fresh_start relies on the safe DEFAULT false and behaves like a no-fresh-start claim", async (t) => {
  const pg = await migratedDatabase(t)
  const invitationId = await createInvitation(pg)
  await seedAccount(pg)
  const seeded = await seedUsedAccountState(pg)

  await reserve(pg, invitationId, ids.attempt)
  const claim = await pg.query<{ reused: boolean; fresh_start: boolean }>(
    "SELECT * FROM public.complete_partner_access_claim($1, 1, $2, $3, $4)",
    [invitationId, ids.attempt, ids.creator, ids.funnel],
  )
  assert.deepEqual(
    { reused: claim.rows[0].reused, fresh_start: claim.rows[0].fresh_start },
    { reused: false, fresh_start: false },
  )

  assert.equal(await activePartnerGrants(pg, invitationId), "1")
  assert.equal(
    (
      await pg.query<{ stamped: boolean }>(
        "SELECT fresh_start_at IS NOT NULL AS stamped FROM public.partner_access_invitations WHERE id = $1",
        [invitationId],
      )
    ).rows[0].stamped,
    false,
  )
  assert.equal(await scalarCount(pg, "public.hair_profiles WHERE user_id = $1", [ids.creator]), "1")
  const plan = await readPlan(pg)
  assert.deepEqual(plan, {
    enrollment_purchase_source_id: seeded.enrollmentSourceId,
    current_initial_need_version_id: ids.needVersion,
    current_refined_need_version_id: ids.needVersion,
    active_routine_version_id: ids.routineVersion,
    pending_routine_proposal_id: ids.proposal,
    unrefined_direct_accept: true,
    last_evaluated_source_fingerprint: "fingerprint-evaluated",
    last_rejected_auto_fingerprint: "fingerprint-rejected",
    legacy_prefill_v1: { prefill: true },
    revision: "4",
  })
  assert.deepEqual(await readResetState(pg, seeded), {
    refinementDraftStatus: "in_progress",
    productDraftStatus: "active",
    proposalStatus: "pending",
    lifecycleMarks: "1",
    personalPlanEnrollmentStatus: "active",
    personalPlanEnrollmentRevoked: false,
    regularQuizEnrollmentStatus: "active",
    regularQuizEnrollmentRevoked: false,
    testerGrantsRevoked: "0",
    quizDraftStatus: "active",
    resultReturnRevoked: false,
    ownedProducts: "1",
    archivedProducts: "0",
    nudgeDismissedUntilCleared: false,
  })
})

test("a replayed claim completion neither re-grants nor restarts the account again", async (t) => {
  const pg = await migratedDatabase(t)
  const invitationId = await createInvitation(pg)
  await seedAccount(pg)

  await reserve(pg, invitationId, ids.attempt)
  await completeClaim(pg, invitationId)
  const seeded = await seedUsedAccountState(pg)

  const replay = await completeClaim(pg, invitationId)
  assert.deepEqual(
    { reused: replay.reused, fresh_start: replay.fresh_start },
    { reused: true, fresh_start: false },
  )
  assert.equal(await activePartnerGrants(pg, invitationId), "1")
  assert.equal(await scalarCount(pg, "public.hair_profiles WHERE user_id = $1", [ids.creator]), "1")
  const plan = await readPlan(pg)
  assert.equal(plan.current_initial_need_version_id, ids.needVersion)
  assert.equal(plan.enrollment_purchase_source_id, seeded.enrollmentSourceId)
  assert.equal(plan.revision, "4")
})

test("a legacy claimed invitation self-heals its grant and restart exactly once", async (t) => {
  const pg = await migratedDatabase(t)
  const invitationId = await createInvitation(pg)
  await seedAccount(pg)

  await reserve(pg, invitationId, ids.attempt)
  await completeClaim(pg, invitationId, false)
  await pg.query(
    "UPDATE public.manual_access_grants SET revoked_at = pg_catalog.now() WHERE partner_access_invitation_id = $1",
    [invitationId],
  )
  await pg.query(
    "UPDATE public.partner_access_invitations SET current_manual_access_grant_id = NULL WHERE id = $1",
    [invitationId],
  )
  await seedUsedAccountState(pg)

  const healed = await completeClaim(pg, invitationId)
  assert.deepEqual(
    { reused: healed.reused, fresh_start: healed.fresh_start },
    { reused: true, fresh_start: true },
  )
  assert.equal(await activePartnerGrants(pg, invitationId), "1")
  assert.equal(await scalarCount(pg, "public.hair_profiles WHERE user_id = $1", [ids.creator]), "0")

  const seededAgain = await seedUsedAccountState(pg)
  const second = await completeClaim(pg, invitationId)
  assert.deepEqual(
    { reused: second.reused, fresh_start: second.fresh_start },
    { reused: true, fresh_start: false },
  )
  assert.equal(await activePartnerGrants(pg, invitationId), "1")
  assert.equal(await scalarCount(pg, "public.hair_profiles WHERE user_id = $1", [ids.creator]), "1")
  const plan = await readPlan(pg)
  assert.equal(plan.current_initial_need_version_id, ids.needVersion)
  assert.equal(plan.enrollment_purchase_source_id, seededAgain.enrollmentSourceId)
})

test("a failing fresh start rolls the whole claim completion back", async (t) => {
  const pg = await migratedDatabase(t)
  const invitationId = await createInvitation(pg)
  await seedAccount(pg)
  await seedUsedAccountState(pg)
  await pg.exec(`
    CREATE FUNCTION public.partner_access_test_block() RETURNS trigger
    LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fresh start blocked'; END; $$;
    CREATE TRIGGER partner_access_test_block_profiles
      BEFORE UPDATE ON public.profiles
      FOR EACH ROW EXECUTE FUNCTION public.partner_access_test_block();
  `)

  await reserve(pg, invitationId, ids.attempt)
  await assert.rejects(completeClaim(pg, invitationId), /fresh start blocked/)

  const invitation = await pg.query<{
    claimed_user_id: string | null
    claimed_at: string | null
    fresh_start_at: string | null
    current_manual_access_grant_id: string | null
  }>(
    "SELECT claimed_user_id, claimed_at, fresh_start_at, current_manual_access_grant_id FROM public.partner_access_invitations WHERE id = $1",
    [invitationId],
  )
  assert.deepEqual(invitation.rows[0], {
    claimed_user_id: null,
    claimed_at: null,
    fresh_start_at: null,
    current_manual_access_grant_id: null,
  })
  assert.equal(
    await scalarCount(pg, "public.manual_access_grants WHERE partner_access_invitation_id = $1", [
      invitationId,
    ]),
    "0",
  )
  assert.equal(
    await scalarCount(pg, "public.funnel_sessions WHERE id = $1 AND user_id IS NOT NULL", [
      ids.funnel,
    ]),
    "0",
  )
})

test("activation reuses the claim grant and revocation cycles keep one active grant", async (t) => {
  const pg = await migratedDatabase(t)
  const invitationId = await createInvitation(pg)
  await seedAccount(pg)

  await reserve(pg, invitationId, ids.attempt)
  await completeClaim(pg, invitationId)
  const claimGrantId = (
    await pg.query<{ id: string }>(
      "SELECT id FROM public.manual_access_grants WHERE partner_access_invitation_id = $1",
      [invitationId],
    )
  ).rows[0].id

  const savedLead = await pg.query<{ lead_id: string }>(
    `SELECT * FROM public.save_partner_access_lead(
      $1, $2, $3, 'lea@example.test', 'Lea', true, '{"texture":"wavy"}'::jsonb
    )`,
    [invitationId, ids.creator, ids.funnel],
  )
  const activated = await activate(pg, invitationId, savedLead.rows[0].lead_id)
  assert.equal(activated.manual_access_grant_id, claimGrantId)
  assert.equal(
    await scalarCount(pg, "public.manual_access_grants WHERE partner_access_invitation_id = $1", [
      invitationId,
    ]),
    "1",
  )
  const stamped = await pg.query<{ lead_id: string; activated: boolean }>(
    "SELECT lead_id, activated_at IS NOT NULL AS activated FROM public.partner_access_invitations WHERE id = $1",
    [invitationId],
  )
  assert.deepEqual(stamped.rows[0], { lead_id: savedLead.rows[0].lead_id, activated: true })

  await pg.query("SELECT * FROM public.revoke_partner_access($1)", [invitationId])
  assert.equal(await activePartnerGrants(pg, invitationId), "0")
  const reactivated = await pg.query<{ manual_access_grant_id: string }>(
    "SELECT * FROM public.reactivate_partner_access($1)",
    [invitationId],
  )
  assert.notEqual(reactivated.rows[0].manual_access_grant_id, claimGrantId)
  assert.equal(await activePartnerGrants(pg, invitationId), "1")
})

test("a claimed but never activated invitation regains a grant on reactivation", async (t) => {
  const pg = await migratedDatabase(t)
  const invitationId = await createInvitation(pg)
  await seedAccount(pg)

  await reserve(pg, invitationId, ids.attempt)
  await completeClaim(pg, invitationId)
  const claimGrantId = (
    await pg.query<{ id: string }>(
      "SELECT id FROM public.manual_access_grants WHERE partner_access_invitation_id = $1",
      [invitationId],
    )
  ).rows[0].id

  await pg.query("SELECT * FROM public.revoke_partner_access($1)", [invitationId])
  assert.equal(await activePartnerGrants(pg, invitationId), "0")

  const reactivated = await pg.query<{ manual_access_grant_id: string; changed: boolean }>(
    "SELECT * FROM public.reactivate_partner_access($1)",
    [invitationId],
  )
  assert.equal(reactivated.rows[0].changed, true)
  assert.notEqual(reactivated.rows[0].manual_access_grant_id, claimGrantId)
  assert.equal(await activePartnerGrants(pg, invitationId), "1")
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
  const claim = await completeClaim(pg, invitationId)
  assert.equal(claim.reused, false)
  assert.equal(await activePartnerGrants(pg, invitationId), "1")

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
  assert.equal(await activePartnerGrants(pg, invitationId), "1")

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

test("the fresh start helper stays out of reach of anon and authenticated callers", async (t) => {
  const pg = await migratedDatabase(t)
  const acl = await pg.query<{ role_name: string; has_execute: boolean }>(
    `SELECT role_name,
            pg_catalog.has_function_privilege(
              role_name,
              'private.partner_access_fresh_start(uuid, uuid)',
              'EXECUTE'
            ) AS has_execute
       FROM (VALUES ('anon'), ('authenticated'), ('service_role')) AS roles(role_name)`,
  )
  assert.deepEqual(acl.rows, [
    { role_name: "anon", has_execute: false },
    { role_name: "authenticated", has_execute: false },
    { role_name: "service_role", has_execute: true },
  ])

  const claimAcl = await pg.query<{ role_name: string; has_execute: boolean }>(
    `SELECT role_name,
            pg_catalog.has_function_privilege(
              role_name,
              'public.complete_partner_access_claim(uuid, integer, uuid, uuid, uuid, boolean)',
              'EXECUTE'
            ) AS has_execute
       FROM (VALUES ('anon'), ('authenticated'), ('service_role')) AS roles(role_name)`,
  )
  assert.deepEqual(claimAcl.rows, [
    { role_name: "anon", has_execute: false },
    { role_name: "authenticated", has_execute: false },
    { role_name: "service_role", has_execute: true },
  ])
})

async function migratedDatabase(t: { after: (fn: () => Promise<void>) => void }) {
  const pg = new PGlite()
  t.after(async () => pg.close())
  await pg.exec(predecessorSchema)
  await pg.exec(await readFile(migrationPath, "utf8"))
  await pg.exec(await readFile(freshStartMigrationPath, "utf8"))
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

async function completeClaim(pg: PGlite, invitationId: string, freshStart = true) {
  const result = await pg.query<{ reused: boolean; fresh_start: boolean }>(
    "SELECT * FROM public.complete_partner_access_claim($1, 1, $2, $3, $4, $5)",
    [invitationId, ids.attempt, ids.creator, ids.funnel, freshStart],
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

async function scalarCount(pg: PGlite, fromClause: string, params: unknown[] = []) {
  const result = await pg.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM ${fromClause}`,
    params,
  )
  return result.rows[0].count
}

async function activePartnerGrants(pg: PGlite, invitationId: string) {
  return scalarCount(
    pg,
    "public.manual_access_grants WHERE partner_access_invitation_id = $1 AND revoked_at IS NULL",
    [invitationId],
  )
}

async function seedAccount(pg: PGlite) {
  await pg.query(
    `INSERT INTO public.profiles (id, email, onboarding_completed, onboarding_step, has_seen_completion_popup)
     VALUES ($1, 'lea@example.test', true, 'plan', true)`,
    [ids.creator],
  )
  await pg.query(
    "INSERT INTO public.funnel_sessions (id, package_key) VALUES ($1, 'default_organic')",
    [ids.funnel],
  )
  await pg.query(
    "INSERT INTO public.funnel_sessions (id, package_key, user_id) VALUES ($1, 'default_organic', $2)",
    [ids.legacyFunnel, ids.creator],
  )
}

type SeededState = {
  planId: string
  enrollmentSourceId: string
  leadId: string
  testerGrantIds: string[]
}

/** Rebuilds the "account already used the product" state the fresh start has to clear. */
async function seedUsedAccountState(pg: PGlite): Promise<SeededState> {
  await pg.query(
    `UPDATE public.profiles
        SET onboarding_completed = true, onboarding_step = 'plan', has_seen_completion_popup = true
      WHERE id = $1`,
    [ids.creator],
  )
  await pg.query(
    "INSERT INTO public.hair_profiles (user_id, hair_type) VALUES ($1, 'glatt') ON CONFLICT (user_id) DO NOTHING",
    [ids.creator],
  )
  const enrollmentSourceId = "90000000-0000-4000-8000-000000000009"
  const plan = await pg.query<{ id: string }>(
    `INSERT INTO public.personal_plans (
       user_id, enrollment_purchase_source_id, current_initial_need_version_id,
       current_refined_need_version_id, active_routine_version_id, pending_routine_proposal_id,
       unrefined_direct_accept, last_evaluated_source_fingerprint, last_rejected_auto_fingerprint,
       legacy_prefill_v1, nudge_dismissed_until, revision
     ) VALUES ($1, $2, $3, $3, $4, $5, true, 'fingerprint-evaluated', 'fingerprint-rejected',
       '{"prefill": true}'::jsonb, pg_catalog.now() + interval '30 days', 4)
     ON CONFLICT (user_id) DO UPDATE SET
       enrollment_purchase_source_id = EXCLUDED.enrollment_purchase_source_id,
       current_initial_need_version_id = EXCLUDED.current_initial_need_version_id,
       current_refined_need_version_id = EXCLUDED.current_refined_need_version_id,
       active_routine_version_id = EXCLUDED.active_routine_version_id,
       pending_routine_proposal_id = EXCLUDED.pending_routine_proposal_id,
       unrefined_direct_accept = EXCLUDED.unrefined_direct_accept,
       last_evaluated_source_fingerprint = EXCLUDED.last_evaluated_source_fingerprint,
       last_rejected_auto_fingerprint = EXCLUDED.last_rejected_auto_fingerprint,
       legacy_prefill_v1 = EXCLUDED.legacy_prefill_v1,
       nudge_dismissed_until = EXCLUDED.nudge_dismissed_until,
       revision = EXCLUDED.revision
     RETURNING id`,
    [ids.creator, enrollmentSourceId, ids.needVersion, ids.routineVersion, ids.proposal],
  )
  const planId = plan.rows[0].id

  await pg.query("DELETE FROM public.personal_plan_refinement_drafts WHERE user_id = $1", [
    ids.creator,
  ])
  await pg.query(
    "INSERT INTO public.personal_plan_refinement_drafts (user_id, personal_plan_id, status) VALUES ($1, $2, 'in_progress')",
    [ids.creator, planId],
  )
  await pg.query("DELETE FROM public.personal_plan_product_drafts WHERE user_id = $1", [
    ids.creator,
  ])
  await pg.query(
    "INSERT INTO public.personal_plan_product_drafts (user_id, personal_plan_id, status) VALUES ($1, $2, 'active')",
    [ids.creator, planId],
  )
  await pg.query("DELETE FROM public.personal_plan_routine_proposals WHERE user_id = $1", [
    ids.creator,
  ])
  await pg.query(
    "INSERT INTO public.personal_plan_routine_proposals (id, user_id, personal_plan_id, status) VALUES ($1, $2, $3, 'pending')",
    [ids.proposal, ids.creator, planId],
  )
  await pg.query(
    `INSERT INTO public.personal_plan_ui_lifecycle_marks (user_id, kind, subject)
     VALUES ($1, 'nav_surface_visited', 'routine')
     ON CONFLICT (user_id, kind, subject) DO NOTHING`,
    [ids.creator],
  )

  await pg.query("DELETE FROM public.personal_plan_test_enrollments WHERE user_id = $1", [
    ids.creator,
  ])
  await pg.query("DELETE FROM public.regular_quiz_test_enrollments WHERE user_id = $1", [
    ids.creator,
  ])
  const testerGrantIds: string[] = []
  for (const table of ["personal_plan_test_enrollments", "regular_quiz_test_enrollments"]) {
    const testerGrant = await pg.query<{ id: string }>(
      "INSERT INTO public.manual_access_grants (user_id, reason, expires_at) VALUES ($1, 'tester', NULL) RETURNING id",
      [ids.creator],
    )
    testerGrantIds.push(testerGrant.rows[0].id)
    await pg.query(
      `INSERT INTO public.${table} (user_id, manual_access_grant_id, status) VALUES ($1, $2, 'active')`,
      [ids.creator, testerGrant.rows[0].id],
    )
  }

  await pg.query("DELETE FROM public.personal_plan_quiz_drafts WHERE funnel_session_id = $1", [
    ids.legacyFunnel,
  ])
  await pg.query(
    "INSERT INTO public.personal_plan_quiz_drafts (funnel_session_id, status) VALUES ($1, 'active')",
    [ids.legacyFunnel],
  )

  await pg.query(
    "DELETE FROM public.personal_plan_result_returns WHERE lead_id IN (SELECT id FROM public.leads WHERE user_id = $1)",
    [ids.creator],
  )
  await pg.query(
    "DELETE FROM public.leads WHERE user_id = $1 AND partner_access_invitation_id IS NULL",
    [ids.creator],
  )
  const lead = await pg.query<{ id: string }>(
    "INSERT INTO public.leads (email, user_id) VALUES ('lea@example.test', $1) RETURNING id",
    [ids.creator],
  )
  await pg.query("INSERT INTO public.personal_plan_result_returns (lead_id) VALUES ($1)", [
    lead.rows[0].id,
  ])

  await pg.query("DELETE FROM public.user_products WHERE user_id = $1", [ids.creator])
  await pg.query(
    "INSERT INTO public.user_products (user_id, category, brand_text, ownership_status) VALUES ($1, 'shampoo', 'Marke', 'owned')",
    [ids.creator],
  )

  return { planId, enrollmentSourceId, leadId: lead.rows[0].id, testerGrantIds }
}

async function readPlan(pg: PGlite) {
  const result = await pg.query<{
    enrollment_purchase_source_id: string | null
    current_initial_need_version_id: string | null
    current_refined_need_version_id: string | null
    active_routine_version_id: string | null
    pending_routine_proposal_id: string | null
    unrefined_direct_accept: boolean
    last_evaluated_source_fingerprint: string | null
    last_rejected_auto_fingerprint: string | null
    legacy_prefill_v1: unknown
    revision: string
  }>(
    `SELECT enrollment_purchase_source_id, current_initial_need_version_id,
            current_refined_need_version_id, active_routine_version_id,
            pending_routine_proposal_id, unrefined_direct_accept,
            last_evaluated_source_fingerprint, last_rejected_auto_fingerprint,
            legacy_prefill_v1, revision::text AS revision
       FROM public.personal_plans WHERE user_id = $1`,
    [ids.creator],
  )
  return result.rows[0]
}

async function readResetState(pg: PGlite, seeded: SeededState) {
  const result = await pg.query<Record<string, unknown>>(
    `SELECT
       (SELECT status FROM public.personal_plan_refinement_drafts WHERE user_id = $1) AS "refinementDraftStatus",
       (SELECT status FROM public.personal_plan_product_drafts WHERE user_id = $1) AS "productDraftStatus",
       (SELECT status FROM public.personal_plan_routine_proposals WHERE user_id = $1) AS "proposalStatus",
       (SELECT count(*)::text FROM public.personal_plan_ui_lifecycle_marks WHERE user_id = $1) AS "lifecycleMarks",
       (SELECT status FROM public.personal_plan_test_enrollments WHERE user_id = $1) AS "personalPlanEnrollmentStatus",
       (SELECT revoked_at IS NOT NULL FROM public.personal_plan_test_enrollments WHERE user_id = $1) AS "personalPlanEnrollmentRevoked",
       (SELECT status FROM public.regular_quiz_test_enrollments WHERE user_id = $1) AS "regularQuizEnrollmentStatus",
       (SELECT revoked_at IS NOT NULL FROM public.regular_quiz_test_enrollments WHERE user_id = $1) AS "regularQuizEnrollmentRevoked",
       (SELECT count(*)::text FROM public.manual_access_grants WHERE id = ANY($2::uuid[]) AND revoked_at IS NOT NULL) AS "testerGrantsRevoked",
       (SELECT status FROM public.personal_plan_quiz_drafts WHERE funnel_session_id = $3) AS "quizDraftStatus",
       (SELECT revoked_at IS NOT NULL FROM public.personal_plan_result_returns WHERE lead_id = $4) AS "resultReturnRevoked",
       (SELECT count(*)::text FROM public.user_products WHERE user_id = $1 AND ownership_status = 'owned') AS "ownedProducts",
       (SELECT count(*)::text FROM public.user_products WHERE user_id = $1 AND ownership_status = 'archived') AS "archivedProducts",
       (SELECT nudge_dismissed_until IS NULL FROM public.personal_plans WHERE user_id = $1) AS "nudgeDismissedUntilCleared"`,
    [ids.creator, seeded.testerGrantIds, ids.legacyFunnel, seeded.leadId],
  )
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
  email text,
  onboarding_completed boolean NOT NULL DEFAULT false,
  onboarding_step text DEFAULT 'welcome',
  has_seen_completion_popup boolean NOT NULL DEFAULT false
);

CREATE TABLE public.hair_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  hair_type text
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
  user_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  enrollment_purchase_source_id uuid,
  current_initial_need_version_id uuid,
  current_refined_need_version_id uuid,
  pending_routine_proposal_id uuid,
  active_routine_version_id uuid,
  unrefined_direct_accept boolean NOT NULL DEFAULT false,
  last_evaluated_source_fingerprint text,
  last_rejected_auto_fingerprint text,
  legacy_prefill_v1 jsonb,
  nudge_dismissed_until timestamptz,
  revision bigint NOT NULL DEFAULT 0 CHECK (revision >= 0),
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  UNIQUE (id, user_id)
);

CREATE TABLE public.personal_plan_refinement_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  personal_plan_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress', 'complete', 'stale')),
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now()
);

CREATE TABLE public.personal_plan_product_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  personal_plan_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'stale')),
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now()
);

CREATE TABLE public.personal_plan_routine_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  personal_plan_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected', 'superseded')),
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now()
);

CREATE TABLE public.personal_plan_ui_lifecycle_marks (
  user_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('module_banner_dismissed', 'nav_surface_visited')),
  subject text NOT NULL,
  marked_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  PRIMARY KEY (user_id, kind, subject)
);

CREATE TABLE public.personal_plan_test_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  manual_access_grant_id uuid NOT NULL REFERENCES public.manual_access_grants(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  activated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  revoked_at timestamptz,
  CONSTRAINT personal_plan_test_enrollments_time_order CHECK (
    revoked_at IS NULL OR revoked_at >= activated_at
  ),
  CONSTRAINT personal_plan_test_enrollments_revocation_status CHECK (
    (status = 'active' AND revoked_at IS NULL)
    OR (status = 'revoked' AND revoked_at IS NOT NULL)
  )
);

CREATE TABLE public.regular_quiz_test_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  manual_access_grant_id uuid NOT NULL REFERENCES public.manual_access_grants(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  activated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  revoked_at timestamptz,
  CONSTRAINT regular_quiz_test_enrollments_time_order CHECK (
    revoked_at IS NULL OR revoked_at >= activated_at
  ),
  CONSTRAINT regular_quiz_test_enrollments_revocation_status CHECK (
    (status = 'active' AND revoked_at IS NULL)
    OR (status = 'revoked' AND revoked_at IS NOT NULL)
  )
);

CREATE TABLE public.personal_plan_quiz_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funnel_session_id uuid NOT NULL REFERENCES public.funnel_sessions(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'expired')),
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now()
);

CREATE TABLE public.personal_plan_result_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL UNIQUE REFERENCES public.leads(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  revoked_at timestamptz,
  CONSTRAINT personal_plan_result_returns_timestamp_order
    CHECK (revoked_at IS NULL OR revoked_at >= created_at)
);

CREATE TABLE public.user_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category text NOT NULL,
  catalog_product_id uuid,
  brand_text text,
  product_name_text text,
  identity_status text NOT NULL DEFAULT 'text_only'
    CHECK (identity_status IN ('matched', 'pending_review', 'needs_more_info', 'text_only')),
  ownership_status text NOT NULL DEFAULT 'owned' CHECK (ownership_status IN ('owned', 'archived')),
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CHECK (ownership_status = 'archived'
      OR identity_status IN ('pending_review', 'needs_more_info')
      OR brand_text IS NOT NULL OR product_name_text IS NOT NULL OR catalog_product_id IS NOT NULL)
);
CREATE UNIQUE INDEX user_products_live_catalog_identity_key
  ON public.user_products(user_id, category, catalog_product_id)
  WHERE ownership_status = 'owned' AND catalog_product_id IS NOT NULL;
`
