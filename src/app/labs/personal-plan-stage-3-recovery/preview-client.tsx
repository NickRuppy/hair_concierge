"use client"

import { useState } from "react"

import { PersonalPlanJourneyHeader } from "@/components/personal-plan-journey"
import {
  Stage3PreparationRecoveryPanel,
  type Stage3PreparationRecoveryKind,
} from "@/components/personal-plan-products/stage3-preparation-recovery"

export function Stage3RecoveryPreviewClient({
  kind,
  diagnosticQueued,
}: {
  kind: Stage3PreparationRecoveryKind
  diagnosticQueued: boolean
}) {
  const [lastAction, setLastAction] = useState<string | null>(null)
  return (
    <div
      className="min-h-dvh bg-[var(--background)] text-[var(--text-body)]"
      data-stage3-recovery-scenario={kind}
      {...(lastAction ? { "data-last-action": lastAction } : {})}
    >
      <PersonalPlanJourneyHeader currentStage={2} />
      <Stage3PreparationRecoveryPanel
        kind={kind}
        diagnosticQueued={diagnosticQueued}
        onRecover={kind === "contract_violation" ? undefined : () => setLastAction("recover")}
        onExit={() => setLastAction("routine")}
        exitLabel="Zur Routine"
      />
    </div>
  )
}
