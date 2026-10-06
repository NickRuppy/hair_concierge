import assert from "node:assert/strict"
import test from "node:test"

import {
  bindPersonalPlanFieldTestLead,
  createPersonalPlanFieldTestCampaignCookie,
  hashPersonalPlanFieldTestToken,
  hasPersonalPlanFieldTestOfferIntent,
  isPersonalPlanFieldTestGuestRetry,
  personalPlanFieldTestCookieSecret,
  resolvePersonalPlanFieldTestCampaignCookie,
  resolvePersonalPlanFieldTestCampaignToken,
  resolvePersonalPlanFieldTestOfferAuthorization,
  resolveOrganicModeratorOfferAuthorization,
} from "../src/lib/personal-plan-field-test"

const campaignId = "10000000-0000-4000-8000-000000000001"
const sessionId = "20000000-0000-4000-8000-000000000002"
const leadId = "30000000-0000-4000-8000-000000000003"
const now = Date.UTC(2026, 7, 10, 10, 0, 0)
const cookieSecret = "field-test-cookie-secret"
const signingSecret = personalPlanFieldTestCookieSecret(cookieSecret)
assert.ok(signingSecret)
const campaign = {
  id: campaignId,
  status: "active" as const,
  startsAt: now - 60_000,
  expiresAt: now + 60_000,
  maxActivations: 100,
  successfulActivations: 4,
  accessDurationHours: 168,
}

test("campaign token lookup stores and compares only the SHA-256 hash", async () => {
  const seen: string[] = []
  const result = await resolvePersonalPlanFieldTestCampaignToken("opaque-token", {
    now,
    loadCampaignByTokenHash: async (tokenHash) => {
      seen.push(tokenHash)
      return campaign
    },
  })

  assert.deepEqual(seen, [hashPersonalPlanFieldTestToken("opaque-token")])
  assert.deepEqual(result, {
    kind: "eligible",
    campaign: {
      id: campaignId,
      accessDurationHours: 168,
      startsAt: campaign.startsAt,
      expiresAt: campaign.expiresAt,
    },
  })
})

test("an authenticated field guest may retry only the exact campaign, session, lead, and user", async () => {
  const input = { campaignId, funnelSessionId: sessionId, leadId, userId: "guest-user" }
  assert.equal(
    await isPersonalPlanFieldTestGuestRetry(input, {
      loadEnrollment: async () => ({
        campaignId,
        funnelSessionId: sessionId,
        leadId,
        userId: "guest-user",
      }),
    }),
    true,
  )
  assert.equal(
    await isPersonalPlanFieldTestGuestRetry(input, {
      loadEnrollment: async () => ({
        campaignId,
        funnelSessionId: sessionId,
        leadId: "another-lead",
        userId: "guest-user",
      }),
    }),
    false,
  )
})

test("campaign cookie is revalidated against current database lifecycle and capacity", async () => {
  const cookie = createPersonalPlanFieldTestCampaignCookie(
    {
      campaignId,
      accessDurationHours: 168,
      issuedAt: now,
      expiresAt: campaign.expiresAt,
    },
    signingSecret,
  )
  assert.ok(cookie)

  const eligible = await resolvePersonalPlanFieldTestCampaignCookie(cookie, {
    now,
    cookieSecret,
    loadCampaignById: async () => campaign,
  })
  assert.equal(eligible.kind, "eligible")

  const exhausted = await resolvePersonalPlanFieldTestCampaignCookie(cookie, {
    now,
    cookieSecret,
    loadCampaignById: async () => ({ ...campaign, successfulActivations: 100 }),
  })
  assert.deepEqual(exhausted, { kind: "unavailable", code: "field_test_unavailable" })
})

test("offer authorization requires the exact signed campaign, session, and lead", async () => {
  const cookie = createPersonalPlanFieldTestCampaignCookie(
    {
      campaignId,
      accessDurationHours: 168,
      issuedAt: now,
      expiresAt: campaign.expiresAt,
    },
    signingSecret,
  )
  assert.ok(cookie)

  const authorized = await resolvePersonalPlanFieldTestOfferAuthorization(
    { campaignCookieValue: cookie, funnelSessionId: sessionId, leadId },
    {
      now,
      cookieSecret,
      loadCampaignById: async () => campaign,
      loadOfferSession: async () => ({
        id: sessionId,
        leadId,
        packageKey: "meta_personal_plan_v1",
        testKind: "field_test",
        campaignId,
      }),
    },
  )

  assert.deepEqual(authorized, {
    campaignId,
    funnelSessionId: sessionId,
    leadId,
    accessDurationHours: 168,
  })
  assert.equal(
    await resolvePersonalPlanFieldTestOfferAuthorization(
      { campaignCookieValue: cookie, funnelSessionId: sessionId, leadId: "wrong" },
      {
        now,
        cookieSecret,
        loadCampaignById: async () => campaign,
        loadOfferSession: async () => null,
      },
    ),
    null,
  )
})

test("persisted field-test offer intent survives campaign authorization loss", async () => {
  const loadOfferSession = async () => ({
    id: sessionId,
    leadId,
    packageKey: "meta_personal_plan_v1",
    testKind: "field_test",
    campaignId,
  })

  assert.equal(
    await hasPersonalPlanFieldTestOfferIntent(
      { leadId, funnelSessionId: sessionId },
      { loadOfferSession },
    ),
    true,
  )
  assert.equal(
    await hasPersonalPlanFieldTestOfferIntent(
      { leadId, funnelSessionId: "another-session" },
      { loadOfferSession },
    ),
    false,
  )
})

test("missing pre-migration field-test columns do not break ordinary paid results", async () => {
  assert.equal(
    await hasPersonalPlanFieldTestOfferIntent(
      { leadId, funnelSessionId: sessionId },
      {
        loadOfferSession: async () => {
          throw {
            code: "PGRST204",
            message:
              "Could not find the 'test_kind' column of 'funnel_sessions' in the schema cache",
          }
        },
      },
    ),
    false,
  )
})

test("unexpected persisted-intent lookup failures remain non-commercial", async () => {
  assert.equal(
    await hasPersonalPlanFieldTestOfferIntent(
      { leadId, funnelSessionId: sessionId },
      {
        loadOfferSession: async () => {
          throw new Error("database unavailable")
        },
      },
    ),
    true,
  )
})

test("lead binding uses only server-resolved campaign and funnel context", async () => {
  const cookie = createPersonalPlanFieldTestCampaignCookie(
    {
      campaignId,
      accessDurationHours: 168,
      issuedAt: now,
      expiresAt: campaign.expiresAt,
    },
    signingSecret,
  )
  assert.ok(cookie)
  const calls: Record<string, unknown>[] = []

  const bound = await bindPersonalPlanFieldTestLead(
    {
      campaignCookieValue: cookie,
      funnelContext: {
        visitorId: "40000000-0000-4000-8000-000000000004",
        sessionId,
        packageKey: "meta_personal_plan_v1",
        issuedAt: now,
      },
      leadId,
    },
    {
      now,
      cookieSecret,
      loadCampaignById: async () => campaign,
      bindFunnel: async (args) => {
        calls.push(args)
        return true
      },
    },
  )

  assert.equal(bound, true)
  assert.deepEqual(calls, [
    {
      p_campaign_id: campaignId,
      p_funnel_session_id: sessionId,
      p_lead_id: leadId,
    },
  ])
})

test("unknown campaign identity modes never fall back to guest", async () => {
  const resolved = await resolvePersonalPlanFieldTestCampaignToken("opaque-token", {
    now,
    loadCampaignByTokenHash: async () => ({ ...campaign, identityMode: "unknown" as never }),
  })
  assert.equal(resolved.kind, "unavailable")
})

test("spent email-bound token can still reach account resolution without granting a new seat", async () => {
  const resolved = await resolvePersonalPlanFieldTestCampaignToken("opaque-token", {
    now,
    loadCampaignByTokenHash: async () => ({
      ...campaign,
      identityMode: "email_bound",
      accessDurationHours: 2160,
      expiresAt: now - 1,
      successfulActivations: 100,
    }),
  })
  assert.equal(resolved.kind, "eligible")
  if (resolved.kind === "eligible") assert.equal(resolved.campaign.identityMode, "email_bound")
})

test("guest offer authorization cannot consume an email-bound campaign", async () => {
  const cookie = createPersonalPlanFieldTestCampaignCookie(
    {
      campaignId,
      accessDurationHours: 2160,
      issuedAt: now,
      expiresAt: campaign.expiresAt,
    },
    signingSecret!,
  )
  const resolved = await resolvePersonalPlanFieldTestOfferAuthorization(
    { campaignCookieValue: cookie, funnelSessionId: sessionId, leadId },
    {
      now,
      cookieSecret,
      loadCampaignById: async () => ({
        ...campaign,
        identityMode: "email_bound",
        accessDurationHours: 2160,
      }),
      loadOfferSession: async () => ({
        id: sessionId,
        leadId,
        packageKey: "meta_personal_plan_v1",
        testKind: "field_test",
        campaignId,
      }),
    },
  )
  assert.equal(resolved, null)
})

test("organic moderator offer authorization requires the exact email-bound organic campaign, session, and lead", async () => {
  const cookie = createPersonalPlanFieldTestCampaignCookie(
    {
      campaignId,
      accessDurationHours: 2160,
      issuedAt: now,
      expiresAt: campaign.expiresAt,
    },
    signingSecret!,
  )
  assert.ok(cookie)
  const emailBoundCampaign = {
    ...campaign,
    identityMode: "email_bound" as const,
    accessDurationHours: 2160,
  }
  const session = {
    id: sessionId,
    leadId,
    packageKey: "default_organic",
    testKind: "field_test",
    campaignId,
  }
  const dependencies = {
    now,
    cookieSecret,
    loadCampaignById: async () => emailBoundCampaign,
    loadOfferSession: async () => session,
  }

  assert.deepEqual(
    await resolveOrganicModeratorOfferAuthorization(
      { campaignCookieValue: cookie, funnelSessionId: sessionId, leadId, allowEmailBound: true },
      dependencies,
    ),
    { campaignId, funnelSessionId: sessionId, leadId, accessDurationHours: 2160 },
  )

  for (const input of [
    { campaignCookieValue: cookie, funnelSessionId: sessionId, leadId },
    {
      campaignCookieValue: cookie,
      funnelSessionId: "wrong-session",
      leadId,
      allowEmailBound: true,
    },
    {
      campaignCookieValue: cookie,
      funnelSessionId: sessionId,
      leadId: "wrong-lead",
      allowEmailBound: true,
    },
  ]) {
    assert.equal(await resolveOrganicModeratorOfferAuthorization(input, dependencies), null)
  }

  assert.equal(
    await resolveOrganicModeratorOfferAuthorization(
      { campaignCookieValue: cookie, funnelSessionId: sessionId, leadId, allowEmailBound: true },
      {
        ...dependencies,
        loadCampaignById: async () => ({ ...campaign, identityMode: "guest" as const }),
      },
    ),
    null,
  )
})
