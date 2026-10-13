import { nightWearFromEarlierNightAnswer } from "@/lib/personal-plan/tools/facts"

import {
  getStage2QuestionModule,
  isStage2NightWearApplicable,
  resolveStage2RefinementContract,
} from "./question-path"
import type {
  PersonalPlanRefinementAnswersV1,
  Stage2AnswerProvenance,
  Stage2QuestionId,
  Stage2TriggerContext,
} from "./types"

export type Stage2PersistedAnswerState = {
  answers: PersonalPlanRefinementAnswersV1
  completedQuestionIds: readonly Stage2QuestionId[]
  answerProvenance: Stage2AnswerProvenance
}

/**
 * Rev. 6 (review fixes F2/F3, 2026-10-12): the night question carries over the earlier answer
 * of a member who finished Gewohnheiten before it existed. Nick's ruling — existing answers
 * pre-fill the new question and are never re-asked; Gewohnheiten stays complete.
 *
 * The old `night_protection` multi-select offered both techniques, so her answer already says how
 * she wears her hair at night: Pineapple, else „Locker zusammengebunden", else „Offen". The
 * carried-over `night_wear` is completed with the old answer's provenance (`user` stays `user`,
 * `assumed` stays `assumed`), so a member-complete module stays complete and a direct-accept
 * draft stays answered by assumption. It is a translation, not an invention.
 *
 * Applies only when `night_wear` is on the path and not answered, the draft still names the old
 * `night_protection` as completed (a draft saved before the night question existed), and every
 * other Gewohnheiten question on the path is completed. A Gewohnheiten still in progress asks the
 * night question in its normal order, and a new member never had the old question.
 *
 * Pure and idempotent. Every reader of a persisted draft applies it — the session load, the
 * Stage-2 service (so the next save persists it), the module status and the facts rebase — so
 * they all see the same answers.
 */
export function carryOverStage2NightAnswer<Draft extends Stage2PersistedAnswerState>(
  triggerContext: Stage2TriggerContext,
  draft: Draft,
): Draft {
  if (!isStage2NightWearApplicable(triggerContext)) return draft
  if (!draft.completedQuestionIds.includes("night_protection")) return draft
  const contract = resolveStage2RefinementContract({
    triggerContext,
    answers: draft.answers,
    completedQuestionIds: [...draft.completedQuestionIds],
  })
  const { orderedQuestionIds } = contract.path
  if (!orderedQuestionIds.includes("night_wear")) return draft
  if (contract.completedQuestionIds.includes("night_wear")) return draft
  const habitsInProgress = orderedQuestionIds.some(
    (questionId) =>
      questionId !== "night_wear" &&
      getStage2QuestionModule(questionId) === "habits" &&
      !contract.completedQuestionIds.includes(questionId),
  )
  if (habitsInProgress) return draft

  // The draft's own earlier answer, read before the path prunes the old question away.
  const earlier = nightWearFromEarlierNightAnswer(draft.answers.nightProtection)
  const provenance =
    earlier !== undefined && draft.answerProvenance.night_protection !== "assumed"
      ? "user"
      : "assumed"
  return {
    ...draft,
    answers: { ...draft.answers, nightWear: earlier ?? "open" },
    completedQuestionIds: [...draft.completedQuestionIds, "night_wear"],
    answerProvenance: { ...draft.answerProvenance, night_wear: provenance },
  }
}
