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

function existingLeadClient(
  leads: Array<{
    id: string
    quiz_answers: typeof requestBody.quizAnswers
    marketing_consent: boolean
    status: string
    moderator_campaign_id?: string | null
  }> = [
    {
      id: leadId,
      quiz_answers: requestBody.quizAnswers,
      marketing_consent: false,
      status: "captured",
    },
  ],
) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            gte: () => ({
              order: () => ({
                limit: async () => ({
                  data: leads,
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
  recentLeads,
}: {
  campaignCookie?: string
  enabled?: boolean
  bind?: () => Promise<boolean>
  onSync?: () => void
  onMeta?: () => void
  recentLeads?: Parameters<typeof existingLeadClient>[0]
} = {}) {
  return createQuizLeadPostHandler({
    resolveModeratorJourney: async () => ({ kind: "ordinary" }),
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
    createAdminClient: (() => existingLeadClient(recentLeads)) as never,
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

test("ordinary lead reuse excludes a moderator-owned lead with the same email and answers", async () => {
  const ordinaryLeadId = "10000000-0000-4000-8000-000000000009"
  const response = await handler({
    recentLeads: [
      {
        id: leadId,
        quiz_answers: requestBody.quizAnswers,
        marketing_consent: false,
        status: "captured",
        moderator_campaign_id: "40000000-0000-4000-8000-000000000004",
      },
      {
        id: ordinaryLeadId,
        quiz_answers: requestBody.quizAnswers,
        marketing_consent: false,
        status: "captured",
      },
    ],
  })(request())

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { leadId: ordinaryLeadId })
})

test("organic moderator saves a private owned lead without guest binding, dedupe or commercial dispatch", async () => {
  const calls: unknown[] = []
  const forbidden = () => {
    throw Error("moderator must not use commercial or guest persistence")
  }
  const moderator = {
    kind: "authorized" as const,
    campaignId: "40000000-0000-4000-8000-000000000004",
    userId: "50000000-0000-4000-8000-000000000005",
    email: requestBody.email,
    funnelSessionId: funnelContext.sessionId,
  }
  const post = createQuizLeadPostHandler({
    checkRateLimit: async () => ({ allowed: true }),
    cookies: (async () => ({ get: () => undefined })) as never,
    resolveFunnelCookieContext: async () => funnelContext,
    resolveModeratorJourney: async () => moderator,
    saveModeratorOrganicLead: async (input) => {
      calls.push(input)
      return { leadId, reused: false }
    },
    createAdminClient: forbidden,
    checkEmailDeliverability: forbidden,
    syncQuizLeadToCustomerIo: forbidden,
    enqueueMetaLead: forbidden,
    bindRegularQuizFieldTestLead: forbidden,
    scheduleAfter: forbidden,
  })
  const response = await post(request())
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { leadId, fieldTestAttached: true })
  assert.equal(calls.length, 1)
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0])), {
    campaignId: moderator.campaignId,
    userId: moderator.userId,
    confirmedEmail: moderator.email,
    funnelSessionId: funnelContext.sessionId,
    name: requestBody.name,
    marketingConsent: false,
    quizAnswers: requestBody.quizAnswers,
  })
})

test("organic moderator rejects a quiz email that differs from the invited account before persistence", async () => {
  const post = createQuizLeadPostHandler({
    checkRateLimit: async () => ({ allowed: true }),
    cookies: (async () => ({ get: () => undefined })) as never,
    resolveFunnelCookieContext: async () => funnelContext,
    resolveModeratorJourney: async () => ({
      kind: "authorized" as const,
      campaignId: "40000000-0000-4000-8000-000000000004",
      userId: "50000000-0000-4000-8000-000000000005",
      email: requestBody.email,
      funnelSessionId: funnelContext.sessionId,
    }),
    saveModeratorOrganicLead: () => {
      throw Error("must not persist a different email")
    },
    checkEmailDeliverability: () => {
      throw Error("must not enter public flow")
    },
  })
  const response = await post(
    new Request("https://chaarlie.de/api/quiz/lead", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...requestBody, email: "different@example.com" }),
    }),
  )
  assert.equal(response.status, 422)
  assert.deepEqual(await response.json(), {
    code: "invited_email_mismatch",
    error: "Bitte verwende die E-Mail-Adresse deines eingeladenen Kontos.",
  })
})

test("organic moderator rejects a cross-origin lead save before its private RPC", async () => {
  const post = createQuizLeadPostHandler({
    checkRateLimit: async () => ({ allowed: true }),
    cookies: (async () => ({ get: () => undefined })) as never,
    resolveFunnelCookieContext: async () => funnelContext,
    resolveModeratorJourney: async () => ({
      kind: "authorized" as const,
      campaignId: "40000000-0000-4000-8000-000000000004",
      userId: "50000000-0000-4000-8000-000000000005",
      email: requestBody.email,
      funnelSessionId: funnelContext.sessionId,
    }),
    saveModeratorOrganicLead: () => {
      throw Error("must not persist cross-origin")
    },
  })
  const response = await post(
    new Request("https://chaarlie.de/api/quiz/lead", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://attacker.invalid" },
      body: JSON.stringify(requestBody),
    }),
  )
  assert.equal(response.status, 403)
  assert.deepEqual(await response.json(), { error: "Ungültige Anfrage" })
})

test("organic moderator private lead-save failures fail closed without commercial dispatch", async () => {
  const forbidden = () => {
    throw Error("must not enter commercial flow")
  }
  const post = createQuizLeadPostHandler({
    checkRateLimit: async () => ({ allowed: true }),
    cookies: (async () => ({ get: () => undefined })) as never,
    resolveFunnelCookieContext: async () => funnelContext,
    resolveModeratorJourney: async () => ({
      kind: "authorized" as const,
      campaignId: "40000000-0000-4000-8000-000000000004",
      userId: "50000000-0000-4000-8000-000000000005",
      email: requestBody.email,
      funnelSessionId: funnelContext.sessionId,
    }),
    saveModeratorOrganicLead: async () => {
      throw Error("rpc unavailable")
    },
    checkEmailDeliverability: forbidden,
    createAdminClient: forbidden,
    syncQuizLeadToCustomerIo: forbidden,
    enqueueMetaLead: forbidden,
  })
  const response = await post(request())
  assert.equal(response.status, 503)
  assert.deepEqual(await response.json(), { error: "Testzugang ist nicht verfügbar" })
})

test("invalid moderator ownership fails closed before deliverability and persistence", async () => {
  const post = createQuizLeadPostHandler({
    checkRateLimit: async () => ({ allowed: true }),
    cookies: (async () => ({ get: () => undefined })) as never,
    resolveFunnelCookieContext: async () => funnelContext,
    resolveModeratorJourney: async () => ({ kind: "unavailable" }),
    checkEmailDeliverability: () => {
      throw Error("must stop before public lead flow")
    },
  })
  assert.equal((await post(request())).status, 503)
})
