import assert from "node:assert/strict"
import { readFile, readdir } from "node:fs/promises"
import path from "node:path"
import test from "node:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"

import {
  REFINEMENT_CATEGORY_DISPLAY_OPTIONS,
  REFINEMENT_CATEGORY_OPTIONS,
  REFINEMENT_TELEMETRY_EVENTS,
  RefinementQuestion,
  getAnswerForQuestion,
  getQuestionFamily,
  getQuestionSection,
  isLocalAnswerComplete,
  type RefinementQuestionStatus,
} from "../src/components/personal-plan-refinement/refinement-question"
import {
  ADDITIONAL_HEAT_TOOL_OPTIONS,
  DRYING_ROUTE_OPTIONS,
  NIGHT_PROTECTION_OPTIONS,
  OIL_PURPOSE_OPTIONS,
  WET_WASH_FREQUENCY_OPTIONS,
  mergeGroupedCategorySelection,
} from "../src/components/personal-plan-refinement/refinement-options"
import {
  RefinementFlow,
  getCompletedHandoffForLoadedSession,
  getBridgeBackQuestionId,
  stage3HandoffFailure,
  type Stage2RefinementTelemetryEvent,
} from "../src/components/personal-plan-refinement/refinement-flow"
import {
  createPreviewGateway,
  moduleEntryForScenario,
  type Stage2PreviewScenario,
} from "../src/app/labs/personal-plan-stage-2/preview-client"
import {
  createStage2RefinementSession,
  type Stage2RefinementSession,
} from "../src/lib/personal-plan/refinement/session"
import {
  ADDITIONAL_HEAT_TOOLS,
  DRYING_ROUTES,
  OIL_PURPOSES,
  STAGE2_PRODUCT_CATEGORIES,
  type PersonalPlanRefinementAnswersV1,
  type Stage2QuestionId,
  type Stage2TriggerContext,
} from "../src/lib/personal-plan/refinement/types"
import { NIGHT_PROTECTIONS } from "../src/lib/vocabulary/onboarding-care"
import { Stage3PreparationError } from "../src/lib/personal-plan/products/bootstrap-recovery"
import { Stage3ProductsGatewayError } from "../src/lib/personal-plan/products/gateway"

const baseTriggerContext: Stage2TriggerContext = {
  relevantCategories: ["shampoo", "mask", "heat_protectant"],
  hasReportedIrritatedScalp: true,
  dryShampooBridgeEligibility: "eligible",
}

function countOccurrences(source: string, needle: string): number {
  return source.split(needle).length - 1
}

test("Stage 2 handoff failures keep recovery semantics instead of collapsing to retry", () => {
  assert.deepEqual(stage3HandoffFailure(new Stage3PreparationError("contract_violation", true)), {
    kind: "contract_violation",
    diagnosticQueued: true,
  })
  assert.deepEqual(
    stage3HandoffFailure(new Stage3ProductsGatewayError("stale_authority_snapshot")),
    { kind: "checkpoint_changed", diagnosticQueued: false },
  )
  assert.deepEqual(stage3HandoffFailure(new Error("network")), {
    kind: "transient",
    diagnosticQueued: false,
  })
})

test("Stage 2 ordinary answer saves stay in the question flow without a full-screen interstitial", async () => {
  const flowSource = await readFile(
    new URL("../src/components/personal-plan-refinement/refinement-flow.tsx", import.meta.url),
    "utf8",
  )

  assert.doesNotMatch(flowSource, /type RefinementMode = .*"saving"/)
  assert.doesNotMatch(flowSource, /SavingTransitionShell/)
  assert.doesNotMatch(flowSource, /setMode\("saving"\)/)
  assert.match(flowSource, /Antwort wird gespeichert\. Nächste Frage geladen\./)
  assert.match(flowSource, /if \(status === "saving"\) return/)
})

test("the Stage-2 bridge is an inline handoff shell without chapter ceremony", () => {
  const completeSession = createStage2RefinementSession({
    pathVersion: "stage2-ui-test",
    triggerContext: {
      relevantCategories: ["shampoo"],
      hasReportedIrritatedScalp: false,
      dryShampooBridgeEligibility: "ineligible",
    },
    answers: {
      currentProductCategories: [],
      wetWashFrequency: "weekly_1x",
      towel: { material: "no_towel" },
      dryingRoutes: [],
      additionalHeatTools: [],
      nightProtection: [],
    },
    completedQuestionIds: [
      "current_product_categories",
      "wet_wash_frequency",
      "towel_handling",
      "drying_routes",
      "additional_heat_tools",
      "night_protection",
    ],
    completedHandoff: {
      refinedVersionId: "fixture-refined-stage2-v1-r9",
      nextHref: "/plan-start",
    },
    status: "complete",
  })
  const gateway = {
    load: async () => completeSession,
    saveAnswer: async () => completeSession,
    complete: async () => completeSession.completedHandoff!,
  } as unknown as React.ComponentProps<typeof RefinementFlow>["gateway"]
  const bridgeHtml = renderToStaticMarkup(
    <RefinementFlow gateway={gateway} initialSession={completeSession} />,
  )

  assert.match(bridgeHtml, /Deine Produkte werden vorbereitet\./)
  assert.match(bridgeHtml, /Feinschliff gespeichert/)
  assert.match(bridgeHtml, /fixture-refined-stage2-v1-r9/)
  assert.match(bridgeHtml, /data-stage2-next-href="\/plan-start"/)
  assert.doesNotMatch(bridgeHtml, /data-personal-plan-chapter/)
  assert.doesNotMatch(bridgeHtml, /Produkte erfassen/)
  assert.doesNotMatch(bridgeHtml, /<a\b/)
  assert.doesNotMatch(bridgeHtml, /Empfehlung|Delta|verändert|Tier|Routinekarte|Produktkarte/i)
})

test("Stage 2 flow source has no ResumeShell or chapter bridge branch", async () => {
  const flowSource = await readFile(
    new URL("../src/components/personal-plan-refinement/refinement-flow.tsx", import.meta.url),
    "utf8",
  )

  assert.doesNotMatch(flowSource, /ResumeShell/)
  assert.doesNotMatch(flowSource, /RefinementBridge/)
  assert.doesNotMatch(flowSource, /refinement-bridge/)
  assert.doesNotMatch(flowSource, /stage2BridgePresentation/)
  assert.match(flowSource, /openOptionalRefinement\?\.bind\(gateway\)/)
  assert.match(flowSource, /handoffInFlightRef/)
})

test("renders the current qualitative section and never a numeric question total", () => {
  const session = createStage2RefinementSession({
    pathVersion: "stage2-ui-test",
    triggerContext: baseTriggerContext,
    answers: {
      currentProductCategories: ["shampoo"],
      wetWashFrequency: "weekly_2x",
      scalpIrritationDetail: "mild_sensitive_or_itchy",
      dryShampooBridgePreference: "decline",
    },
    completedQuestionIds: [
      "current_product_categories",
      "wet_wash_frequency",
      "scalp_irritation_detail",
      "dry_shampoo_bridge_preference",
    ],
  })
  const html = renderToStaticMarkup(
    <RefinementQuestion
      session={session}
      questionId="towel_handling"
      localAnswer={undefined}
      onLocalAnswerChange={() => {}}
      status="idle"
      canGoBack
      onBack={() => {}}
      onSubmit={() => {}}
      onSecondaryExit={() => {}}
    />,
  )

  assert.match(html, /Wie du dein Haar behandelst/)
  assert.doesNotMatch(html, /Frage\s+\d+\s+von\s+\d+/i)
})

test("Stage 2 question chrome keeps Back and the wordmark but retires the 5-stage bar (Task 2.7)", () => {
  const session = createStage2RefinementSession({
    pathVersion: "stage2-ui-test",
    triggerContext: baseTriggerContext,
    answers: {
      currentProductCategories: ["shampoo"],
      wetWashFrequency: "weekly_2x",
      scalpIrritationDetail: "mild_sensitive_or_itchy",
      dryShampooBridgePreference: "decline",
    },
    completedQuestionIds: [
      "current_product_categories",
      "wet_wash_frequency",
      "scalp_irritation_detail",
      "dry_shampoo_bridge_preference",
    ],
  })
  const html = renderToStaticMarkup(
    <RefinementQuestion
      session={session}
      questionId="towel_handling"
      localAnswer={undefined}
      onLocalAnswerChange={() => {}}
      status="idle"
      canGoBack
      onBack={() => {}}
      onSubmit={() => {}}
      onSecondaryExit={() => {}}
    />,
  )

  assert.doesNotMatch(html, /Personal-Plan-Stufen/)
  assert.doesNotMatch(html, /role="progressbar"/)
  assert.match(html, />chaarlie</)
  assert.match(html, /aria-label="Zurück"/)
})

test("renders exactly ten contextual current-product categories with no preselection", () => {
  assert.equal(REFINEMENT_CATEGORY_OPTIONS.length, 10)
  assert.deepEqual(
    REFINEMENT_CATEGORY_OPTIONS.map((option) => option.value),
    [...STAGE2_PRODUCT_CATEGORIES],
  )

  const session = createStage2RefinementSession({
    pathVersion: "stage2-ui-test",
    triggerContext: baseTriggerContext,
  })
  const html = renderToStaticMarkup(
    <RefinementQuestion
      session={session}
      questionId="current_product_categories"
      localAnswer={undefined}
      onLocalAnswerChange={() => {}}
      status="idle"
      canGoBack={false}
      onBack={() => {}}
      onSubmit={() => {}}
      onSecondaryExit={() => {}}
    />,
  )

  for (const label of [
    "Shampoo",
    "Conditioner",
    "Leave-in",
    "Hitzeschutz",
    "Öl",
    "Maske",
    "Kopfhautpflege",
    "Trockenshampoo",
    "Bondbuilder",
    "Tiefenreinigungsshampoo",
  ]) {
    assert.match(html, new RegExp(label))
  }
  assert.equal(countOccurrences(html, 'aria-pressed="true"'), 0)
  assert.match(
    html,
    /Alle unterstützten Kategorien: zuerst für deinen Plan, danach alle weiteren\./,
  )
  assert.match(html, /Für deinen Plan/)
  assert.match(html, /Keine weiteren/)
  assert.match(html, /Produkt, das du vor Föhn, Glätteisen oder anderer direkter Hitze verwendest/)
  assert.match(html, /Serum, Tonic oder Peeling, das direkt auf die Kopfhaut kommt/)
})

test("UI option value order stays coupled to canonical Slice A vocabularies", () => {
  assert.deepEqual(
    REFINEMENT_CATEGORY_OPTIONS.map((option) => option.value),
    [...STAGE2_PRODUCT_CATEGORIES],
  )
  assert.deepEqual(
    OIL_PURPOSE_OPTIONS.map((option) => option.value),
    [...OIL_PURPOSES],
  )
  assert.deepEqual(
    DRYING_ROUTE_OPTIONS.map((option) => option.value),
    [...DRYING_ROUTES],
  )
  assert.deepEqual(
    ADDITIONAL_HEAT_TOOL_OPTIONS.map((option) => option.value),
    [...ADDITIONAL_HEAT_TOOLS],
  )
  assert.deepEqual(
    NIGHT_PROTECTION_OPTIONS.map((option) => option.value),
    [...NIGHT_PROTECTIONS],
  )
})

test("renders wet-wash frequency with the shared rare-to-daily slider and a separate no-wash branch", () => {
  assert.deepEqual(
    WET_WASH_FREQUENCY_OPTIONS.map((option) => option.value),
    [
      "less_than_monthly",
      "monthly_1x",
      "biweekly_1x",
      "weekly_1x",
      "weekly_2x",
      "weekly_3_4x",
      "weekly_5_6x",
      "daily_1x",
      "does_not_wash",
    ],
  )

  const session = createStage2RefinementSession({
    pathVersion: "stage2-ui-test",
    triggerContext: baseTriggerContext,
  })
  const html = renderToStaticMarkup(
    <RefinementQuestion
      session={session}
      questionId="wet_wash_frequency"
      localAnswer={undefined}
      onLocalAnswerChange={() => {}}
      status="idle"
      canGoBack={false}
      onBack={() => {}}
      onSubmit={() => {}}
      onSecondaryExit={() => {}}
    />,
  )

  assert.match(html, /data-wet-wash-frequency-scale="true"/)
  assert.match(html, /role="slider"/)
  assert.match(html, /aria-label="Häufigkeit der Haarwäsche"/)
  assert.match(html, /aria-valuemin="0"/)
  assert.match(html, /aria-valuemax="7"/)
  assert.match(html, /aria-label="&lt;1×\/Monat"/)
  assert.match(html, /aria-label="Alle 2 Wochen"/)
  assert.match(html, /data-slider-label-line="1"[^>]*>&lt;1×\/<\/span>/)
  assert.match(html, /data-slider-label-line="2"[^>]*>Monat<\/span>/)
  assert.doesNotMatch(html, /data-wet-wash-frequency-rail/)
  assert.doesNotMatch(html, /data-wet-wash-frequency-rank/)
  assert.ok(
    html.indexOf('data-slider-stop-label="less_than_monthly"') <
      html.indexOf('data-slider-stop-label="daily_1x"'),
  )
  assert.ok(
    html.indexOf('data-slider-stop-label="less_than_monthly"') <
      html.indexOf("Ich wasche meine Haare nicht nass"),
  )

  const resumedNoWashSession = createStage2RefinementSession({
    pathVersion: "stage2-ui-test",
    triggerContext: baseTriggerContext,
    answers: { wetWashFrequency: "does_not_wash" },
    completedQuestionIds: ["wet_wash_frequency"],
  })
  const resumedNoWashHtml = renderToStaticMarkup(
    <RefinementQuestion
      session={resumedNoWashSession}
      questionId="wet_wash_frequency"
      localAnswer={undefined}
      onLocalAnswerChange={() => {}}
      status="idle"
      canGoBack={false}
      onBack={() => {}}
      onSubmit={() => {}}
      onSecondaryExit={() => {}}
    />,
  )

  assert.match(resumedNoWashHtml, /aria-valuetext="Nicht ausgewählt"/)
  assert.match(
    resumedNoWashHtml,
    /aria-pressed="true"[\s\S]*?Ich wasche meine Haare nicht nass \/ mit Shampoo/,
  )
})

test("the secondary category empty action is group-local and preserves three primary selections", () => {
  const session = createStage2RefinementSession({
    pathVersion: "stage2-ui-test",
    triggerContext: baseTriggerContext,
    answers: { currentProductCategories: ["shampoo", "mask", "heat_protectant"] },
    completedQuestionIds: ["current_product_categories"],
  })
  const html = renderToStaticMarkup(
    <RefinementQuestion
      session={session}
      questionId="current_product_categories"
      localAnswer={["shampoo", "mask", "heat_protectant"]}
      onLocalAnswerChange={() => {}}
      status="idle"
      canGoBack={false}
      onBack={() => {}}
      onSubmit={() => {}}
      onSecondaryExit={() => {}}
    />,
  )

  assert.equal(countOccurrences(html, 'aria-pressed="true"'), 3)
  assert.match(html, /Weitere Kategorien/)
  assert.match(html, /Keine weiteren/)
  assert.match(html, /Du nutzt keine weiteren Kategorien/i)
  assert.match(html, /aria-label="Keine weiteren; ersetzt die Auswahl unter Weitere Kategorien"/)
  assert.doesNotMatch(
    html,
    /aria-pressed="true" aria-label="Keine weiteren; ersetzt die Auswahl unter Weitere Kategorien"/,
  )
})

test("an unanswered additional heat-tool selection stays distinct from an explicit empty answer", () => {
  const session = createStage2RefinementSession({
    pathVersion: "stage2-ui-test",
    triggerContext: baseTriggerContext,
  })
  const unansweredHtml = renderToStaticMarkup(
    <RefinementQuestion
      session={session}
      questionId="additional_heat_tools"
      localAnswer={undefined}
      onLocalAnswerChange={() => {}}
      status="idle"
      canGoBack
      onBack={() => {}}
      onSubmit={() => {}}
      onSecondaryExit={() => {}}
    />,
  )
  const explicitNoneHtml = renderToStaticMarkup(
    <RefinementQuestion
      session={session}
      questionId="additional_heat_tools"
      localAnswer={[]}
      onLocalAnswerChange={() => {}}
      status="idle"
      canGoBack
      onBack={() => {}}
      onSubmit={() => {}}
      onSecondaryExit={() => {}}
    />,
  )

  assert.doesNotMatch(
    unansweredHtml,
    /data-refinement-none-option="true"[\s\S]*?aria-pressed="true"/,
  )
  assert.match(unansweredHtml, /<button[^>]*disabled=""[^>]*>Weiter<\/button>/)
  assert.match(explicitNoneHtml, /data-refinement-none-option="true"[\s\S]*?aria-pressed="true"/)
  assert.match(explicitNoneHtml, /personal-plan-option-card quiz-card/)
  assert.doesNotMatch(explicitNoneHtml, /<button[^>]*disabled=""[^>]*>Weiter<\/button>/)
})

test("merges grouped category selections without dropping the other group", () => {
  const currentSelection = ["shampoo", "oil", "mask"] as const
  const relevantGroup = ["shampoo", "mask", "heat_protectant"] as const
  const remainingGroup = REFINEMENT_CATEGORY_OPTIONS.map((option) => option.value).filter(
    (value) => !relevantGroup.includes(value as (typeof relevantGroup)[number]),
  )

  assert.deepEqual(
    mergeGroupedCategorySelection({
      currentSelection: ["shampoo", "heat_protectant", "oil", "mask"],
      groupValues: remainingGroup,
      nextGroupSelection: [],
    }),
    ["shampoo", "heat_protectant", "mask"],
  )
  assert.deepEqual(
    mergeGroupedCategorySelection({
      currentSelection,
      groupValues: relevantGroup,
      nextGroupSelection: ["mask", "heat_protectant"],
    }),
    ["heat_protectant", "oil", "mask"],
  )
  assert.deepEqual(
    mergeGroupedCategorySelection({
      currentSelection,
      groupValues: remainingGroup,
      nextGroupSelection: ["conditioner", "oil"],
    }),
    ["shampoo", "conditioner", "oil", "mask"],
  )
  assert.deepEqual(
    mergeGroupedCategorySelection({
      currentSelection,
      groupValues: REFINEMENT_CATEGORY_OPTIONS.map((option) => option.value),
      nextGroupSelection: [],
    }),
    [],
  )
})

test("renders conservative severe-irritation boundary and accessible save/error shape", () => {
  const session = createStage2RefinementSession({
    pathVersion: "stage2-ui-test",
    triggerContext: baseTriggerContext,
    answers: {
      currentProductCategories: ["shampoo"],
      wetWashFrequency: "weekly_2x",
    },
    completedQuestionIds: ["current_product_categories", "wet_wash_frequency"],
  })
  const html = renderToStaticMarkup(
    <RefinementQuestion
      session={session}
      questionId="scalp_irritation_detail"
      localAnswer="burning_painful_or_inflamed"
      onLocalAnswerChange={() => {}}
      status="save_failed"
      canGoBack
      onBack={() => {}}
      onSubmit={() => {}}
      onSecondaryExit={() => {}}
      liveMessage="Speichern fehlgeschlagen"
    />,
  )

  assert.match(html, /brennend, schmerzhaft oder entzündet/i)
  assert.match(html, /Fühlt sich normal an/)
  assert.match(html, /kosmetische Kopfhaut-Empfehlungen pausieren/i)
  assert.match(html, /ärztliche oder dermatologische Einschätzung/i)
  assert.match(html, /role="alert"/)
  assert.match(html, /aria-live="polite"/)
  assert.match(html, /Erneut versuchen/)
})

test("constructs every Labs preview scenario and keeps complete canonical", async () => {
  const scenarios: Stage2PreviewScenario[] = [
    "ready",
    "conditional",
    "save-error",
    "conflict",
    "resume",
    "complete",
    "complete-error",
  ]

  for (const scenario of scenarios) {
    const gateway = createPreviewGateway(scenario)
    const session = await gateway.load()
    assert.equal(session.schemaVersion, 1)
    assert.equal(session.pathVersion, "stage2-fixture-v1")
    if (scenario === "complete") {
      assert.equal(session.status, "complete")
      assert.equal(session.path.firstUnresolvedQuestionId, null)
      assert.equal(session.triggerContext.hasReportedIrritatedScalp, false)
      assert.equal(session.triggerContext.dryShampooBridgeEligibility, "ineligible")
      assert.deepEqual(getCompletedHandoffForLoadedSession(session), session.completedHandoff)
    }
  }
})

test("loaded complete sessions require completedHandoff instead of a completion call", () => {
  const completeSession = createStage2RefinementSession({
    pathVersion: "stage2-ui-test",
    triggerContext: {
      relevantCategories: ["shampoo"],
      hasReportedIrritatedScalp: false,
      dryShampooBridgeEligibility: "ineligible",
    },
    answers: {
      currentProductCategories: [],
      wetWashFrequency: "weekly_1x",
      towel: { material: "no_towel" },
      dryingRoutes: [],
      additionalHeatTools: [],
      nightProtection: [],
    },
    completedQuestionIds: [
      "current_product_categories",
      "wet_wash_frequency",
      "towel_handling",
      "drying_routes",
      "additional_heat_tools",
      "night_protection",
    ],
    completedHandoff: {
      refinedVersionId: "fixture-refined-loaded-r9",
      nextHref: "/plan-start",
    },
    revision: 9,
    status: "complete",
  })
  assert.deepEqual(getCompletedHandoffForLoadedSession(completeSession), {
    refinedVersionId: "fixture-refined-loaded-r9",
    nextHref: "/plan-start",
  })

  const inconsistent = {
    ...completeSession,
    completedHandoff: undefined,
  } as Stage2RefinementSession
  assert.throws(() => getCompletedHandoffForLoadedSession(inconsistent), /completed handoff/)
})

test("bridge back targets the final canonical question", () => {
  const session = createStage2RefinementSession({
    pathVersion: "stage2-ui-test",
    triggerContext: {
      relevantCategories: ["shampoo"],
      hasReportedIrritatedScalp: false,
      dryShampooBridgeEligibility: "ineligible",
    },
    answers: {
      currentProductCategories: [],
      wetWashFrequency: "weekly_1x",
      towel: { material: "no_towel" },
      dryingRoutes: [],
      additionalHeatTools: [],
      nightProtection: [],
    },
    completedQuestionIds: [
      "current_product_categories",
      "wet_wash_frequency",
      "towel_handling",
      "drying_routes",
      "additional_heat_tools",
      "night_protection",
    ],
  })

  assert.equal(getBridgeBackQuestionId(session), "night_protection")
  assert.deepEqual(session.answers.nightProtection, [])
})

test("telemetry events are code-owned and expose only coarse safe properties", () => {
  assert.deepEqual(REFINEMENT_TELEMETRY_EVENTS, [
    "personal_plan_stage2_started",
    "personal_plan_stage2_question_viewed",
    "personal_plan_stage2_answer_saved",
    "personal_plan_stage2_save_failed",
    "personal_plan_stage2_resumed",
    "personal_plan_stage2_completed",
    "personal_plan_stage2_module_completed",
    "personal_plan_stage2_bridge_viewed",
    "personal_plan_stage2_handoff_failed",
  ])

  const viewed: Stage2RefinementTelemetryEvent = {
    name: "personal_plan_stage2_question_viewed",
    section: "current_products",
    family: "product_categories",
  }
  const failed: Stage2RefinementTelemetryEvent = {
    name: "personal_plan_stage2_save_failed",
    errorCode: "completion_failed",
  }
  const handoffFailed: Stage2RefinementTelemetryEvent = {
    name: "personal_plan_stage2_handoff_failed",
  }

  assert.deepEqual(Object.keys(viewed).sort(), ["family", "name", "section"])
  assert.deepEqual(Object.keys(failed).sort(), ["errorCode", "name"])
  const moduleCompleted: Stage2RefinementTelemetryEvent = {
    name: "personal_plan_stage2_module_completed",
    module: "products",
  }

  assert.deepEqual(Object.keys(handoffFailed), ["name"])
  assert.deepEqual(Object.keys(moduleCompleted).sort(), ["module", "name"])
  assert.doesNotMatch(
    JSON.stringify([viewed, failed, handoffFailed, moduleCompleted]),
    /questionId|answer|category|irritation|frequency|root/i,
  )
})

test("Labs previews are development guarded and keep fixture-gateway behind Labs clients", async () => {
  const pageSource = await readFile(
    new URL("../src/app/labs/personal-plan-stage-2/page.tsx", import.meta.url),
    "utf8",
  )
  assert.match(pageSource, /process\.env\.NODE_ENV !== "development"/)
  assert.match(pageSource, /notFound\(\)/)
  assert.match(pageSource, /scenario/)
  assert.doesNotMatch(pageSource, /fixture-gateway/)

  const previewSource = await readFile(
    new URL("../src/app/labs/personal-plan-stage-2/preview-client.tsx", import.meta.url),
    "utf8",
  )
  assert.match(previewSource, /fixture-gateway/)
  assert.match(previewSource, /ready|conditional|save-error|conflict|resume/)
  assert.match(previewSource, /module-products/)

  const srcRoot = path.resolve(new URL("../src", import.meta.url).pathname)
  const importers: string[] = []
  async function visit(directory: string): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const child = path.join(directory, entry.name)
      if (entry.isDirectory()) {
        await visit(child)
      } else if (/\.(ts|tsx)$/.test(entry.name)) {
        const source = await readFile(child, "utf8")
        if (source.includes("fixture-gateway")) importers.push(path.relative(srcRoot, child))
      }
    }
  }
  await visit(srcRoot)

  assert.deepEqual(importers.sort(), [
    // Dev-only Feinschliff-Einstieg demo harness (`/labs/feinschliff-journey`).
    "app/labs/feinschliff-journey/journey-client.tsx",
    "app/labs/personal-plan-stage-1-2/journey-client.tsx",
    "app/labs/personal-plan-stage-2/preview-client.tsx",
    "app/labs/personal-plan/stage-3/lab-client.tsx",
  ])
})

// ---------------------------------------------------------------------------
// Hair Tools port, Task 5: the tool questions (`tools_overview`, `tools:<pageKey>`).
// ---------------------------------------------------------------------------

const toolsTriggerContext: Stage2TriggerContext = {
  relevantCategories: ["shampoo"],
  hasReportedIrritatedScalp: false,
  dryShampooBridgeEligibility: "ineligible",
  toolsEnabled: true,
}

const PRODUCTS_DONE_IDS = ["current_product_categories", "wet_wash_frequency"] as const

function toolsSession(
  answers: PersonalPlanRefinementAnswersV1 = {},
  completedQuestionIds: Stage2QuestionId[] = [...PRODUCTS_DONE_IDS],
  triggerContext: Stage2TriggerContext = toolsTriggerContext,
): Stage2RefinementSession {
  return createStage2RefinementSession({
    pathVersion: "stage2-ui-test",
    triggerContext,
    answers: { currentProductCategories: [], wetWashFrequency: "weekly_2x", ...answers },
    completedQuestionIds,
    revision: 3,
  })
}

/** Renders a question the way the flow does: the local answer starts as the stored/pre-filled one. */
function renderQuestion(
  session: Stage2RefinementSession,
  questionId: Stage2QuestionId,
  options: { localAnswer?: unknown; status?: RefinementQuestionStatus } = {},
): string {
  return renderToStaticMarkup(
    <RefinementQuestion
      session={session}
      questionId={questionId}
      localAnswer={
        "localAnswer" in options
          ? options.localAnswer
          : getAnswerForQuestion(session.answers, questionId)
      }
      onLocalAnswerChange={() => {}}
      status={options.status ?? "idle"}
      canGoBack
      onBack={() => {}}
      onSubmit={() => {}}
      onSecondaryExit={() => {}}
    />,
  )
}

function pressedOptions(html: string): string[] {
  return [...html.matchAll(/<button[^>]*aria-pressed="true"[^>]*data-tool-option="([^"]+)"/g)].map(
    (match) => match[1]!,
  )
}

function nothingPressed(html: string): boolean {
  return /<button[^>]*aria-pressed="true"[^>]*data-tool-nothing-option/.test(html)
}

test('the tool overview asks „Was hast du schon?" with the four chronological section cards', () => {
  const session = toolsSession()
  assert.deepEqual(session.path.orderedQuestionIds.slice(2), [
    "tools_overview",
    "towel_handling",
    "drying_routes",
  ])
  const html = renderQuestion(session, "tools_overview")

  assert.match(html, /Was hast du schon\?/)
  assert.match(html, /Deine Tools/)
  assert.match(
    html,
    /Wähle die Bereiche, aus denen du schon Produkte hast\. Nicht gewählt = hast du nicht\./,
  )
  const labels = [
    "Waschen &amp; Auftragen",
    "Abtrocknen &amp; Entwirren",
    "Trocknen &amp; Stylen",
    "Nachtschutz",
  ]
  const positions = labels.map((label) => html.indexOf(label))
  assert.ok(
    positions.every((position) => position > 0),
    "all four sections render",
  )
  assert.deepEqual(
    [...positions].sort((a, b) => a - b),
    positions,
    "in wash-day order",
  )
  for (const hint of [
    "Applikator, Kopfhautbürste",
    "Handtücher, Kämme, Bürsten",
    "Föhn, Glätteisen, Lockenwickler, Clips",
    "Kissenbezug, Bonnet",
  ]) {
    assert.ok(html.includes(hint), `hint ${hint}`)
  }
  assert.equal(countOccurrences(html, "data-tool-option="), 4)
  assert.match(html, /data-tool-option="waschen_auftragen"/)
  assert.match(html, /data-tool-option="nachtschutz"/)
  assert.match(html, /<button[^>]*data-tool-nothing-option[^>]*>Nichts davon<\/button>/)
  // Nothing implied, nothing answered: nothing is ticked, „Nichts davon" is not pre-lit, Weiter waits.
  assert.deepEqual(pressedOptions(html), [])
  assert.equal(nothingPressed(html), false)
  assert.match(html, /<button[^>]*disabled=""[^>]*>Weiter<\/button>/)
})

test("the overview pre-fill is a starting value only: ticked on screen, never saved until submitted", () => {
  const session = toolsSession({
    towel: { material: "mikrofaser", technique: "gentle_press" },
    nightProtection: ["silk_satin_pillow"],
  })
  const startingValue = getAnswerForQuestion(session.answers, "tools_overview")
  assert.deepEqual(startingValue, ["abtrocknen_entwirren", "nachtschutz"])
  assert.equal(session.answers.toolFamiliesWithSomething, undefined, "nothing was saved")
  assert.equal(session.answers.toolForms, undefined)
  assert.equal(session.path.completedQuestionIds.includes("tools_overview"), false)

  const html = renderQuestion(session, "tools_overview")
  assert.deepEqual(pressedOptions(html), ["abtrocknen_entwirren", "nachtschutz"])
  assert.equal(nothingPressed(html), false)
  // The starting value is already a usable answer: Weiter is enabled.
  assert.doesNotMatch(html, /<button[^>]*disabled=""[^>]*>Weiter<\/button>/)
})

test('a saved overview wins over the pre-fill, and a saved „Nichts davon" lights the none option', () => {
  const saved = toolsSession(
    {
      towel: { material: "mikrofaser", technique: "gentle_press" },
      toolFamiliesWithSomething: ["airflow"],
    },
    [...PRODUCTS_DONE_IDS, "tools_overview"],
  )
  assert.deepEqual(getAnswerForQuestion(saved.answers, "tools_overview"), ["trocknen_stylen"])
  assert.deepEqual(pressedOptions(renderQuestion(saved, "tools_overview")), ["trocknen_stylen"])

  const none = toolsSession({ toolFamiliesWithSomething: [] }, [
    ...PRODUCTS_DONE_IDS,
    "tools_overview",
  ])
  assert.deepEqual(getAnswerForQuestion(none.answers, "tools_overview"), [])
  const html = renderQuestion(none, "tools_overview")
  assert.deepEqual(pressedOptions(html), [])
  assert.equal(
    nothingPressed(html),
    true,
    'an explicit empty overview shows „Nichts davon" selected',
  )
})

/**
 * Mounts a client component in jsdom (real clicks, real state) for the few interaction
 * contracts a static render cannot see. Globals are installed for the call and removed after.
 */
async function withMountedDom<T>(
  element: React.ReactElement,
  run: (container: HTMLElement) => T | Promise<T>,
): Promise<T> {
  const { JSDOM } = await import("jsdom")
  const { createRoot } = await import("react-dom/client")
  const { flushSync } = await import("react-dom")
  const dom = new JSDOM(
    '<!doctype html><html lang="de"><body><div id="root"></div></body></html>',
    {
      url: "http://localhost/",
      pretendToBeVisual: true,
    },
  )
  const globals = globalThis as unknown as Record<string, unknown>
  const previous: Record<string, PropertyDescriptor | undefined> = {}
  const installed: Record<string, unknown> = {
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    IS_REACT_ACT_ENVIRONMENT: true,
  }
  for (const [key, value] of Object.entries(installed)) {
    previous[key] = Object.getOwnPropertyDescriptor(globals, key)
    Object.defineProperty(globals, key, { value, configurable: true, writable: true })
  }
  const container = dom.window.document.getElementById("root")!
  const root = createRoot(container)
  try {
    flushSync(() => root.render(element))
    return await run(container)
  } finally {
    flushSync(() => root.unmount())
    // React's scheduler and next/image still have timers queued for this window; let them
    // drain before the globals go away.
    await new Promise((resolve) => setTimeout(resolve, 50))
    for (const key of Object.keys(installed)) {
      const descriptor = previous[key]
      if (descriptor) Object.defineProperty(globals, key, descriptor)
      else delete globals[key]
    }
    dom.window.close()
  }
}

function click(element: Element): void {
  const view = element.ownerDocument.defaultView!
  element.dispatchEvent(new view.MouseEvent("click", { bubbles: true, cancelable: true }))
}

test('tapping cards toggles them in wash-day order and „Nichts davon" clears the whole overview', async () => {
  const { ToolVisualMultiSelect } =
    await import("../src/components/personal-plan-refinement/tool-inventory")
  const { TOOL_OVERVIEW_OPTIONS } = await import("../src/lib/personal-plan/tools/stage2")
  const { flushSync } = await import("react-dom")
  const calls: Array<{ next: string[]; announcement?: string }> = []
  function Harness() {
    const [selected, setSelected] = React.useState<string[] | null>(["abtrocknen_entwirren"])
    return (
      <ToolVisualMultiSelect
        options={TOOL_OVERVIEW_OPTIONS}
        selected={selected}
        ariaLabel="Was hast du schon?"
        onChange={(next, announcement) => {
          calls.push({ next, announcement })
          setSelected(next)
        }}
      />
    )
  }
  await withMountedDom(<Harness />, (container) => {
    const card = (value: string) => container.querySelector(`[data-tool-option="${value}"]`)!
    const none = () => container.querySelector("[data-tool-nothing-option]")!
    flushSync(() => click(card("nachtschutz")))
    flushSync(() => click(card("waschen_auftragen")))
    // Order follows the wash-day sections, not the tapping order.
    assert.deepEqual(calls.at(-1)?.next, [
      "waschen_auftragen",
      "abtrocknen_entwirren",
      "nachtschutz",
    ])
    assert.equal(card("nachtschutz").getAttribute("aria-pressed"), "true")

    flushSync(() => click(none()))
    assert.deepEqual(calls.at(-1), { next: [], announcement: "Nichts davon" })
    for (const value of ["waschen_auftragen", "abtrocknen_entwirren", "nachtschutz"]) {
      assert.equal(card(value).getAttribute("aria-pressed"), "false")
    }
    assert.equal(none().getAttribute("aria-pressed"), "true")
    // Tapping a card again ends „Nichts davon" and ticks the card.
    flushSync(() => click(card("trocknen_stylen")))
    assert.deepEqual(calls.at(-1)?.next, ["trocknen_stylen"])
    assert.equal(none().getAttribute("aria-pressed"), "false")
  })
})

test("a tool page renders its photo cards with plum selection and the Mehrfachauswahl lead", () => {
  const session = toolsSession(
    { toolFamiliesWithSomething: ["drying_textiles", "brushes_combs"] },
    [...PRODUCTS_DONE_IDS, "tools_overview"],
  )
  const html = renderQuestion(session, "tools:drying_textiles:1")

  assert.match(html, /Welche Handtücher oder Tücher nutzt du\?/)
  assert.match(html, /Mehrfachauswahl möglich\./)
  assert.doesNotMatch(html, /Seite \d von \d/)
  // Abtrocknen & Entwirren is the section; the kicker is the module's.
  assert.match(html, /Abtrocknen &amp; Entwirren/)
  assert.match(html, /Was du schon hast/)
  assert.deepEqual(
    [...html.matchAll(/data-tool-option="([^"]+)"/g)].map((match) => match[1]),
    ["microfiber_towel", "frottee", "smooth_cotton_cloth", "drying_wrap"],
  )
  for (const label of ["Mikrofaser-Handtuch", "Frottee-Handtuch"])
    assert.ok(html.includes(label), label)
  assert.match(html, /\/images\/tools\/microfiber_towel\.webp/)
  assert.match(html, /\/images\/tools\/frottee\.webp/)
  // Photo cards: white body, plum border/ring when selected — coral is the CTA's alone.
  const cardsRegion = html.slice(html.indexOf("data-tool-visual-select"), html.indexOf(">Weiter<"))
  assert.doesNotMatch(cardsRegion.slice(0, cardsRegion.lastIndexOf("<button")), /coral/i)
  assert.match(html, /bg-\[var\(--brand-coral\)\]/)
  assert.match(html, /<button[^>]*data-tool-nothing-option[^>]*>Nichts davon<\/button>/)
  // Unanswered, nothing implied: the page waits for a choice or an explicit „Nichts davon".
  assert.match(html, /<button[^>]*disabled=""[^>]*>Weiter<\/button>/)
})

test("two-page families number their pages and keep their own forms", () => {
  const session = toolsSession({ toolFamiliesWithSomething: ["brushes_combs"] }, [
    ...PRODUCTS_DONE_IDS,
    "tools_overview",
  ])
  const first = renderQuestion(session, "tools:brushes_combs:1")
  const second = renderQuestion(session, "tools:brushes_combs:2")
  assert.match(first, /Mehrfachauswahl möglich\. Seite 1 von 2\./)
  assert.match(second, /Mehrfachauswahl möglich\. Seite 2 von 2\./)
  const optionsOf = (html: string) =>
    [...html.matchAll(/data-tool-option="([^"]+)"/g)].map((match) => match[1]!)
  assert.ok(optionsOf(first).includes("fingers"))
  assert.equal(optionsOf(first).includes("round_brush"), false)
  assert.ok(optionsOf(second).includes("round_brush"))
  assert.equal(
    optionsOf(first).some((form) => optionsOf(second).includes(form)),
    false,
    "no form is offered on two pages",
  )
})

test("a tool page's pre-fill is its own slice of the care-implied inventory, shown as a starting value", () => {
  const session = toolsSession(
    {
      towel: { material: "mikrofaser", technique: "gentle_press" },
      additionalHeatTools: ["straightener"],
      nightProtection: ["silk_satin_bonnet"],
      toolFamiliesWithSomething: [
        "drying_textiles",
        "heated_styling",
        "night_protection",
        "brushes_combs",
      ],
    },
    [...PRODUCTS_DONE_IDS, "tools_overview"],
  )
  assert.deepEqual(getAnswerForQuestion(session.answers, "tools:drying_textiles:1"), [
    "microfiber_towel",
  ])
  assert.deepEqual(getAnswerForQuestion(session.answers, "tools:heated_styling:1"), ["flat_iron"])
  assert.deepEqual(getAnswerForQuestion(session.answers, "tools:night_protection:1"), ["bonnet"])
  // Nothing implied for the brush pages: no pre-fill, not an answer either.
  assert.equal(getAnswerForQuestion(session.answers, "tools:brushes_combs:1"), undefined)
  assert.equal(session.answers.toolForms, undefined, "nothing is saved by looking at the page")

  const html = renderQuestion(session, "tools:drying_textiles:1")
  assert.deepEqual(pressedOptions(html), ["microfiber_towel"])
  assert.equal(nothingPressed(html), false)
  assert.doesNotMatch(html, /<button[^>]*disabled=""[^>]*>Weiter<\/button>/)
})

test('a saved page answer wins over the pre-fill and an explicit empty page shows „Nichts davon"', () => {
  const session = toolsSession(
    {
      towel: { material: "mikrofaser", technique: "gentle_press" },
      toolFamiliesWithSomething: ["drying_textiles"],
      toolForms: { "drying_textiles:1": ["drying_wrap"] },
    },
    [...PRODUCTS_DONE_IDS, "tools_overview", "tools:drying_textiles:1"],
  )
  assert.deepEqual(getAnswerForQuestion(session.answers, "tools:drying_textiles:1"), [
    "drying_wrap",
  ])

  const none = toolsSession(
    { toolFamiliesWithSomething: ["drying_textiles"], toolForms: { "drying_textiles:1": [] } },
    [...PRODUCTS_DONE_IDS, "tools_overview", "tools:drying_textiles:1"],
  )
  assert.deepEqual(getAnswerForQuestion(none.answers, "tools:drying_textiles:1"), [])
  const html = renderQuestion(none, "tools:drying_textiles:1")
  assert.deepEqual(pressedOptions(html), [])
  assert.equal(nothingPressed(html), true)
})

test('a care-implied empty page start does not pre-light „Nichts davon"', () => {
  const session = toolsSession({ toolFamiliesWithSomething: ["airflow"] }, [
    ...PRODUCTS_DONE_IDS,
    "tools_overview",
  ])
  const html = renderQuestion(session, "tools:airflow:1", { localAnswer: [] })
  assert.equal(
    nothingPressed(html),
    false,
    "an unsaved empty starting value is not the user's claim",
  )
})

test("local completeness: an explicit empty tool page is an answer, an untouched one is not", () => {
  assert.equal(isLocalAnswerComplete("tools_overview", undefined), false)
  assert.equal(isLocalAnswerComplete("tools_overview", []), true)
  assert.equal(isLocalAnswerComplete("tools_overview", ["nachtschutz"]), true)
  assert.equal(isLocalAnswerComplete("tools:airflow:1", undefined), false)
  assert.equal(isLocalAnswerComplete("tools:airflow:1", []), true)
  assert.equal(isLocalAnswerComplete("tools:airflow:1", ["hair_dryer"]), true)
})

test('rollout on: drying needs at least one way; rollout off keeps „Nichts davon"', () => {
  assert.equal(isLocalAnswerComplete("drying_routes", [], { toolsEnabled: true }), false)
  assert.equal(isLocalAnswerComplete("drying_routes", ["air_dry"], { toolsEnabled: true }), true)
  assert.equal(isLocalAnswerComplete("drying_routes", []), true)
  assert.equal(isLocalAnswerComplete("drying_routes", [], { toolsEnabled: false }), true)
})

test("rollout on: the towel question asks only the technique once the textiles page named the material", () => {
  assert.equal(
    isLocalAnswerComplete(
      "towel_handling",
      { technique: "gentle_press" },
      { towelMaterialDerived: true },
    ),
    true,
  )
  assert.equal(isLocalAnswerComplete("towel_handling", {}, { towelMaterialDerived: true }), false)
  assert.equal(isLocalAnswerComplete("towel_handling", { technique: "gentle_press" }), false)

  const session = toolsSession(
    {
      toolFamiliesWithSomething: ["drying_textiles"],
      toolForms: { "drying_textiles:1": ["microfiber_towel"] },
    },
    [...PRODUCTS_DONE_IDS, "tools_overview", "tools:drying_textiles:1"],
  )
  const html = renderQuestion(session, "towel_handling", { localAnswer: undefined })
  assert.doesNotMatch(html, /Welches Material nutzt du meistens\?/)
  assert.match(html, /Wie gehst du damit meistens um\?/)
  // Rollout off: unchanged — material first.
  const off = createStage2RefinementSession({
    pathVersion: "stage2-ui-test",
    triggerContext: baseTriggerContext,
  })
  assert.match(
    renderQuestion(off, "towel_handling", { localAnswer: undefined }),
    /Welches Material nutzt du meistens\?/,
  )
})

test('rollout on: the drying page offers only the routes the owned airflow tools back, without „Nichts davon"', () => {
  // Label and subtitle are separate lines of one card.
  const OPTION_COPY = [
    { label: "Lufttrocknen", subtitle: null },
    { label: "Gewöhnlich föhnen", subtitle: "auch mit Rundbürste" },
    { label: "Mit Diffusor", subtitle: "Aufsatz für Locken/Wellen" },
  ] as const
  const optionLabels = (html: string) =>
    OPTION_COPY.filter(({ label, subtitle }) => {
      if (!html.includes(`>${label}<`)) return false
      if (subtitle) assert.ok(html.includes(`>${subtitle}<`), `${label} lost its subtitle`)
      return true
    }).map(({ label }) => label)
  const base = {
    toolFamiliesWithSomething: ["airflow" as const],
  }
  const noAirflow = toolsSession({ toolFamiliesWithSomething: [], toolForms: {} }, [
    ...PRODUCTS_DONE_IDS,
    "tools_overview",
  ])
  const noAirflowHtml = renderQuestion(noAirflow, "drying_routes", { localAnswer: undefined })
  assert.deepEqual(optionLabels(noAirflowHtml), ["Lufttrocknen"])
  assert.doesNotMatch(noAirflowHtml, /data-refinement-none-option/)

  const dryer = toolsSession({ ...base, toolForms: { "airflow:1": ["hair_dryer"] } }, [
    ...PRODUCTS_DONE_IDS,
    "tools_overview",
    "tools:airflow:1",
  ])
  assert.deepEqual(
    optionLabels(renderQuestion(dryer, "drying_routes", { localAnswer: undefined })),
    ["Lufttrocknen", "Gewöhnlich föhnen"],
  )

  const diffuser = toolsSession(
    { ...base, toolForms: { "airflow:1": ["hair_dryer", "diffuser"] } },
    [...PRODUCTS_DONE_IDS, "tools_overview", "tools:airflow:1"],
  )
  const diffuserHtml = renderQuestion(diffuser, "drying_routes", { localAnswer: undefined })
  assert.deepEqual(optionLabels(diffuserHtml), [
    "Lufttrocknen",
    "Gewöhnlich föhnen",
    "Mit Diffusor",
  ])
  for (const retired of [
    "Diffusor oder formender Luftstrom",
    "Gewöhnlich föhnen / auch mit Rundbürste",
    "Mit Diffusor / Aufsatz für Locken/Wellen",
  ]) {
    assert.ok(!diffuserHtml.includes(retired), retired)
  }

  // Rollout off: today's page, with „Nichts davon" and the old labels.
  const off = createStage2RefinementSession({
    pathVersion: "stage2-ui-test",
    triggerContext: baseTriggerContext,
  })
  const offHtml = renderQuestion(off, "drying_routes", { localAnswer: undefined })
  assert.match(offHtml, /data-refinement-none-option/)
  assert.match(offHtml, /Diffusor oder formender Luftstrom/)
})

test("Diffusor rule: with the rollout on the Diffusor question asks only „Wie häufig?“, no protection block", () => {
  const diffuserAnswers = {
    toolFamiliesWithSomething: ["airflow" as const],
    toolForms: { "airflow:1": ["hair_dryer", "diffuser"] },
    dryingRoutes: ["diffuser_or_airflow_shaping" as const],
  } as PersonalPlanRefinementAnswersV1
  const session = toolsSession(diffuserAnswers, [
    ...PRODUCTS_DONE_IDS,
    "tools_overview",
    "tools:airflow:1",
    "drying_routes",
  ])
  const html = renderQuestion(session, "heat:diffuser_airflow_shaping", {
    localAnswer: { frequency: "weekly_2x" },
  })
  assert.match(html, /Wie häufig\?/)
  assert.doesNotMatch(html, /Wie konsequent nutzt du dabei Hitzeschutz\?/)
  assert.doesNotMatch(html, /und ob du dabei Hitzeschutz verwendest/)
  assert.match(html, /Gib deinen üblichen Rhythmus an\./)

  // A Warmluftbürste next to it keeps its protection block.
  const dryerBrushHtml = renderQuestion(session, "heat:dryer_brush", {
    localAnswer: { frequency: "weekly_2x" },
  })
  assert.match(dryerBrushHtml, /Wie konsequent nutzt du dabei Hitzeschutz\?/)

  // Rollout off: today's Diffusor question, protection included.
  const off = createStage2RefinementSession({
    pathVersion: "stage2-ui-test",
    triggerContext: baseTriggerContext,
  })
  const offHtml = renderQuestion(off, "heat:diffuser_airflow_shaping", {
    localAnswer: { frequency: "weekly_2x" },
  })
  assert.match(offHtml, /Wie konsequent nutzt du dabei Hitzeschutz\?/)
})

test("Diffusor rule: a Diffusor answer is complete with a frequency alone only under the rollout", () => {
  const frequencyOnly = { frequency: "weekly_2x" }
  assert.equal(
    isLocalAnswerComplete("heat:diffuser_airflow_shaping", frequencyOnly, { toolsEnabled: true }),
    true,
  )
  assert.equal(isLocalAnswerComplete("heat:diffuser_airflow_shaping", frequencyOnly), false)
  assert.equal(
    isLocalAnswerComplete("heat:dryer_brush", frequencyOnly, { toolsEnabled: true }),
    false,
  )
  assert.equal(
    isLocalAnswerComplete("heat:diffuser_airflow_shaping", {}, { toolsEnabled: true }),
    false,
  )
})

test("the Produkte page lists categories in the display order; the stored order stays canonical", () => {
  assert.deepEqual(
    REFINEMENT_CATEGORY_DISPLAY_OPTIONS.map((option) => option.value),
    [
      "shampoo",
      "deep_cleansing_shampoo",
      "scalp_care",
      "conditioner",
      "mask",
      "bondbuilder",
      "leave_in",
      "heat_protectant",
      "oil",
      "dry_shampoo",
    ],
  )
  assert.deepEqual(
    [...REFINEMENT_CATEGORY_DISPLAY_OPTIONS.map((option) => option.value)].sort(),
    [...STAGE2_PRODUCT_CATEGORIES].sort(),
  )
  const labelOrder = (html: string, labels: string[]) =>
    labels
      .map((label) => ({ label, at: html.indexOf(`>${label}<`) }))
      .filter(({ at }) => at >= 0)
      .sort((a, b) => a.at - b.at)
      .map(({ label }) => label)
  const session = createStage2RefinementSession({
    pathVersion: "stage2-ui-test",
    triggerContext: { ...baseTriggerContext, relevantCategories: [] },
  })
  const html = renderQuestion(session, "current_product_categories", { localAnswer: undefined })
  assert.deepEqual(
    labelOrder(
      html,
      REFINEMENT_CATEGORY_DISPLAY_OPTIONS.map((option) => option.label),
    ),
    REFINEMENT_CATEGORY_DISPLAY_OPTIONS.map((option) => option.label),
  )
  // With a relevant group the plan's categories come first, each group in display order.
  const grouped = createStage2RefinementSession({
    pathVersion: "stage2-ui-test",
    triggerContext: baseTriggerContext, // shampoo, mask, heat_protectant
  })
  const groupedHtml = renderQuestion(grouped, "current_product_categories", {
    localAnswer: undefined,
  })
  assert.deepEqual(
    labelOrder(
      groupedHtml,
      REFINEMENT_CATEGORY_DISPLAY_OPTIONS.map((option) => option.label),
    ),
    [
      "Shampoo",
      "Maske",
      "Hitzeschutz",
      "Tiefenreinigungsshampoo",
      "Kopfhautpflege",
      "Conditioner",
      "Bondbuilder",
      "Leave-in",
      "Öl",
      "Trockenshampoo",
    ],
  )
})

test("tool questions report one bounded telemetry family and the tools section", () => {
  assert.equal(getQuestionFamily("tools_overview"), "tool_inventory")
  assert.equal(getQuestionFamily("tools:airflow:1"), "tool_inventory")
  assert.equal(getQuestionSection("tools_overview"), "tools")
  assert.equal(getQuestionSection("tools:night_protection:1"), "tools")
  // Existing families are untouched.
  assert.equal(getQuestionFamily("drying_routes"), "heat_behavior")
})

test("a failed module completion on the last tool page offers the retry, not a second save", () => {
  const session = toolsSession(
    { toolFamiliesWithSomething: ["night_protection"], toolForms: { "night_protection:1": [] } },
    [...PRODUCTS_DONE_IDS, "tools_overview", "tools:night_protection:1"],
  )
  const html = renderQuestion(session, "tools:night_protection:1", { status: "completion_failed" })
  assert.match(html, /Deine Antwort ist gespeichert\. Das Abschließen hat gerade nicht geklappt\./)
  assert.match(html, /Du musst diese Antwort nicht noch einmal speichern\./)
  assert.match(html, /<button[^>]*>Abschließen erneut versuchen<\/button>/)
  assert.doesNotMatch(html, /<button[^>]*disabled=""[^>]*>Abschließen erneut versuchen<\/button>/)
})

test("the retry reaches the server: failed completing PATCH, then POST complete {module} over the HTTP gateway", async () => {
  const savedSession = toolsSession(
    { toolFamiliesWithSomething: ["night_protection"], toolForms: { "night_protection:1": [] } },
    [...PRODUCTS_DONE_IDS, "tools_overview", "tools:night_protection:1"],
  )
  const { createStage2RouteHandlers } = await import("../src/app/api/personal-plan/stage-2/route")
  const { createStage2CompleteRouteHandler } =
    await import("../src/app/api/personal-plan/stage-2/complete/route")
  const { createHttpStage2RefinementGateway } =
    await import("../src/lib/personal-plan/refinement/http-gateway")
  const { Stage2RefinementError } = await import("../src/lib/personal-plan/refinement/gateway")

  let completionAttempts = 0
  const serverGateway = () => ({
    load: async () => savedSession,
    saveAnswer: async () => savedSession,
    complete: async () => ({ refinedVersionId: "refined-1", nextHref: "/plan-start" as const }),
    completeModule: async () => {
      completionAttempts += 1
      if (completionAttempts === 1) throw new Stage2RefinementError("temporarily_unavailable")
      return {
        module: "tools" as const,
        refinedVersionId: "refined-tools-1",
        status: "in_progress" as const,
        stage3Handoff: false,
        nextHref: "/plan-start" as const,
      }
    },
  })
  const common = {
    enabled: () => true,
    getUserId: async () => "owner-1",
    loadStage2Access: async () => ({ allowed: true as const }),
    toolsEnabled: async () => true,
    gatewayFor: serverGateway,
    runHabitsRecompute: async () => null,
  }
  const patch = createStage2RouteHandlers(common).PATCH
  const post = createStage2CompleteRouteHandler(common)
  const browser = createHttpStage2RefinementGateway({
    fetch: async (input, init) => {
      const url = String(input)
      const request = new Request(`http://test${url}`, init)
      return url.endsWith("/complete") ? post(request) : patch(request)
    },
  })

  await assert.rejects(
    browser.saveAnswerAndCompleteModule!({
      module: "tools",
      questionId: "tools:night_protection:1",
      answer: [],
      expectedRevision: 3,
    }),
    (error: unknown) =>
      error instanceof Stage2RefinementError &&
      error.code === "temporarily_unavailable" &&
      error.savedSession?.revision === savedSession.revision,
  )
  const retried = await browser.completeModule!({
    module: "tools",
    expectedRevision: savedSession.revision,
  })
  assert.equal(retried.refinedVersionId, "refined-tools-1")
  assert.equal(completionAttempts, 2)
})

test("the module-tools Labs scenario walks the tools module with the rollout on", async () => {
  const gateway = createPreviewGateway("module-tools")
  const session = await gateway.load()
  assert.equal(session.triggerContext.toolsEnabled, true)
  assert.equal(session.path.orderedQuestionIds.includes("tools_overview"), true)
  assert.equal(session.path.firstUnresolvedQuestionId, "tools_overview")
  assert.equal(moduleEntryForScenario("module-tools"), "tools")
})
