export type ProgressiveEntryLoaderOptions<T> = {
  loadModule: () => Promise<T>
  isOnline: () => boolean
  isVisible: () => boolean
  schedule: (callback: () => void, delayMs: number) => unknown
  cancel: (handle: unknown) => void
  onAttemptFailure?: (error: unknown, attempt: number) => void
}

export type ProgressiveEntryLoader<T> = {
  load: () => Promise<T>
  retryNow: () => void
  pause: () => void
  dispose: () => void
}

export function createProgressiveEntryLoader<T>({
  loadModule,
  isOnline,
  isVisible,
  schedule,
  cancel,
  onAttemptFailure,
}: ProgressiveEntryLoaderOptions<T>): ProgressiveEntryLoader<T> {
  let consumerPromise: Promise<T> | null = null
  let resolveConsumer: ((value: T) => void) | null = null
  let active = false
  let disposed = false
  let settled = false
  let failures = 0
  let retryHandle: unknown = null

  function clearScheduledRetry() {
    if (retryHandle === null) return
    cancel(retryHandle)
    retryHandle = null
  }

  function canAttempt() {
    return !disposed && !settled && isOnline() && isVisible()
  }

  function scheduleRetry() {
    if (!canAttempt() || retryHandle !== null) return
    const delayMs = Math.min(500 * 2 ** Math.max(0, failures - 1), 10_000)
    retryHandle = schedule(() => {
      retryHandle = null
      startAttempt()
    }, delayMs)
  }

  function startAttempt() {
    if (!canAttempt() || active) return
    active = true
    void loadModule().then(
      (module) => {
        active = false
        if (disposed || settled) return
        settled = true
        clearScheduledRetry()
        resolveConsumer?.(module)
      },
      (error: unknown) => {
        active = false
        if (disposed || settled) return
        failures += 1
        onAttemptFailure?.(error, failures)
        scheduleRetry()
      },
    )
  }

  function ensureConsumerPromise() {
    consumerPromise =
      consumerPromise ??
      new Promise<T>((resolve) => {
        resolveConsumer = resolve
      })
    return consumerPromise
  }

  return {
    load() {
      const promise = ensureConsumerPromise()
      startAttempt()
      return promise
    },
    retryNow() {
      if (!consumerPromise || active || settled || disposed) return
      clearScheduledRetry()
      startAttempt()
    },
    pause() {
      clearScheduledRetry()
    },
    dispose() {
      if (disposed) return
      disposed = true
      clearScheduledRetry()
    },
  }
}
