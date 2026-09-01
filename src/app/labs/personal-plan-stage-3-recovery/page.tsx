import { notFound } from "next/navigation"

import type { Stage3PreparationRecoveryKind } from "@/components/personal-plan-products/stage3-preparation-recovery"

import { Stage3RecoveryPreviewClient } from "./preview-client"

const SCENARIOS = new Set<Stage3PreparationRecoveryKind>([
  "checkpoint_changed",
  "transient",
  "contract_violation",
])

export default async function PersonalPlanStage3RecoveryLabPage({
  searchParams,
}: {
  searchParams: Promise<{ scenario?: string; registered?: string }>
}) {
  if (process.env.NODE_ENV !== "development") notFound()
  const params = await searchParams
  const scenario = params.scenario ?? "transient"
  if (!SCENARIOS.has(scenario as Stage3PreparationRecoveryKind)) notFound()

  return (
    <Stage3RecoveryPreviewClient
      kind={scenario as Stage3PreparationRecoveryKind}
      diagnosticQueued={params.registered === "1"}
    />
  )
}
