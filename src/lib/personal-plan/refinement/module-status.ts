import { userAnsweredQuestionIds } from "./answer-provenance"
import { resolveAssumedAnswers, settleLateAddedAssumptions } from "./assumed-defaults"
import { carryOverStage2NightAnswer } from "./night-wear-carry-over"
import { getStage2ModulePathStates } from "./question-path"
import {
  STAGE2_MODULES,
  type PersonalPlanRefinementAnswersV1,
  type Stage2AnswerProvenance,
  type Stage2Module,
  type Stage2ModulePathState,
  type Stage2QuestionId,
  type Stage2TriggerContext,
} from "./types"

/**
 * Derived module status — the honest replacement for the
 * `unrefined_direct_accept` boolean.
 *
 * That flag records "the active Routine came from a direct accept" and is
 * cleared by whoever remembers to clear it. Once Stage 2 is modular that is a
 * lie: a plan whose `products` module the user answered but whose `habits`
 * module is still assumed is neither "unrefined" nor "refined". The truth is a
 * pure function of the draft: for every module, are all of ITS canonical
 * questions answered by the user (provenance `user`)?
 *
 * Pure/deterministic, no I/O. Same derivation the module-completion gate uses
 * (`persistence/stage2-refinement-service.ts`): the path is resolved WITH the
 * assumption resolver, because an assumed answer can open or close conditional
 * questions, while completeness is judged against user answers only.
 */

export type Stage2ModuleStatusInput = {
  triggerContext: Stage2TriggerContext
  answers: PersonalPlanRefinementAnswersV1
  completedQuestionIds: readonly Stage2QuestionId[]
  answerProvenance: Stage2AnswerProvenance
}

export function stage2ModuleStates(
  raw: Stage2ModuleStatusInput,
): Record<Stage2Module, Stage2ModulePathState> {
  // A Gewohnheiten finished before the night question existed keeps its old night answer.
  const input = carryOverStage2NightAnswer(raw.triggerContext, raw)
  const userQuestionIds = userAnsweredQuestionIds(
    input.completedQuestionIds,
    input.answerProvenance,
  )
  const resolution = resolveAssumedAnswers({
    triggerContext: input.triggerContext,
    answers: input.answers,
    userAnsweredQuestionIds: userQuestionIds,
  })
  return settleLateAddedAssumptions(
    getStage2ModulePathStates(resolution.orderedQuestionIds, userQuestionIds),
    input,
  )
}

/**
 * "Dein Plan basiert noch auf Annahmen." — true while ANY module still has a
 * question the user has not answered, because that module's contribution to the
 * projected Need version came from the assumption resolver.
 */
export function stage2AssumptionsActive(input: Stage2ModuleStatusInput): boolean {
  const states = stage2ModuleStates(input)
  // A `not_applicable` module has no question, so no assumption of its own is in force.
  return STAGE2_MODULES.some((stage2Module) => states[stage2Module].status === "open")
}
