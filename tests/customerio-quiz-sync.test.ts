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

test("quiz lead sync skips Customer.io entirely when marketing consent is false", async () => {
  const calls: unknown[] = []
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async (url: string | URL | Request) => {
    calls.push(String(url))
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
          fingertest: "leicht_uneben",
          pulltest: "stretches_stays",
          scalp_type: "trocken",
          has_scalp_issue: false,
          concerns: ["dryness"],
          treatment: ["natur"],
          goals: ["moisture"],
        },
      })

      assert.equal(result.identify, undefined)
      assert.equal(result.profileSubmitted, undefined)
      assert.deepEqual(calls, [])
    })
  } finally {
    globalThis.fetch = originalFetch
  }
})
