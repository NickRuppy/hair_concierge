import assert from "node:assert/strict"
import test from "node:test"

import { createSlackGrowthHandler, type Rpc } from "../supabase/functions/slack-growth/handler.ts"

const deliveryId = "d2719a90-8121-4fc0-8c7f-1da083018dde"
const token = "a2719a90-8121-4fc0-8c7f-1da083018dde"
const env = {
  SLACK_GROWTH_WEBHOOK_URL: "https://hooks.slack.com/services/T123/B123/secret",
  SLACK_GROWTH_DISPATCH_TOKEN: "dispatch-secret",
  SUPABASE_URL: "https://pqdkhefxsxkyeqelqegq.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-role",
}
const claim = {
  token,
  event: {
    id: "outbox-1",
    event_name: "purchase_completed",
    user_id: deliveryId,
    provider: "stripe",
    occurred_at: "2026-09-15T08:30:00.000Z",
    payload: { value: 14.99, currency: "EUR", interval: "month" },
  },
  profile: { full_name: "Mia Beispiel", email: "mia@example.com" },
}
function request(
  body: unknown = { delivery_id: deliveryId },
  tokenValue = env.SLACK_GROWTH_DISPATCH_TOKEN,
) {
  return new Request("https://edge.test", {
    method: "POST",
    headers: { "content-type": "application/json", "x-slack-growth-token": tokenValue },
    body: JSON.stringify(body),
  })
}

function rawRequest(body: string, headers: Record<string, string> = {}) {
  return new Request("https://edge.test", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-slack-growth-token": env.SLACK_GROWTH_DISPATCH_TOKEN,
      ...headers,
    },
    body,
  })
}
function rpcFixture(overrides: Partial<Record<string, unknown>> = {}) {
  const calls: Array<{ name: string; body: Record<string, unknown> }> = []
  const rpc: Rpc = async (name, body) => {
    calls.push({ name, body })
    return {
      ok: true,
      data: Object.hasOwn(overrides, name)
        ? overrides[name]
        : name === "claim_slack_growth_delivery"
          ? claim
          : true,
    }
  }
  return { rpc, calls }
}

test("rejects missing or wrong dispatch token before DB access and validates body", async () => {
  const fixture = rpcFixture()
  const handler = createSlackGrowthHandler({ env, rpc: fixture.rpc })
  assert.equal((await handler(request({}, "wrong"))).status, 401)
  assert.equal(
    (
      await handler(
        new Request("https://edge.test", {
          method: "GET",
          headers: { "x-slack-growth-token": env.SLACK_GROWTH_DISPATCH_TOKEN },
        }),
      )
    ).status,
    405,
  )
  assert.equal((await handler(request({ delivery_id: "not-a-uuid" }))).status, 400)
  assert.equal((await handler(rawRequest("null"))).status, 400)
  assert.equal((await handler(rawRequest("[]"))).status, 400)
  assert.equal((await handler(rawRequest("x".repeat(1_025)))).status, 400)
  assert.equal(fixture.calls.length, 0)
})

test("claims, fences, posts a formatted message, then records delivered receipt", async () => {
  const fixture = rpcFixture()
  const sent: RequestInit[] = []
  const handler = createSlackGrowthHandler({
    env,
    rpc: fixture.rpc,
    fetch: async (_url, init) => {
      sent.push(init!)
      return new Response("ok", { status: 200 })
    },
  })
  const response = await handler(request())
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { status: "delivered" })
  assert.equal(fixture.calls[0].name, "claim_slack_growth_delivery")
  assert.equal(fixture.calls[1].name, "check_slack_growth_claim")
  assert.equal(fixture.calls[2].name, "complete_slack_growth_delivery")
  assert.equal(fixture.calls[2].body.p_outcome, "delivered")
  assert.equal(fixture.calls[2].body.p_token, token)
  assert.match(String(sent[0].body), /mia@example.com/)
})

test("does no send for noop or paused claim and restores pause without consuming attempt", async () => {
  const noop = rpcFixture({ claim_slack_growth_delivery: null })
  const nooped = createSlackGrowthHandler({ env, rpc: noop.rpc })
  assert.deepEqual(await (await nooped(request())).json(), { status: "noop" })
  const paused = rpcFixture({ check_slack_growth_claim: false })
  let sends = 0
  const handler = createSlackGrowthHandler({
    env,
    rpc: paused.rpc,
    fetch: async () => {
      sends++
      return new Response("ok")
    },
  })
  assert.deepEqual(await (await handler(request())).json(), { status: "paused" })
  assert.equal(sends, 0)
  assert.equal(paused.calls.at(-1)?.body.p_outcome, "paused")
})

test("records bounded retry for rate limits and safe outcomes for transient and permanent Slack errors", async () => {
  for (const [response, outcome, error] of [
    [
      new Response("body-secret", { status: 429, headers: { "retry-after": "99999" } }),
      "retry",
      "slack_rate_limited",
    ],
    [new Response("body-secret", { status: 503 }), "retry", "slack_temporarily_unavailable"],
    [new Response("body-secret", { status: 400 }), "permanent", "slack_rejected_notification"],
  ] as const) {
    const fixture = rpcFixture()
    const handler = createSlackGrowthHandler({ env, rpc: fixture.rpc, fetch: async () => response })
    const result = await handler(request())
    assert.equal(result.status, 200)
    const receipt = fixture.calls.at(-1)!
    assert.equal(receipt.body.p_outcome, outcome)
    assert.equal(receipt.body.p_error, error)
    assert.doesNotMatch(JSON.stringify(receipt), /body-secret/)
    if (error === "slack_rate_limited") assert.equal(receipt.body.p_retry_after_seconds, 3600)
  }
  const fixture = rpcFixture()
  const handler = createSlackGrowthHandler({
    env: { ...env, SLACK_GROWTH_WEBHOOK_URL: "http://bad" },
    rpc: fixture.rpc,
  })
  await handler(request())
  assert.equal(fixture.calls.at(-1)?.body.p_error, "slack_webhook_configuration_invalid")
})

test("strictly rejects Slack URL credentials, query and fragment without making a Slack request", async () => {
  for (const webhook of [
    "https://user:password@hooks.slack.com/services/T123/B123/secret",
    "https://hooks.slack.com/services/T123/B123/secret?leak=1",
    "https://hooks.slack.com/services/T123/B123/secret#fragment",
    "https://hooks.slack.com/services/T123/B123/secret/extra",
  ]) {
    const fixture = rpcFixture()
    let sends = 0
    const handler = createSlackGrowthHandler({
      env: { ...env, SLACK_GROWTH_WEBHOOK_URL: webhook },
      rpc: fixture.rpc,
      fetch: async () => {
        sends++
        return new Response("ok")
      },
    })
    assert.equal((await handler(request())).status, 200)
    assert.equal(sends, 0)
    assert.equal(fixture.calls.at(-1)?.body.p_error, "slack_webhook_configuration_invalid")
  }
})

test("converts throws, a non-ok 200 receipt, and an RPC failure into safe outcomes", async () => {
  for (const fetcher of [
    async () => new Response("not-ok", { status: 200 }),
    async () => Promise.reject(new Error("webhook-secret")),
  ]) {
    const fixture = rpcFixture()
    const handler = createSlackGrowthHandler({ env, rpc: fixture.rpc, fetch: fetcher })
    assert.equal((await handler(request())).status, 200)
    assert.equal(fixture.calls.at(-1)?.body.p_outcome, "retry")
    assert.equal(fixture.calls.at(-1)?.body.p_error, "slack_delivery_failed")
  }
  const fixture = rpcFixture()
  const failingRpc: Rpc = async (name, body) =>
    name === "claim_slack_growth_delivery" ? { ok: false, data: null } : fixture.rpc(name, body)
  const handler = createSlackGrowthHandler({ env, rpc: failingRpc })
  assert.equal((await handler(request())).status, 502)
  assert.equal(fixture.calls.length, 0)
})

test("does not claim when required server credentials are absent and reports receipt failure without details", async () => {
  const fixture = rpcFixture({ complete_slack_growth_delivery: false })
  const handler = createSlackGrowthHandler({
    env,
    rpc: fixture.rpc,
    fetch: async () => new Response("ok"),
  })
  const response = await handler(request())
  assert.equal(response.status, 502)
  assert.deepEqual(await response.json(), { error: "receipt_unavailable" })
  const missing = rpcFixture()
  const unconfigured = createSlackGrowthHandler({
    env: { ...env, SUPABASE_SERVICE_ROLE_KEY: undefined },
    rpc: missing.rpc,
  })
  assert.equal((await unconfigured(request())).status, 500)
  assert.equal(missing.calls.length, 0)
})
