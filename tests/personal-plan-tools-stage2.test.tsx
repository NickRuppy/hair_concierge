import assert from "node:assert/strict"
import test from "node:test"
import { renderToStaticMarkup } from "react-dom/server"

import { buildDirectAcceptanceStage2Defaults } from "@/lib/personal-plan/direct-acceptance/defaults"
import {
  getOrderedQuestionIds,
  getToolQuestionIds,
  resolveStage2RefinementContract,
} from "@/lib/personal-plan/refinement/question-path"
import {
  createStage2RefinementSession,
  saveStage2SessionAnswer,
} from "@/lib/personal-plan/refinement/session"
import type {
  PersonalPlanRefinementAnswersV1,
  Stage2QuestionId,
  Stage2TriggerContext,
} from "@/lib/personal-plan/refinement/types"
import { TOOL_FORM_PAGES, TOOL_OVERVIEW_SECTIONS } from "@/lib/personal-plan/tools/labels"
import {
  defaultToolFormsFromCare,
  defaultToolSectionsFromCare,
  TOOL_OVERVIEW_OPTIONS,
  toolFormPagePresentation,
} from "@/lib/personal-plan/tools/stage2"
import { EMPTY_TOOL_CARE_FACTS, projectToolCareFacts } from "@/lib/personal-plan/tools/facts"
import {
  computeToolRoutes,
  toolProfileFactsFromPlanProfile,
} from "@/lib/personal-plan/tools/routes"
import { buildPlanProfile } from "@/lib/personal-plan/input"
import { RefinementQuestion } from "@/components/personal-plan-refinement/refinement-question"
import { COMPLETE_V3_PLAN_ENVELOPE } from "./personal-plan/fixtures"

const BASE_CONTEXT: Stage2TriggerContext = {
  relevantCategories: ["shampoo", "conditioner"],
  hasReportedIrritatedScalp: false,
  dryShampooBridgeEligibility: "ineligible",
}

const COMPLETE_CARE_ANSWERS: PersonalPlanRefinementAnswersV1 = {
  currentProductCategories: [],
  wetWashFrequency: "weekly_2x",
  towel: { material: "mikrofaser", technique: "gentle_press" },
  dryingRoutes: ["air_dry"],
  additionalHeatTools: [],
  heatEvents: {},
  nightProtection: [],
}

test("Tools off leaves the released Feinschliff path byte-identical", () => {
  const off = getOrderedQuestionIds(BASE_CONTEXT, COMPLETE_CARE_ANSWERS)
  assert.equal(
    off.some((id) => id.startsWith("tools")),
    false,
  )
  assert.deepEqual(getToolQuestionIds(BASE_CONTEXT, COMPLETE_CARE_ANSWERS), [])
})

test("the Tool trip starts with one overview and opens only selected sections", () => {
  const context = { ...BASE_CONTEXT, toolsEnabled: true }
  const start = getToolQuestionIds(context, COMPLETE_CARE_ANSWERS)
  assert.deepEqual(start, ["tools_overview"])

  const opened = getToolQuestionIds(context, {
    ...COMPLETE_CARE_ANSWERS,
    toolFamiliesWithSomething: ["brushes_combs", "securing_sectioning"],
  })
  assert.deepEqual(opened, [
    "tools_overview",
    "tools:brushes_combs:1",
    "tools:brushes_combs:2",
    "tools:securing_sectioning:1",
    "tools:securing_sectioning:2",
  ])
  assert.equal(
    getToolQuestionIds(context, { ...COMPLETE_CARE_ANSWERS, toolFamiliesWithSomething: [] }).length,
    1,
    "an explicit nothing-selected overview opens no product-form page",
  )
})

test("no product-form page ever shows more than four large options", () => {
  for (const page of TOOL_FORM_PAGES) {
    assert.ok(page.forms.length <= 4, `${page.pageKey} shows ${page.forms.length} options`)
    assert.ok(page.forms.length >= 1)
  }
  assert.equal(TOOL_OVERVIEW_OPTIONS.length, 4)
})

test("presentation section headers never leak into persisted keys", () => {
  const sectionKeys = TOOL_OVERVIEW_SECTIONS.map((section) => section.key)
  for (const page of TOOL_FORM_PAGES) {
    assert.equal(sectionKeys.includes(page.family as never), false)
  }
  const context = { ...BASE_CONTEXT, toolsEnabled: true }
  const contract = resolveStage2RefinementContract({
    triggerContext: context,
    answers: {
      ...COMPLETE_CARE_ANSWERS,
      toolFamiliesWithSomething: ["wash_application"],
      toolForms: { wash_application: ["scalp_brush"] },
    },
    completedQuestionIds: [],
  })
  assert.deepEqual(Object.keys(contract.answers.toolForms ?? {}), ["wash_application"])
})

test("deselecting a section prunes only that section's persisted forms", () => {
  const contract = resolveStage2RefinementContract({
    triggerContext: { ...BASE_CONTEXT, toolsEnabled: true },
    answers: {
      ...COMPLETE_CARE_ANSWERS,
      toolFamiliesWithSomething: ["wash_application"],
      toolForms: { wash_application: ["scalp_brush"], brushes_combs: ["paddle_brush"] },
    },
    completedQuestionIds: [],
  })
  assert.deepEqual(contract.answers.toolForms, { wash_application: ["scalp_brush"] })
  assert.ok(contract.prunedAnswerKeys.includes("toolForms"))
})

test("the Tool trip is walked interactively but never required for completion", () => {
  const context = { ...BASE_CONTEXT, toolsEnabled: true }
  const contract = resolveStage2RefinementContract({
    triggerContext: context,
    answers: COMPLETE_CARE_ANSWERS,
    completedQuestionIds: [
      "current_product_categories",
      "wet_wash_frequency",
      "towel_handling",
      "drying_routes",
      "additional_heat_tools",
      "night_protection",
    ],
  })
  assert.equal(contract.isComplete, true, "every required care question is answered")
  assert.equal(
    contract.path.firstUnresolvedQuestionId,
    "tools_overview",
    "an interactive user still walks into the Tool trip",
  )
  assert.equal(contract.path.requiredQuestionIds.includes("tools_overview"), false)
  assert.ok(contract.path.orderedQuestionIds.includes("tools_overview"))
})

test("direct acceptance leaves every Tool answer unknown", () => {
  const defaults = buildDirectAcceptanceStage2Defaults({ ...BASE_CONTEXT, toolsEnabled: true })
  assert.equal(
    defaults.answers.toolFamiliesWithSomething,
    undefined,
    "skipped is unknown, never an explicit none",
  )
  assert.equal(defaults.answers.toolForms, undefined)
  assert.equal(
    defaults.completedQuestionIds.some((id) => id.startsWith("tools")),
    false,
  )
})

test("Nichts davon is an explicit answer that resolves the page", () => {
  const context = { ...BASE_CONTEXT, toolsEnabled: true }
  let session = createStage2RefinementSession({
    pathVersion: "test",
    triggerContext: context,
    answers: COMPLETE_CARE_ANSWERS,
    completedQuestionIds: [
      "current_product_categories",
      "wet_wash_frequency",
      "towel_handling",
      "drying_routes",
      "additional_heat_tools",
      "night_protection",
    ] as Stage2QuestionId[],
  })
  session = saveStage2SessionAnswer(session, { questionId: "tools_overview", answer: [] })
  assert.deepEqual(session.answers.toolFamiliesWithSomething, [])
  // Submitting the overview answers every family, so unchecked ones become an
  // explicit none rather than staying unknown.
  assert.deepEqual(session.answers.toolForms, {
    airflow: [],
    heated_styling: [],
    heatless_styling: [],
    brushes_combs: [],
    securing_sectioning: [],
    wash_application: [],
    night_protection: [],
    drying_textiles: [],
  })
  assert.equal(session.path.firstUnresolvedQuestionId, null)
  assert.ok(session.completedQuestionIds.includes("tools_overview"))
})

test("a submitted overview materializes only the unchecked families as explicit none", () => {
  let session = createStage2RefinementSession({
    pathVersion: "test",
    triggerContext: { ...BASE_CONTEXT, toolsEnabled: true },
    answers: COMPLETE_CARE_ANSWERS,
    completedQuestionIds: [
      "current_product_categories",
      "wet_wash_frequency",
      "towel_handling",
      "drying_routes",
      "additional_heat_tools",
      "night_protection",
    ] as Stage2QuestionId[],
  })
  session = saveStage2SessionAnswer(session, {
    questionId: "tools_overview",
    answer: ["waschen_auftragen"],
  })
  // The chosen family stays open for its product-form page; the rest are answered.
  assert.deepEqual(session.answers.toolFamiliesWithSomething, ["wash_application"])
  assert.equal(session.answers.toolForms?.wash_application, undefined)
  assert.deepEqual(session.answers.toolForms?.brushes_combs, [])
  assert.ok(
    session.path.orderedQuestionIds.includes("tools:wash_application:1"),
    "the chosen family opens its page",
  )
  assert.equal(
    session.path.orderedQuestionIds.some((id) => id.startsWith("tools:brushes_combs")),
    false,
    "an unchecked family opens no page",
  )
})

test("presentation section keys are never persisted", () => {
  const session = createStage2RefinementSession({
    pathVersion: "test",
    triggerContext: { ...BASE_CONTEXT, toolsEnabled: true },
    answers: { ...COMPLETE_CARE_ANSWERS, toolFamiliesWithSomething: ["wash_application"] },
    completedQuestionIds: [],
  })
  const serialized = JSON.stringify(session.answers)
  for (const section of TOOL_OVERVIEW_SECTIONS) {
    assert.equal(
      serialized.includes(section.key),
      false,
      `${section.key} is a presentation header and must not be persisted`,
    )
  }
})

test("known answers preselect sections and forms instead of asking twice", () => {
  const care = projectToolCareFacts({
    ...COMPLETE_CARE_ANSWERS,
    dryingRoutes: ["ordinary_blow_dry"],
    towel: { material: "mikrofaser", technique: "gentle_press" },
    nightProtection: ["silk_satin_bonnet"],
  })
  assert.deepEqual(defaultToolSectionsFromCare(care), ["trocknen_stylen", "tuecher_nachtschutz"])
  assert.deepEqual(defaultToolFormsFromCare(care), {
    airflow: ["hair_dryer"],
    drying_textiles: ["microfiber_towel"],
    night_protection: ["bonnet"],
  })
  assert.deepEqual(defaultToolSectionsFromCare(EMPTY_TOOL_CARE_FACTS), [])
})

test("a reused known answer produces ownership without a second question", () => {
  const care = projectToolCareFacts({
    ...COMPLETE_CARE_ANSWERS,
    dryingRoutes: ["diffuser_or_airflow_shaping"],
  })
  const routes = computeToolRoutes({
    profile: toolProfileFactsFromPlanProfile(
      buildPlanProfile(COMPLETE_V3_PLAN_ENVELOPE, {
        artifactId: "artifact-1",
        projection: "initial_quiz",
      }),
    ),
    care,
    inventory: {},
    scalpApplicationJob: false,
  })
  const drying = routes.find((route) => route.target === "drying_diffused")
  assert.equal(drying?.ownership, "owned_generic")
})

test("the overview renders four large image sections and an explicit none", () => {
  const session = createStage2RefinementSession({
    pathVersion: "test",
    triggerContext: { ...BASE_CONTEXT, toolsEnabled: true },
    answers: COMPLETE_CARE_ANSWERS,
    completedQuestionIds: [
      "current_product_categories",
      "wet_wash_frequency",
      "towel_handling",
      "drying_routes",
      "additional_heat_tools",
      "night_protection",
    ] as Stage2QuestionId[],
  })
  const markup = renderToStaticMarkup(
    <RefinementQuestion
      session={session}
      questionId="tools_overview"
      localAnswer={undefined}
      onLocalAnswerChange={() => {}}
      status="idle"
      canGoBack
      onBack={() => {}}
      onSubmit={() => {}}
      onSecondaryExit={() => {}}
      showJourneyHeader={false}
      focusOnQuestionChange={false}
    />,
  )
  assert.ok(markup.includes('data-tool-option-count="4"'))
  assert.ok(markup.includes("data-tool-nothing-option"))
  for (const section of TOOL_OVERVIEW_SECTIONS) {
    const escaped = section.label.replaceAll("&", "&amp;")
    assert.ok(markup.includes(escaped), `${section.label} is missing`)
  }
  assert.equal(markup.includes("Marke"), false, "brand is never asked")
  assert.equal(markup.includes("Modell"), false, "model is never asked")
})

test("a product-form page names the persisted family, not a purpose header", () => {
  const page = toolFormPagePresentation("brushes_combs:1")
  assert.equal(page?.title, "Welche Bürsten & Kämme nutzt du?")
  assert.equal(page?.sectionLabel, "Entwirren & Fixieren")
  assert.equal(page?.pageCount, 2)
  assert.ok(page!.options.length <= 4)
})

test("turning the rollout off hides the Tool trip without deleting stored answers", () => {
  const stored = {
    ...COMPLETE_CARE_ANSWERS,
    toolFamiliesWithSomething: ["wash_application" as const],
    toolForms: { wash_application: ["scalp_brush" as const] },
  }
  const off = resolveStage2RefinementContract({
    triggerContext: BASE_CONTEXT,
    answers: stored,
    completedQuestionIds: [],
  })
  // Rollback must preserve additive facts: the pruned answers are what gets
  // written back on the next ordinary save.
  assert.deepEqual(off.answers.toolForms, { wash_application: ["scalp_brush"] })
  assert.deepEqual(off.answers.toolFamiliesWithSomething, ["wash_application"])
  assert.equal(off.prunedAnswerKeys.includes("toolForms"), false)
  assert.equal(
    off.path.orderedQuestionIds.some((id) => id.startsWith("tools")),
    false,
    "the trip is still hidden while off",
  )

  // Turning it back on restores the trip with the stored answers intact.
  const backOn = resolveStage2RefinementContract({
    triggerContext: { ...BASE_CONTEXT, toolsEnabled: true },
    answers: off.answers,
    completedQuestionIds: [],
  })
  assert.deepEqual(backOn.answers.toolForms, { wash_application: ["scalp_brush"] })
})

test("once the overview is submitted its product-form pages become required", () => {
  const context = { ...BASE_CONTEXT, toolsEnabled: true }
  const careDone: Stage2QuestionId[] = [
    "current_product_categories",
    "wet_wash_frequency",
    "towel_handling",
    "drying_routes",
    "additional_heat_tools",
    "night_protection",
  ]

  // Half-answered trip: the overview opened a family whose page is unanswered.
  // The server must not let this complete into an immutable refined version.
  const halfAnswered = resolveStage2RefinementContract({
    triggerContext: context,
    answers: { ...COMPLETE_CARE_ANSWERS, toolFamiliesWithSomething: ["wash_application"] },
    completedQuestionIds: [...careDone, "tools_overview"],
  })
  assert.equal(halfAnswered.isComplete, false)
  assert.ok(halfAnswered.path.requiredQuestionIds.includes("tools:wash_application:1"))

  // Direct acceptance never submits the overview, so it still completes.
  const directAccept = resolveStage2RefinementContract({
    triggerContext: context,
    answers: COMPLETE_CARE_ANSWERS,
    completedQuestionIds: careDone,
  })
  assert.equal(directAccept.isComplete, true)
  assert.equal(directAccept.path.requiredQuestionIds.includes("tools_overview"), false)
})
