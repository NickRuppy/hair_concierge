import assert from "node:assert/strict"
import test from "node:test"

import { createQuizLeadPostHandler } from "../src/app/api/quiz/lead/route"
import { defaultGetUser, resolvePartnerJourney } from "../src/lib/partner-access/journey"
import {
  MIGRATION_QUIZ_CONTEXT_COOKIE,
  createMigrationQuizContextCookie,
} from "../src/lib/personal-plan/migration-quiz-context"
import { REGULAR_QUIZ_FIELD_TEST_CAMPAIGN_COOKIE } from "../src/lib/personal-plan-field-test"
import { MODERATOR_INTENT_COOKIE } from "../src/lib/personal-plan-field-test/moderator-contract"
import {
  QUIZ_EMAIL_RETURN_COOKIE,
  QUIZ_EMAIL_RETURN_EDIT_COOKIE,
} from "../src/lib/quiz/email-return-constants"

const leadId = "10000000-0000-4000-8000-000000000001"
const migrationUserId = "50000000-0000-4000-8000-000000000005"
const migrationEnrollmentId = "60000000-0000-4000-8000-000000000006"
const migrationCookieSecret = "migration-quiz-context-secret-32-plus"
const migrationNow = Date.UTC(2026, 7, 28, 12, 0, 0)
const funnelContext = {
  visitorId: "20000000-0000-4000-8000-000000000002",
  sessionId: "30000000-0000-4000-8000-000000000003",
  packageKey: "default_organic",
  issuedAt: Date.now(),
}

/**
 * The real partner resolver, driven through its real `defaultGetUser` with an
 * injected session-less Supabase client — exactly what `@supabase/ssr` answers
 * for an anonymous request (`user: null` plus an `AuthSessionMissingError`).
 * Stubbing `resolvePartnerJourney` away here would hide a signed-out resolver
 * regression from every ordinary-lead test: a resolver that reports
 * `unavailable` for anonymous visitors turns each of them into a 503.
 */
function anonymousPartnerJourney() {
  return resolvePartnerJourney({
    getUser: () =>
      defaultGetUser({
        auth: {
          async getUser() {
            return {
              data: { user: null },
              error: Object.assign(new Error("Auth session missing!"), {
                name: "AuthSessionMissingError",
              }),
            }
          },
        },
      } as unknown as Parameters<typeof defaultGetUser>[0]),
    loadInvitation: async () => {
      throw new Error("an anonymous lead must never read partner invitations")
    },
  })
}

function migrationCookie(userId = migrationUserId, enrollmentId = migrationEnrollmentId) {
  const value = createMigrationQuizContextCookie(
    { userId, enrollmentId },
    migrationCookieSecret,
    migrationNow,
  )
  assert.ok(value)
  return value
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

function request(
  headers: Record<string, string> = {},
  bodyOverrides: Record<string, unknown> = {},
) {
  return new Request("https://chaarlie.de/api/quiz/lead", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.14", ...headers },
    body: JSON.stringify({ ...requestBody, ...bodyOverrides }),
  })
}

function migrationRecoveryRequest(headers: Record<string, string> = {}) {
  return request(headers, { migrationRecovery: true })
}

function existingLeadClient(
  leads: Array<{
    id: string
    quiz_answers: typeof requestBody.quizAnswers
    marketing_consent: boolean
    status: string
    moderator_campaign_id?: string | null
    partner_access_invitation_id?: string | null
  }> = [
    {
      id: leadId,
      quiz_answers: requestBody.quizAnswers,
      marketing_consent: false,
      status: "captured",
    },
  ],
  insertedLeadId = leadId,
  onInsert: (row: unknown) => void = () => {},
) {
  const recent = {
    gte: () => ({
      order: () => ({
        limit: async () => ({
          data: leads,
          error: null,
        }),
      }),
    }),
  }
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          // `is` is the partner-lead exclusion: an ordinary dedupe candidate must
          // carry no `partner_access_invitation_id`.
          eq: () => ({ is: () => recent }),
        }),
      }),
      insert: (row: unknown) => ({
        select: () => ({
          single: async () => {
            onInsert(row)
            return { data: { id: insertedLeadId }, error: null }
          },
        }),
      }),
      update: () => ({ eq: async () => ({ error: null }) }),
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
  insertedLeadId,
  onInsert,
  returnPackage = false,
  returnIdentity,
}: {
  campaignCookie?: string
  enabled?: boolean
  bind?: () => Promise<boolean>
  onSync?: (input: unknown) => void
  onMeta?: () => void
  recentLeads?: Parameters<typeof existingLeadClient>[0]
  insertedLeadId?: string
  onInsert?: (row: unknown) => void
  returnPackage?: boolean
  returnIdentity?: {
    leadId: string
    name: string
    email: string
    marketingConsent: boolean
    consentTimestamp: string
  }
} = {}) {
  return createQuizLeadPostHandler({
    resolveModeratorJourney: async () => ({ kind: "ordinary" }),
    resolvePartnerJourney: anonymousPartnerJourney,
    checkRateLimit: async () => ({ allowed: true }),
    checkEmailDeliverability: (async () => ({
      ok: true,
      normalized: requestBody.email,
      outcome: "mx",
    })) as never,
    recordEmailDeliverabilityOutcome: () => {},
    cookies: (async () => ({
      get: (name: string) => {
        if (name === REGULAR_QUIZ_FIELD_TEST_CAMPAIGN_COOKIE && campaignCookie) {
          return { value: campaignCookie }
        }
        if (
          returnPackage &&
          (name === QUIZ_EMAIL_RETURN_COOKIE || name === QUIZ_EMAIL_RETURN_EDIT_COOKIE)
        ) {
          return { value: "signed-return-cookie" }
        }
        return undefined
      },
    })) as never,
    createAdminClient: (() => existingLeadClient(recentLeads, insertedLeadId, onInsert)) as never,
    isRegularQuizFieldTestEnabled: () => enabled,
    resolveFunnelCookieContext: async () =>
      returnPackage
        ? { ...funnelContext, packageKey: "customerio_scan_return_v1" }
        : campaignCookie
          ? funnelContext
          : null,
    resolvePendingFunnelTouchValue: async () => null,
    recordFunnelEvent: async () => undefined,
    bindRegularQuizFieldTestLead: bind as never,
    resolveQuizEmailReturnSourceIdentity: async () =>
      returnIdentity
        ? { status: "resolved" as const, identity: returnIdentity }
        : { status: "invalid" as const },
    syncQuizLeadToCustomerIo: (async (input: unknown) => {
      onSync(input)
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
    resolvePartnerJourney: async () => ({ kind: "none" }),
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

test("partner lead capture persists the server-authorized creator name instead of client input", async () => {
  const calls: unknown[] = []
  const forbidden = () => {
    throw Error("partner must not use commercial persistence")
  }
  const partner = {
    kind: "authorized" as const,
    invitationId: "40000000-0000-4000-8000-000000000004",
    userId: "50000000-0000-4000-8000-000000000005",
    name: "Lea Sommer",
    email: requestBody.email,
    funnelSessionId: funnelContext.sessionId,
  }
  const post = createQuizLeadPostHandler({
    checkRateLimit: async () => ({ allowed: true }),
    cookies: (async () => ({ get: () => undefined })) as never,
    resolveFunnelCookieContext: async () => funnelContext,
    resolveModeratorJourney: async () => ({ kind: "ordinary" }),
    resolvePartnerJourney: async () => partner,
    savePartnerAccessLead: async (input) => {
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
  const response = await post(request({}, { name: "Changed in the browser" }))

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { leadId })
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0])), {
    invitationId: partner.invitationId,
    userId: partner.userId,
    funnelSessionId: partner.funnelSessionId,
    email: partner.email,
    name: partner.name,
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

test("migration recovery intent without a signed cookie returns to recovery instead of ordinary persistence", async () => {
  let deliverabilityChecked = false
  let adminCreated = false
  const post = createQuizLeadPostHandler({
    checkRateLimit: async () => ({ allowed: true }),
    cookies: (async () => ({ get: () => undefined })) as never,
    createAdminClient: (() => {
      adminCreated = true
      return existingLeadClient()
    }) as never,
    checkEmailDeliverability: (async () => {
      deliverabilityChecked = true
      throw Error("cookie-less migration recovery must not enter ordinary flow")
    }) as never,
  })

  const response = await post(migrationRecoveryRequest())

  assert.equal(response.status, 403)
  assert.deepEqual(await response.json(), {
    error: "Migration nicht verfügbar",
    nextHref: "/plan-bereit",
  })
  assert.equal(deliverabilityChecked, false)
  assert.equal(adminCreated, false)
})

test("ordinary lead capture ignores leftover migration cookies unless recovery intent is explicit", async () => {
  for (const cookieValue of [migrationCookie(), "not-a-valid-context"]) {
    let migrationRpcCalled = false
    const post = createQuizLeadPostHandler({
      resolveModeratorJourney: async () => ({ kind: "ordinary" }),
      resolvePartnerJourney: async () => ({ kind: "none" }),
      checkRateLimit: async () => ({ allowed: true }),
      checkEmailDeliverability: (async () => ({
        ok: true,
        normalized: requestBody.email,
        outcome: "mx",
      })) as never,
      recordEmailDeliverabilityOutcome: () => {},
      cookies: (async () => ({
        get: (name: string) =>
          name === MIGRATION_QUIZ_CONTEXT_COOKIE ? { value: cookieValue } : undefined,
      })) as never,
      createAdminClient: (() => ({
        ...existingLeadClient(),
        rpc: async () => {
          migrationRpcCalled = true
          throw Error("ordinary flow must not call migration RPC")
        },
      })) as never,
      syncQuizLeadToCustomerIo: (async () => ({})) as never,
      enqueueMetaLead: () => false,
      scheduleAfter: ((callback: unknown) => {
        if (typeof callback === "function") void callback()
      }) as never,
    })

    const response = await post(request())

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { leadId })
    assert.equal(migrationRpcCalled, false)
  }
})

test("migration quiz completion uses authenticated server context and skips public lead side effects", async () => {
  const calls: Array<[string, Record<string, unknown>]> = []
  let forbiddenCalls = 0
  const forbidden = () => {
    forbiddenCalls += 1
    throw Error("migration quiz must not enter public lead side effects")
  }
  const post = createQuizLeadPostHandler({
    checkRateLimit: async () => ({ allowed: true }),
    cookies: (async () => ({
      get: (name: string) =>
        name === MIGRATION_QUIZ_CONTEXT_COOKIE ? { value: migrationCookie() } : undefined,
    })) as never,
    createSessionClient: (async () => ({
      auth: { getUser: async () => ({ data: { user: { id: migrationUserId } }, error: null }) },
    })) as never,
    createAdminClient: (() => ({
      rpc: async (name: string, args: Record<string, unknown>) => {
        calls.push([name, args])
        return {
          data: {
            status: "saved",
            lead_id: leadId,
          },
          error: null,
        }
      },
    })) as never,
    migrationQuizCookieSecret: () => migrationCookieSecret,
    migrationQuizEnabled: () => true,
    now: () => migrationNow,
    checkEmailDeliverability: forbidden,
    resolveModeratorJourney: forbidden as never,
    resolveFunnelCookieContext: forbidden as never,
    resolvePendingFunnelTouchValue: forbidden as never,
    recordFunnelEvent: forbidden as never,
    syncQuizLeadToCustomerIo: forbidden as never,
    enqueueMetaLead: forbidden,
    scheduleAfter: forbidden as never,
  })

  const response = await post(migrationRecoveryRequest())
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { leadId, nextHref: "/plan-bereit" })
  assert.match(response.headers.get("set-cookie") ?? "", /chaarlie_personal_plan_migration_quiz=/)
  assert.match(response.headers.get("set-cookie") ?? "", /Max-Age=0/)
  assert.deepEqual(calls, [
    [
      "personal_plan_save_migration_quiz_lead",
      {
        p_user_id: migrationUserId,
        p_enrollment_id: migrationEnrollmentId,
        p_name: requestBody.name,
        p_email: requestBody.email,
        p_marketing_consent: false,
        p_quiz_answers: requestBody.quizAnswers,
      },
    ],
  ])
  assert.equal(forbiddenCalls, 0)
})

test("migration quiz completion rejects cross-origin requests before its private RPC", async () => {
  let saveCalled = false
  const post = createQuizLeadPostHandler({
    checkRateLimit: async () => ({ allowed: true }),
    cookies: (async () => ({
      get: (name: string) =>
        name === MIGRATION_QUIZ_CONTEXT_COOKIE ? { value: migrationCookie() } : undefined,
    })) as never,
    createSessionClient: (async () => ({
      auth: { getUser: async () => ({ data: { user: { id: migrationUserId } }, error: null }) },
    })) as never,
    createAdminClient: (() => ({
      rpc: async () => {
        saveCalled = true
        throw Error("cross-origin migration request must not mutate")
      },
    })) as never,
    migrationQuizCookieSecret: () => migrationCookieSecret,
    migrationQuizEnabled: () => true,
    now: () => migrationNow,
  })

  const response = await post(migrationRecoveryRequest({ origin: "https://attacker.invalid" }))

  assert.equal(response.status, 403)
  assert.deepEqual(await response.json(), { error: "Ungültige Anfrage" })
  assert.equal(saveCalled, false)
})

test("migration quiz completion fails closed before binding while the migration release flag is off", async () => {
  let saveCalled = false
  const post = createQuizLeadPostHandler({
    checkRateLimit: async () => ({ allowed: true }),
    cookies: (async () => ({
      get: (name: string) =>
        name === MIGRATION_QUIZ_CONTEXT_COOKIE ? { value: migrationCookie() } : undefined,
    })) as never,
    createSessionClient: (async () => ({
      auth: { getUser: async () => ({ data: { user: { id: migrationUserId } }, error: null }) },
    })) as never,
    createAdminClient: (() => ({
      rpc: async () => {
        saveCalled = true
        throw Error("flag-off migration request must not mutate")
      },
    })) as never,
    migrationQuizCookieSecret: () => migrationCookieSecret,
    migrationQuizEnabled: () => false,
    now: () => migrationNow,
  })

  const response = await post(migrationRecoveryRequest())

  assert.equal(response.status, 403)
  assert.deepEqual(await response.json(), {
    error: "Migration nicht verfügbar",
    nextHref: "/plan-bereit",
  })
  assert.match(response.headers.get("set-cookie") ?? "", /Max-Age=0/)
  assert.equal(saveCalled, false)
})

test("migration quiz completion sends unauthenticated users back to recovery before admin persistence", async () => {
  let adminCreated = false
  const post = createQuizLeadPostHandler({
    checkRateLimit: async () => ({ allowed: true }),
    cookies: (async () => ({
      get: (name: string) =>
        name === MIGRATION_QUIZ_CONTEXT_COOKIE ? { value: migrationCookie() } : undefined,
    })) as never,
    createSessionClient: (async () => ({
      auth: { getUser: async () => ({ data: { user: null }, error: null }) },
    })) as never,
    createAdminClient: (() => {
      adminCreated = true
      throw Error("must stop before admin persistence")
    }) as never,
    migrationQuizCookieSecret: () => migrationCookieSecret,
    now: () => migrationNow,
  })

  const response = await post(migrationRecoveryRequest())
  assert.equal(response.status, 403)
  assert.deepEqual(await response.json(), {
    error: "Migration nicht verfügbar",
    nextHref: "/plan-bereit",
  })
  assert.match(response.headers.get("set-cookie") ?? "", /Max-Age=0/)
  assert.equal(adminCreated, false)
})

test("migration quiz completion rejects invalid or mismatched context before public lead flow", async () => {
  let deliverabilityChecked = false
  const post = createQuizLeadPostHandler({
    checkRateLimit: async () => ({ allowed: true }),
    cookies: (async () => ({
      get: (name: string) =>
        name === MIGRATION_QUIZ_CONTEXT_COOKIE
          ? { value: migrationCookie("50000000-0000-4000-8000-000000000099") }
          : undefined,
    })) as never,
    createSessionClient: (async () => ({
      auth: { getUser: async () => ({ data: { user: { id: migrationUserId } }, error: null }) },
    })) as never,
    migrationQuizCookieSecret: () => migrationCookieSecret,
    migrationQuizEnabled: () => true,
    now: () => migrationNow,
    checkEmailDeliverability: async () => {
      deliverabilityChecked = true
      throw Error("must stop before public lead flow")
    },
  })

  const response = await post(migrationRecoveryRequest())
  assert.equal(response.status, 403)
  assert.deepEqual(await response.json(), {
    error: "Migration nicht verfügbar",
    nextHref: "/plan-bereit",
  })
  assert.match(response.headers.get("set-cookie") ?? "", /Max-Age=0/)
  assert.equal(deliverabilityChecked, false)
})

test("migration quiz completion sends expired contexts back to recovery instead of the ordinary quiz path", async () => {
  const expiredCookie = createMigrationQuizContextCookie(
    { userId: migrationUserId, enrollmentId: migrationEnrollmentId },
    migrationCookieSecret,
    migrationNow - 3 * 60 * 60 * 1000,
  )
  assert.ok(expiredCookie)
  let deliverabilityChecked = false
  const post = createQuizLeadPostHandler({
    checkRateLimit: async () => ({ allowed: true }),
    cookies: (async () => ({
      get: (name: string) =>
        name === MIGRATION_QUIZ_CONTEXT_COOKIE ? { value: expiredCookie } : undefined,
    })) as never,
    createSessionClient: (async () => ({
      auth: { getUser: async () => ({ data: { user: { id: migrationUserId } }, error: null }) },
    })) as never,
    migrationQuizCookieSecret: () => migrationCookieSecret,
    migrationQuizEnabled: () => true,
    now: () => migrationNow,
    checkEmailDeliverability: async () => {
      deliverabilityChecked = true
      throw Error("expired migration context must not enter public lead flow")
    },
  })

  const response = await post(migrationRecoveryRequest())

  assert.equal(response.status, 403)
  assert.deepEqual(await response.json(), {
    error: "Migration nicht verfügbar",
    nextHref: "/plan-bereit",
  })
  assert.match(response.headers.get("set-cookie") ?? "", /Max-Age=0/)
  assert.equal(deliverabilityChecked, false)
})

test("migration quiz replay rejection does not fall back to email dedupe", async () => {
  let queriedLeads = false
  const post = createQuizLeadPostHandler({
    checkRateLimit: async () => ({ allowed: true }),
    cookies: (async () => ({
      get: (name: string) =>
        name === MIGRATION_QUIZ_CONTEXT_COOKIE ? { value: migrationCookie() } : undefined,
    })) as never,
    createSessionClient: (async () => ({
      auth: { getUser: async () => ({ data: { user: { id: migrationUserId } }, error: null }) },
    })) as never,
    createAdminClient: (() => ({
      rpc: async () => ({ data: { status: "invalid_context" }, error: null }),
      from: () => {
        queriedLeads = true
        throw Error("migration replay must not query public lead dedupe")
      },
    })) as never,
    migrationQuizCookieSecret: () => migrationCookieSecret,
    migrationQuizEnabled: () => true,
    now: () => migrationNow,
  })

  const response = await post(migrationRecoveryRequest())
  assert.equal(response.status, 403)
  assert.deepEqual(await response.json(), {
    error: "Migration nicht verfügbar",
    nextHref: "/plan-bereit",
  })
  assert.match(response.headers.get("set-cookie") ?? "", /Max-Age=0/)
  assert.equal(queriedLeads, false)
})

test("plain migration query parameters carry no authority without the signed cookie", async () => {
  let migrationRpcCalled = false
  const post = createQuizLeadPostHandler({
    resolveModeratorJourney: async () => ({ kind: "ordinary" }),
    resolvePartnerJourney: async () => ({ kind: "none" }),
    checkRateLimit: async () => ({ allowed: true }),
    checkEmailDeliverability: (async () => ({
      ok: true,
      normalized: requestBody.email,
      outcome: "mx",
    })) as never,
    recordEmailDeliverabilityOutcome: () => {},
    cookies: (async () => ({ get: () => undefined })) as never,
    createAdminClient: (() => ({
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              is: () => ({
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
      }),
      rpc: async () => {
        migrationRpcCalled = true
        throw Error("plain query must not call migration rpc")
      },
    })) as never,
    syncQuizLeadToCustomerIo: (async () => ({})) as never,
    enqueueMetaLead: () => false,
    scheduleAfter: ((callback: unknown) => {
      if (typeof callback === "function") void callback()
    }) as never,
  })

  const response = await post(
    new Request(
      `https://chaarlie.de/api/quiz/lead?migrationEnrollmentId=${migrationEnrollmentId}`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.14" },
        body: JSON.stringify(requestBody),
      },
    ),
  )
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { leadId })
  assert.equal(migrationRpcCalled, false)
})

test("a leftover moderator intent cookie never blocks an authorized partner lead", async () => {
  const calls: unknown[] = []
  let moderatorConsulted = false
  const forbidden = () => {
    throw Error("partner must not use commercial persistence")
  }
  const partner = {
    kind: "authorized" as const,
    invitationId: "40000000-0000-4000-8000-000000000004",
    userId: "50000000-0000-4000-8000-000000000005",
    name: "Lea Sommer",
    email: requestBody.email,
    funnelSessionId: funnelContext.sessionId,
  }
  const post = createQuizLeadPostHandler({
    checkRateLimit: async () => ({ allowed: true }),
    cookies: (async () => ({
      get: (name: string) =>
        name === MODERATOR_INTENT_COOKIE ? { value: "leftover-moderator-intent" } : undefined,
    })) as never,
    resolveFunnelCookieContext: async () => funnelContext,
    // A former moderator keeps the intent cookie forever; their campaign is long
    // gone, so the moderator resolver fails closed with `unavailable` (503).
    resolveModeratorJourney: async () => {
      moderatorConsulted = true
      return { kind: "unavailable" as const }
    },
    resolvePartnerJourney: async () => partner,
    savePartnerAccessLead: async (input) => {
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
  assert.deepEqual(await response.json(), { leadId })
  assert.equal(calls.length, 1)
  assert.equal(moderatorConsulted, false)
})

test("ordinary lead reuse excludes a partner-owned lead with the same email and answers", async () => {
  const inserted: unknown[] = []
  const freshLeadId = "10000000-0000-4000-8000-000000000012"
  const response = await handler({
    insertedLeadId: freshLeadId,
    onInsert: (row) => inserted.push(row),
    recentLeads: [
      {
        id: leadId,
        quiz_answers: requestBody.quizAnswers,
        marketing_consent: false,
        status: "captured",
        partner_access_invitation_id: "40000000-0000-4000-8000-000000000004",
      },
    ],
  })(request())

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { leadId: freshLeadId })
  assert.equal(inserted.length, 1)
})

test("email-return Edit saves a fresh completion even when the same answers were saved recently", async () => {
  const inserted: unknown[] = []
  const freshLeadId = "10000000-0000-4000-8000-000000000019"
  const response = await handler({
    returnPackage: true,
    insertedLeadId: freshLeadId,
    onInsert: (row) => inserted.push(row),
  })(request())

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { leadId: freshLeadId })
  assert.equal(inserted.length, 1)
})

test("email-return Edit preserves verified consent provenance for the same email", async () => {
  const syncInputs: Record<string, unknown>[] = []
  const response = await handler({
    returnPackage: true,
    returnIdentity: {
      leadId,
      name: "Feldtest Person",
      email: requestBody.email,
      marketingConsent: true,
      consentTimestamp: "2026-05-28T10:00:00.000Z",
    },
    onSync: (input) => {
      syncInputs.push(input as Record<string, unknown>)
    },
  })(request({}, { marketingConsent: true, marketingConsentSource: "inherited" }))

  assert.equal(response.status, 200)
  assert.equal(syncInputs[0]?.consentTimestamp, "2026-05-28T10:00:00.000Z")
})

test("email-return Edit rejects inherited consent when the source identity cannot validate it", async () => {
  const post = createQuizLeadPostHandler({
    resolveModeratorJourney: async () => ({ kind: "ordinary" }),
    resolvePartnerJourney: anonymousPartnerJourney,
    checkRateLimit: async () => ({ allowed: true }),
    cookies: (async () => ({ get: () => ({ value: "signed-return-cookie" }) })) as never,
    resolveFunnelCookieContext: async () => ({
      ...funnelContext,
      packageKey: "customerio_scan_return_v1",
    }),
    resolveQuizEmailReturnSourceIdentity: async () => ({ status: "invalid" as const }),
    createAdminClient: (() => {
      throw new Error("invalid inherited consent must stop before persistence")
    }) as never,
  } as never)

  const response = await post(
    request({}, { marketingConsent: true, marketingConsentSource: "inherited" }),
  )

  assert.equal(response.status, 422)
  assert.deepEqual(await response.json(), {
    code: "return_consent_unavailable",
    error: "Bitte bestätige deine Einwilligung erneut.",
  })
})

test("email-return Edit never inherits consent onto a different email", async () => {
  const post = createQuizLeadPostHandler({
    resolveModeratorJourney: async () => ({ kind: "ordinary" }),
    resolvePartnerJourney: anonymousPartnerJourney,
    checkRateLimit: async () => ({ allowed: true }),
    cookies: (async () => ({ get: () => ({ value: "signed-return-cookie" }) })) as never,
    resolveFunnelCookieContext: async () => ({
      ...funnelContext,
      packageKey: "customerio_scan_return_v1",
    }),
    resolveQuizEmailReturnSourceIdentity: async () => ({
      status: "resolved" as const,
      identity: {
        leadId,
        name: requestBody.name,
        email: "original@example.com",
        marketingConsent: true,
        consentTimestamp: "2026-05-28T10:00:00.000Z",
      },
    }),
    createAdminClient: (() => {
      throw new Error("email mismatch must stop before persistence")
    }) as never,
  } as never)

  const response = await post(
    request({}, { marketingConsent: true, marketingConsentSource: "inherited" }),
  )

  assert.equal(response.status, 422)
  assert.deepEqual(await response.json(), {
    code: "return_consent_unavailable",
    error: "Bitte bestätige deine Einwilligung erneut.",
  })
})
