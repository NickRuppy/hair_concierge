import type {
  HeatEventAnswer,
  PersonalPlanRefinementAnswersV1,
  Stage2HeatEventSource,
  Stage2PathState,
  Stage2QuestionId,
  Stage2TriggerContext,
} from "./types"
import { isStage2ToolQuestionId, STAGE2_TOOL_OVERVIEW_QUESTION_ID } from "./types"
import { resolveStage2RefinementContract } from "./question-path"
import { requiresStage2HeatProtection } from "./heat-events"
import { Stage2RefinementError } from "./gateway"
import {
  TOOL_FORM_PAGES,
  toolFamiliesForSections,
  type ToolOverviewSectionKey,
} from "@/lib/personal-plan/tools/labels"
import { sortToolReportedForms, TOOL_FAMILIES } from "@/lib/personal-plan/tools/contracts"

export type Stage2RefinementHandoff = {
  refinedVersionId: string
  nextHref: "/plan-start"
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
  // INVARIANT: `status: "complete"` is only ever passed here to reconstruct an
  // already-persisted completion (a DB row, a fixture snapshot, or a test
  // fixture) -- the actual completion decision is made once, elsewhere
  // (`stage2-refinement-service.ts` `complete()` / `Stage2FixtureGateway.complete()`),
  // by checking `resolveStage2RefinementContract(...).isComplete` against the
  // contract in force AT THAT MOMENT, before `status` is ever set to
  // "complete". We deliberately do NOT re-derive completeness here against
  // today's contract: a later rollout toggle (or any other question-path
  // growth) can add newly required questions after a draft was validly
  // completed, and re-validating on every load would make a legitimately
  // finished draft throw `incomplete_refinement` the instant the path grows
  // underneath it -- collapsing an already-finished user journey to
  // "unavailable" (see C6). The stored `status` + `completedHandoff` are the
  // source of truth for "this draft is done"; we trust them instead.
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
  if (questionId === STAGE2_TOOL_OVERVIEW_QUESTION_ID) {
    // The UI answers in presentation sections; only family facts are persisted.
    const sections = (structuredClone(answer) ?? []) as ToolOverviewSectionKey[]
    const families = toolFamiliesForSections(sections)
    next.toolFamiliesWithSomething = TOOL_FAMILIES.filter((family) => families.includes(family))
    // Submitting the overview is a real answer about every family: the ones the
    // user did not tick are explicitly empty, not unknown.
    const forms = { ...next.toolForms }
    for (const family of TOOL_FAMILIES) {
      if (families.includes(family)) continue
      forms[family] = []
    }
    next.toolForms = forms
    return next
  }
  if (isStage2ToolQuestionId(questionId)) {
    const page = TOOL_FORM_PAGES.find((candidate) => `tools:${candidate.pageKey}` === questionId)
    if (page) {
      // The pages of one family share one array, and a page hands back its own
      // options plus everything it did not offer. Canonicalizing here is what
      // lets a page carry forms out of family order (the ratified Bürsten page
      // does) and lets an already-answered earlier page be edited afterwards.
      next.toolForms = {
        ...next.toolForms,
        [page.family]: sortToolReportedForms(
          page.family,
          (structuredClone(answer) ?? []) as string[],
        ),
      }
    }
    return next
  }
  if (questionId.startsWith("heat:")) {
    const source = questionId.slice("heat:".length) as Stage2HeatEventSource
    const submitted = (structuredClone(answer) ?? {}) as HeatEventAnswer
    // `R1`: the diffuser source no longer asks for heat protection, so a value
    // carried along from a legacy answer is dropped on write instead of being
    // re-persisted under a contract that forbids it.
    const { protectionConsistency, ...rest } = submitted
    next.heatEvents = {
      ...next.heatEvents,
      [questionId]: requiresStage2HeatProtection(source)
        ? { ...rest, protectionConsistency }
        : rest,
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
