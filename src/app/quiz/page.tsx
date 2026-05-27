"use client"

import { useEffect, useRef } from "react"
import { notFound } from "next/navigation"
import { useQuizStore } from "@/lib/quiz/store"
import { getQuestionByStep } from "@/lib/quiz/questions"
import { QuizQuestion } from "@/components/quiz/quiz-question"
import { QuizScalpQuestion } from "@/components/quiz/quiz-scalp-question"
import { QuizConcernsQuestion } from "@/components/quiz/quiz-concerns-question"
import { QuizLeadCapture } from "@/components/quiz/quiz-lead-capture"
import { QuizAnalysis } from "@/components/quiz/quiz-analysis"
import { QuizResults } from "@/components/quiz/quiz-results"
import { QuizGoals } from "@/components/quiz/quiz-goals"
import { QuizWelcome } from "@/components/quiz/quiz-welcome"
import { trackAppEvent } from "@/lib/analytics/track-app-event"

const STEP_NAMES: Record<number, string> = {
  2: "hair_texture",
  3: "hair_thickness",
  13: "hair_density",
  4: "surface_test",
  5: "pull_test",
  6: "scalp",
  7: "chemical_treatment",
  8: "concerns",
  9: "lead_capture",
  10: "analysis",
  11: "results",
  12: "goals",
  14: "auth_transition",
}

export default function QuizPage() {
  const step = useQuizStore((s) => s.step)
  const quizStartedRef = useRef(false)
  const lastTrackedStepRef = useRef<number | null>(null)

  useEffect(() => {
    if (lastTrackedStepRef.current === step) return
    lastTrackedStepRef.current = step

    const stepName = STEP_NAMES[step] || `step_${step}`

    if (!quizStartedRef.current) {
      quizStartedRef.current = true
      trackAppEvent("quiz_started", {
        stepName,
        stepNumber: step,
      })
    }

    trackAppEvent("quiz_step_viewed", {
      stepName,
      stepNumber: step, // deprecated: use stepName after Phase 4 resequencing
    })
  }, [step])

  // Step 6: custom scalp progressive disclosure
  if (step === 6) return <QuizScalpQuestion />
  if (step === 8) return <QuizConcernsQuestion />

  // Standard quiz question cards
  const question = getQuestionByStep(step)
  if (question) return <QuizQuestion key={question.step} question={question} />

  switch (step) {
    case 9:
      return <QuizLeadCapture />
    case 10:
      return <QuizAnalysis />
    case 11:
      return <QuizResults />
    case 12:
      return <QuizGoals />
    case 14:
      return <QuizWelcome />
    default:
      // Unknown step — shouldn't happen with a healthy store. Surface a 404
      // rather than silently rendering a placeholder (would hide bugs).
      notFound()
  }
}
