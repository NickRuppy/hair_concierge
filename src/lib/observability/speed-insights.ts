import {
  routeGroupForPathname,
  type AppPerformanceRouteGroup,
} from "@/lib/observability/app-performance"

export type SpeedInsightsBeforeSendEvent = {
  type: "vital"
  url: string
  route?: string
}

const CANONICAL_PATH_BY_ROUTE_GROUP: Record<AppPerformanceRouteGroup, string> = {
  plan_start: "/plan-start",
  plan_ready: "/plan-bereit",
  routine: "/routine",
  anwendung: "/anwendung",
  profile: "/profile",
  chat: "/chat",
  tracker: "/tracker",
}

const PUBLIC_PATHS = new Set(["/", "/quiz", "/lp/haarplan", "/lp/scan"])

/**
 * Speed Insights receives URL data by default. Keep the named public pages and
 * seven measured app areas; replace every path/query value with a fixed label.
 */
export function sanitizeSpeedInsightsEvent(
  event: SpeedInsightsBeforeSendEvent,
): SpeedInsightsBeforeSendEvent | null {
  if (event.type !== "vital") return null

  let url: URL
  try {
    url = new URL(event.url)
  } catch {
    return null
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null

  const routeGroup = routeGroupForPathname(url.pathname)
  const canonicalPath = PUBLIC_PATHS.has(url.pathname)
    ? url.pathname
    : routeGroup
      ? CANONICAL_PATH_BY_ROUTE_GROUP[routeGroup]
      : null
  if (!canonicalPath) return null

  return {
    type: "vital",
    url: `${url.origin}${canonicalPath}`,
    route: canonicalPath,
  }
}
