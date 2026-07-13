import assert from "node:assert/strict"
import test from "node:test"

import { createBoundedFifo } from "../src/lib/analytics/runtime/bounded-fifo"
import { createCustomerIoRuntime } from "../src/lib/analytics/runtime/customerio"
import { createCustomerIoTracker } from "../src/lib/customerio-tracking"
import {
  createPostHogRuntime,
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

test("PostHog bootstrap failure releases queued calls without registration", async () => {
  const calls: unknown[][] = []
  const runtime = createPostHogRuntime({
    loadClient: async () => createPostHogClient(calls),
  })

  runtime.posthog.capture("quiz_started", { step: 2 })
  runtime.configureContext(Promise.reject(new Error("context unavailable")))
  await runtime.release()

  assert.deepEqual(calls, [["capture", "quiz_started", { step: 2 }]])
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
    ["page", null, "/quiz", {}],
    ["identify", "user-1", { email: "test@example.com" }],
    ["track", "quiz_started", { step_number: 2 }],
    ["reset"],
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
