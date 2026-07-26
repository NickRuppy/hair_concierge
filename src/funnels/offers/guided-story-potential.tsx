"use client"

import { GuidedStoryOfferShell } from "./guided-story"
import type { FunnelOfferVariantProps } from "@/funnels/types"
import { calculateHairPotential } from "@/lib/quiz/hair-potential"

export default function GuidedStoryPotentialOfferVariant(props: FunnelOfferVariantProps) {
  return (
    <GuidedStoryOfferShell
      {...props}
      experimentMode="potential"
      getHairPotential={({ preview, quizAnswers }) =>
        calculateHairPotential(quizAnswers, preview.priorities)
      }
    />
  )
}
