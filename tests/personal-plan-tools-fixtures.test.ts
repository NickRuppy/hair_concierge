import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import { buildPlanProfile } from "@/lib/personal-plan/input"
import { projectToolsForDay } from "@/lib/personal-plan/tools/application"
import { buildToolPlan } from "@/lib/personal-plan/tools/assets"
import {
  assetKeyFor,
  atDayAnchor,
  choiceGroupKeyFor,
  dayAnchorIndex,
  placementForAnchor,
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
import type { ToolUseSectionView } from "@/lib/personal-plan/tools/application"
import { TOOL_CHOICE_GROUP_LABELS } from "@/lib/personal-plan/tools/labels"
import type { ApplicationDayTypeKey } from "@/lib/routines/personal-plan/application/contracts"
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
import {
  createStage2RefinementSession,
  saveStage2SessionAnswer,
} from "@/lib/personal-plan/refinement/session"
import {
  defaultToolFormsFromCare,
  defaultToolSectionsFromCare,
  TOOL_OVERVIEW_LEAD,
} from "@/lib/personal-plan/tools/stage2"
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
  /**
   * The RENDERED Anwendung section for this route on the given day — the copy
   * the user actually reads, not the occurrence row behind it.
   */
  section: (target: ToolRouteTarget, dayType: ApplicationDayTypeKey) => ToolUseSectionView | null
  /** Stage-1 card the asset (or its choice group) for this route renders into. */
  card: (
    target: ToolRouteTarget,
  ) => { tier: string; stateLabel: string; typeLabel: string; noteDe: string | null } | null
  /** The rendered Stage-1 card ids, per tier block. */
  cardIds: (tier: "basis" | "optional") => string[]
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
    section: (target, dayType) => {
      const found = plan.occurrences.find((candidate) => candidate.routeKey === routeKeyFor(target))
      if (!found) return null
      return (
        projectToolsForDay({
          dayType,
          assets: plan.assets,
          occurrences: plan.occurrences,
          guidance: plan.guidance,
        }).sections.find((candidate) => candidate.stepKey === found.occurrenceKey) ?? null
      )
    },
    card: (target) => {
      const found = asset(target)
      // D5: a route inside a choice group renders through the group's single
      // card, so the lookup accepts either identity.
      const owningGroup = plan.choiceGroups.find((candidate) =>
        candidate.memberRouteKeys.includes(routeKeyFor(target)),
      )
      if (!found && !owningGroup) return null
      const all = [...(blocks.basis?.cards ?? []), ...(blocks.optional?.cards ?? [])]
      const match = all.find(
        (candidate) =>
          (found !== null && candidate.id === found.assetKey) ||
          (owningGroup !== undefined && candidate.id === owningGroup.groupKey),
      )
      return match
        ? {
            tier: match.tier,
            stateLabel: match.stateLabel,
            typeLabel: match.typeLabel,
            noteDe: match.noteDe,
          }
        : null
    },
    cardIds: (tier) => (blocks[tier]?.cards ?? []).map((candidate) => candidate.id),
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
      // D5: the air-shaping approach is one member of the shared volume choice —
      // it never deletes its heated and heatless peers.
      const group = context.group("volume_set")
      assert.equal(group?.tier, "basis")
      assert.deepEqual(group?.memberRouteKeys, [
        routeKeyFor("air_shaping_volume"),
        routeKeyFor("heated_volume_set"),
        routeKeyFor("heatless_volume_set"),
      ])
      for (const target of ["heated_volume_set", "heatless_volume_set"] as const) {
        assert.equal(context.route(target)?.tier, "basis")
        exact(context, target, [
          "tools.styling.volume_basis",
          "tools.styling.volume_direction_inferred",
        ])
      }

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
    id: "35",
    name: "tools-airflow-shape-unreported-choice",
    input: {
      care: { dryingRoutes: ["ordinary_blow_dry"] },
      answers: { goals: ["volume_balance"] },
      inventory: { airflow: [] },
    },
    check: (context) => {
      const group = context.group("volume_set")
      assert.equal(group?.tier, "basis")
      // All three eligible approaches are members — the air-shaping basis no
      // longer deletes its peers.
      assert.deepEqual(group?.memberRouteKeys, [
        routeKeyFor("air_shaping_volume"),
        routeKeyFor("heated_volume_set"),
        routeKeyFor("heatless_volume_set"),
      ])
      // Nothing is covered, so the group renders with no ownership claim at all.
      assert.equal(group?.fulfilledBy, null, "no partial fulfilment, no lead")
      exact(context, "air_shaping_volume", [
        "tools.airflow.air_shape_basis",
        "tools.styling.volume_basis",
        "tools.styling.volume_direction_inferred",
      ])
      for (const target of ["heated_volume_set", "heatless_volume_set"] as const) {
        exact(context, target, [
          "tools.styling.volume_basis",
          "tools.styling.volume_direction_inferred",
        ])
      }
      exact(context, "drying_standard", ["tools.airflow.basis"])
      assert.equal(context.route("air_shaping_volume")?.reportedOwnership.state, "explicit_none")
      // One need, one card: three member routes must not render three basis cards.
      assert.deepEqual(context.cardIds("basis"), [
        assetKeyFor("airflow", "hair_dryer"),
        choiceGroupKeyFor("volume_set"),
        assetKeyFor("brushes_combs", "detangling_brush"),
      ])
      assert.equal(
        context.card("air_shaping_volume")?.typeLabel,
        TOOL_CHOICE_GROUP_LABELS.volume_set,
      )
      assert.equal(
        context.card("heated_volume_set")?.typeLabel,
        TOOL_CHOICE_GROUP_LABELS.volume_set,
      )
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
      assert.deepEqual(group?.memberRouteKeys, [
        routeKeyFor("air_shaping_volume"),
        routeKeyFor("heated_volume_set"),
        routeKeyFor("heatless_volume_set"),
      ])
      // A reported form changes lead and coverage, never the rule-ID set.
      exact(context, "air_shaping_volume", [
        "tools.airflow.air_shape_basis",
        "tools.styling.volume_basis",
        "tools.styling.volume_direction_inferred",
      ])
      for (const target of ["heated_volume_set", "heatless_volume_set"] as const) {
        exact(context, target, [
          "tools.styling.volume_basis",
          "tools.styling.volume_direction_inferred",
        ])
      }
      // D5 as refined 2026-08-25: a REPORTED eligible form fulfils the group
      // even while its exact capability is unverified — fulfilment counts once
      // and H10's conditional use-yours wording carries the uncertainty. Row 36
      // is satisfiable exactly as written.
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
      // REPRESENTABILITY NOTE — the row's other half, „air-dry guidance", is
      // NOT asserted here because it has no representation to assert.
      // `docs/personal-plan/categories/tools/fixtures.md` §1, fixture 3
      // („tools-airflow-air-dry"), states it: "`tools.airflow.none` has no route
      // representation; absence is the result." So air-drying produces no route,
      // asset, occurrence or guidance entry, and the only executable half of
      // A-x2 is the blow-dry member above. If a rule ever emits air-dry
      // guidance, assert it here.
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
      const route = context.route("heated_volume_set")
      assert.equal(route?.tier, "not_needed")
      exact(context, "heated_volume_set", ["tools.styling.reported_straighten"])
      assert.equal(context.lead("heated_volume_set"), "flat_iron")
      // D4 (clarified 2026-08-25): `additionalHeatTools` NAMES a concrete tool,
      // so the answer is `reported` wherever it was asked — only behaviour
      // projections are `derived`.
      assert.equal(route?.reportedOwnership.state, "owned_generic")
      assert.equal(route?.reportedOwnership.provenance, "reported")
      assert.equal(route?.coverage.state, "covered_by_report")
      assert.equal(context.card("heated_volume_set"), null, "not_needed renders no Stage-1 card")
      const occurrence = context.occurrence("heated_volume_set")
      assert.deepEqual(occurrence?.anchor, atDayAnchor("heat_tool"))
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
      const route = context.route("heated_volume_set")
      assert.equal(route?.tier, "not_needed")
      exact(context, "heated_volume_set", ["tools.styling.reported_curl_wave"])
      assert.equal(context.lead("heated_volume_set"), "curling_iron")
      // D4: a named care answer is `reported`.
      assert.equal(route?.reportedOwnership.provenance, "reported")
      assert.equal(route?.coverage.state, "covered_by_report")
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
      // Re-check finding 2: the group is fulfilled by the reported roller whose
      // own reported-use route renders no card — H06's ONE optional alternative
      // (the heated peer) must still be visible, not silently deleted.
      const heatedPeerCard = context
        .cardIds("optional")
        .concat(context.cardIds("basis"))
        .find((id) => id.includes("heated_styling"))
      assert.ok(heatedPeerCard, "the H06 heated alternative still renders a card")
    },
  },
  {
    id: "47",
    name: "tools-volume-blow-dry-approaches",
    input: {
      care: { dryingRoutes: ["ordinary_blow_dry"] },
      answers: { goals: ["volume_balance"] },
    },
    check: (context) => {
      const group = context.group("volume_set")
      assert.equal(group?.tier, "basis")
      // Air shaping, heated setting and heatless setting are compared inside ONE
      // group; only one must ever be fulfilled.
      assert.deepEqual(group?.memberRouteKeys, [
        routeKeyFor("air_shaping_volume"),
        routeKeyFor("heated_volume_set"),
        routeKeyFor("heatless_volume_set"),
      ])
      // The derived Föhn covers the air-shaping member but the plan cannot vouch
      // for it (`A04`/`H10`), so `D5` (amended 2026-08-25) leaves the group
      // unfulfilled: neutral render, no ownership claim.
      assert.equal(context.route("air_shaping_volume")?.coverage.state, "covered_by_derived")
      assert.equal(context.route("air_shaping_volume")?.coverage.capabilityVerified, false)
      assert.equal(group?.fulfilledBy, null)
      exact(context, "air_shaping_volume", [
        "tools.airflow.air_shape_basis",
        "tools.styling.volume_basis",
        "tools.styling.volume_direction_inferred",
      ])
      for (const target of ["heated_volume_set", "heatless_volume_set"] as const) {
        assert.equal(context.route(target)?.tier, "basis")
        exact(context, target, [
          "tools.styling.volume_basis",
          "tools.styling.volume_direction_inferred",
        ])
      }
      exact(context, "drying_standard", ["tools.airflow.basis"])
      // One card per need: the drying path plus one neutral group card.
      assert.deepEqual(context.cardIds("basis"), [
        assetKeyFor("airflow", "hair_dryer"),
        choiceGroupKeyFor("volume_set"),
        assetKeyFor("brushes_combs", "detangling_brush"),
      ])
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
      // Re-check finding 1: the rendered group card carries the GROUP tier —
      // two basis members make it a basis card even though the (first-listed)
      // air-shaping member is only optional.
      assert.ok(
        context.cardIds("basis").includes(choiceGroupKeyFor("volume_set")),
        "the volume group card renders in the basis block",
      )
      assert.ok(!context.cardIds("optional").includes(choiceGroupKeyFor("volume_set")))
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
      // Tier clarified 2026-08-25: `basis` + `covered_by_report` — the need
      // stands, the purchase push does not.
      assert.equal(route?.tier, "basis")
      assert.equal(route?.coverage.state, "covered_by_report")
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
    id: "54",
    name: "tools-styling-optional-every-wash",
    input: { inventory: { heated_styling: ["flat_iron"] } },
    check: (context) => {
      const occurrence = context.occurrence("heated_volume_set")
      assert.ok(occurrence)
      // D7: a heated Tool session belongs to the heat position of the shared
      // graph, which is what makes heat protection precede it by construction.
      assert.equal(occurrence.anchor.position, "heat_tool")
      for (const dayType of [
        "wash_day",
        "intensive_care_day",
        "bond_repair_day",
        "clarifying_wash_day",
        "styling_day",
      ] as const) {
        assert.ok(
          context.section("heated_volume_set", dayType),
          `${dayType} carries the styling session`,
        )
      }
      for (const dayType of ["refresh_day", "between_wash_care_day", "rest_day"] as const) {
        assert.equal(
          context.section("heated_volume_set", dayType),
          null,
          `${dayType} has no styling session`,
        )
      }
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
    id: "64",
    name: "tools-brush-routine-placement",
    input: { answers: { texture: "curly" } },
    check: (context) => {
      // B12 (a): curly and coily detangle in the conditioned wet/damp phase.
      assert.equal(
        context.occurrence("detangling_foundation")?.anchor.position,
        "post_cleanse_rinse_off",
      )
      assert.equal(
        evaluate({ answers: { texture: "coily" } }).occurrence("detangling_foundation")?.anchor
          .position,
        "post_cleanse_rinse_off",
      )
      // Definition-led wavy follows the same branch (B02/B12 share one
      // population); every other wavy profile does not.
      assert.equal(
        evaluate({ answers: { texture: "wavy", goals: ["shape_definition"] } }).occurrence(
          "detangling_foundation",
        )?.anchor.position,
        "post_cleanse_rinse_off",
      )
      assert.equal(
        evaluate({ answers: { texture: "wavy" } }).occurrence("detangling_foundation")?.anchor
          .position,
        "post_rinse_towel_dry",
      )
      // B12 (b): straight detangles after partial drying.
      assert.equal(
        evaluate({ answers: { texture: "straight" } }).occurrence("detangling_foundation")?.anchor
          .position,
        "post_rinse_towel_dry",
      )
      // B12 (c): very short plus fingers creates no separate brush step at all.
      const veryShort = evaluate({
        answers: { hairLength: "very_short" },
        inventory: { brushes_combs: ["fingers"] },
      })
      assert.equal(veryShort.route("detangling_foundation"), null)
      assert.equal(veryShort.occurrence("detangling_foundation"), null)
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
  {
    id: "55",
    name: "tools-airflow-manual-round-brush",
    input: {
      care: { dryingRoutes: ["ordinary_blow_dry"] },
      answers: { goals: ["volume_balance"] },
      inventory: { brushes_combs: ["round_brush"] },
    },
    check: (context) => {
      const route = context.route("manual_air_shaping")
      assert.equal(route?.tier, "not_needed")
      exact(context, "manual_air_shaping", ["tools.brush.manual_air_shape"])
      // The Rundbürste finally leads a route of its own: `air_shaping_volume`
      // lives in `airflow`, so it never could.
      assert.equal(context.lead("manual_air_shaping"), "round_brush")
      assert.equal(route?.coverage.state, "covered_by_report")
      assert.equal(context.asset("manual_air_shaping")?.presentationState, "use_yours")
      // „prioritize the manual approach … do not add another volume tool
      // requirement": the reported brush is the missing half of `B08`'s
      // Föhn-plus-Rundbürste approach, so the shared volume need is fulfilled.
      assert.equal(context.route("air_shaping_volume")?.coverage.capabilityVerified, true)
      assert.equal(context.group("volume_set")?.fulfilledBy, routeKeyFor("air_shaping_volume"))
      // No second shaping brush beside the one they already reported.
      absent(context, "specialized_brush_job")
      assert.equal(context.card("manual_air_shaping"), null, "use-yours never adds a card")
    },
  },
  {
    id: "65",
    name: "tools-brush-round-volume",
    input: {
      care: { dryingRoutes: ["ordinary_blow_dry"] },
      answers: { goals: ["volume_balance"] },
      inventory: { brushes_combs: ["round_brush"] },
    },
    check: (context) => {
      // „link to the shared pre-dry/air-shape session": one parent session key,
      // never a second inferred weekly schedule.
      const session = context.occurrence("air_shaping_volume")?.sessionKey
      assert.ok(session)
      assert.equal(context.occurrence("drying_standard")?.sessionKey, session)
      assert.equal(context.occurrence("manual_air_shaping")?.sessionKey, session)
      // Order inside the session comes from the graph, not from a sequence field.
      assert.equal(context.occurrence("manual_air_shaping")?.anchor.position, "heat_tool")
      // „reuse the dryer": one airflow asset serves drying and shaping.
      assert.equal(
        context.plan.assets.filter((asset) => asset.family === "airflow").length,
        1,
        "the reported dryer is reused, never duplicated",
      )
    },
  },
  {
    id: "66",
    name: "tools-brush-definition-optional",
    input: { answers: { texture: "curly", goals: ["shape_definition"] } },
    check: (context) => {
      assert.equal(context.route("definition_brush_job")?.tier, "optional")
      exact(context, "definition_brush_job", ["tools.brush.definition_optional"])
      assert.equal(context.lead("definition_brush_job"), "styling_brush")
      assert.equal(context.card("definition_brush_job")?.tier, "optional")
      // R2: `straight` plus `shape_definition` activates nothing (fixture 4b).
      absent(evaluate({ answers: { goals: ["shape_definition"] } }), "definition_brush_job")
      // Texture alone never activates it either.
      absent(evaluate({ answers: { texture: "curly" } }), "definition_brush_job")
    },
  },
  {
    id: "67",
    name: "tools-brush-pick-optional",
    // The oracle's Input cell still carries the pre-`D1` premise, and its own
    // note says to update it once this route lands: `coily` resolves to CONTROL,
    // so `volume_balance` alone can no longer reach a volume route. The live
    // trigger is the concern that OVERRIDES the inference.
    input: { answers: { texture: "coily", currentConcerns: ["low_volume_or_weighed_down"] } },
    check: (context) => {
      assert.equal(context.route("pick_job")?.tier, "optional")
      exact(context, "pick_job", ["tools.brush.pick_optional"])
      assert.equal(context.lead("pick_job"), "hair_pick")
      // One collapsed optional approach, never another required volume product.
      assert.equal(context.card("pick_job")?.tier, "optional")
      // `D1`: the merged goal alone resolves to control and reaches nothing.
      absent(evaluate({ answers: { texture: "coily", goals: ["volume_balance"] } }), "pick_job")
      // The Pick is a curly/coily form; the same concern on straight hair is not it.
      absent(evaluate({ answers: { currentConcerns: ["low_volume_or_weighed_down"] } }), "pick_job")
    },
  },
  {
    id: "68",
    name: "tools-brush-reported-dry-style",
    input: { inventory: { brushes_combs: ["vent_brush"] } },
    check: (context) => {
      const route = context.route("dry_styling_brush")
      assert.equal(route?.tier, "not_needed")
      exact(context, "dry_styling_brush", ["tools.brush.reported_dry_style"])
      assert.equal(context.lead("dry_styling_brush"), "vent_brush")
      assert.equal(route?.coverage.state, "covered_by_report")
      assert.equal(context.asset("dry_styling_brush")?.presentationState, "use_yours")
      // Use-yours/reference guidance only: no new purchase and no card.
      assert.equal(context.card("dry_styling_brush"), null)
      assert.equal(context.occurrence("dry_styling_brush")?.anchor.position, "styling_session")
      // One physical brush, one row: a reported form that already LEADS the
      // detangling foundation keeps its single card there (fixtures 9, 60b).
      absent(evaluate({ inventory: { brushes_combs: ["paddle_brush"] } }), "dry_styling_brush")
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
    id: "78",
    name: "tools-securing-tension-fallback",
    input: { scalpApplicationJob: true },
    check: (context) => {
      const section = context.section("securing_support", "wash_day")
      assert.ok(section, "the securing step renders on the wash day")
      // C04: the low-tension fallback is part of the step the user reads, not a
      // separate note somewhere else.
      assert.ok(
        section.actionsDe.some((action) => action.includes("Nur so fest wie nötig")),
        `the C04 tension line is missing from ${JSON.stringify(section.actionsDe)}`,
      )
      assert.ok(
        section.actionsDe.some((action) => /zieht oder wehtut/.test(action)),
        "the loosen/remove clause is missing",
      )
    },
  },
  {
    id: "71",
    name: "tools-securing-no-parent",
    input: { answers: { hairLength: "very_long" } },
    check: (context) => absent(context, "securing_support"),
  },
  {
    id: "73",
    name: "tools-securing-root-volume-parent",
    // `C01`'s fourth parent, restated 2026-08-25 against `D1`. P0 is
    // straight/normal, so the ratified predicate resolves the merged
    // `volume_balance` goal to volume_up and the parent is active.
    input: { answers: { goals: ["volume_balance"] } },
    check: (context) => {
      assert.equal(context.route("securing_support")?.tier, "optional")
      exact(context, "securing_support", ["tools.securing.optional"])
      // `C02` resolves the root-volume parent to the Root-Volume-Clip.
      assert.equal(context.lead("securing_support"), "root_volume_clip")
      // One collapsed optional result, never another volume basis.
      assert.equal(context.card("securing_support")?.tier, "optional")
      // A control-resolved direction reaches no securing route at all.
      absent(
        evaluate({ answers: { texture: "curly", goals: ["volume_balance"] } }),
        "securing_support",
      )
      // The explicit concern overrides the inference and activates it anyway.
      assert.equal(
        evaluate({
          answers: { texture: "curly", currentConcerns: ["low_volume_or_weighed_down"] },
        }).route("securing_support")?.tier,
        "optional",
      )
    },
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
    id: "127",
    name: "tools-securing-heated-set-parent",
    input: { inventory: { heated_styling: ["heated_rollers"] } },
    check: (context) => {
      // C01 names "a selected heated/Heatless set" as a securing parent. The
      // unlock predicate reads COVERAGE of any heated or heatless set route —
      // the symmetric twin of fixture 12.
      assert.equal(context.route("heated_volume_set")?.coverage.state, "covered_by_report")
      assert.equal(context.route("securing_support")?.tier, "optional")
      exact(context, "securing_support", ["tools.securing.optional"])
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
    id: "128",
    name: "tools-wash-scalp-brush-not-lead",
    input: { scalpApplicationJob: true, inventory: { wash_application: ["scalp_brush"] } },
    check: (context) => {
      const route = context.route("wash_application_support")
      assert.equal(route?.tier, "optional")
      // Row 128's rule-ID cell was corrected to `tools.wash_application.optional`
      // in the oracle (645a262a); asserted verbatim here.
      exact(context, "wash_application_support", ["tools.wash_application.optional"])
      // W02: a reported scalp brush stays use-yours on its own scalp-care job.
      // It never leads targeted application and never fulfils it.
      assert.equal(context.lead("wash_application_support"), "applicator_bottle")
      // D4 reason precedence: the blocker is unknown ownership of a suitable
      // tool, not an unverified capability of the (ineligible) scalp brush.
      assert.equal(
        context.occurrence("wash_application_support")?.conditionalReason,
        "unknown_ownership",
      )
      assert.equal(
        route?.recommendedProductTypes.includes("scalp_brush"),
        false,
        "the scalp brush is not in the applicator route's eligible lead set",
      )
      assert.equal(route?.coverage.state, "uncovered")
      assert.equal(
        context.asset("wash_application_support")?.productTypes.includes("scalp_brush"),
        false,
      )
      // The reported brush is still what the user told us; only the applicator
      // need stays open.
      assert.deepEqual(route?.reportedOwnership.forms, ["scalp_brush"])
      // The deferred ownership half (WS3, companion of fixture 85): the brush IS
      // visible as use-yours — on its own scalp-care job, never on this card.
      assert.equal(context.lead("scalp_brush_use"), "scalp_brush")
      assert.equal(context.asset("scalp_brush_use")?.presentationState, "use_yours")
      assert.equal(context.card("scalp_brush_use"), null)
    },
  },
  {
    id: "85",
    name: "tools-wash-reported-scalp-brush",
    input: { scalpApplicationJob: false, inventory: { wash_application: ["scalp_brush"] } },
    check: (context) => {
      // W01/W02: reported-use only. It needs no parent event, creates no need
      // and lives on its own scalp-care route.
      const route = context.route("scalp_brush_use")
      assert.equal(route?.tier, "not_needed")
      assert.equal(context.lead("scalp_brush_use"), "scalp_brush")
      assert.equal(route?.coverage.state, "covered_by_report")
      assert.equal(context.asset("scalp_brush_use")?.presentationState, "use_yours")
      assert.equal(context.card("scalp_brush_use"), null, "no purchase, no card")
      // No proactive parent, so the applicator need never appears.
      absent(context, "wash_application_support")
      // Gentle guidance only — never a growth or hair-loss claim.
      const section = context.section("scalp_brush_use", "wash_day")
      assert.ok(section, "the reported brush becomes a real use-yours step")
      const copy = section.actionsDe.join(" ")
      for (const overreach of ["Wachstum", "Haarausfall", "repariert"]) {
        assert.equal(copy.includes(overreach), false, `W01 forbids the claim „${overreach}"`)
      }
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
      // D4: the user's own „Nichts davon"-class answer is `reported`.
      assert.equal(context.route("night_protection")?.reportedOwnership.provenance, "reported")

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
      const ownership = context.route("night_protection")?.reportedOwnership
      assert.equal(ownership?.state, "owned_generic")
      // D4: „Ich schlafe auf einem Satin-Bonnet" NAMES a product — it is a
      // report, wherever it was asked.
      assert.equal(ownership?.provenance, "reported")
      assert.equal(context.route("night_protection")?.coverage.state, "covered_by_report")
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
      assert.equal(context.route("night_protection")?.reportedOwnership.provenance, "reported")
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
      assert.equal(context.route("night_protection")?.reportedOwnership.provenance, "reported")
    },
  },
  {
    id: "97",
    name: "tools-night-default-pillow",
    input: { answers: { goals: ["frizz_surface"] }, care: { nightProtection: [] } },
    check: (context) => {
      assert.equal(context.lead("night_protection"), "pillowcase")
      assert.equal(context.route("night_protection")?.reportedOwnership.state, "explicit_none")
      assert.equal(context.route("night_protection")?.reportedOwnership.provenance, "reported")
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
      const ownership = context.route("night_protection")?.reportedOwnership
      assert.equal(ownership?.state, "explicit_none")
      assert.equal(ownership?.provenance, "reported")
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
    id: "103",
    name: "tools-night-guidance-boundary",
    input: {
      answers: { hairLength: "long" },
      care: { nightProtection: ["silk_satin_bonnet"] },
    },
    check: (context) => {
      // The nightly step exists on every day, so any day renders it.
      const section = context.section("night_protection", "rest_day")
      assert.ok(section)
      assert.equal(section.placement, "nightly")
      // N06: comfortable coverage, loose fit, and loosen/reposition/remove on
      // pulling or pain.
      assert.ok(
        section.actionsDe.some((action) => action.includes("bequem")),
        `comfortable-coverage guidance missing from ${JSON.stringify(section.actionsDe)}`,
      )
      assert.ok(
        section.actionsDe.some((action) => /zieht oder wehtut/.test(action)),
        "the N06 loosen/reposition/remove clause is missing",
      )
      // N06 boundary: containment and style preservation only.
      const copy = section.actionsDe.join(" ")
      for (const overreach of ["repariert", "Wachstum", "verhindert", "Bruch"]) {
        assert.equal(copy.includes(overreach), false, `N06 forbids the claim „${overreach}"`)
      }
    },
  },
  {
    id: "17",
    name: "tools-night-no-signal",
    input: { care: { nightProtection: ["silk_satin_pillow"] } },
    check: (context) => {
      const route = context.route("night_protection")
      // N04: real current behaviour is preserved; ownership alone creates
      // neither a need nor a shopping card, so the tier is `not_needed`.
      assert.equal(route?.tier, "not_needed")
      exact(context, "night_protection", [])
      assert.equal(context.lead("night_protection"), "pillowcase")
      assert.equal(route?.reportedOwnership.state, "owned_generic")
      assert.equal(route?.reportedOwnership.provenance, "reported")
      // … as a nightly continue-yours step.
      const occurrence = context.occurrence("night_protection")
      assert.equal(occurrence?.anchor.position, "nightly")
      assert.equal(occurrence?.executable, true)
      assert.ok(context.section("night_protection", "rest_day"), "nightly happens every day")
      assert.equal(context.card("night_protection"), null, "no optional need, no shopping card")
    },
  },
  {
    id: "94",
    name: "tools-night-no-signal-reported",
    input: { care: { nightProtection: ["length_tip_accessory"] } },
    check: (context) => {
      assert.equal(context.route("night_protection")?.tier, "not_needed")
      exact(context, "night_protection", [])
      assert.equal(context.lead("night_protection"), "length_tip_sleeve")
      assert.equal(context.occurrence("night_protection")?.anchor.position, "nightly")
      assert.equal(context.card("night_protection"), null)
    },
  },
  {
    id: "98",
    name: "tools-night-reported-alternative",
    input: { answers: { hairLength: "long" }, care: { nightProtection: ["silk_satin_bonnet"] } },
    check: (context) => {
      assert.equal(context.route("night_protection")?.tier, "optional")
      exact(context, "night_protection", ["tools.night.optional_other"])
      // N03: the reported form stays primary.
      assert.equal(context.lead("night_protection"), "bonnet")
      // The one surviving alternative is the FIRST form in the route's binding
      // order whose intended coverage differs from the reported lead — here the
      // pillowcase, ahead of the bonnet in `N02`'s order.
      assert.deepEqual(context.route("night_protection")?.recommendedProductTypes, [
        "pillowcase",
        "bonnet",
        "soft_night_tie",
        "length_tip_sleeve",
      ])
      assert.equal(
        context.card("night_protection")?.noteDe,
        "Alternative: Glatter Kissenbezug, wenn diese Form besser zu dir passt",
      )
      // … rendered as the „Alternative:" line only, never as a second card.
      assert.equal(
        context.plan.assets.filter((asset) => asset.family === "night_protection").length,
        1,
      )
      assert.equal(
        context.cardIds("optional").filter((id) => id.includes("night_protection")).length,
        1,
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

/** The `T05` plopping guidance entry — the route produces nothing else. */
function plopGuidance(context: FixtureContext) {
  const entry = context.plan.guidance.find(
    (candidate) => candidate.routeKey === routeKeyFor("textile_plop"),
  )
  assert.ok(entry, "the plopping route must produce a guidance entry")
  return entry
}

/** The rendered plopping step on a day, as the user reads it. */
function plopStep(context: FixtureContext, dayType: ApplicationDayTypeKey) {
  const entry = plopGuidance(context)
  return (
    projectToolsForDay({
      dayType,
      assets: context.plan.assets,
      occurrences: context.plan.occurrences,
      guidance: context.plan.guidance,
    }).transitions.find((candidate) => candidate.stepKey === entry.guidanceKey) ?? null
  )
}

/** Every Stage-1 card the drying-textile family renders, across both blocks. */
function textileCardIds(context: FixtureContext): string[] {
  return [...context.cardIds("basis"), ...context.cardIds("optional")].filter((id) =>
    id.includes("drying_textile"),
  )
}

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
      // D5: the neutral textile group renders as ONE card through the choice
      // group now, with exactly the copy the family-keyed special case used.
      assert.equal(
        context.card("drying_textile_upgrade")?.typeLabel,
        TOOL_CHOICE_GROUP_LABELS.drying_textile,
      )
      assert.deepEqual(context.cardIds("optional"), [choiceGroupKeyFor("drying_textile")])
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
    id: "106",
    name: "tools-textile-reported-suitable",
    input: { care: { towelMaterial: "mikrofaser", towelTechnique: "gentle_press" } },
    check: (context) => {
      // T02: a reported suitable form is use-yours, never another purchase.
      const route = context.route("drying_textile_use")
      assert.equal(route?.tier, "not_needed")
      assert.equal(context.lead("drying_textile_use"), "microfiber_towel")
      assert.equal(route?.coverage.state, "covered_by_report")
      assert.equal(context.asset("drying_textile_use")?.presentationState, "use_yours")
      assert.equal(context.card("drying_textile_use"), null, "no duplicate purchase")
      assert.equal(
        context.occurrence("drying_textile_use")?.anchor.position,
        "post_rinse_towel_dry",
      )
      // Only `frottee` creates the optional upgrade (fixture 105 keeps it away).
      absent(context, "drying_textile_upgrade")
    },
  },
  {
    id: "108",
    name: "tools-textile-plop-default",
    input: {
      answers: { texture: "curly", goals: ["shape_definition"] },
      care: { towelMaterial: "tshirt", towelTechnique: "gentle_press" },
    },
    check: (context) => {
      const route = context.route("textile_plop")
      // T03: a DEFAULT wash-routine technique, not a collapsed optional tip.
      assert.equal(route?.tier, "basis")
      assert.equal(route?.resolution, "behavior_only")
      exact(context, "textile_plop", ["tools.textile.plop"])
      // T04: a technique, never a product — so no wrap can become a basis buy.
      assert.equal(context.asset("textile_plop"), null)
      assert.equal(context.occurrence("textile_plop"), null)
      const guidance = plopGuidance(context)
      assert.equal(guidance.strength, "supportive")
      const step = plopStep(context, "wash_day")
      assert.ok(step, "the technique renders as an ordinary routine step")
      // gather/scrunch gently, never rub or twist tightly …
      assert.match(step.copyDe, /nicht rubbeln/)
      assert.match(step.copyDe, /ohne Zug/)
      // … and no universal duration is prescribed.
      for (const duration of ["Minute", "Stunde", "Sekunde"]) {
        assert.equal(step.copyDe.includes(duration), false, `T05 forbids „${duration}"`)
      }
    },
  },
  {
    id: "109",
    name: "tools-textile-plop-no-towel-override",
    input: {
      answers: { texture: "curly", goals: ["shape_definition"] },
      care: { towelMaterial: "no_towel" },
    },
    check: (context) => {
      absent(context, "textile_plop")
      assert.equal(
        context.routes.some((route) => route.family === "drying_textiles"),
        false,
        "`no_towel` overrides the plopping default and every textile product",
      )
    },
  },
  {
    id: "110",
    name: "tools-textile-plop-owned",
    input: {
      answers: { texture: "curly", goals: ["shape_definition"] },
      care: { towelMaterial: "tshirt", towelTechnique: "gentle_press" },
      inventory: { drying_textiles: ["smooth_cotton_cloth"] },
    },
    check: (context) => {
      assert.equal(context.route("textile_plop")?.tier, "basis")
      // „execute with the owned form …"
      assert.equal(context.lead("drying_textile_use"), "smooth_cotton_cloth")
      assert.equal(context.asset("drying_textile_use")?.presentationState, "use_yours")
      // „… and recommend no product."
      assert.deepEqual(textileCardIds(context), [])
    },
  },
  {
    id: "111",
    name: "tools-textile-plop-unreported",
    input: {
      answers: { texture: "curly", goals: ["shape_definition"] },
      care: { towelMaterial: "tshirt", towelTechnique: "gentle_press" },
      inventory: { drying_textiles: [] },
    },
    check: (context) => {
      // The technique stays executable with an ordinary suitable T-Shirt …
      assert.equal(context.route("textile_plop")?.tier, "basis")
      assert.ok(plopStep(context, "wash_day"))
      // … and an explicit „nothing" never turns a wrap into a basis product.
      absent(context, "drying_textile_use", "drying_textile_upgrade")
      assert.deepEqual(textileCardIds(context), [])
    },
  },
  {
    id: "112",
    name: "tools-textile-plop-placement",
    input: {
      answers: { texture: "curly", goals: ["shape_definition"] },
      care: {
        towelMaterial: "tshirt",
        towelTechnique: "gentle_press",
        dryingRoutes: ["diffuser_or_airflow_shaping"],
      },
    },
    check: (context) => {
      const guidance = plopGuidance(context)
      // D7: after the damp Leave-in/styling application …
      assert.equal(guidance.anchor.position, "damp_leave_on")
      assert.equal(placementForAnchor(guidance.anchor), "post_wash")
      // … and strictly before the drying occurrence.
      const drying = context.occurrence("drying_diffused")
      assert.ok(drying)
      assert.ok(
        dayAnchorIndex(guidance.anchor) < dayAnchorIndex(drying.anchor),
        "plopping precedes drying on the shared graph",
      )
      // The towel step is a different, earlier occurrence — plopping does not
      // anchor at `post_rinse_towel_dry` (the 2026-08-25 `D7` correction).
      assert.ok(
        dayAnchorIndex(atDayAnchor("post_rinse_towel_dry")) < dayAnchorIndex(guidance.anchor),
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
      // Block exactness: each block contains exactly the named members and
      // nothing else, in family order.
      assert.deepEqual(context.cardIds("basis"), [
        assetKeyFor("airflow", "hair_dryer"),
        assetKeyFor("brushes_combs", "detangling_brush"),
      ])
      assert.deepEqual(context.cardIds("optional"), [
        assetKeyFor("night_protection", "length_tip_sleeve"),
        choiceGroupKeyFor("drying_textile"),
      ])
    },
  },
  {
    id: "37",
    name: "tools-airflow-linked-occurrences",
    input: {
      care: { dryingRoutes: ["ordinary_blow_dry"] },
      answers: { goals: ["volume_balance"] },
    },
    check: (context) => {
      const preDry = context.occurrence("drying_standard")
      const airShape = context.occurrence("air_shaping_volume")
      assert.ok(preDry && airShape, "both halves of the linked pair exist")
      // D7: the pair sits on the shared day graph in graph order — the ordering
      // comes from the graph, not from a separate sequence field.
      assert.equal(preDry.anchor.position, "dry_pre_heat")
      assert.equal(airShape.anchor.position, "heat_tool")
      // A09: one parent styling session, one cadence. Two occurrences must never
      // be read as two inferred weekly schedules.
      assert.ok(preDry.sessionKey, "the pre-dry half carries the session key")
      assert.equal(preDry.sessionKey, airShape.sessionKey)
      const schedules = new Set(
        [preDry, airShape].map((occurrence) => occurrence.sessionKey ?? occurrence.occurrenceKey),
      )
      assert.equal(schedules.size, 1, "the linked pair schedules once")
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

test("fixture 116 — tools-onboarding-submitted-unchecked", () => {
  const triggerContext = {
    relevantCategories: [],
    hasReportedIrritatedScalp: false,
    dryShampooBridgeEligibility: "ineligible" as const,
    toolsEnabled: true,
  }
  // The care answers that make the preselection real: the user already told us
  // they blow-dry, so the airflow section arrives pre-ticked (`D3a` condition 1).
  const answers: PersonalPlanRefinementAnswersV1 = {
    currentProductCategories: [],
    wetWashFrequency: "weekly_2x",
    towel: { material: "no_towel" },
    dryingRoutes: ["ordinary_blow_dry"],
    additionalHeatTools: [],
    heatEvents: { "heat:ordinary_blow_dry": { frequency: "weekly_2x" } },
    nightProtection: [],
  }
  const care = careFrom(answers)
  assert.deepEqual(
    defaultToolSectionsFromCare(care),
    ["trocknen_stylen"],
    "the care-implied section is pre-ticked, so an unticked card is a real choice",
  )
  assert.deepEqual(defaultToolFormsFromCare(care).airflow, ["hair_dryer"])

  // Condition 2: the withdrawn promise is gone and the ratified copy is shipped.
  assert.equal(
    TOOL_OVERVIEW_LEAD,
    "Wähle die Bereiche, aus denen du schon Produkte hast. Nicht gewählt = hast du nicht.",
  )

  const session = saveStage2SessionAnswer(
    createStage2RefinementSession({
      pathVersion: "test",
      triggerContext,
      answers,
      completedQuestionIds: [
        "current_product_categories",
        "wet_wash_frequency",
        "towel_handling",
        "drying_routes",
        "additional_heat_tools",
        "heat:ordinary_blow_dry",
        "night_protection",
      ],
    }),
    { questionId: "tools_overview", answer: ["trocknen_stylen"] },
  )

  assert.deepEqual(session.answers.toolFamiliesWithSomething, [
    "airflow",
    "heated_styling",
    "heatless_styling",
  ])
  // `D3a`: every unchecked family is an explicit none — no unknowns remain.
  for (const family of [
    "brushes_combs",
    "securing_sectioning",
    "wash_application",
    "night_protection",
    "drying_textiles",
  ] as const) {
    assert.deepEqual(session.answers.toolForms?.[family], [], `${family} must be an explicit none`)
  }
  // The checked families stay open for their own pages rather than being
  // answered on the user's behalf.
  for (const family of ["airflow", "heated_styling", "heatless_styling"] as const) {
    assert.equal(session.answers.toolForms?.[family], undefined)
  }
  // `D3c`: the care-implied airflow evidence survives the submit — the overview
  // never writes synthesized emptiness over a preselection the user kept.
  const merged = mergeToolInventories(
    projectToolInventoryFromCareFacts(care),
    session.answers.toolForms ?? {},
  )
  assert.deepEqual(inventoryFor(merged, "airflow"), ["hair_dryer"])
  assert.deepEqual(inventoryFor(merged, "brushes_combs"), [])
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
  // `B09`'s Stielkamm needs a SELECTED parting/sectioning step. `scalpApplicationJob`
  // is not it: `C02` already resolves that parent to a Sectioning-Clip, and
  // fixture 88 forbids a second sectioning aid for the same event.
  "69": "no production input (no selected parting step)",
  "72": "no production input (no selected parting step)",
  // `W01`'s second proactive parent — a SELECTED between-wash curl/wave refresh
  // step — has no production field, so the water spray bottle has no trigger.
  "83": "no production input (no between-wash refresh step)",
  "84": "no production input (no refresh parent)",
  "88": "no production input",
  "92": "no production input (no independent brush-friction signal)",

  // C05 deferred to Stage 2 by decision.
  "79": "NOT APPLICABLE (C05 deferred)",

  // Flagged to the orchestrator rather than implemented.
  "114":
    "FLAGGED — deferredFacts wiring. Emitting a route for `towelMaterial=null` " +
    "adds a Stage-1 card for every pre-Feinschliff user, which needs the WS4 " +
    "mockup gate. WS4 (2026-08-25) confirmed the flag rather than clearing it: " +
    "the ratified WS4 evidence covers the overview copy, the drying question " +
    "and the two Bürsten cards — not a new Stage-1 textile card. No Phase-1 " +
    "rule takes a conservative lower tier on a missing input today either " +
    "(`routes.ts` returns `deferredFacts: []` because the families that could " +
    "defer emit nothing at all), so there is no existing route to attach a " +
    "reason fact to without first emitting the card the gate covers.",
}

const RETIRED = new Set(["122", "123"])

/**
 * The oracle's live row ids, parsed from `fixtures.md` itself.
 *
 * The previous guard compared a hand-written `1..126` range against a hand-
 * written count — a constant expression that could only ever fail if someone
 * edited both halves. Reading the document means a row added to the oracle fails
 * this suite until it is encoded or skip-listed, which is the whole point of
 * having an oracle. Read-only: the test never writes the file.
 */
const FIXTURE_TABLE_PATH = new URL(
  "../docs/personal-plan/categories/tools/fixtures.md",
  import.meta.url,
)

function parseLiveFixtureIds(): string[] {
  const source = readFileSync(FIXTURE_TABLE_PATH, "utf8")
  const ids: string[] = []
  for (const line of source.split("\n")) {
    if (!line.startsWith("|")) continue
    const cell = line.slice(1).split("|")[0]?.trim()
    if (cell === undefined) continue
    // A fixture row's first cell is the fixture number and nothing else: a plain
    // number, the `4b` variant, or one of the `A-x…` rows production forces.
    // Strip bold/code decoration so a row written `| **129** |` cannot be
    // silently skipped by the parser.
    const undecorated = cell.replace(/[*`_]/g, "").trim()
    if (!/^(\d{1,3}|4b|A-x\d+)$/.test(undecorated)) continue
    if (!ids.includes(undecorated)) ids.push(undecorated)
  }
  return ids
}

test("the executor covers exactly the live rows in fixtures.md", () => {
  const oracleIds = parseLiveFixtureIds()
  assert.ok(
    oracleIds.length > 120,
    `fixtures.md parsed as only ${oracleIds.length} rows — the parser or the table changed shape`,
  )

  const implemented = new Set(IMPLEMENTED_ROWS.map((row) => row.id))
  // 40, 50, 51 and 125 run through the heat-protection executor above; 116 runs
  // through the Feinschliff capture executor (it judges the session, not a route).
  for (const id of ["40", "50", "51", "116", "125"]) implemented.add(id)

  const covered = new Set([...implemented, ...Object.keys(SKIPPED)])
  const missing = oracleIds.filter((id) => !covered.has(id))
  const phantom = [...covered].filter((id) => !oracleIds.includes(id))
  const doubled = [...implemented].filter((id) => id in SKIPPED && !RETIRED.has(id))

  assert.deepEqual(missing, [], "these fixtures.md rows are neither executed nor skip-listed")
  assert.deepEqual(phantom, [], "these ids are covered here but no longer exist in fixtures.md")
  assert.deepEqual(doubled, [], "these fixture rows are both executed and skip-listed")
  assert.deepEqual(
    [...covered].sort(),
    [...oracleIds].sort(),
    "executed ∪ skipped must equal the oracle's live row set",
  )
})
