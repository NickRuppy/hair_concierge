import type { ComponentType, ReactNode } from "react"

import type { QuizResultNarrative } from "@/lib/quiz/result-narrative"
import type { QuizAnswers } from "@/lib/quiz/types"

export type FunnelLandingVariantComponent = ComponentType

export type FunnelOfferVariantProps = {
  name: string
  narrative: QuizResultNarrative
  quizAnswers: QuizAnswers
  pricingSlot: ReactNode
  focusRoutine?: boolean
}

export type FunnelOfferVariantComponent = ComponentType<FunnelOfferVariantProps>
