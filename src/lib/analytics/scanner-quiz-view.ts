import {
  bootstrapFunnelContext,
  createFunnelEventId,
  type CurrentFunnelContext,
} from "@/lib/funnel/client"
import { trackAppEvent } from "./track-app-event"

type Retry = (callback: () => void) => void

/**
 * Packages whose quiz entry gets a one-shot view snapshot, and the event each
 * one emits. Separate event names keep the scanner's PostHog queries intact.
 */
const QUIZ_VIEW_EVENTS = {
  scan_v1: "scanner_quiz_viewed",
  discovery_call_v1: "discovery_call_quiz_viewed",
} as const

export function quizViewEventForPackage(packageKey: string | null | undefined) {
  return packageKey ? (QUIZ_VIEW_EVENTS[packageKey as keyof typeof QUIZ_VIEW_EVENTS] ?? null) : null
}

const scheduleRetry: Retry = (callback) => {
  setTimeout(callback, 150)
}

export function createScannerQuizViewTracker({
  bootstrap = bootstrapFunnelContext,
  createId = createFunnelEventId,
  now = () => new Date().toISOString(),
  track = trackAppEvent,
  retry = scheduleRetry,
}: {
  bootstrap?: () => Promise<CurrentFunnelContext | null>
  createId?: typeof createFunnelEventId
  now?: () => string
  track?: typeof trackAppEvent
  retry?: Retry
} = {}) {
  // Keyed by package: a mid-bootstrap package hand-off (the provider may
  // republish a different key) must not leave BOTH funnels without their
  // one-shot snapshot.
  let settledFor: string | null = null

  return ({
    displayedFunnelPackageKey,
    isCurrent = () => true,
    resumed,
    step,
  }: {
    displayedFunnelPackageKey: string
    isCurrent?: () => boolean
    resumed: boolean
    step: number
  }) => {
    if (settledFor === displayedFunnelPackageKey) return
    const eventName = quizViewEventForPackage(displayedFunnelPackageKey)
    if (!eventName) return
    const viewedAt = now()
    const quizViewId = createId()
    // Keep a single immutable view snapshot per package while the bounded
    // context lookup resolves.
    settledFor = displayedFunnelPackageKey
    const attempt = (number: number) => {
      void bootstrap()
        .then((context) => {
          if (
            context?.funnelPackageKey === displayedFunnelPackageKey &&
            context.analyticsContextReady !== false &&
            isCurrent()
          ) {
            track(eventName, {
              funnelEventId: quizViewId,
              funnelPackageKey: context.funnelPackageKey,
              funnelSessionId: context.funnelSessionId,
              isResumed: resumed,
              quizStep: step,
              quizViewId,
              scannerTrackingVersion: 1,
              viewedAt,
              ...(context.issuedAt === undefined
                ? {}
                : { entryAt: new Date(context.issuedAt).toISOString() }),
              ...(context.entryPath ? { entryPath: context.entryPath } : {}),
              ...(context.isInternalTest === undefined
                ? {}
                : { isInternalTest: context.isInternalTest }),
              ...(context.testKind ? { testKind: context.testKind } : {}),
              ...(context.utmCampaign ? { utmCampaign: context.utmCampaign } : {}),
              ...(context.utmContent ? { utmContent: context.utmContent } : {}),
              ...(context.utmMedium ? { utmMedium: context.utmMedium } : {}),
              ...(context.utmSource ? { utmSource: context.utmSource } : {}),
              ...(context.utmTerm ? { utmTerm: context.utmTerm } : {}),
            })
            return
          }
          if ((!context || context.analyticsContextReady === false) && number < 3)
            retry(() => attempt(number + 1))
        })
        .catch(() => {
          if (number < 3) retry(() => attempt(number + 1))
        })
    }
    attempt(1)
  }
}
