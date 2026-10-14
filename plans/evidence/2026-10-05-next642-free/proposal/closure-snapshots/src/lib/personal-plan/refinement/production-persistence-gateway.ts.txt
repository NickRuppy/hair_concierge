import { computeNeedPlan } from "@/lib/personal-plan/compute-stage1"
import type { Stage2RefinementGateway } from "./gateway"
import {
  createStage2RefinementService,
  type Stage2RefinementPersistence,
} from "@/lib/personal-plan/persistence/stage2-refinement-service"
import { hashPersonalPlanNeedVersionInput, type JsonValue } from "@/lib/personal-plan/persistence"
import { PERSONAL_PLAN_STAGE1_COMPUTATION_VERSION } from "@/lib/personal-plan/persistence/stage1-service"
import { buildPlanRoutineContextFromCompletedRefinement } from "./stage1-adapter"
import type { InitialNeedPlanSnapshot } from "@/lib/personal-plan/types"
import type {
  PersonalPlanRefinementAnswersV1,
  Stage2QuestionId,
  Stage2TriggerContext,
} from "./types"

export function createPersistedStage2RefinementGateway(input: {
  userId: string
  persistence: Stage2RefinementPersistence
}): Stage2RefinementGateway {
  return createStage2RefinementService({
    userId: input.userId,
    persistence: input.persistence,
    snapshotBuilder: (snapshotInput) =>
      createRefinedNeedSnapshot({
        ...snapshotInput,
        createdAt: new Date().toISOString(),
      }),
  })
}

export function createRefinedNeedSnapshot(input: {
  baseInitialNeedVersionId: string
  preparedArtifactSourceId: string
  baseInputSnapshot: JsonValue
  triggerContext: Stage2TriggerContext
  answers: PersonalPlanRefinementAnswersV1
  completedQuestionIds: readonly Stage2QuestionId[]
  habitsModuleUserComplete?: boolean
  createdAt: string
}): {
  inputSnapshot: Record<string, unknown>
  outputSnapshot: InitialNeedPlanSnapshot
  inputHash: string
  schemaVersion: number
  computationVersion: string
} {
  const routine = buildPlanRoutineContextFromCompletedRefinement({
    triggerContext: input.triggerContext,
    answers: input.answers,
    completedQuestionIds: input.completedQuestionIds,
    habitsModuleUserComplete: input.habitsModuleUserComplete,
  })
  const computed = computeNeedPlan({
    rawEnvelope: input.baseInputSnapshot,
    artifactId: input.preparedArtifactSourceId,
    projection: "refined_post_plan",
    computationVersion: PERSONAL_PLAN_STAGE1_COMPUTATION_VERSION,
    createdAt: input.createdAt,
    routine,
  })
  if (computed.status !== "ready") {
    throw new Error(`Refined Personal Plan snapshot is unavailable: ${computed.status}`)
  }
  const inputSnapshot = {
    triggerContext: input.triggerContext,
    answers: input.answers,
    completedQuestionIds: [...input.completedQuestionIds],
    ...(input.habitsModuleUserComplete === false
      ? { habitsModuleUserComplete: false as const }
      : {}),
  }
  return {
    inputSnapshot,
    outputSnapshot: computed.snapshot,
    inputHash: hashPersonalPlanNeedVersionInput({
      schemaVersion: computed.snapshot.schemaVersion,
      computationVersion: computed.snapshot.computationVersion,
      inputSnapshot: inputSnapshot as JsonValue,
      parentNeedVersionId: input.baseInitialNeedVersionId,
    }),
    schemaVersion: computed.snapshot.schemaVersion,
    computationVersion: computed.snapshot.computationVersion,
  }
}
