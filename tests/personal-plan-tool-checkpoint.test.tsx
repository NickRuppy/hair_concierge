import assert from "node:assert/strict"
import test from "node:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"

import {
  TOOL_CHECKPOINT_ADD_TOOLS_HREF,
  TOOL_CHECKPOINT_CTA,
  TOOL_CHECKPOINT_EMPTY,
  TOOL_CHECKPOINT_KICKER,
  TOOL_CHECKPOINT_LEAD,
  TOOL_CHECKPOINT_TITLE,
  ToolCheckpoint,
} from "../src/components/personal-plan-refinement/tool-checkpoint"
import {
  buildToolCheckpointGroups,
  toolCheckpointInventory,
} from "../src/lib/personal-plan/tools/checkpoint"
import { createStage2RefinementSession } from "../src/lib/personal-plan/refinement/session"
import type {
  PersonalPlanRefinementAnswersV1,
  Stage2QuestionId,
  Stage2TriggerContext,
} from "../src/lib/personal-plan/refinement/types"

/**
 * Hair Tools port, Task 10: the Tool-Checkpoint „Das hast du schon", shown once when the tools
 * module returns to the host. It reads the draft-side ownership oracle over the session the
 * module completed with: only pages the member confirmed count, families in wash-day order.
 */

const toolsTriggerContext: Stage2TriggerContext = {
  relevantCategories: ["shampoo"],
  hasReportedIrritatedScalp: false,
  dryShampooBridgeEligibility: "ineligible",
  toolsEnabled: true,
}

const PRODUCTS_DONE_IDS: Stage2QuestionId[] = ["current_product_categories", "wet_wash_frequency"]

function toolsSession(
  answers: PersonalPlanRefinementAnswersV1,
  completedQuestionIds: Stage2QuestionId[],
) {
  return createStage2RefinementSession({
    pathVersion: "tool-checkpoint-test",
    triggerContext: toolsTriggerContext,
    answers: { currentProductCategories: [], wetWashFrequency: "weekly_2x", ...answers },
    completedQuestionIds: [...PRODUCTS_DONE_IDS, ...completedQuestionIds],
    revision: 7,
  })
}

/** Lena's journey (plan §6 step 3): three sections ticked, two families answered „Nichts davon". */
const LENA_ANSWERS: PersonalPlanRefinementAnswersV1 = {
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
}

const LENA_TOOL_IDS: Stage2QuestionId[] = [
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

test("checkpoint groups follow the wash-day order, whatever order the inventory lists them in", () => {
  const groups = buildToolCheckpointGroups({
    night_protection: ["pillowcase"],
    airflow: ["hair_dryer", "hot_air_brush"],
    heated_styling: ["flat_iron"],
    brushes_combs: ["wide_tooth_comb", "round_brush"],
    drying_textiles: ["microfiber_towel"],
    wash_application: ["applicator_bottle"],
  })
  assert.deepEqual(
    groups.map((group) => group.family),
    [
      "wash_application",
      "drying_textiles",
      "brushes_combs",
      "airflow",
      "heated_styling",
      "night_protection",
    ],
  )
  assert.deepEqual(
    groups.map((group) => group.label),
    [
      "Wasch- & Auftragshilfen",
      "Handtücher & Trocknungsmaterialien",
      "Bürsten & Kämme",
      "Haartrockner & Luftstyler",
      "Hitzestyling-Tools",
      "Nachtschutz",
    ],
  )
  assert.deepEqual(
    groups.find((group) => group.family === "airflow")?.items.map((item) => item.label),
    ["Föhn", "Warmluftbürste"],
  )
  assert.equal(
    groups.find((group) => group.family === "night_protection")?.items[0]?.imageSrc,
    "/images/tools/pillowcase.webp",
  )
})

test("„Nichts davon“ families, unknown families and a fingers-only brush answer are omitted", () => {
  const groups = buildToolCheckpointGroups({
    heatless_styling: [],
    securing_sectioning: [],
    airflow: null,
    brushes_combs: ["fingers"],
    drying_textiles: ["frottee"],
  })
  // „Nur Finger" is an answer about handling, not a tool the member owns; Frottee is a towel.
  assert.deepEqual(
    groups.map((group) => group.family),
    ["drying_textiles"],
  )
  assert.deepEqual(
    groups[0]?.items.map((item) => item.label),
    ["Frottee-Handtuch"],
  )
})

test("the inventory comes from the session the tools module completed with (Lena)", () => {
  const session = toolsSession(LENA_ANSWERS, LENA_TOOL_IDS)
  const groups = buildToolCheckpointGroups(toolCheckpointInventory(session))
  assert.deepEqual(
    groups.map((group) => [group.label, group.items.map((item) => item.label)]),
    [
      ["Handtücher & Trocknungsmaterialien", ["Mikrofaser-Handtuch"]],
      ["Bürsten & Kämme", ["Grobzinkiger Kamm", "Rundbürste"]],
      ["Haartrockner & Luftstyler", ["Föhn", "Warmluftbürste"]],
      ["Hitzestyling-Tools", ["Glätteisen"]],
      ["Nachtschutz", ["Glatter Kissenbezug"]],
    ],
  )
})

test("an unticked family never shows, even with a stale page answer from an earlier visit", () => {
  // The member once owned a Föhn, then unticked „Trocknen & Stylen": the airflow page is off the
  // path and stays completed from the earlier visit. It must not read as owned.
  const session = toolsSession(
    {
      toolFamiliesWithSomething: ["night_protection"],
      toolForms: { "airflow:1": ["hair_dryer"], "night_protection:1": ["bonnet"] },
    },
    ["tools_overview", "tools:airflow:1", "tools:night_protection:1"],
  )
  const groups = buildToolCheckpointGroups(toolCheckpointInventory(session))
  assert.deepEqual(
    groups.map((group) => group.family),
    ["night_protection"],
  )
})

test("assumed pages never show as owned: a completed page off the confirmed path is not reported", () => {
  // Overview still open (direct-accept defaults), the airflow page completed off the path: an
  // assumption the member never confirmed. Nothing counts.
  const session = toolsSession({ toolForms: { "airflow:1": ["hair_dryer"] } }, ["tools:airflow:1"])
  assert.equal(session.path.orderedQuestionIds.includes("tools:airflow:1"), false)
  assert.deepEqual(buildToolCheckpointGroups(toolCheckpointInventory(session)), [])
})

test("the checkpoint renders the §4 copy, coral CTA, quiet secondary and the groups in order", () => {
  const session = toolsSession(LENA_ANSWERS, LENA_TOOL_IDS)
  const html = renderToStaticMarkup(
    <ToolCheckpoint
      groups={buildToolCheckpointGroups(toolCheckpointInventory(session))}
      onContinue={() => {}}
      onAddTools={() => {}}
    />,
  )
  assert.equal(TOOL_CHECKPOINT_KICKER, "Deine Tools")
  assert.equal(TOOL_CHECKPOINT_TITLE, "Das hast du schon")
  assert.equal(TOOL_CHECKPOINT_LEAD, "Damit planen wir ab jetzt deine Routine.")
  assert.equal(TOOL_CHECKPOINT_CTA, "Weiter zu deiner Routine")
  assert.equal(TOOL_CHECKPOINT_ADD_TOOLS_HREF, "/plan-start?refine=tools")
  assert.match(html, />Deine Tools</)
  assert.match(html, /<h1[^>]*>Das hast du schon<\/h1>/)
  assert.match(html, />Damit planen wir ab jetzt deine Routine\.</)
  assert.match(
    html,
    /<button[^>]*data-tool-checkpoint-continue[^>]*>Weiter zu deiner Routine<\/button>/,
  )
  // Coral primary: the shared funnel CTA variant.
  assert.match(
    html,
    /<button[^>]*class="[^"]*bg-\[var\(--brand-coral\)\][^"]*"[^>]*data-tool-checkpoint-continue/,
  )
  assert.match(
    html,
    /data-tool-checkpoint-add-tools[^>]*>Etwas fehlt\? <span[^>]*>Tools ergänzen<\/span><\/button>/,
  )
  const order = [...html.matchAll(/data-tool-checkpoint-group="([a-z_]+)"/g)].map((m) => m[1])
  assert.deepEqual(order, [
    "drying_textiles",
    "brushes_combs",
    "airflow",
    "heated_styling",
    "night_protection",
  ])
  assert.equal((html.match(/data-tool-thumb/g) ?? []).length, 7)
  assert.doesNotMatch(html, /Nichts davon/)
  assert.doesNotMatch(html, new RegExp(TOOL_CHECKPOINT_EMPTY))
})

test("an empty inventory keeps the screen honest: an empty note, the same CTA and secondary", () => {
  const session = toolsSession({ toolFamiliesWithSomething: [] }, ["tools_overview"])
  const groups = buildToolCheckpointGroups(toolCheckpointInventory(session))
  assert.deepEqual(groups, [])
  const html = renderToStaticMarkup(
    <ToolCheckpoint groups={groups} onContinue={() => {}} onAddTools={() => {}} />,
  )
  assert.match(html, new RegExp(TOOL_CHECKPOINT_EMPTY.replace(/\./g, "\\.")))
  assert.match(html, /data-tool-checkpoint-empty/)
  assert.match(html, />Weiter zu deiner Routine<\/button>/)
  assert.match(html, /Tools ergänzen/)
  assert.doesNotMatch(html, /data-tool-checkpoint-group=/)
})
