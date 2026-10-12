"use client"

import { useMemo, useState } from "react"

import {
  RefinementFlow,
  type Stage2HandoffPayload,
  type Stage2ModuleCompletionPayload,
  type Stage2ModuleProgress,
} from "@/components/personal-plan-refinement/refinement-flow"
import type {
  Stage2RefinementGateway,
  Stage2SaveAnswerInput,
} from "@/lib/personal-plan/refinement/gateway"
import {
  stage2SecondaryExitDestination,
  type Stage2ModuleEntryRequest,
} from "@/lib/personal-plan/refinement/module-scope"
import { createStage2FixtureGateway } from "@/lib/personal-plan/refinement/fixture-gateway"
import type { Stage2RefinementSession } from "@/lib/personal-plan/refinement/session"
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
  /** Modul-scoped entries (Task 2.4): walk ONE module and finish it. */
  | "module-products"
  /** Hair Tools port: the tools module with the rollout on (`toolsEnabled`), products answered. */
  | "module-tools"
  | "module-habits"
  /** Modul deep link on a COMPLETE draft — the direct-accept cohort. */
  | "module-direct-accept"

/** The module a scenario enters with; `undefined` keeps the legacy linear flow. */
export function moduleEntryForScenario(
  scenario: Stage2PreviewScenario,
): Stage2ModuleEntryRequest | undefined {
  if (scenario === "module-products" || scenario === "module-direct-accept") return "products"
  if (scenario === "module-tools") return "tools"
  if (scenario === "module-habits") return "habits"
  return undefined
}

export function Stage2PreviewClient({
  scenario,
  triggerContext,
  onHandoff,
  onModuleComplete,
  autoHandoff,
  moduleProgress,
  seedSession,
}: {
  scenario: Stage2PreviewScenario
  triggerContext?: Stage2TriggerContext
  /**
   * A draft carried over from an earlier step of a multi-step lab (`/labs/feinschliff-journey`):
   * the module then starts from what the reviewer just answered instead of the scenario's
   * fixture answers.
   */
  seedSession?: Stage2RefinementSession
  onHandoff?: (payload: Stage2HandoffPayload) => void | Promise<void>
  onModuleComplete?: (payload: Stage2ModuleCompletionPayload) => void | Promise<void>
  autoHandoff?: boolean
  /** The coarse "X von 4" a host would carry over from the Routine banner. */
  moduleProgress?: Stage2ModuleProgress | null
}) {
  const gateway = useMemo(
    () => createPreviewGateway(scenario, triggerContext, seedSession),
    [scenario, triggerContext, seedSession],
  )
  const moduleEntry = moduleEntryForScenario(scenario)
  const [secondaryExit, setSecondaryExit] = useState<"routine" | "stage1" | null>(null)

  return (
    <div
      data-stage2-preview-scenario={scenario}
      {...(secondaryExit ? { "data-stage2-secondary-exit": secondaryExit } : {})}
    >
      <RefinementFlow
        gateway={gateway}
        moduleEntry={moduleEntry}
        moduleProgress={moduleProgress}
        // Every module-scoped scenario here (`module-products`, `module-habits`,
        // `module-direct-accept`) models an explicit deep link into an EXISTING
        // plan's module — the post-accept loop. Labs has no scenario for the
        // unaccepted-cohort exception (a hand-built `?refine=habits` link on a
        // draft that was never accepted; T2.1) — add one if that cohort ever
        // needs a QA harness.
        postAcceptModuleEntry={moduleEntry !== undefined}
        onSecondaryExit={() => {
          // The preview must not invent an Idealplan href, but it records the
          // destination the production host would route to — the SAME shared
          // rule, so the harness cannot pass on a stubbed no-op.
          setSecondaryExit(stage2SecondaryExitDestination(moduleEntry))
        }}
        onHandoff={onHandoff}
        onModuleComplete={onModuleComplete}
        autoHandoff={autoHandoff}
      />
    </div>
  )
}

export function createPreviewGateway(
  scenario: Stage2PreviewScenario,
  triggerContext?: Stage2TriggerContext,
  seedSession?: Stage2RefinementSession,
): Stage2RefinementGateway {
  if (seedSession) {
    return createStage2FixtureGateway({
      runtimeEnvironment: process.env.NODE_ENV === "test" ? "test" : "development",
      triggerContext: seedSession.triggerContext,
      initialAnswers: seedSession.answers,
      initialCompletedQuestionIds: [...seedSession.completedQuestionIds],
      initialRevision: seedSession.revision,
      initialStatus: "in_progress",
    })
  }
  const fixture = createStage2FixtureGateway({
    runtimeEnvironment: process.env.NODE_ENV === "test" ? "test" : "development",
    triggerContext: triggerContext ?? triggerContextForScenario(scenario),
    initialAnswers: initialAnswersForScenario(scenario),
    initialCompletedQuestionIds: completedQuestionsForScenario(scenario),
    initialRevision:
      scenario === "resume"
        ? 7
        : scenario === "complete"
          ? 12
          : scenario === "module-habits" || scenario === "module-tools"
            ? 2
            : scenario === "module-direct-accept"
              ? 9
              : 0,
    initialStatus:
      scenario === "complete" || scenario === "module-direct-accept" ? "complete" : "in_progress",
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
  if (scenario === "module-tools") {
    return {
      relevantCategories: ["shampoo", "mask", "heat_protectant"],
      hasReportedIrritatedScalp: false,
      dryShampooBridgeEligibility: "ineligible",
      toolsEnabled: true,
      // Rev. 6: hair that can be tied, so the Gewohnheiten night question („Wie trägst du dein
      // Haar nachts?") is on the path when the journey lab continues into the habits module.
      hairLength: "long",
    }
  }
  if (
    scenario === "ready" ||
    scenario === "complete" ||
    scenario === "complete-error" ||
    scenario === "module-products" ||
    scenario === "module-habits" ||
    scenario === "module-direct-accept"
  ) {
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
  if (scenario === "complete" || scenario === "module-direct-accept") {
    return completeAnswers()
  }
  if (scenario === "module-habits") {
    // Modul 1 done, Modul 2 untouched — the state a `products` completion leaves.
    return { currentProductCategories: ["shampoo"], wetWashFrequency: "weekly_2x" }
  }
  if (scenario === "module-tools") {
    // Produkte done; the member's earlier Gewohnheiten answers imply a towel and a Satin pillow,
    // so the overview opens with those sections pre-ticked — a starting value, nothing saved.
    return {
      currentProductCategories: ["shampoo"],
      wetWashFrequency: "weekly_2x",
      towel: { material: "mikrofaser", technique: "gentle_press" },
      nightProtection: ["silk_satin_pillow"],
    }
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
  if (scenario === "complete" || scenario === "module-direct-accept") {
    return [
      "current_product_categories",
      "wet_wash_frequency",
      "towel_handling",
      "drying_routes",
      "additional_heat_tools",
      "night_protection",
    ]
  }
  if (scenario === "module-habits" || scenario === "module-tools") {
    return ["current_product_categories", "wet_wash_frequency"]
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
