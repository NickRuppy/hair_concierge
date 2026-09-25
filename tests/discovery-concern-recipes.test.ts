import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"

import { CONCERN_RECIPES, concernRecipeFor } from "../src/lib/discovery/concern-recipes"
import {
  UNKNOWN_CONCERN_PROFILE_FACTS,
  buildDiscoveryConcernRecipeView,
  discoveryConcernCoverageInput,
  discoveryConcernProfileFacts,
  evaluateConcernRecipeWhen,
  type DiscoveryConcernProfileFacts,
} from "../src/lib/discovery/concern-recipe-view"
import { DIAGNOSTIC_CONCERNS } from "../src/lib/quiz/diagnostic-input"

/**
 * The main-problem recipe (batch 7c, F9): the typed table mirrors the research JSON, the
 * `when` gates read her profile with „prüfen" for unknown facts, and every recipe category
 * says whether she already has it and whether the Idealroutine contains it.
 */

const RECIPES_JSON = path.join(process.cwd(), "docs/research/concern-recipes/recipes.json")

const known: DiscoveryConcernProfileFacts = {
  hair_texture: "straight",
  thickness: "normal",
  scalp_type: "balanced",
  chemical_treatment: [],
  damaged: false,
  heat_styling: false,
}

// --- the table ------------------------------------------------------------------

test("the TS table equals recipes.json, the research's source of truth", () => {
  const json: unknown = JSON.parse(readFileSync(RECIPES_JSON, "utf8"))
  assert.deepEqual(CONCERN_RECIPES, json)
})

test("every quiz concern has exactly one recipe, and nothing else does", () => {
  const codes = CONCERN_RECIPES.map((recipe) => recipe.code)
  assert.deepEqual([...codes].sort(), [...DIAGNOSTIC_CONCERNS].sort())
  assert.equal(new Set(codes).size, codes.length)
  for (const code of DIAGNOSTIC_CONCERNS) assert.equal(concernRecipeFor(code)?.code, code)
})

test("hair loss stays a boundary: no product category anywhere in its recipe", () => {
  const recipe = concernRecipeFor("hair_loss_or_thinning")
  assert.ok(recipe?.boundary)
  assert.deepEqual(recipe.primary.categories, [])
  assert.deepEqual(recipe.conditional, [])
  assert.ok(recipe.primary.levers.every((lever) => lever.category === undefined))
})

// --- `when` ---------------------------------------------------------------------

test("`when`: OR within a key, AND across keys", () => {
  assert.equal(
    evaluateConcernRecipeWhen({ thickness: ["normal", "coarse"] }, known).result,
    "match",
  )
  assert.equal(evaluateConcernRecipeWhen({ thickness: ["coarse"] }, known).result, "no_match")
  assert.equal(
    evaluateConcernRecipeWhen({ hair_texture: ["straight"], thickness: ["coarse"] }, known).result,
    "no_match",
  )
  assert.equal(
    evaluateConcernRecipeWhen(
      { chemical_treatment: ["lightened", "permed"] },
      { ...known, chemical_treatment: ["colored", "permed"] },
    ).result,
    "match",
  )
  assert.equal(
    evaluateConcernRecipeWhen({ damaged: true }, { ...known, damaged: true }).result,
    "match",
  )
  assert.equal(evaluateConcernRecipeWhen({ heat_styling: true }, known).result, "no_match")
})

test("`when`: an unknown fact makes the gate „prüfen“ — unless a known fact already fails it", () => {
  const unknownHeat = { ...known, heat_styling: null }
  const heat = evaluateConcernRecipeWhen({ heat_styling: true }, unknownHeat)
  assert.equal(heat.result, "unknown")
  assert.deepEqual(heat.unknownKeys, ["heat_styling"])

  const unknownDamage = { ...known, damaged: null }
  assert.equal(
    evaluateConcernRecipeWhen({ damaged: true, thickness: ["normal", "coarse"] }, unknownDamage)
      .result,
    "unknown",
  )
  // Fine hair never unlocks the damaged-hair mask, whatever the damage turns out to be.
  assert.equal(
    evaluateConcernRecipeWhen(
      { damaged: true, thickness: ["normal", "coarse"] },
      { ...unknownDamage, thickness: "fine" },
    ).result,
    "no_match",
  )
  assert.equal(
    evaluateConcernRecipeWhen({ hair_texture: ["curly"] }, UNKNOWN_CONCERN_PROFILE_FACTS).result,
    "unknown",
  )
})

// --- her profile ----------------------------------------------------------------

function snapshot(overrides: {
  texture?: string
  thickness?: string
  surface?: string
  elasticity?: string
  chemicalTreatments?: string[]
  oiliness?: string
  heat?: { state: "present" | "absent" | "unknown"; frequencies?: string[]; route?: string }
}) {
  const heat = overrides.heat ?? { state: "unknown" }
  return {
    profile: {
      hair: {
        texture: overrides.texture ?? "wavy",
        thickness: overrides.thickness ?? "normal",
        surface: overrides.surface ?? "smooth",
        elasticity: overrides.elasticity ?? "stretches_bounces",
        chemicalTreatments: overrides.chemicalTreatments ?? ["natural"],
      },
      scalp: { oiliness: overrides.oiliness ?? "balanced" },
    },
    assessments: {
      heatExposure: {
        state: heat.state,
        events: (heat.frequencies ?? []).map((frequency, index) => ({
          id: `heat-${index}`,
          tool: "straightener",
          route: heat.route ?? "direct_contact_heat",
          frequency,
          sourceRuleIds: [],
        })),
      },
    },
  }
}

test("profile facts come from the Idealplan's own snapshot", () => {
  assert.deepEqual(
    discoveryConcernProfileFacts(
      snapshot({
        texture: "curly",
        thickness: "coarse",
        oiliness: "oily",
        chemicalTreatments: ["colored"],
        heat: { state: "present", frequencies: ["weekly_1x"] },
      }),
    ),
    {
      hair_texture: "curly",
      thickness: "coarse",
      scalp_type: "oily",
      chemical_treatment: ["colored"],
      // Colour alone does not count as damaged (README, open domain question).
      damaged: false,
      heat_styling: true,
    },
  )
})

test("damaged = lightened/permed/straightened, or snaps, or a rough surface", () => {
  const damaged = (overrides: Parameters<typeof snapshot>[0]) =>
    discoveryConcernProfileFacts(snapshot(overrides)).damaged
  assert.equal(damaged({ chemicalTreatments: ["lightened"] }), true)
  assert.equal(damaged({ chemicalTreatments: ["chemically_straightened"] }), true)
  assert.equal(damaged({ elasticity: "snaps" }), true)
  assert.equal(damaged({ surface: "rough" }), true)
  assert.equal(damaged({ chemicalTreatments: ["colored"], surface: "slightly_uneven" }), false)
})

test("heat styling: weekly or more counts, rarer does not, unknown stays unknown", () => {
  const heat = (state: "present" | "absent" | "unknown", frequencies: string[] = []) =>
    discoveryConcernProfileFacts(snapshot({ heat: { state, frequencies } })).heat_styling
  assert.equal(heat("present", ["monthly_1x", "daily_1x"]), true)
  assert.equal(heat("present", ["less_than_monthly", "biweekly_1x"]), false)
  assert.equal(heat("absent"), false)
  assert.equal(heat("unknown"), null)
})

test("heat styling counts only styling heat — plain blow-drying does not", () => {
  const heat = (route: string) =>
    discoveryConcernProfileFacts(
      snapshot({ heat: { state: "present", frequencies: ["daily_1x"], route } }),
    ).heat_styling
  assert.equal(heat("ordinary_airflow"), false)
  assert.equal(heat("direct_contact_heat"), true)
  assert.equal(heat("airflow_shaping"), true)
})

test("no readable snapshot: every fact is unknown, nothing throws", () => {
  assert.deepEqual(discoveryConcernProfileFacts(undefined), UNKNOWN_CONCERN_PROFILE_FACTS)
  assert.deepEqual(discoveryConcernProfileFacts({}), UNKNOWN_CONCERN_PROFILE_FACTS)
})

// --- coverage -------------------------------------------------------------------

test("coverage: „hat sie“ reads her products (usage or type), „Idealroutine“ reads the steps", () => {
  const coverage = discoveryConcernCoverageInput({
    intakeProducts: [
      { category: "leave_in", productType: "conditioner" },
      { category: null, productType: null },
      { category: "mask", productType: null },
    ],
    steps: [{ category: "shampoo" }, { category: "leave_in" }],
  })
  const view = buildDiscoveryConcernRecipeView("dry_lengths", known, coverage)
  assert.ok(view)
  const byCategory = new Map(view.primaryCategories.map((entry) => [entry.category, entry]))
  assert.deepEqual(byCategory.get("conditioner")?.coverage, { owned: true, inRoutine: false })
  assert.deepEqual(byCategory.get("leave_in")?.coverage, { owned: true, inRoutine: true })
  assert.deepEqual(byCategory.get("shampoo")?.coverage, { owned: false, inRoutine: true })
})

// --- the view -------------------------------------------------------------------

const noCoverage = discoveryConcernCoverageInput({ intakeProducts: [], steps: [] })

test("the view keeps only the conditionals that apply or need checking", () => {
  const curlyCoarse = buildDiscoveryConcernRecipeView(
    "dry_lengths",
    { ...known, hair_texture: "curly", thickness: "coarse", heat_styling: null },
    noCoverage,
  )
  assert.ok(curlyCoarse)
  const mask = curlyCoarse.conditional.find((entry) => entry.category === "mask")
  assert.equal(mask?.status, "applies")
  // Both matching gates (coarse, curly) give their reason; the category shows once.
  assert.equal(mask?.reasons.length, 2)
  assert.equal(curlyCoarse.conditional.filter((entry) => entry.category === "mask").length, 1)
  const heat = curlyCoarse.conditional.find((entry) => entry.category === "heat_protectant")
  assert.equal(heat?.status, "check")
  assert.deepEqual(heat?.uncheckedFacts, ["Hitzestyling"])
  // Natural hair: the bondbuilder gate is known false and drops out.
  assert.equal(
    curlyCoarse.conditional.some((entry) => entry.category === "bondbuilder"),
    false,
  )

  const fineStraight = buildDiscoveryConcernRecipeView(
    "dry_lengths",
    { ...known, thickness: "fine" },
    noCoverage,
  )
  assert.deepEqual(fineStraight?.conditional, [])
})

test("a category that applies through one gate is not also listed as „prüfen“", () => {
  const view = buildDiscoveryConcernRecipeView(
    "dry_lengths",
    { ...known, thickness: "coarse", damaged: null },
    noCoverage,
  )
  const masks = view?.conditional.filter((entry) => entry.category === "mask") ?? []
  assert.equal(masks.length, 1)
  assert.equal(masks[0]?.status, "applies")
})

test("the recipe's copy comes through unchanged, with evidence labels", () => {
  const recipe = concernRecipeFor("frizz_flyaways")
  const view = buildDiscoveryConcernRecipeView("frizz_flyaways", known, noCoverage)
  assert.ok(recipe && view)
  assert.equal(view.label, recipe.labelDe)
  assert.equal(view.talkingPoint, recipe.talkingPointDe)
  assert.deepEqual(view.avoid, recipe.avoid)
  assert.equal(view.boundary, recipe.boundary)
  assert.deepEqual(
    view.primaryCategories.map((entry) => [entry.category, entry.evidence]),
    recipe.primary.categories.map((entry) => [entry.category, entry.evidence]),
  )
  assert.deepEqual(
    view.levers.map((entry) => entry.lever),
    recipe.primary.levers.map((entry) => entry.lever),
  )
  // A signal-gated lever names the category it may unlock.
  assert.ok(view.levers.some((entry) => entry.signalCategoryLabel === "Tiefenreinigung"))
})

test("hair loss renders as a boundary only — no product list", () => {
  const view = buildDiscoveryConcernRecipeView(
    "hair_loss_or_thinning",
    UNKNOWN_CONCERN_PROFILE_FACTS,
    noCoverage,
  )
  assert.ok(view)
  assert.equal(view.boundaryOnly, true)
  assert.deepEqual(view.primaryCategories, [])
  assert.deepEqual(view.conditional, [])
  assert.ok(view.boundary)
})
