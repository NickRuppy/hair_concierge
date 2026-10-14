import { notFound } from "next/navigation"

import { adaptInitialNeedSnapshotToPlanStartViewModel } from "@/components/personal-plan-start"
import { planStartHasOptionalPage } from "@/components/personal-plan-start/snapshot-adapter"
import { buildToolView } from "@/lib/personal-plan/tools/read-view"

import { journeyRoutineToolSectionAction } from "./actions"
import { DEMO_PERSONAL_PLAN_ID } from "./fixtures"
import { FeinschliffJourneyClient } from "./journey-client"
import { journeyNeedSnapshot } from "./routine-tools"
import { buildFeinschliffJourneyStage3EntryContext } from "./stage3-entry"

/**
 * Dev-only clickable demo of the fork-free Feinschliff journey, chaining the
 * real production components on fixture data. See `journey-client.tsx`.
 *
 * Tools rollout ON (Hair Tools port, Task 10): five steps, the tools module and
 * its Tool-Checkpoint between Produkte and Gewohnheiten. Tool content is the
 * read-time view (`buildToolView`) — before the Feinschliff from no facts at
 * all (Stage 1); once the tools module is done, from the care facts the
 * completion would write from the answers just clicked (`routine-tools.ts`, via
 * the labs-only server action), so the Routine's `Deine Tools` follows them.
 */
export default async function FeinschliffJourneyLabPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string }>
}) {
  if (process.env.NODE_ENV !== "development") notFound()
  const { step } = await searchParams

  const snapshot = journeyNeedSnapshot()
  if (!snapshot) notFound()

  // Stage 1 before any Feinschliff: no facts yet, so every Tool card rests on the profile alone.
  const stage1Tools = buildToolView({
    careHabits: null,
    fieldProvenance: undefined,
    needSnapshot: snapshot,
    routine: null,
    hasOptionalPage: planStartHasOptionalPage(snapshot),
    toolsEnabled: true,
  })
  const plan = adaptInitialNeedSnapshotToPlanStartViewModel(
    stage1Tools ? { ...snapshot, stage1ToolCards: stage1Tools.stage1Cards } : snapshot,
    { toolsEnabled: true },
  )
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
      resolveRoutineToolSection={journeyRoutineToolSectionAction}
      initialStep={step === "module-tools" ? "module-tools" : "idealplan"}
    />
  )
}
