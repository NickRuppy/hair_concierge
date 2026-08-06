import { NextResponse } from "next/server"

import { checkRateLimit, type RateLimitConfig } from "@/lib/rate-limit"
import {
  parseWaitlistSurveyAccessTokenHash,
  WAITLIST_SURVEY_ACCESS_COOKIE,
  waitlistSurveyAccessCookieOptions,
} from "@/lib/waitlist/survey-access"

export const WAITLIST_SURVEY_ACCESS_RATE_LIMIT: RateLimitConfig = {
  prefix: "waitlist-survey-access",
  limit: 30,
  windowMs: 60 * 60_000,
}

type WaitlistSurveyAccessDependencies = {
  checkRateLimit: typeof checkRateLimit
}

export function createWaitlistSurveyAccessGetHandler(
  overrides: Partial<WaitlistSurveyAccessDependencies> = {},
) {
  const dependencies = { checkRateLimit, ...overrides }

  return async function GET(request: Request) {
    let rateLimit: { allowed: boolean; error?: string }
    try {
      rateLimit = await dependencies.checkRateLimit(
        requestIp(request),
        WAITLIST_SURVEY_ACCESS_RATE_LIMIT,
      )
    } catch {
      return NextResponse.json({ error: "Link ist gerade nicht verfügbar." }, { status: 503 })
    }
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Zu viele Anfragen" },
        { status: rateLimit.error === "service_unavailable" ? 503 : 429 },
      )
    }

    const tokenHash = parseWaitlistSurveyAccessTokenHash(
      new URL(request.url).searchParams.get("token"),
    )
    if (!tokenHash) {
      return NextResponse.json({ error: "Ungültiger Umfrage-Link." }, { status: 400 })
    }

    const response = NextResponse.redirect(new URL("/warteliste/umfrage", request.url), {
      status: 303,
      headers: {
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
      },
    })
    response.cookies.set(
      WAITLIST_SURVEY_ACCESS_COOKIE,
      tokenHash,
      waitlistSurveyAccessCookieOptions,
    )
    return response
  }
}

export const GET = createWaitlistSurveyAccessGetHandler()

function requestIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
}
