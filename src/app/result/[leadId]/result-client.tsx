"use client"

import { useEffect } from "react"

import {
  getSubscriptionPlanReferencePrices,
  QUIZ_RESULT_REFERENCE_PRICES,
} from "@/components/checkout/plan-reference-prices"
import { ResultOfferPricing } from "@/components/quiz/result-offer-pricing"
import { QuizResultsView } from "@/components/quiz/quiz-results-view"
import {
  PersonalPlanOffer,
  PersonalPlanPaidContinuation,
  PersonalPlanOfferRecovery,
} from "@/components/personal-plan-offer/personal-plan-offer"
import type { PersonalPlanOfferModel } from "@/components/personal-plan-offer/types"
import { renderOfferVariant } from "@/funnels/offers/registry"
import { getQuizResultCta } from "@/lib/quiz/result-cta"
import type { GuidedStoryFocusTarget } from "@/lib/quiz/guided-story-flow"
import { buildQuizResultOnboardingPath } from "@/lib/quiz/result-navigation"
import { buildQuizResultNarrative } from "@/lib/quiz/result-narrative"
import type { QuizAnswers } from "@/lib/quiz/types"
import type { PersonalPlanOfferFocusTarget } from "@/lib/personal-plan-quiz/offer-focus"
import type { SubscriptionPricingCatalog } from "@/lib/stripe/pricing-plans"
import type { FunnelAnalyticsEnvelope, OfferEntryContext } from "@/lib/analytics/events"
import { isGuidedStoryFamilyVariant } from "@/lib/funnel/offer-experiment"

export function ResultPageClient({
  leadId,
  name,
  personalPlanOffer = null,
  personalPlanFocusTarget = null,
  quizAnswers,
  quizKind = "legacy",
  entryContext,
  focusRoutine,
  focusTarget = null,
  hasAccess,
  isInternalTest = false,
  returnTo = null,
  offerTracking = null,
  offerVariant = "default",
  pricingCatalog,
}: {
  leadId: string
  name: string
  personalPlanOffer?: PersonalPlanOfferModel | null
  personalPlanFocusTarget?: PersonalPlanOfferFocusTarget | null
  quizAnswers: QuizAnswers | null
  quizKind?: "legacy" | "personal_plan"
  entryContext?: OfferEntryContext
  focusRoutine: boolean
  focusTarget?: GuidedStoryFocusTarget
  hasAccess: boolean
  isInternalTest?: boolean
  returnTo?: string | null
  offerTracking?: FunnelAnalyticsEnvelope | null
  offerVariant?: string
  pricingCatalog?: SubscriptionPricingCatalog
}) {
  const resolvedEntryContext = entryContext ?? (focusRoutine ? "routine_return" : "saved_result")
  const resolvedPricingCatalog = pricingCatalog ?? "standard"
  const pricingCatalogWasProvided = pricingCatalog !== undefined

  if (quizKind === "personal_plan") {
    if (hasAccess) {
      return <PersonalPlanPaidContinuation leadId={leadId} name={name} />
    }

    if (!personalPlanOffer) {
      return <PersonalPlanOfferRecovery leadId={leadId} />
    }

    return (
      <PersonalPlanOffer
        entryContext={resolvedEntryContext}
        focusTarget={personalPlanFocusTarget}
        isInternalTest={isInternalTest}
        leadId={leadId}
        model={personalPlanOffer}
        offerTracking={offerTracking}
        offerVariant={offerVariant}
        pricingCatalog={pricingCatalog}
      />
    )
  }

  if (!quizAnswers) {
    return <PersonalPlanOfferRecovery leadId={leadId} />
  }

  return (
    <LegacyResultPageClient
      entryContext={resolvedEntryContext}
      focusRoutine={focusRoutine}
      focusTarget={focusTarget}
      hasAccess={hasAccess}
      leadId={leadId}
      name={name}
      offerTracking={offerTracking}
      offerVariant={offerVariant}
      pricingCatalog={resolvedPricingCatalog}
      pricingCatalogWasProvided={pricingCatalogWasProvided}
      quizAnswers={quizAnswers}
      returnTo={returnTo}
    />
  )
}

function LegacyResultPageClient({
  entryContext,
  focusRoutine,
  focusTarget,
  hasAccess,
  leadId,
  name,
  offerTracking,
  offerVariant,
  pricingCatalog,
  pricingCatalogWasProvided,
  quizAnswers,
  returnTo,
}: {
  entryContext: OfferEntryContext
  focusRoutine: boolean
  focusTarget?: GuidedStoryFocusTarget
  hasAccess: boolean
  leadId: string
  name: string
  offerTracking?: FunnelAnalyticsEnvelope | null
  offerVariant: string
  pricingCatalog: SubscriptionPricingCatalog
  pricingCatalogWasProvided: boolean
  quizAnswers: QuizAnswers
  returnTo?: string | null
}) {
  const narrative = buildQuizResultNarrative(quizAnswers)
  const cta = getQuizResultCta({ canGoStraightToRoutine: hasAccess })

  useEffect(() => {
    if (!focusTarget || isGuidedStoryFamilyVariant(offerVariant)) return

    window.requestAnimationFrame(() => {
      document.getElementById(focusTarget)?.scrollIntoView({ behavior: "smooth", block: "start" })
    })
  }, [focusTarget, offerVariant])

  if (hasAccess) {
    return (
      <QuizResultsView
        name={name}
        narrative={{ ...narrative, cta }}
        primaryAction={{
          label: cta.label,
          href: buildQuizResultOnboardingPath({ leadId, returnTo }),
        }}
        secondaryAction={null}
      />
    )
  }

  const offer = renderOfferVariant(offerVariant, {
    entryContext,
    leadId,
    name,
    narrative,
    offerTracking,
    offerVariant,
    quizAnswers,
    focusRoutine,
    focusTarget,
    pricingSlot: (
      <ResultOfferPricing
        leadId={leadId}
        offerTracking={offerTracking}
        pricingCatalog={pricingCatalog}
        referencePrices={
          pricingCatalogWasProvided
            ? (getSubscriptionPlanReferencePrices(pricingCatalog) ?? QUIZ_RESULT_REFERENCE_PRICES)
            : QUIZ_RESULT_REFERENCE_PRICES
        }
      />
    ),
  })
  if (!offer) throw new Error(`Unknown funnel offer variant: ${offerVariant}`)
  return offer
}
