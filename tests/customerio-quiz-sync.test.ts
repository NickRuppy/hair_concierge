import assert from "node:assert/strict"
import test from "node:test"

import { syncQuizLeadToCustomerIo } from "../src/lib/customerio/quiz-sync"

function withEnv(name: string, value: string, fn: () => Promise<void>) {
  const previous = process.env[name]
  process.env[name] = value
  return fn().finally(() => {
    if (previous === undefined) delete process.env[name]
    else process.env[name] = previous
  })
}

test("quiz lead sync returns failed results without throwing when Customer.io is unavailable", async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async () => new Response("down", { status: 503 })) as typeof fetch

  try {
    await withEnv("CUSTOMERIO_SERVER_WRITE_KEY", "server-key", async () => {
      const result = await syncQuizLeadToCustomerIo({
        createdAt: "2026-05-28T10:00:00.000Z",
        email: "lead@example.com",
        leadId: "lead-123",
        marketingConsent: true,
        name: "Lead",
        quizAnswers: {
          structure: "wavy",
          thickness: "fine",
          density: "low",
          hair_length: "medium",
          fingertest: "leicht_uneben",
          pulltest: "stretches_stays",
          scalp_type: "trocken",
          has_scalp_issue: true,
          scalp_condition: "gereizt",
          concerns: ["dryness"],
          treatment: ["natur"],
          goals: ["moisture"],
        },
      })

      assert.ok(result.identify)
      assert.equal(result.identify.ok, false)
      assert.equal(result.profileSubmitted?.ok, false)
    })
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("quiz lead sync sends Customer.io profile and event when marketing consent is false", async () => {
  const calls: Array<{ url: string; body: Record<string, unknown> }> = []
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({
      url: String(url),
      body: JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>,
    })
    return new Response("{}", { status: 200 })
  }) as typeof fetch

  try {
    await withEnv("CUSTOMERIO_SERVER_WRITE_KEY", "server-key", async () => {
      const result = await syncQuizLeadToCustomerIo({
        createdAt: "2026-05-28T10:00:00.000Z",
        email: "lead@example.com",
        leadId: "lead-456",
        marketingConsent: false,
        name: "Lead",
        quizAnswers: {
          structure: "wavy",
          thickness: "fine",
          density: "low",
          hair_length: "medium",
          fingertest: "leicht_uneben",
          pulltest: "stretches_stays",
          scalp_type: "trocken",
          has_scalp_issue: false,
          concerns: ["dryness"],
          treatment: ["natur"],
          goals: ["moisture"],
        },
      })

      assert.equal(result.identify?.ok, true)
      assert.equal(result.profileSubmitted?.ok, true)
      assert.equal(calls.length, 2)
      assert.equal(calls[0].url, "https://cdp-eu.customer.io/v1/identify")
      assert.equal(calls[1].url, "https://cdp-eu.customer.io/v1/track")
      assert.equal(calls[0].body.userId, "lead@example.com")
      assert.equal(calls[1].body.userId, "lead@example.com")

      const identifyTraits = calls[0].body.traits as Record<string, unknown>
      assert.equal(identifyTraits.email, "lead@example.com")
      assert.equal(identifyTraits.lead_id, "lead-456")
      assert.equal(identifyTraits.marketing_consent, false)
      assert.equal(identifyTraits.consent_timestamp, undefined)
      assert.equal(identifyTraits.quiz_completed_at, "2026-05-28T10:00:00.000Z")
      assert.equal(identifyTraits.hair_length, "medium")
      assert.equal(identifyTraits.hair_length_label, "Mittellang")

      assert.equal(calls[1].body.event, "quiz_profile_submitted")
      const eventProperties = calls[1].body.properties as Record<string, unknown>
      assert.equal(eventProperties.lead_id, "lead-456")
      assert.equal(eventProperties.marketing_consent, false)
    })
  } finally {
    globalThis.fetch = originalFetch
  }
})
