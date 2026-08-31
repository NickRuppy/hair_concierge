import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { parsePersonalPlanMigrationAdmission } from "../src/lib/personal-plan/migration-admission"
import { predecessorSchemaSql } from "./personal-plan-migration-admission.fixtures"

import { PGlite } from "@electric-sql/pglite"
import { uuid_ossp } from "@electric-sql/pglite/contrib/uuid_ossp"

const migrationPath =
  "supabase/migrations/20260828104243_personal_plan_paid_migration_admission.sql"

const ids = {
  user: "11111111-1111-4111-8111-111111111111",
  otherUser: "22222222-2222-4222-8222-222222222222",
  subscription: "33333333-3333-4333-8333-333333333333",
  fallbackSubscription: "34343434-3434-4434-8434-343434343434",
  oneTimePurchase: "44444444-4444-4444-8444-444444444444",
  consent: "45454545-4545-4545-8545-454545454545",
  funnel: "55555555-5555-4555-8555-555555555555",
  lead: "66666666-6666-4666-8666-666666666666",
  secondLead: "67676767-6767-4767-8767-676767676767",
  otherLead: "77777777-7777-4777-8777-777777777777",
  enrollment: "88888888-8888-4888-8888-888888888888",
  campaign: "89898989-8989-4989-8989-898989898989",
  grant: "90909090-9090-4090-9090-909090909090",
}

test("resolve is read-only and admits current paid sources without manual grants", async (t) => {
  const pg = await migratedDatabase(t)
  await seedProfile(pg, ids.user)
  await seedProfile(pg, ids.otherUser)
  await seedSubscription(pg, {
    id: ids.subscription,
    userId: ids.user,
    status: "active",
    periodEnd: null,
  })
  await pg.query(
    "INSERT INTO public.manual_access_grants (id, user_id, reason, expires_at) VALUES ($1, $2, 'tester', '2100-01-01T00:00:00Z')",
    [ids.enrollment, ids.otherUser],
  )

  const resolved = await resolveAdmission(pg, ids.user)
  assert.deepEqual(resolved, {
    admission_kind: "billing_subscription",
    admission_source_id: ids.subscription,
    status: "candidate",
  })

  const manualOnly = await resolveAdmission(pg, ids.otherUser)
  assert.deepEqual(manualOnly, { status: "ineligible" })

  const enrollments = await pg.query<{ count: string }>(
    "SELECT count(*)::text AS count FROM public.personal_plan_migration_enrollments",
  )
  assert.equal(enrollments.rows[0]!.count, "0", "GET-style resolve must not create state")
})

test("begin binds a unique owned legacy source and Stage 1 accepts only that ready migration", async (t) => {
  const pg = await migratedDatabase(t)
  await seedProfile(pg, ids.user)
  await seedSubscription(pg, {
    id: ids.subscription,
    userId: ids.user,
    status: "active",
    periodEnd: "2100-01-01T00:00:00Z",
  })
  await seedLead(pg, ids.lead, ids.user)
  await seedLead(pg, ids.secondLead, ids.user)

  const begun = await beginMigration(pg, ids.user, ids.lead)
  assert.equal(begun.status, "ready")
  assert.equal(parsePersonalPlanMigrationAdmission(begun).status, "ready")
  assert.equal(begun.admission_kind, "billing_subscription")
  assert.equal(begun.admission_source_id, ids.subscription)
  assert.equal(begun.lead_id, ids.lead)
  assert.ok(begun.enrollment_id)

  const replacedBeforeStage1 = await beginMigration(pg, ids.user, ids.secondLead)
  assert.equal(replacedBeforeStage1.status, "ready")
  assert.equal(replacedBeforeStage1.lead_id, ids.secondLead)

  const restoredBeforeStage1 = await beginMigration(pg, ids.user, ids.lead)
  assert.equal(restoredBeforeStage1.lead_id, ids.lead)

  const routing = await ownRoutingSource(pg, ids.user)
  assert.equal(routing.source_kind, "migration")
  assert.equal(routing.migration_status, "ready")
  assert.equal(routing.source_id, restoredBeforeStage1.enrollment_id)
  assert.equal(routing.lead_id, ids.lead)
  assert.equal(routing.quiz_source_kind, "legacy")

  const created = await createInitialNeed(pg, {
    userId: ids.user,
    enrollmentId: restoredBeforeStage1.enrollment_id,
    leadId: ids.lead,
    inputHash: "a".repeat(64),
  })
  assert.equal(created.outcome, "completed")
  assert.ok(created.personalPlanId)

  const recomputed = await createInitialNeed(pg, {
    userId: ids.user,
    enrollmentId: restoredBeforeStage1.enrollment_id,
    leadId: ids.lead,
    inputHash: "c".repeat(64),
  })
  assert.equal(recomputed.outcome, "completed")
  assert.equal(
    recomputed.needVersionId,
    created.needVersionId,
    "migration return must not reset an already-created initial Plan",
  )
  const needVersions = await pg.query<{ count: string }>(
    "SELECT count(*)::text AS count FROM public.personal_plan_need_versions",
  )
  assert.equal(needVersions.rows[0]!.count, "1")

  const replacementAfterStage1 = await beginMigration(pg, ids.user, ids.secondLead)
  assert.equal(replacementAfterStage1.status, "ready")
  assert.equal(
    replacementAfterStage1.lead_id,
    ids.lead,
    "after Stage 1, begin/retry must not silently replace the bound quiz source",
  )

  const forgedLead = await createInitialNeed(pg, {
    userId: ids.user,
    enrollmentId: restoredBeforeStage1.enrollment_id,
    leadId: ids.otherLead,
    inputHash: "b".repeat(64),
  })
  assert.deepEqual(forgedLead, {
    outcome: "invalid_source",
    reasonCode: "migration_source_mismatch",
  })

  await seedProfile(pg, ids.otherUser)
  await seedLead(pg, ids.otherLead, ids.otherUser)
  await pg.query(
    `
      INSERT INTO public.personal_plan_migration_enrollments
        (id, user_id, admission_kind, admission_source_id, status, lead_id, bound_at)
      VALUES
        ($1, $2, 'legacy_profile', $2, 'ready', $3, pg_catalog.now())
    `,
    [ids.enrollment, ids.otherUser, ids.otherLead],
  )
  const foreignEnrollment = await createInitialNeed(pg, {
    userId: ids.user,
    enrollmentId: ids.enrollment,
    leadId: ids.lead,
    inputHash: "d".repeat(64),
  })
  assert.deepEqual(foreignEnrollment, {
    outcome: "invalid_source",
    reasonCode: "migration_source_mismatch",
  })
})

test("paid parity covers one-time access and legacy profile fallback", async (t) => {
  const oneTimeDb = await migratedDatabase(t)
  await seedProfile(oneTimeDb, ids.user)
  await seedLead(oneTimeDb, ids.lead, ids.user)
  await seedOneTimePurchase(oneTimeDb, ids.user, ids.lead)

  const oneTime = await beginMigration(oneTimeDb, ids.user)
  assert.equal(oneTime.status, "ready")
  assert.equal(oneTime.admission_kind, "one_time_purchase")
  assert.equal(oneTime.admission_source_id, ids.oneTimePurchase)
  assert.equal(oneTime.lead_id, ids.lead)

  const oneTimeRouting = await ownRoutingSource(oneTimeDb, ids.user)
  assert.equal(oneTimeRouting.source_kind, "migration")
  assert.equal(oneTimeRouting.source_id, oneTime.enrollment_id)

  const profileDb = await migratedDatabase(t)
  await seedProfile(profileDb, ids.user, {
    subscriptionStatus: "active",
    currentPeriodEnd: null,
  })
  const profile = await resolveAdmission(profileDb, ids.user)
  assert.deepEqual(profile, {
    admission_kind: "legacy_profile",
    admission_source_id: ids.user,
    status: "candidate",
  })

  const canceledDb = await migratedDatabase(t)
  await seedProfile(canceledDb, ids.user)
  await seedSubscription(canceledDb, {
    id: ids.subscription,
    userId: ids.user,
    status: "canceled",
    periodEnd: "2100-01-01T00:00:00Z",
    cancelAtPeriodEnd: false,
  })
  assert.deepEqual(await resolveAdmission(canceledDb, ids.user), { status: "ineligible" })
})

test("migration Stage 1 accepts a bound personal-plan artifact source", async (t) => {
  const pg = await migratedDatabase(t)
  await seedProfile(pg, ids.user)
  await seedSubscription(pg, {
    id: ids.subscription,
    userId: ids.user,
    status: "active",
    periodEnd: "2100-01-01T00:00:00Z",
  })
  await seedLead(pg, ids.lead, ids.user, { quizKind: "personal_plan" })
  await pg.query(
    `
      INSERT INTO public.personal_plan_prepared_artifacts (id, user_id, lead_id, status)
      VALUES ($1, $2, $3, 'attached')
    `,
    [ids.consent, ids.user, ids.lead],
  )

  const begun = await beginMigration(pg, ids.user)
  assert.equal(begun.status, "ready")
  assert.equal(begun.lead_id, ids.lead)

  const created = await createInitialNeedFromArtifact(pg, {
    userId: ids.user,
    enrollmentId: begun.enrollment_id,
    artifactId: ids.consent,
    inputHash: "e".repeat(64),
  })
  assert.equal(created.outcome, "completed")
})

test("begin does not guess between ambiguous owned legacy leads and accepts explicit owned leads", async (t) => {
  const pg = await migratedDatabase(t)
  await seedProfile(pg, ids.user)
  await seedSubscription(pg, {
    id: ids.subscription,
    userId: ids.user,
    status: "past_due",
    periodEnd: "2100-01-01T00:00:00Z",
  })
  await seedLead(pg, ids.lead, ids.user)
  await seedLead(pg, ids.secondLead, ids.user)

  const pending = await beginMigration(pg, ids.user)
  assert.equal(pending.status, "pending_source")
  assert.equal(parsePersonalPlanMigrationAdmission(pending).status, "pending_source")
  assert.equal(pending.lead_id, null)

  const explicit = await beginMigration(pg, ids.user, ids.secondLead)
  assert.equal(explicit.status, "ready")
  assert.equal(explicit.lead_id, ids.secondLead)

  const explicitDb = await migratedDatabase(t)
  await seedProfile(explicitDb, ids.user)
  await seedSubscription(explicitDb, {
    id: ids.subscription,
    userId: ids.user,
    status: "active",
    periodEnd: "2100-01-01T00:00:00Z",
  })
  await seedLead(explicitDb, ids.lead, ids.user, { status: "captured" })

  const explicitCaptured = await beginMigration(explicitDb, ids.user, ids.lead)
  assert.equal(explicitCaptured.status, "ready")
  assert.equal(explicitCaptured.lead_id, ids.lead)
})

test("existing field-test routing still wins over a migration candidate", async (t) => {
  const pg = await migratedDatabase(t)
  await seedProfile(pg, ids.user)
  await seedSubscription(pg, {
    id: ids.subscription,
    userId: ids.user,
    status: "active",
    periodEnd: "2100-01-01T00:00:00Z",
  })
  await seedLead(pg, ids.lead, ids.user, { moderatorCampaignId: ids.campaign })
  await pg.query(
    "INSERT INTO public.manual_access_grants (id, user_id, reason, expires_at) VALUES ($1, $2, 'tester', '2100-01-01T00:00:00Z')",
    [ids.grant, ids.user],
  )
  await pg.query(
    `
      INSERT INTO public.personal_plan_test_enrollments
        (id, campaign_id, lead_id, user_id, manual_access_grant_id, prepared_artifact_id,
         quiz_source_kind, status, expires_at)
      VALUES
        ($1, $2, $3, $4, $5, NULL, 'legacy', 'active', '2100-01-01T00:00:00Z')
    `,
    [ids.enrollment, ids.campaign, ids.lead, ids.user, ids.grant],
  )
  await pg.query(
    `
      INSERT INTO public.personal_plan_test_members (campaign_id, user_id, enrollment_id, status)
      VALUES ($1, $2, $3, 'activated')
    `,
    [ids.campaign, ids.user, ids.enrollment],
  )

  const routing = await ownRoutingSource(pg, ids.user)
  assert.equal(routing.source_kind, "field_test")
  assert.equal(routing.source_id, ids.enrollment)
  assert.equal(routing.lead_id, ids.lead)
  assert.equal(routing.quiz_source_kind, "legacy")

  const enrollments = await pg.query<{ count: string }>(
    "SELECT count(*)::text AS count FROM public.personal_plan_migration_enrollments",
  )
  assert.equal(enrollments.rows[0]!.count, "0")
})

test("begin rejects wrong-owner leads and readmits a stale enrollment to the current paid authority", async (t) => {
  const pg = await migratedDatabase(t)
  await seedProfile(pg, ids.user)
  await seedProfile(pg, ids.otherUser)
  await seedLead(pg, ids.lead, ids.user)
  await seedLead(pg, ids.otherLead, ids.otherUser)
  await seedSubscription(pg, {
    id: ids.subscription,
    userId: ids.user,
    status: "active",
    periodEnd: "2000-01-01T00:00:00Z",
  })
  await seedSubscription(pg, {
    id: ids.fallbackSubscription,
    userId: ids.user,
    status: "active",
    periodEnd: "2100-01-01T00:00:00Z",
  })

  const wrongOwner = await beginMigration(pg, ids.user, ids.otherLead)
  assert.equal(wrongOwner.status, "pending_source")
  assert.equal(wrongOwner.lead_id, null)

  const explicit = await beginMigration(pg, ids.user, ids.lead)
  assert.equal(explicit.status, "ready")
  assert.equal(explicit.admission_source_id, ids.fallbackSubscription)

  await pg.query(
    "UPDATE public.personal_plan_migration_enrollments SET admission_source_id = $1 WHERE id = $2",
    [ids.subscription, explicit.enrollment_id],
  )
  const resolvedStale = await resolveAdmission(pg, ids.user)
  assert.equal(resolvedStale.admission_source_id, ids.fallbackSubscription)
  assert.equal(typeof resolvedStale.admitted_at, "string")
  assert.equal(resolvedStale.quiz_source_kind, "legacy")

  const readmitted = await beginMigration(pg, ids.user)
  assert.equal(readmitted.status, "ready")
  assert.equal(readmitted.lead_id, ids.lead)
  assert.equal(readmitted.admission_source_id, ids.fallbackSubscription)
})

test("begin does not create a migration ledger for an existing non-migration Plan", async (t) => {
  const pg = await migratedDatabase(t)
  await seedProfile(pg, ids.user)
  await seedSubscription(pg, {
    id: ids.subscription,
    userId: ids.user,
    status: "active",
    periodEnd: "2100-01-01T00:00:00Z",
  })
  await pg.query(
    `
      INSERT INTO public.personal_plans
        (user_id, enrollment_purchase_source_id, current_initial_need_version_id)
      VALUES ($1, $2, $3)
    `,
    [ids.user, ids.subscription, ids.lead],
  )

  const begun = await beginMigration(pg, ids.user)
  assert.deepEqual(begun, { status: "ineligible" })

  const enrollments = await pg.query<{ count: string }>(
    "SELECT count(*)::text AS count FROM public.personal_plan_migration_enrollments",
  )
  assert.equal(enrollments.rows[0]!.count, "0")
})

test("new admission functions and table remain service-only", async (t) => {
  const pg = await migratedDatabase(t)

  const privileges = await pg.query<{
    anon_resolve: boolean
    authenticated_begin: boolean
    service_begin: boolean
    authenticated_save: boolean
    service_save: boolean
    anon_table_insert: boolean
  }>(
    `
      SELECT
        has_function_privilege('anon', 'public.personal_plan_resolve_migration_admission(uuid)', 'EXECUTE') AS anon_resolve,
        has_function_privilege('authenticated', 'public.personal_plan_begin_or_bind_migration(uuid,uuid)', 'EXECUTE') AS authenticated_begin,
        has_function_privilege('service_role', 'public.personal_plan_begin_or_bind_migration(uuid,uuid)', 'EXECUTE') AS service_begin,
        has_function_privilege('authenticated', 'public.personal_plan_save_migration_quiz_lead(uuid,uuid,text,text,boolean,jsonb)', 'EXECUTE') AS authenticated_save,
        has_function_privilege('service_role', 'public.personal_plan_save_migration_quiz_lead(uuid,uuid,text,text,boolean,jsonb)', 'EXECUTE') AS service_save,
        has_table_privilege('anon', 'public.personal_plan_migration_enrollments', 'INSERT') AS anon_table_insert
    `,
  )
  assert.deepEqual(privileges.rows[0], {
    anon_resolve: false,
    authenticated_begin: false,
    service_begin: true,
    authenticated_save: false,
    service_save: true,
    anon_table_insert: false,
  })
})

test("save migration quiz creates a fresh bound legacy lead and reuses exact retries", async (t) => {
  const pg = await migratedDatabase(t)
  await seedAuthUser(pg, ids.user, "buyer@example.test")
  await seedProfile(pg, ids.user, { email: "buyer@example.test" })
  await seedSubscription(pg, {
    id: ids.subscription,
    userId: ids.user,
    status: "active",
    periodEnd: "2100-01-01T00:00:00Z",
  })
  const begun = await beginMigration(pg, ids.user)
  assert.equal(begun.status, "pending_source")

  const first = await saveMigrationQuizLead(pg, {
    userId: ids.user,
    enrollmentId: begun.enrollment_id,
    name: "Nick",
    email: "buyer@example.test",
    marketingConsent: false,
    quizAnswers: { structure: "wavy" },
  })
  assert.equal(first.status, "saved")
  assert.equal(typeof first.lead_id, "string")

  const retry = await saveMigrationQuizLead(pg, {
    userId: ids.user,
    enrollmentId: begun.enrollment_id,
    name: "Nick",
    email: "buyer@example.test",
    marketingConsent: false,
    quizAnswers: { structure: "wavy" },
  })
  assert.deepEqual(retry, first)

  const enrollment = await pg.query<{ status: string; lead_id: string }>(
    "SELECT status, lead_id FROM public.personal_plan_migration_enrollments WHERE id = $1",
    [begun.enrollment_id],
  )
  assert.deepEqual(enrollment.rows[0], { status: "ready", lead_id: first.lead_id })

  const lead = await pg.query<{
    user_id: string
    quiz_kind: string
    status: string
    email: string
    quiz_answers: Record<string, unknown>
    name: string
    marketing_consent: boolean
  }>(
    "SELECT user_id, quiz_kind, status, email, quiz_answers, name, marketing_consent FROM public.leads WHERE id = $1",
    [first.lead_id],
  )
  assert.deepEqual(lead.rows[0], {
    user_id: ids.user,
    quiz_kind: "legacy",
    status: "linked",
    email: "buyer@example.test",
    quiz_answers: { structure: "wavy" },
    name: "Nick",
    marketing_consent: false,
  })

  const leadCount = await pg.query<{ count: string }>(
    "SELECT count(*)::text AS count FROM public.leads WHERE user_id = $1",
    [ids.user],
  )
  assert.equal(leadCount.rows[0]!.count, "1")
})

test("save migration quiz can replace an incomplete ready source without mutating the old lead", async (t) => {
  const pg = await migratedDatabase(t)
  await seedAuthUser(pg, ids.user, "buyer@example.test")
  await seedProfile(pg, ids.user, { email: "buyer@example.test" })
  await seedSubscription(pg, {
    id: ids.subscription,
    userId: ids.user,
    status: "active",
    periodEnd: "2100-01-01T00:00:00Z",
  })
  await seedLead(pg, ids.lead, ids.user)
  const begun = await beginMigration(pg, ids.user, ids.lead)
  assert.equal(begun.status, "ready")

  const saved = await saveMigrationQuizLead(pg, {
    userId: ids.user,
    enrollmentId: begun.enrollment_id,
    name: "Nick",
    email: "buyer@example.test",
    marketingConsent: true,
    quizAnswers: { structure: "curly" },
  })
  assert.equal(saved.status, "saved")
  assert.notEqual(saved.lead_id, ids.lead)

  const enrollment = await pg.query<{ lead_id: string }>(
    "SELECT lead_id FROM public.personal_plan_migration_enrollments WHERE id = $1",
    [begun.enrollment_id],
  )
  assert.equal(enrollment.rows[0]!.lead_id, saved.lead_id)

  const oldLead = await pg.query<{ quiz_answers: Record<string, unknown>; status: string }>(
    "SELECT quiz_answers, status FROM public.leads WHERE id = $1",
    [ids.lead],
  )
  assert.deepEqual(oldLead.rows[0], { quiz_answers: {}, status: "linked" })
})

test("save migration quiz can recover from a bound unused personal-plan source", async (t) => {
  const pg = await migratedDatabase(t)
  await seedAuthUser(pg, ids.user, "buyer@example.test")
  await seedProfile(pg, ids.user, { email: "buyer@example.test" })
  await seedSubscription(pg, {
    id: ids.subscription,
    userId: ids.user,
    status: "active",
    periodEnd: "2100-01-01T00:00:00Z",
  })
  await seedLead(pg, ids.lead, ids.user, { quizKind: "personal_plan" })
  const begun = await beginMigration(pg, ids.user, ids.lead)
  assert.equal(begun.status, "ready")
  assert.equal(begun.quiz_source_kind, "personal_plan")

  const saved = await saveMigrationQuizLead(pg, {
    userId: ids.user,
    enrollmentId: begun.enrollment_id,
    name: "Nick",
    email: "buyer@example.test",
    marketingConsent: false,
    quizAnswers: { structure: "wavy" },
  })
  assert.equal(saved.status, "saved")
  assert.notEqual(saved.lead_id, ids.lead)

  const leads = await pg.query<{
    id: string
    quiz_kind: string
    quiz_answers: Record<string, unknown>
  }>(
    "SELECT id, quiz_kind, quiz_answers FROM public.leads WHERE user_id = $1 ORDER BY created_at, id",
    [ids.user],
  )
  assert.deepEqual(leads.rows, [
    { id: ids.lead, quiz_kind: "personal_plan", quiz_answers: {} },
    { id: saved.lead_id!, quiz_kind: "legacy", quiz_answers: { structure: "wavy" } },
  ])
})

test("save migration quiz rejects other owners, expired access, email mismatch, and after Stage 1", async (t) => {
  const pg = await migratedDatabase(t)
  await seedAuthUser(pg, ids.user, "buyer@example.test")
  await seedAuthUser(pg, ids.otherUser, "other@example.test")
  await seedProfile(pg, ids.user, { email: "buyer@example.test" })
  await seedProfile(pg, ids.otherUser, { email: "other@example.test" })
  await seedSubscription(pg, {
    id: ids.subscription,
    userId: ids.user,
    status: "active",
    periodEnd: "2100-01-01T00:00:00Z",
  })
  await seedSubscription(pg, {
    id: ids.fallbackSubscription,
    userId: ids.otherUser,
    status: "active",
    periodEnd: "2100-01-01T00:00:00Z",
  })
  const userEnrollment = await beginMigration(pg, ids.user)
  const otherEnrollment = await beginMigration(pg, ids.otherUser)

  assert.deepEqual(
    await saveMigrationQuizLead(pg, {
      userId: ids.user,
      enrollmentId: otherEnrollment.enrollment_id,
      name: "Nick",
      email: "buyer@example.test",
      marketingConsent: false,
      quizAnswers: { structure: "wavy" },
    }),
    { status: "invalid_context" },
  )

  assert.deepEqual(
    await saveMigrationQuizLead(pg, {
      userId: ids.user,
      enrollmentId: userEnrollment.enrollment_id,
      name: "Nick",
      email: "other@example.test",
      marketingConsent: false,
      quizAnswers: { structure: "wavy" },
    }),
    { status: "invalid_context" },
  )

  await pg.query(
    "UPDATE public.billing_subscriptions SET current_period_end = '2000-01-01T00:00:00Z' WHERE id = $1",
    [ids.subscription],
  )
  assert.deepEqual(
    await saveMigrationQuizLead(pg, {
      userId: ids.user,
      enrollmentId: userEnrollment.enrollment_id,
      name: "Nick",
      email: "buyer@example.test",
      marketingConsent: false,
      quizAnswers: { structure: "wavy" },
    }),
    { status: "invalid_context" },
  )

  await pg.query(
    "UPDATE public.billing_subscriptions SET current_period_end = '2100-01-01T00:00:00Z' WHERE id = $1",
    [ids.subscription],
  )
  const saved = await saveMigrationQuizLead(pg, {
    userId: ids.user,
    enrollmentId: userEnrollment.enrollment_id,
    name: "Nick",
    email: "buyer@example.test",
    marketingConsent: false,
    quizAnswers: { structure: "wavy" },
  })
  assert.equal(saved.status, "saved")
  assert.ok(saved.lead_id)

  await createInitialNeed(pg, {
    userId: ids.user,
    enrollmentId: userEnrollment.enrollment_id,
    leadId: saved.lead_id,
    inputHash: "f".repeat(64),
  })
  assert.deepEqual(
    await saveMigrationQuizLead(pg, {
      userId: ids.user,
      enrollmentId: userEnrollment.enrollment_id,
      name: "Nick Changed",
      email: "buyer@example.test",
      marketingConsent: false,
      quizAnswers: { structure: "straight" },
    }),
    { status: "invalid_context" },
  )
})

test("pending migration enrollments cannot carry a quiz source", async (t) => {
  const pg = await migratedDatabase(t)
  await seedAuthUser(pg, ids.user, "buyer@example.test")
  await seedProfile(pg, ids.user, { email: "buyer@example.test" })
  await seedLead(pg, ids.lead, ids.user)

  await assert.rejects(
    pg.query(
      `
        INSERT INTO public.personal_plan_migration_enrollments
          (user_id, admission_kind, admission_source_id, status, lead_id)
        VALUES
          ($1, 'legacy_profile', $1, 'pending_source', $2)
      `,
      [ids.user, ids.lead],
    ),
    /violates check constraint/,
  )
})

async function migratedDatabase(t: { after: (fn: () => Promise<void>) => void }) {
  const pg = new PGlite({ extensions: { uuid_ossp } })
  t.after(async () => {
    await pg.close()
  })
  await pg.exec(predecessorSchemaSql)
  await pg.exec(await readFile(migrationPath, "utf8"))
  return pg
}

async function seedAuthUser(pg: PGlite, userId: string, email: string) {
  await pg.query(
    "INSERT INTO auth.users (id, email, email_confirmed_at) VALUES ($1, $2, pg_catalog.now())",
    [userId, email],
  )
}

async function seedProfile(
  pg: PGlite,
  userId: string,
  input: {
    subscriptionStatus?: string | null
    currentPeriodEnd?: string | null
    email?: string
  } = {},
) {
  await pg.query(
    `
      INSERT INTO public.profiles (id, email, subscription_status, current_period_end)
      VALUES ($1, $2, $3, $4)
    `,
    [
      userId,
      input.email ?? `${userId.slice(0, 8)}@example.test`,
      input.subscriptionStatus ?? null,
      input.currentPeriodEnd ?? null,
    ],
  )
}

async function seedSubscription(
  pg: PGlite,
  input: {
    id: string
    userId: string
    status: string
    periodEnd: string | null
    cancelAtPeriodEnd?: boolean
  },
) {
  await pg.query(
    `
      INSERT INTO public.billing_subscriptions
        (id, user_id, provider, provider_subscription_id, provider_status, entitlement_status, current_period_end, cancel_at_period_end)
      VALUES ($1, $2, 'stripe', $3, $4, $4, $5, $6)
    `,
    [
      input.id,
      input.userId,
      `sub_${input.id.slice(0, 8)}`,
      input.status,
      input.periodEnd,
      input.cancelAtPeriodEnd ?? false,
    ],
  )
}

async function seedOneTimePurchase(pg: PGlite, userId: string, leadId: string) {
  await pg.query("INSERT INTO public.funnel_sessions (id, lead_id, user_id) VALUES ($1, $2, $3)", [
    ids.funnel,
    leadId,
    userId,
  ])
  await pg.query(
    `
      INSERT INTO public.personal_plan_one_time_checkout_consents
        (id, lead_id, funnel_session_id, user_id, product_kind, confirmation_status,
         generation_started_at, generation_completed_at, generated_content_sha256,
         delivery_provider, delivery_reference, delivered_at)
      VALUES
        ($1, $2, $3, $4, 'personal_plan_once', 'delivered',
         '2026-08-20T00:00:00Z', '2026-08-20T00:00:01Z', repeat('c', 64),
         'customerio', 'delivery-1', '2026-08-20T00:00:02Z')
    `,
    [ids.consent, leadId, ids.funnel, userId],
  )
  await pg.query(
    `
      INSERT INTO public.billing_one_time_purchases
        (id, user_id, provider, product_kind, provider_transaction_id, status, paid_at, consent_id)
      VALUES
        ($1, $2, 'stripe', 'personal_plan_once', 'pi_once', 'paid',
         '2026-08-20T00:00:00Z', $3)
    `,
    [ids.oneTimePurchase, userId, ids.consent],
  )
}

async function seedLead(
  pg: PGlite,
  leadId: string,
  userId: string,
  input: {
    moderatorCampaignId?: string | null
    quizKind?: "legacy" | "personal_plan"
    status?: string
  } = {},
) {
  await pg.query(
    `
      INSERT INTO public.leads
        (id, email, quiz_answers, quiz_kind, status, user_id, moderator_campaign_id)
      VALUES ($1, $2, '{}'::jsonb, $3, $4, $5, $6)
    `,
    [
      leadId,
      `${userId.slice(0, 8)}@example.test`,
      input.quizKind ?? "legacy",
      input.status ?? "linked",
      userId,
      input.moderatorCampaignId ?? null,
    ],
  )
}

async function resolveAdmission(pg: PGlite, userId: string) {
  const { rows } = await pg.query<{ result: Record<string, unknown> }>(
    "SELECT public.personal_plan_resolve_migration_admission($1) AS result",
    [userId],
  )
  return rows[0]!.result
}

async function beginMigration(pg: PGlite, userId: string, leadId: string | null = null) {
  const { rows } = await pg.query<{ result: BeginMigrationResult }>(
    "SELECT public.personal_plan_begin_or_bind_migration($1, $2) AS result",
    [userId, leadId],
  )
  return rows[0]!.result
}

async function saveMigrationQuizLead(
  pg: PGlite,
  input: {
    userId: string
    enrollmentId: string
    name: string
    email: string
    marketingConsent: boolean
    quizAnswers: Record<string, unknown>
  },
) {
  const { rows } = await pg.query<{ result: { status: string; lead_id?: string } }>(
    `
      SELECT public.personal_plan_save_migration_quiz_lead(
        $1::uuid, $2::uuid, $3, $4, $5, $6::jsonb
      ) AS result
    `,
    [
      input.userId,
      input.enrollmentId,
      input.name,
      input.email,
      input.marketingConsent,
      JSON.stringify(input.quizAnswers),
    ],
  )
  return rows[0]!.result
}

type BeginMigrationResult = {
  status: string
  enrollment_id: string
  admission_kind: string
  admission_source_id: string
  lead_id: string | null
  admitted_at: string
  quiz_source_kind: "legacy" | "personal_plan" | null
}

async function ownRoutingSource(pg: PGlite, userId: string) {
  await pg.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [userId])
  const { rows } = await pg.query<{ source: Record<string, unknown> }>(
    "SELECT public.personal_plan_get_own_routing_source() AS source",
  )
  return rows[0]!.source
}

async function createInitialNeed(
  pg: PGlite,
  input: { userId: string; enrollmentId: string; leadId: string; inputHash: string },
) {
  const { rows } = await pg.query<{ result: Record<string, unknown> }>(
    `
      SELECT public.personal_plan_create_or_reuse_initial_need(
        $1::uuid,
        $2::uuid,
        NULL,
        1,
        'v1',
        $3,
        '{}'::jsonb,
        '{}'::jsonb,
        'legacy_quiz_lead',
        $4::uuid
      ) AS result
    `,
    [input.userId, input.enrollmentId, input.inputHash, input.leadId],
  )
  return rows[0]!.result
}

async function createInitialNeedFromArtifact(
  pg: PGlite,
  input: { userId: string; enrollmentId: string; artifactId: string; inputHash: string },
) {
  const { rows } = await pg.query<{ result: Record<string, unknown> }>(
    `
      SELECT public.personal_plan_create_or_reuse_initial_need(
        $1::uuid,
        $2::uuid,
        $3::uuid,
        1,
        'v1',
        $4,
        '{}'::jsonb,
        '{}'::jsonb,
        'personal_plan_artifact',
        NULL
      ) AS result
    `,
    [input.userId, input.enrollmentId, input.artifactId, input.inputHash],
  )
  return rows[0]!.result
}
