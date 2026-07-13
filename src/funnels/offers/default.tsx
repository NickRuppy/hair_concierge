"use client"

import { QuizResultOfferPageShell } from "@/components/quiz/quiz-result-offer-page"
import type { FunnelOfferVariantProps } from "@/funnels/types"

export default function DefaultOfferVariant({
  name,
  narrative,
  quizAnswers,
  pricingSlot,
  focusRoutine = false,
}: FunnelOfferVariantProps) {
  return (
    <QuizResultOfferPageShell
      name={name}
      narrative={narrative}
      quizAnswers={quizAnswers}
      pricingSlot={pricingSlot}
      focusRoutine={focusRoutine}
    />
  )
}
