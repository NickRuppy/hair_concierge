import assert from "node:assert/strict"
import test from "node:test"

import { createFunnelContextBootstrap, parseFunnelContext } from "../src/lib/funnel/client"

const scannerContext = {
  entryPath: "/lp/scan",
  funnelPackageKey: "scan_v1",
  funnelSessionId: "session-1",
  isInternalTest: false,
  issuedAt: 1_726_000_000_000,
  testKind: "field_test",
  utmCampaign: "scanner-launch",
  utmMedium: "paid_social",
  utmSource: "meta",
}

test("funnel context only admits the allowlisted server envelope", () => {
  assert.deepEqual(
    parseFunnelContext({
      ...scannerContext,
      email: "private@example.com",
      entryPath: "https://bad",
    }),
    {
      funnelPackageKey: "scan_v1",
      funnelSessionId: "session-1",
      isInternalTest: false,
      issuedAt: 1_726_000_000_000,
      testKind: "field_test",
      utmCampaign: "scanner-launch",
      utmMedium: "paid_social",
      utmSource: "meta",
    },
  )
  assert.equal(parseFunnelContext({ funnelSessionId: "session-1" }), null)
})

test("failed bounded bootstrap retries and a later caller can retry again", async () => {
  let calls = 0
  const bootstrap = createFunnelContextBootstrap({
    fetchContext: async () => {
      calls += 1
      if (calls < 3) throw new Error("temporary failure")
      return new Response(JSON.stringify(scannerContext), { status: 200 })
    },
    maxAttempts: 2,
    retryDelayMs: 0,
    timeoutMs: 20,
    wait: async () => undefined,
  })

  assert.equal(await bootstrap.bootstrap(), null)
  assert.deepEqual(await bootstrap.bootstrap(), parseFunnelContext(scannerContext))
  assert.equal(calls, 3)
})

test("a timed-out request is bounded and the following attempt can recover", async () => {
  let calls = 0
  const bootstrap = createFunnelContextBootstrap({
    fetchContext: async () => {
      calls += 1
      if (calls === 1) return new Promise<Response>(() => undefined)
      return new Response(JSON.stringify(scannerContext), { status: 200 })
    },
    maxAttempts: 2,
    retryDelayMs: 0,
    timeoutMs: 5,
    wait: async () => undefined,
  })

  assert.deepEqual(await bootstrap.bootstrap(), parseFunnelContext(scannerContext))
  assert.equal(calls, 2)
})

test("milestone identity retains acquisition fields and a slow older GET cannot replace a new journey", async () => {
  let resolveFetch: ((response: Response) => void) | undefined
  const bootstrap = createFunnelContextBootstrap({
    fetchContext: () =>
      new Promise<Response>((resolve) => {
        resolveFetch = resolve
      }),
    maxAttempts: 1,
    timeoutMs: 100,
  })

  const pending = bootstrap.bootstrap()
  bootstrap.setCurrentContext(
    parseFunnelContext({ ...scannerContext, funnelSessionId: "new-session" })!,
  )
  resolveFetch?.(new Response(JSON.stringify(scannerContext), { status: 200 }))
  assert.equal((await pending)?.funnelSessionId, "new-session")

  bootstrap.setCurrentContext(
    parseFunnelContext({
      funnelPackageKey: "scan_v1",
      funnelSessionId: "new-session",
    })!,
  )
  assert.deepEqual(bootstrap.getCurrentContext(), {
    ...parseFunnelContext({ ...scannerContext, funnelSessionId: "new-session" }),
  })
})

test("a successful retry publishes its resolved context to subscribers", async () => {
  const seen: string[] = []
  const bootstrap = createFunnelContextBootstrap({
    fetchContext: async () => new Response(JSON.stringify(scannerContext), { status: 200 }),
    maxAttempts: 1,
  })
  bootstrap.subscribe((context) => seen.push(context.funnelSessionId))

  await bootstrap.bootstrap()
  assert.deepEqual(seen, ["session-1"])
})

test("a same-journey milestone arriving before GET does not discard acquisition enrichment", async () => {
  let resolveFetch!: (response: Response) => void
  const bootstrap = createFunnelContextBootstrap({
    fetchContext: () =>
      new Promise<Response>((resolve) => {
        resolveFetch = resolve
      }),
    maxAttempts: 1,
  })
  const pending = bootstrap.bootstrap()
  bootstrap.setCurrentContext({ funnelSessionId: "session-1", funnelPackageKey: "scan_v1" })
  const secondCaller = bootstrap.bootstrap()
  resolveFetch(new Response(JSON.stringify(scannerContext), { status: 200 }))

  assert.deepEqual(await pending, parseFunnelContext(scannerContext))
  assert.deepEqual(await secondCaller, parseFunnelContext(scannerContext))
  assert.deepEqual(bootstrap.getCurrentContext(), parseFunnelContext(scannerContext))
})

test("an identity-only milestone before bootstrap still permits the acquisition GET", async () => {
  let calls = 0
  const bootstrap = createFunnelContextBootstrap({
    fetchContext: async () => {
      calls += 1
      return new Response(JSON.stringify(scannerContext), { status: 200 })
    },
  })
  bootstrap.setCurrentContext({ funnelSessionId: "session-1", funnelPackageKey: "scan_v1" })
  assert.deepEqual(await bootstrap.bootstrap(), parseFunnelContext(scannerContext))
  assert.deepEqual(await bootstrap.bootstrap(), parseFunnelContext(scannerContext))
  assert.equal(calls, 1)
})

test("a successful HTTP response with incomplete scanner metadata is retried and never cached as ready", async () => {
  let calls = 0
  const partial = {
    funnelSessionId: "session-1",
    funnelPackageKey: "scan_v1",
    analyticsContextReady: false,
  }
  const ready = { ...scannerContext, analyticsContextReady: true }
  const bootstrap = createFunnelContextBootstrap({
    maxAttempts: 2,
    wait: async () => undefined,
    fetchContext: async () => new Response(JSON.stringify(++calls <= 2 ? partial : ready)),
  })
  assert.deepEqual(await bootstrap.bootstrap(), partial)
  assert.deepEqual(await bootstrap.bootstrap(), parseFunnelContext(ready))
  assert.equal(calls, 3)
})
