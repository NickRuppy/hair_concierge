"use client"

import { useMemo } from "react"

import {
  RefinementFlow,
  type Stage2HandoffPayload,
} from "@/components/personal-plan-refinement/refinement-flow"
import type {
  Stage2RefinementGateway,
  Stage2SaveAnswerInput,
} from "@/lib/personal-plan/refinement/gateway"
import { createStage2FixtureGateway } from "@/lib/personal-plan/refinement/fixture-gateway"
import type {
  PersonalPlanRefinementAnswersV1,
  Stage2QuestionId,
  Stage2TriggerContext,
} from "@/lib/personal-plan/refinement/types"

export type Stage2PreviewScenario =
  | "ready"
  | "conditional"
  | "save-error"
  | "conflict"
  | "resume"
  | "complete"
  | "complete-error"

export function Stage2PreviewClient({
  scenario,
  triggerContext,
  onHandoff,
}: {
  scenario: Stage2PreviewScenario
  triggerContext?: Stage2TriggerContext
  onHandoff?: (payload: Stage2HandoffPayload) => void | Promise<void>
}) {
  const gateway = useMemo(
    () => createPreviewGateway(scenario, triggerContext),
    [scenario, triggerContext],
  )

  return (
    <div data-stage2-preview-scenario={scenario}>
      <RefinementFlow
        gateway={gateway}
        onSecondaryExit={() => {
          // Preview-safe no-op: the customer component must not invent a Bedarfsplan href.
        }}
        onHandoff={onHandoff}
      />
    </div>
  )
}

export function createPreviewGateway(
  scenario: Stage2PreviewScenario,
  triggerContext?: Stage2TriggerContext,
): Stage2RefinementGateway {
  const fixture = createStage2FixtureGateway({
    runtimeEnvironment: process.env.NODE_ENV === "test" ? "test" : "development",
    triggerContext: triggerContext ?? triggerContextForScenario(scenario),
    initialAnswers: initialAnswersForScenario(scenario),
    initialCompletedQuestionIds: completedQuestionsForScenario(scenario),
    initialRevision: scenario === "resume" ? 7 : scenario === "complete" ? 12 : 0,
    initialStatus: scenario === "complete" ? "complete" : "in_progress",
    failNextSave: scenario === "save-error",
    failNextComplete: scenario === "complete-error",
  })

  if (scenario !== "conflict") return fixture

  let shouldConflict = true
  return {
    load: () => fixture.load(),
    complete: (input) => fixture.complete(input),
    saveAnswer: async (input: Stage2SaveAnswerInput) => {
      if (shouldConflict) {
        shouldConflict = false
        fixture.simulateExternalRevision()
      }
      return fixture.saveAnswer(input)
    },
  }
}

function triggerContextForScenario(scenario: Stage2PreviewScenario): Stage2TriggerContext {
  if (scenario === "ready" || scenario === "complete" || scenario === "complete-error") {
    return {
      relevantCategories: ["shampoo", "mask", "heat_protectant"],
      hasReportedIrritatedScalp: false,
      dryShampooBridgeEligibility: "ineligible",
    }
  }
  return {
    relevantCategories: ["shampoo", "mask", "heat_protectant", "oil", "dry_shampoo"],
    hasReportedIrritatedScalp: true,
    dryShampooBridgeEligibility: "eligible",
  }
}

function initialAnswersForScenario(
  scenario: Stage2PreviewScenario,
): PersonalPlanRefinementAnswersV1 | undefined {
  if (scenario === "resume") {
    return {
      currentProductCategories: ["shampoo", "oil"],
      wetWashFrequency: "weekly_2x",
      scalpIrritationDetail: "mild_sensitive_or_itchy",
      dryShampooBridgePreference: "decline",
      oilPurposes: ["dry_finish"],
      towel: { material: "mikrofaser", technique: "gentle_press" },
      dryingRoutes: ["air_dry", "ordinary_blow_dry"],
      additionalHeatTools: [],
      heatEvents: {
        "heat:ordinary_blow_dry": { frequency: "weekly_2x" },
      },
    }
  }
  if (scenario === "complete") {
    return completeAnswers()
  }
  return undefined
}

function completedQuestionsForScenario(scenario: Stage2PreviewScenario): Stage2QuestionId[] {
  if (scenario === "resume") {
    return [
      "current_product_categories",
      "wet_wash_frequency",
      "scalp_irritation_detail",
      "dry_shampoo_bridge_preference",
      "oil_purposes",
      "towel_handling",
      "drying_routes",
      "additional_heat_tools",
      "heat:ordinary_blow_dry",
    ]
  }
  if (scenario === "complete") {
    return [
      "current_product_categories",
      "wet_wash_frequency",
      "towel_handling",
      "drying_routes",
      "additional_heat_tools",
      "night_protection",
    ]
  }
  return []
}

function completeAnswers(): PersonalPlanRefinementAnswersV1 {
  return {
    currentProductCategories: ["shampoo"],
    wetWashFrequency: "weekly_2x",
    towel: { material: "no_towel" },
    dryingRoutes: [],
    additionalHeatTools: [],
    nightProtection: [],
  }
}
