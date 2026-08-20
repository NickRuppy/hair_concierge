import assert from "node:assert/strict"
import test from "node:test"

import {
  captureSentryClientException,
  createSentryClientRuntime,
  setActiveSentryClientRuntime,
  type SentryClientModule,
} from "../src/lib/observability/sentry-client-runtime"

type Listener = (event: unknown) => void

class FakeEventSource {
  private listeners = new Map<string, Set<Listener>>()

  addEventListener(type: "error" | "unhandledrejection", listener: Listener) {
    const listeners = this.listeners.get(type) ?? new Set<Listener>()
    listeners.add(listener)
    this.listeners.set(type, listeners)
  }

  removeEventListener(type: "error" | "unhandledrejection", listener: Listener) {
    this.listeners.get(type)?.delete(listener)
  }

  dispatch(type: "error" | "unhandledrejection", event: unknown) {
    for (const listener of this.listeners.get(type) ?? []) listener(event)
  }

  count(type: "error" | "unhandledrejection") {
    return this.listeners.get(type)?.size ?? 0
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, reject, resolve }
}

function createClient(calls: unknown[][]): SentryClientModule {
  return {
    captureException: (...args) => calls.push(["captureException", ...args]),
    captureRouterTransitionStart: (...args) =>
      calls.push(["captureRouterTransitionStart", ...args]),
  }
}

function createHarness(options: { initializeError?: Error; queueLimit?: number } = {}) {
  const calls: unknown[][] = []
  const eventSource = new FakeEventSource()
  const load = deferred<SentryClientModule>()
  const scheduled: Array<() => void> = []
  let cancelled = 0
  let loadCount = 0
  const runtime = createSentryClientRuntime({
    eventSource,
    initializeClient: (client) => {
      calls.push([
        "initialize",
        client,
        eventSource.count("error"),
        eventSource.count("unhandledrejection"),
      ])
      if (options.initializeError) throw options.initializeError
    },
    loadClient: () => {
      loadCount += 1
      return load.promise
    },
    queueLimit: options.queueLimit,
    scheduleAfterPaint: (callback) => {
      scheduled.push(callback)
      return () => {
        cancelled += 1
      }
    },
    warn: (...args) => calls.push(["warn", ...args]),
  })
  return {
    calls,
    eventSource,
    get cancelled() {
      return cancelled
    },
    load,
    get loadCount() {
      return loadCount
    },
    runtime,
    scheduled,
  }
}

test("exact landing routes wait for post-paint while every other route starts immediately", async () => {
  for (const pathname of ["/", "/lp/haarplan", "/lp/haarplan/"]) {
    const harness = createHarness()
    await harness.runtime.start(pathname)
    assert.equal(harness.loadCount, 0, pathname)
    assert.equal(harness.scheduled.length, 1, pathname)
    harness.scheduled[0]?.()
    assert.equal(harness.loadCount, 1, pathname)
  }

  for (const pathname of ["/quiz", "/lp/haarplan/angebot", "/result/lead-1"]) {
    const harness = createHarness()
    void harness.runtime.start(pathname)
    assert.equal(harness.loadCount, 1, pathname)
    assert.equal(harness.scheduled.length, 0, pathname)
  }
})

test("the first early browser error force-loads and flushes once with its mechanism", async () => {
  const harness = createHarness()
  await harness.runtime.start("/")
  const error = new Error("landing failed")

  harness.eventSource.dispatch("error", { error, message: "ignored fallback" })

  assert.equal(harness.loadCount, 1)
  assert.equal(harness.cancelled, 1)
  harness.load.resolve(createClient(harness.calls))
  await Promise.resolve()
  await Promise.resolve()

  assert.deepEqual(
    harness.calls.slice(0, 2).map(([name]) => name),
    ["initialize", "captureException"],
  )
  assert.deepEqual(harness.calls[0]?.slice(2), [0, 0])
  assert.deepEqual(harness.calls[1]?.slice(1), [
    error,
    { mechanism: { type: "onerror", handled: false } },
  ])
  assert.equal(harness.eventSource.count("error"), 0)
  assert.equal(harness.eventSource.count("unhandledrejection"), 0)
})

test("fallback browser errors retain source location without serializing event objects", async () => {
  const harness = createHarness()
  await harness.runtime.start("/")
  harness.eventSource.dispatch("error", {
    colno: 9,
    filename: "https://chaarlie.de/landing.js?token=secret",
    lineno: 42,
    message: "Script error.",
  })
  harness.load.resolve(createClient(harness.calls))
  await Promise.resolve()
  await Promise.resolve()

  const capture = harness.calls.find(([name]) => name === "captureException")
  const error = capture?.[1] as Error
  assert.equal(error.message, "Script error.")
  assert.match(error.stack ?? "", /landing\.js\?token=secret:42:9/)
})

test("bounded FIFO drops the oldest exception and preserves rejection order", async () => {
  const harness = createHarness({ queueLimit: 2 })
  await harness.runtime.start("/")
  harness.eventSource.dispatch("unhandledrejection", { reason: "first" })
  harness.eventSource.dispatch("unhandledrejection", { reason: new Error("second") })
  harness.eventSource.dispatch("unhandledrejection", { reason: { secret: "do not serialize" } })
  harness.load.resolve(createClient(harness.calls))
  await Promise.resolve()
  await Promise.resolve()

  const captures = harness.calls.filter(([name]) => name === "captureException")
  assert.equal(captures.length, 2)
  assert.equal((captures[0]?.[1] as Error).message, "second")
  assert.equal((captures[1]?.[1] as Error).message, "Unhandled promise rejection")
  assert.deepEqual(
    captures.map((call) => call[2]),
    [
      { mechanism: { type: "onunhandledrejection", handled: false } },
      { mechanism: { type: "onunhandledrejection", handled: false } },
    ],
  )
})

test("React-boundary capture uses the shared facade and force-starts loading", async () => {
  const harness = createHarness()
  await harness.runtime.start("/")
  setActiveSentryClientRuntime(harness.runtime)
  const error = new Error("hydration failed")

  assert.equal(captureSentryClientException(error), true)
  assert.equal(harness.loadCount, 1)
  harness.load.resolve(createClient(harness.calls))
  await Promise.resolve()
  await Promise.resolve()

  const capture = harness.calls.find(([name]) => name === "captureException")
  assert.deepEqual(capture?.slice(1), [error, { mechanism: { type: "react", handled: true } }])
  setActiveSentryClientRuntime(null)
})

test("the shared facade warns in development when no runtime is registered", () => {
  setActiveSentryClientRuntime(null)
  const warnings: unknown[][] = []
  const originalWarn = console.warn
  console.warn = (...args) => warnings.push(args)
  try {
    assert.equal(captureSentryClientException(new Error("unregistered")), false)
  } finally {
    console.warn = originalWarn
  }
  assert.equal(warnings.length, 1)
  assert.match(String(warnings[0]?.[0]), /before client runtime registration/)
})

test("concurrent releases share one load and later router transitions forward", async () => {
  const harness = createHarness()
  void harness.runtime.start("/quiz")
  harness.runtime.captureException(new Error("early"))
  assert.equal(harness.loadCount, 1)
  const client = createClient(harness.calls)
  harness.load.resolve(client)
  await Promise.resolve()
  await Promise.resolve()

  harness.runtime.onRouterTransitionStart("/next", "push")
  assert.equal(harness.loadCount, 1)
  assert.deepEqual(harness.calls.at(-1), ["captureRouterTransitionStart", "/next", "push"])
})

test("loader failure removes listeners, clears queued errors, and never throws", async () => {
  const harness = createHarness()
  void harness.runtime.start("/quiz")
  harness.eventSource.dispatch("error", { message: "early failure" })
  harness.load.reject(new Error("sdk unavailable"))
  await Promise.resolve()
  await Promise.resolve()

  assert.equal(harness.eventSource.count("error"), 0)
  assert.equal(harness.eventSource.count("unhandledrejection"), 0)
  assert.equal(harness.runtime.captureException(new Error("late")), false)
  assert.deepEqual(
    harness.calls.map(([name]) => name),
    ["warn"],
  )
})

test("initialization failure is isolated after temporary listeners are removed", async () => {
  const harness = createHarness({ initializeError: new Error("init failed") })
  void harness.runtime.start("/quiz")
  harness.eventSource.dispatch("error", { message: "early failure" })
  harness.load.resolve(createClient(harness.calls))
  await Promise.resolve()
  await Promise.resolve()

  assert.deepEqual(
    harness.calls.map(([name]) => name),
    ["initialize", "warn"],
  )
  assert.deepEqual(harness.calls[0]?.slice(2), [0, 0])
  assert.equal(harness.runtime.captureException(new Error("late")), false)
})
