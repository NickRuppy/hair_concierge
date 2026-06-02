"use client"

import { useEffect } from "react"

import { QuizResultOfferPage } from "@/components/quiz/quiz-result-offer-page"
import { QuizResultsView } from "@/components/quiz/quiz-results-view"
import { getQuizResultCta } from "@/lib/quiz/result-cta"
import { buildQuizResultNarrative } from "@/lib/quiz/result-narrative"
import type { QuizAnswers } from "@/lib/quiz/types"

export function ResultPageClient({
  leadId,
  name,
  quizAnswers,
  focusRoutine,
  hasAccess,
}: {
  leadId: string
  name: string
  quizAnswers: QuizAnswers
  focusRoutine: boolean
  hasAccess: boolean
}) {
  const narrative = buildQuizResultNarrative(quizAnswers)
  const cta = getQuizResultCta({ canGoStraightToRoutine: hasAccess })

  useEffect(() => {
    if (!focusRoutine) return

    window.requestAnimationFrame(() => {
      document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth", block: "start" })
    })
  }, [focusRoutine])

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
    />
  )
}
