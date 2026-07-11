"use client"

import { useEffect } from "react"

import { QuizResultOfferPage } from "@/components/quiz/quiz-result-offer-page"
import { QuizResultsView } from "@/components/quiz/quiz-results-view"
import { getQuizResultCta } from "@/lib/quiz/result-cta"
import { buildQuizResultNarrative } from "@/lib/quiz/result-narrative"
import type { QuizAnswers } from "@/lib/quiz/types"
import type { FunnelAnalyticsEnvelope } from "@/lib/analytics/events"

type ResultPageFocusTarget = "unlock-plan" | "pricing" | null

export function ResultPageClient({
  leadId,
  name,
  quizAnswers,
  focusRoutine,
  focusTarget = null,
  hasAccess,
  offerTracking = null,
}: {
  leadId: string
  name: string
  quizAnswers: QuizAnswers
  focusRoutine: boolean
  focusTarget?: ResultPageFocusTarget
  hasAccess: boolean
  offerTracking?: FunnelAnalyticsEnvelope | null
}) {
  const narrative = buildQuizResultNarrative(quizAnswers)
  const cta = getQuizResultCta({ canGoStraightToRoutine: hasAccess })

  useEffect(() => {
    if (!focusTarget) return

    window.requestAnimationFrame(() => {
      document.getElementById(focusTarget)?.scrollIntoView({ behavior: "smooth", block: "start" })
    })
  }, [focusTarget])

  if (hasAccess) {
    return (
      <QuizResultsView
        name={name}
        narrative={{ ...narrative, cta }}
        primaryAction={{
          label: cta.label,
          href: `/onboarding?lead=${encodeURIComponent(leadId)}`,
        }}
        secondaryAction={null}
      />
    )
  }

  return (
    <QuizResultOfferPage
      name={name}
      narrative={narrative}
      leadId={leadId}
      focusRoutine={focusRoutine}
      offerTracking={offerTracking}
    />
  )
}
