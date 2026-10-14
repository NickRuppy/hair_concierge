import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { PGlite } from "@electric-sql/pglite"
import { uuid_ossp } from "@electric-sql/pglite/contrib/uuid_ossp"

import { predecessorSchemaSql } from "./personal-plan-migration-admission.fixtures"

const MIGRATIONS = [
  "supabase/migrations/20260828104243_personal_plan_paid_migration_admission.sql",
  "supabase/migrations/20260914044650_trial_admission_foundation.sql",
  "supabase/migrations/20260914051220_trial_access_projection.sql",
  "supabase/migrations/20260914051731_trial_paid_migration_authority.sql",
] as const

const ids = {
  trial: "11111111-1111-4111-8111-111111111111",
  paid: "22222222-2222-4222-8222-222222222222",
  expired: "33333333-3333-4333-8333-333333333333",
  legacy: "44444444-4444-4444-8444-444444444444",
  oneTime: "55555555-5555-4555-8555-555555555555",
  grace: "66666666-6666-4666-8666-666666666666",
  marker: "77777777-7777-4777-8777-777777777777",
}

async function database(t: { after: (fn: () => Promise<void>) => void }) {
  const pg = new PGlite({ extensions: { uuid_ossp } })
  t.after(() => pg.close())
  await pg.exec(predecessorSchemaSql)
  await pg.exec(`
    ALTER TABLE public.billing_subscriptions
      ADD COLUMN provider_customer_id text,
      ADD COLUMN interval text,
      ADD COLUMN cancelled_at timestamptz,
      ADD COLUMN provider_subscriber_email text,
      ADD COLUMN cancel_scheduled_at timestamptz;
  `)
  for (const migration of MIGRATIONS) await pg.exec(await readFile(migration, "utf8"))
  return pg
}

async function seedProfile(pg: PGlite, userId: string, active = true) {
  await pg.query(
    `INSERT INTO public.profiles (id, email, subscription_status, current_period_end)
     VALUES ($1::uuid, $2, $3, NULL)`,
    [userId, `${userId.slice(0, 8)}@example.test`, active ? "active" : null],
  )
}

async function seedTrialSubscription(
  pg: PGlite,
  userId: string,
  values: {
    firstPayment?: string | null
    paidThrough?: string | null
    graceEnds?: string | null
  } = {},
) {
  const enrollment = `${userId.slice(0, 8)}-aaaa-4aaa-8aaa-aaaaaaaaaaaa`
  const subscription = `${userId.slice(0, 8)}-bbbb-4bbb-8bbb-bbbbbbbbbbbb`
  await pg.query(
    `INSERT INTO public.trial_enrollments (
       id, user_id, accepted_offer, provider, provider_agreement_id, admission_status,
       authorization_succeeded_at, original_trial_end_at, first_payment_succeeded_at,
       paid_through_at, renewal_payment_failed, renewal_grace_ends_at
     ) VALUES (
       $1::uuid, $2::uuid, '{}'::jsonb, 'stripe', $3, 'active',
       pg_catalog.now() - interval '8 days', pg_catalog.now() - interval '1 day',
       $4::timestamptz, $5::timestamptz, $6::boolean, $7::timestamptz
     )`,
    [
      enrollment,
      userId,
      `agreement-${userId.slice(0, 8)}`,
      values.firstPayment ?? null,
      values.paidThrough ?? null,
      values.graceEnds !== undefined,
      values.graceEnds ?? null,
    ],
  )
  await pg.query(
    `INSERT INTO public.billing_subscriptions (
       id, user_id, provider, provider_subscription_id, provider_status, entitlement_status,
       current_period_end, metadata, trial_enrollment_id
     ) VALUES ($1::uuid, $2::uuid, 'stripe', $3, 'active', 'active',
       pg_catalog.now() + interval '30 days', '{"trial_cohort":"trial_v1"}'::jsonb, $4::uuid)`,
    [subscription, userId, `sub-${userId.slice(0, 8)}`, enrollment],
  )
  return subscription
}

async function authority(pg: PGlite, userId: string) {
  const result = await pg.query<{ admission_kind: string; admission_source_id: string }>(
    `SELECT admission_kind, admission_source_id::text
     FROM private.personal_plan_current_paid_migration_authority($1::uuid)`,
    [userId],
  )
  return result.rows
}

test("does not treat an active free trial or stale active profile as historical paid migration authority", async (t) => {
  const pg = await database(t)
  await seedProfile(pg, ids.trial)
  await seedTrialSubscription(pg, ids.trial)
  await seedProfile(pg, ids.marker)
  await pg.query(
    `INSERT INTO public.billing_subscriptions (
       id, user_id, provider, provider_subscription_id, provider_status, entitlement_status,
       current_period_end, metadata
     ) VALUES ('77777777-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid, $1::uuid, 'stripe', 'trial-marker',
       'active', 'active', pg_catalog.now() + interval '30 days', '{"trial_cohort":"trial_v1"}'::jsonb)`,
    [ids.marker],
  )

  assert.deepEqual(await authority(pg, ids.trial), [])
  assert.deepEqual(await authority(pg, ids.marker), [])
})

test("admits only a linked trial with a successful first payment and verified paid access", async (t) => {
  const pg = await database(t)
  await seedProfile(pg, ids.paid)
  const paidSubscription = await seedTrialSubscription(pg, ids.paid, {
    firstPayment: "2020-01-10T00:00:00Z",
    paidThrough: "2100-01-01T00:00:00Z",
  })
  await seedProfile(pg, ids.expired)
  await seedTrialSubscription(pg, ids.expired, {
    firstPayment: "2020-01-10T00:00:00Z",
    paidThrough: "2020-02-10T00:00:00Z",
  })
  await seedProfile(pg, ids.grace)
  const graceSubscription = await seedTrialSubscription(pg, ids.grace, {
    firstPayment: "2020-01-10T00:00:00Z",
    paidThrough: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    graceEnds: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  })

  assert.deepEqual(await authority(pg, ids.paid), [
    { admission_kind: "billing_subscription", admission_source_id: paidSubscription },
  ])
  assert.deepEqual(await authority(pg, ids.expired), [])
  assert.deepEqual(await authority(pg, ids.grace), [
    { admission_kind: "billing_subscription", admission_source_id: graceSubscription },
  ])
  await pg.query(
    'UPDATE public.billing_subscriptions SET metadata = \'{"trial_cohort":""}\'::jsonb WHERE id = $1::uuid',
    [paidSubscription],
  )
  assert.deepEqual(
    await authority(pg, ids.paid),
    [],
    "an unknown marker cannot become paid migration authority",
  )
})

test("keeps independently eligible legacy billing and one-time purchase candidates", async (t) => {
  const pg = await database(t)
  await seedProfile(pg, ids.legacy, false)
  const legacySubscription = "44444444-cccc-4ccc-8ccc-cccccccccccc"
  await pg.query(
    `INSERT INTO public.billing_subscriptions (
       id, user_id, provider, provider_subscription_id, provider_status, entitlement_status, current_period_end, metadata
     ) VALUES ($1::uuid, $2::uuid, 'stripe', 'legacy-sub', 'active', 'active', pg_catalog.now() + interval '1 day', '{}'::jsonb)`,
    [legacySubscription, ids.legacy],
  )

  await seedProfile(pg, ids.oneTime)
  await seedTrialSubscription(pg, ids.oneTime, {
    firstPayment: "2020-01-10T00:00:00Z",
    paidThrough: "2020-02-10T00:00:00Z",
  })
  const consent = "55555555-cccc-4ccc-8ccc-cccccccccccc"
  const purchase = "55555555-dddd-4ddd-8ddd-dddddddddddd"
  const lead = "55555555-eeee-4eee-8eee-eeeeeeeeeeee"
  const funnel = "55555555-ffff-4fff-8fff-ffffffffffff"
  await pg.query(
    "INSERT INTO public.leads (id, email, user_id) VALUES ($1::uuid, 'one-time@example.test', $2::uuid)",
    [lead, ids.oneTime],
  )
  await pg.query(
    "INSERT INTO public.funnel_sessions (id, lead_id, user_id) VALUES ($1::uuid, $2::uuid, $3::uuid)",
    [funnel, lead, ids.oneTime],
  )
  await pg.query(
    `INSERT INTO public.personal_plan_one_time_checkout_consents (
       id, user_id, lead_id, product_kind, confirmation_status, generation_started_at,
       generation_completed_at, generated_content_sha256, delivery_provider, delivery_reference, delivered_at, funnel_session_id
     ) VALUES ($1::uuid, $2::uuid, $3::uuid, 'personal_plan_once', 'delivered', pg_catalog.now(),
       pg_catalog.now(), repeat('a', 64), 'test', 'delivery', pg_catalog.now(), $4::uuid)`,
    [consent, ids.oneTime, lead, funnel],
  )
  await pg.query(
    `INSERT INTO public.billing_one_time_purchases (
       id, user_id, provider_transaction_id, product_kind, status, consent_id
     ) VALUES ($1::uuid, $2::uuid, 'txn', 'personal_plan_once', 'paid', $3::uuid)`,
    [purchase, ids.oneTime, consent],
  )

  assert.deepEqual(await authority(pg, ids.legacy), [
    { admission_kind: "billing_subscription", admission_source_id: legacySubscription },
  ])
  assert.deepEqual(await authority(pg, ids.oneTime), [
    { admission_kind: "one_time_purchase", admission_source_id: purchase },
  ])
})

test("keeps the authority function service-role only", async (t) => {
  const pg = await database(t)
  await pg.exec("SET ROLE authenticated")
  await assert.rejects(
    pg.query("SELECT * FROM private.personal_plan_current_paid_migration_authority($1::uuid)", [
      ids.trial,
    ]),
    /permission denied/,
  )
})
