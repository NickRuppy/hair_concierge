import type { InitialNeedPlanSnapshot, PlanRoutineContext } from "@/lib/personal-plan/types"

import { projectStage2HeatEvents } from "./heat-events"
import {
  getEffectiveDryShampooBridgePreference,
  resolveStage2RefinementContract,
} from "./question-path"
import type {
  PersonalPlanRefinementAnswersV1,
  Stage2QuestionId,
  Stage2TriggerContext,
} from "./types"

const STAGE2_HEAT_SOURCE_RULE_IDS = ["post_plan_onboarding:heat_tool_use"]

type CompletedRefinementInput = {
  triggerContext: Stage2TriggerContext
  answers: PersonalPlanRefinementAnswersV1
  completedQuestionIds: readonly Stage2QuestionId[]
}

export function deriveStage2TriggerContext(
  snapshot: InitialNeedPlanSnapshot,
): Stage2TriggerContext {
  const dryShampoo = snapshot.decisions.find((decision) => decision.category === "dry_shampoo")

  return {
    relevantCategories: [...snapshot.renderedOrder],
    hasReportedIrritatedScalp: snapshot.profile.scalp.concerns.includes("irritated"),
    dryShampooBridgeEligibility:
      dryShampoo?.resolution === "deferred_until_post_plan_onboarding" &&
      dryShampoo.deferredFacts.includes("dry_shampoo_bridge_preference")
        ? "eligible"
        : "ineligible",
  }
}

export function buildPlanRoutineContextFromCompletedRefinement(
  input: CompletedRefinementInput,
): PlanRoutineContext {
  const contract = resolveStage2RefinementContract(input)
  if (!contract.isComplete) {
    throw new Error(
      `Stage 2 refinement is incomplete: ${contract.path.firstUnresolvedQuestionId ?? "unknown"}`,
    )
  }

  const shampooFrequency = contract.answers.wetWashFrequency
  if (!shampooFrequency) {
    throw new Error("Stage 2 refinement is incomplete: wet_wash_frequency")
  }

  const dryShampooBridgePreference = getEffectiveDryShampooBridgePreference(contract.answers)

  return {
    shampooFrequency: { state: "known", value: shampooFrequency },
    heatToolUse: {
      state: "known",
      value: projectStage2HeatEvents(contract.answers).map((event) => ({
        id: event.id,
        tool: event.tool,
        route: event.route,
        frequency: event.frequency,
        sourceRuleIds: [...STAGE2_HEAT_SOURCE_RULE_IDS],
      })),
    },
    dryShampooBridgePreference: dryShampooBridgePreference
      ? { state: "known", value: dryShampooBridgePreference }
      : { state: "unknown", reason: "dry_shampoo_bridge_preference" },
    scalpIrritationState:
      input.triggerContext.hasReportedIrritatedScalp && contract.answers.scalpIrritationDetail
        ? { state: "known", value: contract.answers.scalpIrritationDetail }
        : { state: "unknown", reason: "scalp_irritation_detail" },
  }
}
