import { after, NextResponse } from "next/server"
import { z } from "zod"

import { checkRateLimit, type RateLimitConfig } from "@/lib/rate-limit"
import { createAdminClient } from "@/lib/supabase/admin"
import { dispatchWaitlistCustomerIoForSignup } from "@/lib/waitlist/customerio-outbox"
import { recordWaitlistSurvey } from "@/lib/waitlist/persistence"
import {
  readWaitlistSurveyAccessCookie,
  WAITLIST_SURVEY_ACCESS_COOKIE,
  waitlistSurveyAccessCookieOptions,
} from "@/lib/waitlist/survey-access"

export const WAITLIST_SURVEY_RATE_LIMIT: RateLimitConfig = {
  prefix: "waitlist-survey",
  limit: 12,
  windowMs: 60 * 60_000,
}

const surveySchema = z
  .object({
    opaqueToken: z.string().min(32).max(256).optional(),
    responseId: z.string().trim().min(1).max(512),
  })
  .strict()

type WaitlistSurveyPostDependencies = {
  checkRateLimit: typeof checkRateLimit
  createAdminClient: typeof createAdminClient
  recordWaitlistSurvey: typeof recordWaitlistSurvey
  dispatchWaitlistCustomerIoForSignup: typeof dispatchWaitlistCustomerIoForSignup
  schedule: typeof after
}

export function createWaitlistSurveyPostHandler(
  overrides: Partial<WaitlistSurveyPostDependencies> = {},
) {
  const dependencies: WaitlistSurveyPostDependencies = {
    checkRateLimit,
    createAdminClient,
    recordWaitlistSurvey,
    dispatchWaitlistCustomerIoForSignup,
    schedule: after,
    ...overrides,
  }

  return async function POST(request: Request) {
    let rateLimit: { allowed: boolean; error?: string }
    try {
      rateLimit = await dependencies.checkRateLimit(requestIp(request), WAITLIST_SURVEY_RATE_LIMIT)
    } catch {
      return NextResponse.json({ error: "Umfrage ist gerade nicht möglich." }, { status: 503 })
    }
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Zu viele Anfragen" },
        { status: rateLimit.error === "service_unavailable" ? 503 : 429 },
      )
    }

    const parsed = surveySchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: "Ungültige Daten" }, { status: 400 })

    const cookieTokenHash = readWaitlistSurveyAccessCookie(request.headers.get("cookie"))
    const authorization = parsed.data.opaqueToken
      ? { opaqueToken: parsed.data.opaqueToken, responseId: parsed.data.responseId }
      : cookieTokenHash
        ? {
            tokenHash: cookieTokenHash,
            responseId: parsed.data.responseId,
          }
        : null
    if (!authorization) return NextResponse.json({ error: "Ungültige Daten" }, { status: 400 })

    try {
      const supabase = dependencies.createAdminClient()
      // The response ID is client-attested from Typeform's browser callback. It can
      // only update optional survey/message projection; it grants no access or entitlement.
      const survey = await dependencies.recordWaitlistSurvey(supabase, authorization)
      if (!survey.recorded) {
        return NextResponse.json({ error: "Ungültige oder abgelaufene Umfrage." }, { status: 404 })
      }

      dependencies.schedule(() =>
        dependencies
          .dispatchWaitlistCustomerIoForSignup(supabase, survey.signupId)
          .catch(() => undefined),
      )
      const response = NextResponse.json({ ok: true })
      response.cookies.set(WAITLIST_SURVEY_ACCESS_COOKIE, "", {
        ...waitlistSurveyAccessCookieOptions,
        maxAge: 0,
      })
      return response
    } catch {
      return NextResponse.json(
        { error: "Umfrage konnte nicht gespeichert werden." },
        { status: 500 },
      )
    }
  }
}

export const POST = createWaitlistSurveyPostHandler()

function requestIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
}
