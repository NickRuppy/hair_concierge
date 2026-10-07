export const APP_PERFORMANCE_ROUTE_GROUPS = [
  "plan_start",
  "plan_ready",
  "routine",
  "anwendung",
  "profile",
  "chat",
  "tracker",
] as const

export const APP_PERFORMANCE_OPERATIONS = [
  "proxy_auth",
  "proxy_access",
  "route_access",
  "route_data",
  "render_total",
] as const

export const APP_PERFORMANCE_OUTCOMES = [
  "success",
  "redirect",
  "denied",
  "not_found",
  "transient_error",
] as const

export type AppPerformanceRouteGroup = (typeof APP_PERFORMANCE_ROUTE_GROUPS)[number]
export type AppPerformanceOperation = (typeof APP_PERFORMANCE_OPERATIONS)[number]
export type AppPerformanceOutcome = (typeof APP_PERFORMANCE_OUTCOMES)[number]

export type AppPerformanceEvent = {
  route_group: AppPerformanceRouteGroup
  operation: AppPerformanceOperation
  outcome: AppPerformanceOutcome
  region: string
  duration_ms: number
  round_trip_count?: number
  correlation_id: string
}

type CreateAppPerformanceEventInput = {
  routeGroup: AppPerformanceRouteGroup
  operation: AppPerformanceOperation
  outcome: AppPerformanceOutcome
  durationMs: number
  region?: string | null
  roundTripCount?: number
  correlationId: string
}

const CORRELATION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function assertEnum<Value extends string>(
  value: string,
  values: readonly Value[],
  field: string,
): asserts value is Value {
  if (!values.includes(value as Value)) throw new TypeError(`Invalid ${field}`)
}

function assertCorrelationId(value: string) {
  if (!CORRELATION_ID_PATTERN.test(value)) throw new TypeError("Invalid correlationId")
}

function normalizedDuration(value: number) {
  if (!Number.isFinite(value) || value < 0) throw new TypeError("Invalid durationMs")
  return Math.round(value * 100) / 100
}

export function createAppPerformanceEvent({
  routeGroup,
  operation,
  outcome,
  durationMs,
  region,
  roundTripCount,
  correlationId,
}: CreateAppPerformanceEventInput): AppPerformanceEvent {
  assertEnum(routeGroup, APP_PERFORMANCE_ROUTE_GROUPS, "routeGroup")
  assertEnum(operation, APP_PERFORMANCE_OPERATIONS, "operation")
  assertEnum(outcome, APP_PERFORMANCE_OUTCOMES, "outcome")
  assertCorrelationId(correlationId)
  if (roundTripCount !== undefined && (!Number.isInteger(roundTripCount) || roundTripCount < 0)) {
    throw new TypeError("Invalid roundTripCount")
  }

  return {
    route_group: routeGroup,
    operation,
    outcome,
    region: region && /^[a-z0-9-]{1,32}$/i.test(region) ? region : "unknown",
    duration_ms: normalizedDuration(durationMs),
    ...(roundTripCount === undefined ? {} : { round_trip_count: roundTripCount }),
    correlation_id: correlationId,
  }
}

/** Public response-safe: contains operation duration only, never correlation or request attributes. */
export function serializeServerTiming(event: AppPerformanceEvent) {
  return `app_${event.operation};dur=${event.duration_ms.toFixed(2)}`
}

export function appendServerTiming(existing: string | null, event: AppPerformanceEvent) {
  const timing = serializeServerTiming(event)
  return existing ? `${existing}, ${timing}` : timing
}

/** Private structured logs may receive the validated correlation ID. */
export function toStructuredPerformanceLog(event: AppPerformanceEvent) {
  return { event: "app_performance", ...event }
}

/** Sentry span attributes are bounded; the correlation ID must not be promoted to a tag or metric. */
export function toSentryPerformanceSpanContext(event: AppPerformanceEvent) {
  return {
    "app_performance.route_group": event.route_group,
    "app_performance.operation": event.operation,
    "app_performance.outcome": event.outcome,
    "app_performance.region": event.region,
    "app_performance.duration_ms": event.duration_ms,
    ...(event.round_trip_count === undefined
      ? {}
      : { "app_performance.round_trip_count": event.round_trip_count }),
    "app_performance.correlation_id": event.correlation_id,
  }
}

export function routeGroupForPathname(pathname: string): AppPerformanceRouteGroup | null {
  if (pathname === "/plan-start" || pathname.startsWith("/plan-start/")) return "plan_start"
  if (pathname === "/plan-bereit" || pathname.startsWith("/plan-bereit/")) return "plan_ready"
  if (pathname === "/routine" || pathname.startsWith("/routine/")) return "routine"
  if (pathname === "/anwendung" || pathname.startsWith("/anwendung/")) return "anwendung"
  if (pathname === "/profile" || pathname.startsWith("/profile/")) return "profile"
  if (pathname === "/chat" || pathname.startsWith("/chat/")) return "chat"
  if (pathname === "/tracker" || pathname.startsWith("/tracker/")) return "tracker"
  return null
}

export function outcomeForResponseStatus(status: number): AppPerformanceOutcome {
  if (status >= 300 && status < 400) return "redirect"
  if (status === 401 || status === 403) return "denied"
  if (status === 404) return "not_found"
  if (status >= 500) return "transient_error"
  return "success"
}
