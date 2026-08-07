import type {
  PersonalPlanRefinementAnswersV1,
  Stage2QuestionId,
  Stage2TriggerContext,
} from "./types"
import {
  Stage2RefinementError,
  type Stage2CompleteResult,
  type Stage2RefinementGateway,
  type Stage2SaveAnswerInput,
} from "./gateway"
import {
  cloneStage2RefinementSession,
  createStage2RefinementSession,
  saveStage2SessionAnswer,
  type Stage2RefinementHandoff,
  type Stage2RefinementSession,
} from "./session"
import { resolveStage2RefinementContract } from "./question-path"

export type Stage2FixtureRuntimeEnvironment = "development" | "test" | "production"

export type Stage2FixtureGatewayOptions = {
  runtimeEnvironment: Stage2FixtureRuntimeEnvironment
  triggerContext: Stage2TriggerContext
  pathVersion?: string
  initialAnswers?: PersonalPlanRefinementAnswersV1
  initialCompletedQuestionIds?: Stage2QuestionId[]
  initialRevision?: number
  initialStatus?: "in_progress" | "complete"
  failNextSave?: boolean
  failNextComplete?: boolean
}

export class Stage2FixtureGateway implements Stage2RefinementGateway {
  private session: Stage2RefinementSession
  private shouldFailNextSave: boolean
  private shouldFailNextComplete: boolean

  constructor(options: Stage2FixtureGatewayOptions) {
    if (options.runtimeEnvironment === "production" || process.env.NODE_ENV === "production") {
      throw new Error("The Stage 2 fixture gateway is unavailable in production")
    }
    const pathVersion = options.pathVersion ?? "stage2-fixture-v1"
    const revision = options.initialRevision ?? 0
    const completedHandoff =
      options.initialStatus === "complete" ? createFixtureHandoff(pathVersion, revision) : undefined
    this.session = createStage2RefinementSession({
      pathVersion,
      triggerContext: options.triggerContext,
      answers: options.initialAnswers,
      completedQuestionIds: options.initialCompletedQuestionIds,
      revision,
      status: options.initialStatus,
      completedHandoff,
    })
    this.shouldFailNextSave = options.failNextSave ?? false
    this.shouldFailNextComplete = options.failNextComplete ?? false
  }

  async load(): Promise<Stage2RefinementSession> {
    return cloneStage2RefinementSession(this.session)
  }

  async saveAnswer(input: Stage2SaveAnswerInput): Promise<Stage2RefinementSession> {
    if (this.shouldFailNextSave) {
      this.shouldFailNextSave = false
      throw new Stage2RefinementError("save_failed", "The fixture save failed")
    }
    this.assertRevision(input.expectedRevision)
    const nextSession = saveStage2SessionAnswer(this.session, input)
    this.session = cloneStage2RefinementSession(nextSession)
    return cloneStage2RefinementSession(nextSession)
  }

  async complete(input: { expectedRevision: number }): Promise<Stage2CompleteResult> {
    this.assertRevision(input.expectedRevision)
    const contract = resolveStage2RefinementContract({
      triggerContext: this.session.triggerContext,
      answers: this.session.answers,
      completedQuestionIds: this.session.completedQuestionIds,
    })
    if (!contract.isComplete) {
      throw new Stage2RefinementError("incomplete_refinement", "The refinement path is incomplete")
    }
    if (this.shouldFailNextComplete) {
      this.shouldFailNextComplete = false
      throw new Stage2RefinementError("completion_failed", "The fixture completion failed")
    }
    const completedHandoff =
      this.session.completedHandoff ??
      createFixtureHandoff(this.session.pathVersion, this.session.revision)
    this.session = {
      ...this.session,
      status: "complete",
      completedHandoff: structuredClone(completedHandoff),
    }
    return structuredClone(completedHandoff)
  }

  failNextSave(): void {
    this.shouldFailNextSave = true
  }

  failNextComplete(): void {
    this.shouldFailNextComplete = true
  }

  simulateExternalRevision(): Stage2RefinementSession {
    this.session = { ...this.session, revision: this.session.revision + 1 }
    return cloneStage2RefinementSession(this.session)
  }

  private assertRevision(expectedRevision: number): void {
    if (expectedRevision !== this.session.revision) {
      throw new Stage2RefinementError(
        "revision_conflict",
        "The fixture contains newer refinement progress",
      )
    }
  }
}

export function createStage2FixtureGateway(
  options: Stage2FixtureGatewayOptions,
): Stage2FixtureGateway {
  return new Stage2FixtureGateway(options)
}

function createFixtureHandoff(pathVersion: string, revision: number): Stage2RefinementHandoff {
  const safePathVersion = pathVersion.replace(/[^a-zA-Z0-9_-]/g, "-")
  return {
    refinedVersionId: `fixture-refined-${safePathVersion}-r${revision}`,
    nextHref: "/plan-start/produkte",
  }
}
