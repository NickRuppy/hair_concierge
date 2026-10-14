import assert from "node:assert/strict"
import test from "node:test"
import { PGlite } from "@electric-sql/pglite"
import {
  RESET_TABLES,
  resetInventoryTableNames,
} from "../scripts/lib/moderator-account-reset-inventory"
import {
  buildModeratorResetPlan,
  buildRuntimeFingerprintSelectSql,
} from "../scripts/lib/moderator-account-reset-plan"
import {
  MODERATOR_RESET_OPERATION,
  MODERATOR_RESET_SCHEMA_VERSION,
  ResetManifest,
  fingerprintManifest,
} from "../scripts/lib/moderator-account-reset-types"

const USER_ID = "11111111-1111-4111-8111-111111111111"
const OTHER_USER_ID = "99999999-9999-4999-8999-999999999999"
const EMAIL = "moderator@example.test"
const GRANT_ID = "22222222-2222-4222-8222-222222222222"

test("blocks incomplete private manifest proof instead of generating reset SQL", () => {
  const manifest = withFingerprint({
    ...baseManifest(),
    externalProof: {
      ...baseManifest().externalProof,
      authAdminMechanismVerified: false,
    },
  })

  const plan = buildModeratorResetPlan(manifest)

  assert.equal(plan.sql, null)
  assert.match(plan.blockers.join("\n"), /external proof incomplete: authAdminMechanismVerified/)
})

test("blocks unclassified owner tables and billing-linked state", () => {
  const manifest = baseManifest()
  manifest.expectedSchema.discoveredOwnerTables = [
    ...manifest.expectedSchema.discoveredOwnerTables,
    "public.surprise_user_runtime",
  ]
  manifest.accounts[0].expectedCounts["public.billing_one_time_purchases"] = 1
  const plan = buildModeratorResetPlan(withFingerprint(manifest))

  assert.equal(plan.sql, null)
  assert.match(
    plan.blockers.join("\n"),
    /unclassified live owner table public\.surprise_user_runtime/,
  )
  assert.match(plan.blockers.join("\n"), /billing_one_time_purchases rows/)
})

test("production reset refuses missing payment replay cutoff proof", () => {
  const manifest = baseManifest()
  manifest.environment = "production"
  manifest.projectRef = "pqdkhefxsxkyeqelqegq"
  manifest.externalProof.productionOperationApproval = "approved_exact_batch"
  const plan = buildModeratorResetPlan(withFingerprint(manifest))
  assert.equal(plan.sql, null)
  assert.match(plan.blockers.join("\n"), /payment replay cutoff proof/)
})

test("the operational payment cutoff cannot be removed as legacy app metadata", () => {
  const manifest = baseManifest()
  manifest.accounts[0].authAppMetadataKeysToRemove.push("moderator_reset_cutoff_at")
  const plan = buildModeratorResetPlan(withFingerprint(manifest))
  assert.equal(plan.sql, null)
  assert.match(plan.blockers.join("\n"), /moderator_reset_cutoff_at.*allowlist/)
})

test("drains requests that may start immediately before the last JWT expires", () => {
  const manifest = baseManifest()
  const proof = manifest.accounts[0].authMaintenanceProof!
  proof.workerQueueDrainedAt = proof.loginRestrictedAt
  proof.earliestResetAt = "2026-08-27T13:05:00.000Z"
  const plan = buildModeratorResetPlan(withFingerprint(manifest))
  assert.equal(plan.sql, null)
  assert.match(plan.blockers.join("\n"), /drain after the last JWT expiry/)
})

test("waits out tokens minted between global logout and the confirmed login restriction", () => {
  const manifest = baseManifest()
  const proof = manifest.accounts[0].authMaintenanceProof!
  proof.loginRestrictedAt = "2026-08-27T12:10:00.000Z"
  proof.workerQueueDrainedAt = proof.loginRestrictedAt
  proof.earliestResetAt = "2026-08-27T13:10:00.000Z"
  const plan = buildModeratorResetPlan(withFingerprint(manifest))
  assert.equal(plan.sql, null)
  assert.match(plan.blockers.join("\n"), /drain after the last JWT expiry/)
  proof.earliestResetAt = "2026-08-27T13:15:00.000Z"
  assert.deepEqual(buildModeratorResetPlan(withFingerprint(manifest)).blockers, [])
})

test("reset supports an exact fixture with no manual grants", async (t) => {
  const pg = new PGlite()
  t.after(() => pg.close())
  await createSyntheticSchema(pg)
  await seedSyntheticOldState(pg)
  await pg.exec("DELETE FROM public.manual_access_grants")
  const manifest = await manifestWithCurrentRuntimeFingerprint(pg)
  manifest.accounts[0].revokeManualAccessGrantIds = []
  manifest.accounts[0].expectedCounts["public.manual_access_grants"] = 0
  const plan = buildModeratorResetPlan(withFingerprint(manifest))
  assert.ok(plan.sql)
  await pg.exec(plan.sql)
  const result = await pg.query("SELECT id FROM public.hair_profiles")
  assert.deepEqual(result.rows, [])
})

test("production SQL rechecks maintenance and clock inside the reset transaction", async (t) => {
  const pg = new PGlite()
  t.after(() => pg.close())
  await createSyntheticSchema(pg)
  await seedSyntheticOldState(pg)
  await pg.exec(`ALTER TABLE auth.users ADD COLUMN banned_until timestamptz;
    CREATE TABLE auth.sessions (id uuid, user_id uuid);
    CREATE TABLE auth.refresh_tokens (user_id text, revoked boolean);`)
  const currentPlan = async (future = false) => {
    const manifest = await manifestWithCurrentRuntimeFingerprint(pg)
    manifest.environment = "production"
    manifest.projectRef = "pqdkhefxsxkyeqelqegq"
    manifest.externalProof.productionOperationApproval = "approved_exact_batch"
    manifest.createdAt = future ? "2099-01-01T00:00:00.000Z" : "2020-01-02T00:00:00.000Z"
    const proof = manifest.accounts[0].authMaintenanceProof!
    proof.loginRestrictedAt = "2020-01-01T00:00:00.000Z"
    proof.paymentReplayCutoffAt = proof.loginRestrictedAt
    proof.sessionsRevokedAt = proof.loginRestrictedAt
    proof.workerQueueDrainedAt = proof.loginRestrictedAt
    proof.earliestResetAt = future ? manifest.createdAt : "2020-01-01T01:05:00.000Z"
    return buildModeratorResetPlan(withFingerprint(manifest)).sql!
  }
  await assert.rejects(pg.exec(await currentPlan()), /active maintenance ban required/)
  await pg.exec("ROLLBACK")
  await pg.exec("UPDATE auth.users SET banned_until = now() + interval '1 day'")
  await assert.rejects(pg.exec(await currentPlan()), /payment replay cutoff mismatch/)
  await pg.exec("ROLLBACK")
  await pg.query("UPDATE auth.users SET raw_app_meta_data = raw_app_meta_data || $1::jsonb", [
    JSON.stringify({ moderator_reset_cutoff_at: "2020-01-01T00:00:00.000Z" }),
  ])
  await pg.query("INSERT INTO auth.sessions VALUES ($1, $2)", [GRANT_ID, USER_ID])
  await assert.rejects(pg.exec(await currentPlan()), /remaining Auth sessions/)
  await pg.exec("ROLLBACK; DELETE FROM auth.sessions")
  await pg.query("INSERT INTO auth.refresh_tokens VALUES ($1, false)", [USER_ID])
  await assert.rejects(pg.exec(await currentPlan()), /unrevoked refresh tokens/)
  await pg.exec("ROLLBACK; DELETE FROM auth.refresh_tokens")
  await assert.rejects(pg.exec(await currentPlan(true)), /safe reset time has not elapsed/)
  await pg.exec("ROLLBACK")
  await pg.exec(await currentPlan())
  assert.deepEqual((await pg.query("SELECT id FROM public.hair_profiles")).rows, [])
  assert.equal(
    (
      await pg.query<{ cutoff: string }>(
        "SELECT raw_app_meta_data->>'moderator_reset_cutoff_at' AS cutoff FROM auth.users",
      )
    ).rows[0].cutoff,
    "2020-01-01T00:00:00.000Z",
  )
})

test("generated guarded SQL resets app state and preserves login identity", async (t) => {
  const pg = new PGlite()
  t.after(async () => {
    await pg.close()
  })
  await createSyntheticSchema(pg)
  await seedSyntheticOldState(pg)
  const manifest = withFingerprint(await manifestWithCurrentRuntimeFingerprint(pg))
  const plan = buildModeratorResetPlan(manifest)

  assert.deepEqual(plan.blockers, [])
  assert.ok(plan.sql)
  await pg.exec(plan.sql)

  const authUser = await pg.query<{
    email: string
    raw_app_meta_data: Record<string, unknown>
    raw_user_meta_data: Record<string, unknown>
  }>("SELECT email, raw_app_meta_data, raw_user_meta_data FROM auth.users WHERE id = $1", [USER_ID])
  assert.equal(authUser.rows[0].email, EMAIL)
  assert.deepEqual(authUser.rows[0].raw_app_meta_data, { provider: "email" })
  assert.deepEqual(authUser.rows[0].raw_user_meta_data, { email_verified: true })

  const profile = await pg.query<{
    email: string
    full_name: string | null
    onboarding_completed: boolean
    onboarding_step: string
    message_count_this_month: number
    is_admin: boolean
  }>(
    "SELECT email, full_name, onboarding_completed, onboarding_step, message_count_this_month, is_admin FROM public.profiles WHERE id = $1",
    [USER_ID],
  )
  assert.deepEqual(profile.rows[0], {
    email: EMAIL,
    full_name: null,
    onboarding_completed: false,
    onboarding_step: "welcome",
    message_count_this_month: 0,
    is_admin: true,
  })

  for (const entry of RESET_TABLES.filter((table) => table.disposition === "delete")) {
    const result = await pg.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM ${entry.table}`,
    )
    assert.equal(
      result.rows[0].count,
      entry.table === "public.conversations" ? "1" : "0",
      entry.table,
    )
  }
  const otherConversation = await pg.query<{ count: string }>(
    "SELECT count(*)::text AS count FROM public.conversations WHERE user_id = $1",
    [OTHER_USER_ID],
  )
  assert.equal(otherConversation.rows[0].count, "1")

  const grant = await pg.query<{ revoked_at: Date | string | null }>(
    "SELECT revoked_at FROM public.manual_access_grants WHERE id = $1",
    [GRANT_ID],
  )
  assert.ok(grant.rows[0].revoked_at)
})

test("generated SQL aborts on count mismatch before deleting data", async (t) => {
  const pg = new PGlite()
  t.after(async () => {
    await pg.close()
  })
  await createSyntheticSchema(pg)
  await seedSyntheticOldState(pg)
  const manifest = await manifestWithCurrentRuntimeFingerprint(pg)
  manifest.accounts[0].expectedCounts["public.hair_profiles"] = 0
  const plan = buildModeratorResetPlan(withFingerprint(manifest))

  assert.ok(plan.sql)
  await assert.rejects(pg.exec(plan.sql), /precondition count mismatch for public\.hair_profiles/)
  await pg.exec("ROLLBACK")
  const residual = await pg.query<{ count: string }>(
    "SELECT count(*)::text AS count FROM public.hair_profiles WHERE user_id = $1",
    [USER_ID],
  )
  assert.equal(residual.rows[0].count, "1")
})

test("generated SQL aborts on same-count runtime payload drift before deleting data", async (t) => {
  const pg = new PGlite()
  t.after(async () => {
    await pg.close()
  })
  await createSyntheticSchema(pg)
  await seedSyntheticOldState(pg)
  const manifest = withFingerprint(await manifestWithCurrentRuntimeFingerprint(pg))
  await pg.query(
    "UPDATE public.hair_profiles SET conversation_memory = 'changed after manifest' WHERE user_id = $1",
    [USER_ID],
  )
  const plan = buildModeratorResetPlan(manifest)

  assert.ok(plan.sql)
  await assert.rejects(pg.exec(plan.sql), /runtime fingerprint mismatch/)
  await pg.exec("ROLLBACK")
  const residual = await pg.query<{ conversation_memory: string }>(
    "SELECT conversation_memory FROM public.hair_profiles WHERE user_id = $1",
    [USER_ID],
  )
  assert.equal(residual.rows[0].conversation_memory, "changed after manifest")
})

test("cross-owner exact-email lead blocks reset and preserves both owners' state", async (t) => {
  const pg = new PGlite()
  t.after(async () => {
    await pg.close()
  })
  await createSyntheticSchema(pg)
  await seedSyntheticOldState(pg)
  await pg.query(
    "INSERT INTO public.leads (id, user_id, email) VALUES ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', $1, $2)",
    [OTHER_USER_ID, EMAIL],
  )
  await pg.query(
    "INSERT INTO public.funnel_sessions (id, user_id, lead_id) VALUES ('ffffffff-ffff-4fff-8fff-ffffffffffff', $1, 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee')",
    [OTHER_USER_ID],
  )
  const manifest = withFingerprint(await manifestWithCurrentRuntimeFingerprint(pg))
  const plan = buildModeratorResetPlan(manifest)

  assert.ok(plan.sql)
  await assert.rejects(pg.exec(plan.sql), /cross-owner exact-email lead blocks reset/)
  await pg.exec("ROLLBACK")
  const otherLead = await pg.query<{ count: string }>(
    "SELECT count(*)::text AS count FROM public.leads WHERE id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'",
  )
  const ownLead = await pg.query<{ count: string }>(
    "SELECT count(*)::text AS count FROM public.leads WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'",
  )
  assert.equal(otherLead.rows[0].count, "1")
  assert.equal(ownLead.rows[0].count, "1")
})

test("retain-zero billing and backup rows block reset without deleting evidence", async (t) => {
  const pg = new PGlite()
  t.after(async () => {
    await pg.close()
  })
  await createSyntheticSchema(pg)
  await seedSyntheticOldState(pg)
  await pg.query("INSERT INTO public.billing_subscriptions (id, user_id) VALUES ($1, $2)", [
    syntheticUuid(96),
    USER_ID,
  ])
  await pg.query("INSERT INTO public.profiles_backup_20260822 (id, email) VALUES ($1, $2)", [
    USER_ID,
    EMAIL,
  ])
  const manifest = withFingerprint(await manifestWithCurrentRuntimeFingerprint(pg))
  const plan = buildModeratorResetPlan(manifest)

  assert.ok(plan.sql)
  await assert.rejects(
    pg.exec(plan.sql),
    /precondition count mismatch for public\.billing_subscriptions/,
  )
  await pg.exec("ROLLBACK")
  const billing = await pg.query<{ count: string }>(
    "SELECT count(*)::text AS count FROM public.billing_subscriptions WHERE user_id = $1",
    [USER_ID],
  )
  const backup = await pg.query<{ count: string }>(
    "SELECT count(*)::text AS count FROM public.profiles_backup_20260822 WHERE id = $1",
    [USER_ID],
  )
  assert.equal(billing.rows[0].count, "1")
  assert.equal(backup.rows[0].count, "1")
})

test("foreign funnel session or prepared artifact linked to an owned lead blocks reset", async (t) => {
  const pg = new PGlite()
  t.after(async () => {
    await pg.close()
  })
  await createSyntheticSchema(pg)
  await seedSyntheticOldState(pg)
  await pg.query(
    "INSERT INTO public.funnel_sessions (id, user_id, lead_id) VALUES ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', $1, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')",
    [OTHER_USER_ID],
  )
  const funnelManifest = withFingerprint(await manifestWithCurrentRuntimeFingerprint(pg))
  const funnelPlan = buildModeratorResetPlan(funnelManifest)
  assert.ok(funnelPlan.sql)
  await assert.rejects(pg.exec(funnelPlan.sql), /cross-owner funnel session blocks reset/)
  await pg.exec("ROLLBACK")
  await pg.query(
    "DELETE FROM public.funnel_sessions WHERE id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'",
  )

  await pg.query(
    "INSERT INTO public.personal_plan_prepared_artifacts (id, user_id, lead_id) VALUES ($1, $2, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')",
    [syntheticUuid(97), OTHER_USER_ID],
  )
  const artifactManifest = withFingerprint(await manifestWithCurrentRuntimeFingerprint(pg))
  const artifactPlan = buildModeratorResetPlan(artifactManifest)
  assert.ok(artifactPlan.sql)
  await assert.rejects(pg.exec(artifactPlan.sql), /cross-owner prepared artifact blocks reset/)
  await pg.exec("ROLLBACK")
  const artifact = await pg.query<{ count: string }>(
    "SELECT count(*)::text AS count FROM public.personal_plan_prepared_artifacts WHERE user_id = $1",
    [OTHER_USER_ID],
  )
  assert.equal(artifact.rows[0].count, "1")
})

test("child residual checks keep frozen conversation ownership after parent deletion", async (t) => {
  const pg = new PGlite()
  t.after(async () => {
    await pg.close()
  })
  await createSyntheticSchema(pg)
  await seedSyntheticOldState(pg)
  const manifest = withFingerprint(await manifestWithCurrentRuntimeFingerprint(pg))
  const plan = buildModeratorResetPlan(manifest)
  assert.ok(plan.sql)
  await pg.exec(`
    CREATE FUNCTION public.retain_trace_for_residual_test() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      RETURN NULL;
    END;
    $$;
    CREATE TRIGGER retain_trace_for_residual_test
      BEFORE DELETE ON public.conversation_turn_traces
      FOR EACH ROW EXECUTE FUNCTION public.retain_trace_for_residual_test();
  `)

  await assert.rejects(
    pg.exec(plan.sql),
    /residual count mismatch for public\.conversation_turn_traces: expected 0, got 1/,
  )
  await pg.exec("ROLLBACK")
  const trace = await pg.query<{ count: string }>(
    "SELECT count(*)::text AS count FROM public.conversation_turn_traces WHERE user_id = $1",
    [USER_ID],
  )
  assert.equal(trace.rows[0].count, "1")
})

function baseManifest(): ResetManifest {
  const expectedCounts = Object.fromEntries(resetInventoryTableNames().map((table) => [table, 0]))
  for (const table of resetInventoryTableNames()) {
    expectedCounts[table] = table === "public.profiles" ? 1 : 0
  }
  for (const table of RESET_TABLES.filter((entry) => entry.disposition === "delete")) {
    expectedCounts[table.table] = 1
  }
  expectedCounts["public.manual_access_grants"] = 1
  expectedCounts["public.billing_one_time_purchases"] = 0
  expectedCounts["public.personal_plan_one_time_checkout_consents"] = 0
  expectedCounts["public.personal_plan_one_time_fulfillment_jobs"] = 0
  return {
    schemaVersion: MODERATOR_RESET_SCHEMA_VERSION,
    operation: MODERATOR_RESET_OPERATION,
    environment: "local_test",
    projectRef: "local-pglite",
    batchId: "synthetic-moderator-reset",
    createdAt: "2026-08-27T13:30:00.000Z",
    manifestFingerprint: "sha256:0000000000000000000000000000000000000000000000000000000000000000",
    operatorApprovedTargetCount: 1,
    expectedSchema: {
      discoveredOwnerTables: resetInventoryTableNames(),
      profileColumns: [
        "id",
        "email",
        "full_name",
        "is_admin",
        "onboarding_completed",
        "onboarding_step",
        "message_count_this_month",
        "created_at",
        "updated_at",
      ],
      authUsersColumns: ["id", "email", "raw_app_meta_data"],
    },
    profileResetValues: {
      full_name: null,
      onboarding_completed: false,
      onboarding_step: "welcome",
      message_count_this_month: 0,
      updated_at: "$now",
    },
    externalProof: {
      productionOperationApproval: "not_required_local_test",
      authAdminMechanismVerified: true,
      storageInventoryComplete: true,
      storageObjectsRemoved: true,
      workerPauseVerified: true,
      delayedCallbackWriteBlocked: true,
      billingOwnershipReconciled: true,
    },
    accounts: [
      {
        userId: USER_ID,
        email: EMAIL,
        expectedAuthEmail: EMAIL,
        expectedCounts,
        expectedRuntimeFingerprint: "md5:00000000000000000000000000000000",
        revokeManualAccessGrantIds: [GRANT_ID],
        storageObjectPaths: ["product-images/tmp/synthetic-moderator-reset/front.jpg"],
        authAppMetadataKeysToRemove: ["access_kind", "field_test_flow", "quiz_lead_id"],
        authUserMetadataKeysToRemove: ["manual_access_reason"],
        authMaintenanceProof: {
          loginRestrictionMethod: "synthetic local stub",
          loginRestrictedAt: "2026-08-27T12:00:00.000Z",
          sessionsRevokedAt: "2026-08-27T12:05:00.000Z",
          jwtExpiresAfterSeconds: 3600,
          inFlightDrainSeconds: 300,
          workerQueueDrainedAt: "2026-08-27T13:05:00.000Z",
          earliestResetAt: "2026-08-27T13:15:00.000Z",
          restoreProcedure: "synthetic local restore",
        },
      },
    ],
  }
}

function withFingerprint(manifest: ResetManifest): ResetManifest {
  return { ...manifest, manifestFingerprint: fingerprintManifest(manifest) }
}

async function manifestWithCurrentRuntimeFingerprint(pg: PGlite): Promise<ResetManifest> {
  const manifest = baseManifest()
  const result = await pg.query<{ runtime_fingerprint: string }>(
    buildRuntimeFingerprintSelectSql(
      `'${USER_ID}'::uuid`,
      `'${EMAIL}'`,
      `ARRAY['${GRANT_ID}'::uuid]`,
    ),
  )
  manifest.accounts[0].expectedRuntimeFingerprint = result.rows[0].runtime_fingerprint
  return manifest
}

async function createSyntheticSchema(pg: PGlite) {
  await pg.exec(`
    CREATE SCHEMA auth;
    CREATE TABLE auth.users (
      id uuid PRIMARY KEY,
      email text NOT NULL,
      raw_app_meta_data jsonb NOT NULL DEFAULT '{}'::jsonb,
      raw_user_meta_data jsonb NOT NULL DEFAULT '{}'::jsonb
    );
    CREATE SCHEMA IF NOT EXISTS public;
    CREATE TABLE public.profiles (
      id uuid PRIMARY KEY,
      email text NOT NULL,
      full_name text,
      is_admin boolean NOT NULL DEFAULT false,
      onboarding_completed boolean NOT NULL DEFAULT false,
      onboarding_step text NOT NULL DEFAULT 'welcome',
      message_count_this_month integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE public.leads (id uuid PRIMARY KEY, user_id uuid, email text NOT NULL);
    CREATE TABLE public.funnel_sessions (id uuid PRIMARY KEY, user_id uuid, lead_id uuid);
    CREATE TABLE public.funnel_events (event_id text PRIMARY KEY, funnel_session_id uuid, lead_id uuid);
    CREATE TABLE public.customerio_profile_sync_outbox (lead_id uuid PRIMARY KEY);
    CREATE TABLE public.personal_plan_result_returns (id uuid PRIMARY KEY, lead_id uuid);
    CREATE TABLE public.personal_plan_quiz_drafts (id uuid PRIMARY KEY, funnel_session_id uuid);
    CREATE TABLE public.personal_plan_test_members (id uuid PRIMARY KEY, campaign_id uuid, user_id uuid);
    CREATE TABLE public.personal_plan_test_enrollments (id uuid PRIMARY KEY, user_id uuid);
    CREATE TABLE public.regular_quiz_test_enrollments (id uuid PRIMARY KEY, user_id uuid);
    CREATE TABLE public.checkout_activation_claims (session_hash text PRIMARY KEY, user_id uuid);
    CREATE TABLE public.scan_wishlist (id uuid PRIMARY KEY, user_id uuid);
    CREATE TABLE public.scan_resolve_events (id uuid PRIMARY KEY, user_id uuid);
    CREATE TABLE public.routine_logs (id uuid PRIMARY KEY, user_id uuid);
    CREATE TABLE public.routine_log_products (id uuid PRIMARY KEY, routine_log_id uuid);
    CREATE TABLE public.tracker_nudge_dismissals (id uuid PRIMARY KEY, user_id uuid);
    CREATE TABLE public.dismissed_suggestions (id uuid PRIMARY KEY, user_id uuid);
    CREATE TABLE public.personal_plan_ui_lifecycle_marks (id uuid PRIMARY KEY, user_id uuid);
    CREATE TABLE public.messages (id uuid PRIMARY KEY, conversation_id uuid);
    CREATE TABLE public.conversation_turn_traces (id uuid PRIMARY KEY, user_id uuid, conversation_id uuid);
    CREATE TABLE public.conversation_states (conversation_id uuid PRIMARY KEY, user_id uuid);
    CREATE TABLE public.conversations (id uuid PRIMARY KEY, user_id uuid);
    CREATE TABLE public.beta_feedback (id uuid PRIMARY KEY, user_id uuid);
    CREATE TABLE public.product_submissions (id uuid PRIMARY KEY, user_id uuid);
    CREATE TABLE public.user_product_usage (id uuid PRIMARY KEY, user_id uuid);
    CREATE TABLE public.personal_plan_routine_source_change_outbox (id uuid PRIMARY KEY, user_id uuid);
    CREATE TABLE public.personal_plan_routine_proposals (id uuid PRIMARY KEY, user_id uuid);
    CREATE TABLE public.personal_plan_routine_versions (id uuid PRIMARY KEY, user_id uuid);
    CREATE TABLE public.personal_plan_portfolio_versions (id uuid PRIMARY KEY, user_id uuid);
    CREATE TABLE public.personal_plan_product_drafts (id uuid PRIMARY KEY, user_id uuid);
    CREATE TABLE public.personal_plan_refinement_drafts (id uuid PRIMARY KEY, user_id uuid);
    CREATE TABLE public.personal_plan_need_versions (id uuid PRIMARY KEY, user_id uuid);
    CREATE TABLE public.personal_plans (
      id uuid PRIMARY KEY,
      user_id uuid,
      current_initial_need_version_id uuid,
      current_refined_need_version_id uuid,
      active_routine_version_id uuid,
      pending_routine_proposal_id uuid
    );
    CREATE TABLE public.user_products (id uuid PRIMARY KEY, user_id uuid);
    CREATE TABLE public.personal_plan_prepared_artifacts (id uuid PRIMARY KEY, user_id uuid, lead_id uuid);
    CREATE TABLE public.hair_profiles (id uuid PRIMARY KEY, user_id uuid, conversation_memory text);
    CREATE TABLE public.manual_access_grants (id uuid PRIMARY KEY, user_id uuid, email text, reason text, expires_at timestamptz, revoked_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE public.billing_one_time_purchases (id uuid PRIMARY KEY, user_id uuid);
    CREATE TABLE public.billing_subscriptions (id uuid PRIMARY KEY, user_id uuid);
    CREATE TABLE public.billing_subscription_plan_changes (id uuid PRIMARY KEY, user_id uuid);
    CREATE TABLE public.billing_analytics_outbox (id uuid PRIMARY KEY, user_id uuid);
    CREATE TABLE public.membership_reactivation_checkout_reservations (id uuid PRIMARY KEY, user_id uuid);
    CREATE TABLE public.payment_support_cases (id uuid PRIMARY KEY, user_id uuid);
    CREATE TABLE public.paypal_checkout_intents (id uuid PRIMARY KEY, user_id uuid, email text);
    CREATE TABLE public.paypal_order_intents (id uuid PRIMARY KEY, user_id uuid, email text);
    CREATE TABLE public.billing_subscriptions_backup_20260822 (id uuid PRIMARY KEY, user_id uuid);
    CREATE TABLE public.profiles_backup_20260822 (id uuid PRIMARY KEY, email text);
    CREATE TABLE public.personal_plan_one_time_checkout_consents (id uuid PRIMARY KEY, user_id uuid, lead_id uuid);
    CREATE TABLE public.personal_plan_one_time_fulfillment_jobs (id uuid PRIMARY KEY, purchase_id uuid, consent_id uuid);
  `)
}

async function seedSyntheticOldState(pg: PGlite) {
  await pg.query(
    "INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data) VALUES ($1, $2, $3::jsonb, $4::jsonb)",
    [
      USER_ID,
      EMAIL,
      JSON.stringify({
        provider: "email",
        access_kind: "field_test",
        field_test_flow: "personal_plan",
        quiz_lead_id: "legacy",
      }),
      JSON.stringify({ email_verified: true, manual_access_reason: "June moderator" }),
    ],
  )
  await pg.query(
    "INSERT INTO public.profiles (id, email, full_name, is_admin, onboarding_completed, onboarding_step, message_count_this_month) VALUES ($1, $2, 'Legacy Name', true, true, 'legacy', 42)",
    [USER_ID, EMAIL],
  )
  await pg.query(
    "INSERT INTO public.leads (id, user_id, email) VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', $1, $2)",
    [USER_ID, EMAIL],
  )
  await pg.query(
    "INSERT INTO public.funnel_sessions (id, user_id, lead_id) VALUES ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', $1, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')",
    [USER_ID],
  )
  await pg.query(
    "INSERT INTO public.conversations (id, user_id) VALUES ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', $1), ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', $2)",
    [USER_ID, OTHER_USER_ID],
  )
  const singleUserTables = RESET_TABLES.filter(
    (entry) =>
      entry.disposition === "delete" &&
      ![
        "public.leads",
        "public.funnel_sessions",
        "public.conversations",
        "public.conversation_turn_traces",
        "public.messages",
        "public.conversation_states",
        "public.routine_log_products",
        "public.customerio_profile_sync_outbox",
        "public.personal_plan_quiz_drafts",
        "public.personal_plan_result_returns",
        "public.funnel_events",
        "public.checkout_activation_claims",
      ].includes(entry.table),
  )
  for (const [index, entry] of singleUserTables.entries()) {
    await pg.query(`INSERT INTO ${entry.table} (id, user_id) VALUES ($1, $2)`, [
      syntheticUuid(index),
      USER_ID,
    ])
  }
  await pg.query(
    "INSERT INTO public.messages (id, conversation_id) VALUES ($1, 'cccccccc-cccc-4ccc-8ccc-cccccccccccc')",
    [syntheticUuid(90)],
  )
  await pg.query(
    "INSERT INTO public.conversation_turn_traces (id, user_id, conversation_id) VALUES ($1, $2, 'cccccccc-cccc-4ccc-8ccc-cccccccccccc')",
    [syntheticUuid(91), USER_ID],
  )
  await pg.query(
    "INSERT INTO public.conversation_states (conversation_id, user_id) VALUES ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', $1)",
    [USER_ID],
  )
  await pg.query(
    "INSERT INTO public.routine_log_products (id, routine_log_id) VALUES ($1, (SELECT id FROM public.routine_logs WHERE user_id = $2 LIMIT 1))",
    [syntheticUuid(91), USER_ID],
  )
  await pg.query(
    "INSERT INTO public.customerio_profile_sync_outbox (lead_id) VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')",
  )
  await pg.query(
    "INSERT INTO public.personal_plan_quiz_drafts (id, funnel_session_id) VALUES ($1, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')",
    [syntheticUuid(92)],
  )
  await pg.query(
    "INSERT INTO public.personal_plan_result_returns (id, lead_id) VALUES ($1, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')",
    [syntheticUuid(93)],
  )
  await pg.query(
    "INSERT INTO public.funnel_events (event_id, funnel_session_id, lead_id) VALUES ('event-1', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')",
  )
  await pg.query(
    "INSERT INTO public.checkout_activation_claims (session_hash, user_id) VALUES ('session-hash', $1)",
    [USER_ID],
  )
  await pg.query(
    "INSERT INTO public.manual_access_grants (id, user_id, email) VALUES ($1, $2, $3)",
    [GRANT_ID, USER_ID, EMAIL],
  )
}

function syntheticUuid(index: number): string {
  return `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`
}
