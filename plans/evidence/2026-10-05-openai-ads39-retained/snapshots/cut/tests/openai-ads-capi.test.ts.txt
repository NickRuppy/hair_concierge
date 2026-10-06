import assert from "node:assert/strict"
import test from "node:test"
import type { BillingAnalyticsOutboxRow } from "../src/lib/billing/types"
import {
  sendOpenAIConversion,
  type OpenAICAPIDependencies,
} from "../src/lib/openai-ads/server/capi"

const NOW = Date.parse("2026-09-15T12:00:00Z")
const event: BillingAnalyticsOutboxRow = {
  id: "fixture-outbox",
  event_key: "stripe:purchase_completed:fixture-payment",
  event_name: "purchase_completed",
  user_id: "fixture-user",
  provider: "stripe",
  provider_customer_id: null,
  provider_subscription_id: null,
  source_event_id: "fixture-webhook",
  source_object_id: "fixture-payment",
  occurred_at: "2026-09-15T11:59:00Z",
  created_at: "2026-09-15T11:59:00Z",
  updated_at: "2026-09-15T11:59:00Z",
  payload: { value: 9.99, currency: "EUR" },
}
const configured = {
  OPENAI_ADS_ENABLED: "true",
  OPENAI_ADS_PIXEL_ID: "fixture-pixel",
  NEXT_PUBLIC_OPENAI_ADS_PIXEL_ID: "fixture-pixel",
  OPENAI_ADS_CAPI_KEY: "placeholder-for-unit-tests",
}
const context = {
  sourceUrl: "https://chaarlie.de/welcome?token=never-send#private",
  canonicalOrigin: "https://chaarlie.de",
  oppref: "opaque%2Bvalue",
  personalizationOptOut: true,
}
function dependencies(overrides: Partial<OpenAICAPIDependencies> = {}): OpenAICAPIDependencies {
  return {
    env: configured,
    now: () => NOW,
    resolveContext: async () => context,
    fetch: async () => new Response(null, { status: 202 }),
    ...overrides,
  }
}

test("disabled sending never reads consent context or calls the network", async () => {
  assert.deepEqual(
    await sendOpenAIConversion(
      event,
      dependencies({
        env: {},
        resolveContext: async () => {
          throw new Error("must not resolve")
        },
        fetch: async () => {
          throw new Error("must not send")
        },
      }),
    ),
    { outcome: "skipped", reason: "disabled" },
  )
})

test("missing or mismatched pixel/key configuration never calls the network", async () => {
  for (const env of [
    { ...configured, OPENAI_ADS_CAPI_KEY: "" },
    { ...configured, NEXT_PUBLIC_OPENAI_ADS_PIXEL_ID: "different" },
    { ...configured, OPENAI_ADS_PIXEL_ID: "" },
  ]) {
    assert.deepEqual(
      await sendOpenAIConversion(
        event,
        dependencies({
          env,
          fetch: async () => {
            assert.fail("must not send")
          },
        }),
      ),
      { outcome: "skipped", reason: "not_configured" },
    )
  }
})

test("denied context prevents transmission even when release configuration is enabled", async () => {
  assert.deepEqual(
    await sendOpenAIConversion(
      event,
      dependencies({
        resolveContext: async () => null,
        fetch: async () => {
          assert.fail("must not send")
        },
      }),
    ),
    { outcome: "skipped", reason: "consent_denied" },
  )
})

test("successful request uses CAPI schema and stable ID without private query or profile fields", async () => {
  let calls = 0
  const result = await sendOpenAIConversion(
    event,
    dependencies({
      fetch: async (url, init) => {
        calls += 1
        assert.equal(String(url), "https://bzr.openai.com/v1/events?pid=fixture-pixel")
        assert.equal(init?.method, "POST")
        assert.equal(init?.redirect, "error")
        assert.equal(
          new Headers(init?.headers).get("Authorization"),
          "Bearer placeholder-for-unit-tests",
        )
        assert.deepEqual(JSON.parse(String(init?.body)), {
          validate_only: false,
          events: [
            {
              id: "stripe:purchase_completed:fixture-payment",
              type: "order_created",
              timestamp_ms: Date.parse("2026-09-15T11:59:00Z"),
              source_url: "https://chaarlie.de/welcome",
              action_source: "web",
              oppref: "opaque%2Bvalue",
              opt_out: true,
              data: { type: "contents", amount: 999, currency: "EUR" },
            },
          ],
        })
        return new Response(null, { status: 202 })
      },
    }),
  )
  assert.equal(calls, 1)
  assert.deepEqual(result, { outcome: "accepted", status: 202 })
})

test("retries keep the identical conversion ID", async () => {
  const bodies: string[] = []
  const deps = dependencies({
    fetch: async (_url, init) => {
      bodies.push(String(init?.body))
      return new Response(null, { status: 202 })
    },
  })
  await sendOpenAIConversion(event, deps)
  await sendOpenAIConversion(event, deps)
  assert.equal(bodies.length, 2)
  assert.equal(bodies[0], bodies[1])
})

test("renewals and malformed events do not produce HTTP requests", async () => {
  for (const candidate of [
    { ...event, event_name: "payment_completed" as const },
    { ...event, payload: { value: 0, currency: "EUR" } },
    { ...event, occurred_at: "invalid" },
  ]) {
    assert.deepEqual(
      await sendOpenAIConversion(
        candidate,
        dependencies({
          fetch: async () => {
            assert.fail("must not send")
          },
        }),
      ),
      { outcome: "skipped", reason: "invalid_event" },
    )
  }
})

test("HTTP errors classify retryability without exposing response text", async () => {
  for (const [status, retryable] of [
    [400, false],
    [401, false],
    [403, false],
    [408, true],
    [429, true],
    [500, true],
  ] as const) {
    const result = await sendOpenAIConversion(
      event,
      dependencies({
        fetch: async () => new Response("private response content", { status }),
      }),
    )
    assert.deepEqual(result, { outcome: "failed", reason: "http_error", status, retryable })
  }
})

test("throwing context and network calls are contained and sanitized", async () => {
  for (const overrides of [
    {
      resolveContext: async () => {
        throw new Error("private context value")
      },
    },
    {
      fetch: async () => {
        throw new Error("placeholder-for-unit-tests")
      },
    },
  ]) {
    assert.deepEqual(await sendOpenAIConversion(event, dependencies(overrides)), {
      outcome: "failed",
      reason: "context_or_transport_error",
      retryable: true,
    })
  }
})

test("slow consent resolution times out and cannot send after returning", async () => {
  let release!: () => void
  let calls = 0
  const pending = new Promise<void>((resolve) => {
    release = resolve
  })
  const result = await sendOpenAIConversion(
    event,
    dependencies({
      timeoutMs: 10,
      resolveContext: async () => {
        await pending
        return context
      },
      fetch: async () => {
        calls++
        return new Response(null, { status: 202 })
      },
    }),
  )
  assert.deepEqual(result, { outcome: "failed", reason: "timeout", retryable: true })
  release()
  await new Promise((resolve) => setTimeout(resolve, 5))
  assert.equal(calls, 0)
})

test("unresponsive HTTP transport is bounded even if a test double ignores abort", async () => {
  assert.deepEqual(
    await sendOpenAIConversion(
      event,
      dependencies({
        timeoutMs: 10,
        fetch: async () => new Promise<Response>(() => {}),
      }),
    ),
    { outcome: "failed", reason: "timeout", retryable: true },
  )
})
