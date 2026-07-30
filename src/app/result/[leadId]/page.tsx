import type { Metadata } from "next"
import { cookies } from "next/headers"
import { notFound } from "next/navigation"
import { createServerClient } from "@supabase/ssr"

import { ResultPageClient } from "./result-client"
import { parsePersonalPlanOfferModel } from "@/components/personal-plan-offer/model"
import type { PersonalPlanOfferModel } from "@/components/personal-plan-offer/types"
import { hasCurrentAppAccess } from "@/lib/billing/subscriptions"
import { normalizeStoredQuizAnswers } from "@/lib/quiz/normalization"
import {
  getQuizResultSearchParamValue,
  resolveQuizResultRetakeReturnTo,
} from "@/lib/quiz/result-navigation"
import type { QuizAnswers } from "@/lib/quiz/types"
import { resolvePersonalPlanOfferFocusTarget } from "@/lib/personal-plan-quiz/offer-focus"
import { storedQuizAnswersSchema } from "@/lib/quiz/validators"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  recordFunnelEvent,
  resolveFunnelContextForLead,
  resolveGuidedStoryOfferExperiment,
} from "@/lib/funnel/server"
import { isFunnelAttributionEnabled } from "@/lib/funnel/flags"
import type { FunnelCookieContext } from "@/lib/funnel/cookie"
import type { OfferEntryContext } from "@/lib/analytics/events"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
}

interface Props {
  params: Promise<{ leadId: string }>
  searchParams: Promise<{
    entry?: string | string[]
    focus?: string | string[]
    mode?: string | string[]
    returnTo?: string | string[]
  }>
}

interface LeadResultRow {
  id: string
  name: string
  quiz_kind: "legacy" | "personal_plan"
  quiz_answers: unknown
}

async function getLeadResult(leadId: string): Promise<LeadResultRow | null> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("leads")
    .select("id, name, quiz_kind, quiz_answers")
    .eq("id", leadId)
    .maybeSingle()

  if (error) {
    console.error("[result-page] failed to load lead", error)
    return null
  }

  return data as LeadResultRow | null
}

async function getPersonalPlanPublicOfferModel(
  leadId: string,
): Promise<PersonalPlanOfferModel | null> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("personal_plan_prepared_artifacts")
    .select("public_offer_model")
    .eq("lead_id", leadId)
    .eq("status", "attached")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.warn("[result-page] failed to load personal plan artifact", error)
    return null
  }

  return parsePersonalPlanOfferModel(data?.public_offer_model ?? null)
}

async function recordLeadOfferView(leadId: string, context: FunnelCookieContext | null) {
  if (!isFunnelAttributionEnabled() || !context) return null
  const eventId = crypto.randomUUID()
  await recordFunnelEvent({
    context,
    eventId,
    milestone: "offer_viewed",
    leadId,
  }).catch((error) => console.warn("[funnel] result offer tracking failed", error))
  return {
    funnelEventId: eventId,
    funnelSessionId: context.sessionId,
    funnelPackageKey: context.packageKey,
  }
}

function parseQuizAnswers(raw: unknown): QuizAnswers | null {
  const normalized = normalizeStoredQuizAnswers((raw as Record<string, unknown> | null) ?? null)
  const parsed = storedQuizAnswersSchema.safeParse(normalized)

  return parsed.success ? parsed.data : null
}

async function getAuthenticatedResultAccess(): Promise<boolean> {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return false

  return hasCurrentAppAccess(supabase, { userId: user.id, email: user.email }).catch((error) => {
    console.warn("[result-page] failed to resolve authenticated access", error)
    return false
  })
}

export default async function ResultPage({ params, searchParams }: Props) {
  const [{ leadId }, sp] = await Promise.all([params, searchParams])
  const focus = getQuizResultSearchParamValue(sp.focus)
  const entry = getQuizResultSearchParamValue(sp.entry)
  const focusRoutine = focus === "routine"
  const focusTarget = focus === "unlock-plan" ? "unlock-plan" : focusRoutine ? "pricing" : null
  const personalPlanFocusTarget = resolvePersonalPlanOfferFocusTarget(focus)
  const returnTo = resolveQuizResultRetakeReturnTo(sp.mode, sp.returnTo)
  const entryContext: OfferEntryContext = focusRoutine
    ? "routine_return"
    : entry === "quiz_completion"
      ? "quiz_completion"
      : entry === "result_email"
        ? "result_email"
        : "saved_result"
  const [lead, hasAccess] = await Promise.all([
    getLeadResult(leadId),
    getAuthenticatedResultAccess(),
  ])
  const quizAnswers = lead?.quiz_kind === "legacy" ? parseQuizAnswers(lead.quiz_answers) : null
  const personalPlanOffer =
    lead?.quiz_kind === "personal_plan" ? await getPersonalPlanPublicOfferModel(lead.id) : null

  if (!lead || (lead.quiz_kind === "legacy" && !quizAnswers)) {
    notFound()
  }

  const funnelContext = hasAccess ? null : await resolveFunnelContextForLead(leadId)
  const offerVariant =
    lead.quiz_kind === "personal_plan"
      ? "personal-plan-v1"
      : hasAccess
        ? "default"
        : await resolveGuidedStoryOfferExperiment({
            leadId,
            session: funnelContext
              ? {
                  sessionId: funnelContext.sessionId,
                  packageKey: funnelContext.packageKey,
                  offerVariant: funnelContext.offerVariant ?? null,
                  offerViewedAt: funnelContext.offerViewedAt ?? null,
                }
              : null,
          })
  const offerTracking = hasAccess ? null : await recordLeadOfferView(leadId, funnelContext)

  return (
    <ResultPageClient
      leadId={lead.id}
      name={lead.name}
      personalPlanOffer={personalPlanOffer as PersonalPlanOfferModel | null}
      personalPlanFocusTarget={personalPlanFocusTarget}
      quizAnswers={quizAnswers}
      quizKind={lead.quiz_kind}
      entryContext={entryContext}
      focusRoutine={focusRoutine}
      focusTarget={focusTarget}
      hasAccess={hasAccess}
      returnTo={returnTo}
      offerTracking={offerTracking}
      offerVariant={offerVariant}
    />
  )
}
