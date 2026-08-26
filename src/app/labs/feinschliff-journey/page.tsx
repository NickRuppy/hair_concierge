import { notFound } from "next/navigation"

import { STAGE1_STAGE2_LAB_ENVELOPE } from "@/app/labs/personal-plan-stage-1-2/fixture"
import { adaptInitialNeedSnapshotToPlanStartViewModel } from "@/components/personal-plan-start"
import { computeNeedPlan } from "@/lib/personal-plan/compute-stage1"

import { DEMO_PERSONAL_PLAN_ID } from "./fixtures"
import { FeinschliffJourneyClient } from "./journey-client"
import { buildFeinschliffJourneyStage3EntryContext } from "./stage3-entry"

/**
 * Dev-only clickable demo of the fork-free Feinschliff journey, chaining the
 * real production components on fixture data. See `journey-client.tsx`.
 */
export default function FeinschliffJourneyLabPage() {
  if (process.env.NODE_ENV !== "development") notFound()

  const computed = computeNeedPlan({
    rawEnvelope: STAGE1_STAGE2_LAB_ENVELOPE,
    artifactId: "11111111-1111-4111-8111-111111111111",
    projection: "initial_quiz",
    computationVersion: "stage1-v1",
    createdAt: "2026-08-26T12:00:00.000Z",
  })
  if (computed.status !== "ready") notFound()

  const plan = adaptInitialNeedSnapshotToPlanStartViewModel(computed.snapshot)
  if (!plan) notFound()

  return (
    <FeinschliffJourneyClient
      plan={{
        ...plan,
        personalPlanId: DEMO_PERSONAL_PLAN_ID,
        // Dropping the hash keeps the Stage-1 preview request unrequestable, so
        // the demo makes no network call for previews and the CTA stays on its
        // accept intent („Zu deiner Routine") with an empty — legitimately
        // all-deferred — seen state. That all-deferred accept is exactly the
        // deferred-role story the Routine step then shows.
        sourceInputHash: undefined,
      }}
      stage3EntryContext={buildFeinschliffJourneyStage3EntryContext()}
    />
  )
}
