import { cookies } from "next/headers"
import { NextResponse } from "next/server"

import {
  FUNNEL_SESSION_COOKIE,
  encodeFunnelContext,
  funnelSessionCookieOptions,
} from "@/lib/funnel/cookie"
import { isFunnelAttributionEnabled } from "@/lib/funnel/flags"
import { recordFunnelEvent, resolveFunnelCookieContext } from "@/lib/funnel/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { checkRateLimit } from "@/lib/rate-limit"
import {
  QUIZ_EMAIL_RETURN_COOKIE,
  QUIZ_EMAIL_RETURN_EDIT_COOKIE,
  QUIZ_EMAIL_RETURN_PACKAGE_KEY,
  quizEmailReturnCookieOptions,
} from "@/lib/quiz/email-return-context"
import { projectQuizEmailReturnPrefill } from "@/lib/quiz/email-return-prefill"
import { resolveQuizEmailReturnCookie } from "@/lib/quiz/email-return-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function loadEditLead(leadId: string) {
  const { data, error } = await createAdminClient()
    .from("leads")
    .select("id,quiz_kind,quiz_answers")
    .eq("id", leadId)
    .maybeSingle()
  return { data, error }
}

type ChoiceDependencies = {
  enabled: typeof isFunnelAttributionEnabled
  cookieStore: typeof cookies
  resolveSource: typeof resolveQuizEmailReturnCookie
  resolvePrevious: typeof resolveFunnelCookieContext
  record: typeof recordFunnelEvent
  loadLead: typeof loadEditLead
  rateLimit: typeof checkRateLimit
}

const RETURN_CHOICE_RATE_LIMIT = {
  prefix: "quiz-email-return-choice",
  limit: 20,
  windowMs: 3_600_000,
}

export function createQuizEmailReturnChoiceHandler(overrides: Partial<ChoiceDependencies> = {}) {
  const dependencies: ChoiceDependencies = {
    enabled: isFunnelAttributionEnabled,
    cookieStore: cookies,
    resolveSource: resolveQuizEmailReturnCookie,
    resolvePrevious: resolveFunnelCookieContext,
    record: recordFunnelEvent,
    loadLead: loadEditLead,
    rateLimit: checkRateLimit,
    ...overrides,
  }
  return async function POST(request: Request) {
    const origin = request.headers.get("origin")
    if (origin && origin !== new URL(request.url).origin) {
      return NextResponse.json({ status: "forbidden" }, { status: 403 })
    }
    if (!dependencies.enabled()) {
      return NextResponse.json({ status: "unavailable" }, { status: 503 })
    }
    const secret = process.env.FUNNEL_COOKIE_SIGNING_SECRET
    if (!secret) return NextResponse.json({ status: "unavailable" }, { status: 503 })
    const body = await request.json().catch(() => null)
    if (body?.choice !== "continue" && body?.choice !== "edit") {
      return NextResponse.json({ status: "invalid" }, { status: 400 })
    }

    const cookieStore = await dependencies.cookieStore()
    const returnCookieValue = cookieStore.get(QUIZ_EMAIL_RETURN_COOKIE)?.value
    const source = await dependencies.resolveSource(returnCookieValue)
    if (source.status !== "resolved") {
      return NextResponse.json(
        { status: source.status },
        { status: source.status === "unavailable" ? 503 : 410 },
      )
    }
    const rate = await dependencies.rateLimit(source.linkId, RETURN_CHOICE_RATE_LIMIT)
    if (!rate.allowed) {
      return NextResponse.json(
        { status: "unavailable" },
        { status: rate.error === "service_unavailable" ? 503 : 429 },
      )
    }

    let prefill: ReturnType<typeof projectQuizEmailReturnPrefill> | null = null
    if (body.choice === "edit") {
      const { data, error } = await dependencies.loadLead(source.leadId)
      if (error) return NextResponse.json({ status: "unavailable" }, { status: 503 })
      if (!data || data.quiz_kind !== source.quizKind || !data.quiz_answers) {
        return NextResponse.json({ status: "invalid" }, { status: 410 })
      }
      prefill = projectQuizEmailReturnPrefill(source.quizKind, data.quiz_answers)
    }

    const previous = await dependencies.resolvePrevious(
      cookieStore.get(FUNNEL_SESSION_COOKIE)?.value,
    )
    const now = Date.now()
    const context = {
      visitorId: previous?.visitorId ?? crypto.randomUUID(),
      sessionId: crypto.randomUUID(),
      packageKey: QUIZ_EMAIL_RETURN_PACKAGE_KEY,
      issuedAt: now,
    }
    try {
      const recorded = await dependencies.record({
        context,
        eventId: crypto.randomUUID(),
        milestone: "landing_viewed",
        leadId: body.choice === "continue" ? source.leadId : null,
        touch: {
          visitorId: context.visitorId,
          sessionId: context.sessionId,
          capturedAt: now,
          entryPath: "/quiz/return",
          utmSource: "customerio",
          utmMedium: "email",
          utmCampaign: source.campaignKey,
        },
        properties: {
          return_choice: body.choice,
          return_source_quiz_kind: source.quizKind,
        },
      })
      if (!recorded) throw new Error("Email return package unavailable")
    } catch {
      return NextResponse.json({ status: "unavailable" }, { status: 503 })
    }

    const response = NextResponse.json(
      body.choice === "continue"
        ? { status: "continue", destination: `/result/${source.leadId}` }
        : { status: "edit", answers: prefill },
    )
    response.cookies.set(
      FUNNEL_SESSION_COOKIE,
      await encodeFunnelContext(context, secret),
      funnelSessionCookieOptions,
    )
    response.cookies.set(
      QUIZ_EMAIL_RETURN_EDIT_COOKIE,
      body.choice === "edit" ? (returnCookieValue ?? "") : "",
      body.choice === "edit"
        ? quizEmailReturnCookieOptions
        : { ...quizEmailReturnCookieOptions, maxAge: 0 },
    )
    response.headers.set("Cache-Control", "private, no-store")
    response.headers.set("Referrer-Policy", "no-referrer")
    return response
  }
}

export const POST = createQuizEmailReturnChoiceHandler()
