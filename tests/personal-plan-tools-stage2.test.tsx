import assert from "node:assert/strict"
import { existsSync } from "node:fs"
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
import {
  TOOL_FORM_PAGES,
  TOOL_MAX_OPTIONS_PER_PAGE,
  TOOL_OVERVIEW_SECTIONS,
  toolImageSrc,
} from "@/lib/personal-plan/tools/labels"
import {
  defaultToolFormsFromCare,
  defaultToolSectionsFromCare,
  TOOL_OVERVIEW_LEAD,
  TOOL_OVERVIEW_OPTIONS,
  toolFormPagePresentation,
} from "@/lib/personal-plan/tools/stage2"
import { TOOL_PRODUCT_TYPES } from "@/lib/personal-plan/tools/contracts"
import {
  EMPTY_TOOL_CARE_FACTS,
  projectToolCareFacts,
  reportedFormsFor,
} from "@/lib/personal-plan/tools/facts"
import {
  computeToolRoutes,
  toolProfileFactsFromPlanProfile,
} from "@/lib/personal-plan/tools/routes"
import { buildPlanProfile } from "@/lib/personal-plan/input"
import {
  getAnswerForQuestion,
  RefinementQuestion,
} from "@/components/personal-plan-refinement/refinement-question"
import { ToolVisualMultiSelect } from "@/components/personal-plan-refinement/tool-inventory"
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

/** Care answered, but nothing that implies owning a Tool. */
const EMPTY_CARE_ANSWERS: PersonalPlanRefinementAnswersV1 = {
  currentProductCategories: [],
  wetWashFrequency: "weekly_2x",
  towel: { material: "no_towel" },
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

test("a product-form page stays inside the ratified card budget", () => {
  for (const page of TOOL_FORM_PAGES) {
    assert.ok(
      page.forms.length <= TOOL_MAX_OPTIONS_PER_PAGE,
      `${page.pageKey} shows ${page.forms.length} options`,
    )
    assert.ok(page.forms.length >= 1)
  }
  // Nick ruling 2026-08-26: heated and heatless capture their whole family on
  // ONE page (8 and 5 cards); the ratified Bürsten page carries six; every
  // other page keeps four.
  const oversized = TOOL_FORM_PAGES.filter((page) => page.forms.length > 4).map(
    (page) => page.pageKey,
  )
  assert.deepEqual(oversized, ["heated_styling:1", "heatless_styling:1", "brushes_combs:1"])
  for (const family of ["heated_styling", "heatless_styling"] as const) {
    const pages = TOOL_FORM_PAGES.filter((page) => page.family === family)
    assert.equal(pages.length, 1, `${family} captures on one page`)
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
  assert.equal(drying?.reportedOwnership.state, "owned_generic")
  assert.equal(
    drying?.reportedOwnership.provenance,
    "derived",
    "a reused drying answer is a behaviour we projected, not a Tool the user reported (D4)",
  )
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
  assert.ok(page!.options.length <= TOOL_MAX_OPTIONS_PER_PAGE)
  // `R3` + `D9b`: the ratified Bürsten page carries the restored
  // Wildschweinborsten-Bürste and the „Nur Finger" answer-only card.
  assert.deepEqual(
    page!.options.map((option) => option.value),
    [
      "wide_tooth_comb",
      "detangling_brush",
      "paddle_brush",
      "vent_brush",
      "boar_bristle",
      "fingers",
    ],
  )
  assert.equal(page!.options.at(-2)?.label, "Wildschweinborsten-Bürste")
  assert.equal(page!.options.at(-1)?.label, "Nur Finger")
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

// --- WS4: ratified copy, preselection, the two new Bürsten cards -------------

const CARE_DONE: Stage2QuestionId[] = [
  "current_product_categories",
  "wet_wash_frequency",
  "towel_handling",
  "drying_routes",
  "additional_heat_tools",
  "night_protection",
]

const CARE_WITH_TOOLS: PersonalPlanRefinementAnswersV1 = {
  ...COMPLETE_CARE_ANSWERS,
  dryingRoutes: ["ordinary_blow_dry"],
  heatEvents: { "heat:ordinary_blow_dry": { frequency: "weekly_2x" } },
  nightProtection: ["silk_satin_bonnet"],
}

function completedIdsFor(answers: PersonalPlanRefinementAnswersV1): Stage2QuestionId[] {
  // The heat questions the care answers themselves open must be answered before
  // the Tool trip becomes the current question.
  return [
    ...CARE_DONE,
    ...Object.keys(answers.heatEvents ?? {}).map((id) => id as Stage2QuestionId),
  ]
}

function toolSession(
  answers: PersonalPlanRefinementAnswersV1,
  completed = completedIdsFor(answers),
) {
  return createStage2RefinementSession({
    pathVersion: "test",
    triggerContext: { ...BASE_CONTEXT, toolsEnabled: true },
    answers,
    completedQuestionIds: completed,
  })
}

function renderQuestion(session: ReturnType<typeof toolSession>, questionId: Stage2QuestionId) {
  return renderToStaticMarkup(
    <RefinementQuestion
      session={session}
      questionId={questionId}
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
}

test("D3a: the overview lead states the ruling instead of the withdrawn promise", () => {
  assert.equal(
    TOOL_OVERVIEW_LEAD,
    "Wähle die Bereiche, aus denen du schon Produkte hast. Nicht gewählt = hast du nicht.",
  )
  const markup = renderQuestion(toolSession(COMPLETE_CARE_ANSWERS), "tools_overview")
  assert.ok(markup.includes("Nicht gewählt = hast du nicht."))
  assert.equal(
    markup.includes("bleibt offen"),
    false,
    "the withdrawn promise must not survive anywhere on the page",
  )
})

test("D3a: care answers preselect the overview and the drilldowns", () => {
  // The unanswered overview starts from what the care answers already imply.
  assert.deepEqual(getAnswerForQuestion(CARE_WITH_TOOLS, "tools_overview"), [
    "trocknen_stylen",
    "tuecher_nachtschutz",
  ])
  assert.deepEqual(getAnswerForQuestion(CARE_WITH_TOOLS, "tools:airflow:1"), ["hair_dryer"])
  // Nothing implied stays unanswered — never an explicit `[]`, which would
  // pre-select a „Nichts davon" the user never said.
  assert.equal(getAnswerForQuestion(COMPLETE_CARE_ANSWERS, "tools:brushes_combs:1"), undefined)
  assert.equal(getAnswerForQuestion(EMPTY_CARE_ANSWERS, "tools_overview"), undefined)

  const markup = renderQuestion(toolSession(CARE_WITH_TOOLS), "tools_overview")
  assert.match(markup, /aria-pressed="true"[^>]*data-tool-option="trocknen_stylen"/)
  assert.match(markup, /aria-pressed="false"[^>]*data-tool-option="waschen_auftragen"/)
  assert.match(markup, /aria-pressed="false"[^>]*data-tool-nothing-option/)
})

test("D3a: submitting the preselected overview unchanged keeps the care-implied families", () => {
  const session = toolSession(CARE_WITH_TOOLS)
  const preselected = getAnswerForQuestion(session.answers, "tools_overview")
  const submitted = saveStage2SessionAnswer(session, {
    questionId: "tools_overview",
    answer: preselected,
  })
  assert.deepEqual(submitted.answers.toolFamiliesWithSomething, [
    "airflow",
    "heated_styling",
    "heatless_styling",
    "night_protection",
    "drying_textiles",
  ])
  // The families behind the kept sections are NOT overwritten with a synthesized
  // emptiness; only the unticked ones become an explicit none (`D3a`/`D3c`).
  assert.equal(submitted.answers.toolForms?.airflow, undefined)
  assert.equal(submitted.answers.toolForms?.night_protection, undefined)
  assert.deepEqual(submitted.answers.toolForms?.brushes_combs, [])
  assert.deepEqual(submitted.answers.toolForms?.wash_application, [])
})

test('a selection that lives on another page of the family never pre-lights „Nichts davon"', () => {
  // A family can span pages (`brushes_combs` still does), and every page of it
  // receives the whole family array. When the only selected form belongs to
  // another page, THIS page shows nothing ticked — but a lit „Nichts davon"
  // would be a claim about this page that the user never made, so it stays off
  // until the page is their own answer.
  //
  // Driven against the component rather than through a care preselection: since
  // the 2026-08-26 one-page-per-family ruling, no care-projected family spans
  // pages any more, and the guard lives here.
  const page = toolFormPagePresentation("brushes_combs:1")
  assert.ok(page)
  const foreignForm = "round_brush" // brushes_combs page 2
  assert.equal(
    page!.options.some((option) => option.value === foreignForm),
    false,
    "the fixture form must not be offered on this page",
  )

  const render = (answered: boolean) =>
    renderToStaticMarkup(
      <ToolVisualMultiSelect
        ariaLabel={page!.title}
        options={page!.options}
        selected={[foreignForm]}
        onChange={() => {}}
        nothingLabel="Nichts davon"
        answered={answered}
      />,
    )

  assert.match(render(false), /aria-pressed="false"[^>]*data-tool-nothing-option/)
  // Once the page IS the user's own answer, the empty page reads as „Nichts davon".
  assert.match(render(true), /aria-pressed="true"[^>]*data-tool-nothing-option/)
})

test('R3 + D9b: the Bürsten page carries Wildschweinborsten-Bürste and „Nur Finger"', () => {
  const markup = renderQuestion(toolSession(COMPLETE_CARE_ANSWERS), "tools:brushes_combs:1")
  assert.ok(markup.includes('data-tool-option="boar_bristle"'))
  assert.ok(markup.includes('data-tool-option="fingers"'))
  assert.ok(markup.includes("Wildschweinborsten-Bürste"))
  assert.ok(markup.includes("Nur Finger"))
  assert.ok(markup.includes("Du entwirrst mit den Händen."))
  assert.ok(markup.includes('data-tool-option-count="6"'))
  // The long compound label must be allowed to break instead of running under
  // the selection circle.
  assert.ok(markup.includes("hyphens-auto"))
  assert.ok(markup.includes("break-words"))
})

test("D9b: `fingers` round-trips as a persisted brushes answer and never becomes a product", () => {
  const opened = saveStage2SessionAnswer(toolSession(COMPLETE_CARE_ANSWERS), {
    questionId: "tools_overview",
    answer: ["entwirren_fixieren"],
  })
  const answered = saveStage2SessionAnswer(opened, {
    questionId: "tools:brushes_combs:1",
    answer: ["fingers"],
  })
  assert.deepEqual(answered.answers.toolForms?.brushes_combs, ["fingers"])
  assert.ok(answered.completedQuestionIds.includes("tools:brushes_combs:1"))
  // The route layer strips it: the user answered, and what they own is no product.
  assert.deepEqual(reportedFormsFor({ brushes_combs: ["fingers"] }, "brushes_combs"), [])
  assert.equal(
    (TOOL_PRODUCT_TYPES as readonly string[]).includes("fingers"),
    false,
    "`fingers` is never a recommendable product type",
  )
})

test("a family answer is stored in canonical order whatever order the pages were walked", () => {
  const opened = saveStage2SessionAnswer(toolSession(COMPLETE_CARE_ANSWERS), {
    questionId: "tools_overview",
    answer: ["entwirren_fixieren"],
  })
  // Page 1 carries `boar_bristle`, which sorts AFTER page 2's `round_brush`.
  const page1 = saveStage2SessionAnswer(opened, {
    questionId: "tools:brushes_combs:1",
    answer: ["detangling_brush", "boar_bristle", "fingers"],
  })
  const page2 = saveStage2SessionAnswer(page1, {
    questionId: "tools:brushes_combs:2",
    answer: ["detangling_brush", "boar_bristle", "fingers", "round_brush"],
  })
  assert.deepEqual(page2.answers.toolForms?.brushes_combs, [
    "detangling_brush",
    "round_brush",
    "boar_bristle",
    "fingers",
  ])
  assert.ok(page2.completedQuestionIds.includes("tools:brushes_combs:2"))

  // And an already-answered earlier page stays editable afterwards.
  const edited = saveStage2SessionAnswer(page2, {
    questionId: "tools:brushes_combs:1",
    answer: ["round_brush", "wide_tooth_comb"],
  })
  assert.deepEqual(edited.answers.toolForms?.brushes_combs, ["wide_tooth_comb", "round_brush"])
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

test("every capture card resolves to a real image file — nothing 404s", () => {
  // Since 2026-08-26 every form carries an approved photo Bildkarte
  // (/images/tools/*.webp). The line-art fallback in `toolImageSrc` stays as a
  // safety net for a form added before its photo, but no card may use it today.
  const publicRoot = new URL("../public/", import.meta.url)
  const resolve = (imageUrl: string) => new URL(imageUrl.replace(/^\//, ""), publicRoot)
  for (const page of TOOL_FORM_PAGES) {
    const presentation = toolFormPagePresentation(page.pageKey)
    assert.ok(presentation, page.pageKey)
    for (const option of presentation!.options) {
      assert.ok(
        existsSync(resolve(option.imageUrl)),
        `${option.value} has no image at ${option.imageUrl}`,
      )
      assert.ok(
        option.imageUrl.startsWith("/images/tools/") && option.imageUrl.endsWith(".webp"),
        `${option.value} still falls back to line art (${option.imageUrl})`,
      )
      assert.ok(option.imageAlt.length > 0)
    }
  }
  for (const option of TOOL_OVERVIEW_OPTIONS) {
    assert.ok(
      existsSync(resolve(option.imageUrl)),
      `${option.value} has no image at ${option.imageUrl}`,
    )
    assert.ok(
      option.imageUrl.startsWith("/images/tools/") && option.imageUrl.endsWith(".webp"),
      `${option.value} still falls back to line art (${option.imageUrl})`,
    )
  }

  // Every `ToolReportedForm`, not only the ones a page happens to offer.
  for (const form of TOOL_PRODUCT_TYPES) {
    const src = toolImageSrc(form)
    assert.ok(existsSync(resolve(src)), `${form} has no image at ${src}`)
    assert.ok(src.endsWith(".webp"), `${form} still falls back to line art (${src})`)
  }
})
