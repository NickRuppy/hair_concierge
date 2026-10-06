import assert from "node:assert/strict"
import test from "node:test"
import type {
  SupabaseBillingAnalyticsClient,
  BillingAnalyticsOutboxRow,
} from "../src/lib/billing/types"
import {
  handleOpenAIContextRequest,
  rawOpenAICookie,
  resolveOpenAIContext,
  sanitizeOpenAISourceUrl,
} from "../src/lib/openai-ads/server/context"
import {
  encodeOpenAIConsentCookie,
  OPENAI_CONSENT_COOKIE,
} from "../src/lib/openai-ads/server/consent-cookie"
const now = Date.now(),
  secret = "test-secret",
  id = "11111111-1111-4111-8111-111111111111"
const env = {
  OPENAI_ADS_ENABLED: "true",
  FUNNEL_COOKIE_SIGNING_SECRET: secret,
  NODE_ENV: "test",
} as NodeJS.ProcessEnv
function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request("https://chaarlie.de/api/openai-ads/context", {
    method: "POST",
    headers: {
      origin: "https://chaarlie.de",
      "content-type": "application/json",
      cookie: `${OPENAI_CONSENT_COOKIE}=${encodeOpenAIConsentCookie({ id, issuedAt: now }, secret)}`,
      ...headers,
    },
    body: JSON.stringify(body),
  })
}
const choice = {
  action: "choice",
  requestId: crypto.randomUUID(),
  expectedRevision: 0,
  marketing: true,
}
function setup() {
  const calls: { name: string; args: Record<string, unknown> }[] = []
  const supabase = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args })
      return {
        data: {
          revision: args.p_action === "choice" ? 1 : 0,
          marketing: args.p_action === "choice",
          expiresAt: new Date(now + 86400000).toISOString(),
          conflict: false,
        },
        error: null,
      }
    },
  } as unknown as SupabaseBillingAnalyticsClient
  return { calls, dependencies: { supabase: () => supabase, env, now: () => now } }
}
test("route initializes signed identity, never grants without existing cookie, and disables without DB access", async () => {
  const { calls, dependencies } = setup()
  const get = await handleOpenAIContextRequest(
    new Request("https://chaarlie.de/api/openai-ads/context"),
    dependencies,
  )
  assert.equal(get.status, 200)
  assert.match(get.headers.get("set-cookie") ?? "", /HttpOnly; SameSite=Lax/)
  assert.equal(get.headers.get("cache-control"), "no-store")
  const post = await handleOpenAIContextRequest(request(choice, { cookie: "" }), dependencies)
  assert.equal(post.status, 409)
  assert.equal(
    calls.every((c) => c.args.p_action === "get"),
    true,
  )
  const disabled = await handleOpenAIContextRequest(request(choice), {
    ...dependencies,
    env: { OPENAI_ADS_ENABLED: "false" },
    supabase: () => {
      throw new Error("must not access DB")
    },
  })
  assert.deepEqual(await disabled.json(), { revision: 0, marketing: false, expiresAt: null })
})
test("route rejects cross-origin, invalid fields, content type and unbounded body before database", async () => {
  const { calls, dependencies } = setup()
  for (const [req, status] of [
    [request(choice, { origin: "https://evil.test" }), 403],
    [request(choice, { "content-type": "text/plain" }), 415],
    [request({ ...choice, consentId: id }), 400],
    [request({ ...choice, action: "context" }), 400],
    [request({ ...choice, sourceUrl: "https://evil.test/result" }), 400],
    [request({ ...choice, sourceUrl: "x".repeat(5000) }), 413],
  ] as const)
    assert.equal((await handleOpenAIContextRequest(req, dependencies)).status, status)
  assert.equal(calls.length, 0)
})
test("route propagates conflict state and denial never reads or forwards reference cookies", async () => {
  const { calls, dependencies } = setup()
  const response = await handleOpenAIContextRequest(
    request({ ...choice, marketing: false }),
    dependencies,
  )
  assert.equal(response.status, 200)
  assert.equal(calls[1].args.p_oppref, null)
  assert.equal(calls[1].args.p_session_id, null)
  const conflict = await handleOpenAIContextRequest(request(choice), {
    ...dependencies,
    supabase: () =>
      ({
        rpc: async () => ({
          data: {
            revision: 2,
            marketing: false,
            expiresAt: new Date(now + 1e5).toISOString(),
            conflict: true,
          },
          error: null,
        }),
      }) as unknown as SupabaseBillingAnalyticsClient,
  })
  assert.equal(conflict.status, 409)
  assert.equal((await conflict.json()).revision, 2)
})
test("raw references remain byte-identical, ambiguous cookies are dropped, source excludes query and private paths", () => {
  assert.equal(
    rawOpenAICookie("__oppref=abc%2B%2520+123; unrelated=secret", "__oppref"),
    "abc%2B%2520+123",
  )
  assert.equal(rawOpenAICookie("__oppref=a; __oppref=b", "__oppref"), undefined)
  assert.equal(rawOpenAICookie("__oppref=" + "x".repeat(2049), "__oppref"), undefined)
  assert.equal(
    sanitizeOpenAISourceUrl("https://chaarlie.de/result?email=secret#private"),
    "https://chaarlie.de/result",
  )
  assert.equal(sanitizeOpenAISourceUrl("https://chaarlie.de/admin"), null)
  assert.equal(
    sanitizeOpenAISourceUrl("https://chaarlie.de/lp/test"),
    "https://chaarlie.de/lp/test",
  )
})
test("resolver has no latest-user fallback and transient DB errors remain retryable", async () => {
  const event = {
    payload: {},
    occurred_at: new Date(now).toISOString(),
  } as BillingAnalyticsOutboxRow
  let calls = 0
  const supabase = {
    rpc: async () => {
      calls++
      return { data: null, error: { message: "sensitive" } }
    },
  } as unknown as SupabaseBillingAnalyticsClient
  assert.equal(await resolveOpenAIContext(supabase, event), null)
  assert.equal(calls, 0)
  await assert.rejects(
    resolveOpenAIContext(supabase, { ...event, payload: { funnel_session_id: id } }),
    /^Error: OpenAI consent context unavailable$/,
  )
})
