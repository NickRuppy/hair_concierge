import assert from "node:assert/strict"
import test from "node:test"

import {
  handleStripeWebhookEvent,
  shouldRecordStripePaymentCompleted,
} from "../src/app/api/stripe/webhook/route"
import {
  findProfileByStripeCustomerId,
  handleCheckoutSessionCompleted,
  type HandlerDeps,
} from "../src/lib/stripe/webhook-handlers"

function stubDeps() {
  const users: Record<string, { id: string; email: string }> = {}
  const profiles: Record<string, any> = {}
  const billing: any[] = []
  const billingAnalyticsOutbox: any[] = []
  const billingAnalyticsDeliveries: any[] = []
  const canceledSubscriptions: string[] = []
  const subscriptionPaymentMethods: Record<string, { id: string; type?: string }> = {
    sub_123: { id: "pm_card", type: "card" },
  }

  const deps: HandlerDeps = {
    supabase: {
      auth: {
        admin: {
          async createUser({ email }: { email: string }) {
            const id = `user_${Object.keys(users).length + 1}`
            const user = { id, email }
            users[email] = user
            profiles[id] = { id, email }
            return { data: { user }, error: null }
          },
        },
      },
      from(table: string) {
        const filters: Array<[string, string]> = []
        const tableApi = {
          select() {
            return this
          },
          eq(column: string, value: string) {
            filters.push([column, value])
            return this
          },
          async maybeSingle() {
            const row = rowsForTable().find((candidate: any) =>
              filters.every(([column, value]) => candidate[column] === value),
            )
            return { data: row ?? null, error: null }
          },
          update(patch: any) {
            const updateFilters: Array<[string, string]> = []
            let appliedRows: any[] | null = null
            const applyUpdate = () => {
              if (appliedRows) return appliedRows
              appliedRows = []
              for (const row of rowsForTable()) {
                if (updateFilters.every(([column, value]) => row[column] === value)) {
                  Object.assign(row, patch)
                  appliedRows.push(row)
                }
              }
              return appliedRows
            }
            const builder = {
              eq(column: string, value: string) {
                updateFilters.push([column, value])
                return builder
              },
              select() {
                return builder
              },
              async maybeSingle() {
                const row = applyUpdate()[0]
                return { data: row ?? null, error: null }
              },
              then(resolve: (value: { error: null }) => unknown) {
                applyUpdate()
                return Promise.resolve({ error: null }).then(resolve)
              },
            }
            return builder
          },
          insert(row: any) {
            if (table === "billing_analytics_outbox") {
              const inserted = {
                ...row,
                id: `outbox_${billingAnalyticsOutbox.length + 1}`,
                created_at: new Date().toISOString(),
              }
              billingAnalyticsOutbox.push(inserted)
              return {
                select: () => ({
                  single: async () => ({ data: inserted, error: null }),
                }),
              }
            }
            return {
              select: () => ({
                single: async () => ({ data: row, error: null }),
              }),
            }
          },
          upsert(row: any) {
            if (table === "profiles") {
              profiles[row.id] = { ...(profiles[row.id] ?? {}), ...row }
            } else if (table === "billing_subscriptions") {
              const existing = billing.find(
                (candidate) =>
                  candidate.provider === row.provider &&
                  candidate.provider_subscription_id === row.provider_subscription_id,
              )
              if (existing) Object.assign(existing, row)
              else billing.push(row)
            } else if (table === "billing_analytics_deliveries") {
              for (const delivery of row) {
                billingAnalyticsDeliveries.push({
                  ...delivery,
                  id: `delivery_${billingAnalyticsDeliveries.length + 1}`,
                  status: "pending",
                  attempts: 0,
                  processing_started_at: null,
                  next_attempt_at: null,
                  delivered_at: null,
                  last_error: null,
                  provider_request_id: null,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                })
              }
            }
            return {
              error: null,
              select: () => ({
                single: async () => ({ data: row, error: null }),
              }),
            }
          },
        }

        function rowsForTable() {
          if (table === "profiles") return Object.values(profiles)
          if (table === "billing_subscriptions") return billing
          if (table === "billing_analytics_outbox") return billingAnalyticsOutbox
          if (table === "billing_analytics_deliveries") return billingAnalyticsDeliveries
          return []
        }

        return tableApi
      },
    } as any,
    stripe: {
      subscriptions: {
        async retrieve(id: string) {
          return {
            id,
            status: "active",
            default_payment_method: subscriptionPaymentMethods[id] ?? {
              id: "pm_card",
              type: "card",
            },
            current_period_end: 1_800_000_000,
            items: {
              data: [
                {
                  current_period_end: 1_800_000_000,
                  price: { interval: "month", interval_count: 1 },
                },
              ],
            },
          }
        },
        async cancel(id: string) {
          canceledSubscriptions.push(id)
          return { id, status: "canceled" }
        },
      },
    } as any,
    premiumTierId: "tier_premium",
  }

  return {
    billing,
    billingAnalyticsDeliveries,
    billingAnalyticsOutbox,
    canceledSubscriptions,
    deps,
    profiles,
    subscriptionPaymentMethods,
  }
}

function withEnv(name: string, value: string, fn: () => Promise<void>) {
  const previous = process.env[name]
  process.env[name] = value
  return fn().finally(() => {
    if (previous === undefined) delete process.env[name]
    else process.env[name] = previous
  })
}

test("checkout handler returns fulfilled account data for Customer.io sync", async () => {
  const { deps } = stubDeps()

  const result = await handleCheckoutSessionCompleted(
    {
      id: "cs_123",
      status: "complete",
      payment_status: "paid",
      customer: "cus_123",
      customer_details: { email: "buyer@example.com" },
      subscription: "sub_123",
    } as any,
    deps,
  )

  assert.equal(result.userId, "user_1")
  assert.equal(result.email, "buyer@example.com")
  assert.equal(result.subscriptionInterval, "month")
  assert.equal(result.stripeCustomerId, "cus_123")
  assert.equal(result.stripeSubscriptionId, "sub_123")
  assert.equal(result.subscriptionStatus, "active")
})

test("profile lookup by Stripe customer returns campaign fields", async () => {
  const { deps, profiles } = stubDeps()
  profiles.user_456 = {
    id: "user_456",
    email: "buyer@example.com",
    stripe_customer_id: "cus_456",
    stripe_subscription_id: "sub_456",
    subscription_interval: "quarter",
    subscription_status: "active",
  }

  const profile = await findProfileByStripeCustomerId(deps.supabase, "cus_456")

  assert.deepEqual(profile, {
    id: "user_456",
    email: "buyer@example.com",
    stripe_customer_id: "cus_456",
    stripe_subscription_id: "sub_456",
    subscription_interval: "quarter",
    subscription_status: "active",
  })
})

test("skips initial Stripe subscription invoice analytics to avoid double counting checkout", () => {
  assert.equal(
    shouldRecordStripePaymentCompleted({ billing_reason: "subscription_create" } as any),
    false,
  )
  assert.equal(
    shouldRecordStripePaymentCompleted({ billing_reason: "subscription_cycle" } as any),
    true,
  )
  assert.equal(shouldRecordStripePaymentCompleted({ billing_reason: null } as any), true)
})

test("webhook event schedules best-effort Customer.io checkout sync after fulfillment", async () => {
  const { deps, profiles } = stubDeps()
  const deferred: Array<() => void | Promise<void>> = []
  const calls: Array<{ url: string; body: Record<string, unknown> }> = []
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({
      url: String(url),
      body: JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>,
    })
    return new Response("down", { status: 500 })
  }) as typeof fetch

  try {
    await withEnv("CUSTOMERIO_SERVER_WRITE_KEY", "server-key", async () => {
      await handleStripeWebhookEvent(
        {
          id: "evt_checkout",
          type: "checkout.session.completed",
          created: 1_800_000_000,
          data: {
            object: {
              id: "cs_123",
              amount_total: 1499,
              currency: "eur",
              status: "complete",
              payment_status: "paid",
              customer: "cus_123",
              customer_details: { email: "buyer@example.com" },
              subscription: "sub_123",
            },
          },
        } as any,
        {
          defer: (work) => deferred.push(work),
          getPremiumTierId: async () => "tier_premium",
          linkQuizToProfile: async () => {},
          stripe: deps.stripe,
          supabase: deps.supabase,
        },
      )

      const profile = Object.values(profiles).find(
        (candidate: any) => candidate.email === "buyer@example.com",
      ) as any
      assert.equal(profile.subscription_status, "active")
      assert.equal(deferred.length, 2)

      await Promise.all(deferred.map((work) => work()))

      assert.deepEqual(
        calls.map((call) => call.url),
        [
          "https://cdp-eu.customer.io/v1/identify",
          "https://cdp-eu.customer.io/v1/track",
          "https://cdp-eu.customer.io/v1/track",
        ],
      )
      assert.deepEqual(calls.map((call) => call.body.event).filter(Boolean), [
        "purchase_completed",
        "subscription_started",
      ])
      assert.equal(calls[1].body.timestamp, "2027-01-15T08:00:00.000Z")
      assert.equal(((calls[1].body.properties as Record<string, unknown>) ?? {}).amount, 14.99)
    })
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("production checkout analytics uses outbox instead of duplicate direct Customer.io sync", async () => {
  const { billingAnalyticsOutbox, deps, profiles } = stubDeps()
  const deferred: Array<() => void | Promise<void>> = []

  await handleStripeWebhookEvent(
    {
      id: "evt_checkout_outbox",
      type: "checkout.session.completed",
      created: 1_800_000_000,
      data: {
        object: {
          id: "cs_outbox",
          amount_total: 1499,
          currency: "eur",
          status: "complete",
          payment_status: "paid",
          customer: "cus_outbox",
          customer_details: { email: "buyer@example.com" },
          subscription: "sub_123",
        },
      },
    } as any,
    {
      defer: (work) => deferred.push(work),
      getPremiumTierId: async () => "tier_premium",
      linkQuizToProfile: async () => {},
      recordBillingAnalytics: true,
      stripe: deps.stripe,
      supabase: deps.supabase,
    },
  )

  const profile = Object.values(profiles).find(
    (candidate: any) => candidate.email === "buyer@example.com",
  ) as any
  assert.equal(profile.subscription_status, "active")
  assert.equal(deferred.length, 3)
  assert.deepEqual(
    billingAnalyticsOutbox.map((row) => row.event_name),
    ["purchase_completed", "subscription_started"],
  )
  assert.equal(billingAnalyticsOutbox[0].payload.checkout_reference, "cs_outbox")
})

test("attributed Stripe purchase enqueues funnel only when both delivery flags are enabled", async () => {
  async function run(flags: { attribution: string; delivery: string }) {
    const { billingAnalyticsDeliveries, deps } = stubDeps()
    const deferred: Array<() => void | Promise<void>> = []
    await withEnv("FUNNEL_ATTRIBUTION_ENABLED", flags.attribution, () =>
      withEnv("BILLING_FUNNEL_DELIVERY_ENABLED", flags.delivery, () =>
        handleStripeWebhookEvent(
          {
            id: `evt_checkout_funnel_${flags.attribution}_${flags.delivery}`,
            type: "checkout.session.completed",
            created: 1_800_000_000,
            data: {
              object: {
                id: "cs_funnel",
                amount_total: 1499,
                currency: "eur",
                status: "complete",
                payment_status: "paid",
                customer: "cus_funnel",
                customer_details: { email: "funnel@example.com" },
                subscription: "sub_123",
                metadata: {
                  funnel_session_id: "20000000-0000-4000-8000-000000000002",
                  funnel_package_key: "default_organic",
                },
              },
            },
          } as any,
          {
            defer: (work) => deferred.push(work),
            getPremiumTierId: async () => "tier_premium",
            linkQuizToProfile: async () => {},
            recordBillingAnalytics: true,
            stripe: deps.stripe,
            supabase: deps.supabase,
          },
        ),
      ),
    )
    return billingAnalyticsDeliveries.filter((row) => row.destination === "funnel")
  }

  assert.equal((await run({ attribution: "true", delivery: "false" })).length, 0)
  assert.equal((await run({ attribution: "false", delivery: "true" })).length, 0)
  assert.equal((await run({ attribution: "true", delivery: "true" })).length, 1)
})

test("webhook event activates non-SEPA async payment success", async () => {
  const { billing, deps, profiles, subscriptionPaymentMethods } = stubDeps()
  const deferred: Array<() => void | Promise<void>> = []
  subscriptionPaymentMethods.sub_async_success = { id: "pm_delayed", type: "customer_balance" }

  await handleStripeWebhookEvent(
    {
      id: "evt_async_succeeded",
      type: "checkout.session.async_payment_succeeded",
      created: 1_800_000_000,
      data: {
        object: {
          id: "cs_async_succeeded",
          amount_total: 3499,
          currency: "eur",
          status: "complete",
          payment_status: "paid",
          customer: "cus_async_succeeded",
          customer_details: { email: "async-success@example.com" },
          subscription: "sub_async_success",
        },
      },
    } as any,
    {
      defer: (work) => deferred.push(work),
      getPremiumTierId: async () => "tier_premium",
      linkQuizToProfile: async () => {},
      stripe: deps.stripe,
      supabase: deps.supabase,
    },
  )

  const profile = Object.values(profiles).find(
    (candidate: any) => candidate.email === "async-success@example.com",
  ) as any
  assert.equal(profile.subscription_status, "active")
  assert.equal(profile.stripe_subscription_id, "sub_async_success")
  assert.equal(billing[0].provider_subscription_id, "sub_async_success")
  assert.equal(billing[0].entitlement_status, "active")
  assert.equal(deferred.length, 2)
})

test("webhook event activates async success when SEPA was offered but a non-SEPA method settled", async () => {
  const { billing, canceledSubscriptions, deps, profiles, subscriptionPaymentMethods } = stubDeps()
  const deferred: Array<() => void | Promise<void>> = []
  subscriptionPaymentMethods.sub_mixed_success = { id: "pm_delayed", type: "customer_balance" }

  await handleStripeWebhookEvent(
    {
      id: "evt_mixed_async_succeeded",
      type: "checkout.session.async_payment_succeeded",
      created: 1_800_000_000,
      data: {
        object: {
          id: "cs_mixed_async_succeeded",
          amount_total: 3499,
          currency: "eur",
          status: "complete",
          payment_status: "paid",
          payment_method_types: ["customer_balance", "sepa_debit"],
          customer: "cus_mixed_async_succeeded",
          customer_details: { email: "mixed-success@example.com" },
          subscription: "sub_mixed_success",
        },
      },
    } as any,
    {
      defer: (work) => deferred.push(work),
      getPremiumTierId: async () => "tier_premium",
      linkQuizToProfile: async () => {},
      stripe: deps.stripe,
      supabase: deps.supabase,
    },
  )

  const profile = Object.values(profiles).find(
    (candidate: any) => candidate.email === "mixed-success@example.com",
  ) as any
  assert.equal(profile.subscription_status, "active")
  assert.equal(profile.stripe_subscription_id, "sub_mixed_success")
  assert.equal(billing[0].provider_subscription_id, "sub_mixed_success")
  assert.equal(billing[0].entitlement_status, "active")
  assert.deepEqual(canceledSubscriptions, [])
  assert.equal(deferred.length, 2)
})

test("webhook event skips SEPA async payment success during SEPA sunset", async () => {
  const { billing, canceledSubscriptions, deps, profiles, subscriptionPaymentMethods } = stubDeps()
  const deferred: Array<() => void | Promise<void>> = []
  subscriptionPaymentMethods.sub_sepa_success = { id: "pm_sepa", type: "sepa_debit" }

  await handleStripeWebhookEvent(
    {
      id: "evt_sepa_async_succeeded",
      type: "checkout.session.async_payment_succeeded",
      created: 1_800_000_000,
      data: {
        object: {
          id: "cs_sepa_async_succeeded",
          amount_total: 1499,
          currency: "eur",
          status: "complete",
          payment_status: "paid",
          customer: "cus_sepa_async_succeeded",
          customer_details: { email: "sepa-success@example.com" },
          subscription: "sub_sepa_success",
        },
      },
    } as any,
    {
      defer: (work) => deferred.push(work),
      getPremiumTierId: async () => "tier_premium",
      linkQuizToProfile: async () => {},
      stripe: deps.stripe,
      supabase: deps.supabase,
    },
  )

  assert.deepEqual(Object.values(profiles), [])
  assert.deepEqual(billing, [])
  assert.deepEqual(canceledSubscriptions, ["sub_sepa_success"])
  assert.equal(deferred.length, 0)
})

test("webhook event skips SEPA async payment success when the session payment method types reveal it", async () => {
  const { billing, canceledSubscriptions, deps, profiles, subscriptionPaymentMethods } = stubDeps()
  const deferred: Array<() => void | Promise<void>> = []
  subscriptionPaymentMethods.sub_session_sepa_success = { id: "pm_unknown" }

  await handleStripeWebhookEvent(
    {
      id: "evt_session_sepa_async_succeeded",
      type: "checkout.session.async_payment_succeeded",
      created: 1_800_000_000,
      data: {
        object: {
          id: "cs_session_sepa_async_succeeded",
          amount_total: 1499,
          currency: "eur",
          status: "complete",
          payment_status: "paid",
          payment_method_types: ["sepa_debit"],
          customer: "cus_session_sepa_async_succeeded",
          customer_details: { email: "session-sepa-success@example.com" },
          subscription: "sub_session_sepa_success",
        },
      },
    } as any,
    {
      defer: (work) => deferred.push(work),
      getPremiumTierId: async () => "tier_premium",
      linkQuizToProfile: async () => {},
      stripe: deps.stripe,
      supabase: deps.supabase,
    },
  )

  assert.deepEqual(Object.values(profiles), [])
  assert.deepEqual(billing, [])
  assert.deepEqual(canceledSubscriptions, ["sub_session_sepa_success"])
  assert.equal(deferred.length, 0)
})

test("webhook event acknowledges unpaid checkout completion without granting access", async () => {
  const { billing, deps, profiles } = stubDeps()
  const deferred: Array<() => void | Promise<void>> = []

  await handleStripeWebhookEvent(
    {
      id: "evt_checkout_unpaid",
      type: "checkout.session.completed",
      created: 1_800_000_000,
      data: {
        object: {
          id: "cs_unpaid",
          amount_total: 1499,
          currency: "eur",
          status: "complete",
          payment_status: "unpaid",
          customer: "cus_unpaid",
          customer_details: { email: "unpaid@example.com" },
          subscription: "sub_unpaid",
        },
      },
    } as any,
    {
      defer: (work) => deferred.push(work),
      getPremiumTierId: async () => "tier_premium",
      linkQuizToProfile: async () => {},
      stripe: deps.stripe,
      supabase: deps.supabase,
    },
  )

  assert.deepEqual(Object.values(profiles), [])
  assert.deepEqual(billing, [])
  assert.equal(deferred.length, 0)
})

test("webhook event handles checkout.session.async_payment_failed without Customer.io purchase work", async () => {
  const { billing, canceledSubscriptions, deps, profiles } = stubDeps()
  const deferred: Array<() => void | Promise<void>> = []
  profiles.user_async_failed = {
    id: "user_async_failed",
    email: "async-failed@example.com",
    stripe_customer_id: "cus_async_failed",
    stripe_subscription_id: "sub_async_failed",
    subscription_status: "active",
    subscription_tier_id: "tier_premium",
    subscription_interval: "quarter",
    current_period_end: "2027-01-01T00:00:00.000Z",
  }
  await handleStripeWebhookEvent(
    {
      id: "evt_async_failed",
      type: "checkout.session.async_payment_failed",
      created: 1_800_000_000,
      data: {
        object: {
          id: "cs_async_failed",
          customer: "cus_async_failed",
          subscription: "sub_async_failed",
        },
      },
    } as any,
    {
      defer: (work) => deferred.push(work),
      getFreeTierId: async () => "tier_free",
      stripe: deps.stripe,
      supabase: deps.supabase,
    },
  )

  assert.equal(profiles.user_async_failed.subscription_status, "canceled")
  assert.equal(profiles.user_async_failed.subscription_tier_id, "tier_free")
  assert.equal(profiles.user_async_failed.stripe_subscription_id, null)
  assert.equal(profiles.user_async_failed.subscription_interval, null)
  assert.equal(profiles.user_async_failed.current_period_end, null)
  assert.equal(billing.length, 1)
  assert.equal(billing[0].provider_status, "payment_failed")
  assert.deepEqual(billing[0].metadata, { reason: "async_payment_failed" })
  assert.deepEqual(canceledSubscriptions, ["sub_async_failed"])
  assert.equal(deferred.length, 0)
})

test("stale subscription deletion does not send Customer.io cancellation for a newer active subscription", async () => {
  const { billing, deps, profiles } = stubDeps()
  const deferred: Array<() => void | Promise<void>> = []
  profiles.user_migrated = {
    id: "user_migrated",
    email: "migrated@example.com",
    stripe_customer_id: "cus_migrated",
    stripe_subscription_id: "sub_new_active",
    subscription_status: "active",
    subscription_tier_id: "tier_premium",
    subscription_interval: "quarter",
    current_period_end: "2027-01-01T00:00:00.000Z",
  }

  await handleStripeWebhookEvent(
    {
      id: "evt_stale_deleted",
      type: "customer.subscription.deleted",
      created: 1_800_000_000,
      data: {
        object: {
          id: "sub_old_deleted",
          customer: "cus_migrated",
          status: "canceled",
        },
      },
    } as any,
    {
      defer: (work) => deferred.push(work),
      getFreeTierId: async () => "tier_free",
      stripe: deps.stripe,
      supabase: deps.supabase,
    },
  )

  assert.equal(profiles.user_migrated.stripe_subscription_id, "sub_new_active")
  assert.equal(profiles.user_migrated.subscription_status, "active")
  assert.equal(profiles.user_migrated.subscription_tier_id, "tier_premium")
  assert.equal(billing.length, 1)
  assert.equal(billing[0].provider_subscription_id, "sub_old_deleted")
  assert.equal(billing[0].entitlement_status, "canceled")
  assert.equal(deferred.length, 0)
})
