import assert from "node:assert/strict"
import test from "node:test"
import { NextRequest } from "next/server"

import { createPersonalPlanFieldTestEntryHandler } from "../src/app/test/haarplan/[token]/route"
import { classifyRoute } from "../src/lib/auth/route-classification"
import { updateSession } from "../src/lib/supabase/middleware"

const now = Date.UTC(2026, 7, 10, 10, 0, 0)

test("valid bearer token is exchanged for signed HttpOnly cookies and a clean quiz URL", async () => {
  const handler = createPersonalPlanFieldTestEntryHandler({
    resolveCampaignToken: async () => ({
      kind: "eligible",
      campaign: {
        id: "10000000-0000-4000-8000-000000000001",
        accessDurationHours: 168,
        startsAt: now - 1,
        expiresAt: now + 30 * 24 * 60 * 60 * 1000,
      },
    }),
    cookieSecret: () => "field-cookie-secret",
    funnelSecret: () => "funnel-cookie-secret",
    now: () => now,
    randomUUID: (() => {
      const ids = ["20000000-0000-4000-8000-000000000002", "30000000-0000-4000-8000-000000000003"]
      return () => ids.shift()!
    })(),
  })
  const response = await handler(new NextRequest("https://chaarlie.de/test/haarplan/raw-secret"), {
    params: Promise.resolve({ token: "raw-secret" }),
  })

  assert.equal(response.status, 307)
  assert.equal(response.headers.get("location"), "https://chaarlie.de/lp/haarplan")
  assert.doesNotMatch(response.headers.get("location") ?? "", /raw-secret/)
  const cookies = response.headers.get("set-cookie") ?? ""
  assert.match(cookies, /chaarlie_personal_plan_field_test=/)
  assert.match(cookies, /chaarlie_funnel_session=/)
  assert.match(cookies, /HttpOnly/i)
  assert.match(response.headers.get("cache-control") ?? "", /no-store/)
  assert.equal(response.headers.get("referrer-policy"), "no-referrer")
  assert.equal(response.headers.get("x-robots-tag"), "noindex, nofollow")
})

test("unavailable token fails before issuing any campaign or funnel cookie", async () => {
  const handler = createPersonalPlanFieldTestEntryHandler({
    resolveCampaignToken: async () => ({
      kind: "unavailable",
      code: "field_test_unavailable",
    }),
  })
  const response = await handler(new NextRequest("https://chaarlie.de/test/haarplan/bad"), {
    params: Promise.resolve({ token: "bad" }),
  })
  assert.equal(response.status, 404)
  assert.equal(response.headers.get("set-cookie"), null)
  assert.match(await response.text(), /gerade nicht verfügbar/)
})

test("activation reaches its signed route checks before any auth or subscription gate", async () => {
  const pathname = "/api/personal-plan/field-test/activate"
  assert.equal(
    classifyRoute(pathname, { nodeEnv: "production", localDevLoginEnabled: false }),
    "public",
  )

  const response = await updateSession(
    new NextRequest(`https://chaarlie.de${pathname}`, { method: "POST" }),
  )
  assert.equal(response.status, 200)
  assert.equal(response.headers.get("location"), null)
})
