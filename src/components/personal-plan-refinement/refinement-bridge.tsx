"use client"

import { PersonalPlanChapterTransition } from "@/components/personal-plan-journey"

/**
 * The bridge's machine-readable handoff contract: which refined version this
 * bridge is armed with, and where it hands off to. It belongs to the bridge
 * STATE, not to either presentation of it — an explicit module entry renders
 * the quiet pending shell instead of the chapter screen (field test
 * 26.08.2026) and still carries the very same handoff. Keep both presentations
 * on this one helper so they cannot drift apart again.
 */
export function stage2BridgeMarkerProps(bridge: {
  refinedVersionId: string
  nextHref: "/plan-start"
}) {
  return {
    "data-refined-version-id": bridge.refinedVersionId,
    "data-stage2-next-href": bridge.nextHref,
  } as const
}

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
    <div {...stage2BridgeMarkerProps({ refinedVersionId, nextHref })}>
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
