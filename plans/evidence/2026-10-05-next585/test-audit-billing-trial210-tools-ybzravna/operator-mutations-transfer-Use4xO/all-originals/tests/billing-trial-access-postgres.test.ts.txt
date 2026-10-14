import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { PGlite } from "@electric-sql/pglite"

import { resolveBillingTrialAccess } from "../src/lib/billing/trial-access-projection"
import { createTrialOfferSnapshot } from "../src/lib/billing/trial-offer"
import {
  recordTrialPaymentEvent,
  type TrialPaymentEvent,
} from "../src/lib/billing/trial-payment-events"

const ROOT = new URL("../", import.meta.url)
const MIGRATIONS = [
  "supabase/migrations/20260527_add_billing_subscriptions.sql",
  "supabase/migrations/20260603120000_add_provider_subscriber_email.sql",
  "supabase/migrations/20260716120000_add_billing_cancel_scheduled_at.sql",
  "supabase/migrations/20260822140000_billing_subscriptions_classified_views.sql",
  "supabase/migrations/20260914044650_trial_admission_foundation.sql",
  "supabase/migrations/20260914051220_trial_access_projection.sql",
  "supabase/migrations/20260915145501_trial_access_first_collection_bridge.sql",
  "supabase/migrations/20260915190000_paypal_trial_frozen_end.sql",
] as const
// Collection bridge boundary: TRIAL_END is exactly seven days after
// AUTHORIZED_AT (the Stripe contract), so even though it sits on a UTC midnight
// its window is the next midnight plus two days. A frozen PayPal end (more than
// seven days out, on a midnight) is its own collection start and closes two
// days later.
const COLLECTION_WINDOW_END = "2020-01-11T00:00:00.000Z"
const LEGACY_TRIAL_END = "2020-01-08T10:00:00.000Z"
const LEGACY_COLLECTION_WINDOW_END = "2020-01-11T00:00:00.000Z"
const FROZEN_TRIAL_END = "2020-01-09T00:00:00.000Z"
const FROZEN_COLLECTION_WINDOW_END = "2020-01-11T00:00:00.000Z"
const MUTANT = process.env.TRIAL_ACCESS_MUTANT
const USER = "11111111-1111-4111-8111-111111111111"
const OTHER_USER = "22222222-2222-4222-8222-222222222222"
const LEGACY_USER = "77777777-7777-4777-8777-777777777777"
const COHORT_USER = "88888888-8888-4888-8888-888888888888"
const ENROLLMENT = "33333333-3333-4333-8333-333333333333"
const BILLING = "44444444-4444-4444-8444-444444444444"
const AUTHORIZED_AT = "2020-01-01T00:00:00.000Z"
const TRIAL_END = "2020-01-08T00:00:00.000Z"
const OFFER = createTrialOfferSnapshot("month", {
  monthPriceId: "price_trial_month",
  yearPriceId: "price_trial_year",
  annualCouponId: "coupon_trial_year",
})

async function database(t: { after: (fn: () => Promise<void>) => void }) {
  const pg = new PGlite()
  t.after(() => pg.close())
  await pg.exec(`
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    CREATE TABLE public.profiles (
      id uuid PRIMARY KEY,
      stripe_customer_id text,
      stripe_subscription_id text,
      subscription_status text,
      subscription_interval text,
      current_period_end timestamptz
    );
    GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
  `)
  for (const file of MIGRATIONS) {
    let sql = await readFile(new URL(file, ROOT), "utf8")
    // Harness-only semantic mutant: linked expired trials must never receive the
    // legacy view's grace. It never alters the tracked migration.
    if (MUTANT === "legacy-grace" && file.endsWith("trial_access_projection.sql")) {
      sql = sql.replace("public.trial_enrollment_has_access(e, now())", "true")
    }
    await pg.exec(sql)
  }
  // Supabase's authenticated runtime grants table SELECT; this focused harness
  // supplies that platform baseline while deliberately granting no private table.
  await pg.exec("GRANT SELECT ON public.billing_subscriptions TO authenticated")
  return pg
}

async function seedUser(pg: PGlite, id = USER) {
  await pg.query("INSERT INTO public.profiles (id) VALUES ($1::uuid)", [id])
}

async function seedEnrollment(
  pg: PGlite,
  id = ENROLLMENT,
  userId: string | null = USER,
  trialEnd = TRIAL_END,
) {
  await pg.query(
    `INSERT INTO public.trial_enrollments (
      id, user_id, accepted_offer, provider, admission_status,
      provider_agreement_id, authorization_succeeded_at, original_trial_end_at
    ) VALUES ($1::uuid, $2::uuid, $3::jsonb, 'stripe', 'active', 'agreement', $4::timestamptz, $5::timestamptz)`,
    [id, userId, JSON.stringify(OFFER), AUTHORIZED_AT, trialEnd],
  )
}

async function seedBilling(
  pg: PGlite,
  values: {
    id?: string
    userId?: string
    enrollmentId?: string | null
    metadata?: unknown
    periodEnd?: string
  } = {},
) {
  const id = values.id ?? BILLING
  await pg.query(
    `INSERT INTO public.billing_subscriptions (
      id, user_id, provider, provider_subscription_id, provider_status, entitlement_status,
      interval, current_period_end, metadata, trial_enrollment_id, trial_access_facts
    ) VALUES ($1::uuid, $2::uuid, 'stripe', $3, 'active', 'active', 'month',
      $4::timestamptz, $5::jsonb, $6::uuid, '{"accessRevoked":false,"accepted_offer":"attacker"}'::jsonb)`,
    [
      id,
      values.userId ?? USER,
      `sub_${id.slice(0, 8)}`,
      values.periodEnd ?? "2099-01-01T00:00:00Z",
      JSON.stringify(values.metadata ?? { trial_cohort: values.enrollmentId ? "trial_v1" : null }),
      values.enrollmentId ?? null,
    ],
  )
  return id
}

async function accessSql(pg: PGlite, at: string) {
  const result = await pg.query<{ access: boolean }>(
    "SELECT public.trial_enrollment_has_access(e, $2::timestamptz) AS access FROM public.trial_enrollments e WHERE id = $1::uuid",
    [ENROLLMENT, at],
  )
  return result.rows[0]!.access
}

async function projection(pg: PGlite, billingId = BILLING) {
  const result = await pg.query<{
    trial_enrollment_id: string
    trial_access_facts: Record<string, unknown>
  }>(
    "SELECT trial_enrollment_id::text, trial_access_facts FROM public.billing_subscriptions WHERE id = $1::uuid",
    [billingId],
  )
  return result.rows[0]!
}

test("payment RPC updates the billing projection consumed by SQL and application access guards", async (t) => {
  const pg = await database(t)
  await pg.exec(
    await readFile(
      new URL("supabase/migrations/20260914094203_trial_payment_events.sql", ROOT),
      "utf8",
    ),
  )
  await seedUser(pg)
  await seedEnrollment(pg)
  await seedBilling(pg, { enrollmentId: ENROLLMENT })
  const client = {
    rpc: async (_name: string, args: Record<string, unknown>) => {
      const { rows } = await pg.query<{ result: unknown }>(
        "SELECT public.record_trial_payment_event($1::jsonb) AS result",
        [JSON.stringify(args.p_event)],
      )
      return { data: rows[0].result, error: null }
    },
  }
  const payment: TrialPaymentEvent = {
    provider: "stripe",
    enrollmentId: ENROLLMENT,
    agreementId: "agreement",
    sourceEventId: "evt_failed",
    sourceObjectId: "invoice_first",
    outcome: "failed",
    occurredAt: TRIAL_END,
    amountMinor: 999,
    currency: "EUR",
    periodStartAt: TRIAL_END,
    periodEndAt: "2020-02-08T00:00:00.000Z",
  }
  await recordTrialPaymentEvent(client, payment)
  assert.equal(await accessSql(pg, TRIAL_END), true)
  assert.equal(
    resolveBillingTrialAccess(await projection(pg), new Date(TRIAL_END))?.reason,
    "first_collection_pending",
  )
  assert.equal(await accessSql(pg, COLLECTION_WINDOW_END), false)
  assert.equal(
    resolveBillingTrialAccess(await projection(pg), new Date(COLLECTION_WINDOW_END))?.hasAccess,
    false,
  )
  await recordTrialPaymentEvent(client, {
    ...payment,
    outcome: "succeeded",
    sourceEventId: "evt_paid",
  })
  assert.equal(await accessSql(pg, TRIAL_END), true)
  assert.equal(resolveBillingTrialAccess(await projection(pg), new Date(TRIAL_END))?.phase, "paid")
  await recordTrialPaymentEvent(client, {
    ...payment,
    sourceEventId: "evt_renewal_failed",
    sourceObjectId: "invoice_renewal",
    occurredAt: "2020-02-09T00:00:00.000Z",
    periodStartAt: "2020-02-08T00:00:00.000Z",
    periodEndAt: "2020-03-08T00:00:00.000Z",
  })
  assert.equal(await accessSql(pg, "2020-02-14T23:59:59Z"), true)
  assert.equal(
    resolveBillingTrialAccess(await projection(pg), new Date("2020-02-14T23:59:59Z"))?.phase,
    "renewal_grace",
  )
  assert.equal(await accessSql(pg, "2020-02-15T00:00:00Z"), false)
  assert.equal(
    resolveBillingTrialAccess(await projection(pg), new Date("2020-02-15T00:00:00Z"))?.hasAccess,
    false,
  )
})

test("trial projection appends stable classified-view columns and derives a safe immutable billing projection", async (t) => {
  const pg = await database(t)
  await seedUser(pg)
  await seedEnrollment(pg)
  await seedBilling(pg, { enrollmentId: ENROLLMENT })
  const columns = await pg.query<{ attname: string }>(
    `SELECT attname FROM pg_attribute
      WHERE attrelid = 'public.billing_subscriptions_classified'::regclass AND attnum > 0 AND NOT attisdropped
      ORDER BY attnum`,
  )
  assert.deepEqual(
    columns.rows.map((row) => row.attname),
    [
      "id",
      "user_id",
      "provider",
      "provider_customer_id",
      "provider_subscription_id",
      "provider_status",
      "entitlement_status",
      "interval",
      "current_period_end",
      "cancel_at_period_end",
      "cancelled_at",
      "metadata",
      "created_at",
      "updated_at",
      "provider_subscriber_email",
      "cancel_scheduled_at",
      "is_test",
      "is_current",
      "trial_enrollment_id",
      "trial_access_facts",
    ],
  )
  const stored = await projection(pg)
  assert.equal(stored.trial_enrollment_id, ENROLLMENT)
  assert.deepEqual(
    Object.keys(stored.trial_access_facts).sort(),
    [
      "accessRevoked",
      "admissionStatus",
      "authorizationSucceededAt",
      "cancelAtPeriodEnd",
      "enrollmentId",
      "firstPaymentSucceededAt",
      "originalTrialEndAt",
      "paidThroughAt",
      "renewalGraceEndsAt",
      "renewalPaymentFailed",
      "version",
    ].sort(),
  )
  assert.equal(stored.trial_access_facts.accepted_offer, undefined)
  assert.doesNotMatch(JSON.stringify(stored.trial_access_facts), /price_trial|agreement|identity/i)
})

test("SQL and TypeScript agree on strict trial expiry, paid access, grace, cancellation, and revocation", async (t) => {
  const pg = await database(t)
  await seedUser(pg)
  await seedEnrollment(pg)
  await seedBilling(pg, { enrollmentId: ENROLLMENT })
  let row = await projection(pg)
  assert.equal(await accessSql(pg, AUTHORIZED_AT), true)
  assert.equal(await accessSql(pg, TRIAL_END), true)
  assert.equal(await accessSql(pg, COLLECTION_WINDOW_END), false)
  assert.deepEqual(
    resolveBillingTrialAccess(
      { ...row, metadata: { trial_cohort: "trial_v1" } },
      new Date(AUTHORIZED_AT),
    ),
    {
      hasAccess: true,
      phase: "trial",
      reason: "trial_active",
    },
  )
  assert.deepEqual(
    resolveBillingTrialAccess(
      { ...row, metadata: { trial_cohort: "trial_v1" } },
      new Date(TRIAL_END),
    ),
    {
      hasAccess: true,
      phase: "trial",
      reason: "first_collection_pending",
    },
  )
  assert.deepEqual(
    resolveBillingTrialAccess(
      { ...row, metadata: { trial_cohort: "trial_v1" } },
      new Date(COLLECTION_WINDOW_END),
    ),
    {
      hasAccess: false,
      phase: "locked",
      reason: "trial_expired_without_payment",
    },
  )

  await pg.query(
    `UPDATE public.trial_enrollments SET first_payment_succeeded_at = '2020-01-10T00:00:00Z',
       paid_through_at = '2020-02-10T00:00:00Z', renewal_payment_failed = true,
       renewal_grace_ends_at = '2020-02-17T00:00:00Z' WHERE id = $1::uuid`,
    [ENROLLMENT],
  )
  row = await projection(pg)
  assert.equal(row.trial_access_facts.firstPaymentSucceededAt, "2020-01-10T00:00:00+00:00")
  assert.equal(row.trial_access_facts.paidThroughAt, "2020-02-10T00:00:00+00:00")
  assert.equal(row.trial_access_facts.renewalGraceEndsAt, "2020-02-17T00:00:00+00:00")
  assert.equal(await accessSql(pg, "2020-01-15T00:00:00Z"), true)
  assert.deepEqual(
    resolveBillingTrialAccess(
      { ...row, metadata: { trial_cohort: "trial_v1" } },
      new Date("2020-01-15T00:00:00Z"),
    ),
    {
      hasAccess: true,
      phase: "paid",
      reason: "paid_active",
    },
  )
  await pg.query(
    "UPDATE public.trial_enrollments SET cancel_at_period_end = true WHERE id = $1::uuid",
    [ENROLLMENT],
  )
  assert.equal((await projection(pg)).trial_access_facts.cancelAtPeriodEnd, true)
  assert.equal(await accessSql(pg, "2020-02-11T00:00:00Z"), false)
  await pg.query("UPDATE public.trial_enrollments SET access_revoked = true WHERE id = $1::uuid", [
    ENROLLMENT,
  ])
  assert.equal((await projection(pg)).trial_access_facts.accessRevoked, true)
  assert.equal(await accessSql(pg, "2020-01-15T00:00:00Z"), false)
})

test("linked trials fail closed in views while unlinked legacy rows retain their one-day grace", async (t) => {
  const pg = await database(t)
  await seedUser(pg)
  await seedUser(pg, LEGACY_USER)
  await seedUser(pg, COHORT_USER)
  await seedEnrollment(pg)
  await seedBilling(pg, { enrollmentId: ENROLLMENT, periodEnd: "2020-01-01T00:00:00Z" })
  const legacyId = "55555555-5555-4555-8555-555555555555"
  await seedBilling(pg, {
    id: legacyId,
    userId: LEGACY_USER,
    metadata: {},
    periodEnd: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
  })
  const cohortWithoutLink = "66666666-6666-4666-8666-666666666666"
  await seedBilling(pg, {
    id: cohortWithoutLink,
    userId: COHORT_USER,
    metadata: { trial_cohort: "trial_v1" },
    periodEnd: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  })
  const classified = await pg.query<{ id: string; is_current: boolean }>(
    `SELECT id::text, is_current FROM public.billing_subscriptions_classified
      WHERE id IN ($1::uuid, $2::uuid, $3::uuid) ORDER BY id`,
    [BILLING, legacyId, cohortWithoutLink],
  )
  assert.deepEqual(classified.rows, [
    { id: BILLING, is_current: false },
    { id: legacyId, is_current: true },
    { id: cohortWithoutLink, is_current: false },
  ])
})

test("SQL and application readers reject unknown or empty trial markers consistently", async (t) => {
  const pg = await database(t)
  await seedUser(pg)
  await seedEnrollment(pg)
  await seedBilling(pg, { enrollmentId: ENROLLMENT })
  await pg.query(
    `UPDATE public.trial_enrollments SET first_payment_succeeded_at = '2020-01-08T00:00:00Z',
    paid_through_at = '2099-01-01T00:00:00Z' WHERE id = $1::uuid`,
    [ENROLLMENT],
  )
  for (const marker of [undefined, null, "trial_v1", "", "unknown", 1, false, {}]) {
    const metadata = marker === undefined ? {} : { trial_cohort: marker }
    const expected = marker === undefined || marker === null || marker === "trial_v1"
    await pg.query(
      "UPDATE public.billing_subscriptions SET metadata = $2::jsonb WHERE id = $1::uuid",
      [BILLING, JSON.stringify(metadata)],
    )
    const result = await pg.query<{ is_current: boolean }>(
      "SELECT is_current FROM public.billing_subscriptions_classified WHERE id = $1::uuid",
      [BILLING],
    )
    assert.equal(result.rows[0]!.is_current, expected, JSON.stringify(metadata))
    assert.equal(
      resolveBillingTrialAccess({ ...(await projection(pg)), metadata }, new Date())!.hasAccess,
      expected,
    )
  }
  const legacyId = "55555555-5555-4555-8555-555555555555"
  await seedUser(pg, LEGACY_USER)
  await seedBilling(pg, { id: legacyId, userId: LEGACY_USER, metadata: { trial_cohort: "" } })
  const result = await pg.query<{ is_current: boolean }>(
    "SELECT is_current FROM public.billing_subscriptions_classified WHERE id = $1::uuid",
    [legacyId],
  )
  assert.equal(result.rows[0]!.is_current, false)
})

test("link ownership, account deletion, and role boundaries preserve safe projection access", async (t) => {
  const pg = await database(t)
  await seedUser(pg)
  await seedUser(pg, OTHER_USER)
  await seedEnrollment(pg)
  await assert.rejects(() => seedBilling(pg, { enrollmentId: ENROLLMENT, userId: OTHER_USER }), {
    code: "23514",
  })
  await seedBilling(pg, { enrollmentId: ENROLLMENT })
  await pg.exec(
    `SELECT set_config('request.jwt.claim.sub', '${USER}', false); SET ROLE authenticated`,
  )
  const own = await pg.query<{ trial_access_facts: unknown }>(
    "SELECT trial_access_facts FROM public.billing_subscriptions WHERE id = $1::uuid",
    [BILLING],
  )
  assert.ok(own.rows[0]!.trial_access_facts)
  await assert.rejects(
    () => pg.query("SELECT * FROM public.trial_enrollments"),
    /permission denied for table/,
  )
  await assert.rejects(
    () => pg.query("SELECT * FROM public.trial_identity_claims"),
    /permission denied for table/,
  )
  await pg.exec("RESET ROLE; SET ROLE anon")
  await assert.rejects(
    () =>
      pg.query("SELECT public.trial_enrollment_has_access(NULL::public.trial_enrollments, now())"),
    /permission denied for function/,
  )
  await pg.exec("RESET ROLE")
  await pg.query("DELETE FROM public.profiles WHERE id = $1::uuid", [USER])
  const remaining = await pg.query<{ billing: number; user_id: string | null }>(
    `SELECT (SELECT count(*)::int FROM public.billing_subscriptions WHERE id = $1::uuid) AS billing,
       (SELECT user_id::text FROM public.trial_enrollments WHERE id = $2::uuid) AS user_id`,
    [BILLING, ENROLLMENT],
  )
  assert.deepEqual(remaining.rows[0], { billing: 0, user_id: null })
})

test("a second-exact legacy trial end keeps its next-midnight collection window in SQL and TypeScript", async (t) => {
  const pg = await database(t)
  await seedUser(pg)
  await seedEnrollment(pg, ENROLLMENT, USER, LEGACY_TRIAL_END)
  await seedBilling(pg, { enrollmentId: ENROLLMENT })
  const row = await projection(pg)
  assert.equal(
    Date.parse(String(row.trial_access_facts.originalTrialEndAt)),
    Date.parse(LEGACY_TRIAL_END),
  )
  const facts = { ...row, metadata: { trial_cohort: "trial_v1" } }
  for (const [at, expected] of [
    [LEGACY_TRIAL_END, true],
    ["2020-01-10T23:59:59.000Z", true],
    [LEGACY_COLLECTION_WINDOW_END, false],
  ] as const) {
    assert.equal(await accessSql(pg, at), expected, at)
    assert.equal(resolveBillingTrialAccess(facts, new Date(at))?.hasAccess, expected, at)
  }
})

test("a frozen midnight PayPal trial end is its own collection start and closes two days later in SQL and TypeScript", async (t) => {
  const pg = await database(t)
  await seedUser(pg)
  await seedEnrollment(pg, ENROLLMENT, USER, FROZEN_TRIAL_END)
  await seedBilling(pg, { enrollmentId: ENROLLMENT })
  const row = await projection(pg)
  const facts = { ...row, metadata: { trial_cohort: "trial_v1" } }
  for (const [at, expected] of [
    [FROZEN_TRIAL_END, true],
    ["2020-01-10T23:59:59.000Z", true],
    [FROZEN_COLLECTION_WINDOW_END, false],
  ] as const) {
    assert.equal(await accessSql(pg, at), expected, at)
    assert.equal(resolveBillingTrialAccess(facts, new Date(at))?.hasAccess, expected, at)
  }
})
