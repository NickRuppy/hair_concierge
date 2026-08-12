import assert from "node:assert/strict"
import test from "node:test"

import { createQuizLeadPostHandler } from "../src/app/api/quiz/lead/route"
import { REGULAR_QUIZ_FIELD_TEST_CAMPAIGN_COOKIE } from "../src/lib/personal-plan-field-test"

const leadId = "10000000-0000-4000-8000-000000000001"
const funnelContext = {
  visitorId: "20000000-0000-4000-8000-000000000002",
  sessionId: "30000000-0000-4000-8000-000000000003",
  packageKey: "default_organic",
  issuedAt: Date.now(),
}

const requestBody = {
  name: "Feldtest Person",
  email: "feldtest@example.com",
  marketingConsent: false,
  quizAnswers: {
    structure: "wavy",
    thickness: "fine",
    density: "medium",
    hair_length: "medium",
    fingertest: "leicht_uneben",
    pulltest: "stretches_bounces",
    scalp_type: "ausgeglichen",
    has_scalp_issue: false,
    concerns: ["dryness"],
    treatment: ["natur"],
    goals: ["shine"],
  },
} as const

function request() {
  return new Request("https://chaarlie.de/api/quiz/lead", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.14" },
    body: JSON.stringify(requestBody),
  })
}

function existingLeadClient() {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            gte: () => ({
              order: () => ({
                limit: async () => ({
                  data: [
                    {
                      id: leadId,
                      quiz_answers: requestBody.quizAnswers,
                      marketing_consent: false,
                      status: "captured",
                    },
                  ],
                  error: null,
                }),
              }),
            }),
          }),
        }),
      }),
    }),
  }
}

function handler({
  campaignCookie,
  enabled = true,
  bind = async () => true,
  onSync = () => {},
  onMeta = () => {},
}: {
  campaignCookie?: string
  enabled?: boolean
  bind?: () => Promise<boolean>
  onSync?: () => void
  onMeta?: () => void
} = {}) {
  return createQuizLeadPostHandler({
    checkRateLimit: async () => ({ allowed: true }),
    checkEmailDeliverability: (async () => ({
      ok: true,
      normalized: requestBody.email,
      outcome: "mx",
    })) as never,
    recordEmailDeliverabilityOutcome: () => {},
    cookies: (async () => ({
      get: (name: string) =>
        name === REGULAR_QUIZ_FIELD_TEST_CAMPAIGN_COOKIE && campaignCookie
          ? { value: campaignCookie }
          : undefined,
    })) as never,
    createAdminClient: (() => existingLeadClient()) as never,
    isRegularQuizFieldTestEnabled: () => enabled,
    resolveFunnelCookieContext: async () => (campaignCookie ? funnelContext : null),
    resolvePendingFunnelTouchValue: async () => null,
    recordFunnelEvent: async () => undefined,
    bindRegularQuizFieldTestLead: bind as never,
    syncQuizLeadToCustomerIo: (async () => {
      onSync()
      return {}
    }) as never,
    enqueueMetaLead: () => {
      onMeta()
      return true
    },
    scheduleAfter: ((callback: unknown) => {
      if (typeof callback === "function") void callback()
    }) as never,
  })
}

test("regular field-test lead attaches and suppresses commercial side effects", async () => {
  let syncs = 0
  let metas = 0
  const response = await handler({
    campaignCookie: "valid-signed-campaign-cookie",
    onSync: () => syncs++,
    onMeta: () => metas++,
  })(request())

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { leadId, fieldTestAttached: true })
  assert.equal(syncs, 0)
  assert.equal(metas, 0)
})

test("field-test cookie fails closed without persistence or commercial side effects when disabled", async () => {
  let adminCreated = false
  let syncs = 0
  let metas = 0
  const fieldTestHandler = createQuizLeadPostHandler({
    checkRateLimit: async () => ({ allowed: true }),
    checkEmailDeliverability: (async () => ({
      ok: true,
      normalized: requestBody.email,
      outcome: "mx",
    })) as never,
    recordEmailDeliverabilityOutcome: () => {},
    cookies: (async () => ({
      get: (name: string) =>
        name === REGULAR_QUIZ_FIELD_TEST_CAMPAIGN_COOKIE
          ? { value: "valid-signed-campaign-cookie" }
          : undefined,
    })) as never,
    createAdminClient: (() => {
      adminCreated = true
      throw new Error("field-test must stop before persistence")
    }) as never,
    isRegularQuizFieldTestEnabled: () => false,
    syncQuizLeadToCustomerIo: (async () => {
      syncs++
      return {}
    }) as never,
    enqueueMetaLead: () => {
      metas++
      return true
    },
  })

  const response = await fieldTestHandler(request())
  assert.equal(response.status, 503)
  assert.deepEqual(await response.json(), { error: "Testzugang ist nicht verfügbar" })
  assert.equal(adminCreated, false)
  assert.equal(syncs, 0)
  assert.equal(metas, 0)
})

test("regular field-test bind failure stays off the commercial path", async () => {
  let syncs = 0
  let metas = 0
  const response = await handler({
    campaignCookie: "valid-signed-campaign-cookie",
    bind: async () => false,
    onSync: () => syncs++,
    onMeta: () => metas++,
  })(request())

  assert.equal(response.status, 503)
  assert.deepEqual(await response.json(), { error: "Testzugang ist nicht verfügbar" })
  assert.equal(syncs, 0)
  assert.equal(metas, 0)
})

test("ordinary legacy lead retains commercial synchronization", async () => {
  let syncs = 0
  let metas = 0
  const response = await handler({
    onSync: () => syncs++,
    onMeta: () => metas++,
  })(request())

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { leadId })
  assert.equal(syncs, 1)
  assert.equal(metas, 1)
})
