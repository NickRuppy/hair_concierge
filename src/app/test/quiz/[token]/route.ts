import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

import {
  createRegularQuizFieldTestCampaignCookie,
  isRegularQuizFieldTestEnabled,
  REGULAR_QUIZ_FIELD_TEST_CAMPAIGN_COOKIE,
  regularQuizFieldTestCampaignCookieOptions,
  regularQuizFieldTestCookieSecret,
  resolveRegularQuizFieldTestCampaignToken,
} from "@/lib/personal-plan-field-test"
import {
  encodeFunnelContext,
  funnelSessionCookieOptions,
  FUNNEL_SESSION_COOKIE,
  FUNNEL_TOUCH_COOKIE,
} from "@/lib/funnel/cookie"

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow",
}

type EntryDependencies = {
  enabled: () => boolean
  getAuthenticatedUser: (request: NextRequest) => Promise<{ id: string } | null>
  resolveCampaignToken: typeof resolveRegularQuizFieldTestCampaignToken
  cookieSecret: typeof regularQuizFieldTestCookieSecret
  encodeFunnelContext: typeof encodeFunnelContext
  now: () => number
  randomUUID: () => string
  funnelSecret: () => string | undefined
}

async function getAuthenticatedUser(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) return null
  const client = createServerClient(url, anonKey, {
    cookies: { getAll: () => request.cookies.getAll(), setAll: () => undefined },
  })
  const {
    data: { user },
  } = await client.auth.getUser()
  return user ? { id: user.id } : null
}

const DEFAULT_DEPENDENCIES: EntryDependencies = {
  enabled: () => isRegularQuizFieldTestEnabled(),
  getAuthenticatedUser,
  resolveCampaignToken: resolveRegularQuizFieldTestCampaignToken,
  cookieSecret: regularQuizFieldTestCookieSecret,
  encodeFunnelContext,
  now: Date.now,
  randomUUID: crypto.randomUUID,
  funnelSecret: () => process.env.FUNNEL_COOKIE_SIGNING_SECRET,
}

export function RegularQuizFieldTestUnavailablePage() {
  return new NextResponse(
    '<!doctype html><html lang="de"><head><meta name="robots" content="noindex"></head><body><main><h1>Dieser Produkttest ist gerade nicht verfügbar.</h1><p>Bitte frage das Chaarlie-Team nach einem neuen Testlink.</p></main></body></html>',
    { headers: { "Content-Type": "text/html; charset=utf-8", ...NO_STORE_HEADERS }, status: 404 },
  )
}

export function RegularQuizFieldTestExistingSessionPage() {
  return new NextResponse(
    '<!doctype html><html lang="de"><head><meta name="robots" content="noindex"></head><body><main><h1>Dieser Produkttest braucht eine separate Browser-Sitzung.</h1><p>Bitte öffne den Link in einem privaten Fenster oder melde dich zuerst ab.</p><a href="/chat">Zurück zu deinem Konto</a></main></body></html>',
    { headers: { "Content-Type": "text/html; charset=utf-8", ...NO_STORE_HEADERS }, status: 409 },
  )
}

export function createRegularQuizFieldTestEntryHandler(overrides: Partial<EntryDependencies> = {}) {
  const dependencies = { ...DEFAULT_DEPENDENCIES, ...overrides }
  return async function GET(request: NextRequest, context: { params: Promise<{ token: string }> }) {
    if (!dependencies.enabled()) return RegularQuizFieldTestUnavailablePage()
    try {
      if (await dependencies.getAuthenticatedUser(request))
        return RegularQuizFieldTestExistingSessionPage()
    } catch {
      return RegularQuizFieldTestUnavailablePage()
    }
    const { token } = await context.params
    const campaign = await dependencies.resolveCampaignToken(token, { enabled: true })
    const cookieSecret = dependencies.cookieSecret()
    if (campaign.kind !== "eligible" || !cookieSecret) return RegularQuizFieldTestUnavailablePage()
    const now = dependencies.now()
    const campaignCookie = createRegularQuizFieldTestCampaignCookie(
      {
        campaignId: campaign.campaign.id,
        accessDurationHours: campaign.campaign.accessDurationHours,
        issuedAt: now,
        expiresAt: campaign.campaign.expiresAt,
      },
      cookieSecret,
    )
    const funnelSecret = dependencies.funnelSecret()
    if (!campaignCookie || !funnelSecret) return RegularQuizFieldTestUnavailablePage()
    const funnelCookie = await dependencies.encodeFunnelContext(
      {
        visitorId: dependencies.randomUUID(),
        sessionId: dependencies.randomUUID(),
        packageKey: "default_organic",
        issuedAt: now,
      },
      funnelSecret,
    )
    const response = NextResponse.redirect(new URL("/quiz", request.url), {
      headers: NO_STORE_HEADERS,
    })
    response.cookies.set(
      REGULAR_QUIZ_FIELD_TEST_CAMPAIGN_COOKIE,
      campaignCookie,
      regularQuizFieldTestCampaignCookieOptions,
    )
    response.cookies.set(FUNNEL_SESSION_COOKIE, funnelCookie, funnelSessionCookieOptions)
    response.cookies.set(FUNNEL_TOUCH_COOKIE, "", { path: "/", maxAge: 0 })
    return response
  }
}

export const GET = createRegularQuizFieldTestEntryHandler()
