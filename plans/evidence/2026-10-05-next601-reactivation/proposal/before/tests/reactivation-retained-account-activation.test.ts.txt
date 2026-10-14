import assert from "node:assert/strict"
import test from "node:test"
import { createHash } from "node:crypto"
import { ensureCheckoutAccount } from "../src/lib/stripe/checkout-activation"
import { handleCheckoutSessionCompleted } from "../src/lib/stripe/webhook-handlers"
import { findOwnedReactivationCheckout } from "../src/lib/reactivation/checkout-recovery"

const reservationId = "00000000-0000-4000-8000-000000000001"
const userId = "00000000-0000-4000-8000-000000000002"
function fixture() {
  const metadata = {
    checkout_context: "membership_reactivation",
    reactivation_reservation_id: reservationId,
    stripe_checkout_context_version: "1",
  }
  const session: any = {
    id: "cs_reactivation",
    status: "complete",
    payment_status: "paid",
    livemode: true,
    customer: "cus_replacement",
    customer_details: { email: "billing@example.com" },
    subscription: "sub_reactivation",
    metadata,
  }
  const context: any = {
    version: 1,
    stripe_account_id: "acct_expected",
    livemode: true,
    user_id: userId,
    account_email: "login@example.com",
    profile_customer_id: "cus_missing",
    expires_at: 1800000000,
    initial_params: { mode: "subscription", customer: "cus_missing", metadata },
    recovery_params: { mode: "subscription", customer_email: "login@example.com", metadata },
  }
  const reservation: any = {
    id: reservationId,
    user_id: userId,
    provider: "stripe",
    provider_reference: session.id,
    status: "provider_created",
    stripe_checkout_context: context,
  }
  const profiles: any[] = [
    { id: userId, email: "login@example.com", stripe_customer_id: "cus_missing", history: "keep" },
  ]
  const users: any[] = [
    {
      id: userId,
      email: "login@example.com",
      app_metadata: {
        checkout_activation_session_hash: createHash("sha256").update(session.id).digest("hex"),
      },
    },
  ]
  const billing: any[] = []
  const writes: any[] = []
  const links: any[] = []
  let beforeProfileUpdate: (() => void) | undefined
  let beforeBillingInsert: (() => void) | undefined
  let completionError = false
  const supabase: any = {
    auth: {
      admin: {
        getUserById: async (id: string) => ({
          data: { user: users.find((u) => u.id === id) ?? null },
          error: null,
        }),
        createUser: async (args: any) => {
          writes.push(["createUser", args])
          const user = { id: "new-user", email: args.email, app_metadata: args.app_metadata }
          users.push(user)
          return { data: { user }, error: null }
        },
      },
    },
    from(table: string) {
      const rows =
        table === "profiles"
          ? profiles
          : table === "billing_subscriptions"
            ? billing
            : table === "membership_reactivation_checkout_reservations"
              ? [reservation]
              : []
      const filters: Array<(row: any) => boolean> = []
      let patch: any
      let insert: any
      let insertOnly = false
      const execute = () => {
        if (patch && table === "membership_reactivation_checkout_reservations" && completionError) {
          return { data: null, error: new Error("completion temporarily unavailable") }
        }
        if (patch && table === "profiles" && beforeProfileUpdate) {
          const action = beforeProfileUpdate
          beforeProfileUpdate = undefined
          action()
        }
        let row = rows.find((r) => filters.every((f) => f(r)))
        if (patch && row) {
          writes.push([table, { ...patch }])
          Object.assign(row, patch)
        }
        if (insert) {
          if (insertOnly && table === "billing_subscriptions" && beforeBillingInsert) {
            const action = beforeBillingInsert
            beforeBillingInsert = undefined
            action()
          }
          row = rows.find((r) =>
            table === "profiles"
              ? r.id === insert.id
              : r.provider_subscription_id === insert.provider_subscription_id,
          )
          if (row && insertOnly) return { data: null, error: { code: "23505" } }
          if (row) Object.assign(row, insert)
          else {
            row = { ...insert }
            rows.push(row)
          }
          writes.push([table, { ...insert }])
        }
        return { data: row ? { ...row } : null, error: null }
      }
      const builder: any = {
        select: () => builder,
        order: () => builder,
        limit: () => builder,
        in: (key: string, values: unknown[]) => {
          filters.push((r) => values.includes(r[key]))
          return builder
        },
        eq: (key: string, value: unknown) => {
          filters.push((r) => r[key] === value)
          return builder
        },
        is: (key: string, value: unknown) => {
          filters.push((r) => (r[key] ?? null) === value)
          return builder
        },
        update: (value: any) => {
          patch = value
          return builder
        },
        upsert: (value: any) => {
          insert = value
          return builder
        },
        insert: (value: any) => {
          insertOnly = true
          insert = value
          return builder
        },
        maybeSingle: async () => execute(),
        single: async () => execute(),
        then: (resolve: any, reject: any) => Promise.resolve(execute()).then(resolve, reject),
      }
      return builder
    },
  }
  const deps: any = {
    supabase,
    premiumTierId: "premium",
    now: () => new Date("2026-09-13"),
    linkQuizToProfile: async (...args: any[]) => {
      links.push(args)
    },
    stripe: {
      accounts: { retrieve: async () => ({ id: "acct_expected" }) },
      subscriptions: {
        retrieve: async () => ({
          id: "sub_reactivation",
          status: "active",
          items: {
            data: [
              {
                current_period_end: 1800000000,
                price: { recurring: { interval: "month", interval_count: 1 } },
              },
            ],
          },
        }),
      },
    },
  }
  return {
    session,
    context,
    reservation,
    profiles,
    users,
    billing,
    writes,
    links,
    deps,
    failCompletion: (fail: boolean) => {
      completionError = fail
    },
    race: (fn: () => void) => {
      beforeProfileUpdate = fn
    },
    raceBilling: (fn: () => void) => {
      beforeBillingInsert = fn
    },
  }
}

test("Stripe webhook completes a paid reactivation without browser return and no longer offers the old attempt", async () => {
  const f = fixture()
  f.reservation.status = "reconciliation_required"
  await handleCheckoutSessionCompleted(f.session, f.deps)
  assert.equal(f.reservation.status, "completed")
  assert.equal(f.billing[0].user_id, userId)
  assert.equal(await findOwnedReactivationCheckout(f.deps.supabase, userId), null)
  // Later expiry must not make the old reservation eligible for recovery again.
  f.profiles[0].subscription_status = "canceled"
  f.profiles[0].current_period_end = "2020-01-01T00:00:00Z"
  f.billing[0].entitlement_status = "inactive"
  assert.equal(await findOwnedReactivationCheckout(f.deps.supabase, userId), null)
})

test("Stripe duplicate webhook safely repeats completion of the same bound reservation", async () => {
  const f = fixture()
  await handleCheckoutSessionCompleted(f.session, f.deps)
  await handleCheckoutSessionCompleted(f.session, f.deps)
  assert.equal(f.reservation.status, "completed")
  assert.equal(f.billing.length, 1)
  assert.equal(f.users.length, 1)
})

test("Stripe completion persistence failure rejects webhook processing and the retry closes the attempt", async () => {
  const f = fixture()
  f.failCompletion(true)
  await assert.rejects(
    handleCheckoutSessionCompleted(f.session, f.deps),
    /completion temporarily unavailable/,
  )
  assert.equal(f.reservation.status, "provider_created")
  f.failCompletion(false)
  await handleCheckoutSessionCompleted(f.session, f.deps)
  assert.equal(f.reservation.status, "completed")
  assert.equal(f.billing.length, 1)
})

test("Stripe activation cannot complete a reservation whose provider binding changed during activation", async () => {
  const f = fixture()
  f.race(() => {
    f.reservation.provider_reference = "cs_other"
  })
  await assert.rejects(handleCheckoutSessionCompleted(f.session, f.deps), /could not be completed/)
  assert.equal(f.reservation.status, "provider_created")
})

test("versioned reactivation keeps login account/email even if Stripe billing email belongs to another account", async () => {
  const f = fixture()
  f.profiles.push({ id: "other", email: "billing@example.com", stripe_customer_id: "cus_other" })
  f.users.push({ id: "other", email: "billing@example.com" })
  const result = await ensureCheckoutAccount(f.session, f.deps)
  assert.equal(result.userId, userId)
  assert.equal(result.email, "login@example.com")
  assert.equal(result.canSetInitialPassword, false)
  assert.equal(f.profiles[0].email, "login@example.com")
  assert.equal(f.profiles[0].stripe_customer_id, "cus_replacement")
  assert.equal(f.profiles[0].history, "keep")
  assert.equal(f.profiles[1].stripe_customer_id, "cus_other")
  assert.equal(f.billing[0].user_id, userId)
  assert.equal(f.links[0][1], "login@example.com")
  assert.equal(
    f.writes.some((w) => w[0] === "createUser"),
    false,
  )
})

test("webhook before provider binding remains retryable and never creates another account", async () => {
  const f = fixture()
  f.reservation.provider_reference = null
  f.reservation.status = "reconciliation_required"
  await assert.rejects(ensureCheckoutAccount(f.session, f.deps), {
    code: "checkout_reactivation_pending_binding",
  })
  assert.deepEqual(f.writes, [])
  f.reservation.provider_reference = f.session.id
  f.reservation.status = "provider_created"
  assert.equal((await ensureCheckoutAccount(f.session, f.deps)).userId, userId)
})

test("duplicate completed webhook retains account and never grants initial-password capability", async () => {
  const f = fixture()
  const first = await ensureCheckoutAccount(f.session, f.deps)
  f.reservation.status = "completed"
  const second = await ensureCheckoutAccount(f.session, f.deps)
  assert.equal(first.userId, userId)
  assert.equal(second.userId, userId)
  assert.equal(second.canSetInitialPassword, false)
  assert.equal(f.billing.length, 1)
  assert.equal(f.users.length, 1)
})

for (const reason of [
  "customer owner",
  "subscription owner",
  "missing auth",
  "missing profile",
  "different session",
  "wrong provider",
  "wrong mode",
  "wrong account",
  "context owner",
  "unknown version",
  "missing context",
  "changed profile customer",
] as const) {
  test(`versioned reactivation fails closed without writes for ${reason}`, async () => {
    const f = fixture()
    if (reason === "customer owner")
      f.profiles.push({
        id: "other",
        email: "other@example.com",
        stripe_customer_id: "cus_replacement",
      })
    if (reason === "subscription owner")
      f.billing.push({
        provider: "stripe",
        provider_subscription_id: "sub_reactivation",
        user_id: "other",
      })
    if (reason === "missing auth") f.users.length = 0
    if (reason === "missing profile") f.profiles.length = 0
    if (reason === "different session") f.reservation.provider_reference = "cs_other"
    if (reason === "wrong provider") f.reservation.provider = "paypal"
    if (reason === "wrong mode") f.context.livemode = false
    if (reason === "wrong account") f.context.stripe_account_id = "acct_other"
    if (reason === "context owner") f.context.user_id = "other"
    if (reason === "unknown version") f.session.metadata.stripe_checkout_context_version = "2"
    if (reason === "missing context") f.reservation.stripe_checkout_context = null
    if (reason === "changed profile customer") f.profiles[0].stripe_customer_id = "cus_newer"
    await assert.rejects(ensureCheckoutAccount(f.session, f.deps), {
      code: "checkout_ownership_conflict",
    })
    assert.deepEqual(f.writes, [])
  })
}

test("a profile customer changed after ownership reads is not overwritten", async () => {
  const f = fixture()
  f.race(() => {
    f.profiles[0].stripe_customer_id = "cus_newer"
  })
  await assert.rejects(ensureCheckoutAccount(f.session, f.deps), {
    code: "checkout_ownership_conflict",
  })
  assert.equal(f.profiles[0].stripe_customer_id, "cus_newer")
  assert.equal(f.billing.length, 1)
  assert.equal(f.billing[0].user_id, userId)
  assert.equal(
    f.writes.some((w) => w[0] === "profiles"),
    false,
  )
})

test("versioned reactivation needs no Stripe billing email when canonical login identity exists", async () => {
  const f = fixture()
  f.session.customer_details = null
  const result = await ensureCheckoutAccount(f.session, f.deps)
  assert.equal(result.email, "login@example.com")
  assert.equal(result.userId, userId)
})

test("initial request reuses its valid customer and a null snapshot can adopt a newly created customer", async () => {
  for (const original of ["cus_replacement", null]) {
    const f = fixture()
    f.profiles[0].stripe_customer_id = original
    f.context.profile_customer_id = original
    delete f.context.recovery_params
    if (original) f.context.initial_params.customer = original
    else {
      delete f.context.initial_params.customer
      f.context.initial_params.customer_email = "login@example.com"
    }
    assert.equal((await ensureCheckoutAccount(f.session, f.deps)).userId, userId)
    assert.equal(f.profiles[0].stripe_customer_id, "cus_replacement")
  }
})

test("different frozen metadata or customer prevents activation", async () => {
  for (const mutation of ["metadata", "customer"]) {
    const f = fixture()
    f.context.recovery_params = {
      ...f.context.recovery_params,
      metadata: { ...f.context.recovery_params.metadata },
    }
    if (mutation === "metadata") f.context.recovery_params.metadata.return_destination = "/routine"
    else f.context.recovery_params.customer = "cus_different"
    await assert.rejects(ensureCheckoutAccount(f.session, f.deps), {
      code: "checkout_ownership_conflict",
    })
    assert.deepEqual(f.writes, [])
  }
})

test("concurrent login email change cannot be overwritten by a stale activation", async () => {
  const f = fixture()
  f.race(() => {
    f.profiles[0].email = "new-login@example.com"
  })
  await assert.rejects(ensureCheckoutAccount(f.session, f.deps), {
    code: "checkout_ownership_conflict",
  })
  assert.equal(f.profiles[0].email, "new-login@example.com")
  assert.equal(f.billing[0].user_id, userId)
  assert.equal(
    f.writes.some((w) => w[0] === "profiles"),
    false,
  )
})

test("competing subscription insert is adopted only for the same immutable account", async () => {
  for (const owner of [userId, "other-owner"]) {
    const f = fixture()
    f.raceBilling(() =>
      f.billing.push({
        provider: "stripe",
        provider_subscription_id: "sub_reactivation",
        user_id: owner,
      }),
    )
    if (owner === userId)
      assert.equal((await ensureCheckoutAccount(f.session, f.deps)).userId, userId)
    else
      await assert.rejects(ensureCheckoutAccount(f.session, f.deps), {
        code: "checkout_ownership_conflict",
      })
    assert.equal(f.billing.length, 1)
    assert.equal(f.billing[0].user_id, owner)
    assert.equal(f.users.length, 1)
  }
})

test("late conflicting billing owner cannot grant access through the profile mirror", async () => {
  const f = fixture()
  const originalProfile = { ...f.profiles[0] }
  f.raceBilling(() =>
    f.billing.push({
      provider: "stripe",
      provider_subscription_id: "sub_reactivation",
      user_id: "other-owner",
    }),
  )
  await assert.rejects(ensureCheckoutAccount(f.session, f.deps), {
    code: "checkout_ownership_conflict",
  })
  assert.deepEqual(f.profiles[0], originalProfile)
  assert.deepEqual(f.writes, [])
})
