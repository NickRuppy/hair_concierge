import { z } from "zod"

import {
  createStage2RefinementSession,
  saveStage2SessionAnswer,
  type Stage2RefinementHandoff,
  type Stage2RefinementSession,
} from "@/lib/personal-plan/refinement/session"
import { resolveStage2RefinementContract } from "@/lib/personal-plan/refinement/question-path"
import { stage2ModuleStates } from "@/lib/personal-plan/refinement/module-status"
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
import { toCareHabitsPatch, toFieldProvenance } from "@/lib/user-facts/from-refinement-draft"
import { CARE_HABITS_SCHEMA_VERSION } from "@/lib/user-facts/schema"
import type { SaveUserFactsInput, SaveUserFactsResult } from "@/lib/user-facts/save"
import type { JsonValue } from "./index"

/**
 * The `care_habits` arm of `SaveUserFactsInput`, injected so `completeModule` can write
 * facts without this file importing `saveUserFacts` (and its `server-only` guard) or an
 * admin client directly. Production wiring lives in `refinement/production-persistence-gateway.ts`.
 */
export type SaveCareHabitsFacts = (
  input: Extract<SaveUserFactsInput, { domain: "care_habits" }>,
) => Promise<SaveUserFactsResult>

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
  /** Present only for a partial module projection; omitted by terminal completion. */
  habitsModuleUserComplete?: boolean
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
  /**
   * Writes the `care_habits` user-facts domain from the draft's own answers, bound to the
   * source draft's revision (F04/F22). EVERY lane that publishes a refined version from
   * draft answers writes facts first — the terminal `complete()` (and the closing module,
   * which delegates to it) and a non-closing `completeModule` alike (controller ruling,
   * task 5b fix round 1, I1). Optional in the TYPE only, so test harnesses that never
   * reach a completion path keep compiling unchanged; the production factory
   * (`createPersistedStage2RefinementGateway`) always wires the real `saveUserFacts`, and
   * every completion path THROWS if it is missing at the write point (M5) — it is never
   * silently skipped.
   */
  saveFacts?: SaveCareHabitsFacts
  /** Injected clock for `provenance.at` (M2). Defaults to the real time. */
  now?: () => Date
}) {
  let cached: Stage2PersistedDraft | null = null
  const now = input.now ?? (() => new Date())

  /**
   * Writes `care_habits` from the draft's own current answers, bound to the draft
   * actually being closed. Shared by `completeDraft` (the terminal `complete()` lane,
   * including the closing module's delegate to it) and `completeModule`'s own non-closing
   * branch — exactly the two places a refined version is ever published from draft
   * answers. Throws a plain `Error` (never `Stage2RefinementError`) if `saveFacts` is
   * missing: a wiring bug, not a user-facing conflict (M5). A `draft_conflict` or
   * `revision_conflict` result maps to the existing `Stage2RefinementError("revision_conflict")`
   * and the caller must not proceed to its own RPC.
   */
  async function writeCareHabitsFacts(
    draft: Stage2PersistedDraft,
    expectedRevision: number,
  ): Promise<void> {
    if (!input.saveFacts) {
      throw new Error(
        "stage2-refinement-service: completing a Feinschliff module or draft requires saveFacts",
      )
    }
    const facts = await input.saveFacts({
      userId: input.userId,
      domain: "care_habits",
      patch: toCareHabitsPatch(draft.answers),
      provenance: {
        source: { kind: "feinschliff_draft", id: draft.id },
        schemaVersion: CARE_HABITS_SCHEMA_VERSION,
        at: now().toISOString(),
        fields: toFieldProvenance({
          completedQuestionIds: draft.completedQuestionIds,
          answerProvenance: draft.answerProvenance,
        }),
      },
      draftBinding: {
        sourceDraftId: draft.id,
        expectedDraftRevision: expectedRevision,
        expectedInitialVersionId: draft.baseInitialNeedVersionId,
      },
    })
    if (facts.status === "draft_conflict" || facts.status === "revision_conflict") {
      cached = null
      // Tagged with `detail.source: "facts"` (fix round 2, ruling 1) so a caller — direct
      // acceptance — can map ONLY this origin to its own conflict error; every other
      // `revision_conflict` in this file stays untagged and propagates unchanged. `code`
      // itself never changes, so the stage-2 route's 409 mapping is untouched.
      throw new Stage2RefinementError("revision_conflict", undefined, undefined, {
        source: "facts",
        status: facts.status,
      })
    }
  }

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
    // I1: EVERY lane that publishes a refined version writes facts first, including this
    // terminal completion (and, by extension, the closing module — it delegates here).
    //
    // Except on a replay (fix round 2, P2): a draft that is no longer `in_progress` was
    // already completed successfully — its facts were written by that completion — and only
    // the HTTP response was lost. The draft binding would reject this write as
    // `not_in_progress` and turn the identical retry into a 409, so the write is skipped and
    // the RPC answers from its own `already_completed` branch, exactly as before this
    // program. `in_progress` drafts keep the facts-first order.
    if (draft.status === "in_progress") await writeCareHabitsFacts(draft, expectedRevision)
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
      // Single source of truth for module status — the same derivation the
      // `unrefined_direct_accept` replacement reads, so the completion gate and
      // "runs on assumptions" can never disagree. It re-resolves the path
      // internally (pure and deterministic, so identical to `resolution`).
      const moduleStates = stage2ModuleStates(draft)
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
      // draft status, so nothing extra is persisted. `completeDraft` writes
      // `care_habits` facts itself (I1) — writing here too would double-publish.
      if (STAGE2_MODULES.every((candidate) => moduleStates[candidate].status === "complete")) {
        const handoff = await completeDraft(expectedRevision)
        return { ...handoff, module: stage2Module, status: "complete", stage3Handoff }
      }

      // Non-closing module completion: `completeDraft` is not on this path, so this is the
      // only place `care_habits` gets published for it — before `persistence.completeModule`
      // (F04/F22), bound to the draft actually being closed, not the resolver's own
      // assumptions for this call (the merge keeps whatever an earlier write recorded for a
      // question the current path no longer asks).
      await writeCareHabitsFacts(draft, expectedRevision)

      const snapshot = input.snapshotBuilder({
        baseInitialNeedVersionId: draft.baseInitialNeedVersionId,
        preparedArtifactSourceId: draft.preparedArtifactSourceId,
        baseInputSnapshot: draft.baseInputSnapshot,
        triggerContext: draft.triggerContext,
        answers: resolution.answers,
        completedQuestionIds: resolution.orderedQuestionIds,
        habitsModuleUserComplete: moduleStates.habits.status === "complete",
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
