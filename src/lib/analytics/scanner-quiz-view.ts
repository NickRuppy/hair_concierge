import {
  bootstrapFunnelContext,
  createFunnelEventId,
  type CurrentFunnelContext,
} from "@/lib/funnel/client"
import { trackAppEvent } from "./track-app-event"

type Retry = (callback: () => void) => void

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
  let settled = false

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
    if (settled) return
    if (displayedFunnelPackageKey !== "scan_v1") return
    const viewedAt = now()
    const quizViewId = createId()
    // Keep a single immutable view snapshot while the bounded context lookup resolves.
    settled = true
    const attempt = (number: number) => {
      void bootstrap()
        .then((context) => {
          if (
            context?.funnelPackageKey === "scan_v1" &&
            context.analyticsContextReady !== false &&
            isCurrent()
          ) {
            track("scanner_quiz_viewed", {
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
