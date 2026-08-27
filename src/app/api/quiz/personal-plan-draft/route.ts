import { resolveModeratorJourney } from "@/lib/personal-plan-field-test/moderator-journey"
import { NextResponse, type NextRequest } from "next/server"

import { FUNNEL_SESSION_COOKIE } from "@/lib/funnel/cookie"
import { isPersonalPlanQuizCrossBrowserResumeEnabled } from "@/lib/funnel/flags"
import { resolveFunnelCookieContext } from "@/lib/funnel/server"
import {
  createPersonalPlanQuizResumeCredential,
  decodePersonalPlanQuizDraftCookie,
  encodePersonalPlanQuizDraftCookie,
  isPersonalPlanQuizDraftCookieSecretConfigured,
  isSameOriginRequest,
  noStoreHeaders,
  parsePersonalPlanQuizServerDraft,
  PERSONAL_PLAN_QUIZ_DRAFT_COOKIE,
  PERSONAL_PLAN_QUIZ_DRAFT_MAX_BODY_BYTES,
  PERSONAL_PLAN_QUIZ_DRAFT_VERSION,
  personalPlanQuizDraftCookieOptions,
} from "@/lib/personal-plan-quiz/server-draft"
import {
  checkRateLimit,
  PERSONAL_PLAN_QUIZ_DRAFT_IP_RATE_LIMIT,
  PERSONAL_PLAN_QUIZ_DRAFT_WRITE_RATE_LIMIT,
} from "@/lib/rate-limit"
import { createAdminClient } from "@/lib/supabase/admin"

function disabled() {
  return NextResponse.json({ error: "not_found" }, { status: 404, headers: noStoreHeaders() })
}

function requestIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
}

async function readBoundedJson(request: Request): Promise<unknown | null> {
  const declared = Number(request.headers.get("content-length") ?? 0)
  if (declared > PERSONAL_PLAN_QUIZ_DRAFT_MAX_BODY_BYTES) return null
  const text = await request.text()
  if (new TextEncoder().encode(text).byteLength > PERSONAL_PLAN_QUIZ_DRAFT_MAX_BODY_BYTES)
    return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function clearDraftCookie(response: NextResponse) {
  response.cookies.set(PERSONAL_PLAN_QUIZ_DRAFT_COOKIE, "", {
    ...personalPlanQuizDraftCookieOptions,
    maxAge: 0,
  })
}

export async function POST(request: NextRequest) {
  if (!isPersonalPlanQuizCrossBrowserResumeEnabled()) return disabled()
  if (!isPersonalPlanQuizDraftCookieSecretConfigured())
    return NextResponse.json({ error: "unavailable" }, { status: 202, headers: noStoreHeaders() })
  if (!isSameOriginRequest(request))
    return NextResponse.json(
      { error: "invalid_request" },
      { status: 400, headers: noStoreHeaders() },
    )

  const moderator = await resolveModeratorJourney({
    cookies: request.cookies,
    funnelContext: await resolveFunnelCookieContext(
      request.cookies.get(FUNNEL_SESSION_COOKIE)?.value,
    ),
  })
  if (moderator.kind !== "ordinary") return disabled()

  const existingCookieValue = request.cookies.get(PERSONAL_PLAN_QUIZ_DRAFT_COOKIE)?.value
  const existingCookie = decodePersonalPlanQuizDraftCookie(existingCookieValue)
  const [ipRateLimit, credentialRateLimit] = await Promise.all([
    checkRateLimit(requestIp(request), PERSONAL_PLAN_QUIZ_DRAFT_IP_RATE_LIMIT),
    existingCookie
      ? checkRateLimit(existingCookie.draftId, PERSONAL_PLAN_QUIZ_DRAFT_WRITE_RATE_LIMIT)
      : Promise.resolve<{ allowed: boolean; error?: string }>({ allowed: true }),
  ])
  const rejectedRateLimit = !ipRateLimit.allowed
    ? ipRateLimit
    : !credentialRateLimit.allowed
      ? credentialRateLimit
      : null
  if (rejectedRateLimit)
    return NextResponse.json(
      { error: rejectedRateLimit.error ?? "rate_limited" },
      { status: rejectedRateLimit.error ? 503 : 429, headers: noStoreHeaders() },
    )

  const parsed = parsePersonalPlanQuizServerDraft(await readBoundedJson(request))
  if (!parsed)
    return NextResponse.json(
      { error: "invalid_payload" },
      { status: 400, headers: noStoreHeaders() },
    )

  const admin = createAdminClient()

  try {
    if (existingCookie) {
      if (!parsed.expectedRevision)
        return NextResponse.json(
          { error: "invalid_payload" },
          { status: 400, headers: noStoreHeaders() },
        )
      const { data, error } = await admin.rpc("update_personal_plan_quiz_draft", {
        p_draft_id: existingCookie.draftId,
        p_browser_generation: existingCookie.browserGeneration,
        p_expected_revision: parsed.expectedRevision,
        p_draft: { version: PERSONAL_PLAN_QUIZ_DRAFT_VERSION, ...parsed.draft },
        p_allow_revision_catchup: parsed.allowRevisionCatchup === true,
      })
      if (error)
        return NextResponse.json(
          { error: "unavailable" },
          { status: 202, headers: noStoreHeaders() },
        )
      if (!Array.isArray(data) || data.length !== 1)
        return NextResponse.json({ error: "stale" }, { status: 409, headers: noStoreHeaders() })
      const row = data[0] as Record<string, unknown>
      const response = NextResponse.json(
        {
          status: "saved",
          draftId: existingCookie.draftId,
          revision: row.revision,
          browserGeneration: row.browser_generation,
        },
        { headers: noStoreHeaders() },
      )
      const expiresAt =
        typeof row.expires_at === "string" ? row.expires_at : existingCookie.expiresAt
      const signedCookie = encodePersonalPlanQuizDraftCookie({
        draftId: existingCookie.draftId,
        browserGeneration: existingCookie.browserGeneration,
        expiresAt,
      })
      if (signedCookie)
        response.cookies.set(
          PERSONAL_PLAN_QUIZ_DRAFT_COOKIE,
          signedCookie,
          personalPlanQuizDraftCookieOptions,
        )
      return response
    }

    const funnelContext = await resolveFunnelCookieContext(
      request.cookies.get(FUNNEL_SESSION_COOKIE)?.value,
    )
    if (!funnelContext || funnelContext.packageKey !== "meta_personal_plan_v1")
      return NextResponse.json({ error: "unavailable" }, { status: 202, headers: noStoreHeaders() })

    const credential = createPersonalPlanQuizResumeCredential()
    const { data, error } = await admin.rpc("create_personal_plan_quiz_draft", {
      p_funnel_session_id: funnelContext.sessionId,
      p_visitor_id: funnelContext.visitorId,
      p_package_key: funnelContext.packageKey,
      p_resume_token_hash: credential.resumeTokenHash,
      p_draft: { version: PERSONAL_PLAN_QUIZ_DRAFT_VERSION, ...parsed.draft },
    })
    if (error || !Array.isArray(data) || data.length !== 1)
      return NextResponse.json({ error: "unavailable" }, { status: 202, headers: noStoreHeaders() })
    const row = data[0] as Record<string, unknown>
    if (
      typeof row.draft_id !== "string" ||
      typeof row.browser_generation !== "number" ||
      typeof row.expires_at !== "string"
    )
      return NextResponse.json({ error: "unavailable" }, { status: 202, headers: noStoreHeaders() })
    const response = NextResponse.json(
      {
        status: "created",
        draftId: row.draft_id,
        revision: row.revision,
        browserGeneration: row.browser_generation,
        resumeToken: credential.resumeToken,
      },
      { headers: noStoreHeaders() },
    )
    const signedCookie = encodePersonalPlanQuizDraftCookie({
      draftId: row.draft_id,
      browserGeneration: row.browser_generation,
      expiresAt: row.expires_at,
    })
    if (!signedCookie)
      return NextResponse.json({ error: "unavailable" }, { status: 202, headers: noStoreHeaders() })
    response.cookies.set(
      PERSONAL_PLAN_QUIZ_DRAFT_COOKIE,
      signedCookie,
      personalPlanQuizDraftCookieOptions,
    )
    return response
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 202, headers: noStoreHeaders() })
  }
}

export async function DELETE(request: NextRequest) {
  if (!isPersonalPlanQuizCrossBrowserResumeEnabled()) return disabled()
  if (!isSameOriginRequest(request))
    return NextResponse.json(
      { error: "invalid_request" },
      { status: 400, headers: noStoreHeaders() },
    )
  const moderator = await resolveModeratorJourney({
    cookies: request.cookies,
    funnelContext: await resolveFunnelCookieContext(
      request.cookies.get(FUNNEL_SESSION_COOKIE)?.value,
    ),
  })
  if (moderator.kind !== "ordinary") return disabled()

  const response = NextResponse.json({ ok: true }, { headers: noStoreHeaders() })
  const cookie = decodePersonalPlanQuizDraftCookie(
    request.cookies.get(PERSONAL_PLAN_QUIZ_DRAFT_COOKIE)?.value,
  )
  clearDraftCookie(response)
  if (!cookie) return response
  try {
    await createAdminClient().rpc("revoke_personal_plan_quiz_draft", {
      p_draft_id: cookie.draftId,
      p_browser_generation: cookie.browserGeneration,
    })
  } catch {
    // Completion remains best-effort after clearing the browser credential.
  }
  return response
}
