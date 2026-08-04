export const DEFAULT_PROVIDER_WATCHDOG_TIMEOUT_MS = 15_000

export type CheckoutWatchdog = {
  settle: () => void
}

export function createCheckoutWatchdog({
  onTimeout,
  schedule = (callback, delayMs) => globalThis.setTimeout(callback, delayMs),
  timeoutMs = DEFAULT_PROVIDER_WATCHDOG_TIMEOUT_MS,
}: {
  onTimeout: (durationMs: number) => void
  schedule?: (callback: () => void, delayMs: number) => ReturnType<typeof globalThis.setTimeout>
  timeoutMs?: number
}): CheckoutWatchdog {
  const startedAt = Date.now()
  let reported = false
  let settled = false
  const timer = schedule(() => {
    if (settled || reported) return
    reported = true
    onTimeout(Math.max(0, Date.now() - startedAt))
  }, timeoutMs)

  return {
    settle() {
      settled = true
      clearTimeout(timer)
    },
  }
}

export function createCheckoutWatchdogRegistry() {
  const active = new Set<CheckoutWatchdog>()

  return {
    settle(watchdog: CheckoutWatchdog) {
      watchdog.settle()
      active.delete(watchdog)
    },
    settleAll() {
      for (const watchdog of active) watchdog.settle()
      active.clear()
    },
    track(watchdog: CheckoutWatchdog) {
      active.add(watchdog)
      return watchdog
    },
  }
}
