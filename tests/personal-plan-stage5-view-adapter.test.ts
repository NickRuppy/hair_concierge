import assert from "node:assert/strict"
import test from "node:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import type { CompiledApplicationViewV1 } from "../src/lib/routines/personal-plan/application/compiler"
import { ApplicationPage } from "../src/components/application/application-page"
import { toApplicationPageView } from "../src/components/application/application-view-adapter"

const shampooId = "11111111-1111-4111-8111-111111111111"

function compiledView(): CompiledApplicationViewV1 {
  const shampoo = {
    productId: shampooId,
    productName: "Mildes Shampoo",
    category: "shampoo" as const,
    roles: ["cleanse" as const],
    applicationInstanceKey: `${shampooId}:wet_cleanse`,
    anchor: "wet_cleanse",
    steps: [
      {
        stepKey: "apply",
        action: "apply_product" as const,
        copyDe: "Auf die nasse Kopfhaut geben und sanft einmassieren.",
      },
    ],
    noteDe: null,
    status: "confirmed" as const,
  }

  return {
    days: [
      {
        key: "wash_day",
        productBlocks: [shampoo],
        outerSequence: [
          {
            kind: "state_transition",
            fromAnchor: "dry",
            toAnchor: "wet_cleanse",
            copyDe: "Haare gründlich mit Wasser anfeuchten.",
          },
          { kind: "product", block: shampoo },
        ],
      },
      { key: "rest_day", productBlocks: [], outerSequence: [] },
    ],
    failures: [],
  }
}

const definitions = [
  {
    key: "wash_day" as const,
    definitionVersion: 1,
    locale: "de" as const,
    label: "Waschtag",
    summary: "Deine vollständige Basiswäsche.",
    sortOrder: 10,
  },
  {
    key: "rest_day" as const,
    definitionVersion: 1,
    locale: "de" as const,
    label: "Pausentag",
    summary: "An einem Pausentag ist keine Anwendung nötig.",
    sortOrder: 80,
  },
]

test("adapts compiler output into the product-led Anwendung view", () => {
  const view = toApplicationPageView({
    compiled: compiledView(),
    dayDefinitions: definitions,
    cadenceByDay: { wash_day: "Bei deiner nächsten Haarwäsche" },
  })

  assert.equal(view.state, "ready")
  if (view.state !== "ready") return

  assert.deepEqual(
    view.days.map(({ dayType, labelDe, sortOrder }) => ({ dayType, labelDe, sortOrder })),
    [
      { dayType: "wash_day", labelDe: "Waschtag", sortOrder: 10 },
      { dayType: "rest_day", labelDe: "Pausentag", sortOrder: 80 },
    ],
  )
  assert.equal(view.days[0].cadenceDe, "Bei deiner nächsten Haarwäsche")
  assert.equal(view.days[0].steps[0].kind, "transition")
  assert.equal(view.days[0].steps[1].kind, "product")
  if (view.days[0].steps[1].kind !== "product") return
  assert.equal(view.days[0].steps[1].categoryLabelDe, "Shampoo")
  assert.equal(view.days[0].steps[1].purposeDe, "Reinigt Kopfhaut und Ansatz.")
  assert.equal(
    view.days[0].steps[1].actions[0].copyDe,
    "Auf die nasse Kopfhaut geben und sanft einmassieren.",
  )
})

test("retains Pausentag as the recovery route when no complete product day exists", () => {
  const view = toApplicationPageView({
    compiled: {
      days: [{ key: "rest_day", productBlocks: [], outerSequence: [] }],
      failures: [{ dayType: "wash_day", reason: "incomplete_guidance" }],
    },
    dayDefinitions: definitions,
  })

  assert.equal(view.state, "no_complete_day")
  if (view.state === "no_complete_day") {
    assert.equal(view.restDay.labelDe, "Pausentag")
  }
})

test("fails closed when a compiled day has no active canonical definition", () => {
  assert.throws(
    () => toApplicationPageView({ compiled: compiledView(), dayDefinitions: definitions.slice(1) }),
    /missing active day definition for wash_day/,
  )
})

test("adapts and renders provisional guidance plus a local unresolved product gap", () => {
  const compiled = compiledView()
  const washDay = compiled.days[0]!
  const provisional = {
    ...washDay.productBlocks[0]!,
    productId: "22222222-2222-4222-8222-222222222222",
    productName: "Vorgemerkter Conditioner",
    category: "conditioner" as const,
    roles: ["condition" as const],
    applicationInstanceKey: "conditioner:application",
    anchor: "post_cleanse_rinse_off",
    status: "provisional" as const,
  }
  const unresolved = {
    productId: null,
    productName: null,
    category: "leave_in" as const,
    role: "leave_in" as const,
    applicationInstanceKey: "leave-in:unresolved",
    status: "unresolved" as const,
  }
  washDay.productBlocks.push(provisional)
  washDay.outerSequence.push(
    { kind: "product", block: provisional },
    { kind: "unresolved_product", block: unresolved },
  )
  washDay.isPartial = true

  const view = toApplicationPageView({ compiled, dayDefinitions: definitions })
  assert.equal(view.state, "ready")
  if (view.state !== "ready") return
  assert.deepEqual(
    view.days[0]!.steps.map((step) => step.kind),
    ["transition", "product", "product", "unresolved_product"],
  )
  assert.equal(view.days[0]!.provisionalProductCount, 1)
  assert.equal(view.days[0]!.unresolvedProductCount, 1)

  const html = renderToStaticMarkup(createElement(ApplicationPage, { view }))
  assert.match(html, /Dein Plan wird noch vervollständigt/)
  assert.match(html, /Teilweise bereit/)

  const selectedHtml = renderToStaticMarkup(
    createElement(ApplicationPage, {
      view: { ...view, selectedDayType: "wash_day" },
    }),
  )
  assert.match(selectedHtml, /Vorläufig/)
  assert.match(selectedHtml, /seine Anwendung ist bereits bekannt/)
  assert.match(selectedHtml, /Produkt noch offen/)
  assert.match(selectedHtml, /Für diese Kategorie fehlen noch ein bestätigtes Produkt/)
})
