import {
  STAGE2_ASSUMED_DRY_SHAMPOO_BRIDGE_PREFERENCE,
  STAGE2_ASSUMED_SCALP_IRRITATION_DETAIL,
  STAGE2_ASSUMED_TOWEL_MATERIAL,
  STAGE2_ASSUMED_TOWEL_TECHNIQUE,
  STAGE2_ASSUMED_WET_WASH_FREQUENCY,
  resolveAssumedAnswers,
} from "../refinement/assumed-defaults"
import type {
  PersonalPlanRefinementAnswersV1,
  Stage2AnswerProvenance,
  Stage2QuestionId,
  Stage2TriggerContext,
} from "../refinement/types"
import type { KnownCareAnswers } from "@/lib/user-facts/known-care-answers"

/**
 * Accepting a Stage-1 Idealplan without running Stage 2 interactively. The
 * values themselves live in the typed default resolver
 * (`refinement/assumed-defaults.ts`), which owns the full rule table with
 * rationales; direct acceptance is the no-answers special case of it. Every
 * default is deliberately conservative: it must never invent a need the
 * Idealplan did not already show, and every assumption it makes has to be
 * renderable to the user before they accept.
 */

export const DIRECT_ACCEPTANCE_WET_WASH_FREQUENCY = STAGE2_ASSUMED_WET_WASH_FREQUENCY
export const DIRECT_ACCEPTANCE_TOWEL_MATERIAL = STAGE2_ASSUMED_TOWEL_MATERIAL
export const DIRECT_ACCEPTANCE_TOWEL_TECHNIQUE = STAGE2_ASSUMED_TOWEL_TECHNIQUE
export const DIRECT_ACCEPTANCE_SCALP_IRRITATION_DETAIL = STAGE2_ASSUMED_SCALP_IRRITATION_DETAIL
export const DIRECT_ACCEPTANCE_DRY_SHAMPOO_BRIDGE_PREFERENCE =
  STAGE2_ASSUMED_DRY_SHAMPOO_BRIDGE_PREFERENCE

export type DirectAcceptanceStage2Defaults = {
  answers: PersonalPlanRefinementAnswersV1
  completedQuestionIds: Stage2QuestionId[]
  /** `user` for a stored answer the resolver kept, `assumed` for everything it filled in. */
  answerProvenance: Stage2AnswerProvenance
}

const NOTHING_KNOWN: KnownCareAnswers = { answers: {}, questionIds: [] }

/**
 * The resolver assumes only what the member's stored care answers leave open (2026-10-06: an
 * all-assumed accept replaced a legacy member's real towel/drying answers). With nothing known
 * it assumes the whole canonical path — complete by construction when the path changes.
 * Provenance comes from what the resolver actually assumed, never from what was passed in: a
 * known answer it rejects (off-path, invalid, a towel missing its technique) is `assumed`.
 */
export function buildDirectAcceptanceStage2Defaults(
  triggerContext: Stage2TriggerContext,
  known: KnownCareAnswers = NOTHING_KNOWN,
): DirectAcceptanceStage2Defaults {
  const resolution = resolveAssumedAnswers({
    triggerContext,
    answers: known.answers,
    ...(known.questionIds.length > 0 ? { userAnsweredQuestionIds: known.questionIds } : {}),
  })
  const assumed = new Set(resolution.assumedQuestionIds)
  const answerProvenance: Stage2AnswerProvenance = {}
  for (const id of resolution.orderedQuestionIds) {
    answerProvenance[id] = assumed.has(id) ? "assumed" : "user"
  }
  return {
    answers: resolution.answers,
    completedQuestionIds: resolution.orderedQuestionIds,
    answerProvenance,
  }
}
