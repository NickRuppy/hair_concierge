import { notFound } from "next/navigation"

import {
  PlanStartProductionGate,
  adaptInitialNeedSnapshotToPlanStartViewModel,
} from "@/components/personal-plan-start"
import { PlanStartCustomerJourney } from "@/components/personal-plan-start/plan-start-flow"
import { computeNeedPlan } from "@/lib/personal-plan/compute-stage1"
import { STAGE1_STAGE2_LAB_ENVELOPE } from "@/app/labs/personal-plan-stage-1-2/fixture"

export default async function PersonalPlanStartLabPage({
  searchParams,
}: {
  searchParams: Promise<{ scenario?: string }>
}) {
  if (process.env.NODE_ENV !== "development") notFound()

  const { scenario } = await searchParams
  if (scenario === "production-composition")
    return <PlanStartProductionGate initialJourney={{ stage: "stage1" }} />

  const computed = computeNeedPlan({
    rawEnvelope: STAGE1_STAGE2_LAB_ENVELOPE,
    artifactId: "11111111-1111-4111-8111-111111111111",
    projection: "initial_quiz",
    computationVersion: "stage1-v1",
    createdAt: "2026-08-08T12:00:00.000Z",
  })
  if (computed.status !== "ready") notFound()

  const plan = adaptInitialNeedSnapshotToPlanStartViewModel(computed.snapshot)
  if (!plan) notFound()

  return (
    <PlanStartCustomerJourney
      initialPlan={{ ...plan, personalPlanId: "20000000-0000-4000-8000-000000000001" }}
      initialJourney={{ stage: "stage1" }}
      personalPlanId="20000000-0000-4000-8000-000000000001"
    />
  )
}
