import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { PGlite } from "@electric-sql/pglite"

const ROOT = new URL("../", import.meta.url)
const migrations = [
  "supabase/migrations/20260914044650_trial_admission_foundation.sql",
  "supabase/migrations/20260914090614_trial_cancellation_declarations.sql",
  "supabase/migrations/20260914093927_trial_cancellation_provider_operations.sql",
  "supabase/migrations/20260914101500_trial_cancellation_provider_retry.sql",
]
const user = "11111111-1111-4111-8111-111111111111",
  otherUser = "22222222-2222-4222-8222-222222222222",
  enrollment = "33333333-3333-4333-8333-333333333333",
  declaration = "44444444-4444-4444-8444-444444444444"

async function database(t: { after: (fn: () => Promise<void>) => void }) {
  const pg = new PGlite()
  t.after(() => pg.close())
  await pg.exec(
    "CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE TABLE public.profiles (id uuid PRIMARY KEY); CREATE TABLE public.billing_subscriptions (id uuid PRIMARY KEY, user_id uuid, provider text, provider_customer_id text, provider_subscription_id text); GRANT USAGE ON SCHEMA public TO service_role; GRANT ALL ON public.profiles, public.billing_subscriptions TO service_role;",
  )
  for (const file of migrations) await pg.exec(await readFile(new URL(file, ROOT), "utf8"))
  await pg.exec("GRANT USAGE ON SCHEMA private TO service_role")
  await pg.query("INSERT INTO public.profiles(id) VALUES ($1::uuid), ($2::uuid)", [user, otherUser])
  await pg.query(
    `INSERT INTO public.trial_enrollments(id,user_id,accepted_offer,provider,provider_agreement_id,admission_status,authorization_succeeded_at,original_trial_end_at) VALUES ($1::uuid,$2::uuid,'{}','stripe','sub_1','active','2099-01-01T00:00:00Z','2099-01-08T00:00:00Z')`,
    [enrollment, user],
  )
  await pg.query(
    "INSERT INTO public.billing_subscriptions(id,user_id,provider,provider_customer_id,provider_subscription_id,trial_enrollment_id) VALUES ($1::uuid,$2::uuid,'stripe','cus_1','sub_1',$3::uuid)",
    [declaration, user, enrollment],
  )
  await pg.query(
    "SELECT * FROM public.submit_trial_cancellation_declaration($1::uuid,$2::uuid,$3::uuid)",
    [declaration, user, enrollment],
  )
  return pg
}

test("provider operation RPC exposes only the exact owned billing link and confirms idempotently", async (t) => {
  const pg = await database(t)
  const saved = await pg.query<{ declaration_id: string }>(
    "SELECT id AS declaration_id FROM private.trial_cancellation_declarations",
  )
  const id = saved.rows[0]!.declaration_id
  const loaded = await pg.query<{
    enrollment_id: string
    user_id: string
    provider: string
    status: string
    cancel_at_period_end: boolean
    provider_customer_id: string
    provider_agreement_id: string
    original_trial_end_at: string
  }>("SELECT * FROM public.load_trial_cancellation_provider_operation($1::uuid,$2::uuid)", [
    id,
    user,
  ])
  assert.equal(loaded.rows[0]!.enrollment_id, enrollment)
  assert.equal(loaded.rows[0]!.user_id, user)
  assert.equal(loaded.rows[0]!.provider, "stripe")
  assert.equal(loaded.rows[0]!.provider_customer_id, "cus_1")
  assert.equal(loaded.rows[0]!.provider_agreement_id, "sub_1")
  assert.equal(
    new Date(loaded.rows[0]!.original_trial_end_at).toISOString(),
    "2099-01-08T00:00:00.000Z",
  )
  assert.equal(loaded.rows[0]!.status, "pending")
  assert.equal(loaded.rows[0]!.cancel_at_period_end, true)
  assert.equal(
    (
      await pg.query(
        "SELECT * FROM public.load_trial_cancellation_provider_operation($1::uuid,$2::uuid)",
        [id, otherUser],
      )
    ).rows.length,
    0,
  )
  assert.equal(
    (
      await pg.query<{ confirm_trial_cancellation_provider_operation: boolean }>(
        "SELECT public.confirm_trial_cancellation_provider_operation($1::uuid,$2::uuid,'33333333-3333-4333-8333-333333333333','stripe','sub_1','cus_1','2099-01-08T00:00:00Z','','')",
        [id, user],
      )
    ).rows[0]!.confirm_trial_cancellation_provider_operation,
    true,
  )
  const first = await pg.query<{ reconciled_at: string }>(
    "SELECT reconciled_at::text FROM private.trial_cancellation_provider_operations",
  )
  assert.equal(
    (
      await pg.query<{ confirm_trial_cancellation_provider_operation: boolean }>(
        "SELECT public.confirm_trial_cancellation_provider_operation($1::uuid,$2::uuid,'33333333-3333-4333-8333-333333333333','stripe','sub_1','cus_1','2099-01-08T00:00:00Z','','')",
        [id, user],
      )
    ).rows[0]!.confirm_trial_cancellation_provider_operation,
    true,
  )
  const repeated = await pg.query<{ reconciled_at: string }>(
    "SELECT reconciled_at::text FROM private.trial_cancellation_provider_operations",
  )
  assert.equal(repeated.rows[0]!.reconciled_at, first.rows[0]!.reconciled_at)
})

test("provider operation RPC cannot confirm after a restore or ownership-link race and remains service-only", async (t) => {
  const pg = await database(t)
  const id = (
    await pg.query<{ id: string }>("SELECT id FROM private.trial_cancellation_declarations")
  ).rows[0]!.id
  await pg.query(
    "UPDATE public.trial_enrollments SET cancel_at_period_end = false WHERE id = $1::uuid",
    [enrollment],
  )
  assert.equal(
    (
      await pg.query<{ confirm_trial_cancellation_provider_operation: boolean }>(
        "SELECT public.confirm_trial_cancellation_provider_operation($1::uuid,$2::uuid,'33333333-3333-4333-8333-333333333333','stripe','sub_1','cus_1','2099-01-08T00:00:00Z','','')",
        [id, user],
      )
    ).rows[0]!.confirm_trial_cancellation_provider_operation,
    false,
  )
  await pg.exec("SET ROLE authenticated")
  await assert.rejects(
    () =>
      pg.query(
        "SELECT * FROM public.load_trial_cancellation_provider_operation($1::uuid,$2::uuid)",
        [id, user],
      ),
    /permission denied/,
  )
})

test("confirmation compares the exact provider evidence, including a concurrently replaced billing customer", async (t) => {
  const pg = await database(t)
  const id = (
    await pg.query<{ id: string }>("SELECT id FROM private.trial_cancellation_declarations")
  ).rows[0]!.id
  const confirm = async (agreement = "sub_1", customer = "cus_1", end = "2099-01-08T00:00:00Z") => {
    const result = await pg.query<{ confirmed: boolean }>(
      "SELECT public.confirm_trial_cancellation_provider_operation($1::uuid,$2::uuid,$3::uuid,'stripe',$4,$5,$6::timestamptz,'','') AS confirmed",
      [id, user, enrollment, agreement, customer, end],
    )
    return result.rows[0]!.confirmed
  }
  assert.equal(await confirm("wrong"), false)
  assert.equal(await confirm("sub_1", "wrong"), false)
  assert.equal(await confirm("sub_1", "cus_1", "2099-01-09T00:00:00Z"), false)
  await pg.exec("UPDATE public.billing_subscriptions SET provider_customer_id = 'cus_replacement'")
  assert.equal(await confirm(), false)
  assert.equal(
    (
      await pg.query<{ status: string }>(
        "SELECT status FROM private.trial_cancellation_provider_operations",
      )
    ).rows[0]!.status,
    "pending",
  )
})

test("PayPal confirmation requires the owned payer, trial cohort, and plan pin", async (t) => {
  const pg = await database(t)
  const paypalEnrollment = "66666666-6666-4666-8666-666666666666"
  const paypalBilling = "77777777-7777-4777-8777-777777777777"
  const request = "88888888-8888-4888-8888-888888888888"
  await pg.query(
    "INSERT INTO public.trial_enrollments(id,user_id,accepted_offer,provider,provider_agreement_id,admission_status,authorization_succeeded_at,original_trial_end_at) VALUES ($1::uuid,$2::uuid,'{}','paypal','I-1','active','2099-01-01T00:00:00Z','2099-01-08T00:00:00Z')",
    [paypalEnrollment, user],
  )
  await pg.query(
    "INSERT INTO public.billing_subscriptions(id,user_id,provider,provider_customer_id,provider_subscription_id,trial_enrollment_id,metadata) VALUES ($1::uuid,$2::uuid,'paypal','payer_1','I-1',$3::uuid,$4::jsonb)",
    [
      paypalBilling,
      user,
      paypalEnrollment,
      JSON.stringify({ trial_cohort: "trial_v1", paypal_plan_id: "P-trial" }),
    ],
  )
  const saved = await pg.query<{ declaration_id: string }>(
    "SELECT * FROM public.submit_trial_cancellation_declaration($1::uuid,$2::uuid,$3::uuid)",
    [request, user, paypalEnrollment],
  )
  const id = saved.rows[0]!.declaration_id
  const loaded = await pg.query<{
    enrollment_id: string
    user_id: string
    provider: string
    provider_customer_id: string
    provider_agreement_id: string
    trial_cohort: string
    provider_plan_id: string
  }>("SELECT * FROM public.load_trial_cancellation_provider_operation($1::uuid,$2::uuid)", [
    id,
    user,
  ])
  assert.equal(loaded.rows[0]!.enrollment_id, paypalEnrollment)
  assert.equal(loaded.rows[0]!.user_id, user)
  assert.equal(loaded.rows[0]!.provider, "paypal")
  assert.equal(loaded.rows[0]!.provider_customer_id, "payer_1")
  assert.equal(loaded.rows[0]!.provider_agreement_id, "I-1")
  assert.equal(loaded.rows[0]!.trial_cohort, "trial_v1")
  assert.equal(loaded.rows[0]!.provider_plan_id, "P-trial")
  await pg.query(
    "UPDATE private.trial_cancellation_provider_operations SET status = 'error' WHERE declaration_id <> $1::uuid",
    [id],
  )
  const lease = (
    await pg.query<{ lease_token: string }>(
      "SELECT * FROM public.claim_trial_cancellation_provider_operations(1,60)",
    )
  ).rows[0]!.lease_token
  const confirm = async (plan: string, leaseToken = lease) =>
    (
      await pg.query<{ confirmed: boolean }>(
        "SELECT public.confirm_trial_cancellation_provider_operation($1::uuid,$2::uuid,$3::uuid,'paypal','I-1','payer_1','2099-01-08T00:00:00Z','trial_v1',$4,$5::uuid) AS confirmed",
        [id, user, paypalEnrollment, plan, leaseToken],
      )
    ).rows[0]!.confirmed
  assert.equal(await confirm("P-other"), false)
  assert.equal(await confirm("P-trial", "99999999-9999-4999-8999-999999999999"), false)
  assert.equal(await confirm("P-trial"), true)
})
