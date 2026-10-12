import { createStage2RefinementSession } from "@/lib/personal-plan/refinement/session"
import type {
  PersonalPlanRefinementAnswersV1,
  Stage2QuestionId,
  Stage2TriggerContext,
} from "@/lib/personal-plan/refinement/types"
import { toCareHabitsPatch, toFieldProvenance } from "@/lib/user-facts/from-refinement-draft"
import { careHabitsV1Schema } from "@/lib/user-facts/schema"

/**
 * Lena (plan `plans/2026-10-09-hair-tools-port.md` §6): products answered, every tool page and
 * every Gewohnheiten question except the Rev. 6 night question (`night_wear`) answered by her; it
 * stays on her path unanswered, because the trigger context carries no `hairLength`. One draft feeds every surface of the lab — the
 * Feinschliff pages, the Tool-Checkpoint, and (through the same `care_habits` projection the
 * completion writes) the read-time tool view on Stage 1, Routine and Anwendung. No DB.
 */

export const TOOLS_LAB_TRIGGER_CONTEXT: Stage2TriggerContext = {
  relevantCategories: ["shampoo", "mask", "heat_protectant"],
  hasReportedIrritatedScalp: false,
  dryShampooBridgeEligibility: "ineligible",
  toolsEnabled: true,
}

export const TOOLS_LAB_ANSWERS: PersonalPlanRefinementAnswersV1 = {
  currentProductCategories: [],
  wetWashFrequency: "weekly_2x",
  toolFamiliesWithSomething: [
    "drying_textiles",
    "brushes_combs",
    "airflow",
    "heated_styling",
    "heatless_styling",
    "securing_sectioning",
    "night_protection",
  ],
  toolForms: {
    "drying_textiles:1": ["microfiber_towel"],
    "brushes_combs:1": ["wide_tooth_comb"],
    "brushes_combs:2": ["round_brush"],
    "airflow:1": ["hair_dryer", "hot_air_brush"],
    "heated_styling:1": ["flat_iron"],
    "heatless_styling:1": [],
    "securing_sectioning:1": [],
    "securing_sectioning:2": [],
    "night_protection:1": ["pillowcase"],
  },
  // The material is derived from the Handtücher page; only the technique is asked.
  towel: { technique: "gentle_press" } as never,
  dryingRoutes: ["air_dry", "ordinary_blow_dry"],
  heatEvents: {
    "heat:ordinary_blow_dry": { frequency: "weekly_2x" },
    "heat:dryer_brush": { frequency: "weekly_1x", protectionConsistency: "always" },
    "heat:straightener": { frequency: "weekly_1x", protectionConsistency: "sometimes" },
  },
}

const PRODUCTS_IDS: Stage2QuestionId[] = ["current_product_categories", "wet_wash_frequency"]

const TOOL_IDS: Stage2QuestionId[] = [
  "tools_overview",
  "tools:drying_textiles:1",
  "tools:brushes_combs:1",
  "tools:brushes_combs:2",
  "tools:airflow:1",
  "tools:heated_styling:1",
  "tools:heatless_styling:1",
  "tools:securing_sectioning:1",
  "tools:securing_sectioning:2",
  "tools:night_protection:1",
]

const HABIT_IDS: Stage2QuestionId[] = [
  "towel_handling",
  "drying_routes",
  "heat:ordinary_blow_dry",
  "heat:dryer_brush",
  "heat:straightener",
]

/** The draft right after the tools module completed (Gewohnheiten still open). */
export function toolsLabToolsDoneSession() {
  return createStage2RefinementSession({
    pathVersion: "labs-personal-plan-tools",
    triggerContext: TOOLS_LAB_TRIGGER_CONTEXT,
    answers: TOOLS_LAB_ANSWERS,
    completedQuestionIds: [...PRODUCTS_IDS, ...TOOL_IDS],
    revision: 12,
  })
}

/** The member's `care_habits` facts after every module, as the completion writes them. */
export function toolsLabCareFacts() {
  const session = createStage2RefinementSession({
    pathVersion: "labs-personal-plan-tools",
    triggerContext: TOOLS_LAB_TRIGGER_CONTEXT,
    answers: TOOLS_LAB_ANSWERS,
    completedQuestionIds: [...PRODUCTS_IDS, ...TOOL_IDS, ...HABIT_IDS],
    revision: 17,
  })
  const completedQuestionIds = session.path.completedQuestionIds
  return {
    careHabits: careHabitsV1Schema.parse(
      toCareHabitsPatch(session.answers, { completedQuestionIds }),
    ),
    fieldProvenance: toFieldProvenance({
      completedQuestionIds,
      answerProvenance: {},
      answers: session.answers,
    }),
  }
}
