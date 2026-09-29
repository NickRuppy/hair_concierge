import assert from "node:assert/strict"
import test from "node:test"

import type {
  DiscoveryCockpitIntakeProductView,
  DiscoveryCockpitStepView,
  DiscoveryCockpitUnassignedView,
  DiscoveryCockpitVerdictView,
} from "../src/lib/discovery/cockpit"
import { consultSourceHash } from "../src/lib/discovery/consult-brief/hash"
import {
  assembleConsultInput,
  type ConsultInputSource,
} from "../src/lib/discovery/consult-brief/input"
import { discoveryConsultSnapshotFacts } from "../src/lib/discovery/consult-brief/snapshot-facts"
import type { DiscoveryHeatStylingV1 } from "../src/lib/discovery/heat-styling"
import type { PersonalPlanCategory } from "../src/lib/personal-plan/products/contracts"
import type { ScanPresentedVerdictPayload, ScanVerdict } from "../src/lib/scan/types"

/**
 * The consult brief's input assembly and its source hash (consult-agent T2): one structured
 * context from the cockpit read model, the runsheet derivations, the main-problem recipe and
 * the fired knowledge entries — and a stable fingerprint over it, so the page can tell a
 * stored brief is stale.
 */

// --- fixtures ----------------------------------------------------------------------------

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const key of Object.keys(value as object)) {
      deepFreeze((value as Record<string, unknown>)[key])
    }
  }
  return value
}

function inCatalog(
  verdict: ScanVerdict,
  product: { name: string; brand: string | null },
  verdictLabel: string,
): DiscoveryCockpitVerdictView {
  return {
    status: "verdict",
    product: { productId: "p", ...product } as never,
    payload: {
      kind: "in_catalog",
      verdict,
      verdictLabel,
      verdictTitle: verdictLabel,
      status: "neutral",
      subtitle: "",
      evaluatedRole: null,
      evaluatedRoleLabel: null,
      dimensions: [],
      criteria: [],
      coverage: null,
      fitNarrative: null,
      alternatives: [],
    } satisfies ScanPresentedVerdictPayload,
    propertyRows: [],
  }
}

type StepInput = Partial<DiscoveryCockpitStepView> & {
  decisionKey: string
  category: PersonalPlanCategory
}

function step(input: StepInput): DiscoveryCockpitStepView {
  return {
    categoryLabel: input.category,
    roleLabel: input.category,
    roleDescription: null,
    frequencyLabel: "2× pro Woche",
    depth: null,
    section: "basis",
    outcome: input.intakeItemId ? "undecided" : "ideal",
    ownedLabel: null,
    intakeItemId: null,
    ownedProductId: null,
    ownedUsageRole: null,
    stepEntryCount: 1,
    ownedFrequencyLabel: null,
    ownedFrequency: null,
    idealAllowedRange: null,
    canDrop: false,
    unanswered: false,
    verdict: null,
    swapOptions: [],
    swapProductId: null,
    swapProductLabel: null,
    idealRecommendation: null,
    recommendationLabel: null,
    ownedUsageLabel: null,
    ownedImageUrl: null,
    swapProductImageUrl: null,
    recommendationImageUrl: null,
    usageDifference: null,
    ...input,
  }
}

function option(productId: string, label: string) {
  return {
    productId,
    name: label,
    brand: null,
    label,
    verdictLabel: "Passt",
    origin: "alternative" as const,
    propertyRows: null,
    priceLabel: null,
  }
}

function intakeProduct(
  itemId: string,
  category: PersonalPlanCategory | null,
  frequency: DiscoveryCockpitIntakeProductView["frequency"] = null,
): DiscoveryCockpitIntakeProductView {
  return {
    itemId,
    category,
    usageRole: null,
    productType: null,
    frequency,
    frequencyLabel: null,
    typeOpen: false,
    productName: null,
    label: `Label ${itemId}`,
    imageUrl: null,
    status: "in_catalog",
    statusLabel: "",
    canStartResearch: false,
  }
}

const NOMI_HEAT: DiscoveryHeatStylingV1 = {
  dryingRoutes: ["ordinary_blow_dry"],
  additionalHeatTools: ["curling_or_wave_iron"],
  heatEvents: {
    "heat:ordinary_blow_dry": { frequency: "weekly_3_4x" },
    "heat:curling_or_wave_iron": { frequency: "weekly_2x", protectionConsistency: "sometimes" },
  },
}

const SHAMPOO_KEY = "shampoo:shampoo_everyday:none"
const CONDITIONER_KEY = "conditioner:conditioner_rinse_out:none"
const BOND_KEY = "bondbuilder:specialized_bond_treatment:none"

/** Nomi: blondiert + gefärbt, Lockenstab 2×/Woche, reißt beim Zugtest, Hauptproblem Bruch. */
function nomiSource(overrides: Partial<ConsultInputSource> = {}): ConsultInputSource {
  const unassigned: DiscoveryCockpitUnassignedView[] = [
    {
      itemId: "item-oil",
      category: "oil",
      label: "Gescanntes Produkt · Glanzöl",
      reason: "research_pending",
      usageLabel: null,
      imageUrl: null,
    },
  ]
  return {
    view: {
      steps: [
        step({
          decisionKey: SHAMPOO_KEY,
          category: "shampoo",
          categoryLabel: "Shampoo",
          intakeItemId: "item-shampoo",
          ownedLabel: "Glanzwerk Volumen Shampoo",
          verdict: inCatalog(
            "mismatch",
            { name: "Volumen Shampoo", brand: "Glanzwerk" },
            "Passt nicht",
          ),
          swapOptions: [option("prod-mild", "Sanftwerk Mild Shampoo")],
        }),
        step({
          decisionKey: CONDITIONER_KEY,
          category: "conditioner",
          categoryLabel: "Conditioner",
          intakeItemId: "item-conditioner",
          ownedLabel: "Pflegehaus Repair Spülung",
          verdict: inCatalog("ideal", { name: "Repair Spülung", brand: "Pflegehaus" }, "Passt"),
        }),
        step({
          decisionKey: BOND_KEY,
          category: "bondbuilder",
          categoryLabel: "Bondbuilder",
          idealRecommendation: {
            ...option("prod-bond", "Bindwerk Bond Kur"),
            origin: "ideal_recommendation",
          },
          recommendationLabel: "Bindwerk Bond Kur",
        }),
      ],
      unassigned,
      intakeProducts: [
        intakeProduct("item-shampoo", "shampoo", "daily_1x"),
        intakeProduct("item-conditioner", "conditioner", "daily_1x"),
        intakeProduct("item-oil", "oil"),
      ],
    },
    model: {
      concernProfileFacts: {
        hair_texture: "wavy",
        thickness: "normal",
        scalp_type: "balanced",
        chemical_treatment: ["lightened", "colored"],
        damaged: true,
        heat_styling: true,
      },
      hairElasticity: "snaps",
      heatStyling: NOMI_HEAT,
      consultFacts: {
        concerns: ["breakage", "dry_lengths"],
        scalpConcerns: [],
        profileHeatTools: ["curling_iron"],
        currentWashFrequency: "daily_1x",
        idealWashFrequency: "weekly_3_4x",
        hairLossBoundary: false,
      },
      research: undefined,
    },
    quiz: { concerns: ["breakage", "dry_lengths"], mainConcern: "breakage" },
    ...overrides,
  }
}

// --- snapshot facts -------------------------------------------------------------------------

test("snapshot facts: concerns, scalp concerns, heat tools, wash cadence, hair-loss boundary", () => {
  const snapshot = {
    profile: {
      concerns: ["low_volume_or_weighed_down"],
      scalp: { concerns: ["dry_dandruff"] },
      routine: { shampooFrequency: { state: "known", value: "daily_1x" } },
    },
    assessments: {
      heatExposure: {
        state: "present",
        events: [{ tool: "straightener", route: "direct_contact_heat", frequency: "weekly_2x" }],
      },
      hairLossBoundary: { state: "present", sourceFacts: ["hair_loss_or_thinning"] },
    },
    decisions: [
      { category: "conditioner", frequency: null },
      { category: "shampoo", frequency: { kind: "wet_wash_total", target: "weekly_3_4x" } },
    ],
  }
  assert.deepEqual(discoveryConsultSnapshotFacts(snapshot), {
    concerns: ["low_volume_or_weighed_down"],
    scalpConcerns: ["dry_dandruff"],
    profileHeatTools: ["straightener"],
    currentWashFrequency: "daily_1x",
    idealWashFrequency: "weekly_3_4x",
    hairLossBoundary: true,
  })
})

test("snapshot facts: unreadable = unknown, heat absent = no tools", () => {
  assert.deepEqual(discoveryConsultSnapshotFacts(null), {
    concerns: null,
    scalpConcerns: null,
    profileHeatTools: null,
    currentWashFrequency: null,
    idealWashFrequency: null,
    hairLossBoundary: null,
  })
  const absent = discoveryConsultSnapshotFacts({
    profile: { routine: { shampooFrequency: { state: "unknown", reason: "shampoo_frequency" } } },
    assessments: {
      heatExposure: { state: "absent", events: [] },
      hairLossBoundary: { state: "absent" },
    },
  })
  assert.deepEqual(absent.profileHeatTools, [])
  assert.equal(absent.currentWashFrequency, null)
  assert.equal(absent.hairLossBoundary, false)
})

// --- assembly -------------------------------------------------------------------------------

test("Nomi: profile, main problem with recipe excerpt, fired entries, heat, wash change", () => {
  const input = assembleConsultInput(deepFreeze(nomiSource()), { baselineScore: 4 })

  assert.deepEqual(input.profile.chemicalTreatments, ["lightened", "colored"])
  assert.equal(input.profile.elasticity, "snaps")
  assert.deepEqual(input.profile.concerns, ["breakage", "dry_lengths"])
  assert.equal(input.mainConcern?.code, "breakage")
  assert.ok(input.mainConcern!.label.length > 0)
  assert.ok(input.mainConcern!.levers.length > 0)
  assert.equal("evidence" in input.mainConcern!, false)

  assert.deepEqual(
    input.knowledge.map((entry) => [entry.id, entry.questionFirst]),
    [
      ["ask-bleach-cadence", false],
      ["ask-detangling", false],
      ["color-fade-honesty", false],
      ["dry-lengths-softness", false],
      ["expectation-windows", false],
      ["ongoing-damage-first", false],
      ["protein-stiffness-risk", false],
      ["wash-frequency-transition", false],
    ],
  )
  assert.deepEqual(input.flags, [
    "bleached",
    "breakage_signal",
    "colored",
    "dry_lengths_concern",
    "hot_tool",
    "oil_in_routine",
    "protein_or_bond_care",
    "wash_frequency_change",
    "wavy_hair",
  ])

  assert.equal(input.heat?.tools.length, 2)
  assert.deepEqual(input.washFrequency, {
    current: "daily_1x",
    currentLabel: "Täglich",
    ideal: "weekly_3_4x",
    idealLabel: "3–4× pro Woche",
    changes: true,
  })
  assert.equal(input.baselineScore, 4)
  assert.deepEqual(input.boundaryTriggers, [])
})

test("seeding flags come from the snapshot profile: texture, scalp oiliness, scalp concerns", () => {
  const base = nomiSource()
  const input = assembleConsultInput(
    {
      ...base,
      model: {
        ...base.model,
        concernProfileFacts: {
          ...base.model.concernProfileFacts!,
          hair_texture: "curly",
          scalp_type: "oily",
        },
        consultFacts: {
          ...base.model.consultFacts!,
          scalpConcerns: ["oily_dandruff", "irritated"],
        },
      },
      quiz: {
        concerns: ["frizz_flyaways", "low_shine", "dry_lengths", "tangling"],
        mainConcern: "frizz_flyaways",
      },
    },
    null,
  )
  for (const flag of [
    "curly_or_coily",
    "oily_scalp",
    "oily_scalp_flakes",
    "irritated_scalp",
    "frizz_concern",
    "shine_concern",
    "dry_lengths_concern",
    "tangling_concern",
  ] as const) {
    assert.ok(input.flags.includes(flag), flag)
  }
  assert.ok(!input.flags.includes("wavy_hair"))
  const ids = input.knowledge.map((entry) => entry.id)
  assert.ok(ids.includes("oily-roots-dry-lengths"))
  assert.ok(!ids.includes("dry-lengths-softness"), "folded into oily-roots-dry-lengths")
  assert.deepEqual(
    input.knowledge.find((entry) => entry.id === "oily-roots-dry-lengths")?.mergedFrom,
    ["dry-lengths-softness"],
  )
  for (const id of [
    "curly-coily-care-basics",
    "oily-scalp-wash-cadence",
    "oily-flakes-antidandruff",
    "irritated-scalp-phrasing",
    "frizz-mechanism",
    "ask-frizz-or-breakage",
    "shine-surface-reflection",
    "colored-oily-scalp-tradeoff",
  ]) {
    assert.ok(ids.includes(id), id)
  }
})

test("unknown texture and scalp facts derive none of the seeding flags", () => {
  const base = nomiSource()
  const input = assembleConsultInput(
    {
      ...base,
      model: {
        ...base.model,
        concernProfileFacts: {
          ...base.model.concernProfileFacts!,
          hair_texture: null,
          scalp_type: null,
        },
        consultFacts: { ...base.model.consultFacts!, scalpConcerns: null },
      },
    },
    null,
  )
  for (const flag of [
    "curly_or_coily",
    "wavy_hair",
    "oily_scalp",
    "oily_scalp_flakes",
    "irritated_scalp",
  ] as const) {
    assert.ok(!input.flags.includes(flag), flag)
  }
})

test("products per entry: name, verdict, decisionKey, bucket — plus swap options and research", () => {
  const input = assembleConsultInput(nomiSource(), null)
  assert.deepEqual(
    input.products.map((product) => ({
      bucket: product.bucket,
      decisionKey: product.decisionKey,
      name: product.name,
      verdict: product.verdict,
    })),
    [
      {
        bucket: "behalten",
        decisionKey: CONDITIONER_KEY,
        name: "Pflegehaus Repair Spülung",
        verdict: "passt",
      },
      {
        bucket: "tauschenOderNeu",
        decisionKey: SHAMPOO_KEY,
        name: "Glanzwerk Volumen Shampoo",
        verdict: "passt_nicht",
      },
      {
        bucket: "tauschenOderNeu",
        decisionKey: BOND_KEY,
        name: "Bindwerk Bond Kur",
        verdict: "neu",
      },
      {
        bucket: "klaeren",
        decisionKey: null,
        name: "Gescanntes Produkt · Glanzöl",
        verdict: "in_recherche",
      },
    ],
  )
  const shampoo = input.products.find((product) => product.decisionKey === SHAMPOO_KEY)!
  assert.deepEqual(shampoo.swapOptions, ["Sanftwerk Mild Shampoo"])
  assert.equal(shampoo.verdictLabel, "Passt nicht")
  assert.ok(shampoo.aliases.includes("Glanzwerk Volumen Shampoo"))
  // The checklist: research open (with her product), score missing, bleach cadence, detangling.
  assert.deepEqual(
    input.checklist.map((item) => item.kind),
    [
      "research_open",
      "score_missing",
      "ask_bleach_cadence",
      "ask_detangling",
      "ask_where_she_shops",
    ],
  )
  assert.equal(input.checklist[0]!.label, "Gescanntes Produkt · Glanzöl")
})

test("no evidence or confidence grade reaches the text context", () => {
  const serialized = JSON.stringify(assembleConsultInput(nomiSource(), { baselineScore: 4 }))
  assert.doesNotMatch(serialized, /"evidence"/)
  assert.doesNotMatch(serialized, /"(strong|moderate|practice|weak)"/)
  assert.doesNotMatch(serialized, /confidence/i)
})

test("hair loss concern or boundary assessment is a G2 trigger", () => {
  const source = nomiSource({
    quiz: { concerns: ["hair_loss_or_thinning"], mainConcern: "hair_loss_or_thinning" },
  })
  const input = assembleConsultInput(source, null)
  assert.deepEqual(input.boundaryTriggers, ["hair_loss_concern"])
  assert.equal(input.mainConcern?.code, "hair_loss_or_thinning")
  assert.ok(input.mainConcern?.boundary)

  const base = nomiSource()
  const assessed = assembleConsultInput(
    {
      ...base,
      model: {
        ...base.model,
        consultFacts: { ...base.model.consultFacts!, hairLossBoundary: true },
      },
    },
    null,
  )
  assert.deepEqual(assessed.boundaryTriggers, ["hair_loss_assessment"])
})

test("without a quiz the concerns come from the plan snapshot; one concern is the main one", () => {
  const base = nomiSource({ quiz: null })
  const input = assembleConsultInput(
    {
      ...base,
      model: {
        ...base.model,
        consultFacts: { ...base.model.consultFacts!, concerns: ["lost_shape"] },
      },
    },
    null,
  )
  assert.deepEqual(input.profile.concerns, ["lost_shape"])
  assert.equal(input.mainConcern?.code, "lost_shape")
  assert.ok(input.knowledge.some((entry) => entry.id === "styling-goal-honesty"))
})

test("a legacy model without the new facts assembles with unknowns, never throws", () => {
  const input = assembleConsultInput(
    {
      view: { steps: [], unassigned: [], intakeProducts: [] },
      model: {},
      quiz: null,
    },
    null,
  )
  assert.equal(input.mainConcern, null)
  assert.deepEqual(input.products, [])
  assert.deepEqual(
    input.knowledge.map((entry) => entry.id),
    ["expectation-windows"],
  )
  assert.deepEqual(input.washFrequency, {
    current: null,
    currentLabel: null,
    ideal: null,
    idealLabel: null,
    changes: false,
  })
})

// --- hash -----------------------------------------------------------------------------------

test("identical inputs hash the same; key order is irrelevant", () => {
  const first = consultSourceHash(assembleConsultInput(nomiSource(), { baselineScore: 4 }))
  const second = consultSourceHash(assembleConsultInput(nomiSource(), { baselineScore: 4 }))
  assert.equal(first, second)
  assert.match(first, /^[0-9a-f]{64}$/)

  const input = assembleConsultInput(nomiSource(), { baselineScore: 4 })
  const reordered = Object.fromEntries(Object.entries(input).reverse()) as typeof input
  assert.equal(consultSourceHash(reordered), first)
})

test("a verdict change, a finished research, a score change each move the hash", () => {
  const base = consultSourceHash(assembleConsultInput(nomiSource(), { baselineScore: 4 }))

  const source = nomiSource()
  const verdictChanged: ConsultInputSource = {
    ...source,
    view: {
      ...source.view,
      steps: source.view.steps.map((entry) =>
        entry.decisionKey === SHAMPOO_KEY
          ? {
              ...entry,
              verdict: inCatalog("ideal", { name: "Volumen Shampoo", brand: "Glanzwerk" }, "Passt"),
            }
          : entry,
      ),
    },
  }
  assert.notEqual(
    consultSourceHash(assembleConsultInput(verdictChanged, { baselineScore: 4 })),
    base,
  )

  const researchDone: ConsultInputSource = {
    ...source,
    view: {
      ...source.view,
      unassigned: [],
      steps: [
        ...source.view.steps,
        step({
          decisionKey: "oil:dry_finish:none",
          category: "oil",
          intakeItemId: "item-oil",
          ownedLabel: "Glanzwerk Glanzöl",
          verdict: inCatalog(
            "supportive",
            { name: "Glanzöl", brand: "Glanzwerk" },
            "Passt mit Einschränkung",
          ),
        }),
      ],
    },
  }
  assert.notEqual(consultSourceHash(assembleConsultInput(researchDone, { baselineScore: 4 })), base)

  assert.notEqual(consultSourceHash(assembleConsultInput(nomiSource(), { baselineScore: 5 })), base)
  assert.notEqual(consultSourceHash(assembleConsultInput(nomiSource(), null)), base)
})
