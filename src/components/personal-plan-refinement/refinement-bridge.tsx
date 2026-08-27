"use client"

import { PersonalPlanChapterTransition } from "@/components/personal-plan-journey"

export function RefinementBridge({
  refinedVersionId,
  nextHref,
  onBack,
  onContinue,
  onRevisit,
  isContinuing = false,
  continueError,
}: {
  refinedVersionId: string
  nextHref: "/plan-start"
  onBack?: () => void
  onContinue?: () => void
  /**
   * Re-opens the completed Feinschliff at its first question with every answer
   * prefilled (Nick sign-off 2026-08-26). Only offered on an explicit
   * re-entry (`/plan-start?refine=1`) — the fresh-completion bridge keeps its
   * single forward action.
   */
  onRevisit?: () => void
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
        secondaryActionLabel={onRevisit ? "Feinschliff überarbeiten" : undefined}
        onSecondaryAction={onRevisit}
        secondaryHint={
          onRevisit
            ? "Deine Antworten bleiben erhalten — du kannst einzelne Angaben ändern."
            : undefined
        }
      />
    </div>
  )
}
