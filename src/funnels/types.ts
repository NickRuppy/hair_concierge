import type { ComponentType, ReactNode } from "react"

import type { QuizResultNarrative } from "@/lib/quiz/result-narrative"

export type FunnelLandingVariantComponent = ComponentType

export type FunnelOfferVariantProps = {
  name: string
  narrative: QuizResultNarrative
  pricingSlot: ReactNode
  focusRoutine?: boolean
}

export type FunnelOfferVariantComponent = ComponentType<FunnelOfferVariantProps>
