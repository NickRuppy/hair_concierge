"use client"

import { PersonalPlanChapterTransition } from "@/components/personal-plan-journey/chapter-transition"
import type { PersonalPlanJourneyStage } from "@/components/personal-plan-journey/journey-content"

function noop() {}

export function PersonalPlanChaptersLabClient({ stage }: { stage: PersonalPlanJourneyStage }) {
  return (
    <PersonalPlanChapterTransition
      currentStage={stage}
      onAction={noop}
      onBack={stage > 1 ? noop : undefined}
    />
  )
}
