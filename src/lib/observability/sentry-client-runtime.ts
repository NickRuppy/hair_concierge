import { createBoundedFifo } from "@/lib/analytics/runtime/bounded-fifo"

export type SentryExceptionMechanism = "onerror" | "onunhandledrejection" | "react"

export type SentryClientModule = {
  captureException: (
    error: Error,
    hint?: { mechanism?: { type: SentryExceptionMechanism; handled: boolean } },
  ) => unknown
  captureRouterTransitionStart: (...args: unknown[]) => unknown
}

type SentryEventSource = {
  addEventListener: (
    type: "error" | "unhandledrejection",
    listener: (event: unknown) => void,
  ) => void
  removeEventListener: (
    type: "error" | "unhandledrejection",
    listener: (event: unknown) => void,
  ) => void
}

type SentryClientRuntimeOptions = {
  eventSource: SentryEventSource
  initializeClient: (client: SentryClientModule) => void
  loadClient: () => Promise<SentryClientModule>
  queueLimit?: number
  scheduleAfterPaint: (callback: () => void) => () => void
  warn?: (message: string, error?: unknown) => void
}

export function createSentryClientRuntime(_options: SentryClientRuntimeOptions) {
  const {
    eventSource,
    initializeClient,
    loadClient,
    queueLimit = 10,
    scheduleAfterPaint,
    warn = defaultWarn,
  } = _options
  const queue = createBoundedFifo<{ error: Error; mechanism: SentryExceptionMechanism }>({
    label: "Sentry",
    limit: queueLimit,
    warn: (message) => warn(message),
  })
  let cancelScheduledStart: (() => void) | null = null
  let client: SentryClientModule | null = null
  let failed = false
  let listenersInstalled = false
  let released = false
  let startPromise: Promise<void> | null = null

  const removeTemporaryListeners = () => {
    if (!listenersInstalled) return
    eventSource.removeEventListener("error", onError)
    eventSource.removeEventListener("unhandledrejection", onUnhandledRejection)
    listenersInstalled = false
  }

  const dispatch = (error: Error, mechanism: SentryExceptionMechanism) => {
    if (!client) return false
    try {
      client.captureException(error, {
        mechanism: { type: mechanism, handled: mechanism === "react" },
      })
      return true
    } catch (captureError) {
      warn("[observability] Sentry capture failed", captureError)
      return false
    }
  }

  const maybeStart = () => {
    if (!released || startPromise) return startPromise
    cancelScheduledStart?.()
    cancelScheduledStart = null

    startPromise = loadClient()
      .then((nextClient) => {
        removeTemporaryListeners()
        initializeClient(nextClient)
        client = nextClient
        for (const item of queue.drain()) dispatch(item.error, item.mechanism)
      })
      .catch((error) => {
        client = null
        failed = true
        removeTemporaryListeners()
        queue.clear()
        warn("[observability] Sentry loader failed", error)
      })

    return startPromise
  }

  const release = () => {
    released = true
    return maybeStart() ?? Promise.resolve()
  }

  const enqueueOrDispatch = (error: Error, mechanism: SentryExceptionMechanism) => {
    if (failed) return false
    if (client) return dispatch(error, mechanism)
    queue.push({ error, mechanism })
    void release()
    return true
  }

  function onError(event: unknown) {
    const candidate = event as { error?: unknown; message?: unknown }
    const error =
      candidate.error instanceof Error ? candidate.error : createBrowserFallbackError(candidate)
    enqueueOrDispatch(error, "onerror")
  }

  function onUnhandledRejection(event: unknown) {
    const reason = (event as { reason?: unknown }).reason
    const error =
      reason instanceof Error
        ? reason
        : new Error(
            typeof reason === "string" && reason.length > 0
              ? reason
              : "Unhandled promise rejection",
          )
    enqueueOrDispatch(error, "onunhandledrejection")
  }

  const installTemporaryListeners = () => {
    if (listenersInstalled || failed || client) return
    eventSource.addEventListener("error", onError)
    eventSource.addEventListener("unhandledrejection", onUnhandledRejection)
    listenersInstalled = true
  }

  return {
    captureException(error: Error, mechanism: SentryExceptionMechanism = "react") {
      return enqueueOrDispatch(error, mechanism)
    },
    onRouterTransitionStart(...args: unknown[]) {
      if (!client) return
      try {
        client.captureRouterTransitionStart(...args)
      } catch (error) {
        warn("[observability] Sentry router instrumentation failed", error)
      }
    },
    start(pathname: string) {
      installTemporaryListeners()
      if (isDeferredLandingPath(pathname)) {
        if (!cancelScheduledStart && !released) {
          cancelScheduledStart = scheduleAfterPaint(() => {
            cancelScheduledStart = null
            void release()
          })
        }
        return Promise.resolve()
      }
      return release()
    },
  }
}

function isDeferredLandingPath(pathname: string) {
  const withoutQuery = pathname.split(/[?#]/, 1)[0] || "/"
  const normalized = withoutQuery === "/" ? "/" : withoutQuery.replace(/\/+$/, "") || "/"
  return normalized === "/" || normalized === "/lp/haarplan"
}

function createBrowserFallbackError(candidate: {
  colno?: unknown
  filename?: unknown
  lineno?: unknown
  message?: unknown
}) {
  const error = new Error(
    typeof candidate.message === "string" && candidate.message.length > 0
      ? candidate.message
      : "Unhandled browser error",
  )
  if (typeof candidate.filename !== "string" || candidate.filename.length === 0) return error

  const line = typeof candidate.lineno === "number" ? candidate.lineno : 0
  const column = typeof candidate.colno === "number" ? candidate.colno : 0
  error.stack = `${error.name}: ${error.message}\n    at ${candidate.filename}:${line}:${column}`
  return error
}

function defaultWarn(message: string, error?: unknown) {
  if (process.env.NODE_ENV !== "production") console.warn(message, error)
}

type SentryClientRuntime = ReturnType<typeof createSentryClientRuntime>
let activeRuntime: SentryClientRuntime | null = null

export function setActiveSentryClientRuntime(runtime: SentryClientRuntime | null) {
  activeRuntime = runtime
}

export function captureSentryClientException(
  error: Error,
  mechanism: SentryExceptionMechanism = "react",
) {
  if (!activeRuntime) {
    defaultWarn("[observability] Sentry capture requested before client runtime registration")
    return false
  }
  return activeRuntime.captureException(error, mechanism)
}
