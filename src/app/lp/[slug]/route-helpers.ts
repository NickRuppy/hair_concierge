import type { FunnelPackage } from "@/lib/funnel/packages"

const SAFE_RETIRED_ROUTINE_QUERY_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "fbclid",
] as const

export function buildRetiredRoutineRedirect(
  searchParams: Record<string, string | string[] | undefined>,
) {
  const params = new URLSearchParams()
  for (const key of SAFE_RETIRED_ROUTINE_QUERY_KEYS) {
    const value = getSingleSearchParam(searchParams[key])
    if (value) params.set(key, value)
  }
  const query = params.toString()
  return query ? `/?${query}` : "/"
}

export function buildScannerQuizRedirect(
  searchParams: Record<string, string | string[] | undefined>,
) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === "string") params.append(key, value)
    else if (Array.isArray(value)) {
      for (const item of value) params.append(key, item)
    }
  }
  const query = params.toString()
  return query ? `/quiz?${query}` : "/quiz"
}

/**
 * `scan_v1` route gate, mirroring `isAttributableFunnelPackage`'s scan branch in
 * `src/proxy.ts`: once the package status is `active`, the route renders
 * regardless of `SCAN_FUNNEL_ENABLED`. While it stays `placeholder`, the flag
 * is still required (today's behaviour, same pattern as `meta_personal_plan_v1`).
 */
export function shouldBlockPlaceholderScanRoute(
  funnelPackage: Pick<FunnelPackage, "key" | "status">,
  scanFunnelEnabled: boolean,
) {
  return (
    funnelPackage.key === "scan_v1" && funnelPackage.status === "placeholder" && !scanFunnelEnabled
  )
}

function getSingleSearchParam(value: string | string[] | undefined) {
  return typeof value === "string" && value.length > 0 ? value : null
}
