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
  Stage2Module,
  Stage2ModulePathState,
  Stage2PathState,
  Stage2QuestionId,
  Stage2StaticQuestionId,
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
  STAGE2_MODULES,
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
  stage2HeatRuleOptions,
} from "./heat-events"
import type { ToolFamily } from "@/lib/personal-plan/tools/contracts"
import {
  careFactsFromToolInventory,
  dryingRouteOptionsFromToolInventory,
  isToolOverviewAnswerValid,
  isToolPageAnswerValid,
  resolvedToolInventory,
  type ToolDerivedCareFacts,
} from "@/lib/personal-plan/tools/facts"
import {
  isToolFormPageKey,
  toolFormPage,
  toolFormPagesForFamilies,
  type ToolFormPageKey,
} from "@/lib/personal-plan/tools/labels"

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

  if (input.triggerContext.toolsEnabled === true) {
    if (normalizeToolForms(answers)) prunedAnswerKeys.push("toolForms")
    applyDerivedToolCareFacts(answers)
  }
  // Rollout off is non-destructive: tool answers are hidden from the path, never deleted, so a
  // rollback cannot erase reported ownership on the next ordinary save.

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
  if (triggerContext.toolsEnabled === true) {
    // Rev. 5: Deine Tools before Gewohnheiten, and the things are asked once — in the tools.
    // Further heat tools and night protection are derived from the pages, so their
    // Gewohnheiten questions leave the path; the towel question keeps the technique.
    ids.push(...getToolQuestionIds(triggerContext, answers))
    // „Kein Handtuch" derived from the textiles page leaves nothing to ask about the towel.
    if (getStage2ToolDerivedCareFacts(triggerContext, answers)?.towelMaterial !== "no_towel") {
      ids.push("towel_handling")
    }
    ids.push("drying_routes")
    ids.push(...getSelectedStage2HeatEventSources(answers).map(createStage2HeatEventId))
    return ids
  }
  ids.push(...END_QUESTION_IDS.slice(0, 3))
  ids.push(...getSelectedStage2HeatEventSources(answers).map(createStage2HeatEventId))
  ids.push(...END_QUESTION_IDS.slice(3))
  return ids
}

/**
 * The tools block: the overview, then — once it is answered — one page per page key of every
 * ticked family, in wash-day order. Empty while the rollout is off.
 */
export function getToolQuestionIds(
  triggerContext: Stage2TriggerContext,
  answers: PersonalPlanRefinementAnswersV1,
): Stage2QuestionId[] {
  if (triggerContext.toolsEnabled !== true) return []
  const ids: Stage2QuestionId[] = ["tools_overview"]
  if (!isToolOverviewAnswerValid(answers.toolFamiliesWithSomething)) return ids
  for (const page of toolFormPagesForFamilies(answers.toolFamiliesWithSomething)) {
    ids.push(`tools:${page.pageKey}`)
  }
  return ids
}

/**
 * The care facts the settled tool pages derive (`careFactsFromToolInventory`), or `null` while
 * the rollout is off. A key is present only once its source pages are settled.
 */
export function getStage2ToolDerivedCareFacts(
  triggerContext: Stage2TriggerContext,
  answers: PersonalPlanRefinementAnswersV1,
): ToolDerivedCareFacts | null {
  if (triggerContext.toolsEnabled !== true) return null
  return careFactsFromToolInventory(resolvedToolInventory(answers))
}

/**
 * The drying routes the Gewohnheiten page offers: with the rollout on and the airflow page
 * settled, `air_dry` plus the routes the owned airflow forms back; otherwise every route.
 * The UI renders exactly these options; a stored answer outside them is incomplete.
 */
export function getStage2DryingRouteOptions(
  triggerContext: Stage2TriggerContext,
  answers: PersonalPlanRefinementAnswersV1,
): readonly DryingRoute[] {
  if (triggerContext.toolsEnabled !== true) return DRYING_ROUTES
  return dryingRouteOptionsFromToolInventory(resolvedToolInventory(answers)) ?? DRYING_ROUTES
}

/**
 * Whether the towel material comes from the textiles page, so the towel question asks only
 * the technique (and leaves the path entirely for a derived „kein Handtuch"). False while the
 * rollout is off or the textiles family is not settled yet.
 */
export function isStage2TowelMaterialDerived(
  triggerContext: Stage2TriggerContext,
  answers: PersonalPlanRefinementAnswersV1,
): boolean {
  return getStage2ToolDerivedCareFacts(triggerContext, answers)?.towelMaterial !== undefined
}

/**
 * Per-page normalization (rollout on): keys that are not a page are dropped (the August drafts
 * stored one array per family), and once the overview is answered every page of an unticked
 * family holds the explicit none it stands for. Mutates `answers`; reports whether it changed.
 */
function normalizeToolForms(answers: PersonalPlanRefinementAnswersV1): boolean {
  if (!answers.toolForms) return false
  const ticked = isToolOverviewAnswerValid(answers.toolFamiliesWithSomething)
    ? new Set<ToolFamily>(answers.toolFamiliesWithSomething)
    : null
  let changed = false
  const next: Partial<Record<ToolFormPageKey, (typeof answers.toolForms)[ToolFormPageKey]>> = {}
  for (const [key, forms] of Object.entries(answers.toolForms)) {
    if (!isToolFormPageKey(key)) {
      changed = true
      continue
    }
    const page = toolFormPage(key)
    if (ticked && page && !ticked.has(page.family) && (forms?.length ?? 0) > 0) {
      next[key] = []
      changed = true
      continue
    }
    next[key] = forms
  }
  if (changed) answers.toolForms = next
  return changed
}

/**
 * Writes the derived thing-fields into the answers (rollout on), so heat events, validation,
 * the plan and the facts write all read one value. Before its source pages are settled a
 * field keeps whatever the member answered earlier.
 */
function applyDerivedToolCareFacts(answers: PersonalPlanRefinementAnswersV1): void {
  const derived = careFactsFromToolInventory(resolvedToolInventory(answers))
  if (derived.additionalHeatTools) answers.additionalHeatTools = derived.additionalHeatTools
  if (derived.nightProtection) answers.nightProtection = derived.nightProtection
  if (derived.towelMaterial) {
    const technique = answers.towel?.technique
    answers.towel = {
      material: derived.towelMaterial,
      ...(technique !== undefined ? { technique } : {}),
    }
  }
}

/**
 * Total mapping from every canonical Stage 2 question id to its module. Source of truth for the
 * split: section A ("Was du heute benutzt") = products, section B ("Wie du dein Haar behandelst")
 * = habits. Derived heat-event questions (`heat:<source>`) belong to habits; the tool questions
 * (`tools_overview`, `tools:<pageKey>`) belong to tools. Fixed model — no abstraction for
 * hypothetical further modules.
 */
const STAGE2_QUESTION_MODULE_BY_ID: Record<Stage2StaticQuestionId, Stage2Module> = {
  current_product_categories: "products",
  wet_wash_frequency: "products",
  scalp_irritation_detail: "products",
  dry_shampoo_bridge_preference: "products",
  dry_shampoo_visible_hair_color: "products",
  oil_purposes: "products",
  towel_handling: "habits",
  drying_routes: "habits",
  additional_heat_tools: "habits",
  night_protection: "habits",
}

export function getStage2QuestionModule(questionId: Stage2QuestionId): Stage2Module {
  if (questionId.startsWith("heat:")) return "habits"
  if (questionId === "tools_overview" || questionId.startsWith("tools:")) return "tools"
  const questionModule = STAGE2_QUESTION_MODULE_BY_ID[questionId as Stage2StaticQuestionId]
  if (!questionModule) throw new Error(`Unmapped Stage 2 refinement question id: ${questionId}`)
  return questionModule
}

/**
 * Given the current dynamic ordered path and completed question ids, groups them per module:
 * its question ids (in path order), which are completed vs open, and a module status (`open`
 * when it has at least one unanswered question on the current path, `complete` once all its
 * current-path questions are answered, `not_applicable` when it has no question on the path at
 * all). Pure/deterministic — no I/O.
 */
export function getStage2ModulePathStates(
  orderedQuestionIds: readonly Stage2QuestionId[],
  completedQuestionIds: readonly Stage2QuestionId[],
): Record<Stage2Module, Stage2ModulePathState> {
  const completed = new Set(completedQuestionIds)
  const emptyModuleState = (): Stage2ModulePathState => ({
    questionIds: [],
    completedQuestionIds: [],
    openQuestionIds: [],
    status: "not_applicable",
  })
  const states: Record<Stage2Module, Stage2ModulePathState> = {
    products: emptyModuleState(),
    tools: emptyModuleState(),
    habits: emptyModuleState(),
  }

  for (const questionId of orderedQuestionIds) {
    const state = states[getStage2QuestionModule(questionId)]
    state.questionIds.push(questionId)
    ;(completed.has(questionId) ? state.completedQuestionIds : state.openQuestionIds).push(
      questionId,
    )
  }
  for (const stage2Module of STAGE2_MODULES) {
    const state = states[stage2Module]
    state.status =
      state.questionIds.length === 0
        ? "not_applicable"
        : state.openQuestionIds.length > 0
          ? "open"
          : "complete"
  }
  return states
}

/**
 * The closing check: every module is either answered (`complete`) or has nothing to ask
 * (`not_applicable`). Only then does a module completion close the draft.
 */
export function areAllStage2ModulesSettled(
  states: Record<Stage2Module, Stage2ModulePathState>,
): boolean {
  return STAGE2_MODULES.every(
    (stage2Module) =>
      states[stage2Module].status === "complete" ||
      states[stage2Module].status === "not_applicable",
  )
}

export function resolveStage2Path(input: PathInput): Stage2PathState {
  return resolveStage2RefinementContract(input).path
}

/** The sole canonical server/gateway transition input: prune, validate, then derive the path. */
export function resolveStage2RefinementContract(input: PathInput): Stage2RefinementContract {
  const pruned = pruneStage2Answers(input)
  const orderedQuestionIds = getOrderedQuestionIds(input.triggerContext, pruned.answers)
  const completedQuestionIds = orderedQuestionIds.filter(
    (id) =>
      pruned.completedQuestionIds.includes(id) &&
      isStage2QuestionAnswerValid(id, pruned.answers, input.triggerContext),
  )
  const firstUnresolvedQuestionId =
    orderedQuestionIds.find((id) => !completedQuestionIds.includes(id)) ?? null
  const path: Stage2PathState = {
    orderedQuestionIds,
    requiredQuestionIds: orderedQuestionIds,
    completedQuestionIds,
    firstUnresolvedQuestionId,
    prunedAnswerKeys: pruned.prunedAnswerKeys,
  }
  const validationErrors = orderedQuestionIds.flatMap((questionId) =>
    isStage2QuestionAnswerValid(questionId, pruned.answers, input.triggerContext)
      ? []
      : [`${questionId} is invalid or incomplete`],
  )
  return {
    ...pruned,
    completedQuestionIds,
    path,
    validationErrors,
    isComplete: firstUnresolvedQuestionId === null,
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

/**
 * Whether the stored answer for one canonical question is structurally usable.
 * The single validity oracle for the path model — also the resolver's test for
 * "this question is still open" (see `assumed-defaults.ts`).
 *
 * `triggerContext` matters only for the rollout-on drying filter: with the rollout on, a
 * drying answer must stay within `getStage2DryingRouteOptions`. Without it the check is
 * today's.
 */
export function isStage2QuestionAnswerValid(
  questionId: Stage2QuestionId,
  answers: PersonalPlanRefinementAnswersV1,
  triggerContext?: Stage2TriggerContext,
): boolean {
  if (questionId.startsWith("heat:"))
    return isHeatEventAnswerValid(questionId, answers, triggerContext)
  if (questionId === "tools_overview") {
    return isToolOverviewAnswerValid(answers.toolFamiliesWithSomething)
  }
  if (questionId.startsWith("tools:")) {
    const pageKey = questionId.slice("tools:".length)
    return (
      isToolFormPageKey(pageKey) && isToolPageAnswerValid(pageKey, answers.toolForms?.[pageKey])
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
      return (
        isOrderedKnownArray<DryingRoute>(answers.dryingRoutes, DRYING_ROUTES) &&
        (triggerContext?.toolsEnabled !== true ||
          answers.dryingRoutes.every((route) =>
            getStage2DryingRouteOptions(triggerContext, answers).includes(route),
          ))
      )
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

/**
 * Heat-event validity. Under the Diffusor rule (tools rollout on) the diffuser source is plain
 * blow-drying: it needs no protection answer and a stored one is ignored, never a reason to
 * re-open the question. Readers without a trigger context (stored facts, scanner) are tolerant
 * the same way; a rollout-off member keeps today's contract.
 */
function isHeatEventAnswerValid(
  questionId: Stage2QuestionId,
  answers: PersonalPlanRefinementAnswersV1,
  triggerContext?: Stage2TriggerContext,
): boolean {
  const source = questionId.slice("heat:".length) as Stage2HeatEventSource
  const event = answers.heatEvents?.[questionId]
  if (!event || !isOneOf<ProductFrequency>(event.frequency, PRODUCT_FREQUENCIES)) return false
  const rule = triggerContext
    ? stage2HeatRuleOptions(triggerContext)
    : ({ diffuserAsBlowDry: true } as const)
  if (ignoresStoredStage2HeatProtection(source, rule)) return true
  return requiresStage2HeatProtection(source, rule)
    ? isOneOf<HeatProtectionConsistency>(event.protectionConsistency, HEAT_PROTECTION_CONSISTENCIES)
    : event.protectionConsistency === undefined
}
