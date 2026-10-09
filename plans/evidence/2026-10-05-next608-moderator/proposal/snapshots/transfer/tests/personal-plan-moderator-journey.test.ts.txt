import assert from "node:assert/strict"
import test from "node:test"
import {
  resolveModeratorJourney,
  loadPersonalPlanResultFunnel,
  loadModeratorResultCampaign,
} from "../src/lib/personal-plan-field-test/moderator-journey"
import { MODERATOR_INTENT_COOKIE } from "../src/lib/personal-plan-field-test/moderator-contract"
import { PERSONAL_PLAN_FIELD_TEST_CAMPAIGN_COOKIE } from "../src/lib/personal-plan-field-test/constants"

const campaignId = "30000000-0000-4000-8000-000000000003"
const userId = "10000000-0000-4000-8000-000000000001"
const funnel = {
  sessionId: "20000000-0000-4000-8000-000000000002",
  visitorId: "20000000-0000-4000-8000-000000000003",
  packageKey: "meta_personal_plan_v1",
  issuedAt: 100,
}
const campaign = {
  id: campaignId,
  startsAt: 100,
  expiresAt: 10000,
  accessDurationHours: 2160,
  identityMode: "email_bound" as const,
}
const intent = {
  campaignId,
  userId,
  funnelSessionId: funnel.sessionId,
  issuedAt: 100,
  expiresAt: 10000,
}
const cookies = {
  get: (name: string) =>
    [MODERATOR_INTENT_COOKIE, PERSONAL_PLAN_FIELD_TEST_CAMPAIGN_COOKIE].includes(name)
      ? { value: "signed" }
      : undefined,
}
type Dependencies = NonNullable<Parameters<typeof resolveModeratorJourney>[1]>
const dependencies: Dependencies = {
  loadMode: async () => "email_bound",
  resolveCampaign: async () => ({ kind: "eligible", campaign }),
  getUser: async () => ({
    id: userId,
    email: " MOD@EXAMPLE.COM ",
    email_confirmed_at: "2026-08-27",
  }),
  resolveIntent: async () => ({ kind: "ready", intent, campaign, member: { id: userId, userId } }),
}

test("moderator journey authorizes only verified account and passes exact result ownership to intent verification", async () => {
  const leadId = "10000000-0000-4000-8000-000000000099"
  const result = await resolveModeratorJourney(
    { cookies, funnelContext: funnel, leadId },
    {
      ...dependencies,
      resolveIntent: async (value, user, context, options) => {
        assert.equal(value, "signed")
        assert.equal(user.id, userId)
        assert.equal(context.sessionId, funnel.sessionId)
        assert.equal(options?.leadId, leadId)
        return { kind: "ready", intent, campaign, member: { id: userId, userId } }
      },
    },
  )
  assert.deepEqual(result, {
    kind: "authorized",
    campaignId,
    userId,
    email: "mod@example.com",
    funnelSessionId: funnel.sessionId,
  })
})

test("missing credentials or account proof cannot downgrade a persisted moderator funnel to commercial", async () => {
  const cases: Array<{
    cookies?: typeof cookies
    funnelContext?: typeof funnel | null
    overrides?: Dependencies
  }> = [
    { cookies: { get: () => undefined } },
    { funnelContext: null },
    { overrides: { getUser: async () => null } },
    { overrides: { getUser: async () => ({ id: userId, email: "mod@example.com" }) } },
    {
      overrides: {
        resolveCampaign: async () => ({ kind: "unavailable", code: "field_test_unavailable" }),
      },
    },
    {
      overrides: { resolveIntent: async () => ({ kind: "forbidden", reason: "intent_mismatch" }) },
    },
    {
      overrides: {
        resolveIntent: async () => ({
          kind: "ready",
          intent: { ...intent, campaignId: "another" },
          campaign,
          member: { id: userId, userId },
        }),
      },
    },
  ]
  for (const item of cases) {
    assert.deepEqual(
      await resolveModeratorJourney(
        {
          cookies: item.cookies ?? cookies,
          funnelContext: item.funnelContext === undefined ? funnel : item.funnelContext,
        },
        { ...dependencies, ...item.overrides },
      ),
      { kind: "unavailable" },
    )
  }
})

test("moderator journey treats database and authentication failures as unavailable", async () => {
  for (const overrides of [
    { loadMode: async () => "unavailable" as const },
    {
      loadMode: async () => {
        throw Error("offline")
      },
    },
    {
      getUser: async () => {
        throw Error("offline")
      },
    },
  ]) {
    assert.deepEqual(
      await resolveModeratorJourney(
        { cookies, funnelContext: funnel },
        { ...dependencies, ...overrides },
      ),
      { kind: "unavailable" },
    )
  }
})

test("ordinary visitors and legacy guest funnels do not require account proof", async () => {
  const getUser = async () => {
    throw Error("ordinary journey must not authenticate")
  }
  assert.deepEqual(
    await resolveModeratorJourney(
      { cookies: { get: () => undefined }, funnelContext: null },
      { getUser },
    ),
    { kind: "ordinary" },
  )
  assert.deepEqual(
    await resolveModeratorJourney(
      { cookies: { get: () => undefined }, funnelContext: funnel },
      { loadMode: async () => "guest", getUser },
    ),
    { kind: "ordinary" },
  )
})

test("result ownership lookup does not treat database failure or disabled analytics as no moderator context", async () => {
  const oldFlag = process.env.FUNNEL_ATTRIBUTION_ENABLED
  process.env.FUNNEL_ATTRIBUTION_ENABLED = "false"
  try {
    const loaded = await loadPersonalPlanResultFunnel("lead", async () => ({
      data: {
        id: funnel.sessionId,
        visitor_id: funnel.visitorId,
        package_key: funnel.packageKey,
        first_seen_at: "2026-08-27T10:00:00Z",
        offer_variant: null,
        offer_viewed_at: null,
        checkout_started_at: null,
        is_internal_test: false,
        test_kind: "field_test",
        field_test_campaign_id: campaignId,
      },
      error: null,
    }))
    assert.equal(loaded.kind, "loaded")
    if (loaded.kind === "loaded") assert.equal(loaded.context?.fieldTestCampaignId, campaignId)
    assert.deepEqual(
      await loadPersonalPlanResultFunnel("lead", async () => ({
        data: null,
        error: { code: "offline" },
      })),
      { kind: "unavailable" },
    )
    assert.deepEqual(
      await loadPersonalPlanResultFunnel("lead", async () => {
        throw Error("offline")
      }),
      { kind: "unavailable" },
    )
  } finally {
    if (oldFlag === undefined) delete process.env.FUNNEL_ATTRIBUTION_ENABLED
    else process.env.FUNNEL_ATTRIBUTION_ENABLED = oldFlag
  }
})

test("result account classification survives missing funnel context and fails closed on read errors", async () => {
  assert.deepEqual(
    await loadModeratorResultCampaign("old-lead", async () => ({
      data: { moderator_campaign_id: campaignId },
      error: null,
    })),
    { kind: "moderator", campaignId },
  )
  assert.deepEqual(
    await loadModeratorResultCampaign("ordinary-lead", async () => ({
      data: { moderator_campaign_id: null },
      error: null,
    })),
    { kind: "ordinary" },
  )
  assert.deepEqual(
    await loadModeratorResultCampaign("lead", async () => ({
      data: null,
      error: { code: "offline", message: "offline" },
    })),
    { kind: "unavailable" },
  )
  assert.deepEqual(
    await loadModeratorResultCampaign("lead", async () => ({
      data: null,
      error: { code: "42703", message: "column moderator_campaign_id does not exist" },
    })),
    { kind: "ordinary" },
  )
  assert.deepEqual(
    await loadModeratorResultCampaign("lead", async () => ({
      data: null,
      error: { code: "42703", message: "column unrelated does not exist" },
    })),
    { kind: "unavailable" },
  )
})
