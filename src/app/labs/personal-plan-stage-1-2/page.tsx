import { notFound } from "next/navigation"

import { computeNeedPlan } from "@/lib/personal-plan/compute-stage1"
import { deriveStage2TriggerContext } from "@/lib/personal-plan/refinement/stage1-adapter"
import { STAGE1_STAGE2_LAB_ENVELOPE } from "./fixture"
import { PersonalPlanStage1To3JourneyClient } from "./journey-client"

export default function PersonalPlanStage1Stage2LabPage() {
  if (process.env.NODE_ENV !== "development") notFound()

  const result = computeNeedPlan({
    rawEnvelope: STAGE1_STAGE2_LAB_ENVELOPE,
    artifactId: "11111111-1111-4111-8111-111111111111",
    projection: "initial_quiz",
    computationVersion: "stage1-v1",
    createdAt: "2026-08-07T12:00:00.000Z",
  })
  if (result.status !== "ready") notFound()

  const triggerContext = deriveStage2TriggerContext(result.snapshot)

  return <PersonalPlanStage1To3JourneyClient triggerContext={triggerContext} />
}
