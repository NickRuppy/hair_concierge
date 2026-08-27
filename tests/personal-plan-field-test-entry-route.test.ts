import assert from "node:assert/strict"
import test from "node:test"
import { NextRequest } from "next/server"

import { createPersonalPlanFieldTestEntryHandler } from "../src/app/test/haarplan/[token]/route"
import { classifyRoute } from "../src/lib/auth/route-classification"
import { updateSession } from "../src/lib/supabase/middleware"

const now = Date.UTC(2026, 7, 10, 10, 0, 0)
const campaignId = "10000000-0000-4000-8000-000000000001"

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

test("email-bound token only routes to account authentication without issuing guest credentials", async () => {
  const handler = createPersonalPlanFieldTestEntryHandler({
    resolveCampaignToken: async () => ({
      kind: "eligible",
      campaign: {
        id: "10000000-0000-4000-8000-000000000001",
        identityMode: "email_bound" as const,
        accessDurationHours: 2160,
        startsAt: now - 1,
        expiresAt: now + 30 * 24 * 60 * 60 * 1000,
      },
    }),
  })

  const response = await handler(new NextRequest("https://chaarlie.de/test/haarplan/raw-secret"), {
    params: Promise.resolve({ token: "raw-secret" }),
  })

  assert.equal(
    response.headers.get("location"),
    "https://chaarlie.de/test/haarplan/konto?campaign=10000000-0000-4000-8000-000000000001",
  )
  assert.doesNotMatch(response.headers.get("location") ?? "", /raw-secret/)
  assert.equal(response.headers.get("set-cookie"), null)
  assert.match(response.headers.get("cache-control") ?? "", /no-store/)
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

test("organic moderator activation reaches its account checks before the subscription gate", async () => {
  const pathname = "/api/personal-plan/field-test/moderator/activate-organic"
  assert.equal(
    classifyRoute(pathname, { nodeEnv: "production", localDevLoginEnabled: false }),
    "public",
  )
  const response = await updateSession(
    new NextRequest(`https://chaarlie.de${pathname}`, { method: "POST" }),
  )
  assert.equal(response.status, 200)
  assert.equal(response.headers.get("location"), null)
  assert.equal(
    classifyRoute(`${pathname}/other`, { nodeEnv: "production", localDevLoginEnabled: false }),
    "protected",
  )
})

class CapturedRedirect extends Error {
  constructor(readonly destination: string) {
    super(`redirect:${destination}`)
  }
}

function captureRedirect(destination: string): never {
  throw new CapturedRedirect(destination)
}

async function assertRedirectsTo(action: () => Promise<unknown>, destination: string) {
  try {
    await action()
    assert.fail(`expected redirect to ${destination}`)
  } catch (error) {
    assert.ok(error instanceof CapturedRedirect)
    assert.equal(error.destination, destination)
  }
}

test("authenticated active moderator invite return opens the saved plan instead of a fresh quiz prompt", async () => {
  const { createModeratorAccountPage } =
    await import("../src/app/test/haarplan/konto/moderator-account-page")
  const calls: unknown[] = []
  const authUser = {
    id: "20000000-0000-4000-8000-000000000002",
    email: "member@example.com",
    email_confirmed_at: "2026-08-27T10:00:00Z",
  }
  const page = createModeratorAccountPage({
    redirect: captureRedirect,
    createClient: async () =>
      ({
        auth: {
          getUser: async () => ({ data: { user: authUser } }),
        },
      }) as never,
    resolveMember: async (input) => {
      calls.push(input)
      return {
        kind: "active" as const,
        campaignId,
        expiresAt: new Date(now + 2160 * 60 * 60 * 1000).toISOString(),
        member: { id: "30000000-0000-4000-8000-000000000003", userId: authUser.id },
      }
    },
  })

  await assertRedirectsTo(
    () => page({ searchParams: Promise.resolve({ campaign: campaignId }) }),
    "/anwendung",
  )
  assert.deepEqual(calls, [{ campaignId, user: authUser }])
})

test("authenticated ready moderator invite still renders the fresh quiz start UI", async () => {
  const { createModeratorAccountPage } =
    await import("../src/app/test/haarplan/konto/moderator-account-page")
  const authUser = {
    id: "20000000-0000-4000-8000-000000000002",
    email: "member@example.com",
    email_confirmed_at: "2026-08-27T10:00:00Z",
  }
  const page = createModeratorAccountPage({
    redirect: captureRedirect,
    createClient: async () =>
      ({
        auth: {
          getUser: async () => ({ data: { user: authUser } }),
        },
      }) as never,
    resolveMember: async () => ({
      kind: "ready" as const,
      campaign: {
        id: campaignId,
        expiresAt: now + 24 * 60 * 60 * 1000,
        accessDurationHours: 2160,
      },
      member: { id: "30000000-0000-4000-8000-000000000003", userId: authUser.id },
    }),
  })

  const element = (await page({ searchParams: Promise.resolve({ campaign: campaignId }) })) as {
    props?: { campaignId?: string }
  }
  assert.equal(element.props?.campaignId, campaignId)
})

test("authenticated ended moderator invite returns the existing ended state", async () => {
  const { createModeratorAccountPage } =
    await import("../src/app/test/haarplan/konto/moderator-account-page")
  const page = createModeratorAccountPage({
    redirect: captureRedirect,
    createClient: async () =>
      ({
        auth: {
          getUser: async () => ({
            data: {
              user: {
                id: "20000000-0000-4000-8000-000000000002",
                email: "member@example.com",
                email_confirmed_at: "2026-08-27T10:00:00Z",
              },
            },
          }),
        },
      }) as never,
    resolveMember: async () => ({ kind: "ended" as const, campaignId, reason: "expired" }),
  })

  await assertRedirectsTo(
    () => page({ searchParams: Promise.resolve({ campaign: campaignId }) }),
    "/test/haarplan/beendet",
  )
})
