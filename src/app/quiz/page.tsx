"use client"

import { useQuizStore } from "@/lib/quiz/store"
import { getQuestionByStep } from "@/lib/quiz/questions"
import { QuizLanding } from "@/components/quiz/quiz-landing"
import { QuizQuestion } from "@/components/quiz/quiz-question"
import { QuizLeadCapture } from "@/components/quiz/quiz-lead-capture"
import { QuizAnalysis } from "@/components/quiz/quiz-analysis"
import { QuizResults } from "@/components/quiz/quiz-results"
import { QuizWelcome } from "@/components/quiz/quiz-welcome"

export default function QuizPage() {
  const step = useQuizStore((s) => s.step)

  // Screens 2-8: quiz questions
  if (step >= 2 && step <= 8) {
    const question = getQuestionByStep(step)
    if (question) return <QuizQuestion question={question} />
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
