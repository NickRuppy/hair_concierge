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

/**
 * Speed Insights receives URL data by default. Keep only the seven measured app
 * route groups and replace every path/query value with a fixed public label.
 */
export function sanitizeSpeedInsightsEvent(
  event: SpeedInsightsBeforeSendEvent,
): SpeedInsightsBeforeSendEvent | null {
  if (event.type !== "vital") return null

  let pathname: string
  try {
    pathname = new URL(event.url, "https://chaarlie.invalid").pathname
  } catch {
    return null
  }

  const routeGroup = routeGroupForPathname(pathname)
  if (!routeGroup) return null

  const canonicalPath = CANONICAL_PATH_BY_ROUTE_GROUP[routeGroup]
  return {
    type: "vital",
    url: canonicalPath,
    route: canonicalPath,
  }
}
