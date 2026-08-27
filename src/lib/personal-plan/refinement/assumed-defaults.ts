import type { ProductFrequency } from "@/lib/vocabulary/frequencies"
import { TOWEL_MATERIALS } from "@/lib/vocabulary/onboarding-care"

import { createStage2HeatEventId, requiresStage2HeatProtection } from "./heat-events"
import {
  getOrderedQuestionIds,
  isStage2QuestionAnswerValid,
  pruneStage2Answers,
} from "./question-path"
import type {
  DryShampooBridgePreference,
  DryShampooVisibleHairColor,
  HeatEventAnswer,
  HeatProtectionConsistency,
  OilPurpose,
  PersonalPlanRefinementAnswersV1,
  ScalpIrritationDetail,
  Stage2AnswerKey,
  Stage2HeatEventSource,
  Stage2QuestionId,
  Stage2StaticQuestionId,
  Stage2TriggerContext,
  TowelMaterial,
  TowelTechnique,
  WetWashFrequency,
} from "./types"

/**
 * The typed default resolver: for a Stage-2 trigger context plus whatever the
 * user has actually answered so far, it fills EVERY still-open question on the
 * current canonical path with an assumed value, so a partially refined draft
 * can still project a complete plan.
 *
 * Every assumed value is one explicit, individually reviewable rule in
 * `STAGE2_ASSUMPTION_RULES`. The rules ARE the implementation — there is no
 * second copy of the values to drift out of sync with the table.
 *
 * Choosing values follows the repo's conservative-under-uncertainty rule and
 * the philosophy the direct-acceptance defaults already established: an
 * assumption must never invent a need the Idealplan did not already show, and
 * where two values are defensible the one closest to the existing no-answers
 * defaults wins. `buildDirectAcceptanceStage2Defaults()` delegates here, so the
 * no-answers case stays value-for-value what it was.
 *
 * Pure/deterministic — no I/O, no DB, no API.
 */

/* ── the assumed values ──────────────────────────────────────────────────── */

/** Most common wash rhythm; conservative between daily and weekly cleansing. */
export const STAGE2_ASSUMED_WET_WASH_FREQUENCY: ProductFrequency & WetWashFrequency = "weekly_2x"
/** Gentle handling, so no mechanical-exposure signal is assumed. */
export const STAGE2_ASSUMED_TOWEL_MATERIAL: TowelMaterial = "mikrofaser"
export const STAGE2_ASSUMED_TOWEL_TECHNIQUE: TowelTechnique = "gentle_press"
export const STAGE2_ASSUMED_SCALP_IRRITATION_DETAIL: ScalpIrritationDetail = "normal"
export const STAGE2_ASSUMED_DRY_SHAMPOO_BRIDGE_PREFERENCE: DryShampooBridgePreference = "decline"
export const STAGE2_ASSUMED_DRY_SHAMPOO_VISIBLE_HAIR_COLOR: DryShampooVisibleHairColor =
  "light_blonde"
export const STAGE2_ASSUMED_OIL_PURPOSES: readonly OilPurpose[] = ["prewash_lengths"]
export const STAGE2_ASSUMED_HEAT_EVENT_FREQUENCY: ProductFrequency = "less_than_monthly"
export const STAGE2_ASSUMED_HEAT_PROTECTION_CONSISTENCY: HeatProtectionConsistency = "unsure"

/* ── the rule table ──────────────────────────────────────────────────────── */

export const STAGE2_ASSUMPTION_RULE_IDS = [
  "assume:current_product_categories:none",
  "assume:wet_wash_frequency:weekly_2x",
  "assume:scalp_irritation_detail:normal",
  "assume:dry_shampoo_bridge_preference:decline",
  "assume:dry_shampoo_visible_hair_color:light_blonde",
  "assume:oil_purposes:prewash_lengths",
  "assume:towel_technique:gentle_press",
  "assume:towel_handling:mikrofaser_gentle_press",
  "assume:drying_routes:air_dry",
  "assume:additional_heat_tools:none",
  "assume:heat_event:ordinary_airflow_minimum",
  "assume:heat_event:protected_minimum",
  "assume:night_protection:none",
] as const
export type Stage2AssumptionRuleId = (typeof STAGE2_ASSUMPTION_RULE_IDS)[number]

type Stage2AssumptionInput = {
  questionId: Stage2QuestionId
  answers: PersonalPlanRefinementAnswersV1
}

export type Stage2AssumptionRule = {
  ruleId: Stage2AssumptionRuleId
  /** Canonical question the rule stands in for; `heat:*` covers every derived heat-event question. */
  questionId: Stage2StaticQuestionId | "heat:*"
  /** When the rule fires, on top of "this question is on the path and has no valid user answer". */
  condition: string
  /** Why this value and not a defensible alternative. */
  rationale: string
  /** Extra guard beyond `questionId`; rules are tried in table order. */
  matches?: (input: Stage2AssumptionInput) => boolean
  /** Returns the answer set with this rule's assumed value written in. */
  write: (input: Stage2AssumptionInput) => PersonalPlanRefinementAnswersV1
}

export const STAGE2_ASSUMPTION_RULES: readonly Stage2AssumptionRule[] = [
  {
    ruleId: "assume:current_product_categories:none",
    questionId: "current_product_categories",
    condition: "always — the question opens the path and is never conditional",
    rationale:
      "An empty product load is the only value that adds no current-product facts. Assuming any owned category would feed reset-load and scalp-buildup assessments the Idealplan never showed.",
    write: ({ answers }) => ({ ...answers, currentProductCategories: [] }),
  },
  {
    ruleId: "assume:wet_wash_frequency:weekly_2x",
    questionId: "wet_wash_frequency",
    condition: "always — unconditional path question",
    rationale:
      "Most common wash rhythm and the midpoint between daily and weekly cleansing; unchanged from the direct-acceptance default so the accepted routine stays the plan the user saw.",
    write: ({ answers }) => ({ ...answers, wetWashFrequency: STAGE2_ASSUMED_WET_WASH_FREQUENCY }),
  },
  {
    ruleId: "assume:scalp_irritation_detail:normal",
    questionId: "scalp_irritation_detail",
    condition: "trigger context has `hasReportedIrritatedScalp`",
    rationale:
      "Medically adjacent, so the assumption stays cosmetic-neutral: `normal` is the only value that does not turn Stage 1's Scalp-Care deferral into an extra `scalp_comfort` role. The more symptom-faithful `mild_sensitive_or_itchy` was considered and rejected with Nick — plan identity won, and the assumption is disclosed to the user, who can correct it in a real Stage 2.",
    write: ({ answers }) => ({
      ...answers,
      scalpIrritationDetail: STAGE2_ASSUMED_SCALP_IRRITATION_DETAIL,
    }),
  },
  {
    ruleId: "assume:dry_shampoo_bridge_preference:decline",
    questionId: "dry_shampoo_bridge_preference",
    condition:
      "bridge eligibility is `eligible` and the user did not report dry shampoo as an owned category",
    rationale:
      "Declining keeps Dry Shampoo out of an Idealplan that never showed it; accepting would introduce a whole product the assumption has no evidence for.",
    write: ({ answers }) => ({
      ...answers,
      dryShampooBridgePreference: STAGE2_ASSUMED_DRY_SHAMPOO_BRIDGE_PREFERENCE,
    }),
  },
  {
    ruleId: "assume:dry_shampoo_visible_hair_color:light_blonde",
    questionId: "dry_shampoo_visible_hair_color",
    condition:
      "the user reported dry shampoo as an owned category, or the user accepted the bridge — the question is never reachable from an assumption alone",
    rationale:
      "The question exists to flag visible residue risk. Light/blonde root colour is the option that triggers no special handling, so it adds no constraint the plan did not already carry; `dark` would invent a tinted-product requirement. No truly neutral option exists in this set — see the concern noted with the task.",
    write: ({ answers }) => ({
      ...answers,
      dryShampooVisibleHairColor: STAGE2_ASSUMED_DRY_SHAMPOO_VISIBLE_HAIR_COLOR,
    }),
  },
  {
    ruleId: "assume:oil_purposes:prewash_lengths",
    questionId: "oil_purposes",
    condition:
      "the user reported `oil` in the owned categories — never reachable from an assumed empty category list",
    rationale:
      "The answer must be non-empty, so the least distorting single purpose wins. `prewash_lengths` is the only oil use that is washed out again: unlike `dry_finish` it adds no finishing-oil load to the reset assessment, and unlike `scalp` it adds no scalp-oil load to the medically adjacent scalp assessment.",
    write: ({ answers }) => ({ ...answers, oilPurposes: [...STAGE2_ASSUMED_OIL_PURPOSES] }),
  },
  {
    ruleId: "assume:towel_technique:gentle_press",
    questionId: "towel_handling",
    condition: "the user answered a real towel material but left the technique open",
    rationale:
      "Keeps the user's material and assumes only the missing half. `gentle_press` is the technique that raises no `towel_rough_rubbing` mechanical-exposure signal, so the assumption adds no damage input.",
    matches: ({ answers }) => isRealTowelMaterial(answers.towel?.material),
    write: ({ answers }) => ({
      ...answers,
      towel: {
        material: answers.towel?.material as TowelMaterial,
        technique: STAGE2_ASSUMED_TOWEL_TECHNIQUE,
      },
    }),
  },
  {
    ruleId: "assume:towel_handling:mikrofaser_gentle_press",
    questionId: "towel_handling",
    condition: "the towel question is open with no usable material answer",
    rationale:
      "Gentle handling on a low-friction material, so no mechanical-exposure signal is assumed; unchanged from the direct-acceptance default.",
    write: ({ answers }) => ({
      ...answers,
      towel: {
        material: STAGE2_ASSUMED_TOWEL_MATERIAL,
        technique: STAGE2_ASSUMED_TOWEL_TECHNIQUE,
      },
    }),
  },
  {
    ruleId: "assume:drying_routes:air_dry",
    questionId: "drying_routes",
    condition: "always — unconditional path question",
    rationale:
      "Air drying is the only route that opens no heat event and adds no heat exposure; unchanged from the direct-acceptance default („Lufttrocknen, kein Föhnen“).",
    write: ({ answers }) => ({ ...answers, dryingRoutes: ["air_dry"] }),
  },
  {
    ruleId: "assume:additional_heat_tools:none",
    questionId: "additional_heat_tools",
    condition: "always — unconditional path question",
    rationale:
      "No heat tool means no heat event and no heat-damage input; unchanged from the direct-acceptance default („Keine Hitze-Styling-Geräte“).",
    write: ({ answers }) => ({ ...answers, additionalHeatTools: [] }),
  },
  {
    ruleId: "assume:heat_event:ordinary_airflow_minimum",
    questionId: "heat:*",
    condition:
      "the user selected an ordinary-airflow source (gewöhnlich föhnen) but left its event open",
    rationale:
      "The source is a user answer, so the event cannot be dropped — only minimised. `less_than_monthly` is the lowest frequency the option set offers and the only band that keeps the heat damage score at 1 (`low`), the closest reachable state to no heat at all. Ordinary airflow carries no protection question, so none is written.",
    matches: ({ questionId }) => !requiresStage2HeatProtection(heatEventSource(questionId)),
    write: ({ answers, questionId }) =>
      writeHeatEvent(answers, questionId, { frequency: STAGE2_ASSUMED_HEAT_EVENT_FREQUENCY }),
  },
  {
    ruleId: "assume:heat_event:protected_minimum",
    questionId: "heat:*",
    condition:
      "the user selected an airflow-shaping or direct-contact-heat source but left its event open",
    rationale:
      "Same minimal frequency as the ordinary-airflow rule. Protection is `unsure` because that is the only option that truthfully encodes the app's knowledge state: the user never made any statement about heat protection, and `always` would be a positive behavioural claim on their behalf. Assuming `always` would additionally suppress the best-supported cosmetic recommendation in hair care — a heat protectant for a confirmed direct-contact-tool user — the moment this field gains a consumer (domain review, fix round 1). `no` would go the other way and invent a failure the user never reported.",
    matches: ({ questionId }) => requiresStage2HeatProtection(heatEventSource(questionId)),
    write: ({ answers, questionId }) =>
      writeHeatEvent(answers, questionId, {
        frequency: STAGE2_ASSUMED_HEAT_EVENT_FREQUENCY,
        protectionConsistency: STAGE2_ASSUMED_HEAT_PROTECTION_CONSISTENCY,
      }),
  },
  {
    ruleId: "assume:night_protection:none",
    questionId: "night_protection",
    condition: "always — unconditional path question",
    rationale:
      "No night protection introduces no habit and no product; unchanged from the direct-acceptance default („Kein besonderer Haarschutz über Nacht“).",
    write: ({ answers }) => ({ ...answers, nightProtection: [] }),
  },
]

/* ── resolution ──────────────────────────────────────────────────────────── */

export type Stage2AssumedAnswerResolution = {
  /** User answers ∪ assumptions — total over `orderedQuestionIds`. */
  answers: PersonalPlanRefinementAnswersV1
  /** The canonical path the resolved answers produce; every id on it is answered. */
  orderedQuestionIds: Stage2QuestionId[]
  /** Path-ordered ids the resolver had to assume. */
  assumedQuestionIds: Stage2QuestionId[]
  /** Rule ids applied, aligned index-for-index with `assumedQuestionIds`. */
  appliedRuleIds: Stage2AssumptionRuleId[]
}

/**
 * Upper bound on resolution passes. The canonical path can hold at most ~17
 * questions and each pass closes exactly one, so exceeding this means a rule
 * re-opened a question — a bug we want loud, not silently truncated.
 */
const MAX_ASSUMPTION_PASSES = 64

export function resolveAssumedAnswers(input: {
  triggerContext: Stage2TriggerContext
  answers: PersonalPlanRefinementAnswersV1
  /**
   * Ids the user actually answered (provenance `user`). When given, every other
   * stored answer is discarded and re-derived from the rules, so an earlier
   * assumption never hardens into truth. When omitted, every structurally valid
   * stored answer is trusted.
   */
  userAnsweredQuestionIds?: readonly Stage2QuestionId[]
}): Stage2AssumedAnswerResolution {
  let answers = input.userAnsweredQuestionIds
    ? selectStage2Answers(input.answers, input.userAnsweredQuestionIds)
    : input.answers
  const ruleIdByQuestionId = new Map<Stage2QuestionId, Stage2AssumptionRuleId>()

  for (let pass = 0; pass <= MAX_ASSUMPTION_PASSES; pass += 1) {
    // Prune first: an answer that is no longer on the path must not keep a
    // conditional question alive, and the path has to be recomputed after every
    // assumption because assumptions can gate later questions.
    answers = pruneStage2Answers({
      triggerContext: input.triggerContext,
      answers,
      completedQuestionIds: [],
    }).answers
    const orderedQuestionIds = getOrderedQuestionIds(input.triggerContext, answers)
    const openQuestionId = orderedQuestionIds.find(
      (questionId) => !isStage2QuestionAnswerValid(questionId, answers),
    )
    if (!openQuestionId) {
      const assumedQuestionIds = orderedQuestionIds.filter((questionId) =>
        ruleIdByQuestionId.has(questionId),
      )
      return {
        answers: { ...answers, heatEvents: answers.heatEvents ?? {} },
        orderedQuestionIds,
        assumedQuestionIds,
        appliedRuleIds: assumedQuestionIds.map(
          (questionId) => ruleIdByQuestionId.get(questionId) as Stage2AssumptionRuleId,
        ),
      }
    }
    const rule = findAssumptionRule({ questionId: openQuestionId, answers })
    answers = rule.write({ questionId: openQuestionId, answers })
    ruleIdByQuestionId.set(openQuestionId, rule.ruleId)
  }

  throw new Error("Stage 2 assumed-default resolution did not reach a fixed point")
}

function findAssumptionRule(input: Stage2AssumptionInput): Stage2AssumptionRule {
  const isHeatEvent = input.questionId.startsWith("heat:")
  const rule = STAGE2_ASSUMPTION_RULES.find(
    (candidate) =>
      (isHeatEvent
        ? candidate.questionId === "heat:*"
        : candidate.questionId === input.questionId) &&
      (candidate.matches?.(input) ?? true),
  )
  if (!rule) {
    throw new Error(`No Stage 2 assumption rule for canonical question: ${input.questionId}`)
  }
  return rule
}

/* ── answer selection by question id ─────────────────────────────────────── */

const STAGE2_ANSWER_KEY_BY_QUESTION_ID: Record<
  Stage2StaticQuestionId,
  Exclude<Stage2AnswerKey, "heatEvents">
> = {
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
 * Narrows an answer set to the answers owned by the given canonical question
 * ids. The provenance read path uses it to strip assumed answers back out
 * before re-resolving them.
 */
export function selectStage2Answers(
  answers: PersonalPlanRefinementAnswersV1,
  questionIds: readonly Stage2QuestionId[],
): PersonalPlanRefinementAnswersV1 {
  const selected: PersonalPlanRefinementAnswersV1 = {}
  const heatEvents: Record<string, HeatEventAnswer> = {}
  let hasHeatEvent = false

  for (const questionId of questionIds) {
    if (questionId.startsWith("heat:")) {
      const event = answers.heatEvents?.[questionId]
      if (event) {
        heatEvents[questionId] = event
        hasHeatEvent = true
      }
      continue
    }
    const answerKey = STAGE2_ANSWER_KEY_BY_QUESTION_ID[questionId as Stage2StaticQuestionId]
    if (!answerKey) continue
    const value = answers[answerKey]
    if (value !== undefined) (selected as Record<string, unknown>)[answerKey] = value
  }
  return hasHeatEvent ? { ...selected, heatEvents } : selected
}

/* ── helpers ─────────────────────────────────────────────────────────────── */

function heatEventSource(questionId: Stage2QuestionId): Stage2HeatEventSource {
  return questionId.slice("heat:".length) as Stage2HeatEventSource
}

function writeHeatEvent(
  answers: PersonalPlanRefinementAnswersV1,
  questionId: Stage2QuestionId,
  event: HeatEventAnswer,
): PersonalPlanRefinementAnswersV1 {
  const source = heatEventSource(questionId)
  return {
    ...answers,
    heatEvents: { ...answers.heatEvents, [createStage2HeatEventId(source)]: event },
  }
}

function isRealTowelMaterial(material: TowelMaterial | undefined): boolean {
  return material !== undefined && material !== "no_towel" && TOWEL_MATERIALS.includes(material)
}
