import { resolveFunnelCookieContext } from "@/lib/funnel/server"
import { resolveModeratorJourney } from "@/lib/personal-plan-field-test/moderator-journey"
import { NextResponse, type NextRequest } from "next/server"

import {
  encodeFunnelContext,
  funnelSessionCookieOptions,
  FUNNEL_SESSION_COOKIE,
  FUNNEL_TOUCH_COOKIE,
} from "@/lib/funnel/cookie"
import { isPersonalPlanQuizCrossBrowserResumeEnabled } from "@/lib/funnel/flags"
import {
  createPersonalPlanQuizResumeCredential,
  decodePersonalPlanQuizDraftCookie,
  encodePersonalPlanQuizDraftCookie,
  hashPersonalPlanQuizResumeCredential,
  isPersonalPlanQuizDraftCookieSecretConfigured,
  isValidPersonalPlanQuizResumeToken,
  noStoreHeaders,
  PERSONAL_PLAN_QUIZ_DRAFT_COOKIE,
  PERSONAL_PLAN_QUIZ_RESUME_QUERY_KEY,
  personalPlanQuizDraftCookieOptions,
} from "@/lib/personal-plan-quiz/server-draft"
import {
  checkRateLimit,
  PERSONAL_PLAN_QUIZ_DRAFT_CREDENTIAL_RATE_LIMIT,
  PERSONAL_PLAN_QUIZ_DRAFT_RESUME_IP_RATE_LIMIT,
} from "@/lib/rate-limit"
import { createAdminClient } from "@/lib/supabase/admin"

function clearDraftCookie(response: NextResponse) {
  response.cookies.set(PERSONAL_PLAN_QUIZ_DRAFT_COOKIE, "", {
    ...personalPlanQuizDraftCookieOptions,
    maxAge: 0,
  })
}

export function cleanRedirect(request: NextRequest) {
  const url = new URL("/lp/haarplan", request.url)
  const response = NextResponse.redirect(url, { headers: noStoreHeaders() })
  // A valid credential can belong to the source browser after another browser
  // has rotated the draft. Keep it so its next write is rejected as stale
  // instead of being mistaken for a fresh create.
  if (
    !decodePersonalPlanQuizDraftCookie(request.cookies.get(PERSONAL_PLAN_QUIZ_DRAFT_COOKIE)?.value)
  )
    clearDraftCookie(response)
  return response
}

function requestIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
}

export async function GET(request: NextRequest) {
  if (!isPersonalPlanQuizCrossBrowserResumeEnabled()) return cleanRedirect(request)
  const moderator = await resolveModeratorJourney({
    cookies: request.cookies,
    funnelContext: await resolveFunnelCookieContext(
      request.cookies.get(FUNNEL_SESSION_COOKIE)?.value,
    ),
  })
  if (moderator.kind !== "ordinary") return cleanRedirect(request)
  const secret = process.env.FUNNEL_COOKIE_SIGNING_SECRET
  if (!secret || !isPersonalPlanQuizDraftCookieSecretConfigured()) return cleanRedirect(request)
  const resumeToken = request.nextUrl.searchParams.get(PERSONAL_PLAN_QUIZ_RESUME_QUERY_KEY)
  if (!isValidPersonalPlanQuizResumeToken(resumeToken)) return cleanRedirect(request)
  if (!resumeToken) return cleanRedirect(request)

  const tokenHash = hashPersonalPlanQuizResumeCredential(resumeToken)
  const [ipRate, credentialRate] = await Promise.all([
    checkRateLimit(requestIp(request), PERSONAL_PLAN_QUIZ_DRAFT_RESUME_IP_RATE_LIMIT),
    checkRateLimit(tokenHash, PERSONAL_PLAN_QUIZ_DRAFT_CREDENTIAL_RATE_LIMIT),
  ])
  if (!ipRate.allowed || !credentialRate.allowed) return cleanRedirect(request)

  try {
    const replacement = createPersonalPlanQuizResumeCredential()
    const { data, error } = await createAdminClient().rpc("exchange_personal_plan_quiz_draft", {
      p_resume_token_hash: tokenHash,
      p_replacement_token_hash: replacement.resumeTokenHash,
    })
    if (error || !Array.isArray(data) || data.length !== 1) return cleanRedirect(request)
    const row = data[0] as Record<string, unknown>
    if (
      typeof row.draft_id !== "string" ||
      typeof row.browser_generation !== "number" ||
      typeof row.expires_at !== "string" ||
      typeof row.visitor_id !== "string" ||
      typeof row.session_id !== "string" ||
      row.package_key !== "meta_personal_plan_v1" ||
      typeof row.funnel_issued_at !== "string" ||
      !Number.isFinite(Date.parse(row.funnel_issued_at))
    )
      return cleanRedirect(request)

    const draftCookie = encodePersonalPlanQuizDraftCookie({
      draftId: row.draft_id,
      browserGeneration: row.browser_generation,
      expiresAt: row.expires_at,
    })
    if (!draftCookie) return cleanRedirect(request)
    const funnelCookie = await encodeFunnelContext(
      {
        visitorId: row.visitor_id,
        sessionId: row.session_id,
        packageKey: row.package_key,
        issuedAt: Date.parse(row.funnel_issued_at),
      },
      secret,
    )
    const destination = new URL("/lp/haarplan", request.url)
    destination.searchParams.set(PERSONAL_PLAN_QUIZ_RESUME_QUERY_KEY, replacement.resumeToken)
    const response = NextResponse.redirect(destination, { headers: noStoreHeaders() })
    response.cookies.set(
      PERSONAL_PLAN_QUIZ_DRAFT_COOKIE,
      draftCookie,
      personalPlanQuizDraftCookieOptions,
    )
    response.cookies.set(FUNNEL_SESSION_COOKIE, funnelCookie, funnelSessionCookieOptions)
    response.cookies.set(FUNNEL_TOUCH_COOKIE, "", { path: "/", maxAge: 0 })
    return response
  } catch {
    return cleanRedirect(request)
  }
}
