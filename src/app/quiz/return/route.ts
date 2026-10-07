import { NextRequest, NextResponse } from "next/server"

import { isFunnelAttributionEnabled, isQuizEmailReturnEnabled } from "@/lib/funnel/flags"
import { FUNNEL_SESSION_COOKIE, FUNNEL_TOUCH_COOKIE } from "@/lib/funnel/cookie"
import { REGULAR_QUIZ_FIELD_TEST_CAMPAIGN_COOKIE } from "@/lib/personal-plan-field-test"
import { MIGRATION_QUIZ_COOKIE } from "@/lib/personal-plan/migration-quiz-context"
import { checkRateLimit } from "@/lib/rate-limit"
import {
  isValidQuizEmailReturnCredential,
  resolveQuizEmailReturnCredential,
} from "@/lib/quiz/email-return-credential"
import {
  encodeQuizEmailReturnContext,
  QUIZ_EMAIL_RETURN_COOKIE,
  QUIZ_EMAIL_RETURN_PACKAGE_KEY,
  quizEmailReturnCookieOptions,
} from "@/lib/quiz/email-return-context"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const RETURN_LOOKUP_RATE_LIMIT = { prefix: "quiz-email-return-token", limit: 30, windowMs: 60_000 }

function redirectToQuiz(request: NextRequest, outcome: "ready" | "invalid" | "unavailable") {
  const destination = new URL("/quiz", request.url)
  destination.searchParams.set("return", outcome)
  const response = NextResponse.redirect(destination, 303)
  response.headers.set("Cache-Control", "private, no-store")
  response.headers.set("Referrer-Policy", "no-referrer")
  response.headers.set("X-Robots-Tag", "noindex, nofollow")
  if (outcome !== "ready") {
    response.cookies.delete(QUIZ_EMAIL_RETURN_COOKIE)
    response.cookies.delete(FUNNEL_SESSION_COOKIE)
    response.cookies.delete(FUNNEL_TOUCH_COOKIE)
  }
  return response
}

type EntryDependencies = {
  enabled: typeof isQuizEmailReturnEnabled
  rateLimit: typeof checkRateLimit
  resolve: typeof resolveQuizEmailReturnCredential
}

export function createQuizEmailReturnEntryHandler(overrides: Partial<EntryDependencies> = {}) {
  const dependencies: EntryDependencies = {
    enabled: () => isQuizEmailReturnEnabled() && isFunnelAttributionEnabled(),
    rateLimit: checkRateLimit,
    resolve: resolveQuizEmailReturnCredential,
    ...overrides,
  }
  return async function GET(request: NextRequest) {
    // Email scanners may fetch this URL. A preview never opens a measured funnel
    // session or spends a credential; the real click can still use the same link.
    if (
      /prefetch|prerender/i.test(
        [request.headers.get("purpose"), request.headers.get("sec-purpose")].join(" "),
      )
    ) {
      return new NextResponse(null, {
        status: 204,
        headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" },
      })
    }

    if (!dependencies.enabled()) return redirectToQuiz(request, "invalid")
    const secret = process.env.FUNNEL_COOKIE_SIGNING_SECRET
    if (!secret) return redirectToQuiz(request, "unavailable")
    const token = request.nextUrl.searchParams.get("token")
    if (!isValidQuizEmailReturnCredential(token)) return redirectToQuiz(request, "invalid")
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
    const rate = await dependencies.rateLimit(ip, RETURN_LOOKUP_RATE_LIMIT)
    if (!rate.allowed) return redirectToQuiz(request, "unavailable")
    const resolved = await dependencies.resolve(token)
    if (resolved.status !== "resolved") return redirectToQuiz(request, resolved.status)
    if (resolved.packageKey !== QUIZ_EMAIL_RETURN_PACKAGE_KEY || !resolved.linkId) {
      return redirectToQuiz(request, "invalid")
    }

    const response = redirectToQuiz(request, "ready")
    // The message starts a new commercial journey only after a deliberate choice.
    // Until then the ordinary first question must not inherit an old Meta/test
    // package or a migration intent from this browser.
    response.cookies.delete(FUNNEL_SESSION_COOKIE)
    response.cookies.delete(FUNNEL_TOUCH_COOKIE)
    response.cookies.delete(REGULAR_QUIZ_FIELD_TEST_CAMPAIGN_COOKIE)
    response.cookies.delete(MIGRATION_QUIZ_COOKIE)
    response.cookies.set(
      QUIZ_EMAIL_RETURN_COOKIE,
      encodeQuizEmailReturnContext(resolved.linkId, secret),
      quizEmailReturnCookieOptions,
    )
    return response
  }
}

export const GET = createQuizEmailReturnEntryHandler()
