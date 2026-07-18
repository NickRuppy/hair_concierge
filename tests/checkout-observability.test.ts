import assert from "node:assert/strict"
import test from "node:test"
import {
  buildCheckoutSentryPayload,
  getCheckoutRateLimitReason,
  scrubSentryBreadcrumb,
  scrubSentryEvent,
} from "../src/lib/observability/checkout"

test("buildCheckoutSentryPayload keeps searchable checkout tags without raw PayPal token", () => {
  const payload = buildCheckoutSentryPayload({
    provider: "paypal",
    stage: "paypal_approve_subscription",
    source: "pricing_page",
    interval: "quarter",
    leadId: "11111111-1111-4111-8111-111111111111",
    paypalSubscriptionId: "I-SUBSCRIPTION",
    paypalTokenPresent: true,
    status: 502,
  })

  assert.deepEqual(payload.tags, {
    "checkout.provider": "paypal",
    "checkout.stage": "paypal_approve_subscription",
    "checkout.source": "pricing_page",
    "checkout.interval": "quarter",
    "checkout.status": "502",
  })
  assert.deepEqual(payload.context, {
    provider: "paypal",
    stage: "paypal_approve_subscription",
    source: "pricing_page",
    interval: "quarter",
    lead_id: "11111111-1111-4111-8111-111111111111",
    paypal_subscription_id: "I-SUBSCRIPTION",
    paypal_token_present: true,
    status: 502,
  })
  assert.equal(JSON.stringify(payload).includes("secret-token"), false)
})

test("buildCheckoutSentryPayload includes sanitized PayPal webhook identifiers", () => {
  const payload = buildCheckoutSentryPayload({
    provider: "paypal",
    stage: "paypal_webhook_ingestion",
    paypalEventId: "WH-123",
    paypalEventType: "PAYMENT.SALE.COMPLETED",
  })

  assert.equal(payload.tags["checkout.stage"], "paypal_webhook_ingestion")
  assert.equal(payload.context.paypal_event_id, "WH-123")
  assert.equal(payload.context.paypal_event_type, "PAYMENT.SALE.COMPLETED")
})

test("buildCheckoutSentryPayload redacts raw Stripe checkout session ids", () => {
  const payload = buildCheckoutSentryPayload({
    provider: "stripe",
    stage: "checkout_return",
    source: "welcome",
    stripeSessionId: "cs_test_secret",
  })

  assert.equal(payload.context.stripe_session_id, "[Filtered]")
  assert.equal(JSON.stringify(payload).includes("cs_test_secret"), false)
})

test("scrubSentryEvent removes checkout activation secrets from request urls", () => {
  const event = scrubSentryEvent({
    request: {
      url: "https://chaarlie.example/welcome?provider=paypal&token=secret-token&session_id=cs_test_123&keep=yes",
    },
  })

  assert.equal(
    event.request?.url,
    "https://chaarlie.example/welcome?provider=paypal&token=%5BFiltered%5D&session_id=%5BFiltered%5D&keep=yes",
  )
})

test("scrubSentryEvent redacts relative urls, query fields, headers, cookies, and spans", () => {
  const event = scrubSentryEvent({
    request: {
      url: "/welcome?provider=paypal&token=secret-token&session_id=cs_test_123&keep=yes",
      query_string: {
        token: "secret-token",
        keep: "yes",
        session_id: "cs_test_123",
      },
      headers: {
        authorization: "Bearer secret",
        cookie: "session=secret",
        "x-safe": "yes",
      },
      cookies: { session: "secret" },
      data: {
        token: "secret-token",
        callbackUrl: "/welcome?session_id=cs_test_123",
      },
    },
    contexts: {
      checkout: {
        stripe_session_id: "cs_test_secret",
      },
    },
    exception: {
      values: [
        {
          value: "Checkout failed for /welcome?session_id=cs_test_123",
        },
      ],
    },
    extra: {
      returnUrl: "/welcome?token=secret-token",
    },
    message: "Checkout failed for /welcome?token=secret-token",
    spans: [
      {
        description: "GET /api/paypal/activation-status?token=secret-token",
        data: {
          url: "/api/paypal/activation-status?token=secret-token",
        },
      },
    ],
    transaction: "/welcome?token=secret-token",
  })

  assert.equal(
    event.request?.url,
    "/welcome?provider=paypal&token=%5BFiltered%5D&session_id=%5BFiltered%5D&keep=yes",
  )
  assert.deepEqual(event.request?.query_string, {
    token: "[Filtered]",
    keep: "yes",
    session_id: "[Filtered]",
  })
  assert.deepEqual(event.request?.headers, {
    authorization: "[Filtered]",
    cookie: "[Filtered]",
    "x-safe": "yes",
  })
  assert.equal("cookies" in (event.request ?? {}), false)
  assert.deepEqual(event.contexts?.checkout, {
    stripe_session_id: "[Filtered]",
  })
  assert.deepEqual(event.request?.data, {
    token: "[Filtered]",
    callbackUrl: "/welcome?session_id=%5BFiltered%5D",
  })
  assert.deepEqual(event.extra, {
    returnUrl: "/welcome?token=%5BFiltered%5D",
  })
  assert.equal(event.message, "Checkout failed for /welcome?token=%5BFiltered%5D")
  assert.deepEqual(event.exception?.values, [
    {
      value: "Checkout failed for /welcome?session_id=%5BFiltered%5D",
    },
  ])
  assert.equal(
    event.spans?.[0]?.description,
    "GET /api/paypal/activation-status?token=%5BFiltered%5D",
  )
  assert.deepEqual(event.spans?.[0]?.data, {
    url: "/api/paypal/activation-status?token=%5BFiltered%5D",
  })
  assert.equal(event.transaction, "/welcome?token=%5BFiltered%5D")
})

test("scrubSentryBreadcrumb removes checkout activation secrets from breadcrumb data", () => {
  const breadcrumb = scrubSentryBreadcrumb({
    message: "Navigated to /welcome?session_id=cs_test_123",
    data: {
      from: "/pricing",
      to: "/welcome?token=secret-token",
      request: {
        url: "/api/paypal/activation-status?token=secret-token",
      },
    },
  })

  assert.equal(breadcrumb.message, "Navigated to /welcome?session_id=%5BFiltered%5D")
  assert.deepEqual(breadcrumb.data, {
    from: "/pricing",
    to: "/welcome?token=%5BFiltered%5D",
    request: {
      url: "/api/paypal/activation-status?token=%5BFiltered%5D",
    },
  })
})

test("buildCheckoutSentryPayload tags checkout rate-limit source", () => {
  const payload = buildCheckoutSentryPayload({
    provider: "stripe",
    stage: "checkout_magic_link_activation",
    source: "welcome",
    status: 429,
    reason: "send_auth_link_rate_limited",
    rateLimitSource: "app",
  })

  assert.equal(payload.tags["checkout.rate_limit_source"], "app")
  assert.equal(payload.context.rate_limit_source, "app")
})

test("getCheckoutRateLimitReason recognizes Supabase email-send throttling", () => {
  assert.equal(
    getCheckoutRateLimitReason({
      message: "Email rate limit exceeded",
      error_code: "over_email_send_rate_limit",
      status: 429,
    }),
    "supabase_auth_email_rate_limit",
  )
})
