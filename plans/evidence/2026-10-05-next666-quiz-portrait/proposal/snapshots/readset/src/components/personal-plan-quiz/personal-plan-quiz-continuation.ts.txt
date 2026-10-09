import { lazy } from "react"

import { createProgressiveEntryLoader } from "./progressive-entry-runtime"
import { captureSentryClientException } from "@/lib/observability/sentry-client-runtime"

type QuizContinuationModule = {
  default: typeof import("./personal-plan-quiz").PersonalPlanQuiz
}

let failureCount = 0
const listeners = new Set<() => void>()

function notifyFailure(error: unknown, attempt: number) {
  failureCount += 1
  for (const listener of listeners) listener()
  if (attempt !== 1 || typeof window === "undefined") return
  const exception =
    error instanceof Error ? error : new Error("Personal Plan continuation failed to load")
  captureSentryClientException(exception, "onerror")
}

const loader = createProgressiveEntryLoader<QuizContinuationModule>({
  loadModule: () =>
    import("./personal-plan-quiz").then((module) => ({ default: module.PersonalPlanQuiz })),
  isOnline: () => typeof navigator === "undefined" || navigator.onLine,
  isVisible: () => typeof document === "undefined" || document.visibilityState === "visible",
  schedule: (callback, delayMs) => setTimeout(callback, delayMs),
  cancel: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  onAttemptFailure: notifyFailure,
})

export const RecoveringLazyPersonalPlanQuiz = lazy(loader.load)
export const ServerResumeLazyPersonalPlanQuiz = lazy(() =>
  import("./personal-plan-quiz").then((module) => ({ default: module.PersonalPlanQuiz })),
)

export function subscribeToPersonalPlanContinuationFailures(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) loader.pause()
  }
}

export function getPersonalPlanContinuationFailureCount() {
  return failureCount
}

export function retryPersonalPlanContinuationNow() {
  loader.retryNow()
}
