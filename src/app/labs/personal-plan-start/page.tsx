import { notFound } from "next/navigation"

import {
  PlanStartFlow,
  adaptInitialNeedSnapshotToPlanStartViewModel,
} from "@/components/personal-plan-start"
import { computeNeedPlan } from "@/lib/personal-plan/compute-stage1"
import { STAGE1_STAGE2_LAB_ENVELOPE } from "@/app/labs/personal-plan-stage-1-2/fixture"

export default function PersonalPlanStartLabPage() {
  if (process.env.NODE_ENV !== "development") notFound()

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

  return <PlanStartFlow state="ready" plan={plan} />
}
