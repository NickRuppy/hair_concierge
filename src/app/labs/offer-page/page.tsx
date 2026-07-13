import { notFound } from "next/navigation"

import { QuizResultOfferPage } from "@/components/quiz/quiz-result-offer-page"
import { buildQuizResultNarrative } from "@/lib/quiz/result-narrative"
import type { QuizAnswers } from "@/lib/quiz/types"

const REVIEW_ANSWERS: QuizAnswers = {
  structure: "wavy",
  thickness: "normal",
  density: "medium",
  hair_length: "long",
  fingertest: "rau",
  pulltest: "stretches_bounces",
  scalp_type: "ausgeglichen",
  has_scalp_issue: false,
  concerns: ["frizz", "dryness"],
  treatment: ["natur"],
  goals: ["less_frizz", "moisture", "shine"],
}

export default function OfferPageLab() {
  if (process.env.NODE_ENV !== "development") notFound()

  return (
    <QuizResultOfferPage
      leadId={null}
      name="Lea"
      narrative={buildQuizResultNarrative(REVIEW_ANSWERS)}
      quizAnswers={REVIEW_ANSWERS}
    />
  )
}
