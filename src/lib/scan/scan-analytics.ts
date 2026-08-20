import type { AppEventMap } from "@/lib/analytics/events"
import { trackAppEvent } from "@/lib/analytics/track-app-event"
import { loadConsent } from "@/lib/cookie-consent"

export type ScanAnalyticsEventName =
  | "scan_started"
  | "scan_decoded"
  | "scan_result_shown"
  | "scan_not_found"
  | "scan_submission_created"
  | "scan_fallback_search_used"
  | "scan_saved"
  | "scan_buy_clicked"

export type ScanAnalyticsPort = {
  track<E extends ScanAnalyticsEventName>(eventName: E, payload: AppEventMap[E]): void
}

export const noOpScanAnalytics: ScanAnalyticsPort = {
  track() {},
}

type ConsentAwareScanAnalyticsDeps = {
  loadConsent: typeof loadConsent
  trackAppEvent: ScanAnalyticsPort["track"]
}

/** Production scan analytics only fires once the visitor has opted into analytics cookies. */
export function createConsentAwareScanAnalytics(
  deps: ConsentAwareScanAnalyticsDeps = { loadConsent, trackAppEvent },
): ScanAnalyticsPort {
  return {
    track(eventName, payload) {
      if (deps.loadConsent()?.analytics !== true) return
      deps.trackAppEvent(eventName, payload)
    },
  }
}

export const scanAnalytics = createConsentAwareScanAnalytics()
