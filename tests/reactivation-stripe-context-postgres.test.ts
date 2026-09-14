import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { after, before, beforeEach, test } from "node:test"
import { PGlite } from "@electric-sql/pglite"
import { markMembershipReactivationCheckoutCompleted } from "../src/lib/reactivation/checkout-reservations"
import { findOwnedReactivationCheckout } from "../src/lib/reactivation/checkout-recovery"

const USER = "00000000-0000-4000-8000-000000000001"
const OTHER = "00000000-0000-4000-8000-000000000002"
const RESERVATION = "00000000-0000-4000-8000-000000000003"
const ATTEMPT = "00000000-0000-4000-8000-000000000004"
const pg = new PGlite()
const migration = (name: string) =>
  readFileSync(new URL(`../supabase/migrations/${name}.sql`, import.meta.url), "utf8")

// Execute the completion helper's real predicates against PostgreSQL semantics.
// Only the PostgREST transport is replaced; lifecycle/uniqueness SQL stays real.
const completionClient = {
  from(table: string) {
    assert.equal(table, "membership_reactivation_checkout_reservations")
    const predicates: string[] = []
    const parameters: unknown[] = []
    let patch: Record<string, unknown> | undefined
    const parameter = (value: unknown) => {
      parameters.push(value)
      return `$${parameters.length}`
    }
    const column = (key: string) => {
      assert.match(key, /^(id|user_id|provider|provider_reference|status|updated_at)$/)
      return key
    }
    const builder = {
      select: () => builder,
      order: () => builder,
      limit: () => builder,
      eq: (key: string, value: unknown) => {
        predicates.push(`${column(key)} = ${parameter(value)}`)
        return builder
      },
      in: (key: string, values: unknown[]) => {
        predicates.push(`${column(key)} IN (${values.map(parameter).join(",")})`)
        return builder
      },
      update: (value: Record<string, unknown>) => {
        patch = value
        return builder
      },
      maybeSingle: async () => {
        const statement = patch
          ? `UPDATE public.${table} SET ${Object.entries(patch)
              .map(([key, value]) => `${column(key)}=${parameter(value)}`)
              .join(",")} WHERE ${predicates.join(" AND ")} RETURNING *`
          : `SELECT * FROM public.${table} WHERE ${predicates.join(" AND ")} ORDER BY created_at DESC LIMIT 1`
        const { rows } = await pg.query(statement, parameters)
        return { data: rows[0] ?? null, error: null }
      },
    }
    return builder
  },
} as unknown as Parameters<typeof markMembershipReactivationCheckoutCompleted>[0]

before(async () => {
  await pg.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE TABLE public.profiles (id uuid PRIMARY KEY);
    INSERT INTO public.profiles VALUES ('${USER}'), ('${OTHER}');`)
  await pg.exec(migration("20260714200000_membership_reactivation_checkout_reservations"))
  // The new expiry predicate reads only this existing intent relationship/marker.
  await pg.exec(`CREATE TABLE public.paypal_checkout_intents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid,
    reactivation_reservation_id uuid REFERENCES public.membership_reactivation_checkout_reservations(id),
    status text NOT NULL DEFAULT 'created', provider_subscription_id text,
    expires_at timestamptz NOT NULL DEFAULT (now()+interval '24 hours'), updated_at timestamptz NOT NULL DEFAULT now(),
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb);`)
  // Apply the real reservation grants, excluding unrelated billing RPCs absent from this harness.
  await pg.exec(
    migration("20260714220000_restrict_billing_security_definer_functions")
      .split(";")
      .filter((statement) => statement.includes("membership_reactivation"))
      .join(";") + ";",
  )
  await pg.exec(migration("20260913202413_membership_reactivation_stripe_context"))
})
after(async () => {
  await pg.close()
})
beforeEach(async () => {
  await pg.exec(`DELETE FROM public.paypal_checkout_intents;
    DELETE FROM public.membership_reactivation_checkout_reservations;
    INSERT INTO public.membership_reactivation_checkout_reservations
      (id,user_id,checkout_attempt_id,interval,expires_at)
    VALUES ('${RESERVATION}','${USER}','${ATTEMPT}','month',date_trunc('second',now()) + interval '23 hours');`)
})

async function context() {
  const { rows } = await pg.query<{ expiry: number }>(
    `SELECT extract(epoch from expires_at)::bigint AS expiry FROM public.membership_reactivation_checkout_reservations WHERE id=$1`,
    [RESERVATION],
  )
  return {
    version: 1,
    stripe_account_id: "acct_verified",
    livemode: true,
    user_id: USER,
    account_email: "owner@example.test",
    profile_customer_id: "cus_stale",
    expires_at: Number(rows[0].expiry),
    initial_params: {
      mode: "subscription",
      customer: "cus_stale",
      expires_at: Number(rows[0].expiry),
      line_items: [{ price: "price_month", quantity: 1 }],
      metadata: {
        checkout_context: "membership_reactivation",
        reactivation_reservation_id: RESERVATION,
      },
      success_url: "https://example.test/success",
      cancel_url: "https://example.test/reactivate",
    },
  }
}

async function prepare(candidate: unknown, userId = USER) {
  const { rows } = await pg.query<{ reservation: Record<string, unknown> }>(
    `SELECT to_jsonb(public.prepare_membership_reactivation_stripe_checkout($1,$2,$3)) AS reservation`,
    [RESERVATION, userId, candidate],
  )
  return rows[0].reservation
}

async function recover(
  overrides: { user?: string; account?: string; live?: boolean; customer?: string } = {},
) {
  const { rows } = await pg.query<{ reservation: Record<string, unknown> }>(
    `SELECT to_jsonb(public.recover_membership_reactivation_stripe_checkout($1,$2,$3,$4,$5)) AS reservation`,
    [
      RESERVATION,
      overrides.user ?? USER,
      overrides.account ?? "acct_verified",
      overrides.live ?? true,
      overrides.customer ?? "cus_stale",
    ],
  )
  return rows[0].reservation
}

for (const provider of ["stripe", "paypal"] as const) {
  test(`${provider} completed payment releases the old reservation for later repurchase and duplicate completion leaves the new attempt alone`, async () => {
    const reference = provider === "stripe" ? "cs_paid" : "00000000-0000-4000-8000-000000000005"
    await pg.query(
      `UPDATE public.membership_reactivation_checkout_reservations SET provider=$1, provider_reference=$2, status='reconciliation_required', stripe_checkout_context=$3, expires_at=now()-interval '1 day' WHERE id=$4`,
      [provider, reference, provider === "stripe" ? { version: 1 } : null, RESERVATION],
    )
    if (provider === "paypal") {
      await pg.query(
        `INSERT INTO public.paypal_checkout_intents(id,user_id,reactivation_reservation_id,provider_subscription_id,metadata) VALUES($1,$2,$3,'I_PAID','{"reactivation_client_creation_issued_at":"2026-09-14"}')`,
        [reference, USER, RESERVATION],
      )
    }
    assert.equal((await findOwnedReactivationCheckout(completionClient, USER))?.id, RESERVATION)
    await markMembershipReactivationCheckoutCompleted(completionClient, RESERVATION, USER, {
      provider,
      providerReference: reference,
    })
    assert.equal(await findOwnedReactivationCheckout(completionClient, USER), null)
    const { rows } = await pg.query<{
      reservation: { id: string; checkout_attempt_id: string; status: string }
    }>(
      `SELECT to_jsonb(public.acquire_membership_reactivation_checkout($1,$2,'month','/chat')) AS reservation`,
      [USER, OTHER],
    )
    assert.notEqual(rows[0].reservation.id, RESERVATION)
    assert.equal(rows[0].reservation.checkout_attempt_id, OTHER)
    assert.equal(rows[0].reservation.status, "open")
    await markMembershipReactivationCheckoutCompleted(completionClient, RESERVATION, USER, {
      provider,
      providerReference: reference,
    })
    assert.equal(
      (await findOwnedReactivationCheckout(completionClient, USER))?.id,
      rows[0].reservation.id,
    )
  })
}

test("completion refuses wrong owner, provider, reference, missing binding and terminal-expired state", async () => {
  await pg.query(
    `UPDATE public.membership_reactivation_checkout_reservations SET provider='stripe', provider_reference='cs_paid', status='reconciliation_required' WHERE id=$1`,
    [RESERVATION],
  )
  for (const [user, provider, reference] of [
    [OTHER, "stripe", "cs_paid"],
    [USER, "paypal", "cs_paid"],
    [USER, "stripe", "cs_other"],
  ] as const) {
    await assert.rejects(
      markMembershipReactivationCheckoutCompleted(completionClient, RESERVATION, user, {
        provider,
        providerReference: reference,
      }),
      /could not be completed/,
    )
  }
  assert.equal(
    (await findOwnedReactivationCheckout(completionClient, USER))?.status,
    "reconciliation_required",
  )
  await pg.query(
    `UPDATE public.membership_reactivation_checkout_reservations SET provider_reference=NULL WHERE id=$1`,
    [RESERVATION],
  )
  await assert.rejects(
    markMembershipReactivationCheckoutCompleted(completionClient, RESERVATION, USER, {
      provider: "stripe",
      providerReference: "cs_paid",
    }),
    /could not be completed/,
  )
  await pg.query(
    `UPDATE public.membership_reactivation_checkout_reservations SET provider_reference='cs_paid',status='expired' WHERE id=$1`,
    [RESERVATION],
  )
  await assert.rejects(
    markMembershipReactivationCheckoutCompleted(completionClient, RESERVATION, USER, {
      provider: "stripe",
      providerReference: "cs_paid",
    }),
    /could not be completed/,
  )
})

test("prepare atomically freezes one request and retries ignore changed profile, email and price", async () => {
  const original = await context()
  const changed = {
    ...original,
    account_email: "changed@example.test",
    profile_customer_id: "cus_changed",
    initial_params: {
      ...original.initial_params,
      customer: "cus_changed",
      line_items: [{ price: "price_other", quantity: 1 }],
    },
  }
  // PGlite serializes these submitted competitors; this proves persisted convergence,
  // while the migration's FOR UPDATE is the production multi-connection lock.
  const [first, second] = await Promise.all([prepare(original), prepare(changed)])
  assert.equal(first.provider, "stripe")
  assert.equal(first.status, "reconciliation_required")
  assert.deepEqual(first.stripe_checkout_context, original)
  assert.deepEqual(second.stripe_checkout_context, original)
  await assert.rejects(prepare({ ...original, stripe_account_id: "acct_other" }), /context changed/)
  await assert.rejects(prepare({ ...original, livemode: false }), /context changed/)
  await assert.rejects(prepare(original, OTHER), /closed or expired/)
})

test("recovery changes only customer to immutable account email and converges across retries", async () => {
  const original = await context()
  await prepare(original)
  const [first, second] = await Promise.all([recover(), recover()])
  const { customer: _customer, ...rest } = original.initial_params
  const expected = {
    ...original,
    recovery_params: { ...rest, customer_email: "owner@example.test" },
  }
  assert.deepEqual(first.stripe_checkout_context, expected)
  assert.deepEqual(second.stripe_checkout_context, expected)
  assert.deepEqual(
    (await prepare({ ...original, account_email: "new@example.test" })).stripe_checkout_context,
    expected,
  )
  for (const override of [
    { user: OTHER },
    { account: "acct_other" },
    { live: false },
    { customer: "cus_other" },
  ]) {
    await assert.rejects(recover(override), /reactivation checkout/)
  }
})

test("wrong provider, legacy selected and terminal attempts cannot adopt new keys", async () => {
  const original = await context()
  for (const [provider, status] of [
    ["paypal", "provider_selected"],
    ["stripe", "provider_selected"],
    ["stripe", "reconciliation_required"],
    [null, "completed"],
    [null, "expired"],
  ]) {
    await pg.query(
      `UPDATE public.membership_reactivation_checkout_reservations SET provider=$1,status=$2 WHERE id=$3`,
      [provider, status, RESERVATION],
    )
    await assert.rejects(prepare(original), /reactivation checkout/)
  }
})

test("prepare rejects mismatched ownership, metadata, mixed identity and mutable recovery input", async () => {
  const original = await context()
  const invalid = [
    { ...original, user_id: OTHER },
    { ...original, version: 2 },
    { ...original, recovery_params: original.initial_params },
    {
      ...original,
      initial_params: { ...original.initial_params, customer_email: original.account_email },
    },
    { ...original, initial_params: { ...original.initial_params, customer: "cus_other" } },
    {
      ...original,
      initial_params: {
        ...original.initial_params,
        payment_intent_data: { metadata: { bad: "secret" } },
      },
    },
    {
      ...original,
      initial_params: {
        ...original.initial_params,
        metadata: { reactivation_reservation_id: OTHER },
      },
    },
    {
      ...original,
      initial_params: { ...original.initial_params, expires_at: original.expires_at + 1 },
    },
  ]
  for (const candidate of invalid) await assert.rejects(prepare(candidate), /reactivation checkout/)
  const { rows } = await pg.query(
    `SELECT status,provider,stripe_checkout_context FROM public.membership_reactivation_checkout_reservations WHERE id=$1`,
    [RESERVATION],
  )
  assert.deepEqual(rows, [{ status: "open", provider: null, stripe_checkout_context: null }])
})

test("email-first creation preserves original profile snapshot and cannot enter missing-customer retry", async () => {
  const original = await context()
  const { customer: _customer, ...rest } = original.initial_params
  const candidate = {
    ...original,
    initial_params: { ...rest, customer_email: original.account_email },
  }
  assert.deepEqual((await prepare(candidate)).stripe_checkout_context, candidate)
  await assert.rejects(recover(), /identity conflict/)
})

test("bound sessions and terminal rows reject recovery; last creation window and 24-hour maximum are enforced", async () => {
  const original = await context()
  await prepare(original)
  await pg.query(
    `UPDATE public.membership_reactivation_checkout_reservations SET provider_reference='cs_known',status='provider_created' WHERE id=$1`,
    [RESERVATION],
  )
  await assert.rejects(recover(), /cannot recover/)
  for (const status of ["completed", "expired"]) {
    await pg.query(
      `UPDATE public.membership_reactivation_checkout_reservations SET provider_reference=null,status=$1 WHERE id=$2`,
      [status, RESERVATION],
    )
    await assert.rejects(recover(), /cannot recover/)
  }
  for (const interval of ["20 minutes", "25 hours", "-1 second"]) {
    await pg.query(
      `UPDATE public.membership_reactivation_checkout_reservations SET status='open',provider=null,stripe_checkout_context=null,expires_at=date_trunc('second',now()) + $1::interval WHERE id=$2`,
      [interval, RESERVATION],
    )
    await assert.rejects(prepare(await context()), /reactivation checkout/)
  }
})

test("time cannot release an uncertain context, even after binding changed status to provider_created", async () => {
  await prepare(await context())
  for (const status of ["reconciliation_required", "provider_created"]) {
    await pg.query(
      `UPDATE public.membership_reactivation_checkout_reservations SET expires_at=now()-interval '1 day',status=$1 WHERE id=$2`,
      [status, RESERVATION],
    )
    const { rows } = await pg.query<{ reservation: Record<string, unknown> }>(
      `SELECT to_jsonb(public.acquire_membership_reactivation_checkout($1,$2,'month','/chat')) AS reservation`,
      [USER, OTHER],
    )
    assert.equal(rows[0].reservation.id, RESERVATION)
    assert.equal(rows[0].reservation.status, status)
    await assert.rejects(
      pg.query(`SELECT public.claim_membership_reactivation_checkout_provider($1,$2,'paypal')`, [
        RESERVATION,
        USER,
      ]),
      /reactivation checkout/,
    )
  }
})

test("issued PayPal SDK creation stays locked beyond 24 hours, including after provider binding", async () => {
  await pg.query(
    `UPDATE public.membership_reactivation_checkout_reservations SET provider='paypal' WHERE id=$1`,
    [RESERVATION],
  )
  await pg.query(
    `INSERT INTO public.paypal_checkout_intents (user_id,reactivation_reservation_id,metadata)
    VALUES ($1,$2,'{"reactivation_client_creation_issued_at":"2026-09-13T20:00:00Z"}')`,
    [USER, RESERVATION],
  )
  for (const status of ["provider_selected", "provider_created", "reconciliation_required"]) {
    await pg.query(
      `UPDATE public.membership_reactivation_checkout_reservations SET expires_at=now()-interval '2 days',status=$1 WHERE id=$2`,
      [status, RESERVATION],
    )
    const { rows } = await pg.query<{ reservation: Record<string, unknown> }>(
      `SELECT to_jsonb(public.acquire_membership_reactivation_checkout($1,$2,'month','/chat')) AS reservation`,
      [USER, OTHER],
    )
    assert.equal(rows[0].reservation.id, RESERVATION)
    assert.equal(rows[0].reservation.status, status)
  }
  await assert.rejects(
    pg.query(`SELECT public.claim_membership_reactivation_checkout_provider($1,$2,'paypal')`, [
      RESERVATION,
      USER,
    ]),
    /reactivation checkout/,
  )
  const { rows } = await pg.query(
    `SELECT status FROM public.membership_reactivation_checkout_reservations WHERE id=$1`,
    [RESERVATION],
  )
  assert.deepEqual(rows, [{ status: "reconciliation_required" }])
  await assert.rejects(
    pg.query(`SELECT public.claim_membership_reactivation_checkout_provider($1,$2,'stripe')`, [
      RESERVATION,
      USER,
    ]),
    /reactivation checkout/,
  )
})

test("unissued PayPal same-provider reconciliation remains available without reopening its status", async () => {
  await pg.query(
    `UPDATE public.membership_reactivation_checkout_reservations SET provider='paypal',status='reconciliation_required' WHERE id=$1`,
    [RESERVATION],
  )
  const { rows } = await pg.query<{ reservation: Record<string, unknown> }>(
    `SELECT to_jsonb(public.claim_membership_reactivation_checkout_provider($1,$2,'paypal')) AS reservation`,
    [RESERVATION, USER],
  )
  assert.equal(rows[0].reservation.status, "reconciliation_required")
})

test("unmarked legacy PayPal expiry stays unchanged", async () => {
  await pg.query(
    `UPDATE public.membership_reactivation_checkout_reservations SET provider='paypal',status='provider_created',expires_at=now()-interval '2 days' WHERE id=$1`,
    [RESERVATION],
  )
  await pg.query(
    `INSERT INTO public.paypal_checkout_intents (user_id,reactivation_reservation_id) VALUES ($1,$2)`,
    [USER, RESERVATION],
  )
  const { rows } = await pg.query<{ reservation: Record<string, unknown> }>(
    `SELECT to_jsonb(public.acquire_membership_reactivation_checkout($1,$2,'month','/chat')) AS reservation`,
    [USER, OTHER],
  )
  assert.notEqual(rows[0].reservation.id, RESERVATION)
  assert.equal(rows[0].reservation.status, "open")
})

async function paypalIssuanceFixture() {
  await pg.query(
    `UPDATE public.membership_reactivation_checkout_reservations SET provider='paypal',status='provider_created',provider_reference=$1 WHERE id=$2`,
    [ATTEMPT, RESERVATION],
  )
  await pg.query(
    `INSERT INTO public.paypal_checkout_intents (id,user_id,reactivation_reservation_id,metadata)
    VALUES ($1,$2,$3,'{"paypal_plan_id":"P-MONTH","checkout_context":"membership_reactivation"}')`,
    [ATTEMPT, USER, RESERVATION],
  )
}
async function issuePayPal(reservationId = RESERVATION, userId = USER, intentId = ATTEMPT) {
  const { rows } = await pg.query<{ issued: boolean }>(
    `SELECT public.claim_membership_reactivation_paypal_client_creation($1,$2,$3) AS issued`,
    [reservationId, userId, intentId],
  )
  return rows[0].issued
}

test("PayPal issuance atomically claims one token and preserves metadata across submitted competitors", async () => {
  await paypalIssuanceFixture()
  assert.deepEqual(await Promise.all([issuePayPal(), issuePayPal()]), [true, false])
  const { rows } = await pg.query<{ status: string; metadata: Record<string, unknown> }>(
    `SELECT r.status,i.metadata FROM public.membership_reactivation_checkout_reservations r
    JOIN public.paypal_checkout_intents i ON i.reactivation_reservation_id=r.id WHERE r.id=$1`,
    [RESERVATION],
  )
  assert.equal(rows[0].status, "reconciliation_required")
  assert.equal(rows[0].metadata.paypal_plan_id, "P-MONTH")
  assert.equal(rows[0].metadata.checkout_context, "membership_reactivation")
  assert.equal(typeof rows[0].metadata.reactivation_client_creation_issued_at, "string")
})

test("PayPal issuance refuses a closed, expired, wrong-owner or wrong-provider reservation without minting a token", async () => {
  await paypalIssuanceFixture()
  assert.equal(await issuePayPal(OTHER), false)
  assert.equal(await issuePayPal(RESERVATION, OTHER), false)
  assert.equal(await issuePayPal(RESERVATION, USER, OTHER), false)
  for (const status of ["open", "completed", "expired"]) {
    await pg.query(
      `UPDATE public.membership_reactivation_checkout_reservations SET status=$1 WHERE id=$2`,
      [status, RESERVATION],
    )
    assert.equal(await issuePayPal(), false)
  }
  await pg.query(
    `UPDATE public.membership_reactivation_checkout_reservations SET status='provider_created',expires_at=now()-interval '1 second' WHERE id=$1`,
    [RESERVATION],
  )
  assert.equal(await issuePayPal(), false)
  await pg.query(
    `UPDATE public.membership_reactivation_checkout_reservations SET provider='stripe',expires_at=now()+interval '1 hour' WHERE id=$1`,
    [RESERVATION],
  )
  assert.equal(await issuePayPal(), false)
  const { rows } = await pg.query(
    `SELECT metadata ? 'reactivation_client_creation_issued_at' AS issued FROM public.paypal_checkout_intents WHERE id=$1`,
    [ATTEMPT],
  )
  assert.deepEqual(rows, [{ issued: false }])
})

test("PayPal issuance rejects a completed, expired, bound or differently owned intent", async () => {
  await paypalIssuanceFixture()
  for (const status of ["approved", "duplicate", "activated", "expired"]) {
    await pg.query(`UPDATE public.paypal_checkout_intents SET status=$1 WHERE id=$2`, [
      status,
      ATTEMPT,
    ])
    assert.equal(await issuePayPal(), false)
  }
  await pg.query(
    `UPDATE public.paypal_checkout_intents SET status='created',expires_at=now()-interval '1 second' WHERE id=$1`,
    [ATTEMPT],
  )
  assert.equal(await issuePayPal(), false)
  await pg.query(
    `UPDATE public.paypal_checkout_intents SET expires_at=now()+interval '1 hour',provider_subscription_id='I-PAID' WHERE id=$1`,
    [ATTEMPT],
  )
  assert.equal(await issuePayPal(), false)
  await pg.query(
    `UPDATE public.paypal_checkout_intents SET provider_subscription_id=null,user_id=$1 WHERE id=$2`,
    [OTHER, ATTEMPT],
  )
  assert.equal(await issuePayPal(), false)
  const { rows } = await pg.query(
    `SELECT status FROM public.membership_reactivation_checkout_reservations WHERE id=$1`,
    [RESERVATION],
  )
  assert.deepEqual(rows, [{ status: "provider_created" }])
})

test("RPC privileges and private ledger refuse public roles and use service-role invoker with empty search path", async () => {
  const { rows } = await pg.query<{
    proname: string
    prosecdef: boolean
    proconfig: string[]
    anon: boolean
    authenticated: boolean
    service: boolean
  }>(`
    SELECT p.proname,p.prosecdef,p.proconfig,
      has_function_privilege('anon',p.oid,'EXECUTE') AS anon,
      has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated,
      has_function_privilege('service_role',p.oid,'EXECUTE') AS service
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname IN ('prepare_membership_reactivation_stripe_checkout','recover_membership_reactivation_stripe_checkout','claim_membership_reactivation_paypal_client_creation')`)
  assert.equal(rows.length, 3)
  for (const row of rows) {
    assert.equal(row.prosecdef, false)
    assert.deepEqual(row.proconfig, ['search_path=""'])
    assert.equal(row.anon, false)
    assert.equal(row.authenticated, false)
    assert.equal(row.service, true)
  }
  await pg.exec("SET ROLE anon")
  await assert.rejects(
    pg.query(
      `SELECT stripe_checkout_context FROM public.membership_reactivation_checkout_reservations`,
    ),
    /permission denied/,
  )
  await pg.exec("RESET ROLE")
  await pg.exec("SET ROLE service_role")
  try {
    assert.equal((await prepare(await context())).provider, "stripe")
  } finally {
    await pg.exec("RESET ROLE")
  }
})

test("rollback claim cannot enter a Stripe reservation with frozen request state", async () => {
  await pg.query(
    `UPDATE public.membership_reactivation_checkout_reservations SET provider='stripe',status='reconciliation_required',stripe_checkout_context=$1 WHERE id=$2`,
    [await context(), RESERVATION],
  )
  await assert.rejects(
    pg.query(`SELECT public.claim_membership_reactivation_checkout_provider($1,$2,'stripe')`, [
      RESERVATION,
      USER,
    ]),
    /reactivation checkout/,
  )
})

test("legacy claim cannot reopen a completed attempt", async () => {
  await pg.query(
    `UPDATE public.membership_reactivation_checkout_reservations SET status='completed',provider='stripe' WHERE id=$1`,
    [RESERVATION],
  )
  await assert.rejects(
    pg.query(`SELECT public.claim_membership_reactivation_checkout_provider($1,$2,'stripe')`, [
      RESERVATION,
      USER,
    ]),
    /reactivation checkout/,
  )
})
