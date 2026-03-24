"use client"

import { useEffect } from "react"
import { useQuizStore } from "@/lib/quiz/store"
import { getQuestionByStep } from "@/lib/quiz/questions"
import { QuizLanding } from "@/components/quiz/quiz-landing"
import { QuizQuestion } from "@/components/quiz/quiz-question"
import { QuizScalpQuestion } from "@/components/quiz/quiz-scalp-question"
import { QuizLeadCapture } from "@/components/quiz/quiz-lead-capture"
import { QuizAnalysis } from "@/components/quiz/quiz-analysis"
import { QuizResults } from "@/components/quiz/quiz-results"
import { QuizWelcome } from "@/components/quiz/quiz-welcome"
import { posthog } from "@/providers/posthog-provider"

const STEP_NAMES: Record<number, string> = {
  1: "landing",
  2: "hair_texture",
  3: "hair_thickness",
  4: "surface_test",
  5: "pull_test",
  6: "scalp",
  7: "chemical_treatment",
  9: "lead_capture",
  10: "analysis",
  11: "results",
  14: "welcome",
}

export default function QuizPage() {
  const step = useQuizStore((s) => s.step)

  useEffect(() => {
    posthog.capture("quiz_step_viewed", {
      step_name: STEP_NAMES[step] || `step_${step}`,
      step_number: step, // deprecated: use step_name after Phase 4 resequencing
    })
  }, [step])

  // Step 6: custom scalp progressive disclosure
  if (step === 6) return <QuizScalpQuestion />

  // Screens 2-7: quiz questions (except 6)
  if (step >= 2 && step <= 7) {
    const question = getQuestionByStep(step)
    if (question) return <QuizQuestion key={question.step} question={question} />
  }

  switch (step) {
    case 1:
      return <QuizLanding />
    case 9:
      return <QuizLeadCapture />
    case 10:
      return <QuizAnalysis />
    case 11:
      return <QuizResults />
    case 14:
      return <QuizWelcome />
    default:
      return <QuizLanding />
  }
}
