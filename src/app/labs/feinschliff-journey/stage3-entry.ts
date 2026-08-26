import { STAGE1_STAGE2_LAB_ENVELOPE } from "@/app/labs/personal-plan-stage-1-2/fixture"
import { computeNeedPlan } from "@/lib/personal-plan/compute-stage1"
import type { Stage3EntryContext } from "@/lib/personal-plan/products/contracts"
import { buildStage3EntryContext } from "@/lib/personal-plan/products/stage2-entry-adapter"
import { buildPlanRoutineContextFromCompletedRefinement } from "@/lib/personal-plan/refinement/stage1-adapter"
import type {
  PersonalPlanRefinementAnswersV1,
  Stage2QuestionId,
  Stage2TriggerContext,
} from "@/lib/personal-plan/refinement/types"

import { DEMO_PERSONAL_PLAN_ID, DEMO_REFINED_VERSION_ID } from "./fixtures"

/**
 * The Stage-3 entry context the demo hands to `Stage3ProductsFlow`.
 *
 * It is built once, server-side, from the SAME complete answer set the
 * `personal-plan-stage-2` lab's `complete` scenario uses — deliberately not
 * from whatever the demo user just clicked in the products module, because
 * `buildPlanRoutineContextFromCompletedRefinement` requires a complete
 * refinement and a single module never is one. Documented as a degraded step
 * in the journey-demo report.
 */

const TRIGGER_CONTEXT: Stage2TriggerContext = {
  relevantCategories: ["shampoo", "mask", "heat_protectant"],
  hasReportedIrritatedScalp: false,
  dryShampooBridgeEligibility: "ineligible",
}

const ANSWERS: PersonalPlanRefinementAnswersV1 = {
  currentProductCategories: ["shampoo"],
  wetWashFrequency: "weekly_2x",
  towel: { material: "no_towel" },
  dryingRoutes: [],
  additionalHeatTools: [],
  nightProtection: [],
}

const COMPLETED_QUESTION_IDS: Stage2QuestionId[] = [
  "current_product_categories",
  "wet_wash_frequency",
  "towel_handling",
  "drying_routes",
  "additional_heat_tools",
  "night_protection",
]

export function buildFeinschliffJourneyStage3EntryContext(): Stage3EntryContext | null {
  const routine = buildPlanRoutineContextFromCompletedRefinement({
    triggerContext: TRIGGER_CONTEXT,
    answers: ANSWERS,
    completedQuestionIds: COMPLETED_QUESTION_IDS,
  })
  const refined = computeNeedPlan({
    rawEnvelope: STAGE1_STAGE2_LAB_ENVELOPE,
    artifactId: "11111111-1111-4111-8111-111111111111",
    projection: "refined_post_plan",
    computationVersion: "stage1-v1",
    createdAt: "2026-08-26T12:10:00.000Z",
    routine,
  })
  if (refined.status !== "ready") return null
  return buildStage3EntryContext(refined.snapshot, {
    personalPlanId: DEMO_PERSONAL_PLAN_ID,
    refinedVersionId: DEMO_REFINED_VERSION_ID,
  })
}
