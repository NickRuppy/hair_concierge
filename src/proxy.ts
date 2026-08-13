import { AUTHENTICATED_SESSION_RESPONSE_HEADER, updateSession } from "@/lib/supabase/middleware"
import {
  decodeFunnelContext,
  decodeFunnelTouch,
  encodeFunnelContext,
  encodeFunnelTouch,
  funnelSessionCookieOptions,
  funnelTouchCookieOptions,
  FUNNEL_SESSION_COOKIE,
  FUNNEL_TOUCH_COOKIE,
  shouldReplacePendingTouch,
  type FunnelCookieContext,
  type FunnelTouch,
} from "@/lib/funnel/cookie"
import { isFunnelAttributionEnabled, isPersonalPlanQuizV1Enabled } from "@/lib/funnel/flags"
import {
  getFunnelPackageByKey,
  getFunnelPackageBySlug,
  resolveDefaultFunnelPackage,
  type FunnelPackage,
} from "@/lib/funnel/packages"
import { type NextRequest } from "next/server"
import { NextResponse } from "next/server"
import * as Sentry from "@sentry/nextjs"
import {
  decodeSignedRegularQuizFieldTestCampaignCookie,
  REGULAR_QUIZ_FIELD_TEST_CAMPAIGN_COOKIE,
} from "@/lib/personal-plan-field-test/regular-quiz-campaign-cookie"
import { regularQuizFieldTestCookieSecret } from "@/lib/personal-plan-field-test/server"
import {
  appendServerTiming,
  createAppPerformanceEvent,
  outcomeForResponseStatus,
  routeGroupForPathname,
  toSentryPerformanceSpanContext,
  toStructuredPerformanceLog,
} from "@/lib/observability/app-performance"

export async function proxy(request: NextRequest) {
  if (request.nextUrl.hostname === "www.chaarlie.de") {
    const url = request.nextUrl.clone()
    url.hostname = "chaarlie.de"
    return NextResponse.redirect(url, 308)
  }

  if (request.nextUrl.pathname === "/lp/routine" || request.nextUrl.pathname === "/lp/routine/") {
    const url = request.nextUrl.clone()
    url.pathname = "/"
    for (const key of [...url.searchParams.keys()]) {
      if (!SAFE_RETIRED_ROUTINE_QUERY_KEYS.has(key)) url.searchParams.delete(key)
    }
    return NextResponse.redirect(url, 307)
  }

  const routeGroup = routeGroupForPathname(request.nextUrl.pathname)
  const response = routeGroup
    ? await measureProxyAccess(request, routeGroup)
    : await updateSession(request)
  const regularFieldTestSecret = regularQuizFieldTestCookieSecret()
  const requestedRegularFieldTestRewrite = shouldRewriteRegularQuizFieldTest(request)
  const authenticated = response.headers.get(AUTHENTICATED_SESSION_RESPONSE_HEADER) === "1"
  response.headers.delete(AUTHENTICATED_SESSION_RESPONSE_HEADER)
  if (
    shouldClearInvalidRegularQuizFieldTestCookie({
      pathname: request.nextUrl.pathname,
      hasCookie: request.cookies.has(REGULAR_QUIZ_FIELD_TEST_CAMPAIGN_COOKIE),
      secretAvailable: Boolean(regularFieldTestSecret),
      rewriteRequested: requestedRegularFieldTestRewrite,
    })
  ) {
    response.cookies.set(REGULAR_QUIZ_FIELD_TEST_CAMPAIGN_COOKIE, "", {
      path: "/",
      maxAge: 0,
    })
  }
  const rewriteRegularFieldTest = shouldApplyRegularQuizFieldTestRewrite({
    authenticated,
    location: response.headers.get("location"),
    requested: requestedRegularFieldTestRewrite,
    status: response.status,
  })
  if (!isFunnelAttributionEnabled()) {
    return finalizeRegularQuizFieldTestRewrite(request, response, rewriteRegularFieldTest)
  }

  const secret = process.env.FUNNEL_COOKIE_SIGNING_SECRET
  if (!secret) {
    console.error("[funnel] FUNNEL_COOKIE_SIGNING_SECRET is required when attribution is enabled")
    return finalizeRegularQuizFieldTestRewrite(request, response, rewriteRegularFieldTest)
  }

  const personalPlanEnabled = isPersonalPlanQuizV1Enabled()
  const selectedPackage = resolveAttributablePackageForPath(
    request.nextUrl.pathname,
    personalPlanEnabled,
  )
  if (!selectedPackage) {
    return finalizeRegularQuizFieldTestRewrite(request, response, rewriteRegularFieldTest)
  }

  const existingValue = request.cookies.get(FUNNEL_SESSION_COOKIE)?.value
  const existing = existingValue ? await decodeFunnelContext(existingValue, secret) : null
  const explicitlySelectsPackage =
    rewriteRegularFieldTest ||
    request.nextUrl.pathname === "/" ||
    request.nextUrl.pathname.startsWith("/lp/")

  const startNewSession = shouldStartNewFunnelSession({
    existingPackageKey: existing?.packageKey ?? null,
    explicitlySelectsPackage,
    personalPlanEnabled,
    selectedPackage,
  })
  const context: FunnelCookieContext =
    startNewSession || !existing
      ? {
          visitorId: existing?.visitorId ?? crypto.randomUUID(),
          sessionId: crypto.randomUUID(),
          packageKey: selectedPackage.key,
          issuedAt: Date.now(),
        }
      : existing

  response.cookies.set(
    FUNNEL_SESSION_COOKIE,
    await encodeFunnelContext(context, secret),
    funnelSessionCookieOptions,
  )

  const existingTouchValue = request.cookies.get(FUNNEL_TOUCH_COOKIE)?.value
  const existingTouch = existingTouchValue
    ? await decodeFunnelTouch(existingTouchValue, secret)
    : null
  if (shouldReplacePendingTouch(request.nextUrl.pathname, context.sessionId, existingTouch)) {
    const touch = buildPendingTouch(request, context)
    response.cookies.set(
      FUNNEL_TOUCH_COOKIE,
      await encodeFunnelTouch(touch, secret),
      funnelTouchCookieOptions,
    )
  }
  return finalizeRegularQuizFieldTestRewrite(request, response, rewriteRegularFieldTest)
}

async function measureProxyAccess(
  request: NextRequest,
  routeGroup: NonNullable<ReturnType<typeof routeGroupForPathname>>,
) {
  const correlationId = crypto.randomUUID()
  return Sentry.startSpan(
    {
      name: "app_performance.proxy_access",
      op: "middleware",
      onlyIfParent: true,
      attributes: {
        "app_performance.route_group": routeGroup,
        "app_performance.operation": "proxy_access",
        "app_performance.correlation_id": correlationId,
      },
    },
    async (span) => {
      const startedAt = performance.now()
      let response: NextResponse | undefined
      try {
        response = await updateSession(request)
        return response
      } finally {
        const event = createAppPerformanceEvent({
          routeGroup,
          operation: "proxy_access",
          outcome: response ? outcomeForResponseStatus(response.status) : "transient_error",
          durationMs: performance.now() - startedAt,
          region: process.env.VERCEL_REGION,
          correlationId,
        })
        span.setAttributes(toSentryPerformanceSpanContext(event))
        console.info(JSON.stringify(toStructuredPerformanceLog(event)))
        if (response) {
          response.headers.set(
            "Server-Timing",
            appendServerTiming(response.headers.get("Server-Timing"), event),
          )
        }
      }
    },
  )
}

export function shouldApplyRegularQuizFieldTestRewrite({
  authenticated,
  location,
  requested,
  status,
}: {
  authenticated: boolean
  location: string | null
  requested: boolean
  status: number
}) {
  return requested && !authenticated && !location && status === 200
}

export function shouldClearInvalidRegularQuizFieldTestCookie({
  pathname,
  hasCookie,
  secretAvailable,
  rewriteRequested,
}: {
  pathname: string
  hasCookie: boolean
  secretAvailable: boolean
  rewriteRequested: boolean
}) {
  return pathname === "/quiz" && hasCookie && secretAvailable && !rewriteRequested
}

function finalizeRegularQuizFieldTestRewrite(
  request: NextRequest,
  response: NextResponse,
  rewrite: boolean,
) {
  if (!rewrite) return response
  const url = request.nextUrl.clone()
  url.pathname = "/test/quiz/session"
  const rewriteResponse = NextResponse.rewrite(url)
  for (const cookie of response.cookies.getAll()) rewriteResponse.cookies.set(cookie)
  return rewriteResponse
}

export function shouldRewriteRegularQuizFieldTest(request: NextRequest) {
  if (request.nextUrl.pathname !== "/quiz") return false
  const value = request.cookies.get(REGULAR_QUIZ_FIELD_TEST_CAMPAIGN_COOKIE)?.value
  // A signed cookie stays on the server-validated path even after the global
  // switch is disabled. The dynamic layout then sends the participant to the
  // neutral ended surface instead of letting the test fall into paid `/quiz`.
  return Boolean(
    decodeSignedRegularQuizFieldTestCampaignCookie(value, regularQuizFieldTestCookieSecret()),
  )
}

const SAFE_RETIRED_ROUTINE_QUERY_KEYS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "fbclid",
])

export function isAttributableFunnelPackage(
  funnelPackage: FunnelPackage,
  personalPlanEnabled: boolean,
) {
  if (funnelPackage.key === "default_organic") return funnelPackage.status === "active"
  return (
    funnelPackage.key === "meta_personal_plan_v1" &&
    funnelPackage.status === "placeholder" &&
    personalPlanEnabled
  )
}

export function resolveAttributablePackageForPath(pathname: string, personalPlanEnabled: boolean) {
  if (pathname === "/" || pathname === "/quiz") return resolveDefaultFunnelPackage()
  const match = pathname.match(/^\/lp\/([^/]+)\/?$/)
  const funnelPackage = match ? getFunnelPackageBySlug(match[1]) : null
  return funnelPackage && isAttributableFunnelPackage(funnelPackage, personalPlanEnabled)
    ? funnelPackage
    : null
}

export function shouldStartNewFunnelSession({
  existingPackageKey,
  explicitlySelectsPackage,
  personalPlanEnabled,
  selectedPackage,
}: {
  existingPackageKey: string | null
  explicitlySelectsPackage: boolean
  personalPlanEnabled: boolean
  selectedPackage: FunnelPackage
}) {
  if (!existingPackageKey) return true
  const existingPackage = getFunnelPackageByKey(existingPackageKey)
  if (!existingPackage || !isAttributableFunnelPackage(existingPackage, personalPlanEnabled)) {
    return true
  }
  return explicitlySelectsPackage && existingPackageKey !== selectedPackage.key
}

function truncate(value: string | null, maxLength: number) {
  return value?.trim().slice(0, maxLength) || undefined
}

function buildPendingTouch(request: NextRequest, context: FunnelCookieContext): FunnelTouch {
  const params = request.nextUrl.searchParams
  return {
    visitorId: context.visitorId,
    sessionId: context.sessionId,
    capturedAt: Date.now(),
    entryPath: request.nextUrl.pathname.slice(0, 256),
    utmSource: truncate(params.get("utm_source"), 100),
    utmMedium: truncate(params.get("utm_medium"), 100),
    utmCampaign: truncate(params.get("utm_campaign"), 150),
    utmContent: truncate(params.get("utm_content"), 150),
    utmTerm: truncate(params.get("utm_term"), 100),
    fbclid: truncate(params.get("fbclid"), 256),
    referrer: truncate(request.headers.get("referer"), 300),
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|images/|fonts/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ttf|woff2?)$).*)",
  ],
}
