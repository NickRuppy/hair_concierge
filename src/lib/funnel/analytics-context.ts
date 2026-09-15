import type { FunnelCookieContext, FunnelTouch } from "./cookie"

// Original acquisition metadata, never raw URLs, click IDs, or the full first_touch object.
export function buildScannerAnalyticsContext(
  context: FunnelCookieContext,
  row: Record<string, unknown> | null,
  touch: FunnelTouch | null,
  lookupFailed = false,
): Record<string, unknown> {
  const result: Record<string, unknown> = {
    funnelSessionId: context.sessionId,
    funnelPackageKey: context.packageKey,
  }
  if (context.packageKey !== "scan_v1") return result
  result.issuedAt = context.issuedAt
  result.analyticsContextReady = !lookupFailed
  if (lookupFailed) return result
  const matchingTouch =
    touch?.sessionId === context.sessionId && touch.visitorId === context.visitorId ? touch : null
  // A saved row is authoritative even when it has no campaign; a later entry must not overwrite it.
  const source = row ? (isRecord(row.first_touch) ? row.first_touch : {}) : matchingTouch
  const path = row ? row.entry_path : matchingTouch?.entryPath
  if (path === "/lp/scan" || path === "/quiz") result.entryPath = path
  if (row) {
    result.isInternalTest = row.is_internal_test === true
    if (row.test_kind === "field_test" || row.test_kind === "partner")
      result.testKind = row.test_kind
  }
  for (const [camel, snake] of [
    ["utmSource", "utm_source"],
    ["utmMedium", "utm_medium"],
    ["utmCampaign", "utm_campaign"],
    ["utmContent", "utm_content"],
    ["utmTerm", "utm_term"],
  ]) {
    const value = source && (source as Record<string, unknown>)[row ? snake : camel]
    if (typeof value === "string" && value.trim()) result[camel] = value.trim().slice(0, 200)
  }
  return result
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value)
}
