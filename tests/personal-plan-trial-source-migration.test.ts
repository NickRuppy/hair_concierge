import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { PGlite } from "@electric-sql/pglite"
import { uuid_ossp } from "@electric-sql/pglite/contrib/uuid_ossp"
import { predecessorSchemaSql } from "./personal-plan-migration-admission.fixtures"

const migration = "supabase/migrations/20260915202841_personal_plan_trial_source.sql"
const sql = (name: string) => readFile(`supabase/migrations/${name}.sql`, "utf8")
const user = "11111111-1111-4111-8111-111111111111"
const other = "22222222-2222-4222-8222-222222222222"

type Source = {
  enrollment_id: string
  lead_id: string
  quiz_source_kind: string
  qualified_at: string
}

async function database(t: { after: (fn: () => Promise<void>) => void }) {
  const pg = new PGlite({ extensions: { uuid_ossp } })
  t.after(() => pg.close())
  await pg.exec(predecessorSchemaSql)
  await pg.exec(await sql("20260828104243_personal_plan_paid_migration_admission"))
  await pg.exec(await sql("20260914044650_trial_admission_foundation"))
  // Execute the actual current access function (the rest of this migration
  // concerns frozen PayPal schedules and is outside this read-only contract).
  const access = await sql("20260915190000_paypal_trial_frozen_end")
  await pg.exec(
    access.slice(access.indexOf("CREATE OR REPLACE FUNCTION public.trial_enrollment_has_access")),
  )
  await pg.exec(await sql("20260914051731_trial_paid_migration_authority"))
  // Real checkout table DDL, including its constraints; the unrelated writer
  // routines need provider catalog infrastructure and are not used here.
  for (const [name, marker] of [
    ["20260527_add_billing_subscriptions", "CREATE TABLE IF NOT EXISTS paypal_checkout_intents"],
    ["20260914091103_trial_checkout_attempt", "CREATE TABLE public.trial_checkout_attempts"],
    [
      "20260914120000_paypal_trial_checkout_attempt",
      "CREATE TABLE private.paypal_trial_checkout_attempts",
    ],
  ]) {
    const source = await sql(name)
    const start = source.indexOf(marker)
    assert.ok(start >= 0)
    await pg.exec(source.slice(start, source.indexOf(";", start) + 1))
  }
  await pg.exec(`
    ALTER ROLE service_role BYPASSRLS;
    GRANT USAGE ON SCHEMA public, private, auth TO service_role, authenticated;
    GRANT SELECT ON public.billing_subscriptions, public.leads, public.trial_checkout_attempts,
      public.paypal_checkout_intents, private.paypal_trial_checkout_attempts TO service_role;
    REVOKE ALL ON FUNCTION public.trial_enrollment_has_access(public.trial_enrollments,timestamptz) FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION public.trial_enrollment_has_access(public.trial_enrollments,timestamptz) TO service_role;
    INSERT INTO public.profiles(id) VALUES ('${user}'),('${other}');
  `)
  await pg.exec(await readFile(migration, "utf8"))
  return pg
}

async function seed(
  pg: PGlite,
  provider: "stripe" | "paypal",
  options: {
    scope?: "user" | "lead"
    quiz?: "legacy" | "personal_plan"
    owner?: string
    age?: string
    revoked?: boolean
    status?: string
    missingSource?: boolean
    metadataLead?: string
    metadataEnrollment?: string
    scopeId?: string
    billingOwner?: string
    billingProvider?: string
    cohort?: string
    intentOwner?: string
    intentAgreement?: string
    frozenStatus?: string
  } = {},
) {
  const enrollment = randomUUID(),
    lead = randomUUID(),
    attempt = randomUUID(),
    intent = randomUUID()
  const agreement = `${provider}_${enrollment}`
  const scope = options.scope ?? "lead"
  await pg.query(
    "INSERT INTO public.leads(id,email,user_id,quiz_kind) VALUES ($1,'fixture@example.invalid',$2,$3)",
    [lead, options.owner ?? user, options.quiz ?? "legacy"],
  )
  await pg.query(
    `INSERT INTO public.trial_enrollments(id,user_id,accepted_offer,provider,provider_agreement_id,
    admission_status,authorization_succeeded_at,original_trial_end_at,access_revoked)
    VALUES ($1,$2,'{}',$3,$4,$5,now()-$6::interval,now()-$6::interval+interval '7 days',$7)`,
    [
      enrollment,
      user,
      provider,
      agreement,
      options.status ?? "active",
      options.age ?? "1 minute",
      options.revoked ?? false,
    ],
  )
  await pg.query(
    `INSERT INTO public.billing_subscriptions(id,user_id,provider,provider_subscription_id,
    provider_status,entitlement_status,trial_enrollment_id,metadata)
    VALUES ($1,$2,$3,$4,'ACTIVE','active',$5,$6)`,
    [
      randomUUID(),
      options.billingOwner ?? user,
      options.billingProvider ?? provider,
      agreement,
      enrollment,
      JSON.stringify({ trial_cohort: options.cohort ?? "trial_v1" }),
    ],
  )
  if (!options.missingSource) {
    const scopeId = options.scopeId ?? (scope === "lead" ? lead : user)
    if (provider === "stripe") {
      await pg.query(
        `INSERT INTO public.trial_checkout_attempts(id,scope_kind,scope_id,client_attempt_id,
        enrollment_id,accepted_offer,status,stripe_account_id,stripe_livemode,stripe_params,expires_at,provider_reference)
        VALUES ($1,$2,$3,$1,$4,'{}',$5,'acct_test',false,$6,now()+interval '1 hour','cs_test_exact')`,
        [
          attempt,
          scope,
          scopeId,
          enrollment,
          options.frozenStatus ?? "provider_created",
          JSON.stringify({
            metadata: {
              lead_id: options.metadataLead ?? lead,
              trial_enrollment_id: options.metadataEnrollment ?? enrollment,
              trial_cohort: "trial_v1",
            },
          }),
        ],
      )
    } else {
      await pg.query(
        `INSERT INTO public.paypal_checkout_intents(id,token,interval,source,lead_id,user_id,
        provider_subscription_id,expires_at,metadata) VALUES ($1::uuid,($1::uuid)::text,'month','quiz_result_offer',$2,$3,$4,now()+interval '1 day',$5)`,
        [
          intent,
          lead,
          options.intentOwner ?? null,
          options.intentAgreement ?? agreement,
          JSON.stringify({
            trial_enrollment_id: options.metadataEnrollment ?? enrollment,
            trial_cohort: "trial_v1",
          }),
        ],
      )
      await pg.query(
        `INSERT INTO private.paypal_trial_checkout_attempts(id,scope_kind,scope_id,client_attempt_id,
        enrollment_id,intent_id,accepted_offer,status,provider_reference)
        VALUES ($1,$2,$3,$1,$4,$5,'{}',$6,$7)`,
        [
          attempt,
          scope,
          scopeId,
          enrollment,
          intent,
          options.frozenStatus ?? "provider_created",
          agreement,
        ],
      )
    }
  }
  return { enrollment, lead, agreement }
}

async function resolve(pg: PGlite, owner = user) {
  await pg.exec("SET ROLE service_role")
  try {
    const result = await pg.query<{ source: Source | null }>(
      "SELECT public.personal_plan_resolve_trial_source($1) AS source",
      [owner],
    )
    return result.rows[0]!.source
  } finally {
    await pg.exec("RESET ROLE")
  }
}
async function routing(pg: PGlite, owner = user) {
  await pg.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [owner])
  await pg.exec("SET ROLE authenticated")
  try {
    return (
      await pg.query<{ source: Record<string, unknown> | null }>(
        "SELECT public.personal_plan_get_own_routing_source() AS source",
      )
    ).rows[0]!.source
  } finally {
    await pg.exec("RESET ROLE")
  }
}

for (const provider of ["paypal", "stripe"] as const) {
  for (const scope of ["lead", "user"] as const) {
    test(`${provider} ${scope} checkout resolves without purchase or analytics, through service and owner routing`, async (t) => {
      const pg = await database(t)
      const seeded = await seed(pg, provider, {
        scope,
        quiz: scope === "lead" ? "legacy" : "personal_plan",
      })
      const source = await resolve(pg)
      assert.equal(source?.enrollment_id, seeded.enrollment)
      assert.equal(source?.lead_id, seeded.lead)
      assert.equal(source?.quiz_source_kind, scope === "lead" ? "legacy" : "personal_plan")
      assert.deepEqual(Object.keys(source!).sort(), [
        "enrollment_id",
        "lead_id",
        "qualified_at",
        "quiz_source_kind",
      ])
      const own = await routing(pg)
      assert.equal(own?.source_kind, "trial")
      assert.equal(own?.source_id, seeded.enrollment)
      assert.equal(own?.lead_id, seeded.lead)
      assert.equal(own?.plan, null)
      assert.equal(await routing(pg, other), null)
      assert.equal(await resolve(pg, other), null)
      assert.equal(await routing(pg, ""), null)
    })
  }
}

test("source identity survives replacement billing agreement and paid continuation, exposing the existing frontier", async (t) => {
  const pg = await database(t)
  const { enrollment, lead } = await seed(pg, "paypal")
  const before = await resolve(pg)
  await pg.query(
    "UPDATE public.billing_subscriptions SET provider_subscription_id='I-REPLACED' WHERE trial_enrollment_id=$1",
    [enrollment],
  )
  await pg.query(
    "UPDATE public.trial_enrollments SET first_payment_succeeded_at=now(),paid_through_at=now()+interval '30 days' WHERE id=$1",
    [enrollment],
  )
  const need = randomUUID()
  await pg.query(
    "INSERT INTO public.personal_plans(user_id,enrollment_purchase_source_id,current_initial_need_version_id) VALUES ($1,$2,$3)",
    [user, enrollment, need],
  )
  assert.deepEqual(await resolve(pg), before)
  const own = await routing(pg)
  assert.equal(own?.source_kind, "trial")
  assert.equal(own?.source_id, enrollment)
  assert.equal(own?.lead_id, lead)
  assert.equal((own?.plan as Record<string, unknown>)?.current_initial_need_version_id, need)
})

test("untrusted, absent, revoked, expired, and mismatched source evidence fails closed", async (t) => {
  const pg = await database(t)
  const cases: Array<["stripe" | "paypal", Parameters<typeof seed>[2]]> = [
    ["paypal", { revoked: true }],
    ["paypal", { age: "40 days" }],
    ["paypal", { age: "-1 day" }],
    ["paypal", { status: "reserved" }],
    ["paypal", { owner: other }],
    ["paypal", { missingSource: true }],
    ["paypal", { billingOwner: other }],
    ["paypal", { billingProvider: "stripe" }],
    ["paypal", { cohort: "unknown" }],
    ["paypal", { scopeId: other }],
    ["paypal", { intentOwner: other }],
    ["paypal", { intentAgreement: "I-WRONG" }],
    ["paypal", { metadataEnrollment: other }],
    ["paypal", { frozenStatus: "frozen" }],
    ["stripe", { metadataLead: "not-a-uuid" }],
    ["stripe", { metadataLead: other }],
    ["stripe", { metadataEnrollment: other }],
    ["stripe", { scope: "user", scopeId: other }],
    ["stripe", { owner: other }],
    ["stripe", { frozenStatus: "frozen" }],
  ]
  for (const [provider, options] of cases) {
    await pg.exec("BEGIN")
    try {
      await seed(pg, provider, options)
      assert.equal(await resolve(pg), null, JSON.stringify({ provider, options }))
    } finally {
      await pg.exec("ROLLBACK")
    }
  }
})

test("two valid trials are ambiguous rather than selecting the latest quiz", async (t) => {
  const pg = await database(t)
  await seed(pg, "paypal")
  await seed(pg, "stripe")
  assert.equal(await resolve(pg), null)
  assert.equal(await routing(pg), null)
})

test("arbitrary-user RPC and its helper are service-only; owner routing remains authenticated", async (t) => {
  const pg = await database(t)
  await seed(pg, "paypal")
  assert.ok(await resolve(pg))
  for (const role of ["anon", "authenticated"]) {
    for (const schema of ["public", "private"]) {
      await pg.exec(`SET ROLE ${role}`)
      await assert.rejects(
        pg.query(`SELECT ${schema}.personal_plan_resolve_trial_source($1)`, [user]),
        /permission denied/,
      )
      await pg.exec("RESET ROLE")
    }
  }
  const functions = await pg.query<{
    proname: string
    prosecdef: boolean
  }>(`SELECT proname,prosecdef FROM pg_proc
    WHERE proname='personal_plan_resolve_trial_source'`)
  assert.equal(functions.rows.length, 2)
  assert.ok(functions.rows.every((row) => !row.prosecdef))
})

test("recognized paid source retains precedence over a valid trial", async (t) => {
  const pg = await database(t)
  const { lead } = await seed(pg, "paypal")
  const paid = randomUUID()
  await pg.query(
    `INSERT INTO public.billing_subscriptions(id,user_id,provider,provider_subscription_id,
    provider_status,entitlement_status,metadata) VALUES ($1,$2,'stripe','sub_paid','active','active',
    '{"pricing_catalog":"personal_plan_launch_v1","checkout_session_id":"cs_paid"}')`,
    [paid, user],
  )
  await pg.query(
    `INSERT INTO public.funnel_sessions(id,lead_id,user_id,purchase_completed_at,purchase_provider,purchase_reference)
    VALUES ($1,$2,$3,now(),'stripe','cs_paid')`,
    [randomUUID(), lead, user],
  )
  const source = await routing(pg)
  assert.equal(source?.source_id, paid)
  assert.equal(source?.source_kind, "paid")
  assert.ok(await resolve(pg), "the trial remains valid but does not replace the paid source")
})

test("canceled future trial remains a source until typed access ends, regardless of provider row status", async (t) => {
  const pg = await database(t)
  const { enrollment } = await seed(pg, "paypal")
  await pg.query("UPDATE public.trial_enrollments SET cancel_at_period_end=true WHERE id=$1", [
    enrollment,
  ])
  await pg.query(
    "UPDATE public.billing_subscriptions SET entitlement_status='canceled',provider_status='CANCELLED' WHERE trial_enrollment_id=$1",
    [enrollment],
  )
  assert.equal((await resolve(pg))?.enrollment_id, enrollment)
  await pg.query("UPDATE public.trial_enrollments SET access_revoked=true WHERE id=$1", [
    enrollment,
  ])
  assert.equal(await resolve(pg), null)
  assert.equal(await routing(pg), null)
})
