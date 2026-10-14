// PUB-3, security audit 2026-10-09, minimal fix ruled by Nick 2026-10-12.
import assert from "node:assert/strict"
import test from "node:test"
import { createQuizLeadPostHandler } from "../src/app/api/quiz/lead/route"
import { canonicalizeQuizAnswers } from "../src/lib/quiz/normalization"

const body = {
  name: "Submitted Name",
  email: "VICTIM@example.com",
  marketingConsent: true,
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
}

async function save(options: {
  known?: boolean
  lookupError?: boolean
  malformed?: boolean
  throws?: boolean
  sessionEmail?: string
  dedupe?: boolean
  name?: string
}) {
  const calls: Array<{ url: string; body: Record<string, any> }> = []
  const updates: unknown[] = []
  const lookups: unknown[] = []
  const callbacks: Array<() => unknown> = []
  const client = {
    rpc: async (name: string, args: unknown) => {
      lookups.push({ name, args })
      if (options.throws) throw new Error("lookup down")
      return {
        data: options.malformed ? null : (options.known ?? false),
        error: options.lookupError ? { message: "lookup down" } : null,
      }
    },
    from: () => {
      const query: any = {
        select: () => query,
        eq: () => query,
        is: () => query,
        gte: () => query,
        order: () => query,
        limit: async () => ({
          data: options.dedupe
            ? [
                {
                  id: "existing",
                  marketing_consent: false,
                  quiz_answers: canonicalizeQuizAnswers(body.quizAnswers as never),
                },
              ]
            : [],
          error: null,
        }),
        insert: () => query,
        single: async () => ({ data: { id: "new" }, error: null }),
        update: (value: unknown) => {
          updates.push(value)
          return query
        },
        then: (resolve: (value: unknown) => unknown) =>
          Promise.resolve({ error: null }).then(resolve),
      }
      return query
    },
  }
  const handler = createQuizLeadPostHandler({
    discoveryEnabled: () => false,
    cookies: (async () => ({ get: () => undefined })) as never,
    resolveFunnelCookieContext: async () => null,
    resolveModeratorJourney: async () => ({ kind: "ordinary" }),
    resolvePartnerJourney: async () => ({ kind: "none" }),
    checkRateLimit: async () => ({ allowed: true }),
    checkEmailDeliverability: async () =>
      ({ ok: true, normalized: "victim@example.com", outcome: "deliverable" }) as never,
    recordEmailDeliverabilityOutcome: () => {},
    createAdminClient: (() => client) as never,
    createSessionClient: (async () => ({
      auth: {
        getUser: async () => ({
          data: { user: options.sessionEmail ? { email: options.sessionEmail } : null },
          error: null,
        }),
      },
    })) as never,
    scheduleAfter: ((callback: () => unknown) => {
      callbacks.push(callback)
    }) as never,
    enqueueMetaLead: () => false,
  })
  const originalFetch = globalThis.fetch
  const originalKey = process.env.CUSTOMERIO_SERVER_WRITE_KEY
  process.env.CUSTOMERIO_SERVER_WRITE_KEY = "test-key"
  globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
    calls.push({ url: String(url), body: JSON.parse(String(init?.body)) })
    return new Response("{}", { status: 200 })
  }) as typeof fetch
  try {
    const response = await handler(
      new Request("https://chaarlie.de/api/quiz/lead", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...body, name: options.name ?? body.name }),
      }),
    )
    for (const callback of callbacks) await callback()
    return { response, calls, updates, lookups }
  } finally {
    globalThis.fetch = originalFetch
    if (originalKey === undefined) delete process.env.CUSTOMERIO_SERVER_WRITE_KEY
    else process.env.CUSTOMERIO_SERVER_WRITE_KEY = originalKey
  }
}

for (const [label, options, restricted] of [
  ["known email anonymous", { known: true }, true],
  ["brand-new email", { known: false }, false],
  ["authenticated same email", { known: true, sessionEmail: " VICTIM@EXAMPLE.COM " }, false],
  ["authenticated other email", { known: true, sessionEmail: "other@example.com" }, true],
  ["lookup error", { lookupError: true }, true],
  ["lookup throws", { throws: true }, true],
  ["malformed lookup", { malformed: true }, true],
  ["dedupe after new-email lookup", { known: false, dedupe: true }, true],
  ["anonymous dedupe", { known: true, dedupe: true }, true],
  [
    "authenticated dedupe",
    { known: true, dedupe: true, sessionEmail: "victim@example.com" },
    false,
  ],
] as const) {
  test(`PUB-3 ${label}: identify and stored consent respect email ownership`, async () => {
    const result = await save(options)
    assert.equal(result.response.status, 200)
    if (options.dedupe)
      assert.deepEqual(result.updates, restricted ? [] : [{ marketing_consent: true }])
    const traits = result.calls.find((call) => call.url.endsWith("/identify"))!.body.traits
    assert.equal(traits.hair_texture, "wavy")
    assert.equal(
      result.calls.find((call) => call.url.endsWith("/track"))!.body.event,
      "quiz_profile_submitted",
    )
    for (const key of ["email", "first_name", "marketing_consent", "consent_timestamp"])
      assert.equal(key in traits, !restricted, key)
    if (!restricted) {
      assert.equal(traits.first_name, "Submitted")
      assert.equal(traits.marketing_consent, true)
      assert.ok(traits.consent_timestamp)
    }
    if (!options.sessionEmail || options.sessionEmail === "other@example.com")
      assert.equal(result.lookups.length, 1)
  })
}

test("PUB-3 name cap preserves the existing validation response", async () => {
  assert.equal((await save({ name: "x".repeat(80) })).response.status, 200)
  const result = await save({ name: "x".repeat(81) })
  assert.equal(result.response.status, 400)
  assert.deepEqual(await result.response.json(), { error: "Ungueltige Daten" })
  assert.equal(result.calls.length, 0)
})
