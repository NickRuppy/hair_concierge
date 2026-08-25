import type { Stage2Module, Stage2QuestionId } from "./types"
import type { Stage2RefinementHandoff, Stage2RefinementSession } from "./session"

export type Stage2RefinementErrorCode =
  | "save_failed"
  | "completion_failed"
  | "revision_conflict"
  | "invalid_answer"
  | "question_not_current"
  | "incomplete_refinement"
  | "temporarily_unavailable"
  | "unsupported_snapshot_version"
  | "snapshot_too_large"

export class Stage2RefinementError extends Error {
  constructor(
    public readonly code: Stage2RefinementErrorCode,
    message: string = code,
    public readonly savedSession?: Stage2RefinementSession,
  ) {
    super(message)
    this.name = "Stage2RefinementError"
  }
}

export type Stage2SaveAnswerInput = {
  questionId: Stage2QuestionId
  answer: unknown
  expectedRevision: number
}

export type Stage2CompleteResult = Stage2RefinementHandoff

export type Stage2SaveAndCompleteResult = {
  session: Stage2RefinementSession
  handoff: Stage2CompleteResult
}

export type Stage2CompleteModuleInput = { module: Stage2Module; expectedRevision: number }

/**
 * Result of finishing ONE refinement module. `status` is the draft state after
 * the write: `in_progress` while the other module is still open, `complete`
 * once this module was the closing one (that case runs through the unchanged
 * full-completion path). `stage3Handoff` is the Modul-1 handoff marker — true
 * exactly for `products`, whose completion hands the user into Stage 3.
 */
export type Stage2ModuleCompletionResult = Stage2RefinementHandoff & {
  module: Stage2Module
  status: "in_progress" | "complete"
  stage3Handoff: boolean
}

export type Stage2SaveAndCompleteModuleResult = {
  session: Stage2RefinementSession
  moduleCompletion: Stage2ModuleCompletionResult
}

export interface Stage2RefinementGateway {
  load(): Promise<Stage2RefinementSession>
  saveAnswer(input: Stage2SaveAnswerInput): Promise<Stage2RefinementSession>
  saveAnswerAndComplete?(input: Stage2SaveAnswerInput): Promise<Stage2SaveAndCompleteResult>
  /** Client-side counterpart of the PATCH `completeModuleAfterSave` contract. */
  saveAnswerAndCompleteModule?(
    input: Stage2SaveAnswerInput & { module: Stage2Module },
  ): Promise<Stage2SaveAndCompleteModuleResult>
  complete(input: { expectedRevision: number }): Promise<Stage2CompleteResult>
  /** Server-side module completion; absent on gateways that cannot project one (fixtures). */
  completeModule?(input: Stage2CompleteModuleInput): Promise<Stage2ModuleCompletionResult>
}
