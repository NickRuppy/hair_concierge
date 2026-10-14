import type {
  HeatEventAnswer,
  NightWear,
  PersonalPlanRefinementAnswersV1,
  Stage2PathState,
  Stage2QuestionId,
  Stage2TriggerContext,
} from "./types"
import { getStage2QuestionModule, resolveStage2RefinementContract } from "./question-path"
import { Stage2RefinementError } from "./gateway"
import {
  sortToolReportedForms,
  type ToolFamily,
  type ToolReportedForm,
} from "@/lib/personal-plan/tools/contracts"
import { nightWearFromNightProtection } from "@/lib/personal-plan/tools/facts"
import {
  TOOL_FORM_PAGES,
  TOOL_OVERVIEW_FAMILY_ORDER,
  toolFamiliesForSections,
  toolFormPage,
  type ToolOverviewSectionKey,
} from "@/lib/personal-plan/tools/labels"
import type { CareHabitsV1, FieldProvenanceValue } from "@/lib/user-facts/schema"
import type { BrushType } from "@/lib/vocabulary/onboarding-care"

export type Stage2RefinementHandoff = {
  refinedVersionId: string
  nextHref: "/plan-start"
}

/**
 * Read-only pre-fill context (Hair Tools port, Task 8 fix round 3): the member's care facts the
 * Tool pages pre-tick from but the Stage-2 answers do not carry — the legacy brush answer and
 * (Rev. 6) the stored night technique. Set by the server only while the Tools rollout is on and only from a confirmed fact
 * (`user`, or non-empty `unknown_historical`). Never part of the answers, never persisted, never
 * read by the path, the resolver or a save; it only changes UI starting values.
 */
export type Stage2PrefillCare = {
  brushesCombs?: BrushType[]
  /**
   * Rev. 6: the night technique of a confirmed stored `nightProtection` (`pineapple` /
   * `loose_tied`), the starting value of „Wie trägst du dein Haar nachts?". The question still
   * shows (pre-filled); one tap on „Weiter" keeps it.
   */
  nightWear?: Exclude<NightWear, "open">
}

/** The confirmed legacy care facts for `Stage2PrefillCare`, or `undefined` when there are none. */
export function stage2PrefillCareFromFacts(
  careHabits: Partial<CareHabitsV1> | null | undefined,
  fields: Record<string, FieldProvenanceValue> | undefined,
): Stage2PrefillCare | undefined {
  const confirmed = (field: string) =>
    fields?.[field] === "user" || fields?.[field] === "unknown_historical"
  const prefill: Stage2PrefillCare = {}
  const brushes = careHabits?.brushesCombs
  if (brushes && brushes.length > 0 && confirmed("brushesCombs")) {
    prefill.brushesCombs = [...brushes]
  }
  const nightWear = nightWearFromNightProtection(careHabits?.nightProtection)
  if (nightWear && confirmed("nightProtection")) prefill.nightWear = nightWear
  return Object.keys(prefill).length > 0 ? prefill : undefined
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
  /** Read-only UI pre-fill context; see `Stage2PrefillCare`. */
  prefillCare?: Stage2PrefillCare
}

export type CreateStage2RefinementSessionInput = {
  pathVersion: string
  triggerContext: Stage2TriggerContext
  answers?: PersonalPlanRefinementAnswersV1
  completedQuestionIds?: Stage2QuestionId[]
  revision?: number
  status?: "in_progress" | "complete" | "stale"
  completedHandoff?: Stage2RefinementHandoff
  prefillCare?: Stage2PrefillCare
  /**
   * Only for rows read back from persistence. A draft completed under an older path can
   * have a path that GREW since (a new question joined it): the stored row stays `complete`
   * with its handoff, and its first unresolved question is asked on the next visit, whose
   * first save reopens the draft. Fixtures and newly created sessions keep the strict
   * "complete requires a complete canonical path" rule.
   */
  tolerateGrownPath?: boolean
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
  if (status === "complete" && !contract.isComplete && !input.tolerateGrownPath) {
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
    ...(input.prefillCare ? { prefillCare: structuredClone(input.prefillCare) } : {}),
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
    (!isCompletedActiveQuestion &&
      firstUnresolvedQuestionOfModule(canonical.path, input.questionId) !== input.questionId)
  ) {
    throw new Stage2RefinementError(
      "question_not_current",
      "The submitted question is not the current or an editable completed question",
    )
  }

  // D2: the hair dries somehow, so with the tools rollout on a NEW drying answer names at least
  // one route. Path validity still accepts a stored `[]` — nobody who answered it is re-asked.
  if (
    input.questionId === "drying_routes" &&
    session.triggerContext.toolsEnabled === true &&
    Array.isArray(input.answer) &&
    input.answer.length === 0
  ) {
    throw new Stage2RefinementError("invalid_answer", "The submitted answer is invalid")
  }

  // A rollout-off member still answers the Diffusor's protection question (the path reads a
  // stored Diffusor event without it as answered under the rule, so only a new save is checked).
  if (
    input.questionId === "heat:diffuser_airflow_shaping" &&
    session.triggerContext.toolsEnabled !== true &&
    (typeof input.answer !== "object" ||
      input.answer === null ||
      (input.answer as { protectionConsistency?: unknown }).protectionConsistency === undefined)
  ) {
    throw new Stage2RefinementError("invalid_answer", "The submitted answer is invalid")
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
    // The pre-fill context outlives the local save; it is not an answer.
    ...(session.prefillCare ? { prefillCare: structuredClone(session.prefillCare) } : {}),
  }
}

/**
 * The current question within the submitted question's own module. A module entry walks only its
 * module (`module-scope.ts`), so its next question is current even while an earlier module —
 * Deine Tools for a member who finished Gewohnheiten before it existed — is still open (review
 * fix F2). The contract keeps completed answers behind an unresolved question, and order inside
 * a module is unchanged. The whole path's first unresolved question is always one of these.
 */
function firstUnresolvedQuestionOfModule(
  path: Stage2PathState,
  questionId: Stage2QuestionId,
): Stage2QuestionId | undefined {
  const questionModule = getStage2QuestionModule(questionId)
  return path.orderedQuestionIds.find(
    (candidate) =>
      getStage2QuestionModule(candidate) === questionModule &&
      !path.completedQuestionIds.includes(candidate),
  )
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
  if (questionId === "tools_overview") {
    // The UI answers in presentation sections; the families behind them are what is stored,
    // in wash-day order. Submitting the overview is a real answer about every family: each
    // page of an unticked family becomes an explicit none (`D3a`); ticked families keep their
    // pages (answered or still open).
    const families = new Set<ToolFamily>(
      toolFamiliesForSections((structuredClone(answer) ?? []) as ToolOverviewSectionKey[]),
    )
    next.toolFamiliesWithSomething = TOOL_OVERVIEW_FAMILY_ORDER.filter((family) =>
      families.has(family),
    )
    const toolForms = { ...next.toolForms }
    for (const page of TOOL_FORM_PAGES) {
      if (!families.has(page.family)) toolForms[page.pageKey] = []
    }
    next.toolForms = toolForms
    return next
  }
  if (questionId.startsWith("tools:")) {
    // One page writes only its own answer, sorted into the family's canonical order.
    const page = toolFormPage(questionId.slice("tools:".length))
    if (page) {
      // A value outside the family is kept as submitted, so validation rejects the answer
      // instead of silently turning it into „Nichts davon".
      const submitted = structuredClone(answer)
      const sorted = Array.isArray(submitted)
        ? sortToolReportedForms(page.family, submitted as string[])
        : null
      next.toolForms = {
        ...next.toolForms,
        [page.pageKey]: (sorted && sorted.length === new Set(submitted as string[]).size
          ? sorted
          : submitted) as ToolReportedForm[],
      }
    }
    return next
  }
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
    case "bondbuilder_timing":
      next.bondbuilderTiming = answer as PersonalPlanRefinementAnswersV1["bondbuilderTiming"]
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
    case "night_wear":
      next.nightWear = answer as PersonalPlanRefinementAnswersV1["nightWear"]
      break
  }
  return next
}
