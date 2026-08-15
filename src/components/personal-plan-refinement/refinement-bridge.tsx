"use client"

import { PersonalPlanChapterTransition } from "@/components/personal-plan-journey"

export function RefinementBridge({
  refinedVersionId,
  nextHref,
  onBack,
  onContinue,
  isContinuing = false,
  continueError,
}: {
  refinedVersionId: string
  nextHref: "/plan-start"
  onBack?: () => void
  onContinue?: () => void
  isContinuing?: boolean
  continueError?: string
}) {
  return (
    <div data-refined-version-id={refinedVersionId} data-stage2-next-href={nextHref}>
      <PersonalPlanChapterTransition
        currentStage={3}
        onAction={onContinue}
        actionPending={isContinuing}
        actionPendingLabel="Produkte werden vorbereitet …"
        onBack={onBack}
        backLabel="Zur letzten Frage"
        errorMessage={continueError}
      />
    </div>
  )
}
