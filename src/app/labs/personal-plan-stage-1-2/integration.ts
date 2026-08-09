import { computeNeedPlan } from "@/lib/personal-plan/compute-stage1"
import { buildStage3EntryContext } from "@/lib/personal-plan/products/stage2-entry-adapter"
import { buildPlanRoutineContextFromCompletedRefinement } from "@/lib/personal-plan/refinement/stage1-adapter"
import type {
  Stage2RefinementHandoff,
  Stage2RefinementSession,
} from "@/lib/personal-plan/refinement/session"

import { STAGE1_STAGE2_LAB_ENVELOPE } from "./fixture"

const LAB_PERSONAL_PLAN_ID = "fixture-personal-plan"
const LAB_ARTIFACT_ID = "11111111-1111-4111-8111-111111111111"

export function prepareStage3EntryContextForLab({
  session,
  handoff,
}: {
  session: Stage2RefinementSession
  handoff: Stage2RefinementHandoff
}) {
  if (session.status !== "complete" || !session.completedHandoff) {
    throw new Error("Stage 3 entry requires a completed Stage 2 refinement")
  }
  if (
    session.completedHandoff.refinedVersionId !== handoff.refinedVersionId ||
    handoff.nextHref !== "/plan-start"
  ) {
    throw new Error("Stage 2 handoff does not match the completed refinement")
  }

  const routine = buildPlanRoutineContextFromCompletedRefinement({
    triggerContext: session.triggerContext,
    answers: session.answers,
    completedQuestionIds: session.completedQuestionIds,
  })
  const refined = computeNeedPlan({
    rawEnvelope: STAGE1_STAGE2_LAB_ENVELOPE,
    artifactId: LAB_ARTIFACT_ID,
    projection: "refined_post_plan",
    computationVersion: "stage1-v1",
    createdAt: "2026-08-07T12:10:00.000Z",
    routine,
  })
  if (refined.status !== "ready") {
    throw new Error(`Refined plan is not ready: ${refined.status}`)
  }

  return {
    refinedSnapshot: refined.snapshot,
    entryContext: buildStage3EntryContext(refined.snapshot, {
      personalPlanId: LAB_PERSONAL_PLAN_ID,
      refinedVersionId: handoff.refinedVersionId,
    }),
  }
}
