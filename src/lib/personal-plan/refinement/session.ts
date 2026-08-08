import type {
  HeatEventAnswer,
  PersonalPlanRefinementAnswersV1,
  Stage2PathState,
  Stage2QuestionId,
  Stage2TriggerContext,
} from "./types"
import { resolveStage2RefinementContract } from "./question-path"
import { Stage2RefinementError } from "./gateway"

export type Stage2RefinementHandoff = {
  refinedVersionId: string
  nextHref: "/plan-start/produkte"
}

export type Stage2RefinementSession = {
  schemaVersion: 1
  pathVersion: string
  revision: number
  status: "in_progress" | "complete" | "stale"
  triggerContext: Stage2TriggerContext
  answers: PersonalPlanRefinementAnswersV1
  completedQuestionIds: Stage2QuestionId[]
  path: Stage2PathState
  completedHandoff?: Stage2RefinementHandoff
}

export type CreateStage2RefinementSessionInput = {
  pathVersion: string
  triggerContext: Stage2TriggerContext
  answers?: PersonalPlanRefinementAnswersV1
  completedQuestionIds?: Stage2QuestionId[]
  revision?: number
  status?: "in_progress" | "complete" | "stale"
  completedHandoff?: Stage2RefinementHandoff
}

export function createStage2RefinementSession(
  input: CreateStage2RefinementSessionInput,
): Stage2RefinementSession {
  const contract = resolveStage2RefinementContract({
    triggerContext: structuredClone(input.triggerContext),
    answers: structuredClone(input.answers ?? {}),
    completedQuestionIds: [...(input.completedQuestionIds ?? [])],
  })
  const status = input.status ?? "in_progress"
  if (status === "complete" && !contract.isComplete) {
    throw new Stage2RefinementError(
      "incomplete_refinement",
      "A complete refinement session must have a complete canonical path",
    )
  }
  if (status === "complete" && !input.completedHandoff) {
    throw new Stage2RefinementError(
      "incomplete_refinement",
      "A complete refinement session must carry its completed handoff",
    )
  }
  if (status !== "complete" && input.completedHandoff) {
    throw new Stage2RefinementError(
      "incomplete_refinement",
      "An in-progress refinement session cannot carry a completed handoff",
    )
  }
  return {
    schemaVersion: 1,
    pathVersion: input.pathVersion,
    revision: input.revision ?? 0,
    status,
    triggerContext: structuredClone(input.triggerContext),
    answers: contract.answers,
    completedQuestionIds: contract.path.completedQuestionIds,
    path: contract.path,
    completedHandoff: input.completedHandoff ? structuredClone(input.completedHandoff) : undefined,
  }
}

export function saveStage2SessionAnswer(
  session: Stage2RefinementSession,
  input: { questionId: Stage2QuestionId; answer: unknown },
): Stage2RefinementSession {
  if (session.status === "stale") {
    throw new Stage2RefinementError("revision_conflict", "A stale refinement must be reloaded")
  }
  const canonical = resolveStage2RefinementContract({
    triggerContext: session.triggerContext,
    answers: session.answers,
    completedQuestionIds: session.completedQuestionIds,
  })
  const activeQuestionIds = new Set(canonical.path.orderedQuestionIds)
  const isCompletedActiveQuestion = canonical.path.completedQuestionIds.includes(input.questionId)
  if (
    !activeQuestionIds.has(input.questionId) ||
    (!isCompletedActiveQuestion && canonical.path.firstUnresolvedQuestionId !== input.questionId)
  ) {
    throw new Stage2RefinementError(
      "question_not_current",
      "The submitted question is not the current or an editable completed question",
    )
  }

  const candidateAnswers = replaceQuestionAnswer(canonical.answers, input.questionId, input.answer)
  const candidate = resolveStage2RefinementContract({
    triggerContext: session.triggerContext,
    answers: candidateAnswers,
    completedQuestionIds: [...canonical.path.completedQuestionIds, input.questionId],
  })
  if (!candidate.path.completedQuestionIds.includes(input.questionId)) {
    throw new Stage2RefinementError("invalid_answer", "The submitted answer is invalid")
  }

  return {
    schemaVersion: 1,
    pathVersion: session.pathVersion,
    revision: session.revision + 1,
    status: "in_progress",
    triggerContext: structuredClone(session.triggerContext),
    answers: candidate.answers,
    completedQuestionIds: candidate.path.completedQuestionIds,
    path: candidate.path,
  }
}

export function cloneStage2RefinementSession(
  session: Stage2RefinementSession,
): Stage2RefinementSession {
  return structuredClone(session)
}

function replaceQuestionAnswer(
  answers: PersonalPlanRefinementAnswersV1,
  questionId: Stage2QuestionId,
  answer: unknown,
): PersonalPlanRefinementAnswersV1 {
  const next = structuredClone(answers)
  if (questionId.startsWith("heat:")) {
    next.heatEvents = {
      ...next.heatEvents,
      [questionId]: structuredClone(answer) as HeatEventAnswer,
    }
    return next
  }

  switch (questionId) {
    case "current_product_categories":
      next.currentProductCategories = structuredClone(
        answer,
      ) as PersonalPlanRefinementAnswersV1["currentProductCategories"]
      break
    case "wet_wash_frequency":
      next.wetWashFrequency = answer as PersonalPlanRefinementAnswersV1["wetWashFrequency"]
      break
    case "scalp_irritation_detail":
      next.scalpIrritationDetail =
        answer as PersonalPlanRefinementAnswersV1["scalpIrritationDetail"]
      break
    case "dry_shampoo_bridge_preference":
      next.dryShampooBridgePreference =
        answer as PersonalPlanRefinementAnswersV1["dryShampooBridgePreference"]
      break
    case "dry_shampoo_visible_hair_color":
      next.dryShampooVisibleHairColor =
        answer as PersonalPlanRefinementAnswersV1["dryShampooVisibleHairColor"]
      break
    case "oil_purposes":
      next.oilPurposes = structuredClone(answer) as PersonalPlanRefinementAnswersV1["oilPurposes"]
      break
    case "towel_handling":
      next.towel = structuredClone(answer) as PersonalPlanRefinementAnswersV1["towel"]
      break
    case "drying_routes":
      next.dryingRoutes = structuredClone(answer) as PersonalPlanRefinementAnswersV1["dryingRoutes"]
      break
    case "additional_heat_tools":
      next.additionalHeatTools = structuredClone(
        answer,
      ) as PersonalPlanRefinementAnswersV1["additionalHeatTools"]
      break
    case "night_protection":
      next.nightProtection = structuredClone(
        answer,
      ) as PersonalPlanRefinementAnswersV1["nightProtection"]
      break
  }
  return next
}
