import assert from "node:assert/strict"
import test from "node:test"
import { renderToStaticMarkup } from "react-dom/server"

import { ApplicationDay } from "@/components/application/application-day"
import type { ApplicationDayView } from "@/components/application/application-types"
import { projectToolsForDay } from "@/lib/personal-plan/tools/application"
import {
  atDayAnchor,
  type ToolAsset,
  type ToolGuidance,
  type ToolOccurrence,
} from "@/lib/personal-plan/tools/contracts"

const COMB: ToolAsset = {
  assetKey: "asset:brushes_combs:wide_tooth_comb",
  family: "brushes_combs",
  productTypes: ["wide_tooth_comb"],
  capabilities: ["detangle", "distribute_product"],
  ownership: "owned_generic",
  presentationState: "use_yours",
  routeKeys: ["tool:brushes_combs:detangling_foundation"],
  labelKey: "Grobzinkiger Kamm",
  purposeKey: "Zum sanften Entwirren und Verteilen von Produkt",
  imageKey: "wide_tooth_comb",
}

const DRYER: ToolAsset = {
  assetKey: "asset:airflow:hair_dryer",
  family: "airflow",
  productTypes: ["hair_dryer"],
  capabilities: ["dry_hair", "diffuse_airflow"],
  ownership: "unknown",
  presentationState: "check_in_refinement",
  routeKeys: ["tool:airflow:drying_diffused"],
  labelKey: "Föhn",
  purposeKey: "Damit dein Muster beim Trocknen erhalten bleibt",
  imageKey: "hair_dryer",
}

const BONNET: ToolAsset = {
  assetKey: "asset:night_protection:bonnet",
  family: "night_protection",
  productTypes: ["bonnet"],
  capabilities: ["reduce_surface_friction"],
  ownership: "owned_generic",
  presentationState: "use_yours",
  routeKeys: ["tool:night_protection:night_protection"],
  labelKey: "Bonnet",
  purposeKey: "Für weniger Reibung über Nacht",
  imageKey: "bonnet",
}

// Deliberately out of day order: the projection must sort them itself.
const OCCURRENCES: ToolOccurrence[] = [
  {
    occurrenceKey: "occurrence:tool:night_protection:night_protection:nightly",
    assetKey: BONNET.assetKey,
    routeKey: "tool:night_protection:night_protection",
    capability: "reduce_surface_friction",
    anchor: atDayAnchor("nightly"),
    sessionKey: null,
    executable: true,
    conditionalReason: null,
  },
  {
    occurrenceKey: "occurrence:tool:brushes_combs:detangling_foundation:wash_day_post_wash",
    assetKey: COMB.assetKey,
    routeKey: "tool:brushes_combs:detangling_foundation",
    capability: "detangle",
    anchor: atDayAnchor("post_rinse_towel_dry"),
    sessionKey: null,
    executable: true,
    conditionalReason: null,
  },
  {
    occurrenceKey: "occurrence:tool:airflow:drying_diffused:wash_day_drying",
    assetKey: DRYER.assetKey,
    routeKey: "tool:airflow:drying_diffused",
    capability: "diffuse_airflow",
    anchor: atDayAnchor("dry_pre_heat"),
    sessionKey: null,
    executable: false,
    conditionalReason: "unknown_ownership",
  },
]

const COMB_OCCURRENCE = OCCURRENCES.find((occurrence) => occurrence.assetKey === COMB.assetKey)!

const GUIDANCE: ToolGuidance[] = [
  {
    guidanceKey: "guidance:tool:drying_textiles:gentle_towel_handling",
    routeKey: "tool:drying_textiles:gentle_towel_handling",
    anchor: atDayAnchor("post_rinse_towel_dry"),
    copyKey: "personal_plan.tools.guidance.gentle_towel_handling",
    strength: "firm",
  },
]

function project(dayType: Parameters<typeof projectToolsForDay>[0]["dayType"]) {
  return projectToolsForDay({
    dayType,
    assets: [COMB, DRYER, BONNET],
    occurrences: OCCURRENCES,
    guidance: GUIDANCE,
  })
}

test("Tools appear as shelf objects, never as a pill row", () => {
  const projection = project("wash_day")
  assert.deepEqual(
    projection.shelf.map((slot) => slot.kind),
    ["tool", "tool"],
  )
  assert.equal(projection.shelf.length, 2)
  assert.equal(
    projection.shelf.some((slot) => slot.assetKey === DRYER.assetKey),
    false,
    "a Tool the user may not have does not join the shelf",
  )
})

test("each Tool use is its own image-led section in the right order", () => {
  const projection = project("wash_day")
  // Day order is guaranteed by the projection itself, not by occurrence order.
  assert.deepEqual(
    projection.sections.map((section) => section.placement),
    ["post_wash", "drying", "nightly"],
  )
  for (const section of projection.sections) {
    assert.equal(section.kind, "tool_use")
    assert.ok(section.imageUrl.length > 0)
    assert.ok(section.imageAltDe.length > 0)
  }
})

test("behaviour-only guidance stays a normal step with no Tool card", () => {
  const projection = project("wash_day")
  assert.equal(projection.transitions.length, 1)
  assert.equal(
    projection.transitions[0].copyDe,
    "Drücke das Wasser sanft aus oder scrunche es ein – rubbel nicht.",
  )
  assert.equal(
    projection.sections.some((section) => section.assetKey.includes("drying_textiles")),
    false,
  )
})

test("an unverified Tool fails closed on its own step without blocking the day", () => {
  const projection = project("wash_day")
  const drying = projection.sections.find((section) => section.assetKey === DRYER.assetKey)
  assert.equal(
    drying?.conditionalNoteDe,
    "Wir wissen noch nicht, ob du so etwas hast. Ergänze es im Feinschliff.",
  )
  const comb = projection.sections.find((section) => section.assetKey === COMB.assetKey)
  assert.equal(comb?.conditionalNoteDe, null, "the unrelated step stays executable")
})

test("a nightly Tool occurs on every day, a wash Tool only on wash days", () => {
  const rest = project("rest_day")
  assert.deepEqual(
    rest.sections.map((section) => section.assetKey),
    [BONNET.assetKey],
  )
  assert.equal(rest.transitions.length, 0)
})

test("styling Tools are not dropped on intensive-care, bond-repair or clarifying days", () => {
  // These are ordinary wash days; a styling session can genuinely happen on them.
  for (const dayType of [
    "intensive_care_day",
    "bond_repair_day",
    "clarifying_wash_day",
    "styling_day",
  ] as const) {
    const projection = projectToolsForDay({
      dayType,
      assets: [COMB],
      occurrences: [
        {
          ...COMB_OCCURRENCE,
          occurrenceKey: "occurrence:styling",
          anchor: atDayAnchor("styling_session"),
        },
      ],
      guidance: [],
    })
    assert.equal(projection.sections.length, 1, `${dayType} must keep its styling Tool`)
  }
})

test("one physical Tool never produces duplicate shelf objects", () => {
  const projection = projectToolsForDay({
    dayType: "wash_day",
    assets: [COMB],
    occurrences: [
      COMB_OCCURRENCE,
      {
        ...COMB_OCCURRENCE,
        occurrenceKey: "occurrence:tool:brushes_combs:specialized_brush_job:styling_session",
        routeKey: "tool:brushes_combs:specialized_brush_job",
        capability: "distribute_product",
        anchor: atDayAnchor("styling_session"),
      },
    ],
    guidance: [],
  })
  assert.equal(projection.shelf.length, 1)
  assert.equal(projection.sections.length, 2, "each use still gets its own section")
})

test("the rendered day shows an image-led Tool section and no capability pills", () => {
  const projection = project("wash_day")
  const day: ApplicationDayView = {
    dayType: "wash_day",
    sortOrder: 10,
    labelDe: "Waschtag",
    summaryDe: "Waschen und sanft trocknen",
    cadenceDe: null,
    steps: projection.sections,
    isPartial: false,
    provisionalProductCount: 0,
    unresolvedProductCount: 0,
    shelf: projection.shelf,
  }
  const markup = renderToStaticMarkup(<ApplicationDay day={day} />)
  assert.ok(markup.includes("data-application-tool-use"))
  assert.ok(markup.includes("Grobzinkiger Kamm"))
  assert.ok(markup.includes("data-application-tool-conditional"))
  for (const forbidden of ["Fähigkeit", "capability-pill", "Tool-Chip"]) {
    assert.equal(markup.includes(forbidden), false)
  }
})

test("drying and styling Tools are used before the finishing product, nightly stays last", async () => {
  const { toApplicationPageView } =
    await import("@/components/application/application-view-adapter")
  const productBlock = (
    applicationInstanceKey: string,
    productName: string,
    roles: string[],
    category: string,
  ) => ({
    applicationInstanceKey,
    productId: `product-${applicationInstanceKey}`,
    productName,
    imageUrl: null,
    category,
    roles,
    steps: [{ stepKey: `${applicationInstanceKey}:1`, copyDe: "Auftragen." }],
    noteDe: null,
    status: "confirmed" as const,
  })
  const shampoo = productBlock("shampoo", "Mildes Shampoo", ["cleanse"], "shampoo")
  const finishOil = productBlock("oil", "Finish-Öl", ["finish"], "oil")

  const view = toApplicationPageView({
    compiled: {
      days: [
        {
          key: "wash_day",
          outerSequence: [
            { kind: "product" as const, block: shampoo },
            { kind: "product" as const, block: finishOil },
          ],
          productBlocks: [shampoo, finishOil],
        },
        { key: "rest_day", outerSequence: [], productBlocks: [] },
      ],
    } as never,
    dayDefinitions: [
      { key: "wash_day", label: "Waschtag", summary: "", sortOrder: 10 },
      { key: "rest_day", label: "Pausentag", summary: "", sortOrder: 80 },
    ] as never,
    tools: { assets: [COMB, DRYER, BONNET], occurrences: OCCURRENCES, guidance: [] },
  })
  assert.equal(view.state, "ready")
  if (view.state !== "ready") throw new Error("unreachable")
  const washDay = view.days.find((day) => day.dayType === "wash_day")!
  const order = washDay.steps.map((step) =>
    step.kind === "tool_use" ? `tool:${step.assetKey}` : `product:${step.stepKey}`,
  )
  const finishAt = order.indexOf("product:oil")
  const dryerAt = order.indexOf(`tool:${DRYER.assetKey}`)
  const nightlyAt = order.indexOf(`tool:${BONNET.assetKey}`)

  assert.ok(dryerAt >= 0 && finishAt >= 0 && nightlyAt >= 0)
  assert.ok(dryerAt < finishAt, "drying happens before the finishing product")
  assert.ok(finishAt < nightlyAt, "the nightly step stays last")
})
