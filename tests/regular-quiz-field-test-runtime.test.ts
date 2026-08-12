import assert from "node:assert/strict"
import test from "node:test"
import { NextRequest } from "next/server"

import {
  createRegularQuizFieldTestCampaignCookie,
  hasRegularQuizFieldTestOfferIntent,
  isRegularQuizFieldTestEnabled,
  regularQuizFieldTestCookieSecret,
  resolveRegularQuizFieldTestCampaignToken,
  resolveRegularQuizFieldTestOfferAuthorization,
  resolvePersonalPlanFieldTestCampaignToken,
} from "../src/lib/personal-plan-field-test"
import { createRegularQuizFieldTestEntryHandler } from "../src/app/test/quiz/[token]/route"
import {
  createLeaveRegularQuizFieldTestHandler,
  mayReleaseRegularQuizFieldTestSession,
} from "../src/app/test/quiz/beendet/normal/route"
import { classifyRoute } from "../src/lib/auth/route-classification"
import { createUpdateSession } from "../src/lib/supabase/middleware"
import {
  shouldApplyRegularQuizFieldTestRewrite,
  shouldClearInvalidRegularQuizFieldTestCookie,
  shouldRewriteRegularQuizFieldTest,
  shouldStartNewFunnelSession,
} from "../src/proxy"
import { bindRegularFieldTestLead } from "../src/app/api/quiz/lead/route"

const campaignId = "10000000-0000-4000-8000-000000000001"
const sessionId = "20000000-0000-4000-8000-000000000002"
const leadId = "30000000-0000-4000-8000-000000000003"
const now = Date.UTC(2026, 7, 10, 10, 0, 0)
const campaign = {
  id: campaignId,
  status: "active" as const,
  flowKind: "regular_quiz" as const,
  startsAt: now - 60_000,
  expiresAt: now + 60_000,
  maxActivations: 100,
  successfulActivations: 4,
  accessDurationHours: 168,
}

test("regular quiz field-test runtime is explicitly flag-gated and flow-scoped", async () => {
  assert.equal(isRegularQuizFieldTestEnabled({ REGULAR_QUIZ_FIELD_TEST_ENABLED: "true" }), true)
  assert.equal(isRegularQuizFieldTestEnabled({ REGULAR_QUIZ_FIELD_TEST_ENABLED: "1" }), false)
  assert.deepEqual(
    await resolveRegularQuizFieldTestCampaignToken("opaque-token", {
      now,
      enabled: true,
      loadCampaignByTokenHash: async () => campaign,
    }),
    {
      kind: "eligible",
      campaign: {
        id: campaignId,
        accessDurationHours: 168,
        startsAt: campaign.startsAt,
        expiresAt: campaign.expiresAt,
      },
    },
  )
  assert.deepEqual(
    await resolveRegularQuizFieldTestCampaignToken("opaque-token", {
      now,
      enabled: true,
      loadCampaignByTokenHash: async () => ({ ...campaign, flowKind: "personal_plan" as const }),
    }),
    { kind: "unavailable", code: "field_test_unavailable" },
  )
  assert.deepEqual(
    await resolvePersonalPlanFieldTestCampaignToken("opaque-token", {
      now,
      loadCampaignByTokenHash: async () => campaign,
    }),
    { kind: "unavailable", code: "field_test_unavailable" },
  )
})

test("regular offer authorization needs the exact campaign, organic session, and legacy lead", async () => {
  const cookie = createRegularQuizFieldTestCampaignCookie(
    { campaignId, accessDurationHours: 168, issuedAt: now, expiresAt: campaign.expiresAt },
    regularQuizFieldTestCookieSecret("test-cookie-secret")!,
  )
  assert.ok(cookie)
  const dependencies = {
    now,
    enabled: true,
    cookieSecret: "test-cookie-secret",
    loadCampaignById: async () => campaign,
    loadOfferSession: async () => ({
      id: sessionId,
      leadId,
      packageKey: "default_organic",
      testKind: "field_test",
      campaignId,
    }),
  }
  assert.deepEqual(
    await resolveRegularQuizFieldTestOfferAuthorization(
      { campaignCookieValue: cookie, funnelSessionId: sessionId, leadId },
      dependencies,
    ),
    { campaignId, funnelSessionId: sessionId, leadId, accessDurationHours: 168 },
  )
  assert.equal(
    await hasRegularQuizFieldTestOfferIntent({ leadId, funnelSessionId: sessionId }, dependencies),
    true,
  )
})

test("regular entry refuses authenticated browsers and only starts eligible regular campaigns", async () => {
  const handler = createRegularQuizFieldTestEntryHandler({
    enabled: () => true,
    getAuthenticatedUser: async () => ({ id: "existing-user" }),
  })
  const existing = await handler(new NextRequest("https://chaarlie.de/test/quiz/raw-secret"), {
    params: Promise.resolve({ token: "raw-secret" }),
  })
  assert.equal(existing.status, 409)
  assert.equal(existing.headers.get("set-cookie"), null)

  const fresh = createRegularQuizFieldTestEntryHandler({
    enabled: () => true,
    getAuthenticatedUser: async () => null,
    resolveCampaignToken: async () => ({
      kind: "eligible",
      campaign: {
        id: campaignId,
        accessDurationHours: 168,
        startsAt: campaign.startsAt,
        expiresAt: campaign.expiresAt,
      },
    }),
    cookieSecret: () => "regular-cookie-secret",
    funnelSecret: () => "funnel-cookie-secret",
    now: () => now,
    randomUUID: (() => {
      const ids = ["20000000-0000-4000-8000-000000000002", "30000000-0000-4000-8000-000000000003"]
      return () => ids.shift()!
    })(),
  })
  const response = await fresh(new NextRequest("https://chaarlie.de/test/quiz/raw-secret"), {
    params: Promise.resolve({ token: "raw-secret" }),
  })
  assert.equal(response.headers.get("location"), "https://chaarlie.de/quiz")
  assert.match(response.headers.get("set-cookie") ?? "", /chaarlie_regular_quiz_field_test=/)
  assert.match(response.headers.get("set-cookie") ?? "", /chaarlie_funnel_session=/)
})

test("regular ended route is public and expired regular guests stay out of the Personal Plan ended surface", async () => {
  assert.equal(
    classifyRoute("/test/quiz/beendet", { nodeEnv: "production", localDevLoginEnabled: false }),
    "public",
  )
  const middleware = createUpdateSession({
    createServerClient: (() => ({
      auth: {
        getUser: async () => ({
          data: {
            user: {
              id: "guest",
              app_metadata: { access_kind: "field_test", field_test_flow: "regular_quiz" },
            },
          },
        }),
      },
    })) as never,
    hasCurrentAppAccess: (async () => false) as never,
    resolveOneTimeAccessState: (async () => "none") as never,
    getRouteEnvironment: () => ({ nodeEnv: "test", localDevLoginEnabled: false }),
  })
  const response = await middleware(new NextRequest("https://chaarlie.de/onboarding"))
  assert.equal(response.headers.get("location"), "https://chaarlie.de/test/quiz/beendet")

  let released = 0
  const leaveRegularQuizFieldTest = createLeaveRegularQuizFieldTestHandler({
    releaseFieldTestSession: async () => {
      released += 1
      return true
    },
  })
  const leaveResponse = await leaveRegularQuizFieldTest(
    new NextRequest("https://chaarlie.de/test/quiz/beendet/normal"),
  )
  assert.equal(leaveResponse.status, 303)
  assert.equal(leaveResponse.headers.get("location"), "https://chaarlie.de/quiz")
  assert.match(
    leaveResponse.headers.get("set-cookie") ?? "",
    /chaarlie_regular_quiz_field_test=;.*Max-Age=0/i,
  )
  assert.equal(released, 1)
  assert.equal(mayReleaseRegularQuizFieldTestSession(null), true)
  assert.equal(mayReleaseRegularQuizFieldTestSession({ name: "AuthSessionMissingError" }), true)
  assert.equal(mayReleaseRegularQuizFieldTestSession({ name: "AuthApiError" }), false)

  const failedLeave = createLeaveRegularQuizFieldTestHandler({
    releaseFieldTestSession: async (_request, response) => {
      response.cookies.set("sb-refreshed-auth", "preserved")
      return false
    },
  })
  const failedLeaveResponse = await failedLeave(
    new NextRequest("https://chaarlie.de/test/quiz/beendet/normal"),
  )
  assert.equal(failedLeaveResponse.status, 503)
  assert.match(failedLeaveResponse.headers.get("set-cookie") ?? "", /sb-refreshed-auth=preserved/)
})

test("regular quiz rewrite never overrides authenticated routing and forces organic repackaging", () => {
  assert.equal(
    shouldApplyRegularQuizFieldTestRewrite({
      authenticated: true,
      location: null,
      requested: true,
      status: 200,
    }),
    false,
  )
  assert.equal(
    shouldApplyRegularQuizFieldTestRewrite({
      authenticated: false,
      location: "/onboarding",
      requested: true,
      status: 307,
    }),
    false,
  )
  assert.equal(
    shouldApplyRegularQuizFieldTestRewrite({
      authenticated: false,
      location: null,
      requested: true,
      status: 200,
    }),
    true,
  )
  assert.equal(
    shouldStartNewFunnelSession({
      existingPackageKey: "meta_personal_plan_v1",
      explicitlySelectsPackage: true,
      personalPlanEnabled: true,
      selectedPackage: {
        key: "default_organic",
        slug: "organic",
        status: "active",
      } as never,
    }),
    true,
  )
})

test("only a signed regular campaign cookie enters the server-validated quiz shell", () => {
  const previousFlag = process.env.REGULAR_QUIZ_FIELD_TEST_ENABLED
  const previousSecret = process.env.PERSONAL_PLAN_FIELD_TEST_COOKIE_SIGNING_SECRET
  process.env.REGULAR_QUIZ_FIELD_TEST_ENABLED = "true"
  process.env.PERSONAL_PLAN_FIELD_TEST_COOKIE_SIGNING_SECRET = "rewrite-secret"
  try {
    const value = createRegularQuizFieldTestCampaignCookie(
      {
        campaignId,
        accessDurationHours: 168,
        issuedAt: Date.now() - 1_000,
        expiresAt: Date.now() + 60_000,
      },
      regularQuizFieldTestCookieSecret("rewrite-secret")!,
    )
    assert.equal(
      shouldRewriteRegularQuizFieldTest(
        new NextRequest("https://chaarlie.de/quiz", {
          headers: { cookie: `chaarlie_regular_quiz_field_test=${value}` },
        }),
      ),
      true,
    )
    const expiredValue = createRegularQuizFieldTestCampaignCookie(
      {
        campaignId,
        accessDurationHours: 168,
        issuedAt: Date.now() - 120_000,
        expiresAt: Date.now() - 60_000,
      },
      regularQuizFieldTestCookieSecret("rewrite-secret")!,
    )
    assert.equal(
      shouldRewriteRegularQuizFieldTest(
        new NextRequest("https://chaarlie.de/quiz", {
          headers: { cookie: `chaarlie_regular_quiz_field_test=${expiredValue}` },
        }),
      ),
      true,
    )
    assert.equal(
      shouldRewriteRegularQuizFieldTest(new NextRequest("https://chaarlie.de/quiz")),
      false,
    )
    process.env.REGULAR_QUIZ_FIELD_TEST_ENABLED = "false"
    assert.equal(
      shouldRewriteRegularQuizFieldTest(
        new NextRequest("https://chaarlie.de/quiz", {
          headers: { cookie: `chaarlie_regular_quiz_field_test=${value}` },
        }),
      ),
      true,
    )
  } finally {
    if (previousFlag === undefined) delete process.env.REGULAR_QUIZ_FIELD_TEST_ENABLED
    else process.env.REGULAR_QUIZ_FIELD_TEST_ENABLED = previousFlag
    if (previousSecret === undefined)
      delete process.env.PERSONAL_PLAN_FIELD_TEST_COOKIE_SIGNING_SECRET
    else process.env.PERSONAL_PLAN_FIELD_TEST_COOKIE_SIGNING_SECRET = previousSecret
  }
})

test("an invalid regular cookie is cleared only when signature validation is configured", () => {
  const invalidCookie = {
    pathname: "/quiz",
    hasCookie: true,
    rewriteRequested: false,
  }
  assert.equal(
    shouldClearInvalidRegularQuizFieldTestCookie({
      ...invalidCookie,
      secretAvailable: false,
    }),
    false,
  )
  assert.equal(
    shouldClearInvalidRegularQuizFieldTestCookie({
      ...invalidCookie,
      secretAvailable: true,
    }),
    true,
  )
})

test("lead binding runs only for exact regular field-test intent and organic context", async () => {
  let calls = 0
  const bind = async () => {
    calls += 1
    return true
  }
  const context = {
    visitorId: "40000000-0000-4000-8000-000000000004",
    sessionId,
    packageKey: "default_organic",
    issuedAt: now,
  }

  assert.equal(
    await bindRegularFieldTestLead({
      intent: false,
      campaignCookieValue: "signed",
      funnelContext: context,
      leadId,
      bind: bind as never,
    }),
    false,
  )
  assert.equal(
    await bindRegularFieldTestLead({
      intent: true,
      campaignCookieValue: "signed",
      funnelContext: { ...context, packageKey: "meta_personal_plan_v1" },
      leadId,
      bind: bind as never,
    }),
    false,
  )
  assert.equal(
    await bindRegularFieldTestLead({
      intent: true,
      campaignCookieValue: "signed",
      funnelContext: context,
      leadId,
      bind: bind as never,
    }),
    true,
  )
  assert.equal(calls, 1)
})
