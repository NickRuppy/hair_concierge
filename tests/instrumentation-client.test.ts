import assert from "node:assert/strict"
import test from "node:test"
import { initializeSentryClient } from "../instrumentation-client"

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
