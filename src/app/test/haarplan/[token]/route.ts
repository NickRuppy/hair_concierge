import { NextResponse, type NextRequest } from "next/server"

import {
  createPersonalPlanFieldTestCampaignCookie,
  PERSONAL_PLAN_FIELD_TEST_CAMPAIGN_COOKIE,
  personalPlanFieldTestCampaignCookieOptions,
  personalPlanFieldTestCookieSecret,
  resolvePersonalPlanFieldTestCampaignToken,
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
  resolveCampaignToken: typeof resolvePersonalPlanFieldTestCampaignToken
  cookieSecret: typeof personalPlanFieldTestCookieSecret
  encodeFunnelContext: typeof encodeFunnelContext
  now: () => number
  randomUUID: () => string
  funnelSecret: () => string | undefined
}

const DEFAULT_DEPENDENCIES: EntryDependencies = {
  resolveCampaignToken: resolvePersonalPlanFieldTestCampaignToken,
  cookieSecret: personalPlanFieldTestCookieSecret,
  encodeFunnelContext,
  now: Date.now,
  randomUUID: crypto.randomUUID,
  funnelSecret: () => process.env.FUNNEL_COOKIE_SIGNING_SECRET,
}

export function FieldTestUnavailablePage() {
  return new NextResponse(
    '<!doctype html><html lang="de"><head><meta name="robots" content="noindex"></head><body><main><h1>Dieser Produkttest ist gerade nicht verfügbar.</h1><p>Bitte frage das Chaarlie-Team nach einem neuen Testlink.</p></main></body></html>',
    { headers: { "Content-Type": "text/html; charset=utf-8", ...NO_STORE_HEADERS }, status: 404 },
  )
}

export function createPersonalPlanFieldTestEntryHandler(
  overrides: Partial<EntryDependencies> = {},
) {
  const dependencies = { ...DEFAULT_DEPENDENCIES, ...overrides }
  return async function GET(request: NextRequest, context: { params: Promise<{ token: string }> }) {
    const { token } = await context.params
    const campaign = await dependencies.resolveCampaignToken(token)
    const cookieSecret = dependencies.cookieSecret()
    if (campaign.kind !== "eligible" || !cookieSecret) return FieldTestUnavailablePage()

    const now = dependencies.now()
    const campaignCookie = createPersonalPlanFieldTestCampaignCookie(
      {
        campaignId: campaign.campaign.id,
        accessDurationHours: campaign.campaign.accessDurationHours,
        issuedAt: now,
        expiresAt: campaign.campaign.expiresAt,
      },
      cookieSecret,
    )
    const funnelSecret = dependencies.funnelSecret()
    if (!campaignCookie || !funnelSecret) return FieldTestUnavailablePage()

    const funnelCookie = await dependencies.encodeFunnelContext(
      {
        visitorId: dependencies.randomUUID(),
        sessionId: dependencies.randomUUID(),
        packageKey: "meta_personal_plan_v1",
        issuedAt: now,
      },
      funnelSecret,
    )
    const response = NextResponse.redirect(new URL("/lp/haarplan", request.url), {
      headers: NO_STORE_HEADERS,
    })
    response.cookies.set(
      PERSONAL_PLAN_FIELD_TEST_CAMPAIGN_COOKIE,
      campaignCookie,
      personalPlanFieldTestCampaignCookieOptions,
    )
    response.cookies.set(FUNNEL_SESSION_COOKIE, funnelCookie, funnelSessionCookieOptions)
    response.cookies.set(FUNNEL_TOUCH_COOKIE, "", { path: "/", maxAge: 0 })
    return response
  }
}

export const GET = createPersonalPlanFieldTestEntryHandler()
