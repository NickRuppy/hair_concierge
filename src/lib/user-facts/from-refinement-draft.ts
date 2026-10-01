import type {
  PersonalPlanRefinementAnswersV1,
  Stage2AnswerProvenance,
  Stage2QuestionId,
  Stage2StaticQuestionId,
} from "@/lib/personal-plan/refinement/types"

import type { CareHabitsPatch, FieldProvenanceValue } from "./schema"

/**
 * Pure translators from a Feinschliff refinement draft's own answer state into the
 * `care_habits` user-facts domain shape `saveUserFacts` expects. No I/O — reused by the
 * Feinschliff module-completion write path (`persistence/stage2-refinement-service.ts`)
 * and, per the plan's task 6, by the backfill's Stage-2 decode path.
 */

/**
 * The `care_habits` patch is exactly the draft's own `PersonalPlanRefinementAnswersV1`
 * answers, spread as-is: every present field named, every absent field omitted (never
 * `null`). An absent field is NOT the user clearing it — it means the current refinement
 * path never asked that question (e.g. a conditional question that closed once another
 * answer changed), so the field-level merge inside `user_facts_save_v1` must keep
 * whatever value an earlier write recorded for it, not erase it. `brushesCombs`
 * (legacy-only; see `schema.ts`) is never set here — Feinschliff has no brush question.
 */
export function toCareHabitsPatch(answers: PersonalPlanRefinementAnswersV1): CareHabitsPatch {
  return { ...answers } as CareHabitsPatch
}

/**
 * Stage-2 static question id -> the `care_habits` field it feeds. Every dynamic
 * `heat:<source>` id folds into the single `heatEvents` aggregate key instead — see
 * `toFieldProvenance`.
 */
const CARE_HABITS_FIELD_BY_STATIC_QUESTION_ID: Record<Stage2StaticQuestionId, string> = {
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
 */
export function toFieldProvenance(input: {
  completedQuestionIds: readonly Stage2QuestionId[]
  answerProvenance: Stage2AnswerProvenance
}): Record<string, FieldProvenanceValue> {
  const fields: Record<string, FieldProvenanceValue> = {}
  let heatEventSeen = false
  let heatEventAssumed = false

  for (const id of input.completedQuestionIds) {
    const value: FieldProvenanceValue =
      input.answerProvenance[id] === "assumed" ? "assumed" : "user"
    if (id.startsWith("heat:")) {
      heatEventSeen = true
      if (value === "assumed") heatEventAssumed = true
      continue
    }
    const field = CARE_HABITS_FIELD_BY_STATIC_QUESTION_ID[id as Stage2StaticQuestionId]
    if (!field) continue
    fields[field] = value
  }

  if (heatEventSeen) {
    fields.heatEvents = heatEventAssumed ? "assumed" : "user"
  }

  return fields
}
