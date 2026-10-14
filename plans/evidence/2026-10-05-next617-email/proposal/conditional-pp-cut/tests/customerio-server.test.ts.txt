import assert from "node:assert/strict"
import test from "node:test"

import {
  identifyCustomerIoServerPerson,
  trackCustomerIoServerEvent,
} from "../src/lib/customerio/server"

function withEnv(name: string, value: string | undefined, fn: () => Promise<void>) {
  const previous = process.env[name]
  if (value === undefined) delete process.env[name]
  else process.env[name] = value

  return fn().finally(() => {
    if (previous === undefined) delete process.env[name]
    else process.env[name] = previous
  })
}

test("server identify uses Customer.io EU Pipelines strict mode", async () => {
  const calls: Array<{ url: string; init: RequestInit }> = []
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} })
    return new Response("{}", { status: 200 })
  }) as typeof fetch

  try {
    await withEnv("CUSTOMERIO_SERVER_WRITE_KEY", "server-key", async () => {
      const result = await identifyCustomerIoServerPerson({
        userId: "lead@example.com",
        traits: { email: "lead@example.com", lead_id: "lead-123" },
        messageId: "identify:lead:lead-123",
      })
      assert.equal(result.ok, true)
    })
  } finally {
    globalThis.fetch = originalFetch
  }

  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, "https://cdp-eu.customer.io/v1/identify")
  assert.equal(calls[0].init.method, "POST")
  assert.equal((calls[0].init.headers as Record<string, string>)["X-Strict-Mode"], "1")
  assert.equal(
    (calls[0].init.headers as Record<string, string>).Authorization,
    `Basic ${Buffer.from("server-key:").toString("base64")}`,
  )
  assert.deepEqual(JSON.parse(String(calls[0].init.body)), {
    userId: "lead@example.com",
    traits: { email: "lead@example.com", lead_id: "lead-123" },
    messageId: "identify:lead:lead-123",
  })
})

test("server track returns a failed result instead of throwing", async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async () => new Response("bad", { status: 500 })) as typeof fetch

  try {
    await withEnv("CUSTOMERIO_SERVER_WRITE_KEY", "server-key", async () => {
      const result = await trackCustomerIoServerEvent({
        userId: "lead@example.com",
        event: "quiz_profile_submitted",
        properties: { lead_id: "lead-123", source: "quiz_lead_api" },
        messageId: "quiz_profile_submitted:lead-123",
      })
      assert.equal(result.ok, false)
      assert.match(result.error ?? "", /500/)
    })
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("server helper no-ops when CUSTOMERIO_SERVER_WRITE_KEY is missing", async () => {
  await withEnv("CUSTOMERIO_SERVER_WRITE_KEY", undefined, async () => {
    const result = await identifyCustomerIoServerPerson({
      userId: "lead@example.com",
      traits: { email: "lead@example.com" },
      messageId: "identify:lead:missing-key",
    })
    assert.equal(result.ok, false)
    assert.equal(result.skipped, true)
  })
})
