import assert from "node:assert/strict"
import test from "node:test"

import {
  DISCOVERY_ROUTINE_DAY_TITLES,
  composeDiscoveryRoutineDays,
  type DiscoveryRoutineDayItem,
} from "../src/lib/discovery/routine-days"

/**
 * Batch 7 (plan §2.1 item 4, prototype round 6 `routineGroups`): „Deine Routine" composes her
 * products into day cards — Waschtag, Intensiv-Pflegetag, Tag ohne Wäsche, Styling, Weitere, in
 * that order. Batch 8 (plan `plans/discovery-b8-motion-days/plan.md` Part A): Waschtag and Tag
 * ohne Wäsche always show (empty too); the rest only with products. Pure and client-safe.
 */

let counter = 0
function item(overrides: Partial<DiscoveryRoutineDayItem>): DiscoveryRoutineDayItem {
  counter += 1
  return {
    id: `i${counter}`,
    source: "catalog_search",
    category: "shampoo",
    usageRole: null,
    productType: null,
    frequency: null,
    ...overrides,
  }
}

function shape(days: ReturnType<typeof composeDiscoveryRoutineDays>) {
  return days.map((day) => [day.kind, day.title, day.cadenceLabel, day.items.map((i) => i.id)])
}

test("the day titles are the participant's own labels", () => {
  assert.deepEqual(DISCOVERY_ROUTINE_DAY_TITLES, {
    wash_day: "Waschtag",
    intensive_day: "Intensiv-Pflegetag",
    no_wash_day: "Tag ohne Wäsche",
    styling: "Styling",
    other: "Weitere",
  })
})

test("an empty intake composes the two default days, both empty; „none“ rows never appear", () => {
  const defaults = [
    ["wash_day", "Waschtag", null, []],
    ["no_wash_day", "Tag ohne Wäsche", null, []],
  ]
  assert.deepEqual(shape(composeDiscoveryRoutineDays([])), defaults)
  assert.deepEqual(
    shape(composeDiscoveryRoutineDays([item({ source: "none", category: "mask" })])),
    defaults,
  )
})

test("every category lands on its day, in the card's own order; optional days only with products", () => {
  const mask = item({ id: "mask", category: "mask", frequency: "weekly_1x" })
  const shampoo = item({ id: "shampoo", category: "shampoo", frequency: "weekly_3_4x" })
  const leaveIn = item({ id: "leave_in", category: "leave_in", frequency: "weekly_3_4x" })
  const conditioner = item({ id: "conditioner", category: "conditioner" })
  const dampOil = item({
    id: "damp_oil",
    category: "oil",
    usageRole: "leave_on_fibre_conditioning",
  })
  const preWashOil = item({ id: "pre_oil", category: "oil", usageRole: "pre_wash_fibre_treatment" })
  const preWashConditioner = item({
    id: "pre_cond",
    category: "conditioner",
    usageRole: "pre_wash_conditioner",
  })
  const bond = item({ id: "bond", category: "bondbuilder", frequency: "biweekly_1x" })
  const deep = item({ id: "deep", category: "deep_cleansing_shampoo" })
  const dry = item({ id: "dry", category: "dry_shampoo" })
  const finish = item({ id: "finish", category: "oil", usageRole: "dry_finish" })
  const scalp = item({ id: "scalp", category: "scalp_care", usageRole: "scalp_flake_oil_adjunct" })
  const heat = item({ id: "heat", category: "heat_protectant" })

  assert.deepEqual(
    shape(
      composeDiscoveryRoutineDays([
        mask,
        heat,
        finish,
        leaveIn,
        dampOil,
        conditioner,
        shampoo,
        bond,
        deep,
        preWashOil,
        preWashConditioner,
        dry,
        scalp,
      ]),
    ),
    [
      [
        "wash_day",
        "Waschtag",
        "3–4× pro Woche",
        ["shampoo", "conditioner", "leave_in", "damp_oil"],
      ],
      [
        "intensive_day",
        "Intensiv-Pflegetag",
        "1× pro Woche",
        ["pre_oil", "pre_cond", "deep", "bond", "mask"],
      ],
      ["no_wash_day", "Tag ohne Wäsche", null, ["finish", "dry", "scalp"]],
      ["styling", "Styling", null, ["heat"]],
    ],
  )
})

test("Waschtag cadence = the MOST frequent shampoo; unknown or unasked → no cadence", () => {
  const days = composeDiscoveryRoutineDays([
    item({ id: "a", category: "shampoo", frequency: "weekly_2x" }),
    item({ id: "b", category: "shampoo", frequency: "daily_1x" }),
    item({ id: "c", category: "shampoo", frequency: "unknown" }),
    // A conditioner's frequency never sets the Waschtag cadence.
    item({ id: "d", category: "conditioner", frequency: "daily_1x" }),
  ])
  assert.equal(days[0].cadence, "daily_1x")
  assert.equal(days[0].cadenceLabel, "Täglich")

  const open = composeDiscoveryRoutineDays([
    item({ category: "shampoo", frequency: "unknown" }),
    item({ category: "conditioner", frequency: "weekly_2x" }),
  ])
  assert.equal(open[0].cadence, null)
  assert.equal(open[0].cadenceLabel, null)

  // No shampoo at all: the Waschtag still shows her conditioner, cadence open (asked in the call).
  const noShampoo = composeDiscoveryRoutineDays([
    item({ category: "leave_in", frequency: "weekly_1x" }),
  ])
  assert.deepEqual(shape(noShampoo), [
    ["wash_day", "Waschtag", null, [noShampoo[0].items[0].id]],
    ["no_wash_day", "Tag ohne Wäsche", null, []],
  ])
})

test("Intensiv-Pflegetag cadence = the most frequent mask or bondbuilder", () => {
  const days = composeDiscoveryRoutineDays([
    item({ category: "oil", usageRole: "pre_wash_fibre_treatment", frequency: "daily_1x" }),
    item({ category: "mask", frequency: "monthly_1x" }),
    item({ category: "bondbuilder", frequency: "biweekly_1x" }),
  ])
  const intensive = days.find((day) => day.kind === "intensive_day")
  assert.equal(intensive?.cadence, "biweekly_1x")
  assert.equal(intensive?.cadenceLabel, "Alle 2 Wochen")
})

test("„Kategorie offen“ lands in „Weitere“; a styling product on the Styling card", () => {
  const open = item({ id: "open", category: null })
  const spray = item({ id: "spray", category: null, productType: "styling" })
  const heat = item({ id: "heat", category: "heat_protectant" })
  assert.deepEqual(shape(composeDiscoveryRoutineDays([open, spray, heat])), [
    ["wash_day", "Waschtag", null, []],
    ["no_wash_day", "Tag ohne Wäsche", null, []],
    ["styling", "Styling", null, ["spray", "heat"]],
    ["other", "Weitere", null, ["open"]],
  ])
})

test("a legacy role-less oil sits on Tag ohne Wäsche; items keep their own objects", () => {
  const oil = item({ id: "oil", category: "oil", usageRole: null })
  const days = composeDiscoveryRoutineDays([oil])
  const noWash = days.find((day) => day.kind === "no_wash_day")
  assert.equal(noWash?.items[0], oil)
  assert.equal(noWash?.cadence, null)
  assert.equal(noWash?.cadenceLabel, null)
})

test("leave-in also on Tag ohne Wäsche only when used MORE often than her most frequent shampoo", () => {
  const cases: Array<{
    name: string
    shampoos: Array<string | null>
    leaveIn: string | null
    both: boolean
  }> = [
    { name: "daily vs shampoo 2×", shampoos: ["weekly_2x"], leaveIn: "daily_1x", both: true },
    { name: "5–6× vs shampoo 3–4×", shampoos: ["weekly_3_4x"], leaveIn: "weekly_5_6x", both: true },
    {
      name: "equal to the shampoo",
      shampoos: ["weekly_3_4x"],
      leaveIn: "weekly_3_4x",
      both: false,
    },
    {
      name: "less often than the shampoo",
      shampoos: ["daily_1x"],
      leaveIn: "weekly_2x",
      both: false,
    },
    {
      name: "compared with her MOST frequent shampoo",
      shampoos: ["weekly_1x", "daily_1x"],
      leaveIn: "weekly_5_6x",
      both: false,
    },
    { name: "leave-in „Weiß ich nicht“", shampoos: ["weekly_1x"], leaveIn: "unknown", both: false },
    { name: "leave-in not asked", shampoos: ["weekly_1x"], leaveIn: null, both: false },
    { name: "shampoo „Weiß ich nicht“", shampoos: ["unknown"], leaveIn: "daily_1x", both: false },
    { name: "shampoo not asked", shampoos: [null], leaveIn: "daily_1x", both: false },
    { name: "no shampoo at all", shampoos: [], leaveIn: "daily_1x", both: false },
  ]
  for (const entry of cases) {
    const leaveIn = item({
      id: "leave_in",
      category: "leave_in",
      frequency: entry.leaveIn as never,
    })
    const days = composeDiscoveryRoutineDays([
      ...entry.shampoos.map((frequency) =>
        item({ category: "shampoo", frequency: frequency as never }),
      ),
      leaveIn,
    ])
    const washDay = days.find((day) => day.kind === "wash_day")
    const noWash = days.find((day) => day.kind === "no_wash_day")
    assert.ok(washDay?.items.includes(leaveIn), `${entry.name}: always on the Waschtag`)
    assert.equal(noWash?.items.includes(leaveIn), entry.both, entry.name)
  }
})

test("the leave-in joins Tag ohne Wäsche in capture order, next to its own products", () => {
  const dry = item({ id: "dry", category: "dry_shampoo" })
  const leaveIn = item({ id: "leave_in", category: "leave_in", frequency: "daily_1x" })
  const shampoo = item({ id: "shampoo", category: "shampoo", frequency: "weekly_2x" })
  const finish = item({ id: "finish", category: "oil", usageRole: "dry_finish" })
  assert.deepEqual(shape(composeDiscoveryRoutineDays([dry, leaveIn, shampoo, finish])), [
    ["wash_day", "Waschtag", "2× pro Woche", ["shampoo", "leave_in"]],
    ["no_wash_day", "Tag ohne Wäsche", null, ["dry", "leave_in", "finish"]],
  ])
})
