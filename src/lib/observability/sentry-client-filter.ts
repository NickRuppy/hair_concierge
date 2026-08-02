interface SentryStackFrameLike {
  filename?: string
  function?: string
}

interface SentryExceptionLike {
  value?: string
  stacktrace?: { frames?: SentryStackFrameLike[] }
}

interface SentryClientEventLike {
  exception?: { values?: unknown[] }
  message?: string
}

const IOS_NATIVE_BRIDGE_MESSAGE =
  "undefined is not an object (evaluating 'window.webkit.messageHandlers')"
const ANDROID_NATIVE_BRIDGE_MESSAGE = "Error invoking postMessage: Java object is gone"
const IOS_NATIVE_BRIDGE_FUNCTIONS = new Set(["sendDataToNative", "setupIosCallbackHandler"])
const ANDROID_NATIVE_BRIDGE_FRAME = "app://navigation_performance_logger_android"

export function filterMetaNativeBridgeEvent<Event extends SentryClientEventLike>(
  event: Event,
): Event | null {
  const exceptions = event.exception?.values?.filter(isSentryExceptionLike) ?? []

  for (const exception of exceptions) {
    const frames = Array.isArray(exception.stacktrace?.frames) ? exception.stacktrace.frames : []
    if (
      exception.value === IOS_NATIVE_BRIDGE_MESSAGE &&
      frames.some(
        (frame) =>
          /^app:\/\/[^/]/.test(frame.filename ?? "") &&
          IOS_NATIVE_BRIDGE_FUNCTIONS.has(frame.function ?? ""),
      )
    ) {
      return null
    }
    if (
      exception.value === ANDROID_NATIVE_BRIDGE_MESSAGE &&
      frames.some(
        (frame) =>
          frame.filename === ANDROID_NATIVE_BRIDGE_FRAME && frame.function === "sendDataToNative",
      )
    ) {
      return null
    }
  }

  return event
}

function isSentryExceptionLike(value: unknown): value is SentryExceptionLike {
  return typeof value === "object" && value !== null
}
