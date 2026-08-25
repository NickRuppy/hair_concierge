import type {
  AdditionalHeatTool,
  DryingRoute,
  DryShampooBridgePreference,
  DryShampooVisibleHairColor,
  HeatProtectionConsistency,
  NightProtection,
  OilPurpose,
  PersonalPlanRefinementAnswersV1,
  ProductFrequency,
  ScalpIrritationDetail,
  Stage2AnswerKey,
  Stage2HeatEventSource,
  Stage2HeatEventQuestionId,
  Stage2PathState,
  Stage2QuestionId,
  Stage2TriggerContext,
  TowelMaterial,
  TowelTechnique,
} from "./types"
import {
  ADDITIONAL_HEAT_TOOLS,
  DRY_SHAMPOO_BRIDGE_PREFERENCES,
  DRY_SHAMPOO_VISIBLE_HAIR_COLORS,
  DRYING_ROUTES,
  HEAT_PROTECTION_CONSISTENCIES,
  OIL_PURPOSES,
  SCALP_IRRITATION_DETAILS,
  STAGE2_PRODUCT_CATEGORIES,
} from "./types"
import {
  NIGHT_PROTECTIONS,
  TOWEL_MATERIALS,
  TOWEL_TECHNIQUES,
} from "@/lib/vocabulary/onboarding-care"
import { PRODUCT_FREQUENCIES } from "@/lib/vocabulary/frequencies"
import {
  createStage2HeatEventId,
  getSelectedStage2HeatEventSources,
  ignoresStoredStage2HeatProtection,
  requiresStage2HeatProtection,
} from "./heat-events"
import {
  TOOL_FAMILIES,
  TOOL_REPORTED_FORMS_BY_FAMILY,
  type ToolFamily,
  type ToolReportedForm,
} from "@/lib/personal-plan/tools/contracts"
import { TOOL_FORM_PAGES, toolFormPagesForFamilies } from "@/lib/personal-plan/tools/labels"
import { STAGE2_TOOL_OVERVIEW_QUESTION_ID, isStage2ToolQuestionId } from "./types"

const BASE_QUESTION_IDS: Stage2QuestionId[] = ["current_product_categories", "wet_wash_frequency"]
const END_QUESTION_IDS: Stage2QuestionId[] = [
  "towel_handling",
  "drying_routes",
  "additional_heat_tools",
  "night_protection",
]

type PathInput = {
  triggerContext: Stage2TriggerContext
  answers: PersonalPlanRefinementAnswersV1
  completedQuestionIds: readonly Stage2QuestionId[]
}

export type Stage2PrunedAnswers = {
  answers: PersonalPlanRefinementAnswersV1
  completedQuestionIds: Stage2QuestionId[]
  prunedAnswerKeys: Stage2AnswerKey[]
}

export type Stage2RefinementContract = Stage2PrunedAnswers & {
  path: Stage2PathState
  validationErrors: string[]
  isComplete: boolean
}

export function pruneStage2Answers(input: PathInput): Stage2PrunedAnswers {
  const answers = {
    ...input.answers,
    heatEvents: input.answers.heatEvents ? { ...input.answers.heatEvents } : undefined,
  }
  const prunedAnswerKeys: Stage2AnswerKey[] = []
  const remove = (key: Stage2AnswerKey) => {
    if (answers[key] !== undefined) {
      delete answers[key]
      prunedAnswerKeys.push(key)
    }
  }
  const categories = answers.currentProductCategories ?? []
  const usesDryShampoo = categories.includes("dry_shampoo")

  if (!input.triggerContext.hasReportedIrritatedScalp) remove("scalpIrritationDetail")
  if (!categories.includes("oil")) remove("oilPurposes")

  if (usesDryShampoo) {
    remove("dryShampooBridgePreference")
  } else if (input.triggerContext.dryShampooBridgeEligibility !== "eligible") {
    remove("dryShampooBridgePreference")
    remove("dryShampooVisibleHairColor")
  } else if (answers.dryShampooBridgePreference !== "accept") {
    remove("dryShampooVisibleHairColor")
  }

  if (
    answers.towel &&
    (!answers.towel.material || answers.towel.material === "no_towel") &&
    answers.towel.technique !== undefined
  ) {
    answers.towel = { material: answers.towel.material }
    prunedAnswerKeys.push("towel")
  }

  const selectedEventIds = new Set<Stage2HeatEventQuestionId>(
    getSelectedStage2HeatEventSources(answers).map(createStage2HeatEventId),
  )
  if (answers.heatEvents) {
    const remainingEvents = Object.fromEntries(
      Object.entries(answers.heatEvents).filter(([id]) =>
        selectedEventIds.has(id as Stage2HeatEventQuestionId),
      ),
    )
    if (Object.keys(remainingEvents).length !== Object.keys(answers.heatEvents).length) {
      answers.heatEvents = remainingEvents
      prunedAnswerKeys.push("heatEvents")
    }
  }

  if (input.triggerContext.toolsEnabled !== true) {
    // Rollout-off must be non-destructive: hide the Tool trip, never delete what
    // the user already reported. Deleting here would let a rollback erase
    // additive ownership facts on the next ordinary answer save, because the
    // pruned answer object is what gets written back.
  } else if (answers.toolFamiliesWithSomething) {
    // Forms are retained for families the user said they own something in, plus
    // the explicit `[]` entries the overview materialized for the rest.
    const activeFamilies = new Set<ToolFamily>(answers.toolFamiliesWithSomething)
    if (answers.toolForms) {
      const retained = Object.fromEntries(
        Object.entries(answers.toolForms).filter(
          ([family, forms]) =>
            activeFamilies.has(family as ToolFamily) || (forms?.length ?? 0) === 0,
        ),
      ) as PersonalPlanRefinementAnswersV1["toolForms"]
      if (Object.keys(retained ?? {}).length !== Object.keys(answers.toolForms).length) {
        answers.toolForms = retained
        prunedAnswerKeys.push("toolForms")
      }
    }
  }

  const orderedQuestionIds = getOrderedQuestionIds(input.triggerContext, answers)
  const activeQuestionIds = new Set<Stage2QuestionId>(orderedQuestionIds)
  const completedQuestionIds = input.completedQuestionIds.filter((id) => activeQuestionIds.has(id))
  return { answers, completedQuestionIds, prunedAnswerKeys }
}

export function getOrderedQuestionIds(
  triggerContext: Stage2TriggerContext,
  answers: PersonalPlanRefinementAnswersV1,
): Stage2QuestionId[] {
  const categories = answers.currentProductCategories ?? []
  const usesDryShampoo = categories.includes("dry_shampoo")
  const ids = [...BASE_QUESTION_IDS]
  if (triggerContext.hasReportedIrritatedScalp) ids.push("scalp_irritation_detail")
  if (usesDryShampoo) {
    ids.push("dry_shampoo_visible_hair_color")
  } else if (triggerContext.dryShampooBridgeEligibility === "eligible") {
    ids.push("dry_shampoo_bridge_preference")
    if (answers.dryShampooBridgePreference === "accept") ids.push("dry_shampoo_visible_hair_color")
  }
  if (categories.includes("oil")) ids.push("oil_purposes")
  ids.push(...END_QUESTION_IDS.slice(0, 3))
  ids.push(...getSelectedStage2HeatEventSources(answers).map(createStage2HeatEventId))
  ids.push(...END_QUESTION_IDS.slice(3))
  ids.push(...getToolQuestionIds(triggerContext, answers))
  return ids
}

/**
 * The visual Tool trip: one four-section overview, then short product-form pages
 * for the selected sections only. Absent while the rollout is off, so the
 * released Feinschliff path is byte-identical.
 */
export function getToolQuestionIds(
  triggerContext: Stage2TriggerContext,
  answers: PersonalPlanRefinementAnswersV1,
): Stage2QuestionId[] {
  if (triggerContext.toolsEnabled !== true) return []
  const ids: Stage2QuestionId[] = [STAGE2_TOOL_OVERVIEW_QUESTION_ID]
  const families = answers.toolFamiliesWithSomething
  if (!families) return ids
  // Pages follow the persisted family facts, so the path is stable: answering a
  // page never makes it disappear.
  for (const page of toolFormPagesForFamilies(families)) {
    ids.push(`tools:${page.pageKey}` as Stage2QuestionId)
  }
  return ids
}

const TOOL_FORM_PAGE_BY_QUESTION_ID = new Map(
  TOOL_FORM_PAGES.map((page) => [`tools:${page.pageKey}`, page] as const),
)

export function resolveStage2Path(input: PathInput): Stage2PathState {
  return resolveStage2RefinementContract(input).path
}

/** The sole canonical server/gateway transition input: prune, validate, then derive the path. */
export function resolveStage2RefinementContract(input: PathInput): Stage2RefinementContract {
  const pruned = pruneStage2Answers(input)
  const orderedQuestionIds = getOrderedQuestionIds(input.triggerContext, pruned.answers)
  const completedQuestionIds = orderedQuestionIds.filter(
    (id) => pruned.completedQuestionIds.includes(id) && isQuestionAnswerValid(id, pruned.answers),
  )
  const firstUnresolvedQuestionId =
    orderedQuestionIds.find((id) => !completedQuestionIds.includes(id)) ?? null
  // The Tool overview itself is never required: direct acceptance must be able to
  // finish a Stage-2 draft while every Tool answer stays `unknown` rather than
  // being coerced into an explicit none.
  //
  // But once the overview HAS been submitted, the product-form pages it opened
  // are required. Without that, an API caller could complete a draft whose Tool
  // trip is half answered, freezing a partially answered trip into an immutable
  // refined version.
  const overviewSubmitted = pruned.answers.toolFamiliesWithSomething !== undefined
  const requiredQuestionIds = orderedQuestionIds.filter(
    (id) =>
      !isStage2ToolQuestionId(id) || (overviewSubmitted && id !== STAGE2_TOOL_OVERVIEW_QUESTION_ID),
  )
  const path: Stage2PathState = {
    orderedQuestionIds,
    requiredQuestionIds,
    completedQuestionIds,
    firstUnresolvedQuestionId,
    prunedAnswerKeys: pruned.prunedAnswerKeys,
  }
  const validationErrors = orderedQuestionIds.flatMap((questionId) =>
    isQuestionAnswerValid(questionId, pruned.answers)
      ? []
      : [`${questionId} is invalid or incomplete`],
  )
  return {
    ...pruned,
    completedQuestionIds,
    path,
    validationErrors,
    isComplete: requiredQuestionIds.every((id) => completedQuestionIds.includes(id)),
  }
}

export function validateStage2Answers(input: PathInput): string[] {
  return resolveStage2RefinementContract(input).validationErrors
}

export function getEffectiveDryShampooBridgePreference(
  answers: PersonalPlanRefinementAnswersV1,
): DryShampooBridgePreference | undefined {
  return answers.currentProductCategories?.includes("dry_shampoo")
    ? "accept"
    : answers.dryShampooBridgePreference
}

function isOneOf<T extends string>(value: unknown, values: readonly T[]): value is T {
  return typeof value === "string" && values.includes(value as T)
}

function isOrderedKnownArray<T extends string>(
  value: unknown,
  values: readonly T[],
  requireValue = false,
): value is T[] {
  if (!Array.isArray(value) || (requireValue && value.length === 0)) return false
  const selected = new Set(value)
  return (
    value.length === selected.size &&
    value.every((item) => isOneOf(item, values)) &&
    value.every(
      (item, index) => index === 0 || values.indexOf(value[index - 1]) < values.indexOf(item),
    )
  )
}

function isQuestionAnswerValid(
  questionId: Stage2QuestionId,
  answers: PersonalPlanRefinementAnswersV1,
): boolean {
  if (questionId.startsWith("heat:")) return isHeatEventAnswerValid(questionId, answers)
  if (questionId === STAGE2_TOOL_OVERVIEW_QUESTION_ID) {
    return isOrderedKnownArray<ToolFamily>(answers.toolFamiliesWithSomething, TOOL_FAMILIES)
  }
  if (isStage2ToolQuestionId(questionId)) {
    const page = TOOL_FORM_PAGE_BY_QUESTION_ID.get(questionId)
    if (!page) return false
    const reported = answers.toolForms?.[page.family]
    // The family's answer may carry its answer-only tokens („Nur Finger",
    // `D9b`) beside its real forms, in the one canonical order.
    return isOrderedKnownArray<ToolReportedForm>(
      reported,
      TOOL_REPORTED_FORMS_BY_FAMILY[page.family],
    )
  }
  switch (questionId) {
    case "current_product_categories":
      return isOrderedKnownArray(answers.currentProductCategories, STAGE2_PRODUCT_CATEGORIES)
    case "wet_wash_frequency":
      return (
        answers.wetWashFrequency === "does_not_wash" ||
        isOneOf(answers.wetWashFrequency, PRODUCT_FREQUENCIES)
      )
    case "scalp_irritation_detail":
      return isOneOf<ScalpIrritationDetail>(answers.scalpIrritationDetail, SCALP_IRRITATION_DETAILS)
    case "dry_shampoo_bridge_preference":
      return isOneOf<DryShampooBridgePreference>(
        answers.dryShampooBridgePreference,
        DRY_SHAMPOO_BRIDGE_PREFERENCES,
      )
    case "dry_shampoo_visible_hair_color":
      return isOneOf<DryShampooVisibleHairColor>(
        answers.dryShampooVisibleHairColor,
        DRY_SHAMPOO_VISIBLE_HAIR_COLORS,
      )
    case "oil_purposes":
      return isOrderedKnownArray<OilPurpose>(answers.oilPurposes, OIL_PURPOSES, true)
    case "towel_handling":
      return isTowelHandlingValid(answers)
    case "drying_routes":
      // `D2` (ruled 2026-08-24, path version 2): „Nichts davon" is gone and at
      // least one route is required — an empty set never described a real head
      // of hair, and the engine already reads a legacy `[]` as unanswered. A row
      // completed under path version 1 stays complete: completion is trusted
      // from the stored status, never re-derived (`D8`).
      return isOrderedKnownArray<DryingRoute>(answers.dryingRoutes, DRYING_ROUTES, true)
    case "additional_heat_tools":
      return isOrderedKnownArray<AdditionalHeatTool>(
        answers.additionalHeatTools,
        ADDITIONAL_HEAT_TOOLS,
      )
    case "night_protection":
      return isOrderedKnownArray<NightProtection>(answers.nightProtection, NIGHT_PROTECTIONS)
  }
  return false
}

function isTowelHandlingValid(answers: PersonalPlanRefinementAnswersV1): boolean {
  const towel = answers.towel
  if (!towel || !isOneOf<TowelMaterial>(towel.material, TOWEL_MATERIALS)) return false
  return towel.material === "no_towel"
    ? towel.technique === undefined
    : isOneOf<TowelTechnique>(towel.technique, TOWEL_TECHNIQUES)
}

function isHeatEventAnswerValid(
  questionId: Stage2QuestionId,
  answers: PersonalPlanRefinementAnswersV1,
): boolean {
  const source = questionId.slice("heat:".length) as Stage2HeatEventSource
  const event = answers.heatEvents?.[questionId]
  if (!event || !isOneOf<ProductFrequency>(event.frequency, PRODUCT_FREQUENCIES)) return false
  if (requiresStage2HeatProtection(source)) {
    return isOneOf<HeatProtectionConsistency>(
      event.protectionConsistency,
      HEAT_PROTECTION_CONSISTENCIES,
    )
  }
  // `R1` + `D8`: a row written while the diffuser question still existed keeps
  // its stored value. It is ignored, never a reason to re-open the question.
  return ignoresStoredStage2HeatProtection(source) || event.protectionConsistency === undefined
}
