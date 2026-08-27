import {
  resolveModeratorJourney,
  loadFunnelIdentityMode,
  loadPersonalPlanResultFunnel,
  loadModeratorResultCampaign,
} from "@/lib/personal-plan-field-test/moderator-journey"
import { resolveModeratorAccess } from "@/lib/personal-plan-field-test/moderator"
import { PersonalPlanFieldTestEnded } from "@/components/personal-plan-field-test/personal-plan-field-test-ended"
import type { Metadata } from "next"
import { cookies } from "next/headers"
import { notFound, redirect } from "next/navigation"
import { createServerClient } from "@supabase/ssr"

import { ResultPageClient } from "./result-client"
import { parsePersonalPlanOfferModel } from "@/components/personal-plan-offer/model"
import type { PersonalPlanOfferModel } from "@/components/personal-plan-offer/types"
import { hasCurrentAppAccess } from "@/lib/billing/subscriptions"
import { recordPersonalPlanOneTimeFirstAccess } from "@/lib/billing/personal-plan-one-time-first-access"
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
  assignPersonalPlanOneTimeQa,
  resolveFunnelContextForLead,
  resolvePersonalPlanPricingExperiment,
} from "@/lib/funnel/server"
import {
  isFunnelAttributionEnabled,
  isPersonalPlanLaunchPricingEnabled,
  isPersonalPlanResultReturnEnabled,
} from "@/lib/funnel/flags"
import { resolveSubscriptionPricingCatalog } from "@/lib/billing/pricing-catalog"
import type { FunnelCookieContext } from "@/lib/funnel/cookie"
import type { OfferEntryContext } from "@/lib/analytics/events"
import { resolveLegacyResultOfferVariant } from "@/lib/funnel/packages"
import {
  isPersonalPlanResultReturnForLead,
  PERSONAL_PLAN_RESULT_RETURN_COOKIE,
  resolvePersonalPlanResultReturn,
} from "@/lib/personal-plan-quiz/result-return"
import {
  hasRegularQuizFieldTestOfferIntent,
  hasPersonalPlanFieldTestOfferIntent,
  isRegularQuizFieldTestEnabled,
  PERSONAL_PLAN_FIELD_TEST_CAMPAIGN_COOKIE,
  REGULAR_QUIZ_FIELD_TEST_CAMPAIGN_COOKIE,
  resolvePersonalPlanFieldTestOfferAuthorization,
  resolveRegularQuizFieldTestOfferAuthorization,
} from "@/lib/personal-plan-field-test"
import { PERSONAL_PLAN_PRICING_EXPERIMENT } from "@/lib/funnel/personal-plan-pricing-experiment"

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
    qa?: string | string[]
  }>
}

interface LeadResultRow {
  id: string
  user_id: string | null
  name: string
  quiz_kind: "legacy" | "personal_plan"
  quiz_answers: unknown
  moderator_campaign_id: string | null
}

type RegularQuizFieldTestAuthorization = {
  campaignId: string
  funnelSessionId: string
  leadId: string
  accessDurationHours: number
}

async function getLeadResult(leadId: string): Promise<LeadResultRow | null> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("leads")
    .select("id, user_id, name, quiz_kind, quiz_answers, moderator_campaign_id")
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

async function recordLeadOfferView(
  leadId: string,
  context: FunnelCookieContext | null,
  trustedOfferVariant: string,
) {
  if (!isFunnelAttributionEnabled() || !context) return null
  const eventId = crypto.randomUUID()
  await recordFunnelEvent({
    context,
    eventId,
    milestone: "offer_viewed",
    leadId,
    trustedOfferVariant,
  }).catch((error) => console.warn("[funnel] result offer tracking failed", error))
  return {
    funnelEventId: eventId,
    funnelSessionId: context.sessionId,
    funnelPackageKey: context.packageKey,
  }
}

function buildReturnOfferTracking(context: FunnelCookieContext | null) {
  if (!isFunnelAttributionEnabled() || !context) return null
  return {
    funnelEventId: null,
    funnelSessionId: context.sessionId,
    funnelPackageKey: context.packageKey,
  }
}

function parseQuizAnswers(raw: unknown): QuizAnswers | null {
  const normalized = normalizeStoredQuizAnswers((raw as Record<string, unknown> | null) ?? null)
  const parsed = storedQuizAnswersSchema.safeParse(normalized)

  return parsed.success ? parsed.data : null
}

async function getAuthenticatedResultAccess(): Promise<{
  hasAccess: boolean
  userId: string | null
}> {
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

  if (!user) return { hasAccess: false, userId: null }

  const hasAccess = await hasCurrentAppAccess(supabase, {
    userId: user.id,
    email: user.email,
  }).catch((error) => {
    console.warn("[result-page] failed to resolve authenticated access", error)
    return false
  })
  return { hasAccess, userId: user.id }
}

async function hasTrustedPersonalPlanResultReturn(input: {
  entry: string | null
  lead: LeadResultRow | null
}) {
  if (
    input.entry !== "quiz_return" ||
    input.lead?.quiz_kind !== "personal_plan" ||
    !isPersonalPlanResultReturnEnabled()
  ) {
    return false
  }

  const cookieStore = await cookies()
  const token = cookieStore.get(PERSONAL_PLAN_RESULT_RETURN_COOKIE)?.value
  if (!token) return false

  const resolution = await resolvePersonalPlanResultReturn(token)
  return isPersonalPlanResultReturnForLead(resolution, input.lead.id)
}

async function resolveRegularQuizFieldTestOfferState(input: {
  hasAccess: boolean
  lead: LeadResultRow
  moderatorTest: boolean
  funnelContext:
    | (FunnelCookieContext & {
        testKind?: string | null
        fieldTestCampaignId?: string | null
      })
    | null
}): Promise<{
  authorization: RegularQuizFieldTestAuthorization | null
  unavailable: boolean
}> {
  if (input.lead.quiz_kind !== "legacy" || input.hasAccess || input.moderatorTest) {
    return { authorization: null, unavailable: false }
  }

  const cookieValue = (await cookies()).get(REGULAR_QUIZ_FIELD_TEST_CAMPAIGN_COOKIE)?.value
  const contextIntent = Boolean(
    input.funnelContext?.packageKey === "default_organic" &&
    input.funnelContext.testKind === "field_test" &&
    input.funnelContext.fieldTestCampaignId,
  )
  if (!cookieValue && !contextIntent) return { authorization: null, unavailable: false }
  const intent =
    contextIntent ||
    (cookieValue
      ? await hasRegularQuizFieldTestOfferIntent({
          leadId: input.lead.id,
          funnelSessionId: contextIntent ? input.funnelContext?.sessionId : undefined,
        })
      : false)
  // The global stop must close an already-bound test journey, never turn it
  // into the commercial offer. Cookie presence alone is not lead authority.
  if (!isRegularQuizFieldTestEnabled()) return { authorization: null, unavailable: intent }

  const authorization = await resolveRegularQuizFieldTestOfferAuthorization({
    campaignCookieValue: cookieValue,
    funnelSessionId: contextIntent ? input.funnelContext?.sessionId : undefined,
    leadId: input.lead.id,
  })

  return {
    authorization,
    // A campaign cookie proves only that this browser entered some regular
    // field test. The lead-bound funnel session is the authority for deciding
    // whether this exact result must fail closed instead of showing pricing.
    unavailable: intent && !authorization,
  }
}

export default async function ResultPage({ params, searchParams }: Props) {
  const [{ leadId }, sp] = await Promise.all([params, searchParams])
  const focus = getQuizResultSearchParamValue(sp.focus)
  const entry = getQuizResultSearchParamValue(sp.entry)
  const qaToken = getQuizResultSearchParamValue(sp.qa)
  const focusRoutine = focus === "routine"
  const focusTarget = focus === "unlock-plan" ? "unlock-plan" : focusRoutine ? "pricing" : null
  const personalPlanFocusTarget = resolvePersonalPlanOfferFocusTarget(focus)
  const returnTo = resolveQuizResultRetakeReturnTo(sp.mode, sp.returnTo)
  const [lead, authenticatedAccess] = await Promise.all([
    getLeadResult(leadId),
    getAuthenticatedResultAccess(),
  ])
  const resultCampaign = lead?.moderator_campaign_id
    ? await loadModeratorResultCampaign(leadId)
    : null
  const resultFunnel =
    lead?.quiz_kind === "personal_plan" || resultCampaign?.kind === "moderator"
      ? await loadPersonalPlanResultFunnel(leadId)
      : null
  if (resultCampaign?.kind === "unavailable") return <PersonalPlanFieldTestEnded unavailable />
  if (resultFunnel?.kind === "unavailable") return <PersonalPlanFieldTestEnded unavailable />
  const persistedFunnel = resultFunnel?.context ?? null
  const persistedMode =
    resultCampaign?.kind === "moderator"
      ? "email_bound"
      : persistedFunnel
        ? await loadFunnelIdentityMode(persistedFunnel.sessionId)
        : null
  let moderatorTest = false
  if (persistedMode === "unavailable") return <PersonalPlanFieldTestEnded unavailable />
  if (persistedMode === "email_bound") {
    if (!authenticatedAccess.userId)
      redirect(`/auth?next=${encodeURIComponent(`/result/${leadId}`)}`)
    if (lead?.user_id !== authenticatedAccess.userId)
      return <PersonalPlanFieldTestEnded unavailable />
    const access = await resolveModeratorAccess({ userId: authenticatedAccess.userId })
    if (access.kind === "active") redirect("/plan-start")
    if (access.kind === "ended") return <PersonalPlanFieldTestEnded />
    if (access.kind === "unavailable") return <PersonalPlanFieldTestEnded unavailable />
    const moderator = await resolveModeratorJourney({
      cookies: await cookies(),
      funnelContext: persistedFunnel,
      leadId,
    })
    if (moderator.kind !== "authorized") return <PersonalPlanFieldTestEnded unavailable />
    moderatorTest = true
  }
  const trustedPersonalPlanResultReturn = await hasTrustedPersonalPlanResultReturn({ entry, lead })
  const entryContext: OfferEntryContext = focusRoutine
    ? "routine_return"
    : entry === "quiz_completion"
      ? "quiz_completion"
      : trustedPersonalPlanResultReturn
        ? "quiz_return"
        : entry === "result_email"
          ? "result_email"
          : "saved_result"
  const quizAnswers = lead?.quiz_kind === "legacy" ? parseQuizAnswers(lead.quiz_answers) : null
  const personalPlanOffer =
    lead?.quiz_kind === "personal_plan" ? await getPersonalPlanPublicOfferModel(lead.id) : null

  if (!lead || (lead.quiz_kind === "legacy" && !quizAnswers)) {
    notFound()
  }

  if (authenticatedAccess.userId) {
    await recordPersonalPlanOneTimeFirstAccess(createAdminClient(), {
      userId: authenticatedAccess.userId,
      leadId: lead.id,
    }).catch(() => {
      console.warn("[result-page] failed to record one-time plan first access", {
        leadId: lead.id,
        userId: authenticatedAccess.userId,
      })
    })
  }

  const hasAccess = authenticatedAccess.hasAccess

  const funnelContext = hasAccess
    ? null
    : (persistedFunnel ?? (await resolveFunnelContextForLead(leadId)))
  const fieldTestCookie = (await cookies()).get(PERSONAL_PLAN_FIELD_TEST_CAMPAIGN_COOKIE)?.value
  const fieldTestAuthorization =
    lead.quiz_kind === "personal_plan"
      ? await resolvePersonalPlanFieldTestOfferAuthorization({
          campaignCookieValue: fieldTestCookie,
          allowEmailBound: moderatorTest,
          funnelSessionId: funnelContext?.sessionId,
          leadId,
        })
      : null
  const fieldTestIntent =
    lead.quiz_kind === "personal_plan"
      ? await hasPersonalPlanFieldTestOfferIntent({
          leadId,
          funnelSessionId: funnelContext?.sessionId,
        })
      : false
  const fieldTestUnavailable = fieldTestIntent && !fieldTestAuthorization
  const regularFieldTestState = await resolveRegularQuizFieldTestOfferState({
    hasAccess,
    lead,
    moderatorTest,
    funnelContext,
  })
  const personalPlanSession = funnelContext
    ? {
        sessionId: funnelContext.sessionId,
        packageKey: funnelContext.packageKey,
        offerVariant: funnelContext.offerVariant ?? null,
        offerViewedAt: funnelContext.offerViewedAt ?? null,
        checkoutStartedAt: funnelContext.checkoutStartedAt ?? null,
        isInternalTest: funnelContext.isInternalTest ?? false,
      }
    : null
  if (lead.quiz_kind === "personal_plan" && qaToken) {
    const assigned = await assignPersonalPlanOneTimeQa({
      leadId,
      session: personalPlanSession,
      token: qaToken,
    })
    if (assigned)
      redirect(
        cleanResultUrl(leadId, {
          entry: entry ?? undefined,
          focus: focus ?? undefined,
          mode: sp.mode,
          returnTo: sp.returnTo,
        }),
      )
  }
  const offerVariant =
    lead.quiz_kind === "personal_plan"
      ? fieldTestAuthorization || fieldTestUnavailable
        ? PERSONAL_PLAN_PRICING_EXPERIMENT.baseVariant
        : await resolvePersonalPlanPricingExperiment({ session: personalPlanSession })
      : hasAccess
        ? "organic-plan-v1"
        : resolveLegacyResultOfferVariant(funnelContext)
  const offerTracking =
    hasAccess || fieldTestUnavailable || regularFieldTestState.unavailable
      ? null
      : entryContext === "quiz_return"
        ? buildReturnOfferTracking(funnelContext)
        : await recordLeadOfferView(leadId, funnelContext, offerVariant)
  const pricingCatalog = resolveSubscriptionPricingCatalog(isPersonalPlanLaunchPricingEnabled())

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
      fieldTest={Boolean(fieldTestAuthorization)}
      moderatorTest={moderatorTest}
      fieldTestUnavailable={fieldTestUnavailable}
      isInternalTest={personalPlanSession?.isInternalTest ?? false}
      regularFieldTest={
        moderatorTest
          ? {
              accessDurationHours: 2160,
              activationApiPath: "/api/personal-plan/field-test/moderator/activate-organic",
              identityMode: "email_bound",
            }
          : regularFieldTestState.authorization
            ? {
                accessDurationHours: regularFieldTestState.authorization.accessDurationHours,
                identityMode: "guest",
              }
            : null
      }
      regularFieldTestUnavailable={regularFieldTestState.unavailable}
      returnTo={returnTo}
      offerTracking={offerTracking}
      offerVariant={offerVariant}
      pricingCatalog={pricingCatalog}
      showQuizRestart={
        lead.quiz_kind === "personal_plan" && !hasAccess && isPersonalPlanResultReturnEnabled()
      }
    />
  )
}

function cleanResultUrl(
  leadId: string,
  values: {
    entry: string | undefined
    focus: string | undefined
    mode: string | string[] | undefined
    returnTo: string | string[] | undefined
  },
): string {
  const search = new URLSearchParams()
  if (values.entry) search.set("entry", values.entry)
  if (values.focus) search.set("focus", values.focus)
  const mode = getQuizResultSearchParamValue(values.mode)
  const returnTo = getQuizResultSearchParamValue(values.returnTo)
  if (mode) search.set("mode", mode)
  if (returnTo) search.set("returnTo", returnTo)
  const query = search.toString()
  return `/result/${encodeURIComponent(leadId)}${query ? `?${query}` : ""}`
}
