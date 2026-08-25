import assert from "node:assert/strict"
import test from "node:test"

import { buildPlanProfile } from "@/lib/personal-plan/input"
import { buildToolPlan } from "@/lib/personal-plan/tools/assets"
import {
  routeKeyFor,
  type PlanToolPlan,
  type PlanToolRoute,
  type ToolAsset,
  type ToolChoiceGroup,
  type ToolChoiceGroupTarget,
  type ToolOccurrence,
  type ToolProductType,
  type ToolRouteTarget,
} from "@/lib/personal-plan/tools/contracts"
import {
  EMPTY_TOOL_CARE_FACTS,
  inventoryFor,
  mergeToolInventories,
  projectToolCareFacts,
  projectToolInventoryFromCareFacts,
  reportedFormsFor,
  toolHeatProtectionEvents,
  uncoveredToolHeatProtectionEvents,
  type ToolCareFacts,
  type ToolInventory,
} from "@/lib/personal-plan/tools/facts"
import { buildStage1ToolBlocks } from "@/lib/personal-plan/tools/presentation"
import {
  computeToolRoutes,
  toolProfileFactsFromPlanProfile,
} from "@/lib/personal-plan/tools/routes"
import { resolveStage2RefinementContract } from "@/lib/personal-plan/refinement/question-path"
import type { PersonalPlanRefinementAnswersV1 } from "@/lib/personal-plan/refinement/types"
import type { PersonalPlanQuizSubmissionEnvelope } from "@/lib/personal-plan-quiz/types"
import { COMPLETE_V3_PLAN_ENVELOPE } from "./personal-plan/fixtures"

/**
 * The `fixtures.md` oracle, executed.
 *
 * `docs/personal-plan/categories/tools/fixtures.md` (v3) restates every Hair
 * Tools fixture as one row of production field names and values. This file IS
 * that table: one row per fixture, one executor, and a machine-readable skip
 * list naming the workstream each unimplemented row waits on.
 *
 * Discipline (`fixtures.md` §10, the WS2 non-negotiables):
 *
 * - Rule-ID rows assert the **exact set**, never a subset. Fixtures 8, 42, 45
 *   and 46 only fail as exact-set assertions.
 * - Lead-form rows assert the **rendered** `ToolAsset.productTypes[0]`, not
 *   `PlanToolRoute.recommendedProductTypes[0]`. The C1 defect survived a whole
 *   review because the route layer was asserted before the projection reordered
 *   it.
 * - Every live fixture number is either implemented here or skip-listed with its
 *   owning workstream; `SKIPPED` and the coverage test below make that total.
 */

type Answers = PersonalPlanQuizSubmissionEnvelope["answers"]

/**
 * Base profile `P0` from `fixtures.md`: straight, normal thickness, medium
 * length, no goals, no concerns, nothing answered in Feinschliff.
 */
const P0_ANSWERS: Partial<Answers> = {
  texture: "straight",
  thickness: "normal",
  density: "medium",
  hairLength: "medium",
  goals: [],
  currentConcerns: [],
}

type FixtureInput = {
  answers?: Partial<Answers>
  care?: Partial<ToolCareFacts>
  /** The user's own Tool answers, before the care projection is merged in. */
  inventory?: ToolInventory
  scalpApplicationJob?: boolean
}

type FixtureContext = {
  routes: PlanToolRoute[]
  plan: PlanToolPlan
  care: ToolCareFacts
  /** Care projection merged with the Tool answers, exactly as the engine sees it. */
  inventory: ToolInventory
  route: (target: ToolRouteTarget) => PlanToolRoute | null
  /** The exact rule-ID set the route carries. */
  ruleIds: (target: ToolRouteTarget) => string[] | null
  asset: (target: ToolRouteTarget) => ToolAsset | null
  /** The RENDERED lead form — `ToolAsset.productTypes[0]`. */
  lead: (target: ToolRouteTarget) => ToolProductType | null
  group: (target: ToolChoiceGroupTarget) => ToolChoiceGroup | null
  occurrence: (target: ToolRouteTarget) => ToolOccurrence | null
  /** Stage-1 card the asset for this route renders into, if any. */
  card: (target: ToolRouteTarget) => { tier: string; stateLabel: string; typeLabel: string } | null
}

function evaluate(input: FixtureInput): FixtureContext {
  const care: ToolCareFacts = { ...EMPTY_TOOL_CARE_FACTS, ...input.care }
  const profile = buildPlanProfile(
    {
      ...COMPLETE_V3_PLAN_ENVELOPE,
      answers: { ...COMPLETE_V3_PLAN_ENVELOPE.answers, ...P0_ANSWERS, ...input.answers },
    },
    { artifactId: "artifact-1", projection: "initial_quiz" },
  )
  const routes = computeToolRoutes({
    profile: toolProfileFactsFromPlanProfile(profile),
    care,
    inventory: input.inventory ?? {},
    scalpApplicationJob: input.scalpApplicationJob ?? false,
  })
  const plan = buildToolPlan({ routes })
  const inventory = mergeToolInventories(
    projectToolInventoryFromCareFacts(care),
    input.inventory ?? {},
  )
  const route = (target: ToolRouteTarget) =>
    routes.find((candidate) => candidate.routeKey === routeKeyFor(target)) ?? null
  const asset = (target: ToolRouteTarget) =>
    plan.assets.find((candidate) => candidate.routeKeys.includes(routeKeyFor(target))) ?? null
  const blocks = buildStage1ToolBlocks(plan, { hasOptionalPage: true })
  return {
    routes,
    plan,
    care,
    inventory,
    route,
    ruleIds: (target) => route(target)?.ruleIds ?? null,
    asset,
    lead: (target) => asset(target)?.productTypes[0] ?? null,
    group: (target) => plan.choiceGroups.find((candidate) => candidate.target === target) ?? null,
    occurrence: (target) =>
      plan.occurrences.find((candidate) => candidate.routeKey === routeKeyFor(target)) ?? null,
    card: (target) => {
      const found = asset(target)
      if (!found) return null
      const all = [...(blocks.basis?.cards ?? []), ...(blocks.optional?.cards ?? [])]
      const match = all.find((candidate) => candidate.id === found.assetKey)
      return match
        ? { tier: match.tier, stateLabel: match.stateLabel, typeLabel: match.typeLabel }
        : null
    },
  }
}

type FixtureRow = {
  /** The number in `fixtures.md`. Numbers are never reused or renumbered. */
  id: string
  name: string
  input: FixtureInput
  check: (context: FixtureContext) => void
}

function exact(context: FixtureContext, target: ToolRouteTarget, expected: string[]): void {
  assert.deepEqual(
    context.ruleIds(target),
    [...expected].sort(),
    `${target} must carry exactly ${JSON.stringify(expected)}`,
  )
}

function absent(context: FixtureContext, ...targets: ToolRouteTarget[]): void {
  for (const target of targets) {
    assert.equal(context.route(target), null, `${target} must not exist`)
  }
}

// --- 1. Airflow ---------------------------------------------------------------

const AIRFLOW_ROWS: FixtureRow[] = [
  {
    id: "1",
    name: "tools-airflow-blow-dry",
    input: { care: { dryingRoutes: ["ordinary_blow_dry"] } },
    check: (context) => {
      const route = context.route("drying_standard")
      assert.equal(route?.tier, "basis")
      exact(context, "drying_standard", ["tools.airflow.basis"])
      assert.equal(context.lead("drying_standard"), "hair_dryer")
      // D4: projected from the drying behaviour, not from a Tool answer.
      assert.equal(route?.reportedOwnership.state, "owned_generic")
      assert.equal(route?.reportedOwnership.provenance, "derived")
    },
  },
  {
    id: "2",
    name: "tools-airflow-diffuser",
    input: { care: { dryingRoutes: ["diffuser_or_airflow_shaping"] } },
    check: (context) => {
      const route = context.route("drying_diffused")
      assert.equal(route?.tier, "basis")
      exact(context, "drying_diffused", ["tools.airflow.basis", "tools.airflow.diffuser_path"])
      assert.equal(context.lead("drying_diffused"), "hair_dryer")
      assert.equal(route?.reportedOwnership.provenance, "derived")
      // A06 + D2a: the behaviour answer never proves a diffuser-capable device.
      assert.equal(route?.coverage.capabilityVerified, false)
      assert.equal(context.occurrence("drying_diffused")?.executable, false)
    },
  },
  {
    id: "3",
    name: "tools-airflow-air-dry",
    input: { care: { dryingRoutes: ["air_dry"] } },
    check: (context) => {
      assert.equal(
        context.routes.some((route) => route.family === "airflow"),
        false,
      )
      // D4: air-drying is a behaviour, never „ich besitze keinen Föhn".
      assert.equal(context.inventory.airflow, undefined)
    },
  },
  {
    id: "4",
    name: "tools-airflow-air-dry-definition",
    input: {
      answers: { texture: "curly", goals: ["shape_definition"] },
      care: { dryingRoutes: ["air_dry"] },
    },
    check: (context) => {
      const route = context.route("drying_diffused")
      assert.equal(route?.tier, "optional")
      exact(context, "drying_diffused", ["tools.airflow.optional_goal"])
      assert.equal(context.lead("drying_diffused"), "hair_dryer")
      assert.equal(route?.reportedOwnership.state, "unknown")
      assert.equal(route?.reportedOwnership.provenance, null)
      assert.equal(route?.coverage.state, "uncovered")
    },
  },
  {
    id: "4b",
    name: "tools-airflow-air-dry-definition-straight-negative",
    input: {
      answers: { texture: "straight", goals: ["shape_definition"] },
      care: { dryingRoutes: ["air_dry"] },
    },
    check: (context) => {
      // R2: straight + shape_definition activates no tool route from the
      // definition goal — no diffuser path and no Definitionsbürste.
      absent(context, "drying_diffused", "drying_standard", "air_shaping_volume")
      assert.equal(
        context.routes.some((route) => route.ruleIds.includes("tools.brush.definition_optional")),
        false,
      )
    },
  },
  {
    id: "32",
    name: "tools-airflow-goal-diffuser",
    input: {
      answers: { texture: "curly", goals: ["shape_definition"] },
      care: { dryingRoutes: ["ordinary_blow_dry"] },
    },
    check: (context) => {
      assert.equal(context.route("drying_diffused")?.tier, "basis")
      absent(context, "drying_standard")
      exact(context, "drying_diffused", ["tools.airflow.basis", "tools.airflow.diffuser_path"])
      assert.equal(context.route("drying_diffused")?.reportedOwnership.provenance, "derived")
    },
  },
  {
    id: "34",
    name: "tools-airflow-volume-basis",
    input: {
      care: { dryingRoutes: ["ordinary_blow_dry"] },
      answers: { goals: ["volume_balance"] },
    },
    check: (context) => {
      assert.equal(context.route("air_shaping_volume")?.tier, "basis")
      exact(context, "air_shaping_volume", [
        "tools.airflow.air_shape_basis",
        "tools.styling.volume_basis",
        "tools.styling.volume_direction_inferred",
      ])
      assert.equal(context.route("air_shaping_volume")?.reportedOwnership.provenance, "derived")

      // (a) frizz and shine never supply the direction.
      const frizz = evaluate({
        care: { dryingRoutes: ["ordinary_blow_dry"] },
        answers: { goals: ["frizz_surface", "shine"] },
      })
      absent(frizz, "air_shaping_volume")

      // (b) curly resolves to control, so the route never fires.
      const control = evaluate({
        care: { dryingRoutes: ["ordinary_blow_dry"] },
        answers: { texture: "curly", goals: ["volume_balance"] },
      })
      absent(control, "air_shaping_volume")

      // (c) the concern triggers the volume routes on its own.
      const concern = evaluate({
        care: { dryingRoutes: ["ordinary_blow_dry"] },
        answers: { goals: [], currentConcerns: ["low_volume_or_weighed_down"] },
      })
      assert.equal(concern.route("air_shaping_volume")?.tier, "basis")

      // (d) and it OVERRIDES the control inference — and because the direction
      // was then not inferred, the marker must be absent.
      const override = evaluate({
        care: { dryingRoutes: ["ordinary_blow_dry"] },
        answers: {
          texture: "curly",
          goals: [],
          currentConcerns: ["low_volume_or_weighed_down"],
        },
      })
      assert.equal(override.route("air_shaping_volume")?.tier, "basis")
      exact(override, "air_shaping_volume", [
        "tools.airflow.air_shape_basis",
        "tools.styling.volume_basis",
      ])
    },
  },
  {
    id: "36",
    name: "tools-airflow-shape-reported",
    input: {
      care: { dryingRoutes: ["ordinary_blow_dry"] },
      answers: { goals: ["volume_balance"] },
      inventory: { airflow: ["hot_air_brush"] },
    },
    check: (context) => {
      const group = context.group("volume_set")
      assert.equal(group?.tier, "basis")
      assert.equal(group?.fulfilledBy, routeKeyFor("air_shaping_volume"))
      const route = context.route("air_shaping_volume")
      assert.equal(route?.reportedOwnership.state, "owned_generic")
      assert.equal(route?.coverage.state, "covered_by_report")
      // A04/H10: no judgement of the exact unidentified device.
      assert.equal(route?.coverage.capabilityVerified, false)
      assert.equal(context.lead("air_shaping_volume"), "hot_air_brush")
    },
  },
  {
    id: "A-x1",
    name: "tools-airflow-empty-drying-answer",
    input: { care: { dryingRoutes: [] } },
    check: (context) => {
      // D2: legacy stored `[]` is unanswered, never the air-dry branch.
      assert.equal(
        context.routes.some((route) => route.family === "airflow"),
        false,
      )
      assert.equal(context.inventory.airflow, undefined)
    },
  },
  {
    id: "A-x2",
    name: "tools-airflow-mixed-set",
    input: { care: { dryingRoutes: ["air_dry", "ordinary_blow_dry"] } },
    check: (context) => {
      // D2: every ticked route counts; the profile is a blow-drying profile for
      // every rule keyed on a blow-dry member.
      assert.equal(context.route("drying_standard")?.tier, "basis")
      assert.equal(context.route("drying_standard")?.reportedOwnership.state, "owned_generic")
    },
  },
  {
    id: "A-x3",
    name: "tools-airflow-both-blow-dry-members",
    input: { care: { dryingRoutes: ["ordinary_blow_dry", "diffuser_or_airflow_shaping"] } },
    check: (context) => {
      assert.equal(context.route("drying_diffused")?.tier, "basis")
      absent(context, "drying_standard")
    },
  },
]

// --- 2. Heated and heatless styling -------------------------------------------

const STYLING_ROWS: FixtureRow[] = [
  {
    id: "5",
    name: "tools-styling-natural-definition-boundary",
    input: { answers: { texture: "curly", goals: ["shape_definition"] } },
    check: (context) => absent(context, "heated_volume_set", "heatless_volume_set"),
  },
  {
    id: "6",
    name: "tools-styling-volume-choice",
    input: { answers: { goals: ["volume_balance"] } },
    check: (context) => {
      const group = context.group("volume_set")
      assert.equal(group?.tier, "basis")
      assert.deepEqual(
        [...(group?.memberRouteKeys ?? [])].sort(),
        [routeKeyFor("heated_volume_set"), routeKeyFor("heatless_volume_set")].sort(),
      )
      assert.equal(group?.fulfilledBy, null, "no partial fulfilment, no lead")
      for (const target of ["heated_volume_set", "heatless_volume_set"] as const) {
        exact(context, target, [
          "tools.styling.volume_basis",
          "tools.styling.volume_direction_inferred",
        ])
        assert.equal(context.route(target)?.reportedOwnership.state, "unknown")
      }
      // Same trigger/override pair as fixture 34.
      const concern = evaluate({
        answers: { goals: [], currentConcerns: ["low_volume_or_weighed_down"] },
      })
      assert.equal(concern.route("heated_volume_set")?.tier, "basis")
      const override = evaluate({
        answers: { texture: "curly", goals: [], currentConcerns: ["low_volume_or_weighed_down"] },
      })
      exact(override, "heated_volume_set", ["tools.styling.volume_basis"])
    },
  },
  {
    id: "7",
    name: "tools-styling-control-direction-negative",
    input: { answers: { texture: "curly", thickness: "normal", goals: ["volume_balance"] } },
    check: (context) => {
      absent(context, "heated_volume_set", "heatless_volume_set", "air_shaping_volume")
      assert.equal(
        context.routes.some((route) => route.ruleIds.includes("tools.styling.volume_basis")),
        false,
        "a control direction must never push a volume-set tool",
      )
    },
  },
  {
    id: "8",
    name: "tools-styling-reported-without-goal",
    input: { inventory: { heated_styling: ["curling_iron"] } },
    check: (context) => {
      assert.equal(context.route("heated_volume_set")?.tier, "not_needed")
      exact(context, "heated_volume_set", ["tools.styling.reported_curl_wave"])
      assert.equal(context.lead("heated_volume_set"), "curling_iron")
      assert.equal(context.route("heated_volume_set")?.reportedOwnership.state, "owned_generic")
      // H06: the neutral peer approach appears as ONE optional alternative.
      assert.equal(context.route("heatless_volume_set")?.tier, "optional")
      exact(context, "heatless_volume_set", ["tools.styling.reported_curl_wave"])
    },
  },
  {
    id: "42",
    name: "tools-heated-reported-flat-iron",
    input: { care: { additionalHeatTools: ["straightener"] } },
    check: (context) => {
      assert.equal(context.route("heated_volume_set")?.tier, "not_needed")
      exact(context, "heated_volume_set", ["tools.styling.reported_straighten"])
      assert.equal(context.lead("heated_volume_set"), "flat_iron")
      assert.equal(context.card("heated_volume_set"), null, "not_needed renders no Stage-1 card")
      const occurrence = context.occurrence("heated_volume_set")
      assert.deepEqual(occurrence?.anchor, { kind: "styling_session" })
      assert.equal(occurrence?.executable, true)
      // A straightening report reveals no heatless alternative.
      absent(context, "heatless_volume_set")
    },
  },
  {
    id: "43",
    name: "tools-heated-no-straightening-intent",
    input: {
      answers: { goals: ["frizz_surface", "shine"] },
      care: { additionalHeatTools: [] },
    },
    check: (context) => absent(context, "heated_volume_set", "heatless_volume_set"),
  },
  {
    id: "44",
    name: "tools-created-curl-definition-boundary",
    input: {
      answers: { texture: "wavy", goals: ["shape_definition"] },
      inventory: { heated_styling: [], heatless_styling: [] },
    },
    check: (context) => absent(context, "heated_volume_set", "heatless_volume_set"),
  },
  {
    id: "45",
    name: "tools-created-curl-reported-heated",
    input: { care: { additionalHeatTools: ["curling_or_wave_iron"] } },
    check: (context) => {
      assert.equal(context.route("heated_volume_set")?.tier, "not_needed")
      exact(context, "heated_volume_set", ["tools.styling.reported_curl_wave"])
      assert.equal(context.lead("heated_volume_set"), "curling_iron")
      assert.equal(context.route("heatless_volume_set")?.tier, "optional")
    },
  },
  {
    id: "46",
    name: "tools-created-curl-reported-heatless",
    input: { inventory: { heatless_styling: ["setting_roller"] } },
    check: (context) => {
      assert.equal(context.route("heatless_volume_set")?.tier, "not_needed")
      exact(context, "heatless_volume_set", ["tools.styling.reported_curl_wave"])
      assert.equal(context.lead("heatless_volume_set"), "setting_roller")
      assert.equal(context.route("heated_volume_set")?.tier, "optional")
      exact(context, "heated_volume_set", ["tools.styling.reported_curl_wave"])
    },
  },
  {
    id: "48",
    name: "tools-volume-air-dry-approaches",
    input: { care: { dryingRoutes: ["air_dry"] }, answers: { goals: ["volume_balance"] } },
    check: (context) => {
      const group = context.group("volume_set")
      assert.equal(group?.tier, "basis", "the group takes the strongest member tier")
      assert.deepEqual(
        [...(group?.memberRouteKeys ?? [])].sort(),
        [
          routeKeyFor("air_shaping_volume"),
          routeKeyFor("heated_volume_set"),
          routeKeyFor("heatless_volume_set"),
        ].sort(),
      )
      assert.equal(group?.fulfilledBy, null)
      for (const target of ["heated_volume_set", "heatless_volume_set"] as const) {
        assert.equal(context.route(target)?.tier, "basis")
        exact(context, target, [
          "tools.styling.volume_basis",
          "tools.styling.volume_direction_inferred",
        ])
      }
      // Air shaping stays optional because it would add blow-drying, so it does
      // NOT carry `tools.styling.volume_basis`.
      assert.equal(context.route("air_shaping_volume")?.tier, "optional")
      exact(context, "air_shaping_volume", [
        "tools.airflow.optional_goal",
        "tools.styling.volume_direction_inferred",
      ])
    },
  },
  {
    id: "49",
    name: "tools-styling-ambiguous-owned-capability",
    input: {
      inventory: { heated_styling: ["heated_multi_styler"] },
      answers: { goals: ["volume_balance"] },
    },
    check: (context) => {
      const route = context.route("heated_volume_set")
      assert.equal(route?.reportedOwnership.state, "owned_generic")
      assert.deepEqual(route?.reportedOwnership.forms, ["heated_multi_styler"])
      assert.equal(route?.coverage.capabilityVerified, false, "never assume the exact capability")
      // Conditional use-yours, never a duplicate purchase.
      assert.equal(context.lead("heated_volume_set"), "heated_multi_styler")
      assert.equal(context.asset("heated_volume_set")?.presentationState, "use_yours")
      assert.equal(
        context.plan.assets.filter((asset) => asset.family === "heated_styling").length,
        1,
      )
    },
  },
  {
    id: "119",
    name: "tools-onboarding-complex-type",
    input: {
      inventory: { heated_styling: ["heated_brush"] },
      answers: { goals: ["volume_balance"] },
    },
    check: (context) => {
      assert.equal(context.route("heated_volume_set")?.coverage.capabilityVerified, false)
      const occurrence = context.occurrence("heated_volume_set")
      assert.equal(occurrence?.executable, false)
      assert.equal(occurrence?.conditionalReason, "unverified_capability")
    },
  },
]

// --- 3. Brushes and combs -----------------------------------------------------

const BRUSH_ROWS: FixtureRow[] = [
  {
    id: "9",
    name: "tools-brush-foundation",
    input: {
      answers: { hairLength: "medium" },
      inventory: { brushes_combs: ["paddle_brush", "round_brush"] },
    },
    check: (context) => {
      const route = context.route("detangling_foundation")
      assert.equal(route?.tier, "basis")
      exact(context, "detangling_foundation", [
        "tools.brush.foundation",
        "tools.brush.reported_coverage",
      ])
      // D4: B04 sets coverage only; ownership names THEIR forms.
      assert.equal(route?.coverage.state, "covered_by_report")
      assert.equal(route?.reportedOwnership.state, "owned_generic")
      assert.deepEqual(route?.reportedOwnership.forms, ["paddle_brush", "round_brush"])
      // B04 grants no unverified `detangle`.
      assert.equal(route?.coverage.capabilityVerified, false)
      // The reported eligible form leads; `round_brush` acts through coverage only.
      assert.equal(context.lead("detangling_foundation"), "paddle_brush")
      assert.equal(
        context.plan.assets.filter((asset) => asset.family === "brushes_combs").length,
        1,
        "exactly one route and one asset, never two basis cards",
      )
    },
  },
  {
    id: "10",
    name: "tools-brush-very-short-fingers",
    input: { answers: { hairLength: "very_short" }, inventory: { brushes_combs: ["fingers"] } },
    check: (context) => {
      absent(context, "detangling_foundation")
      assert.deepEqual(inventoryFor(context.inventory, "brushes_combs"), ["fingers"])
      // `fingers` is an answer token, never a `ToolProductType`.
      assert.deepEqual(reportedFormsFor(context.inventory, "brushes_combs"), [])
      // The length-only variant behaves the same.
      const lengthOnly = evaluate({ answers: { hairLength: "very_short" } })
      absent(lengthOnly, "detangling_foundation")
    },
  },
  {
    id: "11",
    name: "tools-brush-very-short-job",
    input: { answers: { hairLength: "very_short", currentConcerns: ["tangling"] } },
    check: (context) => {
      assert.equal(context.route("detangling_foundation")?.tier, "basis")
      exact(context, "detangling_foundation", ["tools.brush.foundation", "tools.brush.mismatch"])
      assert.equal(context.lead("detangling_foundation"), "detangling_brush")
      assert.equal(context.route("detangling_foundation")?.reportedOwnership.state, "unknown")

      // (b) fingers do not silently cover a concrete mismatch.
      const fingers = evaluate({
        answers: { hairLength: "very_short", currentConcerns: ["tangling"] },
        inventory: { brushes_combs: ["fingers"] },
      })
      const route = fingers.route("detangling_foundation")
      assert.equal(route?.tier, "basis")
      assert.equal(route?.reportedOwnership.state, "explicit_none")
      assert.deepEqual(route?.reportedOwnership.forms, [])
      assert.equal(route?.coverage.state, "uncovered")
      assert.equal(fingers.lead("detangling_foundation"), "detangling_brush")
    },
  },
  {
    id: "56",
    name: "tools-brush-short-fingers-only",
    input: { answers: { hairLength: "short" }, inventory: { brushes_combs: ["fingers"] } },
    check: (context) => {
      const route = context.route("detangling_foundation")
      assert.equal(route?.tier, "basis")
      exact(context, "detangling_foundation", ["tools.brush.foundation"])
      // From `short` upward a finger-only answer does not close the need.
      assert.equal(route?.coverage.state, "uncovered")
      assert.deepEqual(route?.reportedOwnership.forms, [])
      assert.equal(context.lead("detangling_foundation"), "detangling_brush")
    },
  },
  {
    id: "57",
    name: "tools-brush-straight-default",
    input: { answers: { hairLength: "short" }, inventory: { brushes_combs: [] } },
    check: (context) => {
      assert.equal(context.route("detangling_foundation")?.tier, "basis")
      exact(context, "detangling_foundation", ["tools.brush.foundation"])
      // D6: the RENDERED lead, not the route array. `assetFormsFor` used to
      // re-sort through the canonical family order and produce a Kamm.
      assert.equal(context.lead("detangling_foundation"), "detangling_brush")
      assert.equal(context.route("detangling_foundation")?.reportedOwnership.state, "explicit_none")
    },
  },
  {
    id: "58",
    name: "tools-brush-curly-coily-default",
    input: {
      answers: { texture: "curly", hairLength: "short" },
      inventory: { brushes_combs: [] },
    },
    check: (context) => {
      assert.equal(context.lead("detangling_foundation"), "wide_tooth_comb")
      assert.equal(context.route("detangling_foundation")?.reportedOwnership.state, "explicit_none")
    },
  },
  {
    id: "59",
    name: "tools-brush-wavy-map",
    input: {
      answers: { texture: "wavy", goals: ["shape_definition"] },
      inventory: { brushes_combs: [] },
    },
    check: (context) => {
      assert.equal(context.lead("detangling_foundation"), "wide_tooth_comb")
      // (b) wavy without a definition goal leads with the brush. Never both.
      const plain = evaluate({
        answers: { texture: "wavy", goals: [] },
        inventory: { brushes_combs: [] },
      })
      assert.equal(plain.lead("detangling_foundation"), "detangling_brush")
    },
  },
  {
    id: "60",
    name: "tools-brush-any-reported-physical",
    input: { inventory: { brushes_combs: ["round_brush"] } },
    check: (context) => {
      // (a) a styling form covers the purchase but never leads the card.
      exact(context, "detangling_foundation", [
        "tools.brush.foundation",
        "tools.brush.reported_coverage",
      ])
      assert.equal(context.lead("detangling_foundation"), "detangling_brush")
      assert.equal(context.route("detangling_foundation")?.coverage.state, "covered_by_report")
      assert.equal(context.route("detangling_foundation")?.coverage.capabilityVerified, false)

      // (b) the tail form leads but still grants no verified `detangle`.
      const paddle = evaluate({ inventory: { brushes_combs: ["paddle_brush"] } })
      assert.equal(paddle.lead("detangling_foundation"), "paddle_brush")
      assert.equal(paddle.route("detangling_foundation")?.coverage.capabilityVerified, false)

      // (c) R3: `boar_bristle` is a shipped form again.
      const boar = evaluate({ inventory: { brushes_combs: ["boar_bristle"] } })
      assert.equal(boar.route("detangling_foundation")?.coverage.state, "covered_by_report")
      assert.equal(boar.lead("detangling_foundation"), "detangling_brush")
      assert.equal(boar.route("detangling_foundation")?.coverage.capabilityVerified, false)
    },
  },
  {
    id: "61",
    name: "tools-brush-reported-mismatch",
    input: {
      inventory: { brushes_combs: ["styling_brush"] },
      answers: { currentConcerns: ["tangling"] },
    },
    check: (context) => {
      const route = context.route("detangling_foundation")
      assert.equal(route?.tier, "basis")
      exact(context, "detangling_foundation", [
        "tools.brush.foundation",
        "tools.brush.mismatch",
        "tools.brush.reported_coverage",
      ])
      // B05: the correction wins over broad reported coverage.
      assert.equal(route?.coverage.state, "uncovered")
      assert.equal(route?.reportedOwnership.state, "owned_generic")
      assert.deepEqual(route?.reportedOwnership.forms, ["styling_brush"])
      assert.equal(context.lead("detangling_foundation"), "detangling_brush")
      // „Nutze deins" is gated on owning the ACTUAL form.
      assert.notEqual(context.asset("detangling_foundation")?.presentationState, "use_yours")
    },
  },
  {
    id: "62",
    name: "tools-brush-unknown-ownership",
    input: {},
    check: (context) => {
      assert.equal(context.route("detangling_foundation")?.reportedOwnership.state, "unknown")
      assert.equal(context.lead("detangling_foundation"), "detangling_brush")
      assert.equal(context.asset("detangling_foundation")?.presentationState, "check_in_refinement")
    },
  },
  {
    id: "63",
    name: "tools-brush-explicit-none",
    input: { answers: { hairLength: "long" }, inventory: { brushes_combs: [] } },
    check: (context) => {
      assert.equal(context.route("detangling_foundation")?.tier, "basis")
      assert.equal(context.lead("detangling_foundation"), "detangling_brush")
      assert.equal(context.route("detangling_foundation")?.reportedOwnership.state, "explicit_none")
    },
  },
]

// --- 4. Clips, ties and securing ----------------------------------------------

const SECURING_ROWS: FixtureRow[] = [
  {
    id: "12",
    name: "tools-accessory-subordinate",
    input: { inventory: { heatless_styling: ["setting_roller"] } },
    check: (context) => {
      assert.equal(context.route("securing_support")?.tier, "optional")
      exact(context, "securing_support", ["tools.securing.optional"])
      assert.equal(context.lead("securing_support"), "sectioning_clip")
      assert.equal(context.route("securing_support")?.reportedOwnership.state, "unknown")
      // The co-emitted `not_needed` set route produces no Stage-1 card.
      assert.equal(context.card("heatless_volume_set"), null)
    },
  },
  {
    id: "71",
    name: "tools-securing-no-parent",
    input: { answers: { hairLength: "very_long" } },
    check: (context) => absent(context, "securing_support"),
  },
  {
    id: "74",
    name: "tools-securing-night-owner",
    input: { answers: { hairLength: "long" }, care: { nightProtection: ["loose_tied"] } },
    check: (context) => {
      assert.equal(context.route("night_protection")?.tier, "optional")
      exact(context, "night_protection", ["tools.night.optional_other"])
      assert.equal(context.lead("night_protection"), "soft_night_tie")
      const ownership = context.route("night_protection")?.reportedOwnership
      assert.equal(ownership?.state, "owned_generic")
      // D4: `loose_tied` is a technique. It is never a REPORTED tie.
      assert.equal(ownership?.provenance, "derived")
      // C02/D12: the soft tie is owned by Night Protection — no duplicate card.
      absent(context, "securing_support")
    },
  },
  {
    id: "75",
    name: "tools-securing-many-parents",
    input: { care: { nightProtection: ["pineapple"] }, scalpApplicationJob: true },
    check: (context) => {
      assert.equal(
        context.routes.filter((route) => route.family === "securing_sectioning").length,
        1,
        "all active reasons merge into one optional result",
      )
      assert.equal(context.route("securing_support")?.tier, "optional")
      exact(context, "securing_support", ["tools.securing.optional"])
      // C02 rendered-order row: the canonical family order would lead with the
      // soft tie; the route order is binding (D6).
      assert.equal(context.lead("securing_support"), "sectioning_clip")
      assert.equal(context.route("securing_support")?.reportedOwnership.state, "unknown")
    },
  },
  {
    id: "76",
    name: "tools-securing-reported-compatible",
    input: { scalpApplicationJob: true, inventory: { securing_sectioning: ["claw_clip"] } },
    check: (context) => {
      assert.equal(context.route("securing_support")?.tier, "optional")
      assert.equal(context.lead("securing_support"), "claw_clip")
      assert.equal(context.route("securing_support")?.reportedOwnership.state, "owned_generic")
    },
  },
]

// --- 5. Wash and application aids ---------------------------------------------

const WASH_ROWS: FixtureRow[] = [
  {
    id: "13",
    name: "tools-wash-aid-no-job",
    input: { answers: { hairLength: "very_long" }, scalpApplicationJob: false },
    check: (context) => absent(context, "wash_application_support"),
  },
  {
    id: "14",
    name: "tools-wash-aid-supported",
    input: { scalpApplicationJob: true },
    check: (context) => {
      assert.equal(context.route("wash_application_support")?.tier, "optional")
      exact(context, "wash_application_support", ["tools.wash_application.optional"])
      // W02's lead is binding (D6): the canonical order would lead with the
      // scalp brush, which W02 makes use-yours-only.
      assert.equal(context.lead("wash_application_support"), "applicator_bottle")
      assert.equal(context.route("wash_application_support")?.reportedOwnership.state, "unknown")
    },
  },
  {
    id: "80",
    name: "tools-wash-no-parent",
    input: { scalpApplicationJob: false },
    check: (context) => absent(context, "wash_application_support"),
  },
  {
    id: "81",
    name: "tools-wash-targeted-application",
    input: { scalpApplicationJob: true, inventory: { wash_application: [] } },
    check: (context) => {
      assert.equal(context.lead("wash_application_support"), "applicator_bottle")
      assert.equal(
        context.route("wash_application_support")?.reportedOwnership.state,
        "explicit_none",
      )
    },
  },
  {
    id: "82",
    name: "tools-wash-reported-applicator-comb",
    input: { scalpApplicationJob: true, inventory: { wash_application: ["applicator_comb"] } },
    check: (context) => {
      assert.equal(context.lead("wash_application_support"), "applicator_comb")
      assert.equal(
        context.route("wash_application_support")?.reportedOwnership.state,
        "owned_generic",
      )
    },
  },
  {
    id: "86",
    name: "tools-wash-scalp-signal-no-brush",
    input: { scalpApplicationJob: false },
    check: (context) => absent(context, "wash_application_support"),
  },
  {
    id: "87",
    name: "tools-wash-shower-detangler-dedup",
    input: { answers: { hairLength: "long", currentConcerns: ["tangling"] } },
    check: (context) => absent(context, "wash_application_support"),
  },
]

// --- 6. Night Protection ------------------------------------------------------

const NIGHT_ROWS: FixtureRow[] = [
  {
    id: "15",
    name: "tools-night-strong-optional",
    input: {
      answers: { currentConcerns: ["breakage"] },
      care: {
        towelMaterial: "mikrofaser",
        towelTechnique: "rough_rubbing",
        nightProtection: [],
      },
    },
    check: (context) => {
      assert.equal(context.route("night_protection")?.tier, "optional")
      exact(context, "night_protection", ["tools.night.optional_strong"])
      assert.equal(context.lead("night_protection"), "pillowcase")
      assert.equal(context.route("night_protection")?.reportedOwnership.state, "explicit_none")

      // R4: the V2 token `split_ends` reaches the strong tier too.
      const v2 = evaluate({
        answers: { currentConcerns: ["split_ends"] },
        care: {
          towelMaterial: "mikrofaser",
          towelTechnique: "rough_rubbing",
          nightProtection: [],
        },
      })
      exact(v2, "night_protection", ["tools.night.optional_strong"])
    },
  },
  {
    id: "16",
    name: "tools-night-long-only",
    input: { answers: { hairLength: "long" } },
    check: (context) => {
      assert.equal(context.route("night_protection")?.tier, "optional")
      exact(context, "night_protection", ["tools.night.optional_other"])
      assert.equal(context.lead("night_protection"), "pillowcase")
      assert.equal(context.route("night_protection")?.reportedOwnership.state, "unknown")
    },
  },
  {
    id: "18",
    name: "tools-night-null",
    input: { answers: { hairLength: "long" }, care: { nightProtection: null } },
    check: (context) => {
      assert.equal(context.route("night_protection")?.tier, "optional")
      assert.equal(context.lead("night_protection"), "pillowcase")
      assert.equal(context.route("night_protection")?.reportedOwnership.state, "unknown")
    },
  },
  {
    id: "19",
    name: "tools-night-reported",
    input: { answers: { hairLength: "long" }, care: { nightProtection: ["silk_satin_bonnet"] } },
    check: (context) => {
      assert.equal(context.route("night_protection")?.tier, "optional")
      assert.equal(context.lead("night_protection"), "bonnet")
      assert.equal(context.route("night_protection")?.reportedOwnership.state, "owned_generic")
    },
  },
  {
    id: "91",
    name: "tools-night-broad-health-goal",
    input: { answers: { goals: ["strength_ends"] } },
    check: (context) => {
      assert.equal(context.route("night_protection")?.tier, "optional")
      exact(context, "night_protection", ["tools.night.optional_other"])
      assert.equal(context.lead("night_protection"), "pillowcase")
    },
  },
  {
    id: "93",
    name: "tools-night-no-signal-unreported",
    input: {},
    check: (context) => absent(context, "night_protection"),
  },
  {
    id: "95",
    name: "tools-night-default-sleeve",
    input: {
      answers: { hairLength: "very_long", currentConcerns: ["split_ends"] },
      care: { nightProtection: [] },
    },
    check: (context) => {
      assert.equal(context.route("night_protection")?.tier, "optional")
      exact(context, "night_protection", ["tools.night.optional_other"])
      // N02's reason-based map, asserted on the RENDERED lead.
      assert.equal(context.lead("night_protection"), "length_tip_sleeve")
      assert.equal(context.route("night_protection")?.reportedOwnership.state, "explicit_none")
    },
  },
  {
    id: "96",
    name: "tools-night-default-bonnet",
    input: {
      answers: { texture: "curly", goals: ["shape_definition"] },
      care: { nightProtection: [] },
    },
    check: (context) => {
      assert.equal(context.route("night_protection")?.tier, "optional")
      assert.equal(context.lead("night_protection"), "bonnet")
      assert.equal(context.route("night_protection")?.reportedOwnership.state, "explicit_none")
    },
  },
  {
    id: "97",
    name: "tools-night-default-pillow",
    input: { answers: { goals: ["frizz_surface"] }, care: { nightProtection: [] } },
    check: (context) => {
      assert.equal(context.lead("night_protection"), "pillowcase")
      assert.equal(context.route("night_protection")?.reportedOwnership.state, "explicit_none")
    },
  },
  {
    id: "99",
    name: "tools-night-null-ownership",
    input: { answers: { hairLength: "long" }, care: { nightProtection: null } },
    check: (context) => {
      assert.equal(context.route("night_protection")?.reportedOwnership.state, "unknown")
      assert.equal(context.lead("night_protection"), "pillowcase")
    },
  },
  {
    id: "100",
    name: "tools-night-explicit-none",
    input: { answers: { hairLength: "long" }, care: { nightProtection: [] } },
    check: (context) => {
      assert.equal(context.route("night_protection")?.reportedOwnership.state, "explicit_none")
      assert.equal(context.lead("night_protection"), "pillowcase")
    },
  },
  {
    id: "102",
    name: "tools-night-soft-tie-dedup",
    input: { answers: { hairLength: "long" }, care: { nightProtection: ["loose_tied"] } },
    check: (context) => {
      exact(context, "night_protection", ["tools.night.optional_other"])
      assert.equal(context.lead("night_protection"), "soft_night_tie")
      const ownership = context.route("night_protection")?.reportedOwnership
      assert.equal(ownership?.state, "owned_generic")
      assert.equal(ownership?.provenance, "derived")
      assert.equal(
        context.plan.assets.filter(
          (asset) => asset.family === "night_protection" || asset.family === "securing_sectioning",
        ).length,
        1,
        "one card only, owned by night_protection",
      )
    },
  },
  {
    id: "126",
    name: "tools-night-manageability-trigger",
    input: { answers: { goals: ["manageability_styling"] }, care: { nightProtection: null } },
    check: (context) => {
      assert.equal(context.route("night_protection")?.tier, "optional")
      exact(context, "night_protection", ["tools.night.optional_other"])
      assert.equal(context.lead("night_protection"), "pillowcase")
      assert.equal(context.route("night_protection")?.reportedOwnership.state, "unknown")
    },
  },
]

// --- 7. Drying textiles -------------------------------------------------------

const TEXTILE_ROWS: FixtureRow[] = [
  {
    id: "20",
    name: "tools-towel-rub",
    input: { care: { towelMaterial: "mikrofaser", towelTechnique: "rough_rubbing" } },
    check: (context) => {
      const route = context.route("gentle_towel_handling")
      assert.equal(route?.tier, "basis")
      assert.equal(route?.resolution, "behavior_only")
      exact(context, "gentle_towel_handling", ["tools.towel.technique"])
      assert.equal(context.asset("gentle_towel_handling"), null, "guidance, never an asset")
      assert.equal(context.occurrence("gentle_towel_handling"), null)
      assert.equal(
        context.plan.guidance.find(
          (entry) => entry.routeKey === routeKeyFor("gentle_towel_handling"),
        )?.strength,
        "firm",
      )
    },
  },
  {
    id: "21",
    name: "tools-towel-terry",
    input: { care: { towelMaterial: "frottee", towelTechnique: "gentle_press" } },
    check: (context) => {
      const route = context.route("drying_textile_upgrade")
      assert.equal(route?.tier, "optional")
      exact(context, "drying_textile_upgrade", ["tools.towel.optional_material"])
      assert.deepEqual(route?.recommendedProductTypes, [
        "microfiber_towel",
        "smooth_cotton_cloth",
        "drying_wrap",
      ])
      // D4: the reported terry towel is a towel-material answer. It is NEVER
      // re-encoded as „owns no drying textile".
      assert.equal(route?.reportedOwnership.state, "unknown")
      assert.equal(route?.reportedOwnership.provenance, null)
      assert.equal(context.inventory.drying_textiles, undefined)
      assert.equal(route?.coverage.state, "uncovered")
    },
  },
  {
    id: "104",
    name: "tools-textile-frottee-choice",
    input: { care: { towelMaterial: "frottee", towelTechnique: "gentle_press" } },
    check: (context) => {
      assert.equal(context.route("drying_textile_upgrade")?.tier, "optional")
      assert.equal(context.route("drying_textile_upgrade")?.reportedOwnership.state, "unknown")
      assert.equal(context.route("drying_textile_upgrade")?.reportedOwnership.provenance, null)
    },
  },
  {
    id: "105",
    name: "tools-textile-rubbing-any-material",
    input: { care: { towelMaterial: "tshirt", towelTechnique: "rough_rubbing" } },
    check: (context) => {
      assert.equal(context.route("gentle_towel_handling")?.tier, "basis")
      absent(context, "drying_textile_upgrade")
    },
  },
  {
    id: "107",
    name: "tools-textile-no-towel",
    input: { care: { towelMaterial: "no_towel" } },
    check: (context) => {
      assert.equal(
        context.routes.some((route) => route.family === "drying_textiles"),
        false,
      )
    },
  },
  {
    id: "113",
    name: "tools-textile-neutral-options",
    input: {
      answers: { texture: "curly", goals: ["shape_definition"] },
      care: { towelMaterial: "frottee", towelTechnique: "gentle_press" },
    },
    check: (context) => {
      // No profile input reorders the three forms.
      assert.deepEqual(context.route("drying_textile_upgrade")?.recommendedProductTypes, [
        "microfiber_towel",
        "smooth_cotton_cloth",
        "drying_wrap",
      ])
      assert.equal(context.route("drying_textile_upgrade")?.reportedOwnership.provenance, null)
    },
  },
]

// --- 8. Ownership capture, presentation and lifecycle -------------------------

const LIFECYCLE_ROWS: FixtureRow[] = [
  {
    id: "22",
    name: "tools-multicapability-once",
    input: {
      care: { dryingRoutes: ["ordinary_blow_dry"] },
      inventory: { airflow: ["air_multi_styler"] },
      answers: { goals: ["volume_balance"] },
    },
    check: (context) => {
      const airflowAssets = context.plan.assets.filter((asset) => asset.family === "airflow")
      assert.equal(airflowAssets.length, 1, "one physical Tool, one asset identity")
      assert.deepEqual(airflowAssets[0].productTypes, ["air_multi_styler"])
      assert.deepEqual(
        [...airflowAssets[0].routeKeys].sort(),
        [routeKeyFor("air_shaping_volume"), routeKeyFor("drying_standard")].sort(),
      )
    },
  },
  {
    id: "25",
    name: "tools-route-unknown",
    input: {},
    check: (context) => {
      assert.equal(context.route("detangling_foundation")?.reportedOwnership.state, "unknown")
      assert.equal(context.asset("detangling_foundation")?.presentationState, "check_in_refinement")
    },
  },
  {
    id: "30",
    name: "tools-recompute",
    input: {},
    check: (context) => {
      const before = context.route("detangling_foundation")
      const after = evaluate({ inventory: { brushes_combs: ["paddle_brush"] } }).route(
        "detangling_foundation",
      )
      assert.equal(before?.tier, after?.tier, "ownership never creates or removes need")
      assert.equal(before?.reportedOwnership.state, "unknown")
      assert.equal(after?.reportedOwnership.state, "owned_generic")
    },
  },
  {
    id: "31",
    name: "tools-salience-many",
    input: {
      answers: { hairLength: "long", currentConcerns: ["tangling"] },
      care: {
        dryingRoutes: ["ordinary_blow_dry"],
        towelMaterial: "frottee",
        towelTechnique: "gentle_press",
      },
    },
    check: (context) => {
      assert.equal(context.card("drying_standard")?.tier, "basis")
      assert.equal(context.card("detangling_foundation")?.tier, "basis")
      assert.equal(context.card("night_protection")?.tier, "optional")
      assert.equal(context.card("drying_textile_upgrade")?.tier, "optional")
    },
  },
  {
    id: "38",
    name: "tools-airflow-one-device-two-uses",
    input: {
      inventory: { airflow: ["air_multi_styler"] },
      care: { dryingRoutes: ["ordinary_blow_dry"] },
      answers: { goals: ["volume_balance"] },
    },
    check: (context) => {
      const airflowAssets = context.plan.assets.filter((asset) => asset.family === "airflow")
      assert.equal(airflowAssets.length, 1)
      assert.equal(
        context.plan.occurrences.filter(
          (occurrence) => occurrence.assetKey === airflowAssets[0].assetKey,
        ).length,
        2,
        "one asset fills both linked occurrences",
      )
      assert.equal(context.route("drying_standard")?.reportedOwnership.state, "owned_generic")
    },
  },
  {
    id: "117",
    name: "tools-onboarding-unanswered",
    input: {},
    check: (context) => {
      for (const route of context.routes) {
        if (route.resolution === "behavior_only") continue
        assert.equal(
          route.reportedOwnership.state,
          "unknown",
          `${route.target} must stay unknown when nothing was answered`,
        )
      }
    },
  },
  {
    id: "120",
    name: "tools-owned-visible",
    input: { care: { dryingRoutes: ["ordinary_blow_dry"] } },
    check: (context) => {
      const card = context.card("drying_standard")
      assert.equal(card?.tier, "basis", "the card stays in the normal plan order")
      assert.equal(card?.stateLabel, "Nutze deins")
      assert.equal(context.occurrence("drying_standard")?.executable, true)
    },
  },
  {
    id: "124",
    name: "tools-onboarding-merge-per-form",
    input: {
      care: { additionalHeatTools: ["straightener"] },
      inventory: { heated_styling: ["curling_iron"] },
    },
    check: (context) => {
      const ownership = context.route("heated_volume_set")?.reportedOwnership
      // D3c: merge per form, never replace per family. The care-derived
      // straightener evidence survives the Tool page answer.
      assert.deepEqual([...(ownership?.forms ?? [])].sort(), ["curling_iron", "flat_iron"])
      assert.equal(ownership?.state, "owned_generic")
      // D4: provenance records the STRONGER source.
      assert.equal(ownership?.provenance, "reported")
    },
  },
]

const IMPLEMENTED_ROWS: FixtureRow[] = [
  ...AIRFLOW_ROWS,
  ...STYLING_ROWS,
  ...BRUSH_ROWS,
  ...SECURING_ROWS,
  ...WASH_ROWS,
  ...NIGHT_ROWS,
  ...TEXTILE_ROWS,
  ...LIFECYCLE_ROWS,
]

for (const row of IMPLEMENTED_ROWS) {
  test(`fixture ${row.id} — ${row.name}`, () => {
    row.check(evaluate(row.input))
  })
}

// --- heat-protection coverage (`D9a` + `R1`) ----------------------------------
//
// These rows read `heatEvents[…].protectionConsistency`, not a route input, so
// they run through the care-fact projection rather than the route executor.

function careFrom(answers: PersonalPlanRefinementAnswersV1): ToolCareFacts {
  return projectToolCareFacts(answers)
}

test("fixture 40 — tools-airflow-heat-protection-tiers", () => {
  const events = toolHeatProtectionEvents(
    careFrom({
      dryingRoutes: ["ordinary_blow_dry", "diffuser_or_airflow_shaping"],
      additionalHeatTools: ["dryer_brush", "straightener"],
      heatEvents: {
        "heat:ordinary_blow_dry": { frequency: "weekly_2x" },
        "heat:diffuser_airflow_shaping": { frequency: "weekly_2x" },
        "heat:dryer_brush": { frequency: "weekly_1x", protectionConsistency: "always" },
        "heat:straightener": { frequency: "weekly_1x", protectionConsistency: "no" },
      },
    }),
  )
  const bySource = new Map(events.map((event) => [event.source, event]))
  // A11 + D2a: ordinary and diffuser drying are both `not_needed`.
  assert.equal(bySource.get("ordinary_blow_dry")?.tier, "not_needed")
  assert.equal(bySource.get("diffuser_airflow_shaping")?.tier, "not_needed")
  assert.equal(bySource.get("dryer_brush")?.tier, "optional")
  assert.equal(bySource.get("straightener")?.tier, "basis")
  // Coverage is read from the event's own answer; only `always` counts.
  assert.equal(bySource.get("dryer_brush")?.covered, true)
  assert.equal(bySource.get("straightener")?.covered, false)
  // R1: no rule reads `protectionConsistency` for the diffuser or ordinary source.
  assert.equal(bySource.get("diffuser_airflow_shaping")?.protectionConsistency, null)
  assert.equal(bySource.get("ordinary_blow_dry")?.protectionConsistency, null)
  // The portfolio result is the union of the UNCOVERED events: a user may be
  // covered for the Warmluftbürste and uncovered for the Glätteisen.
  assert.deepEqual(
    uncoveredToolHeatProtectionEvents(
      careFrom({
        dryingRoutes: ["ordinary_blow_dry", "diffuser_or_airflow_shaping"],
        additionalHeatTools: ["dryer_brush", "straightener"],
        heatEvents: {
          "heat:ordinary_blow_dry": { frequency: "weekly_2x" },
          "heat:diffuser_airflow_shaping": { frequency: "weekly_2x" },
          "heat:dryer_brush": { frequency: "weekly_1x", protectionConsistency: "always" },
          "heat:straightener": { frequency: "weekly_1x", protectionConsistency: "no" },
        },
      }),
    ).map((event) => event.source),
    ["straightener"],
  )
})

test("fixture 50 — tools-direct-heat-protection-covered", () => {
  const [event] = toolHeatProtectionEvents(
    careFrom({
      additionalHeatTools: ["straightener"],
      heatEvents: {
        "heat:straightener": { frequency: "weekly_1x", protectionConsistency: "always" },
      },
    }),
  )
  assert.equal(event.tier, "basis")
  assert.equal(event.covered, true, "the dependency is satisfied for that event")
  assert.equal(event.consistencyNudge, false)
})

test("fixture 51 — tools-direct-heat-protection-missing", () => {
  const evaluateConsistency = (protectionConsistency: "no" | "unsure" | "sometimes") =>
    toolHeatProtectionEvents(
      careFrom({
        additionalHeatTools: ["straightener"],
        heatEvents: { "heat:straightener": { frequency: "weekly_1x", protectionConsistency } },
      }),
    )[0]

  for (const value of ["no", "unsure"] as const) {
    const event = evaluateConsistency(value)
    assert.equal(event.tier, "basis")
    assert.equal(event.covered, false)
    assert.equal(event.consistencyNudge, false, `${value} is not a nudge, it is the recommendation`)
  }
  const sometimes = evaluateConsistency("sometimes")
  assert.equal(sometimes.covered, false, "`sometimes` is not coverage")
  assert.equal(sometimes.consistencyNudge, true)
})

test("fixture 125 — tools-heat-protection-legacy-diffuser-value-ignored", () => {
  const answers: PersonalPlanRefinementAnswersV1 = {
    dryingRoutes: ["diffuser_or_airflow_shaping"],
    heatEvents: {
      "heat:diffuser_airflow_shaping": { frequency: "weekly_2x", protectionConsistency: "no" },
    },
  }
  // 1. The row completed under the old contract still loads COMPLETE — its
  //    completion is validated against its completion-time contract (D8).
  const contract = resolveStage2RefinementContract({
    triggerContext: {
      relevantCategories: [],
      hasReportedIrritatedScalp: false,
      dryShampooBridgeEligibility: "ineligible",
    },
    answers,
    completedQuestionIds: ["heat:diffuser_airflow_shaping"],
  })
  assert.ok(
    contract.completedQuestionIds.includes("heat:diffuser_airflow_shaping"),
    "a row completed under the old contract stays complete",
  )
  assert.deepEqual(
    contract.validationErrors.filter((error) => error.startsWith("heat:")),
    [],
  )
  // 2. The stored value is ignored on read.
  const care = careFrom(answers)
  assert.equal(care.heatEvents?.[0].protectionConsistency, null)
  // 3. Nothing derives from it: the tier is `not_needed` and no dependency,
  //    nudge or uncovered state appears.
  const [event] = toolHeatProtectionEvents(care)
  assert.equal(event.tier, "not_needed")
  assert.equal(event.covered, true)
  assert.equal(event.consistencyNudge, false)
  assert.equal(event.protectionConsistency, null)
})

// --- coverage of the oracle ---------------------------------------------------

/**
 * Machine-readable skip list: fixture number → the workstream that owns it.
 *
 * Nothing from `fixtures.md` may be dropped silently. Every live row is either
 * executed above or listed here with a reason.
 */
export const SKIPPED: Record<string, string> = {
  // Retired by `D9a` — production never defaults `protectionConsistency`.
  "122": "RETIRED (D9a)",
  "123": "RETIRED (D9a)",

  // Phase 2 catalog — needs verified exact-product facts.
  "23": "Phase 2 catalog",
  "24": "Phase 2 catalog",
  "26": "Phase 2 catalog",
  "27": "Phase 2 catalog",
  "29": "Phase 2 catalog",
  "33": "Phase 2 catalog",
  "39": "Phase 2 catalog",
  "41": "Phase 2 catalog",
  "52": "Phase 2 catalog",
  "53": "Phase 2 catalog",
  "70": "Phase 2 catalog",
  "77": "Phase 2 catalog",
  "89": "Phase 2 catalog",
  "90": "Phase 2 catalog",
  "101": "Phase 2 catalog",
  "115": "Phase 2 catalog",
  "118": "Phase 2 catalog",
  "121": "Phase 2 catalog",

  // No production input exists for the trigger.
  "28": "no production input (no pain/tightness field)",
  "69": "no production input (no selected parting step)",
  "72": "no production input (no selected parting step)",
  "73": "no production input (no root-volume parent)",
  "83": "no production input (no between-wash refresh step)",
  "84": "no production input (no refresh parent)",
  "88": "no production input",
  "92": "no production input (no independent brush-friction signal)",

  // WS3 — the route target does not exist yet.
  "17": "WS3 (night continue-yours occurrence)",
  "55": "WS3 (tools.brush.manual_air_shape route)",
  "65": "WS3 (round-brush volume route)",
  "66": "WS3 (Definitionsbürste route)",
  "67": "WS3 (Pick route)",
  "68": "WS3 (reported dry-style route)",
  "85": "WS3 (reported scalp-brush use-yours route)",
  "94": "WS3 (night continue-yours occurrence)",
  "106": "WS3 (reported-suitable textile use-yours route)",
  "108": "WS3 (tools.textile.plop route)",
  "109": "WS3 (re-assert after the plop route lands)",
  "110": "WS3 (tools.textile.plop route)",
  "111": "WS3 (tools.textile.plop route)",
  "112": "WS3 (tools.textile.plop route)",

  // WS6 — day-anchor graph, placement and session keys.
  "37": "WS6 (linked occurrences on the shared day graph, one cadence)",
  "54": "WS6 (Anwendung projection per ApplicationDayTypeKey)",
  "64": "WS6 (B12 detangle timing anchors)",
  "78": "WS6 (C04 tension line in the Anwendung step)",
  "103": "WS6 (N06 loosen/remove clause in the guidance copy)",

  // WS4 — Feinschliff capture, copy and the „Nur Finger" card.
  "116": "WS4 (overview submit semantics, preselection wiring, ratified lead copy)",

  // C05 deferred to Stage 2 by decision.
  "79": "NOT APPLICABLE (C05 deferred)",

  // Flagged to the orchestrator rather than implemented — see the WS2 handback.
  "35":
    "FLAGGED — requires all three volume_set members to be emitted at once; today " +
    "the air-shaping basis suppresses the heated/heatless peers. Emitting them " +
    "without a group-aware Stage-1 card projection would render three basis " +
    "cards for one need (WS4 owns that projection).",
  "47": "FLAGGED — same as 35: three group members with a blow-dry + volume profile.",
  "98":
    "FLAGGED — N03's 'at most one functionally different alternative' needs a " +
    "non-reported form to survive the reported-form filter in assetFormsFor; the " +
    "rule for which alternative survives is not stated in the spec.",
  "114":
    "FLAGGED — deferredFacts wiring. Emitting a route for `towelMaterial=null` " +
    "adds a Stage-1 card for every pre-Feinschliff user, which needs the WS4 " +
    "mockup gate.",
}

const RETIRED = new Set(["122", "123"])

test("every live fixture row is executed or skip-listed with its owner", () => {
  const implemented = new Set(IMPLEMENTED_ROWS.map((row) => row.id))
  // 40, 50, 51 and 125 run through the heat-protection executor above.
  for (const id of ["40", "50", "51", "125"]) implemented.add(id)

  const all = [
    ...Array.from({ length: 126 }, (_, index) => String(index + 1)),
    "4b",
    "A-x1",
    "A-x2",
    "A-x3",
  ]
  const missing: string[] = []
  const doubled: string[] = []
  for (const id of all) {
    const isImplemented = implemented.has(id)
    const isSkipped = id in SKIPPED
    if (!isImplemented && !isSkipped) missing.push(id)
    if (isImplemented && isSkipped && !RETIRED.has(id)) doubled.push(id)
  }
  assert.deepEqual(missing, [], "these fixture rows are neither executed nor skip-listed")
  assert.deepEqual(doubled, [], "these fixture rows are both executed and skip-listed")

  assert.equal(
    all.length - RETIRED.size,
    128,
    "fixtures.md v3 records 128 live rows; the executor must enumerate the same set",
  )
})
