import assert from "node:assert/strict"
import test from "node:test"

import { handleStripeWebhookEvent } from "../src/app/api/stripe/webhook/route"
import {
  findProfileByStripeCustomerId,
  handleCheckoutSessionCompleted,
  type HandlerDeps,
} from "../src/lib/stripe/webhook-handlers"

function stubDeps() {
  const users: Record<string, { id: string; email: string }> = {}
  const profiles: Record<string, any> = {}
  const billing: any[] = []

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
            return {
              eq(column: string, value: string) {
                const row = Object.values(profiles).find(
                  (candidate: any) => candidate[column] === value,
                )
                if (row) Object.assign(row, patch)
                return Promise.resolve({ error: null })
              },
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
          return []
        }

        return tableApi
      },
    } as any,
    stripe: {
      subscriptions: {
        async retrieve() {
          return {
            id: "sub_123",
            status: "active",
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
      },
    } as any,
    premiumTierId: "tier_premium",
  }

  return { deps, profiles }
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
              amount_total: 749,
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
      assert.equal(((calls[1].body.properties as Record<string, unknown>) ?? {}).amount, 7.49)
    })
  } finally {
    globalThis.fetch = originalFetch
  }
})
