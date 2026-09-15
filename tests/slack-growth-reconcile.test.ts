import assert from "node:assert/strict"
import test from "node:test"

import { handleSlackGrowthNotificationReconcile } from "../src/app/api/billing/slack-notifications/reconcile/route"
import type { SupabaseBillingAnalyticsClient } from "../src/lib/billing/types"

const supabase = {
  from: () => ({}),
  rpc: async () => ({ data: null, error: null }),
} as unknown as SupabaseBillingAnalyticsClient
const production = {
  SLACK_GROWTH_ENABLED: "true",
  VERCEL_ENV: "production",
  SLACK_GROWTH_WEBHOOK_URL: "https://hooks.slack.com/services/T123/B123/secret",
}

function request(token = "secret") {
  return new Request("https://chaarlie.de/api/billing/slack-notifications/reconcile", {
    headers: { authorization: `Bearer ${token}` },
  })
}

test("rejects requests without the cron bearer token", async () => {
  const result = await handleSlackGrowthNotificationReconcile(request("wrong"), {
    supabase,
    cronSecret: "secret",
    env: production,
  })
  assert.deepEqual(result, { status: 401, body: { error: "unauthorized" } })
})

test("returns paused without claiming deliveries outside the enabled production mode", async () => {
  let called = false
  const result = await handleSlackGrowthNotificationReconcile(request(), {
    supabase,
    cronSecret: "secret",
    env: { ...production, SLACK_GROWTH_ENABLED: "false" },
    canDispatch: async () => {
      called = true
      return true
    },
  })
  assert.equal(result.status, 200)
  assert.deepEqual(result.body, { slackGrowthNotifications: "paused" })
  assert.equal(called, false)
})

test("fails closed when enabled Slack configuration is incomplete", async () => {
  const result = await handleSlackGrowthNotificationReconcile(request(), {
    supabase,
    cronSecret: "secret",
    env: { ...production, SLACK_GROWTH_WEBHOOK_URL: "" },
  })
  assert.deepEqual(result, {
    status: 503,
    body: { error: "slack_growth_configuration_unavailable" },
  })
})

test("returns paused when the database switch is disabled without recovery or dispatch", async () => {
  let recovery = false
  let dispatch = false
  const result = await handleSlackGrowthNotificationReconcile(request(), {
    supabase,
    cronSecret: "secret",
    env: production,
    canDispatch: async () => false,
    reconcile: async () => {
      recovery = true
    },
    dispatch: async () => {
      dispatch = true
      return { processed: 0, delivered: 0, failed: 0 }
    },
  })
  assert.equal(result.status, 200)
  assert.equal(recovery, false)
  assert.equal(dispatch, false)
})

test("returns a sanitized 503 when state or recovery is unavailable", async () => {
  const stateFailure = await handleSlackGrowthNotificationReconcile(request(), {
    supabase,
    cronSecret: "secret",
    env: production,
    canDispatch: async () => {
      throw new Error("database password")
    },
  })
  assert.deepEqual(stateFailure, {
    status: 503,
    body: { error: "slack_growth_reconcile_unavailable" },
  })

  let dispatched = false
  const recoveryFailure = await handleSlackGrowthNotificationReconcile(request(), {
    supabase,
    cronSecret: "secret",
    env: production,
    canDispatch: async () => true,
    reconcile: async () => {
      throw new Error("rpc detail")
    },
    dispatch: async () => {
      dispatched = true
      return { processed: 0, delivered: 0, failed: 0 }
    },
  })
  assert.deepEqual(recoveryFailure, {
    status: 503,
    body: { error: "slack_growth_reconcile_unavailable" },
  })
  assert.equal(dispatched, false)
})

test("recovers before sending only five Slack deliveries", async () => {
  const order: string[] = []
  const result = await handleSlackGrowthNotificationReconcile(request(), {
    supabase,
    cronSecret: "secret",
    env: production,
    canDispatch: async () => true,
    reconcile: async () => {
      order.push("recovery")
      return { inserted: 2 }
    },
    dispatch: async (_client, options) => {
      order.push("dispatch")
      assert.deepEqual(options, { destination: "slack", limit: 5 })
      return { processed: 2, delivered: 2, failed: 0 }
    },
  })
  assert.equal(result.status, 200)
  assert.deepEqual(order, ["recovery", "dispatch"])
  assert.deepEqual(result.body, {
    slackGrowthRecovery: { inserted: 2 },
    slackGrowthDelivery: { processed: 2, delivered: 2, failed: 0 },
  })
})
