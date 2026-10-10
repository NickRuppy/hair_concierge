import assert from "node:assert/strict"
import test from "node:test"
import { renderToStaticMarkup } from "react-dom/server"

import { ApplicationDay } from "@/components/application/application-day"
import type { ApplicationDayView } from "@/components/application/application-types"
import { toApplicationPageView } from "@/components/application/application-view-adapter"
import { projectToolsForDay } from "@/lib/personal-plan/tools/application"

import { lenaToolView, type LenaOptions } from "./personal-plan/tools-lena-fixture"

/**
 * The rendered Waschtag, ordered by the engine's day graph (`D7`) and built the way the
 * Anwendung page builds it: `buildToolView(...).applicationGuidance` straight into the real
 * view adapter (`projectToolsForDay` per day). Lena's tools are the engine's own output for
 * her answers — nothing here hand-places a tool.
 */

type Block = {
  applicationInstanceKey: string
  productId: string
  productName: string
  imageUrl: null
  category: string
  roles: string[]
  anchor: string
  steps: Array<{ stepKey: string; copyDe: string }>
  noteDe: null
  status: "confirmed"
}

function block(
  key: string,
  name: string,
  roles: string[],
  category: string,
  anchor: string,
): Block {
  return {
    applicationInstanceKey: key,
    productId: `product-${key}`,
    productName: name,
    imageUrl: null,
    category,
    roles,
    anchor,
    steps: [{ stepKey: `${key}:1`, copyDe: "Auftragen." }],
    noteDe: null,
    status: "confirmed",
  }
}

const SHAMPOO = block("shampoo", "Mildes Shampoo", ["cleanse"], "shampoo", "wet_cleanse")
const SCALP = block("scalp", "Kopfhaut-Serum", ["scalp_care"], "scalp_care", "wet_cleanse")
const CONDITIONER = block(
  "conditioner",
  "Leichter Conditioner",
  ["condition"],
  "conditioner",
  "post_cleanse_rinse_off",
)
const LEAVE_IN = block("leave-in", "Leave-in", ["leave_in"], "leave_in", "damp_leave_on")
const HEAT_PROTECTION = block(
  "heat-protection",
  "Hitzeschutz-Spray",
  ["heat_protection"],
  "heat_protectant",
  "dry_pre_heat",
)
const FINISH_OIL = block("oil", "Finish-Öl", ["finish"], "oil", "dry_finish")

const TOWEL_TRANSITION_COPY_DE = "Sanft mit einem Handtuch ausdrücken."

type OuterEntry =
  | { kind: "product"; block: Block }
  | { kind: "state_transition"; fromAnchor: string; toAnchor: string; copyDe: string }

function product(entry: Block): OuterEntry {
  return { kind: "product", block: entry }
}

/** The compiler's own generic towel line sits between the conditioner and the Leave-in. */
const TOWEL_TRANSITION: OuterEntry = {
  kind: "state_transition",
  fromAnchor: "post_cleanse_rinse_off",
  toAnchor: "post_rinse_towel_dry",
  copyDe: TOWEL_TRANSITION_COPY_DE,
}

const COMPILED_DAY_ORDER = {
  withoutScalp: [
    product(SHAMPOO),
    product(CONDITIONER),
    TOWEL_TRANSITION,
    product(LEAVE_IN),
    product(HEAT_PROTECTION),
    product(FINISH_OIL),
  ],
  withScalp: [
    product(SHAMPOO),
    product(SCALP),
    product(CONDITIONER),
    TOWEL_TRANSITION,
    product(LEAVE_IN),
    product(HEAT_PROTECTION),
    product(FINISH_OIL),
  ],
}

function renderWashDay(options: LenaOptions = {}, withTools = true) {
  const outerSequence = options.scalpJob
    ? COMPILED_DAY_ORDER.withScalp
    : COMPILED_DAY_ORDER.withoutScalp
  const productBlocks = outerSequence.flatMap((entry) =>
    entry.kind === "product" ? [entry.block] : [],
  )
  const view = toApplicationPageView({
    compiled: {
      days: [
        { key: "wash_day", outerSequence, productBlocks },
        { key: "rest_day", outerSequence: [], productBlocks: [] },
      ],
    } as never,
    dayDefinitions: [
      { key: "wash_day", label: "Waschtag", summary: "", sortOrder: 10 },
      { key: "rest_day", label: "Pausentag", summary: "", sortOrder: 80 },
    ] as never,
    ...(withTools ? { tools: lenaToolView(options).applicationGuidance } : {}),
  })
  assert.equal(view.state, "ready")
  if (view.state !== "ready") throw new Error("unreachable")
  const day = view.days.find((candidate) => candidate.dayType === "wash_day")
  if (!day) throw new Error("missing wash_day")
  return {
    day,
    order: day.steps.map((step) =>
      step.kind === "tool_use"
        ? `tool:${step.assetKey}`
        : step.kind === "transition"
          ? `line:${step.stepKey}`
          : `step:${step.stepKey}`,
    ),
  }
}

const TOWEL = "tool:asset:drying_textiles:microfiber_towel"
const COMB = "tool:asset:brushes_combs:wide_tooth_comb"
const DRYER = "tool:asset:airflow:hair_dryer"
const IRON = "tool:asset:heated_styling:flat_iron"
const PILLOWCASE = "tool:asset:night_protection:pillowcase"
const APPLICATOR = "tool:asset:wash_application:applicator_bottle"

test("Lena's Waschtag: the towel comes after the conditioner and before Leave-in and Hitzeschutz", () => {
  const { order } = renderWashDay()
  const towelAt = order.indexOf(TOWEL)
  assert.ok(towelAt >= 0, "the towel step renders")
  assert.ok(order.indexOf("step:conditioner") < towelAt)
  assert.ok(towelAt < order.indexOf("step:leave-in"), "towel before the Leave-in")
  assert.ok(towelAt < order.indexOf("step:heat-protection"), "towel before heat protection")
  assert.ok(order.indexOf(COMB) < order.indexOf("step:leave-in"), "detangling is a wet-hair step")
})

test("Lena's Waschtag: Hitzeschutz comes before every heated step, styling before the finish, night last", () => {
  const { order } = renderWashDay()
  const heatProtectionAt = order.indexOf("step:heat-protection")
  assert.ok(heatProtectionAt >= 0 && order.indexOf(IRON) >= 0)
  assert.ok(heatProtectionAt < order.indexOf(DRYER), "protect before the dryer")
  assert.ok(order.indexOf(DRYER) < order.indexOf(IRON), "pre-drying before the iron")
  assert.ok(order.indexOf(IRON) < order.indexOf("step:oil"), "styling before the finishing product")
  assert.equal(order.indexOf(PILLOWCASE), order.length - 1, "the night step stays last")
})

test("the Applikator renders BEFORE its scalp product and the shampoo (ready-check ruling)", () => {
  const { order } = renderWashDay({ scalpJob: true })
  const applicatorAt = order.indexOf(APPLICATOR)
  assert.ok(applicatorAt >= 0, "a scalp job with an application step brings the Applikator")
  assert.ok(applicatorAt < order.indexOf("step:scalp"), "pick up the tool, then apply the product")
  assert.ok(applicatorAt < order.indexOf("step:shampoo"))
})

test("the rough-rubbing correction merges into the towel card when both would render", () => {
  // Frottee + rough rubbing: the engine offers a microfiber towel card AND the firm correction.
  const withCard = renderWashDay({ towelMaterial: "frottee", towelTechnique: "rough_rubbing" })
  assert.ok(withCard.order.includes(TOWEL), "the towel card renders")
  assert.equal(
    withCard.order.some((id) => id.includes("gentle_towel_handling")),
    false,
    "one towel line only when the card renders",
  )
  // Microfiber owned + rough rubbing: no card, so the firm correction survives on its own.
  const withoutCard = renderWashDay({ towelTechnique: "rough_rubbing" })
  assert.equal(withoutCard.order.includes(TOWEL), false)
  assert.equal(
    withoutCard.order.some((id) => id.includes("gentle_towel_handling")),
    true,
    "the firm correction survives without a towel card",
  )
  const correctionAt = withoutCard.order.findIndex((id) => id.includes("gentle_towel_handling"))
  assert.ok(withoutCard.order.indexOf("step:conditioner") < correctionAt)
  assert.ok(correctionAt < withoutCard.order.indexOf("step:leave-in"))
})

test("the towel card replaces the compiler's generic towel line, nothing else does", () => {
  const genericLines = (order: string[]) => order.filter((id) => id.includes(":transition:"))
  // Without Tools the compiler's line is rendered exactly as compiled.
  assert.equal(genericLines(renderWashDay({}, false).order).length, 1)
  // A towel card at the same graph position makes the Tool step the single instruction.
  assert.equal(genericLines(renderWashDay().order).length, 0)
  // A correction line (no card) is not a drying-textile Tool step: the compiler's line stays.
  assert.equal(genericLines(renderWashDay({ towelTechnique: "rough_rubbing" }).order).length, 1)
})

test("without Tools the Waschtag is exactly the compiled day", () => {
  const { day, order } = renderWashDay({}, false)
  assert.deepEqual(
    order.filter((id) => id.startsWith("tool:")),
    [],
  )
  assert.equal(
    day.shelf.some((slot) => slot.kind === "tool"),
    false,
  )
  assert.equal(day.steps.length, COMPILED_DAY_ORDER.withoutScalp.length)
})

test("an empty Tool guidance renders the same day as no guidance at all", () => {
  const without = renderWashDay({}, false).day
  const empty = toApplicationPageView({
    compiled: {
      days: [
        {
          key: "wash_day",
          outerSequence: COMPILED_DAY_ORDER.withoutScalp,
          productBlocks: COMPILED_DAY_ORDER.withoutScalp.flatMap((entry) =>
            entry.kind === "product" ? [entry.block] : [],
          ),
        },
        { key: "rest_day", outerSequence: [], productBlocks: [] },
      ],
    } as never,
    dayDefinitions: [
      { key: "wash_day", label: "Waschtag", summary: "", sortOrder: 10 },
      { key: "rest_day", label: "Pausentag", summary: "", sortOrder: 80 },
    ] as never,
    tools: { assets: [], occurrences: [], guidance: [] },
  })
  assert.equal(empty.state, "ready")
  if (empty.state !== "ready") return
  const day = empty.days.find((candidate) => candidate.dayType === "wash_day")!
  assert.deepEqual(day, without)
})

test("the adapter places exactly what the engine projects for the day", () => {
  const guidance = lenaToolView().applicationGuidance
  const projected = projectToolsForDay({ dayType: "wash_day", ...guidance })
  const { day } = renderWashDay()
  assert.deepEqual(
    day.steps.flatMap((step) => (step.kind === "tool_use" ? [step.assetKey] : [])).sort(),
    projected.sections.map((section) => section.assetKey).sort(),
  )
  assert.equal(day.shelf.filter((slot) => slot.kind === "tool").length, projected.shelf.length)
})

test("the rendered Waschtag shows Lena's tools as image-led sections, never as pills", () => {
  const { day } = renderWashDay()
  const markup = renderToStaticMarkup(
    <ApplicationDay day={day as ApplicationDayView} overviewHref="/anwendung" />,
  )
  for (const label of ["Mikrofaser-Handtuch", "Föhn", "Glätteisen", "Glatter Kissenbezug"]) {
    assert.ok(markup.includes(label), `${label} is on the Waschtag`)
  }
  assert.ok(markup.includes("data-application-tool-use"))
  for (const forbidden of ["Fähigkeit", "capability-pill", "Tool-Chip"]) {
    assert.equal(markup.includes(forbidden), false)
  }
})

test("a throwing Tool projection drops only the Tool blocks, never the product steps", () => {
  const guidance = lenaToolView().applicationGuidance
  // An occurrence without an anchor makes the projection throw.
  const broken = {
    ...guidance,
    occurrences: guidance.occurrences.map((occurrence) => ({ ...occurrence, anchor: undefined })),
  } as unknown as typeof guidance
  assert.throws(() => projectToolsForDay({ dayType: "wash_day", ...broken }))

  const outerSequence = COMPILED_DAY_ORDER.withoutScalp
  const view = toApplicationPageView({
    compiled: {
      days: [
        {
          key: "wash_day",
          outerSequence,
          productBlocks: outerSequence.flatMap((entry) =>
            entry.kind === "product" ? [entry.block] : [],
          ),
        },
        { key: "rest_day", outerSequence: [], productBlocks: [] },
      ],
    } as never,
    dayDefinitions: [
      { key: "wash_day", label: "Waschtag", summary: "", sortOrder: 10 },
      { key: "rest_day", label: "Pausentag", summary: "", sortOrder: 80 },
    ] as never,
    tools: broken,
  })
  assert.equal(view.state, "ready")
  if (view.state !== "ready") return
  // Exactly the day the compiler produced: same as rendering without Tools.
  assert.deepEqual(
    view.days.find((day) => day.dayType === "wash_day"),
    renderWashDay({}, false).day,
  )
})
