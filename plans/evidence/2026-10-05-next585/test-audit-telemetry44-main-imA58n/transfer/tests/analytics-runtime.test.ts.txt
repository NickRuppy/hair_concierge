import assert from "node:assert/strict"
import test from "node:test"

import { createBoundedFifo } from "../src/lib/analytics/runtime/bounded-fifo"
import {
  createCustomerIoBrowserLoader,
  createCustomerIoRuntime,
} from "../src/lib/analytics/runtime/customerio"
import {
  createCustomerIoTracker,
  type CustomerIoBrowserClient,
} from "../src/lib/customerio-tracking"
import {
  createPostHogRuntime,
  sanitizePostHogProperties,
  sanitizePostHogSessionRecordingRequest,
  shouldMaskPostHogSessionRecordingInputs,
  type PostHogRuntimeClient,
} from "../src/lib/analytics/runtime/posthog"
import { scheduleAfterFirstPaint } from "../src/lib/analytics/runtime/post-paint"

test("bounded FIFO drops the oldest item and warns when full", () => {
  const warnings: string[] = []
  const queue = createBoundedFifo<number>({
    label: "test",
    limit: 2,
    warn: (message) => warnings.push(message),
  })

  queue.push(1)
  queue.push(2)
  queue.push(3)

  assert.deepEqual(queue.drain(), [2, 3])
  assert.equal(warnings.length, 1)
})

test("post-paint scheduling releases only after two animation frames", () => {
  const frames: FrameRequestCallback[] = []
  const calls: string[] = []
  const cancelled: number[] = []
  let nextFrameId = 0
  const requestFrame = (callback: FrameRequestCallback) => {
    frames.push(callback)
    nextFrameId += 1
    return nextFrameId
  }

  const cancel = scheduleAfterFirstPaint(
    () => calls.push("released"),
    requestFrame,
    (id) => cancelled.push(id),
  )

  assert.deepEqual(calls, [])
  frames.shift()?.(0)
  assert.deepEqual(calls, [])
  frames.shift()?.(16)
  assert.deepEqual(calls, ["released"])

  cancel()
  assert.deepEqual(cancelled, [1, 2])
})

function createPostHogClient(calls: unknown[][]): PostHogRuntimeClient {
  return {
    capture: (...args) => calls.push(["capture", ...args]),
    get_session_id: () => "session-123",
    identify: (...args) => calls.push(["identify", ...args]),
    register: (...args) => calls.push(["register", ...args]),
    reset: () => calls.push(["reset"]),
  }
}

test("PostHog registers settled funnel context before one FIFO flush", async () => {
  const calls: unknown[][] = []
  const runtime = createPostHogRuntime({
    loadClient: async () => createPostHogClient(calls),
    queueLimit: 10,
  })

  runtime.posthog.capture("$pageview", { path: "/" })
  runtime.posthog.identify("user-1", { email: "test@example.com" })
  runtime.configureContext(
    Promise.resolve({ funnelPackageKey: "default", funnelSessionId: "session-1" }),
  )
  await runtime.release()

  assert.deepEqual(calls, [
    ["register", { funnel_package_key: "default", funnel_session_id: "session-1" }],
    ["capture", "$pageview", { path: "/" }],
    ["identify", "user-1", { email: "test@example.com" }],
  ])
  assert.equal(runtime.posthog.get_session_id(), "session-123")
})

test("PostHog registers a later successful context after an initial bootstrap failure", async () => {
  const calls: unknown[][] = []
  const runtime = createPostHogRuntime({
    loadClient: async () => createPostHogClient(calls),
  })

  runtime.posthog.capture("quiz_started", { step: 2 })
  runtime.configureContext(Promise.reject(new Error("context unavailable")))
  await runtime.release()

  assert.deepEqual(calls, [["capture", "quiz_started", { step: 2 }]])

  await runtime.configureContext(
    Promise.resolve({ funnelPackageKey: "scan_v1", funnelSessionId: "session-2" }),
  )
  await Promise.resolve()
  assert.deepEqual(calls, [
    ["capture", "quiz_started", { step: 2 }],
    ["register", { funnel_package_key: "scan_v1", funnel_session_id: "session-2" }],
  ])
})

test("PostHog ignores a stale context that settles after a newer navigation", async () => {
  const calls: unknown[][] = []
  let resolveOld:
    | ((context: { funnelPackageKey: string; funnelSessionId: string }) => void)
    | undefined
  let resolveNew:
    | ((context: { funnelPackageKey: string; funnelSessionId: string }) => void)
    | undefined
  const oldContext = new Promise<{ funnelPackageKey: string; funnelSessionId: string }>(
    (resolve) => {
      resolveOld = resolve
    },
  )
  const newContext = new Promise<{ funnelPackageKey: string; funnelSessionId: string }>(
    (resolve) => {
      resolveNew = resolve
    },
  )
  const runtime = createPostHogRuntime({ loadClient: async () => createPostHogClient(calls) })

  runtime.configureContext(oldContext)
  runtime.configureContext(newContext)
  resolveOld?.({ funnelPackageKey: "old", funnelSessionId: "old-session" })
  await runtime.release()
  resolveNew?.({ funnelPackageKey: "scan_v1", funnelSessionId: "new-session" })
  await new Promise<void>((resolve) => setImmediate(resolve))

  assert.deepEqual(calls, [
    ["register", { funnel_package_key: "scan_v1", funnel_session_id: "new-session" }],
  ])
})

test("PostHog registers the newest context that settles before its client and preserves explicit events", async () => {
  const calls: unknown[][] = []
  let resolveClient: ((client: PostHogRuntimeClient) => void) | undefined
  let resolveFirst:
    | ((context: { funnelPackageKey: string; funnelSessionId: string }) => void)
    | undefined
  let resolveLatest:
    | ((context: { funnelPackageKey: string; funnelSessionId: string }) => void)
    | undefined
  const first = new Promise<{ funnelPackageKey: string; funnelSessionId: string }>((resolve) => {
    resolveFirst = resolve
  })
  const latest = new Promise<{ funnelPackageKey: string; funnelSessionId: string }>((resolve) => {
    resolveLatest = resolve
  })
  const runtime = createPostHogRuntime({
    loadClient: () =>
      new Promise<PostHogRuntimeClient>((resolve) => {
        resolveClient = resolve
      }),
  })

  runtime.posthog.capture("scanner_quiz_viewed", { funnel_session_id: "explicit-session" })
  runtime.configureContext(first)
  runtime.configureContext(latest)
  const released = runtime.release()
  resolveLatest?.({ funnelPackageKey: "scan_v1", funnelSessionId: "latest-session" })
  resolveFirst?.({ funnelPackageKey: "old", funnelSessionId: "old-session" })
  resolveClient?.(createPostHogClient(calls))
  await released

  assert.deepEqual(calls, [
    ["register", { funnel_package_key: "scan_v1", funnel_session_id: "latest-session" }],
    ["capture", "scanner_quiz_viewed", { funnel_session_id: "explicit-session" }],
  ])
})

test("PostHog preserves identify and reset ordering before readiness", async () => {
  const calls: unknown[][] = []
  const runtime = createPostHogRuntime({
    loadClient: async () => createPostHogClient(calls),
  })

  runtime.posthog.identify("user-1")
  runtime.posthog.reset()
  runtime.configureContext(Promise.resolve(null))
  await runtime.release()

  assert.deepEqual(calls, [["identify", "user-1", undefined], ["reset"]])
})

test("PostHog loader failure is isolated and stops accepting new calls", async () => {
  const runtime = createPostHogRuntime({
    loadClient: async () => {
      throw new Error("sdk unavailable")
    },
    warn: () => undefined,
  })

  assert.equal(runtime.posthog.capture("quiz_started"), true)
  runtime.configureContext(Promise.resolve(null))
  await runtime.release()
  assert.equal(runtime.posthog.capture("quiz_completed"), false)
})

test("PostHog removes sensitive queries and fragments from automatic URL properties", () => {
  assert.deepEqual(
    sanitizePostHogProperties({
      $current_url: "https://chaarlie.de/auth/update-password?code=recovery-code#access_token=x",
      $referrer: "https://chaarlie.de/welcome?session_id=stripe-session&token=paypal-token",
      $session_entry_referrer: "https://chaarlie.de/welcome?session_id=first-stripe-session",
      $session_entry_url: "https://chaarlie.de/auth/update-password?code=first-recovery-code",
      $set_once: {
        $initial_current_url:
          "https://chaarlie.de/result/lead-123?entry=quiz_completion&focus=routine&email=x",
      },
      offer_revision: "product_led_v2",
    }),
    {
      $current_url: "https://chaarlie.de/auth/update-password",
      $referrer: "https://chaarlie.de/welcome",
      $session_entry_referrer: "https://chaarlie.de/welcome",
      $session_entry_url: "https://chaarlie.de/auth/update-password",
      $set_once: {
        $initial_current_url:
          "https://chaarlie.de/result/lead-123?entry=quiz_completion&focus=routine",
      },
      offer_revision: "product_led_v2",
    },
  )
})

test("PostHog preserves the allowlisted quiz-return result context", () => {
  assert.equal(
    sanitizePostHogProperties({
      $current_url:
        "https://chaarlie.de/result/lead-123?entry=quiz_return&utm_source=repeat&resume_token=secret",
    }).$current_url,
    "https://chaarlie.de/result/lead-123?entry=quiz_return",
  )
})

test("PostHog removes sensitive queries from session replay URLs", () => {
  assert.deepEqual(
    sanitizePostHogSessionRecordingRequest({
      entryType: "resource",
      name: "https://chaarlie.de/auth/update-password?code=recovery-code#access_token=x",
    }),
    {
      entryType: "resource",
      name: "https://chaarlie.de/auth/update-password",
    },
  )
})

test("PostHog masks replay inputs unless unmasking is explicitly enabled", () => {
  assert.equal(shouldMaskPostHogSessionRecordingInputs(undefined), true)
  assert.equal(shouldMaskPostHogSessionRecordingInputs("false"), true)
  assert.equal(shouldMaskPostHogSessionRecordingInputs("TRUE"), true)
  assert.equal(shouldMaskPostHogSessionRecordingInputs("true"), false)
})

test("Customer.io bridges page, identify, track, and reset in FIFO order", () => {
  const calls: unknown[][] = []
  const tracker = createCustomerIoTracker({ queueLimit: 10 })

  tracker.page("/quiz")
  tracker.identify("user-1", { email: "test@example.com" })
  tracker.track("quiz_started", { step_number: 2 })
  tracker.reset()

  tracker.setClient({
    identify: (...args) => calls.push(["identify", ...args]),
    page: (...args) => calls.push(["page", ...args]),
    reset: () => calls.push(["reset"]),
    track: (...args) => calls.push(["track", ...args]),
  })

  assert.deepEqual(calls, [
    ["page", undefined, "/quiz", {}],
    ["identify", "user-1", { email: "test@example.com" }],
    ["track", "quiz_started", { step_number: 2 }],
    ["reset"],
  ])
})

test("Customer.io browser loader unwraps the SDK tuple before flushing queued calls", async () => {
  const calls: unknown[][] = []
  const tracker = createCustomerIoTracker({ queueLimit: 10 })
  const client: CustomerIoBrowserClient = {
    identify: (...args) => calls.push(["identify", ...args]),
    page: (...args) => calls.push(["page", ...args]),
    reset: () => calls.push(["reset"]),
    track: (...args) => calls.push(["track", ...args]),
  }
  const context = { source: "fake-sdk" }
  const settings: unknown[] = []
  const loadResult: PromiseLike<[CustomerIoBrowserClient, typeof context]> = {
    then(onFulfilled, onRejected) {
      return Promise.resolve([client, context] as [CustomerIoBrowserClient, typeof context]).then(
        onFulfilled,
        onRejected,
      )
    },
  }

  tracker.page("/result/lead-123?entry=quiz_completion", {
    entry_context: "quiz_completion",
  })
  tracker.track("pricing_viewed", { lead_id: "lead-123" })

  const loadClient = createCustomerIoBrowserLoader({
    browserAvailable: () => true,
    cdnURL: "https://cdp-eu.customer.io",
    importSdk: async () => ({
      AnalyticsBrowser: {
        load(nextSettings) {
          settings.push(nextSettings)
          return loadResult
        },
      },
    }),
    writeKey: "write-key",
  })
  const runtime = createCustomerIoRuntime({
    loadClient,
    onReady: (nextClient) => tracker.setClient(nextClient),
  })

  assert.equal(await runtime.start(), true)
  assert.deepEqual(settings, [{ cdnURL: "https://cdp-eu.customer.io", writeKey: "write-key" }])
  assert.deepEqual(calls, [
    [
      "page",
      undefined,
      "/result/lead-123?entry=quiz_completion",
      { entry_context: "quiz_completion" },
    ],
    ["track", "pricing_viewed", { lead_id: "lead-123" }],
  ])
})

test("Customer.io loader is single-flight and connects the client once", async () => {
  const calls: string[] = []
  const client = {
    identify: () => undefined,
    page: () => undefined,
    reset: () => undefined,
    track: () => undefined,
  }
  const runtime = createCustomerIoRuntime({
    loadClient: async () => {
      calls.push("load")
      return client
    },
    onReady: (nextClient) => {
      assert.equal(nextClient, client)
      calls.push("ready")
    },
  })

  const firstStart = runtime.start()
  const secondStart = runtime.start()

  assert.equal(firstStart, secondStart)
  assert.equal(await firstStart, true)
  assert.deepEqual(calls, ["load", "ready"])
})

test("Customer.io loader failure is isolated and disables its queue", async () => {
  const calls: string[] = []
  const runtime = createCustomerIoRuntime({
    loadClient: async () => {
      throw new Error("sdk unavailable")
    },
    onUnavailable: () => calls.push("unavailable"),
    warn: () => calls.push("warn"),
  })

  assert.equal(await runtime.start(), false)
  assert.equal(await runtime.start(), false)
  assert.deepEqual(calls, ["unavailable", "warn"])
})
