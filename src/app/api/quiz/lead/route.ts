import { after, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { checkRateLimit, QUIZ_LEAD_RATE_LIMIT } from "@/lib/rate-limit"
import { leadSchema } from "@/lib/quiz/validators"
import { canonicalizeQuizAnswers } from "@/lib/quiz/normalization"
import { findReusableLead } from "@/lib/quiz/lead-lifecycle"
import { syncQuizLeadToCustomerIo } from "@/lib/customerio/quiz-sync"
import {
  bindRegularQuizFieldTestLead,
  isRegularQuizFieldTestEnabled,
  REGULAR_QUIZ_FIELD_TEST_CAMPAIGN_COOKIE,
} from "@/lib/personal-plan-field-test"
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
import { checkEmailDeliverability } from "@/lib/email-deliverability"
import { recordEmailDeliverabilityOutcome } from "@/lib/email-deliverability-observability"
import {
  EMAIL_DELIVERABILITY_REJECTION_MESSAGE,
  type EmailDeliverabilityRejectionResponse,
} from "@/lib/email-deliverability-shared"

const DEDUPE_WINDOW_MS = 15 * 60 * 1000
const MAX_RECENT_DUPLICATE_CANDIDATES = 10

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

interface QuizLeadPostDependencies {
  checkRateLimit: typeof checkRateLimit
  checkEmailDeliverability: typeof checkEmailDeliverability
  recordEmailDeliverabilityOutcome: typeof recordEmailDeliverabilityOutcome
  createAdminClient: typeof createAdminClient
  cookies: typeof cookies
  bindRegularQuizFieldTestLead: typeof bindRegularQuizFieldTestLead
  isRegularQuizFieldTestEnabled: typeof isRegularQuizFieldTestEnabled
  resolveFunnelCookieContext: typeof resolveFunnelCookieContext
  resolvePendingFunnelTouchValue: typeof resolvePendingFunnelTouchValue
  recordFunnelEvent: typeof recordFunnelEvent
  syncQuizLeadToCustomerIo: typeof syncQuizLeadToCustomerIo
  enqueueMetaLead: typeof enqueueMetaLead
  scheduleAfter: typeof after
}

export function createQuizLeadPostHandler(overrides: Partial<QuizLeadPostDependencies> = {}) {
  const dependencies: QuizLeadPostDependencies = {
    checkRateLimit,
    checkEmailDeliverability,
    recordEmailDeliverabilityOutcome,
    createAdminClient,
    cookies,
    bindRegularQuizFieldTestLead,
    isRegularQuizFieldTestEnabled,
    resolveFunnelCookieContext,
    resolvePendingFunnelTouchValue,
    recordFunnelEvent,
    syncQuizLeadToCustomerIo,
    enqueueMetaLead,
    scheduleAfter: after,
    ...overrides,
  }

  return async function POST(request: Request) {
    const ip = request.headers.get("x-forwarded-for") ?? "unknown"
    const rateCheck = await dependencies.checkRateLimit(ip, QUIZ_LEAD_RATE_LIMIT)
    if (!rateCheck.allowed) {
      const status = rateCheck.error === "service_unavailable" ? 503 : 429
      return NextResponse.json({ error: "Zu viele Anfragen" }, { status })
    }

    try {
      const body = await request.json()
      const { browserEventId, funnelEventId } = resolveBrowserFunnelEventId(body)
      const parsed = leadSchema.parse(body)
      const email = normalizeEmail(parsed.email)
      const deliverability = await dependencies.checkEmailDeliverability(email)
      dependencies.recordEmailDeliverabilityOutcome("legacy", deliverability)
      if (!deliverability.ok) {
        const rejection: EmailDeliverabilityRejectionResponse = {
          error: EMAIL_DELIVERABILITY_REJECTION_MESSAGE,
          reason: deliverability.reason,
          suggestion: deliverability.suggestion,
        }
        return NextResponse.json(rejection, { status: 422 })
      }
      const deliverableEmail = deliverability.normalized
      const quizAnswers = canonicalizeQuizAnswers(parsed.quizAnswers)
      const metaUserRequestData = metaRequestData(request)

      const cookieStore = await dependencies.cookies()
      // A field-test cookie is a non-commercial intent marker. If the global
      // switch is turned off after a tester entered, fail closed instead of
      // allowing their submission to fall through into the paid funnel.
      const regularFieldTestIntent = Boolean(
        cookieStore.get(REGULAR_QUIZ_FIELD_TEST_CAMPAIGN_COOKIE)?.value,
      )
      if (regularFieldTestIntent && !dependencies.isRegularQuizFieldTestEnabled()) {
        return fieldTestUnavailableResponse()
      }

      const supabase = dependencies.createAdminClient()
      const funnelContext = await dependencies.resolveFunnelCookieContext(
        cookieStore.get(FUNNEL_SESSION_COOKIE)?.value,
      )
      const funnelTouch = funnelContext
        ? await dependencies.resolvePendingFunnelTouchValue(
            cookieStore.get(FUNNEL_TOUCH_COOKIE)?.value,
            funnelContext,
          )
        : null
      const recentThreshold = new Date(Date.now() - DEDUPE_WINDOW_MS).toISOString()

      const { data: recentLeads, error: recentLeadsError } = await supabase
        .from("leads")
        .select("id, quiz_answers, marketing_consent, status")
        .eq("quiz_kind", "legacy")
        .eq("email", deliverableEmail)
        .gte("created_at", recentThreshold)
        .order("created_at", { ascending: false })
        .limit(MAX_RECENT_DUPLICATE_CANDIDATES)

      if (recentLeadsError) {
        console.error("Lead dedupe lookup error:", recentLeadsError)
        return NextResponse.json({ error: "Speichern fehlgeschlagen" }, { status: 500 })
      }

      const existingLead = findReusableLead(
        (recentLeads as Array<{
          id: string
          quiz_answers: Record<string, unknown> | null
        }> | null) ?? null,
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

        const funnelRecorded = funnelContext
          ? await dependencies
              .recordFunnelEvent({
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

        const fieldTestAttached = await bindRegularFieldTestLead({
          intent: regularFieldTestIntent,
          campaignCookieValue: cookieStore.get(REGULAR_QUIZ_FIELD_TEST_CAMPAIGN_COOKIE)?.value,
          funnelContext,
          leadId: existingLead.id,
          bind: dependencies.bindRegularQuizFieldTestLead,
        })
        if (regularFieldTestIntent && !fieldTestAttached) return fieldTestUnavailableResponse()
        if (!regularFieldTestIntent) {
          dependencies.scheduleAfter(() =>
            dependencies.syncQuizLeadToCustomerIo({
              createdAt,
              email: deliverableEmail,
              leadId: existingLead.id,
              marketingConsent: parsed.marketingConsent,
              name: parsed.name,
              quizAnswers,
              funnelSessionId: funnelContext?.sessionId,
              funnelPackageKey: funnelContext?.packageKey,
            }),
          )
          dependencies.enqueueMetaLead({
            browserEventId,
            eventTime: createdAt,
            email: deliverableEmail,
            leadId: existingLead.id,
            name: parsed.name,
            requestData: metaUserRequestData,
          })
        }

        return leadResponse(
          existingLead.id,
          Boolean(funnelTouch) && funnelRecorded,
          regularFieldTestIntent ? fieldTestAttached : undefined,
        )
      }

      const { data, error } = await supabase
        .from("leads")
        .insert({
          name: parsed.name,
          email: deliverableEmail,
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
      const funnelRecorded = funnelContext
        ? await dependencies
            .recordFunnelEvent({
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

      const fieldTestAttached = await bindRegularFieldTestLead({
        intent: regularFieldTestIntent,
        campaignCookieValue: cookieStore.get(REGULAR_QUIZ_FIELD_TEST_CAMPAIGN_COOKIE)?.value,
        funnelContext,
        leadId: data.id,
        bind: dependencies.bindRegularQuizFieldTestLead,
      })
      if (regularFieldTestIntent && !fieldTestAttached) return fieldTestUnavailableResponse()
      if (!regularFieldTestIntent) {
        dependencies.scheduleAfter(() =>
          dependencies.syncQuizLeadToCustomerIo({
            createdAt,
            email: deliverableEmail,
            leadId: data.id,
            marketingConsent: parsed.marketingConsent,
            name: parsed.name,
            quizAnswers,
            funnelSessionId: funnelContext?.sessionId,
            funnelPackageKey: funnelContext?.packageKey,
          }),
        )
        dependencies.enqueueMetaLead({
          browserEventId,
          eventTime: createdAt,
          email: deliverableEmail,
          leadId: data.id,
          name: parsed.name,
          requestData: metaUserRequestData,
        })
      }

      return leadResponse(
        data.id,
        Boolean(funnelTouch) && funnelRecorded,
        regularFieldTestIntent ? fieldTestAttached : undefined,
      )
    } catch (err) {
      console.error("Lead API error:", err)
      return NextResponse.json({ error: "Ungueltige Daten" }, { status: 400 })
    }
  }
}

export const POST = createQuizLeadPostHandler()

export type MetaLeadEnqueueInput = {
  browserEventId: string | null
  eventTime: string
  email: string
  eventSourceUrl?: string
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
  {
    browserEventId,
    eventTime,
    email,
    eventSourceUrl,
    leadId,
    name,
    requestData,
  }: MetaLeadEnqueueInput,
  dependencies: MetaLeadEnqueueDependencies = {},
) {
  const enabled = dependencies.enabled ?? isMetaLeadCapiEnabled()
  if (!enabled || !browserEventId) return false

  const schedule = dependencies.schedule ?? after
  schedule(async () => {
    const conversion: MetaConversionInput = {
      eventName: "Lead",
      eventId: browserEventId,
      eventSourceUrl: eventSourceUrl ?? META_QUIZ_EVENT_SOURCE_URL,
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

export async function bindRegularFieldTestLead({
  intent,
  campaignCookieValue,
  funnelContext,
  leadId,
  bind,
}: {
  intent: boolean
  campaignCookieValue: string | undefined
  funnelContext: Awaited<ReturnType<typeof resolveFunnelCookieContext>>
  leadId: string
  bind: typeof bindRegularQuizFieldTestLead
}) {
  if (!intent) return false
  if (!funnelContext || funnelContext.packageKey !== "default_organic") return false
  return bind({ campaignCookieValue, funnelContext, leadId })
}

function fieldTestUnavailableResponse() {
  return NextResponse.json({ error: "Testzugang ist nicht verfügbar" }, { status: 503 })
}

function leadResponse(leadId: string, clearTouch: boolean, fieldTestAttached?: boolean) {
  const response = NextResponse.json(
    fieldTestAttached === undefined ? { leadId } : { leadId, fieldTestAttached },
  )
  if (clearTouch) response.cookies.set(FUNNEL_TOUCH_COOKIE, "", { path: "/", maxAge: 0 })
  return response
}
