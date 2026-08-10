import type { Stage2QuestionId } from "./types"
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

export interface Stage2RefinementGateway {
  load(): Promise<Stage2RefinementSession>
  saveAnswer(input: Stage2SaveAnswerInput): Promise<Stage2RefinementSession>
  saveAnswerAndComplete?(input: Stage2SaveAnswerInput): Promise<Stage2SaveAndCompleteResult>
  complete(input: { expectedRevision: number }): Promise<Stage2CompleteResult>
}
