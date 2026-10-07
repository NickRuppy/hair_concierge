import assert from "node:assert/strict"
import test from "node:test"

import {
  POST,
  handlePayPalSubscriptionIntent,
  resolvePayPalFunnelContext,
} from "../src/app/api/paypal/create-subscription-intent/route"

test("an incomplete trial PayPal request fails validation before intent or provider work", async () => {
  const previous = process.env.NEXT_PUBLIC_PAYPAL_ENABLED
  process.env.NEXT_PUBLIC_PAYPAL_ENABLED = "true"
  try {
    const response = await POST(
      new Request("http://localhost/api/paypal/create-subscription-intent", {
        body: JSON.stringify({
          interval: "year",
          leadId: "11111111-1111-4111-8111-111111111111",
          source: "quiz_result_offer",
          trial: true,
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    )

    assert.equal(response.status, 400)
    assert.deepEqual(await response.json(), { error: "bad request" })
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_PAYPAL_ENABLED
    else process.env.NEXT_PUBLIC_PAYPAL_ENABLED = previous
  }
})

for (const interval of ["month", "year"] as const) {
  test(`successful ${interval} trial intent returns the SDK trial contract and server-created subscription`, async () => {
    const previous = process.env.NEXT_PUBLIC_PAYPAL_ENABLED
    process.env.NEXT_PUBLIC_PAYPAL_ENABLED = "true"
    const calls: any[] = []
    const userId = "11111111-1111-4111-8111-111111111111"
    const attemptId = "22222222-2222-4222-8222-222222222222"
    const query: any = {
      select() {
        return this
      },
      eq() {
        return this
      },
      single: async () => ({ data: { metadata: { trial_cohort: "trial_v1" } }, error: null }),
      update(value: unknown) {
        calls.push({ update: value })
        return this
      },
      then(resolve: (value: unknown) => void) {
        resolve({ error: null })
      },
    }
    const deps: any = {
      createAdminClient: () => ({ from: () => query }),
      createClient: async () => ({
        auth: {
          getUser: async () => ({
            data: {
              user: {
                id: userId,
                email: "owner@example.com",
                email_confirmed_at: "2026-09-01T00:00:00Z",
              },
            },
          }),
        },
      }),
      assertCanStartCheckout: async () => {},
      assertCanStartCheckoutForEmail: async () => {},
      readTrialRuntime: () => ({
        trial: {
          enrollmentMode: "public",
          identityKeys: [{ version: 1, secret: Buffer.alloc(32, 1) }],
        },
      }),
      createTrialCheckout: async (input: unknown) => {
        calls.push({ create: input })
        return {
          token: "server-intent-token",
          subscription: { id: "I-server-created", plan_id: `P-server-${interval}` },
        }
      },
      cookies: async () => ({ get: () => undefined }),
      resolveFunnelCookieContext: async () => null,
    }
    try {
      const response = await handlePayPalSubscriptionIntent(
        new Request("http://localhost/api/paypal/create-subscription-intent", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            interval,
            source: "quiz_result_offer",
            trial: true,
            checkoutAttemptId: attemptId,
          }),
        }),
        deps,
      )
      assert.equal(response.status, 200)
      assert.deepEqual(await response.json(), {
        trial: true,
        token: "server-intent-token",
        subscriptionId: "I-server-created",
        planId: `P-server-${interval}`,
      })
      assert.equal(calls.filter((c) => c.create).length, 1)
      assert.equal(calls[0].create.interval, interval)
      assert.equal(calls[0].create.clientAttemptId, attemptId)
      assert.deepEqual(calls[0].create.scope, { kind: "user", id: userId })
      assert.equal(calls[0].create.claims.length, 2)
    } finally {
      if (previous === undefined) delete process.env.NEXT_PUBLIC_PAYPAL_ENABLED
      else process.env.NEXT_PUBLIC_PAYPAL_ENABLED = previous
    }
  })
}

test("an exact PayPal funnel session that is not bound to the lead is rejected before trial creation", async () => {
  const previous = process.env.NEXT_PUBLIC_PAYPAL_ENABLED
  process.env.NEXT_PUBLIC_PAYPAL_ENABLED = "true"
  const leadId = "11111111-1111-4111-8111-111111111111"
  const funnelSessionId = "22222222-2222-4222-8222-222222222222"
  let trialCreationCalls = 0
  let exactLookupCalls = 0
  const leadsQuery: any = {
    select() {
      return this
    },
    eq() {
      return this
    },
    maybeSingle: async () => ({ data: { email: "lead@example.com" }, error: null }),
  }
  const deps: any = {
    createAdminClient: () => ({ from: () => leadsQuery }),
    createClient: async () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }),
    assertCanStartCheckoutForEmail: async () => {},
    readTrialRuntime: () => ({
      trial: {
        enrollmentMode: "public",
        identityKeys: [{ version: 1, secret: Buffer.alloc(32, 1) }],
      },
    }),
    createTrialCheckout: async () => {
      trialCreationCalls += 1
      throw new Error("must not create a trial")
    },
    cookies: async () => ({ get: () => undefined }),
    resolveFunnelCookieContext: async () => ({
      visitorId: "returning-visitor",
      sessionId: funnelSessionId,
      packageKey: "customerio_scan_return_v1",
    }),
    resolveFunnelContextForLead: async (requestedLeadId: string, requestedSessionId?: string) => {
      exactLookupCalls += 1
      assert.equal(requestedLeadId, leadId)
      assert.equal(requestedSessionId, funnelSessionId)
      return null
    },
  }

  try {
    const response = await handlePayPalSubscriptionIntent(
      new Request("http://localhost/api/paypal/create-subscription-intent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          interval: "month",
          source: "quiz_result_offer",
          leadId,
          funnelSessionId,
          trial: true,
          checkoutAttemptId: "33333333-3333-4333-8333-333333333333",
        }),
      }),
      deps,
    )

    assert.equal(response.status, 409)
    assert.deepEqual(await response.json(), { error: "funnel_session_mismatch" })
    assert.equal(exactLookupCalls, 1)
    assert.equal(trialCreationCalls, 0)
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_PAYPAL_ENABLED
    else process.env.NEXT_PUBLIC_PAYPAL_ENABLED = previous
  }
})

test("a verified exact PayPal funnel session is frozen into the trial intent and checkout attribution", async () => {
  const previous = process.env.NEXT_PUBLIC_PAYPAL_ENABLED
  process.env.NEXT_PUBLIC_PAYPAL_ENABLED = "true"
  const leadId = "11111111-1111-4111-8111-111111111111"
  const funnelSessionId = "22222222-2222-4222-8222-222222222222"
  const calls: any[] = []
  const leadsQuery: any = {
    select() {
      return this
    },
    eq() {
      return this
    },
    maybeSingle: async () => ({ data: { email: "lead@example.com" }, error: null }),
  }
  const intentQuery: any = {
    select() {
      return this
    },
    eq() {
      return this
    },
    single: async () => ({ data: { metadata: { trial_cohort: "trial_v1" } }, error: null }),
    update(value: unknown) {
      calls.push({ intentUpdate: value })
      return this
    },
    then(resolve: (value: unknown) => void) {
      resolve({ error: null })
    },
  }
  let cookieContextCalls = 0
  const exactContext = {
    visitorId: "returning-visitor",
    sessionId: funnelSessionId,
    packageKey: "customerio_scan_return_v1",
    offerVariant: "scan-regal-v1",
    offerViewedAt: null,
    checkoutStartedAt: null,
    isInternalTest: false,
    testKind: null,
    fieldTestCampaignId: null,
    issuedAt: 0,
  }
  const deps: any = {
    createAdminClient: () => ({
      from: (table: string) => (table === "leads" ? leadsQuery : intentQuery),
    }),
    createClient: async () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }),
    assertCanStartCheckoutForEmail: async () => {},
    readTrialRuntime: () => ({
      trial: {
        enrollmentMode: "public",
        identityKeys: [{ version: 1, secret: Buffer.alloc(32, 1) }],
      },
    }),
    createTrialCheckout: async (input: unknown) => {
      calls.push({ trialInput: input })
      return {
        token: "server-intent-token",
        subscription: { id: "I-server-created", plan_id: "P-server-month" },
      }
    },
    cookies: async () => ({ get: () => undefined }),
    resolveFunnelCookieContext: async () => {
      cookieContextCalls += 1
      return exactContext
    },
    resolveFunnelContextForLead: async (requestedLeadId: string, requestedSessionId?: string) => {
      assert.equal(requestedLeadId, leadId)
      assert.equal(requestedSessionId, funnelSessionId)
      return exactContext
    },
    recordFunnelEvent: async (input: unknown) => calls.push({ funnelEvent: input }),
  }

  try {
    const response = await handlePayPalSubscriptionIntent(
      new Request("http://localhost/api/paypal/create-subscription-intent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          interval: "month",
          source: "quiz_result_offer",
          leadId,
          funnelSessionId,
          trial: true,
          checkoutAttemptId: "33333333-3333-4333-8333-333333333333",
          funnelEventId: "44444444-4444-4444-8444-444444444444",
        }),
      }),
      deps,
    )

    assert.equal(response.status, 200)
    assert.equal(cookieContextCalls, 1)
    assert.equal(calls[0].trialInput.analyticsContext.funnelSessionId, funnelSessionId)
    assert.deepEqual(calls[1].intentUpdate.metadata, {
      trial_cohort: "trial_v1",
      funnel_session_id: funnelSessionId,
      funnel_package_key: "customerio_scan_return_v1",
    })
    assert.equal(calls[2].funnelEvent.context.sessionId, funnelSessionId)
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_PAYPAL_ENABLED
    else process.env.NEXT_PUBLIC_PAYPAL_ENABLED = previous
  }
})

test("an ordinary trial retains its signed-cookie attribution if optional lead attachment failed", async () => {
  const cookieContext = {
    visitorId: "ordinary-visitor",
    sessionId: "ordinary-session",
    packageKey: "default_organic",
  }
  let exactLookups = 0
  const resolved = await resolvePayPalFunnelContext({
    cookieStore: { get: () => undefined } as never,
    funnelSessionId: "unattached-offer-session",
    leadId: "ordinary-lead",
    resolveCookieContext: async () => cookieContext as never,
    resolveLeadContext: async () => {
      exactLookups += 1
      return null
    },
  })
  assert.deepEqual(resolved, cookieContext)
  assert.equal(exactLookups, 0)
})

test("an email-return PayPal session rejects a different signed browser visitor", async () => {
  const exact = {
    visitorId: "original-visitor",
    sessionId: "return-session",
    packageKey: "customerio_scan_return_v1",
    testKind: null,
    fieldTestCampaignId: null,
  }
  await assert.rejects(
    resolvePayPalFunnelContext({
      cookieStore: { get: () => undefined } as never,
      funnelSessionId: exact.sessionId,
      leadId: "return-lead",
      resolveCookieContext: async () => ({ ...exact, visitorId: "different-visitor" }) as never,
      resolveLeadContext: async () => exact as never,
    }),
    /funnel session mismatch/,
  )
})
