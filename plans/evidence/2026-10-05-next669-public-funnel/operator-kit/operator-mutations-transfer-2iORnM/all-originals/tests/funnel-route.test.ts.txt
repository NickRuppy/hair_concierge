import assert from "node:assert/strict"
import test from "node:test"
import { NextRequest } from "next/server"

import { POST } from "../src/app/api/funnel/session/route"
import { encodeFunnelContext, FUNNEL_SESSION_COOKIE } from "../src/lib/funnel/cookie"

const signingSecret = "route-test-signing-secret"
const context = {
  visitorId: "10000000-0000-4000-8000-000000000001",
  sessionId: "20000000-0000-4000-8000-000000000002",
  packageKey: "default_organic",
  issuedAt: Date.now(),
}

async function withFunnelEnv<T>(fn: () => Promise<T>) {
  const previousEnabled = process.env.FUNNEL_ATTRIBUTION_ENABLED
  const previousSecret = process.env.FUNNEL_COOKIE_SIGNING_SECRET
  process.env.FUNNEL_ATTRIBUTION_ENABLED = "true"
  process.env.FUNNEL_COOKIE_SIGNING_SECRET = signingSecret
  try {
    return await fn()
  } finally {
    if (previousEnabled === undefined) delete process.env.FUNNEL_ATTRIBUTION_ENABLED
    else process.env.FUNNEL_ATTRIBUTION_ENABLED = previousEnabled
    if (previousSecret === undefined) delete process.env.FUNNEL_COOKIE_SIGNING_SECRET
    else process.env.FUNNEL_COOKIE_SIGNING_SECRET = previousSecret
  }
}

async function request(body: unknown, cookieValue?: string) {
  const signed = cookieValue ?? (await encodeFunnelContext(context, signingSecret))
  return new NextRequest("https://chaarlie.de/api/funnel/session", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: `${FUNNEL_SESSION_COOKIE}=${signed}`,
    },
    body: JSON.stringify(body),
  })
}

test("funnel route rejects browser-spoofed purchases before database access", () =>
  withFunnelEnv(async () => {
    const response = await POST(
      await request({ eventId: crypto.randomUUID(), milestone: "purchase_completed" }),
    )
    assert.equal(response.status, 400)
    assert.deepEqual(await response.json(), { error: "invalid_milestone" })
  }))

test("funnel route rejects tampered context without database access", () =>
  withFunnelEnv(async () => {
    const response = await POST(
      await request({ eventId: crypto.randomUUID(), milestone: "quiz_started" }, "tampered"),
    )
    assert.equal(response.status, 202)
    assert.deepEqual(await response.json(), { enabled: false })
  }))

test("funnel route rejects oversized declared bodies before reading them", () =>
  withFunnelEnv(async () => {
    const signed = await encodeFunnelContext(context, signingSecret)
    const response = await POST(
      new NextRequest("https://chaarlie.de/api/funnel/session", {
        method: "POST",
        headers: {
          "content-length": "9000",
          "content-type": "application/json",
          cookie: `${FUNNEL_SESSION_COOKIE}=${signed}`,
        },
        body: "{}",
      }),
    )
    assert.equal(response.status, 413)
    assert.deepEqual(await response.json(), { error: "payload_too_large" })
  }))
