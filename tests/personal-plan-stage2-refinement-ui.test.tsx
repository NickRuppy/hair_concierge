import assert from "node:assert/strict"
import { readFile, readdir } from "node:fs/promises"
import path from "node:path"
import test from "node:test"
import { renderToStaticMarkup } from "react-dom/server"

import {
  REFINEMENT_CATEGORY_OPTIONS,
  REFINEMENT_TELEMETRY_EVENTS,
  RefinementQuestion,
} from "../src/components/personal-plan-refinement/refinement-question"
import { RefinementBridge } from "../src/components/personal-plan-refinement/refinement-bridge"
import {
  ADDITIONAL_HEAT_TOOL_OPTIONS,
  DRYING_ROUTE_OPTIONS,
  NIGHT_PROTECTION_OPTIONS,
  OIL_PURPOSE_OPTIONS,
  mergeGroupedCategorySelection,
} from "../src/components/personal-plan-refinement/refinement-options"
import {
  getCompletedHandoffForLoadedSession,
  getBridgeBackQuestionId,
  type Stage2RefinementTelemetryEvent,
} from "../src/components/personal-plan-refinement/refinement-flow"
import {
  createPreviewGateway,
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
  type Stage2TriggerContext,
} from "../src/lib/personal-plan/refinement/types"
import { NIGHT_PROTECTIONS } from "../src/lib/vocabulary/onboarding-care"

const baseTriggerContext: Stage2TriggerContext = {
  relevantCategories: ["shampoo", "mask", "heat_protectant"],
  hasReportedIrritatedScalp: true,
  dryShampooBridgeEligibility: "eligible",
}

function countOccurrences(source: string, needle: string): number {
  return source.split(needle).length - 1
}

test("renders the German invitation and neutral bridge hierarchy without result leakage", () => {
  const bridgeHtml = renderToStaticMarkup(
    <RefinementBridge
      refinedVersionId="fixture-refined-stage2-v1-r9"
      nextHref="/plan-start/produkte"
    />,
  )

  assert.match(bridgeHtml, /Jetzt schauen wir uns deine Produkte an\./)
  assert.match(bridgeHtml, /Produkte erfassen/)
  assert.match(bridgeHtml, /fixture-refined-stage2-v1-r9/)
  assert.match(bridgeHtml, /data-stage2-next-href="\/plan-start\/produkte"/)
  assert.doesNotMatch(bridgeHtml, /<a\b/)
  assert.doesNotMatch(bridgeHtml, /Empfehlung|Delta|verändert|Tier|Routinekarte|Produktkarte/i)
})

test("the bridge exposes a real continuation action and blocks duplicate handoff attempts", () => {
  const bridgeHtml = renderToStaticMarkup(
    <RefinementBridge
      refinedVersionId="fixture-refined-stage2-v1-r9"
      nextHref="/plan-start/produkte"
      onContinue={() => {}}
      isContinuing
    />,
  )

  assert.match(bridgeHtml, /Produkte werden vorbereitet/)
  assert.match(bridgeHtml, /disabled=""/)
  assert.match(bridgeHtml, /aria-busy="true"/)
})

test("renders two qualitative sections and never a numeric question total", () => {
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

  assert.match(html, /Was du heute benutzt/)
  assert.match(html, /Wie du dein Haar behandelst/)
  assert.doesNotMatch(html, /Frage\s+\d+\s+von\s+\d+/i)
})

test("renders exactly ten current-product categories with no preselection from relevant categories", () => {
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
  assert.match(html, /Nichts davon/)
  assert.doesNotMatch(html, /Serum|Styling|Scrub|Andere/)
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

test("global category none is inactive when only a relevant category is selected", () => {
  const session = createStage2RefinementSession({
    pathVersion: "stage2-ui-test",
    triggerContext: baseTriggerContext,
    answers: { currentProductCategories: ["shampoo"] },
    completedQuestionIds: ["current_product_categories"],
  })
  const html = renderToStaticMarkup(
    <RefinementQuestion
      session={session}
      questionId="current_product_categories"
      localAnswer={["shampoo"]}
      onLocalAnswerChange={() => {}}
      status="idle"
      canGoBack={false}
      onBack={() => {}}
      onSubmit={() => {}}
      onSecondaryExit={() => {}}
    />,
  )

  assert.match(html, /aria-label="Nichts davon; andere Auswahl wird gelöscht"/)
  assert.doesNotMatch(
    html,
    /aria-pressed="true" aria-label="Nichts davon; andere Auswahl wird gelöscht"/,
  )
})

test("merges grouped category selections without dropping the other group", () => {
  const currentSelection = ["shampoo", "oil", "mask"] as const
  const relevantGroup = ["shampoo", "mask", "heat_protectant"] as const
  const remainingGroup = REFINEMENT_CATEGORY_OPTIONS.map((option) => option.value).filter(
    (value) => !relevantGroup.includes(value as (typeof relevantGroup)[number]),
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
      nextHref: "/plan-start/produkte",
    },
    revision: 9,
    status: "complete",
  })
  assert.deepEqual(getCompletedHandoffForLoadedSession(completeSession), {
    refinedVersionId: "fixture-refined-loaded-r9",
    nextHref: "/plan-start/produkte",
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
  assert.deepEqual(Object.keys(handoffFailed), ["name"])
  assert.doesNotMatch(
    JSON.stringify([viewed, failed, handoffFailed]),
    /questionId|answer|category|irritation|frequency|root/i,
  )
})

test("Labs preview is development guarded and keeps fixture-gateway behind preview-client", async () => {
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
    "app/labs/personal-plan-stage-2/preview-client.tsx",
    "components/personal-plan-products/stage3-products-flow.tsx",
  ])
})
