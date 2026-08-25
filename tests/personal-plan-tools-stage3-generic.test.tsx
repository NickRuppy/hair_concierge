import assert from "node:assert/strict"
import test from "node:test"
import { renderToStaticMarkup } from "react-dom/server"

import {
  Stage3ToolCheckpoint,
  TOOL_CHECKPOINT_BASIS_SECTION,
  TOOL_CHECKPOINT_KICKER,
  TOOL_CHECKPOINT_LEAD,
  TOOL_CHECKPOINT_OPTIONAL_SECTION,
} from "@/components/personal-plan-products/tool-checkpoint"
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

/**
 * Stage 3 renders Variante D2 — pure Idealplan analog (D2 redesign, Nick
 * sign-off 2026-08-25): two tier blocks with counters, pastel family cards, and
 * NO ownership status anywhere on the page. Ownership stays where it is
 * collected and used — the Feinschliff and the Routine steps — so the state
 * labels below are asserted on the view model (the Stage-1 contract) and
 * asserted ABSENT from the Stage-3 markup.
 */

const CARE_ANSWERS: PersonalPlanRefinementAnswersV1 = {
  currentProductCategories: [],
  wetWashFrequency: "weekly_2x",
  towel: { material: "mikrofaser", technique: "gentle_press" },
  dryingRoutes: ["ordinary_blow_dry"],
  additionalHeatTools: [],
  heatEvents: {},
  nightProtection: [],
}

/** Every state label the Stage-3 section must never show. */
const OWNERSHIP_LABELS = [
  "Nutze deins",
  "Konkretes Produkt folgt",
  "Bestand im Feinschliff prüfen",
  "Neu einplanen",
]

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
    buildStage1ToolBlocks(buildToolPlan({ routes }), { hasOptionalPage: false }).basis?.cards ?? []
  )
}

function assertNoOwnershipClaim(markup: string) {
  for (const label of OWNERSHIP_LABELS) {
    assert.equal(markup.includes(label), false, `"${label}" must not appear on Stage 3`)
  }
}

test("a reported Tool keeps its form without claiming ownership on Stage 3", () => {
  const cards = checkpointCards({
    ...CARE_ANSWERS,
    toolForms: { brushes_combs: ["wide_tooth_comb"] },
  })
  const brush = cards.find((card) => card.familyLabel === "Bürsten & Kämme")
  assert.equal(brush?.state, "use_yours", "the Stage-1 view model still knows the ownership")
  assert.equal(brush?.typeLabel, "Grobzinkiger Kamm")

  const markup = renderToStaticMarkup(<Stage3ToolCheckpoint cards={cards} onContinue={() => {}} />)
  assert.ok(markup.includes("Grobzinkiger Kamm"), "the reported form stays the lead")
  assertNoOwnershipClaim(markup)
  // No care-product comparison anatomy is manufactured for a durable Tool.
  for (const forbidden of ["Preis", "€", "Vergleich", "Passt zu dir", "Verfügbar"]) {
    assert.equal(markup.includes(forbidden), false, `${forbidden} must not appear`)
  }
})

test("an explicitly missing route stays a useful generic type with no gap disclaimer", () => {
  const cards = checkpointCards({ ...CARE_ANSWERS, toolForms: { brushes_combs: [] } })
  const brush = cards.find((card) => card.familyLabel === "Bürsten & Kämme")
  assert.equal(brush?.state, "catalog_gap")
  // D6: the route order is the lead-form decision. B02 gives a straight profile
  // the Detangling-Bürste; the old expectation was the canonical family order
  // leaking through `assetFormsFor`.
  assert.equal(brush?.typeLabel, "Detangling-Bürste", "the generic form stays visible and useful")

  const markup = renderToStaticMarkup(<Stage3ToolCheckpoint cards={cards} onContinue={() => {}} />)
  assert.ok(markup.includes("Detangling-Bürste"))
  assertNoOwnershipClaim(markup)
  // The gap disclaimer went with the status pills; the new lead carries the
  // message that this page is about the need, not about a concrete product.
  assert.equal(markup.includes("Sobald ein geprüftes dazukommt"), false)
  assert.ok(markup.includes(TOOL_CHECKPOINT_LEAD))
  assert.ok(markup.includes(TOOL_CHECKPOINT_KICKER))
})

test("unknown inventory keeps the checkpoint honest without inventing an answer", () => {
  const cards = checkpointCards(CARE_ANSWERS)
  const brush = cards.find((card) => card.familyLabel === "Bürsten & Kämme")
  assert.equal(brush?.state, "check_in_refinement")
  assertNoOwnershipClaim(
    renderToStaticMarkup(<Stage3ToolCheckpoint cards={cards} onContinue={() => {}} />),
  )
})

test("the section mirrors the Idealplan: two tier blocks, each with its counter", () => {
  const cards = checkpointCards({ ...CARE_ANSWERS, toolForms: { brushes_combs: [] } })
  const basisCount = cards.filter((card) => card.tier === "basis").length
  const optionalCount = cards.filter((card) => card.tier === "optional").length
  assert.ok(basisCount > 0 && optionalCount > 0, "the fixture must exercise both tiers")

  const markup = renderToStaticMarkup(<Stage3ToolCheckpoint cards={cards} onContinue={() => {}} />)
  assert.ok(markup.includes(TOOL_CHECKPOINT_BASIS_SECTION))
  assert.ok(markup.includes(TOOL_CHECKPOINT_OPTIONAL_SECTION))
  assert.ok(markup.includes(`${basisCount} ${basisCount === 1 ? "Tool" : "Tools"}`))
  assert.ok(markup.includes(`${optionalCount} ${optionalCount === 1 ? "Tool" : "Tools"}`))
  assert.ok(markup.includes('data-stage3-tool-tier="basis"'))
  assert.ok(markup.includes('data-stage3-tool-tier="optional"'))
  // Only the optional tier carries the Idealplan-optional chip.
  assert.equal((markup.match(/>Optional</g) ?? []).length, optionalCount)
})

test("a tier with no Tool renders no empty block", () => {
  const cards = checkpointCards({ ...CARE_ANSWERS, toolForms: { brushes_combs: [] } }).filter(
    (card) => card.tier === "basis",
  )
  const markup = renderToStaticMarkup(<Stage3ToolCheckpoint cards={cards} onContinue={() => {}} />)
  assert.ok(markup.includes(TOOL_CHECKPOINT_BASIS_SECTION))
  assert.equal(markup.includes(TOOL_CHECKPOINT_OPTIONAL_SECTION), false)
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
  // The Stage-1 Idealplan block keeps its own wording, unchanged by D2.
  assert.equal(towel?.typeLabel, "Mikrofaser-Handtuch, Baumwolltuch oder Haarturban")
  assert.equal(
    towel?.noteDe,
    "Entscheidend ist die Technik, nicht das Material: sanft ausdrücken statt rubbeln.",
  )
  // Stage 3 leads with the need and names the forms as one neutral „Auch ok" line.
  assert.equal(towel?.stage3.title, "Handtuch oder Tuch")
  assert.equal(towel?.stage3.note, "Sanft ausdrücken statt rubbeln — die Technik zählt.")
  assert.equal(towel?.stage3.alternatives, "Auch ok: Mikrofaser, Baumwolltuch oder Haarturban")

  const markup = renderToStaticMarkup(<Stage3ToolCheckpoint cards={cards} onContinue={() => {}} />)
  assert.ok(markup.includes("Handtuch oder Tuch"))
  assert.ok(markup.includes("Auch ok: Mikrofaser, Baumwolltuch oder Haarturban"))
  // The technique line replaces the purpose, so the card never says it twice.
  assert.equal(markup.includes("Um Wasser sanft aufzunehmen"), false)
  for (const claim of ["reibungsärmer", "schont", "verhindert", "am besten", "am wenigsten"]) {
    assert.equal(markup.includes(claim), false, `unsupported claim "${claim}" must not appear`)
  }
})

test("families that legitimately lead with one form name their alternative", () => {
  const cards = checkpointCards({ ...CARE_ANSWERS, toolForms: { brushes_combs: [] } })
  const brush = cards.find((card) => card.familyLabel === "Bürsten & Kämme")
  assert.equal(brush?.typeLabel, "Detangling-Bürste", "brushes keep one recommended form")
  // Stage 1 keeps the long line; Stage 3 says the same thing in telegram form.
  assert.ok(
    brush?.noteDe?.startsWith("Alternative: "),
    `expected an alternative line, got ${String(brush?.noteDe)}`,
  )
  assert.equal(brush?.stage3.alternatives, "Auch ok: Grobzinkiger Kamm")

  const markup = renderToStaticMarkup(<Stage3ToolCheckpoint cards={cards} onContinue={() => {}} />)
  assert.ok(markup.includes("Auch ok: Grobzinkiger Kamm"))
  assert.equal(markup.includes("wenn diese Form besser zu dir passt"), false)
})
