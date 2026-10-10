import { notFound } from "next/navigation"

import { STAGE1_STAGE2_LAB_ENVELOPE } from "@/app/labs/personal-plan-stage-1-2/fixture"
import { toolsLabCareFacts } from "@/app/labs/personal-plan-tools/fixture"
import { adaptInitialNeedSnapshotToPlanStartViewModel } from "@/components/personal-plan-start"
import { planStartHasOptionalPage } from "@/components/personal-plan-start/snapshot-adapter"
import { computeNeedPlan } from "@/lib/personal-plan/compute-stage1"
import { buildToolView } from "@/lib/personal-plan/tools/read-view"

import { DEMO_PERSONAL_PLAN_ID, ROUTINE_VIEW_RESOLVED } from "./fixtures"
import { FeinschliffJourneyClient } from "./journey-client"
import { buildFeinschliffJourneyStage3EntryContext } from "./stage3-entry"

/**
 * Dev-only clickable demo of the fork-free Feinschliff journey, chaining the
 * real production components on fixture data. See `journey-client.tsx`.
 *
 * Tools rollout ON (Hair Tools port, Task 10): five steps, the tools module and
 * its Tool-Checkpoint between Produkte and Gewohnheiten. Tool content is the
 * read-time view (`buildToolView`) — before the Feinschliff from no facts at
 * all (Stage 1), afterwards from the `personal-plan-tools` lab's fixture facts
 * (Routine), so the Routine's `Deine Tools` does not follow what was clicked.
 */
export default async function FeinschliffJourneyLabPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string }>
}) {
  if (process.env.NODE_ENV !== "development") notFound()
  const { step } = await searchParams

  const computed = computeNeedPlan({
    rawEnvelope: STAGE1_STAGE2_LAB_ENVELOPE,
    artifactId: "11111111-1111-4111-8111-111111111111",
    projection: "initial_quiz",
    computationVersion: "stage1-v1",
    createdAt: "2026-08-26T12:00:00.000Z",
  })
  if (computed.status !== "ready") notFound()

  // Stage 1 before any Feinschliff: no facts yet, so every Tool card rests on the profile alone.
  const stage1Tools = buildToolView({
    careHabits: null,
    fieldProvenance: undefined,
    needSnapshot: computed.snapshot,
    routine: null,
    hasOptionalPage: planStartHasOptionalPage(computed.snapshot),
    toolsEnabled: true,
  })
  const plan = adaptInitialNeedSnapshotToPlanStartViewModel(
    stage1Tools
      ? { ...computed.snapshot, stage1ToolCards: stage1Tools.stage1Cards }
      : computed.snapshot,
    { toolsEnabled: true },
  )
  if (!plan) notFound()
  const routineTools = buildToolView({
    ...toolsLabCareFacts(),
    needSnapshot: computed.snapshot,
    routine: ROUTINE_VIEW_RESOLVED.activeVersion!.payload,
    hasOptionalPage: false,
    toolsEnabled: true,
  })

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
      routineToolSection={routineTools?.routineSection ?? null}
      initialStep={step === "module-tools" ? "module-tools" : "idealplan"}
    />
  )
}
