import type { JsonValue } from "@/lib/personal-plan/persistence"
import { userAnsweredQuestionIds } from "@/lib/personal-plan/refinement/answer-provenance"
import { resolveAssumedAnswers } from "@/lib/personal-plan/refinement/assumed-defaults"
import { stage2ModuleStates } from "@/lib/personal-plan/refinement/module-status"
import { createRefinedNeedSnapshot } from "@/lib/personal-plan/refinement/production-persistence-gateway"
import { resolveStage2RefinementContract } from "@/lib/personal-plan/refinement/question-path"
import { deriveStage2TriggerContext } from "@/lib/personal-plan/refinement/stage1-adapter"
import {
  STAGE2_MODULES,
  type PersonalPlanRefinementAnswersV1,
  type Stage2AnswerProvenance,
  type Stage2QuestionId,
  type Stage2TriggerContext,
} from "@/lib/personal-plan/refinement/types"
import type { InitialNeedPlanSnapshot } from "@/lib/personal-plan/types"
import { toCareHabitsPatch, toFieldProvenance } from "@/lib/user-facts/from-refinement-draft"
import {
  CARE_HABITS_SCHEMA_VERSION,
  type CareHabitsPatch,
  type DomainProvenance,
} from "@/lib/user-facts/schema"

/**
 * The clone content and refined projection of a facts rebase (plans/2026-10-03-central-user-
 * profile-pr2.md §4a, „Clone content and projection"). Rule: produce exactly what the user's
 * own lane would produce on the NEW parent — so every step below calls the function that lane
 * calls, never a copy of it. Pure: no I/O; `now` is the only clock.
 */

/** The source draft as `loadExistingFromSource` would pick it (stale drafts never count). */
export type RebaseSourceDraft = {
  id: string
  status: "in_progress" | "complete"
  answers: PersonalPlanRefinementAnswersV1
  completedQuestionIds: Stage2QuestionId[]
  answerProvenance: Stage2AnswerProvenance
}

export type RebaseProjectionInput = {
  sourceDraft: RebaseSourceDraft
  /** The new initial version: its id (part of the refined hash) and Stage-1 snapshots. */
  newInitial: { id: string; inputSnapshot: JsonValue; outputSnapshot: InitialNeedPlanSnapshot }
  /** `prepared_artifact_source_id ?? stage1_source_lead_id`, copied to the new initial. */
  sourceId: string
  hasRefinedHead: boolean
  now: Date
}

export type RebaseClone = {
  answers: PersonalPlanRefinementAnswersV1
  completedQuestionIds: Stage2QuestionId[]
  answerProvenance: Stage2AnswerProvenance
}

export type RebaseRefinedVersion = {
  schemaVersion: number
  computationVersion: string
  inputHash: string
  inputSnapshot: Record<string, unknown>
  outputSnapshot: InitialNeedPlanSnapshot
}

export type RebaseProjection = {
  clone: RebaseClone
  /** `null` exactly when the plan has no refined head (nothing was published before). */
  refined: RebaseRefinedVersion | null
  /** The facts-first write (I1, R16); non-null exactly when `refined` is. */
  careHabits: { patch: CareHabitsPatch; provenance: DomainProvenance } | null
}

/**
 * The terminal contract cannot be met on the new parent — the same condition on which
 * `completeDraft` throws `incomplete_refinement`. The lane maps it to `unavailable /
 * invalid_source`.
 */
export class RebaseProjectionIncompleteError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "RebaseProjectionIncompleteError"
  }
}

export function buildRebaseProjection(input: RebaseProjectionInput): RebaseProjection {
  const { sourceDraft, newInitial } = input
  const triggerContext = deriveStage2TriggerContext(newInitial.outputSnapshot)
  const clone =
    sourceDraft.status === "complete"
      ? resolvedClone(sourceDraft, triggerContext)
      : {
          answers: sourceDraft.answers,
          completedQuestionIds: sourceDraft.completedQuestionIds,
          answerProvenance: sourceDraft.answerProvenance,
        }

  // The snapshot is computed even without a refined head: a complete source on the new
  // parent must still satisfy the terminal contract, and the module lane's resolver must
  // still succeed — a refusal here is a refusal whatever the RPC would say.
  const snapshotArgs =
    sourceDraft.status === "complete"
      ? terminalSnapshotArgs(clone, triggerContext)
      : moduleSnapshotArgs(clone, triggerContext)
  if (!input.hasRefinedHead) return { clone, refined: null, careHabits: null }

  const snapshot = createRefinedNeedSnapshot({
    baseInitialNeedVersionId: newInitial.id,
    preparedArtifactSourceId: input.sourceId,
    baseInputSnapshot: newInitial.inputSnapshot,
    triggerContext,
    ...snapshotArgs,
    createdAt: input.now.toISOString(),
  })
  return {
    clone,
    refined: {
      schemaVersion: snapshot.schemaVersion,
      computationVersion: snapshot.computationVersion,
      inputHash: snapshot.inputHash,
      inputSnapshot: snapshot.inputSnapshot,
      outputSnapshot: snapshot.outputSnapshot,
    },
    // Exactly `writeCareHabitsFacts` (stage2-refinement-service.ts) for the clone.
    careHabits: {
      patch: toCareHabitsPatch(clone.answers),
      provenance: {
        source: { kind: "feinschliff_draft", id: sourceDraft.id },
        schemaVersion: CARE_HABITS_SCHEMA_VERSION,
        at: input.now.toISOString(),
        fields: toFieldProvenance(clone),
      },
    },
  }
}

type SnapshotArgs = {
  answers: PersonalPlanRefinementAnswersV1
  completedQuestionIds: readonly Stage2QuestionId[]
  habitsModuleUserComplete?: boolean
}

/**
 * Complete source (terminal lane, incl. direct acceptance; R15): user answers are kept, every
 * other question on the new path is resolved by the assumption rules, and the clone carries
 * the resolver's full path with `user` / `assumed` provenance.
 */
function resolvedClone(
  sourceDraft: RebaseSourceDraft,
  triggerContext: Stage2TriggerContext,
): RebaseClone {
  const resolution = resolveAssumedAnswers({
    triggerContext,
    answers: sourceDraft.answers,
    userAnsweredQuestionIds: userAnsweredQuestionIds(
      sourceDraft.completedQuestionIds,
      sourceDraft.answerProvenance,
    ),
  })
  const assumed = new Set(resolution.assumedQuestionIds)
  const answerProvenance: Stage2AnswerProvenance = {}
  for (const id of resolution.orderedQuestionIds) {
    answerProvenance[id] = assumed.has(id) ? "assumed" : "user"
  }
  // The resolver always returns `heatEvents` (`{}` when no heat source is selected); a draft
  // completed interactively without heat never carries the key. An empty map the source never
  // had is not an answer: keeping it would make the clone — and so the refined hash — differ
  // from what the terminal lane produces for the very same answers (hash-equality test).
  const answers =
    sourceDraft.answers.heatEvents === undefined &&
    Object.keys(resolution.answers.heatEvents ?? {}).length === 0
      ? withoutHeatEvents(resolution.answers)
      : resolution.answers
  return { answers, completedQuestionIds: resolution.orderedQuestionIds, answerProvenance }
}

function withoutHeatEvents(
  answers: PersonalPlanRefinementAnswersV1,
): PersonalPlanRefinementAnswersV1 {
  const rest = { ...answers }
  delete rest.heatEvents
  return rest
}

/** Exactly `completeDraft`: the contract over the draft, contract answers verbatim. */
function terminalSnapshotArgs(
  draft: RebaseClone,
  triggerContext: Stage2TriggerContext,
): SnapshotArgs {
  const contract = resolveStage2RefinementContract({
    triggerContext,
    answers: draft.answers,
    completedQuestionIds: draft.completedQuestionIds,
  })
  if (!contract.isComplete) {
    throw new RebaseProjectionIncompleteError(
      `Refinement contract incomplete on the new parent: ${contract.path.firstUnresolvedQuestionId}`,
    )
  }
  return { answers: contract.answers, completedQuestionIds: contract.path.completedQuestionIds }
}

/**
 * Exactly `completeModule`, without its module gate (a system projection completes no
 * module): user answers ∪ the resolver's assumptions, `habitsModuleUserComplete` from the
 * module states — unless every module is user-complete, in which case `completeModule`
 * delegates to the terminal completion, and so does this.
 */
function moduleSnapshotArgs(
  draft: RebaseClone,
  triggerContext: Stage2TriggerContext,
): SnapshotArgs {
  const moduleStates = stage2ModuleStates({ triggerContext, ...draft })
  if (STAGE2_MODULES.every((candidate) => moduleStates[candidate].status === "complete")) {
    return terminalSnapshotArgs(draft, triggerContext)
  }
  const resolution = resolveAssumedAnswers({
    triggerContext,
    answers: draft.answers,
    userAnsweredQuestionIds: userAnsweredQuestionIds(
      draft.completedQuestionIds,
      draft.answerProvenance,
    ),
  })
  return {
    answers: resolution.answers,
    completedQuestionIds: resolution.orderedQuestionIds,
    habitsModuleUserComplete: moduleStates.habits.status === "complete",
  }
}
