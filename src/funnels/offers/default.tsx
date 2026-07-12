"use client"

import { QuizResultOfferPageShell } from "@/components/quiz/quiz-result-offer-page"
import type { FunnelOfferVariantProps } from "@/funnels/types"

export default function DefaultOfferVariant({
  name,
  narrative,
  pricingSlot,
  focusRoutine = false,
}: FunnelOfferVariantProps) {
  return (
    <QuizResultOfferPageShell
      name={name}
      narrative={narrative}
      pricingSlot={pricingSlot}
      focusRoutine={focusRoutine}
    />
  )
}
