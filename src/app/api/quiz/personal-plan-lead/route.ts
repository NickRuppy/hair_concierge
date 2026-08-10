import { after, NextResponse } from "next/server"
import { cookies } from "next/headers"

import { checkEmailDeliverability } from "@/lib/email-deliverability"
import { recordEmailDeliverabilityOutcome } from "@/lib/email-deliverability-observability"
import {
  EMAIL_DELIVERABILITY_REJECTION_MESSAGE,
  type EmailDeliverabilityRejectionResponse,
} from "@/lib/email-deliverability-shared"
import { dispatchCustomerIoProfileSyncForLead } from "@/lib/personal-plan-quiz/customerio-outbox"
import { enqueueMetaLead } from "@/app/api/quiz/lead/route"
import { metaRequestData, resolveBrowserFunnelEventId } from "@/lib/analytics/meta-capi"
import { META_PERSONAL_PLAN_QUIZ_EVENT_SOURCE_URL } from "@/lib/analytics/page-url"
import {
  canonicalizePersonalPlanAnswers,
  hashPersonalPlanAnswers,
  hashPersonalPlanClaimToken,
  normalizePersonalPlanEmail,
  personalPlanLeadRequestSchema,
} from "@/lib/personal-plan-quiz/persistence"
import { checkRateLimit, QUIZ_LEAD_RATE_LIMIT } from "@/lib/rate-limit"
import { createAdminClient } from "@/lib/supabase/admin"
import { FUNNEL_SESSION_COOKIE, FUNNEL_TOUCH_COOKIE } from "@/lib/funnel/cookie"
import {
  recordFunnelEvent,
  resolveFunnelCookieContext,
  resolvePendingFunnelTouchValue,
} from "@/lib/funnel/server"
import { isPersonalPlanQuizV1Enabled, isPersonalPlanResultReturnEnabled } from "@/lib/funnel/flags"
import { issuePersonalPlanResultReturn } from "@/lib/personal-plan-quiz/result-return"
import {
  bindPersonalPlanFieldTestLead,
  PERSONAL_PLAN_FIELD_TEST_CAMPAIGN_COOKIE,
  resolvePersonalPlanFieldTestCampaignCookie,
} from "@/lib/personal-plan-field-test"

interface PersonalPlanLeadPostDependencies {
  checkRateLimit: typeof checkRateLimit
  checkEmailDeliverability: typeof checkEmailDeliverability
  recordEmailDeliverabilityOutcome: typeof recordEmailDeliverabilityOutcome
  createAdminClient: typeof createAdminClient
  cookies: typeof cookies
  issueResultReturn: typeof issuePersonalPlanResultReturn
  enqueueMetaLead: typeof enqueueMetaLead
  recordFunnelEvent: typeof recordFunnelEvent
  resolveFunnelCookieContext: typeof resolveFunnelCookieContext
  resolvePendingFunnelTouchValue: typeof resolvePendingFunnelTouchValue
  bindPersonalPlanFieldTestLead: typeof bindPersonalPlanFieldTestLead
  resolvePersonalPlanFieldTestCampaignCookie: typeof resolvePersonalPlanFieldTestCampaignCookie
  scheduleAfter: typeof after
}

export function createPersonalPlanLeadPostHandler(
  overrides: Partial<PersonalPlanLeadPostDependencies> = {},
) {
  const dependencies: PersonalPlanLeadPostDependencies = {
    checkRateLimit,
    checkEmailDeliverability,
    recordEmailDeliverabilityOutcome,
    createAdminClient,
    cookies,
    issueResultReturn: issuePersonalPlanResultReturn,
    enqueueMetaLead,
    recordFunnelEvent,
    resolveFunnelCookieContext,
    resolvePendingFunnelTouchValue,
    bindPersonalPlanFieldTestLead,
    resolvePersonalPlanFieldTestCampaignCookie,
    scheduleAfter: after,
    ...overrides,
  }

  return async function POST(request: Request) {
    if (!isPersonalPlanQuizV1Enabled()) {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 })
    }

    const rateCheck = await dependencies.checkRateLimit(
      request.headers.get("x-forwarded-for") ?? "unknown",
      QUIZ_LEAD_RATE_LIMIT,
    )
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: "Zu viele Anfragen" },
        { status: rateCheck.error === "service_unavailable" ? 503 : 429 },
      )
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Ungueltige Daten" }, { status: 400 })
    }
    const parseResult = personalPlanLeadRequestSchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json({ error: "Ungueltige Daten" }, { status: 400 })
    }

    try {
      const { browserEventId, funnelEventId } = resolveBrowserFunnelEventId(body)
      const parsed = parseResult.data
      const email = normalizePersonalPlanEmail(parsed.email)

      // Zustellbarkeit pruefen, bevor der Lead gespeichert wird. Tippfehler in
      // der Domain ("gmail.vom", "gmx.den") waren die Hauptursache fuer eine
      // Bounce-Quote von rund 4,6 Prozent, die Gmail den Absender in den
      // Spam-Ordner sortieren laesst. Bei DNS-Problemen laesst die Pruefung
      // bewusst durch, sie darf nie Leads blockieren.
      const deliverability = await dependencies.checkEmailDeliverability(email)
      dependencies.recordEmailDeliverabilityOutcome("personal_plan", deliverability)
      if (!deliverability.ok) {
        const rejection: EmailDeliverabilityRejectionResponse = {
          error: EMAIL_DELIVERABILITY_REJECTION_MESSAGE,
          reason: deliverability.reason,
          suggestion: deliverability.suggestion,
        }
        return NextResponse.json(rejection, { status: 422 })
      }
      const deliverableEmail = deliverability.normalized
      const metaUserRequestData = metaRequestData(request)
      const quizAnswers = canonicalizePersonalPlanAnswers(parsed.answers)
      const answerHash = hashPersonalPlanAnswers(quizAnswers)
      const supabase = dependencies.createAdminClient()
      const cookieStore = await dependencies.cookies()
      const funnelContext = await dependencies.resolveFunnelCookieContext(
        cookieStore.get(FUNNEL_SESSION_COOKIE)?.value,
      )
      const funnelTouch = funnelContext
        ? await dependencies.resolvePendingFunnelTouchValue(
            cookieStore.get(FUNNEL_TOUCH_COOKIE)?.value,
            funnelContext,
          )
        : null
      const fieldTestCookieValue = cookieStore.get(PERSONAL_PLAN_FIELD_TEST_CAMPAIGN_COOKIE)?.value
      const fieldTestCampaign = funnelContext
        ? await dependencies.resolvePersonalPlanFieldTestCampaignCookie(fieldTestCookieValue)
        : { kind: "unavailable" as const, code: "field_test_unavailable" as const }
      const { data: savedLeads, error: saveError } = await supabase.rpc(
        "save_personal_plan_lead_with_artifact",
        {
          p_email: deliverableEmail,
          p_marketing_consent: parsed.marketingConsent,
          p_quiz_answers: quizAnswers,
          p_artifact_id: parsed.preparedPlan.artifactId,
          p_claim_token_hash: hashPersonalPlanClaimToken(parsed.preparedPlan.claimToken),
          p_answer_hash: answerHash,
        },
      )
      if (saveError) throw saveError
      const leadId = savedLeads?.[0]?.lead_id
      if (typeof leadId !== "string") {
        throw new Error("Personal-plan lead save returned no lead ID")
      }

      const createdAt = new Date().toISOString()
      dependencies.scheduleAfter(async () => {
        try {
          const outcome = await dispatchCustomerIoProfileSyncForLead(supabase, leadId)
          if (outcome === "failed") {
            console.warn("[customerio:profile-sync] deferred delivery queued for retry", {
              leadId,
            })
          }
        } catch (error) {
          console.warn("[customerio:profile-sync] deferred dispatch failed", {
            leadId,
            error: error instanceof Error ? error.message : String(error),
          })
        }
      })
      if (fieldTestCampaign.kind !== "eligible") {
        dependencies.enqueueMetaLead({
          browserEventId,
          email: deliverableEmail,
          eventSourceUrl: META_PERSONAL_PLAN_QUIZ_EVENT_SOURCE_URL,
          eventTime: createdAt,
          leadId,
          name: "",
          requestData: metaUserRequestData,
        })
      }
      const attributionAttached = funnelContext
        ? await dependencies
            .recordFunnelEvent({
              context: funnelContext,
              eventId: funnelEventId,
              milestone: "lead_captured",
              leadId,
              touch: funnelTouch,
            })
            .then(() => true)
            .catch((error) => {
              console.warn("[funnel] personal-plan lead attachment failed", error)
              return false
            })
        : false
      const fieldTestAttached =
        attributionAttached && funnelContext && fieldTestCampaign.kind === "eligible"
          ? await dependencies.bindPersonalPlanFieldTestLead({
              campaignCookieValue: fieldTestCookieValue,
              funnelContext,
              leadId,
            })
          : false
      const response = NextResponse.json(
        fieldTestCampaign.kind === "eligible"
          ? { leadId, attributionAttached, fieldTestAttached }
          : { leadId, attributionAttached },
      )
      if (isPersonalPlanResultReturnEnabled()) {
        try {
          const issued = await dependencies.issueResultReturn({
            leadId,
            response,
            admin: supabase as never,
          })
          if (!issued.issued) {
            console.warn("[personal-plan-result-return] capability issuance unavailable")
          }
        } catch {
          console.warn("[personal-plan-result-return] capability issuance unavailable")
        }
      }
      if (attributionAttached && funnelTouch)
        response.cookies.set(FUNNEL_TOUCH_COOKIE, "", { path: "/", maxAge: 0 })
      return response
    } catch (error) {
      console.error("Personal-plan lead API error:", error)
      return NextResponse.json(
        {
          error: isPreparedPlanClaimError(error)
            ? "Plan muss erneut vorbereitet werden"
            : "Speichern fehlgeschlagen",
        },
        { status: isPreparedPlanClaimError(error) ? 409 : 500 },
      )
    }
  }
}

export const POST = createPersonalPlanLeadPostHandler()

function isPreparedPlanClaimError(error: unknown): boolean {
  if (!error || typeof error !== "object" || Array.isArray(error)) return false
  const code = (error as Record<string, unknown>).code
  return code === "22023" || code === "23505" || code === "P0002"
}
