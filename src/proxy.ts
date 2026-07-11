import { updateSession } from "@/lib/supabase/middleware"
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
import { isFunnelAttributionEnabled } from "@/lib/funnel/flags"
import { getFunnelPackageBySlug, resolveDefaultFunnelPackage } from "@/lib/funnel/packages"
import { type NextRequest } from "next/server"
import { NextResponse } from "next/server"

export async function proxy(request: NextRequest) {
  if (request.nextUrl.hostname === "www.chaarlie.de") {
    const url = request.nextUrl.clone()
    url.hostname = "chaarlie.de"
    return NextResponse.redirect(url, 308)
  }

  const response = await updateSession(request)
  if (!isFunnelAttributionEnabled()) return response

  const secret = process.env.FUNNEL_COOKIE_SIGNING_SECRET
  if (!secret) {
    console.error("[funnel] FUNNEL_COOKIE_SIGNING_SECRET is required when attribution is enabled")
    return response
  }

  const selectedPackage = resolvePackageForPath(request.nextUrl.pathname)
  if (!selectedPackage) return response

  const existingValue = request.cookies.get(FUNNEL_SESSION_COOKIE)?.value
  const existing = existingValue ? await decodeFunnelContext(existingValue, secret) : null
  const explicitlySelectsPackage =
    request.nextUrl.pathname === "/" || request.nextUrl.pathname.startsWith("/lp/")

  let context = existing
  if (!context || (explicitlySelectsPackage && context.packageKey !== selectedPackage.key)) {
    context = {
      visitorId: existing?.visitorId ?? crypto.randomUUID(),
      sessionId: crypto.randomUUID(),
      packageKey: selectedPackage.key,
      issuedAt: Date.now(),
    }
  }

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
  return response
}

function resolvePackageForPath(pathname: string) {
  if (pathname === "/" || pathname === "/quiz") return resolveDefaultFunnelPackage()
  const match = pathname.match(/^\/lp\/([^/]+)\/?$/)
  return match ? getFunnelPackageBySlug(match[1]) : null
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
