import assert from "node:assert/strict"
import test from "node:test"

import { buildOpenAIConversionEvent } from "../src/lib/openai-ads/event-payload"
import type { BillingAnalyticsOutboxRow } from "../src/lib/billing/types"

const NOW = Date.parse("2026-09-15T12:00:00.000Z")

function event(overrides: Partial<BillingAnalyticsOutboxRow> = {}): BillingAnalyticsOutboxRow {
  return {
    id: "outbox-1",
    event_key: "stripe:purchase_completed:cs_123",
    event_name: "purchase_completed",
    user_id: "user-123",
    provider: "stripe",
    provider_customer_id: "cus_123",
    provider_subscription_id: "sub_123",
    source_event_id: "evt_123",
    source_object_id: "cs_123",
    occurred_at: "2026-09-15T11:00:00.000Z",
    payload: { value: 9.99, currency: "EUR" },
    created_at: "2026-09-15T11:00:00.000Z",
    updated_at: "2026-09-15T11:00:00.000Z",
    ...overrides,
  }
}

const context = {
  sourceUrl: "https://chaarlie.de/welcome?session_id=secret#done",
  canonicalOrigin: "https://chaarlie.de",
  oppref: "a%2Fb%3Dkeep-raw",
  obref: "browser-reference",
  personalizationOptOut: true,
} as const

test("maps a first paid EUR conversion into the documented OpenAI order event", () => {
  assert.deepEqual(buildOpenAIConversionEvent(event(), context, NOW), {
    id: "stripe:purchase_completed:cs_123",
    type: "order_created",
    timestamp_ms: Date.parse("2026-09-15T11:00:00.000Z"),
    source_url: "https://chaarlie.de/welcome",
    action_source: "web",
    opt_out: true,
    oppref: "a%2Fb%3Dkeep-raw",
    user: { obref: "browser-reference" },
    data: { type: "contents", amount: 999, currency: "EUR" },
  })
})

test("keeps an explicit JPY minor-unit amount without assuming two decimal places", () => {
  const converted = buildOpenAIConversionEvent(
    event({
      event_key: "paypal:purchase_completed:I-123",
      provider: "paypal",
      payload: { attempt_phase: "first_paid", amount_minor: 1200, currency: "JPY", value: 12 },
    }),
    { ...context, personalizationOptOut: false },
    NOW,
  )

  assert.deepEqual(converted?.data, { type: "contents", amount: 1200, currency: "JPY" })
  assert.equal(converted?.opt_out, false)
})

test("maps only a verified zero-value trial activation", () => {
  const trial = event({
    event_key: "stripe:trial_started:enrollment-123",
    event_name: "trial_started",
    occurred_at: "2026-09-15T11:30:00.000Z",
    payload: {
      trial_analytics_version: 1,
      trial_authorized_at: "2026-09-15T11:30:00.000Z",
      value: 0,
      currency: "EUR",
    },
  })

  assert.deepEqual(buildOpenAIConversionEvent(trial, context, NOW), {
    id: "stripe:trial_started:enrollment-123",
    type: "trial_started",
    timestamp_ms: Date.parse("2026-09-15T11:30:00.000Z"),
    source_url: "https://chaarlie.de/welcome",
    action_source: "web",
    opt_out: true,
    oppref: "a%2Fb%3Dkeep-raw",
    user: { obref: "browser-reference" },
    data: { type: "plan_enrollment" },
  })

  for (const payload of [
    { ...trial.payload, trial_analytics_version: 2 },
    { ...trial.payload, trial_authorized_at: "not-a-date" },
    { ...trial.payload, value: 1 },
  ]) {
    assert.equal(buildOpenAIConversionEvent(event({ ...trial, payload }), context, NOW), null)
  }
})

test("rejects unsupported, internal, test, renewal, and zero-value paid conversions", () => {
  const invalid = [
    event({ event_name: "payment_completed" }),
    event({ payload: { attempt_phase: "renewal", value: 9.99, currency: "EUR" } }),
    event({ payload: { attempt_phase: "first_paid", value: 0, currency: "EUR" } }),
    event({
      payload: {
        attempt_phase: "first_paid",
        value: 9.99,
        currency: "EUR",
        is_internal_test: true,
      },
    }),
    event({
      payload: {
        attempt_phase: "first_paid",
        value: 9.99,
        currency: "EUR",
        test_kind: "field_test",
      },
    }),
    event({
      payload: { attempt_phase: "first_paid", value: 9.99, currency: "EUR", test_kind: "partner" },
    }),
    event({ payload: { value: 9.99, currency: "ZZZ" } }),
  ]

  for (const candidate of invalid) {
    assert.equal(buildOpenAIConversionEvent(candidate, context, NOW), null)
  }
})

test("accepts only safe canonical source URLs and never copies contact fields", () => {
  const withContacts = event({
    payload: {
      attempt_phase: "first_paid",
      value: 9.99,
      currency: "EUR",
      email: "person@example.com",
      external_id: "person-123",
      quiz_answers: { private: true },
    },
  })
  const converted = buildOpenAIConversionEvent(
    withContacts,
    { ...context, sourceUrl: "https://chaarlie.de/lp/haarplan?email=person%40example.com#offer" },
    NOW,
  )

  assert.equal(converted?.source_url, "https://chaarlie.de/lp/haarplan")
  assert.deepEqual(Object.keys(converted ?? {}).sort(), [
    "action_source",
    "data",
    "id",
    "oppref",
    "opt_out",
    "source_url",
    "timestamp_ms",
    "type",
    "user",
  ])

  for (const sourceUrl of [
    "https://ads.example/lp/haarplan",
    "https://chaarlie.de/result/a-user-secret",
    "https://chaarlie.de/profile/a-user-secret",
  ]) {
    assert.equal(buildOpenAIConversionEvent(withContacts, { ...context, sourceUrl }, NOW), null)
  }
})

test("rejects timestamps outside the documented seven-day and ten-minute window", () => {
  for (const occurred_at of ["2026-09-08T11:59:59.999Z", "2026-09-15T12:10:00.001Z", "invalid"]) {
    assert.equal(buildOpenAIConversionEvent(event({ occurred_at }), context, NOW), null)
  }
})

test("does not guess monetary units for non-two-decimal or malformed stored amounts", () => {
  for (const payload of [
    { trial_analytics_version: 1, attempt_phase: "first_paid", value: 12, currency: "JPY" },
    { value: 12, currency: "JPY" },
    { value: 9.99, currency: "EUR", amount_minor: "999" },
    { value: 9.99, currency: "EUR", amount_minor: null },
  ]) {
    assert.equal(buildOpenAIConversionEvent(event({ payload }), context, NOW), null)
  }
})
