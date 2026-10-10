import assert from "node:assert/strict"
import test from "node:test"

import { computeNeedPlan } from "@/lib/personal-plan/compute-stage1"
import { resolveStage2RefinementContract } from "@/lib/personal-plan/refinement/question-path"
import type { RoutinePayloadV1 } from "@/lib/personal-plan/routine/contracts"
import { buildToolPlan } from "@/lib/personal-plan/tools/assets"
import { projectToolCareFacts, toolFormsByFamily } from "@/lib/personal-plan/tools/facts"
import {
  buildToolView,
  scalpApplicationJobFromDecisions,
  scalpApplicationJobFromRoutine,
  toolCareFactsFromFacts,
  type BuildToolViewInput,
  type ToolView,
} from "@/lib/personal-plan/tools/read-view"
import {
  computeToolRoutes,
  toolProfileFactsFromPlanProfile,
} from "@/lib/personal-plan/tools/routes"
import type { InitialNeedPlanSnapshot } from "@/lib/personal-plan/types"
import { toCareHabitsPatch, toFieldProvenance } from "@/lib/user-facts/from-refinement-draft"
import { careHabitsV1Schema, type FieldProvenanceValue } from "@/lib/user-facts/schema"

import { COMPLETE_V3_PLAN_ENVELOPE } from "./fixtures"

function needSnapshot(): InitialNeedPlanSnapshot {
  const computed = computeNeedPlan({
    rawEnvelope: COMPLETE_V3_PLAN_ENVELOPE,
    artifactId: "artifact-1",
    projection: "initial_quiz",
    computationVersion: "test",
    createdAt: "2026-10-10T00:00:00.000Z",
  })
  assert.equal(computed.status, "ready")
  if (computed.status !== "ready") throw new Error("unreachable")
  return computed.snapshot
}

const toolsOn = {
  relevantCategories: [],
  hasReportedIrritatedScalp: false,
  dryShampooBridgeEligibility: "ineligible" as const,
  toolsEnabled: true as const,
}

/**
 * Lena (§6): Föhn, Warmluftbürste, Glätteisen, Rundbürste, Grobzinkiger Kamm,
 * Mikrofaser-Handtuch, Glatter Kissenbezug — answered by her, stored through the facts door.
 */
function lenaDraft() {
  const contract = resolveStage2RefinementContract({
    triggerContext: toolsOn,
    answers: {
      currentProductCategories: [],
      wetWashFrequency: "weekly_2x",
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
        "wash_application:1": [],
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
      towel: { technique: "gentle_press" } as never,
      dryingRoutes: ["air_dry", "ordinary_blow_dry"],
      heatEvents: {
        "heat:ordinary_blow_dry": { frequency: "weekly_2x" },
        "heat:dryer_brush": { frequency: "weekly_1x", protectionConsistency: "always" },
        "heat:straightener": { frequency: "weekly_1x", protectionConsistency: "sometimes" },
      },
    },
    completedQuestionIds: [
      "current_product_categories",
      "wet_wash_frequency",
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
      "towel_handling",
      "drying_routes",
      "heat:ordinary_blow_dry",
      "heat:dryer_brush",
      "heat:straightener",
    ],
  })
  assert.equal(contract.isComplete, true)
  return { answers: contract.answers, completedQuestionIds: contract.path.completedQuestionIds }
}

function lenaFacts() {
  const draft = lenaDraft()
  const careHabits = careHabitsV1Schema.parse(
    toCareHabitsPatch(draft.answers, { completedQuestionIds: draft.completedQuestionIds }),
  )
  const fieldProvenance = toFieldProvenance({ ...draft, answerProvenance: {} })
  return { careHabits, fieldProvenance }
}

function viewFor(overrides: Partial<BuildToolViewInput> = {}): ToolView {
  const view = buildToolView({
    ...lenaFacts(),
    needSnapshot: needSnapshot(),
    routine: null,
    hasOptionalPage: true,
    toolsEnabled: true,
    ...overrides,
  })
  assert.ok(view)
  return view!
}

function cardIds(view: ToolView) {
  return {
    basis: view.stage1Cards.basis?.cards.map((card) => [card.id, card.state]) ?? [],
    optional: view.stage1Cards.optional?.cards.map((card) => [card.id, card.state]) ?? [],
  }
}

/* ── flag ─────────────────────────────────────────────────────────────── */

test("flag off (false, undefined) yields no view at all", () => {
  for (const toolsEnabled of [false, undefined]) {
    assert.equal(
      buildToolView({
        ...lenaFacts(),
        needSnapshot: needSnapshot(),
        routine: null,
        hasOptionalPage: true,
        toolsEnabled,
      }),
      null,
    )
  }
})

/* ── determinism ──────────────────────────────────────────────────────── */

test("same facts give the same view", () => {
  assert.deepEqual(viewFor(), viewFor())
  // Key order of the stored facts is irrelevant.
  const { careHabits, fieldProvenance } = lenaFacts()
  const reversed = Object.fromEntries(Object.entries(careHabits).reverse())
  assert.deepEqual(viewFor({ careHabits: reversed, fieldProvenance }), viewFor())
})

/* ── Lena (§6) against the engine's own oracle ───────────────────────── */

test("Lena: the read view equals the engine fed the fixture way from her draft", () => {
  const draft = lenaDraft()
  const snapshot = needSnapshot()
  const oracle = buildToolPlan({
    routes: computeToolRoutes({
      profile: toolProfileFactsFromPlanProfile(snapshot.profile),
      care: projectToolCareFacts(draft.answers, "reported"),
      inventory: toolFormsByFamily(draft.answers),
      scalpApplicationJob: false,
    }),
  })
  const view = viewFor()
  assert.deepEqual(view.routineSection?.assets, oracle.assets)
  assert.deepEqual(view.applicationGuidance, {
    assets: oracle.assets,
    occurrences: oracle.occurrences,
    guidance: oracle.guidance,
  })
})

test("Lena: cards, Routine rows and Anwendung occurrences", () => {
  const view = viewFor()
  assert.deepEqual(cardIds(view), {
    basis: [
      ["asset:airflow:hair_dryer", "use_yours"],
      ["asset:brushes_combs:wide_tooth_comb", "use_yours"],
    ],
    optional: [["asset:night_protection:pillowcase", "use_yours"]],
  })
  assert.deepEqual(
    view.routineSection?.assets.map((asset) => [asset.assetKey, asset.productTypes]),
    [
      ["asset:airflow:hair_dryer", ["hair_dryer", "hot_air_brush"]],
      ["asset:heated_styling:flat_iron", ["flat_iron"]],
      ["asset:brushes_combs:wide_tooth_comb", ["wide_tooth_comb"]],
      ["asset:night_protection:pillowcase", ["pillowcase"]],
      ["asset:drying_textiles:microfiber_towel", ["microfiber_towel"]],
    ],
  )
  // Everything she owns, she named herself: nothing is marked derived.
  assert.deepEqual(view.routineSection?.derivedAssetKeys, [])
  assert.equal(
    [...(view.stage1Cards.basis?.cards ?? []), ...(view.stage1Cards.optional?.cards ?? [])].some(
      (card) => card.derived,
    ),
    false,
  )
  assert.deepEqual(
    view.applicationGuidance.occurrences.map((occurrence) => [
      occurrence.assetKey,
      occurrence.anchor.position,
    ]),
    [
      ["asset:airflow:hair_dryer", "dry_pre_heat"],
      ["asset:heated_styling:flat_iron", "heat_tool"],
      ["asset:brushes_combs:wide_tooth_comb", "post_rinse_towel_dry"],
      ["asset:night_protection:pillowcase", "nightly"],
      ["asset:drying_textiles:microfiber_towel", "post_rinse_towel_dry"],
    ],
  )
  assert.deepEqual(view.applicationGuidance.guidance, [])
})

test("without an Optional page the optional Tools follow the basis block", () => {
  const view = viewFor({ hasOptionalPage: false })
  assert.equal(view.stage1Cards.optional, null)
  assert.deepEqual(
    view.stage1Cards.basis?.cards.map((card) => card.id),
    [
      "asset:airflow:hair_dryer",
      "asset:brushes_combs:wide_tooth_comb",
      "asset:night_protection:pillowcase",
    ],
  )
})

/* ── D5: assumed never owns ──────────────────────────────────────────── */

test("assumed forms are excluded from ownership; the same values as user answers own", () => {
  const careHabits = {
    dryingRoutes: ["ordinary_blow_dry"],
    towel: { material: "mikrofaser", technique: "gentle_press" },
    toolFamiliesWithSomething: ["drying_textiles"],
    toolForms_drying_textiles_1: ["microfiber_towel"],
  } as BuildToolViewInput["careHabits"]
  const provenance = (value: FieldProvenanceValue) => ({
    dryingRoutes: value,
    towel: value,
    toolFamiliesWithSomething: value,
    toolForms_drying_textiles_1: value,
  })

  const assumed = viewFor({ careHabits, fieldProvenance: provenance("assumed") })
  for (const asset of assumed.routineSection?.assets ?? []) {
    assert.equal(asset.ownership, "unknown", asset.assetKey)
    assert.equal(asset.presentationState, "check_in_refinement", asset.assetKey)
  }
  assert.equal(
    assumed.routineSection?.assets.some((asset) => asset.family === "drying_textiles"),
    false,
    "an assumed towel never becomes a Tool the member owns",
  )

  const reported = viewFor({ careHabits, fieldProvenance: provenance("user") })
  const towel = reported.routineSection?.assets.find(
    (asset) => asset.assetKey === "asset:drying_textiles:microfiber_towel",
  )
  assert.equal(towel?.presentationState, "use_yours")
})

/* ── per-field care provenance (fix round 1) ─────────────────────────── */

const CARE_FACTS = {
  dryingRoutes: ["ordinary_blow_dry"],
  towel: { material: "mikrofaser", technique: "gentle_press" },
  nightProtection: ["silk_satin_pillow"],
} as BuildToolViewInput["careHabits"]

function assetState(view: ToolView, assetKey: string) {
  return view.routineSection?.assets.find((asset) => asset.assetKey === assetKey)?.presentationState
}

test("mixed provenance: drying user + night assumed → Föhn confirmed-derived, night unconfirmed", () => {
  const view = viewFor({
    careHabits: CARE_FACTS,
    fieldProvenance: { dryingRoutes: "user", towel: "user", nightProtection: "assumed" },
  })
  assert.equal(assetState(view, "asset:airflow:hair_dryer"), "use_yours")
  assert.ok(view.routineSection?.derivedAssetKeys.includes("asset:airflow:hair_dryer"))
  assert.equal(assetState(view, "asset:drying_textiles:microfiber_towel"), "use_yours")
  const night = view.routineSection?.assets.find((asset) => asset.family === "night_protection")
  assert.ok(night, "the night need still exists — an assumed fact shapes routes")
  assert.equal(night.ownership, "unknown")
  assert.equal(night.presentationState, "check_in_refinement")
})

test("a backfilled member (all unknown_historical) is confirmed; nothing care-backed reads check-in-refinement", () => {
  const view = viewFor({
    careHabits: CARE_FACTS,
    fieldProvenance: {
      dryingRoutes: "unknown_historical",
      towel: "unknown_historical",
      nightProtection: "unknown_historical",
    },
  })
  const careBacked = new Set(["airflow", "drying_textiles", "night_protection"])
  const assets = view.routineSection!.assets.filter((asset) => careBacked.has(asset.family))
  assert.equal(assets.length, 3)
  for (const asset of assets) {
    assert.notEqual(asset.presentationState, "check_in_refinement", asset.assetKey)
    assert.notEqual(asset.ownership, "unknown", asset.assetKey)
  }
  assert.equal(assetState(view, "asset:airflow:hair_dryer"), "use_yours")
  assert.ok(view.routineSection?.derivedAssetKeys.includes("asset:airflow:hair_dryer"))
})

test("an empty historical default is not an answer (knownCareAnswers rule)", () => {
  const care = toolCareFactsFromFacts(
    { nightProtection: [], dryingRoutes: ["ordinary_blow_dry"] },
    { nightProtection: "unknown_historical", dryingRoutes: "unknown_historical" },
  )
  assert.deepEqual(care.assumedFields, ["nightProtection"])
})

test("all assumed → every care-derived Tool is unconfirmed", () => {
  const view = viewFor({
    careHabits: CARE_FACTS,
    fieldProvenance: { dryingRoutes: "assumed", towel: "assumed", nightProtection: "assumed" },
  })
  for (const asset of view.routineSection!.assets) {
    assert.equal(asset.ownership, "unknown", asset.assetKey)
    assert.equal(asset.presentationState, "check_in_refinement", asset.assetKey)
  }
  assert.deepEqual(view.routineSection?.derivedAssetKeys, [])
  // A fact without any provenance entry counts as unconfirmed too.
  assert.deepEqual(toolCareFactsFromFacts(CARE_FACTS, undefined).assumedFields, [
    "dryingRoutes",
    "towelMaterial",
    "nightProtection",
  ])
})

test("reported ownership from the Tool pages stays user-only (D5 unchanged)", () => {
  const view = viewFor({
    careHabits: {
      toolFamiliesWithSomething: ["brushes_combs"],
      toolForms_brushes_combs_1: ["wide_tooth_comb"],
      toolForms_brushes_combs_2: [],
    },
    fieldProvenance: {
      toolFamiliesWithSomething: "unknown_historical",
      toolForms_brushes_combs_1: "unknown_historical",
      toolForms_brushes_combs_2: "unknown_historical",
    },
  })
  for (const asset of view.routineSection!.assets) {
    assert.equal(asset.ownership, "unknown", asset.assetKey)
  }
})

/* ── D4: a behaviour projection is marked derived ────────────────────── */

test("a Föhn projected from the drying behaviour is marked derived on Stage 1 and in the Routine", () => {
  const view = viewFor({
    careHabits: { dryingRoutes: ["ordinary_blow_dry"] },
    fieldProvenance: { dryingRoutes: "user" },
  })
  const dryer = view.stage1Cards.basis?.cards.find((card) => card.id === "asset:airflow:hair_dryer")
  assert.equal(dryer?.state, "use_yours")
  assert.equal(dryer?.derived, true)
  assert.deepEqual(view.routineSection?.derivedAssetKeys, ["asset:airflow:hair_dryer"])
  // Cards that claim nothing carry no marking at all.
  for (const card of view.stage1Cards.basis?.cards ?? []) {
    if (card.state !== "use_yours") assert.equal("derived" in card, false, card.id)
  }
})

/* ── carried from Task 4: answer-only tokens ─────────────────────────── */

test("a textiles page holding only Frottee reads as explicit none; textile guidance keys on the care facts", () => {
  const view = viewFor({
    careHabits: {
      toolFamiliesWithSomething: ["drying_textiles"],
      toolForms_drying_textiles_1: ["frottee"],
      towel: { material: "frottee", technique: "rough_rubbing" },
    },
    fieldProvenance: {
      toolFamiliesWithSomething: "user",
      toolForms_drying_textiles_1: "user",
      towel: "user",
    },
  })
  const textile = view.routineSection?.assets.find((asset) => asset.family === "drying_textiles")
  assert.equal(textile?.ownership, "explicit_none", "Frottee is an answer, never a product")
  // The textile need itself comes from towel.material = frottee (fixture 104) …
  assert.deepEqual(textile?.productTypes, [
    "microfiber_towel",
    "smooth_cotton_cloth",
    "drying_wrap",
  ])
  // … and the towel correction from towel.technique = rough_rubbing.
  assert.deepEqual(
    view.applicationGuidance.guidance.map((entry) => [entry.guidanceKey, entry.strength]),
    [["guidance:tool:drying_textiles:gentle_towel_handling", "firm"]],
  )
})

test("an airflow page holding only the Diffusor reads as explicit none; the drying route still keys on the care facts", () => {
  const tokenOnly = viewFor({
    careHabits: {
      toolFamiliesWithSomething: ["airflow"],
      toolForms_airflow_1: ["diffuser"],
      dryingRoutes: ["diffuser_or_airflow_shaping"],
    },
    fieldProvenance: {
      toolFamiliesWithSomething: "user",
      toolForms_airflow_1: "user",
      dryingRoutes: "user",
    },
  })
  const airflow = tokenOnly.routineSection?.assets.find((asset) => asset.family === "airflow")
  assert.equal(airflow?.ownership, "explicit_none", "Diffusor is an answer, never a product")
  assert.ok(
    tokenOnly.applicationGuidance.occurrences.some(
      (occurrence) => occurrence.assetKey === airflow?.assetKey,
    ),
    "the airflow route is still there, driven by the drying routes",
  )

  // Without the page, the same drying route projects a derived Föhn instead.
  const careOnly = viewFor({
    careHabits: { dryingRoutes: ["diffuser_or_airflow_shaping"] },
    fieldProvenance: { dryingRoutes: "user" },
  })
  const derivedAirflow = careOnly.routineSection?.assets.find((asset) => asset.family === "airflow")
  assert.equal(derivedAirflow?.ownership, "owned_generic")
  assert.deepEqual(careOnly.routineSection?.derivedAssetKeys, [derivedAirflow?.assetKey])
})

/* ── scalp application job ───────────────────────────────────────────── */

test("the scalp job comes from the Routine when there is one, else from the decisions", () => {
  const decisions = [
    {
      category: "scalp_care" as const,
      needTier: "basis" as const,
      roles: ["scalp_comfort" as const],
    },
  ]
  assert.equal(scalpApplicationJobFromDecisions(decisions), true)
  assert.equal(
    scalpApplicationJobFromDecisions([{ ...decisions[0], needTier: "not_needed" as const }]),
    false,
  )
  assert.equal(scalpApplicationJobFromDecisions([]), false)

  const item = (inclusion: "included" | "excluded") =>
    ({
      category: "scalp_care",
      role: "scalp_comfort",
      state: { inclusion },
    }) as unknown as RoutinePayloadV1["items"][number]
  assert.equal(scalpApplicationJobFromRoutine({ items: [item("included")] }), true)
  assert.equal(scalpApplicationJobFromRoutine({ items: [item("excluded")] }), false)
  assert.equal(scalpApplicationJobFromRoutine({ items: [] }), false)
})

test("an empty facts document still yields the profile-driven Tool needs, all unverified", () => {
  const view = viewFor({ careHabits: null, fieldProvenance: undefined })
  assert.ok(view.routineSection)
  for (const asset of view.routineSection!.assets) {
    assert.equal(asset.ownership, "unknown", asset.assetKey)
  }
})
