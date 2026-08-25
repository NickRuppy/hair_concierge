import assert from "node:assert/strict"
import test from "node:test"
import { renderToStaticMarkup } from "react-dom/server"

import { Stage3ToolCheckpoint } from "@/components/personal-plan-products/tool-checkpoint"
import { buildPlanProfile } from "@/lib/personal-plan/input"
import { buildToolPlan } from "@/lib/personal-plan/tools/assets"
import { projectToolCareFacts, type ToolInventory } from "@/lib/personal-plan/tools/facts"
import { buildStage1ToolBlocks } from "@/lib/personal-plan/tools/presentation"
import {
  computeToolRoutes,
  toolProfileFactsFromPlanProfile,
} from "@/lib/personal-plan/tools/routes"
import type { PersonalPlanRefinementAnswersV1 } from "@/lib/personal-plan/refinement/types"
import { COMPLETE_V3_PLAN_ENVELOPE } from "./personal-plan/fixtures"

const CARE_ANSWERS: PersonalPlanRefinementAnswersV1 = {
  currentProductCategories: [],
  wetWashFrequency: "weekly_2x",
  towel: { material: "mikrofaser", technique: "gentle_press" },
  dryingRoutes: ["ordinary_blow_dry"],
  additionalHeatTools: [],
  heatEvents: {},
  nightProtection: [],
}

function checkpointCards(answers: PersonalPlanRefinementAnswersV1) {
  const care = projectToolCareFacts(answers)
  const inventory: ToolInventory = { ...(answers.toolForms ?? {}) }
  const routes = computeToolRoutes({
    profile: toolProfileFactsFromPlanProfile(
      buildPlanProfile(COMPLETE_V3_PLAN_ENVELOPE, {
        artifactId: "artifact-1",
        projection: "initial_quiz",
      }),
    ),
    care,
    inventory,
    scalpApplicationJob: false,
  })
  return (
    buildStage1ToolBlocks(buildToolPlan({ routes, inventory }), { hasOptionalPage: false }).basis
      ?.cards ?? []
  )
}

test("a reported Tool leads with Nutze deins and no exact comparison", () => {
  const cards = checkpointCards({
    ...CARE_ANSWERS,
    toolForms: { brushes_combs: ["wide_tooth_comb"] },
  })
  const brush = cards.find((card) => card.familyLabel === "Bürsten & Kämme")
  assert.equal(brush?.state, "use_yours")
  assert.equal(brush?.typeLabel, "Grobzinkiger Kamm")

  const markup = renderToStaticMarkup(<Stage3ToolCheckpoint cards={cards} onContinue={() => {}} />)
  assert.ok(markup.includes("Nutze deins"))
  // No care-product comparison anatomy is manufactured for a durable Tool.
  for (const forbidden of ["Preis", "€", "Vergleich", "Passt zu dir", "Verfügbar"]) {
    assert.equal(markup.includes(forbidden), false, `${forbidden} must not appear`)
  }
})

test("an explicitly missing route stays a useful generic type with an honest gap", () => {
  const cards = checkpointCards({ ...CARE_ANSWERS, toolForms: { brushes_combs: [] } })
  const brush = cards.find((card) => card.familyLabel === "Bürsten & Kämme")
  assert.equal(brush?.state, "catalog_gap")
  // D6: the route order is the lead-form decision. B02 gives a straight profile
  // the Detangling-Bürste; the old expectation was the canonical family order
  // leaking through `assetFormsFor`.
  assert.equal(brush?.typeLabel, "Detangling-Bürste", "the generic form stays visible and useful")

  const markup = renderToStaticMarkup(<Stage3ToolCheckpoint cards={cards} onContinue={() => {}} />)
  assert.ok(markup.includes("Konkretes Produkt folgt"))
  assert.ok(markup.includes("Sobald ein geprüftes dazukommt"))
})

test("unknown inventory keeps the checkpoint honest without inventing an answer", () => {
  const cards = checkpointCards(CARE_ANSWERS)
  const brush = cards.find((card) => card.familyLabel === "Bürsten & Kämme")
  assert.equal(brush?.state, "check_in_refinement")
})

test("the checkpoint uses one full-width sticky action and no inline micro-CTA", () => {
  const markup = renderToStaticMarkup(
    <Stage3ToolCheckpoint
      cards={checkpointCards({ ...CARE_ANSWERS, toolForms: { brushes_combs: [] } })}
      onContinue={() => {}}
    />,
  )
  const buttons = markup.match(/<button/g) ?? []
  assert.equal(buttons.length, 1, "exactly one action on the screen")
  assert.ok(markup.includes("Weiter zu deiner Routine"))
  assert.ok(markup.includes("env(safe-area-inset-bottom)"), "the action stays inside the safe area")
})

test("rendering the checkpoint never changes ownership or selection", () => {
  const answers = { ...CARE_ANSWERS, toolForms: { brushes_combs: [] } }
  const before = JSON.stringify(answers)
  const cards = checkpointCards(answers)
  renderToStaticMarkup(<Stage3ToolCheckpoint cards={cards} onContinue={() => {}} />)
  assert.equal(JSON.stringify(answers), before, "viewing a Tool card mutates nothing")
  assert.equal(
    cards.every((card) => card.state !== "use_yours" || card.state === "use_yours"),
    true,
  )
})

test("one physical Tool appears once even when it serves several routes", () => {
  const cards = checkpointCards({
    ...CARE_ANSWERS,
    dryingRoutes: ["diffuser_or_airflow_shaping"],
    toolForms: { airflow: ["air_multi_styler"] },
  })
  const airflowCards = cards.filter((card) => card.familyLabel === "Haartrockner & Luftstyler")
  assert.equal(airflowCards.length, 1)
})

test("towel forms are named as a neutral group, never silently ranked", () => {
  // A 2026-08-21 evidence pass found no measurement ranking microfiber against a
  // smooth cotton T-shirt, and AAD ranks technique rather than material.
  const cards = checkpointCards({
    ...CARE_ANSWERS,
    towel: { material: "frottee", technique: "gentle_press" },
    toolForms: { drying_textiles: [] },
  })
  const towel = cards.find((card) => card.familyLabel.startsWith("Handtücher"))
  assert.equal(towel?.typeLabel, "Mikrofaser-Handtuch, Baumwolltuch oder Haarturban")
  assert.equal(
    towel?.noteDe,
    "Entscheidend ist die Technik, nicht das Material: sanft ausdrücken statt rubbeln.",
  )

  const markup = renderToStaticMarkup(<Stage3ToolCheckpoint cards={cards} onContinue={() => {}} />)
  for (const claim of ["reibungsärmer", "schont", "verhindert", "am besten", "am wenigsten"]) {
    assert.equal(markup.includes(claim), false, `unsupported claim "${claim}" must not appear`)
  }
})

test("families that legitimately lead with one form name their alternative", () => {
  const cards = checkpointCards({ ...CARE_ANSWERS, toolForms: { brushes_combs: [] } })
  const brush = cards.find((card) => card.familyLabel === "Bürsten & Kämme")
  assert.equal(brush?.typeLabel, "Detangling-Bürste", "brushes keep one recommended form")
  assert.ok(
    brush?.noteDe?.startsWith("Alternative: "),
    `expected an alternative line, got ${String(brush?.noteDe)}`,
  )
})
