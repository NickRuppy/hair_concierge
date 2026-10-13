import { STAGE1_STAGE2_LAB_ENVELOPE } from "@/app/labs/personal-plan-stage-1-2/fixture"
import { computeNeedPlan } from "@/lib/personal-plan/compute-stage1"
import { createStage2RefinementSession } from "@/lib/personal-plan/refinement/session"
import type {
  PersonalPlanRefinementAnswersV1,
  Stage2QuestionId,
  Stage2TriggerContext,
} from "@/lib/personal-plan/refinement/types"
import type { InitialNeedPlanSnapshot } from "@/lib/personal-plan/types"
import { buildToolView, type ToolRoutineSection } from "@/lib/personal-plan/tools/read-view"
import { toCareHabitsPatch, toFieldProvenance } from "@/lib/user-facts/from-refinement-draft"
import { careHabitsV1Schema } from "@/lib/user-facts/schema"

import { ROUTINE_VIEW_RESOLVED } from "./fixtures"

/**
 * Server side of `/labs/feinschliff-journey`'s Routine „Deine Tools": the same read-time view
 * production shows (`buildToolView`), fed with the care facts the module completion would write
 * from the lab session's OWN answers (`toCareHabitsPatch` / `toFieldProvenance`) — so the section
 * follows what the reviewer clicked instead of a fixed fixture.
 */

/** The journey's Stage-1 need snapshot (the fixture envelope). */
export function journeyNeedSnapshot(): InitialNeedPlanSnapshot | null {
  const computed = computeNeedPlan({
    rawEnvelope: STAGE1_STAGE2_LAB_ENVELOPE,
    artifactId: "11111111-1111-4111-8111-111111111111",
    projection: "initial_quiz",
    computationVersion: "stage1-v1",
    createdAt: "2026-08-26T12:00:00.000Z",
  })
  return computed.status === "ready" ? computed.snapshot : null
}

/** The serializable slice of a lab session the Routine tool section is derived from. */
export type JourneyToolSessionInput = {
  triggerContext: Stage2TriggerContext
  answers: PersonalPlanRefinementAnswersV1
  completedQuestionIds: Stage2QuestionId[]
}

export function journeyRoutineToolSection(
  input: JourneyToolSessionInput,
  needSnapshot: InitialNeedPlanSnapshot | null = journeyNeedSnapshot(),
): ToolRoutineSection | null {
  if (!needSnapshot) return null
  const session = createStage2RefinementSession({
    pathVersion: "labs-feinschliff-journey",
    triggerContext: input.triggerContext,
    answers: input.answers,
    completedQuestionIds: input.completedQuestionIds,
  })
  const completedQuestionIds = session.path.completedQuestionIds
  const view = buildToolView({
    careHabits: careHabitsV1Schema.parse(
      toCareHabitsPatch(session.answers, { completedQuestionIds }),
    ),
    // The lab session carries no answer provenance: every completed answer is the reviewer's own.
    fieldProvenance: toFieldProvenance({
      completedQuestionIds,
      answerProvenance: {},
      answers: session.answers,
    }),
    needSnapshot,
    routine: ROUTINE_VIEW_RESOLVED.activeVersion!.payload,
    hasOptionalPage: false,
    toolsEnabled: true,
  })
  return view?.routineSection ?? null
}
