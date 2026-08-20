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

/**
 * The `in_catalog` property of `scan_result_shown`.
 *
 * Both resolved-verdict branches describe a product the catalog already knows — the
 * `not_needed` payload still carries the scanned product's catalog header (name, brand,
 * price, buy link), it just reaches no fit verdict because the profile does not need that
 * category. Reading the flag off `kind === "in_catalog"` therefore reported every
 * "brauchst du nicht" scan as a catalog MISS, which is the same signal `scan_not_found`
 * carries for a genuinely unknown barcode — the two were indistinguishable in the funnel.
 * A real miss never reaches this event at all: it resolves to `unknown_product` or
 * `pending_submission`, neither of which has a product header.
 */
export function scanResultShownInCatalog(result: {
  kind: "in_catalog" | "not_needed"
  product: unknown
}): boolean {
  return (result.kind === "in_catalog" || result.kind === "not_needed") && Boolean(result.product)
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
