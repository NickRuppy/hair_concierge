import assert from "node:assert/strict"
import test from "node:test"

import {
  classifySlackGrowthEvent,
  deliverBillingAnalyticsToSlack,
  formatSlackGrowthNotification,
  isSlackGrowthEnabled,
} from "../src/lib/billing/analytics-destinations/slack"
import type {
  BillingAnalyticsOutboxRow,
  SupabaseBillingAnalyticsClient,
} from "../src/lib/billing/types"

function event(overrides: Partial<BillingAnalyticsOutboxRow> = {}): BillingAnalyticsOutboxRow {
  return {
    id: "outbox-1",
    event_key: "stripe:purchase_completed:cs_123",
    event_name: "purchase_completed",
    user_id: "d2719a90-8121-4fc0-8c7f-1da083018dde",
    provider: "stripe",
    provider_customer_id: "cus_123",
    provider_subscription_id: "sub_123",
    source_event_id: "evt_123",
    source_object_id: "cs_123",
    occurred_at: "2026-09-15T08:30:00.000Z",
    payload: { value: 14.99, currency: "EUR", interval: "month" },
    created_at: "2026-09-15T08:30:00.000Z",
    updated_at: "2026-09-15T08:30:00.000Z",
    ...overrides,
  }
}

function input(overrides: Partial<Parameters<typeof deliverBillingAnalyticsToSlack>[0]> = {}) {
  return {
    event: event(),
    profile: {
      id: "d2719a90-8121-4fc0-8c7f-1da083018dde",
      full_name: "Mia Beispiel",
      email: "mia@example.com",
    },
    supabase: {
      from: () => ({}),
      rpc: async () => ({
        data: { enabled: true, enabled_at: "2026-09-15T08:00:00.000Z" },
        error: null,
      }),
    } as unknown as SupabaseBillingAnalyticsClient,
    ...overrides,
  }
}

test("classifies only canonical trials, first paid trial conversions, and non-renewal direct purchases", () => {
  assert.equal(
    classifySlackGrowthEvent(
      event({
        event_name: "trial_started",
        payload: {
          trial_analytics_version: 1,
          value: 0,
          trial_authorized_at: "2026-09-15T08:00:00.000Z",
        },
      }),
    ),
    "trial_started",
  )
  assert.equal(
    classifySlackGrowthEvent(
      event({
        payload: {
          trial_analytics_version: 1,
          attempt_phase: "first_paid",
          value: 14.99,
          currency: "EUR",
        },
      }),
    ),
    "trial_converted",
  )
  assert.equal(
    classifySlackGrowthEvent(event({ payload: { attempt_phase: "renewal", value: 14.99 } })),
    null,
  )
  assert.equal(
    classifySlackGrowthEvent(
      event({ payload: { trial_analytics_version: 1, attempt_phase: "renewal", value: 14.99 } }),
    ),
    null,
  )
  assert.equal(
    classifySlackGrowthEvent(event({ payload: { value: 29.99, interval: "one_time" } })),
    "direct_purchase",
  )
  assert.equal(
    classifySlackGrowthEvent(event({ payload: { value: 29.99, is_internal_test: true } })),
    null,
  )
  assert.equal(classifySlackGrowthEvent(event({ payload: { value: "29.99" } })), null)
})

test("formats German plain-text blocks with profile identity, actual amount, canonical trial end, and safe fallback", () => {
  const trial = formatSlackGrowthNotification(
    input({
      event: event({
        event_name: "trial_started",
        payload: {
          trial_analytics_version: 1,
          value: 0,
          trial_authorized_at: "2026-09-15T08:00:00.000Z",
          trial_end_at: "2026-09-22T08:00:00.000Z",
          interval: "month",
        },
      }),
    }),
  )
  assert.ok(trial)
  assert.match(trial.text, /Trial gestartet/)
  assert.match(JSON.stringify(trial.blocks), /Mia Beispiel/)
  assert.match(JSON.stringify(trial.blocks), /mia@example.com/)
  assert.match(JSON.stringify(trial.blocks), /Testende/)
  assert.match(JSON.stringify(trial.blocks), /Nutzerverwaltung öffnen/)
  assert.ok(
    trial.blocks.every(
      (block) => JSON.stringify(block).includes('"type":"plain_text"') || block.type === "actions",
    ),
  )

  const missingIdentity = formatSlackGrowthNotification(input({ profile: null }))
  assert.ok(missingIdentity)
  assert.match(
    JSON.stringify(missingIdentity.blocks),
    /Nicht verfügbar \(ID: d2719a90-8121-4fc0-8c7f-1da083018dde\)/,
  )

  const hostile = formatSlackGrowthNotification(
    input({
      profile: { id: "user-123", full_name: "<@U123>&<>\nA", email: "<mia@example.com>" },
    }),
  )
  assert.ok(hostile)
  assert.doesNotMatch(hostile.text, /<@U123>/)
  assert.match(hostile.text, /&lt;@U123&gt;/)

  const longName = formatSlackGrowthNotification(
    input({
      profile: { id: "user-123", full_name: "A".repeat(500), email: "mia@example.com" },
    }),
  )
  assert.ok(longName)
  assert.match(JSON.stringify(longName.blocks), /mia@example.com/)
  const quarterly = formatSlackGrowthNotification(
    input({ event: event({ payload: { value: 29.99, currency: "EUR", interval: "quarter" } }) }),
  )
  assert.ok(quarterly)
  assert.match(quarterly.text, /Quartalsabo/)
  assert.match(JSON.stringify(quarterly.blocks), /Quartalsabo/)
})

test("requires production flag, validated active cutoff, and a strict Slack webhook before posting", async () => {
  assert.equal(
    isSlackGrowthEnabled({ SLACK_GROWTH_ENABLED: "true", VERCEL_ENV: "production" }),
    true,
  )
  assert.equal(isSlackGrowthEnabled({ SLACK_GROWTH_ENABLED: "true", VERCEL_ENV: "preview" }), false)

  const paused = await deliverBillingAnalyticsToSlack(input(), {
    env: { SLACK_GROWTH_ENABLED: "false", VERCEL_ENV: "production" },
  })
  assert.deepEqual(paused, { ok: false, paused: true, error: "slack_paused" })

  const calls: string[] = []
  const result = await deliverBillingAnalyticsToSlack(input(), {
    env: {
      SLACK_GROWTH_ENABLED: "true",
      VERCEL_ENV: "production",
      SLACK_GROWTH_WEBHOOK_URL: "https://hooks.slack.com/services/T123/B123/secret",
    },
    fetch: async (url) => {
      calls.push(String(url))
      return new Response("ok", { status: 200 })
    },
  })
  assert.deepEqual(calls, ["https://hooks.slack.com/services/T123/B123/secret"])
  assert.deepEqual(result, { ok: true, status: 200 })

  const badUrl = await deliverBillingAnalyticsToSlack(input(), {
    env: {
      SLACK_GROWTH_ENABLED: "true",
      VERCEL_ENV: "production",
      SLACK_GROWTH_WEBHOOK_URL: "https://hooks.slack.com/services/T/B/secret?leak=1",
    },
  })
  assert.equal(badUrl.permanent, true)
  assert.equal(badUrl.error, "Slack webhook configuration is invalid")

  const stale = await deliverBillingAnalyticsToSlack(
    input({
      supabase: {
        from: () => ({}),
        rpc: async () => ({
          data: { enabled: true, enabled_at: "2026-09-15T09:00:00.000Z" },
          error: null,
        }),
      } as unknown as SupabaseBillingAnalyticsClient,
    }),
    {
      env: {
        SLACK_GROWTH_ENABLED: "true",
        VERCEL_ENV: "production",
        SLACK_GROWTH_WEBHOOK_URL: "https://hooks.slack.com/services/T123/B123/secret",
      },
    },
  )
  assert.equal(stale.skipped, true)
  assert.equal(stale.permanent, true)
})

test("accepts PostgreSQL timestamptz precision and UTC offset forms", async () => {
  const calls: string[] = []
  const result = await deliverBillingAnalyticsToSlack(
    input({
      event: event({ occurred_at: "2026-09-15T10:30:00.123456+00:00" }),
      supabase: {
        from: () => ({}),
        rpc: async () => ({
          data: { enabled: true, enabled_at: "2026-09-15T10:00:00.000000+00:00" },
          error: null,
        }),
      } as unknown as SupabaseBillingAnalyticsClient,
    }),
    {
      env: {
        SLACK_GROWTH_ENABLED: "true",
        VERCEL_ENV: "production",
        SLACK_GROWTH_WEBHOOK_URL: "https://hooks.slack.com/services/T123/B123/secret",
      },
      fetch: async (url) => {
        calls.push(String(url))
        return new Response("ok", { status: 200 })
      },
    },
  )
  assert.equal(result.ok, true)
  assert.equal(calls.length, 1)
})

test("retries throttling and transient failures without exposing webhook or response body", async () => {
  const throttled = await deliverBillingAnalyticsToSlack(input(), {
    env: {
      SLACK_GROWTH_ENABLED: "true",
      VERCEL_ENV: "production",
      SLACK_GROWTH_WEBHOOK_URL: "https://hooks.slack.com/services/T123/B123/secret",
    },
    fetch: async () =>
      new Response("rate_limited", { status: 429, headers: { "retry-after": "99999" } }),
  })
  assert.equal(throttled.status, 429)
  assert.equal(throttled.retryAfterSeconds, 3600)
  assert.equal(throttled.permanent, undefined)
  assert.equal(throttled.error, "Slack rate limited the notification")

  const unavailable = await deliverBillingAnalyticsToSlack(input(), {
    env: {
      SLACK_GROWTH_ENABLED: "true",
      VERCEL_ENV: "production",
      SLACK_GROWTH_WEBHOOK_URL: "https://hooks.slack.com/services/T123/B123/secret",
    },
    fetch: async () => new Response("secret response body", { status: 503 }),
  })
  assert.equal(unavailable.error, "Slack is temporarily unavailable")
  assert.equal(unavailable.permanent, undefined)

  const rejected = await deliverBillingAnalyticsToSlack(input(), {
    env: {
      SLACK_GROWTH_ENABLED: "true",
      VERCEL_ENV: "production",
      SLACK_GROWTH_WEBHOOK_URL: "https://hooks.slack.com/services/T123/B123/secret",
    },
    fetch: async () => new Response("invalid_token_secret", { status: 400 }),
  })
  assert.equal(rejected.permanent, true)
  assert.equal(rejected.error, "Slack rejected the notification")
})
