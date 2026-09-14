import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { PGlite } from "@electric-sql/pglite"

import { createTrialOfferSnapshot } from "../src/lib/billing/trial-offer"
import { buildPayPalDeferredTrialPlanRequest } from "../src/lib/paypal/trial-plan-shape"
import { createDurablePayPalTrialCheckout } from "../src/lib/paypal/trial-checkout"

const ROOT = new URL("../", import.meta.url)
const FOUNDATION = "supabase/migrations/20260914044650_trial_admission_foundation.sql"
const MIGRATION = "supabase/migrations/20260914120000_paypal_trial_checkout_attempt.sql"
const USER = "00000000-0000-4000-8000-000000000001"
const LEAD = "00000000-0000-4000-8000-000000000002"
const ATTEMPT = "00000000-0000-4000-8000-000000000003"
const OFFER = createTrialOfferSnapshot("month", {
  monthPriceId: "price_trial_month",
  yearPriceId: "price_trial_year",
  annualCouponId: "coupon_trial_year",
})

async function database(t: { after(fn: () => Promise<void>): void }) {
  const pg = new PGlite()
  t.after(() => pg.close())
  await pg.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA private; GRANT USAGE ON SCHEMA private TO service_role;
    CREATE TABLE public.profiles(id uuid PRIMARY KEY); CREATE TABLE public.billing_subscriptions(id uuid PRIMARY KEY);
    CREATE TABLE public.paypal_checkout_intents (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), token text NOT NULL UNIQUE,
      interval text NOT NULL CHECK (interval IN ('month','quarter','year')),
      source text NOT NULL CHECK (source IN ('pricing_page','quiz_result_offer','premium_sheet')),
      lead_id uuid, email text, user_id uuid, provider_subscription_id text,
      status text NOT NULL DEFAULT 'created', expires_at timestamptz NOT NULL,
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
    INSERT INTO public.profiles VALUES ('${USER}');`)
  await pg.exec(await readFile(new URL(FOUNDATION, ROOT), "utf8"))
  await pg.exec(await readFile(new URL(MIGRATION, ROOT), "utf8"))
  return pg
}

async function create(
  pg: PGlite,
  input: {
    scope?: "user" | "lead"
    id?: string
    attempt?: string
    offer?: unknown
    email?: string | null
    leadId?: string | null
    source?: string
  } = {},
) {
  const result = await pg.query<{ row: Record<string, unknown> }>(
    "SELECT public.create_paypal_trial_checkout_attempt($1,$2::uuid,$3::uuid,$4::jsonb,$5,$6::uuid,$7) AS row",
    [
      input.scope ?? "user",
      input.id ?? USER,
      input.attempt ?? ATTEMPT,
      JSON.stringify(input.offer ?? OFFER),
      input.email ?? "nick@example.com",
      input.leadId ?? null,
      input.source ?? "pricing_page",
    ],
  )
  return result.rows[0]!.row
}

test("atomically creates a scope-owned immutable attempt, enrollment, and source-pinned intent", async (t) => {
  const pg = await database(t)
  const first = await create(pg)
  const replay = await create(pg)
  assert.equal(first.id, replay.id)
  assert.notEqual(first.enrollment_id, ATTEMPT)
  assert.equal(String(first.intent_token).length >= 32, true)
  const intent = await pg.query<{
    interval: string
    source: string
    user_id: string
    lead_id: string | null
    metadata: Record<string, unknown>
  }>(
    "SELECT interval,source,user_id,lead_id,metadata FROM public.paypal_checkout_intents WHERE id=$1::uuid",
    [first.intent_id],
  )
  assert.deepEqual(intent.rows[0], {
    interval: "month",
    source: "pricing_page",
    user_id: USER,
    lead_id: null,
    metadata: {
      trial_cohort: "trial_v1",
      trial_enrollment_id: first.enrollment_id,
      accepted_offer: OFFER,
    },
  })
  await assert.rejects(
    () => create(pg, { offer: { ...OFFER, stripePriceId: "price_later" } }),
    /conflict/,
  )
  await assert.rejects(() => create(pg, { scope: "user", leadId: LEAD }), /scope/)
  await assert.rejects(() => create(pg, { scope: "lead", id: LEAD, leadId: USER }), /scope/)
  await assert.rejects(() => create(pg, { offer: { interval: "quarter" } }), /invalid/)
  await assert.rejects(
    () =>
      create(pg, {
        offer: {
          ...OFFER,
          interval: "year",
          firstAmountMinor: 6999,
          renewalAmountMinor: 9999,
          stripeCouponId: null,
        },
      }),
    /invalid/,
  )
})

test("freezes a single bounded request identity and binds one immutable provider reference", async (t) => {
  const pg = await database(t)
  const attempt = await create(pg)
  const frozen = await pg.query<{ row: Record<string, unknown> }>(
    "SELECT public.freeze_paypal_trial_checkout_attempt($1::uuid,'APP-owned','PROD-owned','P-owned',$2) AS row",
    [attempt.id, `paypal-trial:${attempt.id}:v1`],
  )
  assert.equal(frozen.rows[0]!.row.status, "frozen")
  assert.equal(frozen.rows[0]!.row.request_expires_at !== null, true)
  await pg.query(
    "SELECT public.freeze_paypal_trial_checkout_attempt($1::uuid,'APP-owned','PROD-owned','P-owned',$2)",
    [attempt.id, `paypal-trial:${attempt.id}:v1`],
  )
  await assert.rejects(
    () =>
      pg.query(
        "SELECT public.freeze_paypal_trial_checkout_attempt($1::uuid,'APP-owned','PROD-owned','P-other',$2)",
        [attempt.id, `paypal-trial:${attempt.id}:v1`],
      ),
    /conflict/,
  )
  const bound = await pg.query<{ row: Record<string, unknown> }>(
    "SELECT public.bind_paypal_trial_checkout_reference($1::uuid,'I-subscription') AS row",
    [attempt.id],
  )
  assert.equal(bound.rows[0]!.row.status, "provider_created")
  await pg.query("SELECT public.bind_paypal_trial_checkout_reference($1::uuid,'I-subscription')", [
    attempt.id,
  ])
  await assert.rejects(
    () =>
      pg.query("SELECT public.bind_paypal_trial_checkout_reference($1::uuid,'I-other')", [
        attempt.id,
      ]),
    /conflict/,
  )
  await assert.rejects(
    () =>
      pg.query(
        "UPDATE private.paypal_trial_checkout_attempts SET paypal_plan_id='P-rewrite' WHERE id=$1::uuid",
        [attempt.id],
      ),
    /immutable/,
  )
  await assert.rejects(
    () =>
      pg.query(
        "UPDATE private.paypal_trial_checkout_attempts SET accepted_offer='{}'::jsonb WHERE id=$1::uuid",
        [attempt.id],
      ),
    /immutable/,
  )
})

test("rejects expired frozen request identities and leaves private attempts and RPCs unavailable to users", async (t) => {
  const pg = await database(t)
  const attempt = await create(pg)
  await pg.query(
    "SELECT public.freeze_paypal_trial_checkout_attempt($1::uuid,'APP-owned','PROD-owned','P-owned',$2)",
    [attempt.id, `paypal-trial:${attempt.id}:v1`],
  )
  await pg.exec(
    "ALTER TABLE private.paypal_trial_checkout_attempts DISABLE TRIGGER paypal_trial_checkout_attempt_immutable",
  )
  await pg.query(
    "UPDATE private.paypal_trial_checkout_attempts SET request_expires_at=now()-interval '1 second' WHERE id=$1::uuid",
    [attempt.id],
  )
  await pg.exec(
    "ALTER TABLE private.paypal_trial_checkout_attempts ENABLE TRIGGER paypal_trial_checkout_attempt_immutable",
  )
  await assert.rejects(
    () =>
      pg.query("SELECT public.bind_paypal_trial_checkout_reference($1::uuid,'I-subscription')", [
        attempt.id,
      ]),
    /reconciliation/,
  )
  await pg.exec("SET ROLE authenticated")
  await assert.rejects(
    () => pg.query("SELECT * FROM private.paypal_trial_checkout_attempts"),
    /permission denied/,
  )
  await assert.rejects(
    () =>
      pg.query(
        "SELECT public.create_paypal_trial_checkout_attempt('user',$1::uuid,$2::uuid,$3::jsonb,NULL,NULL,'pricing_page')",
        [USER, ATTEMPT, JSON.stringify(OFFER)],
      ),
    /permission denied/,
  )
})

test("service attests each provider interaction, freezes accepted terms, and verifies replayed subscription identity", async () => {
  const calls: Array<{ planId: string; requestId: string }> = []
  let attestedApp = "APP-owned"
  let attestations = 0
  let attempt: any = {
    id: ATTEMPT,
    enrollmentId: USER,
    intentToken: "token-1",
    scope: { kind: "lead", id: LEAD },
    clientAttemptId: ATTEMPT,
    offer: OFFER,
    status: "reserved",
    paypalAppId: null,
    paypalProductId: null,
    paypalPlanId: null,
    requestId: null,
    requestExpiresAt: null,
    providerReference: null,
  }
  const row = (x: any) => ({
    id: x.id,
    enrollment_id: x.enrollmentId,
    intent_token: x.intentToken,
    scope_kind: x.scope.kind,
    scope_id: x.scope.id,
    client_attempt_id: x.clientAttemptId,
    accepted_offer: x.offer,
    status: x.status,
    paypal_app_id: x.paypalAppId,
    paypal_product_id: x.paypalProductId,
    paypal_plan_id: x.paypalPlanId,
    request_id: x.requestId,
    request_expires_at: x.requestExpiresAt,
    provider_reference: x.providerReference,
  })
  let frozenManagementCatalog: any = null
  let frozenPlanCatalog: any = null
  const rpc = async (name: string, args: Record<string, unknown>) => {
    if (name === "get_paypal_trial_checkout_attempt_by_scope")
      return { data: row(attempt), error: null }
    if (name === "load_frozen_trial_management_catalog")
      return { data: frozenManagementCatalog, error: null }
    if (name === "freeze_trial_management_catalog") {
      frozenManagementCatalog = args.p_catalog
      return { data: true, error: null }
    }
    if (name === "get_paypal_trial_plan_catalog") return { data: frozenPlanCatalog, error: null }
    if (name === "freeze_paypal_trial_plan_catalog") {
      frozenPlanCatalog = {
        enrollment_id: args.p_enrollment_id,
        app_id: args.p_app_id,
        product_id: args.p_product_id,
        month_plan_id: args.p_month_plan_id,
        year_plan_id: args.p_year_plan_id,
      }
      return { data: frozenPlanCatalog, error: null }
    }
    if (name === "create_paypal_trial_checkout_attempt") return { data: row(attempt), error: null }
    if (name === "freeze_paypal_trial_checkout_attempt") {
      attempt = {
        ...attempt,
        status: "frozen",
        paypalAppId: args.p_app_id,
        paypalProductId: args.p_product_id,
        paypalPlanId: args.p_plan_id,
        requestId: args.p_request_id,
        requestExpiresAt: "2099-01-01T00:00:00.000Z",
      }
      return { data: row(attempt), error: null }
    }
    if (name === "bind_paypal_trial_checkout_reference") {
      attempt = {
        ...attempt,
        status: "provider_created",
        providerReference: args.p_provider_reference,
      }
      return { data: row(attempt), error: null }
    }
    throw new Error(name)
  }
  const deps: any = {
    supabase: { rpc },
    runtime: {
      trial: {
        catalog: {
          monthPriceId: "price_trial_month",
          yearPriceId: "price_trial_year",
          annualCouponId: "coupon_trial_year",
        },
        enrollmentMode: "public",
        allowedEmails: [],
      },
      appId: "APP-owned",
      productId: "PROD-owned",
      monthPlanId: "P-first",
      yearPlanId: "P-year",
    },
    attestApp: async () => {
      attestations += 1
      return attestedApp
    },
    getPlan: async (id: string) =>
      buildPayPalDeferredTrialPlanRequest({
        interval: id === "P-year" ? "year" : "month",
        productId: "PROD-owned",
      }),
    createSubscription: async (input: any) => {
      calls.push(input)
      if (calls.length === 1) throw new Error("lost response")
      return { id: "I-subscription", plan_id: input.planId, custom_id: input.customId }
    },
    retrieveSubscription: async () => ({}),
  }
  const input: any = {
    scope: { kind: "lead", id: LEAD },
    clientAttemptId: ATTEMPT,
    interval: "month",
    serverVerifiedEmail: "nick@example.com",
    claims: [],
    email: "nick@example.com",
    leadId: LEAD,
    source: "pricing_page",
  }
  const getUntaxedPlan = deps.getPlan
  deps.getPlan = async () => ({
    ...(await getUntaxedPlan()),
    taxes: { percentage: "19", inclusive: false },
  })
  await assert.rejects(() => createDurablePayPalTrialCheckout(input, deps), /accepted terms/)
  assert.equal(calls.length, 0)
  deps.getPlan = getUntaxedPlan
  attestations = 0
  await assert.rejects(() => createDurablePayPalTrialCheckout(input, deps), /lost response/)
  deps.runtime.monthPlanId = "P-later-catalog"
  const result = await createDurablePayPalTrialCheckout(input, deps)
  assert.equal(result.subscription.id, "I-subscription")
  assert.equal(attestations, 4)
  assert.deepEqual(calls, [
    {
      planId: "P-first",
      customId: "token-1",
      requestId: `paypal-trial:${ATTEMPT}:v1`,
      startTime: "2099-01-05T00:00:00.000Z",
      offer: OFFER,
    },
    {
      planId: "P-first",
      customId: "token-1",
      requestId: `paypal-trial:${ATTEMPT}:v1`,
      startTime: "2099-01-05T00:00:00.000Z",
      offer: OFFER,
    },
  ])
  deps.retrieveSubscription = async () => ({
    id: "I-different",
    plan_id: "P-first",
    custom_id: "token-1",
  })
  await assert.rejects(() => createDurablePayPalTrialCheckout(input, deps), /subscription mismatch/)
  deps.retrieveSubscription = async () => ({
    id: "I-subscription",
    plan_id: "P-first",
    custom_id: "wrong-token",
  })
  await assert.rejects(() => createDurablePayPalTrialCheckout(input, deps), /subscription mismatch/)
  attestedApp = "APP-other"
  await assert.rejects(() => createDurablePayPalTrialCheckout(input, deps), /provider mismatch/)

  const annualOffer = createTrialOfferSnapshot("year", {
    monthPriceId: "price_trial_month",
    yearPriceId: "price_trial_year",
    annualCouponId: null,
  })
  attempt = {
    ...attempt,
    id: "00000000-0000-4000-8000-000000000004",
    clientAttemptId: "00000000-0000-4000-8000-000000000004",
    offer: annualOffer,
    status: "reserved",
    paypalAppId: null,
    paypalProductId: null,
    paypalPlanId: null,
    requestId: null,
    requestExpiresAt: null,
    providerReference: null,
  }
  attestedApp = "APP-owned"
  frozenManagementCatalog = null
  frozenPlanCatalog = null
  deps.runtime.trial.catalog.annualCouponId = null
  deps.getPlan = async () => ({
    product_id: "PROD-owned",
    status: "ACTIVE",
    billing_cycles: [
      {
        tenure_type: "TRIAL",
        sequence: 1,
        total_cycles: 1,
        frequency: { interval_unit: "DAY", interval_count: 7 },
        pricing_scheme: { fixed_price: { value: "0", currency_code: "EUR" } },
      },
      {
        tenure_type: "TRIAL",
        sequence: 2,
        total_cycles: 1,
        frequency: { interval_unit: "YEAR", interval_count: 1 },
        pricing_scheme: { fixed_price: { value: "69.99", currency_code: "EUR" } },
      },
      {
        tenure_type: "REGULAR",
        sequence: 3,
        total_cycles: 0,
        frequency: { interval_unit: "YEAR", interval_count: 1 },
        pricing_scheme: { fixed_price: { value: "99.99", currency_code: "EUR" } },
      },
    ],
    payment_preferences: { setup_fee: { value: "0", currency_code: "EUR" } },
  })
  await assert.rejects(
    () =>
      createDurablePayPalTrialCheckout(
        { ...input, clientAttemptId: attempt.id, interval: "year" },
        deps,
      ),
    /accepted terms/,
  )
  await assert.rejects(
    () =>
      createDurablePayPalTrialCheckout(
        {
          ...input,
          scope: { kind: "user", id: USER },
          clientAttemptId: ATTEMPT,
          leadId: null,
          claims: [],
        },
        deps,
      ),
    /account identity/,
  )
})

test("pins the original activation event once, survives later provider clock changes, and rejects changed evidence", async (t) => {
  const pg = await database(t)
  await pg.exec(
    await readFile(
      new URL("supabase/migrations/20260914135017_paypal_trial_activation_clock.sql", ROOT),
      "utf8",
    ),
  )
  const attempt = await create(pg)
  await pg.query(
    "SELECT public.freeze_paypal_trial_checkout_attempt($1::uuid,'APP-owned','PROD-owned','P-owned',$2)",
    [attempt.id, `paypal-trial:${attempt.id}:v1`],
  )
  await pg.query("SELECT public.bind_paypal_trial_checkout_reference($1::uuid,'I-subscription')", [
    attempt.id,
  ])
  const now = new Date().toISOString()
  const args = [attempt.intent_token, "I-subscription", "WH-activation", now]
  const pin = () =>
    pg.query<{ row: Record<string, unknown> }>(
      "SELECT public.pin_paypal_trial_activation($1,$2,$3,$4::timestamptz) AS row",
      args,
    )
  const first = await pin()
  assert.equal(Date.parse(String(first.rows[0].row.authorization_succeeded_at)), Date.parse(now))
  assert.equal((await pin()).rows[0].row.activation_event_id, "WH-activation")
  await assert.rejects(
    () =>
      pg.query(
        "SELECT public.pin_paypal_trial_activation($1,'I-wrong','WH-activation',$2::timestamptz)",
        [attempt.intent_token, now],
      ),
    /mismatch/,
  )
  await assert.rejects(
    () =>
      pg.query(
        "SELECT public.pin_paypal_trial_activation($1,'I-subscription','WH-second',$2::timestamptz)",
        [attempt.intent_token, new Date(Date.parse(now) + 1000).toISOString()],
      ),
    /mismatch|conflict/,
  )
  await assert.rejects(
    () =>
      pg.query(
        "UPDATE private.paypal_trial_checkout_attempts SET authorization_succeeded_at=authorization_succeeded_at+interval '1 day' WHERE id=$1::uuid",
        [attempt.id],
      ),
    /immutable/,
  )
  await pg.exec("SET ROLE authenticated")
  await assert.rejects(
    () => pg.query("SELECT public.get_paypal_trial_checkout_attempt($1)", [attempt.intent_token]),
    /permission denied/,
  )
  await assert.rejects(pin, /permission denied/)
})
