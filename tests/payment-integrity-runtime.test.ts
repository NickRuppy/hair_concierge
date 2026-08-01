import assert from "node:assert/strict"
import test from "node:test"

import {
  createPaymentIntegrityReporter,
  createPaymentIntegrityRunner,
  createProviderReferenceDigest,
} from "../src/lib/billing/payment-integrity-runtime"
import { DEFAULT_PAYMENT_INTEGRITY_CANDIDATE_CAP } from "../src/lib/billing/payment-integrity"

const now = new Date("2026-08-01T12:00:00.000Z")
const deadlineAt = new Date(Date.now() + 30_000)
const twoHoursAgo = Math.floor(new Date("2026-08-01T10:00:00.000Z").getTime() / 1000)

test("provider references are represented only by a server-keyed HMAC digest", () => {
  const digest = createProviderReferenceDigest(
    "digest-secret",
    "stripe",
    "subscription",
    "sub_raw_provider_reference",
  )

  assert.match(digest, /^[a-f0-9]{64}$/)
  assert.equal(digest.includes("sub_raw_provider_reference"), false)
  assert.notEqual(
    digest,
    createProviderReferenceDigest(
      "other-secret",
      "stripe",
      "subscription",
      "sub_raw_provider_reference",
    ),
  )
})

test("Stripe provider discovery paginates within the bounded window and maps strong success to local subscription state", async () => {
  const stripeCalls: Array<Record<string, unknown>> = []
  const runner = createPaymentIntegrityRunner({
    digestSecret: "digest-secret",
    paymentRuntime: { stripeLive: true, paypalLive: false },
    stripe: fakeStripe({
      sessions: [
        {
          data: [
            stripeSubscriptionSession("cs_page_1", "sub_missing", {
              checkout_attempt_id: "attempt_page_1",
            }),
          ],
          has_more: true,
        },
        {
          data: [
            stripeSubscriptionSession("cs_page_2", "sub_healthy", {
              checkout_attempt_id: "attempt_page_2",
            }),
          ],
          has_more: false,
        },
      ],
      onSessionList: (params) => stripeCalls.push(params),
    }),
    paypalRequest: async () => ({}),
    supabase: fakeSupabase({
      billing_subscriptions: [
        {
          provider: "stripe",
          provider_subscription_id: "sub_healthy",
          provider_status: "active",
          entitlement_status: "active",
          current_period_end: "2026-09-01T00:00:00.000Z",
        },
      ],
    }),
  })

  const result = await runner({ now, deadlineAt })

  assert.equal(stripeCalls.length, 2)
  assert.equal(stripeCalls[0]?.created && typeof stripeCalls[0].created === "object", true)
  assert.equal(stripeCalls[1]?.starting_after, "cs_page_1")
  assert.equal(result.status, "completed")
  assert.equal(result.counters.incompleteProviders, 0)
  assert.deepEqual(
    result.findings.map((finding) => finding.invariant),
    ["provider_success_without_billing_success"],
  )
  assert.equal(result.findings[0]?.checkoutAttemptId, "attempt_page_1")
  assert.equal(JSON.stringify(result).includes("sub_missing"), false)
})

test("Stripe marks the provider incomplete when checkout sessions consume the cap before invoice scan", async () => {
  let invoiceCalls = 0
  const sessions = Array.from({ length: DEFAULT_PAYMENT_INTEGRITY_CANDIDATE_CAP }, (_, index) =>
    stripeSubscriptionSession(`cs_cap_${index}`, `sub_cap_${index}`, {
      checkout_attempt_id: `attempt_cap_${index}`,
    }),
  )
  const runner = createPaymentIntegrityRunner({
    digestSecret: "digest-secret",
    paymentRuntime: { stripeLive: true, paypalLive: false },
    stripe: fakeStripe({
      sessions: [{ data: sessions, has_more: false }],
      invoices: [{ data: [], has_more: false }],
      onInvoiceList: () => {
        invoiceCalls += 1
      },
    }),
    paypalRequest: async () => ({}),
    supabase: fakeSupabase({
      billing_subscriptions: sessions.map((session, index) => ({
        provider: "stripe",
        provider_subscription_id: `sub_cap_${index}`,
        provider_status: "active",
        entitlement_status: "active",
        current_period_end: "2026-09-01T00:00:00.000Z",
      })),
    }),
  })

  const result = await runner({ now, deadlineAt })

  assert.equal(invoiceCalls, 0)
  assert.equal(result.status, "monitor_failed")
  assert.equal(result.counters.incompleteProviders, 1)
  assert.equal(result.monitorFailures[0]?.reason, "incomplete_pagination")
})

test("Stripe one-time success maps only to a paid one-time purchase row", async () => {
  const runner = createPaymentIntegrityRunner({
    digestSecret: "digest-secret",
    paymentRuntime: { stripeLive: true, paypalLive: false },
    stripe: fakeStripe({
      sessions: [
        {
          data: [
            stripeOneTimeSession("cs_once_paid", "pi_once_paid", {
              checkout_attempt_id: "attempt_once_paid",
            }),
            stripeOneTimeSession("cs_once_missing", "pi_once_missing", {
              checkout_attempt_id: "attempt_once_miss",
            }),
          ],
          has_more: false,
        },
      ],
    }),
    paypalRequest: async () => ({}),
    supabase: fakeSupabase({
      billing_one_time_purchases: [
        {
          provider_transaction_id: "pi_once_paid",
          provider_order_id: "cs_once_paid",
          status: "paid",
        },
      ],
    }),
  })

  const result = await runner({ now, deadlineAt })

  assert.deepEqual(
    result.findings.map((finding) => finding.invariant),
    ["provider_success_without_paid_one_time_purchase"],
  )
  assert.equal(result.findings[0]?.checkoutAttemptId, "attempt_once_miss")
})

test("Stripe one-time historical success with a terminal refunded local row is already reconciled", async () => {
  const runner = createPaymentIntegrityRunner({
    digestSecret: "digest-secret",
    paymentRuntime: { stripeLive: true, paypalLive: false },
    stripe: fakeStripe({
      sessions: [
        {
          data: [
            stripeOneTimeSession("cs_once_refunded", "pi_once_refunded", {
              checkout_attempt_id: "attempt_refunded",
            }),
          ],
          has_more: false,
        },
      ],
    }),
    paypalRequest: async () => ({}),
    supabase: fakeSupabase({
      billing_one_time_purchases: [
        {
          provider_transaction_id: "pi_once_refunded",
          provider_order_id: "cs_once_refunded",
          status: "refunded",
        },
      ],
    }),
  })

  const result = await runner({ now, deadlineAt })

  assert.equal(result.status, "completed")
  assert.equal(result.counters.findings, 0)
  assert.equal(result.counters.candidatesChecked, 1)
})

test("Stripe invoice reconciliation reads modern parent subscription references", async () => {
  const runner = createPaymentIntegrityRunner({
    digestSecret: "digest-secret",
    paymentRuntime: { stripeLive: true, paypalLive: false },
    stripe: fakeStripe({
      sessions: [{ data: [], has_more: false }],
      invoices: [
        {
          data: [
            {
              id: "in_parent_sub",
              status: "paid",
              created: twoHoursAgo,
              parent: { subscription_details: { subscription: { id: "sub_parent_modern" } } },
              metadata: {},
            },
          ],
          has_more: false,
        },
      ],
    }),
    paypalRequest: async () => ({}),
    supabase: fakeSupabase(),
  })

  const result = await runner({ now, deadlineAt })

  assert.deepEqual(
    result.findings.map((finding) => finding.invariant),
    ["provider_success_without_billing_success"],
  )
  assert.equal(JSON.stringify(result).includes("sub_parent_modern"), false)
})

test("subscription success with retained canceled-at-period-end access is reconciled", async () => {
  const runner = createPaymentIntegrityRunner({
    digestSecret: "digest-secret",
    paymentRuntime: { stripeLive: true, paypalLive: false },
    stripe: fakeStripe({
      sessions: [
        {
          data: [
            stripeSubscriptionSession("cs_cancel_retain", "sub_cancel_retain", {
              checkout_attempt_id: "attempt_cancel",
            }),
          ],
          has_more: false,
        },
      ],
    }),
    paypalRequest: async () => ({}),
    supabase: fakeSupabase({
      billing_subscriptions: [
        {
          provider: "stripe",
          provider_subscription_id: "sub_cancel_retain",
          provider_status: "canceled",
          entitlement_status: "canceled",
          cancel_at_period_end: true,
          current_period_end: "2026-09-01T00:00:00.000Z",
        },
      ],
    }),
  })

  const result = await runner({ now, deadlineAt })

  assert.equal(result.status, "completed")
  assert.equal(result.counters.findings, 0)
})

test("subscription success with a local past_due entitlement is reconciled", async () => {
  const runner = createPaymentIntegrityRunner({
    digestSecret: "digest-secret",
    paymentRuntime: { stripeLive: true, paypalLive: false },
    stripe: fakeStripe({
      sessions: [
        {
          data: [
            stripeSubscriptionSession("cs_past_due", "sub_past_due", {
              checkout_attempt_id: "attempt_past_due",
            }),
          ],
          has_more: false,
        },
      ],
    }),
    paypalRequest: async () => ({}),
    supabase: fakeSupabase({
      billing_subscriptions: [
        {
          provider: "stripe",
          provider_subscription_id: "sub_past_due",
          provider_status: "past_due",
          entitlement_status: "past_due",
          current_period_end: null,
        },
      ],
    }),
  })

  const result = await runner({ now, deadlineAt })

  assert.equal(result.status, "completed")
  assert.equal(result.counters.findings, 0)
})

test("subscription-level failed provider states are skipped instead of conflicting with retained access", async () => {
  const runner = createPaymentIntegrityRunner({
    digestSecret: "digest-secret",
    paymentRuntime: { stripeLive: true, paypalLive: false },
    stripe: fakeStripe({
      sessions: [
        {
          data: [
            {
              ...stripeSubscriptionSession("cs_failed_sub", "sub_failed_sub", {
                checkout_attempt_id: "attempt_failed_sub",
              }),
              payment_status: "unpaid",
              subscription: { id: "sub_failed_sub", status: "incomplete_expired" },
            },
          ],
          has_more: false,
        },
      ],
    }),
    paypalRequest: async () => ({}),
    supabase: fakeSupabase({
      billing_subscriptions: [
        {
          provider: "stripe",
          provider_subscription_id: "sub_failed_sub",
          provider_status: "active",
          entitlement_status: "active",
          current_period_end: "2026-09-01T00:00:00.000Z",
        },
      ],
    }),
  })

  const result = await runner({ now, deadlineAt })

  assert.equal(result.status, "completed")
  assert.equal(result.counters.findings, 0)
  assert.equal(result.counters.candidatesChecked, 0)
})

test("Stripe invoice-level failures are not converted into retained-access integrity mismatches", async () => {
  const runner = createPaymentIntegrityRunner({
    digestSecret: "digest-secret",
    paymentRuntime: { stripeLive: true, paypalLive: false },
    stripe: fakeStripe({
      sessions: [{ data: [], has_more: false }],
      invoices: [
        {
          data: [
            {
              id: "in_failed_renewal",
              status: "uncollectible",
              created: twoHoursAgo,
              parent: { subscription_details: { subscription: "sub_retained_access" } },
              metadata: {},
            },
          ],
          has_more: false,
        },
      ],
    }),
    paypalRequest: async () => ({}),
    supabase: fakeSupabase({
      billing_subscriptions: [
        {
          provider: "stripe",
          provider_subscription_id: "sub_retained_access",
          provider_status: "active",
          entitlement_status: "active",
          current_period_end: "2026-09-01T00:00:00.000Z",
        },
      ],
    }),
  })

  const result = await runner({ now, deadlineAt })

  assert.equal(result.status, "completed")
  assert.equal(result.counters.findings, 0)
  assert.equal(result.counters.candidatesChecked, 0)
})

test("PayPal scans local intent rows, reads provider truth individually, and keeps raw provider ids out of results", async () => {
  const paypalPaths: string[] = []
  const runner = createPaymentIntegrityRunner({
    digestSecret: "digest-secret",
    paymentRuntime: { stripeLive: false, paypalLive: true },
    stripe: fakeStripe(),
    paypalRequest: async (path) => {
      paypalPaths.push(path)
      return {
        id: "I-RAW-ACTIVE",
        status: "ACTIVE",
        create_time: "2026-08-01T09:00:00.000Z",
      }
    },
    supabase: fakeSupabase({
      paypal_checkout_intents: [
        {
          provider_subscription_id: "I-RAW-ACTIVE",
          user_id: "user_paypal",
          lead_id: "lead_paypal",
          metadata: { production_qa: "true" },
          created_at: "2026-08-01T08:00:00.000Z",
          updated_at: "2026-08-01T08:01:00.000Z",
        },
      ],
    }),
  })

  const result = await runner({ now, deadlineAt })

  assert.deepEqual(paypalPaths, ["/v1/billing/subscriptions/I-RAW-ACTIVE"])
  assert.equal(result.findings[0]?.isInternalTest, true)
  assert.equal(result.findings[0]?.provider, "paypal")
  assert.equal(result.findings[0]?.live, true)
  assert.equal(JSON.stringify(result).includes("I-RAW-ACTIVE"), false)
})

test("PayPal order success uses checkoutAttemptId and provider-order local lookup for one-time purchases", async () => {
  const runner = createPaymentIntegrityRunner({
    digestSecret: "digest-secret",
    paymentRuntime: { stripeLive: false, paypalLive: true },
    stripe: fakeStripe(),
    paypalRequest: async () => ({
      id: "ORDER-RAW-1",
      status: "COMPLETED",
      update_time: "2026-08-01T09:00:00.000Z",
    }),
    supabase: fakeSupabase({
      paypal_order_intents: [
        {
          provider_order_id: "ORDER-RAW-1",
          provider_capture_id: null,
          checkout_attempt_id: "attempt_paypal_order",
          user_id: "user_order",
          lead_id: "lead_order",
          metadata: {},
          expires_at: "2026-08-02T08:00:00.000Z",
        },
      ],
      billing_one_time_purchases: [
        {
          provider_transaction_id: "CAPTURE-OTHER",
          provider_order_id: "ORDER-RAW-1",
          status: "paid",
        },
      ],
    }),
  })

  const result = await runner({ now, deadlineAt })

  assert.equal(result.counters.candidatesChecked, 1)
  assert.equal(result.counters.findings, 0)
  assert.equal(JSON.stringify(result).includes("ORDER-RAW-1"), false)
})

test("PayPal renewal scan is bounded by local subscriptions and recent subscription transactions", async () => {
  const paypalPaths: string[] = []
  const runner = createPaymentIntegrityRunner({
    digestSecret: "digest-secret",
    paymentRuntime: { stripeLive: false, paypalLive: true },
    stripe: fakeStripe(),
    paypalRequest: async (path) => {
      paypalPaths.push(path)
      return {
        transactions: [
          {
            id: "TXN-RAW-RENEWAL",
            status: "COMPLETED",
            time: "2026-08-01T09:30:00.000Z",
          },
        ],
      }
    },
    supabase: fakeSupabase({
      billing_subscriptions: [
        {
          provider: "paypal",
          provider_subscription_id: "I-LOCAL-RENEWAL",
          user_id: "user_renewal",
          provider_status: "ACTIVE",
          entitlement_status: "canceled",
          current_period_end: null,
          metadata: {},
          updated_at: "2026-07-01T00:00:00.000Z",
        },
      ],
    }),
  })

  const result = await runner({ now, deadlineAt })

  assert.equal(paypalPaths.length, 1)
  assert.match(paypalPaths[0] ?? "", /\/v1\/billing\/subscriptions\/I-LOCAL-RENEWAL\/transactions/)
  assert.deepEqual(
    result.findings.map((finding) => finding.invariant),
    ["provider_success_without_active_entitlement"],
  )
  assert.equal(JSON.stringify(result).includes("I-LOCAL-RENEWAL"), false)
  assert.equal(JSON.stringify(result).includes("TXN-RAW-RENEWAL"), false)
})

test("PayPal marks the provider incomplete when subscription intents consume the cap before renewal and order scans", async () => {
  const rows = Array.from({ length: DEFAULT_PAYMENT_INTEGRITY_CANDIDATE_CAP }, (_, index) => ({
    provider_subscription_id: `I-CAP-${index}`,
    user_id: `user_cap_${index}`,
    lead_id: `lead_cap_${index}`,
    metadata: {},
    created_at: "2026-08-01T08:00:00.000Z",
    updated_at: "2026-08-01T08:01:00.000Z",
  }))
  const runner = createPaymentIntegrityRunner({
    digestSecret: "digest-secret",
    paymentRuntime: { stripeLive: false, paypalLive: true },
    stripe: fakeStripe(),
    paypalRequest: async () => ({
      status: "ACTIVE",
      create_time: "2026-08-01T09:00:00.000Z",
    }),
    supabase: fakeSupabase({
      paypal_checkout_intents: rows,
      billing_subscriptions: rows.map((row) => ({
        provider: "paypal",
        provider_subscription_id: row.provider_subscription_id,
        provider_status: "ACTIVE",
        entitlement_status: "active",
        current_period_end: null,
      })),
    }),
  })

  const result = await runner({ now, deadlineAt })

  assert.equal(result.status, "monitor_failed")
  assert.equal(result.counters.incompleteProviders, 1)
  assert.equal(result.monitorFailures[0]?.reason, "incomplete_pagination")
  assert.equal(result.counters.findings, 0)
})

test("PayPal failed renewal transactions are not converted into retained-access integrity mismatches", async () => {
  const runner = createPaymentIntegrityRunner({
    digestSecret: "digest-secret",
    paymentRuntime: { stripeLive: false, paypalLive: true },
    stripe: fakeStripe(),
    paypalRequest: async () => ({
      transactions: [
        {
          id: "TXN-RAW-FAILED",
          status: "DENIED",
          time: "2026-08-01T09:30:00.000Z",
        },
      ],
    }),
    supabase: fakeSupabase({
      billing_subscriptions: [
        {
          provider: "paypal",
          provider_subscription_id: "I-FAILED-RENEWAL",
          user_id: "user_failed_renewal",
          provider_status: "ACTIVE",
          entitlement_status: "active",
          current_period_end: null,
          metadata: {},
          updated_at: "2026-07-01T00:00:00.000Z",
        },
      ],
    }),
  })

  const result = await runner({ now, deadlineAt })

  assert.equal(result.status, "completed")
  assert.equal(result.counters.findings, 0)
  assert.equal(result.counters.candidatesChecked, 0)
  assert.equal(JSON.stringify(result).includes("TXN-RAW-FAILED"), false)
})

test("reporter maps integrity findings and monitor failures to typed payment Sentry signals", () => {
  const captured: unknown[] = []
  const reporter = createPaymentIntegrityReporter({
    paymentRuntime: { stripeLive: true, paypalLive: false },
    reportPaymentFailure: (details) => captured.push(details),
  })

  reporter.reportFinding?.({
    signal: "payment_integrity_mismatch",
    provider: "stripe",
    commerceKind: "subscription",
    boundary: "entitlement",
    errorFamily: "entitlement_state",
    invariant: "provider_success_without_active_entitlement",
    checkoutAttemptId: "attempt_report",
    method: "apple_pay",
    truth: "succeeded",
    live: true,
    isInternalTest: false,
    userId: "user_report",
  })
  reporter.reportMonitorFailure?.({
    signal: "payment_monitor_failed",
    provider: "stripe",
    reason: "provider_error",
    errorFamily: "provider_unavailable",
  })

  assert.deepEqual(
    captured.map((entry) => (entry as { signal: string }).signal),
    ["payment_integrity_mismatch", "payment_monitor_failed"],
  )
  assert.equal((captured[0] as { origin: string }).origin, "reconciliation")
  assert.equal((captured[1] as { live: boolean }).live, true)
  assert.equal((captured[1] as { status: string }).status, "provider_error")
})

test("provider calls are bounded by a short timeout and sanitized as provider monitor failures", async () => {
  const runner = createPaymentIntegrityRunner({
    digestSecret: "digest-secret",
    paymentRuntime: { stripeLive: true, paypalLive: false },
    stripe: fakeStripe({
      sessions: [
        {
          data: [
            stripeSubscriptionSession("cs_timeout", "sub_timeout", {
              checkout_attempt_id: "attempt_timeout",
            }),
          ],
          has_more: false,
        },
      ],
      invoices: [
        {
          data: [],
          has_more: false,
        },
      ],
    }),
    paypalRequest: async () => new Promise(() => undefined),
    supabase: fakeSupabase({
      paypal_checkout_intents: [
        {
          provider_subscription_id: "I-TIMEOUT-RAW",
          user_id: "user_timeout",
          lead_id: "lead_timeout",
          metadata: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
    }),
  })

  const result = await runner({
    now: new Date(),
    deadlineAt: new Date(Date.now() + 50),
  })

  assert.equal(result.status, "monitor_failed")
  assert.equal(
    result.counters.incompleteProviders > 0 || result.counters.deadlineExhausted > 0,
    true,
  )
  assert.equal(JSON.stringify(result).includes("I-TIMEOUT-RAW"), false)
})

test("digest secret fallback prefers service role over the rotatable monitor trigger secret", async () => {
  const previousReferenceSecret = process.env.PAYMENT_REFERENCE_DIGEST_SECRET
  const previousServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY
  const previousMonitorSecret = process.env.PAYMENT_MONITOR_TRIGGER_SECRET
  delete process.env.PAYMENT_REFERENCE_DIGEST_SECRET
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-secret"
  process.env.PAYMENT_MONITOR_TRIGGER_SECRET = "monitor-trigger-secret"
  try {
    const runner = createPaymentIntegrityRunner({
      paymentRuntime: { stripeLive: true, paypalLive: false },
      stripe: fakeStripe({
        sessions: [{ data: [], has_more: false }],
        invoices: [
          {
            data: [
              {
                id: "in_digest_fallback",
                status: "paid",
                created: twoHoursAgo,
                parent: { subscription_details: { subscription: "sub_digest_fallback" } },
                metadata: {},
              },
            ],
            has_more: false,
          },
        ],
      }),
      paypalRequest: async () => ({}),
      supabase: fakeSupabase(),
    })

    const result = await runner({ now, deadlineAt })

    assert.equal(
      result.findings[0]?.providerReferenceDigest,
      createProviderReferenceDigest(
        "service-role-secret",
        "stripe",
        "subscription",
        "sub_digest_fallback",
      ),
    )
  } finally {
    restoreEnv("PAYMENT_REFERENCE_DIGEST_SECRET", previousReferenceSecret)
    restoreEnv("SUPABASE_SERVICE_ROLE_KEY", previousServiceRole)
    restoreEnv("PAYMENT_MONITOR_TRIGGER_SECRET", previousMonitorSecret)
  }
})

test("provider and local lookup failures are contained as sanitized monitor failures", async () => {
  const providerRunner = createPaymentIntegrityRunner({
    digestSecret: "digest-secret",
    paymentRuntime: { stripeLive: true, paypalLive: false },
    stripe: fakeStripe({
      sessionError: new Error("Stripe raw secret pi_secret_should_not_escape"),
    }),
    paypalRequest: async () => ({}),
    supabase: fakeSupabase(),
  })
  const providerResult = await providerRunner({ now, deadlineAt })

  assert.equal(providerResult.counters.providerErrors, 1)
  assert.equal(providerResult.monitorFailures[0]?.reason, "provider_error")
  assert.equal(JSON.stringify(providerResult).includes("pi_secret_should_not_escape"), false)

  const localRunner = createPaymentIntegrityRunner({
    digestSecret: "digest-secret",
    paymentRuntime: { stripeLive: true, paypalLive: false },
    stripe: fakeStripe({
      sessions: [
        {
          data: [
            stripeSubscriptionSession("cs_local_error", "sub_local_error", {
              checkout_attempt_id: "attempt_local_err",
            }),
          ],
          has_more: false,
        },
      ],
    }),
    paypalRequest: async () => ({}),
    supabase: fakeSupabase({
      errors: { billing_subscriptions: new Error("raw local lookup provider id sub_local_error") },
    }),
  })
  const localResult = await localRunner({ now, deadlineAt })

  assert.equal(localResult.counters.localLookupErrors, 1)
  assert.equal(localResult.monitorFailures[0]?.reason, "local_lookup_error")
  assert.equal(JSON.stringify(localResult).includes("sub_local_error"), false)
})

function stripeSubscriptionSession(
  id: string,
  subscriptionId: string,
  metadata: Record<string, string>,
) {
  return {
    id,
    mode: "subscription",
    payment_status: "paid",
    status: "complete",
    subscription: { id: subscriptionId, status: "active" },
    payment_intent: {
      id: `pi_${id}`,
      payment_method: { id: `pm_${id}`, type: "card", card: { wallet: { type: "apple_pay" } } },
    },
    metadata,
    created: twoHoursAgo,
  }
}

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) delete process.env[key]
  else process.env[key] = value
}

function stripeOneTimeSession(
  id: string,
  paymentIntentId: string,
  metadata: Record<string, string>,
) {
  return {
    id,
    mode: "payment",
    payment_status: "paid",
    status: "complete",
    payment_intent: {
      id: paymentIntentId,
      status: "succeeded",
      metadata: { product_kind: "personal_plan_once", ...metadata },
      payment_method: { id: `pm_${id}`, type: "card" },
    },
    metadata: { product_kind: "personal_plan_once", ...metadata },
    created: twoHoursAgo,
  }
}

function fakeStripe(
  options: {
    sessions?: Array<{ data: Array<Record<string, unknown>>; has_more?: boolean }>
    invoices?: Array<{ data: Array<Record<string, unknown>>; has_more?: boolean }>
    sessionError?: Error
    onInvoiceList?: () => void
    onSessionList?: (params: Record<string, unknown>) => void
  } = {},
) {
  const sessionPages = [...(options.sessions ?? [{ data: [], has_more: false }])]
  const invoicePages = [...(options.invoices ?? [{ data: [], has_more: false }])]
  return {
    checkout: {
      sessions: {
        async list(params: Record<string, unknown>) {
          options.onSessionList?.(params)
          if (options.sessionError) throw options.sessionError
          return sessionPages.shift() ?? { data: [], has_more: false }
        },
      },
    },
    invoices: {
      async list() {
        options.onInvoiceList?.()
        return invoicePages.shift() ?? { data: [], has_more: false }
      },
    },
  } as never
}

function fakeSupabase(
  input: {
    billing_subscriptions?: Array<Record<string, unknown>>
    billing_one_time_purchases?: Array<Record<string, unknown>>
    paypal_checkout_intents?: Array<Record<string, unknown>>
    paypal_order_intents?: Array<Record<string, unknown>>
    errors?: Record<string, Error>
  } = {},
) {
  const tables: Record<string, Array<Record<string, unknown>>> = {
    billing_subscriptions: input.billing_subscriptions ?? [],
    billing_one_time_purchases: input.billing_one_time_purchases ?? [],
    paypal_checkout_intents: input.paypal_checkout_intents ?? [],
    paypal_order_intents: input.paypal_order_intents ?? [],
  }

  return {
    from(table: string) {
      const filters: Array<(row: Record<string, unknown>) => boolean> = []
      let rowLimit: number | null = null
      const builder = {
        select() {
          return builder
        },
        eq(column: string, value: unknown) {
          filters.push((row) => row[column] === value)
          return builder
        },
        not(column: string, operator: string, value: unknown) {
          filters.push((row) =>
            operator === "is" && value === null ? row[column] !== null : row[column] !== value,
          )
          return builder
        },
        gte(column: string, value: string) {
          filters.push((row) => String(row[column] ?? "") >= value)
          return builder
        },
        lte(column: string, value: string) {
          filters.push((row) => String(row[column] ?? "") <= value)
          return builder
        },
        order() {
          return builder
        },
        limit(value: number) {
          rowLimit = value
          return builder
        },
        async maybeSingle() {
          if (input.errors?.[table]) return { data: null, error: input.errors[table] }
          return { data: rows()[0] ?? null, error: null }
        },
        then(
          resolve: (value: {
            data: Array<Record<string, unknown>> | null
            error: Error | null
          }) => unknown,
        ) {
          if (input.errors?.[table]) {
            return Promise.resolve({ data: null, error: input.errors[table] }).then(resolve)
          }
          return Promise.resolve({ data: rows(), error: null }).then(resolve)
        },
      }
      function rows() {
        const filtered = (tables[table] ?? []).filter((row) =>
          filters.every((filter) => filter(row)),
        )
        return rowLimit === null ? filtered : filtered.slice(0, rowLimit)
      }
      return builder
    },
  } as never
}
