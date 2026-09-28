import assert from "node:assert/strict"
import test from "node:test"

import { discoveryStepDepth } from "../src/lib/discovery/load-ideal-routine"
import {
  deriveFrequencyDelta,
  deriveStepFrequencyDelta,
  IDEAL_CADENCE_LABELS,
  IDEAL_CADENCE_RULES,
  idealCadenceBand,
  runsheetEntryInHerWeek,
  runsheetWashAnchor,
  runsheetWashFrequency,
  type FrequencyDelta,
} from "../src/lib/discovery/runsheet"
import { frequencyLabel } from "../src/lib/personal-plan/decision-presentation"
import type { PlanCategoryDecision, PlanFrequencyTarget } from "../src/lib/personal-plan/types"
import { PRODUCT_FREQUENCIES } from "../src/lib/vocabulary/frequencies"

/**
 * Frequency-delta chips (verdict-layer T3): the Idealroutine step cadence — the prose
 * `frequencyLabel` (decision-presentation.ts) prints and `buildDiscoveryIdealSteps` puts on
 * every cockpit step — mapped to a weekly band, anchored at her wash frequency, and compared
 * with how often she uses the product (intake).
 */

// --- totality over the REAL cadence strings -----------------------------------------------

/**
 * Every `PlanFrequencyTarget` variant, keyed by kind: a new kind fails the typecheck here,
 * and a new label it produces fails the set-equality test below.
 */
const FREQUENCY_TARGETS: Record<PlanFrequencyTarget["kind"], PlanFrequencyTarget[]> = {
  wet_wash_total: PRODUCT_FREQUENCIES.map((target) => ({
    kind: "wet_wash_total" as const,
    mode: "quiz_starting_target" as const,
    target,
    allowedRange: { min: target, max: target },
    specialWashSubstitution: true as const,
  })),
  after_each_eligible_wash: [
    {
      kind: "after_each_eligible_wash",
      roles: ["conditioner_rinse_out"],
      dependsOn: "wet_wash_total",
      placementState: "known",
    },
  ],
  event_based: [
    {
      kind: "event_based",
      role: "pre_heat_protection",
      eventRoutes: ["direct_contact_heat"],
      occurrence: "before_every_qualifying_event",
    },
  ],
  every_nth_wash: ([3, 4] as const).map((every) => ({
    kind: "every_nth_wash" as const,
    roles: ["residue_reset" as const],
    every,
    substitutesRegularShampoo: true as const,
  })),
  unscheduled_as_needed: [
    {
      kind: "unscheduled_as_needed",
      roles: ["residue_reset"],
      boundary: "bei_bedarf",
    },
  ],
  mask_regular_interval: (["weekly_1x", "biweekly_1x", "every_3_weeks"] as const).map(
    (baseInterval) => ({
      kind: "mask_regular_interval" as const,
      role: "intensive_conditioning_mask" as const,
      needStrength: "standard" as const,
      baseInterval,
      placementState: "placed_on_eligible_wash" as const,
    }),
  ),
  role_based_wash_linked: [{ kind: "role_based_wash_linked", roleFrequencies: [] }],
  product_protocol_course: [
    { kind: "product_protocol_course", role: "specialized_bond_treatment" },
  ],
  role_keyed_product_protocol: [{ kind: "role_keyed_product_protocol", roleFrequencies: [] }],
}

const ALL_TARGETS: Array<PlanFrequencyTarget | null> = [
  null,
  ...Object.values(FREQUENCY_TARGETS).flat(),
]

test("the exported cadence list is exactly what the Idealroutine prints for an active step", () => {
  const printed = new Set(ALL_TARGETS.map((target) => frequencyLabel(target, false)))
  assert.deepEqual([...printed].sort(), [...IDEAL_CADENCE_LABELS].sort())
})

test("totality: every real cadence string carries an explicit mapping decision", () => {
  for (const label of IDEAL_CADENCE_LABELS) {
    const rule = IDEAL_CADENCE_RULES[label]
    assert.ok(rule, `no mapping decision for „${label}“`)
    assert.ok(["fixed", "per_wash", "no_band"].includes(rule.kind), label)
  }
  assert.equal(Object.keys(IDEAL_CADENCE_RULES).length, IDEAL_CADENCE_LABELS.length)
})

test("a paused step („später: …“) never gets a band, for every real paused string", () => {
  for (const target of ALL_TARGETS) {
    const label = frequencyLabel(target, true)
    assert.ok(label.startsWith("später: "), label)
    assert.equal(idealCadenceBand(label, "weekly_3_4x"), null, label)
  }
})

test("the mapping table, form by form", () => {
  const wash = "weekly_3_4x" as const
  const cases: Array<[string, { min: number | null; max: number | null } | null]> = [
    ["Seltener als 1×/Monat", { min: 0, max: 0.249 }],
    ["Ca. 1×/Monat", { min: 0.25, max: 0.25 }],
    ["Ca. alle 2 Wochen", { min: 0.5, max: 0.5 }],
    ["1×/Woche", { min: 1, max: 1 }],
    ["2×/Woche", { min: 2, max: 2 }],
    ["3-4×/Woche", { min: 3, max: 4 }],
    ["5-6×/Woche", { min: 5, max: 6 }],
    ["Täglich", { min: 7, max: 7 }],
    ["nach jeder Haarwäsche", { min: 3, max: 4 }],
    ["jede 3. Haarwäsche", { min: 1, max: 4 / 3 }],
    ["jede 4. Haarwäsche", { min: 0.75, max: 1 }],
    ["1× pro Woche", { min: 1, max: 1 }],
    ["etwa alle 2 Wochen", { min: 0.5, max: 0.5 }],
    ["etwa alle 3 Wochen", { min: 0.25, max: 0.5 }],
    ["vor jeder passenden Hitze-Anwendung", null],
    ["bei Bedarf", null],
    ["nach Bedarf", null],
    ["nach Herstellerangabe", null],
    ["wird im nächsten Schritt verfeinert", null],
  ]
  assert.equal(cases.length, IDEAL_CADENCE_LABELS.length)
  for (const [label, band] of cases) {
    assert.deepEqual(idealCadenceBand(label, wash), band, label)
  }
})

test("wash-anchored cadences have no band without a known wash frequency", () => {
  for (const label of ["nach jeder Haarwäsche", "jede 3. Haarwäsche", "jede 4. Haarwäsche"]) {
    assert.equal(idealCadenceBand(label, null), null, label)
  }
  // Fixed bands do not need the anchor.
  assert.deepEqual(idealCadenceBand("1× pro Woche", null), { min: 1, max: 1 })
})

test("a string the Idealroutine never prints gets no band (no guessing)", () => {
  for (const label of ["", "2× / Woche", "nach jeder Wäsche", "vor jeder Haarwäsche", "täglich"]) {
    assert.equal(idealCadenceBand(label, "weekly_2x"), null, label)
  }
})

// --- the delta ------------------------------------------------------------------------------

function delta(
  cadenceLabel: string,
  frequency: string | null | undefined,
  washFrequency: Parameters<typeof deriveFrequencyDelta>[0]["washFrequency"] = "weekly_2x",
): FrequencyDelta | null {
  return deriveFrequencyDelta({ cadenceLabel, frequency, washFrequency })
}

test("no chip without her frequency: not asked, missing, „Weiß ich nicht“, garbage", () => {
  assert.equal(delta("1× pro Woche", null), null)
  assert.equal(delta("1× pro Woche", undefined), null)
  assert.equal(delta("1× pro Woche", "unknown"), null)
  assert.equal(delta("1× pro Woche", "sometimes"), null)
})

test("no chip without a band: as needed, per manufacturer, heat-bound, unrefined, paused", () => {
  for (const label of [
    "nach Bedarf",
    "bei Bedarf",
    "nach Herstellerangabe",
    "vor jeder passenden Hitze-Anwendung",
    "wird im nächsten Schritt verfeinert",
    "später: 1× pro Woche",
  ]) {
    assert.equal(delta(label, "weekly_1x"), null, label)
  }
})

test("wash anchor: „nach jeder Haarwäsche“ at a 2×/week wash, product 1×/week → zu selten", () => {
  assert.deepEqual(delta("nach jeder Haarwäsche", "weekly_1x", "weekly_2x"), {
    status: "zu_selten",
    ideal: { min: 2, max: 2 },
    actual: 1,
  })
  assert.equal(delta("nach jeder Haarwäsche", "weekly_2x", "weekly_2x")?.status, "passt")
  assert.equal(delta("nach jeder Haarwäsche", "weekly_3_4x", "weekly_2x")?.status, "zu_oft")
  // No wash frequency known → no anchor → no chip.
  assert.equal(delta("nach jeder Haarwäsche", "weekly_1x", null), null)
})

test("boundaries: actual on min or max passes, just outside does not", () => {
  // Band 3–4 (wash 3–4×): her 3–4× (midpoint 3,5) passes.
  assert.equal(delta("nach jeder Haarwäsche", "weekly_3_4x", "weekly_3_4x")?.status, "passt")
  // Band 1–1,33 (every 3rd of 3–4 washes): 1×/week sits on min → passt.
  assert.equal(delta("jede 3. Haarwäsche", "weekly_1x", "weekly_3_4x")?.status, "passt")
  // Band 0,75–1 (every 4th of 3–4 washes): 1×/week sits on max → passt; 2× → zu oft.
  assert.equal(delta("jede 4. Haarwäsche", "weekly_1x", "weekly_3_4x")?.status, "passt")
  assert.equal(delta("jede 4. Haarwäsche", "weekly_2x", "weekly_3_4x")?.status, "zu_oft")
  assert.equal(delta("jede 4. Haarwäsche", "biweekly_1x", "weekly_3_4x")?.status, "zu_selten")
  // „etwa alle 3 Wochen“ accepts both neighbouring answers.
  assert.equal(delta("etwa alle 3 Wochen", "monthly_1x")?.status, "passt")
  assert.equal(delta("etwa alle 3 Wochen", "biweekly_1x")?.status, "passt")
  assert.equal(delta("etwa alle 3 Wochen", "weekly_1x")?.status, "zu_oft")
  assert.equal(delta("etwa alle 3 Wochen", "less_than_monthly")?.status, "zu_selten")
})

test("fixed bands: mask 1×/week, shampoo target 2×/week", () => {
  assert.deepEqual(delta("1× pro Woche", "weekly_2x"), {
    status: "zu_oft",
    ideal: { min: 1, max: 1 },
    actual: 2,
  })
  assert.equal(delta("1× pro Woche", "biweekly_1x")?.status, "zu_selten")
  assert.equal(delta("1× pro Woche", "weekly_1x")?.status, "passt")
  assert.equal(delta("2×/Woche", "weekly_3_4x")?.status, "zu_oft")
  assert.equal(delta("Täglich", "daily_1x")?.status, "passt")
  assert.equal(delta("Seltener als 1×/Monat", "less_than_monthly")?.status, "passt")
})

test("half-open bands compare on the closed side only", async () => {
  const { compareFrequencyToBand } = await import("../src/lib/discovery/runsheet/frequency")
  assert.equal(compareFrequencyToBand(9, { min: 2, max: null }), "passt")
  assert.equal(compareFrequencyToBand(1, { min: 2, max: null }), "zu_selten")
  assert.equal(compareFrequencyToBand(0, { min: null, max: 1 }), "passt")
  assert.equal(compareFrequencyToBand(2, { min: null, max: 1 }), "zu_oft")
})

// --- the wash anchor from the intake --------------------------------------------------------

test("her wash frequency is her most frequent known shampoo frequency", () => {
  assert.equal(
    runsheetWashFrequency([
      { category: "shampoo", frequency: "weekly_2x" },
      { category: "conditioner", frequency: "daily_1x" },
      { category: "shampoo", frequency: "weekly_3_4x" },
      { category: "shampoo", frequency: "unknown" },
    ]),
    "weekly_3_4x",
  )
  assert.equal(runsheetWashFrequency([{ category: "shampoo", frequency: "unknown" }]), null)
  assert.equal(runsheetWashFrequency([{ category: "shampoo", frequency: null }]), null)
  assert.equal(runsheetWashFrequency([]), null)
})

// --- fix round 1: step granularity (sum) and the engine's allowed wash range ---------------

test("step sum: two 1×/week shampoos against a 2×/week band read as one „passt“", () => {
  assert.deepEqual(
    deriveStepFrequencyDelta({
      cadenceLabel: "2×/Woche",
      frequencies: ["weekly_1x", "weekly_1x"],
      washFrequency: "weekly_1x",
    }),
    { status: "passt", ideal: { min: 2, max: 2 }, actual: 2 },
  )
})

test("step sum: any owned entry without a known frequency → no chip for the step", () => {
  for (const other of ["unknown", null, undefined]) {
    assert.equal(
      deriveStepFrequencyDelta({
        cadenceLabel: "2×/Woche",
        frequencies: ["weekly_1x", other],
        washFrequency: "weekly_2x",
      }),
      null,
      String(other),
    )
  }
  assert.equal(
    deriveStepFrequencyDelta({ cadenceLabel: "2×/Woche", frequencies: [], washFrequency: null }),
    null,
  )
})

test("step sum: a single entry is the single-product delta", () => {
  assert.deepEqual(
    deriveStepFrequencyDelta({
      cadenceLabel: "nach jeder Haarwäsche",
      frequencies: ["weekly_1x"],
      washFrequency: "weekly_2x",
    }),
    delta("nach jeder Haarwäsche", "weekly_1x", "weekly_2x"),
  )
})

const OILY_RANGE = { min: "weekly_2x", max: "weekly_5_6x" } as const

test("wash target: the engine's allowed range is the band, not the printed target bucket", () => {
  assert.deepEqual(idealCadenceBand("3-4×/Woche", null, OILY_RANGE), { min: 2, max: 6 })
  // Oily route, target 3–4×, she washes 2× → inside the engine's tolerance.
  assert.equal(
    deriveFrequencyDelta({
      cadenceLabel: "3-4×/Woche",
      frequency: "weekly_2x",
      washFrequency: "weekly_2x",
      allowedRange: OILY_RANGE,
    })?.status,
    "passt",
  )
  assert.equal(
    deriveFrequencyDelta({
      cadenceLabel: "3-4×/Woche",
      frequency: "daily_1x",
      washFrequency: "daily_1x",
      allowedRange: OILY_RANGE,
    })?.status,
    "zu_oft",
  )
  // Without the range the target bucket stays the band.
  assert.equal(delta("3-4×/Woche", "weekly_2x")?.status, "zu_selten")
})

test("wash target: the range never creates a band where the label has none", () => {
  for (const label of [
    "später: 3-4×/Woche",
    "wird im nächsten Schritt verfeinert",
    "nach Bedarf",
  ]) {
    assert.equal(idealCadenceBand(label, "weekly_2x", OILY_RANGE), null, label)
  }
})

test("the step depth carries the shampoo decision's allowed range — and only for wet_wash_total", () => {
  const shampoo = {
    category: "shampoo",
    frequency: {
      kind: "wet_wash_total",
      mode: "nearest_boundary",
      target: "weekly_3_4x",
      allowedRange: OILY_RANGE,
      specialWashSubstitution: true,
    },
    target: null,
  } as unknown as PlanCategoryDecision
  assert.deepEqual(discoveryStepDepth(shampoo, "shampoo_everyday").washAllowedRange, OILY_RANGE)
  const mask = {
    category: "mask",
    frequency: FREQUENCY_TARGETS.mask_regular_interval[0],
    target: null,
  } as unknown as PlanCategoryDecision
  assert.equal("washAllowedRange" in discoveryStepDepth(mask, "intensive_conditioning_mask"), false)
})

// --- fix round 2: one ownership rule for both phases ----------------------------------------

test("in her week: kept (with intake row) and undecided count; dropped, swapped, ideal do not", () => {
  const entry = (
    outcome: Parameters<typeof runsheetEntryInHerWeek>[0]["outcome"],
    intakeItemId: string | null = "item-1",
    ownedLabel: string | null = "Sebamed",
  ) => runsheetEntryInHerWeek({ outcome, intakeItemId, ownedLabel })
  assert.equal(entry("kept"), true)
  assert.equal(entry("undecided"), true)
  assert.equal(entry("dropped"), false)
  assert.equal(entry("swapped"), false)
  assert.equal(entry("ideal"), false)
  // No intake row or no label → nothing of hers to put into the week.
  assert.equal(entry("kept", null), false)
  assert.equal(entry("kept", "item-1", null), false)
  assert.equal(entry("undecided", "item-1", null), false)
})

// --- fix wave (P2): the wash anchor is an honest range over her shampoos -------------------

function shampooEntry(
  ownedFrequency: string | null,
  outcome: "kept" | "undecided" | "dropped" | "swapped" = "undecided",
  category = "shampoo",
) {
  return {
    category,
    outcome,
    intakeItemId: "item",
    ownedLabel: "Shampoo",
    ownedFrequency,
  } as Parameters<typeof runsheetWashAnchor>[0][number]
}

test("wash anchor: one shampoo → both ends are its own band (unchanged behaviour)", () => {
  const anchor = runsheetWashAnchor([shampooEntry("weekly_3_4x")])
  assert.deepEqual(anchor, { single: { min: 3, max: 4 }, combined: { min: 3, max: 4 } })
  for (const [label, frequency] of [
    ["nach jeder Haarwäsche", "weekly_1x"],
    ["nach jeder Haarwäsche", "weekly_3_4x"],
    ["jede 3. Haarwäsche", "weekly_1x"],
    ["1× pro Woche", "weekly_2x"],
  ] as const) {
    assert.deepEqual(
      deriveFrequencyDelta({ cadenceLabel: label, frequency, washFrequency: anchor }),
      delta(label, frequency, "weekly_3_4x"),
      label,
    )
  }
})

test("wash anchor: two shampoos → [most frequent one, sum]; dropped/swapped/other categories ignored", () => {
  assert.deepEqual(
    runsheetWashAnchor([
      shampooEntry("weekly_1x"),
      shampooEntry("weekly_1x", "kept"),
      shampooEntry("daily_1x", "dropped"),
      shampooEntry("daily_1x", "swapped"),
      shampooEntry("daily_1x", "undecided", "conditioner"),
    ]),
    { single: { min: 1, max: 1 }, combined: { min: 2, max: 2 } },
  )
  assert.deepEqual(runsheetWashAnchor([shampooEntry("weekly_1x"), shampooEntry("weekly_3_4x")]), {
    single: { min: 3, max: 4 },
    combined: { min: 4, max: 5 },
  })
})

test("wash anchor: no in-week shampoo, or one without a known frequency → no anchor", () => {
  assert.equal(runsheetWashAnchor([]), null)
  assert.equal(runsheetWashAnchor([shampooEntry("weekly_1x", "dropped")]), null)
  assert.equal(runsheetWashAnchor([shampooEntry("weekly_1x"), shampooEntry("unknown")]), null)
  assert.equal(runsheetWashAnchor([shampooEntry("weekly_1x"), shampooEntry(null)]), null)
})

test("wash anchor: the ends disagree → no chip (the false „passt“ of two 1× shampoos)", () => {
  const anchor = runsheetWashAnchor([shampooEntry("weekly_1x"), shampooEntry("weekly_1x")])
  // Same days: 1 wash/week → „passt“; separate days: 2 washes/week → „zu selten“.
  assert.equal(
    deriveFrequencyDelta({
      cadenceLabel: "nach jeder Haarwäsche",
      frequency: "weekly_1x",
      washFrequency: anchor,
    }),
    null,
  )
})

test("wash anchor: both ends agree → a chip on the union band", () => {
  const anchor = runsheetWashAnchor([shampooEntry("weekly_1x"), shampooEntry("weekly_1x")])
  assert.deepEqual(
    deriveFrequencyDelta({
      cadenceLabel: "nach jeder Haarwäsche",
      frequency: "weekly_3_4x",
      washFrequency: anchor,
    }),
    { status: "zu_oft", ideal: { min: 1, max: 2 }, actual: 3.5 },
  )
  // A fixed band does not depend on the anchor at all.
  assert.equal(
    deriveFrequencyDelta({
      cadenceLabel: "1× pro Woche",
      frequency: "weekly_1x",
      washFrequency: anchor,
    })?.status,
    "passt",
  )
})
