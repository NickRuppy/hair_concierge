import assert from "node:assert/strict"
import test from "node:test"

import {
  classifySlackGrowthEvent,
  formatSlackGrowthNotification,
} from "../supabase/functions/slack-growth/message-builder.ts"
import type { SlackGrowthEvent } from "../supabase/functions/slack-growth/message-builder.ts"

function event(overrides: Partial<SlackGrowthEvent> = {}): SlackGrowthEvent {
  return {
    id: "outbox-1",
    event_name: "purchase_completed",
    user_id: "d2719a90-8121-4fc0-8c7f-1da083018dde",
    provider: "stripe",
    occurred_at: "2026-09-15T08:30:00.000Z",
    payload: { value: 14.99, currency: "EUR", interval: "month" },
    ...overrides,
  }
}

function input(overrides: Partial<Parameters<typeof formatSlackGrowthNotification>[0]> = {}) {
  return {
    event: event(),
    profile: {
      id: "d2719a90-8121-4fc0-8c7f-1da083018dde",
      full_name: "Mia Beispiel",
      email: "mia@example.com",
    },
    ...overrides,
  }
}

test("classifies only canonical trials, first paid trial conversions, and non-renewal direct purchases", () => {
  assert.equal(
    classifySlackGrowthEvent(
      event({
        event_name: "trial_started",
        payload: {
          trial_analytics_version: 1,
          value: 0,
          trial_authorized_at: "2026-09-15T08:00:00.000Z",
        },
      }),
    ),
    "trial_started",
  )
  assert.equal(
    classifySlackGrowthEvent(
      event({
        payload: {
          trial_analytics_version: 1,
          attempt_phase: "first_paid",
          value: 14.99,
          currency: "EUR",
        },
      }),
    ),
    "trial_converted",
  )
  assert.equal(
    classifySlackGrowthEvent(event({ payload: { attempt_phase: "renewal", value: 14.99 } })),
    null,
  )
  assert.equal(
    classifySlackGrowthEvent(
      event({ payload: { trial_analytics_version: 1, attempt_phase: "renewal", value: 14.99 } }),
    ),
    null,
  )
  assert.equal(
    classifySlackGrowthEvent(event({ payload: { value: 29.99, interval: "one_time" } })),
    "direct_purchase",
  )
  assert.equal(
    classifySlackGrowthEvent(event({ payload: { value: 29.99, is_internal_test: true } })),
    null,
  )
  assert.equal(
    classifySlackGrowthEvent(event({ payload: { value: 29.99, test_kind: "field_test" } })),
    null,
  )
  assert.equal(
    classifySlackGrowthEvent(event({ payload: { value: 29.99, test_kind: "partner" } })),
    null,
  )
  assert.equal(
    classifySlackGrowthEvent(
      event({
        event_name: "trial_started",
        payload: { trial_analytics_version: 1, value: 0, trial_authorized_at: "not-a-date" },
      }),
    ),
    null,
  )
  assert.equal(classifySlackGrowthEvent(event({ payload: { value: "29.99" } })), null)
})

test("formats German plain-text blocks with profile identity, actual amount, canonical trial end, and safe fallback", () => {
  const trial = formatSlackGrowthNotification(
    input({
      event: event({
        event_name: "trial_started",
        payload: {
          trial_analytics_version: 1,
          value: 0,
          trial_authorized_at: "2026-09-15T08:00:00.000Z",
          trial_end_at: "2026-09-22T08:00:00.000Z",
          interval: "month",
        },
      }),
    }),
  )
  assert.ok(trial)
  assert.match(trial.text, /Trial gestartet/)
  assert.match(JSON.stringify(trial.blocks), /Mia Beispiel/)
  assert.match(JSON.stringify(trial.blocks), /mia@example.com/)
  assert.match(JSON.stringify(trial.blocks), /Testende/)
  assert.match(JSON.stringify(trial.blocks), /Nutzerverwaltung öffnen/)
  assert.ok(
    trial.blocks.every(
      (block) => JSON.stringify(block).includes('"type":"plain_text"') || block.type === "actions",
    ),
  )

  const missingIdentity = formatSlackGrowthNotification(input({ profile: null }))
  assert.ok(missingIdentity)
  assert.match(
    JSON.stringify(missingIdentity.blocks),
    /Nicht verfügbar \(ID: d2719a90-8121-4fc0-8c7f-1da083018dde\)/,
  )

  const hostile = formatSlackGrowthNotification(
    input({
      profile: { full_name: "<@U123>&<>\nA", email: "<mia@example.com>" },
    }),
  )
  assert.ok(hostile)
  assert.doesNotMatch(hostile.text, /<@U123>/)
  assert.match(hostile.text, /&lt;@U123&gt;/)

  const longName = formatSlackGrowthNotification(
    input({
      profile: { full_name: "A".repeat(500), email: "mia@example.com" },
    }),
  )
  assert.ok(longName)
  assert.match(JSON.stringify(longName.blocks), /mia@example.com/)
  assert.match(JSON.stringify(longName.blocks), /A{159}…/)
  const quarterly = formatSlackGrowthNotification(
    input({ event: event({ payload: { value: 29.99, currency: "EUR", interval: "quarter" } }) }),
  )
  assert.ok(quarterly)
  assert.match(quarterly.text, /Quartalsabo/)
  assert.match(JSON.stringify(quarterly.blocks), /Quartalsabo/)
})

test("accepts PostgreSQL timestamptz precision and UTC offset forms", () => {
  const result = formatSlackGrowthNotification(
    input({ event: event({ occurred_at: "2026-09-15T10:30:00.123456+00:00" }) }),
  )
  assert.ok(result)
  assert.match(result.text, /Neukauf/)
})

test("renders malformed event dates as unavailable without silently changing eligibility", () => {
  const result = formatSlackGrowthNotification(
    input({ event: event({ occurred_at: "2026-09-15 10:30:00", payload: { value: 14.99 } }) }),
  )
  assert.ok(result)
  assert.match(JSON.stringify(result.blocks), /Nicht verfügbar/)
})
