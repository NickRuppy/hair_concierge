import type {
  PersonalPlanRefinementAnswersV1,
  Stage2AnswerProvenance,
  Stage2QuestionId,
  Stage2StaticQuestionId,
} from "@/lib/personal-plan/refinement/types"

import {
  careFactsFromToolInventory,
  isToolOverviewAnswerValid,
  isToolPageAnswerValid,
} from "@/lib/personal-plan/tools/facts"
import {
  TOOL_FORM_PAGES,
  toolFormCareKey,
  toolFormPagesOfFamily,
  type ToolFormPageKey,
} from "@/lib/personal-plan/tools/labels"
import type { ToolFamily, ToolReportedForm } from "@/lib/personal-plan/tools/contracts"

import type { CareHabitsPatch, FieldProvenanceValue } from "./schema"

/**
 * Pure translators from a Feinschliff refinement draft's own answer state into the
 * `care_habits` user-facts domain shape `saveUserFacts` expects. No I/O — reused by the
 * Feinschliff module-completion write path (`persistence/stage2-refinement-service.ts`)
 * and, per the plan's task 6, by the backfill's Stage-2 decode path.
 */

/**
 * The `care_habits` patch is the draft's own `PersonalPlanRefinementAnswersV1` answers, spread
 * as-is: every present field named, every absent field omitted (never `null`). An absent field
 * is NOT the user clearing it — it means the current refinement path never asked that question
 * (e.g. a conditional question that closed once another answer changed), so the field-level
 * merge inside `user_facts_save_v1` must keep whatever value an earlier write recorded for it,
 * not erase it.
 *
 * Hair Tools: the nested per-page answers (`toolForms`) never reach the facts. Each SETTLED
 * page becomes its own key (`toolForms_<family>_<n>`) — a page whose question completed, or
 * any page of a family the submitted overview left unticked (an explicit `[]`) — and the
 * legacy `brushesCombs` slot is derived once both brush pages are settled. Unsettled pages are
 * omitted. The derived thing-fields (`additionalHeatTools`, `towel.material`,
 * `nightProtection`) are already in the answers (the path writes them), so they spread as-is.
 * Without `completion` every stored page counts as settled.
 *
 * Rollout-aware: `completion.toolsEnabled === false` (the member's rollout AT WRITE TIME, e.g.
 * after a rollback) expands NOTHING tool-related — no overview or page keys, no `brushesCombs`,
 * and no thing-field that was only tool-derived (its own question never completed). The draft's
 * stored tool answers stay as they are; they just no longer reach the facts.
 */
export function toCareHabitsPatch(
  answers: PersonalPlanRefinementAnswersV1,
  completion?: {
    completedQuestionIds: readonly Stage2QuestionId[]
    answerProvenance?: Stage2AnswerProvenance
    toolsEnabled?: boolean
  },
): CareHabitsPatch {
  const { toolForms, ...rest } = answers
  if (completion?.toolsEnabled === false) {
    return withoutToolAnswers(answers, completion.completedQuestionIds) as CareHabitsPatch
  }
  if (toolForms === undefined && answers.toolFamiliesWithSomething === undefined) {
    return { ...rest } as CareHabitsPatch
  }
  const settled = settledToolPages(answers, completion?.completedQuestionIds)
  const patch: Record<string, unknown> = { ...rest }
  if (!settled.overviewSettled) delete patch.toolFamiliesWithSomething
  for (const [pageKey, forms] of Object.entries(settled.pages) as [
    ToolFormPageKey,
    ToolReportedForm[],
  ][]) {
    patch[toolFormCareKey(pageKey)] = [...forms]
  }
  // The legacy brush slot is the member's answer or nothing: assumed brush pages never write
  // it (the Feinschliff never did, so `brush_type` stays `null` for members who never answered).
  const brushes = settledFamilyForms(settled.pages, "brushes_combs")
  const pageProvenance = toolPageProvenance(answers, settled, (id) =>
    completion?.answerProvenance?.[id] === "assumed" ? "assumed" : "user",
  )
  if (brushes && familyHasUserPage(pageProvenance, "brushes_combs")) {
    patch.brushesCombs = careFactsFromToolInventory({ brushes_combs: brushes }).brushesCombs
  }
  return patch as CareHabitsPatch
}

/**
 * The answers as the facts may see them while the tools rollout is off. When the draft carries
 * tool answers, the thing-fields whose own question never completed are tool-derived (the
 * rollout-on path writes them and keeps their questions off the path), so they are dropped too;
 * a completed question's answer is the member's own and stays.
 */
function withoutToolAnswers(
  answers: PersonalPlanRefinementAnswersV1,
  completedQuestionIds: readonly Stage2QuestionId[],
): Record<string, unknown> {
  const { toolForms, toolFamiliesWithSomething, ...rest } = answers
  const patch: Record<string, unknown> = { ...rest }
  if (toolForms === undefined && toolFamiliesWithSomething === undefined) return patch
  const completed = new Set(completedQuestionIds)
  if (!completed.has("additional_heat_tools")) delete patch.additionalHeatTools
  if (!completed.has("night_protection")) delete patch.nightProtection
  if (!completed.has("towel_handling")) delete patch.towel
  return patch
}

/** Each settled page's provenance: its own question's, or the overview's for an unticked family. */
function toolPageProvenance(
  answers: PersonalPlanRefinementAnswersV1,
  settled: SettledToolPages,
  provenanceOf: (id: Stage2QuestionId) => FieldProvenanceValue,
): Partial<Record<ToolFormPageKey, FieldProvenanceValue>> {
  const overview = settled.overviewSettled ? provenanceOf("tools_overview") : undefined
  const ticked = new Set<ToolFamily>(answers.toolFamiliesWithSomething ?? [])
  const pageProvenance: Partial<Record<ToolFormPageKey, FieldProvenanceValue>> = {}
  for (const page of TOOL_FORM_PAGES) {
    if (settled.pages[page.pageKey] === undefined) continue
    pageProvenance[page.pageKey] =
      overview && !ticked.has(page.family) ? overview : provenanceOf(`tools:${page.pageKey}`)
  }
  return pageProvenance
}

function familyHasUserPage(
  pageProvenance: Partial<Record<ToolFormPageKey, FieldProvenanceValue>>,
  family: ToolFamily,
): boolean {
  return toolFormPagesOfFamily(family).some((page) => pageProvenance[page.pageKey] === "user")
}

type SettledToolPages = {
  overviewSettled: boolean
  pages: Partial<Record<ToolFormPageKey, ToolReportedForm[]>>
}

/**
 * The pages the facts may record: an answered page whose question completed (or, without a
 * completion list, any valid stored page), plus every page of a family the settled overview
 * left unticked.
 */
function settledToolPages(
  answers: PersonalPlanRefinementAnswersV1,
  completedQuestionIds?: readonly Stage2QuestionId[],
): SettledToolPages {
  const completed = completedQuestionIds ? new Set(completedQuestionIds) : null
  const overviewSettled =
    isToolOverviewAnswerValid(answers.toolFamiliesWithSomething) &&
    (completed === null || completed.has("tools_overview"))
  const ticked = new Set<ToolFamily>(answers.toolFamiliesWithSomething ?? [])
  const pages: SettledToolPages["pages"] = {}
  for (const page of TOOL_FORM_PAGES) {
    if (overviewSettled && !ticked.has(page.family)) {
      pages[page.pageKey] = []
      continue
    }
    const forms = answers.toolForms?.[page.pageKey]
    if (!isToolPageAnswerValid(page.pageKey, forms)) continue
    if (completed && !completed.has(`tools:${page.pageKey}`)) continue
    pages[page.pageKey] = forms
  }
  return { overviewSettled, pages }
}

/** A family's forms once every one of its pages is settled; otherwise `null`. */
function settledFamilyForms(
  pages: SettledToolPages["pages"],
  family: ToolFamily,
): ToolReportedForm[] | null {
  const familyPages = toolFormPagesOfFamily(family)
  if (!familyPages.every((page) => pages[page.pageKey] !== undefined)) return null
  return familyPages.flatMap((page) => pages[page.pageKey] ?? [])
}

/**
 * Stage-2 static question id -> the `care_habits` field it feeds. Every dynamic
 * `heat:<source>` id folds into the single `heatEvents` aggregate key instead — see
 * `toFieldProvenance`.
 */
export const CARE_HABITS_FIELD_BY_STATIC_QUESTION_ID: Record<Stage2StaticQuestionId, string> = {
  current_product_categories: "currentProductCategories",
  wet_wash_frequency: "wetWashFrequency",
  scalp_irritation_detail: "scalpIrritationDetail",
  dry_shampoo_bridge_preference: "dryShampooBridgePreference",
  dry_shampoo_visible_hair_color: "dryShampooVisibleHairColor",
  oil_purposes: "oilPurposes",
  towel_handling: "towel",
  drying_routes: "dryingRoutes",
  additional_heat_tools: "additionalHeatTools",
  night_protection: "nightProtection",
}

/**
 * Maps the draft's own per-question provenance onto `care_habits` field names for the
 * `domainProvenanceSchema.fields` envelope.
 *
 * Only ids in `completedQuestionIds` are ever considered — mirrors `userAnsweredQuestionIds`
 * in `refinement/answer-provenance.ts`: a completed id missing a provenance entry defaults
 * to `"user"` (legacy data written before the provenance column existed, never silently
 * downgraded); an id that never completed is omitted outright rather than guessed at.
 *
 * Every `heat:<source>` id folds into ONE `heatEvents` key — `"assumed"` if ANY completed
 * heat event is assumed, else `"user"` (controller ruling: a conservative aggregate, since
 * the `care_habits` domain has no per-event provenance slot).
 *
 * When `answers` carries a `heatEvents` map but no heat question completed (the resolver
 * returns `{}` whenever no heat source is selected), that map is the consequence of the drying
 * and heat-tool answers, so it takes their provenance: `"user"` only when both are user
 * answers. Without an entry the empty map would count as real and replace a member's stored
 * heat events (2026-10-06, `user_facts_save_v1` step 4b).
 */
export function toFieldProvenance(input: {
  completedQuestionIds: readonly Stage2QuestionId[]
  answerProvenance: Stage2AnswerProvenance
  answers?: PersonalPlanRefinementAnswersV1
  /** `false` = the rollout is off at write time: no tool field gets a provenance entry. */
  toolsEnabled?: boolean
}): Record<string, FieldProvenanceValue> {
  const fields: Record<string, FieldProvenanceValue> = {}
  let heatEventSeen = false
  let heatEventAssumed = false
  const provenanceOf = (id: Stage2QuestionId): FieldProvenanceValue =>
    input.answerProvenance[id] === "assumed" ? "assumed" : "user"

  for (const id of input.completedQuestionIds) {
    const value = provenanceOf(id)
    if (id.startsWith("heat:")) {
      heatEventSeen = true
      if (value === "assumed") heatEventAssumed = true
      continue
    }
    if (id === "tools_overview" || id.startsWith("tools:")) continue
    const field = CARE_HABITS_FIELD_BY_STATIC_QUESTION_ID[id as Stage2StaticQuestionId]
    if (!field) continue
    fields[field] = value
  }

  if (input.answers && input.toolsEnabled !== false) {
    Object.assign(fields, toolFieldProvenance(input, provenanceOf, fields))
  }

  if (heatEventSeen) {
    fields.heatEvents = heatEventAssumed ? "assumed" : "user"
  } else if (input.answers?.heatEvents !== undefined) {
    fields.heatEvents =
      fields.dryingRoutes === "user" && fields.additionalHeatTools === "user" ? "user" : "assumed"
  }

  return fields
}

/**
 * Hair Tools provenance, via the same settled-page rule as `toCareHabitsPatch`: each settled
 * page carries its own question's provenance (an unticked family's pages carry the overview's),
 * and a derived field carries its source pages' — `user` only when every source is `user`.
 * `additionalHeatTools` / `nightProtection` take it only when their own (rollout-off) question
 * did not complete; the towel combines the textiles page with the technique answer.
 */
function toolFieldProvenance(
  input: {
    completedQuestionIds: readonly Stage2QuestionId[]
    answers?: PersonalPlanRefinementAnswersV1
  },
  provenanceOf: (id: Stage2QuestionId) => FieldProvenanceValue,
  staticFields: Record<string, FieldProvenanceValue>,
): Record<string, FieldProvenanceValue> {
  const answers = input.answers ?? {}
  const settled = settledToolPages(answers, input.completedQuestionIds)
  const fields: Record<string, FieldProvenanceValue> = {}
  if (Object.keys(settled.pages).length === 0 && !settled.overviewSettled) return fields

  if (settled.overviewSettled) fields.toolFamiliesWithSomething = provenanceOf("tools_overview")
  const pageProvenance = toolPageProvenance(answers, settled, provenanceOf)
  for (const [pageKey, value] of Object.entries(pageProvenance) as [
    ToolFormPageKey,
    FieldProvenanceValue,
  ][]) {
    fields[toolFormCareKey(pageKey)] = value
  }

  const familiesProvenance = (families: readonly ToolFamily[]) => {
    const values = families.flatMap((family) =>
      toolFormPagesOfFamily(family).map((page) => pageProvenance[page.pageKey]),
    )
    if (values.some((value) => value === undefined)) return undefined
    return values.every((value) => value === "user") ? "user" : "assumed"
  }
  const completed = new Set(input.completedQuestionIds)

  const heat = familiesProvenance(["airflow", "heated_styling"])
  if (
    heat &&
    answers.additionalHeatTools !== undefined &&
    !completed.has("additional_heat_tools")
  ) {
    fields.additionalHeatTools = heat
  }
  const night = familiesProvenance(["night_protection"])
  if (night && answers.nightProtection !== undefined && !completed.has("night_protection")) {
    fields.nightProtection = night
  }
  const textiles = familiesProvenance(["drying_textiles"])
  const textileForms = settledFamilyForms(settled.pages, "drying_textiles")
  if (
    textiles &&
    textileForms &&
    answers.towel !== undefined &&
    careFactsFromToolInventory({ drying_textiles: textileForms }).towelMaterial !== undefined
  ) {
    const technique = staticFields.towel
    fields.towel = textiles === "user" && (technique ?? "user") === "user" ? "user" : "assumed"
  }
  // Written only when a brush page is the member's own (see `toCareHabitsPatch`).
  const brushes = familiesProvenance(["brushes_combs"])
  if (brushes && familyHasUserPage(pageProvenance, "brushes_combs")) fields.brushesCombs = brushes

  return fields
}
