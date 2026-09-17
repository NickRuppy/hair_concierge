import * as Sentry from "@sentry/nextjs"

/**
 * Mirrors the shape of `src/lib/observability/checkout.ts`'s `captureCheckoutException`
 * idiom — the established API-route pattern (see `src/app/api/auth/send-magic-link/route.ts`,
 * `src/app/api/billing/reconcile/route.ts`) — scoped to the five scan routes (resolve, search,
 * submit, save, wishlist). Capture on unexpected throws and 5xx responses only; 4xx client
 * errors (validation, 401, 404, 409, 429) and the rate-limiter's fail-closed 503 are not routed
 * through this helper — `checkRateLimit` already `console.error`s that outage, matching how the
 * rest of the API surface treats it (only the checkout-critical auth-link path also captures it,
 * which is not the general pattern this scope follows).
 */
export type ScanRoute = "resolve" | "search" | "submit" | "save" | "wishlist" | "reveal"

type BreadcrumbLevel = "debug" | "info" | "warning" | "error"

export interface ScanSentryDetails {
  route: ScanRoute
  status: number
  reason?: string | null
  userId?: string | null
  /**
   * Sentry severity. Defaults to "error" — the 5xx case this helper exists for. Writers
   * that capture a degraded-but-served request (the fail-open attempt log) pass "warning"
   * so an alert on scan errors is not raised by telemetry the user never noticed.
   */
  level?: "warning" | "error"
}

export interface ScanSentryPayload {
  tags: Record<string, string>
  context: Record<string, unknown>
}

interface ScanScopeLike {
  setContext(name: string, context: Record<string, unknown>): void
  setLevel?(level: BreadcrumbLevel): void
  setTag(key: string, value: string): void
}

interface ScanSentrySink {
  captureException(error: unknown): void
  withScope(callback: (scope: ScanScopeLike) => void): void
}

export function buildScanSentryPayload(details: ScanSentryDetails): ScanSentryPayload {
  const context: Record<string, unknown> = {
    route: details.route,
    status: details.status,
  }
  const tags: Record<string, string> = {
    "scan.route": details.route,
    "scan.status": String(details.status),
  }

  addOptional(context, "reason", details.reason)
  addOptional(context, "user_id", details.userId)
  addTag(tags, "scan.reason", details.reason)

  return { tags, context }
}

export function captureScanException(
  error: unknown,
  details: ScanSentryDetails,
  sink: ScanSentrySink = Sentry,
) {
  const payload = buildScanSentryPayload(details)
  sink.withScope((scope) => {
    for (const [key, value] of Object.entries(payload.tags)) {
      scope.setTag(key, value)
    }
    scope.setContext("scan", payload.context)
    scope.setLevel?.(details.level ?? "error")
    sink.captureException(error)
  })
}

export type RetailerLookupWarningDetails = {
  route: "resolve" | "submit"
  reason: "session_expired" | "transport" | "malformed" | "gtin_mismatch" | "unexpected"
}

const RETAILER_WARNING_THROTTLE_MS = 60_000
const retailerWarningNextAllowedAt = new Map<string, number>()

/** Sanitized, rate-limited warning for fail-open dm lookup faults. */
export function reportRetailerLookupWarning(
  details: RetailerLookupWarningDetails,
  capture: typeof captureScanException = captureScanException,
  now: () => number = Date.now,
): void {
  const key = details.route + ":" + details.reason
  const currentTime = now()
  if (currentTime < (retailerWarningNextAllowedAt.get(key) ?? 0)) return
  retailerWarningNextAllowedAt.set(key, currentTime + RETAILER_WARNING_THROTTLE_MS)
  try {
    // The underlying transport error may contain URLs, identifiers or response payloads.
    // Neither its message nor its stack enters this event.
    capture(new Error("scan_retailer_lookup_failed"), {
      route: details.route,
      status: 200,
      reason: "retailer_lookup_" + details.reason,
      level: "warning",
    })
  } catch {
    // Enrichment and its diagnostics must never determine the scan response.
  }
}

function addOptional(
  target: Record<string, unknown>,
  key: string,
  value: string | number | null | undefined,
) {
  if (value === null || value === undefined || value === "") return
  target[key] = value
}

function addTag(target: Record<string, string>, key: string, value: string | null | undefined) {
  if (value === null || value === undefined || value === "") return
  target[key] = value
}
