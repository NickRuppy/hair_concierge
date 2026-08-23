import assert from "node:assert/strict"
import test from "node:test"
import { renderToStaticMarkup } from "react-dom/server"

import { computeNeedPlan } from "@/lib/personal-plan/compute-stage1"
import {
  buildDirectAcceptanceStage2Defaults,
  directAcceptanceAssumptions,
} from "@/lib/personal-plan/direct-acceptance/defaults"
import { buildPlanProfile } from "@/lib/personal-plan/input"
import {
  projectToolCareFacts,
  projectToolInventoryFromCareFacts,
} from "@/lib/personal-plan/tools/facts"
import {
  computeToolRoutes,
  toolProfileFactsFromPlanProfile,
} from "@/lib/personal-plan/tools/routes"
import { adaptInitialNeedSnapshotToPlanStartViewModel } from "@/components/personal-plan-start/snapshot-adapter"
import { NeedPlanScreen } from "@/components/personal-plan-start/need-plan-screen"
import type { PersonalPlanQuizSubmissionEnvelope } from "@/lib/personal-plan-quiz/types"
import { COMPLETE_V3_PLAN_ENVELOPE } from "./personal-plan/fixtures"

type Answers = PersonalPlanQuizSubmissionEnvelope["answers"]

function planFor(overrides: Partial<Answers>, options: { toolsEnabled?: boolean } = {}) {
  const computed = computeNeedPlan({
    rawEnvelope: {
      ...COMPLETE_V3_PLAN_ENVELOPE,
      answers: { ...COMPLETE_V3_PLAN_ENVELOPE.answers, ...overrides },
    },
    artifactId: "artifact-1",
    projection: "initial_quiz",
    computationVersion: "test",
    createdAt: "2026-08-21T00:00:00.000Z",
  })
  assert.equal(computed.status, "ready")
  if (computed.status !== "ready") throw new Error("unreachable")
  return adaptInitialNeedSnapshotToPlanStartViewModel(computed.snapshot, options)
}

test("Tools off leaves the released Idealplan shape-identical, not just visually equal", () => {
  const off = planFor({ hairLength: "long" })
  // Tool-only properties must be ABSENT while off, not present-and-falsy.
  assert.equal("toolBlock" in (off!.basis as object), false)
  assert.equal("toolsEnabled" in (off as object), false)
  assert.equal("toolContext" in (off as object), false)
  if (off!.optional) assert.equal("toolBlock" in (off!.optional as object), false)
})

test("Tools on adds one compact tier-local block after the care-product cards", () => {
  const on = planFor({ hairLength: "long" }, { toolsEnabled: true })
  const block = on?.basis.toolBlock
  assert.ok(block, "the Basis page gets its own Tool block")
  assert.equal(block?.title, "Deine Tools")
  assert.ok(block!.cards.length > 0)
  const [card] = block!.cards
  assert.equal(card.familyLabel, "Bürsten & Kämme")
  assert.equal(card.stateLabel, "Bestand im Feinschliff prüfen")
  // A durable Tool must not borrow the exact care-product card anatomy.
  for (const forbidden of ["priceLabel", "availabilityLabel", "frequency", "product"]) {
    assert.equal(forbidden in card, false, `${forbidden} must not appear on a Tool card`)
  }
})

test("the Tool block renders its own list without a catalog disclaimer", () => {
  const on = planFor({ hairLength: "long" }, { toolsEnabled: true })
  const markup = renderToStaticMarkup(
    <NeedPlanScreen screen={on!.basis} hasOptionalPage={Boolean(on!.optional)} />,
  )
  assert.ok(markup.includes("data-plan-start-tool-block"))
  assert.ok(markup.includes("Deine Tools"))
  assert.ok(markup.includes("Grobzinkiger Kamm"))
  assert.ok(markup.includes("Bestand im Feinschliff prüfen"))
  assert.equal(
    markup.includes("Für jede Kategorie haben wir das passendste Produkt"),
    true,
    "the existing care-product disclaimer stays above the products, not on Tools",
  )
  const toolSection = markup.slice(markup.indexOf("data-plan-start-tool-block"))
  assert.equal(
    toolSection.includes("aus unserem Katalog"),
    false,
    "the Tool block must not repeat the catalog disclaimer",
  )
})

test("the Idealplan never gains a third page for Tools", () => {
  const on = planFor({ hairLength: "long" }, { toolsEnabled: true })
  assert.deepEqual(Object.keys(on!).includes("tools"), false)
  assert.ok("basis" in on! && "optional" in on!)
})

test("a very short profile with no mismatch gets no Tool block at all", () => {
  const on = planFor(
    {
      hairLength: "very_short",
      currentConcerns: ["low_shine"],
      concernRecurrence: { concernId: "low_shine", frequency: "sometimes" },
      goals: ["moisture"],
    },
    { toolsEnabled: true },
  )
  assert.equal(on?.basis.toolBlock ?? null, null)
})

test("direct accept keeps its shape and only replaces the Night-Protection line", () => {
  const context = {
    relevantCategories: [] as never[],
    hasReportedIrritatedScalp: false,
    dryShampooBridgeEligibility: "ineligible" as const,
  }
  const off = directAcceptanceAssumptions(context)
  const on = directAcceptanceAssumptions(context, { toolsEnabled: true })

  assert.equal(on.length, off.length, "no extra bullet, panel or disclaimer is added")
  assert.deepEqual(
    on.map((assumption) => assumption.id),
    off.map((assumption) => assumption.id),
  )
  const changed = on.filter((assumption, index) => assumption.label !== off[index].label)
  assert.equal(changed.length, 1)
  assert.equal(changed[0].id, "night_protection")
  assert.equal(changed[0].label, "Keine weiteren Tools oder besonderer Nachtschutz eingeplant")

  const byId = new Map(on.map((assumption) => [assumption.id, assumption.label]))
  assert.equal(byId.get("drying_routes"), "Lufttrocknen, kein Föhnen")
  assert.equal(byId.get("additional_heat_tools"), "Keine Hitze-Styling-Geräte")
})

test("the combined line states a planning default and never claims ownership", () => {
  const [line] = directAcceptanceAssumptions(
    {
      relevantCategories: [],
      hasReportedIrritatedScalp: false,
      dryShampooBridgeEligibility: "ineligible",
    },
    { toolsEnabled: true },
  ).filter((assumption) => assumption.id === "night_protection")
  for (const forbidden of ["du hast", "du besitzt", "dein Föhn", "gekauft"]) {
    assert.equal(line.label.toLowerCase().includes(forbidden.toLowerCase()), false)
  }
})

test("direct-accept planning defaults never become Tool ownership", () => {
  const context = {
    relevantCategories: [] as never[],
    hasReportedIrritatedScalp: false,
    dryShampooBridgeEligibility: "ineligible" as const,
  }
  const defaults = buildDirectAcceptanceStage2Defaults(context)

  // These are OUR disclosed assumptions ("Lufttrocknen", "Mikrofaser-Handtuch",
  // "Kein besonderer Nachtschutz"), not the user's answers.
  const assumed = projectToolCareFacts(defaults.answers, "assumed")
  assert.deepEqual(
    projectToolInventoryFromCareFacts(assumed),
    {},
    "an assumption must never claim ownership or explicit absence",
  )

  // The identical answers, if a user had actually reported them, are evidence.
  const reported = projectToolCareFacts(defaults.answers, "reported")
  assert.deepEqual(projectToolInventoryFromCareFacts(reported), {
    airflow: [],
    heated_styling: [],
    drying_textiles: ["microfiber_towel"],
    night_protection: [],
  })
})

test("a directly accepted plan leaves every Tool route unknown", () => {
  const defaults = buildDirectAcceptanceStage2Defaults({
    relevantCategories: [],
    hasReportedIrritatedScalp: false,
    dryShampooBridgeEligibility: "ineligible",
  })
  const care = projectToolCareFacts(defaults.answers, "assumed")
  const routes = computeToolRoutes({
    profile: toolProfileFactsFromPlanProfile(
      buildPlanProfile(COMPLETE_V3_PLAN_ENVELOPE, {
        artifactId: "artifact-1",
        projection: "initial_quiz",
      }),
    ),
    care,
    inventory: {},
    scalpApplicationJob: false,
  })
  assert.ok(routes.length > 0, "direct accept still produces the parallel Tool domain")
  for (const route of routes) {
    if (route.resolution === "behavior_only") continue
    assert.equal(
      route.ownership,
      "unknown",
      `${route.routeKey} must stay unknown after a direct accept`,
    )
  }
})
