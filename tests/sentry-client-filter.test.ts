import assert from "node:assert/strict"
import test from "node:test"
import { filterMetaNativeBridgeEvent } from "../src/lib/observability/sentry-client-filter"
import { scrubSentryEvent } from "../src/lib/observability/checkout"

const IOS_MESSAGE = "undefined is not an object (evaluating 'window.webkit.messageHandlers')"
const ANDROID_MESSAGE = "Error invoking postMessage: Java object is gone"

function eventWith({
  message,
  filename,
  functionName,
  token = "secret-token",
}: {
  message: string
  filename: string
  functionName: string
  token?: string
}) {
  return {
    exception: {
      values: [
        {
          value: message,
          stacktrace: {
            frames: [{ filename, function: functionName }],
          },
        },
      ],
    },
    request: { url: `/welcome?token=${token}` },
  }
}

test("drops only proven iOS Meta native bridge signatures", () => {
  for (const functionName of ["sendDataToNative", "setupIosCallbackHandler"]) {
    assert.equal(
      filterMetaNativeBridgeEvent(
        eventWith({
          message: IOS_MESSAGE,
          filename: "app://ios_bridge.js",
          functionName,
        }),
      ),
      null,
    )
  }
})

test("drops only proven Android Meta native bridge signatures", () => {
  assert.equal(
    filterMetaNativeBridgeEvent(
      eventWith({
        message: ANDROID_MESSAGE,
        filename: "app://navigation_performance_logger_android",
        functionName: "sendDataToNative",
      }),
    ),
    null,
  )
})

test("retains incomplete and near-miss native bridge signatures and scrubs them", () => {
  const fixtures = [
    eventWith({
      message: IOS_MESSAGE,
      filename: "https://chaarlie.com/app.js",
      functionName: "sendDataToNative",
    }),
    eventWith({
      message: "different message",
      filename: "app://ios_bridge.js",
      functionName: "sendDataToNative",
    }),
    eventWith({
      message: IOS_MESSAGE,
      filename: "app://ios_bridge.js",
      functionName: "otherFunction",
    }),
    eventWith({
      message: ANDROID_MESSAGE,
      filename: "app://navigation_performance_logger_android",
      functionName: "otherFunction",
    }),
    eventWith({
      message: ANDROID_MESSAGE,
      filename: "app://navigation_performance_logger_android.js",
      functionName: "sendDataToNative",
    }),
    eventWith({
      message: IOS_MESSAGE,
      filename: "app:///ios_bridge.js",
      functionName: "sendDataToNative",
    }),
    eventWith({
      message: IOS_MESSAGE,
      filename: "https://chaarlie.com/app.js",
      functionName: "setupIosCallbackHandler",
    }),
  ]

  for (const event of fixtures) {
    const retained = filterMetaNativeBridgeEvent(event)
    assert.notEqual(retained, null)
    assert.equal(scrubSentryEvent(retained!).request.url, "/welcome?token=%5BFiltered%5D")
  }
})
