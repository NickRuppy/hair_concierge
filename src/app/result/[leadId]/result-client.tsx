"use client"

import { useEffect } from "react"

import { QuizResultOfferPage } from "@/components/quiz/quiz-result-offer-page"
import { buildQuizResultNarrative } from "@/lib/quiz/result-narrative"
import type { QuizAnswers } from "@/lib/quiz/types"

export function ResultPageClient({
  leadId,
  name,
  quizAnswers,
  focusRoutine,
}: {
  leadId: string
  name: string
  quizAnswers: QuizAnswers
  focusRoutine: boolean
}) {
  const narrative = buildQuizResultNarrative(quizAnswers)

  useEffect(() => {
    if (!focusRoutine) return

    window.requestAnimationFrame(() => {
      document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth", block: "start" })
    })
  }, [focusRoutine])

  return (
    <QuizResultOfferPage
      name={name}
      narrative={narrative}
      leadId={leadId}
      focusRoutine={focusRoutine}
    />
  )
}
