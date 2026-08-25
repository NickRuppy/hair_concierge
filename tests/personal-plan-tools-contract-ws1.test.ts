import assert from "node:assert/strict"
import test from "node:test"

import { buildPlanProfile } from "@/lib/personal-plan/input"
import { buildToolPlan } from "@/lib/personal-plan/tools/assets"
import {
  choiceGroupKeyFor,
  routeKeyFor,
  toolChoiceGroupSchema,
  toolRouteSchema,
  planToolPlanSchema,
  TOOL_COVERAGE_STATES,
  TOOL_OWNERSHIP_PROVENANCES,
  TOOL_PRODUCT_TYPES_BY_FAMILY,
  type PlanToolRoute,
} from "@/lib/personal-plan/tools/contracts"
import { TOOL_PRODUCT_TYPE_LABELS } from "@/lib/personal-plan/tools/labels"
import {
  computeToolRoutes,
  EMPTY_TOOL_CARE_FACTS,
  toolProfileFactsFromPlanProfile,
} from "@/lib/personal-plan/tools/routes"
import type { ToolCareFacts, ToolInventory } from "@/lib/personal-plan/tools/facts"
import type { PersonalPlanQuizSubmissionEnvelope } from "@/lib/personal-plan-quiz/types"
import { COMPLETE_V3_PLAN_ENVELOPE } from "./personal-plan/fixtures"

type Answers = PersonalPlanQuizSubmissionEnvelope["answers"]

function routes(input: {
  answers?: Partial<Answers>
  care?: Partial<ToolCareFacts>
  inventory?: ToolInventory
}): PlanToolRoute[] {
  return computeToolRoutes({
    profile: toolProfileFactsFromPlanProfile(
      buildPlanProfile(
        {
          ...COMPLETE_V3_PLAN_ENVELOPE,
          answers: { ...COMPLETE_V3_PLAN_ENVELOPE.answers, ...input.answers },
        },
        { artifactId: "artifact-1", projection: "initial_quiz" },
      ),
    ),
    care: { ...EMPTY_TOOL_CARE_FACTS, ...input.care },
    inventory: input.inventory ?? {},
    scalpApplicationJob: false,
  })
}

function find(list: PlanToolRoute[], target: Parameters<typeof routeKeyFor>[0]) {
  return list.find((route) => route.routeKey === routeKeyFor(target)) ?? null
}

// --- D4: ownership and coverage are two independent facts ---------------------

test("D4: a reported answer is ownership; suppression is coverage", () => {
  const list = routes({
    answers: { hairLength: "long", texture: "straight" },
    inventory: { brushes_combs: ["round_brush"] },
  })
  const foundation = find(list, "detangling_foundation")

  // The user reported a round brush. That is what they own — nothing else.
  assert.equal(foundation?.reportedOwnership.state, "owned_generic")
  assert.equal(foundation?.reportedOwnership.provenance, "reported")
  assert.deepEqual(foundation?.reportedOwnership.forms, ["round_brush"])

  // B04 suppresses the purchase without vouching for the capability. That is a
  // coverage statement, never an ownership one.
  assert.equal(foundation?.coverage.state, "covered_by_report")
  assert.equal(foundation?.coverage.capabilityVerified, false)
})

test("D4: a care behaviour is marked derived, never reported", () => {
  const list = routes({
    answers: { texture: "straight", thickness: "fine", goals: ["volume_balance"] },
    care: { dryingRoutes: ["ordinary_blow_dry"] },
  })
  const drying = find(list, "drying_standard")
  // "Du föhnst" is a behaviour. The projected Föhn is derived, not reported.
  assert.equal(drying?.reportedOwnership.state, "owned_generic")
  assert.equal(drying?.reportedOwnership.provenance, "derived")
  assert.equal(drying?.coverage.state, "covered_by_derived")

  const answered = routes({
    answers: { texture: "straight", thickness: "fine", goals: ["volume_balance"] },
    care: { dryingRoutes: ["ordinary_blow_dry"] },
    inventory: { airflow: ["hair_dryer"] },
  })
  const reported = find(answered, "drying_standard")
  assert.equal(reported?.reportedOwnership.provenance, "reported")
  assert.equal(reported?.coverage.state, "covered_by_report")
})

test("D4: unknown ownership carries no provenance and names no form", () => {
  const list = routes({ answers: { hairLength: "long" } })
  const foundation = find(list, "detangling_foundation")
  assert.equal(foundation?.reportedOwnership.state, "unknown")
  assert.equal(foundation?.reportedOwnership.provenance, null)
  assert.deepEqual(foundation?.reportedOwnership.forms, [])
  assert.equal(foundation?.coverage.state, "uncovered")
})

test("D4: a behaviour-only route stops persisting a false explicit_none", () => {
  const list = routes({ care: { towelMaterial: "mikrofaser", towelTechnique: "rough_rubbing" } })
  const guidance = find(list, "gentle_towel_handling")
  assert.equal(guidance?.resolution, "behavior_only")
  assert.equal(
    guidance?.reportedOwnership.state,
    "unknown",
    "there is nothing to own, so nothing was explicitly denied",
  )
  assert.equal(guidance?.coverage.state, "not_applicable")
})

test("D4: ownership and coverage vary independently in the contract", () => {
  const base = {
    routeKey: routeKeyFor("detangling_foundation"),
    family: "brushes_combs" as const,
    target: "detangling_foundation" as const,
    tier: "basis" as const,
    resolution: "tool_type" as const,
    recommendedProductTypes: ["detangling_brush" as const],
    requiredCapabilities: ["detangle" as const],
    purposeKey: "purpose",
    ruleIds: ["tools.brush.foundation"],
    deferredFacts: [],
  }
  // Owns something, still uncovered (a correction reopened the need).
  assert.equal(
    toolRouteSchema.safeParse({
      ...base,
      reportedOwnership: {
        state: "owned_generic",
        provenance: "reported",
        forms: ["paddle_brush"],
      },
      coverage: { state: "uncovered", capabilityVerified: false },
    }).success,
    true,
  )
  // Owns nothing in the family, yet the contract still refuses to pretend.
  assert.equal(
    toolRouteSchema.safeParse({
      ...base,
      reportedOwnership: { state: "explicit_none", provenance: "reported", forms: [] },
      coverage: { state: "uncovered", capabilityVerified: true },
    }).success,
    true,
  )
  assert.equal(
    toolRouteSchema.safeParse({
      ...base,
      reportedOwnership: {
        state: "explicit_none",
        provenance: "reported",
        forms: ["paddle_brush"],
      },
      coverage: { state: "uncovered", capabilityVerified: true },
    }).success,
    false,
    "an explicit none must not name a form the user owns",
  )
  assert.equal(
    toolRouteSchema.safeParse({
      ...base,
      reportedOwnership: { state: "unknown", provenance: "reported", forms: [] },
      coverage: { state: "uncovered", capabilityVerified: true },
    }).success,
    false,
    "unknown ownership has no provenance",
  )
  assert.equal(
    toolRouteSchema.safeParse({
      ...base,
      resolution: "behavior_only",
      recommendedProductTypes: [],
      requiredCapabilities: [],
      reportedOwnership: { state: "explicit_none", provenance: "reported", forms: [] },
      coverage: { state: "not_applicable", capabilityVerified: true },
    }).success,
    false,
    "a behaviour-only route has nothing to own and nothing to deny",
  )
  assert.deepEqual(
    [...TOOL_OWNERSHIP_PROVENANCES],
    ["reported", "derived"],
    "a projected care behaviour is derived, an answer is reported",
  )
  assert.ok((TOOL_COVERAGE_STATES as readonly string[]).includes("covered_by_selection"))
})

test('D4: „Nutze deins" needs the actual form, acquisition suppression needs coverage', () => {
  // The user reported a round brush; the ideal detangling form is a different one.
  const list = routes({
    answers: { hairLength: "long", texture: "straight" },
    inventory: { brushes_combs: ["round_brush"] },
  })
  const plan = buildToolPlan({ routes: list })
  const asset = plan.assets.find((candidate) => candidate.family === "brushes_combs")
  assert.ok(asset)
  assert.notEqual(
    asset.presentationState,
    "use_yours",
    'a form the user never reported must not render as „Nutze deins"',
  )

  const owns = routes({
    answers: { hairLength: "long", texture: "straight" },
    inventory: { brushes_combs: ["detangling_brush"] },
  })
  const ownedPlan = buildToolPlan({ routes: owns })
  assert.equal(
    ownedPlan.assets.find((candidate) => candidate.family === "brushes_combs")?.presentationState,
    "use_yours",
  )
})

test("D4: the conditional reason puts ownership ahead of capability", () => {
  const list = routes({ answers: { hairLength: "long" } })
  const plan = buildToolPlan({ routes: list })
  const foundation = plan.occurrences.find((occurrence) =>
    occurrence.routeKey.endsWith("detangling_foundation"),
  )
  assert.equal(foundation?.conditionalReason, "unknown_ownership")

  const none = buildToolPlan({
    routes: routes({ answers: { hairLength: "long" }, inventory: { brushes_combs: [] } }),
  })
  assert.equal(
    none.occurrences.find((occurrence) => occurrence.routeKey.endsWith("detangling_foundation"))
      ?.conditionalReason,
    "explicit_none",
    "not owning the tool outranks not having verified its capability",
  )
})

// --- D5: choice groups are first class ---------------------------------------

test("D5: one shared need is one group with several members and single fulfilment", () => {
  const list = routes({
    answers: { texture: "straight", thickness: "fine", goals: ["volume_balance"] },
  })
  const plan = buildToolPlan({ routes: list })
  const group = plan.choiceGroups.find((candidate) => candidate.target === "volume_set")
  assert.ok(group, "the shared volume/set choice is one group")
  assert.equal(group.groupKey, choiceGroupKeyFor("volume_set"))
  assert.deepEqual(
    [...group.memberRouteKeys].sort(),
    [routeKeyFor("heated_volume_set"), routeKeyFor("heatless_volume_set")].sort(),
  )
  assert.equal(group.tier, "basis")
  assert.equal(group.fulfilledBy, null, "nothing is covered yet")
})

test("D5 (refined 2026-08-25): reported fulfils, derived-unverified never does", () => {
  // D5 refined 2026-08-25: a REPORTED eligible form fulfils even while its
  // exact capability is unverified — H10's conditional wording carries the
  // uncertainty; fulfilment counts once.
  const reportedUnverified = routes({
    answers: { texture: "straight", thickness: "fine", goals: ["volume_balance"] },
    inventory: { heatless_styling: ["setting_roller"] },
  })
  const covered = find(reportedUnverified, "heatless_volume_set")
  assert.equal(covered?.coverage.state, "covered_by_report")
  assert.equal(covered?.coverage.capabilityVerified, false)
  const fulfilledByReport = buildToolPlan({ routes: reportedUnverified }).choiceGroups.find(
    (candidate) => candidate.target === "volume_set",
  )
  assert.equal(
    fulfilledByReport?.fulfilledBy,
    routeKeyFor("heatless_volume_set"),
    "a reported eligible form fulfils the shared need",
  )

  // Derived, unverified coverage never fulfils: the plain Föhn projected from
  // the drying behaviour is a device the plan cannot vouch for (A04/H10).
  const derivedUnverified = routes({
    answers: { texture: "straight", thickness: "fine", goals: ["volume_balance"] },
    care: { dryingRoutes: ["ordinary_blow_dry"] },
  })
  const derivedMember = find(derivedUnverified, "air_shaping_volume")
  assert.equal(derivedMember?.coverage.state, "covered_by_derived")
  assert.equal(derivedMember?.coverage.capabilityVerified, false)
  const unfulfilled = buildToolPlan({ routes: derivedUnverified }).choiceGroups.find(
    (candidate) => candidate.target === "volume_set",
  )
  assert.equal(unfulfilled?.fulfilledBy, null, "an unvouched derived device never fulfils")
  assert.ok(unfulfilled?.memberRouteKeys.includes(routeKeyFor("heated_volume_set")))

  // A reported form whose own use route recommends exactly that form IS
  // verified, and one such member fulfils the whole group.
  const verified = routes({ inventory: { heated_styling: ["curling_iron"] } })
  const useRoute = find(verified, "heated_volume_set")
  assert.equal(useRoute?.coverage.capabilityVerified, true)
  const fulfilled = buildToolPlan({ routes: verified }).choiceGroups.find(
    (candidate) => candidate.target === "volume_set",
  )
  assert.equal(fulfilled?.fulfilledBy, routeKeyFor("heated_volume_set"))
  assert.ok(fulfilled?.memberRouteKeys.includes(routeKeyFor("heatless_volume_set")))
})

test("D5: the group can express the three-way A04 choice", () => {
  const group = {
    groupKey: choiceGroupKeyFor("volume_set"),
    target: "volume_set" as const,
    tier: "basis" as const,
    memberRouteKeys: [
      routeKeyFor("air_shaping_volume"),
      routeKeyFor("heated_volume_set"),
      routeKeyFor("heatless_volume_set"),
    ],
    fulfilledBy: routeKeyFor("air_shaping_volume"),
  }
  assert.equal(toolChoiceGroupSchema.safeParse(group).success, true)
  assert.equal(
    toolChoiceGroupSchema.safeParse({ ...group, fulfilledBy: routeKeyFor("securing_support") })
      .success,
    false,
    "a group is fulfilled by one of its own members",
  )
})

test("D5: the neutral drying-textile group is expressed as a choice group", () => {
  const list = routes({ care: { towelMaterial: "frottee", towelTechnique: "gentle_press" } })
  const plan = buildToolPlan({ routes: list })
  const group = plan.choiceGroups.find((candidate) => candidate.target === "drying_textile")
  assert.ok(group, "the ad-hoc neutral drying-textile group is now a first-class group")
  assert.deepEqual(group.memberRouteKeys, [routeKeyFor("drying_textile_upgrade")])
})

test("D5: the plan rejects a group whose member route does not exist", () => {
  const list = routes({
    answers: { texture: "straight", thickness: "fine", goals: ["volume_balance"] },
  })
  const plan = buildToolPlan({ routes: list })
  assert.equal(
    planToolPlanSchema.safeParse({
      ...plan,
      choiceGroups: [
        {
          groupKey: choiceGroupKeyFor("volume_set"),
          target: "volume_set",
          tier: "basis",
          memberRouteKeys: [routeKeyFor("securing_support")],
          fulfilledBy: null,
        },
      ],
    }).success,
    false,
  )
})

// --- D6: route form order is binding ------------------------------------------

test("D6: the rendered lead form follows the route order, not the family order", () => {
  // B02: a straight profile leads with the detangling brush. The canonical family
  // order starts with the wide-tooth comb, which is what used to render.
  const list = routes({ answers: { hairLength: "medium", texture: "straight" } })
  const foundation = find(list, "detangling_foundation")
  assert.equal(foundation?.recommendedProductTypes[0], "detangling_brush")

  const plan = buildToolPlan({ routes: list })
  const asset = plan.assets.find((candidate) => candidate.family === "brushes_combs")
  assert.deepEqual(
    asset?.productTypes,
    foundation?.recommendedProductTypes,
    "the projected asset forms preserve the route order exactly",
  )
  assert.equal(asset?.imageKey, "detangling_brush")
})

test("D6: every projected asset form list is a subsequence of its route order", () => {
  const list = routes({
    answers: {
      hairLength: "very_long",
      texture: "coily",
      goals: ["shape_definition", "volume_balance"],
      currentConcerns: ["tangling"],
    },
    care: {
      dryingRoutes: ["diffuser_or_airflow_shaping"],
      towelMaterial: "frottee",
      towelTechnique: "gentle_press",
      nightProtection: null,
    },
  })
  const plan = buildToolPlan({ routes: list })
  const byKey = new Map(plan.routes.map((route) => [route.routeKey, route]))
  for (const asset of plan.assets) {
    for (const routeKey of asset.routeKeys) {
      const route = byKey.get(routeKey)
      if (!route || route.recommendedProductTypes.length === 0) continue
      const order = route.recommendedProductTypes
      const projected = asset.productTypes.filter((form) => order.includes(form))
      let cursor = 0
      for (const form of projected) {
        const next = order.indexOf(form, cursor)
        assert.notEqual(next, -1, `${asset.assetKey} reorders ${routeKey}`)
        cursor = next + 1
      }
    }
  }
})

// --- fixture 114: a deferred fact is representable ----------------------------

test("fixture 114: a missing required input is expressible as a reason fact", () => {
  const parsed = toolRouteSchema.parse({
    routeKey: routeKeyFor("drying_textile_upgrade"),
    family: "drying_textiles",
    target: "drying_textile_upgrade",
    tier: "optional",
    resolution: "tool_type",
    recommendedProductTypes: ["microfiber_towel"],
    requiredCapabilities: ["absorb_water"],
    purposeKey: "purpose",
    ruleIds: ["tools.towel.optional_material"],
    reportedOwnership: { state: "unknown", provenance: null, forms: [] },
    coverage: { state: "uncovered", capabilityVerified: true },
    deferredFacts: ["towel_material"],
  })
  assert.deepEqual(parsed.deferredFacts, ["towel_material"])
  assert.equal(
    toolRouteSchema.safeParse({ ...parsed, deferredFacts: ["shoe_size"] }).success,
    false,
    "only known Tool input facts can be deferred",
  )
})

test("computed routes carry an empty deferred-fact list by default", () => {
  for (const route of routes({ answers: { hairLength: "long" } })) {
    assert.deepEqual(route.deferredFacts, [])
  }
})

// --- R3: boar-bristle brush ---------------------------------------------------

test("R3: the Wildschweinborsten-Bürste is a representable brush form", () => {
  assert.ok(
    (TOOL_PRODUCT_TYPES_BY_FAMILY.brushes_combs as readonly string[]).includes("boar_bristle"),
  )
  assert.equal(TOOL_PRODUCT_TYPE_LABELS.boar_bristle, "Wildschweinborsten-Bürste")
})
