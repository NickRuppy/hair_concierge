import assert from "node:assert/strict"
import test from "node:test"

import { toApplicationPageView } from "@/components/application/application-view-adapter"
import { projectToolsForDay } from "@/lib/personal-plan/tools/application"
import {
  atDayAnchor,
  placementForAnchor,
  TOOL_CAPABILITIES,
  TOOL_DAY_ANCHORS,
  type ToolAsset,
  type ToolDayAnchor,
  type ToolGuidance,
  type ToolOccurrence,
} from "@/lib/personal-plan/tools/contracts"

/**
 * WS6 — the shared day-anchor graph (`D7`, ruled 2026-08-24), asserted on the
 * RENDERED Waschtag rather than on anchor fields alone.
 *
 * The three defects this file pins down are review findings, not hypotheticals:
 * the towel step rendered after Leave-in and heat protection, heated Tool steps
 * rendered with an empty instruction block, and every step-relative anchor
 * collapsed into `post_wash` regardless of where it belonged.
 */

// --- fixtures -----------------------------------------------------------------

function asset(
  assetKey: string,
  family: ToolAsset["family"],
  productType: ToolAsset["productTypes"][number],
  capabilities: ToolAsset["capabilities"],
  labelDe: string,
): ToolAsset {
  return {
    assetKey,
    family,
    productTypes: [productType],
    capabilities,
    ownership: "owned_generic",
    presentationState: "use_yours",
    routeKeys: [`tool:${family}:${assetKey}`],
    labelKey: labelDe,
    purposeKey: `Damit du ${labelDe} sinnvoll einsetzt`,
    imageKey: productType,
  }
}

const TOWEL = asset(
  "asset:drying_textiles:microfiber_towel",
  "drying_textiles",
  "microfiber_towel",
  ["absorb_water"],
  "Mikrofaser-Handtuch",
)
const COMB = asset(
  "asset:brushes_combs:wide_tooth_comb",
  "brushes_combs",
  "wide_tooth_comb",
  ["detangle"],
  "Grobzinkiger Kamm",
)
const DRYER = asset("asset:airflow:hair_dryer", "airflow", "hair_dryer", ["dry_hair"], "Föhn")
const IRON = asset(
  "asset:heated_styling:heated_rollers",
  "heated_styling",
  "heated_rollers",
  ["create_volume", "set_style"],
  "Thermoroller",
)
const BONNET = asset(
  "asset:night_protection:bonnet",
  "night_protection",
  "bonnet",
  ["reduce_surface_friction"],
  "Bonnet",
)

const ASSETS = [TOWEL, COMB, DRYER, IRON, BONNET]

function occurrence(
  target: ToolAsset,
  capability: ToolOccurrence["capability"],
  position: ToolDayAnchor,
): ToolOccurrence {
  return {
    occurrenceKey: `occurrence:${target.assetKey}:${position}`,
    assetKey: target.assetKey,
    routeKey: target.routeKeys[0],
    capability,
    anchor: atDayAnchor(position),
    sessionKey: null,
    executable: true,
    conditionalReason: null,
  }
}

// Deliberately out of day order — the projection must sort them itself.
const OCCURRENCES: ToolOccurrence[] = [
  occurrence(BONNET, "reduce_surface_friction", "nightly"),
  occurrence(IRON, "create_volume", "heat_tool"),
  occurrence(DRYER, "dry_hair", "dry_pre_heat"),
  occurrence(COMB, "detangle", "post_rinse_towel_dry"),
  occurrence(TOWEL, "absorb_water", "post_rinse_towel_dry"),
]

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

/** A realistic Waschtag: cleanse, condition, leave-in, heat protection, finish. */
const SHAMPOO = block("shampoo", "Mildes Shampoo", ["cleanse"], "shampoo", "wet_cleanse")
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

type OuterSequenceEntry =
  | { kind: "product"; block: Block }
  | { kind: "state_transition"; fromAnchor: string; toAnchor: string; copyDe: string }

function renderWashDay(input: {
  occurrences?: readonly ToolOccurrence[]
  guidance?: readonly ToolGuidance[]
  blocks?: readonly Block[]
  assets?: readonly ToolAsset[]
  /** Overrides the plain product-only sequence, e.g. to inject a compiler transition. */
  outerSequence?: readonly OuterSequenceEntry[]
}) {
  const blocks = input.blocks ?? [SHAMPOO, CONDITIONER, LEAVE_IN, HEAT_PROTECTION, FINISH_OIL]
  const outerSequence =
    input.outerSequence ?? blocks.map((entry) => ({ kind: "product" as const, block: entry }))
  const view = toApplicationPageView({
    compiled: {
      days: [
        {
          key: "wash_day",
          outerSequence,
          productBlocks: blocks,
        },
        { key: "rest_day", outerSequence: [], productBlocks: [] },
      ],
    } as never,
    dayDefinitions: [
      { key: "wash_day", label: "Waschtag", summary: "", sortOrder: 10 },
      { key: "rest_day", label: "Pausentag", summary: "", sortOrder: 80 },
    ] as never,
    tools: {
      assets: input.assets ?? ASSETS,
      occurrences: input.occurrences ?? OCCURRENCES,
      guidance: input.guidance ?? [],
    },
  })
  assert.equal(view.state, "ready")
  if (view.state !== "ready") throw new Error("unreachable")
  const day = view.days.find((candidate) => candidate.dayType === "wash_day")
  if (!day) throw new Error("missing wash_day")
  return {
    day,
    order: day.steps.map((step) =>
      step.kind === "tool_use" ? `tool:${step.assetKey}` : `step:${step.stepKey}`,
    ),
  }
}

// --- the graph itself ---------------------------------------------------------

test("the shared day graph is the extended 11-position graph, nightly last", () => {
  assert.deepEqual(
    [...TOOL_DAY_ANCHORS],
    [
      "pre_wash",
      "wet_cleanse",
      "post_cleanse_rinse_off",
      "post_rinse_towel_dry",
      "timed_treatment",
      "damp_leave_on",
      "dry_pre_heat",
      "heat_tool",
      "dry_finish",
      "styling_session",
      "nightly",
    ],
  )
})

test("ToolPlacement is derived from the graph, never defined beside it", () => {
  const derived = TOOL_DAY_ANCHORS.map((position) => placementForAnchor(atDayAnchor(position)))
  assert.deepEqual(derived, [
    "wash",
    "wash",
    "wash",
    "post_wash",
    "post_wash",
    "post_wash",
    "drying",
    "drying",
    "drying",
    "styling",
    "nightly",
  ])
})

test("a step-relative anchor keeps its own graph position", () => {
  const relative = atDayAnchor("post_rinse_towel_dry", { side: "after", stepKey: "conditioner" })
  assert.equal(placementForAnchor(relative), "post_wash")
  const stylingRelative = atDayAnchor("styling_session", { side: "before", stepKey: "oil" })
  assert.equal(
    placementForAnchor(stylingRelative),
    "styling",
    "a step-relative anchor must not collapse into post_wash",
  )
})

// --- defect 1: the towel step renders before Leave-in and heat protection -----

test("the towel step renders before Leave-in and heat protection on the Waschtag", () => {
  const { order } = renderWashDay({})
  const towelAt = order.indexOf(`tool:${TOWEL.assetKey}`)
  const conditionerAt = order.indexOf("step:conditioner")
  const leaveInAt = order.indexOf("step:leave-in")
  const heatProtectionAt = order.indexOf("step:heat-protection")

  assert.ok(towelAt >= 0, "the towel step renders")
  assert.ok(conditionerAt < towelAt, "a real wash day towels after rinsing the conditioner out")
  assert.ok(towelAt < leaveInAt, "the towel comes before the Leave-in is applied")
  assert.ok(towelAt < heatProtectionAt, "the towel comes before heat protection")
})

// --- WS7: the compiler's own towel transition dedupes against the Tool step -

const TOWEL_TRANSITION_COPY_DE = "Sanft mit einem Handtuch ausdrücken."

const SEQUENCE_WITH_COMPILER_TOWEL_TRANSITION: OuterSequenceEntry[] = [
  { kind: "product", block: SHAMPOO },
  { kind: "product", block: CONDITIONER },
  {
    kind: "state_transition",
    fromAnchor: "post_cleanse_rinse_off",
    toAnchor: "post_rinse_towel_dry",
    copyDe: TOWEL_TRANSITION_COPY_DE,
  },
  { kind: "product", block: LEAVE_IN },
  { kind: "product", block: HEAT_PROTECTION },
  { kind: "product", block: FINISH_OIL },
]

function towelInstructionCount(day: ReturnType<typeof renderWashDay>["day"]): number {
  return day.steps.filter((step) => {
    if (step.kind === "transition") return step.copyDe === TOWEL_TRANSITION_COPY_DE
    if (step.kind === "tool_use") return step.assetKey === TOWEL.assetKey
    return false
  }).length
}

test("a drying-textile Tool step suppresses the compiler's own towel transition", () => {
  const { day } = renderWashDay({
    outerSequence: SEQUENCE_WITH_COMPILER_TOWEL_TRANSITION,
    occurrences: [occurrence(TOWEL, "absorb_water", "post_rinse_towel_dry")],
  })
  assert.equal(
    towelInstructionCount(day),
    1,
    "exactly one towel instruction renders once the Tool step covers the same position",
  )
  const genericTransitionStillPresent = day.steps.some(
    (step) => step.kind === "transition" && step.copyDe === TOWEL_TRANSITION_COPY_DE,
  )
  assert.equal(genericTransitionStillPresent, false, "the compiler's generic line is dropped")
})

test("a day without a towel Tool step keeps the compiler's own towel transition", () => {
  const { day } = renderWashDay({
    outerSequence: SEQUENCE_WITH_COMPILER_TOWEL_TRANSITION,
    // No towel occurrence at all — a brush at the same position must not
    // suppress the compiler's line, only a drying-textile Tool step may.
    occurrences: [occurrence(COMB, "detangle", "post_rinse_towel_dry")],
  })
  assert.equal(
    towelInstructionCount(day),
    1,
    "the compiler's towel transition still renders when nothing dedupes it",
  )
  const genericTransitionStillPresent = day.steps.some(
    (step) => step.kind === "transition" && step.copyDe === TOWEL_TRANSITION_COPY_DE,
  )
  assert.equal(
    genericTransitionStillPresent,
    true,
    "no drying-textile Tool step means nothing to dedupe against",
  )
})

test("behaviour-only towel guidance lands at the same graph position", () => {
  const guidance: ToolGuidance[] = [
    {
      guidanceKey: "guidance:tool:drying_textiles:gentle_towel_handling",
      routeKey: "tool:drying_textiles:gentle_towel_handling",
      anchor: atDayAnchor("post_rinse_towel_dry"),
      copyKey: "personal_plan.tools.guidance.gentle_towel_handling",
      strength: "firm",
    },
  ]
  const { order } = renderWashDay({ occurrences: [], guidance })
  const guidanceAt = order.indexOf("step:guidance:tool:drying_textiles:gentle_towel_handling")
  assert.ok(guidanceAt >= 0)
  assert.ok(order.indexOf("step:conditioner") < guidanceAt)
  assert.ok(guidanceAt < order.indexOf("step:leave-in"))
})

test("a step-relative anchor refines the position instead of replacing it", () => {
  const relative: ToolOccurrence = {
    ...occurrence(COMB, "detangle", "post_rinse_towel_dry"),
    anchor: atDayAnchor("post_rinse_towel_dry", { side: "before", stepKey: "conditioner" }),
  }
  const { order } = renderWashDay({ occurrences: [relative] })
  const combAt = order.indexOf(`tool:${COMB.assetKey}`)
  // Without the refinement the position alone would place it AFTER the
  // conditioner; the refinement moves it one step, and no further.
  assert.equal(combAt, order.indexOf("step:conditioner") - 1)
  assert.ok(order.indexOf("step:shampoo") < combAt)
})

// --- defect 2: heat protection precedes heated Tool use ----------------------

test("heat protection renders before the heated Tool step, drying before the finish", () => {
  const { order } = renderWashDay({})
  const heatProtectionAt = order.indexOf("step:heat-protection")
  const dryerAt = order.indexOf(`tool:${DRYER.assetKey}`)
  const ironAt = order.indexOf(`tool:${IRON.assetKey}`)
  const finishAt = order.indexOf("step:oil")
  const nightlyAt = order.indexOf(`tool:${BONNET.assetKey}`)

  assert.ok(heatProtectionAt >= 0 && ironAt >= 0)
  assert.ok(heatProtectionAt < ironAt, "heat protection precedes heated Tool use")
  assert.ok(dryerAt < ironAt, "pre-drying precedes the heated tool")
  assert.ok(ironAt < finishAt, "styling happens before the finishing product")
  assert.equal(nightlyAt, order.length - 1, "the nightly step stays last")
})

// --- defect 3: every recommended step carries usable instructions -------------

test("every capability the plan can anchor carries German instructions", () => {
  for (const capability of TOOL_CAPABILITIES) {
    const projection = projectToolsForDay({
      dayType: "wash_day",
      assets: [IRON],
      occurrences: [occurrence(IRON, capability, "heat_tool")],
      guidance: [],
    })
    const section = projection.sections[0]
    assert.ok(section, `${capability} must produce a section`)
    assert.ok(
      section.actionsDe.length > 0,
      `${capability} renders an empty instruction block — the step is useless`,
    )
    for (const action of section.actionsDe) {
      assert.ok(action.length > 12, `${capability}: "${action}" is not a usable instruction`)
      assert.equal(
        TOOL_CAPABILITIES.some((token) => action.includes(token)),
        false,
        `${capability}: the raw token leaked into user-visible copy — "${action}"`,
      )
    }
  }
})

test("the heated set step renders instructions, not an empty block", () => {
  const { day } = renderWashDay({})
  const iron = day.steps.find((step) => step.kind === "tool_use" && step.assetKey === IRON.assetKey)
  assert.ok(iron && iron.kind === "tool_use")
  assert.ok(iron.actionsDe.length > 0)
})

// --- day gating ---------------------------------------------------------------

test("a heated Tool session happens on wash days and on the styling day", () => {
  const present = [
    "wash_day",
    "intensive_care_day",
    "bond_repair_day",
    "clarifying_wash_day",
    "styling_day",
  ] as const
  for (const dayType of present) {
    const projection = projectToolsForDay({
      dayType,
      assets: [IRON],
      occurrences: [occurrence(IRON, "create_volume", "heat_tool")],
      guidance: [],
    })
    assert.equal(projection.sections.length, 1, `${dayType} must keep the heated Tool step`)
  }
  for (const dayType of ["refresh_day", "between_wash_care_day", "rest_day"] as const) {
    const projection = projectToolsForDay({
      dayType,
      assets: [IRON],
      occurrences: [occurrence(IRON, "create_volume", "heat_tool")],
      guidance: [],
    })
    assert.equal(projection.sections.length, 0, `${dayType} has no styling session`)
  }
})

test("a wash-phase Tool never leaks onto the styling day", () => {
  const projection = projectToolsForDay({
    dayType: "styling_day",
    assets: [TOWEL],
    occurrences: [occurrence(TOWEL, "absorb_water", "post_rinse_towel_dry")],
    guidance: [],
  })
  assert.equal(projection.sections.length, 0)
})

// --- ready-check rulings 2026-08-25 --------------------------------------------

const APPLICATOR = asset(
  "asset:wash_application:applicator_bottle",
  "wash_application",
  "applicator_bottle",
  ["apply_product"],
  "Applikatorflasche",
)

test("the Applikator renders BEFORE its scalp product (ready-check ruling)", () => {
  const { order } = renderWashDay({
    assets: [...ASSETS, APPLICATOR],
    occurrences: [occurrence(APPLICATOR, "apply_product", "wet_cleanse")],
  })
  const applicatorAt = order.indexOf(`tool:${APPLICATOR.assetKey}`)
  assert.ok(applicatorAt >= 0)
  assert.ok(
    applicatorAt < order.indexOf("step:shampoo"),
    "you pick up the applicator, then apply the product with it",
  )
})

test("the rough-rubbing correction line merges into the towel card when both render", () => {
  const guidance: ToolGuidance[] = [
    {
      guidanceKey: "guidance:tool:drying_textiles:gentle_towel_handling",
      routeKey: "tool:drying_textiles:gentle_towel_handling",
      anchor: atDayAnchor("post_rinse_towel_dry"),
      copyKey: "personal_plan.tools.guidance.gentle_towel_handling",
      strength: "firm",
    },
  ]
  // Towel card present: the separate correction line is dropped — its message
  // lives in the card (ready-check ruling 2026-08-25).
  const withCard = renderWashDay({
    occurrences: [occurrence(TOWEL, "absorb_water", "post_rinse_towel_dry")],
    guidance,
  })
  assert.equal(
    withCard.order.some((id) => id.includes("gentle_towel_handling")),
    false,
    "one towel line only when the card renders",
  )
  assert.ok(withCard.order.includes(`tool:${TOWEL.assetKey}`))
  // No towel card: rough-rubbing users keep the firm correction.
  const withoutCard = renderWashDay({ occurrences: [], guidance })
  assert.equal(
    withoutCard.order.some((id) => id.includes("gentle_towel_handling")),
    true,
    "the firm correction survives without a towel card",
  )
})
