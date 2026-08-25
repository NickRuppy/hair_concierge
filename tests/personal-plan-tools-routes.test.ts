import assert from "node:assert/strict"
import test from "node:test"

import { buildPlanProfile } from "@/lib/personal-plan/input"
import {
  computeToolRoutes,
  EMPTY_TOOL_CARE_FACTS,
  toolProfileFactsFromPlanProfile,
} from "@/lib/personal-plan/tools/routes"
import type { ToolCareFacts, ToolInventory } from "@/lib/personal-plan/tools/facts"
import { routeKeyFor, type PlanToolRoute } from "@/lib/personal-plan/tools/contracts"
import { buildToolPlan } from "@/lib/personal-plan/tools/assets"
import type { PersonalPlanQuizSubmissionEnvelope } from "@/lib/personal-plan-quiz/types"
import { COMPLETE_V3_PLAN_ENVELOPE } from "./personal-plan/fixtures"

type Answers = PersonalPlanQuizSubmissionEnvelope["answers"]

function profile(overrides: Partial<Answers> = {}) {
  return buildPlanProfile(
    {
      ...COMPLETE_V3_PLAN_ENVELOPE,
      answers: { ...COMPLETE_V3_PLAN_ENVELOPE.answers, ...overrides },
    },
    { artifactId: "artifact-1", projection: "initial_quiz" },
  )
}

function routes(input: {
  answers?: Partial<Answers>
  care?: Partial<ToolCareFacts>
  inventory?: ToolInventory
}): PlanToolRoute[] {
  return computeToolRoutes({
    profile: toolProfileFactsFromPlanProfile(profile(input.answers)),
    care: { ...EMPTY_TOOL_CARE_FACTS, ...input.care },
    inventory: input.inventory ?? {},
    scalpApplicationJob: false,
  })
}

function find(list: PlanToolRoute[], target: Parameters<typeof routeKeyFor>[0]) {
  return list.find((route) => route.routeKey === routeKeyFor(target)) ?? null
}

test("Stage 1 computes only routes the initial quiz can actually prove", () => {
  const list = routes({ answers: { hairLength: "medium", currentConcerns: [] } })
  // Drying facts live in Feinschliff; asserting an airflow route here would
  // invent behaviour the user never reported.
  assert.equal(find(list, "drying_standard"), null)
  assert.equal(find(list, "drying_diffused"), null)
  const foundation = find(list, "detangling_foundation")
  assert.equal(foundation?.tier, "basis")
  assert.equal(foundation?.resolution, "tool_type")
  assert.equal(foundation?.reportedOwnership.state, "unknown")
  assert.ok(foundation?.ruleIds.includes("tools.brush.foundation"))
})

test("tools.brush.very_short is covered by fingers until a concrete mismatch appears", () => {
  const covered = routes({ answers: { hairLength: "very_short", currentConcerns: [] } })
  assert.equal(find(covered, "detangling_foundation"), null)

  const mismatch = routes({ answers: { hairLength: "very_short", currentConcerns: ["tangling"] } })
  const foundation = find(mismatch, "detangling_foundation")
  assert.equal(foundation?.tier, "basis")
  assert.ok(foundation?.ruleIds.includes("tools.brush.mismatch"))
})

test("a reported brush covers the foundation without a second recommendation", () => {
  const list = routes({
    answers: { hairLength: "long" },
    inventory: { brushes_combs: ["wide_tooth_comb"] },
  })
  const foundation = find(list, "detangling_foundation")
  assert.equal(foundation?.reportedOwnership.state, "owned_generic")
  assert.ok(foundation?.ruleIds.includes("tools.brush.reported_coverage"))
  assert.equal(
    list.filter((route) => route.family === "brushes_combs" && route.tier === "basis").length,
    1,
    "reported coverage must not create a second basis brush card",
  )
})

test("tangling reopens the detangling correction even when a brush is reported", () => {
  const list = routes({
    answers: { hairLength: "long", currentConcerns: ["tangling"] },
    inventory: { brushes_combs: ["paddle_brush"] },
  })
  const foundation = find(list, "detangling_foundation")
  assert.equal(foundation?.tier, "basis")
  assert.ok(foundation?.ruleIds.includes("tools.brush.mismatch"))
  assert.equal(
    foundation?.reportedOwnership.state,
    "owned_generic",
    "the correction never erases what the user reported",
  )
})

test("explicit none stays explicit and never becomes unknown", () => {
  const list = routes({ answers: { hairLength: "long" }, inventory: { brushes_combs: [] } })
  assert.equal(find(list, "detangling_foundation")?.reportedOwnership.state, "explicit_none")
})

test("blow drying makes one airflow drying path basis, diffuser replaces standard", () => {
  const standard = routes({ care: { dryingRoutes: ["ordinary_blow_dry"] } })
  assert.equal(find(standard, "drying_standard")?.tier, "basis")
  assert.equal(find(standard, "drying_diffused"), null)

  const diffuser = routes({ care: { dryingRoutes: ["diffuser_or_airflow_shaping"] } })
  assert.equal(find(diffuser, "drying_diffused")?.tier, "basis")
  assert.equal(find(diffuser, "drying_standard"), null, "one drying path, not two")
  assert.ok(find(diffuser, "drying_diffused")?.requiredCapabilities.includes("diffuse_airflow"))
})

test("texture alone never triggers the diffuser path", () => {
  const textureOnly = routes({
    answers: { texture: "curly", goals: ["moisture"] },
    care: { dryingRoutes: ["ordinary_blow_dry"] },
  })
  assert.equal(find(textureOnly, "drying_diffused"), null)
  assert.equal(find(textureOnly, "drying_standard")?.tier, "basis")

  const withDefinition = routes({
    answers: { texture: "curly", goals: ["shape_definition"] },
    care: { dryingRoutes: ["ordinary_blow_dry"] },
  })
  assert.equal(find(withDefinition, "drying_diffused")?.tier, "basis")
})

test("air drying with a definition goal keeps airflow optional and never forces a dryer", () => {
  const list = routes({
    answers: { texture: "wavy", goals: ["shape_definition"] },
    care: { dryingRoutes: ["air_dry"] },
  })
  assert.equal(find(list, "drying_diffused")?.tier, "optional")
  assert.equal(find(list, "drying_standard"), null)
})

test("ordinary air drying creates no dryer need", () => {
  const list = routes({ answers: { goals: ["moisture"] }, care: { dryingRoutes: ["air_dry"] } })
  assert.equal(
    list.some((route) => route.family === "airflow"),
    false,
  )
})

test("tools.styling.none: without a volume goal nothing creates a styling route", () => {
  // Frizz, shine, texture, density, damage and breakage must never supply a
  // supporting heated or heatless route on their own.
  const list = routes({
    answers: {
      goals: ["frizz_surface", "shine", "strength_ends"],
      currentConcerns: ["frizz_flyaways", "hair_damage", "breakage"],
      texture: "straight",
      thickness: "fine",
    },
  })
  for (const target of [
    "heated_volume_set",
    "heatless_volume_set",
    "air_shaping_volume",
  ] as const) {
    assert.equal(find(list, target), null, `${target} must not appear without a volume goal`)
  }
})

test("reported heated tools create use guidance, never a purchase need", () => {
  const list = routes({
    answers: { goals: ["moisture"] },
    care: { additionalHeatTools: ["straightener"] },
    inventory: { heated_styling: ["flat_iron"] },
  })
  const heated = find(list, "heated_volume_set")
  assert.equal(heated?.tier, "not_needed")
  assert.equal(heated?.reportedOwnership.state, "owned_generic")
  assert.ok(
    heated?.ruleIds.includes("tools.styling.reported_curl_wave") ||
      heated?.ruleIds.includes("tools.styling.reported_straighten"),
  )
})

test("night protection is optional at most and never basis", () => {
  const strong = routes({
    answers: { hairLength: "long", currentConcerns: ["breakage"] },
    care: { towelTechnique: "rough_rubbing", nightProtection: [] },
  })
  const night = find(strong, "night_protection")
  assert.equal(night?.tier, "optional")
  assert.equal(night?.reportedOwnership.state, "explicit_none")
  assert.ok(night?.ruleIds.includes("tools.night.optional_strong"))

  const none = routes({
    answers: { hairLength: "short", currentConcerns: [], goals: ["moisture"] },
  })
  assert.equal(find(none, "night_protection"), null)
})

test("unknown night-protection ownership stays unknown, not none", () => {
  const list = routes({ answers: { hairLength: "long" }, care: { nightProtection: null } })
  assert.equal(find(list, "night_protection")?.reportedOwnership.state, "unknown")
})

test("rough rubbing is firm behaviour-only guidance, never a mandatory purchase", () => {
  const list = routes({ care: { towelMaterial: "mikrofaser", towelTechnique: "rough_rubbing" } })
  const guidance = find(list, "gentle_towel_handling")
  assert.equal(guidance?.resolution, "behavior_only")
  assert.equal(guidance?.tier, "basis")
  assert.deepEqual(guidance?.recommendedProductTypes, [])
  assert.equal(find(list, "drying_textile_upgrade"), null, "a suitable material needs no upgrade")
})

test("terry towelling offers an optional textile upgrade without a superiority claim", () => {
  const list = routes({ care: { towelMaterial: "frottee", towelTechnique: "gentle_press" } })
  const upgrade = find(list, "drying_textile_upgrade")
  assert.equal(upgrade?.tier, "optional")
  assert.ok(upgrade?.ruleIds.includes("tools.towel.optional_material"))
  assert.deepEqual(
    [...(upgrade?.recommendedProductTypes ?? [])].sort(),
    ["drying_wrap", "microfiber_towel", "smooth_cotton_cloth"],
    "eligible textile forms stay neutral",
  )
})

test("no_towel removes every textile route and invents no rubbing", () => {
  const list = routes({
    answers: { texture: "curly", goals: ["shape_definition"] },
    care: { towelMaterial: "no_towel" },
  })
  assert.equal(
    list.some((route) => route.family === "drying_textiles"),
    false,
  )
})

test("securing aids stay subordinate to a real supporting step", () => {
  const withoutJob = routes({ answers: { hairLength: "long" } })
  assert.equal(find(withoutJob, "securing_support"), null)

  // C01/C02 + D12 (fixtures 74, 102): a night method is NOT a securing parent —
  // its soft tie is owned by Night Protection, and letting it fire here produced
  // the duplicate Clips/Ties card. A real sectioning job still does.
  const nightOnly = routes({
    answers: { hairLength: "long", currentConcerns: ["breakage"] },
    care: { towelTechnique: "rough_rubbing", nightProtection: ["loose_tied"] },
  })
  assert.equal(find(nightOnly, "securing_support"), null)

  const withJob = computeToolRoutes({
    profile: toolProfileFactsFromPlanProfile(profile({ hairLength: "long" })),
    care: EMPTY_TOOL_CARE_FACTS,
    inventory: {},
    scalpApplicationJob: true,
  })
  assert.equal(find(withJob, "securing_support")?.tier, "optional")
})

test("wash aids need a real application job, never density or length alone", () => {
  const list = computeToolRoutes({
    profile: toolProfileFactsFromPlanProfile(profile({ hairLength: "very_long", density: "high" })),
    care: EMPTY_TOOL_CARE_FACTS,
    inventory: {},
    scalpApplicationJob: false,
  })
  assert.equal(find(list, "wash_application_support"), null)

  const supported = computeToolRoutes({
    profile: toolProfileFactsFromPlanProfile(profile({ hairLength: "very_long" })),
    care: EMPTY_TOOL_CARE_FACTS,
    inventory: {},
    scalpApplicationJob: true,
  })
  assert.equal(find(supported, "wash_application_support")?.tier, "optional")
})

test("computed routes always satisfy the strict route contract", () => {
  const list = routes({
    answers: {
      hairLength: "long",
      texture: "curly",
      goals: ["shape_definition"],
      currentConcerns: ["tangling"],
    },
    care: {
      dryingRoutes: ["diffuser_or_airflow_shaping"],
      towelMaterial: "frottee",
      towelTechnique: "rough_rubbing",
      nightProtection: [],
      additionalHeatTools: [],
    },
    inventory: { airflow: ["hair_dryer"], brushes_combs: [] },
  })
  assert.ok(list.length > 0)
  assert.equal(new Set(list.map((route) => route.routeKey)).size, list.length)
})

// --- volume direction ---------------------------------------------------------
//
// The quiz merges "mehr Volumen" and "weniger Volumen" into one `volume_balance`
// goal. Tools reuses the exact texture/thickness split Conditioner already applies
// to that goal, so one profile fact cannot mean two opposite things in two places.

test("fine straight hair with the volume goal reads as wanting more volume", () => {
  const list = routes({
    answers: { texture: "straight", thickness: "fine", goals: ["volume_balance"] },
  })
  const heated = find(list, "heated_volume_set")
  const heatless = find(list, "heatless_volume_set")
  assert.equal(heated?.tier, "basis")
  assert.equal(heatless?.tier, "basis", "both approaches are one shared basis choice")
  // D5: the peer relationship is the first-class `volume_set` choice group, not
  // an ad-hoc route-to-route link that no presentation layer ever read.
  const group = buildToolPlan({ routes: list }).choiceGroups.find(
    (candidate) => candidate.target === "volume_set",
  )
  assert.deepEqual(
    [...(group?.memberRouteKeys ?? [])].sort(),
    [routeKeyFor("heated_volume_set"), routeKeyFor("heatless_volume_set")].sort(),
  )
  assert.equal(group?.fulfilledBy, null)
  assert.ok(heated?.ruleIds.includes("tools.styling.volume_basis"))
  assert.ok(
    heated?.ruleIds.includes("tools.styling.volume_direction_inferred"),
    "the inference is recorded so the reason payload can disclose it",
  )
})

test("curly, coily and coarse hair reads as wanting control, so nothing is recommended", () => {
  for (const answers of [
    { texture: "curly" as const, goals: ["volume_balance" as const] },
    { texture: "coily" as const, goals: ["volume_balance" as const] },
    {
      texture: "straight" as const,
      thickness: "coarse" as const,
      goals: ["volume_balance" as const],
    },
  ]) {
    const list = routes({ answers })
    assert.equal(find(list, "heated_volume_set"), null, JSON.stringify(answers))
    assert.equal(find(list, "heatless_volume_set"), null, JSON.stringify(answers))
  }
})

test("wavy hair that also wants definition reads as control, not more volume", () => {
  const control = routes({
    answers: { texture: "wavy", goals: ["volume_balance", "shape_definition"] },
  })
  assert.equal(find(control, "heated_volume_set"), null)

  const volumeUp = routes({ answers: { texture: "wavy", goals: ["volume_balance"] } })
  assert.equal(find(volumeUp, "heated_volume_set")?.tier, "basis")
})

test("blow drying covers the shared volume basis through air shaping, not extra tools", () => {
  const list = routes({
    answers: { texture: "straight", thickness: "fine", goals: ["volume_balance"] },
    care: { dryingRoutes: ["ordinary_blow_dry"] },
  })
  const airShape = find(list, "air_shaping_volume")
  assert.equal(airShape?.tier, "basis")
  assert.ok(airShape?.ruleIds.includes("tools.airflow.air_shape_basis"))
  // Fulfilment counts once: a covered volume goal adds no heated/heatless need.
  assert.equal(find(list, "heated_volume_set"), null)
  assert.equal(find(list, "heatless_volume_set"), null)
  assert.equal(find(list, "drying_standard")?.tier, "basis", "the drying path stays separate")
})

test("air drying with a volume goal keeps air shaping optional and never forces a dryer", () => {
  const list = routes({
    answers: { texture: "straight", thickness: "fine", goals: ["volume_balance"] },
    care: { dryingRoutes: ["air_dry"] },
  })
  assert.equal(find(list, "air_shaping_volume")?.tier, "optional")
  assert.ok(find(list, "air_shaping_volume")?.ruleIds.includes("tools.airflow.optional_goal"))
  assert.equal(find(list, "drying_standard"), null)
})

test("a reported viable route is prioritized instead of recommending a purchase", () => {
  const list = routes({
    answers: { texture: "straight", thickness: "fine", goals: ["volume_balance"] },
    inventory: { heatless_styling: ["setting_roller"] },
  })
  assert.equal(find(list, "heatless_volume_set")?.reportedOwnership.state, "owned_generic")
  // The peer survives as a referenceable alternative but is no longer a need.
  assert.equal(find(list, "heated_volume_set")?.tier, "not_needed")
  // D5: the peer stays a group member, and the reported route leads the group.
  const group = buildToolPlan({ routes: list }).choiceGroups.find(
    (candidate) => candidate.target === "volume_set",
  )
  assert.ok(group?.memberRouteKeys.includes(routeKeyFor("heated_volume_set")))
  assert.equal(group?.fulfilledBy, routeKeyFor("heatless_volume_set"))
})

test("one device covering drying and air shaping stays one physical asset", () => {
  const list = routes({
    answers: { texture: "straight", thickness: "fine", goals: ["volume_balance"] },
    care: { dryingRoutes: ["ordinary_blow_dry"] },
    inventory: { airflow: ["air_multi_styler"] },
  })
  const drying = find(list, "drying_standard")
  const airShape = find(list, "air_shaping_volume")
  assert.equal(drying?.reportedOwnership.state, "owned_generic")
  assert.equal(airShape?.reportedOwnership.state, "owned_generic")
})

test("a volume goal alone never creates a specialized brush purchase without air shaping", () => {
  const withoutAirflow = routes({
    answers: { texture: "straight", thickness: "fine", goals: ["volume_balance"] },
  })
  assert.equal(find(withoutAirflow, "specialized_brush_job"), null)
})

// --- brush foundation rules B02 / B04 / B05 ----------------------------------

test("B02: the foundational form follows the confirmed texture map", () => {
  const expected: Array<[Partial<Answers>, string]> = [
    [{ texture: "straight" }, "detangling_brush"],
    [{ texture: "curly" }, "wide_tooth_comb"],
    [{ texture: "coily" }, "wide_tooth_comb"],
    [{ texture: "wavy", goals: ["shape_definition"] }, "wide_tooth_comb"],
    [{ texture: "wavy", goals: ["moisture"] }, "detangling_brush"],
  ]
  for (const [answers, lead] of expected) {
    const list = routes({ answers: { hairLength: "medium", ...answers } })
    assert.equal(
      find(list, "detangling_foundation")?.recommendedProductTypes[0],
      lead,
      `${JSON.stringify(answers)} should lead with ${lead}`,
    )
  }
})

test("B04: any reported physical brush suppresses another foundational purchase", () => {
  // A round brush is a styling form, not a detangling form — but owning one still
  // means we do not tell the user to buy another brush.
  const list = routes({
    answers: { hairLength: "long", texture: "straight" },
    inventory: { brushes_combs: ["round_brush"] },
  })
  const foundation = find(list, "detangling_foundation")
  assert.equal(foundation?.reportedOwnership.state, "owned_generic")
  assert.ok(foundation?.ruleIds.includes("tools.brush.reported_coverage"))
})

test("B04: reported coverage never fabricates a verified detangling capability", () => {
  const list = routes({
    answers: { hairLength: "long", texture: "straight" },
    inventory: { brushes_combs: ["round_brush"] },
  })
  const foundation = find(list, "detangling_foundation")
  assert.equal(
    foundation?.coverage.state,
    "covered_by_report",
    "B04 writes coverage — the purchase is suppressed",
  )
  assert.equal(
    foundation?.coverage.capabilityVerified,
    false,
    "a styling form does not prove it detangles gently",
  )

  const real = routes({
    answers: { hairLength: "long", texture: "straight" },
    inventory: { brushes_combs: ["detangling_brush"] },
  })
  assert.equal(find(real, "detangling_foundation")?.coverage.capabilityVerified, true)
})

test("B05: rough towel rubbing is not a brush mismatch signal", () => {
  // The only mechanical-exposure signal we store today is a TOWEL behaviour.
  // Treating it as a friction-heavy brush pattern invented a brush correction.
  const towelOnly = routes({
    answers: { hairLength: "long", texture: "straight", currentConcerns: ["low_shine"] },
    care: { towelMaterial: "mikrofaser", towelTechnique: "rough_rubbing" },
  })
  assert.equal(
    find(towelOnly, "detangling_foundation")?.ruleIds.includes("tools.brush.mismatch"),
    false,
  )

  const tangling = routes({
    answers: { hairLength: "long", texture: "straight", currentConcerns: ["tangling"] },
  })
  assert.ok(find(tangling, "detangling_foundation")?.ruleIds.includes("tools.brush.mismatch"))
})

test("an owned viable route suppresses the peer as a requirement", () => {
  const list = routes({
    answers: { texture: "straight", thickness: "fine", goals: ["volume_balance"] },
    inventory: { heatless_styling: ["setting_roller"] },
  })
  const heatless = find(list, "heatless_volume_set")
  const heated = find(list, "heated_volume_set")

  assert.equal(heatless?.tier, "basis", "the owned route stays the primary approach")
  assert.equal(heatless?.reportedOwnership.state, "owned_generic")
  // The peer must not become a second basis need: owning one covers the job.
  assert.notEqual(heated?.tier, "basis")

  // And it must not produce a second missing-product card either.
  const plan = buildToolPlan({ routes: list })
  assert.equal(
    plan.assets.filter((asset) => asset.family === "heated_styling").length,
    0,
    "no phantom heated Tool card when the heatless route is already covered",
  )
})
