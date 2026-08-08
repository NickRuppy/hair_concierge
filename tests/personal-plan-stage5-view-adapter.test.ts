import assert from "node:assert/strict"
import test from "node:test"

import type { CompiledApplicationViewV1 } from "../src/lib/routines/personal-plan/application/compiler"
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
