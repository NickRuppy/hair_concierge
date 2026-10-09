import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { PGlite } from "@electric-sql/pglite"
import { createTrialOfferSnapshot } from "../src/lib/billing/trial-offer"

const U = "11111111-1111-4111-8111-111111111111"
const E = "22222222-2222-4222-8222-222222222222"
const S = "33333333-3333-4333-8333-333333333333"
const offer = createTrialOfferSnapshot("month", {
  monthPriceId: "price_month",
  yearPriceId: "price_year",
  annualCouponId: "coupon",
})
async function setup(
  t: { after(fn: () => Promise<void>): void },
  provider = "stripe",
  openai = false,
) {
  const db = new PGlite()
  t.after(() => db.close())
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE TABLE profiles(id uuid PRIMARY KEY);
    CREATE TABLE billing_subscriptions(id uuid PRIMARY KEY,user_id uuid,provider text,provider_subscription_id text,provider_customer_id text,metadata jsonb);
    CREATE TABLE funnel_sessions(id uuid PRIMARY KEY,package_key text,landing_variant text,quiz_variant text,offer_variant text,is_internal_test boolean,test_kind text,visitor_id uuid);
    CREATE TABLE paypal_checkout_intents(id uuid PRIMARY KEY,metadata jsonb);
    GRANT USAGE ON SCHEMA public TO service_role; GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;`)
  for (const name of [
    "20260708133700_billing_analytics_outbox",
    "20260914044650_trial_admission_foundation",
    "20260914085036_trial_started_analytics",
    "20260914090614_trial_cancellation_declarations",
    "20260914094203_trial_payment_events",
    "20260914101500_trial_cancellation_provider_retry",
    "20260914135114_stripe_trial_continuation_operations",
    "20260914140320_trial_management_operations",
    "20260914141149_trial_effective_payment_contract",
    "20260914141408_trial_effective_cancellation_contract",
    "20260914142808_trial_paid_recovery_operations",
    "20260914143515_trial_paid_recovery_ledger",
    "20260914151514_stripe_trial_lifecycle_cancellation_fence",
  ]) {
    await db.exec(readFileSync(`supabase/migrations/${name}.sql`, "utf8"))
  }
  await db.exec(`CREATE TABLE trial_checkout_attempts(enrollment_id uuid,stripe_params jsonb);
    CREATE TABLE private.paypal_trial_checkout_attempts(enrollment_id uuid,intent_id uuid,request_id text);
    GRANT ALL ON trial_checkout_attempts,private.paypal_trial_checkout_attempts TO service_role;
    ALTER TABLE billing_analytics_deliveries DROP CONSTRAINT billing_analytics_deliveries_destination_check;
    ALTER TABLE billing_analytics_deliveries ADD CHECK(destination IN ('customerio','meta','posthog','funnel'));`)
  await db.exec(
    readFileSync("supabase/migrations/20260915113126_trial_lifecycle_analytics.sql", "utf8"),
  )
  if (openai) {
    for (const name of [
      "20260915141251_openai_ads_consent_context",
      "20260915141328_openai_ads_billing_delivery",
      "20260915145322_openai_ads_canonical_test_exclusion",
    ])
      await db.exec(readFileSync(`supabase/migrations/${name}.sql`, "utf8"))
  }
  await db.query("INSERT INTO profiles VALUES($1)", [U])
  await db.query(
    "INSERT INTO funnel_sessions VALUES($1,'scan_v1','scan','legacy-quiz-v1','scan-regal-v1',false,NULL,NULL)",
    [S],
  )
  await db.query(
    "INSERT INTO trial_enrollments(id,user_id,provider,accepted_offer) VALUES($1,$2,$4,$3)",
    [E, U, JSON.stringify(offer), provider],
  )
  await db.query("INSERT INTO trial_checkout_attempts VALUES($1,NULL)", [E])
  await db.query("SELECT freeze_trial_management_catalog($1,$2::jsonb)", [
    E,
    JSON.stringify({
      month: offer,
      year: createTrialOfferSnapshot("year", {
        monthPriceId: "price_month",
        yearPriceId: "price_year",
        annualCouponId: "coupon",
      }),
    }),
  ])
  return db
}
async function freeze(db: PGlite, consent = false) {
  return db.query("SELECT freeze_trial_analytics_context($1,$2,$3::jsonb)", [
    E,
    S,
    JSON.stringify({
      marketing_consent: consent,
      fbp: "fb.1.1234567890123.123",
      client_user_agent: "browser",
    }),
  ])
}
async function activate(db: PGlite, current = false) {
  await db.query(
    `UPDATE trial_enrollments SET admission_status='active',provider_agreement_id='sub_original',authorization_succeeded_at=$2::timestamptz,original_trial_end_at=$2::timestamptz+interval '7 days' WHERE id=$1`,
    [E, current ? new Date(Date.now() - 2.5 * 86400000).toISOString() : "2026-09-01T10:00:00Z"],
  )
  await db.query(
    "INSERT INTO billing_subscriptions(id,user_id,provider,provider_subscription_id,provider_customer_id,trial_enrollment_id) SELECT $1,$2,provider,'sub_original','cus_owner',$1 FROM trial_enrollments WHERE id=$1",
    [E, U],
  )
}
test("activation freezes original attribution and queues one consented zero-value StartTrial atomically", async (t) => {
  const db = await setup(t)
  await freeze(db, true)
  await activate(db)
  await freeze(db, false)
  await db.query("UPDATE trial_enrollments SET admission_status='active' WHERE id=$1", [E])
  const rows = (await db.query<any>("SELECT * FROM billing_analytics_outbox")).rows
  assert.equal(rows.length, 1)
  assert.equal(rows[0].event_key, `stripe:trial_started:${E}`)
  assert.equal(rows[0].payload.value, 0)
  assert.equal(rows[0].payload.funnel_session_id, S)
  assert.equal(rows[0].payload.funnel_package_key, "scan_v1")
  assert.equal(JSON.stringify(rows).includes("client_user_agent"), false)
  assert.deepEqual(
    (
      await db.query<any>(
        "SELECT destination FROM billing_analytics_deliveries ORDER BY destination",
      )
    ).rows.map((r) => r.destination),
    ["meta", "posthog"],
  )
})
test("first failed charge and recovery use the latest canonical ledger, preserve phase and deduplicate aliases", async (t) => {
  const db = await setup(t)
  await freeze(db)
  await activate(db)
  const fact = {
    provider: "stripe",
    enrollmentId: E,
    agreementId: "sub_original",
    sourceEventId: "evt_fail",
    sourceObjectId: "in_first",
    outcome: "failed",
    occurredAt: "2026-09-08T10:00:00Z",
    amountMinor: 999,
    currency: "EUR",
    periodStartAt: "2026-09-08T10:00:00Z",
    periodEndAt: "2026-10-08T10:00:00Z",
  }
  const record = (v: unknown) =>
    db.query("SELECT record_trial_payment_event($1::jsonb)", [JSON.stringify(v)])
  await record(fact)
  await record({ ...fact, sourceEventId: "evt_fail_alias" })
  await record({ ...fact, outcome: "succeeded", sourceEventId: "evt_paid" })
  await record({ ...fact, outcome: "succeeded", sourceEventId: "evt_paid_alias" })
  await record({ ...fact, sourceEventId: "evt_fail_late" })
  assert.deepEqual(
    (
      await db.query<any>(
        "SELECT event_name FROM billing_analytics_outbox ORDER BY occurred_at,event_name",
      )
    ).rows.map((r) => r.event_name),
    ["trial_started", "purchase_completed", "trial_first_payment_failed"],
  )
  const payment = (
    await db.query<any>(
      "SELECT payload FROM billing_analytics_outbox WHERE event_name='purchase_completed'",
    )
  ).rows[0].payload
  assert.equal(payment.value, 9.99)
  assert.equal(payment.funnel_session_id, S)
  assert.equal(payment.first_payment_recovered, true)
  assert.deepEqual(
    (await db.query<any>("SELECT DISTINCT attempt_phase FROM private.trial_payment_events")).rows,
    [{ attempt_phase: "first_paid" }],
  )
  assert.equal(
    (
      await db.query<any>(
        "SELECT count(*)::int n FROM billing_analytics_deliveries WHERE destination='meta'",
      )
    ).rows[0].n,
    0,
  )
})

test("day-3 cancellation request, provider confirmation and committed restore remain separate replay-safe facts", async (t) => {
  const db = await setup(t)
  await freeze(db)
  await activate(db, true)
  const catalog = {
    month: offer,
    year: createTrialOfferSnapshot("year", {
      monthPriceId: "price_month",
      yearPriceId: "price_year",
      annualCouponId: "coupon",
    }),
  }
  await db.query("SELECT freeze_trial_management_catalog($1,$2::jsonb)", [
    E,
    JSON.stringify(catalog),
  ])
  const request = "44444444-4444-4444-8444-444444444444",
    op = "55555555-5555-4555-8555-555555555555"
  const submit = () =>
    db.query<any>("SELECT * FROM submit_trial_cancellation_declaration($1,$2,$3)", [request, U, E])
  const d = (await submit()).rows[0]
  await submit()
  const confirm = () =>
    db.query<any>(
      "SELECT confirm_trial_cancellation_provider_operation($1,$2,$3,'stripe','sub_original','cus_owner',$4::timestamptz)",
      [d.declaration_id, U, E, d.effective_end_at],
    )
  await confirm()
  await confirm()
  const begin = (
    await db.query<any>("SELECT begin_trial_management_operation($1,$2,$3,'restore',0,'month') o", [
      op,
      E,
      U,
    ])
  ).rows[0].o
  const evidence = {
    provider: "stripe",
    providerCustomerId: "cus_owner",
    sourceAgreementId: "sub_original",
    targetAgreementId: "sub_original",
    offer,
    originalTrialEndAt: begin.originalTrialEndAt,
    cancelAtPeriodEnd: false,
    noImmediatePayment: true,
    reference: "provider_truth",
  }
  const commit = () =>
    db.query<any>("SELECT commit_trial_management_operation($1,$2,$3::jsonb) ok", [
      op,
      U,
      JSON.stringify(evidence),
    ])
  assert.equal((await commit()).rows[0].ok, true)
  await commit()
  const events = (
    await db.query<any>(
      "SELECT event_name,payload FROM billing_analytics_outbox ORDER BY occurred_at",
    )
  ).rows
  assert.deepEqual(
    events.map((e) => e.event_name),
    [
      "trial_started",
      "trial_cancellation_requested",
      "trial_cancellation_confirmed",
      "trial_cancellation_restored",
    ],
  )
  assert.equal(Math.floor(events[1].payload.trial_age_seconds / 86400) + 1, 3)
  assert.equal(events[1].payload.was_paid, false)
  assert.equal(events[3].payload.cancel_at_period_end, false)
  assert.equal(
    (await db.query<any>("SELECT cancel_at_period_end c FROM trial_enrollments")).rows[0].c,
    false,
  )
})

test("guarded provider observation is distinct from submission and rejects an outdated cancellation fence", async (t) => {
  const db = await setup(t)
  await freeze(db)
  await activate(db, true)
  await db.query("SELECT freeze_trial_management_catalog($1,$2::jsonb)", [
    E,
    JSON.stringify({
      month: offer,
      year: createTrialOfferSnapshot("year", {
        monthPriceId: "price_month",
        yearPriceId: "price_year",
        annualCouponId: "coupon",
      }),
    }),
  ])
  const observe = (v: number) =>
    db.query<any>(
      "SELECT confirm_stripe_trial_cancellation($1,'sub_original','cus_owner',$2,0,$3) e",
      [E, U, v],
    )
  assert.ok((await observe(0)).rows[0].e)
  assert.equal((await observe(0)).rows[0].e, null)
  await observe(1)
  assert.equal(
    (
      await db.query<any>(
        "SELECT count(*)::int n FROM billing_analytics_outbox WHERE event_name='trial_cancellation_observed'",
      )
    ).rows[0].n,
    1,
  )
  assert.equal(
    (
      await db.query<any>(
        "SELECT count(*)::int n FROM billing_analytics_outbox WHERE event_name='trial_cancellation_requested'",
      )
    ).rows[0].n,
    0,
  )
})

test("reconciliation transition captures once; a failed atomic outbox insert rolls back authoritative activation", async (t) => {
  const db = await setup(t)
  await freeze(db)
  await db.exec(`CREATE FUNCTION reject_test_delivery() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'delivery unavailable'; END $$;
   CREATE TRIGGER reject_delivery BEFORE INSERT ON billing_analytics_deliveries FOR EACH ROW EXECUTE FUNCTION reject_test_delivery();`)
  await assert.rejects(activate(db), /delivery unavailable/)
  assert.equal(
    (await db.query<any>("SELECT authorization_succeeded_at a FROM trial_enrollments")).rows[0].a,
    null,
  )
  assert.equal(
    (await db.query<any>("SELECT count(*)::int n FROM billing_analytics_outbox")).rows[0].n,
    0,
  )
  await db.exec("DROP TRIGGER reject_delivery ON billing_analytics_deliveries")
  await activate(db)
  const fact = {
    provider: "stripe",
    enrollmentId: E,
    agreementId: "sub_original",
    sourceEventId: "evt_reconcile",
    sourceObjectId: "in_reconcile",
    outcome: "succeeded",
    occurredAt: "2026-09-08T10:00:00Z",
    amountMinor: 999,
    currency: "EUR",
    periodStartAt: "2026-09-08T10:00:00Z",
    periodEndAt: "2026-10-08T10:00:00Z",
  }
  await db.query("UPDATE trial_enrollments SET cancel_at_period_end=true WHERE id=$1", [E])
  const record = () =>
    db.query<any>("SELECT record_trial_payment_event($1::jsonb) r", [JSON.stringify(fact)])
  assert.equal((await record()).rows[0].r.outcome, "reconciliation_required")
  assert.equal(
    (await db.query<any>("SELECT attempt_phase FROM private.trial_payment_events")).rows[0]
      .attempt_phase,
    null,
  )
  await db.query("UPDATE trial_enrollments SET cancel_at_period_end=false WHERE id=$1", [E])
  assert.equal((await record()).rows[0].r.outcome, "applied")
  await record()
  assert.equal(
    (
      await db.query<any>(
        "SELECT count(*)::int n FROM billing_analytics_outbox WHERE event_name='purchase_completed'",
      )
    ).rows[0].n,
    1,
  )
})

test("existing frozen checkouts recover exact original acquisition without inventing historical marketing consent", async (t) => {
  const db = await setup(t)
  await db.query("UPDATE trial_checkout_attempts SET stripe_params=$1::jsonb", [
    JSON.stringify({ metadata: { funnel_session_id: S } }),
  ])
  await db.query("SELECT freeze_trial_analytics_context($1,NULL,$2::jsonb)", [
    E,
    JSON.stringify({ marketing_consent: true, fbp: "fb.1.1234567890123.123" }),
  ])
  await activate(db)
  const c = (await db.query<any>("SELECT * FROM private.trial_analytics_contexts")).rows[0]
  assert.equal(c.acquisition.funnel_session_id, S)
  assert.equal(c.marketing_consent, false)
  assert.deepEqual(c.meta_context, {})
  await assert.rejects(
    db.query("UPDATE private.trial_analytics_contexts SET marketing_consent=true"),
    /immutable/,
  )
  await db.exec("SET ROLE anon")
  await assert.rejects(
    db.query("SELECT * FROM private.trial_analytics_contexts"),
    /permission denied/,
  )
  await assert.rejects(
    db.query("SELECT read_trial_analytics_meta_context($1)", [E]),
    /permission denied/,
  )
})

test("PayPal freezes attribution before provider creation and preserves its canonical first-purchase agreement key", async (t) => {
  const db = await setup(t, "paypal")
  const intent = "66666666-6666-4666-8666-666666666666"
  await db.query("INSERT INTO paypal_checkout_intents VALUES($1,'{}')", [intent])
  await db.query("INSERT INTO private.paypal_trial_checkout_attempts VALUES($1,$2,NULL)", [
    E,
    intent,
  ])
  await freeze(db, true)
  assert.equal(
    (await db.query<any>("SELECT metadata FROM paypal_checkout_intents")).rows[0].metadata
      .funnel_session_id,
    S,
  )
  await db.query("UPDATE private.paypal_trial_checkout_attempts SET request_id='provider_request'")
  await db.query("SELECT freeze_trial_analytics_context($1,NULL,'{}')", [E])
  await activate(db)
  const fact = {
    provider: "paypal",
    enrollmentId: E,
    agreementId: "sub_original",
    sourceEventId: "evt_paypal_paid",
    sourceObjectId: "sale_first",
    outcome: "succeeded",
    occurredAt: "2026-09-08T10:00:00Z",
    amountMinor: 999,
    currency: "EUR",
    periodStartAt: "2026-09-08T10:00:00Z",
    periodEndAt: "2026-10-08T10:00:00Z",
  }
  await db.query("SELECT record_trial_payment_event($1::jsonb)", [JSON.stringify(fact)])
  const event = (
    await db.query<any>(
      "SELECT * FROM billing_analytics_outbox WHERE event_name='purchase_completed'",
    )
  ).rows[0]
  assert.equal(event.event_key, "paypal:purchase_completed:sub_original")
  assert.equal(event.source_object_id, "sale_first")
  assert.equal(event.payload.meta_event_id, "sale_first")
  assert.equal(event.payload.funnel_session_id, S)
  assert.deepEqual(
    (
      await db.query<any>(
        "SELECT destination FROM billing_analytics_deliveries WHERE outbox_id=$1 ORDER BY destination",
        [event.id],
      )
    ).rows.map((r) => r.destination),
    ["customerio", "funnel", "meta", "posthog"],
  )
})

test("service-role trigger capture works and field-test context cannot queue a marketing conversion", async (t) => {
  const db = await setup(t)
  await db.query("UPDATE funnel_sessions SET test_kind='field_test' WHERE id=$1", [S])
  await db.exec("SET ROLE service_role")
  await freeze(db, true)
  await activate(db)
  const event = (await db.query<any>("SELECT payload FROM billing_analytics_outbox")).rows[0]
  assert.equal(event.payload.test_kind, "field_test")
  assert.equal(
    (
      await db.query<any>(
        "SELECT count(*)::int n FROM billing_analytics_deliveries WHERE destination='meta'",
      )
    ).rows[0].n,
    0,
  )
})

test("mixed old webhook destination inserts cannot bypass new trial consent or route diagnostics to commercial tools", async (t) => {
  const db = await setup(t)
  await freeze(db)
  await activate(db)
  const start = (
    await db.query<any>("SELECT id FROM billing_analytics_outbox WHERE event_name='trial_started'")
  ).rows[0].id
  // The old application inserts these rows after finding a duplicate outbox key.
  for (const destination of ["meta", "customerio", "funnel"])
    await db.query(
      "INSERT INTO billing_analytics_deliveries(outbox_id,destination) VALUES($1,$2) ON CONFLICT DO NOTHING",
      [start, destination],
    )
  assert.deepEqual(
    (
      await db.query<any>(
        "SELECT destination FROM billing_analytics_deliveries WHERE outbox_id=$1",
        [start],
      )
    ).rows,
    [{ destination: "posthog" }],
  )
  const fact = {
    provider: "stripe",
    enrollmentId: E,
    agreementId: "sub_original",
    sourceEventId: "evt_fail_old",
    sourceObjectId: "in_old",
    outcome: "failed",
    occurredAt: "2026-09-08T10:00:00Z",
    amountMinor: 999,
    currency: "EUR",
    periodStartAt: "2026-09-08T10:00:00Z",
    periodEndAt: "2026-10-08T10:00:00Z",
  }
  await db.query("SELECT record_trial_payment_event($1::jsonb)", [JSON.stringify(fact)])
  await db.query("SELECT record_trial_payment_event($1::jsonb)", [
    JSON.stringify({ ...fact, outcome: "succeeded", sourceEventId: "evt_paid_old" }),
  ])
  for (const name of ["trial_first_payment_failed", "purchase_completed"]) {
    const id = (
      await db.query<any>("SELECT id FROM billing_analytics_outbox WHERE event_name=$1", [name])
    ).rows[0].id
    for (const destination of ["meta", "customerio"])
      await db.query(
        "INSERT INTO billing_analytics_deliveries(outbox_id,destination) VALUES($1,$2) ON CONFLICT DO NOTHING",
        [id, destination],
      )
    assert.equal(
      (
        await db.query<any>(
          "SELECT count(*)::int n FROM billing_analytics_deliveries WHERE outbox_id=$1 AND destination IN ('meta','customerio')",
          [id],
        )
      ).rows[0].n,
      0,
    )
  }
})

for (const provider of ["stripe", "paypal"]) {
  test(`OpenAI delivery follows actual ${provider} trial and first-paid SQL producers without changing Meta`, async (t) => {
    const db = await setup(t, provider, true)
    await freeze(db, false)
    await activate(db)
    const fact = {
      provider,
      enrollmentId: E,
      agreementId: "sub_original",
      sourceEventId: "evt_openai_paid",
      sourceObjectId: "first_invoice",
      outcome: "succeeded",
      occurredAt: "2026-09-08T10:00:00Z",
      amountMinor: 999,
      currency: "EUR",
      periodStartAt: "2026-09-08T10:00:00Z",
      periodEndAt: "2026-10-08T10:00:00Z",
    }
    await db.query("SELECT record_trial_payment_event($1::jsonb)", [JSON.stringify(fact)])
    await db.query("SELECT record_trial_payment_event($1::jsonb)", [
      JSON.stringify({ ...fact, sourceEventId: "paid_alias" }),
    ])
    const deliveries = (
      await db.query<{ event_name: string }>(
        "SELECT e.event_name FROM billing_analytics_deliveries d JOIN billing_analytics_outbox e ON e.id=d.outbox_id WHERE d.destination='openai' ORDER BY e.occurred_at",
      )
    ).rows
    assert.deepEqual(
      deliveries.map((r) => r.event_name),
      ["trial_started", "purchase_completed"],
    )
    assert.equal(
      (
        await db.query<{ n: number }>(
          "SELECT count(*)::int n FROM billing_analytics_deliveries WHERE destination='meta'",
        )
      ).rows[0].n,
      0,
    )
  })
}
