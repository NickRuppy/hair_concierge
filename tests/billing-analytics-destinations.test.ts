import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import test from "node:test"

import { deliverBillingAnalyticsToCustomerIo } from "../src/lib/billing/analytics-destinations/customerio"
import { deliverBillingAnalyticsToMeta } from "../src/lib/billing/analytics-destinations/meta-capi"
import { deliverBillingAnalyticsToPostHog } from "../src/lib/billing/analytics-destinations/posthog-server"
import type { BillingAnalyticsOutboxRow, SupabaseBillingClient } from "../src/lib/billing/types"

const supabase = { from: () => ({}) } as unknown as SupabaseBillingClient

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex")
}

function event(overrides: Partial<BillingAnalyticsOutboxRow> = {}): BillingAnalyticsOutboxRow {
  return {
    id: "outbox-1",
    event_key: "stripe:purchase_completed:cs_test_123",
    event_name: "purchase_completed",
    user_id: "user-123",
    provider: "stripe",
    provider_customer_id: "cus_123",
    provider_subscription_id: "sub_123",
    source_event_id: "evt_123",
    source_object_id: "cs_test_123",
    occurred_at: "2026-07-08T10:00:00.000Z",
    payload: {
      checkout_session_id: "cs_test_123",
      currency: "EUR",
      interval: "month",
      subscription_status: "active",
      value: 14.99,
    },
    created_at: "2026-07-08T10:00:00.000Z",
    updated_at: "2026-07-08T10:00:00.000Z",
    ...overrides,
  }
}

async function withEnv<T>(values: Record<string, string | undefined>, fn: () => Promise<T>) {
  const previous = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]))
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  try {
    return await fn()
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
}

test("Meta CAPI adapter hashes user data and uses Stripe checkout session as Purchase event_id", async () => {
  const calls: Array<{ url: string; body: Record<string, any> }> = []
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({
      url: String(url),
      body: JSON.parse(String(init?.body ?? "{}")),
    })
    return new Response("{}", {
      status: 200,
      headers: { "x-fb-trace-id": "trace-123" },
    })
  }) as typeof fetch

  try {
    await withEnv(
      {
        META_CAPI_ACCESS_TOKEN: "token",
        META_CAPI_API_VERSION: "v99.0",
        META_PIXEL_ID: "pixel-123",
      },
      async () => {
        const result = await deliverBillingAnalyticsToMeta({
          event: event(),
          profile: { id: "user-123", email: "Buyer@Example.com" },
          supabase,
        })

        assert.equal(result.ok, true)
        assert.equal(result.providerRequestId, "trace-123")
      },
    )
  } finally {
    globalThis.fetch = originalFetch
  }

  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, "https://graph.facebook.com/v99.0/pixel-123/events?access_token=token")
  const payload = calls[0].body.data[0]
  assert.equal(payload.event_name, "Purchase")
  assert.equal(payload.action_source, "website")
  assert.equal(payload.event_id, "cs_test_123")
  assert.equal(payload.user_data.em, sha256("buyer@example.com"))
  assert.equal(payload.user_data.external_id, sha256("user-123"))
  assert.equal(payload.custom_data.value, 14.99)
  assert.equal(payload.custom_data.currency, "EUR")
})

test("Meta CAPI reuses the Stripe checkout session for Subscribe deduplication", async () => {
  const bodies: Record<string, any>[] = []
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body ?? "{}")))
    return new Response("{}", { status: 200 })
  }) as typeof fetch

  try {
    await withEnv(
      {
        META_CAPI_ACCESS_TOKEN: "token",
        META_PIXEL_ID: "pixel-123",
      },
      () =>
        deliverBillingAnalyticsToMeta({
          event: event({
            event_key: "stripe:subscription_started:sub_123",
            event_name: "subscription_started",
            source_object_id: "sub_123",
          }),
          profile: { id: "user-123", email: "buyer@example.com" },
          supabase,
        }),
    )
  } finally {
    globalThis.fetch = originalFetch
  }

  assert.equal(bodies[0].data[0].event_name, "Subscribe")
  assert.equal(bodies[0].data[0].event_id, "cs_test_123")
})

test("Meta CAPI only includes package key behind its flag and never includes session id", async () => {
  const bodies: Record<string, any>[] = []
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body ?? "{}")))
    return new Response("{}", { status: 200 })
  }) as typeof fetch

  const funnelEvent = event({
    payload: {
      checkout_session_id: "cs_test_123",
      funnel_package_key: "scalp_check_placeholder",
      funnel_session_id: "20000000-0000-4000-8000-000000000002",
    },
  })

  try {
    for (const flags of [
      { server: undefined, browser: undefined },
      { server: undefined, browser: "true" },
      { server: "true", browser: undefined },
    ]) {
      await withEnv(
        {
          FUNNEL_META_CUSTOM_DATA_ENABLED: flags.server,
          NEXT_PUBLIC_FUNNEL_META_CUSTOM_DATA_ENABLED: flags.browser,
          META_CAPI_ACCESS_TOKEN: "token",
          META_PIXEL_ID: "pixel-123",
        },
        () =>
          deliverBillingAnalyticsToMeta({
            event: funnelEvent,
            profile: { id: "user-123", email: "buyer@example.com" },
            supabase,
          }),
      )
    }
  } finally {
    globalThis.fetch = originalFetch
  }

  assert.equal(bodies[0].data[0].custom_data.funnel_package_key, undefined)
  assert.equal(bodies[1].data[0].custom_data.funnel_package_key, undefined)
  assert.equal(bodies[2].data[0].custom_data.funnel_package_key, "scalp_check_placeholder")
  for (const body of bodies) {
    assert.equal(body.data[0].custom_data.funnel_session_id, undefined)
    assert.equal(JSON.stringify(body).includes("20000000-0000-4000-8000-000000000002"), false)
  }
})

test("PostHog server adapter captures canonical billing event with user id distinct_id", async () => {
  const calls: Array<{ url: string; body: Record<string, any> }> = []
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({
      url: String(url),
      body: JSON.parse(String(init?.body ?? "{}")),
    })
    return new Response("ok", { status: 200 })
  }) as typeof fetch

  try {
    await withEnv(
      {
        POSTHOG_HOST: "https://eu.example.posthog",
        POSTHOG_PROJECT_API_KEY: "ph-key",
      },
      async () => {
        const result = await deliverBillingAnalyticsToPostHog({
          event: event(),
          profile: { id: "user-123", email: "buyer@example.com" },
          supabase,
        })

        assert.equal(result.ok, true)
      },
    )
  } finally {
    globalThis.fetch = originalFetch
  }

  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, "https://eu.example.posthog/capture/")
  assert.equal(calls[0].body.api_key, "ph-key")
  assert.equal(calls[0].body.distinct_id, "user-123")
  assert.equal(calls[0].body.event, "purchase_completed")
  assert.equal(calls[0].body.properties.event_key, "stripe:purchase_completed:cs_test_123")
})

test("Customer.io adapter sends canonical event and transition-safe Stripe traits", async () => {
  const calls: Array<{ url: string; body: Record<string, any> }> = []
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({
      url: String(url),
      body: JSON.parse(String(init?.body ?? "{}")),
    })
    return new Response("ok", { status: 200 })
  }) as typeof fetch

  try {
    await withEnv({ CUSTOMERIO_SERVER_WRITE_KEY: "cio-key" }, async () => {
      const result = await deliverBillingAnalyticsToCustomerIo({
        event: event(),
        profile: {
          id: "user-123",
          email: "buyer@example.com",
          stripe_customer_id: "cus_legacy",
          stripe_subscription_id: "sub_legacy",
          subscription_interval: "month",
          subscription_status: "active",
        },
        supabase,
      })

      assert.equal(result.ok, true)
    })
  } finally {
    globalThis.fetch = originalFetch
  }

  assert.deepEqual(
    calls.map((call) => call.url),
    ["https://cdp-eu.customer.io/v1/identify", "https://cdp-eu.customer.io/v1/track"],
  )
  assert.equal(calls[0].body.traits.email, "buyer@example.com")
  assert.equal(calls[0].body.traits.has_ever_paid, true)
  assert.equal(calls[0].body.traits.has_paid_access, true)
  assert.equal(calls[0].body.traits.billing_provider, "stripe")
  assert.equal(calls[0].body.traits.provider_customer_id, "cus_123")
  assert.equal(calls[0].body.traits.stripe_customer_id, "cus_123")
  assert.equal(calls[0].body.traits.stripe_subscription_id, "sub_123")
  assert.equal(calls[1].body.event, "purchase_completed")
})

test("Customer.io adapter preserves paid-through access on cancelled subscriptions", async () => {
  const calls: Array<{ url: string; body: Record<string, any> }> = []
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({
      url: String(url),
      body: JSON.parse(String(init?.body ?? "{}")),
    })
    return new Response("ok", { status: 200 })
  }) as typeof fetch

  try {
    await withEnv({ CUSTOMERIO_SERVER_WRITE_KEY: "cio-key" }, async () => {
      const result = await deliverBillingAnalyticsToCustomerIo({
        event: event({
          event_key: "paypal:subscription_cancelled:I-active:WH-cancelled",
          event_name: "subscription_cancelled",
          provider: "paypal",
          provider_customer_id: "payer-1",
          provider_subscription_id: "I-active",
          source_event_id: "WH-cancelled",
          source_object_id: "I-active",
          payload: {
            cancel_at_period_end: true,
            current_period_end: "2026-08-08T10:00:00.000Z",
            has_paid_access: true,
            interval: "month",
            provider_status: "CANCELLED",
            subscription_status: "canceled",
          },
        }),
        profile: {
          id: "user-123",
          email: "buyer@example.com",
          subscription_status: "active",
        },
        supabase,
      })

      assert.equal(result.ok, true)
    })
  } finally {
    globalThis.fetch = originalFetch
  }

  assert.equal(calls[0].body.traits.subscription_status, "canceled")
  assert.equal(calls[0].body.traits.has_paid_access, true)
  assert.equal(calls[0].body.traits.is_customer, true)
  assert.equal(calls[0].body.traits.subscription_cancelled_at, "2026-07-08T10:00:00.000Z")
})
