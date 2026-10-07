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

  for (const [field, value] of Object.entries(input.careHabits)) {
    if (field === "brushesCombs" || value === undefined) continue
    const provenance = input.fields?.[field]
    const known =
      provenance === "user" ||
      (provenance === "unknown_historical" &&
        field !== "currentProductCategories" &&
        !isEmpty(value))
    if (!known) continue

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
