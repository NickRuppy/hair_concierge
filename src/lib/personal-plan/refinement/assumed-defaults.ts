import type { ProductFrequency } from "@/lib/vocabulary/frequencies"
import { TOWEL_MATERIALS } from "@/lib/vocabulary/onboarding-care"
import { sortToolReportedForms, type ToolFamily } from "@/lib/personal-plan/tools/contracts"
import { nightWearFromNightProtection, projectToolCareFacts } from "@/lib/personal-plan/tools/facts"
import {
  isToolFormPageKey,
  TOOL_FORM_PAGES,
  TOOL_OVERVIEW_FAMILY_ORDER,
  toolFamiliesForSections,
  toolFormPage,
  type ToolFormPageKey,
} from "@/lib/personal-plan/tools/labels"
import {
  defaultToolFormsFromCare,
  defaultToolSectionsFromCare,
} from "@/lib/personal-plan/tools/stage2"

import {
  createStage2HeatEventId,
  requiresStage2HeatProtection,
  stage2HeatRuleOptions,
} from "./heat-events"
import {
  getOrderedQuestionIds,
  getStage2QuestionModule,
  isStage2QuestionAnswerValid,
  pruneStage2Answers,
  resolveStage2RefinementContract,
} from "./question-path"
import { STAGE2_MODULES } from "./types"
import type {
  BondbuilderTiming,
  DryShampooBridgePreference,
  DryShampooVisibleHairColor,
  HeatEventAnswer,
  HeatProtectionConsistency,
  OilPurpose,
  PersonalPlanRefinementAnswersV1,
  ScalpIrritationDetail,
  Stage2AnswerKey,
  Stage2AnswerProvenance,
  Stage2HeatEventSource,
  Stage2Module,
  Stage2ModulePathState,
  Stage2ModuleProjections,
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
/** Leaves today's Bondbuilder selection (trust tier, then cheapest first) untouched. */
export const STAGE2_ASSUMED_BONDBUILDER_TIMING: BondbuilderTiming = "no_preference"
/** Gentle handling, so no mechanical-exposure signal is assumed. */
export const STAGE2_ASSUMED_TOWEL_MATERIAL: TowelMaterial = "mikrofaser"
export const STAGE2_ASSUMED_TOWEL_TECHNIQUE: TowelTechnique = "gentle_press"
/** The textile card that derives `STAGE2_ASSUMED_TOWEL_MATERIAL` with the rollout on. */
export const STAGE2_ASSUMED_TOWEL_TEXTILE = "microfiber_towel" as const
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
  "assume:bondbuilder_timing:no_preference",
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
  "assume:night_wear:derived_from_care",
  "assume:night_wear:open",
  "assume:tools_overview:derived_from_care",
  "assume:tools_form:derived_from_care",
] as const
export type Stage2AssumptionRuleId = (typeof STAGE2_ASSUMPTION_RULE_IDS)[number]

type Stage2AssumptionInput = {
  questionId: Stage2QuestionId
  answers: PersonalPlanRefinementAnswersV1
  triggerContext: Stage2TriggerContext
}

export type Stage2AssumptionRule = {
  ruleId: Stage2AssumptionRuleId
  /**
   * Canonical question the rule stands in for; `heat:*` covers every derived heat-event question
   * and `tools:*` every product-form page. Wildcards are explicit: a question without a rule
   * throws.
   */
  questionId: Stage2StaticQuestionId | "heat:*" | "tools_overview" | "tools:*"
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
    ruleId: "assume:bondbuilder_timing:no_preference",
    questionId: "bondbuilder_timing",
    condition:
      "Stage-1 Bondbuilder need (basis or optional), the user does not report an owned Bondbuilder, and she washes wet",
    rationale:
      "`no_preference` is the only value that leaves today's selection untouched (trust tier, then cheapest first); assuming a timing would silently swap the product the Idealplan showed.",
    write: ({ answers }) => ({ ...answers, bondbuilderTiming: STAGE2_ASSUMED_BONDBUILDER_TIMING }),
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
      "the user selected an ordinary-airflow source (gewöhnlich föhnen — with the tools rollout on, also „Mit Diffusor“, which is plain blow-drying) but left its event open",
    rationale:
      "The source is a user answer, so the event cannot be dropped — only minimised. `less_than_monthly` is the lowest frequency the option set offers and the only band that keeps the heat damage score at 1 (`low`), the closest reachable state to no heat at all. Ordinary airflow carries no protection question, so none is written.",
    matches: ({ questionId, triggerContext }) =>
      !requiresStage2HeatProtection(
        heatEventSource(questionId),
        stage2HeatRuleOptions(triggerContext),
      ),
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
    matches: ({ questionId, triggerContext }) =>
      requiresStage2HeatProtection(
        heatEventSource(questionId),
        stage2HeatRuleOptions(triggerContext),
      ),
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
  {
    ruleId: "assume:night_wear:derived_from_care",
    questionId: "night_wear",
    condition:
      "the Hair Tools rollout is on, the hair can be tied, and the member's own earlier night answer already names a technique (`pineapple` / `loose_tied`)",
    rationale:
      'Her earlier night answer („Pineapple", „locker zusammengebunden") IS the answer to how she wears her hair at night; assuming „Offen" would silently drop it from the plan, which the rollout-off resolver keeps. Pineapple wins over loose_tied when both were stored (the old multi-select).',
    matches: ({ answers }) => nightWearFromNightProtection(answers.nightProtection) !== undefined,
    write: ({ answers }) => ({
      ...answers,
      nightWear: nightWearFromNightProtection(answers.nightProtection),
    }),
  },
  {
    ruleId: "assume:night_wear:open",
    questionId: "night_wear",
    condition:
      "the Hair Tools rollout is on, the hair can be tied, and no technique is known — the night question closes Gewohnheiten",
    rationale:
      '„Offen" adds no technique, so the derived night protection stays exactly the night things — the same as the rollout-off default `assume:night_protection:none` (no technique, no habit, no product).',
    write: ({ answers }) => ({ ...answers, nightWear: "open" }),
  },
  {
    ruleId: "assume:tools_overview:derived_from_care",
    questionId: "tools_overview",
    condition: "the Hair Tools rollout is on — the overview opens the tools module",
    rationale:
      "Ticks exactly the sections the member's own care answers already imply (`defaultToolSectionsFromCare`, the same starting value the overview shows), so the assumed inventory reproduces the facts she gave. Without a towel answer it also ticks the drying textiles, so the derived towel stays today's assumption (Mikrofaser, `assume:towel_handling:mikrofaser_gentle_press`) — an assumption may never change behaviour versus the rollout-off resolver. Assumed answers never count as reported ownership (`D5`).",
    write: ({ answers }) => {
      const care = projectToolCareFacts(answers)
      const families = new Set(toolFamiliesForSections(defaultToolSectionsFromCare(care)))
      if (care.towelMaterial === null) families.add("drying_textiles")
      return withToolOverview(
        answers,
        TOOL_OVERVIEW_FAMILY_ORDER.filter((family) => families.has(family)),
      )
    },
  },
  {
    ruleId: "assume:tools_form:derived_from_care",
    questionId: "tools:*",
    condition: "the overview ticked the page's family and the page is open",
    rationale:
      "The page offers what the care answers imply for its family (`defaultToolFormsFromCare` ∩ the page's forms), so the derived thing-fields come back as the member reported them; everything else is the page's „Nichts davon\". Without a towel answer the textiles page assumes the Mikrofaser-Handtuch, which derives today's assumed towel material. Never evidence of ownership (`D5`).",
    write: ({ answers, questionId }) => {
      const page = toolFormPage(questionId.slice("tools:".length))
      if (!page) throw new Error(`Unknown Stage 2 tool page: ${questionId}`)
      const care = projectToolCareFacts(answers)
      const implied =
        page.family === "drying_textiles" && care.towelMaterial === null
          ? [STAGE2_ASSUMED_TOWEL_TEXTILE]
          : (defaultToolFormsFromCare(care)[page.family] ?? [])
      const offered = new Set<string>(page.forms)
      return {
        ...answers,
        toolForms: {
          ...answers.toolForms,
          [page.pageKey]: sortToolReportedForms(
            page.family,
            implied.filter((form) => offered.has(form)),
          ),
        },
      }
    },
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
      (questionId) => !isStage2QuestionAnswerValid(questionId, answers, input.triggerContext),
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
    const ruleInput = {
      questionId: openQuestionId,
      answers,
      triggerContext: input.triggerContext,
    }
    const rule = findAssumptionRule(ruleInput)
    answers = rule.write(ruleInput)
    ruleIdByQuestionId.set(openQuestionId, rule.ruleId)
  }

  throw new Error("Stage 2 assumed-default resolution did not reach a fixed point")
}

function ruleQuestionIdFor(questionId: Stage2QuestionId): Stage2AssumptionRule["questionId"] {
  if (questionId.startsWith("heat:")) return "heat:*"
  if (questionId.startsWith("tools:")) return "tools:*"
  return questionId as Stage2StaticQuestionId | "tools_overview"
}

function findAssumptionRule(input: Stage2AssumptionInput): Stage2AssumptionRule {
  const ruleQuestionId = ruleQuestionIdFor(input.questionId)
  const rule = STAGE2_ASSUMPTION_RULES.find(
    (candidate) => candidate.questionId === ruleQuestionId && (candidate.matches?.(input) ?? true),
  )
  if (!rule) {
    throw new Error(`No Stage 2 assumption rule for canonical question: ${input.questionId}`)
  }
  return rule
}

/* ── questions added after a draft already passed their point ────────────── */

/**
 * Canonical questions added to an existing module after members had already finished it (S4:
 * `bondbuilder_timing`, 2026-10). A draft that passed such a question is never reopened for
 * it: the question is answered by its assumption rule instead (Nick, S4 Q2 — „Ist mir egal“,
 * she keeps today's product and can change it via „Bearbeiten“).
 */
export const STAGE2_LATE_ADDED_QUESTION_IDS: readonly Stage2StaticQuestionId[] = [
  "bondbuilder_timing",
]

function isLateAddedQuestionId(questionId: Stage2QuestionId): boolean {
  return (STAGE2_LATE_ADDED_QUESTION_IDS as readonly Stage2QuestionId[]).includes(questionId)
}

export type Stage2LateAddedDraftState = {
  status: "in_progress" | "complete" | "stale"
  triggerContext: Stage2TriggerContext
  answers: PersonalPlanRefinementAnswersV1
  completedQuestionIds: Stage2QuestionId[]
  answerProvenance: Stage2AnswerProvenance
  moduleProjections?: Stage2ModuleProjections
  /** `true`: direct acceptance wrote this draft and already answered every question for her. */
  directAcceptanceOwned?: boolean | null
}

/**
 * Read-time normalization for every persisted draft that rebuilds a refinement contract.
 *
 * A draft has passed a module when it is `complete` or owned by direct acceptance (every
 * module), or `in_progress` with that module already projected (`module_projections`). When a passed module's only unresolved questions are late-added ones, each is answered by its assumption rule, marked
 * `assumed` and appended to `completedQuestionIds` in path order — so `complete` drafts stay
 * loadable (`createStage2RefinementSession` refuses an incomplete complete draft) and the
 * module stays finished (`settleLateAddedAssumptions`). Every other draft is returned as is
 * (same reference): before the point she simply meets the question in order. Idempotent; the
 * stored row is never rewritten here.
 */
export function normalizeLateAddedQuestions<T extends Stage2LateAddedDraftState>(draft: T): T {
  const passedModules: readonly Stage2Module[] =
    draft.status === "complete" || (draft.status === "in_progress" && draft.directAcceptanceOwned)
      ? STAGE2_MODULES
      : draft.status === "in_progress"
        ? STAGE2_MODULES.filter((stage2Module) => draft.moduleProjections?.[stage2Module])
        : []
  if (passedModules.length === 0) return draft

  const { path } = resolveStage2RefinementContract(draft)
  // Path growth in another module (e.g. the newer Tools module) must not reopen products.
  // Fill only a passed module whose own remaining questions are all late-added ones.
  const unresolved = passedModules.flatMap((stage2Module) => {
    const open = path.orderedQuestionIds.filter(
      (questionId) =>
        !path.completedQuestionIds.includes(questionId) &&
        getStage2QuestionModule(questionId) === stage2Module,
    )
    return open.every(isLateAddedQuestionId) ? open : []
  })
  if (unresolved.length === 0) return draft

  let answers = draft.answers
  for (const questionId of unresolved) {
    answers = findAssumptionRule({
      questionId,
      answers,
      triggerContext: draft.triggerContext,
    }).write({
      questionId,
      answers,
      triggerContext: draft.triggerContext,
    })
  }
  const completed = new Set([...path.completedQuestionIds, ...unresolved])
  const normalized = resolveStage2RefinementContract({
    triggerContext: draft.triggerContext,
    answers,
    completedQuestionIds: path.orderedQuestionIds.filter((questionId) => completed.has(questionId)),
  })
  if (unresolved.some((questionId) => !normalized.path.completedQuestionIds.includes(questionId))) {
    return draft
  }
  const answerProvenance = { ...draft.answerProvenance }
  for (const questionId of unresolved) answerProvenance[questionId] = "assumed"
  return {
    ...draft,
    answers,
    completedQuestionIds: normalized.path.completedQuestionIds,
    answerProvenance,
  }
}

/**
 * Carries a parent's late-added assumptions into its optional-edit successor (S4-01).
 *
 * `personal_plan_open_optional_refinement_v1` clones the STORED complete parent into a new
 * `in_progress` draft with empty projections. The parent's late-added answers exist only in its
 * read-time view (`normalizeLateAddedQuestions`), and the successor has no lineage that would
 * let a later read re-derive them — so its products module would reopen. Given the normalized
 * parent and the fresh successor, this returns the successor with every late-added question the
 * parent holds as `assumed` answered by the same assumption rule (provenance `assumed`, path
 * order), ready to be saved once. Returns null when there is nothing to carry or the successor
 * is not a clone of this parent (it misses one of the parent's other completions).
 */
export function carryLateAddedAssumptions<T extends Stage2LateAddedDraftState>(
  parent: Stage2LateAddedDraftState,
  successor: T,
): T | null {
  const carried = parent.completedQuestionIds.filter(
    (questionId) =>
      isLateAddedQuestionId(questionId) &&
      parent.answerProvenance[questionId] === "assumed" &&
      !successor.completedQuestionIds.includes(questionId),
  )
  if (carried.length === 0) return null
  const isClone = parent.completedQuestionIds
    .filter((questionId) => !carried.includes(questionId))
    .every((questionId) => successor.completedQuestionIds.includes(questionId))
  if (!isClone) return null

  let answers = successor.answers
  for (const questionId of carried) {
    answers = findAssumptionRule({
      questionId,
      answers,
      triggerContext: successor.triggerContext,
    }).write({
      questionId,
      answers,
      triggerContext: successor.triggerContext,
    })
  }
  const { path } = resolveStage2RefinementContract({
    triggerContext: successor.triggerContext,
    answers,
    completedQuestionIds: [...successor.completedQuestionIds, ...carried],
  })
  if (carried.some((questionId) => !path.completedQuestionIds.includes(questionId))) return null
  const answerProvenance = { ...successor.answerProvenance }
  for (const questionId of carried) answerProvenance[questionId] = "assumed"
  return {
    ...successor,
    answers,
    completedQuestionIds: path.completedQuestionIds,
    answerProvenance,
  }
}

/**
 * Module status companion of `normalizeLateAddedQuestions`: a module whose ONLY open questions
 * are late-added ones answered by their assumption counts as finished — the member finished it
 * before the question existed. A module that is open for any other reason keeps every open
 * question (a direct-acceptance draft still walks all of them), and an unanswered late-added
 * question stays open.
 */
export function settleLateAddedAssumptions(
  states: Record<Stage2Module, Stage2ModulePathState>,
  input: {
    completedQuestionIds: readonly Stage2QuestionId[]
    answerProvenance: Stage2AnswerProvenance
  },
): Record<Stage2Module, Stage2ModulePathState> {
  const isSettled = (questionId: Stage2QuestionId) =>
    isLateAddedQuestionId(questionId) &&
    input.completedQuestionIds.includes(questionId) &&
    input.answerProvenance[questionId] === "assumed"
  const settled = { ...states }
  for (const stage2Module of STAGE2_MODULES) {
    const state = states[stage2Module]
    if (state.openQuestionIds.length === 0 || !state.openQuestionIds.every(isSettled)) continue
    settled[stage2Module] = {
      ...state,
      completedQuestionIds: [...state.questionIds],
      openQuestionIds: [],
      status: "complete",
    }
  }
  return settled
}

/* ── answer selection by question id ─────────────────────────────────────── */

const STAGE2_ANSWER_KEY_BY_QUESTION_ID: Record<
  Stage2StaticQuestionId,
  Exclude<Stage2AnswerKey, "heatEvents">
> = {
  current_product_categories: "currentProductCategories",
  wet_wash_frequency: "wetWashFrequency",
  bondbuilder_timing: "bondbuilderTiming",
  scalp_irritation_detail: "scalpIrritationDetail",
  dry_shampoo_bridge_preference: "dryShampooBridgePreference",
  dry_shampoo_visible_hair_color: "dryShampooVisibleHairColor",
  oil_purposes: "oilPurposes",
  towel_handling: "towel",
  drying_routes: "dryingRoutes",
  additional_heat_tools: "additionalHeatTools",
  night_protection: "nightProtection",
  night_wear: "nightWear",
}

/**
 * Narrows an answer set to the answers owned by the given canonical question
 * ids. The provenance read path uses it to strip assumed answers back out
 * before re-resolving them. A tool page owns exactly its own `toolForms[pageKey]`;
 * the overview owns `toolFamiliesWithSomething` and the explicit `[]` it wrote on every page of
 * an unticked family.
 */
export function selectStage2Answers(
  answers: PersonalPlanRefinementAnswersV1,
  questionIds: readonly Stage2QuestionId[],
): PersonalPlanRefinementAnswersV1 {
  const selected: PersonalPlanRefinementAnswersV1 = {}
  const heatEvents: Record<string, HeatEventAnswer> = {}
  let hasHeatEvent = false

  const toolForms: Partial<Record<ToolFormPageKey, unknown>> = {}
  let hasToolForm = false

  for (const questionId of questionIds) {
    if (questionId.startsWith("heat:")) {
      const event = answers.heatEvents?.[questionId]
      if (event) {
        heatEvents[questionId] = event
        hasHeatEvent = true
      }
      continue
    }
    if (questionId === "tools_overview") {
      if (answers.toolFamiliesWithSomething !== undefined) {
        selected.toolFamiliesWithSomething = answers.toolFamiliesWithSomething
        // The overview also wrote the explicit none of every unticked family's pages.
        for (const pageKey of overviewOwnedPages(answers.toolFamiliesWithSomething)) {
          const forms = answers.toolForms?.[pageKey]
          if (forms === undefined) continue
          toolForms[pageKey] = forms
          hasToolForm = true
        }
      }
      continue
    }
    if (questionId.startsWith("tools:")) {
      const pageKey = questionId.slice("tools:".length)
      const forms = isToolFormPageKey(pageKey) ? answers.toolForms?.[pageKey] : undefined
      if (isToolFormPageKey(pageKey) && forms !== undefined) {
        toolForms[pageKey] = forms
        hasToolForm = true
      }
      continue
    }
    const answerKey = STAGE2_ANSWER_KEY_BY_QUESTION_ID[questionId as Stage2StaticQuestionId]
    if (!answerKey) continue
    const value = answers[answerKey]
    if (value !== undefined) (selected as Record<string, unknown>)[answerKey] = value
  }
  if (hasToolForm) selected.toolForms = toolForms as PersonalPlanRefinementAnswersV1["toolForms"]
  return hasHeatEvent ? { ...selected, heatEvents } : selected
}

/* ── helpers ─────────────────────────────────────────────────────────────── */

/**
 * The overview answer exactly as an interactive submit stores it (`session.ts`): the families,
 * plus an explicit `[]` on every page of an unticked family.
 */
function withToolOverview(
  answers: PersonalPlanRefinementAnswersV1,
  families: readonly ToolFamily[],
): PersonalPlanRefinementAnswersV1 {
  const ticked = new Set(families)
  const toolForms = { ...answers.toolForms }
  for (const page of TOOL_FORM_PAGES) {
    if (!ticked.has(page.family)) toolForms[page.pageKey] = []
  }
  return { ...answers, toolFamiliesWithSomething: [...families], toolForms }
}

/** The pages the overview answer stands for: every page of a family it left unticked. */
function overviewOwnedPages(families: readonly ToolFamily[] | undefined): ToolFormPageKey[] {
  if (!families) return []
  const ticked = new Set(families)
  return TOOL_FORM_PAGES.filter((page) => !ticked.has(page.family)).map((page) => page.pageKey)
}

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
