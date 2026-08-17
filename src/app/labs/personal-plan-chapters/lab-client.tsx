"use client"

import { PersonalPlanChapterTransition } from "@/components/personal-plan-journey/chapter-transition"
import type { PersonalPlanJourneyStage } from "@/components/personal-plan-journey/journey-content"
import { PlanForkScreen } from "@/components/personal-plan-journey/plan-fork-screen"
import { directAcceptanceAssumptions } from "@/lib/personal-plan/direct-acceptance/defaults"

function noop() {}

export function PersonalPlanChaptersLabClient({
  stage,
  screen,
}: {
  stage: PersonalPlanJourneyStage
  screen?: "fork"
}) {
  if (screen === "fork") {
    return (
      <PlanForkScreen
        assumptions={directAcceptanceAssumptions({
          relevantCategories: [],
          hasReportedIrritatedScalp: false,
          dryShampooBridgeEligibility: "unknown",
        })}
        previewState={{
          seenRoles: [],
          fallbackNotice:
            "Für Shampoo steht die Produktwahl noch aus — der Feinschliff schließt das ab.",
          refinementRequiredNotice: null,
        }}
        directAcceptanceAvailable
        onRefine={noop}
        onAccept={noop}
        onBack={noop}
      />
    )
  }

  return (
    <PersonalPlanChapterTransition
      currentStage={stage}
      onAction={noop}
      onBack={stage > 1 ? noop : undefined}
    />
  )
}
