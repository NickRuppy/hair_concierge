import { after, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { checkRateLimit, QUIZ_LEAD_RATE_LIMIT } from "@/lib/rate-limit"
import { leadSchema } from "@/lib/quiz/validators"
import { canonicalizeQuizAnswers } from "@/lib/quiz/normalization"
import { findReusableLead } from "@/lib/quiz/lead-lifecycle"
import { syncQuizLeadToCustomerIo } from "@/lib/customerio/quiz-sync"
import { cookies } from "next/headers"
import { FUNNEL_SESSION_COOKIE, FUNNEL_TOUCH_COOKIE } from "@/lib/funnel/cookie"
import {
  recordFunnelEvent,
  resolveFunnelCookieContext,
  resolvePendingFunnelTouchValue,
} from "@/lib/funnel/server"
import {
  deliverMetaConversion,
  isMetaLeadCapiEnabled,
  metaRequestData,
  resolveBrowserFunnelEventId,
  type MetaRequestData,
  type MetaConversionInput,
  type MetaConversionDeliveryResult,
} from "@/lib/analytics/meta-capi"
import { META_QUIZ_EVENT_SOURCE_URL } from "@/lib/analytics/page-url"

const DEDUPE_WINDOW_MS = 15 * 60 * 1000
const MAX_RECENT_DUPLICATE_CANDIDATES = 10

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown"
  const rateCheck = await checkRateLimit(ip, QUIZ_LEAD_RATE_LIMIT)
  if (!rateCheck.allowed) {
    const status = rateCheck.error === "service_unavailable" ? 503 : 429
    return NextResponse.json({ error: "Zu viele Anfragen" }, { status })
  }

  try {
    const body = await request.json()
    const { browserEventId, funnelEventId } = resolveBrowserFunnelEventId(body)
    const parsed = leadSchema.parse(body)
    const email = normalizeEmail(parsed.email)
    const quizAnswers = canonicalizeQuizAnswers(parsed.quizAnswers)
    const metaUserRequestData = metaRequestData(request)

    const supabase = createAdminClient()
    const cookieStore = await cookies()
    const funnelContext = await resolveFunnelCookieContext(
      cookieStore.get(FUNNEL_SESSION_COOKIE)?.value,
    )
    const funnelTouch = funnelContext
      ? await resolvePendingFunnelTouchValue(
          cookieStore.get(FUNNEL_TOUCH_COOKIE)?.value,
          funnelContext,
        )
      : null
    const recentThreshold = new Date(Date.now() - DEDUPE_WINDOW_MS).toISOString()

    const { data: recentLeads, error: recentLeadsError } = await supabase
      .from("leads")
      .select("id, quiz_answers, marketing_consent, status")
      .eq("email", email)
      .gte("created_at", recentThreshold)
      .order("created_at", { ascending: false })
      .limit(MAX_RECENT_DUPLICATE_CANDIDATES)

    if (recentLeadsError) {
      console.error("Lead dedupe lookup error:", recentLeadsError)
      return NextResponse.json({ error: "Speichern fehlgeschlagen" }, { status: 500 })
    }

    const existingLead = findReusableLead(
      (recentLeads as Array<{ id: string; quiz_answers: Record<string, unknown> | null }> | null) ??
        null,
      quizAnswers,
    )

    if (existingLead) {
      const createdAt = new Date().toISOString()
      if (existingLead.marketing_consent !== parsed.marketingConsent) {
        const { error: updateError } = await supabase
          .from("leads")
          .update({ marketing_consent: parsed.marketingConsent })
          .eq("id", existingLead.id)

        if (updateError) {
          console.error("Lead dedupe update error:", updateError)
          return NextResponse.json({ error: "Speichern fehlgeschlagen" }, { status: 500 })
        }
      }

      after(() =>
        syncQuizLeadToCustomerIo({
          createdAt,
          email,
          leadId: existingLead.id,
          marketingConsent: parsed.marketingConsent,
          name: parsed.name,
          quizAnswers,
          funnelSessionId: funnelContext?.sessionId,
          funnelPackageKey: funnelContext?.packageKey,
        }),
      )
      enqueueMetaLead({
        browserEventId,
        eventTime: createdAt,
        email,
        leadId: existingLead.id,
        name: parsed.name,
        requestData: metaUserRequestData,
      })

      const funnelRecorded = funnelContext
        ? await recordFunnelEvent({
            context: funnelContext,
            eventId: funnelEventId,
            milestone: "lead_captured",
            leadId: existingLead.id,
            touch: funnelTouch,
          })
            .then(() => true)
            .catch((error) => {
              console.warn("[funnel] lead attachment failed", error)
              return false
            })
        : false

      return leadResponse(existingLead.id, Boolean(funnelTouch) && funnelRecorded)
    }

    const { data, error } = await supabase
      .from("leads")
      .insert({
        name: parsed.name,
        email,
        marketing_consent: parsed.marketingConsent,
        quiz_answers: quizAnswers,
        status: "captured",
      })
      .select("id")
      .single()

    if (error) {
      console.error("Lead insert error:", error)
      return NextResponse.json({ error: "Speichern fehlgeschlagen" }, { status: 500 })
    }

    const createdAt = new Date().toISOString()
    after(() =>
      syncQuizLeadToCustomerIo({
        createdAt,
        email,
        leadId: data.id,
        marketingConsent: parsed.marketingConsent,
        name: parsed.name,
        quizAnswers,
        funnelSessionId: funnelContext?.sessionId,
        funnelPackageKey: funnelContext?.packageKey,
      }),
    )
    enqueueMetaLead({
      browserEventId,
      eventTime: createdAt,
      email,
      leadId: data.id,
      name: parsed.name,
      requestData: metaUserRequestData,
    })

    const funnelRecorded = funnelContext
      ? await recordFunnelEvent({
          context: funnelContext,
          eventId: funnelEventId,
          milestone: "lead_captured",
          leadId: data.id,
          touch: funnelTouch,
        })
          .then(() => true)
          .catch((error) => {
            console.warn("[funnel] lead attachment failed", error)
            return false
          })
      : false

    return leadResponse(data.id, Boolean(funnelTouch) && funnelRecorded)
  } catch (err) {
    console.error("Lead API error:", err)
    return NextResponse.json({ error: "Ungueltige Daten" }, { status: 400 })
  }
}

export type MetaLeadEnqueueInput = {
  browserEventId: string | null
  eventTime: string
  email: string
  leadId: string
  name: string
  requestData: MetaRequestData
}

export type MetaLeadEnqueueDependencies = {
  deliver?: (input: MetaConversionInput) => Promise<MetaConversionDeliveryResult>
  enabled?: boolean
  schedule?: (callback: () => Promise<void>) => void
  warn?: (message: string, context: { status?: number }) => void
}

export function enqueueMetaLead(
  { browserEventId, eventTime, email, leadId, name, requestData }: MetaLeadEnqueueInput,
  dependencies: MetaLeadEnqueueDependencies = {},
) {
  const enabled = dependencies.enabled ?? isMetaLeadCapiEnabled()
  if (!enabled || !browserEventId) return false

  const schedule = dependencies.schedule ?? after
  schedule(async () => {
    const conversion: MetaConversionInput = {
      eventName: "Lead",
      eventId: browserEventId,
      eventSourceUrl: META_QUIZ_EVENT_SOURCE_URL,
      eventTime: new Date(eventTime),
      user: {
        email,
        name,
        externalId: leadId,
        ...requestData,
      },
    }
    const result = dependencies.deliver
      ? await dependencies.deliver(conversion)
      : await deliverMetaConversion(conversion, { enabled })

    if (!result.ok && !result.skipped) {
      const warn = dependencies.warn ?? console.warn
      warn("[meta:capi] Lead delivery failed", { status: result.status })
    }
  })

  return true
}

function leadResponse(leadId: string, clearTouch: boolean) {
  const response = NextResponse.json({ leadId })
  if (clearTouch) response.cookies.set(FUNNEL_TOUCH_COOKIE, "", { path: "/", maxAge: 0 })
  return response
}
