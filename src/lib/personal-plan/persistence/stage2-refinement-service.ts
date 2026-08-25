import { z } from "zod"

import {
  createStage2RefinementSession,
  saveStage2SessionAnswer,
  type Stage2RefinementHandoff,
  type Stage2RefinementSession,
} from "@/lib/personal-plan/refinement/session"
import {
  getStage2ModulePathStates,
  resolveStage2RefinementContract,
} from "@/lib/personal-plan/refinement/question-path"
import {
  applyUserAnswerProvenance,
  userAnsweredQuestionIds,
} from "@/lib/personal-plan/refinement/answer-provenance"
import { resolveAssumedAnswers } from "@/lib/personal-plan/refinement/assumed-defaults"
import {
  STAGE2_MODULES,
  type PersonalPlanRefinementAnswersV1,
  type Stage2AnswerProvenance,
  type Stage2Module,
  type Stage2ModuleProjections,
  type Stage2QuestionId,
  type Stage2TriggerContext,
} from "@/lib/personal-plan/refinement/types"
import {
  Stage2RefinementError,
  type Stage2ModuleCompletionResult,
} from "@/lib/personal-plan/refinement/gateway"
import type { JsonValue } from "./index"

const MAX_REFINEMENT_PAYLOAD_BYTES = 64 * 1024

export const stage2AnswerSaveInputSchema = z.object({
  questionId: z.string().min(1).max(96),
  answer: z.unknown(),
  expectedRevision: z.number().int().nonnegative(),
})

export const stage2CompleteInputSchema = z.object({
  expectedRevision: z.number().int().nonnegative(),
})

export const stage2CompleteModuleInputSchema = z.object({
  module: z.enum(STAGE2_MODULES),
  expectedRevision: z.number().int().nonnegative(),
})

export type Stage2PersistedDraft = {
  id: string
  personalPlanId: string
  baseInitialNeedVersionId: string
  schemaVersion: number
  preparedArtifactSourceId: string
  baseInputSnapshot: JsonValue
  pathVersion: string
  triggerContext: Stage2TriggerContext
  answers: PersonalPlanRefinementAnswersV1
  completedQuestionIds: Stage2QuestionId[]
  /** Canonical question id -> `user` | `assumed`. See `refinement/answer-provenance.ts`. */
  answerProvenance: Stage2AnswerProvenance
  /** Per-module projection lineage incl. the persisted Modul-1 handoff marker. */
  moduleProjections: Stage2ModuleProjections
  revision: number
  status: "in_progress" | "complete" | "stale"
  refinedVersionId: string | null
}

export type Stage2RefinementPersistence = {
  loadOrCreate(userId: string): Promise<Stage2PersistedDraft>
  reopen(input: { userId: string; draft: Stage2PersistedDraft }): Promise<Stage2PersistedDraft>
  save(input: {
    userId: string
    draft: Stage2PersistedDraft
    expectedRevision: number
    answers: PersonalPlanRefinementAnswersV1
    completedQuestionIds: Stage2QuestionId[]
    answerProvenance: Stage2AnswerProvenance
  }): Promise<
    { outcome: "saved"; revision: number } | { outcome: "revision_conflict"; revision: number }
  >
  complete(input: {
    userId: string
    draft: Stage2PersistedDraft
    expectedRevision: number
    inputSnapshot: Record<string, unknown>
    outputSnapshot: Record<string, unknown>
    inputHash: string
    schemaVersion: number
    computationVersion: string
  }): Promise<
    | { outcome: "completed" | "already_completed"; refinedVersionId: string }
    | { outcome: "revision_conflict"; revision: number }
    | { outcome: "stale_source" }
  >
  /**
   * Projects one module's completion: writes the refined Need version, records
   * the module's projection lineage and leaves the draft `in_progress` at its
   * current revision. `already_projected` is the replay of a lost response.
   */
  completeModule(input: {
    userId: string
    draft: Stage2PersistedDraft
    module: Stage2Module
    expectedRevision: number
    inputSnapshot: Record<string, unknown>
    outputSnapshot: Record<string, unknown>
    inputHash: string
    schemaVersion: number
    computationVersion: string
  }): Promise<
    | {
        outcome: "completed" | "already_projected"
        refinedVersionId: string
        stage3Handoff: boolean
      }
    | { outcome: "revision_conflict"; revision: number }
    | { outcome: "stale_source" }
  >
}

export type Stage2RefinementResumeReader = {
  loadExisting(userId: string): Promise<Stage2PersistedDraft | null>
}

export type Stage2RefinementSnapshotBuilder = (input: {
  baseInitialNeedVersionId: string
  preparedArtifactSourceId: string
  baseInputSnapshot: JsonValue
  triggerContext: Stage2TriggerContext
  answers: PersonalPlanRefinementAnswersV1
  completedQuestionIds: readonly Stage2QuestionId[]
}) => {
  inputSnapshot: Record<string, unknown>
  outputSnapshot: Record<string, unknown>
  inputHash: string
  schemaVersion: number
  computationVersion: string
}

export function stage2SessionFromPersistedDraft(
  draft: Stage2PersistedDraft,
): Stage2RefinementSession {
  return createStage2RefinementSession({
    pathVersion: draft.pathVersion,
    triggerContext: draft.triggerContext,
    answers: draft.answers,
    completedQuestionIds: draft.completedQuestionIds,
    revision: draft.revision,
    status: draft.status,
    completedHandoff:
      draft.status === "complete" && draft.refinedVersionId
        ? { refinedVersionId: draft.refinedVersionId, nextHref: "/plan-start" }
        : undefined,
  })
}

export async function loadExistingStage2RefinementSession(input: {
  userId: string
  persistence: Stage2RefinementResumeReader
}): Promise<Stage2RefinementSession | null> {
  const draft = await input.persistence.loadExisting(input.userId)
  if (!draft) return null
  if (draft.status === "stale") {
    throw new Stage2RefinementError(
      "temporarily_unavailable",
      "A current refinement draft is unavailable",
    )
  }
  return stage2SessionFromPersistedDraft(draft)
}

export function createStage2RefinementService(input: {
  userId: string
  persistence: Stage2RefinementPersistence
  snapshotBuilder: Stage2RefinementSnapshotBuilder
}) {
  let cached: Stage2PersistedDraft | null = null

  async function loadDraft(): Promise<Stage2PersistedDraft> {
    const draft = await input.persistence.loadOrCreate(input.userId)
    // A stale row is historical only. The persistence boundary must create a fresh draft.
    if (draft.status === "stale") {
      throw new Stage2RefinementError(
        "temporarily_unavailable",
        "A fresh refinement draft is unavailable",
      )
    }
    cached = draft
    return draft
  }

  /** Today's terminal completion, shared by `complete()` and the closing module. */
  async function completeDraft(expectedRevision: number): Promise<Stage2RefinementHandoff> {
    const draft = cached ?? (await loadDraft())
    const contract = resolveStage2RefinementContract({
      triggerContext: draft.triggerContext,
      answers: draft.answers,
      completedQuestionIds: draft.completedQuestionIds,
    })
    if (!contract.isComplete) throw new Stage2RefinementError("incomplete_refinement")
    const snapshot = input.snapshotBuilder({
      baseInitialNeedVersionId: draft.baseInitialNeedVersionId,
      preparedArtifactSourceId: draft.preparedArtifactSourceId,
      baseInputSnapshot: draft.baseInputSnapshot,
      triggerContext: draft.triggerContext,
      answers: contract.answers,
      completedQuestionIds: contract.path.completedQuestionIds,
    })
    const result = await input.persistence.complete({
      userId: input.userId,
      draft,
      expectedRevision,
      ...snapshot,
    })
    if (result.outcome === "revision_conflict") {
      cached = null
      throw new Stage2RefinementError("revision_conflict")
    }
    if (result.outcome === "stale_source") {
      cached = null
      throw new Stage2RefinementError(
        "revision_conflict",
        "The initial need changed; reload refinement",
      )
    }
    cached = { ...draft, status: "complete", refinedVersionId: result.refinedVersionId }
    return { refinedVersionId: result.refinedVersionId, nextHref: "/plan-start" }
  }

  return {
    async load(): Promise<Stage2RefinementSession> {
      return stage2SessionFromPersistedDraft(await loadDraft())
    },
    async saveAnswer(raw: unknown): Promise<Stage2RefinementSession> {
      const parsed = stage2AnswerSaveInputSchema.safeParse(raw)
      if (!parsed.success) throw new Stage2RefinementError("invalid_answer")
      let draft = cached ?? (await loadDraft())
      if (draft.status === "complete") {
        draft = await input.persistence.reopen({ userId: input.userId, draft })
        cached = draft
      }
      if (draft.status !== "in_progress") throw new Stage2RefinementError("revision_conflict")
      const next = saveStage2SessionAnswer(stage2SessionFromPersistedDraft(draft), {
        questionId: parsed.data.questionId as Stage2QuestionId,
        answer: parsed.data.answer,
      })
      if (
        JSON.stringify({ answers: next.answers, completedQuestionIds: next.completedQuestionIds })
          .length > MAX_REFINEMENT_PAYLOAD_BYTES
      ) {
        throw new Stage2RefinementError("invalid_answer", "The refinement payload is too large")
      }
      const nextAnswerProvenance = applyUserAnswerProvenance({
        previous: draft.answerProvenance,
        answeredQuestionId: parsed.data.questionId as Stage2QuestionId,
        completedQuestionIds: next.completedQuestionIds,
      })
      const saved = await input.persistence.save({
        userId: input.userId,
        draft,
        expectedRevision: parsed.data.expectedRevision,
        answers: next.answers,
        completedQuestionIds: next.completedQuestionIds,
        answerProvenance: nextAnswerProvenance,
      })
      if (saved.outcome === "revision_conflict") {
        cached = null
        throw new Stage2RefinementError("revision_conflict")
      }
      cached = {
        ...draft,
        answers: next.answers,
        completedQuestionIds: next.completedQuestionIds,
        answerProvenance: nextAnswerProvenance,
        revision: saved.revision,
      }
      return stage2SessionFromPersistedDraft(cached)
    },
    async complete(raw: unknown): Promise<Stage2RefinementHandoff> {
      const parsed = stage2CompleteInputSchema.safeParse(raw)
      if (!parsed.success) throw new Stage2RefinementError("completion_failed")
      return completeDraft(parsed.data.expectedRevision)
    },
    /**
     * Finishes ONE module: projects a new refined Need version from the user's
     * own answers ∪ the typed resolver's assumptions for everything still open.
     * The draft stays `in_progress` — unless this module was the closing one,
     * in which case the unchanged full-completion path runs instead, so the end
     * state is byte-identical to today's `complete()`.
     */
    async completeModule(raw: unknown): Promise<Stage2ModuleCompletionResult> {
      const parsed = stage2CompleteModuleInputSchema.safeParse(raw)
      if (!parsed.success) throw new Stage2RefinementError("completion_failed")
      const { module: stage2Module, expectedRevision } = parsed.data
      const draft = cached ?? (await loadDraft())
      if (draft.status !== "in_progress") throw new Stage2RefinementError("revision_conflict")

      // Module status counts USER answers only; the projection input is user ∪
      // assumed. Both derive from the resolved path, because assumptions can
      // open or close conditional questions.
      const userQuestionIds = userAnsweredQuestionIds(
        draft.completedQuestionIds,
        draft.answerProvenance,
      )
      const resolution = resolveAssumedAnswers({
        triggerContext: draft.triggerContext,
        answers: draft.answers,
        userAnsweredQuestionIds: userQuestionIds,
      })
      const moduleStates = getStage2ModulePathStates(resolution.orderedQuestionIds, userQuestionIds)
      if (moduleStates[stage2Module].status !== "complete") {
        throw new Stage2RefinementError(
          "incomplete_refinement",
          `Stage 2 module is incomplete: ${stage2Module}/${moduleStates[stage2Module].openQuestionIds[0]}`,
        )
      }

      const stage3Handoff = stage2Module === "products"
      // Both modules answered ⇒ the canonical path is complete by construction,
      // so the closing module delegates to the existing terminal completion
      // rather than teaching the module RPC a second way to close a draft. The
      // durable Stage-3 entry marker for that case stays today's `complete`
      // draft status, so nothing extra is persisted.
      if (STAGE2_MODULES.every((candidate) => moduleStates[candidate].status === "complete")) {
        const handoff = await completeDraft(expectedRevision)
        return { ...handoff, module: stage2Module, status: "complete", stage3Handoff }
      }

      const snapshot = input.snapshotBuilder({
        baseInitialNeedVersionId: draft.baseInitialNeedVersionId,
        preparedArtifactSourceId: draft.preparedArtifactSourceId,
        baseInputSnapshot: draft.baseInputSnapshot,
        triggerContext: draft.triggerContext,
        answers: resolution.answers,
        completedQuestionIds: resolution.orderedQuestionIds,
      })
      const result = await input.persistence.completeModule({
        userId: input.userId,
        draft,
        module: stage2Module,
        expectedRevision,
        ...snapshot,
      })
      if (result.outcome === "revision_conflict") {
        cached = null
        throw new Stage2RefinementError("revision_conflict")
      }
      if (result.outcome === "stale_source") {
        cached = null
        throw new Stage2RefinementError(
          "revision_conflict",
          "The initial need changed; reload refinement",
        )
      }
      cached = {
        ...draft,
        moduleProjections: {
          ...draft.moduleProjections,
          [stage2Module]: {
            needVersionId: result.refinedVersionId,
            projectedAtRevision: draft.revision,
            stage3Handoff: result.stage3Handoff,
          },
        },
      }
      return {
        module: stage2Module,
        refinedVersionId: result.refinedVersionId,
        status: "in_progress",
        stage3Handoff: result.stage3Handoff,
        nextHref: "/plan-start",
      }
    },
  }
}
