import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { initializeSentryClient, scheduleSentryAfterFirstPaint } from "../instrumentation-client"

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8")

test("client beforeSend filters Meta bridge noise before scrubbing retained events", () => {
  let beforeSend: ((event: never) => unknown) | undefined

  initializeSentryClient({
    init: (options) => {
      beforeSend = options.beforeSend as typeof beforeSend
      return undefined
    },
  })

  assert.ok(beforeSend)
  assert.equal(
    beforeSend({
      exception: {
        values: [
          {
            value: "undefined is not an object (evaluating 'window.webkit.messageHandlers')",
            stacktrace: {
              frames: [{ filename: "app://ios_bridge.js", function: "sendDataToNative" }],
            },
          },
        ],
      },
      request: { url: "/welcome?token=secret-token" },
    } as never),
    null,
  )

  const retained = beforeSend({
    exception: {
      values: [
        {
          value: "undefined is not an object (evaluating 'window.webkit.messageHandlers')",
          stacktrace: {
            frames: [{ filename: "app:///ios_bridge.js", function: "sendDataToNative" }],
          },
        },
      ],
    },
    request: { url: "/welcome?token=secret-token" },
  } as never) as { request?: { url?: string } }

  assert.equal(retained.request?.url, "/welcome?token=%5BFiltered%5D")
})

test("landing client entry points keep Sentry behind a dynamic import boundary", () => {
  const instrumentation = read("instrumentation-client.ts")
  const globalError = read("src/app/global-error.tsx")

  assert.match(instrumentation, /import type \* as Sentry from "@sentry\/nextjs"/)
  assert.match(instrumentation, /await import\("@sentry\/nextjs"\)/)
  assert.doesNotMatch(instrumentation, /import \* as Sentry from "@sentry\/nextjs"/)
  assert.doesNotMatch(globalError, /from "@sentry\/nextjs"/)
  assert.match(globalError, /captureSentryClientException\(error\)/)
})

test("Sentry starts in a task after the post-paint frame boundary", () => {
  const frames: Array<() => void> = []
  const tasks: Array<() => void> = []
  const cancelledTasks: number[] = []
  let callbackCalls = 0

  const cancel = scheduleSentryAfterFirstPaint(
    () => {
      callbackCalls += 1
    },
    (callback) => {
      frames.push(callback)
      return () => undefined
    },
    ((callback: () => void) => {
      tasks.push(callback)
      return 7
    }) as typeof setTimeout,
    ((id: number) => cancelledTasks.push(id)) as typeof clearTimeout,
  )

  frames[0]?.()
  assert.equal(callbackCalls, 0)
  assert.equal(tasks.length, 1)
  tasks[0]?.()
  assert.equal(callbackCalls, 1)
  cancel()
  assert.deepEqual(cancelledTasks, [7])
})
