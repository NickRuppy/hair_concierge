import {
  ADDITIONAL_HEAT_TOOLS,
  DRYING_ROUTES,
  OIL_PURPOSES,
  STAGE2_PRODUCT_CATEGORIES,
  type PersonalPlanRefinementAnswersV1,
  type Stage2QuestionId,
  type Stage2StaticQuestionId,
} from "@/lib/personal-plan/refinement/types"
import { isStage2QuestionAnswerValid } from "@/lib/personal-plan/refinement/question-path"
import { sortToolReportedForms, type ToolReportedForm } from "@/lib/personal-plan/tools/contracts"
import { careFactsFromToolInventory } from "@/lib/personal-plan/tools/facts"
import {
  TOOL_FORM_PAGES,
  TOOL_OVERVIEW_FAMILY_ORDER,
  toolFormCareKey,
  type ToolFormCareKey,
  type ToolFormPageKey,
} from "@/lib/personal-plan/tools/labels"
import { NIGHT_PROTECTIONS } from "@/lib/vocabulary/onboarding-care"

import { CARE_HABITS_FIELD_BY_STATIC_QUESTION_ID } from "./from-refinement-draft"
import type { CareHabitsV1, FieldProvenanceValue } from "./schema"

export type KnownCareAnswers = {
  answers: PersonalPlanRefinementAnswersV1
  /** The Stage-2 question ids those answers stand for (`heat:<source>` per stored event). */
  questionIds: Stage2QuestionId[]
}

const QUESTION_ID_BY_FIELD = new Map<string, Stage2StaticQuestionId>(
  Object.entries(CARE_HABITS_FIELD_BY_STATIC_QUESTION_ID).map(([questionId, field]) => [
    field,
    questionId as Stage2StaticQuestionId,
  ]),
)

/** Stage-2 validation requires each list in its vocabulary's order; stored facts need not be. */
const CANONICAL_ORDER: Partial<Record<keyof PersonalPlanRefinementAnswersV1, readonly string[]>> = {
  currentProductCategories: STAGE2_PRODUCT_CATEGORIES,
  oilPurposes: OIL_PURPOSES,
  dryingRoutes: DRYING_ROUTES,
  additionalHeatTools: ADDITIONAL_HEAT_TOOLS,
  nightProtection: NIGHT_PROTECTIONS,
}

const PAGE_BY_CARE_KEY = new Map<string, (typeof TOOL_FORM_PAGES)[number]>(
  TOOL_FORM_PAGES.map((page) => [toolFormCareKey(page.pageKey), page] as const),
)

/**
 * The stored `care_habits` domain as refinement answers: `brushesCombs` dropped, the per-page
 * Hair Tools keys folded back into `toolForms[pageKey]` (canonical family order) and the
 * overview put into wash-day order. Nothing is validated or filtered by provenance here.
 */
export function toolAnswersFromCareHabits(
  careHabits: CareHabitsV1,
): PersonalPlanRefinementAnswersV1 {
  const answers: Record<string, unknown> = {}
  const toolForms: Partial<Record<ToolFormPageKey, ToolReportedForm[]>> = {}
  let hasToolForm = false
  for (const [field, value] of Object.entries(careHabits)) {
    if (field === "brushesCombs" || value === undefined) continue
    const page = PAGE_BY_CARE_KEY.get(field)
    if (page) {
      toolForms[page.pageKey] = sortToolReportedForms(page.family, value as string[])
      hasToolForm = true
      continue
    }
    answers[field] =
      field === "toolFamiliesWithSomething" && Array.isArray(value)
        ? canonicalOrder(value, TOOL_OVERVIEW_FAMILY_ORDER)
        : value
  }
  if (hasToolForm) answers.toolForms = toolForms
  return answers as PersonalPlanRefinementAnswersV1
}

function canonicalOrder<T>(values: readonly T[], order: readonly T[]): T[] {
  return [...values].sort((a, b) => order.indexOf(a) - order.indexOf(b))
}

/**
 * The Hair Tools pages a derived thing-field comes from, given what is stored: the field is
 * known only while every one of them is the member's own answer. `null` when no source page is
 * stored — the field then follows the ordinary rule (an answer from the old Gewohnheiten
 * questions).
 */
function derivedFieldSources(field: string, careHabits: CareHabitsV1): ToolFormCareKey[] | null {
  const stored = careHabits as Record<string, unknown>
  const present = (keys: ToolFormCareKey[]) => {
    const found = keys.filter((key) => stored[key] !== undefined)
    return found.length > 0 ? keys : null
  }
  switch (field) {
    case "additionalHeatTools":
      return present(["toolForms_airflow_1", "toolForms_heated_styling_1"])
    case "nightProtection":
      return present(["toolForms_night_protection_1"])
    case "towel": {
      const textiles = stored.toolForms_drying_textiles_1
      if (!Array.isArray(textiles)) return null
      const derives =
        careFactsFromToolInventory({ drying_textiles: textiles as ToolReportedForm[] })
          .towelMaterial !== undefined
      return derives ? ["toolForms_drying_textiles_1"] : null
    }
    default:
      return null
  }
}

function isEmpty(value: unknown): boolean {
  if (Array.isArray(value)) return value.length === 0
  return typeof value === "object" && value !== null && Object.keys(value).length === 0
}

/**
 * The stored care answers an assumption must not replace, as Stage-2 answers.
 *
 * - `user` → known, whatever the value (an empty list is her answer).
 * - `unknown_historical` (imported from the legacy columns) → known only when it is a complete
 *   answer: never an empty list/map (indistinguishable from the old column defaults) and never
 *   `currentProductCategories` (the backfill synthesises `["heat_protectant"]` from
 *   `uses_heat_protection` — a partial list, not her product answer).
 * - `assumed` or no provenance entry → not known.
 *
 * Hair Tools: the overview and each per-page key are known only when `user` (they never came
 * from the legacy columns); pages are rebuilt into `toolForms[pageKey]` in canonical order before
 * validation and stand for `tools_overview` / `tools:<pageKey>`. A thing-field the pages derive
 * (`additionalHeatTools`, `towel` with a derived material, `nightProtection`) is known only while
 * every source page is `user`.
 *
 * Lists are put into canonical Stage-2 order, and only answers that are valid for their question
 * count (a towel without its technique, an unknown list value or an incomplete heat event is
 * left to the resolver). That keeps every known answer intact through
 * `resolveAssumedAnswers`, which direct acceptance relies on to recognise its own draft later.
 */
export function knownCareAnswers(input: {
  careHabits: CareHabitsV1 | null
  fields: Record<string, FieldProvenanceValue> | undefined
}): KnownCareAnswers {
  const answers: Record<string, unknown> = {}
  const questionIds: Stage2QuestionId[] = []
  if (!input.careHabits) return { answers: {}, questionIds }

  const careHabits = input.careHabits
  const stored = toolAnswersFromCareHabits(careHabits)
  for (const [field, value] of Object.entries(stored)) {
    if (value === undefined) continue
    if (field === "toolForms") {
      // One known answer per page the member answered herself, in canonical order.
      for (const [pageKey, forms] of Object.entries(value as object) as [
        ToolFormPageKey,
        ToolReportedForm[],
      ][]) {
        if (input.fields?.[toolFormCareKey(pageKey)] !== "user") continue
        const questionId: Stage2QuestionId = `tools:${pageKey}`
        const candidate = { toolForms: { [pageKey]: forms } } as PersonalPlanRefinementAnswersV1
        if (!isStage2QuestionAnswerValid(questionId, candidate)) continue
        answers.toolForms = { ...(answers.toolForms as object), [pageKey]: forms }
        questionIds.push(questionId)
      }
      continue
    }
    if (field === "toolFamiliesWithSomething") {
      if (input.fields?.[field] !== "user") continue
      if (
        !isStage2QuestionAnswerValid("tools_overview", {
          toolFamiliesWithSomething: value as never,
        })
      ) {
        continue
      }
      answers[field] = value
      questionIds.push("tools_overview")
      continue
    }

    const provenance = input.fields?.[field]
    const known =
      provenance === "user" ||
      (provenance === "unknown_historical" &&
        field !== "currentProductCategories" &&
        !isEmpty(value))
    if (!known) continue
    // A thing-field the tool pages derive is the member's answer only while its pages are.
    const sources = derivedFieldSources(field, careHabits)
    if (sources && !sources.every((key) => input.fields?.[key] === "user")) continue

    if (field === "heatEvents") {
      const events: Record<string, unknown> = {}
      for (const [questionId, event] of Object.entries(value as object)) {
        const candidate = { heatEvents: { [questionId]: event } } as PersonalPlanRefinementAnswersV1
        if (!isStage2QuestionAnswerValid(questionId as Stage2QuestionId, candidate)) continue
        events[questionId] = structuredClone(event)
        questionIds.push(questionId as Stage2QuestionId)
      }
      if (Object.keys(events).length > 0) answers.heatEvents = events
      continue
    }

    const questionId = QUESTION_ID_BY_FIELD.get(field)
    if (!questionId) continue
    const order = CANONICAL_ORDER[field as keyof PersonalPlanRefinementAnswersV1]
    const canonical =
      order && Array.isArray(value)
        ? [...value].sort((a, b) => order.indexOf(a) - order.indexOf(b))
        : structuredClone(value)
    if (!isStage2QuestionAnswerValid(questionId, { [field]: canonical })) continue
    answers[field] = canonical
    questionIds.push(questionId)
  }
  return { answers: answers as PersonalPlanRefinementAnswersV1, questionIds }
}
